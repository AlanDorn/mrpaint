// CALM: refactor this into seperate classes
// replace this with yours
const ws = new WebSocket("wss://5r83l7fz-3001.use.devtunnels.ms/"); 
const canvas = document.getElementById("myCanvas");
const drawingarea = document.getElementById("drawingarea");
const ctx = canvas.getContext("2d");
let imageData = ctx.createImageData(canvas.width, canvas.height);

//Mouse button input listener
import Input from "./input.js";
const input = new Input();

//Color input listener
import ColorPicker from "./colorpicker.js";
const colorpicker = new ColorPicker();

//A mouse move consitutes a mouse poll, this triggers a render if the mouse is down
document.addEventListener("mousemove", (event) => {
  if (input.mousedown) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(event.clientX - rect.left);
    const y = Math.floor(event.clientY - rect.top);
    renderData(x, y);
  } else {
    lastX = null;
    lastY = null;
  }
});

//last mouse position of not just current user but all users, indexed by id
let lastX = null;
let lastY = null;
//The polling rate of the mouse is less than the dpi of the screen and
//thus renderData renders a line between the last position and the current position of the mouse
function renderData(x, y) {
  if (lastX !== null && lastY !== null) setLine(lastX, lastY, x, y); // Draw a line between the previous and current mouse positions
  lastX = x;
  lastY = y;
}

// Function to set a line between two points (x1, y1) and (x2, y2)
function setLine(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  const xIncrement = dx / steps;
  const yIncrement = dy / steps;
  let x = x1;
  let y = y1;
  for (let i = 0; i <= steps; i++) {
    setPixel(
      Math.round(x),
      Math.round(y),
      colorpicker.color[0],
      colorpicker.color[1],
      colorpicker.color[2]
    ); // Plot pixel
    x += xIncrement; // Increment x
    y += yIncrement; // Increment y
  }
}

const canvasChanges = [];
//Sets the color of a pixel unless it is outside of the bounds
function setPixel(x, y, r, g, b, send = true) {
  if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
    if (send) canvasChanges.push(x, y, r, g, b);
    const index = (y * imageData.width + x) * 4; // Calculate pixel index
    imageData.data[index] = r; // Red
    imageData.data[index + 1] = g; // Green
    imageData.data[index + 2] = b; // Blue
    imageData.data[index + 3] = 255; // Alpha
  }
}

// When a message is sent to this client it is received here
ws.onmessage = (event) => {
  if (canvasChanges.length) ws.send(canvasChanges.join(","));
  canvasChanges.length = 0;

  const data = event.data.split(",").map((str) => Number.parseInt(str));
  for (let index = 0; index < data.length; index += 5)
    setPixel(
      data[index],
      data[index + 1],
      data[index + 2],
      data[index + 3],
      data[index + 4],
      false
    );
};

// This is a loop which updates the screen every 32 ms or ~30 fps.
// Image data stores the new canvas and is updated in other parts of the program.
setInterval(() => {
  ctx.putImageData(imageData, 0, 0); // Render the changes
}, 16);

function resizeCanvas() {
  const rect = drawingarea.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;

  const newImageData = ctx.createImageData(canvas.width, canvas.height);
  const newData = newImageData.data;
  const oldData = imageData.data;

  const transferWidth = Math.min(canvas.width, imageData.width); // Common width
  const transferHeight = Math.min(canvas.height, imageData.height); // Common height

  for (let y = 0; y < transferHeight; y++) {
    for (let x = 0; x < transferWidth; x++) {
      const oldIndex = (y * imageData.width + x) * 4;
      const newIndex = (y * canvas.width + x) * 4;

      newData[newIndex] = oldData[oldIndex]; // Red
      newData[newIndex + 1] = oldData[oldIndex + 1]; // Green
      newData[newIndex + 2] = oldData[oldIndex + 2]; // Blue
      newData[newIndex + 3] = oldData[oldIndex + 3]; // Alpha
    }
  }

  imageData = newImageData; // Update the imageData to the new one
  ctx.putImageData(imageData, 0, 0); // Optionally draw the updated data
}

// Event listener for window resizing
window.addEventListener("resize", resizeCanvas);
resizeCanvas();
