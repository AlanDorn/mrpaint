/*
Gonna try to eventually move any and all logic to do with cursor be in this class separated into two parts, might change this to cursorManager maybe but that might be over kill
For tool changes, the cursor logic will reside here to toolbar, later the userManagers "other users cursor" (currently circle) should be moved here? shore!
*/

//gotta move adjuster stuff here with cursor interaction (grab)
//eraser needs fine tuning for smaller sizes and maybe overall precision? => //TODO snapToCanvas()
//mess with the edge cases and remove border touching edge if eraser is being clipped,brain brr 

export default class cursorManager {
  constructor(virtualCanvas, toolbar) {
    this.virtualCanvas = virtualCanvas;
    this.colorpicker = toolbar.colorpicker;
    this.brushsize = toolbar.brushsize;
    this.canvas = this.virtualCanvas.canvas;

    this.activeBooton = document.getElementById("pencil");
    this.cursorPosition = { x: 0, y: 0 }; //ensure correct positioning of cursor icon.

    this.eraserSquare = this.makeEraserSquare();
    this.animationframes = 0;
    this.lastEvent = null;
    this.lastClientX, this.lastClientY, this.shiftedX, this.shiftedY = null;

    let drawing = false;
    const defaultCursor = "default";

    this.type = this.activeBooton.getAttribute("cursor-type").toLowerCase();
    this.canvas.style.cursor = this.setCanvasCursor(this.activeBooton, {x:3, y:20});//immediately show cursor on load,no M0ve

    this.canvas.addEventListener("pointerdown", (event) => {
      if (event.button === 0 || event.button === 2) {
        drawing = true;
      }
    });
    this.canvas.addEventListener("pointerup", (event) => {
      if (event.button === 0 || event.button === 2) {
        drawing = false;
      }
    });
    this.canvas.addEventListener("pointercancel", () => (drawing = false));
    
    //this.canvas.addEventListener("pointermove"  //document.body
    // document.body.addEventListener("pointermove", (event) => { //onpointermove = (event) https://developer.mozilla.org/en-US/docs/Web/API/Element/pointermove_event      <= syntax diff
    window.onpointermove = (event) => { //fugg it yo lyfe bro
      this.lastEvent = event;
      [this.lastClientX, this.lastClientY] = this.virtualCanvas.positionInCanvas(this.lastEvent.clientX, this.lastEvent.clientY);
      const inside = this.virtualCanvas.isScreenPointInside(event.clientX, event.clientY);
      
      if((this.type === "eraser") && !inside && (drawing || !drawing)){
        this.showEraser(false);
      } else 

      if (drawing || (inside && !drawing)) {
        this.canvas.style.cursor = this.getCursorForButton(this.activeBooton);
      } else if (!inside && !drawing) {
        this.canvas.style.cursor = defaultCursor;
        this.eraserSquare.style.display = "none";
      }
    };

    this.canvas.addEventListener("pointerleave", () => {
      // this.eraserSquare.style.display = "none";
      this.canvas.style.cursor = "default";
    });

    document.body.addEventListener("mousewheel", (event) => {
      const inside = this.virtualCanvas.isScreenPointInside(event.clientX, event.clientY);
      if((this.type === "eraser") && inside) this.showEraser(true);
      else if((this.type === "eraser") && !inside) this.showEraser(false);
    });

    ["primaryColorChange", "secondaryColorChange"].forEach((event) =>
      window.addEventListener(event, () => {
        if (this.eraserSquare.style.display !== "none") this.showEraser();
      })
    );  

    window.addEventListener("brushSizeChange", ({ detail: { size } }) => {
      this.brushsize.size = size;
      if (this.eraserSquare.style.display !== "none") this.showEraser();
    });
  }

  setCanvasCursor(button, cursorPosition) {
    this.activeBooton = button;
    this.type = this.activeBooton.getAttribute("cursor-type").toLowerCase();
    this.cursorPosition = cursorPosition; // ?? {x: 0, y: 0};
    return this.getCursorForButton(button);
  }

  getCursorForButton(button) {
    switch (this.type) {
      case "eraser":
        return this.showEraser();
      case "svg":
        this.eraserSquare.style.display = "none";
        return this.makeCursorFromButton(button);
      default:
        this.eraserSquare.style.display = "none";
        return "crosshair"; //all geometric tools, and most tools in general, have crosshair as cursor. There aren't that many tools with custom mouse icons/svgs...
    }
  }

  //ngl v!becoded this shit, trust it tho
  makeCursorFromButton(btn) {
    const svg = btn.querySelector("svg");

    // 1. Clone so we can safely tweak attributes
    const clone = svg.cloneNode(true);
    // Insert rect as the first child so it sits under everything else
    clone.setAttribute("width", 24); // make sure it has a size
    clone.setAttribute("height", 24);

    clone.setAttribute("fill", `rgb(${this.colorpicker.userColor})`);

    // 2. Serialize → base64 data-URI
    const str = new XMLSerializer().serializeToString(clone);
    const b64 = btoa(unescape(encodeURIComponent(str)));
    return `url("data:image/svg+xml;base64,${b64}") ${this.cursorPosition.x} ${this.cursorPosition.y}, auto`;
  }

  //ALAN Eraser isnt working like I want. The Eraser should be dynamically sized and changes when it meets the boundary of the canvas
  showEraser(force = true) {
    if (!this.lastEvent) return;
    if (this.animationframes) return;
    // if (this.animationframes && !force) return;

    this.animationframes = requestAnimationFrame(() => {
      this.animationframes = 0;

      //shift or shwifty
      //This was to center the eraser square to the mouse position in the screen space...
      // const s = Math.max(1, this.brushsize.size * this.virtualCanvas.zoom); //size + scale
      const brush = this.brushsize.size; //size vs scale
      //The following is in canvas space from calling positionInCanvas
      //this.lastClientX, this.lastClientY 


      //I think the .5 are needed so it lines up well, no bleeding over by 1px, for inequality
      //canvas space
      let edgeCanvas = {
        left: this.virtualCanvas.offset[0] + this.virtualCanvas.rect.left,
        right: this.virtualCanvas.offset[0] + this.virtualCanvas.width * this.virtualCanvas.zoom + this.virtualCanvas.rect.left - 0.5,
        top: this.virtualCanvas.offset[1] + this.virtualCanvas.rect.top,
        bottom: this.virtualCanvas.offset[1] + this.virtualCanvas.height * this.virtualCanvas.zoom + this.virtualCanvas.rect.top - 0.5,
      };

      let drawingareaCanvas = {
        left: this.virtualCanvas.rect.left,
        right: this.virtualCanvas.rect.right,
        top: this.virtualCanvas.rect.top,
        bottom: this.virtualCanvas.rect.bottom,
      }

      let eraserSquareWidth  = s;
      let eraserSquareHeight = s;
      let screenToCanvasPixelRatioHorizontal = (edgeCanvas.right-edgeCanvas.left)/this.virtualCanvas.width; 
      let screenToCanvasPixelRatioVertical = (edgeCanvas.bottom-edgeCanvas.top)/this.virtualCanvas.height; 
      
      //screen space
      // let mouseX = Math.round((this.lastEvent.clientX));// - s/2; //mouse@ the current center of eraserSquare x
      // let mouseY = Math.round((this.lastEvent.clientY));// - s/2; //mouse@ the current center of eraserSquare y

      //utilize canvas space from positionInCanvas
      this.shiftedX = this.lastClientX;
      this.shiftedY = this.lastClientY;

      //  console.log(`zoom: \t\t${this.virtualCanvas.zoom} \ns: \t\t${s}\nShifted: \t${this.shiftedX} ${this.shiftedY} \nmouse: \t${mouseX} ${mouseX} \noffset: \t${this.virtualCanvas.offset[0]} ${this.virtualCanvas.offset[1]} \nH_ratio:\t${(screenToCanvasPixelRatioHorizontal)} \nV_ratio:\t${(screenToCanvasPixelRatioVertical)} \neverything:\n\tLeft:${edgeCanvas.left} \n\tRight:${edgeCanvas.right} \n\tTop:${edgeCanvas.top} \n\tBottom:${edgeCanvas.bottom}\neverything2:\n\tLeft:${drawingareaCanvas.left} \n\tRight:${drawingareaCanvas.right} \n\tTop:${drawingareaCanvas.top} \n\tBottom:${drawingareaCanvas.bottom}\nMotherFucker:\t${help_me} ${help_me2}\nx/y: \t\t\t${this.lastClientX} ${this.lastClientY} 
      // // `);


      //CHECK DRAWABLE CANVAS EDGE AND
      [this.shiftedX, this.shiftedY, eraserSquareWidth, eraserSquareHeight] = this.edgeCheck(edgeCanvas, this.shiftedX, this.shiftedY, eraserSquareWidth, eraserSquareHeight);

      //CHECK drawingarea CANVAS EDGE to ensure eraser never bleeds over UI or rulers
      [this.shiftedX, this.shiftedY, eraserSquareWidth, eraserSquareHeight] = this.edgeCheck(drawingareaCanvas, this.shiftedX, this.shiftedY, eraserSquareWidth, eraserSquareHeight);
      
      if(eraserSquareWidth <= 0 || eraserSquareHeight <= 0){
        this.eraserSquare.style.border = "none";
        // return;
      }else{
        this.eraserSquare.style.border = "1px solid rgba(0, 0, 0, 0.99)";
      }
      this.eraserSquare.style.width = `${Math.max(0, eraserSquareWidth)}px`
      this.eraserSquare.style.height = `${Math.max(0, eraserSquareHeight)}px`;
      this.eraserSquare.style.background = `rgb(${this.colorpicker.secondarycolor})`;
      this.eraserSquare.style.transform = `translate(${this.shiftedX}px, ${this.shiftedY}px)`;
      this.eraserSquare.style.display = "block";

      //if the cursor is outside of the canvas, show the cursor so users can see where they at tho like irl, and to grab adjusters, force is set to false=show default at eventListener(pointerMove), force is default true
      if(force){
        this.canvas.style.cursor = "none";    
      }else{
        this.canvas.style.cursor = "default";
      }
    });
  }
  
  makeEraserSquare() {
    const div = document.createElement("div");
    Object.assign(div.style, {
      position: "fixed",
      left: "0",
      // right: "0",
      top: "0",
      // bottom: "0",
      // transform: "0",
      pointerEvents: "none",
      // zIndex: 50,
      border: "1px solid rgba(0, 0, 0, 1)",
      borderRadius: "0", // 50% for circle
      background: `rgb(${this.colorpicker.secondarycolor})`,
      display: "none",
      willChange: "transform,width,height",
    });
    document.body.appendChild(div);
    return div;
  }

  edgeCheck(edgeCanvas, shiftedX, shiftedY, eraserSquareWidth, eraserSquareHeight){
  
    //LEFT BORDER CHECK
      if(shiftedX < edgeCanvas.left){      
        eraserSquareWidth -= (edgeCanvas.left - shiftedX); 
        shiftedX = edgeCanvas.left;
      }       
      //RIGHT BORDER CHECK
      if((shiftedX + eraserSquareWidth) > edgeCanvas.right){
        eraserSquareWidth = Math.max(0, edgeCanvas.right - shiftedX); 
        //eraserSquareWidth = Math.max(0, s - (-1*(edgeCanvas.right - edgeEraser.right))); 
        // this.eraserSquare.style.width = eraserSquareWidth + "px";
      }
      //TOP BORDER CHECK
      if(shiftedY <= edgeCanvas.top){
        eraserSquareHeight -= (edgeCanvas.top - shiftedY);
        shiftedY = edgeCanvas.top;
      }
      //BOTTOM BORDER CHECK
      if((shiftedY + eraserSquareHeight) > edgeCanvas.bottom){
        eraserSquareHeight = Math.max(0, edgeCanvas.bottom - shiftedY);
      }

    return [shiftedX, shiftedY, eraserSquareWidth, eraserSquareHeight]; //brackets needed
  }
}
