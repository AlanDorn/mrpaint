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

function renderPixel(virtualCanvas, transaction) {
  const color = transaction.subarray(15, 18);
  const brushsize = decodeLargeNumber(transaction.subarray(18, 20));
  const pixel = decodePosition(transaction.subarray(20, 24));

  const task = [
    () => virtualCanvas.setPixel(pixel[0], pixel[1], color, brushsize),
  ];

  return task;
}

function renderPencil(virtualCanvas, transaction) {
  const color = transaction.subarray(15, 18);
  const brushsize = decodeLargeNumber(transaction.subarray(18, 20));
  const pixels = splinePixels(
    decodePosition(transaction.subarray(20, 24)),
    decodePosition(transaction.subarray(24, 28)),
    decodePosition(transaction.subarray(28, 32)),
    decodePosition(transaction.subarray(32, 36))
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
  const color = transaction.subarray(15, 18);
  const [x, y] = decodePosition(transaction.subarray(18, 22));
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
  const [newWidth, newHeight] = decodePosition(transaction.subarray(15, 19));

  return [
    () => {
      virtualCanvas.setSize(newWidth, newHeight);
    },
  ];
}

function renderEraser(virtualCanvas, transaction) {
  const color = transaction.subarray(15, 18);
  const primarycolor = transaction.subarray(18, 21); // to make things more complicated i spliced and changed vals for rest when i coulda put primarycolor at the back
  const brushsize = decodeLargeNumber(transaction.subarray(21, 23));
  const pixels = splinePixels(
    decodePosition(transaction.subarray(23, 27)),
    decodePosition(transaction.subarray(27, 31)),
    decodePosition(transaction.subarray(31, 35)),
    decodePosition(transaction.subarray(35, 39))
  );
  const mode = transaction[39];

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

function renderStraightLine(virtualCanvas, transaction){

}