import WebSocket from "ws";
import { OP_TYPE, OP_SYNC } from "../client/shared/instructionset.js";

const EXPANSION_RATE = 1.5;

export default class CanvasState {
  index: number;
  transactionIndex = 0;
  transactions: Uint8Array = new Uint8Array(2 ** 10);
  compressedTransactions: Uint8Array;
  momentCount: number;
  moments: Uint8Array[] = [];
  png: Uint8Array = new Uint8Array([0]);

  constructor(index: number, momentCount = -1) {
    this.index = index;
    this.momentCount = momentCount;
    this.transactions[0] = OP_TYPE.SYNC;
    this.transactions[1] = OP_SYNC.TRANSACTIONS;
    const defaultCompr = [OP_TYPE.SYNC, OP_SYNC.COMPRESSED_TRANSACTIONS];
    this.compressedTransactions = new Uint8Array(defaultCompr);
  }

  send(ws: WebSocket) {
    const numSnap = [OP_TYPE.SYNC, OP_SYNC.MOMENT_COUNT, this.momentCount];
    ws.send(new Uint8Array(numSnap));
    const trueIndex = this.transactionIndex - this.index + 2;
    ws.send(this.transactions.subarray(0, trueIndex));
    this.moments.forEach((moment) => ws.send(moment));
    ws.send(this.compressedTransactions);
  }

  handle(event: Uint8Array) {
    switch (event[1]) {
      case OP_SYNC.MOMENT_COUNT:
        return (this.momentCount = event[2]);
      case OP_SYNC.PNG:
        return (this.png = event.subarray(2));
      case OP_SYNC.MOMENTS:
        return this.moments.push(event);
      case OP_SYNC.COMPRESSED_TRANSACTIONS:
        return (this.compressedTransactions = event);
    }
  }

  isFinished = () =>
    this.png.length > 1 &&
    this.momentCount !== -1 &&
    this.moments.length === this.momentCount &&
    this.compressedTransactions.length > 2;

  acceptState(buildState: CanvasState) {
    this.contract();
    if (buildState.index <= this.index) return;
    this.compressedTransactions = buildState.compressedTransactions;
    this.momentCount = buildState.momentCount;
    this.moments = buildState.moments;
    this.png = buildState.png;
    this.transactions.copyWithin(0, buildState.index - this.index);
    this.index = buildState.index;
    this.transactions[0] = OP_TYPE.SYNC;
    this.transactions[1] = OP_SYNC.TRANSACTIONS;
  }

  update(eventData: Uint8Array) {
    const transactions = eventData.subarray(1);
    const trueIndex = this.transactionIndex - this.index + 2;
    const neededLength = trueIndex + transactions.length;
    while (neededLength >= this.transactions.length) this.expand();
    this.transactions.set(transactions, trueIndex);
    this.transactionIndex += transactions.length;
  }

  expand() {
    const newLength = Math.floor(this.transactions.length * EXPANSION_RATE);
    const expanded = new Uint8Array(newLength);
    expanded.set(this.transactions);
    this.transactions = expanded;
  }

  contract() {
    const trueSize = this.transactionIndex - this.index + 2;
    const underUsedThreshold = this.transactions.length / EXPANSION_RATE;
    if (trueSize > Math.floor(underUsedThreshold)) return;
    const newLength = Math.floor(this.transactions.length / EXPANSION_RATE);
    const contracted = new Uint8Array(newLength);
    contracted.set(this.transactions.subarray(0, trueSize));
    this.transactions = contracted;
  }

  print() {
    const used = formatBytes(this.transactionIndex - this.index);
    const avail = formatBytes(this.transactions.length);
    console.log(`Bytes:    ${used} / ${avail}`);
    const compression = formatBytes(this.compressedTransactions.length);
    const ratio = (this.index / this.compressedTransactions.length).toFixed(2);
    console.log(`Compr:    ${compression} : ${ratio}x`);
  }

  bytes = () =>
    0 +
    this.transactions.byteLength +
    this.compressedTransactions.byteLength +
    this.png.byteLength +
    this.moments.reduce((sum, snap) => sum + snap.byteLength, 0);
}

function formatBytes(bytes: number, decimals = 3) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024,
    dm = decimals < 0 ? 0 : decimals,
    sizes = ["Bs", "KBs", "MBs", "GBs", "TBs"],
    i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}
