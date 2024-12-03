import VirtualCanvas from "./virtualcanvas.js";
const virtualCanvas = new VirtualCanvas();

import ColorPicker from "./colorpicker.js";
const colorpicker = new ColorPicker();

import Pencil from "./pencil.js";
const pencil = new Pencil(virtualCanvas, colorpicker);

//ALAN: is this the correct location for this?

// AGI: This should get turned into a little class like color picker, eventually if enough of these little classes come around we will make a class that has them all as field members
const brushSizeDropdown = document.getElementById("default-sizes");
brushSizeDropdown.addEventListener("change", (event) => {
  const newBrushSize = parseInt(event.target.value, 10);
  pencil.setBrushSize(newBrushSize);
});

import Input from "./input.js";
const input = new Input(pencil);

//BUILD replace this with yours
// http://localhost:3000/
// wss://5r83l7fz-3001.use.devtunnels.ms/

// CALM: this can actually be programmatically set by looking at your url and setting the protocol ws for http and wss for https.
const ws = new WebSocket("wss://5r83l7fz-3001.use.devtunnels.ms/");

// When a message is sent to this client it is received here
ws.onmessage = (event) => {
  // CALM: Even though this is "Client" code I think client.js should solve the problem of how things get their dependencies not the cliet interfacing code. That should go into it's own class most likely.
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
