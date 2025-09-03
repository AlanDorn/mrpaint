/* StraightLine.js – preview-layer edition
   ------------------------------------------------------------
   Live strokes are drawn on VirtualCanvas.previewCanvas.  No pixels are
   committed to the main bitmap until the user finalizes, eliminating all
   cross-tool collision bugs.
*/
// gotta fix straightline adjusters when they are stacked, the middle takes priority over the others make it like a ham samich
// movable adjuster - middle adjuster - movable adjuster      if possible
import {
  operationId,
  straightLineTransaction,
  encodePreviewLine,
} from "./transaction.js";

export default class StraightLine {
  constructor(transactionLog, virtualCanvas, previewManager, toolbar) {
    this.transactionLog = transactionLog;
    this.virtualCanvas = virtualCanvas; // VirtualCanvas instance
    this.previewManager = previewManager;
    this.toolbar = toolbar;
    this.colorpicker = toolbar.colorpicker;
    this.brushsize = toolbar.brushsize;

    /* state flags */
    this.isDrawing = false; // user dragging first line
    this.isEditable = false; // handles visible

    this.movedEnough = false; //
    this.dragThreshold = 1;

    /* stroke state */
    this.start = null; // [x,y]
    this.end = null; // [x,y]

    this.OGstart = null;
    this.OGend = null;
    this.middle = null;

    this.opId = null;

    /* style caches for live polling */
    this.colorSource = "primary";
    this.curColor = [...this.colorpicker.primarycolor];
    this.lastBrushSize = this.brushsize.size;

    /* handle DOM */
    this.handles = null; // {start,end}
    this.draggingHandle = null;

    //https://dev.to/ferdunt/multiple-events-to-a-listener-with-javascript-2bj8
    ["primaryColorChange", "secondaryColorChange"].forEach((event) =>
      window.addEventListener(event, ({ detail: { rgb } }) => {
        this.curColor = [rgb];
        this.pollStyleChanges();
      })
    );

    window.addEventListener("brushSizeChange", ({ detail: { size } }) => {
      this.brushsize.size = size;
      this.pollStyleChanges();
    });

    this.onCanvasMove = () => {
      console.log("move")
      this.updateHandlePositions();
      this.refreshPreview();
    };

    this.onKeyDown = (e) => {
      // if (e.key === "Delete" && this.isEditable) this.cancelEdit();
    };
    document.addEventListener("keydown", this.onKeyDown);
  }

  mouseDownLeft = (e) => this.handleMouseDown(e, "primary");
  mouseDownRight = (e) => this.handleMouseDown(e, "secondary");
  mouseUpLeft = () => this.handleMouseUp();
  mouseUpRight = () => this.handleMouseUp();
  mouseMove = (e) => this.handleMouseMove(e);

  /* ————————————————— phase 1: initial drag ————————————————— */

  handleMouseDown(input, paletteKey) {
    if (this.isEditable && !this.isHandle(input.target)) {
      //2nd click commits
      this.commit();
      // return;
    }
    if (this.isDrawing || this.isEditable) return;

    this.movedEnough = false;
    this.isDrawing = true;
    this.colorSource = paletteKey;
    this.curColor = [...this.colorpicker[paletteKey + "color"]];
    this.lastBrushSize = this.brushsize.size;

    this.start = this.virtualCanvas.positionInCanvas(input.x, input.y);
    this.end = [...this.start];
    this.opId = operationId();
  }

  handleMouseUp() {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    if (!this.movedEnough) {
      // Click without drag: cancel; no line created.
      this.reset(); // clears preview & flags; opId discarded
      return;
    }
    // Legitimate drag: enter edit mode with handles
    this.isEditable = true;
    this.spawnHandles();
    this.virtualCanvas.onCanvasMove.add(this.onCanvasMove);

    const draft = {
      start: [...this.start],
      end: [...this.end],
      color: [...this.curColor],
      size: this.lastBrushSize,
      colorSource: this.colorSource,
      opId: this.opId, // temp id – may be replaced on commit
    };
    this.toolbar.undo.pushDraft(this, draft);
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
    if (sizeNow !== this.lastBrushSize || !this.colorsEqual(colNow, this.curColor)) {
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
    const p = this.virtualCanvas.positionInCanvas(input.x, input.y);
    this.end = p;
    const dx = p[0] - this.start[0];
    const dy = p[1] - this.start[1];
    const distSq = dx * dx + dy * dy;
    if (!this.movedEnough && distSq >= this.dragThreshold * this.dragThreshold) {
      this.movedEnough = true;

      // if (!this.isEditable) {    //this if is to spawn the handles ASAP but mspaint doesnt spawn ASAP, also noting that the preview shows the handles spawning ASAP which might be a consistency issue but shouldnt really matter too much imo -Alan
      //   this.isEditable = true;
      //   this.spawnHandles();
      //   this.virtualCanvas.onCanvasMove.add(this.onCanvasMove);
      // }
    }
    if (this.movedEnough) {
      this.virtualCanvas.clearPreview(this.virtualCanvas.selfPreviewCtx);
      this.drawPreview(); // preview

      this.previewManager.localPreview = encodePreviewLine({
        start: this.start,
        end: this.end,
        color: this.curColor,
        size: this.brushsize.size,
      });
    }
  }

  /* ————————————————— phase 2: handle adjustment ——————————————— */

  isHandle(el) {
    // return this.handles && (el === this.handles.start || el === this.handles.end);
    return (
      this.handles &&
      (el === this.handles.start ||
        el === this.handles.end ||
        el === this.handles.center)
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

        if (d === this.handles?.center) {
          // only for the centre box
          this.middle = this.virtualCanvas.positionInCanvas(ev.x, ev.y);
          this.OGstart = [...this.start];
          this.OGend = [...this.end];
        }
      };
      this.virtualCanvas.drawingarea.appendChild(d);
      return d;
    };
    this.handles = { start: mk(this.start), end: mk(this.end) };

    const mid = [
      (this.start[0] + this.end[0]) / 2,
      (this.start[1] + this.end[1]) / 2,
    ];
    this.handles.center = mk(mid); // CENTER BOX
    this.handles.center.classList.add("centerBox");

    document.addEventListener("mouseup", () => {
      this.draggingHandle = null;
      this.middle = this.OGstart = this.OGend = null;
    });
  }

  adjustHandle(input) {
    const p = this.virtualCanvas.positionInCanvas(input.x, input.y);
    if (this.draggingHandle === this.handles.start) {
      this.start = p;
    } else if (this.draggingHandle === this.handles.end) {
      this.end = p;
    } else if (this.draggingHandle === this.handles.center) {
      if (!this.middle) return; // safety
      const dx = p[0] - this.middle[0];
      const dy = p[1] - this.middle[1];
      this.start = [this.OGstart[0] + dx, this.OGstart[1] + dy];
      this.end = [this.OGend[0] + dx, this.OGend[1] + dy];
    }

    this.refreshPreview();
    this.updateHandlePositions();
  }

  updateHandlePositions() {
    if (!this.handles) return;
    this.placeHandle(this.handles.start, this.start);
    this.placeHandle(this.handles.end, this.end);

    const mid = [
      // CENTER BOX
      (this.start[0] + this.end[0]) / 2,
      (this.start[1] + this.end[1]) / 2,
    ];
    this.placeHandle(this.handles.center, mid);
  }

  placeHandle(div, [x, y]) {
    const [sx, sy] = this.virtualCanvas.positionInScreen(x, y);
    div.style.left = `${sx - 5}px`;
    div.style.top = `${sy - 5}px`;
  }

  /* ————————————————— phase 3: commit ————————————————————————— */

  commit() {
    if (!this.isEditable || !this.start || !this.end || !this.opId) return;

    const draft = {
      start: [...this.start],
      end: [...this.end],
      color: [...this.curColor],
      size: this.lastBrushSize,
      colorSource: this.colorSource,
      opId: this.opId,
    };

    this.handles.start?.remove();
    this.handles.end?.remove();
    this.handles.center?.remove();
    this.virtualCanvas.onCanvasMove.delete(this.onCanvasMove);
    this.handles = null;

    // wipe the ghost, then burn the line into the real bitmap
    // this.virtualCanvas.clearPreview(this.virtualCanvas.selfPreviewCtx);
    // this.virtualCanvas.clearPreview(this.virtualCanvas.otherPreviewCtx);

    this.transactionLog.pushClient(
      straightLineTransaction(
        this.opId,
        this.curColor,
        this.brushsize.size,
        this.start,
        this.end
      )
    );

    // this.toolbar.undo.replaceTopWithCommit(this.opId, this, draft);

    this.previewManager.localPreview = null;
    this.toolbar.presence?.clearLocalPreview?.(this.toolbar.presence.userId);

    this.reset();
  }

  // cancelEdit() {
  //   if (!this.isEditable) return;

  //   const draft = {
  //     start: [...this.start],
  //     end: [...this.end],
  //     color: [...this.curColor],
  //     size: this.brushsize.size,
  //     colorSource: this.colorSource,
  //     opId: this.opId,
  //   };

  //   this.toolbar.undo.pushDraft(this, draft);
  //   this.discardDraft();
  // }

  discardDraft() {
    // called by Undo.undo()
    if (!this.isEditable) return;
    this.virtualCanvas.clearPreview(this.virtualCanvas.selfPreviewCtx);
    this.handles?.start.remove();
    this.handles?.end.remove();
    this.handles?.center?.remove();
    this.virtualCanvas.onCanvasMove.delete(this.onCanvasMove);
    this.handles = null;

    this.previewManager.localPreview = null;
    this.reset(); // keeps opId so we can redo
  }

  restoreDraft(draft) {
    this.start = [...draft.start];
    this.end = [...draft.end];
    this.curColor = [...draft.color];
    this.lastBrushSize = draft.size;
    this.colorSource = draft.colorSource;
    this.opId = operationId();

    this.isEditable = true;
    this.spawnHandles();
    this.virtualCanvas.onCanvasMove.add(this.onCanvasMove);
    this.refreshPreview();
  }

  /* ————————————————— drawing ————————————————————————— */

  drawPreview() {
    this.previewManager.drawLineforSelf(this.virtualCanvas.selfPreviewCtx, {
      start: this.start,
      end: this.end,
      color: this.curColor,
      size: this.brushsize.size,
    });
  }

  /* ————————————————— helpers ————————————————————————— */

  refreshPreview() {
    if (!this.isDrawing && !this.isEditable) return;
    this.virtualCanvas.clearPreview(this.virtualCanvas.selfPreviewCtx);
    this.drawPreview();

    this.previewManager.localPreview = encodePreviewLine({
      start: this.start,
      end: this.end,
      color: this.curColor,
      size: this.brushsize.size,
    });
  }

  reset() {
    this.previewManager.localPreview = null;
    this.movedEnough = false;
    this.isDrawing = false;
    this.isEditable = false;
    this.start = this.end = null;
    this.opId = null;
    this.virtualCanvas.onCanvasMove.delete(this.onCanvasMove);
    this.virtualCanvas.clearPreview(this.virtualCanvas.selfPreviewCtx);
  }
}
