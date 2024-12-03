export default class Socket {
  constructor(input, virtualCanvas) {
    const ws = new WebSocket(
      window.location.href
        .replace(/^http/, "ws")
        .replace(/3000/, "3001")
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

          if (cursorElement._removeTimeout)
            clearTimeout(cursorElement._removeTimeout);

          cursorElement._removeTimeout = setTimeout(() => {
            cursorElement.remove();
          }, 500);
        }
      }

      if (canvasEvent.length < 5) return;
      //process canvas
      for (let index = 0; index < canvasEvent.length; index += 5)
        virtualCanvas.setPixelServer(
          canvasEvent[index],
          canvasEvent[index + 1],
          canvasEvent[index + 2],
          canvasEvent[index + 3],
          canvasEvent[index + 4]
        );
    };
  }
}
