import { mirrorAcross, splinePixels } from "./util2d.js";

export default class Pencil {
  constructor(virtualCanvas, transactionManager, colorpicker, brushsize) {
    this.virtualCanvas = virtualCanvas;
    this.transactionManager = transactionManager;
    this.colorpicker = colorpicker;
    this.points = []; // Store the last four points for Catmull-Rom
    this.isDrawing = false;
    this.currentColor = [0, 0, 0];
    this.brushsize = brushsize;
  }

  mouseUpLeft(input) {
    this.handleMouseUp();
  }

  mouseUpRight(input) {
    this.handleMouseUp();
  }

  mouseDownLeft(input) {
    this.currentColor = this.colorpicker.primarycolor;
    this.handleMouseDown(input);
  }

  mouseDownRight(input) {
    this.currentColor = this.colorpicker.secondarycolor;
    this.handleMouseDown(input);
  }

  mouseMove(input) {
    if (!this.isDrawing) return;

    const newPoint = this.virtualCanvas.positionInCanvas(input.x, input.y);
    this.points.push(newPoint);

    if (this.points.length === 2) {
      const mirroredPoint = mirrorAcross(this.points[0], this.points[1]);
      this.points.unshift(mirroredPoint);
    }

    if (this.points.length > 4) {
      this.points.shift();
    }

    if (this.points.length === 4) {
      this.drawClient();
    }
  }

  handleMouseUp() {
    if (this.points.length >= 2) {
      const mirroredPoint = mirrorAcross(
        this.points[this.points.length - 1],
        this.points[this.points.length - 2]
      );
      this.points.push(mirroredPoint);
      this.drawClient();
    }
    this.isDrawing = false;
    this.points = [];
  }

  handleMouseDown(input) {
    this.isDrawing = true;
    const startPoint = this.virtualCanvas.positionInCanvas(input.x, input.y);
    this.points.push(startPoint);
    this.setPixelClient(
      this.currentColor,
      this.brushsize.size,
      startPoint[0],
      startPoint[1]
    );
  }

  drawClient() {
    this.transactionManager.pencilTransaction(
      this.currentColor,
      this.brushsize.size,
      ...this.points
    );
    const pixels = splinePixels(this.points);
    pixels.forEach((pixel) =>
      this.setPixelClient(
        this.currentColor,
        this.brushsize.size,
        pixel[0],
        pixel[1]
      )
    );
  }

  drawServer(color, brushsize, p0, p1, p2, p3) {
    const pixels = splinePixels([p0, p1, p2, p3]);
    pixels.forEach((pixel) =>
      this.setPixelServer(color, brushsize, pixel[0], pixel[1])
    );
  }

  setPixelClient(color, brushsize, x, y) {
    for (let dx = 0; dx < brushsize; dx++) {
      for (let dy = 0; dy < brushsize; dy++) {
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

  setPixelServer(color, brushsize, x, y) {
    for (let dx = 0; dx < brushsize; dx++) {
      for (let dy = 0; dy < brushsize; dy++) {
        this.virtualCanvas.setPixelServer(
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
