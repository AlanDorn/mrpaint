const base62Chars =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export default function newTransaction(canvasEdit) {
  const deciSecondsSinceEpoch = Math.floor((Date.now()) / 10);

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
