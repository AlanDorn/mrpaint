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
