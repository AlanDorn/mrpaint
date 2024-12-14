export const toolCodes = {
  pixel: new Uint8Array([0]),
  pencil: new Uint8Array([1]),
  fill: new Uint8Array([2]),
};
export const toolCodeInverse = ["pixel", "pencil", "fill"];
export const toolLength = [20, 32, 18];

export function pixelTransaction(color, brushsize, position) {
  return buildTransaction(
    touuid(), //10 bytes
    toolCodes["pixel"], //1 bytes
    encodeColor(color), //3 bytes
    encodeLargeNumber(brushsize), //2 bytes
    encodePosition(position), //4 bytes
  );
}

export function pencilTransaction(color, brushsize, p0, p1, p2, p3) {
  return buildTransaction(
    touuid(), //10 bytes
    toolCodes["pencil"], //1 bytes
    encodeColor(color), //3 bytes
    encodeLargeNumber(brushsize), //2 bytes
    encodePosition(p0), //4 bytes
    encodePosition(p1), //4 bytes
    encodePosition(p2), //4 bytes
    encodePosition(p3) //4 bytes
  );
}

export function fillTransaction(color, position) {
  return buildTransaction(
    touuid(), //10 bytes
    toolCodes["fill"], //1 bytes
    encodeColor(color), //3 bytes
    encodePosition(position), //4 bytes
  );
}

export function buildTransaction(...components) {
  let transactionLength = 0;
  for (let index = 0; index < components.length; index++)
    transactionLength += components[index].length;

  const transaction = new Uint8Array(transactionLength);
  let bufferOffset = 0;
  for (let index = 0; index < components.length; index++) {
    transaction.set(components[index], bufferOffset);
    bufferOffset += components[index].length;
  }
  return transaction;
}

export function touuid() {
  let b = new Uint8Array(10),
    t = Date.now();
  b[5] = (t & 15) * 16 + (Math.random() * 16) | 0;
  t = (t / 16) | 0
  for (let i = 4; i >= 0; b[i--] = t & 255, t = (t / 256) | 0);
  for (let i = 5; i < 10; b[i++] = (Math.random() * 256) | 0);
  return b;
}

// positive if first is bigger, negative if second, 0 if equal
export function compareTouuid(first, second) {
  for (let index = 0; index < 10; index++)
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
  const buffer = new Int16Array(position);
  return new Uint8Array(buffer.buffer);
}

export function decodePosition(position) {
  return Array.from(new Int16Array(position.buffer));
}
