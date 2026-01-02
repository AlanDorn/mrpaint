// import {
//   virtualCanvas,
//   transactionLog,
//   momentReplay,
//   toolbar,
// } from "./client.js";
import buildNextTask, { setRenderContext } from "./transactionrenderer.js";
import Compression from "./compression.js";

const UPDATE_BUDGET_MS = 4;
const MOMENT_INTERVAL_MS = 2;

/**
 * Core rendering and transaction processing engine for Mr. Paint.
 *
 * This engine coordinates:
 * - Transaction application and desync rollback.
 * - Task building and incremental processing within a time budget.
 * - Snapshot creation at regular intervals.
 * - Rendering updates to the virtual canvas and status bar.
 */
export default class MrPaintEngine {
  /**
   * Creates a new MrPaintEngine instance.
   *
   * @constructor
   * @property {number} msSinceLastSnapShot - Accumulated draw time since the last snapshot was created.
   * @property {boolean} initializing - Whether the engine is in the initial loading state.
   * @property {Function|null} currentTask - Current incremental rendering task function, or `null` if idle.
   */
  constructor({transactionLog, virtualCanvas, changeTracker, momentReplay, toolbar}) {
    this.transactionLog = transactionLog;
    this.virtualCanvas = virtualCanvas;
    this.changeTracker = changeTracker;
    this.momentReplay = momentReplay;
    this.toolbar = toolbar;

    // this.compression = new Compression({virtualCanvas, momentReplay});

    setRenderContext({
      virtualCanvas: this.virtualCanvas,
      changeTracker: this.changeTracker,
      toolbar: this.toolbar
    });

                              
    this.msSinceLastSnapShot = 0;
    this.initializing = true;
    this.currentTask = null;
    requestAnimationFrame(this.nextFrame);
  }

  /**
   * Main loop callback for processing transactions and rendering.
   *
   * Runs once per animation frame (or timeout in desync state) and:
   * - Pushes new transactions to the log.
   * - Rolls back if desynchronization occurs.
   * - Processes tasks within a fixed time budget UPDATE_BUDGET_MS.
   * - Creates snapshots if enough time has passed.
   * - Updates the virtual canvas ruler and status bar.
   * - Schedules the next frame for rendering or recovery.
   *
   * @private
   * @returns {void}
   */
  nextFrame = () => {
    let now = performance.now();
    const deadline = now + UPDATE_BUDGET_MS;

    // Apply transactions and handle desync rollback
    if (!this.initializing) {
      const desync = this.transactionLog.pushTransactions();
      if (desync) {
        this.currentTask = null;
        this.momentReplay.rollback(desync);
      }
    }

    // Time slice rollback draw
    if (this.momentReplay.rollbackChunks.length)
      this.momentReplay.rollbackSlice(deadline);

    // Process tasks until time budget is exceeded
    if (!this.momentReplay.rollbackChunks.length)
      while (now < deadline) {
        const processStartTime = now;

        // Build a new task if none is active and transactions remain
        while (!this.currentTask && !this.transactionLog.finished()) {
          const transaction = this.transactionLog.nextTransaction();
          if (transaction) this.currentTask = buildNextTask(transaction);
        }

        if (!this.currentTask) break;

        // Run the current task; may return another function or null if finished
        this.currentTask = this.currentTask(deadline);

        // Check if a snapshot should be taken
        let doSnapshot =
          !this.currentTask && this.msSinceLastSnapShot > MOMENT_INTERVAL_MS;
        if (doSnapshot) {
          this.momentReplay.snapshot();
          this.msSinceLastSnapShot = 0;
        }

        now = performance.now();
        if (!doSnapshot) this.msSinceLastSnapShot += now - processStartTime;
      }
    // Update UI components
    this.toolbar.ruler.set();
    const ratio = this.transactionLog.getRenderRatio();
    const left = this.transactionLog.getTransactionsLeft();
    this.toolbar.statusbar.setCompletionBar(ratio, left);
    
    this.virtualCanvas.render();

    // Handle desync state with timeout; otherwise, continue animation frames
    if (this.transactionLog.desyncType !== this.transactionLog.DESYNC.NO)
      return setTimeout(this.nextFrame);

    requestAnimationFrame(this.nextFrame);
  };
}
