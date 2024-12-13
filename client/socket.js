import { decodePosition } from "./transaction.js";

let userId = -1;
let firstMessage = true;

export default function socket(input, transactionManager) {
  const ws = new WebSocket(
    window.location.href.replace(/^http/, "ws").replace(/3000/, "3001")
  );

  // When a message is sent to this client it is received here
  ws.onmessage = (event) => {
    if (firstMessage) {
      event.data.arrayBuffer().then((buffer) => {
        const eventData = new Uint8Array(buffer);
        userId = eventData[0];
        console.log(userId);
        if (eventData.length > 1)
          transactionManager.pushServer(eventData.slice(1));
        firstMessage = false;
        ws.send("synchronized");
      });
      return;
    }

    event.data.arrayBuffer().then((buffer) => {
      const eventData = new Uint8Array(buffer);
      handleCursorData(eventData.slice(0, 5));
      if(eventData.length > 5)
        transactionManager.pushServer(eventData.slice(5));
    });
  };

  setInterval(() => {
    if (firstMessage) return;
    const transactions = transactionManager.buildServerMessage(userId, input.x, input.y)
    ws.send(transactions);
    //transactionManager.pushServer(transactions.slice(5))
  }, 32);
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

  const cursorPosition = decodePosition(cursorData.slice(1));
  cursorElement.style.left = `${cursorPosition[0]}px`; // Ensure units are added
  cursorElement.style.top = `${cursorPosition[1]}px`;

  if (cursorElement._removeTimeout) clearTimeout(cursorElement._removeTimeout);

  cursorElement._removeTimeout = setTimeout(() => {
    cursorElement.remove();
  }, 1500);
}
