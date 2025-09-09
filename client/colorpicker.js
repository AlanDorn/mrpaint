export default class ColorPicker {
  constructor() {
    this.primarycolor = [0, 0, 0];
    this.secondarycolor = [255, 255, 255];
    this.userColor = [
      Math.floor(Math.random() * 256),
      Math.floor(Math.random() * 256),
      Math.floor(Math.random() * 256),
    ];
    //TODO I think I want to make it so that for hovering the individual colors, the names show
    this.staticPalette = [
      //switch to map??? maybe... maybe not??
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
    ];
    this.editPalette = [
      [255, 255, 255], //     Need to add functionality to save custom colors to the blank bank,
      [255, 255, 255], //     how exactly to do that with the current color picker? New color Picker?
      [255, 255, 255], // ima keep this until i think of a better solution, but these arent even needed...
      [255, 255, 255], // just need 10 elements in the array, prob can be empty...
      [255, 255, 255],
      [255, 255, 255],
      [255, 255, 255],
      [255, 255, 255],
      [255, 255, 255],
      [255, 255, 255],
    ];

    //so I need to separate the "blank values and prolly have them (invisibly extend so they are 3 rows, then append those blank 3 rows to the actual color palette, gotta tweak values for the UI portion so that a 3xn row x column way fits perfectly in the main UI top block. So if a square is 10x10, it has an internal and external border of like 1 or 2 px right?

    this.primaryPicker = document.getElementById("primaryPicker");
    this.secondaryPicker = document.getElementById("secondaryPicker");
    this.userColorPicker = document.getElementById("userColorPicker");

    const condensed = document.getElementById("colorpalette-condensed");
    this.dropdown = document.getElementById("paletteDropdown");
    const toggle = document.getElementById("paletteToggle");

    this.userColorPicker.value = rgbToHex(this.userColor);

    this.colorpalette = document.getElementById("colorpalette");
    this.addColorToPalette(this.userColorPicker.value);

    this.initPickers();
    this.initPalette();

    

    // render the dropdown version of the palette
    this.renderPalette(this.dropdown);

    //bruh moment, these two freaking eventlisteners all that was needed for saving own coloros...
    this.primaryPicker.addEventListener("change", (event) => {
      if (this.checkColorNotInPalette(event.target.value))
        this.addColorToPalette(event.target.value);
    });
    this.secondaryPicker.addEventListener("change", (event) => {
      if (this.checkColorNotInPalette(event.target.value)) 
        this.addColorToPalette(event.target.value);
    });
    //should the userColorPicker affect the colorPalette?
    this.userColorPicker.addEventListener("change", (event) => {   
      if (this.checkColorNotInPalette(event.target.value))   //should the color be automatically placed into colorPalette?
        this.addColorToPalette(event.target.value);
    });

    // toggle open/close
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      condensed.classList.toggle("active");
    });

    // keep it open if clicking inside
    this.dropdown.addEventListener("click", (e) => e.stopPropagation());

    // close when clicking anywhere else
    document.addEventListener("click", (e) => {
      if (!condensed.contains(e.target) && e.target !== toggle) {
        condensed.classList.remove("active");
      }
    });
  }

  initPickers() {
    // On change, parse to RGB
    this.primaryPicker.addEventListener("input", () => {
      this.primarycolor = hexToRgb(this.primaryPicker.value);
      this.communicateColor(this.primarycolor, "primaryColorChange");
    });
    this.secondaryPicker.addEventListener("input", () => {
      this.secondarycolor = hexToRgb(this.secondaryPicker.value);
      this.communicateColor(this.secondarycolor, "secondaryColorChange");
    });
    this.userColorPicker.addEventListener("input", () => {
      this.userColor = hexToRgb(this.userColorPicker.value);
      this.communicateColor(this.userColor, "userColorChange");
    });
  }

  initPalette() {
    this.renderPalette(this.colorpalette);
  }

  renderPalette(container) {
    // Clear out any old content
    container.innerHTML = "";

    // Create a swatch <div> for each color in the palette
    this.staticPalette.forEach((rgb) => {
      const colorBox = document.createElement("div");
      colorBox.classList.add("swatch");
      colorBox.style.backgroundColor = rgbToHex(rgb);

      //set primary/secondary/user color to this swatch
      colorBox.addEventListener("pointerdown", (event) => {
        if (event.button === 0) {
          //left mouse click
          this.primarycolor = rgb;
          this.primaryPicker.value = rgbToHex(rgb);
          this.communicateColor(this.primarycolor, "primaryColorChange");
        } else if (event.button === 1) {
          //middle mouse click
          this.userColor = rgb;
          this.userColorPicker.value = rgbToHex(rgb);
          this.communicateColor(this.userColor, "userColorChange");
        } else if (event.button === 2) {
          //right mouse click
          this.secondarycolor = rgb;
          this.secondaryPicker.value = rgbToHex(rgb);
          this.communicateColor(this.secondarycolor, "secondaryColorChange");
        }
      });
      container.appendChild(colorBox);
    });

    this.editPalette.forEach(() => {
      var root = document.querySelector(`:root`); //grab the lightmode/darkmode variables beach basket
      var lightAndDark = getComputedStyle(root); //make the editablePallette light/dark mode beotch

      const colorBox = document.createElement("div");
      colorBox.classList.add("swatchEdit");
      colorBox.style.backgroundColor = lightAndDark.getPropertyValue(`--background`);
      colorBox.style.cursor = "default";

      container.appendChild(colorBox);
    });
  }

  //TODO fix this temporary bandage of a fix to the adding colors to the pallete, coming up with an easy solution to undo unwanted colors is a lil tricky? all mouse base options (mousebtn 0,1,2) are being used primary/secondary/user, but maybe double clicking mouse will remove specific swatches? Or have a lil menu button on right click that says delete x

  //wait wtf, I didn't even check before writing the above line TODO comment yesterday, realize it but this the same shit that mspaint does and this is stoopid still, a better solution will exists!

  //check against duplicate colors
  checkColorNotInPalette(color) {
    let rgbColor = Array.isArray(color) ? color : hexToRgb(color);

    for (let i = 0; i < this.staticPalette.length; i++) {
      // console.log(`${rgbColor} AND ${this.staticPalette[i]}`);

      // if(rgbColor === this.staticPalette[i]){
      if (
        rgbColor[0] === this.staticPalette[i][0] &&
        rgbColor[1] === this.staticPalette[i][1] &&
        rgbColor[2] === this.staticPalette[i][2]
      ) {
        // console.log("TRUE MOTHER FreaKER");
        return false;
      }
    }

    return true;
  }

  addColorToPalette(color) {
    // color can be an [r,g,b] or a hex string
    if (this.editPalette.length === 0) {
      this.staticPalette.splice(20, 1); //good enough for now...
    }
    let rgbColor = Array.isArray(color) ? color : hexToRgb(color);
    //srry if u find this, i was lazy, ill come back & fix it i promise
    this.staticPalette.push(rgbColor); //LOL, so instead of doing something, i did turkish life hack
    this.editPalette.pop(); //hax till it spills over, hopefully mfs dont change colors > 10 times...

    this.renderPalette(this.colorpalette);
    this.renderPalette(this.dropdown);
  }

  //message is "userColourChange" "primaryColorChange" "secondaryColorChange"
  communicateColor(rgbColor, message) {
    window.dispatchEvent(
      new CustomEvent(`${message}`, {
        detail: { rgb: rgbColor },
      })
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

function rgbToHex([r, g, b]) {
  // clamp 0–255 if needed
  return (
    "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()
  );
}

// attempt at make a closure but it mightve been overkill and not practical
//https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures
// function communicateColor(message) {  //message is "userColourChange" "primaryColorChange" "secondaryColorChange"
//   return function (rgbColor) {
//     console.log(`${message} ${rgbColor}`);
//     return dispatchEvent(new CustomEvent(`${message}`, {
//         detail: { rgb: rgbColor },
//       }));
//     }
// }
