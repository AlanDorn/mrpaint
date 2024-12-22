import { redoTransaction, undoTransaction } from "./transaction.js";

export default class Undo {
  constructor(transactionManager) {
    this.transactionManager = transactionManager;
    this.undoList = [];
    this.redoList = [];

    document.addEventListener("keydown", (event) => {
      if (event.ctrlKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        this.undo();
      }

      if (event.ctrlKey && event.key.toLowerCase() === "y") {
        event.preventDefault();
        this.redo();
      }
    });
  }

  undo() {
    const operationId = this.undoList.pop();
    if (!operationId) return;
    this.transactionManager.pushClient(undoTransaction(operationId));
    this.redoList.push(operationId);
  }

  redo() {
    const operationId = this.redoList.pop();
    if (!operationId) return;
    this.transactionManager.pushClient(redoTransaction(operationId));
    this.undoList.push(operationId);
  }

  pushOperation(operationId) {
    this.undoList.push(operationId);
    this.redoList.length = 0;
  }
}
