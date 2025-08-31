import { transactionLog, ws } from "./client.js";
import { OP_TYPE } from "./shared/instructionset.js";

export default class LogManager {
  constructor() {
    const updateMessage = new Uint8Array(2 ** 20); // 1mb
    updateMessage[0] = OP_TYPE.UPDATE;
    // Send queued transactions to the server at 60 FPS
    setInterval(() => {
      if (!transactionLog.unsent.length) return;
      const transactions = transactionLog.unsent;
      transactionLog.unsent = [];
      let inc = 1;
      for (const tx of transactions) {
        updateMessage.set(tx, inc);
        inc += tx.length;
      }
      ws.send(updateMessage.subarray(0, inc));
    }, 1000 / 60);

    ws.socketSelector[OP_TYPE.UPDATE] = (eventData) =>
      transactionLog.pushServer(eventData.subarray(1));
  }
}
