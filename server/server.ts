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

let userIdCounter = 0;
const sockets: [WebSocket, number][] = []; // a record of all active user sockets

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
wss.on("connection", (ws) => {
  console.log("new connection");
  const userId = userIdCounter++;
  sockets.push([ws, userId]);

  // When a client sends a message it is received here
  // Currently it just sends the user's input to everyone
  ws.on("message", (event) => {
    console.log(event.toString());
    const xy = event.toString().split(",");
    const x = Number.parseInt(xy[0]);
    const y = Number.parseInt(xy[1]);
    const output = JSON.stringify({
      userId,
      x,
      y,
    });
    sockets.forEach((tuple) => {
      if (tuple[1] == userId) return;
      tuple[0].send(output);
    });
  });

});

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
