import { TransferStateReader } from "./transferstate.js";
import { OP_TYPE } from "./shared/instructionset.js";
import { buildTransaction } from "./transaction.js";
import PresenceManager from "./presencemanager.js";

export default function socket(
  input,
  transactionManager,
  virtualCanvas,
  transactionLog
) {
  const url = new URL(window.location.href);
  const lobbyCode = url.pathname.split("/").pop();
  const socketString = url.origin.replace(/^http/, "ws"); // https an "wss"???
  const ws = new WebSocket(socketString);
  const transferStateReader = new TransferStateReader(
    ws,
    transactionLog,
    virtualCanvas,
    transactionManager
  );

  // const userId = Date.now() % 100000;
  const presenceManager = new PresenceManager(ws, input, virtualCanvas);

  ws.onopen = () => {
    ws.send(lobbyCode);
    ws.open = true;
    // presenceManager.userManager.broadcastUserInfo();
  };

  ws.binaryType = "arraybuffer";
  ws.onmessage = (event) => {
    const eventData = new Uint8Array(event.data);

    //eventData obfuscates what is actually being sent
    const opType = eventData[0];
    //const payload = eventData.subarray(1);

    switch (opType) {
      case OP_TYPE.SYNC:
        transferStateReader.handle(eventData);
        return;
      case OP_TYPE.UPDATE:
        transactionLog.pushServer(eventData.subarray(1));
        return;
      case OP_TYPE.PRESENCE:
        presenceManager.handle(eventData.subarray(1)); //(eventData.subarray(1)) instead of (eventData) because first byte isnt needed since its being routed
        return;
    }
  };

  const update = () => {
    if (transactionLog.unsentTransactions.length) {
      const transactions = transactionLog.unsentTransactions.splice(0);
      ws.send(buildTransaction([OP_TYPE.UPDATE], ...transactions));
    }
    requestAnimationFrame(update);
  };
  update();
}
