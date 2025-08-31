// Qoi is used to encode canvas snapshots for sending to the server. Works by looping through each pixel and choosing an OP which has the best compression.
// https://qoiformat.org/qoi-specification.pdf

const QOI_RGB = 0b11111110; // full RGB (no compression on channels, alpha unchanged)
const QOI_RGBA = 0b11111111; // full RGBA (no compression on channels)
// 4 packed methods for compressing an incoming pixel:
const QOI_INDEX = 0b00; // Index into a hot hashmap of pixel colors in 1 byte
const QOI_DIFF = 0b01; // Diff from previous pixel color in 1 byte (RGB-only, A same)
const QOI_LUMA = 0b10; // Luma-based diff in 2 bytes (RGB-only, A same)
const QOI_RUN = 0b11; // Run of the same pixel color in 1 byte per run

// Helper to pack/unpack RGBA into a 32-bit int
const packRGBA = (r, g, b, a) => ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
const rFrom = (p) => (p >>> 24) & 255;
const gFrom = (p) => (p >>> 16) & 255;
const bFrom = (p) => (p >>> 8) & 255;
const aFrom = (p) => p & 255;

export const qoiEncode = (pixels /* Uint8Array: RGBA RGBA ... */) => {
  const index = new Uint32Array(64);
  let prevR = 0,
    prevG = 0,
    prevB = 0,
    prevA = 255; // QOI starts with A=255
  let run = 0;

  // Over-allocate; trim at end
  const data = new Uint8Array(pixels.length * 2);
  let dataSize = 0;

  const setByte = (byte) => (data[dataSize++] = byte);
  const setBytes = (...bytes) => {
    for (let i = 0; i < bytes.length; i++) data[dataSize++] = bytes[i];
  };

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];

    // RUN only if full RGBA matches
    const canRun = r === prevR && g === prevG && b === prevB && a === prevA;
    if (canRun) {
      if (++run === 62 || i + 4 >= pixels.length) {
        setByte((QOI_RUN << 6) | (run - 1));
        run = 0;
      }
      continue;
    }
    if (run > 0) {
      setByte((QOI_RUN << 6) | (run - 1));
      run = 0;
    }

    // If alpha changed, we must emit RGBA literal
    if (a !== prevA) {
      setBytes(QOI_RGBA, r, g, b, a);
      const packed = packRGBA(r, g, b, a);
      index[(r * 3 + g * 5 + b * 7 + a * 11) & 63] = packed;
      prevR = r;
      prevG = g;
      prevB = b;
      prevA = a;
      continue;
    }

    // Alpha same: try INDEX / DIFF / LUMA / RGB
    const hashIndex = (r * 3 + g * 5 + b * 7 + a * 11) & 63;
    const packedNow = packRGBA(r, g, b, a);
    if (index[hashIndex] === packedNow) {
      setByte((QOI_INDEX << 6) | hashIndex);
    } else {
      index[hashIndex] = packedNow;

      const dr = r - prevR;
      const dg = g - prevG;
      const db = b - prevB;

      // DIFF: each of dr,dg,db in [-2, 1] => encoded as +2 bias (range 0..3)
      const canDiff =
        dr >= -2 && dr <= 1 && dg >= -2 && dg <= 1 && db >= -2 && db <= 1;

      if (canDiff) {
        setByte((QOI_DIFF << 6) | ((dr + 2) << 4) | ((dg + 2) << 2) | (db + 2));
      } else {
        // LUMA: dg in [-32,31], and (dr-dg),(db-dg) in [-8,7]
        const dgr = dr - dg;
        const dgb = db - dg;
        const canLuma =
          dg >= -32 &&
          dg <= 31 &&
          dgr >= -8 &&
          dgr <= 7 &&
          dgb >= -8 &&
          dgb <= 7;

        if (canLuma) {
          setByte((QOI_LUMA << 6) | ((dg + 32) & 0x3f));
          setByte(((dgr + 8) << 4) | (dgb + 8));
        } else {
          // Fallback: full RGB literal (alpha unchanged)
          setBytes(QOI_RGB, r, g, b);
        }
      }
    }

    prevR = r;
    prevG = g;
    prevB = b; /* prevA unchanged (same as a) */
  }

  return data.slice(0, dataSize);
};

export const qoiDecode = (qoiData, width, height) => {
  const index = new Uint32Array(64);
  const pixels = new Uint8Array(width * height * 4);

  let prevR = 0,
    prevG = 0,
    prevB = 0,
    prevA = 255; // initial pixel
  let dataIndex = 0,
    pixelIndex = 0;

  while (dataIndex < qoiData.length && pixelIndex < pixels.length) {
    const byte = qoiData[dataIndex++];

    if (byte === QOI_RGB) {
      prevR = qoiData[dataIndex++];
      prevG = qoiData[dataIndex++];
      prevB = qoiData[dataIndex++];
      // prevA unchanged
    } else if (byte === QOI_RGBA) {
      prevR = qoiData[dataIndex++];
      prevG = qoiData[dataIndex++];
      prevB = qoiData[dataIndex++];
      prevA = qoiData[dataIndex++];
    } else {
      const tag = byte >> 6;
      if (tag === QOI_INDEX) {
        const hashIdx = byte & 0x3f;
        const packed = index[hashIdx];
        prevR = rFrom(packed);
        prevG = gFrom(packed);
        prevB = bFrom(packed);
        prevA = aFrom(packed);
      } else if (tag === QOI_RUN) {
        let run = (byte & 0x3f) + 1;
        while (run-- && pixelIndex < pixels.length) {
          pixels[pixelIndex++] = prevR;
          pixels[pixelIndex++] = prevG;
          pixels[pixelIndex++] = prevB;
          pixels[pixelIndex++] = prevA;
        }
        // Update index for the current color after the run, as encoder would have done
        index[(prevR * 3 + prevG * 5 + prevB * 7 + prevA * 11) & 63] = packRGBA(
          prevR,
          prevG,
          prevB,
          prevA
        );
        continue;
      } else if (tag === QOI_DIFF) {
        const diff = byte & 0x3f;
        const dr = ((diff >> 4) & 0x03) - 2;
        const dg = ((diff >> 2) & 0x03) - 2;
        const db = (diff & 0x03) - 2;
        prevR = (prevR + dr) & 255;
        prevG = (prevG + dg) & 255;
        prevB = (prevB + db) & 255;
        // A unchanged
      } else if (tag === QOI_LUMA) {
        const drdb = qoiData[dataIndex++];
        const dg = (byte & 0x3f) - 32;
        const dr = (drdb >> 4) - 8 + dg;
        const db = (drdb & 15) - 8 + dg;
        prevR = (prevR + dr) & 255;
        prevG = (prevG + dg) & 255;
        prevB = (prevB + db) & 255;
        // A unchanged
      }
    }

    // Write pixel
    pixels[pixelIndex++] = prevR;
    pixels[pixelIndex++] = prevG;
    pixels[pixelIndex++] = prevB;
    pixels[pixelIndex++] = prevA;

    // Update index with full RGBA
    index[(prevR * 3 + prevG * 5 + prevB * 7 + prevA * 11) & 63] = packRGBA(
      prevR,
      prevG,
      prevB,
      prevA
    );
  }

  return pixels;
};
