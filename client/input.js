export default class Input {
  constructor(toolbar) {
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
    const update = () => {
      updateMouse = true;
      requestAnimationFrame(update);
    }
    update()

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

//OLD1
/*
import { virtualCanvas, toolbar } from "./client.js";

const MOUSE_MOVE_MS = 8;
export default class Input {
  constructor() {
    this.x = 0;
    this.y = 0;
    let didMove = false;

    setInterval(() => {
      if (!didMove) return;
      toolbar.mouseMove({ ...this });
      didMove = false;
    }, MOUSE_MOVE_MS);

    document.addEventListener("pointermove", (event) => {
      this.x = event.clientX;
      this.y = event.clientY;
      didMove = true;
    });

    // prevent right click options
    document.addEventListener("contextmenu", (event) => event.preventDefault());

    //check clicks on canvas, if on menu or outside stop beotch! (bitch!)
    virtualCanvas.canvas.addEventListener("pointerdown", (event) => {
      let leftClick = event.button === 0;
      leftClick &&= event.pointerType === "mouse";
      leftClick ||= event.pointerType === "touch";
      if (leftClick) toolbar.mouseDownLeft({ ...this });

      let rightClick = event.button === 2;
      rightClick &&= event.pointerType === "mouse";
      if (rightClick) toolbar.mouseDownRight({ ...this });
    });

    document.addEventListener("pointerup", () => {
      toolbar.mouseUpLeft({ ...this });
      toolbar.mouseUpRight({ ...this });
    });

    document.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        toolbar.handleWheel(event);
      },
      { passive: false } // Makes preventDefault() work
    );
  }
}
*/