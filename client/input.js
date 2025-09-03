export default class Input {
  constructor({virtualCanvas, toolbar}) {
    this.virtualCanvas = virtualCanvas;
    this.toolbar = toolbar; //8/2/2025
    this.x = 0;
    this.y = 0;
    this.mouseDown = false;

    let canvas = document.getElementById("myCanvas");

    document.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });

    document.addEventListener("pointerdown", (event) => {
      if (event.target === canvas) {
        //check so that click is on canvas, if on menu or outside stop beotch!
        if (
          (event.button === 0 && event.pointerType === "mouse") ||
          event.pointerType === "touch"
        ) {
          // 0 = left, 1 = middle, 2 = right
          this.mouseDown = true;
          this.x = Math.round(event.clientX);
          this.y = Math.round(event.clientY);
          this.toolbar.mouseDownLeft(this);
        }
        if (event.button === 2 && event.pointerType === "mouse") {
          this.mouseDown = true;
          this.x = Math.round(event.clientX);
          this.y = Math.round(event.clientY);
          this.toolbar.mouseDownRight(this);
        }
      }
    });

    document.addEventListener("pointerup", () => {
      this.mouseDown = false;
      this.toolbar.mouseUpLeft(this);
      this.toolbar.mouseUpRight(this);
    });

    let updateMouse = true;
    const update = () => {
      updateMouse = true;
      requestAnimationFrame(update);
    }
    update()

    document.addEventListener("pointermove", (event) => {
      this.x = Math.round(event.clientX);
      this.y = Math.round(event.clientY);
      if (updateMouse) {
        this.toolbar.mouseMove(this);
        updateMouse = false;
      }
    });

    document.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        //CALM: This should be handled by the this.toolbar instead of here.
        if (this.toolbar.activeSelector == null) {
          this.toolbar.viewport.handleWheel(event);
        } else {
          this.toolbar.brushsize.handleWheel(event);
        }
      },
      { passive: false } // Makes preventDefault() work
    );
  }
}
