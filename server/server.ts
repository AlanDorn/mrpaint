import path from "path";
import express from "express";
import * as http from "http";
import WebSocket from "ws";
import mrpaint from "./mrpaintascii";

const app = express();
app.use(express.static(path.join(__dirname, "../client")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../client", "client.html"));
});
app.listen(3000, () => {
  console.log("Server running on port 3000 - http://localhost:3000/");
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let userIdCounter = 0;
const activeUsers: Map<number, WebSocket> = new Map(); // a map of all active user websockets

let cursorPositions = "";
let canvasChanges = "";

//CALM: There needs to be some start up mechanism for each client. This will give them their userId and the current canvas state.
wss.on("connection", (ws) => {
  const userId = userIdCounter++;
  console.log("new user " + userId);

  activeUsers.set(userId, ws);

  // When a client sends a message it is received here
  // Currently it just sends the user's input to everyone
  ws.on("message", (event) => {
    const [cursorEvent, canvasEvent] = event.toString().split(";");
    cursorPositions += userId + "," + cursorEvent + ",";
    if (canvasEvent) canvasChanges += canvasEvent + ",";
  });

  // Kick the user from the active users
  ws.on("close", () => {
    activeUsers.delete(userId);
    console.log("delete user " + userId);
  });
});

setInterval(() => {
  cursorPositions = !cursorPositions ? "" : cursorPositions.slice(0, -1);
  canvasChanges = !canvasChanges ? "" : canvasChanges.slice(0, -1);
  const message = cursorPositions + ";" + canvasChanges;

  activeUsers.forEach((socket, userId) => socket.send(userId + ";" + message));
  cursorPositions = "";
  canvasChanges = "";
}, 32);

server.listen(3001, () => console.log("WebSocket server running on port 3001"));

mrpaint