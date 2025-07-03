import {
  decodeLargeNumber,
  encodeLargeNumber,
  toolLength,
  TOOLCODEINDEX,
} from "./transaction.js";
import { OPCODE, OPCODE_NAME } from "./shared/instructionset.js";

export class TransferStateReader {
  constructor() {
    this.userId = -1;
    this.snapshotLength = -1;
    this.transactions = null;
    this.snapshots = [];
    this.snapshotTransactions = [];
    // this.snapshotIndex = -1;
  }

  handle(event) {
    const eventData =
      event instanceof Uint8Array ? event : new Uint8Array(event);

    const opcode = eventData[0];
    const userId = eventData[1];
    const payload = eventData.subarray(2);

    switch (opcode) {
      case OPCODE.TS_SNAPSHOT_COUNT:
        console.log("\n\nNBYE0\n\n\n");
        this.userId = userId;
        this.snapshotLength = payload[0];
        this.transactions = payload.subarray(1);
        break;
      case OPCODE.TS_PNG:
        console.log("\n\nNBYE1\n\n\n");
        this.userId = userId;
        // this.snapshotLength = payload;
        break;
      case OPCODE.TS_SNAPSHOT:
        console.log("\n\nNBYE2\n\n\n");
        const snapshotIndex = eventData[1];
        const width = decodeLargeNumber(eventData.subarray(2, 4));
        const height = decodeLargeNumber(eventData.subarray(4, 6));

        const transactionStart = 6;
        const toolCode = eventData[TOOLCODEINDEX + transactionStart]; // TOOLCODEINDEX is typically 0
        const transactionLength = toolLength[toolCode];

        const transaction = eventData.subarray(
          transactionStart,
          transactionStart + transactionLength
        );
        const qoiData = eventData.subarray(
          transactionStart + transactionLength
        );

        this.snapshotTransactions[snapshotIndex] = transaction;
        this.snapshots[snapshotIndex] = qoiDecode(qoiData, width, height);
        break;
    }
  }

  isFinished() {
    if (this.userId === -1 || this.snapshotLength === -1 || !this.transactions)
      return false;
    for (let index = 0; index < this.snapshotLength; index++)
      if (!this.snapshots[index] || !this.snapshotTransactions[index])
        return false;
    return true;
  }
}

export function transferState(ws, transactionManager) {
  const currentCanvas = transactionManager.virtualCanvas.virtualCanvas;
  const snapshotCount = transactionManager.snapshots.length;

  const numHistoric = Math.min(4, snapshotCount);
  const totalSnapshots = numHistoric + 1; // +1 for the live/current copy
  const selectedSnapshots = [];

  for (let i = 0; i < numHistoric; i++) {
    const index = Math.floor(
      (i / Math.max(1, numHistoric - 1)) * Math.max(1, snapshotCount - 1)
    );
    selectedSnapshots.push(index);
  }

  // Send transactions for syncing
  ws.send(
    new Uint8Array([
      OPCODE.TS_SNAPSHOT_COUNT,
      transactionManager.userId,
      totalSnapshots,
      ...transactionManager.transactionLog.transactions,
    ])
  );

  // Send each snapshot
  selectedSnapshots.forEach((index, i) => {
    const snapshot = transactionManager.snapshots[index];
    const snapshotTransaction = transactionManager.snapshotTransactions[index];
    ws.send(
      new Uint8Array([
        OPCODE.TS_SNAPSHOT,
        i,
        ...encodeLargeNumber(snapshot[0].length),
        ...encodeLargeNumber(snapshot.length),
        ...snapshotTransaction,
        ...qoiEncode(snapshot),
      ])
    );
  });

  // Send current snapshot (canvas at this moment)
  const latestTransaction =
    transactionManager.transactionLog.transactions.at(-1) || new Uint8Array();

  ws.send(
    new Uint8Array([
      OPCODE.TS_SNAPSHOT,
      totalSnapshots - 1,
      ...encodeLargeNumber(currentCanvas[0].length),
      ...encodeLargeNumber(currentCanvas.length),
      ...latestTransaction,
      ...qoiEncode(currentCanvas),
    ])
  );

  return pngEncode(currentCanvas).then((value) => {
    ws.send(
      new Uint8Array([OPCODE.TS_PNG, transactionManager.userId, ...value])
    );
  });
}

//
//                           ,,
//   7MMF'   7MMF'          7MM
//    MM      MM             MM
//    MM      MM   .gP"Ya    MM  7MMpdMAo.  .gP"Ya  7Mb,od8
//    MMmmmmmmMM  ,M'   Yb   MM    MM   Wb ,M'   Yb   MM' "'
//    MM      MM  8M""""""   MM    MM    M8 8M""""""   MM
//    MM      MM  YM.    ,   MM    MM   ,AP YM.    ,   MM
//  .JMML.  .JMML. Mbmmd' . JMML.  MMbmmd'   Mbmmd'  .JMML.
//                                 MM
//                               .JMML.

// Qoi is used to encode virtual canvas snapshots for sending to the server. Works by looping through each pixel and choosing an OP which has the best compression.
// https://qoiformat.org/qoi-specification.pdf

const QOI_OP_RGB = 0b11111110; // This is no compression
// It has 4 methods for compressing an incoming pixel.
const QOI_OP_INDEX = 0b00; //Index into a hot hashmap of pixel colors in 1 byte
const QOI_OP_DIFF = 0b01; // Difference from the previous pixel color in 1 byte
const QOI_OP_LUMA = 0b10; // Difference from the previous pixel color in 2 bytes
const QOI_OP_RUN = 0b11; //  Run of the same pixel color in 1 byte per run.

function qoiEncode(virtualCanvas) {
  const pixels = encodeVirtualCanvas(virtualCanvas);
  const index = new Uint32Array(64);
  let prevR = 0,
    prevG = 0,
    prevB = 0;
  let run = 0;

  let data = new Uint8Array(pixels.length * 2);
  let dataSize = 0;

  function pushByte(byte) {
    data[dataSize++] = byte;
  }

  function pushBytes(...bytes) {
    for (let b of bytes) data[dataSize++] = b;
  }

  for (let i = 0; i < pixels.length; i += 3) {
    let r = pixels[i],
      g = pixels[i + 1],
      b = pixels[i + 2];

    if (r === prevR && g === prevG && b === prevB) {
      if (++run === 62 || i + 3 >= pixels.length) {
        pushByte((QOI_OP_RUN << 6) | (run - 1));
        run = 0;
      }
      continue;
    }

    if (run > 0) {
      pushByte((QOI_OP_RUN << 6) | (run - 1));
      run = 0;
    }

    const hashIndex = (r * 3 + g * 5 + b * 7) & 63;
    if (index[hashIndex] === ((r << 16) | (g << 8) | b)) {
      pushByte((QOI_OP_INDEX << 6) | hashIndex);
    } else {
      index[hashIndex] = (r << 16) | (g << 8) | b;

      const dr = r - prevR;
      const dg = g - prevG;
      const db = b - prevB;

      // Use DIFF if the difference between color channels is small (in range [-2, 2])
      if (
        Math.abs(dr + 0.5) <= 1.5 &&
        Math.abs(dg + 0.5) <= 1.5 &&
        Math.abs(db + 0.5) <= 1.5
      ) {
        pushByte(
          (QOI_OP_DIFF << 6) | ((dr + 2) << 4) | ((dg + 2) << 2) | (db + 2)
        );
      } else if (
        Math.abs(dg + 0.5) <= 31.5 &&
        Math.abs(dr - dg + 0.5) <= 7.5 &&
        Math.abs(db - dg + 0.5) <= 7.5
      ) {
        pushByte((QOI_OP_LUMA << 6) | ((dg + 32) & 0x3f));
        pushByte(((dr - dg + 8) << 4) | (db - dg + 8));
      } else {
        pushBytes(QOI_OP_RGB, r, g, b);
      }
    }

    prevR = r;
    prevG = g;
    prevB = b;
  }

  return data.slice(0, dataSize);
}

function qoiDecode(qoiData, width, height) {
  const index = new Uint32Array(64);
  let pixels = new Uint8Array(width * height * 3);
  let prevR = 0,
    prevG = 0,
    prevB = 0;
  let dataIndex = 0,
    pixelIndex = 0;

  while (dataIndex < qoiData.length) {
    let byte = qoiData[dataIndex++];

    if (byte === QOI_OP_RGB) {
      prevR = qoiData[dataIndex++];
      prevG = qoiData[dataIndex++];
      prevB = qoiData[dataIndex++];
    } else if (byte >> 6 === QOI_OP_INDEX) {
      let hashIdx = byte & 0x3f;
      let idx = index[hashIdx];
      prevR = (idx >> 16) & 255;
      prevG = (idx >> 8) & 255;
      prevB = idx & 255;
    } else if (byte >> 6 === QOI_OP_RUN) {
      let run = (byte & 0x3f) + 1;
      while (run--) {
        pixels[pixelIndex++] = prevR;
        pixels[pixelIndex++] = prevG;
        pixels[pixelIndex++] = prevB;
      }
      continue;
    } else if (byte >> 6 === QOI_OP_DIFF) {
      let diff = byte & 0x3f;
      let dr = ((diff >> 4) & 0x03) - 2;
      let dg = ((diff >> 2) & 0x03) - 2;
      let db = (diff & 0x03) - 2;
      prevR += dr;
      prevG += dg;
      prevB += db;
    } else if (byte >> 6 === QOI_OP_LUMA) {
      let drdb = qoiData[dataIndex++];
      let dg = (byte & 0x3f) - 32;
      let dr = (drdb >> 4) - 8 + dg;
      let db = (drdb & 15) - 8 + dg;
      prevR += dr;
      prevG += dg;
      prevB += db;
    }

    pixels[pixelIndex++] = prevR;
    pixels[pixelIndex++] = prevG;
    pixels[pixelIndex++] = prevB;
    index[(prevR * 3 + prevG * 5 + prevB * 7) & 63] =
      (prevR << 16) | (prevG << 8) | prevB;
  }

  return decodeVirtualCanvas(pixels, width, height);
}

async function pngEncode(image) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.height = image.length;
  canvas.width = image[0].length;
  const imageData = ctx.createImageData(canvas.width, canvas.height);
  const data = imageData.data;
  let dataIndex = 0;
  for (let y = 0; y < image.length; y++)
    for (let x = 0; x < image[0].length; x++) {
      const pixel = image[y][x];
      data[dataIndex++] = pixel[0];
      data[dataIndex++] = pixel[1];
      data[dataIndex++] = pixel[2];
      data[dataIndex++] = 255;
    }
  ctx.putImageData(imageData, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to convert canvas to Blob"));
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => resolve(new Uint8Array(reader.result));
      reader.readAsArrayBuffer(blob);
    }, "image/png");
  });
}

function encodeVirtualCanvas(virtualCanvas) {
  const pixels = new Uint8Array(
    virtualCanvas.length * virtualCanvas[0].length * 3
  );
  let pixelIndex = 0;
  for (let y = 0; y < virtualCanvas.length; y++)
    for (let x = 0; x < virtualCanvas[0].length; x++) {
      pixels[pixelIndex++] = virtualCanvas[y][x][0];
      pixels[pixelIndex++] = virtualCanvas[y][x][1];
      pixels[pixelIndex++] = virtualCanvas[y][x][2];
    }
  return pixels;
}

function decodeVirtualCanvas(pixels, width, height) {
  const virtualCanvas = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => [0, 0, 0])
  );

  let pixelsIndex = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      virtualCanvas[y][x][0] = pixels[pixelsIndex++];
      virtualCanvas[y][x][1] = pixels[pixelsIndex++];
      virtualCanvas[y][x][2] = pixels[pixelsIndex++];
    }
  }
  return virtualCanvas;
}
