import WebSocket from "ws";
import CanvasState from "./canvasstate";

class UserMap <V> extends Map <number, V> {}

export default class CanvasLobby {
  id: string;
  userIdCounter = 2; //CALM THIS HAS TO START AT 2 OR ELSE!!!!!!!! IF you add to transferstate then increment this too!!!!!!!!

  // nextUserId = 0;
  // freeIds: Set<number> = new Set();

  activeUsers: Map<number, WebSocket> = new Map();
  syncingUsers: Map<number, WebSocket> = new Map();
  syncingData: Map<number, Uint8Array[]> = new Map();
  transactionIndex = 1; //To init a user the first byte has to be the userId
  transactions: Uint8Array = new Uint8Array(2 ** 27);
  activeUsers = new UserMap<WebSocket>();
  syncingUsers = new UserMap<WebSocket>();
  syncingData = new UserMap<Uint8Array[]>();
  canvasState: CanvasState = new CanvasState(1);
  buildStates = new UserMap<CanvasState>();

  constructor(id: string) {
    this.id = id;
    this.canvasState.snapshotCount = 0;
  }

  addUser(ws: WebSocket) {
    const buildState = new CanvasState(this.transactionIndex);

    this.userIdCounter = (this.userIdCounter + 1);

    this.syncingUsers.set(this.userIdCounter, ws);
    this.syncingData.set(this.userIdCounter, []);
    this.buildStates.set(this.userIdCounter, buildState);

    ws.send(new Uint8Array([254, this.userIdCounter])); //communicate to client what their userID is

    ws.send(this.transactions.subarray(0, this.transactionIndex));
    this.canvasState.send(this.userIdCounter, ws);
    return this.userIdCounter;
  }

  deleteUser(userId: number) {
    this.activeUsers.delete(userId);
    this.syncingUsers.delete(userId);
    this.syncingData.delete(userId);
    this.buildStates.delete(userId);
  }

  handle(userId: number, event: WebSocket.RawData) {
    if (this.activeUsers.has(userId)) this.send(userId, event);
    else this.sync(userId, event);
  }

  send(userId: number, event: WebSocket.RawData) {
    const eventData = new Uint8Array(event as Buffer);
    this.activeUsers.forEach((socket, id) => {
      if (id !== userId) socket.send(eventData);
    });
    this.syncingData.forEach((eventList) => eventList.push(eventData));
    const justTransactions = eventData.subarray(5);
    this.transactions.set(justTransactions, this.transactionIndex);
    this.transactionIndex += justTransactions.length;
  }

  sync(userId: number, event: WebSocket.RawData) {
    const buildState = this.buildStates.get(userId);
    if (!buildState) return;
    buildState.handle(event);
    if (!buildState.isFinished()) return;
    this.canvasState =
      buildState.index > this.canvasState.index ? buildState : this.canvasState;
    this.buildStates.delete(userId);
    const socket = this.syncingUsers.get(userId);
    const syncingData = this.syncingData.get(userId);
    if (!socket || !syncingData) return;
    this.activeUsers.set(userId, socket);
    this.syncingData.delete(userId);
    this.syncingUsers.delete(userId);
    syncingData.forEach((data) => socket.send(data));
  }

  print() {
    console.log("==========================");
    console.log(`Lobby:    ${this.id}`);
    console.log(`Size:     ${formatBytes(this.transactionIndex)}`);
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
