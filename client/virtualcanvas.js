const START_HEIGHT = 540;
const START_WIDTH = 960;

const CHUNK_SIZE_POWER = 7;
const CHUNK_SIZE = 2 ** CHUNK_SIZE_POWER;
const MAX_CHUNK_POWER = 15 - CHUNK_SIZE_POWER;

export default class VirtualCanvas {
  constructor() {
    this.CHUNK_SIZE_POWER = CHUNK_SIZE_POWER;
    this.CHUNK_SIZE = CHUNK_SIZE;
    this.MAX_CHUNK_POWER = MAX_CHUNK_POWER;
    this.START_HEIGHT = START_HEIGHT;
    this.START_WIDTH = START_WIDTH;

    this.height = START_HEIGHT;
    this.width = START_WIDTH;
    this.zoomExp = 0;
    this.zoom = 1; // Default zoom level
    this.offset = [0, 0]; // Default offset [x, y]

    this.drawingarea = document.getElementById("drawingarea");
    this.rect = this.drawingarea.getBoundingClientRect();
    this.offscreenCanvas = new OffscreenCanvas(this.width, this.height);
    this.offscreenCtx = this.offscreenCanvas.getContext("2d", {
      alpha: false,
    });
    this.offscreenCtx.fillStyle = "white";
    this.offscreenCtx.fillRect(0, 0, this.width, this.height);

    this.canvas = document.getElementById("myCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.setCanvasSize();
    window.addEventListener("resize", () => this.setCanvasSize());

    this.previewCanvas = document.createElement("canvas");
    this.previewCanvas.width = this.offscreenCanvas.width;
    this.previewCanvas.height = this.offscreenCanvas.height;
    this.previewCtx = this.previewCanvas.getContext("2d");

    this.onCanvasMove = new Set();
  }

  render() {
    const renderLowRez = this.zoom <= 1;
    this.ctx.imageSmoothingEnabled = renderLowRez;
    this.ctx.mozImageSmoothingEnabled = renderLowRez;
    this.ctx.webkitImageSmoothingEnabled = renderLowRez;
    this.ctx.msImageSmoothingEnabled = renderLowRez;

    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

    // committed bitmap
    this.ctx.drawImage(
      this.offscreenCanvas,
      0,
      0,
      this.width,
      this.height,
      Math.floor(this.offset[0]),
      Math.floor(this.offset[1]),
      Math.ceil(this.width * this.zoom),
      Math.ceil(this.height * this.zoom)
    );

    //preview canvas
    this.ctx.drawImage(
      this.previewCanvas,
      0,
      0,
      this.previewCanvas.width,
      this.previewCanvas.height,
      Math.floor(this.offset[0]),
      Math.floor(this.offset[1]),
      Math.ceil(this.width * this.zoom),
      Math.ceil(this.height * this.zoom)
    );
  }

  setPixel = (x, y, color, thickness) => {
    const halfThickness = Math.floor(thickness / 2);
    this.offscreenCtx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 1)`;
    this.offscreenCtx.fillRect(
      x - halfThickness,
      y - halfThickness,
      thickness,
      thickness
    );
  };

  setPixelOutline = (x, y, color, thickness) => {
    const halfThickness = Math.floor(thickness / 2);
    this.offscreenCtx.strokeStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 1)`;
    this.offscreenCtx.lineWidth = 1;
    this.offscreenCtx.strokeRect(
      x - halfThickness + 1 / 2,
      y - halfThickness + 1 / 2,
      thickness - 1,
      thickness - 1
    );
  };

  setSize(width, height, forcePrint = false) {
    const heightChanged = height !== this.height;
    this.height = height;
    const widthChanged = width !== this.width;
    this.width = width;

    if (heightChanged || widthChanged || forcePrint) {
      const temp = new OffscreenCanvas(this.width, this.height);
      this.offscreenCtx = temp.getContext("2d");
      this.offscreenCtx.fillStyle = "white"; // this will be a parameter
      this.offscreenCtx.fillRect(0, 0, this.width, this.height);
      this.offscreenCtx.drawImage(this.offscreenCanvas, 0, 0);
      this.offscreenCanvas = temp;
      this.resizePreviewCanvas(this.previewCanvas, this.offscreenCanvas);
    }

    this.onCanvasMove.forEach((cb) => {
      //when SL (straight Line) is in preview mode, and canvas is adjusted, keeps SL preview shown on instead of disappearing
      if (typeof cb === "function") cb();
    });
  }

  reset() {
    this.width = START_WIDTH;
    this.height = START_HEIGHT;
    this.offscreenCanvas.width = this.width;
    this.offscreenCanvas.height = this.height;
    this.offscreenCtx.fillStyle = "white";
    this.offscreenCtx.fillRect(0, 0, this.width, this.height);
    this.setSize(this.width, this.height, true);
  }

  getBoundsInCanvas() {
    const topLeftInCanvas = this.positionInCanvasFloat(
      this.rect.left,
      this.rect.top
    );
    const bottomRightInCanvas = this.positionInCanvasFloat(
      this.rect.right,
      this.rect.bottom
    );
    return [topLeftInCanvas, bottomRightInCanvas];
  }

  positionInCanvas(clientX, clientY) {
    const x = Math.round(
      (clientX - this.rect.left - this.offset[0]) / this.zoom - 0.5
    );
    const y = Math.round(
      (clientY - this.rect.top - this.offset[1]) / this.zoom - 0.5
    );
    return [x, y];
  }

  positionInCanvasFloat(clientX, clientY) {
    const x = (clientX - this.rect.left - this.offset[0]) / this.zoom - 0.5;
    const y = (clientY - this.rect.top - this.offset[1]) / this.zoom - 0.5;
    return [x, y];
  }

  positionInScreen(x, y) {
    const clientX = (x + 0.5) * this.zoom + this.offset[0] + this.rect.left;
    const clientY = (y + 0.5) * this.zoom + this.offset[1] + this.rect.top;
    return [clientX, clientY];
  }

  setCanvasSize() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    this.debounceTimer = setTimeout(() => {
      this.rect = this.drawingarea.getBoundingClientRect();
      this.canvas.width = this.rect.width;
      this.canvas.height = this.rect.height;
      this.render();
    }, 50);
  }

  // TODO: promote to class + other layers
  clearPreview() {
    this.previewCtx.clearRect(
      0,
      0,
      this.previewCanvas.width,
      this.previewCanvas.height
    );
  }

  setPreviewPixel(x, y, color, thickness) {
    if (thickness === 1) {
      this.previewCtx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},1)`;
      this.previewCtx.fillRect(x, y, thickness, thickness);
      return;
    }
    const half = Math.floor(thickness / 2);
    this.previewCtx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},1)`;
    this.previewCtx.fillRect(x - half, y - half, thickness, thickness);
  }

  resizePreviewCanvas(previewCanvas, offscreenCanvas) {
    previewCanvas.width = offscreenCanvas.width;
    previewCanvas.height = offscreenCanvas.height;
  }
}
