export default class Input {
  constructor(pencil) {
    this.x = 0;
    this.y = 0;
    this.mouseDown = false;

    // Throttle utility function
    const throttle = (func, limit) => {
      let lastFunc;
      let lastRan;
      return function (...args) {
        const context = this;
        if (!lastRan) {
          func.apply(context, args);
          lastRan = Date.now();
        } else {
          clearTimeout(lastFunc);
          lastFunc = setTimeout(() => {
            if (Date.now() - lastRan >= limit) {
              func.apply(context, args);
              lastRan = Date.now();
            }
          }, limit - (Date.now() - lastRan));
        }
      };
    };

    document.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });

    document.addEventListener("mousedown", (event) => {
      if (event.button === 0) {
        // 0 = left, 1 = middle, 2 = right
        this.mouseDown = true;
        pencil.mouseDownLeft(this);
      }
      if (event.button === 2) {
        this.mouseDown = true;
        pencil.mouseDownRight(this);
      }
    });

    document.addEventListener("mouseup", () => {
      this.mouseDown = false;
      pencil.mouseUpLeft(this);
      this.mouseDown = false;
      pencil.mouseUpRight(this);
    });

    // Throttled pointermove handler
    const throttledPointerMove = throttle((event) => {
      this.x = Math.round(event.clientX);
      this.y = Math.round(event.clientY);
      pencil.mouseMove(this);
    }, 16.67); // Limit to ~60 Hz (1000ms / 60)

    document.addEventListener("pointermove", throttledPointerMove);
  }
}
