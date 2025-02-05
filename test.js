const QOI_OP_RGB = 0b11111110;
const QOI_OP_INDEX = 0b00;
const QOI_OP_DIFF = 0b01;
const QOI_OP_LUMA = 0b10;
const QOI_OP_RUN = 0b11;

function qoiEncode(pixels) {
  const startTime = performance.now();
  const index = new Uint32Array(64);
  let prevR = 0,
    prevG = 0,
    prevB = 0;
  let run = 0;

  let data = new Uint8Array(pixels.length * 2);
  let dataSize = 0;

  function pushByte(byte) {
    data[dataSize++] = byte;
  }

  function pushBytes(...bytes) {
    for (let b of bytes) data[dataSize++] = b;
  }

  for (let i = 0; i < pixels.length; i += 3) {
    let r = pixels[i],
      g = pixels[i + 1],
      b = pixels[i + 2];

    if (r === prevR && g === prevG && b === prevB) {
      if (++run === 62 || i + 3 >= pixels.length) {
        pushByte((QOI_OP_RUN << 6) | (run - 1));
        run = 0;
      }
      continue;
    }

    if (run > 0) {
      pushByte((QOI_OP_RUN << 6) | (run - 1));
      run = 0;
    }

    const hashIndex = (r * 3 + g * 5 + b * 7) & 63;
    if (index[hashIndex] === ((r << 16) | (g << 8) | b)) {
      pushByte((QOI_OP_INDEX << 6) | hashIndex);
    } else {
      index[hashIndex] = (r << 16) | (g << 8) | b;

      const dr = r - prevR;
      const dg = g - prevG;
      const db = b - prevB;

      // Use DIFF if the difference between color channels is small (in range [-2, 2])
      if (
        Math.abs(dr + 0.5) <= 1.5 &&
        Math.abs(dg + 0.5) <= 1.5 &&
        Math.abs(db + 0.5) <= 1.5
      ) {
        pushByte(
          (QOI_OP_DIFF << 6) | ((dr + 2) << 4) | ((dg + 2) << 2) | (db + 2)
        );
      } else if (
        Math.abs(dg + 0.5) <= 31.5 &&
        Math.abs(dr - dg + 0.5) <= 7.5 &&
        Math.abs(db - dg + 0.5) <= 7.5
      ) {
        pushByte((QOI_OP_LUMA << 6) | ((dg + 32) & 0x3f));
        pushByte(((dr - dg + 8) << 4) | (db - dg + 8));
      } else {
        pushBytes(QOI_OP_RGB, r, g, b);
      }
    }

    prevR = r;
    prevG = g;
    prevB = b;
  }

  pushBytes(0, 0, 0, 0, 0, 0, 0, 1);
  console.log("Time to encode: ", (performance.now() - startTime) / 1000);
  return data.slice(0, dataSize);
}

function qoiDecode(qoiData, width, height) {
  const startTime = performance.now();
  const index = new Uint32Array(64);
  let pixels = new Uint8Array(width * height * 3);
  let prevR = 0,
    prevG = 0,
    prevB = 0;
  let dataIndex = 0,
    pixelIndex = 0;

  while (dataIndex < qoiData.length - 8) {
    let byte = qoiData[dataIndex++];

    if (byte === QOI_OP_RGB) {
      prevR = qoiData[dataIndex++];
      prevG = qoiData[dataIndex++];
      prevB = qoiData[dataIndex++];
    } else if (byte >> 6 === QOI_OP_INDEX) {
      let hashIdx = byte & 0x3f;
      let idx = index[hashIdx];
      prevR = (idx >> 16) & 255;
      prevG = (idx >> 8) & 255;
      prevB = idx & 255;
    } else if (byte >> 6 === QOI_OP_RUN) {
      let run = (byte & 0x3f) + 1;
      while (run--) {
        pixels[pixelIndex++] = prevR;
        pixels[pixelIndex++] = prevG;
        pixels[pixelIndex++] = prevB;
      }
      continue;
    } else if (byte >> 6 === QOI_OP_DIFF) {
      let diff = byte & 0x3f;
      let dr = ((diff >> 4) & 0x03) - 2;
      let dg = ((diff >> 2) & 0x03) - 2;
      let db = (diff & 0x03) - 2;
      prevR += dr;
      prevG += dg;
      prevB += db;
    } else if (byte >> 6 === QOI_OP_LUMA) {
      let drdb = qoiData[dataIndex++];
      let dg = (byte & 0x3f) - 32;
      let dr = (drdb >> 4) - 8 + dg;
      let db = (drdb & 15) - 8 + dg;
      prevR += dr;
      prevG += dg;
      prevB += db;
    }

    pixels[pixelIndex++] = prevR;
    pixels[pixelIndex++] = prevG;
    pixels[pixelIndex++] = prevB;
    index[(prevR * 3 + prevG * 5 + prevB * 7) & 63] =
      (prevR << 16) | (prevG << 8) | prevB;
  }

  console.log("Time to decode: ", (performance.now() - startTime) / 1000);
  return pixels;
}

function generateLargeImage(width, height) {
  const pixels = new Uint8Array(width * height * 3);
  let colorVariation = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let i = (y * width + x) * 3;
      // Introducing subtle changes in the colors
      let r = (y + colorVariation) % 256;
      let g = ((y % 4 == 0 ? x : y) + colorVariation) % 256;
      let b = (r + g + colorVariation) % 256;

      // Slightly change color with each iteration to test DIFF and LUMA
      if (x % 10 === 0) colorVariation += 3;

      pixels.set([125, 125, 125], i);
    }
  }
  return pixels;
}

// Test cases
function testQOI(width = 3000, height = 3000) {
  console.log(width, height);
  const inputPixels = generateLargeImage(width, height);
  const encoded = qoiEncode(inputPixels, width, height);
  const decoded = qoiDecode(encoded, width, height);
  console.log("Compression ratio:", encoded.length / inputPixels.length);
  console.assert(
    inputPixels.length === decoded.length,
    "Decoded length mismatch"
  );
  for (let i = 0; i < inputPixels.length; i++) {
    console.assert(
      inputPixels[i] === decoded[i],
      `Mismatch at index ${i} ${inputPixels[i]} ${decoded[i]}`
    );
  }
  console.log("Test Passed!");
}

testQOI(100, 100);
testQOI(500, 500);
testQOI(1000, 1000);
testQOI(5000, 5000);
testQOI(10000, 10000);
