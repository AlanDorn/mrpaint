class VirtualCanvas {
  constructor() {
    this.canvas = document.getElementById("myCanvas");
    this.drawingarea = document.getElementById("drawingarea");
    this.ctx = this.canvas.getContext("2d");
    this.imageData = this.ctx.createImageData(
      this.canvas.width,
      this.canvas.height
    );

    this.changes = [];

    // This loop updates the screen every 32 ms or ~30 fps.
    setInterval(() => this.draw(), 16);
    window.addEventListener("resize", () => this.resize());
    this.resize();
  }

  draw() {
    this.ctx.putImageData(this.imageData, 0, 0);
  }

  setPixel(x, y, r, g, b, send = true) {
    if (x >= 0 && x < this.canvas.width && y >= 0 && y < this.canvas.height) {
      if (send) this.changes.push(x, y, r, g, b);
      const index = (y * this.imageData.width + x) * 4; // Calculate pixel index
      this.imageData.data[index] = r; // Red
      this.imageData.data[index + 1] = g; // Green
      this.imageData.data[index + 2] = b; // Blue
      this.imageData.data[index + 3] = 255; // Alpha
    }
  }

  pullChanges() {
    if (!this.changes.length) return null;
    const csv = this.changes.join(",");
    this.changes = [];
    return csv;
  }

  resize() {
    const rect = this.drawingarea.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;

    const newImageData = this.ctx.createImageData(
      this.canvas.width,
      this.canvas.height
    );
    const newData = newImageData.data;
    const oldData = this.imageData.data;

    const transferWidth = Math.min(this.canvas.width, this.imageData.width); // Common width
    const transferHeight = Math.min(this.canvas.height, this.imageData.height); // Common height

    for (let y = 0; y < transferHeight; y++) {
      for (let x = 0; x < transferWidth; x++) {
        const oldIndex = (y * this.imageData.width + x) * 4;
        const newIndex = (y * this.canvas.width + x) * 4;

        newData[newIndex] = oldData[oldIndex]; // Red
        newData[newIndex + 1] = oldData[oldIndex + 1]; // Green
        newData[newIndex + 2] = oldData[oldIndex + 2]; // Blue
        newData[newIndex + 3] = oldData[oldIndex + 3]; // Alpha
      }
    }

    this.imageData = newImageData; // Update the imageData to the new one
    this.draw();
  }

  positionInCanvas(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor(clientX - rect.left);
    const y = Math.floor(clientY - rect.top);
    return [x,y];
  }
}

export default VirtualCanvas;
