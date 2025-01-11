export default class Viewport {
  constructor(virtualCanvas) {
    this.virtualCanvas = virtualCanvas;
  }

  handleWheel(event) {
    if (event.deltaY < 0) {
      event.ctrlKey
        ? this.zoomIn() // If the user does both it does the scroll up
        : event.shiftKey
        ? this.scrollLeft()
        : this.scrollUp();
    } else if (event.deltaY > 0) {
      event.ctrlKey
        ? this.zoomOut()
        : event.shiftKey
        ? this.scrollRight()
        : this.scrollDown();
    }
  }

  scrollUp() {
    this.virtualCanvas.offset[1] = Math.min(
      0,
      this.virtualCanvas.offset[1] + 8 * this.virtualCanvas.zoom
    );
  }

  scrollDown() {
    this.virtualCanvas.offset[1] -= 8 * this.virtualCanvas.zoom;
  }

  scrollLeft() {
    this.virtualCanvas.offset[0] = Math.min(
      0,
      this.virtualCanvas.offset[0] + 8 * this.virtualCanvas.zoom
    );
  }

  scrollRight() {
    this.virtualCanvas.offset[0] -= 8 * this.virtualCanvas.zoom;
  }

  zoomIn() {
    //takes 8 clicks to zoom in/out 2x
    this.virtualCanvas.zoomExp += 0.125;
    this.virtualCanvas.zoom = 2 ** this.virtualCanvas.zoomExp;
  }

  zoomOut() {
    this.virtualCanvas.zoomExp -= 0.125;
    this.virtualCanvas.zoom = 2 ** this.virtualCanvas.zoomExp;
  }
}
