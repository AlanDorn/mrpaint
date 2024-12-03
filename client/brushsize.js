class BrushSize {
  constructor() {
    this.size = 1;

    const brushSizeDropdown = document.getElementById("default-sizes");
    brushSizeDropdown.addEventListener("change", (event) => {
      const newBrushSize = parseInt(event.target.value, 10);
      this.setBrushSize(newBrushSize);
    });
  }

  setBrushSize(newSize) {
    this.size = newSize;
  }
}

export default BrushSize;
