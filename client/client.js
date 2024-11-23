const ws = new WebSocket("ws://localhost:3001/");
const canvas = document.getElementById("myCanvas");
const ctx = canvas.getContext("2d");
const imageData = ctx.createImageData(canvas.width, canvas.height);

const lastX = [];
const lastY = [];

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

function setPixel(x, y) {
  if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
    ws.send(x + "," + y);
    const index = (y * imageData.width + x) * 4; // Calculate pixel index
    imageData.data[index] = 165; // Red
    imageData.data[index + 1] = 142; // Green
    imageData.data[index + 2] = 245; // Blue
    imageData.data[index + 3] = 255; // Alpha
  }
}

let mousedown = false;

// Set mousedown and mouseup events only on the canvas
document.addEventListener("mousedown", () => {
  mousedown = true;
});

document.addEventListener("mouseup", () => {
  mousedown = false;
});

// Update mousemove to draw lines only when on the canvas

const mouseData = [];

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

ws.onmessage = (event) => {
  const output = JSON.parse(event.data);
  setPixel(output.x, output.y);
  //renderData(output.userId, output.x, output.y);
  console.log(output);
};

setInterval(()=>{
  ctx.putImageData(imageData, 0, 0); // Render the changes
}, 100)