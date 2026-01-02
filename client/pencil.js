import { operationId, pencilTransaction } from "./transaction.js";
// import { virtualCanvas, transactionLog, toolbar } from "./client.js";
export default class Pencil {
  constructor(transactionLog, virtualCanvas, toolbar) {
    this.transactionLog = transactionLog;
    this.virtualCanvas = virtualCanvas;
    this.toolbar = toolbar;
    
    this.points = []; // Store the last three points for Catmull-Rom
    this.isDrawing = false;
    this.currentColor = [0, 0, 0];
    this.operationId = null;

    const pencilButton = document.getElementById("pencil");
    pencilButton.addEventListener("click", () => {
      this.toolbar.activeTool = this;
      this.toolbar.updateActiveButton(pencilButton);
    });
  }

  mouseUpLeft() {
    this.handleMouseUp();
  }

  mouseUpRight() {
    this.handleMouseUp();
  }

  mouseDownLeft(input) {
    this.currentColor = this.toolbar.colorpicker.primarycolor;
    this.handleMouseDown(input);
  }

  mouseDownRight(input) {
    this.currentColor = this.toolbar.colorpicker.secondarycolor;
    this.handleMouseDown(input);
  }

  mouseMove(input) {
    if (!this.isDrawing) return;

    const newPoint = this.virtualCanvas.positionInCanvas(input.x, input.y);
    let samePoint = this.points.length > 0;
    samePoint &&= newPoint[0] === this.points[this.points.length - 1][0];
    samePoint &&= newPoint[1] === this.points[this.points.length - 1][1];
    if (samePoint) return;

    this.points.push(newPoint);
    if (this.points.length < 3) return;
    if (this.points.length > 3) this.points.shift();
    const transaction = pencilTransaction(
      this.operationId,
      this.currentColor,
      this.toolbar.brushsize.size,
      ...this.points
    );
    this.transactionLog.pushClient(transaction);
  }

  handleMouseUp() {
    this.isDrawing = false;
    this.points = [];
  }

  handleMouseDown(input) {
    this.isDrawing = true;
    const startPoint = this.virtualCanvas.positionInCanvas(input.x, input.y);
    this.points.push(startPoint, startPoint, startPoint);
    this.operationId = operationId();
    this.toolbar.undo.pushOperation(this.operationId);
    this.transactionLog.pushClient(
      pencilTransaction(
        this.operationId,
        this.currentColor,
        this.toolbar.brushsize.size,
        ...this.points
      )
    );
  }
}
