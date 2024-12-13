export default class FillTool {
  constructor(virtualCanvas, transactionManager, toolbar) {
    this.virtualCanvas = virtualCanvas;
    this.transactionManager = transactionManager;
    this.colorpicker = toolbar.colorpicker;
  }

  mouseMove(input) {}

  mouseUpLeft(input) {}

  mouseUpRight(input) {}

  mouseDownLeft(input) {
    const [x, y] = this.virtualCanvas.positionInCanvas(input.x, input.y);
    this.fill(x, y, this.colorpicker.primarycolor);
  }

  mouseDownRight(input) {
    const [x, y] = this.virtualCanvas.positionInCanvas(input.x, input.y);
    this.fill(x, y, this.colorpicker.secondarycolor);
  }

  fill(x, y, newColor) {
    if (
      x < 0 ||
      y < 0 ||
      x >= this.virtualCanvas.virtualWidth ||
      y >= this.virtualCanvas.virtualHeight
    ) {
      return; // or handle the out-of-bounds case appropriately
    }

    this.virtualCanvas.resizeVirtualIfNeeded(x, y);
    const targetColor = this.virtualCanvas.virtualCanvas[y][x];
    if (this.colorMatch(targetColor, newColor)) return;

    const stack = [[x, y]];
    const width = this.virtualCanvas.virtualWidth;
    const height = this.virtualCanvas.virtualHeight;

    while (stack.length > 0) {
      const [curX, curY] = stack.pop();

      if (
        curX < 0 ||
        curX >= width ||
        curY < 0 ||
        curY >= height ||
        !this.colorMatch(
          this.virtualCanvas.virtualCanvas[curY][curX],
          targetColor
        )
      ) {
        continue;
      }

      this.virtualCanvas.setPixelClient(curX, curY, ...newColor);
      this.virtualCanvas.setPixelServer(curX, curY, ...newColor);

      stack.push([curX + 1, curY]);
      stack.push([curX - 1, curY]);
      stack.push([curX, curY + 1]);
      stack.push([curX, curY - 1]);
    }

    this.transactionManager.fillTransaction(x, y, newColor, targetColor);
  }

  colorMatch(color1, color2) {
    return (
      color1[0] === color2[0] &&
      color1[1] === color2[1] &&
      color1[2] === color2[2]
    );
  }

  drawServer(newColor, targetColor, position) {
    const [x, y] = position;
    // Re-apply the fill logic but without sending a new transaction or
    // calling fillTransaction since we are just applying what the server told us.

    // For example, copy the logic from fill(), but skip calling transactionManager.
    // Or create a helper method to do the flood fill given x,y and colors.
    this.applyFill(x, y, newColor, targetColor);
  }
  applyFill(x, y, newColor, targetColor) {
    // Essentially the same logic as fill() but with no transaction recording
    // and no server messages.
    if (
      x < 0 ||
      y < 0 ||
      x >= this.virtualCanvas.virtualWidth ||
      y >= this.virtualCanvas.virtualHeight
    ) {
      return;
    }

    this.virtualCanvas.resizeVirtualIfNeeded(x, y);

    if (this.colorMatch(this.virtualCanvas.virtualCanvas[y][x], newColor))
      return;

    const stack = [[x, y]];
    const width = this.virtualCanvas.virtualWidth;
    const height = this.virtualCanvas.virtualHeight;

    while (stack.length > 0) {
      const [curX, curY] = stack.pop();

      if (
        curX < 0 ||
        curX >= width ||
        curY < 0 ||
        curY >= height ||
        !this.colorMatch(
          this.virtualCanvas.virtualCanvas[curY][curX],
          targetColor
        )
      ) {
        continue;
      }

      this.virtualCanvas.setPixelClient(curX, curY, ...newColor);
      this.virtualCanvas.setPixelServer(curX, curY, ...newColor);

      stack.push([curX + 1, curY]);
      stack.push([curX - 1, curY]);
      stack.push([curX, curY + 1]);
      stack.push([curX, curY - 1]);
    }
  }
}
