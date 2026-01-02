// import {
//   transactionLog,
//   virtualCanvas,
//   changeTracker,
//   toolbar,
// } from "./client.js";
import { compareTouuid } from "./transaction.js";

const CHUNK_SIZE_POWER = 7;
const CHUNK_SIZE = 2 ** CHUNK_SIZE_POWER;
const MAX_CHUNK_POWER = 15 - CHUNK_SIZE_POWER;

const MAX_SLICE = 64;

/**
 * Manages snapshots ("moments") of the canvas state for rollback
 * and recovery in the collaborative editing engine.
 *
 * Responsibilities:
 * - Maintains a pool of reusable offscreen chunks for efficient memory use.
 * - Creates snapshots of changed canvas regions (moments).
 * - Compacts snapshots by merging redundant moments.
 * - Rolls back to the last valid moment when desynchronization occurs.
 */
export default class MomentReplay {
  /**
   * Creates a new MomentReplay.
   *
   * @constructor
   * @property {OffscreenCanvas[]} chunkPool - Pool of recycled chunk canvases for reuse.
   * @property {Array<Object>} moments - Ordered list of saved snapshot moments.
   * @property {RollbackEntry[]} rollbackChunks - List of chunks queued for redraw after rollback.
   * @property {OffscreenCanvas} whiteChunk - Pre-filled white chunk used as fallback when resetting.
   */
  constructor({transactionLog, virtualCanvas, changeTracker, toolbar}) {
    this.transactionLog = transactionLog;
    this.virtualCanvas = virtualCanvas;
    this.changeTracker = changeTracker;
    this.toolbar = toolbar;

    this.chunkPool = [];
    this.moments = [];
    this.rollbackChunks = [];
    this.whiteChunk = new OffscreenCanvas(CHUNK_SIZE, CHUNK_SIZE);
    const whiteChunkCtx = this.whiteChunk.getContext("2d");
    whiteChunkCtx.fillStyle = "white";
    whiteChunkCtx.fillRect(0, 0, CHUNK_SIZE, CHUNK_SIZE);
  }

  /**
   * Get a new or recycled chunk canvas.
   *
   * @private
   * @returns {OffscreenCanvas} A chunk canvas sized to CHUNK_SIZE × CHUNK_SIZE.
   */
  newChunk = () =>
    this.chunkPool.pop() || new OffscreenCanvas(CHUNK_SIZE, CHUNK_SIZE);

  /**
   * Recycle a chunk canvas back into the pool.
   * Clears its contents to a transparent state.
   *
   * @private
   * @param {OffscreenCanvas} chunk - The chunk canvas to recycle.
   * @returns {number} The new length of the chunk pool after pushing.
   */
  oldChunk = (chunk) =>
    this.chunkPool.push(chunk) &&
    chunk.getContext("2d").clearRect(0, 0, CHUNK_SIZE, CHUNK_SIZE);

  /**
   * Creates a new snapshot (moment) of all changed chunks in the canvas.
   *
   * Steps:
   * - Captures changed regions from the `virtualCanvas` into chunks.
   * - Adds the snapshot to `moments`.
   * - Compacts snapshots by merging with the next moment if redundant.
   *
   * @returns {void}
   */
  snapshot() {
    const { transactions } = this.transactionLog;
    const transaction = transactions[this.transactionLog.rendered - 1];
    const time = this.transactionLog.rendered - 1;
    const changedChunks = new Map();

    for (const pos of this.changeTracker) {
      const row = (pos >> MAX_CHUNK_POWER) * CHUNK_SIZE;
      const col = (pos & ((1 << MAX_CHUNK_POWER) - 1)) * CHUNK_SIZE;
      const chunk = this.newChunk();
      chunk
        .getContext("2d")
        .drawImage(
          this.virtualCanvas.offscreenCanvas,
          col,
          row,
          CHUNK_SIZE,
          CHUNK_SIZE,
          0,
          0,
          CHUNK_SIZE,
          CHUNK_SIZE
        );
      changedChunks.set(pos, chunk);
    }
    this.changeTracker.clear();

    this.moments.push({
      transaction,
      time,
      changedChunks,
      width: this.virtualCanvas.width,
      height: this.virtualCanvas.height,
      col: Math.ceil(this.virtualCanvas.width / CHUNK_SIZE),
      row: Math.ceil(this.virtualCanvas.height / CHUNK_SIZE),
    });

    // Compact moments to avoid storing redundant snapshots
    if (this.moments.length < 2) return;
    let prevTime = 0;
    const lastTime = transactions.length - 1;
    for (let mom = 0; mom < this.moments.length - 1; mom++) {
      const cur = this.moments[mom];
      const isSpacious =
        lastTime - prevTime >
        (lastTime - cur.time) * (Math.log10(lastTime - cur.time + 1) / 2);
      if (isSpacious) prevTime = cur.time;
      else {
        const next = this.moments[mom + 1];
        for (const [pos, chunk] of cur.changedChunks) {
          let isNeeded = !next.changedChunks.has(pos);
          isNeeded &&= pos >> MAX_CHUNK_POWER < next.row;
          isNeeded &&= (pos & ((1 << MAX_CHUNK_POWER) - 1)) < next.col;
          if (isNeeded) next.changedChunks.set(pos, chunk);
          else this.oldChunk(chunk); // recycle unused chunks
        }
        this.moments.splice(mom--, 1);
      }
    }
  }

  /**
   * Rolls back the canvas state to the most recent valid snapshot.
   *
   * Steps:
   * - Finds the rollback moment relative to the given transaction.
   * - Resets or redraws the canvas using stored chunk data.
   * - Tracks and re-applies changes since the rollback moment.
   * - Recycles unnecessary chunks into the pool.
   *
   * @param {Uint8Array} transaction - Transaction to roll back to.
   * @returns {void}
   */
  rollback(transaction) {
    const desyncedMoments = [];
    // Extract moments that occur after the rollback transaction
    for (let index = 0; index < this.moments.length; index++) {
      const momentTransaction = this.moments[index].transaction;
      if (compareTouuid(momentTransaction, transaction) <= 0) continue;
      desyncedMoments.push(...this.moments.splice(index));
      break;
    }

    // If no valid moments remain, reset entirely
    if (!this.moments.length) {
      this.virtualCanvas.reset();
      this.toolbar.viewport.setAdjusters();
      this.toolbar.statusbar.setCanvasSize();
      this.transactionLog.rendered = 0;
      this.changeTracker.clear();
      for (const { changedChunks } of desyncedMoments)
        for (const [, chunk] of changedChunks) this.oldChunk(chunk);
      return;
    }

    // Roll back to the last valid moment
    const rollbackMoment = this.moments[this.moments.length - 1];
    const rollbackRow = rollbackMoment.row;
    const rollbackCol = rollbackMoment.col;

    const locationOfChanges = new Set();
    let minDesyncRow = Math.ceil(this.virtualCanvas.height / CHUNK_SIZE);
    let minDesyncCol = Math.ceil(this.virtualCanvas.width / CHUNK_SIZE);

    // Collect all changes from desynced moments
    for (const { changedChunks, row, col } of desyncedMoments) {
      minDesyncRow = Math.min(minDesyncRow, row);
      minDesyncCol = Math.min(minDesyncCol, col);
      for (const [pos] of changedChunks) {
        let inside = pos >> MAX_CHUNK_POWER < rollbackRow;
        inside &&= (pos & ((1 << MAX_CHUNK_POWER) - 1)) < rollbackCol;
        if (inside) locationOfChanges.add(pos);
      }
    }

    // Recycle desynced chunks
    for (const { changedChunks } of desyncedMoments)
      for (const [, chunk] of changedChunks) this.oldChunk(chunk);

    // Track size-related changes
    for (let row = 0; row < rollbackRow; row++)
      for (let col = 0; col < rollbackCol; col++) {
        if (row < minDesyncRow && col < minDesyncCol) continue;
        locationOfChanges.add((row << MAX_CHUNK_POWER) | col);
      }

    // Track unsnapshotted changes
    for (const pos of this.changeTracker) {
      let inside = pos >> MAX_CHUNK_POWER < rollbackRow;
      inside &&= (pos & ((1 << MAX_CHUNK_POWER) - 1)) < rollbackCol;
      if (inside) locationOfChanges.add(pos);
    }
    this.changeTracker.clear();

    // Track unrollbacked changes
    for (const [pos] of this.rollbackChunks) {
      let inside = pos >> MAX_CHUNK_POWER < rollbackRow;
      inside &&= (pos & ((1 << MAX_CHUNK_POWER) - 1)) < rollbackCol;
      if (inside) locationOfChanges.add(pos);
    }

    // Gather final chunk list for render slicing
    this.rollbackChunks = [];
    for (const pos of locationOfChanges) {
      let needSet = true;
      for (let mom = this.moments.length - 1; mom >= 0 && needSet; mom--) {
        if (!this.moments[mom].changedChunks.has(pos)) continue;
        const chunk = this.moments[mom].changedChunks.get(pos);
        this.rollbackChunks.push([pos, chunk]);
        needSet = false;
      }
      if (needSet) this.rollbackChunks.push([pos, this.whiteChunk]);
    }

    // Apply rollback moment to the canvas
    this.virtualCanvas.setSize(rollbackMoment.width, rollbackMoment.height);
    this.toolbar.viewport.setAdjusters();
    this.toolbar.statusbar.setCanvasSize();
    this.transactionLog.rendered =
      this.transactionLog.transactionIndex(rollbackMoment.transaction) + 1;
  }

  /**
   * Draws pending rollback chunks in time-sliced batches.
   * Call repeatedly until `rollbackChunks` is empty.
   *
   * @param {number} deadLine - Time budget (timestamp).
   * @returns {void}
   */
  rollbackSlice(deadLine) {
    while (this.rollbackChunks.length && performance.now() < deadLine)
      for (let i = 0; i < MAX_SLICE && this.rollbackChunks.length; i++) {
        const [pos, chunk] = this.rollbackChunks.pop();
        const row = pos >> MAX_CHUNK_POWER;
        const col = pos & ((1 << MAX_CHUNK_POWER) - 1);
        this.virtualCanvas.offscreenCtx.drawImage(
          chunk,
          col * CHUNK_SIZE,
          row * CHUNK_SIZE
        );
      }
  }
}
