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
  const newLobby = new CanvasLobby(keyGen());
  const lobbyId = newLobby.id;
  lobbies.set(lobbyId, newLobby);
  res.redirect(`/${lobbyId}`);
});

app.get("/:lobby", (req, res) => {
  if (!lobbies.has(req.params.lobby)) {
    return res.redirect("/");
  }

  const filePath = path.join(__dirname, "../client", "client.html");

  fs.readFile(filePath, "utf8", (err, html) => {
    if (err) {
      console.error("Error reading HTML file:", err);
      return res.status(500).send("Internal Server Error");
    }

    // Inject Open Graph meta tags
    const openGraphTags = `
      <meta property="og:title" content="Mr. Paint" />
      <meta property="og:description" content="Draw with your friends and family" />
      <meta property="og:image" content="https://mrpaint.onrender.com/preview/${req.params.lobby}.png" />
      <meta property="og:image:width" content="700" />
      <meta property="og:image:height" content="500" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:image" content="https://mrpaint.onrender.com/preview/${req.params.lobby}.png" />

      <meta property="og:url" content="https://mrpaint.onrender.com/${req.params.lobby}" />
    `;

    // Inject tags before `</head>`
    const modifiedHtml = html.replace("</head>", `${openGraphTags}\n</head>`);

    res.send(modifiedHtml);
  });
});

app.get("/preview/:lobby", (req, res) => {
  const lobbyCode = req.params.lobby.split(".")[0];
  const lobby = lobbies.get(lobbyCode);
  if (!lobby)
    res.sendFile(
      path.join(
        __dirname,
        "../client/images",
        "db9c352d-2b8b-4e74-a4b5-26f7d7c4a2b9.webp"
      )
    );
  else {
    res.set("Content-Type", "image/png");
    res.send(Buffer.from(lobby.canvasState.png));
  }
});

// Create a single HTTP server
const server = http.createServer(app);

// Attach WebSocket server to the same HTTP server
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  let lobby: CanvasLobby | undefined;
  let userId;

  ws.on("message", (event) => {
    if (!lobby) {
      lobby = lobbies.get(event.toString("utf-8"));
      if (!lobby) return;
      userId = lobby.addUser(ws);
      // console.log(userId);
      lobby.print();
      return;
    }

    lobby.handle(userId, event);
  });

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
