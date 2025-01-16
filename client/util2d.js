//Helper function for spline generate
export function mirrorAcross(basePoint, pointToMirror) {
  return [
    2 * basePoint[0] - pointToMirror[0],
    2 * basePoint[1] - pointToMirror[1],
  ];
}

// Catmull-Rom pixel rendering (running t backwards)
export function splinePixels(p0, p1, p2, p3, tolerance = 0.5) {
  const interpolate = (t, p0, p1, p2, p3) =>
    0.5 *
    (2 * p1 +
      t * (-p0 + p2) +
      t * t * (2 * p0 - 5 * p1 + 4 * p2 - p3) +
      t * t * t * (-p0 + 3 * p1 - 3 * p2 + p3));

  const derivative = (t, p0, p1, p2, p3) =>
    0.5 *
    (-p0 +
      p2 +
      2 * t * (2 * p0 - 5 * p1 + 4 * p2 - p3) +
      3 * t * t * (-p0 + 3 * p1 - 3 * p2 + p3));

  const linePixels = (start, end) => {
    const pixels = [];
    const dx = Math.abs(end[0] - start[0]);
    const dy = Math.abs(end[1] - start[1]);
    const sx = start[0] < end[0] ? 1 : -1;
    const sy = start[1] < end[1] ? 1 : -1;
    let err = dx - dy;

    let x = start[0];
    let y = start[1];

    while (true) {
      pixels.push([x, y]);
      if (x === end[0] && y === end[1]) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }

    return pixels;
  };

  // Check if p1 and p2 are close
  const distance = Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2);
  console.log(distance);
  if (distance < 4) {
    return linePixels(p1.map(Math.round), p2.map(Math.round));
  }

  const pixels = [];
  let t = 1; // Start from 1
  let prevX = interpolate(t, p0[0], p1[0], p2[0], p3[0]);
  let prevY = interpolate(t, p0[1], p1[1], p2[1], p3[1]);
  pixels.push([prevX, prevY]);
  while (t > 0) {
    // Run until t > 0
    const dx = derivative(t, p0[0], p1[0], p2[0], p3[0]);
    const dy = derivative(t, p0[1], p1[1], p2[1], p3[1]);
    const velocity = Math.sqrt(dx * dx + dy * dy);

    const dt = tolerance / velocity;

    t -= dt; // Decrement t
    if (t < 0) t = 0;

    const x = Math.round(interpolate(t, p0[0], p1[0], p2[0], p3[0]));
    const y = Math.round(interpolate(t, p0[1], p1[1], p2[1], p3[1]));

    if (prevX !== x || prevY !== y) pixels.push([x, y]);
    prevX = x;
    prevY = y;
  }
  return pixels;
}

export function centerToBrushSize(brushsize, ...points) {
  const shift = Math.floor(brushsize / 2);
  const centeredPoints = [];
  for (let index = 0; index < points.length; index++) {
    centeredPoints.push([points[index][0] - shift, points[index][1] - shift]);
  }
  return centeredPoints;
}
