export default class Input {
  constructor(toolbar) {
    this.x = 0;
    this.y = 0;
    this.mouseDown = false;
    document.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      //console.log(
      //  "disabled right click menu, aren't you glad you found out it is CNTRL-SHIFT-I?"
      //); // try CNTRL-SHIFT-I
    });


    //maybe switch to a swith case statement
    document.addEventListener("mousedown", (event) => {
      if (event.button === 0) {   
        //0 = left, 1 = middle, 2 = right
        this.mouseDown = true;
        toolbar.mouseDownLeft(this);
        
      }
      if (event.button === 2) {
        this.mouseDown = true;
        toolbar.mouseDownRight(this);
        
      }
    });

    document.addEventListener("mouseup", () => {
        this.mouseDown = false;
        toolbar.mouseUpLeft(this);
        this.mouseDown = false;
        toolbar.mouseUpRight(this);
      
    });
    document.addEventListener("mousemove", (event) => {
      this.x = Math.round(event.clientX);
      this.y = Math.round(event.clientY);
      toolbar.mouseMove(this);
    });
  }
}
