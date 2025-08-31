import BrushSize from "./brushsize.js";
import ColorPicker from "./colorpicker.js";
import Pencil from "./pencil.js";
import Eraser from "./eraser.js";
import FillTool from "./filltool.js";
import Undo from "./undo.js";
import Viewport from "./viewport.js";
import StatusBar from "./statusbar.js";
import Ruler from "./ruler.js";
import StraightLine from "./straightLine.js";

// Toolbar should be split up into components, so the brush size and the color picker are in a way there own components.
// There are the general tools like eraser fill and pencil, there will also
// be  selection tools which will be it's own component.

// Currently toolbar is both the switcher and the general tools
// How this will work is through a seperate classes: ToolSwitcher, General Tools, brushsize, color picker.

// color picker and brush size have states which will need listening.
// this will be implemented:
// this.listeners = [] : will contain functions like void => void
// and
// this.listeners.forEach(listener => listener()) : whenever we change values

// if something needs to listen they go:
// obj.listeners.push(() => {use the obj here})

// if listeners need to be added and removed do it like:

// const listener = () => {}
// obj.listeners.push(listener); adds listener
// obj.listeners.splice(obj.listeners.indexOf(listener), 1) remove listener

export default class Toolbar {
  constructor() {
    this.colorpicker = new ColorPicker();
    this.brushsize = new BrushSize();
    this.pencil = new Pencil();
    this.eraser = new Eraser();
    this.fillTool = new FillTool();
    this.undo = new Undo();
    // this is fine here since it needs brushsize and colorpicker at construct time. That won't be a problem later so no need to worry about the difference here. Basically we'll be importing all these just like we do in the client, except in a MrPaintTools class or something.
    this.straightLine = new StraightLine(this);

    this.viewport = new Viewport();
    this.statusbar = new StatusBar();
    this.ruler = new Ruler();

    //set the default tool to pencil
    this.activeTool = this.pencil;
    this.activeWheel = this.viewport;

    const pencilButton = document.getElementById("pencil");
    this.updateActiveButton(pencilButton);

    const drawingarea = document.getElementById("drawingarea");
    drawingarea.addEventListener("click", () => {
      this.activeWheel = this.viewport;
    });
  }

  updateActiveButton(activeButton) {
    document
      .querySelectorAll("#toolbar button, #toolbar button svg")
      .forEach((button) => button.classList.remove("active"));
    activeButton.classList.add("active");
    activeButton.querySelector("svg").classList.add("active");
  }

  mouseMove = (input) => {
    this.activeTool.mouseMove(input);
    this.statusbar.setMousePosition(input);
    this.ruler.set(input);
  };

  mouseDownLeft = (input) => this.activeTool.mouseDownLeft(input);

  mouseDownRight = (input) => this.activeTool.mouseDownRight(input);

  mouseUpLeft = (input) => this.activeTool.mouseUpLeft(input);

  mouseUpRight = (input) => this.activeTool.mouseUpRight(input);

  handleWheel = (event) => this.activeWheel.handleWheel(event);
}
