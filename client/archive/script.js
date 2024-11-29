const canvas = document.getElementById('drawingBoard');
const ctx = canvas.getContext('2d');

let drawing = false;

// Begin drawing
canvas.addEventListener('mousedown', () => {
    drawing = true;
});

// Stop drawing
canvas.addEventListener('mouseup', () => {
    drawing = false;
    ctx.beginPath();
});

// Draw on the canvas
canvas.addEventListener('mousemove', (event) => {
    if (!drawing) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    //Cool line styling yippee
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'white';

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);

    // Emit drawing data to server
    sendDrawingData({ x, y });
});