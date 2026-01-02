// import { transactionLog, ws } from "./client.js";
import { OP_TYPE } from "./shared/instructionset.js";

export default class LogManager {
  constructor({transactionLog, ws}) {
    this.transactionLog = transactionLog;
    this.ws = ws;

    const updateMessage = new Uint8Array(2 ** 20); // 1mb
    updateMessage[0] = OP_TYPE.UPDATE;
    // Send queued transactions to the server at 60 FPS
    setInterval(() => {
      if (!this.transactionLog.unsent.length) return;
      const transactions = this.transactionLog.unsent;
      this.transactionLog.unsent = [];
      let inc = 1;
      for (const tx of transactions) {
        updateMessage.set(tx, inc);
        inc += tx.length;
      }
      this.ws.send(updateMessage.subarray(0, inc));
    }, 1000 / 60);

    this.ws.socketSelector[OP_TYPE.UPDATE] = (eventData) =>
      this.transactionLog.pushServer(eventData.subarray(1));
  }
}
