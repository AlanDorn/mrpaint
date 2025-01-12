import Viewport from "./viewport.js";

const white = [255, 255, 255];
export default class VirtualCanvas {
  constructor() {
    this.virtualHeight = 300;
    this.virtualWidth = 500;
    this.pixelZoom = 16; // each pixel is represented by a nxn square, this improves clarity.
    this.zoomExp = 1;
    this.zoom = 2; // Default zoom level
    this.offset = [0, 0]; // Default offset [x, y]
    this.fillGeneration = [];

    this.viewport = new Viewport(this);

    this.virtualCanvas = Array.from({ length: this.virtualHeight }, () =>
      Array(this.virtualWidth).fill(white)
    );

    this.drawingarea = document.getElementById("drawingarea");
    this.canvas = document.getElementById("myCanvas");
    this.ctx = this.canvas.getContext("2d");

    // Prepare an offscreen canvas
    this.offscreenCanvas = document.createElement("canvas");
    this.offscreenCanvas.width = this.virtualWidth * this.pixelZoom;
    this.offscreenCanvas.height = this.virtualHeight * this.pixelZoom;
    this.offscreenCtx = this.offscreenCanvas.getContext("2d");

    window.addEventListener("resize", () => {
      this.resizeCanvasToWindow();
    });
    this.resizeCanvasToWindow();
  }

  render() {
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

    this.ctx.drawImage(
      this.offscreenCanvas, // Source
      0,
      0,
      this.virtualWidth * this.pixelZoom,
      this.virtualHeight * this.pixelZoom, // Source rectangle
      this.offset[0],
      this.offset[1],
      this.virtualWidth * this.zoom,
      this.virtualHeight * this.zoom // Destination rectangle
    );
  }
  fill() {
    if (this.fillGeneration.length !== 0) this.fillGeneration.pop()();
  }

  setPixel(x, y, color, thickness) {
    const halfThickness = Math.floor(thickness / 2);
    this.offscreenCtx.fillStyle = `rgba(${color[1]}, ${color[1]}, ${color[2]}, 1)`;
    this.offscreenCtx.fillRect(
      (x - halfThickness) * this.pixelZoom,
      (y - halfThickness) * this.pixelZoom,
      this.pixelZoom * thickness,
      this.pixelZoom * thickness
    );

    for (let dy = 0; dy < thickness; dy++) {
      for (let dx = 0; dx < thickness; dx++) {
        const newX = x - halfThickness + dx;
        const newY = y - halfThickness + dy;
        if (
          newX >= 0 &&
          newY >= 0 &&
          newX < this.virtualWidth &&
          newY < this.virtualHeight
        )
          this.virtualCanvas[newY][newX] = color;
      }
    }
  }

  setPixelOutline(x, y, color, thickness) {
    const halfThickness = Math.floor(thickness / 2);
    const halfPixelZoom = Math.floor(this.pixelZoom / 2);

    this.offscreenCtx.strokeStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 1)`;
    this.offscreenCtx.lineWidth = this.pixelZoom;

    this.offscreenCtx.strokeRect(
      (x - halfThickness) * this.pixelZoom + halfPixelZoom,
      (y - halfThickness) * this.pixelZoom + halfPixelZoom,
      this.pixelZoom * thickness - this.pixelZoom,
      this.pixelZoom * thickness - this.pixelZoom
    );

    for (let dy = 0; dy < thickness; dy++) {
      for (let dx = 0; dx < thickness; dx++) {
        const newX = x - halfThickness + dx;
        const newY = y - halfThickness + dy;
        if (
          (dx === 0 ||
            dy === 0 ||
            dx === thickness - 1 ||
            dy === thickness - 1) &&
          newX >= 0 &&
          newY >= 0 &&
          newX < this.virtualWidth &&
          newY < this.virtualHeight
        )
          this.virtualCanvas[newY][newX] = color;
      }
    }
  }

  setSize(width, height) {
    if (height !== this.virtualHeight)
      if (height > this.virtualHeight)
        for (let index = 0; index < height - this.virtualCanvas; index++)
          this.virtualCanvas.push(Array(this.virtualWidth).fill(white));
      else this.virtualCanvas.length = height;

    if (width !== this.virtualWidth)
      if (width > this.virtualWidth)
        for (let index = 0; index < this.virtualCanvas.length; index++)
          this.virtualCanvas[index].push(
            ...Array(width - this.virtualWidth).fill(white)
          );
      else
        for (let index = 0; index < this.virtualCanvas.length; index++)
          this.virtualCanvas[index].length = width;

    this.virtualWidth = width;
    this.virtualHeight = height;

    if (height !== this.virtualHeight || width !== this.virtualWidth) {
      this.offscreenCanvas.width = this.virtualWidth * this.pixelZoom;
      this.offscreenCanvas.height = this.virtualHeight * this.pixelZoom;
      this.fillImageData();
    }
  }

  resizeCanvasToWindow() {
    const rect = this.drawingarea.getBoundingClientRect();
    this.canvas.width = Math.min(
      rect.width,
      this.virtualWidth * this.zoom * this.pixelZoom
    );
    this.canvas.height = Math.min(
      rect.height,
      this.virtualHeight * this.zoom * this.pixelZoom
    );
    this.fillImageData();
  }

  fillImageData() {
    const chunkSize = 1000;
    this.fillGeneration = [];

    const totalChunks = Math.ceil(this.virtualHeight / chunkSize);
    for (let i = 0; i < totalChunks; i++) {
      const startY = i * chunkSize;
      const endY = Math.min(startY + chunkSize, this.virtualHeight);
      this.fillGeneration.push(() => {
        for (let y = startY; y < endY; y++) {
          for (let x = 0; x < this.virtualWidth; x++) {
            this.offscreenCtx.fillStyle = `rgba(${this.virtualCanvas[y][x][0]}, ${this.virtualCanvas[y][x][1]}, ${this.virtualCanvas[y][x][2]}, 1)`;
            this.offscreenCtx.fillRect(
              x * this.pixelZoom,
              y * this.pixelZoom,
              this.pixelZoom,
              this.pixelZoom
            );
          }
        }
      });
    }
  }

  reset() {
    const oldVirtualCanvas = this.virtualCanvas;
    this.virtualCanvas = Array.from({ length: this.virtualHeight }, () =>
      Array(this.virtualWidth).fill(white)
    );
    setTimeout(() => this.fillImageData());
    return oldVirtualCanvas;
  }

  set(newVirtualCanvas) {
    const oldVirtualCanvas = this.virtualCanvas;
    this.virtualCanvas = newVirtualCanvas;
    this.virtualWidth = this.virtualCanvas[0].length;
    this.virtualHeight = this.virtualCanvas.length;
    //CALM: something here is supposed to set the canvas size, for now the size is static
    setTimeout(() => this.fillImageData());
    return oldVirtualCanvas;
  }

  cloneCanvas(recycledSnapshot = null) {
    const srcHeight = this.virtualCanvas.length;

    if (!recycledSnapshot) {
      // Create a fresh clone
      const clone = new Array(srcHeight);
      for (let y = 0; y < srcHeight; y++) {
        const srcRow = this.virtualCanvas[y];
        const rowLength = srcRow.length;
        const newRow = new Array(rowLength);
        for (let x = 0; x < rowLength; x++) {
          newRow[x] = srcRow[x];
        }
        clone[y] = newRow;
      }
      return clone;
    }

    // Reuse existing snapshot arrays if possible
    recycledSnapshot.length = srcHeight;
    for (let y = 0; y < srcHeight; y++) {
      const srcRow = this.virtualCanvas[y];
      const rowLength = srcRow.length;
      let targetRow = recycledSnapshot[y];

      if (!targetRow || targetRow.length !== rowLength) {
        targetRow = new Array(rowLength);
        recycledSnapshot[y] = targetRow;
      }

      for (let x = 0; x < rowLength; x++) {
        targetRow[x] = srcRow[x];
      }
    }
    return recycledSnapshot;
  }

  positionInCanvas(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.round((clientX - rect.left - this.offset[0]) / this.zoom);
    const y = Math.round((clientY - rect.top - this.offset[1]) / this.zoom);
    return [x, y];
  }
}
