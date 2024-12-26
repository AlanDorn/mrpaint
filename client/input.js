export default class Input {
  constructor(toolbar) {
    this.x = 0;
    this.y = 0;
    this.mouseDown = false;

    let lastMove = performance.now();
    let canvas = document.getElementById("myCanvas");

    document.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });

    document.addEventListener("pointerdown", (event) => {
      if (event.target === canvas) {//check so that click is on canvas, if on menu or outside stop beotch!
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
        if (event.pointerType === "mouse" && event.button === 2) {
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

    document.addEventListener("pointermove", (event) => {
      this.x = Math.round(event.clientX);
      this.y = Math.round(event.clientY);

      if (this.mouseDown) {
        toolbar.mouseMove(this);
      }
      if (performance.now() - lastMove > 32) {
        toolbar.mouseMove(this);
        lastMove = performance.now();
      }
    });
  }
}
