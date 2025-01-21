export default class Ruler {
  constructor(virtualCanvas) {
    this.virtualCanvas = virtualCanvas;
    this.virtualCanvas.ruler = this;
    this.top = document.getElementById("top-ruler");
    this.left = document.getElementById("left-ruler");
    this.topIndicator = document.getElementById("topIndicator");
    this.topSegments = [];
    this.leftSegments = [];

    for (let index = 0; index < 20; index++) {
      this.addTopSegment();
      this.addLeftSegment();
    }

    let start = 0;
    for (let index = 0; index < this.topSegments.length; index++) {
      this.topSegments[index].style.width = "80px";
      this.topSegments[index].rulerNumber.innerText = start;

      this.leftSegments[index].style.height = "120px";
      this.leftSegments[index].rulerNumber.innerText = start;
      start += 30;
    }

    this.set();
  }

  set() {
    const rect = this.virtualCanvas.drawingarea.getBoundingClientRect();
    const topLeftInCanvas = this.virtualCanvas.positionInCanvas(
      rect.left,
      rect.top
    );
    const bottomRightInCanvas = this.virtualCanvas.positionInCanvas(
      rect.left + rect.width,
      rect.top + rect.height
    );

    // Handle width (top segments)
    const canvasWidth = bottomRightInCanvas[0] - topLeftInCanvas[0];
    const idealNumberOfTopSegments = rect.width / 100;
    const canvasLengthOfTopSegment = canvasWidth / idealNumberOfTopSegments;
    const magnitudeWidth = Math.pow(
      10,
      Math.floor(Math.log10(canvasLengthOfTopSegment))
    );
    const canvasTopLength = Math.max(
      10,
      Math.round(canvasLengthOfTopSegment / magnitudeWidth) * magnitudeWidth
    );
    const segmentTopLength = (canvasTopLength * rect.width) / canvasWidth;
    const offsetWidth = topLeftInCanvas[0] % canvasTopLength;
    let startWidth = topLeftInCanvas[0] - canvasTopLength - offsetWidth;
    for (let index = 0; index < this.topSegments.length; index++) {
      this.topSegments[index].style.width = segmentTopLength + "px";
      this.topSegments[index].rulerNumber.innerText = Math.round(startWidth);

      startWidth += canvasTopLength;
    }
    this.topSegments[0].style.marginLeft =
      -((offsetWidth * rect.width) / canvasWidth + segmentTopLength) + "px";

    // Handle height (left segments)
    const canvasHeight = bottomRightInCanvas[1] - topLeftInCanvas[1];
    const idealNumberOfLeftSegments = rect.height / 100;
    const canvasLengthOfLeftSegment = canvasHeight / idealNumberOfLeftSegments;
    const magnitudeHeight = Math.pow(
      10,
      Math.floor(Math.log10(canvasLengthOfLeftSegment))
    );
    const canvasLeftLength = Math.max(
      10,
      Math.round(canvasLengthOfLeftSegment / magnitudeHeight) * magnitudeHeight
    );
    const segmentLeftLength = (canvasLeftLength * rect.height) / canvasHeight;
    const offsetHeight = topLeftInCanvas[1] % canvasLeftLength;
    let startHeight = topLeftInCanvas[1] - canvasLeftLength - offsetHeight;
    for (let index = 0; index < this.leftSegments.length; index++) {
      this.leftSegments[index].style.height = segmentLeftLength + "px";
      this.leftSegments[index].rulerNumber.innerText = Math.round(startHeight);

      startHeight += canvasLeftLength;
    }
    this.leftSegments[0].style.marginTop =
      -((offsetHeight * rect.height) / canvasHeight + segmentLeftLength) + "px";
  }

  addTopSegment() {
    const rulerSegment = document.createElement("div");
    rulerSegment.classList.add("topSegment");
    this.top.appendChild(rulerSegment);

    const rulerNumber = document.createElement("div");
    rulerNumber.classList.add("topNumber");
    rulerSegment.appendChild(rulerNumber);

    const rulerTick = document.createElement("div");
    rulerTick.classList.add("topTick");
    rulerSegment.appendChild(rulerTick);

    for (let index = 0; index < 10; index++) {
      const subTick = document.createElement("div");
      subTick.classList.add("topSubtick");
      rulerTick.appendChild(subTick);
    }

    rulerSegment.rulerNumber = rulerNumber;
    this.topSegments.push(rulerSegment);
  }

  addLeftSegment() {
    const rulerSegment = document.createElement("div");
    rulerSegment.classList.add("leftSegment");
    this.left.appendChild(rulerSegment);

    const rulerNumber = document.createElement("div");
    rulerNumber.classList.add("leftNumber");
    rulerSegment.appendChild(rulerNumber);

    const rulerTick = document.createElement("div");
    rulerTick.classList.add("leftTick");
    rulerSegment.appendChild(rulerTick);

    for (let index = 0; index < 10; index++) {
      const subTick = document.createElement("div");
      subTick.classList.add("leftSubtick");
      rulerTick.appendChild(subTick);
    }

    rulerSegment.rulerNumber = rulerNumber;
    this.leftSegments.push(rulerSegment);
  }
}
