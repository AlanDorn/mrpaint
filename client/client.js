import VirtualCanvas from "./virtualcanvas.js";
const virtualCanvas = new VirtualCanvas();

import ColorPicker from "./colorpicker.js";
const colorpicker = new ColorPicker();

import Pencil from "./pencil.js";
const pencil = new Pencil(virtualCanvas, colorpicker);

//CALM is this the correct location for this?

// AGI: This should get turned into a little class like color picker, eventually if enough of these little classes come around we will make a class that has them all as field members
const brushSizeDropdown = document.getElementById('default-sizes');
  brushSizeDropdown.addEventListener('change', (event) => {
    const newBrushSize = parseInt(event.target.value, 10);
    pencil.setBrushSize(newBrushSize);
  });

import Input from "./input.js";
new Input(pencil);

//BUILD replace this with yours
// http://localhost:3000/
// wss://5r83l7fz-3001.use.devtunnels.ms/
// CALM: Even though this is "Client" code I think client.js should solve the problem of how things get their dependencies not the cliet interfacing code. That should go into it's own class most likely. 
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
