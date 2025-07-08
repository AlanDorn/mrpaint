import WebSocket from "ws";
import { OP_TYPE, OP_SYNC } from "../client/shared/instructionset.js";
import CanvasLobby from "./canvaslobby.js";

export default class CanvasState {
  index: number;
  snapshotCount = -1;
  snapshots: Uint8Array[] = [];
  png: Uint8Array = new Uint8Array([0]);

  constructor(index: number) {
    this.index = index;
  }

  send(ws: WebSocket, lobby: CanvasLobby) {
    ws.send(
      new Uint8Array([OP_TYPE.SYNC, OP_SYNC.SNAPSHOT_COUNT, this.snapshotCount])
    );
    ws.send(lobby.transactions.subarray(0, lobby.transactionIndex));
    this.snapshots.forEach((snapshot) => ws.send(snapshot));
  }

  handle(event: WebSocket.RawData) {
    const eventData =
      event instanceof Uint8Array
        ? event
        : new Uint8Array(event as ArrayBuffer);
    const syncType = eventData[1];

    switch (syncType) {
      case OP_SYNC.SNAPSHOT_COUNT: //0
        this.snapshotCount = eventData[2];
        return;
      case OP_SYNC.PNG: //1
        this.png = eventData.subarray(2)
        return;
      case OP_SYNC.SNAPSHOTS: //2
        this.snapshots.push(eventData);
        return;
    }
  }

  isFinished() {
    return (
      this.png.length > 1 &&
      this.snapshotCount !== -1 &&
      this.snapshots.length === this.snapshotCount
    );
  }
}
