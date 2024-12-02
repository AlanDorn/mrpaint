class ColorPicker {
  constructor() {
    this.color = [0, 0, 0];
    //HECTIC: This needs to include some sort of pallet as well as a primary and secondary color.
    const colorPicker = document.getElementById("colorPicker");
    // Update on color change
    colorPicker.addEventListener(
      "input",
      () => (this.color = hexToRgb(colorPicker.value))
    );
  }
}

function hexToRgb(hex) {
  const bigint = parseInt(hex.slice(1), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return [r, g, b];
}

export default ColorPicker;
