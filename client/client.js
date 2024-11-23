const ws = new WebSocket("ws://localhost:3001/");
const canvas = document.getElementById("myCanvas");
const ctx = canvas.getContext("2d");
const imageData = ctx.createImageData(canvas.width, canvas.height);

//Mouse button input listener
let mousedown = false;
document.addEventListener("mousedown", () => (mousedown = true));
document.addEventListener("mouseup", () => (mousedown = false));

//last mouse position of not just current user but all users, indexed by id
const lastX = [];
const lastY = [];

//The polling rate of the mouse is less than the dpi of the screen and
//thus renderData renders a line between the last position and the current position of the mouse
function renderData(id, x, y) {
  if (lastX[id] !== null && lastY[id] !== null) {
    setLine(lastX[id], lastY[id], x, y); // Draw a line between the previous and current mouse positions
  }
  lastX[id] = x;
  lastY[id] = y;
}

// Function to set a line between two points (x1, y1) and (x2, y2)
function setLine(x1, y1, x2, y2) {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    setPixel(x1, y1); // Set the current pixel to blue
    if (x1 === x2 && y1 === y2) break; // Break the loop when the line is complete
    const e2 = err * 2;
    if (e2 > -dy) {
      err -= dy;
      x1 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y1 += sy;
    }
  }
}

const canvasChanges = []

//Sets the color of a pixel unless it is outside of the bounds
function setPixel(x, y, send = true) {
  if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
    if(send)
      canvasChanges.push(x,y);
    const index = (y * imageData.width + x) * 4; // Calculate pixel index
    imageData.data[index] = 165; // Red
    imageData.data[index + 1] = 142; // Green
    imageData.data[index + 2] = 245; // Blue
    imageData.data[index + 3] = 255; // Alpha
  }
}

//A mouse move consitutes a mouse poll, this triggers a render if the mouse is down
document.addEventListener("mousemove", (event) => {
  if (mousedown) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(event.clientX - rect.left);
    const y = Math.floor(event.clientY - rect.top);
    renderData("me", x, y);
  } else {
    lastX["me"] = null;
    lastY["me"] = null;
  }
});

// When a message is sent to this client it is received here
ws.onmessage = (event) => {
  if(canvasChanges.length)
    ws.send(canvasChanges.join(","));
  canvasChanges.length = 0;

  const data = event.data.split(",").map((str) => Number.parseInt(str));
  console.log(data.length);
  for (let index = 0; index < data.length; index += 2)
    setPixel(data[index], data[index + 1], false);
};

// This is a loop which updates the screen every 32 ms or ~30 fps.
// Image data stores the new canvas and is updated in other parts of the program.
setInterval(() => {
  ctx.putImageData(imageData, 0, 0); // Render the changes
}, 32);
