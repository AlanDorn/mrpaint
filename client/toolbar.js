import BrushSize from "./brushsize.js";
import ColorPicker from "./colorpicker.js";
import Pencil from "./pencil.js";
import FillTool from "./filltool.js";
import Undo from "./undo.js";

export default class Toolbar {
  constructor(virtualCanvas, transactionManager) {
    this.colorpicker = new ColorPicker();
    this.brushsize = new BrushSize();
    this.pencil = new Pencil(virtualCanvas, transactionManager, this);
    this.fillTool = new FillTool(virtualCanvas, transactionManager, this);
    this.undo = new Undo(transactionManager);

    //set the default tool to pencil
    this.activeTool = this.pencil;

    this.setupToolSwitcher();
  }

  setupToolSwitcher() {
    const pencilButton = document.getElementById("pencil");
    const fillToolButton = document.getElementById("fillTool");
    const undoButton = document.getElementById("undo");
    const redoButton = document.getElementById("redo");

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
      this.setActiveTool(this.pencil);
      this.updateActiveButton(pencilButton);
    });

    fillToolButton.addEventListener("click", () => {
      this.setActiveTool(this.fillTool);
      this.updateActiveButton(fillToolButton);
    });
  }

  setActiveTool(tool) {
    this.activeTool = tool;
    console.log(`switched to ${tool.constructor.name}`);
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
