export default class ColorPicker {
  constructor() {
    this.primarycolor = [0, 0, 0];
    this.secondarycolor = [255, 255, 255];
    this.userColor = [109, 109, 109];
    this.palette = [
      [0, 0, 0], //black
      [127, 127, 127], //gray/grey
      [136, 0, 21], //dark red
      [237, 28, 36], //red
      [255, 127, 39], //orange
      [255, 242, 0], //yellow
      [34, 177, 76], //green
      [0, 162, 232], //light blue
      [63, 72, 204], //indigo blue
      [163, 73, 164], //purple        --cut
      [255, 255, 255], //white         --next line
      [195, 195, 195], //light grey
      [185, 122, 87], //brown
      [255, 174, 201], //pinky winky
      [255, 201, 14], //cream orange
      [239, 228, 176], //tan
      [181, 230, 29], //puke baby green
      [153, 217, 234], //light blue
      [112, 146, 190], //marine blue?
      [200, 191, 231], //light purp
      [255, 255, 255], //TODO Need to makes these blank and make sure the blank dont break the code
      [255, 255, 255], //     Need to add functionality to save custom colors to the blank bank,
      [255, 255, 255], //     how exactly to do that with the current color picker? New color Picker?
      [255, 255, 255],
      [255, 255, 255],
      [255, 255, 255],
      [255, 255, 255],
      [255, 255, 255],
      [255, 255, 255],
      [255, 255, 255],
    ];

    this.initPickers();
    this.initPalette();

    const condensed = document.getElementById("colorpalette-condensed");
    const dropdown = document.getElementById("paletteDropdown");
    const toggle = document.getElementById("paletteToggle");

    // render the dropdown version of the palette
    this.renderPalette(dropdown);

    // toggle open/close
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      condensed.classList.toggle("active");
    });

    // keep it open if clicking inside
    dropdown.addEventListener("click", (e) => e.stopPropagation());

    // close when clicking anywhere else
    document.addEventListener("click", (e) => {
      if (!condensed.contains(e.target) && e.target !== toggle) {
        condensed.classList.remove("active");
      }
    });
  }

  getUserColor() {
    return this.userColor;
  }

  initPickers() {
    const primaryPicker = document.getElementById("primaryPicker"); //MAYHEM I think the getElementById should be moved to toolbar class? because it exists in the toolbar?
    const secondaryPicker = document.getElementById("secondaryPicker");

    const userColor = document.getElementById("userColor");

    // On change, parse to RGB
    primaryPicker.addEventListener("input", () => {
      this.primarycolor = hexToRgb(primaryPicker.value);
    });
    secondaryPicker.addEventListener("input", () => {
      this.secondarycolor = hexToRgb(secondaryPicker.value);
    });
    userColor.addEventListener("input", () => {
      this.userColor = hexToRgb(userColor.value);
      if (window.sendColorUpdate) window.sendColorUpdate(this.userColor);
    });
  }

  initPalette() {
    const colorpalette = document.getElementById("colorpalette");
    this.renderPalette(colorpalette);
  }

  renderPalette(container) {
    // Clear out any old content
    container.innerHTML = "";

    // Create a swatch <div> for each color in the palette
    this.palette.forEach((rgb) => {
      const colorBox = document.createElement("div");
      colorBox.classList.add("swatch");
      colorBox.style.backgroundColor = rgbToHex(rgb);

      colorBox.addEventListener("pointerdown", (event) => {
        if (event.button === 0) {
          //left mouse click
          //set primary color to this swatch
          this.primarycolor = rgb;
          const primaryPicker = document.getElementById("primaryPicker"); // update your color input
          primaryPicker.value = rgbToHex(rgb);
        } else if (event.button === 1) {
          //middle mouse click

          this.userColor = rgb;
          const userColor = document.getElementById("userColor");
          userColor.value = rgbToHex(rgb);
          if (window.sendColorUpdate) window.sendColorUpdate(this.userColor);
        } else if (event.button === 2) {
          //right mouse click

          this.secondarycolor = rgb;
          const secondaryPicker = document.getElementById("secondaryPicker");
          secondaryPicker.value = rgbToHex(rgb);
        }
      });
      container.appendChild(colorBox);
    });
  }

  // Optionally a function to add a new color to the palette
  addColorToPalette(color) {
    // color can be an [r,g,b] or a hex string
    let rgbColor = Array.isArray(color) ? color : hexToRgb(color);

    // Add to array and re-render
    this.palette.push(rgbColor);

    const colorpalette = document.getElementById("colorpalette");
    this.renderPalette(colorpalette);
  }
}

function hexToRgb(hex) {
  const bigint = parseInt(hex.slice(1), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return [r, g, b];
}

function rgbToHex([r, g, b]) {
  // clamp 0–255 if needed
  return (
    "#" +
    ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()
  );
}
