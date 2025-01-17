import { decodePosition } from "./transaction.js";

let userId = -1;
let firstMessage = true;

export default function socket(input, transactionManager, virtualCanvas) {
  const url = new URL(window.location.href);
  const lobbyCode = url.pathname.split("/").pop();

  const socketString = url.origin.replace(/^http/, "ws");
  const ws = new WebSocket(socketString);

  ws.onopen = () => ws.send(lobbyCode);

  ws.onmessage = (event) => {
    event.data.arrayBuffer().then((buffer) => {
      if (firstMessage) {
        firstMessage = false;
        const eventData = new Uint8Array(buffer);
        userId = eventData[0];
        if (eventData.length > 1)
          transactionManager.pushServer(eventData.subarray(1));
        transactionManager.transactionRenderLoop();
        return;
      }
      const eventData = new Uint8Array(buffer);
      handleCursorData(eventData.subarray(0, 5), virtualCanvas);
      if (eventData.length > 5)
        transactionManager.pushServer(eventData.subarray(5));
    });
  };

  setInterval(() => {
    if (!firstMessage)
      ws.send(
        transactionManager.buildServerMessage(
          userId,
          ...virtualCanvas.positionInCanvas(input.x, input.y)
        )
      );
  }, 16);
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
