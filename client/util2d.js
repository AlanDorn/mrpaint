//Helper function for spline generate
export function mirrorAcross(basePoint, pointToMirror) {
  return [
    2 * basePoint[0] - pointToMirror[0],
    2 * basePoint[1] - pointToMirror[1],
  ];
}

// Catmull-Rom pixel rendering (running t backwards)
const tolerance = 0.5;
export function splinePixels(p0, p1, p2, p3) {

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
    centeredPoints.push([
      points[index][0] - shift,
      points[index][1] - shift,
    ]);
  }
  return centeredPoints;
}