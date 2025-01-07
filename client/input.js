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
        if (event.pointerType === "mouse" && event.button === 2) {
          this.mouseDown = true;
          this.x = Math.round(event.clientX);
          this.y = Math.round(event.clientY);
          toolbar.mouseDownRight(this);
        }
      }
    });

    document.addEventListener("pointerup", () => {
      clearTimeout(debounceTimeout);
      this.mouseDown = false;
      toolbar.mouseUpLeft(this);
      toolbar.mouseUpRight(this);
    });

    let debounceTimeout;

    document.addEventListener("pointermove", (event) => {
      clearTimeout(debounceTimeout);
      this.x = Math.round(event.clientX);
      this.y = Math.round(event.clientY);

      if (this.mouseDown && false) {
        toolbar.mouseMove(this);
      }
      //AGI: I originally used the if statement below to throttle the polling rate of the mouse. The throttling has it limitations which I think you were trying to over come with this if statement above. The only issue is that the event loop is blocked because toolbar.mouseMove() is blocking and gets called everytime there is a mouse move. I think throttling is necessary but I think the way I had done it was not really that good of an implementation. I think we should outline a list of issues here about mouse movements so that by the time we actually fix it we can remember all the problems we had with the mouse.

      // 1. When the cpu of the client is slow there can be glitching when the mousemove listener is allowed to call the move function everytime it can. Essentially the process queue gets backed up because all of the mouse render commands.

      // 2. because of mouse move works you can get it so that you mouse stops but the pencil line isn't under the cursor. It waits until the mouse either moves again or lift to complete.

      if (performance.now() - lastMove > 16) {
        toolbar.mouseMove(this);
        lastMove = performance.now();
      }

      debounceTimeout = setTimeout(() => {
        toolbar.mouseMove(this);
        lastMove = performance.now();
      }, 32);
    });
  }
}
