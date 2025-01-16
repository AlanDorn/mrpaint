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
    this.needToRenderCanvas = false;

    this.overshoot = 0;

    this.simulateLag = false;
    this.lastVirtualError = 0;
    setTimeout(() => this.transactionRenderLoop(16), 0);
  }

  simulateVirtualLag() {
    if (this.simulateLag && this.correct > this.lastVirtualError) {
      this.lastVirtualError = this.correct + 15;
      this.correct -= Math.random() < 0.5 ? 30 : 60;
    }
  }

  transactionRenderLoop(loopTargetms) {
    const startTime = performance.now();

    if (this.uninsertedTransactions.length > 0) this.pushTransactions();

    const needToSyncCanvas = this.correct < this.rendered;
    if (needToSyncCanvas) this.syncCanvas();

    if (this.rendered >= this.transactions.length) {
      this.virtualCanvas.fill();
      this.needToRenderCanvas = true;
    }

    if (this.needToRenderCanvas) this.virtualCanvas.render();
    this.needToRenderCanvas = false;

    while (performance.now() - startTime < loopTargetms - this.overshoot) {
      const processStartTime = performance.now();
      const taskIsFinished = this.currentTask.length === 0;
      if (taskIsFinished) {
        const allTransactionsAreRendered =
          this.rendered >= this.transactions.length;
        if (allTransactionsAreRendered) {
          const timeLeft = loopTargetms - this.overshoot - (performance.now() - startTime);
          this.simulateVirtualLag();
          setTimeout(() => this.transactionRenderLoop(loopTargetms), timeLeft);
          this.overshoot = (this.overshoot * 99) / 100;
          return;
        }

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
      if (this.currentTask.length === 0 && this.msSinceLastSnapShot > 32) {
        console.log("snapshotTaken");
        console.log(this.overshoot);
        this.takeSnapShot();
        this.msSinceLastSnapShot = 0;
      }
      this.needToRenderCanvas = true;
      this.msSinceLastSnapShot += performance.now() - processStartTime;
    }

    this.overshoot =
      (this.overshoot * 99 +
        performance.now() -
        startTime +
        this.overshoot -
        loopTargetms) /
      100;

    setTimeout(() => this.transactionRenderLoop(loopTargetms), 0);
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
    // Clean up older snapshots that are in the same "magnitude" tier
    // - 5 so that the last 5 snapshots don't get removed
    for (let index = this.snapshots.length - 1 - 5; index > 0; index--) {
      const previousBase =
        this.rendered -
        this.transactionIndex(this.snapshotTransactions[index - 1]);
      const currentBase =
        this.rendered - this.transactionIndex(this.snapshotTransactions[index]);
      if (previousBase < exp * currentBase) {
        // Remove the snapshot and push it into the graveyard
        this.snapshotTransactions.splice(index, 1);
        this.snapshotGraveyard.push(...this.snapshots.splice(index, 1));
      }
    }

    // Create a new snapshot from an old one if available
    let reusedSnapshot = null;
    if (this.snapshotGraveyard.length > 0) {
      // Pop from graveyard and reuse it
      reusedSnapshot = this.snapshotGraveyard.pop();
    }

    this.snapshots.push(this.virtualCanvas.cloneCanvas(reusedSnapshot));
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
        this.correct = Math.min(this.correct, sortedPosition);
      }
    }

    this.uninsertedTransactions.length = 0;
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
          if (firstTransaction) {
            const sortedPosition = this.transactionIndex(firstTransaction);
            this.correct = Math.min(this.correct, sortedPosition);
          }
        }
      }
      return;
    }

    this.lastUndoRedoOperation.set(operationId, undoRedo);

    if (undoRedo[TOOLCODEINDEX] === toolCodes.undo[0]) {
      const firstTransaction =
        this.firstTransactionOfOperation.get(operationId);
      if (firstTransaction)
        this.correct = Math.min(
          this.correct,
          this.transactionIndex(firstTransaction)
        );
    }
  }

  setIfFirstInstanceOfOperation(transaction) {
    const operationId = readOperationIdAsNumber(transaction);
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
