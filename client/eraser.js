import { operationId, eraserTransaction } from "./transaction.js";
import { virtualCanvas, transactionLog, toolbar } from "./client.js";
export default class Eraser {
  constructor() {
    this.points = []; // Store the last 3 points for Catmull-Rom
    this.isDrawing = false;
    this.currentColor = [0, 0, 0];
    this.operationId = null;
    this.mode = 0;

    const eraserButton = document.getElementById("eraser");
    eraserButton.addEventListener("click", () => {
      toolbar.activeTool = this;
      toolbar.updateActiveButton(eraserButton);
    });
  }

  mouseUpLeft() {
    this.handleMouseUp();
  }

  mouseUpRight() {
    this.mode = 0;
    this.handleMouseUp();
  }

  mouseDownLeft(input) {
    this.mode = 0;
    this.currentColor = toolbar.colorpicker.secondarycolor;
    this.handleMouseDown(input);
  }

  mouseDownRight(input) {
    this.mode = 1;
    this.currentColor = toolbar.colorpicker.secondarycolor;
    this.handleMouseDown(input);
  }

  mouseMove(input) {
    if (!this.isDrawing) return;

    const newPoint = virtualCanvas.positionInCanvas(input.x, input.y);
    if (
      this.points.length > 0 &&
      newPoint[0] === this.points[this.points.length - 1][0] &&
      newPoint[1] === this.points[this.points.length - 1][1]
    )
      return;

    this.points.push(newPoint);
    if (this.points.length < 3) return;
    if (this.points.length > 3) this.points.shift();
    const transaction = eraserTransaction(
      this.operationId,
      this.currentColor,
      toolbar.colorpicker.primarycolor,
      toolbar.brushsize.size,
      ...this.points,
      this.mode
    );
    transactionLog.pushClient(transaction);
  }

  handleMouseUp() {
    this.isDrawing = false;
    this.points = [];
  }

  handleMouseDown(input) {
    this.isDrawing = true;
    const startPoint = virtualCanvas.positionInCanvas(input.x, input.y);
    this.points.push(startPoint, startPoint, startPoint);
    this.operationId = operationId();
    toolbar.undo.pushOperation(this.operationId);
    transactionLog.pushClient(
      eraserTransaction(
        this.operationId,
        this.currentColor,
        toolbar.colorpicker.primarycolor,
        toolbar.brushsize.size,
        ...this.points,
        this.mode
      )
    );
  }
}
