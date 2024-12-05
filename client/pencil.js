import { buildTransaction, encodeColor, encodePosition, encodeTool, touuid } from "./transaction.js";

export default class Pencil {
  constructor(virtualCanvas, colorpicker, brushsize) {
    this.virtualCanvas = virtualCanvas;
    this.colorpicker = colorpicker;
    this.currentcolor = [0, 0, 0];
    this.points = []; // Store the last four points for Catmull-Rom
    this.isDrawing = false;
    this.primarydrawing = true;
    this.brushsize = brushsize;
  }

  mouseUpLeft(input) {
    this.handleMouseUp();
  }

  mouseUpRight(input) {
    this.handleMouseUp();
  }

  mouseDownLeft(input) {
    this.handleMouseDown(input);
    this.primarydrawing = true;

  }

  mouseDownRight(input) {
    this.handleMouseDown(input);
    this.primarydrawing = false;
  }

  mouseMove(input) {
    if (!this.isDrawing) return;

    const newPoint = this.virtualCanvas.positionInCanvas(input.x, input.y);
    this.points.push(newPoint);

    if (this.points.length === 2) {
      const mirroredPoint = this.mirrorAcross(this.points[0], this.points[1]);
      this.points.unshift(mirroredPoint);
    }

    if (this.points.length > 4) {
      this.points.shift();
    }

    if (this.points.length === 4) {
      this.drawSpline();
    }
  }

  handleMouseUp() {
    if (this.points.length >= 2) {
      const mirroredPoint = this.mirrorAcross(
        this.points[this.points.length - 1],
        this.points[this.points.length - 2]
      );
      this.points.push(mirroredPoint);
      this.drawSpline();
    }
    this.isDrawing = false;
    this.points = [];
  }

  handleMouseDown(input) {
    this.isDrawing = true;
    const startPoint = this.virtualCanvas.positionInCanvas(input.x, input.y);
    this.points.push(startPoint);
    this.setPixel(startPoint[0], startPoint[1]);
  }

  mirrorAcross(basePoint, pointToMirror) {
    return [
      2 * basePoint[0] - pointToMirror[0],
      2 * basePoint[1] - pointToMirror[1],
    ];
  }

  drawSpline() {
    const [p0, p1, p2, p3] = this.points;

    const transaction = buildTransaction(
      touuid(),
      encodeTool("pencil"),
      encodeColor(this.colorpicker.secondarycolor),
      encodePosition(p0),
      encodePosition(p1),
      encodePosition(p2),
      encodePosition(p3),
    )

    console.log(transaction);
    
    const interpolate = (t, p0, p1, p2, p3) =>
      0.5 *
      (2 * p1 +
        (-p0 + p2) * t +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
        (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);

    const derivative = (t, p0, p1, p2, p3) =>
      0.5 *
      (-p0 +
        p2 +
        2 * t * (2 * p0 - 5 * p1 + 4 * p2 - p3) +
        3 * t * t * (-p0 + 3 * p1 - 3 * p2 + p3));

    const tolerance = 0.5;
    let t = 0;
    let prevX = interpolate(t, p0[0], p1[0], p2[0], p3[0]);
    let prevY = interpolate(t, p0[1], p1[1], p2[1], p3[1]);
    this.setPixel(prevX, prevY);

    while (t < 1) {
      const dx = derivative(t, p0[0], p1[0], p2[0], p3[0]);
      const dy = derivative(t, p0[1], p1[1], p2[1], p3[1]);
      const velocity = Math.sqrt(dx * dx + dy * dy);

      const dt = tolerance / velocity;

      t += dt;
      if (t > 1) t = 1;

      const x = interpolate(t, p0[0], p1[0], p2[0], p3[0]);
      const y = interpolate(t, p0[1], p1[1], p2[1], p3[1]);
      this.setPixel(x, y);
    }
  }

  setPixel(x, y) {
    const color = this.primarydrawing
      ? this.colorpicker.primarycolor
      : this.colorpicker.secondarycolor;
    for (let dx = 0; dx < this.brushsize.size; dx++) {
      for (let dy = 0; dy < this.brushsize.size; dy++) {
        this.virtualCanvas.setPixelClient(
          Math.round(x + dx),
          Math.round(y + dy),
          color[0],
          color[1],
          color[2]
        );
      }
    }
  }
}
