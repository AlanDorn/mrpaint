import {
  decodeColor,
  decodeLargeNumber,
  decodePosition,
} from "./transaction.js";
import { splinePixels } from "./util2d.js";

export default function renderTransaction(virtualCanvas, transaction) {
  switch (transaction[10]) {
    case 0:
      renderPixel(virtualCanvas, transaction);
      break;
    case 1:
      renderPencil(virtualCanvas, transaction);
      break;
  }
}

function renderPixel(virtualCanvas, transaction) {
  const color = decodeColor(transaction.slice(11, 14));
  const brushsize = decodeLargeNumber(transaction.slice(14, 16));
  const pixel = decodePosition(transaction.slice(16, 20));

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

  for (let index = 0; index < pixels.length; index++)
    for (let dx = 0; dx < brushsize; dx++) {
      for (let dy = 0; dy < brushsize; dy++) {
        virtualCanvas.setPixel(
          pixels[index][0] + dx,
          pixels[index][1] + dy,
          color[0],
          color[1],
          color[2]
        );
      }
    }
}
