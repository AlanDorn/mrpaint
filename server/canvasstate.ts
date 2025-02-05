import WebSocket from "ws";

export default class CanvasState {
  index: number;
  snapshotCount = -1;
  snapshots: Uint8Array[] = [];
  png: Uint8Array = new Uint8Array([0]);

  constructor(index: number) {
    this.index = index;
  }

  send(userId: number, ws: WebSocket) {
    ws.send([1, userId, this.snapshotCount]);
    this.snapshots.forEach((snapshot) => ws.send(snapshot));
  }

  handle(event: WebSocket.RawData) {
    switch (event[0]) {
      case 0:
        this.snapshotCount = event[1];
        break;
      case 1:
        this.png = new Uint8Array(event.slice(1) as Buffer);
        break;
      case 2:
        this.snapshots.push(new Uint8Array(event as Buffer));
        break;
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