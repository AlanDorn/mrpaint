import BrushSize from "./brushsize.js";
import ColorPicker from "./colorpicker.js";
import Pencil from "./pencil.js";

export default class Toolbar {
  constructor(virtualCanvas, transactionManager) {
    this.colorpicker = new ColorPicker();
    this.brushsize = new BrushSize();
    this.pencil = new Pencil(virtualCanvas, transactionManager, this);

    //set the default tool to pencil
    this.activeTool = this.pencil;
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
