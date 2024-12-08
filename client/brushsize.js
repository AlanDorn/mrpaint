export default class BrushSize {
  constructor() {
    this.size = 1;
    this.maxSize = 400;

    const dropdown = document.querySelector(".custom-dropdown");
    const input = document.getElementById("customInput");
    const dropdownList = document.getElementById("dropdownOptions");
    const previewLength = 115; // Fixed length for all previews


    // Function to update the input background for line preview
    const updateInputPreview = (size) => {
      if (!input.value.trim()) {
        input.style.backgroundImage = "none"; // Hide line preview if input is empty
        input.placeholder = "Enter brush size..."; // Show placeholder
      } else {
        input.placeholder = ""; // Remove placeholder when there's input
        input.style.backgroundImage = "linear-gradient(to right, black 0%, black 100%)";
        input.style.backgroundSize = `${previewLength}px ${size}px`; // Fixed length, dynamic height
        input.style.backgroundPosition = `62px`; // Align to the right
      }
    };
    

    // Helper to sanitize input
    const sanitizeInput = (value) => {
      let parsedValue = parseInt(value, 10);
      if(isNaN(parsedValue) || parsedValue <= 0) return null;
      if(parsedValue > this.maxSize) parsedValue = this.maxSize;
      return parsedValue;
    };

    const adjustBrushSize = (delta) => {
      let currentValue = sanitizeInput(input.value) || 1;
      let newValue = currentValue + delta;

      if(newValue < 1) newValue = 1;
      if(newValue > this.maxSize) newValue = this.maxSize;

      input.value = `${newValue}`;
      this.setBrushSize(newValue);
      updateInputPreview(newValue);
    }

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
      if(event.key === "ArrowUp"){
        event.preventDefault();
        adjustBrushSize(1);
      } else if(event.key === "ArrowDown"){
        event.preventDefault();
        adjustBrushSize(-1);
      }
    };

    const handleMouseScroll = (event) => { 
      event.preventDefault(); //prevent page scrolling
      const delta = event.deltaY < 0 ? 1: -1;
      adjustBrushSize(delta);
    };

    const selectOnFocus = () => {
      input.select(); //for clicking on input, select all
    };

    // Event listeners
    input.addEventListener("click", toggleDropdown);
    input.addEventListener("focus", selectOnFocus); // highlight text on focus!!!
    input.addEventListener("keydown", handleArrowKeys); //arrow keys 
    input.addEventListener("wheel", handleMouseScroll); //mouse scroll
    document.addEventListener("click", closeDropdown);
    dropdownList.addEventListener("click", handleSelection);
    input.addEventListener("input", handleInput);

    // Initialize with default preview
    updateInputPreview(null);
  }

  setBrushSize(newSize) {
    this.size = newSize;
    console.log(`Brush size set to: ${this.size}px`);
  }
}
