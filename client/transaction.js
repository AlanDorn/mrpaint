export const toolCodes = {
  pixel: new Uint8Array([0]),
  pencil: new Uint8Array([1]),
  fill: new Uint8Array([2]),
  undo: new Uint8Array([3]),
  redo: new Uint8Array([4]),
  resize: new Uint8Array([5]),
};
export const toolCodeInverse = ["pixel", "pencil", "fill", "undo", "redo", "resize"];
export const toolLength = [24, 36, 22, 15, 15, 19];
export const TOOLCODEINDEX = 14;

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

export function buildTransaction(...components) {
  let transactionLength = 0;
  for (let index = 0; index < components.length; index++)
    transactionLength += components[index].length;

  const transaction = new Uint8Array(transactionLength);
  for (
    let index = 0, bufferOffset = 0;
    index < components.length;
    bufferOffset += components[index++].length
  )
    transaction.set(components[index], bufferOffset);

  return transaction;
}

export function operationId() {
  let b = new Uint8Array(6);
  for (let i = 0; i < 6; b[i++] = (Math.random() * 256) | 0);
  return b;
}

export function readOperationId(transaction) {
  return transaction.subarray(8, 14);
}

export function readOperationIdAsNumber(transaction) {
  let operationId = 0n;
  for (let index = 8; index < 14; index++)
    operationId = (operationId << 8n) | BigInt(transaction[index]);
  return operationId;
}

export function compareOperationId(first, second) {
  for (let index = 8; index < 14; index++)
    if (first[index] !== second[index]) return first[index] - second[index];
  return 0;
}

export function touuid() {
  let b = new Uint8Array(8),
    t = Date.now();

  b[5] = ((t & 15) * 16 + Math.random() * 16) | 0;
  t = (t / 16) | 0;

  for (let i = 4; i >= 0; b[i--] = t & 255, t = (t / 256) | 0);
  for (let i = 6; i < 8; b[i++] = (Math.random() * 256) | 0);
  return b;
}

// positive if first is bigger, negative if second, 0 if equal
export function compareTouuid(first, second) {
  for (let index = 0; index < 14; index++)
    if (first[index] !== second[index]) return first[index] - second[index];
  return 0;
}

export function encodeColor(color) {
  return new Uint8Array(color);
}

export function decodeColor(colorBytes) {
  return Array.from(colorBytes);
}

export function encodeSmallNumber(number) {
  return new Uint8Array([Math.floor(number)]);
}

export function decodeSmallNumber(bytes) {
  return bytes[0];
}

export function encodeLargeNumber(number) {
  return new Uint8Array([Math.floor(number / 256), Math.floor(number % 256)]);
}

export function decodeLargeNumber(byteArray) {
  return byteArray[0] * 256 + byteArray[1];
}

export function encodePosition(position) {
  const array = new Uint8Array(4);
  array[0] = position[0] & 0xff; // Lower 8 bits
  array[1] = (position[0] >> 8) & 0xff; // Upper 8 bits
  array[2] = position[1] & 0xff; // Lower 8 bits
  array[3] = (position[1] >> 8) & 0xff; // Upper 8 bits
  return array;
}

// Function to decode a Uint8Array back into two Int16 values
export function decodePosition(position) {
  const int1 = (position[1] << 8) | position[0];
  const signedInt1 = int1 > 0x7fff ? int1 - 0x10000 : int1;
  const int2 = (position[3] << 8) | position[2];
  const signedInt2 = int2 > 0x7fff ? int2 - 0x10000 : int2;
  return [signedInt1, signedInt2];
}
