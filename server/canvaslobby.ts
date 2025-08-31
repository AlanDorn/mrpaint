import WebSocket from "ws";
import CanvasState from "./canvasstate";
import { OP_TYPE } from "../client/shared/instructionset.js";
export default class CanvasLobby {
  id: string;
  users: WebSocket[] = [];
  state: CanvasState = new CanvasState(0, 0);
  buildStates = new Map<WebSocket, CanvasState>();

  constructor(id: string) {
    this.id = id;
  }

  addUser = (ws: WebSocket) => {
    this.users.push(ws);
    this.state.send(ws);
    const newState = new CanvasState(this.state.transactionIndex);
    this.buildStates.set(ws, newState);
    ws.on("message", this.onMessage(ws));
    ws.on("close", this.onClose(ws));
    this.print();
  };

  onMessage = (ws: WebSocket) => (event: Uint8Array) => {
    switch (event[0]) {
      case OP_TYPE.SYNC: return this.sync(ws, event);
      case OP_TYPE.UPDATE: return this.update(ws, event);
      case OP_TYPE.PRESENCE: return this.distribute(ws, event);
    }
  };

  sync(ws: WebSocket, eventData: Uint8Array) {
    const buildState = this.buildStates.get(ws);
    if (!buildState) return;
    buildState.handle(eventData);
    if (!buildState.isFinished()) return;
    this.state.acceptState(buildState);
    this.buildStates.delete(ws);
  }

  update(ws: WebSocket, eventData: Uint8Array) {
    this.state.update(eventData);
    this.distribute(ws, eventData);
  }

  distribute = (ws: WebSocket, eventData: Uint8Array) =>
    this.users.forEach((user) => user !== ws && user.send(eventData));

  onClose = (ws: WebSocket) => () => {
    this.users = this.users.filter((user) => user !== ws);
    this.buildStates.delete(ws);
  };

  print() {
    console.log("==========================");
    console.log(`Lobby:    ${this.id}`);
    console.log(`Users:    ${this.users.length} `);
    this.state.print();
    console.log(`Total:    ${formatBytes(this.bytes())} `);
  }
  bytes() {
    let total = 0;
    // CanvasState memory
    total += this.state.bytes();
    for (const state of this.buildStates.values()) total += state.bytes();
    return total;
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
