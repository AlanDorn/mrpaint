const white = [255, 255, 255];
export default class VirtualCanvas {
  constructor() {
    this.height = 500;
    this.width = 700;
    this.zoomExp = 0;
    this.zoom = 1; // Default zoom level
    this.offset = [0, 0]; // Default offset [x, y]
    this.fillGeneration = [];

    this.virtualCanvas = Array.from({ length: this.height }, () =>
      Array(this.width).fill(white)
    );

    this.drawingarea = document.getElementById("drawingarea");
    this.rect = this.drawingarea.getBoundingClientRect();
    this.offscreenCanvas = document.createElement("canvas");
    this.offscreenCanvas.width = this.width;
    this.offscreenCanvas.height = this.height;
    this.offscreenCtx = this.offscreenCanvas.getContext("2d");
    this.fillImageData();

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
    const renderLowRez = this.zoom <= -2;
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
      this.offset[0],
      this.offset[1],
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
      this.offset[0],
      this.offset[1],
      Math.ceil(this.width * this.zoom),
      Math.ceil(this.height * this.zoom)
    );
  }

  fill() {
    if (this.fillGeneration.length > 0) this.fillGeneration.pop()();
  }

  setPixel(x, y, color, thickness) {
    if (
      thickness === 1 &&
      x >= 0 &&
      y >= 0 &&
      x < this.width &&
      y < this.height
    ) {
      this.offscreenCtx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 1)`;
      this.offscreenCtx.fillRect(x, y, thickness, thickness);
      this.virtualCanvas[y][x] = color;
      return;
    }

    const halfThickness = Math.floor(thickness / 2);
    this.offscreenCtx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 1)`;
    this.offscreenCtx.fillRect(
      x - halfThickness,
      y - halfThickness,
      thickness,
      thickness
    );

    for (let dy = 0; dy < thickness; dy++) {
      for (let dx = 0; dx < thickness; dx++) {
        const newX = x - halfThickness + dx;
        const newY = y - halfThickness + dy;
        if (newX >= 0 && newY >= 0 && newX < this.width && newY < this.height)
          this.virtualCanvas[newY][newX] = color;
      }
    }
  }

  setPixelOutline(x, y, color, thickness) {
    const halfThickness = Math.floor(thickness / 2);

    this.offscreenCtx.strokeStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 1)`;
    this.offscreenCtx.lineWidth = 1;

    this.offscreenCtx.strokeRect(
      x - halfThickness + 1 / 2,
      y - halfThickness + 1 / 2,
      thickness - 1,
      thickness - 1
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
          newX < this.width &&
          newY < this.height
        )
          this.virtualCanvas[newY][newX] = color;
      }
    }
  }

  setSize(width, height, forcePrint = false) {
    const heightChanged = height !== this.height;
    if (heightChanged)
      if (height > this.height)
        for (let index = 0; index < height - this.height; index++)
          this.virtualCanvas.push(Array(this.width).fill(white));
      else this.virtualCanvas.length = height;

    this.height = height;

    const widthChanged = width !== this.width;
    if (widthChanged)
      if (width > this.width)
        for (let index = 0; index < this.height; index++)
          this.virtualCanvas[index].push(
            ...Array(width - this.width).fill(white)
          );
      else
        for (let index = 0; index < this.height; index++)
          this.virtualCanvas[index].length = width;

    this.width = width;

    if (heightChanged || widthChanged || forcePrint) {
      this.offscreenCanvas.width = this.width;
      this.offscreenCanvas.height = this.height;
      this.resizePreviewCanvas(this.previewCanvas, this.offscreenCanvas);

      this.fillImageData();
      while (this.fillGeneration.length > 0) this.fill();
    }

    this.onCanvasMove.forEach((cb) => {
      //when SL (straight Line) is in preview mode, and canvas is adjusted, keeps SL preview shown on instead of disappearing
      if (typeof cb === "function") cb();
    });

    this.viewport.setAdjusters();
    this.statusbar.setCanvasSize();
  }

  fillImageData() {
    const widthChunkSize = Math.floor(this.width / Math.ceil(this.width / 256)); // Size of each square chunk
    const heightChunkSize = Math.floor(
      this.height / Math.ceil(this.height / 256)
    );
    this.fillGeneration = [];

    const horizontalChunks = Math.ceil(this.width / widthChunkSize);
    const verticalChunks = Math.ceil(this.height / heightChunkSize);

    for (let chunkY = 0; chunkY < verticalChunks; chunkY++) {
      for (let chunkX = 0; chunkX < horizontalChunks; chunkX++) {
        const startX = chunkX * widthChunkSize;
        const startY = chunkY * heightChunkSize;
        const endX = Math.min(startX + widthChunkSize, this.width);
        const endY = Math.min(startY + heightChunkSize, this.height);

        this.fillGeneration.push(() => {
          const width = endX - startX;
          const height = endY - startY;
          const imageData = this.offscreenCtx.createImageData(width, height);
          const data = imageData.data;

          for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
              const [r, g, b] = this.virtualCanvas[y][x];

              // Fill the zoomed-in pixels for the current chunk
              const rowStart = (y - startY) * width * 4;
              const colOffset = x - startX;
              const index = rowStart + colOffset * 4;

              data[index] = r; // Red
              data[index + 1] = g; // Green
              data[index + 2] = b; // Blue
              data[index + 3] = 255; // Alpha
            }
          }

          this.offscreenCtx.putImageData(imageData, startX, startY);
        });
      }
    }
  }

  reset() {
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++) this.virtualCanvas[y][x] = white;
    this.setSize(700, 500, true);
  }

  set(newVirtualCanvas) {
    if (
      this.height !== newVirtualCanvas.length ||
      this.width !== newVirtualCanvas[0].length
    ) {
      this.offscreenCanvas.width = newVirtualCanvas[0].length;
      this.offscreenCanvas.height = newVirtualCanvas.length;

      this.resizePreviewCanvas(this.previewCanvas, this.offscreenCanvas);
    }

    const oldVirtualCanvas = this.virtualCanvas;
    this.virtualCanvas = newVirtualCanvas;
    this.width = this.virtualCanvas[0].length;
    this.height = this.virtualCanvas.length;

    this.fillImageData();
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
        for (let x = 0; x < rowLength; x++) newRow[x] = srcRow[x];
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
      for (let x = 0; x < rowLength; x++) targetRow[x] = srcRow[x];
    }
    return recycledSnapshot;
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

  positionInScreen(x, y) {
    const clientX = (x + 0.5) * this.zoom + this.offset[0] + this.rect.left;
    const clientY = (y + 0.5) * this.zoom + this.offset[1] + this.rect.top;
    return [clientX, clientY];
  }

  centerOfScreenInCanvas() {
    return this.positionInCanvas(
      this.rect.width / 2 + this.rect.left,
      this.rect.height / 2 + this.rect.top
    );
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

  getPixelColor(x, y) {
    if (x >= 0 && y >= 0 && x < this.width && y < this.height) {
      const color = this.virtualCanvas[y][x];
      return [color[0], color[1], color[2]];
    } else return white;
  }

  checkPixelColor(x, y, color) {
    if (x >= 0 && y >= 0 && x < this.width && y < this.height) {
      const canvasColor = this.virtualCanvas[y][x];
      return (
        color[0] === canvasColor[0] &&
        color[1] === canvasColor[1] &&
        color[2] === canvasColor[2]
      );
    } else return false;
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
