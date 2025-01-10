import Viewport from "./viewport.js";

const white = [255, 255, 255];
export default class VirtualCanvas {
  constructor() {
    this.drawingarea = document.getElementById("drawingarea");
    this.canvas = document.getElementById("myCanvas");
    this.ctx = this.canvas.getContext("2d");

    this.virtualHeight = 200;
    this.virtualWidth = 350;
    this.pixelZoom = 4; // each pixel is represented by a 3x3 square, this improves clarity.
    this.zoomExp = 1;
    this.zoom = 2; // Default zoom level
    this.offset = [0, 0]; // Default offset [x, y]

    this.viewport = new Viewport(this);

    this.imageData = this.ctx.createImageData(
      this.virtualWidth * this.pixelZoom,
      this.virtualHeight * this.pixelZoom
    );

    this.virtualCanvas = Array.from({ length: this.virtualHeight }, () =>
      Array(this.virtualWidth).fill(white)
    );

    this.fillGeneration = [];
    window.addEventListener("resize", () => {
      this.resizeCanvasToWindow();
    });
    this.resizeCanvasToWindow();

    // Prepare an offscreen canvas
    this.offscreenCanvas = document.createElement("canvas");
    this.offscreenCanvas.width = this.virtualWidth * this.pixelZoom;
    this.offscreenCanvas.height = this.virtualHeight * this.pixelZoom;
    this.offscreenCtx = this.offscreenCanvas.getContext("2d");
  }

  render() {
    this.offscreenCtx.putImageData(this.imageData, 0, 0);

    // Apply zoom and offset transformations using drawImage
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

  setPixel(x, y, color) {
    if (x >= 0 && y >= 0 && x < this.virtualWidth && y < this.virtualHeight) {
      for (let ythick = 0; ythick < this.pixelZoom; ythick++) {
        for (let xthick = 0; xthick < this.pixelZoom; xthick++) {
          let index =
            ((y * this.pixelZoom + ythick) * this.imageData.width +
              x * this.pixelZoom +
              xthick) *
            4; 
          const data = this.imageData.data;
          data[index++] = color[0]; // Red
          data[index++] = color[1]; // Green
          data[index++] = color[2]; // Blue
          data[index] = 255; // Alpha
        }
      }
      this.virtualCanvas[y][x] = color;
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
      this.imageData = this.ctx.createImageData(
        this.virtualWidth,
        this.virtualHeight
      );
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
    const chunkSize = 512;
    this.fillGeneration = [];

    const totalChunks = Math.ceil(this.virtualHeight / chunkSize);
    for (let i = 0; i < totalChunks; i++) {
      const startY = i * chunkSize;
      const endY = Math.min(startY + chunkSize, this.virtualHeight);
      this.fillGeneration.push(() => {
        for (let y = startY; y < endY; y++) {
          for (let x = 0; x < this.virtualWidth; x++) {
            for (let ythick = 0; ythick < this.pixelZoom; ythick++) {
              for (let xthick = 0; xthick < this.pixelZoom; xthick++) {
                let newIndex =
                  ((y * this.pixelZoom + ythick) * this.imageData.width +
                    x * this.pixelZoom +
                    xthick) *
                  4; // Calculate pixel index
                const data = this.imageData.data;
                data[newIndex] = this.virtualCanvas[y][x][0]; // Red
                data[newIndex + 1] = this.virtualCanvas[y][x][1]; // Green
                data[newIndex + 2] = this.virtualCanvas[y][x][2]; // Blue
                data[newIndex + 3] = 255; // Alpha
              }
            }
          }
        }
      });
    }
  }

  reset() {
    const oldVirtualCanvas = this.virtualCanvas;
    this.virtualCanvas = Array.from({ length: this.canvas.height }, () =>
      Array(this.canvas.width).fill(white)
    );
    this.virtualWidth = this.canvas.width;
    this.virtualHeight = this.canvas.height;
    setTimeout(() => this.fillImageData());
    return oldVirtualCanvas;
  }

  set(newVirtualCanvas) {
    const oldVirtualCanvas = this.virtualCanvas;
    this.virtualCanvas = newVirtualCanvas;
    this.virtualWidth = this.virtualCanvas[0].length;
    this.virtualHeight = this.virtualCanvas.length;
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
