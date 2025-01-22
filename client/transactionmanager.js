import {
  buildTransaction,
  compareTouuid,
  encodePosition,
  readOperationIdAsNumber,
  TOOLCODEINDEX,
  toolCodeInverse,
  toolCodes,
  toolLength,
} from "./transaction.js";
import buildRenderTask from "./transactionrenderer.js";

const exp = 1.5;

export default class TransactionManager {
  constructor(virtualCanvas) {
    this.virtualCanvas = virtualCanvas;

    this.transactions = [];
    this.uninsertedTransactions = [];
    this.unsentTransactions = [];

    this.firstTransactionOfOperation = new Map();
    this.lastUndoRedoOperation = new Map();

    this.snapshots = [];
    this.snapshotTransactions = [];
    this.snapshotGraveyard = [];
    this.msSinceLastSnapShot = 0;

    this.rendered = 0;
    this.correct = 0;
    this.currentTask = [];
    this.rerenderCauseOfUndo = false;

    this.newRender = false; // used to control mousemove input,
    this.transactionRenderLoop();
  }

  transactionRenderLoop(loopTargetms = 8) {
    // Having loopTargetms too high blocks the mouse
    const renderFrame = () => {
      const startTime = performance.now();
      this.newRender = true;
      this.virtualCanvas.statusbar.setCompletionBar(
        this.correct / this.transactions.length
      );
      this.virtualCanvas.ruler.set();

      if (this.uninsertedTransactions.length) this.pushTransactions();

      if (this.correct < this.rendered) this.syncCanvas();

      if (this.rerenderCauseOfUndo || this.rendered >= this.transactions.length)
        this.virtualCanvas.fill();

      this.virtualCanvas.render();

      while (performance.now() - startTime < loopTargetms) {
        const processStartTime = performance.now();
        if (this.currentTask.length === 0) {
          if (this.rendered >= this.transactions.length) continue; //let it rip

          let transaction = this.transactions[this.rendered];
          this.rendered++;
          this.correct++;
          while (
            this.transactionIsUndone(transaction) &&
            this.rendered < this.transactions.length
          ) {
            transaction = this.transactions[this.rendered];
            this.rendered++;
            this.correct++;
          }

          if (this.transactionIsUndone(transaction)) continue;

          this.currentTask = buildRenderTask(this.virtualCanvas, transaction);
        }

        const optionalNextTask = this.currentTask.pop()(); // run the next bit of task
        if (optionalNextTask) this.currentTask.push(optionalNextTask);
        if (
          this.currentTask.length === 0 &&
          this.rendered >= this.transactions.length - 1000 &&
          (this.msSinceLastSnapShot > 8 ||
            toolCodeInverse[
              this.transactions[this.rendered - 1][TOOLCODEINDEX]
            ] == "resize")
        ) {
          this.takeSnapShot();
          this.msSinceLastSnapShot = 0;
        }
        this.needToRenderCanvas = true;
        this.msSinceLastSnapShot += performance.now() - processStartTime;
      }

      requestAnimationFrame(renderFrame);
    };

    requestAnimationFrame(renderFrame);
  }

  transactionIsUndone(transaction) {
    const potentialUndoRedo = this.lastUndoRedoOperation.get(
      readOperationIdAsNumber(transaction)
    );
    if (!potentialUndoRedo) return false;
    return potentialUndoRedo[TOOLCODEINDEX] === toolCodes.undo[0];
  }

  syncCanvas() {
    // Stop the current task
    this.currentTask.length = 0;

    // Remove any snapshots that are newer than the current correct index.
    for (let index = 0; index < this.snapshots.length; index++) {
      const snapshotIsNewerThanCorrect =
        this.transactionIndex(this.snapshotTransactions[index]) >= this.correct;
      if (snapshotIsNewerThanCorrect) {
        // Instead of just truncating, we splice so we can push them into the graveyard
        this.snapshotGraveyard.push(...this.snapshots.splice(index));
        this.snapshotTransactions.splice(index);
        break;
      }
    }

    // If there are no snapshots that come before the correct index, reset
    const thereIsNoSnapShotBeforeCorrect = this.snapshots.length === 0;
    if (thereIsNoSnapShotBeforeCorrect) {
      this.virtualCanvas.reset();
      this.rendered = 0;
      this.correct = 0;
      return;
    }

    // Set the canvas to the last snapshot
    const snapshot = this.snapshots[this.snapshots.length - 1];
    const snapshotIndex = this.transactionIndex(
      this.snapshotTransactions[this.snapshotTransactions.length - 1]
    );

    this.snapshotGraveyard.push(this.virtualCanvas.set(snapshot));
    this.virtualCanvas.viewport.setAdjusters();
    this.virtualCanvas.statusbar.setCanvasSize();
    this.rendered = snapshotIndex + 1;
    this.correct = snapshotIndex + 1;
    this.snapshots.length--;
    this.snapshotTransactions.length--;

    // Create a new snapshot from an old one if available
    let reusedSnapshot = null;
    if (this.snapshotGraveyard.length > 0) {
      // Pop from graveyard and reuse it
      reusedSnapshot = this.snapshotGraveyard.pop();
    }

    this.snapshots.push(this.virtualCanvas.cloneCanvas(reusedSnapshot));
    this.snapshotTransactions.push(this.transactions[this.rendered - 1]);

    this.msSinceLastSnapShot = 0;
  }

  takeSnapShot() {
    for (let index = this.snapshots.length - 1 - 5; index > 0; index--) {
      const olderAge =
        this.rendered -
        this.transactionIndex(this.snapshotTransactions[index - 1]);
      const currentAge =
        this.rendered - this.transactionIndex(this.snapshotTransactions[index]);
      if (olderAge < exp * currentAge) {
        this.snapshotTransactions.splice(index, 1);
        this.snapshotGraveyard.push(...this.snapshots.splice(index, 1));
      }
    }

    this.snapshots.push(
      this.virtualCanvas.cloneCanvas(this.snapshotGraveyard.pop())
    );
    this.snapshotTransactions.push(this.transactions[this.rendered - 1]);
  }

  buildServerMessage(userId, mouseX, mouseY) {
    const temp = this.unsentTransactions;
    this.unsentTransactions = [];
    return buildTransaction(
      new Uint8Array([userId]),
      encodePosition([mouseX, mouseY]),
      ...temp
    );
  }

  pushTransactions() {
    for (let index = 0; index < this.uninsertedTransactions.length; index++) {
      const transaction = this.uninsertedTransactions[index];
      const transactionType = transaction[TOOLCODEINDEX];

      if (
        transactionType === toolCodes.undo[0] ||
        transactionType === toolCodes.redo[0]
      )
        this.handleUndoRedo(transaction);
      else {
        const sortedPosition = this.transactionIndex(transaction);
        this.setIfFirstInstanceOfOperation(transaction);
        this.transactions.splice(sortedPosition, 0, transaction);
        if (sortedPosition < this.correct) {
          this.correct = sortedPosition;
          this.rerenderCauseOfUndo = false;
        }
      }
    }

    this.uninsertedTransactions.length = 0;
  }

  handleUndoRedo(undoRedo) {
    const operationId = readOperationIdAsNumber(undoRedo);

    const potentialUndoRedo = this.lastUndoRedoOperation.get(operationId);

    if (potentialUndoRedo) {
      if (compareTouuid(undoRedo, potentialUndoRedo) > 0) {
        this.lastUndoRedoOperation.set(operationId, undoRedo);
        const lastUndoRedoIsDifferent =
          undoRedo[TOOLCODEINDEX] !== potentialUndoRedo[TOOLCODEINDEX];
        if (lastUndoRedoIsDifferent) {
          const firstTransaction =
            this.firstTransactionOfOperation.get(operationId);
          if (firstTransaction) {
            const sortedPosition = this.transactionIndex(firstTransaction);
            if (sortedPosition < this.correct) {
              this.correct = sortedPosition;
              this.rerenderCauseOfUndo = true;
            }
          }
        }
      }
      return;
    }

    this.lastUndoRedoOperation.set(operationId, undoRedo);

    if (undoRedo[TOOLCODEINDEX] === toolCodes.undo[0]) {
      const firstTransaction =
        this.firstTransactionOfOperation.get(operationId);
      if (firstTransaction) {
        const sortedPosition = this.transactionIndex(firstTransaction);
        if (sortedPosition < this.correct) {
          this.correct = sortedPosition;
          this.rerenderCauseOfUndo = true;
        }
      }
    }
  }

  setIfFirstInstanceOfOperation(transaction) {
    const operationId = readOperationIdAsNumber(transaction);
    if (!operationId) return;
    const firstTransaction = this.firstTransactionOfOperation.get(operationId);
    if (!firstTransaction || compareTouuid(transaction, firstTransaction) < 0)
      this.firstTransactionOfOperation.set(operationId, transaction);
  }

  pushServer(transactions) {
    let offset = 0;
    while (offset < transactions.length) {
      const transactionLength =
        toolLength[transactions[offset + TOOLCODEINDEX]];
      this.uninsertedTransactions.push(
        transactions.subarray(offset, offset + transactionLength)
      );
      offset += transactionLength;
    }
  }

  pushClient(transaction) {
    this.unsentTransactions.push(transaction);
    this.uninsertedTransactions.push(transaction);
  }

  transactionIndex(transaction) {
    let low = 0;
    let high = this.transactions.length;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (compareTouuid(this.transactions[mid], transaction) < 0) low = mid + 1;
      else high = mid;
    }
    return low;
  }
}
