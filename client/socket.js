import { TransferStateReader } from "./transferstate.js";
import { OP_TYPE } from "./shared/instructionset.js";
import { buildTransaction } from "./transaction.js";
import PresenceManager from "./presencemanager.js";


export default function socket(
  input,
  transactionManager,
  transactionLog,
  previewManager,
  virtualCanvas
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
  const presenceManager = new PresenceManager(ws, input, previewManager, virtualCanvas);

  let up = 0;
  let down = 0;
  const FRAMES_PER_WINDOW = 6;
  const upHistory = [];
  const downHistory = [];

  setInterval(() => {
    upHistory.push(up);
    downHistory.push(down);
    up = 0;
    down = 0;
    if (upHistory.length > FRAMES_PER_WINDOW) upHistory.shift();
    if (downHistory.length > FRAMES_PER_WINDOW) downHistory.shift();
    const totalUp = upHistory.reduce((sum, v) => sum + v, 0);
    const totalDown = downHistory.reduce((sum, v) => sum + v, 0);
    virtualCanvas.statusbar.setNetworkUsage(totalUp, totalDown);
  }, 1000 / FRAMES_PER_WINDOW);

  ws.onopen = () => {
    ws.send(lobbyCode);
    ws.open = true;
    // presenceManager.userManager.broadcastUserInfo();
    const orig = ws.send;
    ws.send = function (data) {
      up += data.length;
      return orig.call(this, data);
    };
  };

  ws.binaryType = "arraybuffer";
  ws.onmessage = (event) => {
    const eventData = new Uint8Array(event.data);
    down += eventData.length;
    const opType = eventData[0];
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
