class Pencil {
  constructor(virtualCanvas, colorpicker) {
    this.virtualCanvas = virtualCanvas;
    this.colorpicker = colorpicker;

    this.points = []; // Store the last four points for Catmull-Rom
    this.isDrawing = false;
  }

  mouseUp(input) {
    if (this.points.length >= 2) {
      // Add a mirrored point to finish the curve
      const lastPoint = this.points[this.points.length - 1];
      const secondLastPoint = this.points[this.points.length - 2];
      const mirroredPoint = [
        2 * lastPoint[0] - secondLastPoint[0],
        2 * lastPoint[1] - secondLastPoint[1],
      ];
      this.points.push(mirroredPoint);
      this.drawSpline();
    }
    this.isDrawing = false;
    this.points = []; // Clear points after finishing the curve
  }

  mouseDown(input) {
    this.isDrawing = true;
    const startPoint = this.virtualCanvas.positionInCanvas(input.x, input.y);
    this.points.push(startPoint); // Add the initial point
    this.setPixel(startPoint[0],startPoint[1]);
  }

  mouseMove(input) {
    if (!this.isDrawing) return;

    const newPoint = this.virtualCanvas.positionInCanvas(input.x, input.y);
    this.points.push(newPoint);

    // If there are exactly 2 points, insert a mirrored point at the start
    if (this.points.length === 2) {
      const firstPoint = this.points[0];
      const secondPoint = this.points[1];
      const mirroredPoint = [
        2 * firstPoint[0] - secondPoint[0],
        2 * firstPoint[1] - secondPoint[1],
      ];
      this.points.unshift(mirroredPoint); // Add mirrored point at the start
    }

    if (this.points.length > 4) {
      this.points.shift(); // Keep the buffer size at 4
    }

    if (this.points.length === 4) {
      this.drawSpline();
    }
  }

  drawSpline() {
    const [p0, p1, p2, p3] = this.points;
  
    // Catmull-Rom Spline Formula
    const interpolate = (t, p0, p1, p2, p3) =>
      0.5 *
      ((2 * p1) +
        (-p0 + p2) * t +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
        (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  
    // Derivative of Catmull-Rom Spline
    const derivative = (t, p0, p1, p2, p3) =>
      0.5 *
      ((-p0 + p2) +
        2 * t * (2 * p0 - 5 * p1 + 4 * p2 - p3) +
        3 * t * t * (-p0 + 3 * p1 - 3 * p2 + p3));
  
    // Adaptive stepping based on velocity
    const tolerance = 0.5; // Target distance between points
    let t = 0;
    let prevX = interpolate(t, p0[0], p1[0], p2[0], p3[0]);
    let prevY = interpolate(t, p0[1], p1[1], p2[1], p3[1]);
    this.setPixel(prevX, prevY);
  
    while (t < 1) {
      // Calculate instantaneous velocity
      const dx = derivative(t, p0[0], p1[0], p2[0], p3[0]);
      const dy = derivative(t, p0[1], p1[1], p2[1], p3[1]);
      const velocity = Math.sqrt(dx * dx + dy * dy);
  
      // Determine step size based on velocity
      const dt = tolerance / velocity; // Smaller step for high velocity, larger for low
  
      // Move to the next point
      t += dt;
      if (t > 1) t = 1; // Clamp to ensure we don't overshoot
  
      // Calculate and draw the next point
      const x = interpolate(t, p0[0], p1[0], p2[0], p3[0]);
      const y = interpolate(t, p0[1], p1[1], p2[1], p3[1]);
      this.setPixel(x, y);
  
      // Update previous point
      prevX = x;
      prevY = y;
    }
  }
  

  setPixel(x, y) {
    this.virtualCanvas.setPixelClient(
      Math.round(x),
      Math.round(y),
      this.colorpicker.color[0],
      this.colorpicker.color[1],
      this.colorpicker.color[2]
    );
  }
}

export default Pencil;
