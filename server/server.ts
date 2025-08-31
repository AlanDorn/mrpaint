import fs from "fs";
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
  let lobbyName = keyGen();
  while (lobbies.has(lobbyName.toLowerCase())) lobbyName = keyGen();
  lobbies.set(lobbyName.toLowerCase(), new CanvasLobby(lobbyName));
  res.redirect(`./join-canvas/${lobbyName}`);
});

const clientPath = path.join(__dirname, "../client", "client.html");
const clientHTML = fs.readFileSync(clientPath, "utf8");
app.get("/join-canvas/:lobby", (req, res) => {
  const lobbyName = req.params.lobby.toLowerCase();
  if (!lobbies.has(lobbyName)) return res.redirect("/");
  res.send(clientHTML.replaceAll("{{lobby}}", lobbyName));
});

app.get("/preview/:lobby", (req, res) => {
  const lobbyName = req.params.lobby.split(".")[0].toLowerCase();
  const lobby = lobbies.get(lobbyName);
  if (!lobby || lobby.state.png.length < 3)
    return res.sendFile(
      path.join(__dirname, "../client/images", "default_mrpaint.webp")
    );
  res.set("Content-Type", "image/png");
  res.send(Buffer.from(lobby.state.png));
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 3000;
wss.on("connection", (ws: WebSocket) =>
  ws.once("message", (event) =>
    lobbies.get(event.toString("utf-8").toLowerCase())?.addUser(ws)
  )
);
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
mrpaint();
