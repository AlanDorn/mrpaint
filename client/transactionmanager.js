import {
  buildTransaction,
  compareTouuid,
  encodePosition,
  toolLength,
} from "./transaction.js";
import buildRenderTask from "./transactionrenderer.js";

const mod = 32;
const exp = 4;

export default class TransactionManager {
  constructor(virtualCanvas) {
    this.virtualCanvas = virtualCanvas;
    this.transactions = [];
    this.unsentTransactions = [];
    this.currentTask = [];
    this.rendered = 0;
    this.correct = 0;
    this.snapshots = [];
    this.snapshotIndexes = [];
    this.snapshotGraveyard = [];
    setTimeout(() => this.transactionRenderLoop(16), 0);
    this.lastVirtualError = 0;
    this.simulateLag = false;
  }

  simulateVirtualLag() {
    if (
      this.simulateLag &&
      this.correct > this.lastVirtualError &&
      this.correct % 2 == 1
    ) {
      this.lastVirtualError = this.correct;
      this.correct -= 2;
    }
  }

  transactionRenderLoop(loopTargetms) {
    const startTime = performance.now();

    this.virtualCanvas.render();

    const needToSyncCanvas = this.correct < this.rendered;
    if (needToSyncCanvas) this.syncCanvas();

    while (performance.now() - startTime < loopTargetms) {
      const taskIsFinished = this.currentTask.length === 0;
      if (taskIsFinished) {
        const needToTakeSnapShot = this.rendered % mod === mod - 1;
        if (needToTakeSnapShot) this.takeSnapShot();

        const allTransactionsAreRendered =
          this.rendered >= this.transactions.length;
        if (allTransactionsAreRendered) {
          const timeLeft = loopTargetms - (performance.now() - startTime);
          this.simulateVirtualLag();
          setTimeout(() => this.transactionRenderLoop(loopTargetms), timeLeft);
          return;
        }

        this.currentTask = buildRenderTask(
          this.virtualCanvas,
          this.transactions[this.rendered]
        );

        this.rendered++;
        this.correct++;
      }

      this.currentTask.pop()(); // run the next bit of task
    }

    this.simulateVirtualLag();

    setTimeout(() => this.transactionRenderLoop(loopTargetms), 0);
  }

  syncCanvas() {
    console.log("syncing");
    // Stop the current task
    this.currentTask.length = 0;

    // Remove any snapshots that are newer than the current correct index.
    for (let index = 0; index < this.snapshots.length; index++) {
      const snapshotIsNewerThanCorrect =
        this.snapshotIndexes[index] >= this.correct;
      if (snapshotIsNewerThanCorrect) {
        // Instead of just truncating, we splice so we can push them into the graveyard
        const removedSnapshots = this.snapshots.splice(index);
        const removedIndexes = this.snapshotIndexes.splice(index);

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
      const transactionLength = toolLength[transactions[offset + 10]];
      const transaction = transactions.subarray(
        offset,
        offset + transactionLength
      );
      const sortedPosition = this.getSortedPosition(transaction);
      this.correct = Math.min(this.correct, sortedPosition);
      this.transactions.splice(sortedPosition, 0, transaction);
      offset += transactionLength;
    }
  }

  pushClient(transaction) {
    this.pushServer(transaction);
    this.unsentTransactions.push(transaction);
    return;
  }

  getSortedPosition(transaction) {
    if (!transaction) return 0;
    let low = 0;
    let high = this.transactions.length;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (compareTouuid(this.transactions[mid], transaction) < 0) low = mid + 1;
      else high = mid;
    }
    return low; // This is the insertion index
  }
}
