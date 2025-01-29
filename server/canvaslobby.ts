import e from "express";
import WebSocket from "ws";

export default class CanvasLobby {
  id: string;
  userIdCounter = 0;
  activeUsers: Map<number, WebSocket> = new Map();
  syncingUsers: Map<number, WebSocket> = new Map();
  syncingData: Map<number, Uint8Array[]> = new Map();

  transactionIndex = 1; //To init a user the first byte has to be the userId
  transactions: Uint8Array = new Uint8Array(2 ** 27);

  renderIndex = 1;


  constructor(id: string) {
    this.id = id;
  }

  addUser(ws: WebSocket) {
    this.userIdCounter++;
    this.userIdCounter %= 256;
    this.syncingUsers.set(this.userIdCounter, ws);
    this.syncingData.set(this.userIdCounter, []);

    this.transactions[0] = this.userIdCounter;
    ws.send(this.transactions.subarray(0, this.transactionIndex));
    return this.userIdCounter;
  }

  deleteUser(userId: number) {
    this.activeUsers.delete(userId);
    this.syncingUsers.delete(userId);
    this.syncingData.delete(userId);
  }

  handle(userId: number, event: WebSocket.RawData) {
    if (this.activeUsers.has(userId)) this.send(userId, event);

    const socket = this.syncingUsers.get(userId);
    const syncingData = this.syncingData.get(userId);

    if (socket && syncingData) {
      this.activeUsers.set(userId, socket);
      for (let i = 0; i < syncingData.length; i++) socket.send(syncingData[i]);
      this.syncingData.delete(userId);
    }
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

  print() {
    console.log("==========================");
    console.log(`Lobby:    ${this.id}`);
    console.log(`Size:     ${formatBytes(this.transactionIndex)}`);
    if (this.activeUsers.size > 0) {
      this.activeUsers.forEach((socket, id) => {
        console.log(`User:     ${id}`);
      });
    } else {
      console.log("No active users.");
    }
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
