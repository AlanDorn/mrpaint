const white = [255, 255, 255];
export default class VirtualCanvas {
  constructor() {
    this.canvas = document.getElementById("myCanvas");
    this.drawingarea = document.getElementById("drawingarea");
    this.ctx = this.canvas.getContext("2d");
    this.imageData = this.ctx.createImageData(
      this.canvas.width,
      this.canvas.height
    );

    // [y][x][r,g,b]
    this.virtualCanvas = Array.from({ length: this.canvas.height }, () =>
      Array(this.canvas.width).fill(white)
    );
    this.virtualWidth = this.canvas.width;
    this.virtualHeight = this.canvas.height;

    this.fillGeneration = [];
    window.addEventListener("resize", () => {
      this.resize();
    });
    this.resize();
  }

  render() {
    this.ctx.putImageData(this.imageData, 0, 0);
  }

  fill() {
    if (this.fillGeneration.length !== 0) this.fillGeneration.pop()();
  }

  setPixel(x, y, color) {
    if (x >= 0 && x < this.canvas.width && y >= 0 && y < this.canvas.height) {
      const index = (y * this.imageData.width + x) * 4; // Calculate pixel index
      this.imageData.data[index] = color[0]; // Red
      this.imageData.data[index + 1] = color[1]; // Green
      this.imageData.data[index + 2] = color[2]; // Blue
      this.imageData.data[index + 3] = 255; // Alpha
    }

    if (x >= 0 && y >= 0) {
      this.resizeVirtualIfNeeded(x, y);
      this.virtualCanvas[y][x] = color;
    }
  }

  resizeVirtualIfNeeded(x, y) {
    if (y >= this.virtualHeight) {
      const rowsToAdd = y - this.virtualHeight + 1;
      for (let i = 0; i < rowsToAdd; i++) {
        this.virtualCanvas.push(Array(this.virtualWidth).fill(white));
      }
      this.virtualHeight += rowsToAdd;
    }

    // Extend canvas width (columns) for all rows
    if (x >= this.virtualWidth) {
      const colsToAdd = x - this.virtualWidth + 1;
      for (let row of this.virtualCanvas) {
        row.push(...Array(colsToAdd).fill(white));
      }
      this.virtualWidth += colsToAdd;
    }
  }

  resize() {
    this.filling = true;
    const rect = this.drawingarea.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.imageData = this.ctx.createImageData(
      this.canvas.width,
      this.canvas.height
    );

    this.resizeVirtualIfNeeded(Math.ceil(rect.width), Math.ceil(rect.height));

    this.fillImageData();
  }

  fillImageData() {
    const { width, height } = this.canvas;
    const chunkSize = 512;
    // Pre-generate all chunks
    this.fillGeneration = [];
    const totalChunks = Math.ceil(height / chunkSize);
    for (let i = 0; i < totalChunks; i++) {
      const startY = i * chunkSize;
      const endY = Math.min(startY + chunkSize, height);
      this.fillGeneration.push(() => {
        for (let y = startY; y < endY; y++) {
          for (let x = 0; x < width; x++) {
            const newIndex = (y * width + x) * 4;
            this.imageData.data[newIndex] = this.virtualCanvas[y][x][0]; // Red
            this.imageData.data[newIndex + 1] = this.virtualCanvas[y][x][1]; // Green
            this.imageData.data[newIndex + 2] = this.virtualCanvas[y][x][2]; // Blue
            this.imageData.data[newIndex + 3] = 255; // Alpha
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
    this.resizeVirtualIfNeeded(this.virtualWidth, this.virtualHeight);
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
    } else {
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
  }

  positionInCanvas(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.round(clientX - rect.left);
    const y = Math.round(clientY - rect.top);
    return [x, y];
  }
}
