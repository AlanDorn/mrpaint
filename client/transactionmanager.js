import {
  buildTransaction,
  compareTouuid,
  encodePosition,
  readOperationIdAsNumber,
  TOOLCODEINDEX,
  toolCodes,
  toolLength,
} from "./transaction.js";
import buildRenderTask from "./transactionrenderer.js";

const mod = 32;
const exp = 1.5;

export default class TransactionManager {
  constructor(virtualCanvas) {
    this.virtualCanvas = virtualCanvas;

    this.transactions = [];
    this.unsentTransactions = [];

    this.firstTransactionOfOperation = new Map();
    this.lastUndoRedoOperation = new Map();

    this.snapshots = [];
    this.snapshotIndexes = [];
    this.snapshotGraveyard = [];

    this.rendered = 0;
    this.correct = 0;
    this.currentTask = [];

    this.simulateLag = false;
    this.lastVirtualError = 0;
    setTimeout(() => this.transactionRenderLoop(32), 0);
  }

  simulateVirtualLag() {
    if (this.simulateLag && this.correct > this.lastVirtualError) {
      this.lastVirtualError = this.correct;
      this.correct -= Math.random() < 0.5 ? 30 : 60;
    }
  }

  transactionRenderLoop(loopTargetms) {
    const startTime = performance.now();

    this.virtualCanvas.render();

    if (this.rendered >= this.transactions.length) {
      this.virtualCanvas.fill();
    }

    const needToSyncCanvas = this.correct < this.rendered;
    if (needToSyncCanvas) this.syncCanvas();

    let rendered = false;
    while (performance.now() - startTime < loopTargetms) {
      if (performance.now() - startTime < 16 && !rendered) {
        rendered = true;
        this.virtualCanvas.render();
      }
      const taskIsFinished = this.currentTask.length === 0;
      if (taskIsFinished) {
        const allTransactionsAreRendered =
          this.rendered >= this.transactions.length;
        if (allTransactionsAreRendered) {
          const timeLeft = loopTargetms - (performance.now() - startTime);
          this.simulateVirtualLag();
          setTimeout(() => this.transactionRenderLoop(loopTargetms), timeLeft);
          return;
        }

        let transaction = this.transactions[this.rendered];
        this.rendered++;
        this.correct++;
        if (this.transactionIsUndone(transaction)) continue;

        this.currentTask = buildRenderTask(this.virtualCanvas, transaction);
      }

      const optionalNextTask = this.currentTask.pop()(); // run the next bit of task
      if (optionalNextTask) this.currentTask.push(optionalNextTask);
      if (this.currentTask.length === 0 && this.rendered % mod === mod - 1)
        this.takeSnapShot();
    }

    this.simulateVirtualLag();

    setTimeout(() => this.transactionRenderLoop(loopTargetms), 0);
  }

  transactionIsUndone(transaction) {
    const operationId = readOperationIdAsNumber(transaction);
    const potentialUndoRedo = this.lastUndoRedoOperation.get(operationId);
    if (!potentialUndoRedo) return false;
    return potentialUndoRedo[TOOLCODEINDEX] === toolCodes.undo[0];
  }

  syncCanvas() {
    // Stop the current task
    this.currentTask.length = 0;

    // Remove any snapshots that are newer than the current correct index.
    for (let index = 0; index < this.snapshots.length; index++) {
      const snapshotIsNewerThanCorrect =
        this.snapshotIndexes[index] >= this.correct;
      if (snapshotIsNewerThanCorrect) {
        // Instead of just truncating, we splice so we can push them into the graveyard
        const removedSnapshots = this.snapshots.splice(index);
        this.snapshotIndexes.splice(index);

        // Push removed snapshots into the graveyard
        this.snapshotGraveyard.push(...removedSnapshots);
        break;
      }
    }

    // If there are no snapshots that come before the correct index, reset
    const thereIsNoSnapShotBeforeCorrect = this.snapshots.length === 0;
    if (thereIsNoSnapShotBeforeCorrect) {
      this.snapshotGraveyard.push(this.virtualCanvas.reset());
      this.rendered = 0;
      this.correct = 0;
      return;
    }

    // Set the canvas to the last snapshot
    const snapshot = this.snapshots[this.snapshots.length - 1];
    const snapshotIndex = this.snapshotIndexes[this.snapshotIndexes.length - 1];

    this.snapshotGraveyard.push(this.virtualCanvas.set(snapshot));
    this.rendered = snapshotIndex + 1;
    this.correct = snapshotIndex + 1;
    this.snapshots.length--;
    this.snapshotIndexes.length--;
    this.takeSnapShot();
  }

  takeSnapShot() {
    // Clean up older snapshots that are in the same "magnitude" tier
    for (let index = this.snapshots.length - 1; index > 0; index--) {
      const previousBase = Math.floor(
        Math.log(this.rendered - this.snapshotIndexes[index - 1]) /
          Math.log(exp)
      );
      const currentBase = Math.floor(
        Math.log(this.rendered - this.snapshotIndexes[index]) / Math.log(exp)
      );
      if (previousBase === currentBase) {
        // Remove the snapshot and push it into the graveyard
        const removedSnapshots = this.snapshots.splice(index, 1);
        this.snapshotIndexes.splice(index, 1);
        this.snapshotGraveyard.push(...removedSnapshots);
      }
    }

    // Create a new snapshot from an old one if available
    let reusedSnapshot = null;
    if (this.snapshotGraveyard.length > 0) {
      // Pop from graveyard and reuse it
      reusedSnapshot = this.snapshotGraveyard.pop();
    }

    this.snapshots.push(this.virtualCanvas.cloneCanvas(reusedSnapshot));
    this.snapshotIndexes.push(this.rendered - 1);
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

  pushServer(transactions) {
    let offset = 0;
    while (offset < transactions.length) {
      const transactionType = transactions[offset + TOOLCODEINDEX];
      const transactionLength = toolLength[transactionType];
      const transaction = transactions.subarray(
        offset,
        offset + transactionLength
      );
      offset += transactionLength;

      if (
        transactionType === toolCodes.undo[0] ||
        transactionType === toolCodes.redo[0]
      )
        this.handleUndoRedo(transaction);
      else {
        const sortedPosition = this.transactionIndex(transaction);
        this.setIfFirstInstanceOfOperation(transaction);
        this.transactions.splice(sortedPosition, 0, transaction);
        this.correct = Math.min(this.correct, sortedPosition);
      }
    }
  }

  handleUndoRedo(undoRedo) {
    const operationId = readOperationIdAsNumber(undoRedo);
    const strings = [];
    strings[3] = "undo";
    strings[4] = "redo";

    const potentialUndoRedo = this.lastUndoRedoOperation.get(operationId);

    if (potentialUndoRedo) {
      if (compareTouuid(undoRedo, potentialUndoRedo) > 0) {
        this.lastUndoRedoOperation.set(operationId, undoRedo);
        const lastUndoRedoIsDifferent =
          undoRedo[TOOLCODEINDEX] !== potentialUndoRedo[TOOLCODEINDEX];
        if (lastUndoRedoIsDifferent) {
          const firstTransaction =
            this.firstTransactionOfOperation.get(operationId);
          const sortedPosition = this.transactionIndex(firstTransaction);
          this.correct = Math.min(this.correct, sortedPosition);
        }
      }
      return;
    }

    this.lastUndoRedoOperation.set(operationId, undoRedo);

    if (undoRedo[TOOLCODEINDEX] === toolCodes.undo[0]) {
      const firstTransaction =
        this.firstTransactionOfOperation.get(operationId);
      const sortedPosition = this.transactionIndex(firstTransaction);
      this.correct = Math.min(this.correct, sortedPosition);
    }
  }

  setIfFirstInstanceOfOperation(transaction) {
    const operationId = readOperationIdAsNumber(transaction);
    const firstTransaction = this.firstTransactionOfOperation.get(operationId);
    if (!firstTransaction || compareTouuid(transaction, firstTransaction) < 0)
      this.firstTransactionOfOperation.set(operationId, transaction);
  }

  pushClient(transaction) {
    this.pushServer(transaction);
    this.unsentTransactions.push(transaction);
    return;
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
