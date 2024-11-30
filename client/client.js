import VirtualCanvas from "./virtualcanvas.js";
const virtualCanvas = new VirtualCanvas();

import ColorPicker from "./colorpicker.js";
const colorpicker = new ColorPicker();

import Pencil from "./pencil.js";
const pencil = new Pencil(virtualCanvas, colorpicker);

import Input from "./input.js";
new Input(pencil);

// replace this with yours
const ws = new WebSocket("wss://5r83l7fz-3001.use.devtunnels.ms/");

// When a message is sent to this client it is received here
ws.onmessage = (event) => {
  const changes = virtualCanvas.pullChanges();
  if (changes) ws.send(changes);

  if(event.data === "none") return;

  const data = event.data.split(",").map((str) => Number.parseInt(str));
  for (let index = 0; index < data.length; index += 5)
    virtualCanvas.setPixelServer(
      data[index],
      data[index + 1],
      data[index + 2],
      data[index + 3],
      data[index + 4]
    );
};
