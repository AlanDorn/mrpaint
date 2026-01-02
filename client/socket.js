// import { transactionLog, toolbar } from "./client.js";
import { OP_TYPE } from "./shared/instructionset.js";

const FRAMES_PER_WINDOW = 12;

/**
 * WebSocket wrapper for synchronizing transactions and tracking network usage.
 *
 * - Connects to the server based on the current URL and lobby code.
 * - Tracks network upload/download usage and updates the status bar.
 * - Sends unsent transactions to the server at a fixed interval.
 * - Handles UPDATE messages from the server and routes them to the transaction log.
 * - Automatically reloads the page on disconnect.
 */
export default class Socket extends WebSocket {
  /**
   * Creates a new Socket instance connected to the current lobby.
   *
   * Behavior:
   * - Converts the current page URL into a WebSocket endpoint (`ws://` or `wss://`).
   * - Tracks bandwidth usage in both directions over a sliding window.
   * - Overrides `send` to count outgoing bytes.
   * - Dispatches incoming binary messages based on operation type.
   * - Handles connection errors by retrying and reloading.
   *
   * @constructor
   */
  constructor({transactionLog, toolbar}) {
    const url = new URL(window.location.href);
    const lobbyCode = url.pathname.split("/").pop();
    const socketString = url.origin.replace(/^http/, "ws"); // if https → wss
    super(socketString);

    this.transactionLog = transactionLog;
    this.toolbar = toolbar;

    this.up = 0;
    this.down = 0;
    this.upHistory = [];
    this.downHistory = [];

    // Monitor network usage with a sliding window of N frames
    setInterval(() => {
      this.upHistory.push(this.up);
      this.downHistory.push(this.down);
      this.up = 0;
      this.down = 0;

      if (this.upHistory.length > FRAMES_PER_WINDOW) this.upHistory.shift();
      if (this.downHistory.length > FRAMES_PER_WINDOW) this.downHistory.shift();

      this.toolbar.statusbar.setNetworkUsage(
        this.upHistory.reduce((sum, v) => sum + v, 0),
        this.downHistory.reduce((sum, v) => sum + v, 0)
      );
    }, 1000 / FRAMES_PER_WINDOW);

    this.onopen = () => {
      // Identify with the lobby code
      this.send(lobbyCode);
      this.open = true;

      // Wrap send() to track outgoing bandwidth
      const send = this.send;
      this.send = function (data) {
        this.up += data.length;
        return send.call(this, data);
      };
    };

    /** @type {Object<number, function(Uint8Array):void>}
     *  - Routes ops to handlers by type
     */
    this.socketSelector = {};

    this.binaryType = "arraybuffer";

    this.onmessage = (event) => {
      const eventData = new Uint8Array(event.data);
      this.down += eventData.length;
      const opType = eventData[0];
      this.socketSelector[opType]?.(eventData);
    };

    // attempt clean close after error
    this.onerror = (err) => {
      console.error("WebSocket error:", err);
      setTimeout(() => this.close(), 500);
    };

    // When the connection closes (for any reason), reload the page
    this.onclose = (_) => {
      console.warn("WebSocket disconnected, reconnecting…");
      window.location.reload();
    };
  }
}


//OLD2
/*
import { TransferStateReader } from "./transferstate.js";
import { OP_TYPE } from "./shared/instructionset.js";
import { buildTransaction } from "./transaction.js";
import PresenceManager from "./presencemanager.js";


export default function socket(
  input,
  transactionManager,
  transactionLog,
  previewManager,
  virtualCanvas
) {
  const url = new URL(window.location.href);
  const lobbyCode = url.pathname.split("/").pop();
  const socketString = url.origin.replace(/^http/, "ws"); // https an "wss"???
  const ws = new WebSocket(socketString);
  const transferStateReader = new TransferStateReader(
    ws,
    transactionLog,
    virtualCanvas,
    transactionManager
  );
  const presenceManager = new PresenceManager(ws, input, previewManager, virtualCanvas);

  let up = 0;
  let down = 0;
  const FRAMES_PER_WINDOW = 6;
  const upHistory = [];
  const downHistory = [];

  setInterval(() => {
    upHistory.push(up);
    downHistory.push(down);
    up = 0;
    down = 0;
    if (upHistory.length > FRAMES_PER_WINDOW) upHistory.shift();
    if (downHistory.length > FRAMES_PER_WINDOW) downHistory.shift();
    const totalUp = upHistory.reduce((sum, v) => sum + v, 0);
    const totalDown = downHistory.reduce((sum, v) => sum + v, 0);
    virtualCanvas.statusbar.setNetworkUsage(totalUp, totalDown);
  }, 1000 / FRAMES_PER_WINDOW);

  ws.onopen = () => {
    ws.send(lobbyCode);
    ws.open = true;
    // presenceManager.userManager.broadcastUserInfo();
    const orig = ws.send;
    ws.send = function (data) {
      up += data.length;
      return orig.call(this, data);
    };
  };

  ws.binaryType = "arraybuffer";
  ws.onmessage = (event) => {
    const eventData = new Uint8Array(event.data);
    down += eventData.length;
    const opType = eventData[0];
    switch (opType) {
      case OP_TYPE.SYNC:
        transferStateReader.handle(eventData);
        return;
      case OP_TYPE.UPDATE:
        transactionLog.pushServer(eventData.subarray(1));
        return;

      case OP_TYPE.PRESENCE:
        presenceManager.handle(eventData.subarray(1)); //(eventData.subarray(1)) instead of (eventData) because first byte isnt needed since its being routed
        return;
    }
  };

  const update = () => {
    if (transactionLog.unsentTransactions.length) {
      const transactions = transactionLog.unsentTransactions.splice(0);
      ws.send(buildTransaction([OP_TYPE.UPDATE], ...transactions));
    }
    requestAnimationFrame(update);
  };
  update();
}
*/