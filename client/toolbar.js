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

// Toolbar should be split up into components, so the brush size and the color picker are in a way there own components.
// There are the general tools like eraser fill and pencil, there will also
// be selection tools which will be it's own component.

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
  // /** @type {import('./transactionlog.js').default} */ transactionLog;
  // /** @type {import('./virtualcanvas.js').default} */ virtualCanvas;
  // /** @type {import('./previewmanager.js').default} */ previewManager;

  constructor({transactionLog, virtualCanvas, previewManager}) {
    this.transactionLog = transactionLog; 
    this.virtualCanvas = virtualCanvas; 
    this.previewManager = previewManager;

    this.colorpicker = new ColorPicker();
    this.brushsize = new BrushSize();
    
    this.pencil = new Pencil(transactionLog, virtualCanvas, this);
    this.eraser = new Eraser(transactionLog, virtualCanvas, this);
    this.fillTool = new FillTool(transactionLog, virtualCanvas, this);
    this.straightLine = new StraightLine(transactionLog, virtualCanvas, previewManager, this);

    this.undo = new Undo(transactionLog);
    this.viewport = new Viewport(transactionLog, virtualCanvas, this);
    this.statusbar = new StatusBar(virtualCanvas);
    this.ruler = new Ruler(virtualCanvas);
    this.cursor = new CursorManager(virtualCanvas, this);    


    //set the default tool to pencil
    this.activeSelector = null;
    this.setupToolSwitcher();

    this.activeWheel = this.viewport;
    this.activeTool = this.pencil;
    this.updateActiveButton(this.pencilButton);
    this.cursor.setCanvasCursor(this.pencilButton, {x:3, y:20}); //3,20 idfk

    this.drawingarea = document.getElementById("drawingarea");

    this.drawingarea.addEventListener("click", () => {
      this.activeSelector = null;
      this.activeWheel = this.viewport;
    });
  }

  setupToolSwitcher() {
    this.pencilButton = document.getElementById("pencil");
    this.eraserButton = document.getElementById("eraser");
    this.fillToolButton = document.getElementById("fillTool");
    this.undoButton = document.getElementById("undo");
    this.redoButton = document.getElementById("redo");
    this.brushSizeSelector = document.getElementById("brushsize");
    // this.drawingarea = document.getElementById("drawingarea");
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
  

  // updateActiveButton(activeButton) {
  //   document
  //     .querySelectorAll("#toolbar button, #toolbar button svg")
  //     .forEach((button) => button.classList.remove("active"));
  //   activeButton.classList.add("active");
  //   activeButton.querySelector("svg").classList.add("active");
  // }

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

//OLD1

// import BrushSize from "./brushsize.js";
// import ColorPicker from "./colorpicker.js";
// import Pencil from "./pencil.js";
// import Eraser from "./eraser.js";
// import FillTool from "./filltool.js";
// import Undo from "./undo.js";
// import Viewport from "./viewport.js";
// import StatusBar from "./statusbar.js";
// import Ruler from "./ruler.js";
// import StraightLine from "./straightLine.js";

// // Toolbar should be split up into components, so the brush size and the color picker are in a way there own components.
// // There are the general tools like eraser fill and pencil, there will also
// // be  selection tools which will be it's own component.

// // Currently toolbar is both the switcher and the general tools
// // How this will work is through a seperate classes: ToolSwitcher, General Tools, brushsize, color picker.

// // color picker and brush size have states which will need listening.
// // this will be implemented:
// // this.listeners = [] : will contain functions like void => void
// // and
// // this.listeners.forEach(listener => listener()) : whenever we change values

// // if something needs to listen they go:
// // obj.listeners.push(() => {use the obj here})

// // if listeners need to be added and removed do it like:

// // const listener = () => {}
// // obj.listeners.push(listener); adds listener
// // obj.listeners.splice(obj.listeners.indexOf(listener), 1) remove listener

// export default class Toolbar {
//   constructor() {
//     this.colorpicker = new ColorPicker();
//     this.brushsize = new BrushSize();
//     this.pencil = new Pencil();
//     this.eraser = new Eraser();
//     this.fillTool = new FillTool();
//     this.undo = new Undo();
//     // this is fine here since it needs brushsize and colorpicker at construct time. That won't be a problem later so no need to worry about the difference here. Basically we'll be importing all these just like we do in the client, except in a MrPaintTools class or something.
//     this.straightLine = new StraightLine(this);

//     this.viewport = new Viewport();
//     this.statusbar = new StatusBar();
//     this.ruler = new Ruler();

//     //set the default tool to pencil
//     this.activeTool = this.pencil;
//     this.activeWheel = this.viewport;

//     const pencilButton = document.getElementById("pencil");
//     this.updateActiveButton(pencilButton);

//     const drawingarea = document.getElementById("drawingarea");
//     drawingarea.addEventListener("click", () => {
//       this.activeWheel = this.viewport;
//     });
//   }

//   updateActiveButton(activeButton) {
//     document
//       .querySelectorAll("#toolbar button, #toolbar button svg")
//       .forEach((button) => button.classList.remove("active"));
//     activeButton.classList.add("active");
//     activeButton.querySelector("svg").classList.add("active");
//   }

//   mouseMove = (input) => {
//     this.activeTool.mouseMove(input);
//     this.statusbar.setMousePosition(input);
//     this.ruler.set(input);
//   };

//   mouseDownLeft = (input) => this.activeTool.mouseDownLeft(input);

//   mouseDownRight = (input) => this.activeTool.mouseDownRight(input);

//   mouseUpLeft = (input) => this.activeTool.mouseUpLeft(input);

//   mouseUpRight = (input) => this.activeTool.mouseUpRight(input);

//   handleWheel = (event) => this.activeWheel.handleWheel(event);
// }


//OLD2

// import BrushSize from "./brushsize.js";
// import ColorPicker from "./colorpicker.js";

// import Pencil from "./pencil.js";
// import Eraser from "./eraser.js";
// import FillTool from "./filltool.js";
// import StraightLine from "./straightLine.js";

// import CursorManager from "./cursorManager.js";
// import Undo from "./undo.js";
// import Viewport from "./viewport.js";
// import StatusBar from "./statusbar.js";
// import Ruler from "./ruler.js";

// export default class Toolbar {
//   constructor(transactionLog, previewManager, virtualCanvas) {
//     this.previewManager = previewManager;
//     this.virtualCanvas = virtualCanvas;

//     this.colorpicker = new ColorPicker();
//     this.brushsize = new BrushSize();
//     this.pencil = new Pencil(virtualCanvas, transactionLog, this);
//     this.eraser = new Eraser(virtualCanvas, transactionLog, this);
//     this.fillTool = new FillTool(virtualCanvas, transactionLog, this);
//     this.viewport = new Viewport(virtualCanvas, transactionLog, this);
//     this.straightLine = new StraightLine(virtualCanvas, transactionLog, previewManager, this);

//     this.cursor = new CursorManager(virtualCanvas, this);
//     this.undo = new Undo(transactionLog);
//     this.statusbar = new StatusBar(virtualCanvas);
//     this.ruler = new Ruler(virtualCanvas);
    

//     this.activeSelector = null;
//     this.setupToolSwitcher();

//     //set the default tool to pencil
//     this.activeTool = this.pencil;
//     this.updateActiveButton(this.pencilButton);
//     this.cursor.setCanvasCursor(this.pencilButton, {x:3, y:20}); //3,20 idfk
//   }

//   setupToolSwitcher() {
//     this.pencilButton = document.getElementById("pencil");
//     this.eraserButton = document.getElementById("eraser");
//     this.fillToolButton = document.getElementById("fillTool");
//     this.undoButton = document.getElementById("undo");
//     this.redoButton = document.getElementById("redo");
//     this.brushSizeSelector = document.getElementById("brushsize");
//     this.drawingarea = document.getElementById("drawingarea");
//     this.straightLineButton = document.getElementById("straightLine");
    
//     this.undoButton.addEventListener("click", () => {
//       this.undo.undo();
//     });

//     this.redoButton.addEventListener("click", () => {
//       this.undo.redo();
//     });

//     this.pencilButton.addEventListener("click", () => {
//       this.activeTool = this.pencil;
//       this.updateActiveButton(this.pencilButton);
//       this.cursor.setCanvasCursor(this.pencilButton, {x:3, y:20}); //2px by 22px (x & y)
//     });

//     this.eraserButton.addEventListener("click", () => {
//       this.activeTool = this.eraser;
//       this.updateActiveButton(this.eraserButton);
//       this.cursor.setCanvasCursor(this.eraserButton, {x:0, y:0});
//     });

//     this.straightLineButton.addEventListener("click", () => {
//       this.activeTool = this.straightLine;
//       this.updateActiveButton(this.straightLineButton);
//       this.cursor.setCanvasCursor(this.straightLineButton, {x:0, y:0});
//     });

//     this.fillToolButton.addEventListener("click", () => {
//       this.activeTool = this.fillTool;
//       this.updateActiveButton(this.fillToolButton);
//       this.cursor.setCanvasCursor(this.fillToolButton, {x:2, y:21});
//     });

//     this.brushSizeSelector.addEventListener("click", () => {
//       this.activeSelector = this.brushsize;
//       this.activeReason = "click";
//     });

//     this.brushSizeSelector.addEventListener("mouseenter", () => {
//       this.activeSelector = this.brushsize;
//       this.activeReason = "mouseenter";
//     });

//     this.brushSizeSelector.addEventListener("mouseleave", () => {
//       if (this.activeReason === "mouseenter") this.activeSelector = null;
//     });

//     this.drawingarea.addEventListener("click", () => {
//       this.activeSelector = null;
//     });

//     this.viewport.widthAdjuster.addEventListener("mousedown", (event) => {
//       if (this.activeTool == this.viewport) return;
//       this.viewport.activeAdjuster = this.viewport.widthAdjuster;
//       this.viewport.lastActiveTool = this.activeTool;
//       this.activeTool = this.viewport;
//     });

//     this.viewport.heightAdjuster.addEventListener("mousedown", (event) => {
//       if (this.activeTool == this.viewport) return;
//       this.viewport.activeAdjuster = this.viewport.heightAdjuster;
//       this.viewport.lastActiveTool = this.activeTool;
//       this.activeTool = this.viewport;
//     });

//     this.viewport.bothAdjuster.addEventListener("mousedown", (event) => {
//       if (this.activeTool == this.viewport) return;
//       this.viewport.activeAdjuster = this.viewport.bothAdjuster;
//       this.viewport.lastActiveTool = this.activeTool;
//       this.activeTool = this.viewport;
//     });

//     document.addEventListener("mousedown", (event) => {
//       if (event.button === 1) {
//         this.viewport.startPosition[0] = event.clientX;
//         this.viewport.startPosition[1] = event.clientY;

//         this.viewport.activeAdjuster = this.viewport.middleMouseAdjuster;
//         this.viewport.lastActiveTool = this.activeTool;
//         this.activeTool = this.viewport;
//       }
//     });
//   }

//   updateActiveButton(activeButton) {
//     const buttons = document.querySelectorAll("#toolbar button");
//     const svgs = document.querySelectorAll("#toolbar button svg");

//     buttons.forEach((button) => button.classList.remove("active"));
//     activeButton.classList.add("active");

//     svgs.forEach((button) => button.classList.remove("active"));
//     const activeSvg = activeButton.querySelector("svg");

//     activeSvg.classList.add("active");
//   }

//   mouseDownLeft(input) {
//     this.activeTool.mouseDownLeft(input);
//   }

//   mouseDownRight(input) {
//     this.activeTool.mouseDownRight(input);
//   }

//   mouseUpLeft(input) {
//     this.activeTool.mouseUpLeft(input);
//   }

//   mouseUpRight(input) {
//     this.activeTool.mouseUpRight(input);
//   }

//   mouseMove(input) {
//     this.activeTool.mouseMove(input);
//     this.statusbar.setMousePosition(input);
//     this.ruler.set(input);
//   }
// }

