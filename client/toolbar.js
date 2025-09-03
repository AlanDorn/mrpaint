import BrushSize from "./brushsize.js";
import ColorPicker from "./colorpicker.js";

import Pencil from "./pencil.js";
import Eraser from "./eraser.js";
import FillTool from "./filltool.js";
import StraightLine from "./straightLine.js";

import CursorManager from "./cursorManager.js";
import Undo from "./undo.js";
import Viewport from "./viewport.js";
import StatusBar from "./statusbar.js";
import Ruler from "./ruler.js";

export default class Toolbar {
  constructor(transactionLog, previewManager, virtualCanvas) {
    this.previewManager = previewManager;
    this.virtualCanvas = virtualCanvas;

    this.colorpicker = new ColorPicker();
    this.brushsize = new BrushSize();
    this.pencil = new Pencil(virtualCanvas, transactionLog, this);
    this.eraser = new Eraser(virtualCanvas, transactionLog, this);
    this.fillTool = new FillTool(virtualCanvas, transactionLog, this);
    this.viewport = new Viewport(virtualCanvas, transactionLog, this);
    this.straightLine = new StraightLine(virtualCanvas, transactionLog, previewManager, this);

    this.cursor = new CursorManager(virtualCanvas, this);
    this.undo = new Undo(transactionLog);
    this.statusbar = new StatusBar(virtualCanvas);
    this.ruler = new Ruler(virtualCanvas);
    

    this.activeSelector = null;
    this.setupToolSwitcher();

    //set the default tool to pencil
    this.activeTool = this.pencil;
    this.updateActiveButton(this.pencilButton);
    this.cursor.setCanvasCursor(this.pencilButton, {x:3, y:20}); //3,20 idfk
  }

  setupToolSwitcher() {
    this.pencilButton = document.getElementById("pencil");
    this.eraserButton = document.getElementById("eraser");
    this.fillToolButton = document.getElementById("fillTool");
    this.undoButton = document.getElementById("undo");
    this.redoButton = document.getElementById("redo");
    this.brushSizeSelector = document.getElementById("brushsize");
    this.drawingarea = document.getElementById("drawingarea");
    this.straightLineButton = document.getElementById("straightLine");
    
    this.undoButton.addEventListener("click", () => {
      this.undo.undo();
    });

    this.redoButton.addEventListener("click", () => {
      this.undo.redo();
    });

    this.pencilButton.addEventListener("click", () => {
      this.activeTool = this.pencil;
      this.updateActiveButton(this.pencilButton);
      this.cursor.setCanvasCursor(this.pencilButton, {x:3, y:20}); //2px by 22px (x & y)
    });

    this.eraserButton.addEventListener("click", () => {
      this.activeTool = this.eraser;
      this.updateActiveButton(this.eraserButton);
      this.cursor.setCanvasCursor(this.eraserButton, {x:0, y:0});
    });

    this.straightLineButton.addEventListener("click", () => {
      this.activeTool = this.straightLine;
      this.updateActiveButton(this.straightLineButton);
      this.cursor.setCanvasCursor(this.straightLineButton, {x:0, y:0});
    });

    this.fillToolButton.addEventListener("click", () => {
      this.activeTool = this.fillTool;
      this.updateActiveButton(this.fillToolButton);
      this.cursor.setCanvasCursor(this.fillToolButton, {x:2, y:21});
    });

    this.brushSizeSelector.addEventListener("click", () => {
      this.activeSelector = this.brushsize;
      this.activeReason = "click";
    });

    this.brushSizeSelector.addEventListener("mouseenter", () => {
      this.activeSelector = this.brushsize;
      this.activeReason = "mouseenter";
    });

    this.brushSizeSelector.addEventListener("mouseleave", () => {
      if (this.activeReason === "mouseenter") this.activeSelector = null;
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
