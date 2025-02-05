import { decodePosition } from "./transaction.js";
import { TransferStateReader, transferState } from "./transferstate.js";

let userId = -1;
let initializing = true;

export default function socket(input, transactionManager, virtualCanvas) {
  const url = new URL(window.location.href);
  const lobbyCode = url.pathname.split("/").pop();
  const socketString = url.origin.replace(/^http/, "ws");
  const ws = new WebSocket(socketString);
  const transferStateReader = new TransferStateReader();

  ws.onopen = () => {
    ws.send(lobbyCode);
  };

  ws.onmessage = (event) => {
    event.data.arrayBuffer().then((buffer) => {
      if (initializing) {
        const eventData = new Uint8Array(buffer);
        transferStateReader.handle(eventData);
        if (transferStateReader.isFinished()) {
          transactionManager.readState(transferStateReader);
          transactionManager.sendSocket = () => {
            if (!initializing)
              ws.send(
                transactionManager.buildServerMessage(
                  userId,
                  ...virtualCanvas.positionInCanvas(input.x, input.y)
                )
              );
            else if (
              transactionManager.rendered >=
                transactionManager.transactions.length &&
              transactionManager.currentTask.length === 0
            ) {
              transferState(ws, transactionManager);
              initializing = false;
            }
          };
        }
        return;
      }

      const eventData = new Uint8Array(buffer);
      handleCursorData(eventData.subarray(0, 5), virtualCanvas);
      transactionManager.pushServer(eventData.subarray(5));
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
