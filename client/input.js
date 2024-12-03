export default class Input {
  constructor(pencil) {
    this.x = 0;
    this.y = 0;
    this.mouseDown = false;
    document.addEventListener("mousedown", () => {
      this.mouseDown = true;
      pencil.mouseDown(this);
    });
    document.addEventListener("mouseup", () => {
      this.mouseDown = false;
      pencil.mouseUp(this);
    });
    document.addEventListener("mousemove", (event) => {
      this.x = event.clientX;
      this.y = event.clientY;
      pencil.mouseMove(this);
    });
  }
}
