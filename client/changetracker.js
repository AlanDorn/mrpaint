// import { virtualCanvas } from "./client.js";

const CHUNK_SIZE_POWER = 7;
const CHUNK_SIZE = 2 ** CHUNK_SIZE_POWER;
const MAX_CHUNK_POWER = 15 - CHUNK_SIZE_POWER;

/**
 * Tracks which chunks of the canvas have changed so they can be efficiently updated.
 *
 * - Extends the native `Set`, where each entry is an integer encoding a (row, col) chunk position.
 * - Handles both explicit rectangular region changes (`track`) and canvas resizes (`resize`).
 * - Encoded keys: `(row << MAX_CHUNK_POWER) | col`.
 */
export default class ChangeTracker extends Set {
  constructor({virtualCanvas}){
    super();
    this.virtualCanvas = virtualCanvas;
  }
  /**
   * Mark all chunks touched by a rectangular region as changed.
   *
   * - Clamps to canvas boundaries.
   * - Encodes row/col chunk indices into integers and adds them to the set.
   *
   * @param {number} startX - Starting X coordinate of the change region.
   * @param {number} startY - Starting Y coordinate of the change region.
   * @param {number} endX - Ending X coordinate of the change region.
   * @param {number} endY - Ending Y coordinate of the change region.
   * @returns {void}
   */
  track(startX, startY, endX, endY) {
    const x0 = Math.max(0, startX);
    const y0 = Math.max(0, startY);
    const x1 = Math.min(this.virtualCanvas.width, endX) - 1;
    const y1 = Math.min(this.virtualCanvas.height, endY) - 1;
    if (x1 < 0 || y1 < 0 || x0 > x1 || y0 > y1) return;

    const startCol = x0 >> CHUNK_SIZE_POWER;
    const endCol = x1 >> CHUNK_SIZE_POWER;
    const startRow = y0 >> CHUNK_SIZE_POWER;
    const endRow = y1 >> CHUNK_SIZE_POWER;

    for (let row = startRow; row <= endRow; row++)
      for (let col = startCol; col <= endCol; col++)
        this.add((row << MAX_CHUNK_POWER) | col); // encode row+col
  }

  /**
   * Adjust tracked chunks in response to a canvas resize.
   *
   * Handles multiple cases:
   * - **Shrink**: removes chunks outside new bounds, and marks new partial row/col.
   * - **Width growth**:
   *   - If there was a partial column before, ensures old last column is marked.
   *   - Adds all newly added columns in overlapping rows.
   *   - If width changed but column count stayed the same, marks last column anyway.
   * - **Height growth**:
   *   - If there was a partial row before, ensures old last row is marked.
   *   - Adds all newly added rows.
   *   - If height changed but row count stayed the same, marks last row anyway.
   *
   * @param {number} newWidth - New canvas width.
   * @param {number} newHeight - New canvas height.
   * @returns {void}
   */
  resize(newWidth, newHeight) {
    const oldWidth = this.virtualCanvas.width;
    const oldHeight = this.virtualCanvas.height;

    const oldRows = Math.ceil(oldHeight / CHUNK_SIZE);
    const oldCols = Math.ceil(oldWidth / CHUNK_SIZE);
    const newRows = Math.ceil(newHeight / CHUNK_SIZE);
    const newCols = Math.ceil(newWidth / CHUNK_SIZE);

    const hadPartialRowBefore = oldHeight % CHUNK_SIZE !== 0;
    const hadPartialColBefore = oldWidth % CHUNK_SIZE !== 0;

    // shrink, remove any outside the new bounds
    for (const key of Array.from(this)) {
      let outside = key >> MAX_CHUNK_POWER >= newRows;
      outside ||= (key & ((1 << MAX_CHUNK_POWER) - 1)) >= newCols;
      if (outside) this.delete(key);
    }

    // width‐shrink left a partial column at newCols−1?
    const hasNewPartialCol = newWidth % CHUNK_SIZE !== 0;
    if (newWidth < oldWidth && hasNewPartialCol) {
      const lastCol = newCols - 1;
      for (let row = 0; row < newRows; row++)
        this.add((row << MAX_CHUNK_POWER) | lastCol);
    }

    // height‐shrink left a partial row at newRows−1?
    const hasNewPartialRow = newHeight % CHUNK_SIZE !== 0;
    if (newHeight < oldHeight && hasNewPartialRow) {
      const lastRow = newRows - 1;
      for (let col = 0; col < newCols; col++)
        this.add((lastRow << MAX_CHUNK_POWER) | col);
    }

    // width growth, partial-col logic for existing rows
    if (newCols > oldCols) {
      // If there was a partial column before, ensure last old column is marked
      if (hadPartialColBefore && oldCols > 0)
        for (let row = 0; row < Math.min(oldRows, newRows); row++)
          this.add((row << MAX_CHUNK_POWER) | (oldCols - 1));

      // Add all truly new columns for overlapping rows
      for (let row = 0; row < Math.min(oldRows, newRows); row++)
        for (let col = oldCols; col < newCols; col++)
          this.add((row << MAX_CHUNK_POWER) | col);
    } else if (oldWidth !== newWidth && newCols === oldCols && oldCols > 0) {
      // Width changed but column count stayed same: mark last column of existing rows
      for (let row = 0; row < Math.min(oldRows, newRows); row++)
        this.add((row << MAX_CHUNK_POWER) | (oldCols - 1));
    }

    // height growth / partial-row logic
    if (newRows > oldRows) {
      // If there was a partial row before, mark all columns in the last old row
      if (hadPartialRowBefore && oldRows > 0) {
        const lastOldRow = oldRows - 1;
        for (let col = 0; col < newCols; col++)
          this.add((lastOldRow << MAX_CHUNK_POWER) | col);
      }

      // Add all new full rows
      for (let row = oldRows; row < newRows; row++)
        for (let col = 0; col < newCols; col++)
          this.add((row << MAX_CHUNK_POWER) | col);
    } else if (oldHeight !== newHeight && newRows === oldRows && oldRows > 0) {
      // Height changed but row count stayed same: mark all columns in last row
      const lastRow = oldRows - 1;
      for (let col = 0; col < newCols; col++)
        this.add((lastRow << MAX_CHUNK_POWER) | col);
    }
  }
}
