import {
  decodeColor,
  decodeLargeNumber,
  decodePosition,
} from "./transaction.js";
import { splinePixels } from "./util2d.js";

export default function buildRenderTask(virtualCanvas, transaction) {
  switch (transaction[10]) {
    case 0:
      return renderPixel(virtualCanvas, transaction);
    case 1:
      return renderPencil(virtualCanvas, transaction);
  }
}

function renderPixel(virtualCanvas, transaction) {
  const color = decodeColor(transaction.slice(11, 14));
  const brushsize = decodeLargeNumber(transaction.slice(14, 16));
  const pixel = decodePosition(transaction.slice(16, 20));

  const task = [
    () => {
      for (let dx = 0; dx < brushsize; dx++) {
        for (let dy = 0; dy < brushsize; dy++) {
          virtualCanvas.setPixel(
            pixel[0] + dx,
            pixel[1] + dy,
            color[0],
            color[1],
            color[2]
          );
        }
      }
    },
  ];

  return task;
}

function renderPencil(virtualCanvas, transaction) {
  const color = decodeColor(transaction.slice(11, 14));
  const brushsize = decodeLargeNumber(transaction.slice(14, 16));
  const pixels = splinePixels([
    decodePosition(transaction.slice(16, 20)),
    decodePosition(transaction.slice(20, 24)),
    decodePosition(transaction.slice(24, 28)),
    decodePosition(transaction.slice(28, 32)),
  ]);

  const chunkSize = Math.ceil((1 * 400 * 400) / brushsize / brushsize); // Number of pixels to process per chunk
  const task = []; // Array to store the lambdas

  for (let index = 0; index < pixels.length; index += chunkSize) {
    const start = index;
    const end = Math.min(index + chunkSize, pixels.length);

    // Create a lambda for this chunk
    task.push(() => {
      for (let i = start; i < end; i++) {
        const [x, y] = pixels[i];
        for (let dx = 0; dx < brushsize; dx++) {
          for (let dy = 0; dy < brushsize; dy++) {
            virtualCanvas.setPixel(
              x + dx,
              y + dy,
              color[0],
              color[1],
              color[2]
            );
          }
        }
      }
    });
  }

  return task;
}
