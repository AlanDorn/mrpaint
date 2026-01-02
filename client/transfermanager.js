// import {
//   transactionLog,
//   virtualCanvas,
//   changeTracker,
//   momentReplay,
//   mrPaintEngine,
//   ws,
// } from "./client.js";
import { OP_TYPE, OP_SYNC } from "./shared/instructionset.js";
import Compression from "./compression.js";

const { MOMENT_COUNT, MOMENTS, TRANSACTIONS, COMPRESSED_TRANSACTIONS } = OP_SYNC;

/**
 * Coordinates state synchronization (snapshots/moments and transactions)
 * between the local client and the server/peers.
 *
 * Responsibilities:
 * - Receives SYNC frames (moment count, individual moments, raw & compressed transactions).
 * - Waits until all pieces of a sync batch have arrived, then applies them atomically.
 * - During initialization, ensures `mrPaintEngine` does not push transactions itself.
 * - On completion, sends the local state (moments, PNG, compressed transactions) back out.
 */
export default class TransferManager {
  /**
   * Construct a new TransferManager and register the SYNC handler on the socket.
   *
   * @constructor
   * @property {number} momentCount - Expected number of incoming moments (or -1 if unknown).
   * @property {Array<Object>} moments - Received moments (sparse array; filled by index).
   * @property {Uint8Array|null} transactions - Raw (uncompressed) transaction bytes from remote.
   * @property {Uint8Array|null} compressedTransactions - Compressed transaction bytes from remote.
   */
  constructor({transactionLog, virtualCanvas, changeTracker, momentReplay, mrPaintEngine, ws}) {
    this.transactionLog = transactionLog;
    this.virtualCanvas = virtualCanvas;
    this.changeTracker = changeTracker;
    this.momentReplay = momentReplay;
    this.mrPaintEngine = mrPaintEngine;
    this.ws = ws;

    this.compression = new Compression({ virtualCanvas, momentReplay });
    
    this.momentCount = -1;
    this.moments = [];
    this.transactions = null;
    this.compressedTransactions = null;

    // Register handler for SYNC opcode
    this.ws.socketSelector[OP_TYPE.SYNC] = this.handle;
  }

  /**
   * Handle incoming SYNC packets (MOMENT_COUNT, MOMENTS, TRANSACTIONS, COMPRESSED_TRANSACTIONS).
   *
   * @param {Uint8Array} eventData - Binary payload beginning with [OP_TYPE.SYNC, subType, ...data].
   * @returns {void}
   */
  handle = (eventData) => {
    const syncType = eventData[1];

    switch (syncType) {
      case MOMENT_COUNT: {
        console.log("MOMENT_COUNT: ", eventData[2]);
        this.momentCount = eventData[2];
        break;
      }
      case MOMENTS: {
        console.log("MOMENTS: ", eventData[2]);
        const [index, moment] = this.compression.decompressMoment(eventData);
        this.moments[index] = moment;
        break;
      }
      case TRANSACTIONS: {
        console.log("TRANSACTIONS: ", eventData.subarray(2).length);
        this.transactions = eventData.subarray(2);
        break;
      }
      case COMPRESSED_TRANSACTIONS: {
        console.log(
          "COMPRESSED TRANSACTIONS: ",
          formatBytes(eventData.subarray(2).length)
        );
        this.compressedTransactions = eventData.subarray(2);
        break;
      }
    }

    this.processIfFinished();
  };

  /**
   * Apply the sync only after all required inputs are present:
   * - momentCount is known,
   * - all moments [0..momentCount-1] have arrived,
   * - raw & compressed transactions have arrived.
   *
   * Flow:
   * 1) During initial sync, `mrPaintEngine.initializing` is/was true.
   *    While true, the engine will not push transactions itself.
   * 2) Clear local moments; install the remote ones.
   * 3) Save locally-generated transactions caught while syncing; temporarily clear uninserted.
   * 4) Decompress and stage remote compressed transactions; push into log.
   * 5) If there were no moments or no decompressed txs:
   *      push server transactions and done.
   *    Else:
   *      mark the whole canvas as changed, rollback to last moment,
   *      push server transactions and resolve any desync by rolling back again if needed.
   * 6) Render current canvas.
   * 7) Set resync pointers so the renderer resumes from the last transaction.
   * 8) Poll until rendering settles; then:
   *      - send our current state back to peers,
   *      - end initialization,
   *      - reinsert any locally-caught transactions and resolve any desync.
   *
   * @returns {void}
   */
  processIfFinished = () => {
    if (this.momentCount === -1) return;
    if (!this.transactions) return;
    if (!this.compressedTransactions) return;
    for (let index = 0; index < this.momentCount; index++)
      if (!this.moments[index]) return;

    // mrPaintEngine.initializing is/was true. While it's true the engine will not pushTransactions itself.
    console.log("PROCESSING SYNC");

    // Replace local moments with synced moments
    this.momentReplay.moments.length = 0;
    this.momentReplay.moments.push(...this.moments);

    // Preserve transactions created locally while syncing
    const transactionsCaughtWhileSyncing = [...this.transactionLog.uninserted];
    this.transactionLog.uninserted.length = 0;

    // Install decompressed transactions into log
    const decompressed = this.compression.decompressTransaction(this.compressedTransactions);
    for (let index = 0; index < decompressed.length; index++)
      this.transactionLog.uninserted.push(decompressed[index]);
    this.transactionLog.pushTransactions();

    if (this.momentCount === 0 || decompressed.length === 0) {
      // No moments or no decompressed transactions: just append server transactions
      this.transactionLog.pushServer(this.transactions);
      this.transactionLog.pushTransactions();
    } else {
      // We have moments and decompressed txs: redraw from last moment then append server txs
      const { width, height } = this.virtualCanvas;
      this.changeTracker.track(0, 0, width, height); // mark full canvas dirty

      const lastTransaction = this.moments[this.moments.length - 1].transaction;
      this.momentReplay.rollback(lastTransaction);

      this.transactionLog.pushServer(this.transactions);
      const desyncTransaction = this.transactionLog.pushTransactions();
      if (desyncTransaction) this.momentReplay.rollback(desyncTransaction);
    }

    // Paint current state
    this.virtualCanvas.render();

    // Prepare desync pointers to resume from the end
    const lastTransaction =
      this.transactionLog.transactions[this.transactionLog.transactions.length - 1];
    if (lastTransaction) {
      this.transactionLog.desyncType = this.transactionLog.DESYNC.COLLAB;
      this.transactionLog.resyncMoment = lastTransaction;
      this.transactionLog.resyncIndex =
        this.transactionLog.transactionIndex(lastTransaction);
    }

    // Measure how long it takes to finish rendering the remaining transactions
    const transactionsToRender = this.transactionLog.getTransactionsLeft();
    const startTime = performance.now();

    const endInitialization = setInterval(() => {
      // Wait until renderer is idle (no tasks, nothing left)
      if (!this.transactionLog.finished() || this.mrPaintEngine.currentTask) return;

      // Send our state to peers post-initialization
      this.sendState();
      this.transactionLog.desyncType = this.transactionLog.DESYNC.NO;

      // Simple perf log
      const secondsToFinish = (performance.now() - startTime) / 1000;
      console.log(
        transactionsToRender +
          "txs in " +
          secondsToFinish +
          "s @ " +
          transactionsToRender / secondsToFinish +
          "txs/s"
      );

      // End initialization and restore locally-caught transactions
      this.mrPaintEngine.initializing = false;
      this.transactionLog.uninserted.push(...transactionsCaughtWhileSyncing);
      const desycTransaction = this.transactionLog.pushTransactions();
      if (desycTransaction) this.momentReplay.rollback(desycTransaction);

      clearInterval(endInitialization);
    }, 1000 / 10);
  };

  /**
   * Send the local state to the server/peers:
   * - MOMENT_COUNT
   * - (optionally) PNG of the offscreen canvas
   * - all current SNAPSHOTS (moments), compressed
   * - compressed transactions extended with any new raw transactions
   *
   * When there are no transactions, sends 0 count + empty PNG and returns.
   *
   * @returns {void}
   */
  sendState = () => {
    if (!this.transactionLog.transactions.length) {
      console.log("SNAPSHOT_COUNT SENT: ", this.momentReplay.moments.length);

      // MOMENT_COUNT (0)
      const momentCountPacket = new Uint8Array([
        OP_TYPE.SYNC,
        OP_SYNC.MOMENT_COUNT,
        0,
      ]);
      this.ws.send(momentCountPacket);
      console.log("BYTES SENT (MOMENT_COUNT):", momentCountPacket.length);

      // Empty PNG
      const emptyPngPacket = new Uint8Array([OP_TYPE.SYNC, OP_SYNC.PNG, 0, 0]);
      console.log("PNG SENT");
      this.ws.send(emptyPngPacket);
      console.log("BYTES SENT (PNG):", emptyPngPacket.length);
      return;
    }

    // Take a fresh snapshot before sending
    this.momentReplay.snapshot();

    // MOMENT_COUNT
    console.log("SNAPSHOT_COUNT SENT: ", this.momentReplay.moments.length);
    const countPacket = new Uint8Array([
      OP_TYPE.SYNC,
      OP_SYNC.MOMENT_COUNT,
      this.momentReplay.moments.length,
    ]);
    this.ws.send(countPacket);

    // SNAPSHOTS (compressed)
    // console.log("SNAPSHOTS SENT: ", this.momentReplay.moments.length);
    // let snapshotbytes = 0;
    // this.momentReplay.moments.map(this.compression.compressMoment).forEach((m, i) => {
    //   this.ws.send(m);
    //   snapshotbytes += m.length;
    // });
    console.log("SNAPSHOTS SENT: ", this.momentReplay.moments.length);
    let snapshotbytes = 0;
    this.momentReplay.moments.map((moment, i) => this.compression.compressMoment(moment, i)).forEach((m) => {
      this.ws.send(m);
      snapshotbytes += m.length;
    });

    // Rough comparison of pre-compression footprint vs sent bytes
    let precompSnapshotbytes = 0;
    this.momentReplay.moments.forEach((moment) => {
      precompSnapshotbytes += 128 * 128 * 4 * moment.changedChunks.size;
    });
    console.log(
      `BYTES SENT SNAPSHOT:`,
      formatBytes(snapshotbytes),
      precompSnapshotbytes / snapshotbytes
    );

    // PNG of current offscreen canvas
    // this.virtualCanvas.offscreenCanvas
    //   .convertToBlob({ type: "image/png" })
    //   .then((blob) => blob.arrayBuffer())
    //   .then((buf) => {
    //     const pngBytes = new Uint8Array(buf);
    //     const packet = new Uint8Array(2 + pngBytes.length);
    //     packet[0] = OP_TYPE.SYNC;
    //     packet[1] = OP_SYNC.PNG;
    //     packet.set(pngBytes, 2);
    //     this.ws.send(packet);
    //     console.log("BYTES SENT (PNG):", formatBytes(packet.length));
    //   });

    const canvas = this.virtualCanvas.offscreenCanvas;
    const blobPromise = canvas.convertToBlob
      ? canvas.convertToBlob({ type: "image/png" })
      : new Promise((resolve, reject) =>
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob() returned null"))), "image/png")
        );
      
    blobPromise
      .then((blob) => blob.arrayBuffer())
      .then((buf) => {
        const pngBytes = new Uint8Array(buf);
        const packet = new Uint8Array(2 + pngBytes.length);
        packet[0] = OP_TYPE.SYNC;
        packet[1] = OP_SYNC.PNG;
        packet.set(pngBytes, 2);
        this.ws.send(packet);
        console.log("BYTES SENT (PNG):", formatBytes(packet.length));
      })
      .catch((err) => console.error("PNG send failed:", err));

    // Compressed transactions, extended with any new raw transactions
    const txPacket = this.compression.extendCompressedTransaction(
      this.compressedTransactions,
      this.transactions
    );
    this.ws.send(txPacket);
    console.log(
      "BYTES SENT (COMPRESSED TRANSACTIONS):",
      formatBytes(txPacket.length)
    );
  };
}

/**
 * Format a byte count into a human-readable string.
 *
 * Note: `toFixed(dm)` always emits `dm` decimals (including trailing zeros).
 *
 * @param {number} bytes - The number of bytes.
 * @param {number} [decimals=1] - Decimal places to include.
 * @returns {string} Human-readable size, e.g. "12.3 KBs".
 */
function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return "0.0 Bs";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = [" Bs", "KBs", "MBs", "GBs", "TBs"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  // toFixed(dm) will always emit dm decimals (including trailing zeros)
  const value = (bytes / Math.pow(k, i)).toFixed(dm);
  return value + sizes[i];
}
