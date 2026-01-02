// import { virtualCanvas, changeTracker, toolbar } from "./client.js";
import {decodeLargeNumber, decodePosition, TOOLCODEINDEX, toolCodes} from "./transaction.js";
import { bresenhamLine, getCircleStamp, splinePixels } from "./util2d.js";

let virtualCanvas, changeTracker, toolbar;

export function setRenderContext(ctx) {
  ({ virtualCanvas, changeTracker, toolbar } = ctx);
}

// rendering can be extended from outside the class by adding to renderSelector
const buildNextTask = (tx) => renderSelector[tx[TOOLCODEINDEX]]?.(tx);
const renderSelector = {};
buildNextTask.renderSelector = renderSelector;
export default buildNextTask;

//
// pixel
//
const pixelState = {};
renderSelector[toolCodes.pixel[0]] = (transaction) => {
  let inc = TOOLCODEINDEX + 1;
  pixelState.color = transaction.subarray(inc, (inc += 3));
  pixelState.brushsize = decodeLargeNumber(
    transaction.subarray(inc, (inc += 2))
  );
  pixelState.halfBrush = Math.ceil(pixelState.brushsize / 2);
  pixelState.pixel = decodePosition(transaction.subarray(inc, (inc += 4)));
  return pixelRender;
};
const pixelRender = () => {
  const { color, brushsize, halfBrush, pixel } = pixelState;
  virtualCanvas.setPixel(pixel[0], pixel[1], color, brushsize);
  changeTracker.track(
    pixel[0] - halfBrush,
    pixel[1] - halfBrush,
    pixel[0] + halfBrush,
    pixel[1] + halfBrush
  );
};

//
// pencil
//

//  Brush stamp cache (aliased circle)
const pencilState = {};
renderSelector[toolCodes.pencil[0]] = (transaction) => {
  let inc = TOOLCODEINDEX + 1;
  const color = transaction.subarray(inc, (inc += 3));
  const brushsize = decodeLargeNumber(transaction.subarray(inc, (inc += 2)));

  const [pixels, startX, startY, endX, endY] = splinePixels(
    decodePosition(transaction.subarray(inc, (inc += 4))),
    decodePosition(transaction.subarray(inc, (inc += 4))),
    decodePosition(transaction.subarray(inc, (inc += 4)))
  );

  // Prebuild stamp for this size+color
  const { stamp, halfBrush } = getCircleStamp(brushsize, color);

  pencilState.color = color;
  pencilState.brushsize = brushsize;
  pencilState.pixels = pixels;
  pencilState.startX = startX - halfBrush - 1;
  pencilState.startY = startY - halfBrush - 1;
  pencilState.endX = endX + halfBrush + 1;
  pencilState.endY = endY + halfBrush + 1;
  pencilState.halfBrush = halfBrush;
  pencilState.stamp = stamp;

  pencilState.index = 0;
  return pencilRender;
};

const pencilRender = (deadLine) => {
  const { pixels, stamp, halfBrush } = pencilState;
  if (pencilState.index === 0) {
    const { startX, startY, endX, endY } = pencilState;
    changeTracker.track(startX, startY, endX, endY);
    // ensure destination draws crisp
    virtualCanvas.offscreenCtx.imageSmoothingEnabled = false;
  }
  while (pencilState.index < pixels.length && performance.now() < deadLine)
    for (let i = 0; i < 1000 && pencilState.index < pixels.length; i++) {
      const [cx, cy] = pixels[pencilState.index++];
      // draw the prebuilt aliased circle stamp at integer-aligned coords
      virtualCanvas.offscreenCtx.drawImage(
        stamp,
        Math.round(cx - halfBrush),
        Math.round(cy - halfBrush)
      );
    }
  if (pencilState.index < pixels.length) return pencilRender;
};

//
// fill
//
const fillState = {};
renderSelector[toolCodes.fill[0]] = (transaction) => {
  let inc = TOOLCODEINDEX + 1;
  const color = transaction.subarray(inc, (inc += 3)); // [r, g, b]
  fillState.color = color;
  const [startX, startY] = decodePosition(
    transaction.subarray(inc, (inc += 4))
  );
  const { width, height, offscreenCtx: ctx } = virtualCanvas;
  fillState.width = width;
  fillState.height = height;
  fillState.ctx = ctx;
  if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;

  // const imageData = ctx.getImageData(0, 0, width, height);
  // const data = imageData.data;
  const data = virtualCanvas.buff;

  fillState.data = data; // Uint8ClampedArray, 4 bytes per pixel
  if (matchesColor(fillState.data, width, startX, startY, color)) return;
  const pos = startY * width + startX;
  const target = [data[4 * pos], data[4 * pos + 1], data[4 * pos + 2]];
  let colorsMatch = color[0] === target[0];
  colorsMatch &&= color[1] === target[1];
  colorsMatch &&= color[2] === target[2];
  if (colorsMatch) return;
  fillState.target = target;
  ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},1)`;
  fillState.stack = [];
  fillState.head = 0;
  fillState.tail = 0;
  fillState.stack[fillState.tail++] = [startX, startY];
  return fillRender;
};
const fillRender = (deadLine) => {
  const { color, width, height, data, target, stack, ctx } = fillState;
  while (fillState.head < fillState.tail && performance.now() < deadLine)
    for (let i = 0; i < 50 && fillState.head < fillState.tail; i++) {
      const idx = Math.random() < 0.5 ? --fillState.tail : fillState.head++;
      const [sx, sy] = stack[idx];
      let xL = sx;
      let xR = sx;
      while (xL > 0 && matchesColor(data, width, xL - 1, sy, target)) xL--;
      while (xR < width - 1 && matchesColor(data, width, xR + 1, sy, target))
        xR++;
      ctx.fillRect(xL, sy, xR - xL + 1, 1);
      changeTracker.track(xL, sy, xR, sy + 1);
      for (let x = xL; x <= xR; x++) {
        const i = 4 * (sy * width + x);
        data.set(color, i);
      }
      for (let dy of [-1, 1]) {
        const ny = sy + dy;
        if (ny < 0 || ny >= height) continue;
        let x = xL;
        while (x <= xR)
          if (matchesColor(data, width, x, ny, target)) {
            const seedX = x++;
            while (x <= xR && matchesColor(data, width, x, ny, target)) x++;
            stack[fillState.tail++] = [seedX, ny];
          } else x++;
      }
    }
  if (fillState.head < fillState.tail) return fillRender;
};
const matchesColor = (data, width, x, y, [r, g, b]) => {
  const i = 4 * (y * width + x);
  return data[i] === r && data[i + 1] === g && data[i + 2] === b;
};

//
// resize
//
const resizeState = {};
renderSelector[toolCodes.resize[0]] = (transaction) => {
  let inc = TOOLCODEINDEX + 1;
  const positionData = transaction.subarray(inc, (inc += 4));
  const [newWidth, newHeight] = decodePosition(positionData);
  resizeState.newWidth = newWidth;
  resizeState.newHeight = newHeight;
  return resizeRender;
};
const resizeRender = () => {
  const { newWidth, newHeight } = resizeState;
  changeTracker.resize(newWidth, newHeight);
  virtualCanvas.setSize(newWidth, newHeight);
  toolbar.viewport.setAdjusters();
  toolbar.statusbar.setCanvasSize();
};

//
// eraser
//
const eraserState = {};
renderSelector[toolCodes.eraser[0]] = (transaction) => {
  let inc = TOOLCODEINDEX + 1;
  eraserState.mode = transaction[inc];
  eraserState.eraseColor = transaction.subarray((inc += 1), (inc += 3));
  eraserState.primaryColor = transaction.subarray(inc, (inc += 3));
  const brushData = transaction.subarray(inc, (inc += 2));
  eraserState.brushsize = decodeLargeNumber(brushData);
  const [pixels, startX, startY, endX, endY] = splinePixels(
    decodePosition(transaction.subarray(inc, (inc += 4))),
    decodePosition(transaction.subarray(inc, (inc += 4))),
    decodePosition(transaction.subarray(inc, (inc += 4)))
  );
  eraserState.pixels = pixels;
  eraserState.halfBrush = Math.ceil(eraserState.brushsize / 2);

  // FULL BRUSH → mimic pencil technique (no imageData)
  if (eraserState.mode !== 1) {
    eraserState.startX = startX - eraserState.halfBrush;
    eraserState.startY = startY - eraserState.halfBrush;
    eraserState.endX = endX + eraserState.halfBrush;
    eraserState.endY = endY + eraserState.halfBrush;
    // outline optimization for brushsize > 2 (same as pencil)
    eraserState.setFunction =
      eraserState.brushsize <= 2
        ? virtualCanvas.setPixel
        : virtualCanvas.setPixelOutline;
    eraserState.index = 0;
    return eraserRenderFullBrush;
  }
  // NON-FULL MODES → imageData path with color test + bounds
  const { width, height, offscreenCtx: ctx } = virtualCanvas;
  let x0 = Math.max(0, Math.min(startX, endX) - eraserState.halfBrush);
  let y0 = Math.max(0, Math.min(startY, endY) - eraserState.halfBrush);
  let x1 = Math.min(width - 1, Math.max(startX, endX) + eraserState.halfBrush);
  let y1 = Math.min(height - 1, Math.max(startY, endY) + eraserState.halfBrush);
  if (x1 < x0 || y1 < y0) return; // no intersection
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  eraserState.x0 = x0;
  eraserState.y0 = y0;
  eraserState.x1 = x1;
  eraserState.y1 = y1;
  eraserState.w = w;
  eraserState.h = h;
  // const imageData = ctx.getImageData(x0, y0, w, h);   //replacing getImageData with something else for brave users, pls pls pls
  // eraserState.imageData = imageData;
  // eraserState.data = imageData.data;
  const startIndex = (y0 * virtualCanvas.width + x0) * 4;
  eraserState.data = virtualCanvas.buff.subarray(startIndex, startIndex + w*h*4);

  // Precompute mask: mode===1 => outline(1) + subpixel(2)
  eraserState.brushMask = buildBrushMask(
    eraserState.brushsize,
    eraserState.mode
  );
  eraserState.index = 0;
  eraserState.firstDone = false;
  return eraserRenderConditional;
};
const buildBrushMask = (brushSize, mode) => {
  const mask = new Uint8Array(brushSize * brushSize);
  let k = 0;
  for (let dy = 0; dy < brushSize; dy++)
    for (let dx = 0; dx < brushSize; dx++, k++) {
      const isBorder =
        dy === 0 || dx === 0 || dy === brushSize - 1 || dx === brushSize - 1;
      // Only needed for mode===1; full-brush path doesn't use mask
      mask[k] = mode === 1 ? (isBorder ? 1 : 2) : 3;
    }
  return mask;
};
// Full-brush: pencil-style renderer (tracks changes, uses setPixel/Outline)
const eraserRenderFullBrush = () => {
  const { pixels, eraseColor, brushsize, setFunction } = eraserState;
  const startTime = performance.now();
  if (eraserState.index === 0) {
    const { startX, startY, endX, endY } = eraserState;
    changeTracker.track(startX, startY, endX, endY);
    virtualCanvas.setPixel(pixels[0][0], pixels[0][1], eraseColor, brushsize);
    eraserState.index++;
  }
  while (eraserState.index < pixels.length && performance.now() - startTime < 2)
    setFunction(...pixels[eraserState.index++], eraseColor, brushsize);
  if (eraserState.index < pixels.length) return eraserRenderFullBrush;
};
// Conditional (outline/subpixel): imageData path with color checks
const eraserRenderConditional = (deadline) => {
  const s = eraserState;
  const { x0, y0, x1, y1, w, data, imageData, brushsize } = s;
  const { halfBrush, brushMask, pixels, eraseColor, primaryColor } = s;
  const startTime = performance.now();
  const matchesColor = (idx) => {
    const i = idx << 2;
    return (
      data[i] === primaryColor[0] &&
      data[i + 1] === primaryColor[1] &&
      data[i + 2] === primaryColor[2]
    );
  };
  const setColorAt = (idx) => {
    const i = idx << 2;
    data[i] = eraseColor[0];
    data[i + 1] = eraseColor[1];
    data[i + 2] = eraseColor[2];
    data[i + 3] = 255;
  };
  const applyBrush = (x, y) => {
    for (let i = 0, dy = 0; dy < brushsize; dy++) {
      const ny = y - halfBrush + dy;
      if (ny < y0 || ny > y1) {
        i += brushsize;
        continue;
      }
      const rowOffset = (ny - y0) * w;
      for (let dx = 0; dx < brushsize; dx++, i++) {
        const nx = x - halfBrush + dx;
        if (nx < x0 || nx > x1) continue;
        const idx = rowOffset + (nx - x0);
        const m = brushMask[i];
        // 1 = outline, 2 = subpixel → both require primaryColor match
        if ((m === 1 || m === 2) && matchesColor(idx)) setColorAt(idx);
      }
    }
  };
  if (!s.firstDone && s.index < pixels.length) {
    changeTracker.track(x0, y0, x1, y1);
    applyBrush(pixels[0][0], pixels[0][1]);
    s.index = 1;
    s.firstDone = true;
  }
  while (s.index < pixels.length && performance.now() < deadline) {
    const p = pixels[s.index++];
    applyBrush(p[0], p[1]);
  }
  if (s.index >= pixels.length)
    virtualCanvas.offscreenCtx.putImageData(imageData, x0, y0);
  else return eraserRenderConditional;
};

//
// straight line
//
const straightLineState = {};
renderSelector[toolCodes.straightLine[0]] = (transaction) => {
  let inc = TOOLCODEINDEX + 1;
  straightLineState.color = transaction.subarray(inc, (inc += 3));
  const brushData = transaction.subarray(inc, (inc += 2));
  straightLineState.brushsize = decodeLargeNumber(brushData);
  const halfBrush = Math.ceil(straightLineState.brushsize / 2);
  const startPoint = decodePosition(transaction.subarray(inc, (inc += 4)));
  const endPoint = decodePosition(transaction.subarray(inc, (inc += 4)));
  // Points via Bresenham
  straightLineState.points = bresenhamLine(
    startPoint[0],
    startPoint[1],
    endPoint[0],
    endPoint[1]
  );
  // CALM: ez optimization by making not square
  straightLineState.minX = Math.min(startPoint[0], endPoint[0]) - halfBrush;
  straightLineState.minY = Math.min(startPoint[1], endPoint[1]) - halfBrush;
  straightLineState.maxX = Math.max(startPoint[0], endPoint[0]) + halfBrush;
  straightLineState.maxY = Math.max(startPoint[1], endPoint[1]) + halfBrush;
  // choose set function like in pencil
  straightLineState.setFunction = virtualCanvas.setPixel;
    // straightLineState.setFunction      
    // straightLineState.brushsize <= 2   
    //   ? virtualCanvas.setPixel         
    //   : virtualCanvas.setPixelOutline; //the outline was annoying, should it be in SL?                  
  straightLineState.index = 0;            //makes sense for eraser but not so much SL?                  
  return straightLineRender;              //TODO prob put it back l8r but do a lil intersection check     
};
const straightLineRender = () => {
  const s = straightLineState;
  const { color, brushsize, points, setFunction } = s;
  const startTime = performance.now();
  if (s.index === 0) {
    const { minX, minY, maxX, maxY } = s;
    changeTracker.track(minX, minY, maxX, maxY);
    // draw first point once to ensure region is touched
    setFunction(points[0][0], points[0][1], color, brushsize);
    s.index = 1;
  }
  while (s.index < points.length && performance.now() - startTime < 2) {
    const p = points[s.index++];
    setFunction(p[0], p[1], color, brushsize);
  }
  if (s.index < points.length) return straightLineRender;
};
