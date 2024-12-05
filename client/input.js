export default class Input {
  constructor(pencil) {
    this.x = 0;
    this.y = 0;
    this.mouseDown = false;
    document.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      console.log(
        "disabled right click menu, aren't you glad you found out it is CNTRL-SHIFT-I?"
      ); // try CNTRL-SHIFT-I
    });

    //maybe switch to a swith case statement
    document.addEventListener("mousedown", (event) => {
      if (event.button === 0) {
        console.log("left click"); //0 = left, 1 = middle, 2 = right
        this.mouseDown = true;
        pencil.mouseDownLeft(this);
      }
      if (event.button === 2) {
        console.log("right click");
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
    document.addEventListener("mousemove", (event) => {
      this.x = event.clientX;
      this.y = event.clientY;
      pencil.mouseMove(this);
    });
  }
}
