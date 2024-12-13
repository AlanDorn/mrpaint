export default class TransactionManager {
  constructor() {
    this.transactions = [];
    this.unsentTransactions = [];

    this.toolCodes = {
      pencil: new Uint8Array([0]),
      fill: new Uint8Array([1]),
    };

    this.toolCodesInverse = ["pencil", "fill"];
  }

  fillTransaction(x, y, newColor, targetColor) {
    const transaction = buildTransaction(
      touuid(), // 10 bytes
      this.toolCodes["fill"], // 1 byte
      encodeColor(newColor), // 3 bytes
      encodeColor(targetColor), // 3 bytes
      encodePosition([x, y]), // 4 bytes
      new Uint8Array(11) // 11 bytes padding
    );

    this.unsentTransactions.push(transaction);
    this.transactions.push(transaction);
  }

  processFill(transaction) {
    return [
      transaction.slice(0, 10), // UUID
      "fill", // Tool name
      decodeColor(transaction.slice(11, 14)), // newColor (3 bytes)
      decodeColor(transaction.slice(14, 17)), // targetColor (3 bytes)
      decodePosition(transaction.slice(17, 21)), // position (x, y)
    ];
  }

  pencilTransaction(color, brushsize, p0, p1, p2, p3) {
    const transaction = buildTransaction(
      touuid(), //10 bytes
      this.toolCodes["pencil"], //1 bytes
      encodeColor(color), //3 bytes
      encodeLargeNumber(brushsize), //2 bytes
      encodePosition(p0), //4 bytes
      encodePosition(p1), //4 bytes
      encodePosition(p2), //4 bytes
      encodePosition(p3) //4 bytes
    );

    this.unsentTransactions.push(transaction);
    this.transactions.push(transaction);
  }

  processPencil(transaction) {
    return [
      transaction.slice(0, 10),
      "pencil",
      decodeColor(transaction.slice(11, 14)),
      decodeLargeNumber(transaction.slice(14, 16)),
      decodePosition(transaction.slice(16, 20)),
      decodePosition(transaction.slice(20, 24)),
      decodePosition(transaction.slice(24, 28)),
      decodePosition(transaction.slice(28, 32)),
    ];
  }

  processTransactions(transactions) {
    //AGI: For now we know the length of the each transaction however we might not in the future. The would require a step here for deterining the sizes of each transaction.

    const processedTransactions = [];
    for (let index = 0; index < transactions.length; index += 32) {
      const transaction = transactions.slice(index, index + 32);
      const tool = this.getTransactionTool(transaction);
      switch (tool) {
        case "pencil":
          processedTransactions.push(this.processPencil(transaction));
          break;
        case "fill":
          processedTransactions.push(this.processFill(transaction));
          break;
      }

      this.transactions.push(transaction);
    }

    return processedTransactions;
  }

  getTransactionTool(transaction) {
    return this.toolCodesInverse[transaction[10]];
  }

  buildServerMessage(userId, mouseX, mouseY) {
    return buildTransaction(
      new Uint8Array([userId]),
      encodePosition([mouseX, mouseY]),
      ...this.pullTransactions()
    );
  }

  pullTransactions() {
    const temp = this.unsentTransactions;
    this.unsentTransactions = [];
    return temp;
  }
}
//Helper functions
function buildTransaction(...components) {
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

function touuid() {
  let b = new Uint8Array(10),
    t = (Date.now() / 10) | 0;
  for (let i = 4; i >= 0; b[i--] = t & 255, t /= 256);
  for (let i = 5; i < 10; b[i++] = (Math.random() * 256) | 0);
  return b;
}

function encodeColor(color) {
  return new Uint8Array(color);
}

function decodeColor(colorBytes) {
  return Array.from(colorBytes);
}

function encodeSmallNumber(number) {
  return new Uint8Array([Math.floor(number)]);
}

function decodeSmallNumber(bytes) {
  return bytes[0];
}

function encodeLargeNumber(number) {
  return new Uint8Array([Math.floor(number / 256), Math.floor(number % 256)]);
}

function decodeLargeNumber(byteArray) {
  return byteArray[0] * 256 + byteArray[1];
}

function encodePosition(position) {
  const buffer = new Int16Array(position);
  return new Uint8Array(buffer.buffer);
}

export function decodePosition(position) {
  return Array.from(new Int16Array(position.buffer));
}
