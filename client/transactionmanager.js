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
    this.running = false;
    this.snapshots = [];
    this.snapshotIndexes = [];
  }

  startRenderer() {
    setTimeout(() => this.transactionRenderLoop(2), 0);
  }

  transactionRenderLoop(loopTargetms) {
    this.running = true;
    const startTime = performance.now();

    const needToSyncCanvas = this.correct < this.rendered;
    // In the case that we to receive a transaction that came before our current render point we need to reset the screen to what it was like before that transaction and play it forward again.
    // syncCanvas will kill the current task and set up the render index to continue rendering transactions gracefully.
    if (needToSyncCanvas) this.syncCanvas();

    //Rendering the transactions can block the event loop. The renderTasks are build such that they can be done in multiple steps allowing more room for mouse IO events to go through. There is over head between setting a timeout so it is wise to have an internal looping portion to this event safe loop.
    while (performance.now() - startTime < loopTargetms) {
      const taskIsFinished = this.currentTask.length === 0;
      if (taskIsFinished) {
        const needToTakeSnapShot = this.rendered % mod === mod - 1;
        if (needToTakeSnapShot) this.takeSnapShot();

        const allTransactionsAreRendered =
          this.rendered >= this.transactions.length;
        if (allTransactionsAreRendered) {
          this.running = false;
          return;
        }

        this.currentTask = buildRenderTask(this.transactions[this.rendered]);
        this.rendered++;
        this.correct++;
      }

      this.currentTask.slice()(); //run the next bit of task
    }

    this.startRenderer(); // Start over again
  }

  syncCanvas() {
    // currentTask hold sub tasks that can get processed across render iterations. Setting it to empty stops that task from continueing.
    this.currentTask.length = 0;

    // Remove any snapshots which will never be used because they are out of sync.
    for (let index = 0; index < this.snapshots.length; index++) {
      const snapshotIsNewerThanCorrect =
        this.snapshotIndexes[index] >= this.correct;
      if (snapshotIsNewerThanCorrect) {
        this.snapshots.length = index;
        this.snapshotIndexes.length = index;
        break;
      }
    }

    const thereIsNoSnapShotBeforeCorrect = this.snapshots.length === 0;
    if (thereIsNoSnapShotBeforeCorrect) {
      this.virtualCanvas.reset();
      this.rendered = 0;
      this.correct = 0;
      return;
    }

    const snapshot = this.snapshots[this.snapshots.length - 1];
    const snapshotIndex = this.snapshotIndexes[this.snapshotIndexes.length - 1];
    this.virtualCanvas.set(snapshot);
    this.rendered = snapshotIndex + 1;
    this.correct = snapshotIndex + 1;
  }

  takeSnapShot() {
    //This prevents too many snapshots piling up. We have a smart way to remove transactions such that there is always at least 1 snapshot within a magnitude. So if your exp was 10 then you would always have a snapshot within 10000 1000 100 and 10 if you have gotten that far.
    for (let index = this.snapshots.length - 1; index > 0; index--) {
      const previousBase = Math.floor(
        Math.log(indexOfLastRender - this.snapshotIndexes[index - 1]) /
          Math.log(exp)
      );
      const currentBase = Math.floor(
        Math.log(indexOfLastRender - this.snapshotIndexes[index]) /
          Math.log(exp)
      );
      if (previousBase === currentBase) this.snapshotIndexes.splice(index, 1);
    }
    this.snapshots.push(this.virtualCanvas.cloneCanvas());
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
      const transaction = transactions.slice(
        offset,
        offset + transactionLength
      );
      const sortedPosition = this.getSortedPosition(transaction);
      this.correct = Math.min(this.correct, sortedPosition);
      this.transactions.splice(sortedPosition, 0, transaction);
      offset += transactionLength;
    }
    if (this.rendered < this.transactions.length && !this.running)
      this.startRenderer();
  }

  pushClient(transaction) {
    this.unsentTransactions.push(transaction);
    return;
  }

  getSortedPosition(transaction) {
    if (!transaction) return 0;
    let low = 0;
    let high = this.transactions.length;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (compareTouuid(this.transactions[mid], transaction) < 0)
        low = mid + 1; // Move right
      else high = mid; // Move left
    }
    return low; // This is the insertion index
  }
}
