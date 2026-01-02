import { fillTransaction, operationId } from "./transaction.js";
// import { virtualCanvas, transactionLog, toolbar } from "./client.js";
export default class FillTool {
  constructor(transactionLog, virtualCanvas, toolbar) {
    this.transactionLog = transactionLog;
    this.virtualCanvas = virtualCanvas;
    this.toolbar = toolbar;
    // const fillToolButton = document.getElementById("fillTool");

    // fillToolButton.addEventListener("click", () => {
    //   toolbar.activeTool = this;
    //   toolbar.updateActiveButton(fillToolButton);
    // });
  }
  mouseMove() {}

  mouseUpLeft() {}

  mouseUpRight() {}

  mouseDownLeft(input) {
    const position = this.virtualCanvas.positionInCanvas(input.x, input.y);
    this.fill(position, this.toolbar.colorpicker.primarycolor);
  }

  mouseDownRight(input) {
    const position = this.virtualCanvas.positionInCanvas(input.x, input.y);
    this.fill(position, this.toolbar.colorpicker.secondarycolor);
  }

  fill(position, newColor) {
    if (position[0] < 0 || position[1] < 0) return; // or handle the out-of-bounds case appropriately

    const currentOperationId = operationId();
    this.transactionLog.pushClient(
      fillTransaction(currentOperationId, newColor, position)
    );
    this.toolbar.undo.pushOperation(currentOperationId);
  }
}
