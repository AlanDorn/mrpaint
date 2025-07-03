import { redoTransaction, undoTransaction } from "./transaction.js";

export default class Undo {
  constructor(transactionLog) {
    this.transactionLog = transactionLog;
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

    if(operationId.draft) {
      operationId.tool.discardDraft();
      this.redoList.push(operationId);
      return;
    }

    this.transactionLog.pushClient(undoTransaction(operationId.id));
    this.redoList.push(operationId);
  }

  redo() {
    const operationId = this.redoList.pop();
    if (!operationId) return;

    if(operationId.draft) {
      operationId.tool.restoreDraft(operationId.draft);
      this.undoList.push(operationId);
      return;
    }

    this.transactionLog.pushClient(redoTransaction(operationId.id));
    this.undoList.push(operationId);
  }

  pushOperation(operationId) {
    // this.undoList.push(operationId);
    this.undoList.push({ id: operationId });
    this.redoList.length = 0;
  }

  pushDraft(tool, draft){
    this.undoList.push({ draft, tool });
    this.redoList.length = 0;
  }
}
