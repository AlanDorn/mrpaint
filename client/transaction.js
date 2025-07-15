export const toolCodes = {
  pixel: new Uint8Array([0]),
  pencil: new Uint8Array([1]),
  fill: new Uint8Array([2]),
  undo: new Uint8Array([3]),
  redo: new Uint8Array([4]),
  resize: new Uint8Array([5]),
  eraser: new Uint8Array([6]),
  straightLine: new Uint8Array([7]),
};
export const toolCodeInverse = [
  "pixel",
  "pencil",
  "fill",
  "undo",
  "redo",
  "resize",
  "eraser",
  "straightLine",
];
export const TOUUIDLENGTH = 8;
export const OPIDLENGTH = 8;
export const TOOLCODEINDEX = TOUUIDLENGTH + OPIDLENGTH;
export const toolLength = [10, 22, 8, 1, 1, 5, 26, 14].map(
  (l) => l + TOOLCODEINDEX
);

export function pixelTransaction(operationId, color, brushsize, position) {
  return buildTransaction(
    touuid(), //8 bytes
    operationId, //6 bytes
    toolCodes["pixel"], //1 bytes
    encodeColor(color), //3 bytes
    encodeLargeNumber(brushsize), //2 bytes
    encodePosition(position) //4 bytes
  );
}

export function pencilTransaction(
  operationId,
  color,
  brushsize,
  p0,
  p1,
  p2,
  p3
) {
  return buildTransaction(
    touuid(), //8 bytes
    operationId, //6 bytes
    toolCodes["pencil"], //1 bytes
    encodeColor(color), //3 bytes
    encodeLargeNumber(brushsize), //2 bytes
    encodePosition(p0), //4 bytes
    encodePosition(p1), //4 bytes
    encodePosition(p2), //4 bytes
    encodePosition(p3) //4 bytes
  );
}

export function fillTransaction(operationId, color, position) {
  return buildTransaction(
    touuid(), //8 bytes
    operationId, //6 bytes
    toolCodes["fill"], //1 bytes
    encodeColor(color), //3 bytes
    encodePosition(position) //4 bytes
  );
}

export function undoTransaction(operationId) {
  return buildTransaction(
    touuid(), //8 bytes
    operationId, //6 bytes
    toolCodes["undo"] //1 bytes
  );
}

export function redoTransaction(operationId) {
  return buildTransaction(
    touuid(), //8 bytes
    operationId, //6 bytes
    toolCodes["redo"] //1 bytes
  );
}

export function resizeTransaction(operationId, position) {
  return buildTransaction(
    touuid(), //8 bytes
    operationId, //6 bytes
    toolCodes["resize"], //1 bytes
    encodePosition(position) //4 bytes
  );
}

export function eraserTransaction(
  operationId,
  color,
  primarycolor,
  brushsize,
  p0,
  p1,
  p2,
  p3,
  mode
) {
  return buildTransaction(
    touuid(), //8 bytes
    operationId, //6 bytes
    toolCodes["eraser"], //1 bytes
    encodeColor(color), //3 bytes
    encodeColor(primarycolor), //3 bytes
    encodeLargeNumber(brushsize), //2 bytes
    encodePosition(p0), //4 bytes
    encodePosition(p1), //4 bytes
    encodePosition(p2), //4 bytes
    encodePosition(p3), //4 bytes
    new Uint8Array([mode])  //1 bytes
  );
}

export function straightLineTransaction(
  operationId,
  color,
  brushsize,
  startPoint,
  endPoint,
  mode
) {
  return buildTransaction(
    touuid(), //8 bytes
    operationId, //6 bytes
    toolCodes["straightLine"], //1 bytes
    encodeColor(color), //3 bytes
    encodeLargeNumber(brushsize), //2 bytes
    encodePosition(startPoint), //4 bytes
    encodePosition(endPoint) //4 bytes
  );
}

//
//                           ,,
//  `7MMF'  `7MMF'         `7MM
//    MM      MM             MM
//    MM      MM   .gP"Ya    MM  `7MMpdMAo.  .gP"Ya  `7Mb,od8
//    MMmmmmmmMM  ,M'   Yb   MM    MM   `Wb ,M'   Yb   MM' "'
//    MM      MM  8M""""""   MM    MM    M8 8M""""""   MM
//    MM      MM  YM.    ,   MM    MM   ,AP YM.    ,   MM
//  .JMML.  .JMML. `Mbmmd' .JMML.  MMbmmd'   `Mbmmd' .JMML.
//                                 MM
//                               .JMML.

export const buildTransaction = (...components) => {
  const total = components.reduce((sum, c) => sum + c.length, 0);
  const tx = new Uint8Array(total);
  let off = 0;
  for (const c of components) {
    tx.set(c, off);
    off += c.length;
  }
  return tx;
};

export const operationId = () => {
  const buf = new Uint8Array(OPIDLENGTH);
  crypto.getRandomValues(buf);
  return buf;
};

export const readOperationId = (tx) => tx.subarray(TOUUIDLENGTH, TOOLCODEINDEX);

export const readOperationIdAsNumber = (tx) => {
  let id = 0n;
  for (let i = TOUUIDLENGTH; i < TOOLCODEINDEX; i++) {
    id = (id << 8n) | BigInt(tx[i]);
  }
  return id;
};

export function compareOperationId(first, second) {
  for (let index = TOUUIDLENGTH; index < TOOLCODEINDEX; index++)
    if (first[index] !== second[index]) return first[index] - second[index];
  return 0;
}

export function touuid() {
  let ms = BigInt(Date.now());
  const out = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) {
    out[i] = Number(ms & 0xffn);
    ms >>= 8n;
  }
  return out;
}

const WORD = 4; // bytes per “word”
export function compareTouuid(a, b) {
  const len = TOOLCODEINDEX;
  // create DataViews once per call
  const da = new DataView(a.buffer, a.byteOffset, len);
  const db = new DataView(b.buffer, b.byteOffset, len);

  // compare full 32‑bit words
  let offset = 0;
  const nWords = Math.floor(len / WORD);
  for (let i = 0; i < nWords; i++, offset += WORD) {
    // false = big‑endian
    const wa = da.getUint32(offset, false);
    const wb = db.getUint32(offset, false);
    if (wa < wb) return -1;
    if (wa > wb) return +1;
  }

  // compare any remaining tail bytes
  for (; offset < len; offset++) {
    const xa = a[offset],
      xb = b[offset];
    if (xa < xb) return -1;
    if (xa > xb) return +1;
  }

  return 0;
}

// Color arrays ↔ Uint8Array
export const encodeColor = (arr) => Uint8Array.from(arr);
export const decodeColor = (bytes) => Array.from(bytes);

// 0–255 ↔ single byte
export const encodeSmallNumber = (n) => Uint8Array.of(n & 0xff);
export const decodeSmallNumber = (b) => b[0];

// 0–65535 ↔ two bytes big‑endian
export const encodeLargeNumber = (n) =>
  Uint8Array.of((n >> 8) & 0xff, n & 0xff);

export const decodeLargeNumber = (b) => (b[0] << 8) | b[1];

// Two 16‑bit signed ints ↔ 4‑byte buffer little‑endian
export const encodePosition = ([x, y]) =>
  Uint8Array.of(x & 0xff, (x >> 8) & 0xff, y & 0xff, (y >> 8) & 0xff);

export const decodePosition = (b) => {
  const u1 = (b[1] << 8) | b[0];
  const u2 = (b[3] << 8) | b[2];
  const x = u1 & 0x8000 ? u1 - 0x10000 : u1;
  const y = u2 & 0x8000 ? u2 - 0x10000 : u2;
  return [x, y];
};
