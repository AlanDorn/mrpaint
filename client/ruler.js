// import { virtualCanvas } from "./client.js";

export default class Ruler {
  constructor(virtualCanvas) {
    this.virtualCanvas = virtualCanvas;
    this.top = document.getElementById("top-ruler");
    this.left = document.getElementById("left-ruler");
    this.topIndicator = document.getElementById("topIndicator");
    this.leftIndicator = document.getElementById("leftIndicator");

    this.topSegments = [];
    this.leftSegments = [];

    for (let index = 0; index < 100; index++) {
      this.addTopSegment();
      this.addLeftSegment();
    }

    this.set();
  }

  set(input) {
    const rect = this.virtualCanvas.rect;

    if (input) {
      const normalizedPosition = this.virtualCanvas.positionInScreen(
        ...this.virtualCanvas.positionInCanvas(input.x, input.y)
      );
      this.topIndicator.style.width =
        Math.max(0, normalizedPosition[0] - rect.left) + "px";
      this.leftIndicator.style.height =
        Math.max(0, normalizedPosition[1] - rect.top) + "px";
    }

    const [topLeftInCanvas, bottomRightInCanvas] =
      this.virtualCanvas.getBoundsInCanvas();

    const idealNumberOfTopSegments = rect.width / 100;
    const idealNumberOfLeftSegments = rect.height / 100;

    const canvasWidth = bottomRightInCanvas[0] - topLeftInCanvas[0];
    const canvasHeight = bottomRightInCanvas[1] - topLeftInCanvas[1];

    const widthRatio = rect.width / canvasWidth;
    const heightRatio = rect.height / canvasHeight;

    const canvasTopLength = roundMagnitude(
      canvasWidth / idealNumberOfTopSegments
    );
    const canvasLeftLength = roundMagnitude(
      canvasHeight / idealNumberOfLeftSegments
    );

    const segmentTopLength = canvasTopLength * widthRatio;
    const segmentLeftLength = canvasLeftLength * heightRatio;

    // More accurate offset calculation
    const offsetWidth =
      canvasTopLength * Math.floor(topLeftInCanvas[0] / canvasTopLength);
    const offsetHeight =
      canvasLeftLength * Math.floor(topLeftInCanvas[1] / canvasLeftLength);

    let startWidth = offsetWidth - canvasTopLength;
    let startHeight = offsetHeight - canvasLeftLength;

    const margins = this.virtualCanvas.positionInScreen(
      startWidth - 0.5,
      startHeight - 0.5
    );

    this.topSegments[0].style.marginLeft = margins[0] - rect.left + "px";
    this.leftSegments[0].style.marginTop = margins[1] - rect.top + "px";

    for (let index = 0; index < this.topSegments.length; index++) {
      this.topSegments[index].style.width = segmentTopLength + "px";
      this.topSegments[index].rulerNumber.innerText = Math.round(startWidth);

      this.leftSegments[index].style.height = segmentLeftLength + "px";
      this.leftSegments[index].rulerNumber.innerText = Math.round(startHeight);

      startWidth += canvasTopLength;
      startHeight += canvasLeftLength;
    }
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

function roundMagnitude(num) {
  const magnitude = Math.pow(10, Math.floor(Math.log10(num)));
  const scale = num / magnitude;
  const leadDigit = scale < 1.5 ? 1 : scale < 3.5 ? 2 : scale < 7.5 ? 5 : 10;
  return Math.max(10, leadDigit * magnitude);
}
