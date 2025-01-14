import { promises as fs } from "fs";

const adjectives: string[] = [];
const nouns: string[] = [];
let combinations = 0;
let initialized = false;

async function readLinesFromFile(filePath: string): Promise<string[]> {
  try {
    const fileContent = await fs.readFile(filePath, "utf8");
    const lines = fileContent.split("\n");
    return lines.map((line) => line.replace(/\r$/, ""));
  } catch (error) {
    console.error("Error reading file:", error);
    throw error;
  }
}

(async () => {
  adjectives.push(
    ...(await readLinesFromFile("./server/keygen/adjectives_categorized.txt"))
  );
  nouns.push(
    ...(await readLinesFromFile("./server/keygen/nouns_categorized.txt"))
  );

  const A = adjectives.length;
  const N = nouns.length;
  const adjPairCount = (A * (A - 1)) / 2;
  combinations = N * adjPairCount;
  startPoint = Math.floor(Math.random() * combinations);
  initialized = true;
})();

let keyIndex = 0;
const prime = 3469;
let startPoint: number;

export default function keyGen() {
  while (!initialized) {
    
  }
  // Compute the randomIndex
  const randomIndex = (prime * keyIndex + startPoint) % combinations;

  const A = adjectives.length;
  const N = nouns.length;
  const adjPairCount = (A * (A - 1)) / 2;

  const nounIndex = Math.floor(randomIndex % N);
  const adjPairIndex = randomIndex % adjPairCount;

  const noun = nouns[nounIndex];

  // Decode adjPairIndex to get two adjectives
  let i = 0;
  let offset = adjPairIndex;
  let firstAdjective: string;
  let secondAdjective: string;

  while (i < A - 1) {
    const countForI = A - i - 1;
    if (offset < countForI) {
      const j = i + 1 + offset;
      firstAdjective = adjectives[i];
      secondAdjective = adjectives[j];
      break;
    }
    offset -= countForI;
    i++;
  }

  function capitalizeFirstLetter(string: string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  // You now have noun, firstAdjective, and secondAdjective
  // Do something with them here

  keyIndex++; // increment keyIndex to get a new combination next time

  return (
    capitalizeFirstLetter(firstAdjective!) +
    capitalizeFirstLetter(secondAdjective!) +
    capitalizeFirstLetter(noun)
  );
}
