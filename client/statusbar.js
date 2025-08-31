import { virtualCanvas } from "./client.js";

export default class StatusBar {
  constructor() {
    this.mouseposition = document.getElementById("mouseposition");
    this.canvassize = document.getElementById("canvassize");
    this.zoompower = document.getElementById("zoompower");
    this.completionbar = document.getElementById("completionbar");
    this.networkUp = document.getElementById("networkUp");
    this.networkDown = document.getElementById("networkDown");

    this.setCanvasSize();
    this.setZoomPower();
  }

  setMousePosition(input) {
    const positionInCanvas = virtualCanvas.positionInCanvas(input.x, input.y);
    this.mouseposition.innerText = `${positionInCanvas[0]} x ${positionInCanvas[1]}`;
  }

  setCanvasSize() {
    this.canvassize.innerText = `${virtualCanvas.width} x ${virtualCanvas.height}`;
  }

  setZoomPower() {
    if (virtualCanvas.zoomExp >= 0)
      this.zoompower.innerText = `${Math.ceil(10 * virtualCanvas.zoom) / 10}x`;
    else
      this.zoompower.innerText = `-${Math.ceil(10 / virtualCanvas.zoom) / 10}x`;
  }

  setCompletionBar(percent, left) {
    if (isNaN(percent)) percent = 100;
    this.completionbar.style.width = percent * 100 + "%";
    this.completionbar.innerText = "tx: " + left;
  }

  setNetworkUsage(up, down) {
    const upFmt = formatBytes(up);
    const downFmt = formatBytes(down);
    this.networkUp.innerText = `↑: ${upFmt}`;
    this.networkDown.innerText = `↓: ${downFmt}`;
  }
}

function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return "0.0 Bs";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = [" Bs", "KBs", "MBs", "GBs", "TBs"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  // toFixed(dm) will always emit dm decimals (including trailing zeros)
  const value = (bytes / Math.pow(k, i)).toFixed(dm);
  return value + sizes[i];
}
