const CATMULL_TOLERANCE = 0.5;

function makeCatmullRom1D(p0, p1, p2, p3) {
  // coefficients from the original formula:
  // a * t^3 + b * t^2 + c * t + d, with d = 2*p1
  const a = -p0 + 3 * p1 - 3 * p2 + p3; // t^3
  const b = 2 * p0 - 5 * p1 + 4 * p2 - p3; // t^2
  const c = -p0 + p2; // t
  const d = 2 * p1; // constant term before scaling
  // position and derivative closures using stored coeffs
  const position = (t) => 0.5 * (d + t * c + t * t * b + t * t * t * a);
  const derivative = (t) => 0.5 * (c + 2 * t * b + 3 * t * t * a);
  return { position, derivative };
}

export function splinePixels(p0, p1, p2, p3 = p2) {
  let allPixelsSame = p0[0] === p1[0] && p1[0] === p2[0] && p2[0] === p3[0];
  allPixelsSame &&= p0[1] === p1[1] && p1[1] === p2[1] && p2[1] === p3[1];
  if (allPixelsSame) return [[p0], p0[0], p0[1], p0[0], p0[1]];
  const pixels = [];
  const [p0x, p0y] = p0;
  const [p1x, p1y] = p1;
  const [p2x, p2y] = p2;
  const [p3x, p3y] = p3;

  // Precompute per-dimension spline helpers
  const splineX = makeCatmullRom1D(p0x, p1x, p2x, p3x);
  const splineY = makeCatmullRom1D(p0y, p1y, p2y, p3y);

  let t = 0;
  let prevX = Math.round(splineX.position(t));
  let prevY = Math.round(splineY.position(t));
  let doublePrevX = prevX - 10;
  let doublePrevY = prevY - 10;

  pixels.push([prevX, prevY]);
  let minX = prevX;
  let minY = prevY;
  let maxX = prevX;
  let maxY = prevY;

  while (t < 1) {
    const dx = splineX.derivative(t);
    const dy = splineY.derivative(t);
    const speedSq = dx * dx + dy * dy;

    if (speedSq === 0) {
      t += 1e-6;
      if (t > 1) t = 1;
    } else {
      const velocity = Math.sqrt(speedSq);
      const dt = CATMULL_TOLERANCE / velocity;
      t += dt;
      if (t > 1) t = 1;
    }

    const x = Math.round(splineX.position(t));
    const y = Math.round(splineY.position(t));

    if (prevX !== x || prevY !== y) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;

      const isDiagonalReplace =
        Math.abs(x - doublePrevX) === 1 && Math.abs(y - doublePrevY) === 1;

      if (isDiagonalReplace) {
        pixels.pop();
        pixels.push([x, y]);
        prevX = x;
        prevY = y;
        // doublePrev stays
      } else {
        doublePrevX = prevX;
        doublePrevY = prevY;
        pixels.push([x, y]);
        prevX = x;
        prevY = y;
      }
    }
  }

  return [pixels, minX, minY, maxX, maxY];
}
// Bresenham's line algorithm to compute points on the line
export function bresenhamLine(x1, y1, x2, y2) {
  const points = [];
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    points.push([x1, y1]);
    if (x1 === x2 && y1 === y2) break;
    const e2 = err * 2;
    if (e2 > -dy) {
      err -= dy;
      x1 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y1 += sy;
    }
  }
  return points;
}

const newCache = (cache = new Map(), maxSize = 256) => {
  const origSet = cache.set.bind(cache);
  cache.set = (k, v) =>
    origSet(k, v) &&
    cache.size > maxSize &&
    cache.delete(cache.keys().next().value);
  return cache;
};

const circleStampCache = newCache();
export function getCircleStamp(brushsize, color) {
  const key = `${brushsize}|${color[0]},${color[1]},${color[2]}`;
  if (circleStampCache.has(key)) return circleStampCache.get(key);
  const size = brushsize;
  const cx = size / 2; // geometric center in pixel coords
  const cy = size / 2;
  const r = size / 2; // conventional: radius = size/2
  const r2 = r * r;
  const stamp = new OffscreenCanvas(size, size);
  const sctx = stamp.getContext("2d", { willReadFrequently: false });
  sctx.imageSmoothingEnabled = false;
  sctx.clearRect(0, 0, size, size);
  sctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 1)`;
  // Row-by-row spans using pixel-center test
  for (let y = 0; y < size; y++) {
    const py = y + 0.5 - cy;
    const dy2 = py * py;
    if (dy2 > r2) continue;
    let spanStart = -1;
    for (let x = 0; x < size; x++) {
      const px = x + 0.5 - cx;
      const inside = px * px + dy2 <= r2;
      if (inside) {
        if (spanStart < 0) spanStart = x;
      } else if (spanStart >= 0) {
        sctx.fillRect(spanStart, y, x - spanStart, 1);
        spanStart = -1;
      }
    }
    if (spanStart >= 0) sctx.fillRect(spanStart, y, size - spanStart, 1);
  }

  const result = { stamp, halfBrush: Math.floor(size / 2) };
  circleStampCache.set(key, result);
  return result;
}
