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

const cursorPositions: Uint8Array[] = [];
const transactions: Uint8Array[] = [];

//CALM: There needs to be some start up mechanism for each client. This will give them their userId and the current canvas state.
wss.on("connection", (ws) => {
  const userId = userIdCounter++ % 256;
  let needsSynchronization = true;
  ws.send(userId);

  ws.on("message", (event) => {
    if (needsSynchronization) {
      needsSynchronization = false;
      activeUsers.set(userId, ws);
      console.log("new user " + userId);
      return;
    }

    const eventData = new Uint8Array(event as Buffer);

    cursorPositions.push(
      new Uint8Array([
        userId,
        eventData[0],
        eventData[1],
        eventData[2],
        eventData[3],
      ])
    );
    transactions.push(eventData.slice(4));
  });

  // Kick the user from the active users
  ws.on("close", () => {
    activeUsers.delete(userId);
    console.log("delete user " + userId);
  });
});

const nullMessage = new Uint8Array([0]);
setInterval(() => {
  const clientMessage =
    !transactions && !cursorPositions
      ? nullMessage
      : joinUint8Arrays(
          new Uint8Array([cursorPositions.length]),
          ...cursorPositions,
          ...transactions
        );

  activeUsers.forEach((socket) => socket.send(clientMessage));
  cursorPositions.length = 0;
  transactions.length = 0;
}, 16);

function joinUint8Arrays(...components: Uint8Array[]) {
  let transactionLength = 0;
  for (let index = 0; index < components.length; index++)
    transactionLength += components[index].length;

  const transaction = new Uint8Array(transactionLength);
  let bufferOffset = 0;
  for (let index = 0; index < components.length; index++) {
    transaction.set(components[index], bufferOffset);
    bufferOffset += components[index].length;
  }
  return transaction;
}

server.listen(3001, () => console.log("WebSocket server running on port 3001"));

mrpaint();
mrpaint();
