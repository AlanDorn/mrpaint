export default class BrushSize {
  constructor() {
    this.size = 1;
    this.maxSize = 400;

    const dropdown = document.querySelector(".custom-dropdown-brushsize-box");
    const input = document.getElementById("customInputBrushsizeBox");
    const dropdownList = document.getElementById("dropdownOptions");
    const previewLength = 110; // Fixed length for all previews

    //TODO change cursor to brushsize

    // Function to update the input background for line preview
    const updateInputPreview = (size) => {
      if (!input.value.trim()) {
        input.style.backgroundImage = "none"; // Hide line preview if input is empty
        input.placeholder = "Enter brush size..."; // Show placeholder
      } else {
        input.placeholder = ""; // Remove placeholder when there's input
        input.style.backgroundImage =
          "linear-gradient(to right, var(--secondary) 0%, var(--secondary) 100%)";
        input.style.backgroundSize = `${previewLength}px ${size}px`; // Fixed length, dynamic height
        input.style.backgroundPosition = `35px`; // Align to the right
      }
    };

    // Helper to sanitize input
    const sanitizeInput = (value) => {
      let parsedValue = parseInt(value, 10);
      if (isNaN(parsedValue) || parsedValue <= 0) return null;
      if (parsedValue > this.maxSize) parsedValue = this.maxSize;
      return parsedValue;
    };

    const adjustBrushSize = (event) => {
      let currentValue = sanitizeInput(input.value) || 1;
      let newValue = currentValue + event;

      if (newValue < 1) newValue = 1;
      if (newValue > this.maxSize) newValue = this.maxSize;

      input.value = `${newValue}`;
      this.setBrushSize(newValue);
      updateInputPreview(newValue);
    };

    // Toggle dropdown visibility
    const toggleDropdown = () => {
      dropdownList.classList.toggle("show");
    };

    // Close dropdown
    const closeDropdown = (event) => {
      if (!dropdown.contains(event.target)) {
        dropdownList.classList.remove("show");
      }
    };

    // Handle selection from dropdown
    const handleSelection = (event) => {
      if (event.target.classList.contains("dropdown-item")) {
        const value = sanitizeInput(event.target.dataset.value);
        input.value = `${value}`;
        this.setBrushSize(value);
        updateInputPreview(value);
        dropdownList.classList.remove("show");
      }
    };

    // Handle manual input
    const handleInput = () => {
      const sanitizedValue = sanitizeInput(input.value.replace(/[^0-9]/g, ""));

      if (sanitizedValue === null) {
        // If input is empty, reset to placeholder but keep size = 1
        input.value = ""; // Clear the input
        updateInputPreview(null);
        this.setBrushSize(1); // Default value remains 1 internally
      } else {
        // Valid input
        input.value = `${sanitizedValue}`; // Update the input value
        this.setBrushSize(sanitizedValue); // Update brush size
        updateInputPreview(sanitizedValue); // Update line preview
      }
    };

    const handleArrowKeys = (event) => {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        adjustBrushSize(1);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        adjustBrushSize(-1);
      }
    };

    this.handleWheel = (event) => {
      const delta = event.deltaY < 0 ? 1 : -1;
      adjustBrushSize(delta);
    };

    const selectOnFocus = () => {
      input.select(); //for clicking on input, select all
    };

    // Event listeners
    input.addEventListener("click", toggleDropdown);
    input.addEventListener("focus", selectOnFocus); // highlight text on focus!!!
    input.addEventListener("keydown", handleArrowKeys); //arrow keys
    document.addEventListener("click", closeDropdown);
    dropdownList.addEventListener("click", handleSelection);
    input.addEventListener("input", handleInput);

    // Initialize with default preview
    updateInputPreview(null);
  }

  setBrushSize(newSize) {
    this.size = newSize;
    this.communicateBrushSize(this.size, "brushSizeChange");
  }

  communicateBrushSize(size, message) {
    window.dispatchEvent(
      new CustomEvent(`${message}`, {
        detail: { size: size },
      })
    );
  }
}

//OLD1

/*
import { toolbar } from "./client.js";

export default class BrushSize {
  constructor() {
    this.size = 1;
    this.maxSize = 400;
    this.previewLength = 140; // fixed length for all previews

    // cache DOM nodes
    this.dropdown = document.querySelector(".custom-dropdown-brushsize-box");
    this.inputBox = document.getElementById("customInputBrushsizeBox");
    this.dropdownList = document.getElementById("dropdownOptions");

    // wire up listeners
    this.inputBox.addEventListener("click", this.toggleDropdown);
    this.inputBox.addEventListener("keydown", this.handleArrowKeys);
    this.inputBox.addEventListener("input", this.handleInput);
    this.inputBox.addEventListener("wheel", this.handleWheel);
    document.addEventListener("click", this.closeDropdown);
    this.dropdownList.addEventListener("click", this.handleSelection);

    // initialize preview
    this.updateInputPreview(null);

    const brushSizeSelector = document.getElementById("brushsize");
    const activate = () => (toolbar.activeWheel = this);
    const deactivate = () => (toolbar.activeWheel = toolbar.viewport);
    brushSizeSelector.addEventListener("click", activate);
    brushSizeSelector.addEventListener("mouseenter", activate);
    brushSizeSelector.addEventListener("mouseleave", deactivate);
  }

  updateInputPreview = (size) => {
    if (!this.inputBox.value.trim()) {
      this.inputBox.style.backgroundImage = "none";
      this.inputBox.placeholder = "Enter brush size...";
      return;
    }
    this.inputBox.placeholder = "";
    this.inputBox.style.backgroundImage =
      "linear-gradient(to right, var(--secondary) 0%, var(--secondary) 100%)";
    this.inputBox.style.backgroundSize = `${this.previewLength}px ${size}px`;
    this.inputBox.style.backgroundPosition = `35px`;
  };

  sanitizeInput = (value) => {
    let parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed <= 0) return null;
    if (parsed > this.maxSize) parsed = this.maxSize;
    return parsed;
  };

  adjustBrushSize = (delta) => {
    let curr = this.sanitizeInput(this.inputBox.value) || 1;
    let next = curr + delta;
    next = Math.max(1, Math.min(this.maxSize, next));
    this.inputBox.value = `${next}`;
    this.size = next;
    this.updateInputPreview(next);
  };

  handleSelection = (event) => {
    const item = event.target;
    if (!item.classList.contains("dropdown-item")) return;
    this.dropdownList.classList.remove("show");
    const v = this.sanitizeInput(item.dataset.value);
    if (!v) return;
    this.inputBox.value = `${v}`;
    this.size = v;
    this.updateInputPreview(v);
  };

  handleInput = () => {
    const raw = this.inputBox.value.replace(/[^0-9]/g, "");
    const v = this.sanitizeInput(raw);
    if (this.sanitizeInput(raw)) {
      this.inputBox.value = `${v}`;
      this.size = v;
      this.updateInputPreview(v);
      return;
    }
    this.inputBox.value = "";
    this.updateInputPreview(null);
    this.size = 1;
  };

  handleArrowKeys = (event) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      return this.adjustBrushSize(1);
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      return this.adjustBrushSize(-1);
    }
  };

  closeDropdown = (event) =>
    !this.dropdown.contains(event.target) &&
    this.dropdownList.classList.remove("show");

  toggleDropdown = () => this.dropdownList.classList.toggle("show");

  handleWheel = (event) => this.adjustBrushSize(event.deltaY < 0 ? 1 : -1);
}
*/