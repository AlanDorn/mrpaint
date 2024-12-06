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

let transactionIndex = 1;
const transactions: Uint8Array = new Uint8Array(2 ** 27); // up to 4 million pencil transactions or 128 Mega Bytes

//CALM: There needs to be some start up mechanism for each client. This will give them their userId and the current canvas state.
wss.on("connection", (ws) => {
  let needsSynchronization = true;
  const userId = userIdCounter++ % 256;
  transactions[0] = userId;
  ws.send(transactions.slice(0, transactionIndex));

  ws.on("message", (event) => {
    if (needsSynchronization) {
      needsSynchronization = false;
      activeUsers.set(userId, ws);
      console.log("new user " + userId);
      console.log("canvas size (Bytes): " + transactionIndex);
      return;
    }

    const eventData = new Uint8Array(event as Buffer);
    activeUsers.forEach((socket, id) => {
      if (id !== userId) socket.send(eventData);
    });
    const justTransactions = eventData.slice(5);
    transactions.set(justTransactions, transactionIndex);
    transactionIndex += justTransactions.length;
  });

  // Kick the user from the active users
  ws.on("close", () => {
    activeUsers.delete(userId);
    console.log("delete user " + userId);
  });
});

server.listen(3001, () => console.log("WebSocket server running on port 3001"));

mrpaint();
