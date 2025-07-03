import {
  compareTouuid,
  readOperationIdAsNumber,
  TOOLCODEINDEX,
  toolCodes,
  toolLength,
} from "./transaction.js";

export default class TransactionLog {
  constructor() {
    this.transactions = [];
    this.unsentTransactions = [];
    this.uninsertedTransactions = [];
    this.lastUndoRedo = new Map();
    this.initialTransaction = new Map();
    this.rendered = 0;
    this.initializing = true;
    this.rerenderCauseOfUndo = false;
  }

  getRenderRatio() {
    return this.rendered / this.transactions.length;
  }

  finished() {
    return this.rendered >= this.transactions.length;
  }

  needsInsert() {
    return this.uninsertedTransactions.length;
  }

  getLastTransaction() {
    return this.transactions[this.rendered - 1];
  }

  nextTransaction() {
    let transaction = this.transactions[this.rendered++];
    while (this.transactionIsUndone(transaction) && !this.finished())
      transaction = this.transactions[this.rendered++];
    if (this.transactionIsUndone(transaction)) return;
    return transaction;
  }

  transactionIsUndone(transaction) {
    const previousUndoRedo = this.lastUndoRedo.get(
      readOperationIdAsNumber(transaction)
    );
    if (!previousUndoRedo) return false;
    return previousUndoRedo[TOOLCODEINDEX] === toolCodes.undo[0];
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
    if (this.initializing) return;
    this.unsentTransactions.push(transaction);
    this.uninsertedTransactions.push(transaction);
  }

  pushTransactions() {
    let correct = this.rendered;
    for (let index = 0; index < this.uninsertedTransactions.length; index++) {
      const transaction = this.uninsertedTransactions[index];
      const transactionType = transaction[TOOLCODEINDEX];
      const isUndo = transactionType === toolCodes.undo[0];
      const isRedo = transactionType === toolCodes.redo[0];
      if (isUndo || isRedo) correct = this.handleUndoRedo(transaction, correct);
      else correct = this.handleGeneric(transaction, correct);
    }
    this.uninsertedTransactions.length = 0;
    return [correct, correct < this.rendered];
  }

  handleGeneric(transaction, correct) {
    if (transaction.length < 14) return correct;

    const sortedPosition = this.transactionIndex(transaction);
    this.transactions.splice(sortedPosition, 0, transaction);
    if (sortedPosition < correct) {
      correct = sortedPosition;
      this.rerenderCauseOfUndo = false;
    }
    const operationId = readOperationIdAsNumber(transaction);
    const initialTransaction = this.initialTransaction.get(operationId);
    if (
      !initialTransaction ||
      compareTouuid(transaction, initialTransaction) < 0
    )
      this.initialTransaction.set(operationId, transaction);
    return correct;
  }

  handleUndoRedo(undoRedo, correct) {
    const operationId = readOperationIdAsNumber(undoRedo);
    const previousUndoRedo = this.lastUndoRedo.get(operationId);

    if (previousUndoRedo) {
      if (compareTouuid(undoRedo, previousUndoRedo) <= 0) return correct;
      this.lastUndoRedo.set(operationId, undoRedo);
      const lastUndoRedoIsSame =
        undoRedo[TOOLCODEINDEX] === previousUndoRedo[TOOLCODEINDEX];
      if (lastUndoRedoIsSame) return correct;
    } else {
      this.lastUndoRedo.set(operationId, undoRedo);
      if (undoRedo[TOOLCODEINDEX] !== toolCodes.undo[0]) return correct;
    }

    const initialTransaction = this.initialTransaction.get(operationId);
    if (!initialTransaction) return correct;
    const sortedPosition = this.transactionIndex(initialTransaction);
    if (sortedPosition >= correct) return correct;
    this.rerenderCauseOfUndo = true;
    return sortedPosition;
  }
}
