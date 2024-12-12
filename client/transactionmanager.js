import {
  buildTransaction,
  compareTouuid,
  encodePosition,
  toolLength,
} from "./transaction.js";
import TransactionRenderer from "./transactionrenderer.js";

export default class TransactionManager {
  constructor(virtualCanvas) {
    this.virtualCanvas = virtualCanvas;
    this.transactionRenderer = new TransactionRenderer(virtualCanvas);
    this.snapshots = [];
    this.snapshotIndexes = [];
    this.snapshotMod = 32;
    this.snapshotExp = 1.5;
    this.snapshotRecycler = [];
    this.transactions = [];
    this.unsentTransactions = [];
    this.rendered = 0;
    this.correct = 0;
    this.transactionRenderLoop(2);
    this.min = 0;
  }

  transactionRenderLoop(loopTargetms) {
    const startTime = Date.now();
    this.virtualCanvas.render();
    const outOfSync = this.correct < this.rendered;
    if (outOfSync) {
      let snapshotFound = false;
      for (let index = this.snapshots.length - 1; index >= 0; index--)
        if (this.snapshotIndexes[index] < this.correct) {
          this.snapshots.length = index + 1;
          this.snapshotIndexes.length = index + 1;
          this.transactionRenderer.removeTasksAfterSnapshot(
            this.transactions[this.snapshotIndexes[index]]
          );
          this.virtualCanvas.set(this.snapshots[index]);
          this.rendered = this.snapshotIndexes[index] + 1;
          this.correct = this.snapshotIndexes[index] + 1;
          snapshotFound = true;
          break;
        }
      if (!snapshotFound) {
        this.snapshots.length = 0;
        this.snapshotIndexes.length = 0;
        this.transactionRenderer.removeTasksAfterSnapshot();
        this.virtualCanvas.reset();
        this.rendered = 0;
        this.correct = 0;
      }
    }

    let rendered = false;
    while (
      Date.now() - startTime < loopTargetms &&
      this.rendered < this.transactions.length 
    ) {
      rendered = true;
      this.transactionRenderer.renderTransaction(
        this.transactions[this.rendered]
      );
      const indexOfLastRender = this.getSortedPosition(
        this.transactionRenderer.lastFinishedTransaction
      );
      const snapShotIsNeeded =
        indexOfLastRender % this.snapshotMod === this.snapshotMod - 1;
      if (snapShotIsNeeded) {
        //remove unneeded old snapshots
        for (let index = this.snapshots.length - 1; index > 0; index--) {
          const previousSnapShotAge =
            indexOfLastRender - this.snapshotIndexes[index - 1];
          const currentSnapShotAge =
            indexOfLastRender - this.snapshotIndexes[index];
          const previousBase = Math.floor(
            Math.log(previousSnapShotAge) / Math.log(this.snapshotExp)
          );
          const currentBase = Math.floor(
            Math.log(currentSnapShotAge) / Math.log(this.snapshotExp)
          );
          if (previousBase === currentBase) {
            this.snapshotRecycler.push(...this.snapshots.splice(index, 1));
            this.snapshotIndexes.splice(index, 1);
          }
        }

        if (this.snapshotRecycler.length > 0) {
          this.snapshots.push(
            this.virtualCanvas.cloneCanvas(
              this.snapshotRecycler[this.snapshotRecycler.length - 1]
            )
          );
          this.snapshotRecycler.length--;
        } else {
          this.snapshots.push(this.virtualCanvas.cloneCanvas());
        }

        this.snapshotIndexes.push(indexOfLastRender);
      }

      this.rendered++;
      this.correct++;
    }

    const simulateSyncErrors = true;
    if (rendered && simulateSyncErrors) {
      if (Math.random() < 1) {
        const previousCorrect = this.correct;
        this.correct -= Math.random() < 0.8 ? 4 : 16;
        this.correct = Math.max(this.min, this.correct);
        this.min = previousCorrect;
      }
    }

    const timeToStartAgain = loopTargetms - (Date.now() - startTime);
    setTimeout(
      () => this.transactionRenderLoop(loopTargetms),
      Math.max(0, timeToStartAgain)
    );
  }

  pushServer(transactions) {
    let offset = 0;
    const chunkSize = 100000;
    const push = () => {
      let count = 0;
      while (offset < transactions.length && count < chunkSize) {
        count++;
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

      setTimeout(push, 0);
    };

    setTimeout(push, 0);
  }

  pushClient(transaction) {
    this.unsentTransactions.push(transaction);
    return;
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
      this.unsentTransactions.push(transaction);
      offset += transactionLength;
    }
  }

  getSortedPosition(transaction) {
    if (!transaction) {
      return 0;
    }
    let low = 0;
    let high = this.transactions.length;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (compareTouuid(this.transactions[mid], transaction) < 0) {
        low = mid + 1; // Move right
      } else {
        high = mid; // Move left
      }
    }

    return low; // This is the insertion index
  }

  buildServerMessage(userId, mouseX, mouseY) {
    return buildTransaction(
      new Uint8Array([userId]),
      encodePosition([mouseX, mouseY]),
      ...this.pullTransactions()
    );
  }

  pullTransactions() {
    const temp = this.unsentTransactions;
    this.unsentTransactions = [];
    return temp;
  }
}
//Helper functions
