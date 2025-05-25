import { decodePosition } from "./transaction.js";
import { TransferStateReader, transferState } from "./transferstate.js";

let userId;
let initializing = true;
let newUser = true;

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
  const transferStateReader = new TransferStateReader();

  ws.onopen = () => {
    ws.send(lobbyCode);
  };

  ws.onmessage = (event) => {
    event.data.arrayBuffer().then((buffer) => {
      if (newUser) {
        const eventData = new Uint8Array(buffer);
        if (eventData[0] === 254) {
          userId = eventData[1];
          console.log("userID =", userId);
          newUser = false;
          return;
        }
      }

      if (initializing) {
        const eventData = new Uint8Array(buffer);
        transferStateReader.handle(eventData);
        if (transferStateReader.isFinished()) {
          transactionManager.readState(transferStateReader);
          transactionManager.sendSocket = () => {
            if (!initializing) {
              ws.send(
                transactionManager.buildServerMessage(
                  userId,
                  ...virtualCanvas.positionInCanvas(input.x, input.y)
                )
              );
              // console.log("in onmessage", userId);
            } else if (
              transactionManager.rendered >=
                transactionManager.transactions.length &&
              transactionManager.currentTask.length === 0
            ) {
              transferState(ws, transactionManager);
              transactionLog.initializing = false;
              initializing = false;
            }
          };
        }
        return;
      }

      const eventData = new Uint8Array(buffer);
      handleCursorData(eventData.subarray(0, 5), virtualCanvas);
      transactionLog.pushServer(eventData.subarray(5));
    });
  };
}

function handleCursorData(cursorData, virtualCanvas) {
  const id = cursorData[0];
  if (id === userId) return;

  let cursorElement = document.getElementById("cursor" + id);
  if (!cursorElement) {
    cursorElement = document.createElement("div");
    cursorElement.id = "cursor" + id;
    cursorElement.classList.add("cursor");
    document.body.appendChild(cursorElement);
  }

  const cursorPosition = virtualCanvas.positionInScreen(
    ...decodePosition(cursorData.subarray(1))
  );
  cursorElement.style.left = `${cursorPosition[0]}px`; // Ensure units are added
  cursorElement.style.top = `${cursorPosition[1]}px`;

  if (cursorElement._removeTimeout) clearTimeout(cursorElement._removeTimeout);

  cursorElement._removeTimeout = setTimeout(() => {
    cursorElement.remove();
  }, 1500);
}
