import {
  pencilTransaction,
  pixelTransaction,
} from "./transaction.js";
import { mirrorAcross } from "./util2d.js";

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
      this.transactionManager.pushClient(
        pencilTransaction(this.currentColor, this.brushsize.size, ...this.points)
      );
    }
  }

  handleMouseUp() {
    if (this.points.length >= 3) {
      const mirroredPoint = mirrorAcross(
        this.points[this.points.length - 1],
        this.points[this.points.length - 2]
      );
      this.points.push(mirroredPoint);
      if(this.points.length > 4) this.points.shift();
      this.transactionManager.pushClient(
        pencilTransaction(this.currentColor, this.brushsize.size, ...this.points)
      );
    }
    this.isDrawing = false;
    this.points = [];
  }

  handleMouseDown(input) {
    this.isDrawing = true;
    const startPoint = this.virtualCanvas.positionInCanvas(input.x, input.y);
    this.points.push(startPoint);
    this.transactionManager.pushClient(
      pixelTransaction(this.currentColor, this.brushsize.size, startPoint)
    );
  }
}
