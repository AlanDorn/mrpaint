class BrushSize {
  constructor() {
    this.size = 1;

    const brushSizeDropdown = document.getElementById("default-sizes");
    brushSizeDropdown.addEventListener("change", (event) => {
      const newBrushSize = parseInt(event.target.value, 10);
      this.setBrushSize(newBrushSize);
    });
  }

  setDefaultSizes(...sizes) {
    // CALM: If we want to stay true to ms paint, (if), we would need a way to change the values for the dropdown. Tools, such as pencil, will set the default brush sizes when the tools are first selected by the user. So when the user clicks pencil the pencil class will set the default sizes.
  }

  setBrushSize(newSize) {
    this.size = newSize;
  }
}

export default BrushSize;
