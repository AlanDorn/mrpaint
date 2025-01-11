import BrushSize from "./brushsize.js";
import ColorPicker from "./colorpicker.js";
import Pencil from "./pencil.js";
import FillTool from "./filltool.js";
import Undo from "./undo.js";

//TODO Gotta add straight line tool!
//TODO add the active button coloring logic, not sure if goes here or somewhere else yet!

export default class Toolbar {
  constructor(virtualCanvas, transactionManager) {
    this.colorpicker = new ColorPicker();
    this.brushsize = new BrushSize();
    this.pencil = new Pencil(virtualCanvas, transactionManager, this);
    this.fillTool = new FillTool(virtualCanvas, transactionManager, this);
    this.undo = new Undo(transactionManager);

    //set the default tool to pencil
    this.activeTool = this.pencil;
    this.activeSelector = null;

    this.setupToolSwitcher();
  }

  setupToolSwitcher() {
    const pencilButton = document.getElementById("pencil");
    const fillToolButton = document.getElementById("fillTool");
    const undoButton = document.getElementById("undo");
    const redoButton = document.getElementById("redo");
    const brushSizeSelector = document.getElementById("brushsize");
    const drawingarea = document.getElementById("drawingarea");

    undoButton.addEventListener("click", () => {
      // const cntrlzEvent = new KeyboardEvent("keydown", {
      //   key: "z",
      //   cntrlKey: true,
      //   bubbles: true,
      //   cancelable: true
      // });
      // document.dispatchEvent(cntrlzEvent);
      this.undo.undo();
    });

    redoButton.addEventListener("click", () => {
      this.undo.redo();
    });

    pencilButton.addEventListener("click", () => {
      this.activeTool = this.pencil;
      this.updateActiveButton(pencilButton);
    });

    fillToolButton.addEventListener("click", () => {
      this.activeTool = this.fillTool;
      this.updateActiveButton(fillToolButton);
    });

    brushSizeSelector.addEventListener("click", () => {
      this.activeSelector = this.brushsize;
    });

    drawingarea.addEventListener("click", () => {
      this.activeSelector = null;
    })
  }

  updateActiveButton(activeButton) {
    const buttons = document.querySelectorAll("#toolbar button");

    buttons.forEach((button) => button.classList.remove("active"));
    activeButton.classList.add("active");
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
  }
}
