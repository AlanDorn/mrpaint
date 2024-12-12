import {
  compareTouuid,
  decodeColor,
  decodeLargeNumber,
  decodePosition,
} from "./transaction.js";
import { splinePixels } from "./util2d.js";

export default class TransactionRenderer {
  constructor(virtualCanvas) {
    this.virtualCanvas = virtualCanvas;

    this.tasks = [];
    this.taskTransactions = [];
    this.currentTransactionProccessing = null;
    this.lastFinishedTransaction = null;
    this.running = false;
  }

  renderNext() {
    this.lastFinishedTransaction = this.currentTransactionProccessing;
    if (this.tasks.length === 0) {
      this.running = false;
      return;
    }

    this.running = true;

    this.currentTransactionProccessing = this.taskTransactions.shift();
    
    this.render(this.tasks.shift());
  }

  render(task) {
    if (task.length === 0 || !this.currentTransactionProccessing) {
      this.renderNext();
      return;
    }

    task.shift()();
    setTimeout(() => this.render(task), 0);
  }

  removeTasksAfterSnapshot(snapshotTransaction = null) {
    if (!snapshotTransaction) {
      this.tasks.length = 0;
      this.taskTransactions.length = 0;
      this.currentTransactionProccessing = null;
      return;
    }

    if (
      this.currentTransactionProccessing &&
      compareTouuid(this.currentTransactionProccessing, snapshotTransaction) > 0
    ) {
      this.currentTransactionProccessing = null;
    }

    for (let index = 0; index < this.tasks.length; index++) {
      if (
        compareTouuid(this.taskTransactions[index], snapshotTransaction) > 0
      ) {
        this.tasks.length = index;
        this.taskTransactions.length = index;
        return;
      }
    }
  }

  push(transaction, task) {
    this.tasks.push(task);
    this.taskTransactions.push(transaction);
    if (!this.running) this.renderNext();
  }

  renderTransaction(transaction) {
    switch (transaction[10]) {
      case 0:
        this.renderPixel(transaction);
        break;
      case 1:
        this.renderPencil(transaction);
        break;
    }
  }

  renderPixel(transaction) {
    const color = decodeColor(transaction.slice(11, 14));
    const brushsize = decodeLargeNumber(transaction.slice(14, 16));
    const pixel = decodePosition(transaction.slice(16, 20));

    const task = [
      () => {
        for (let dx = 0; dx < brushsize; dx++) {
          for (let dy = 0; dy < brushsize; dy++) {
            this.virtualCanvas.setPixel(
              pixel[0] + dx,
              pixel[1] + dy,
              color[0],
              color[1],
              color[2]
            );
          }
        }
      },
    ];

    this.push(transaction, task);
  }

  renderPencil(transaction) {
    const color = decodeColor(transaction.slice(11, 14));
    const brushsize = decodeLargeNumber(transaction.slice(14, 16));
    const pixels = splinePixels([
      decodePosition(transaction.slice(16, 20)),
      decodePosition(transaction.slice(20, 24)),
      decodePosition(transaction.slice(24, 28)),
      decodePosition(transaction.slice(28, 32)),
    ]);

    const chunkSize = Math.ceil((1 * 400 * 400) / brushsize / brushsize); // Number of pixels to process per chunk
    const task = []; // Array to store the lambdas

    for (let index = 0; index < pixels.length; index += chunkSize) {
      const start = index;
      const end = Math.min(index + chunkSize, pixels.length);

      // Create a lambda for this chunk
      task.push(() => {
        for (let i = start; i < end; i++) {
          const [x, y] = pixels[i];
          for (let dx = 0; dx < brushsize; dx++) {
            for (let dy = 0; dy < brushsize; dy++) {
              this.virtualCanvas.setPixel(
                x + dx,
                y + dy,
                color[0],
                color[1],
                color[2]
              );
            }
          }
        }
      });
    }

    this.push(transaction, task); // Return the list of lambdas
  }
}
