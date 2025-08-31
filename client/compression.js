import { momentReplay, virtualCanvas } from "./client.js";
import {
  decodeLargeNumber,
  encodeLargeNumber,
  toolLength,
  TOOLCODEINDEX,
  decodeExtraLargeNumber,
  encodeExtraLargeNumber,
  buildTransaction,
  toolLayouts,
  decodePosition,
  encodePosition,
} from "./transaction.js";
import { OP_TYPE, OP_SYNC } from "./shared/instructionset.js";
import { qoiDecode, qoiEncode } from "./qoi.js";

export const decompressMoment = (eventData) => {
  const { CHUNK_SIZE } = virtualCanvas;
  let inc = 2;
  const momentIndex = eventData[inc++];
  const width = decodeLargeNumber(eventData.subarray(inc, (inc += 2)));
  const height = decodeLargeNumber(eventData.subarray(inc, (inc += 2)));
  const row = decodeLargeNumber(eventData.subarray(inc, (inc += 2)));
  const col = decodeLargeNumber(eventData.subarray(inc, (inc += 2)));
  const time = decodeExtraLargeNumber(eventData.subarray(inc, (inc += 4)));
  const transactionLength = toolLength[eventData[inc + TOOLCODEINDEX]];
  const transaction = eventData.subarray(inc, (inc += transactionLength));
  const count = decodeExtraLargeNumber(eventData.subarray(inc, (inc += 4)));
  const positions = [];
  for (let index = 0; index < count; index++)
    positions.push(decodeExtraLargeNumber(eventData.subarray(inc, (inc += 4))));
  const qoiData = eventData.subarray(inc);
  const pixelCount = CHUNK_SIZE * CHUNK_SIZE * 4;
  const decodedQoi = qoiDecode(qoiData, CHUNK_SIZE, CHUNK_SIZE * count);
  const changedChunks = new Map();
  //split into changedChunks
  for (let index = 0; index < count; index++) {
    const chunk = momentReplay.newChunk();
    const ctx = chunk.getContext("2d");
    const start = index * pixelCount;
    const end = (index + 1) * pixelCount;
    const { buffer, byteOffset, byteLength } = decodedQoi.subarray(start, end);
    const clamped = new Uint8ClampedArray(buffer, byteOffset, byteLength);
    ctx.putImageData(new ImageData(clamped, CHUNK_SIZE, CHUNK_SIZE), 0, 0);
    changedChunks.set(positions[index], chunk);
  }
  return [
    momentIndex,
    {
      transaction,
      time,
      changedChunks,
      width,
      height,
      col,
      row,
    },
  ];
};

export const compressMoment = (moment, index) => {
  const { CHUNK_SIZE } = virtualCanvas;

  const opType = OP_TYPE.SYNC; // 1 byte
  const opSync = OP_SYNC.MOMENTS; // 1 byte
  const width = encodeLargeNumber(moment.width); // 2 bytes
  const height = encodeLargeNumber(moment.height); // 2 bytes
  const row = encodeLargeNumber(moment.row); // 2 bytes
  const col = encodeLargeNumber(moment.col); // 2 bytes
  const time = encodeExtraLargeNumber(moment.time); // 4 bytes
  const transaction = moment.transaction;
  const countNum = moment.changedChunks.size; // number
  const count = encodeExtraLargeNumber(countNum); // 4 bytes
  const bytesPerChunk = CHUNK_SIZE * CHUNK_SIZE * 4; // RGBA
  const joinedChunks = new Uint8Array(bytesPerChunk * countNum);
  const positionsEncoded = [];
  let offset = 0;
  for (const [pos, canvas] of moment.changedChunks) {
    positionsEncoded.push(encodeExtraLargeNumber(Number(pos)));
    const u8 = readUint8FromCanvas(canvas); // must be length == bytesPerChunk
    joinedChunks.set(u8, offset);
    offset += u8.length;
  }
  // QOI is decoded as qoiDecode(qoiData, CHUNK_SIZE, CHUNK_SIZE * count)
  // so we must encode with the same dimensions.
  const encodedQoi = qoiEncode(joinedChunks, CHUNK_SIZE, CHUNK_SIZE * countNum);

  // Compute total length and assemble the packet
  const totalLength =
    2 /* opType + opSync + momentIndex */ +
    1 +
    2 /* width,height,row,col */ +
    2 +
    2 +
    2 +
    4 /* time */ +
    transaction.length /* transaction */ +
    4 /* count */ +
    4 * countNum /* positions */ +
    encodedQoi.length; /* qoi */
  const out = new Uint8Array(totalLength);
  let inc = 0;
  out[inc++] = opType & 0xff;
  out[inc++] = opSync & 0xff;
  out[inc++] = index & 0xff;
  out.set(width, inc);
  inc += 2;
  out.set(height, inc);
  inc += 2;
  out.set(row, inc);
  inc += 2;
  out.set(col, inc);
  inc += 2;
  out.set(time, inc);
  inc += 4;
  out.set(transaction, inc);
  inc += transaction.length;
  out.set(count, inc);
  inc += 4;
  for (const posBytes of positionsEncoded) {
    out.set(posBytes, inc);
    inc += 4;
  }
  out.set(encodedQoi, inc); // inc += encodedQoi.length; // not needed after
  return out;
};

const readUint8FromCanvas = (canvas) =>
  canvas
    .getContext("2d")
    .getImageData(0, 0, virtualCanvas.CHUNK_SIZE, virtualCanvas.CHUNK_SIZE)
    .data; // Uint8ClampedArray

// Utility: shallow byte equality for TypedArrays (Uint8Array, Uint8ClampedArray)
const equalBytes = (a, b) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

// Utility: normalize to Uint8Array for consistent comparisons
const toU8 = (typed) =>
  typed instanceof Uint8Array
    ? typed
    : new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);

// Utility: read raw RGBA bytes from a canvas chunk
const readChunkRGBA = (canvas) =>
  toU8(
    canvas
      .getContext("2d")
      .getImageData(0, 0, virtualCanvas.CHUNK_SIZE, virtualCanvas.CHUNK_SIZE)
      .data
  );

/**
 * Validate that compressMoment/decompressMoment are inverses for a single moment.
 * @param {object} moment - the original moment object
 * @param {number} index - the moment index to encode
 * @returns {{
 *   ok: boolean,
 *   mismatches: string[],
 *   encodedLength: number,
 *   encodedHeader?: { opType:number, opSync:number, momentIndex:number },
 *   decoded?: any
 * }}
 */
export function validateMomentRoundTrip(moment, index) {
  const mismatches = [];

  // 1) Encode
  const encoded = compressMoment(moment, index);

  // 2) Quick header sanity (decompress ignores first 2 bytes, but we validate anyway)
  const opType = encoded[0];
  const opSync = encoded[1];
  const momentIndexByte = encoded[2];
  if (opType !== OP_TYPE.SYNC)
    mismatches.push(`opType mismatch: ${opType} != ${OP_TYPE.SYNC}`);
  if (opSync !== OP_SYNC.MOMENTS)
    mismatches.push(`opSync mismatch: ${opSync} != ${OP_SYNC.MOMENTS}`);
  if (momentIndexByte !== (index & 0xff))
    mismatches.push(
      `momentIndex mismatch: ${momentIndexByte} != ${index & 0xff}`
    );

  // 3) Decode (round-trip)
  const [decodedIndex, decoded] = decompressMoment(encoded);

  // 4) Compare scalar fields
  if (decodedIndex !== (index & 0xff))
    mismatches.push(
      `decoded index mismatch: ${decodedIndex} != ${index & 0xff}`
    );
  if (decoded.width !== moment.width)
    mismatches.push(`width mismatch: ${decoded.width} != ${moment.width}`);
  if (decoded.height !== moment.height)
    mismatches.push(`height mismatch: ${decoded.height} != ${moment.height}`);
  if (decoded.row !== moment.row)
    mismatches.push(`row mismatch: ${decoded.row} != ${moment.row}`);
  if (decoded.col !== moment.col)
    mismatches.push(`col mismatch: ${decoded.col} != ${moment.col}`);
  if (decoded.time !== moment.time)
    mismatches.push(`time mismatch: ${decoded.time} != ${moment.time}`);

  // 5) Transaction bytes
  const txA = toU8(moment.transaction);
  const txB = toU8(decoded.transaction);
  if (!equalBytes(txA, txB))
    mismatches.push(
      `transaction bytes mismatch (len ${txA.length} vs ${txB.length})`
    );

  // 6) Positions (as sets) and pixel data (per position)
  const origPositions = new Set([...moment.changedChunks.keys()].map((k) => k));
  const decPositions = new Set([...decoded.changedChunks.keys()].map((k) => k));

  // Set equality
  if (origPositions.size !== decPositions.size) {
    mismatches.push(
      `positions count mismatch: ${origPositions.size} != ${decPositions.size}`
    );
  } else {
    for (const p of origPositions)
      if (!decPositions.has(p))
        mismatches.push(`missing decoded position ${p.toString()}`);
  }

  // Pixel-by-pixel equality for each position
  if (mismatches.length === 0) {
    const { CHUNK_SIZE } = virtualCanvas;
    const expectedLen = CHUNK_SIZE * CHUNK_SIZE * 4;

    for (const [pos, origCanvas] of moment.changedChunks) {
      const key = pos;
      const decCanvas = decoded.changedChunks.get(key);
      if (!decCanvas) {
        mismatches.push(`no decoded canvas for position ${key.toString()}`);
        continue;
      }

      const a = readChunkRGBA(origCanvas);
      const b = readChunkRGBA(decCanvas);
      if (a.length !== expectedLen)
        mismatches.push(
          `orig RGBA length at ${key} is ${a.length}, expected ${expectedLen}`
        );
      if (b.length !== expectedLen)
        mismatches.push(
          `decoded RGBA length at ${key} is ${b.length}, expected ${expectedLen}`
        );

      if (!equalBytes(a, b))
        mismatches.push(`pixel data mismatch at position ${key.toString()}`);
    }
  }

  return {
    ok: mismatches.length === 0,
    mismatches,
    encodedLength: encoded.length,
    encodedHeader: { opType, opSync, momentIndex: momentIndexByte },
    decoded, // helpful for debugging
  };
}

//
//
//    .g8"""bgd
//  .dP'     `M
//  dM'       `  ,pW"Wq.  `7MMpMMMb.pMMMb.  `7MMpdMAo.
//  MM          6W'   `Wb   MM    MM    MM    MM   `Wb
//  MM.         8M     M8   MM    MM    MM    MM    M8
//  `Mb.     ,' YA.   ,A9   MM    MM    MM    MM   ,AP
//    `"bmmmd'   `Ybmd9'  .JMML  JMML  JMML.  MMbmmd'
//                                            MM
//                                          .JMML.

export const encodeVarint = (value) => {
  let n = typeof value === "bigint" ? value : BigInt(value);
  if (n < 0n) throw new RangeError("encodeVarint non-negative integers only");
  const bytes = [];
  while (n >= 0x80n) {
    bytes.push(Number((n & 0x7fn) | 0x80n));
    n >>= 7n;
  }
  bytes.push(Number(n));
  return Uint8Array.from(bytes);
};

export const decodeVarint = (buf, ptr) => {
  let shift = 0n,
    result = 0n;
  let byte;
  do {
    byte = BigInt(buf[ptr++]);
    result |= (byte & 0x7fn) << shift;
    shift += 7n;
  } while (byte & 0x80n);
  return [result, ptr];
};

export const encodeSignedVarInt = (value) => {
  // 1) zig‑zag map signed → unsigned
  const n = typeof value === "bigint" ? value : BigInt(value);
  const zz = n >= 0n ? n << 1n : (-n << 1n) - 1n;

  // 2) varint‑encode the zig‑zag result
  const bytes = [];
  let temp = zz;
  while (temp >= 0x80n) {
    bytes.push(Number((temp & 0x7fn) | 0x80n));
    temp >>= 7n;
  }
  bytes.push(Number(temp));
  return Uint8Array.from(bytes);
};

export const decodeSignedVarInt = (buf, ptr = 0) => {
  // 1) varint‑decode to get unsigned zig‑zagged integer
  let shift = 0n;
  let result = 0n;
  let byte;
  do {
    byte = BigInt(buf[ptr++]);
    result |= (byte & 0x7fn) << shift;
    shift += 7n;
  } while (byte & 0x80n);

  // 2) zig‑zag unmap unsigned → signed
  const signed = (result & 1n) === 0n ? result >> 1n : -((result >> 1n) + 1n);

  return [signed, ptr];
};

const bytesToBigInt = (bytes) => {
  let n = 0n;
  for (let b of bytes) {
    n = (n << 8n) | BigInt(b);
  }
  return n;
};

const bigIntToBytes8 = (n) => {
  const bytes = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    // byte 0 is most‑significant
    bytes[i] = Number((n >> BigInt(8 * (7 - i))) & 0xffn);
  }
  return bytes;
};

export const extendCompressedTransaction = (compressed, transactions) => {
  if (compressed.length < 3) {
    if (transactions.length < 16)
      return new Uint8Array([OP_TYPE.SYNC, OP_SYNC.COMPRESSED_TRANSACTIONS, 0]);
    return buildTransaction(
      [OP_TYPE.SYNC, OP_SYNC.COMPRESSED_TRANSACTIONS],
      compressTransaction(transactions)
    );
  }

  const lastTime = bytesToBigInt(compressed.subarray(compressed.length - 8));
  const base = compressed.subarray(0, compressed.length - 8);
  if (transactions.length < 16)
    return buildTransaction(
      [OP_TYPE.SYNC, OP_SYNC.COMPRESSED_TRANSACTIONS],
      base
    );
  const extension = compressTransaction(transactions, lastTime);
  return buildTransaction(
    [OP_TYPE.SYNC, OP_SYNC.COMPRESSED_TRANSACTIONS],
    base,
    extension
  );
};

/*
  The compression ratio of this algorithm is ~10:1.
  Majority of the compression is by grouping splines and deduplicating values.
  Extra compression is obtained by using time and position diffs.
*/

export const compressTransaction = (transactions, lastTime = 0n) => {
  const t0 = performance.now();

  const txs = [];
  let offset = 0;
  while (offset < transactions.length) {
    const transactionLength = toolLength[transactions[offset + TOOLCODEINDEX]];
    txs.push(transactions.subarray(offset, offset + transactionLength));
    offset += transactionLength;
  }

  const groups = new Map();

  for (let tx of txs) {
    const timeBytes = tx.subarray(0, 8);
    const opBytes = tx.subarray(8, 16);
    const opKey = bytesToBigInt(opBytes);
    const timeVal = bytesToBigInt(timeBytes);
    if (!groups.has(opKey)) groups.set(opKey, []);
    groups.get(opKey).push({ tx, time: timeVal });
  }

  for (let group of groups.values())
    group.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));

  const sortedGroups = Array.from(groups.values())
    .map((group) => ({
      time: group[0].time,
      group,
    }))
    .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0))
    .map(({ group }) => group.map(({ tx }) => tx));

  const splitGroups = [];
  sortedGroups.forEach((group) => {
    const firstTx = group[0];
    const lay = toolLayouts[firstTx[TOOLCODEINDEX]];
    const length = lay.length;
    const isSpline =
      lay[length - 1] === 4 && lay[length - 2] === 4 && lay[length - 3] === 4;
    if (!isSpline) return splitGroups.push(group);

    const txLength = firstTx.length;

    let continuousSegment = [];
    let last2 = decodePosition(firstTx.subarray(txLength - 12, txLength - 8));
    let last3 = decodePosition(firstTx.subarray(txLength - 8, txLength - 4));

    for (const tx of group) {
      const cur1 = decodePosition(tx.subarray(txLength - 12, txLength - 8));
      const cur2 = decodePosition(tx.subarray(txLength - 8, txLength - 4));
      const cur3 = decodePosition(tx.subarray(txLength - 4));

      let continuous = true;
      continuous &&= last2[0] === cur1[0] && last2[1] === cur1[1];
      continuous &&= last3[0] === cur2[0] && last3[1] === cur2[1];

      if (!continuous && continuousSegment.length) {
        splitGroups.push(continuousSegment);
        continuousSegment = [];
      }

      last2 = cur2;
      last3 = cur3;
      continuousSegment.push(tx);
    }

    if (continuousSegment.length) splitGroups.push(continuousSegment);
  });

  const compTxs = [];
  let lastTimeBytes;

  for (const opGroup of splitGroups) {
    const tx = opGroup.shift();
    const curTime = bytesToBigInt(tx.subarray(0, 8));
    lastTimeBytes = tx.subarray(0, 8);
    compTxs.push(encodeSignedVarInt(curTime - lastTime));
    compTxs.push(tx.subarray(8, 17));
    lastTime = curTime;

    const lay = toolLayouts[tx[TOOLCODEINDEX]];
    let offset = TOOLCODEINDEX + 1;
    for (const len of lay) {
      compTxs.push(tx.subarray(offset, offset + len));
      offset += len;
    }

    const length = lay.length;
    const isSpline =
      lay[length - 1] === 4 && lay[length - 2] === 4 && lay[length - 3] === 4;
    if (!isSpline) continue;

    compTxs.push(encodeVarint(opGroup.length));
    let lastPosition = decodePosition(tx.subarray(tx.length - 4));
    for (const tx of opGroup) {
      const curTime = bytesToBigInt(tx.subarray(0, 8));
      lastTimeBytes = tx.subarray(0, 8);
      compTxs.push(encodeSignedVarInt(curTime - lastTime));
      lastTime = curTime;

      const position = decodePosition(tx.subarray(tx.length - 4));
      compTxs.push(encodeSignedVarInt(position[0] - lastPosition[0]));
      compTxs.push(encodeSignedVarInt(position[1] - lastPosition[1]));
      lastPosition = position;
    }
  }

  compTxs.push(lastTimeBytes);

  let sourceLength = 0;
  for (let index = 0; index < txs.length; index++)
    sourceLength += txs[index].length;

  let compLength = 0;
  for (let index = 0; index < compTxs.length; index++)
    compLength += compTxs[index].length;

  const compressed = new Uint8Array(compLength);
  let off = 0;
  for (let index = 0; index < compTxs.length; index++) {
    compressed.set(compTxs[index], off);
    off += compTxs[index].length;
  }

  const elapsedMs = performance.now() - t0;

  console.log(
    `TOTAL: IN: ${formatBytes(sourceLength)}, ` +
      `OUT: ${formatBytes(compLength)}, ` +
      `RATIO: ${(sourceLength / compLength).toFixed(2)}, ` +
      `THROUGHPUT: ${formatBytes(
        (sourceLength * 1000) / Math.floor(elapsedMs)
      )}\/s`
  );
  return compressed;
};

export const decompressTransaction = (compressed) => {
  if (compressed.length < 16) return [];
  const txs = [];
  let ptr = 0;
  let lastTime = 0n;

  //8 short since last bytes are time bytes used for extension.
  while (ptr < compressed.length - 8) {
    const [dt, ptrAfterTime] = decodeSignedVarInt(compressed, ptr);
    ptr = ptrAfterTime;
    const curTime = lastTime + dt;
    lastTime = curTime;

    const opKeyBytes = compressed.subarray(ptr, ptr + 8);
    const toolCode = compressed[ptr + 8];
    ptr += 9;

    const timeBytes = bigIntToBytes8(curTime);
    const header = new Uint8Array(8 + 8 + 1);
    header.set(timeBytes, 0);
    header.set(opKeyBytes, 8);
    header[16] = toolCode;

    const lay = toolLayouts[toolCode];
    const staticSegs = [];
    for (const len of lay) {
      staticSegs.push(compressed.subarray(ptr, ptr + len));
      ptr += len;
    }

    const baseLen =
      header.length + staticSegs.reduce((s, seg) => s + seg.length, 0);
    const baseTx = new Uint8Array(baseLen);
    baseTx.set(header, 0);
    let off = header.length;
    for (const seg of staticSegs) {
      baseTx.set(seg, off);
      off += seg.length;
    }

    txs.push(baseTx);

    const L = lay.length;
    const isSpline =
      L >= 3 && lay[L - 1] === 4 && lay[L - 2] === 4 && lay[L - 3] === 4;
    if (!isSpline) continue;

    const [groupCount, ptrAfterCount] = decodeVarint(compressed, ptr);
    ptr = ptrAfterCount;

    const prefixSegs = staticSegs.slice(0, -3);
    let [prevA, prevB, prevC] = staticSegs
      .slice(-3)
      .map((seg) => decodePosition(seg)); // each is [x,y]

    for (let i = 0; i < Number(groupCount); i++) {
      const [dt, p1] = decodeSignedVarInt(compressed, ptr);
      ptr = p1;
      lastTime += dt;

      const [dx, p2] = decodeSignedVarInt(compressed, ptr);
      const [dy, p3] = decodeSignedVarInt(compressed, p2);
      ptr = p3;

      const newC = [prevC[0] + Number(dx), prevC[1] + Number(dy)];

      const timeBytes2 = bigIntToBytes8(lastTime);
      const header2 = new Uint8Array(17);
      header2.set(timeBytes2, 0);
      header2.set(opKeyBytes, 8);
      header2[16] = toolCode;

      const segA = encodePosition(prevB);
      const segB = encodePosition(prevC);
      const segC = encodePosition(newC);

      const outLen =
        header2.length +
        prefixSegs.reduce((sum, s) => sum + s.length, 0) +
        segA.length +
        segB.length +
        segC.length;
      const tx2 = new Uint8Array(outLen);

      let off = 0;
      tx2.set(header2, off);
      off += header2.length;
      for (const s of prefixSegs) {
        tx2.set(s, off);
        off += s.length;
      }
      tx2.set(segA, off);
      off += segA.length;
      tx2.set(segB, off);
      off += segB.length;
      tx2.set(segC, off);

      txs.push(tx2);

      prevA = prevB;
      prevB = prevC;
      prevC = newC;
    }
  }

  return txs;
};

/**
 * Compare two transactions by their first 16 bytes:
 *   – first 8 bytes = timestamp (big‑endian)
 *   – next 8 bytes  = opId    (big‑endian)
 */
function compareTx(a, b) {
  const tA = bytesToBigInt(a.subarray(0, 8));
  const tB = bytesToBigInt(b.subarray(0, 8));
  if (tA < tB) return -1;
  if (tA > tB) return 1;

  const opA = bytesToBigInt(a.subarray(8, 16));
  const opB = bytesToBigInt(b.subarray(8, 16));
  if (opA < opB) return -1;
  if (opA > opB) return 1;

  return 0;
}

const compressAndConcat = (txs) => {
  const mid = Math.floor(txs.length / 2);

  const firstHalf = txs.slice(0, mid);
  const secondHalf = txs.slice(mid);

  const compressedFirst = compressTransaction(firstHalf);

  return extendCompressedTransaction(compressedFirst, secondHalf);
};

/**
 * Validates that compress→decompress is a perfect round‑trip (ignoring order).
 * Logs exactly which tx and which byte index differs.
 */
export function validateCompression(txs) {
  const compressed = compressAndConcat(txs);
  const decompressed = decompressTransaction(compressed);

  if (decompressed.length !== txs.length) {
    console.error(
      `❌ Count mismatch: original=${txs.length}, ` +
        `decompressed=${decompressed.length}`
    );
    return false;
  }

  const origSorted = [...txs].sort(compareTx);
  const decSorted = [...decompressed].sort(compareTx);

  let passes = true;
  for (let i = 0; i < origSorted.length; i++) {
    const a = origSorted[i];
    const b = decSorted[i];

    if (a.length !== b.length) {
      passes = false;
      console.error(`❌ Tx ${i} length mismatch: ${a.length} vs ${b.length}`);
    }

    for (let j = 0; j < a.length; j++) {
      if (a[j] !== b[j]) {
        passes = false;
        console.error(
          `❌ Tx ${i} byte ${j} mismatch: ` +
            `expected 0x${a[j].toString(16)}, got 0x${b[j].toString(16)}`
        );
        console.log("   original tx bytes:", a);
        console.log("   decoded  tx bytes:", b);
      }
    }
  }

  if (passes) {
    console.log("✅ Validation successful: all transactions match!");
    return true;
  }

  console.log("❌ Fails OOPS");
  return false;
}

function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return "0.0 Bs";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = [" Bs", "KBs", "MBs", "GBs", "TBs"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  // toFixed(dm) will always emit dm decimals (including trailing zeros)
  const value = (bytes / Math.pow(k, i)).toFixed(dm);
  return value + sizes[i];
}
