const base62Chars =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export default function newTransaction(canvasEdit) {
  const deciSecondsSinceEpoch = Math.floor(Date.now() / 10);

  const base62 = Array.from(
    { length: 7 },
    (_, i, arr) =>
      base62Chars[Math.floor(deciSecondsSinceEpoch / 62 ** (7 - i - 1)) % 62]
  ).join("");

  const uuid = Array.from(
    { length: 4 },
    () => base62Chars[Math.floor(Math.random() * 62)]
  ).join("");

  return `${base62}${uuid};${canvasEdit}`;
}

function getDecisecondsBuffer() {
  // Calculate the number of deciseconds since 1/1/1970
  const now = Date.now(); // Milliseconds since epoch
  let deciseconds = Math.floor(now / 100); // Convert to deciseconds

  // Create a 5-byte buffer
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);

  // Write the deciseconds value into the buffer, padded to 5 bytes
  // We fill the buffer from the rightmost bytes to ensure padding
  for (let i = 4; i >= 0; i--) {
    view.setUint8(i, deciseconds & 0xff); // Write the least significant byte
    deciseconds >>>= 8; // Shift the value right by 8 bits
  }

  for (let i = 5; i < 8; i++) {
    view.setUint8(i, Math.floor(Math.random() * 256));
  }

  return buffer;
}

// Usage example:
const buffer = getDecisecondsBuffer();
console.log(new Uint8Array(buffer)); // Logs the 5-byte buffer as a Uint8Array for inspection

// Example usage
const canvasEdit = "spline;EDFFE4,1,10,10,100,100";
const transactions = [];
transactions[2] = newTransaction(canvasEdit);
setTimeout(() => {
  transactions[0] = newTransaction(canvasEdit);
  console.log(transactions[0]);
  transactions.sort();
  console.log(transactions[0]);
  console.log(transactions[1]);
  console.log(transactions[2]);
}, 30);
transactions[1] = newTransaction(canvasEdit);
