import { decodePosition } from "./transaction.js";
import { OPCODE, OPCODE_NAME } from "./shared/instructionset.js";

let userId = null;
let initializing = true;
let newUser = true;
let userColorTable = {};
let historyBytes = null;
let usernameStr = "";

export default class PresenceManager {
  constructor(ws, input, virtualCanvas) {
    const username = document.getElementById("customInputUsernameBox");

    username.addEventListener("input", () => {
      usernameStr = username.value;
      sendNameUpdate(ws, userId, usernameStr);
    });

    window.sendColorUpdate = (rgbArray) => {
      ws.send(new Uint8Array([OPCODE.USER_COLOR_UPDATE, userId, ...rgbArray]));
    };

    window.sendColorUpdate = (rgb) => {
      if (!userId) return; // wait until we have an id
      ws.send(new Uint8Array([OPCODE.USER_COLOR_UPDATE, userId, ...rgb]));
    };

    (event) => {
      event.data.arrayBuffer().then((buffer) => {
        // Format is now:
        //  opcode    |    userId    |    payload
        //  1 byte         1 byte         n bytes

        const eventData = new Uint8Array(buffer);

        const opcode = eventData[0];
        const senderId = eventData[1];
        const payload = eventData.subarray(2);

        if (opcode === OPCODE.ASSIGN_USER_ID && newUser) {
          userId = senderId;
          console.log("userID =", userId);
          newUser = false;
          //so instead of the server having/storing the user data, have clients have their own shiz, when user joins, the user also sends message to server requesting ID/name/color from all current active users
          return;
        }

        if (initializing) {
          // ─── Still in sync phase ────────────────────────────────

          if (opcode === OPCODE.TS_TRANSACTION_HISTORY) {
            // 9
            historyBytes = payload; // remember raw bytes
            return; // don't pass to reader
          }

          if (opcode === OPCODE.USER_COLOR_UPDATE) {
            handleColorUpdate(senderId, payload); // cache + paint cursor
            return; // don’t forward yet
          }

          if (opcode === OPCODE.USERNAME_UPDATE) {
            handleNameUpdate(senderId, payload);
            return; // don’t forward yet
          }
          return; // stay in “initializing” branch until .then() runs
        }

        switch (opcode) {
          case OPCODE.USER_LEFT:
            console.log(`User ${senderId} left`);
            break;
          case OPCODE.USER_COLOR_UPDATE:
            handleColorUpdate(senderId, payload);
            break;
          case OPCODE.USERNAME_UPDATE:
            // TODO: Implement when username syncing is added
            handleNameUpdate(senderId, payload);
            break;
          case OPCODE.PREVIEW_UPDATE:
            // TODO: Implement when previewManager is added
            break;
          case OPCODE.CURSOR_POSITION_UPDATE:
            handleCursorData(
              new Uint8Array([senderId, ...payload]),
              virtualCanvas
            );
            break;
          default:
            console.warn(`Unhandled opcode: ${OPCODE_NAME[opcode] || opcode}`);
            break;
        }
      });
    };
  }
}

function sendNameUpdate(ws, userId, usernameStr) {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(usernameStr);

  ws.send(new Uint8Array([OPCODE.USERNAME_UPDATE, userId, ...encoded]));
}

function handleNameUpdate(userId, payload) {
  const decoder = new TextDecoder();
  const name = decoder.decode(payload);

  let cursor = document.getElementById("cursor" + userId);
  if (!cursor) {
    cursor = document.createElement("div");
    cursor.id = "cursor" + userId;
    cursor.classList.add("cursor");
    document.body.appendChild(cursor);
  }

  // Show name when hovering
  cursor.setAttribute("title", name);
}

function handleColorUpdate(userId, payload) {
  const [r, g, b] = payload;
  userColorTable[userId] = `rgb(${r},${g},${b})`;

  console.log(`Color Update:\nid=${userId}  rgb=[${r},${g},${b}]`);

  let div = document.getElementById("cursor" + userId);
  if (!div) {
    div = document.createElement("div");
    div.id = "cursor" + userId;
    div.classList.add("cursor");
    document.body.appendChild(div);
  }
  div.style.setProperty("--secondary", `rgb(${r},${g},${b})`);
  console.log("users/colors:", userColorTable);
}

function handleCursorData(cursorData, virtualCanvas) {
  const id = cursorData[0];
  if (id === userId) return;

  let cursorElement = document.getElementById("cursor" + id);
  if (!cursorElement) {
    cursorElement = document.createElement("div");
    cursorElement.id = "cursor" + id;
    cursorElement.classList.add("cursor");
    document.body.appendChild(cursorElement);
  }

  const [x, y] = decodePosition(cursorData.subarray(1));
  const [screenX, screenY] = virtualCanvas.positionInScreen(x, y);
  cursorElement.style.left = `${screenX}px`;
  cursorElement.style.top = `${screenY}px`;

  if (cursorElement._removeTimeout) clearTimeout(cursorElement._removeTimeout);

  cursorElement._removeTimeout = setTimeout(() => {
    cursorElement.remove();
  }, 1500);
}

class Presence {
    constructor() {

    }
}