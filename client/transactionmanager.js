import {
  buildTransaction,
  encodePosition,
  TOOLCODEINDEX,
  toolCodeInverse,
} from "./transaction.js";
import buildRenderTask from "./transactionrenderer.js";
import { OPCODE, OPCODE_NAME } from "./shared/instructionset.js";

const exp = 1.5;

export default class TransactionManager {
  constructor(transactionLog, virtualCanvas) {
    this.transactionLog = transactionLog;
    this.virtualCanvas = virtualCanvas;
    this.snapshots = [];
    this.snapshotTransactions = [];
    this.snapshotGraveyard = [];
    this.msSinceLastSnapShot = 0;
    this.currentTask = [];
    this.newRender = false; // used to control mousemove input,
    requestAnimationFrame(() => this.renderFrame());
  }

  renderFrame() {
    const startTime = performance.now();
    this.sendSocket();
    this.newRender = true;
    this.virtualCanvas.ruler.set();
    const ratio = this.transactionLog.getRenderRatio();
    this.virtualCanvas.statusbar.setCompletionBar(ratio);
    const [correct, needSync] = this.transactionLog.pushTransactions();
    if (needSync) this.syncCanvas(correct);

    if (
      this.transactionLog.rerenderCauseOfUndo ||
      this.transactionLog.finished()
    )
      this.virtualCanvas.fill();
    this.virtualCanvas.render();

    while (performance.now() - startTime < 7) {
      const processStartTime = performance.now();
      if (this.taskFinished()) {
        if (this.transactionLog.finished()) break;
        const transaction = this.transactionLog.nextTransaction();
        if (!transaction) break;
        this.currentTask = buildRenderTask(this.virtualCanvas, transaction);
      }
      const optionalNextTask = this.currentTask.pop()();
      if (optionalNextTask) this.currentTask.push(optionalNextTask);
      this.msSinceLastSnapShot += performance.now() - processStartTime;
      this.trySnapshot();
    }

    requestAnimationFrame(() => this.renderFrame());
  }

  taskFinished() {
    return this.currentTask.length === 0;
  }

  syncCanvas(correct) {
    // Stop the current task
    this.currentTask.length = 0;

    // Remove any snapshots that are newer than the current correct index.
    for (let index = 0; index < this.snapshots.length; index++) {
      const snapshotIsNewerThanCorrect =
        this.transactionLog.transactionIndex(
          this.snapshotTransactions[index]
        ) >= correct;
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
      this.transactionLog.rendered = 0;
      return;
    }

    // Set the canvas to the last snapshot
    const snapshot = this.snapshots[this.snapshots.length - 1];
    const snapshotIndex = this.transactionLog.transactionIndex(
      this.snapshotTransactions[this.snapshotTransactions.length - 1]
    );

    this.snapshotGraveyard.push(this.virtualCanvas.set(snapshot));
    this.virtualCanvas.viewport.setAdjusters();
    this.virtualCanvas.statusbar.setCanvasSize();
    this.transactionLog.rendered = snapshotIndex + 1;
    this.snapshots.length--;
    this.snapshotTransactions.length--;

    this.snapshots.push(
      this.virtualCanvas.cloneCanvas(this.snapshotGraveyard.pop())
    );
    this.snapshotTransactions.push(
      this.transactionLog.transactions[this.transactionLog.rendered - 1]
    );

    this.msSinceLastSnapShot = 0;
  }

  trySnapshot() {
    if (!this.taskFinished()) return;
    const waitedEnough = this.msSinceLastSnapShot > 8;
    const lastTransaction = this.transactionLog.getLastTransaction();
    const toolcode = lastTransaction[TOOLCODEINDEX];
    const isResize = toolCodeInverse[toolcode] == "resize";
    if (!waitedEnough && !isResize) return;
    this.takeSnapShot();
    this.msSinceLastSnapShot = 0;
  }

  takeSnapShot() {
    for (let index = this.snapshots.length - 1 - 5; index > 0; index--) {
      const olderAge =
        this.transactionLog.rendered -
        this.transactionLog.transactionIndex(
          this.snapshotTransactions[index - 1]
        );
      const currentAge =
        this.transactionLog.rendered -
        this.transactionLog.transactionIndex(this.snapshotTransactions[index]);
      if (olderAge < exp * currentAge) {
        this.snapshotTransactions.splice(index, 1);
        this.snapshotGraveyard.push(...this.snapshots.splice(index, 1));
      }
    }

    this.snapshots.push(
      this.virtualCanvas.cloneCanvas(this.snapshotGraveyard.pop())
    );
    this.snapshotTransactions.push(
      this.transactionLog.transactions[this.transactionLog.rendered - 1]
    );
  }

  buildServerMessage(opcode, userId, mouseX, mouseY) {
    const parts = [new Uint8Array([opcode, userId])];

    // Cursor packets carry a position
    if (opcode === OPCODE.CURSOR_POSITION_UPDATE) {
      parts.push(encodePosition([mouseX, mouseY]));
    }

    // Transaction packets carry the queued transactions
    if (opcode === OPCODE.TRANSACTION_UPDATE) {
      parts.push(...this.transactionLog.unsentTransactions.splice(0));
    }

    return buildTransaction(...parts);
  }

  readState(transferStateReader) {
    this.transactionLog.pushServer(transferStateReader.transactions);
    this.transactionLog.pushTransactions();
    this.snapshots = transferStateReader.snapshots;
    this.snapshotTransactions = transferStateReader.snapshotTransactions;

    if (this.snapshotTransactions.length > 1) {
      const lastTransaction =
        this.snapshotTransactions[this.snapshotTransactions.length - 2];
      const correct = this.transactionLog.transactionIndex(lastTransaction);
      this.syncCanvas(correct);
    }

    while (this.virtualCanvas.fillGeneration.length > 0)
      this.virtualCanvas.fill();
  }

  sendSocket() {
    //blank because this function is generated by socket
  }
}
