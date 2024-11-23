import path from "path";
import express from "express";
import * as http from "http";
import WebSocket from "ws";

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

let canvasChanges = "";

wss.on("connection", (ws) => {
  const userId = userIdCounter++;
  console.log("new user " + userId);

  activeUsers.set(userId, ws);

  // When a client sends a message it is received here
  // Currently it just sends the user's input to everyone
  ws.on("message", (event) => {
    canvasChanges += event.toString() + ",";
  });

  // Kick the user from the active users
  ws.on("close", () => {
    activeUsers.delete(userId);
    console.log("delete user " + userId);
  });
});

setInterval(() => {
  canvasChanges = canvasChanges.slice(0, -1) 
  activeUsers.forEach((socket) => socket.send(canvasChanges));
  canvasChanges = "";

}, 32);

server.listen(3001, () => console.log("WebSocket server running on port 3001"));

console.log(`
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣀⣀⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⡴⠾⠛⠋⠉⠉⠙⠛⠷⣦⣄⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⣠⡾⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⣷⡀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⢀⣀⣤⣤⣴⣶⣶⣶⣶⣶⣶⣶⣶⣦⣤⣄⠘⣷⡀⠀⠀⠀⠀⠀
⠀⠀⠀⣠⣴⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡆⢸⣿⣦⣄⠀⠀⠀
⠀⠀⠀⣿⣿⣿⠿⠟⠛⠛⠛⠉⠉⠉⠉⠉⠉⠉⠉⠛⠛⠛⠃⠘⣿⣿⣿⠀⠀⠀
⠀⠀⠀⠻⣿⣅⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⣿⣿⠟⠀⠀⠀
⠀⠀⠀⠀⣿⡍⠛⠻⠷⠶⣶⣤⣤⣤⣤⣤⣤⣤⣤⣶⠶⢾⣿⣿⡟⠀⠀⠀⠀⠀
⠀⠀⠀⠀⣿⡇⠀⠀⠀⠀⠀⠀⣀⡀⠀⠀⠀⣠⡄⠀⠀⣾⣿⣿⠇⢰⠀⠀⠀⠀
⠀⠀⠀⠀⣿⡇⠀⠀⣿⡆⠀⢰⣿⣿⣷⣤⣴⣿⣿⣦⣴⠿⠿⡟⢀⣿⠀⠀⠀⠀
⠀⠀⠀⠀⣿⡇⠀⠀⣿⣷⣤⣾⣿⣿⣿⣿⣿⣿⣿⣿⠃⣴⡆⠀⣾⣿⠀⠀⠀⠀
⠀⠀⠀⠀⣿⣇⠀⢀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣆⡈⢁⣼⣿⣿⠀⠀⠀⠀
⠀⠀⠀⠀⢿⣿⣶⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠙⠛⠿⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠿⠛⠋⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠉⠉⠉⠉⠉⠉⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
    `);
