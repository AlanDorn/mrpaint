export default class BrushSize {
  constructor() {
    this.size = 1;

    const dropdown = document.querySelector(".custom-dropdown");
    const input = document.getElementById("customInput");
    const dropdownList = document.getElementById("dropdownOptions");

    // Function to update the input background for line preview
    const updateInputBackground = (size) => {
      if (!input.value.trim()) {
        // If input is empty, hide the line preview
        input.style.backgroundImage = "none";
      } else {
        // Show line preview aligned to the right of the text
        input.style.backgroundImage = "linear-gradient(to right, black 0%, black 100%)";
        input.style.backgroundSize = `135px ${size}px`; // Set line height dynamically

        // Calculate position to ensure line appears to the right of the text
        const textWidth = input.value.length * 8; // Approximate width of the input text
        const extraSpacing = 20; // Additional spacing between the text and the line preview
        input.style.backgroundPosition = `${textWidth + extraSpacing}px center`; // Add extra spacing
      }
      console.log(`Input background updated to: ${size ? size + "px" : "none"}`);
    };

    // Helper function to sanitize input
    const sanitizeInput = (value) => {
      const parsedValue = parseInt(value, 10);
      return isNaN(parsedValue) || parsedValue <= 0 ? 1 : parsedValue;
    };

    // Handle dropdown toggle
    input.addEventListener("click", () => {
      dropdownList.classList.toggle("show");
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (event) => {
      if (!dropdown.contains(event.target)) {
        dropdownList.classList.remove("show");
      }

      event.stopPropagation(); //canvas interaction
    });

    // Handle dropdown item selection
    dropdownList.addEventListener("click", (event) => {
      event.stopPropagation();
      if (event.target.classList.contains("dropdown-item")) {
        const value = sanitizeInput(event.target.dataset.value);
        input.value = `${value}`; // Update input field without appending "px"
        this.setBrushSize(value); // Update brush size
        updateInputBackground(value); // Show line preview
        dropdownList.classList.remove("show");
      }
    });

    // Handle manual input
    input.addEventListener("input", () => {
      if (input.value.trim() === "") {
        updateInputBackground(null); // Hide line preview for empty input
        return;
      }

      // Remove non-numeric characters
      input.value = input.value.replace(/[^0-9]/g, "");

      // Extract numeric value for the brush size
      const sanitizedValue = sanitizeInput(input.value);
      if (sanitizedValue) {
        this.setBrushSize(sanitizedValue);
        updateInputBackground(sanitizedValue); // Update line preview
      } else {
        updateInputBackground(null); // Hide line preview for invalid input
      }
    });

    // Initialize with default brush size
    updateInputBackground(null); // Start with no preview
  }

  // Method to set the brush size
  setBrushSize(newSize) {
    this.size = newSize;
    console.log(`Brush size set to: ${this.size}px`);
  }
}
