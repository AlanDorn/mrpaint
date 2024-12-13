export default class Input {
  constructor(pencil) {
    this.x = 0;
    this.y = 0;
    this.mouseDown = false;

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

    

    let lastMove = performance.now();
    document.addEventListener("pointermove", (event) => {
      this.x = Math.round(event.clientX);
      this.y = Math.round(event.clientY);
      if(performance.now() - lastMove > 16){
        pencil.mouseMove(this);
        lastMove = performance.now();
      }
    });
  }
}
