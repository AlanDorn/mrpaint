const white = [255, 255, 255];
export default class VirtualCanvas {
  constructor() {
    this.height = 500;
    this.width = 700;
    this.pixelZoom = 2; // each pixel is represented by a nxn square, this improves clarity. Use an even number or else you get a fill glitch.
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
    this.offscreenCanvas.width = this.width * this.pixelZoom;
    this.offscreenCanvas.height = this.height * this.pixelZoom;
    this.offscreenCtx = this.offscreenCanvas.getContext("2d");
    this.fillImageData();

    this.canvas = document.getElementById("myCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.setCanvasSize();
    window.addEventListener("resize", () => this.setCanvasSize());
  }

  render() {
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

    this.ctx.drawImage(
      this.offscreenCanvas, // Source
      0,
      0,
      this.width * this.pixelZoom,
      this.height * this.pixelZoom, // Source rectangle
      this.offset[0],
      this.offset[1],
      Math.ceil(this.width * this.zoom),
      Math.ceil(this.height * this.zoom) // Destination rectangle
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
      this.offscreenCtx.fillRect(
        x * this.pixelZoom,
        y * this.pixelZoom,
        this.pixelZoom * thickness,
        this.pixelZoom * thickness
      );
      this.virtualCanvas[y][x] = color;
      return;
    }

    const halfThickness = Math.floor(thickness / 2);
    this.offscreenCtx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 1)`;
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
        if (newX >= 0 && newY >= 0 && newX < this.width && newY < this.height) 
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
      this.offscreenCanvas.width = this.width * this.pixelZoom;
      this.offscreenCanvas.height = this.height * this.pixelZoom;
      this.fillImageData();
      while (this.fillGeneration.length > 0) this.fill();
    }

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
          const width = (endX - startX) * this.pixelZoom;
          const height = (endY - startY) * this.pixelZoom;
          const imageData = this.offscreenCtx.createImageData(width, height);
          const data = imageData.data;

          for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
              const [r, g, b] = this.virtualCanvas[y][x];

              // Fill the zoomed-in pixels for the current chunk
              for (let zoomY = 0; zoomY < this.pixelZoom; zoomY++) {
                const rowStart =
                  ((y - startY) * this.pixelZoom + zoomY) * width * 4;
                for (let zoomX = 0; zoomX < this.pixelZoom; zoomX++) {
                  const colOffset = (x - startX) * this.pixelZoom + zoomX;
                  const index = rowStart + colOffset * 4;

                  data[index] = r; // Red
                  data[index + 1] = g; // Green
                  data[index + 2] = b; // Blue
                  data[index + 3] = 255; // Alpha
                }
              }
            }
          }

          this.offscreenCtx.putImageData(
            imageData,
            startX * this.pixelZoom,
            startY * this.pixelZoom
          );
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
      this.offscreenCanvas.width = newVirtualCanvas[0].length * this.pixelZoom;
      this.offscreenCanvas.height = newVirtualCanvas.length * this.pixelZoom;
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
}
