import path from "path";
import express from "express";
import * as http from "http";
import WebSocket from "ws";

const app = express();
app.use(express.static(path.join(__dirname, "../public")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public", "client.html"));
});
app.listen(3000, () => {
  console.log("Server running on port 3000 - http://localhost:3000/");
});


const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
wss.on("connection", (ws) => console.log("new connection"));

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