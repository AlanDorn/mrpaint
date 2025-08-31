import {
  compareTouuid,
  opIdAsBigInt,
  TOOLCODEINDEX,
  toolCodes,
  toolLength,
} from "./transaction.js";

const UNDO_TOOL = toolCodes.undo[0];
const REDO_TOOL = toolCodes.redo[0];
const DESYNC = { NO: 0, COLLAB: 1, UNDOREDO: 2 };

/**
 * Maintains the ordered list of all transactions, including undo/redo handling
 * and collaborative insertion logic.
 *
 * Core responsibilities:
 * - Maintains client, server, and unsent transaction buffers.
 * - Handles insertion of transactions in sorted order by UUID.
 * - Tracks undo/redo state for operations.
 * - Detects desynchronization caused by collaborative inserts or undo/redo,
 *   triggering rollback when necessary.
 */
export default class TransactionLog {
  /**
   * Create a new TransactionLog instance.
   *
   * @constructor
   * @property {Object} DESYNC - Enum for desync states: `NO`, `COLLAB`, `UNDOREDO`.
   * @property {Uint8Array[]} transactions - All known transactions in sorted order.
   * @property {Uint8Array[]} unsent - Client-side transactions not yet sent to the server.
   * @property {Uint8Array[]} uninserted - Transactions not yet inserted into the main log.
   * @property {Map<bigint, Uint8Array>} lastUndoRedo - Tracks the most recent undo/redo for each operation.
   * @property {Map<bigint, Uint8Array>} initialTransaction - Tracks the first transaction for each operation.
   * @property {number} rendered - Index of how many transactions have been rendered/applied.
   * @property {number} desyncType - Current desync type (from DESYNC).
   * @property {number} resyncIndex - Index to resume rendering from after rollback.
   * @property {Uint8Array|null} resyncMoment - Snapshot transaction used for rollback synchronization.
   */
  constructor() {
    this.DESYNC = DESYNC;
    this.transactions = [];
    this.unsent = [];
    this.uninserted = [];
    this.lastUndoRedo = new Map();
    this.initialTransaction = new Map();
    this.rendered = 0;
    this.desyncType = DESYNC.NO;
    this.resyncIndex = 0;
    this.resyncMoment = null;
  }

  /** @returns {number} Rendered progress ratio (0..1). */
  getRenderRatio = () => this.rendered / this.transactions.length;

  /** @returns {number} Number of transactions left to render. */
  getTransactionsLeft = () => this.transactions.length - this.rendered;

  /** @returns {boolean} Whether all transactions have been rendered. */
  finished = () => this.rendered >= this.transactions.length;

  /** @returns {number} Whether there are pending inserts. */
  needsInsert = () => this.uninserted.length;

  /** @returns {Uint8Array|undefined} The last rendered transaction. */
  getLastTransaction = () => this.transactions[this.rendered - 1];

  /**
   * Retrieve the next transaction to render, skipping invalid undo/redo states.
   *
   * - Advances the render pointer.
   * - Clears desync state once resync index is reached.
   * - Skips transactions invalidated by undo/redo.
   *
   * @returns {Uint8Array|undefined} The next valid transaction to render.
   */
  nextTransaction() {
    while (this.rendered < this.transactions.length) {
      const tx = this.transactions[this.rendered++];
      let reSynced = this.desyncType !== DESYNC.NO;
      reSynced &&= this.rendered >= this.resyncIndex;
      if (reSynced) this.desyncType = DESYNC.NO;

      const undoRedo = this.lastUndoRedo.get(opIdAsBigInt(tx));
      if (!undoRedo || undoRedo[TOOLCODEINDEX] === REDO_TOOL) return tx;
    }
  }

  /**
   * Add a client-originated transaction.
   *
   * - Queued in both `unsent` (for network send) and `uninserted` (for local insert).
   *
   * @param {Uint8Array} tx - Transaction to push.
   */
  pushClient = (tx) => {
    this.unsent.push(tx);
    this.uninserted.push(tx);
  };

  /**
   * Add a batch of server transactions.
   *
   * - Splits subarray based on tool length metadata.
   * - Queued into `uninserted` for local insert.
   *
   * @param {Uint8Array} txs - Concatenated transactions from the server.
   */
  pushServer = (txs) => {
    let inc = 0;
    while (inc < txs.length) {
      const length = toolLength[txs[inc + TOOLCODEINDEX]];
      this.uninserted.push(txs.subarray(inc, (inc += length)));
    }
  };

  /**
   * Insert all pending transactions into the log.
   *
   * - Updates resync moment/index if needed.
   * - Returns the desync-causing transaction, if one occurred.
   *
   * @returns {Uint8Array|undefined} Transaction where desync occurred.
   */
  pushTransactions() {
    let correct = this.rendered;
    let desync = false;
    const moment = this.transactions[correct - 1];

    for (let i = 0; i < this.uninserted.length; i++)
      [correct, desync] = this.insert(this.uninserted[i], [correct, desync]);

    this.uninserted.length = 0;

    if (this.resyncMoment)
      this.resyncIndex = this.transactionIndex(this.resyncMoment);

    if (!desync || !moment) return;
    this.resyncMoment = moment;
    this.resyncIndex = this.transactionIndex(moment);
    return this.transactions[correct];
  }

  /**
   * Dispatch transaction insertion by type.
   *
   * - Undo/redo transactions handled separately.
   * - Generic transactions inserted by sorted index.
   *
   * @private
   * @param {Uint8Array} tx - Transaction to insert.
   * @param {[number, boolean]} state - Current `[correctIndex, desyncFlag]`.
   * @returns {[number, boolean]} Updated `[correctIndex, desyncFlag]`.
   */
  insert = (tx, [correct, desync]) =>
    tx[TOOLCODEINDEX] === UNDO_TOOL || tx[TOOLCODEINDEX] === REDO_TOOL
      ? this.handleUndoRedo(tx, [correct, desync])
      : this.handleGeneric(tx, [correct, desync]);

  /**
   * Handle generic (non-undo/redo) transaction insertion.
   *
   * - Inserts transaction in sorted order.
   * - Marks desync if inserted before the current render index.
   * - Tracks the oldest transaction for each operation.
   *
   * @private
   * @param {Uint8Array} tx - Transaction to insert.
   * @param {[number, boolean]} state - Current `[correctIndex, desyncFlag]`.
   * @returns {[number, boolean]} Updated `[correctIndex, desyncFlag]`.
   */
  handleGeneric(tx, [correct, desync]) {
    if (tx.length < TOOLCODEINDEX) return correct;

    const sortedPosition = this.transactionIndex(tx);
    this.transactions.splice(sortedPosition, 0, tx);

    if (sortedPosition < correct) {
      correct = sortedPosition;
      desync = true;
      this.desyncType = DESYNC.COLLAB;
    }

    const operationId = opIdAsBigInt(tx);
    const initialTransaction = this.initialTransaction.get(operationId);
    let isInitial = !initialTransaction;
    isInitial ||= compareTouuid(tx, initialTransaction) < 0;

    // initial transaction is the oldest transaction of an operation
    if (isInitial) this.initialTransaction.set(operationId, tx);

    return [correct, desync];
  }

  /**
   * Handle undo/redo transaction insertion.
   *
   * - Ignores older or duplicate undo/redo states.
   * - Updates last undo/redo record.
   * - Marks desync if undo/redo affects already-rendered transactions.
   *
   * @private
   * @param {Uint8Array} undoRedo - Undo/redo transaction to insert.
   * @param {[number, boolean]} state - Current `[correctIndex, desyncFlag]`.
   * @returns {[number, boolean]} Updated `[correctIndex, desyncFlag]`.
   */
  handleUndoRedo(undoRedo, [correct, desync]) {
    const operationId = opIdAsBigInt(undoRedo);
    const prevUndoRedo = this.lastUndoRedo.get(operationId);

    if (prevUndoRedo) {
      // ignore, it's older than the existing undoredo
      if (compareTouuid(undoRedo, prevUndoRedo) <= 0) return [correct, desync];
      this.lastUndoRedo.set(operationId, undoRedo);

      const lastUndoRedoIsSame =
        undoRedo[TOOLCODEINDEX] === prevUndoRedo[TOOLCODEINDEX];
      // ignore, it's the same type as the existing undoredo
      if (lastUndoRedoIsSame) return [correct, desync];
    } else {
      this.lastUndoRedo.set(operationId, undoRedo);
      // ignore, it's a redo but there is no existing undoredo
      if (undoRedo[TOOLCODEINDEX] !== UNDO_TOOL) return [correct, desync];
    }

    // only gets here if the undoredo potentially changes created state
    const initialTransaction = this.initialTransaction.get(operationId);
    // ignore, undoredoing an unseen transaction
    if (!initialTransaction) return [correct, desync];

    const sortedPosition = this.transactionIndex(initialTransaction);
    // ignore, the undoredo changes an unrendered transaction
    if (sortedPosition < correct) {
      correct = sortedPosition;
      desync = true;
      this.desyncType = DESYNC.UNDOREDO;
    }

    return [correct, desync];
  }

  /**
   * Binary search for a transaction's sorted index.
   *
   * - Uses full UUID comparison for ordering.
   *
   * @param {Uint8Array} tx - Transaction to locate.
   * @returns {number} Insertion index.
   */
  transactionIndex(tx) {
    const arr = this.transactions;
    let lo = 0;
    let hi = arr.length;

    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      const a = arr[mid];
      let c = 0;

      // Compare byte by byte up to TOOLCODEINDEX
      for (let i = 0; i < TOOLCODEINDEX; i++) {
        c = a[i] - tx[i];
        if (c) break;
      }

      if (c < 0) lo = mid + 1;
      else hi = mid;
    }

    return lo;
  }
}
