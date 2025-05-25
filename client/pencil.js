import {
  operationId,
  pencilTransaction,
  pixelTransaction,
} from "./transaction.js";
import { mirrorAcross } from "./util2d.js";

export default class Pencil {
  constructor(virtualCanvas, transactionLog, toolbar) {
    this.virtualCanvas = virtualCanvas;
    this.transactionLog = transactionLog;
    this.colorpicker = toolbar.colorpicker;
    this.points = []; // Store the last four points for Catmull-Rom
    this.isDrawing = false;
    this.currentColor = [0, 0, 0];
    this.brushsize = toolbar.brushsize;
    this.toolbar = toolbar;

    this.operationId = null;
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
    if (
      this.points.length > 0 &&
      newPoint[0] === this.points[this.points.length - 1][0] &&
      newPoint[1] === this.points[this.points.length - 1][1]
    )
      return;

    this.points.push(newPoint);

    if (this.points.length === 2) {
      const mirroredPoint = mirrorAcross(this.points[0], this.points[1]);
      this.points.unshift(mirroredPoint);
    }

    if (this.points.length > 3) {
      this.points.shift();
    }

    if (this.points.length === 3) {
      this.transactionLog.pushClient(
        pencilTransaction(
          this.operationId,
          this.currentColor,
          this.brushsize.size,
          this.points[0],
          this.points[1],
          this.points[2],
          this.points[2]
        )
      );
    }
  }

  handleMouseUp() {
    this.isDrawing = false;
    this.points = [];
  }

  handleMouseDown(input) {
    this.isDrawing = true;
    const startPoint = this.virtualCanvas.positionInCanvas(input.x, input.y);
    this.points.push(startPoint);
    this.operationId = operationId();
    this.toolbar.undo.pushOperation(this.operationId);
    this.transactionLog.pushClient(
      pixelTransaction(
        this.operationId,
        this.currentColor,
        this.brushsize.size,
        this.points[0]
      )
    );
  }
}
