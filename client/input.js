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
