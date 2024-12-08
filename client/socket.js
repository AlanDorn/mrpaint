import { decodePosition } from "./transactionmanager.js";

let userId = -1;
let needsSynchronization = true;

export default function socket(input, transactionManager, pencil) {
  const ws = new WebSocket(
    window.location.href.replace(/^http/, "ws").replace(/3000/, "3001")
  );

  function renderTransactions(transactionData) {
    const processedTransactions =
      transactionManager.processTransactions(transactionData);
    const chunkSize = 100; 
    let index = 0;
    //Recursive for loop which doesn't block event loop
    function processNextChunk() {
      const end = Math.min(index + chunkSize, processedTransactions.length);
      for (; index < end; index++) {
        const transaction = processedTransactions[index];
        switch (transaction[1]) {
          case "pencil":
            pencil.drawServer(...transaction.slice(2));
            break;
        }
      }

      if (index < processedTransactions.length) {
        setTimeout(processNextChunk, 0);
      }
    }

    processNextChunk(); // Start processing
  }

  // When a message is sent to this client it is received here
  ws.onmessage = (event) => {
    if (needsSynchronization) {
      event.data.arrayBuffer().then((buffer) => {
        const eventData = new Uint8Array(buffer);
        userId = eventData[0];
        console.log("Synchronizing canvas");

        const startTime = Date.now();
        renderTransactions(eventData.slice(1));
        const endTime = Date.now() - startTime;
        console.log(
          `Finished processing @ ${Math.round(
            eventData.length / 32 / endTime * 1000
          )} TX/S`
        );
        needsSynchronization = false;
        ws.send("synchronized");
      });
      return;
    }

    event.data.arrayBuffer().then((buffer) => {
      const eventData = new Uint8Array(buffer);
      handleCursorData(eventData.slice(0, 5));
      renderTransactions(eventData.slice(5));
    });
  };

  setInterval(() => {
    if (needsSynchronization) return;
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

  const cursorPosition = decodePosition(cursorData.slice(1));
  cursorElement.style.left = `${cursorPosition[0]}px`; // Ensure units are added
  cursorElement.style.top = `${cursorPosition[1]}px`;

  if (cursorElement._removeTimeout) clearTimeout(cursorElement._removeTimeout);

  cursorElement._removeTimeout = setTimeout(() => {
    cursorElement.remove();
  }, 1500);
}
