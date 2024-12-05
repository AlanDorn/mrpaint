export default class ColorPicker {
  constructor() {
    this.primarycolor = [0, 0, 0];
    this.secondarycolor = [255, 255, 255];
    this.palette = [];

    //HECTIC: This needs to include some sort of pallet as well as a primary and secondary color.
    const colorPicker = document.getElementById("colorPicker");
    const colorPicker2 = document.getElementById("colorPicker2");

    // Update on color change
    colorPicker.addEventListener(
      "input",
      () => (this.primarycolor = hexToRgb(colorPicker.value))
    );
    colorPicker2.addEventListener(
      "input",
      () => (this.secondarycolor = hexToRgb(colorPicker2.value))
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
