class Input {
  constructor() {
    this.mousedown = false;
    document.addEventListener("mousedown", () => (this.mousedown = true));
    document.addEventListener("mouseup", () => (this.mousedown = false));
  }
}

export default Input;
