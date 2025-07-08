export default class Input {
  constructor(toolbar) {
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
          toolbar.mouseDownLeft(this);
        }
        if (event.button === 2 && event.pointerType === "mouse") {
          this.mouseDown = true;
          this.x = Math.round(event.clientX);
          this.y = Math.round(event.clientY);
          toolbar.mouseDownRight(this);
        }
      }
    });

    document.addEventListener("pointerup", () => {
      this.mouseDown = false;
      toolbar.mouseUpLeft(this);
      toolbar.mouseUpRight(this);
    });

    let updateMouse = true;
    setInterval(() => {
      updateMouse = true
    }, 60 / 1000);

    document.addEventListener("pointermove", (event) => {
      this.x = Math.round(event.clientX);
      this.y = Math.round(event.clientY);
      if (updateMouse) {
        toolbar.mouseMove(this);
        updateMouse = false;
      }
    });

    document.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        //CALM: This should be handled by the toolbar instead of here.
        if (toolbar.activeSelector == null) {
          toolbar.viewport.handleWheel(event);
        } else {
          toolbar.brushsize.handleWheel(event);
        }
      },
      { passive: false } // Makes preventDefault() work
    );
  }
}
