import { operationId, resizeTransaction } from "./transaction.js";

export default class Viewport {
  constructor(transactionLog, virtualCanvas, toolbar) {
    this.transactionLog = transactionLog;
    this.virtualCanvas = virtualCanvas;
    this.toolbar = toolbar;
    
    this.virtualCanvas.viewport = this; // AGI: TransactionRenderer doesn't have access to the toolbar, only the virtualCanvas. So since we need to set the position of the adjuster after we receive a resize transaction, viewport needs to be on the virtualCanvas so that setAdjuster can be called.
    

    this.widthAdjuster = document.createElement("div");
    this.heightAdjuster = document.createElement("div");
    this.bothAdjuster = document.createElement("div");
    this.middleMouseAdjuster = {};

    this.widthAdjuster.classList.add("adjuster");
    this.heightAdjuster.classList.add("adjuster");
    this.bothAdjuster.classList.add("adjuster");

    this.virtualCanvas.drawingarea.appendChild(this.widthAdjuster);
    this.virtualCanvas.drawingarea.appendChild(this.heightAdjuster);
    this.virtualCanvas.drawingarea.appendChild(this.bothAdjuster);

    this.startPosition = [0, 0];
    this.activeAdjuster = null;
    this.lastActiveTool = null;

    this.setAdjusters();
    this.notifyCanvasMove();
  }

  setAdjusters(width = null, height = null) {
    if (width == null || height == null) {
      width = this.virtualCanvas.width;
      height = this.virtualCanvas.height;
    }

    const screenSize = this.virtualCanvas.positionInScreen(width, height);

    const halfScreenSize = this.virtualCanvas.positionInScreen(
      width / 2,
      height / 2
    );

    this.widthAdjuster.style.left = `${screenSize[0]}px`;
    this.widthAdjuster.style.top = `${halfScreenSize[1] - 5}px`;

    this.heightAdjuster.style.left = `${halfScreenSize[0] - 5}px`;
    this.heightAdjuster.style.top = `${screenSize[1]}px`;

    this.bothAdjuster.style.left = `${screenSize[0]}px`;
    this.bothAdjuster.style.top = `${screenSize[1]}px`;
  }

  handleWheel(event) {
    if (event.deltaY < 0) {
      event.ctrlKey
        ? this.zoomIn(event) // If the user does both it does the scroll up
        : event.shiftKey
        ? this.scrollLeft(event)
        : this.scrollUp(event);
    } else if (event.deltaY > 0) {
      event.ctrlKey
        ? this.zoomOut(event)
        : event.shiftKey
        ? this.scrollRight(event)
        : this.scrollDown(event);
    }
  }

  scrollUp(event) {
    this.virtualCanvas.offset[1] =
      this.virtualCanvas.offset[1] + 16 * this.virtualCanvas.zoom;
    this.toolbar.statusbar.setMousePosition({
      x: event.clientX,
      y: event.clientY,
    });
    this.setAdjusters();
    this.notifyCanvasMove();
    this.toolbar.activeTool?.updateHandlePositions?.();
  }

  scrollDown(event) {
    this.virtualCanvas.offset[1] -= 16 * this.virtualCanvas.zoom;
    this.setAdjusters();
    this.notifyCanvasMove();
    this.toolbar.statusbar.setMousePosition({
      x: event.clientX,
      y: event.clientY,
    });
    this.toolbar.activeTool?.updateHandlePositions?.();
  }

  scrollLeft(event) {
    this.virtualCanvas.offset[0] =
      this.virtualCanvas.offset[0] + 16 * this.virtualCanvas.zoom;
    this.setAdjusters();
    this.notifyCanvasMove();
    this.toolbar.statusbar.setMousePosition({
      x: event.clientX,
      y: event.clientY,
    });
    this.toolbar.activeTool?.updateHandlePositions?.();
  }

  scrollRight(event) {
    this.virtualCanvas.offset[0] -= 16 * this.virtualCanvas.zoom;
    this.setAdjusters();
    this.notifyCanvasMove();
    this.toolbar.statusbar.setMousePosition({
      x: event.clientX,
      y: event.clientY,
    });
    this.toolbar.activeTool?.updateHandlePositions?.();
  }

  zoomIn(event) {
    const moustBefore = this.virtualCanvas.positionInCanvas(
      event.clientX,
      event.clientY
    );
    this.virtualCanvas.zoomExp += 1 / 8;
    this.virtualCanvas.zoom = 2 ** this.virtualCanvas.zoomExp;
    const mouseAfter = this.virtualCanvas.positionInCanvas(
      event.clientX,
      event.clientY
    );

    const delta = [
      Math.round((mouseAfter[0] - moustBefore[0]) * this.virtualCanvas.zoom),

      Math.round((mouseAfter[1] - moustBefore[1]) * this.virtualCanvas.zoom),
    ];
    this.virtualCanvas.offset[0] = this.virtualCanvas.offset[0] + delta[0];
    this.virtualCanvas.offset[1] = this.virtualCanvas.offset[1] + delta[1];
    this.setAdjusters();
    this.notifyCanvasMove();
    this.toolbar.activeTool?.updateHandlePositions?.();
    this.toolbar.statusbar.setZoomPower(this.virtualCanvas.zoom);
  }

  zoomOut(event) {
    const moustBefore = this.virtualCanvas.positionInCanvas(
      event.clientX,
      event.clientY
    );
    this.virtualCanvas.zoomExp -= 1 / 8;
    this.virtualCanvas.zoom = 2 ** this.virtualCanvas.zoomExp;
    const mouseAfter = this.virtualCanvas.positionInCanvas(
      event.clientX,
      event.clientY
    );

    const delta = [
      Math.round((mouseAfter[0] - moustBefore[0]) * this.virtualCanvas.zoom),

      Math.round((mouseAfter[1] - moustBefore[1]) * this.virtualCanvas.zoom),
    ];
    this.virtualCanvas.offset[0] = this.virtualCanvas.offset[0] + delta[0];
    this.virtualCanvas.offset[1] = this.virtualCanvas.offset[1] + delta[1];
    this.setAdjusters();
    this.notifyCanvasMove();
    this.toolbar.activeTool?.updateHandlePositions?.();
    this.toolbar.statusbar.setZoomPower(this.virtualCanvas.zoom);
  }

  mouseUpLeft(input) {
    const positionInCanvas = this.virtualCanvas.positionInCanvas(
      input.x,
      input.y
    );
    const id = operationId();
    this.toolbar.undo.pushOperation(id);
    switch (this.activeAdjuster) {
      case this.widthAdjuster:
        this.transactionLog.pushClient(
          resizeTransaction(id, [
            Math.max(1, positionInCanvas[0]),
            this.virtualCanvas.height,
          ])
        );
        break;
      case this.heightAdjuster:
        this.transactionLog.pushClient(
          resizeTransaction(id, [
            this.virtualCanvas.width,
            Math.max(1, positionInCanvas[1]),
          ])
        );
        break;
      case this.bothAdjuster:
        this.transactionLog.pushClient(
          resizeTransaction(id, [
            Math.max(1, positionInCanvas[0]),
            Math.max(1, positionInCanvas[1]),
          ])
        );
        break;
    }

    this.toolbar.activeTool = this.lastActiveTool;
  }

  mouseMove(input) {
    const positionInCanvas = this.virtualCanvas.positionInCanvas(
      input.x,
      input.y
    );
    switch (this.activeAdjuster) {
      case this.widthAdjuster:
        this.setAdjusters(
          Math.max(1, positionInCanvas[0]),
          this.virtualCanvas.height
        );
        this.notifyCanvasMove();
        break;
      case this.heightAdjuster:
        this.setAdjusters(
          this.virtualCanvas.width,
          Math.max(1, positionInCanvas[1])
        );
        this.notifyCanvasMove();
        break;
      case this.bothAdjuster:
        this.setAdjusters(
          Math.max(1, positionInCanvas[0]),
          Math.max(1, positionInCanvas[1])
        );
        this.notifyCanvasMove();
        break;
      case this.middleMouseAdjuster:
        const startInCanvas = this.virtualCanvas.positionInCanvas(
          ...this.startPosition
        );
        const currentInCanvas = this.virtualCanvas.positionInCanvas(
          input.x,
          input.y
        );
        const delta = [
          Math.round(
            (currentInCanvas[0] - startInCanvas[0]) * this.virtualCanvas.zoom
          ),
          Math.round(
            (currentInCanvas[1] - startInCanvas[1]) * this.virtualCanvas.zoom
          ),
        ];
        this.virtualCanvas.offset[0] = this.virtualCanvas.offset[0] + delta[0];
        this.virtualCanvas.offset[1] = this.virtualCanvas.offset[1] + delta[1];
        this.startPosition = [input.x, input.y];
        this.setAdjusters();
        this.notifyCanvasMove();
        this.toolbar.activeTool?.updateHandlePositions?.();
        break;
    }
  }

  notifyCanvasMove() {
    // call everybody that asked to be kept in sync
    this.virtualCanvas?.onCanvasMove?.forEach((cb) => {
      if (typeof cb === "function") cb();
    });
  }

  // Blank functions are here because this class pretends to be a tool from the toolbar.
  mouseUpRight() {}

  mouseDownLeft() {}

  mouseDownRight() {}
}
