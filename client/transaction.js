const toolMap = {
  pencil: new Uint8Array([0]),
  //AGI well have more of these in the future, this will help keep track of what is used
};
export function encodeTool(tool) {
  return toolMap[tool];
}

export function encodeColor(color) {
  return new Uint8Array(color);
}

export function encodePosition(position) {
  return new Uint8Array([
    Math.floor(position[0] / 256),
    Math.floor(position[0] % 256),
    Math.floor(position[1] / 256),
    Math.floor(position[1] % 256),
  ]);
}

export function touuid() {
  const buffer = new Uint8Array(10);
  const now = Date.now();
  let deciseconds = Math.floor(now / 100);

  for (let i = 4; i >= 0; i--) {
    buffer[i] = deciseconds & 0xff;
    deciseconds >>>= 8;
  }
  for (let i = 5; i < 10; i++) buffer[i] = Math.floor(Math.random() * 256);

  return buffer;
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
