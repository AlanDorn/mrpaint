export default class ColorPicker {
  constructor() {
    this.primarycolor = [0, 0, 0];
    this.secondarycolor = [255, 255, 255];
    this.palette = [];

    //HECTIC: This needs to include some sort of pallet as well as a primary and secondary color.
    const primaryPicker = document.getElementById("primaryPicker");
    const secondaryPicker = document.getElementById("secondaryPicker");

    // Update on color change
    primaryPicker.addEventListener(
      "input",
      () => (this.primarycolor = hexToRgb(primaryPicker.value))
    );
    secondaryPicker.addEventListener(
      "input",
      () => (this.secondarycolor = hexToRgb(secondaryPicker.value))
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
