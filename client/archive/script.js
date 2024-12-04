const canvas = document.getElementById('drawingBoard');
const ctx = canvas.getContext('2d');

let drawing = false;

// Begin drawing
canvas.addEventListener('mousedown', () => {
    drawing = true;
    ctx.beginPath();
});

// Stop drawing
document.addEventListener('mouseup', () => {
    drawing = false;
});

// Draw on the canvas
document.addEventListener('mousemove', (event) => {
    if (!drawing) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    //Cool line styling yippee
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'yellow';

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);

    // Emit drawing data to server
    sendDrawingData({ x, y });
});

// WebSocket connection
const socket = new WebSocket('ws://localhost:3000');

// Send drawing data
function sendDrawingData(position) {
    socket.send(JSON.stringify(position));
}

// Receive drawing data
socket.onmessage = (message) => {
    const position = JSON.parse(message.data);

    ctx.lineTo(position.x, position.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(position.x, position.y);
};