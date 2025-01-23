import BrushSize from "./brushsize.js";
import ColorPicker from "./colorpicker.js";
import Pencil from "./pencil.js";
import Eraser from "./eraser.js";
import FillTool from "./filltool.js";
import Undo from "./undo.js";
import Viewport from "./viewport.js";
import StatusBar from "./statusbar.js";
import Ruler from "./ruler.js";

//TODO Gotta add straight line tool!
//TODO add the active button coloring logic, not sure if goes here or somewhere else yet!

export default class Toolbar {
  constructor(virtualCanvas, transactionManager) {
    this.colorpicker = new ColorPicker();
    this.brushsize = new BrushSize();
    this.pencil = new Pencil(virtualCanvas, transactionManager, this);
    this.eraser = new Eraser(virtualCanvas, transactionManager, this);
    this.fillTool = new FillTool(virtualCanvas, transactionManager, this);
    this.undo = new Undo(transactionManager);
    this.viewport = new Viewport(virtualCanvas, this, transactionManager);
    this.statusbar = new StatusBar(virtualCanvas);
    this.ruler = new Ruler(virtualCanvas);

    //set the default tool to pencil
    this.activeTool = this.pencil;
    this.activeSelector = null;

    this.setupToolSwitcher();

    const pencilButton = document.getElementById("pencil");
    this.updateActiveButton(pencilButton);
  }

  setupToolSwitcher() {
    const pencilButton = document.getElementById("pencil");
    const eraserButton = document.getElementById("eraser");
    const fillToolButton = document.getElementById("fillTool");
    const undoButton = document.getElementById("undo");
    const redoButton = document.getElementById("redo");
    const brushSizeSelector = document.getElementById("brushsize");
    const drawingarea = document.getElementById("drawingarea");

    undoButton.addEventListener("click", () => {
      this.undo.undo();
    });

    redoButton.addEventListener("click", () => {
      this.undo.redo();
    });

    pencilButton.addEventListener("click", () => {
      this.activeTool = this.pencil;
      this.updateActiveButton(pencilButton);
    });

    eraserButton.addEventListener("click", () => {
      this.activeTool = this.eraser;
      this.updateActiveButton(eraserButton);
    });

    fillToolButton.addEventListener("click", () => {
      this.activeTool = this.fillTool;
      this.updateActiveButton(fillToolButton);
    });

    brushSizeSelector.addEventListener("click", () => {
      this.activeSelector = this.brushsize;
      this.activeReason = "click";
    });

    brushSizeSelector.addEventListener("mouseenter", () => {
      this.activeSelector = this.brushsize;
      this.activeReason = "mouseenter";
    });

    brushSizeSelector.addEventListener("mouseleave", () => {
      if (this.activeReason === "mouseenter") this.activeSelector = null;
    });

    drawingarea.addEventListener("click", () => {
      this.activeSelector = null;
    });

    this.viewport.widthAdjuster.addEventListener("mousedown", (event) => {
      if (this.activeTool == this.viewport) return;
      this.viewport.activeAdjuster = this.viewport.widthAdjuster;
      this.viewport.lastActiveTool = this.activeTool;
      this.activeTool = this.viewport;
    });

    this.viewport.heightAdjuster.addEventListener("mousedown", (event) => {
      if (this.activeTool == this.viewport) return;
      this.viewport.activeAdjuster = this.viewport.heightAdjuster;
      this.viewport.lastActiveTool = this.activeTool;
      this.activeTool = this.viewport;
    });

    this.viewport.bothAdjuster.addEventListener("mousedown", (event) => {
      if (this.activeTool == this.viewport) return;
      this.viewport.activeAdjuster = this.viewport.bothAdjuster;
      this.viewport.lastActiveTool = this.activeTool;
      this.activeTool = this.viewport;
    });

    document.addEventListener("mousedown", (event) => {
      if (event.button === 1) {
        this.viewport.startPosition[0] = event.clientX;
        this.viewport.startPosition[1] = event.clientY;

        this.viewport.activeAdjuster = this.viewport.middleMouseAdjuster;
        this.viewport.lastActiveTool = this.activeTool;
        this.activeTool = this.viewport;
      }
    });
  }

  updateActiveButton(activeButton) {
    const buttons = document.querySelectorAll("#toolbar button");
    const svgs = document.querySelectorAll("#toolbar button svg");

    buttons.forEach((button) => button.classList.remove("active"));
    activeButton.classList.add("active");

    svgs.forEach((button) => button.classList.remove("active"));
    const activeSvg = activeButton.querySelector("svg");

    activeSvg.classList.add("active");
  }

  mouseDownLeft(input) {
    this.activeTool.mouseDownLeft(input);
  }

  mouseDownRight(input) {
    this.activeTool.mouseDownRight(input);
  }

  mouseUpLeft(input) {
    this.activeTool.mouseUpLeft(input);
  }

  mouseUpRight(input) {
    this.activeTool.mouseUpRight(input);
  }

  mouseMove(input) {
    this.activeTool.mouseMove(input);
    this.statusbar.setMousePosition(input);
    this.ruler.set(input);
  }
}
