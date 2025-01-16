const white = [255, 255, 255];
export default class VirtualCanvas {
  constructor() {
    this.virtualHeight = 500;
    this.virtualWidth = 700;
    this.pixelZoom = 2; // each pixel is represented by a nxn square, this improves clarity.
    this.zoomExp = 0;
    this.zoom = 1; // Default zoom level
    this.offset = [0, 0]; // Default offset [x, y]
    this.fillGeneration = [];

    this.virtualCanvas = Array.from({ length: this.virtualHeight }, () =>
      Array(this.virtualWidth).fill(white)
    );

    this.drawingarea = document.getElementById("drawingarea");
    this.offscreenCanvas = document.createElement("canvas");
    this.offscreenCanvas.width = this.virtualWidth * this.pixelZoom;
    this.offscreenCanvas.height = this.virtualHeight * this.pixelZoom;
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
    if (
      thickness === 1 &&
      x >= 0 &&
      y >= 0 &&
      x < this.virtualWidth &&
      y < this.virtualHeight
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

    const heightChanged = height !== this.virtualHeight
    if (heightChanged)
      if (height > this.virtualHeight)
        for (let index = 0; index < height - this.virtualHeight; index++)
          this.virtualCanvas.push(Array(this.virtualWidth).fill(white));
      else this.virtualCanvas.length = height;

    this.virtualHeight = height;

    const widthChanged = width !== this.virtualWidth;
    if (widthChanged)
      if (width > this.virtualWidth)
        for (let index = 0; index < this.virtualHeight; index++)
          this.virtualCanvas[index].push(
            ...Array(width - this.virtualWidth).fill(white)
          );
      else
        for (let index = 0; index < this.virtualHeight; index++)
          this.virtualCanvas[index].length = width;

    this.virtualWidth = width;

    if (heightChanged || widthChanged) {
      this.offscreenCanvas.width = this.virtualWidth * this.pixelZoom;
      this.offscreenCanvas.height = this.virtualHeight * this.pixelZoom;
      this.fillImageData();
    }
  }

  fillImageData() {
    const chunkSize = 5000;
    this.fillGeneration = [];

    const totalChunks = Math.ceil(this.virtualHeight / chunkSize);
    for (let i = 0; i < totalChunks; i++) {
      const startY = i * chunkSize;
      const endY = Math.min(startY + chunkSize, this.virtualHeight);

      this.fillGeneration.push(() => {
        const width = this.virtualWidth * this.pixelZoom;
        const height = (endY - startY) * this.pixelZoom;
        const imageData = this.offscreenCtx.createImageData(width, height);
        const data = imageData.data;

        for (let y = startY; y < endY; y++) {
          for (let x = 0; x < this.virtualWidth; x++) {
            const [r, g, b] = this.virtualCanvas[y][x];

            // Calculate starting index for the top-left corner of the zoomed pixel
            for (let zoomY = 0; zoomY < this.pixelZoom; zoomY++) {
              const rowStart =
                ((y - startY) * this.pixelZoom + zoomY) * width * 4;
              for (let zoomX = 0; zoomX < this.pixelZoom; zoomX++) {
                const colOffset = (x * this.pixelZoom + zoomX) * 4;
                const index = rowStart + colOffset;

                data[index] = r; // Red
                data[index + 1] = g; // Green
                data[index + 2] = b; // Blue
                data[index + 3] = 255; // Alpha
              }
            }
          }
        }

        this.offscreenCtx.putImageData(imageData, 0, startY * this.pixelZoom);
      });
    }
  }

  reset() {
    for (let y = 0; y < this.virtualHeight; y++)
      for (let x = 0; x < this.virtualWidth; x++)
        this.virtualCanvas[y][x] = white;
    this.fillImageData();
  }

  set(newVirtualCanvas) {
    const oldVirtualCanvas = this.virtualCanvas;
    this.virtualCanvas = newVirtualCanvas;
    this.virtualWidth = this.virtualCanvas[0].length;
    this.virtualHeight = this.virtualCanvas.length;
    //CALM: something here is supposed to set the canvas size, for now the size is static
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
    const rect = this.drawingarea.getBoundingClientRect();
    const x = Math.round((clientX - rect.left - this.offset[0]) / this.zoom);
    const y = Math.round((clientY - rect.top - this.offset[1]) / this.zoom);
    return [x, y];
  }

  positionInScreen(x, y) {
    const rect = this.drawingarea.getBoundingClientRect();
    const clientX = x * this.zoom + this.offset[0] + rect.left;
    const clientY = y * this.zoom + this.offset[1] + rect.top;
    return [clientX, clientY];
  }

  centerOfScreenInCanvas() {
    const rect = this.drawingarea.getBoundingClientRect();
    return this.positionInCanvas(rect.width / 2 + rect.left, rect.height / 2 + rect.top)
  }

  setCanvasSize() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    this.debounceTimer = setTimeout(() => {
      const rect = this.drawingarea.getBoundingClientRect();
      this.canvas.width = rect.width;
      this.canvas.height = rect.height;
      this.render();
    }, 50);
  }
}
