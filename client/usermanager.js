import { decodePosition, encodePosition } from "./transaction.js";
import { OP_PRESENCE, OP_TYPE } from "./shared/instructionset.js";

export default class UserManager {
  constructor(virtualCanvas, userId) {
    this.virtualCanvas = virtualCanvas;
    this.users = new Map(); //userId -> { name, color, cursor, timeout }

    this.userId = userId;
    this.username = "";
    this.color = [128, 128, 128];

    this.setupUsernameInput();

    window.sendColorUpdate = (rgb) => (this.color = rgb);
  }

  trackUser(userId) {
    let user = this.users.get(userId);
    if (!user) {
      user = {};
      user.name = "";
      user.color = "rgb(128, 128, 128)";
      user.cursor = this.createCursor(userId);
      this.users.set(userId, user);
    }
    clearTimeout(user.timeout);
    user.timeout = setTimeout(() => {
      this.removeUser(userId);
    }, 1000);
  }

  setupUsernameInput() {
    const input = document.getElementById("customInputUsernameBox");
    if (!input) return;
    input.addEventListener("input", () => {
      this.username = input.value;
    });
  }

  updateName(userId, payload) {
    const name = new TextDecoder().decode(payload);

    let user = this.users.get(userId);
    if (!user) {
      user = { name, color: "gray", cursor: this.createCursor(userId) };
      this.users.set(userId, user);
    }

    user.name = name;
    user.cursor.setAttribute("title", name);
  }

  /**
   * Called by PresenceManager → `OP_PRESENCE.USER_COLOR_UPDATE`
   */
  updateColor(userId, payload) {
    const [r, g, b] = payload;
    const color = `rgb(${r},${g},${b})`;

    let user = this.users.get(userId);
    if (!user) {
      user = { name: "", color, cursor: this.createCursor(userId) };
      this.users.set(userId, user);
    }

    user.color = color;
    user.cursor.style.setProperty("--secondary", color);
  }

  /**
   * Called by PresenceManager → `OP_PRESENCE.CURSOR_UPDATE`
   */
  updateCursor(userId, payload) {
    const user = this.users.get(userId);
    const [x, y] = decodePosition(payload);
    const [screenX, screenY] = this.virtualCanvas.positionInScreen(x, y);
    // use translate for GPU-accelerated positioning
    user.cursor.style.transform = `translate(${screenX}px, ${screenY}px)`;
  }

  /**
   * Called by PresenceManager → `OP_PRESENCE.USER_LEFT`
   */
  removeUser(userId) {
    const user = this.users.get(userId);
    if (user?.cursor) user.cursor.remove();
    this.users.delete(userId);
  }

  createCursor(userId) {
    const div = document.createElement("div");
    div.id = `cursor${userId}`;
    div.classList.add("cursor");
    // if we already know a color, use it
    const user = this.users.get(userId);
    if (user?.color) div.style.setProperty("--secondary", user.color);
    document.body.appendChild(div);
    return div;
  }
}
