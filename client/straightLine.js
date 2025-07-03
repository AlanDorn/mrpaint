/* StraightLine.js – preview-layer edition
   ------------------------------------------------------------
   Live strokes are drawn on VirtualCanvas.previewCanvas.  No pixels are
   committed to the main bitmap until the user finalises, eliminating all
   cross-tool collision bugs.
*/

import { operationId, straightLineTransaction } from "./transaction.js";

export default class StraightLine {
  constructor(vc, transactionLog, toolbar) {
    this.vc = vc; // VirtualCanvas instance
    this.log = transactionLog;
    this.tb = toolbar;

    this.colorpicker = toolbar.colorpicker;
    this.brushsize = toolbar.brushsize;

    /* state flags */
    this.isDrawing = false; // user dragging first line
    this.isEditable = false; // handles visible

    /* stroke state */
    this.start = null; // [x,y]
    this.end = null; // [x,y]
    this.opId = null;

    /* style caches for live polling */
    this.colorSource = "primary";
    this.curColor = [...this.colorpicker.primarycolor];
    this.lastBrushSize = this.brushsize.size;

    /* handle DOM */
    this.handles = null; // {start,end}
    this.draggingHandle = null;

    /* listen to possible toolbar events to refresh preview */
    const add = (src, evts, cb) =>
      evts.forEach((e) => src?.addEventListener?.(e, cb));
    add(this.brushsize, ["change", "input"], () => this.refreshPreview());
    add(this.colorpicker, ["change", "input"], () => {
      this.curColor = [...this.colorpicker[this.colorSource + "color"]];
      this.refreshPreview();
    });

    this.onCanvasMove = () => {
      this.updateHandlePositions();
      this.refreshPreview();
    };

    this._onKeyDown = (e) => {
      if (e.key === "Delete" && this.isEditable) this.cancelEdit();
    };
    document.addEventListener("keydown", this._onKeyDown);
  }

  /* ————————————————— mouse wiring ————————————————— */

  mouseDownLeft = (e) => this.handleMouseDown(e, "primary");
  mouseDownRight = (e) => this.handleMouseDown(e, "secondary");
  mouseUpLeft = () => this.handleMouseUp();
  mouseUpRight = () => this.handleMouseUp();
  mouseMove = (e) => this.handleMouseMove(e);

  /* ————————————————— phase 1: initial drag ————————————————— */

  handleMouseDown(input, paletteKey) {
    if (this.isEditable && !this.isHandle(input.target)) {
      this.commit();
      return;
    }
    if (this.isDrawing || this.isEditable) return;

    this.isDrawing = true;
    this.colorSource = paletteKey;
    this.curColor = [...this.colorpicker[paletteKey + "color"]];
    this.lastBrushSize = this.brushsize.size;
    this.start = this.vc.positionInCanvas(input.x, input.y);
    this.end = [...this.start];
    this.opId = operationId();
  }

  handleMouseMove(input) {
    this.pollStyleChanges();

    if (this.isDrawing) {
      this.liveDrag(input);
    } else if (this.draggingHandle) {
      this.adjustHandle(input);
    } else if (this.isEditable) {
      this.updateHandlePositions();
    }
  }

  pollStyleChanges() {
    if (!this.colorSource) return;

    const sizeNow = this.brushsize.size;
    const colNow = this.colorpicker[this.colorSource + "color"];
    if (
      sizeNow !== this.lastBrushSize ||
      !this.colorsEqual(colNow, this.curColor)
    ) {
      this.curColor = [...colNow];
      this.lastBrushSize = sizeNow;
      this.refreshPreview();
    }
  }

  colorsEqual(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
  }

  liveDrag(input) {
    this.vc.clearPreview();
    this.end = this.vc.positionInCanvas(input.x, input.y);
    this.drawLine(true); // preview = true
  }

  handleMouseUp() {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    this.isEditable = true;
    this.spawnHandles();
    this.vc.onCanvasMove.add(this.onCanvasMove);
  }

  /* ————————————————— phase 2: handle adjustment ——————————————— */

  isHandle(el) {
    return (
      this.handles && (el === this.handles.start || el === this.handles.end)
    );
  }

  spawnHandles() {
    const mk = ([x, y]) => {
      const d = document.createElement("div");
      d.className = "adjuster";
      this.placeHandle(d, [x, y]);
      d.onmousedown = (ev) => {
        ev.stopPropagation();
        this.draggingHandle = d;
      };
      this.vc.drawingarea.appendChild(d);
      return d;
    };
    this.handles = { start: mk(this.start), end: mk(this.end) };
    document.addEventListener("mouseup", () => {
      this.draggingHandle = null;
    });
  }

  adjustHandle(input) {
    const p = this.vc.positionInCanvas(input.x, input.y);
    if (this.draggingHandle === this.handles.start) this.start = p;
    else this.end = p;

    this.refreshPreview();
    this.updateHandlePositions();
  }

  updateHandlePositions() {
    if (!this.handles) return;
    this.placeHandle(this.handles.start, this.start);
    this.placeHandle(this.handles.end, this.end);
  }

  placeHandle(div, [x, y]) {
    const [sx, sy] = this.vc.positionInScreen(x, y);
    div.style.left = `${sx - 5}px`;
    div.style.top = `${sy - 5}px`;
  }

  /* ————————————————— phase 3: commit ————————————————————————— */

  commit() {
    if (!this.isEditable || !this.start || !this.end || !this.opId) return;

    this.handles.start.remove();
    this.handles.end.remove();
    this.vc.onCanvasMove.delete(this.onCanvasMove);
    this.handles = null;

    this.vc.clearPreview();
    this.drawLine(false);

    this.log.pushClient(
      straightLineTransaction(
        this.opId,
        this.curColor,
        this.brushsize.size,
        this.start,
        this.end
      )
    );

    this.tb.undo.pushOperation(this.opId);
    this.reset();
  }

  cancelEdit() {
    if (!this.isEditable) return;

    const draft = {
      start: [...this.start],
      end: [...this.end],
      color: [...this.curColor],
      size: this.lastBrushSize,
      colorSource: this.colorSource,
      opId: this.opId,
    };

    this.tb.undo.pushDraft(this, draft);
    this.discardDraft();
  }

  discardDraft() {
    // called by Undo.undo()
    if (!this.isEditable) return;
    this.vc.clearPreview();
    this.handles?.start.remove();
    this.handles?.end.remove();
    this.vc.onCanvasMove.delete(this.onCanvasMove);
    this.handles = null;
    this.reset(); // keeps opId so we can redo
  }

  restoreDraft(draft) {
    this.start = [...draft.start];
    this.end = [...draft.end];
    this.curColor = [...draft.color];
    this.lastBrushSize = draft.size;
    this.colorSource = draft.colorSource;
    this.opId = draft.opId;

    this.isEditable = true;
    this.spawnHandles();
    this.vc.onCanvasMove.add(this.onCanvasMove);
    this.refreshPreview();
  }

  /* ————————————————— drawing ————————————————————————— */

  drawLine(preview) {
    if (!this.start || !this.end) return;
    const pts = this.bresenham(
      this.start[0],
      this.start[1],
      this.end[0],
      this.end[1]
    );
    const size = this.brushsize.size;
    const offset = Math.floor(size / 2);

    const setPix = preview
      ? this.vc.setPreviewPixel.bind(this.vc)
      : this.vc.setPixel.bind(this.vc);

    pts.forEach(([cx, cy]) => {
      for (let dy = 0; dy < size; dy++)
        for (let dx = 0; dx < size; dx++) {
          const x = cx + dx - offset;
          const y = cy + dy - offset;
          setPix(x, y, this.curColor, 1); // thickness per pixel loop
        }
    });
  }

  bresenham(x1, y1, x2, y2) {
    const pts = [];
    const dx = Math.abs(x2 - x1),
      dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1,
      sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;
    while (true) {
      pts.push([x1, y1]);
      if (x1 === x2 && y1 === y2) break;
      const e2 = err << 1;
      if (e2 > -dy) {
        err -= dy;
        x1 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y1 += sy;
      }
    }
    return pts;
  }

  /* ————————————————— helpers ————————————————————————— */

  refreshPreview() {
    if (!this.isDrawing && !this.isEditable) return;
    this.vc.clearPreview();
    this.drawLine(true);
  }

  reset() {
    this.isDrawing = false;
    this.isEditable = false;
    this.start = this.end = null;
    this.opId = null;
    this.vc.onCanvasMove.delete(this.onCanvasMove);
    this.vc.clearPreview();
  }
}
