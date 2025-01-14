import WebSocket from "ws";

export default class CanvasLobby {
  id: string;
  userIdCounter = 0;
  activeUsers: Map<number, WebSocket> = new Map();

  transactionIndex = 1; //To init a user the first byte has to be the userId
  transactions: Uint8Array = new Uint8Array(2 ** 27);

  constructor(id: string) {
    this.id = id;
  }

  addUser(ws: WebSocket) {
    this.activeUsers.set(this.userIdCounter, ws);
    this.transactions[0] = this.userIdCounter++ % 256;
    ws.send(this.transactions.subarray(0, this.transactionIndex));
    return this.transactions[0];
  }

  deleteUser(userId: number) {
    if (this.activeUsers.has(userId)) this.activeUsers.delete(userId);
  }

  send(userId: number, event: WebSocket.RawData) {
    const eventData = new Uint8Array(event as Buffer);
    this.activeUsers.forEach((socket, id) => {
      if (id !== userId) socket.send(eventData);
    });
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

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024,
    dm = decimals < 0 ? 0 : decimals,
    sizes = ["Bs", "KBs", "MBs", "GBs", "TBs"],
    i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}
