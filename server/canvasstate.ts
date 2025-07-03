import WebSocket from "ws";
import { OPCODE, OPCODE_NAME } from "./shared/instructionset.js";

export default class CanvasState {
  index: number;
  snapshotCount = -1;
  snapshots: Uint8Array[] = [];
  png: Uint8Array = new Uint8Array([0]);
  number = 0;

  constructor(index: number) {
    this.index = index;
  }

  send(userId: number, ws: WebSocket) {
    ws.send(
      new Uint8Array([OPCODE.TS_SNAPSHOT_COUNT, userId, this.snapshotCount])
    );
    this.snapshots.forEach((snapshot, i) =>
      ws.send(new Uint8Array([OPCODE.TS_SNAPSHOT, i, ...snapshot]))
    );
  }

  handle(event: WebSocket.RawData) {
    const eventData =
      event instanceof Uint8Array
        ? event
        : new Uint8Array(event as ArrayBuffer);
    const opcode = eventData[0];
    const userId = eventData[1];
    const payload = eventData.subarray(2);

    switch (opcode) {
      case OPCODE.TS_SNAPSHOT_COUNT: //0
      console.log("\nHELLO0\n");
        if (payload.length < 1) {
          console.warn("TS_SNAPSHOT_COUNT received no payload");
          return;
        }
        this.snapshotCount = payload[0];
        break;
      case OPCODE.TS_PNG: //1
      console.log("\nHELLO1\n");
        this.png = new Uint8Array(payload); //this.png = new Uint8Array(payload as Buffer)
        break;
      case OPCODE.TS_SNAPSHOT: //2
      console.log("\nHELLO2\n");
        this.snapshots.push(new Uint8Array(payload)); //this.snapshots.push(new Uint8Array(payload as Buffer)
        break;
      default:
        // if (this.number < 5) {
          console.warn("Unhandled opcode in CanvasState:", opcode);
        //   this.number++;
        // }
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
