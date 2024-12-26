import { fillTransaction, operationId } from "./transaction.js";

export default class FillTool {
  constructor(virtualCanvas, transactionManager, toolbar) {
    this.virtualCanvas = virtualCanvas;
    this.transactionManager = transactionManager;
    this.colorpicker = toolbar.colorpicker;
    this.toolbar = toolbar;
  }

  mouseMove() {}

  mouseUpLeft() {}

  mouseUpRight() {}

  mouseDownLeft(input) {
    const position = this.virtualCanvas.positionInCanvas(input.x, input.y);
    this.fill(position, this.colorpicker.primarycolor);
  }

  mouseDownRight(input) {
    const position = this.virtualCanvas.positionInCanvas(input.x, input.y);
    this.fill(position, this.colorpicker.secondarycolor);
  }

  fill(position, newColor) {
    if (position[0] < 0 || position[1] < 0) return; // or handle the out-of-bounds case appropriately
    
    const currentOperationId = operationId();
    this.transactionManager.pushClient(fillTransaction(currentOperationId, newColor, position));
    this.toolbar.undo.pushOperation(currentOperationId);
  }
}
