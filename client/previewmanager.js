import { decodePreviewLine } from "./transaction.js";
import { CROSSHAIR } from "./crosshair.js";

export default class PreviewManager {
  constructor(virtualCanvas) {
    this.virtualCanvas = virtualCanvas;

    this.userManager = null;
    this.size = null;

    this.remotePreviews = new Map(); // userId -> {start,end,size,color}
    this.localPreview = null; // straightLine writes here
    this.canvasRect = () => this.virtualCanvas.canvas.getBoundingClientRect();
    setInterval(() => this.gc(), 100);
  }

  attachUserManager(presenceUserManager) {
    this.userManager = presenceUserManager;
  }

  /* -------- receive from PresenceManager ---------- */
  handlePreviewLine(userId, payload) {
    const data = decodePreviewLine(payload);

    const old = this.remotePreviews.get(userId);
    if (old) this.removeHandles(old);

    // ✅ store the fresh preview
    this.remotePreviews.set(userId, { ...data, ts: performance.now() });
    this.redrawAll();
  }

  /* -------- send to PresenceManager ---------- */
  getPreviewData() {
    return this.localPreview ?? null; // PresenceManager will send only if not null
  }

  /* -------- drawing ---------- */

  redrawAll() {
    const ctx = this.virtualCanvas.otherPreviewCtx;
    this.virtualCanvas.clearPreview(ctx);

    // remote previews
    for (const [id, ghost] of this.remotePreviews) {
      this.drawLine(ctx, ghost);
      this.updateHandles(id, ghost);
    }
  }

  drawLineforSelf(ctx, { start, end, color, size }) {
    if (!start || !end) return;

    ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;

    // centre pixels from your in‑class Bresenham
    const pts = this.bresenham(start[0], start[1], end[0], end[1]);

    const half = Math.floor(size / 2); // same anchor as setPixel()

    for (const [cx, cy] of pts) {
      // draw the same square block that setPixel() will later draw
      ctx.fillRect(cx - half, cy - half, size, size);
    }
  }

  drawLine(ctx, { start, end, color, size }) {
    if (!start || !end) return;
    this.size = size;

    ctx.save();
    ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;

    /* ── 1️⃣  square‑block body (matches commit logic) ───────── */
    const pts = this.bresenham(start[0], start[1], end[0], end[1]);
    const half = Math.floor(size / 2);

    for (const [cx, cy] of pts) {
      ctx.fillRect(cx - half, cy - half, size, size);
    }

    ctx.fill();
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

  /* -------- cleanup ---------- */
  clearRemotePreview(userId) {
    const ghost = this.remotePreviews.get(userId);
    this.removeHandles(ghost);
    if (this.remotePreviews.delete(userId)) this.redrawAll();
  }

  placeHandle(div, [x, y], angle) {
    const [sx, sy] = this.virtualCanvas.positionInScreen(x, y);

    div.style.left = `${sx}px`;
    div.style.top = `${sy}px`;
    div.style.transform = `translate(-45%, -55%) rotate(${angle}rad)`; //translate(-7px, -8px) or translate(-45%, -55%)
  }

  /* create the two triangles once */
  spawnHandles(id, obj) {
    if (obj.handles) return; // already spawned

    const user = this.userManager.users.get(id);
    const idColor = user.color; //user ? user.color : "rgb(128, 128, 128)";
    const angle = Math.atan2(obj.end[1] - obj.start[1], obj.end[0] - obj.start[0]);

    const mk = (pt, ang) => {
      // const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      // svg.setAttribute("viewBox", CROSSHAIR.viewBox);
      // svg.setAttribute("width", 14 + (this.size/2)); //14 + this.size   //15
      // svg.setAttribute("height", 14 + (this.size/2)); //14 + this.size //15
      // svg.classList.add("adjuster");
      // svg.style.borderRadius = "50% 50%"

      // svg.innerHTML = CROSSHAIR.inner;
      // svg.style.color = idColor;

      // svg.querySelectorAll("rect").forEach((r) => {
      //   if (r.hasAttribute("fill")) {
      //     r.setAttribute("fill", idColor);
      //   }else{
      //     r.setAttribute("fill", idColor);
      //   }
      // });

      // this.placeHandle(svg, pt, ang);
      // this.virtualCanvas.drawingarea.appendChild(svg);
      // return svg;
      const previewAdjuster = document.createElement("div");
      previewAdjuster.classList.add("adjuster");
      previewAdjuster.style.setProperty("border-radius", "50% 50%");
      // previewAdjuster.style.setProperty("width", `${5 + this.size/3}px`);  //remove these two lines if no likey changing PREVIEW adjusters
      // previewAdjuster.style.setProperty("height", `${5 + this.size/3}px`); //remove these two lines if no likey changing PREVIEW adjusters
      previewAdjuster.style.setProperty("background-color", idColor);
      previewAdjuster.style.setProperty("pointer-events", "none");
      previewAdjuster.style.removeProperty("cursor");

      this.placeHandle(previewAdjuster, pt, ang);
      this.virtualCanvas.drawingarea.appendChild(previewAdjuster);
      return previewAdjuster;
    };

    obj.handles = {
      start: mk(obj.start, angle), // point backward
      end: mk(obj.end, angle), // point forward
    };
  }

  /* move + re‑orient every frame */
  updateHandles(id, obj) {
    if (!obj.handles) this.spawnHandles(id, obj);

    // const angle = Math.atan2(obj.end[1] - obj.start[1], obj.end[0] - obj.start[0]);

    // this.placeHandle(obj.handles.start, obj.start, angle + Math.PI );
    // this.placeHandle(obj.handles.end, obj.end, angle);
  }

  /* delete when preview vanishes */
  removeHandles(obj) {
    if (!obj?.handles) return;
    obj.handles.start.remove();
    obj.handles.end.remove();
    obj.handles = null;
  }

  /* ====== tighten up lifecycle for LOCAL preview ====== */

  /* keep one copy & auto‑cleanup on commit / cancel */
  set localPreview(val) {
    if (val === null && this._localPreview) this.removeHandles(this._localPreview);
    this._localPreview = val;
  }
  get localPreview() {
    return this._localPreview;
  }

  gc(maxAge = 150) {
    const now = performance.now();
    let dirty = false;

    for (const [id, preview] of this.remotePreviews) {
      if (now - preview.ts > maxAge) {
        this.removeHandles(preview);
        this.remotePreviews.delete(id);
        dirty = true;
      }
    }
    if (dirty) this.redrawAll();
  }
}
