export default class TransactionManager {
  constructor() {
    this.transactions = [];
    this.unsentTransactions = [];

    this.toolCodes = {
      pencil: new Uint8Array([0]),
    };

    this.toolCodesInverse = ["pencil"];
  }

  pencilTransaction(color, brushsize, p0, p1, p2, p3) {
    const transaction = buildTransaction(
      touuid(),
      this.toolCodes["pencil"],
      encodeColor(color),
      encodeSmallNumber(brushsize),
      encodePosition(p0),
      encodePosition(p1),
      encodePosition(p2),
      encodePosition(p3)
    );

    this.unsentTransactions.push(transaction);
    this.transactions.push(transaction);
  }

  processPencil(transaction) {
    return [
      transaction.slice(0, 10),
      "pencil",
      decodeColor(transaction.slice(11, 14)), // Assuming 3-byte color
      decodeSmallNumber(transaction.slice(14, 15)),
      decodePosition(transaction.slice(15, 19)),
      decodePosition(transaction.slice(19, 23)),
      decodePosition(transaction.slice(23, 27)),
      decodePosition(transaction.slice(27, 31)),
    ];
  }

  processTransactions(transactions) {
    //AGI: For now we know the length of the each transaction however we might not in the future. The would require a step here for deterining the sizes of each transaction.

    const processedTransactions = [];
    for (let index = 0; index < transactions.length; index += 31) {
      const transaction = transactions.slice(index, index + 31);
      const tool = this.getTransactionTool(transaction);
      switch (tool) {
        case "pencil":
          processedTransactions.push(this.processPencil(transaction));
          break;
      }

      this.transactions.push(transaction);
    }

    return processedTransactions;
  }

  getTransactionTool(transaction) {
    return this.toolCodesInverse[transaction[10]];
  }

  buildServerMessage(mouseX, mouseY) {
    return buildTransaction(
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

function encodeSmallNumber(number) {
  return new Uint8Array([Math.floor(number)]);
}

function encodeLargeNumber(number) {
  return new Uint8Array([Math.floor(number / 256), Math.floor(number % 256)]);
}

function encodePosition(position) {
  return new Uint8Array([
    Math.floor(position[0] / 256),
    Math.floor(position[0] % 256),
    Math.floor(position[1] / 256),
    Math.floor(position[1] % 256),
  ]);
}

function decodeColor(colorBytes) {
  return Array.from(colorBytes);
}

function decodeSmallNumber(bytes) {
  return bytes[0];
}

function decodePosition(bytes) {
  return [bytes[0] * 256 + bytes[1], bytes[2] * 256 + bytes[3]];
}
