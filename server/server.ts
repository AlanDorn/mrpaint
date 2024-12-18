import path from "path";
import express from "express";
import * as http from "http";
import WebSocket from "ws";
import mrpaint from "./mrpaintascii";
import keyGen from "./keygen/keygenerator";
import CanvasLobby from "./canvaslobby";

const lobbies: Map<string, CanvasLobby> = new Map();

const app = express();
app.use(express.static(path.join(__dirname, "../client")));

app.get("/", (req, res) => {
  const newLobby = new CanvasLobby(keyGen());
  const lobbyId = newLobby.id;
  lobbies.set(lobbyId, newLobby);
  res.redirect(`/${lobbyId}`);
});

app.get("/:lobby", (req, res) => {
  if(!lobbies.has(req.params.lobby))
    res.redirect('/');
  else
    res.sendFile(path.join(__dirname, "../client", "client.html"));
});

app.listen(3000, () => {
  console.log("Server running on port 3000 - http://localhost:3000/");
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  let lobby: CanvasLobby | null = null;
  let userId = 0;

  ws.on("message", (event) => {
    if (!lobby) {
      const id = event.toString("utf-8");
      lobby = lobbies.get(id)!;
      userId = lobby.addUser(ws);
      lobby.print();
      return;
    }

    lobby.send(userId, event);
  });

  // Kick the user from the active users
  ws.on("close", () => {
    if(lobby)
      lobby.deleteUser(userId);
  });
});

server.listen(3001, () => console.log("WebSocket server running on port 3001"));

mrpaint();

