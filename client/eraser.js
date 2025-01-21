import {
  operationId,
  eraserTransaction,
  pixelTransaction,
} from "./transaction.js";
import { mirrorAcross } from "./util2d.js";

export default class Eraser {
  constructor(virtualCanvas, transactionManager, toolbar) {
    this.virtualCanvas = virtualCanvas;
    this.transactionManager = transactionManager;
    this.colorpicker = toolbar.colorpicker;
    this.brushsize = toolbar.brushsize;
    this.toolbar = toolbar;
    this.points = []; // Store the last four points for Catmull-Rom
    this.isDrawing = false;
    this.currentColor = [0, 0, 0];
    this.operationId = null;
    this.mode = 0;
  }

  mouseUpLeft(input) {
    this.handleMouseUp();
  }

  mouseUpRight(input) {
    this.mode = 0;
    this.handleMouseUp();
  }

  mouseDownLeft(input) {
    this.currentColor = this.colorpicker.secondarycolor;
    this.handleMouseDown(input);
  }

  mouseDownRight(input) {
    this.mode = 1;
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

    if (this.points.length > 4) {
      this.points.shift();
    }

    if (this.points.length === 4) {
      this.transactionManager.pushClient(
        eraserTransaction(
          this.operationId,
          this.currentColor,
          this.colorpicker.primarycolor,
          this.brushsize.size,
          ...this.points,
          this.mode
        )
      );
    }
  }

  handleMouseUp() {
    this.isDrawing = false;
    
    // If it's only one point
    if (this.points.length < 4 && this.points.length !== 0) {
      // If you were doing right-click, `mode` is 1
      // so let's do a single-point eraser transaction
      this.transactionManager.pushClient(
        eraserTransaction(
          this.operationId,
          this.currentColor,
          this.colorpicker.primarycolor,
          this.brushsize.size,
          // Provide the same point 4 times so spline doesn't go wild
          this.points[0],
          this.points[0],
          this.points[0],
          this.points[0],
          this.mode
        )
      );
    }
    
    this.points = [];
  }
  

  handleMouseDown(input) {
    this.isDrawing = true;
    const startPoint = this.virtualCanvas.positionInCanvas(input.x, input.y);
    this.points.push(startPoint);
    this.operationId = operationId();
    this.toolbar.undo.pushOperation(this.operationId);
  }
}
