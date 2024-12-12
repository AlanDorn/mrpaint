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

    window.addEventListener("resize", () => {
        this.resize();
    });
    this.resize();
    //setInterval(() => this.render(), 4);
    this.fpsReduce = 4;
    this.fpsCounter = 0;
    this.fillGeneration = 0;
  }

  render() {
    //if (this.filling) return;
    this.fpsCounter++;
    this.fpsCounter %= this.fpsReduce;
    if (this.fpsCounter !== 0) return;
    this.ctx.putImageData(this.imageData, 0, 0);
  }

  setPixel(x, y, r, g, b) {
    if (x >= 0 && x < this.canvas.width && y >= 0 && y < this.canvas.height) {
      const index = (y * this.imageData.width + x) * 4; // Calculate pixel index
      this.imageData.data[index] = r; // Red
      this.imageData.data[index + 1] = g; // Green
      this.imageData.data[index + 2] = b; // Blue
      this.imageData.data[index + 3] = 255; // Alpha
    }

    if (x >= 0 && y >= 0) {
      this.resizeVirtualIfNeeded(x, y);
      this.virtualCanvas[y][x] = [r, g, b];
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
    let y = 0; // Start at the top of the canvas
    this.fillGeneration++
    const thisGeneration = this.fillGeneration;

    const processChunk = () => {
      const chunkSize = 2; // Number of rows to process per iteration
      const maxY = Math.min(y + chunkSize, height);

      for (; y < maxY; y++) {
        for (let x = 0; x < width; x++) {
          const newIndex = (y * width + x) * 4;
          this.imageData.data[newIndex] = this.virtualCanvas[y][x][0]; // Red
          this.imageData.data[newIndex + 1] = this.virtualCanvas[y][x][1]; // Green
          this.imageData.data[newIndex + 2] = this.virtualCanvas[y][x][2]; // Blue
          this.imageData.data[newIndex + 3] = 255; // Alpha
        }
      }

      if (y < height && thisGeneration == this.fillGeneration) {
        setTimeout(processChunk, 0); // Schedule the next chunk
      } 
    };

    processChunk(); // Start processing
  }

  fillImageData1() {
    const { width, height } = this.canvas;
    const imageData = this.imageData;
    const virtualCanvas = this.virtualCanvas;
    let chunkStartY = 0; // Start at the top of the canvas
    let chunkStartX = 0; // Start at the left of the canvas
    const thisGeneration = this.fillGeneration;
  
    const processChunk = () => {
      const chunkSize = 64; 
      const maxChunkY = Math.min(chunkStartY + chunkSize, height);
      const maxChunkX = Math.min(chunkStartX + chunkSize, width);
  
      for (let y = chunkStartY; y < maxChunkY; y++) {
        for (let x = chunkStartX; x < maxChunkX; x++) {
          const newIndex = (y * width + x) * 4;
          imageData.data[newIndex] = virtualCanvas[y][x][0]; // Red
          imageData.data[newIndex + 1] = virtualCanvas[y][x][1]; // Green
          imageData.data[newIndex + 2] = virtualCanvas[y][x][2]; // Blue
          imageData.data[newIndex + 3] = 255; // Alpha
        }
      }
  
      // Move to the next chunk
      if (chunkStartX + chunkSize < width) {
        chunkStartX += chunkSize;
      } else {
        chunkStartX = 0; // Reset to the first column
        chunkStartY += chunkSize;
      }
  
      if (chunkStartY < height && thisGeneration == this.fillGeneration) {
        setTimeout(processChunk, 0); // Schedule the next chunk
      }
    };
  
    processChunk(); // Start processing
  }
  

  reset() {
    this.virtualCanvas = Array.from({ length: this.canvas.height }, () =>
      Array(this.canvas.width).fill(white)
    );
    this.virtualWidth = this.canvas.width;
    this.virtualHeight = this.canvas.height;
    this.fillImageData();
  }

  set(newVirtualCanvas) {
    this.virtualCanvas = newVirtualCanvas;
    this.virtualWidth = this.virtualCanvas[0].length;
    this.virtualHeight = this.virtualCanvas.length;
    this.resizeVirtualIfNeeded(this.virtualWidth, this.virtualHeight);
    this.fillImageData();
  }

  cloneCanvas(recycledSnapshot = null) {
    // If no recycled snapshot is provided, create a new array structure
    if (!recycledSnapshot) {
      const clone = [];
      for (let y = 0; y < this.virtualHeight; y++)
        clone.push([...this.virtualCanvas[y]]);
      return clone;
    } else {
      // Adjust the recycledSnapshot dimensions to fit this.virtualCanvas
      recycledSnapshot.length = this.virtualCanvas.length;

      for (let y = 0; y < this.virtualCanvas.length; y++) {
        // Ensure the row exists in recycledSnapshot
        recycledSnapshot[y] = recycledSnapshot[y] || [];
        recycledSnapshot[y].length = this.virtualCanvas[y].length;

        // Fill new columns in the recycled row if necessary
        for (let x = 0; x < this.virtualCanvas[y].length; x++) {
          recycledSnapshot[y][x] = this.virtualCanvas[y][x];
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
