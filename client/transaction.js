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
export const toolLayouts = [];
export const TOUUIDLENGTH = 8;
export const OPIDLENGTH = 8;
export const TOOLCODEINDEX = TOUUIDLENGTH + OPIDLENGTH;

toolLayouts[toolCodes["pixel"][0]] = [3, 2, 4];
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

toolLayouts[toolCodes["pencil"][0]] = [3, 2, 4, 4, 4];
export function pencilTransaction(operationId, color, brushsize, p0, p1, p2) {
  return buildTransaction(
    touuid(), //8 bytes
    operationId, //6 bytes
    toolCodes["pencil"], //1 bytes
    encodeColor(color), //3 bytes
    encodeLargeNumber(brushsize), //2 bytes
    encodePosition(p0), //4 bytes
    encodePosition(p1), //4 bytes
    encodePosition(p2) //4 bytes
  );
}

toolLayouts[toolCodes["fill"][0]] = [3, 4];
export function fillTransaction(operationId, color, position) {
  return buildTransaction(
    touuid(), //8 bytes
    operationId, //6 bytes
    toolCodes["fill"], //1 bytes
    encodeColor(color), //3 bytes
    encodePosition(position) //4 bytes
  );
}

toolLayouts[toolCodes["undo"][0]] = [];
export function undoTransaction(operationId) {
  return buildTransaction(
    touuid(), //8 bytes
    operationId, //6 bytes
    toolCodes["undo"] //1 bytes
  );
}

toolLayouts[toolCodes["redo"][0]] = [];
export function redoTransaction(operationId) {
  return buildTransaction(
    touuid(), //8 bytes
    operationId, //6 bytes
    toolCodes["redo"] //1 bytes
  );
}

toolLayouts[toolCodes["resize"][0]] = [4];
export function resizeTransaction(operationId, position) {
  return buildTransaction(
    touuid(), //8 bytes
    operationId, //6 bytes
    toolCodes["resize"], //1 bytes
    encodePosition(position) //4 bytes
  );
}

toolLayouts[toolCodes["eraser"][0]] = [1, 3, 3, 2, 4, 4, 4];
export function eraserTransaction(
  operationId,
  color,
  primarycolor,
  brushsize,
  p0,
  p1,
  p2,
  mode
) {
  return buildTransaction(
    touuid(), //8 bytes
    operationId, //6 bytes
    toolCodes["eraser"], //1 bytes
    new Uint8Array([mode]), //1 bytes
    encodeColor(color), //3 bytes
    encodeColor(primarycolor), //3 bytes
    encodeLargeNumber(brushsize), //2 bytes
    encodePosition(p0), //4 bytes
    encodePosition(p1), //4 bytes
    encodePosition(p2) //4 bytes
  );
}

toolLayouts[toolCodes["straightLine"][0]] = [3, 2, 4, 4];
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

export const toolLength = toolLayouts.map(
  (arr) => arr.reduce((a, b) => a + b, 0) + TOOLCODEINDEX + 1
);

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

export const opIdAsBigInt = ({ buffer, byteOffset }) =>
  new DataView(buffer, byteOffset + TOUUIDLENGTH, OPIDLENGTH).getBigUint64(
    0,
    false
  );

export const compareOperationId = (first, second) => {
  for (let index = TOUUIDLENGTH; index < TOOLCODEINDEX; index++)
    if (first[index] !== second[index]) return first[index] - second[index];
  return 0;
};

const _buf = new ArrayBuffer(8);
const _dv = new DataView(_buf);
const _bytes = new Uint8Array(_buf);

/**
 * Overwrites the same 8 bytes in-place,
 * then returns that Uint8Array.
 */
export const touuid = () => {
  _dv.setBigUint64(0, BigInt(Date.now()), false);
  return _bytes;
};

export const touuidToBigInt = (bytes) =>
  new DataView(bytes.buffer, bytes.byteOffset, 8).getBigUint64(0, false);

export const msSinceTouuid = (bytes, now = Date.now()) => {
  const diff =
    BigInt(now) -
    new DataView(bytes.buffer, bytes.byteOffset, 8).getBigUint64(0, false);
  return diff > 0n ? Number(diff) : 0;
};

export const compareTouuid = (a, b) => {
  for (let index = 0; index < TOOLCODEINDEX; index++) {
    if (a[index] < b[index]) return -1;
    if (a[index] > b[index]) return 1;
  }
  return 0;
};

// Color arrays <=> Uint8Array
export const encodeColor = (arr) => Uint8Array.from(arr);
export const decodeColor = (bytes) => Array.from(bytes);

// 0–255 <=> single byte
export const encodeSmallNumber = (n) => Uint8Array.of(n & 0xff);
export const decodeSmallNumber = (b) => b[0];

// 0–65535 <=> two bytes big‑endian
export const encodeLargeNumber = (n) =>
  Uint8Array.of((n >> 8) & 0xff, n & 0xff);

export const decodeLargeNumber = (b) => (b[0] << 8) | b[1];

// 0–4,294,967,295 <=> four bytes big-endian
export const encodeExtraLargeNumber = (n) =>
  Uint8Array.of((n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff);

export const decodeExtraLargeNumber = (b) =>
  (b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3];

// Two 16‑bit signed ints <=> 4‑byte buffer little‑endian
export const encodePosition = ([x, y]) =>
  Uint8Array.of(x & 0xff, (x >> 8) & 0xff, y & 0xff, (y >> 8) & 0xff);

export const decodePosition = (b) => {
  const u1 = (b[1] << 8) | b[0];
  const u2 = (b[3] << 8) | b[2];
  const x = u1 & 0x8000 ? u1 - 0x10000 : u1;
  const y = u2 & 0x8000 ? u2 - 0x10000 : u2;
  return [x, y];
};
