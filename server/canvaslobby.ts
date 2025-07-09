import WebSocket from "ws";
import CanvasState from "./canvasstate";
import { OP_TYPE, OP_SYNC } from "../client/shared/instructionset.js";
export default class CanvasLobby {
  id: string;
  users: WebSocket[] = [];
  transactionIndex = 2;
  transactions: Uint8Array = new Uint8Array(2 ** 10);
  canvasState: CanvasState = new CanvasState(2);
  buildStates = new Map<WebSocket, CanvasState>();

  constructor(id: string) {
    this.id = id;
    this.canvasState.snapshotCount = 0;
    this.transactions[0] = OP_TYPE.SYNC;
    this.transactions[1] = OP_SYNC.TRANSACTIONS;
  }

  addUser(ws: WebSocket) {
    this.users.push(ws);
    this.canvasState.send(ws, this);
    this.buildStates.set(ws, new CanvasState(this.transactionIndex));
    ws.on("message", (event: WebSocket.RawData) => this.onMessage(ws, event));
    ws.on("close", () => this.onClose(ws));
    this.print();
  }

  onClose(ws: WebSocket) {
    this.users = this.users.filter((user) => user !== ws);
    this.buildStates.delete(ws);
  }

  onMessage(ws: WebSocket, event: WebSocket.RawData) {
    const eventData =
      event instanceof Uint8Array
        ? event
        : new Uint8Array(event as ArrayBuffer);
    const opType = eventData[0];
    switch (opType) {
      case OP_TYPE.SYNC:
        return this.sync(ws, eventData);
      case OP_TYPE.UPDATE:
        return this.update(ws, eventData);
      case OP_TYPE.PRESENCE:
        return this.distribute(ws, eventData);
    }
  }

  sync(ws: WebSocket, eventData: Uint8Array) {
    const buildState = this.buildStates.get(ws);
    if (!buildState) return;
    buildState.handle(eventData);
    if (!buildState.isFinished()) return;
    if (buildState.index > this.canvasState.index)
      this.canvasState = buildState;
  }

  update(ws: WebSocket, eventData: Uint8Array) {
    const transactions = eventData.subarray(1);
    const neededLength = this.transactionIndex + transactions.length;
    if (neededLength >= this.transactions.length) this.expand();
    this.transactions.set(transactions, this.transactionIndex);
    this.transactionIndex += transactions.length;
    this.distribute(ws, eventData);
  }

  distribute(ws: WebSocket, eventData: Uint8Array) {
    this.users
      .filter((user) => user !== ws)
      .forEach((user) => user.send(eventData));
  }

  expand() {
    const expanded = new Uint8Array(Math.floor(this.transactions.length * 1.5));
    expanded.set(this.transactions);
    this.transactions = expanded;
  }

  print() {
    console.log("==========================");
    console.log(`Lobby:    ${this.id}`);
    console.log(
      `Bytes:     ${formatBytes(this.transactionIndex)} / ${formatBytes(
        this.transactions.length
      )}`
    );
    console.log(`Users:     ${this.users.length} `);
  }
}

function formatBytes(bytes: number, decimals = 3) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024,
    dm = decimals < 0 ? 0 : decimals,
    sizes = ["Bs", "KBs", "MBs", "GBs", "TBs"],
    i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}
