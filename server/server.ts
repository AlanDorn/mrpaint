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
  if (!lobbies.has(req.params.lobby)) res.redirect("/");
  else res.sendFile(path.join(__dirname, "../client", "client.html"));
});

// Create a single HTTP server
const server = http.createServer(app);

// Attach WebSocket server to the same HTTP server
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  let lobby: CanvasLobby | undefined;
  let userId = 0;

  ws.on("message", (event) => {
    if (!lobby) {
      lobby = lobbies.get(event.toString("utf-8"));
      if (!lobby) return;
      userId = lobby.addUser(ws);
      lobby.print();
      return;
    }

    lobby.handle(userId, event);
  });

  // Kick the user from the active users
  ws.on("close", () => {
    if (lobby) lobby.deleteUser(userId);
  });
});

// Start listening on a single port
const PORT = process.env.PORT || 3000; // Render provides the port in the `PORT` env variable
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

mrpaint();
