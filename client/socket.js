import { decodePosition } from "./transaction.js";

let userId = -1;
let firstMessage = true;

export default function socket(input, transactionManager) {
  const socketString = window.location.href
    .slice(0, -15)
    .replace(/^http/, "ws")
    .replace(/3000/, "3001");
  const lobbyCode = window.location.href.slice(-15);
  const ws = new WebSocket(socketString);

  ws.onopen = () => ws.send(lobbyCode);
  
  ws.onmessage = (event) => {
    event.data.arrayBuffer().then((buffer) => {
      if (firstMessage) {
        firstMessage = false;
        const eventData = new Uint8Array(buffer);
        userId = eventData[0];
        console.log(userId);
        if (eventData.length > 1)
          transactionManager.pushServer(eventData.subarray(1));
        return;
      }
      const eventData = new Uint8Array(buffer);
      handleCursorData(eventData.subarray(0, 5));
      if (eventData.length > 5)
        transactionManager.pushServer(eventData.subarray(5));
    });
  };

  setInterval(() => {
    if (!firstMessage)
      ws.send(transactionManager.buildServerMessage(userId, input.x, input.y));
  }, 16);
}

function handleCursorData(cursorData) {
  const id = cursorData[0];
  if (id === userId) return;

  let cursorElement = document.getElementById("cursor" + id);
  if (!cursorElement) {
    cursorElement = document.createElement("div");
    cursorElement.id = "cursor" + id;
    cursorElement.classList.add("cursor");
    document.body.appendChild(cursorElement);
  }

  const cursorPosition = decodePosition(cursorData.subarray(1));
  cursorElement.style.left = `${cursorPosition[0]}px`; // Ensure units are added
  cursorElement.style.top = `${cursorPosition[1]}px`;

  if (cursorElement._removeTimeout) clearTimeout(cursorElement._removeTimeout);

  cursorElement._removeTimeout = setTimeout(() => {
    cursorElement.remove();
  }, 1500);
}
