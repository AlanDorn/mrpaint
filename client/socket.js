export default class Socket {
  constructor(input, virtualCanvas) {
    const ws = new WebSocket(
      window.location.href.replace(/^http/, "ws").replace(/3000/, "3001")
    );
let userId = -1;
let needsSynchronization = true;

export default function socket(input, transactionManager, pencil) {
  const ws = new WebSocket(
    window.location.href.replace(/^http/, "ws").replace(/3000/, "3001")
  );

    // When a message is sent to this client it is received here
    ws.onmessage = (event) => {
      //send your data to server
      const position = input.x + "," + input.y;
      const changes = virtualCanvas.pullChanges();
      const message = position + ";" + changes;
      ws.send(message);

      //process data from server
      const [userId, cursorEvent, canvasEvent] = event.data
        .split(";")
        .map((csv) => csv.split(",").map((str) => Number.parseInt(str)));

      //procces cursors

      //CALM: make this somehow get the user's selected color and use that as the cursor color
      for (let index = 0; index < cursorEvent.length; index += 3) {
        const id = cursorEvent[index];
        if (id !== userId[0]) {
          let cursorElement = document.getElementById("cursor" + id);
          if (!cursorElement) {
            cursorElement = document.createElement("div");
            cursorElement.id = "cursor" + id;
            cursorElement.classList.add("cursor");
            document.body.appendChild(cursorElement);
          }
          cursorElement.style.left = `${cursorEvent[index + 1]}px`; // Ensure units are added
          cursorElement.style.top = `${cursorEvent[index + 2]}px`;
  // When a message is sent to this client it is received here
  ws.onmessage = (event) => {
    if (needsSynchronization) {
      needsSynchronization = false;
      userId = Number.parseInt(event.data);
      ws.send("synchronized");
      return;
    }
    //send your data to server
    ws.send(transactionManager.buildServerMessage(input.x, input.y));

    event.data.arrayBuffer().then((buffer) => {
      const eventData = new Uint8Array(buffer);

      const numberOfCursors = eventData[0];
      let dataOffset = 1;
      for (let index = 0; index < numberOfCursors; index++) {
        handleCursorData(eventData.slice(dataOffset, dataOffset + 5));
        dataOffset += 5;
      }

      const transactionData = eventData.slice(dataOffset);
      const processedTransactions =
        transactionManager.processTransactions(transactionData);

      processedTransactions.forEach((transaction) => {
        switch (transaction[1]) {
          case "pencil":
            pencil.drawServer(...transaction.slice(2));
            break;
        }
      });
    });
  };
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
  cursorElement.style.left = `${cursorData[1] * 256 + cursorData[2]}px`; // Ensure units are added
  cursorElement.style.top = `${cursorData[3] * 256 + cursorData[4]}px`;

  if (cursorElement._removeTimeout) clearTimeout(cursorElement._removeTimeout);

  cursorElement._removeTimeout = setTimeout(() => {
    cursorElement.remove();
  }, 500);
}
