export default class StatusBar {
  constructor(virtualCanvas) {
    this.virtualCanvas = virtualCanvas;
    this.virtualCanvas.statusbar = this;
    this.mouseposition = document.getElementById("mouseposition");
    this.canvassize = document.getElementById("canvassize");
    this.zoompower = document.getElementById("zoompower");
    this.completionbar = document.getElementById("completionbar");
    this.setCanvasSize();
    this.setZoomPower();
  }

  setMousePosition(input) {
    const positionInCanvas = this.virtualCanvas.positionInCanvas(
      input.x,
      input.y
    );
    this.mouseposition.innerText = `${positionInCanvas[0]} x ${positionInCanvas[1]}`;
  }

  setCanvasSize() {
    this.canvassize.innerText = `${this.virtualCanvas.width} x ${this.virtualCanvas.height}`;
  }

  setZoomPower() {
    if (this.virtualCanvas.zoomExp >= 0)
      this.zoompower.innerText = `${
        Math.ceil(10 * this.virtualCanvas.zoom) / 10
      }x`;
    else
      this.zoompower.innerText = `-${
        Math.ceil(10 / this.virtualCanvas.zoom) / 10
      }x`;
  }

  setCompletionBar(percent) {
    if (isNaN(percent)) {
      percent = 100;
    }
    this.completionbar.style.width = percent * 100 + "%";
  }
}
