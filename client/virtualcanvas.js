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
      Array(this.canvas.width).fill([255, 255, 255])
    );
    this.virtualWidth = this.canvas.width;
    this.virtualHeight = this.canvas.height;

    this.changes = [];

    // This loop updates the screen every 32 ms or ~30 fps.
    setInterval(() => this.render(), 16);
    window.addEventListener("resize", () => this.resize());
    this.resize();
  }

  render() {
    this.ctx.putImageData(this.imageData, 0, 0);
  }

  setPixelServer(x, y, r, g, b) {
    if (x >= 0 && x < this.canvas.width && y >= 0 && y < this.canvas.height) {
      const index = (y * this.imageData.width + x) * 4; // Calculate pixel index
      this.imageData.data[index] = r; // Red
      this.imageData.data[index + 1] = g; // Green
      this.imageData.data[index + 2] = b; // Blue
      this.imageData.data[index + 3] = 255; // Alpha
    }

    this.resizeVirtualIfNeeded(x, y);
    this.virtualCanvas[y][x] = [r, g, b];
  }

  setPixelClient(x, y, r, g, b) {
    if (x >= 0 && x < this.canvas.width && y >= 0 && y < this.canvas.height) {
      const index = (y * this.imageData.width + x) * 4; // Calculate pixel index
      this.imageData.data[index] = r; // Red
      this.imageData.data[index + 1] = g; // Green
      this.imageData.data[index + 2] = b; // Blue
      this.imageData.data[index + 3] = 255; // Alpha
    }

    if (x >= 0 && x < this.virtualWidth && y >= 0 && y < this.virtualHeight) {
      this.changes.push(x, y, r, g, b);
      this.virtualCanvas[y][x] = [r, g, b];
    }
  }

  resizeVirtualIfNeeded(x, y) {
    if (y >= this.virtualHeight) {
      const rowsToAdd = y - this.virtualHeight + 1;
      for (let i = 0; i < rowsToAdd; i++) {
        this.virtualCanvas.push(Array(this.virtualWidth).fill([255, 255, 255]));
      }
      this.virtualHeight += rowsToAdd;
    }

    // Extend canvas width (columns) for all rows
    if (x >= this.virtualWidth) {
      const colsToAdd = x - this.virtualWidth + 1;
      for (let row of this.virtualCanvas) {
        row.push(...Array(colsToAdd).fill([255, 255, 255]));
      }
      this.virtualWidth += colsToAdd;
    }
  }

  pullChanges() {
    if (!this.changes.length) return "";
    const csv = this.changes.join(",");
    this.changes = [];
    return csv;
  }

  resize() {
    const rect = this.drawingarea.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.imageData = this.ctx.createImageData(
      this.canvas.width,
      this.canvas.height
    );

    this.resizeVirtualIfNeeded(Math.ceil(rect.width), Math.ceil(rect.height));

    for (let y = 0; y < rect.height; y++) {
      for (let x = 0; x < rect.width; x++) {
        const newIndex = (y * this.canvas.width + x) * 4;

        this.imageData.data[newIndex] = this.virtualCanvas[y][x][0]; // Red
        this.imageData.data[newIndex + 1] = this.virtualCanvas[y][x][1]; // Green
        this.imageData.data[newIndex + 2] = this.virtualCanvas[y][x][2]; // Blue
        this.imageData.data[newIndex + 3] = 255; // Alpha
      }
    }

    this.render();
  }

  positionInCanvas(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor(clientX - rect.left);
    const y = Math.floor(clientY - rect.top);
    return [x, y];
  }
}

