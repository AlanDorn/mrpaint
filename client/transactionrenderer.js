import {
  decodeLargeNumber,
  decodePosition,
  TOOLCODEINDEX,
} from "./transaction.js";
import { splinePixels } from "./util2d.js";

const doNothing = () => {};

export default function buildRenderTask(virtualCanvas, transaction) {
  switch (transaction[TOOLCODEINDEX]) {
    case 0:
      return renderPixel(virtualCanvas, transaction);
    case 1:
      return renderPencil(virtualCanvas, transaction);
    case 2:
      return renderFill(virtualCanvas, transaction);
    case 5:
      return renderResize(virtualCanvas, transaction);
    case 6:
      return renderEraser(virtualCanvas, transaction);
    case 7:
      return renderStraightLine(virtualCanvas, transaction);
  }

  return [doNothing];
}

const newInc =
  (index = 0) =>
  (inc = 0) => {
    index += inc;
    return index;
  };

function renderPixel(virtualCanvas, transaction) {
  let inc = newInc(TOOLCODEINDEX + 1);
  const color = transaction.subarray(inc(), inc(3));
  const brushsize = decodeLargeNumber(transaction.subarray(inc(), inc(2)));
  const pixel = decodePosition(transaction.subarray(inc(), inc(4)));

  const task = [
    () => virtualCanvas.setPixel(pixel[0], pixel[1], color, brushsize),
  ];
  return task;
}

function renderPencil(virtualCanvas, transaction) {
  let inc = newInc(TOOLCODEINDEX + 1);
  const color = transaction.subarray(inc(), inc(3));
  const brushsize = decodeLargeNumber(transaction.subarray(inc(), inc(2)));
  const pixels = splinePixels(
    decodePosition(transaction.subarray(inc(), inc(4))),
    decodePosition(transaction.subarray(inc(), inc(4))),
    decodePosition(transaction.subarray(inc(), inc(4))),
    decodePosition(transaction.subarray(inc(), inc(4)))
  );

  //CALM: benchmark this so you can figure out what is a good number for this.
  const chunkSize = Math.ceil(100000); // Number of pixels to process per chunk
  const task = [
    () => virtualCanvas.setPixel(pixels[0][0], pixels[0][1], color, brushsize),
  ]; // Array to store the lambdas

  for (let index = 0; index < pixels.length; index += chunkSize) {
    const start = index;
    const end = Math.min(index + chunkSize, pixels.length);

    task.push(() => {
      for (let i = start; i < end; i++) {
        const [x, y] = pixels[i];
        if (brushsize <= 2) {
          virtualCanvas.setPixel(x, y, color, brushsize);
        }
        virtualCanvas.setPixelOutline(x, y, color, brushsize);
      }
    });
  }

  return task;
}

function renderFill(virtualCanvas, transaction) {
  let inc = newInc(TOOLCODEINDEX + 1);
  const color = transaction.subarray(inc(), inc(3));
  const [x, y] = decodePosition(transaction.subarray(inc(), inc(4)));
  const width = virtualCanvas.width;
  const height = virtualCanvas.height;

  if (
    x < 0 ||
    x >= width ||
    y < 0 ||
    y >= height ||
    virtualCanvas.checkPixelColor(x, y, color)
  ) {
    return [doNothing];
  }

  const targetColor = virtualCanvas.getPixelColor(x, y);
  if (colorsMatch(color, targetColor)) return [doNothing];

  const stack = [[x, y]];
  const neighbors = [
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ];

  const nextRender = () => {
    let count = 10000; // Render batch limit
    while (count-- > 0 && stack.length > 0) {
      const [cx, cy] = stack.pop();

      neighbors[0][0] = cx + 1;
      neighbors[0][1] = cy;
      neighbors[1][0] = cx - 1;
      neighbors[1][1] = cy;
      neighbors[2][0] = cx;
      neighbors[2][1] = cy + 1;
      neighbors[3][0] = cx;
      neighbors[3][1] = cy - 1;

      if (stack.length % 1000 < 100)
        // mixture of bfs and dfs looks cool
        for (let i = 0; i < 4; i++) {
          const [nx, ny] = neighbors[i];
          if (
            nx >= 0 &&
            nx < width &&
            ny >= 0 &&
            ny < height &&
            virtualCanvas.checkPixelColor(nx, ny, targetColor)
          ) {
            const pos = Math.floor(Math.random() * stack.length);
            stack.push(stack[pos]);
            stack[pos] = [nx, ny];
            virtualCanvas.setPixel(nx, ny, color, 1);
          }
        }
      else
        for (let i = 3; i >= 0; i--) {
          const rand = Math.floor(Math.random() * (i + 1));
          const [nx, ny] = neighbors[rand];
          if (
            nx >= 0 &&
            nx < width &&
            ny >= 0 &&
            ny < height &&
            virtualCanvas.checkPixelColor(nx, ny, targetColor)
          ) {
            stack.push([nx, ny]);
            virtualCanvas.setPixel(nx, ny, color, 1);
          }
          neighbors[rand][0] = neighbors[i][0];
          neighbors[rand][1] = neighbors[i][1];
        }
    }

    return stack.length > 0 ? nextRender : null;
  };

  return [nextRender];
}

function colorsMatch(first, second) {
  return (
    first[0] === second[0] && first[1] === second[1] && first[2] === second[2]
  );
}

function renderResize(virtualCanvas, transaction) {
  let inc = newInc(TOOLCODEINDEX + 1);
  const [newWidth, newHeight] = decodePosition(
    transaction.subarray(inc(), inc(4))
  );

  return [
    () => {
      virtualCanvas.setSize(newWidth, newHeight);
    },
  ];
}

function renderEraser(virtualCanvas, transaction) {
  let inc = newInc(TOOLCODEINDEX + 1);
  const color = transaction.subarray(inc(), inc(3));
  const primarycolor = transaction.subarray(inc(), inc(3)); // to make things more complicated i spliced and changed vals for rest when i coulda put primarycolor at the back
  const brushsize = decodeLargeNumber(transaction.subarray(inc(), inc(2)));
  const pixels = splinePixels(
    decodePosition(transaction.subarray(inc(), inc(4))),
    decodePosition(transaction.subarray(inc(), inc(4))),
    decodePosition(transaction.subarray(inc(), inc(4))),
    decodePosition(transaction.subarray(inc(), inc(4)))
  );
  const mode = transaction[inc()];

  //CALM: benchmark this so you can figure out what is a good number for this.
  const chunkSize = Math.ceil(100000); // Number of pixels to process per chunk

  const task = [() => processPixel(pixels[0][0], pixels[0][1])];

  function processPixel(x, y) {
    if (mode === 1) {
      // Right-click => Eraser logic with subpixel checks
      const halfThickness = Math.floor(brushsize / 2);
      for (let dy = 0; dy < brushsize; dy++) {
        for (let dx = 0; dx < brushsize; dx++) {
          const newX = x - halfThickness + dx;
          const newY = y - halfThickness + dy;

          if (
            newX >= 0 &&
            newY >= 0 &&
            newX < virtualCanvas.width &&
            newY < virtualCanvas.height
          ) {
            const existingColor = virtualCanvas.getPixelColor(newX, newY);
            if (colorsMatch(existingColor, primarycolor)) {
              // Overwrite single subpixel
              virtualCanvas.setPixel(newX, newY, color, 1);
            }
          }
        }
      }
    } else {
      // Left-click => Just do one call that draws the entire brush area
      // No need to check existing color for each subpixel.
      virtualCanvas.setPixel(x, y, color, brushsize);
    }
  }

  for (let index = 0; index < pixels.length; index += chunkSize) {
    const start = index;
    const end = Math.min(index + chunkSize, pixels.length);

    task.push(() => {
      for (let i = start; i < end; i++) processOutline(...pixels[i]);
    });
  }

  function processOutline(x, y) {
    if (mode === 1) {
      // Right-click => Eraser logic with subpixel checks
      const halfThickness = Math.floor(brushsize / 2);
      for (let dy = 0; dy < brushsize; dy++) {
        for (let dx = 0; dx < brushsize; dx++) {
          if (
            dy !== 0 &&
            dx !== 0 &&
            dy !== brushsize - 1 &&
            dx !== brushsize - 1
          )
            continue;

          const newX = x - halfThickness + dx;
          const newY = y - halfThickness + dy;

          if (
            newX >= 0 &&
            newY >= 0 &&
            newX < virtualCanvas.width &&
            newY < virtualCanvas.height
          ) {
            const existingColor = virtualCanvas.getPixelColor(newX, newY);
            if (colorsMatch(existingColor, primarycolor)) {
              // Overwrite single subpixel
              virtualCanvas.setPixel(newX, newY, color, 1);
            }
          }
        }
      }
    } else {
      // Left-click => Just do one call that draws the entire brush area
      // No need to check existing color for each subpixel.
      if (brushsize <= 2) {
        virtualCanvas.setPixel(x, y, color, brushsize);
      }
      virtualCanvas.setPixelOutline(x, y, color, brushsize);
    }
  }

  return task;
}

function renderStraightLine(virtualCanvas, transaction) {
  let inc = newInc(TOOLCODEINDEX + 1);
  const color = transaction.subarray(inc(), inc(3)); // Extract color from transaction
  const brushsize = decodeLargeNumber(transaction.subarray(inc(), inc(2))); // Extract brush size
  const startPoint = decodePosition(transaction.subarray(inc(), inc(4))); // Extract starting point
  const endPoint = decodePosition(transaction.subarray(inc(), inc(4))); // Extract ending point

  // Calculate points along the line using Bresenham's line algorithm
  const points = bresenhamLine(
    startPoint[0],
    startPoint[1],
    endPoint[0],
    endPoint[1]
  );

  // Create a task array to store pixel setting tasks
  const task = [];

  points.forEach(([x, y]) => {
    task.push(() => virtualCanvas.setPixel(x, y, color, brushsize)); // Set each pixel on the canvas
  });

  return task;
}

// Bresenham's line algorithm to compute points on the line
function bresenhamLine(x1, y1, x2, y2) {
  const points = [];
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    points.push([x1, y1]); // Add point to the line
    if (x1 === x2 && y1 === y2) break;
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
  return points;
}
