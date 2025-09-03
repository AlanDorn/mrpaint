import { decodePosition } from "./transaction.js";

// sanitize inputs for the username and rgb values in color picker
const MAX_CHARS = 10000; // 10 k should be plenty for art, tiny for DoS
const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g;

export function sanitizeName(text) {
  const trimmed = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) + "…" : text;
  return trimmed.replace(CONTROL_CHARS, ""); // strip only the nasties
}

export default class UserManager {
  constructor(virtualCanvas, input) {
    this.virtualCanvas = virtualCanvas;
    this.input = input;

    this.userId = Math.floor(Math.random() * 256);
    this.color = this.input.toolbar.colorpicker.userColor;

    console.log(`userId:\t\t${this.userId}\nuserColor:  (${this.color})`);

    this.users = new Map(); //userId -> { name, color, cursor, timeout }
    this.username = "";

    this.dockedUserList = true;

    this.undoStack = [];
    this.redoStack = [];

    this.setupUserListDropdown();
    this.setupUsernameInput();
    this.renderUserList();

    window.addEventListener("userColorChange", ({ detail: { rgb } }) => {
      this.color = rgb;
      this.renderUserList();
    });

    document.addEventListener("DOMContentLoaded", () => {
      this.initFloatingUserList();
    });

    this.positionDockedList = this.positionDockedList.bind(this);
    window.addEventListener("resize", this.positionDockedList);
  }

  //update userId when collisions occur (for the userList)
  updateUserId(newUserId) {
    this.userId = newUserId;
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
      this.renderUserList();
    }, 5000);
    this.renderUserList();
  }

  previewLine(str) {
    return str.includes("\n") ? str.split(/\r?\n/)[0].slice(0, 24) : str;
  }

  undo(input) {
    if (!this.undoStack.length) return;
    this.redoStack.push(this.username);
    this.username = this.undoStack.pop();
    input.value = this.previewLine(this.username);
    this.renderUserList();
  }

  redo(input) {
    if (!this.redoStack.length) return;
    this.undoStack.push(this.username);
    this.username = this.redoStack.pop();
    input.value = this.previewLine(this.username);
    this.renderUserList();
  }

  setupUsernameInput() {
    const input = document.getElementById("customInputUsernameBox");
    if (!input) return;

    const pushHistory = (val) => {
      // push only if stack is empty or value differs from last entry
      if (
        this.undoStack.length === 0 ||
        this.undoStack[this.undoStack.length - 1] !== val
      ) {
        this.undoStack.push(val);
        this.redoStack.length = 0; // clear redo chain
      }
    };

    input.addEventListener("paste", (e) => {
      const text = e.clipboardData.getData("text/plain");

      if (text.includes("\n")) {
        // multiline → ASCII-art mode
        e.preventDefault(); // keep the \n’s (input can’t)
        pushHistory(this.username);
        //this.username = text; // send / render full art
        this.username = sanitizeName(text);
        input.value = this.previewLine(text);
        const previewLine = text.split(/\r?\n/)[0].slice(0, 24);
        input.value = previewLine; // keep toolbar compact

        this.renderUserList();
      }
      /* single-line paste: fall through → browser writes it normally the 'input' listener fires and updates this.username */
    });

    input.addEventListener("input", () => {
      pushHistory(this.username);
      this.username = sanitizeName(input.value);
      this.renderUserList();
    });

    input.addEventListener("keydown", (e) => {
      const zKey = e.key.toLowerCase() === "z";
      const yKey = e.key.toLowerCase() === "y";

      if ((e.ctrlKey || e.metaKey) && zKey) {
        // Ctrl/Cmd-Z
        e.preventDefault();
        this.undo(input);
      } else if ((e.ctrlKey || e.metaKey) && yKey) {
        // Ctrl-Y or Ctrl-Shift-Z
        e.preventDefault();
        this.redo(input);
      }
    });
  }

  updateName(userId, payload) {
    // const name = new TextDecoder().decode(payload);
    const name = sanitizeName(new TextDecoder().decode(payload));

    let user = this.users.get(userId);
    if (!user) {
      user = { name, color: "gray", cursor: this.createCursor(userId) };
      this.users.set(userId, user);
    } else {
      user.name = name;
      user.cursor.setAttribute("title", name);
    }
  }

  updateColor(userId, payload) {
    const [r, g, b] = payload;
    const color = `rgb(${r},${g},${b})`;

    let user = this.users.get(userId);
    if (!user) {
      user = { name: "", color, cursor: this.createCursor(userId) };
      this.users.set(userId, user);
    } else {
      user.color = color;
      user.cursor.style.setProperty("--secondary", color);
    }
  }

  updateCursor(userId, payload) {
    let user = this.users.get(userId);
    const [x, y] = decodePosition(payload);
    const [screenX, screenY] = this.virtualCanvas.positionInScreen(x, y);
    user.cursor.style.left = `${screenX}px`;
    user.cursor.style.top = `${screenY}px`;
  }

  removeUser(userId) {
    const user = this.users.get(userId);
    if (user?.cursor) user.cursor.remove();
    this.users.delete(userId);
  }

  createCursor(userId) {
    const div = document.createElement("div");
    div.id = `cursor${userId}`;
    div.classList.add("cursor");
    div.style.setProperty("border-radius", "50% 50%"); //circle mode activated
    // if we already know a color, use it
    const user = this.users.get(userId);
    if (user?.color) div.style.setProperty("--secondary", user.color);
    document.body.appendChild(div);
    return div;
  }

  //everytime something changes everything is rerendered, could prolly separate rendering of ownUser from allUserList rendering, technical debt stonks go up
  renderUserList() {
    const ul = document.getElementById("userList");
    if (!ul) return;
    ul.innerHTML = "";

    const isMultiline = (str) => str && str.includes("\n");

    const li = document.createElement("li");
    //li.className = "dropdown-item";

    const dot = document.createElement("div");
    dot.className = "user-color-indicator";
    dot.style.backgroundColor = `rgb(${this.color})`;

    // const isMultiline = (text) => text.includes("\n");

    const label = document.createElement(
      this.dockedUserList || !isMultiline(this.username) ? "span" : "pre"
    );
    if (this.dockedUserList && this.username.length >= 26) {
      label.textContent = this.username.substring(0, 24) + "…";
    } else {
      label.textContent = this.username || `(You)`; // are User ${this.userId})`;
    }
    li.append(dot, label);
    ul.appendChild(li);

    for (const [id, user] of this.users) {
      const li = document.createElement("li");
      //li.className = "dropdown-item";

      const dot = document.createElement("div");
      dot.className = "user-color-indicator";
      dot.style.backgroundColor = user.color;

      const isMultiline = (text) => text.includes("\n");

      const label = document.createElement(
        this.dockedUserList || !isMultiline(user.name) ? "span" : "pre"
      );

      if (this.dockedUserList && user.name.length >= 26) {
        label.textContent = user.name.substring(0, 24) + "…";
      } else {
        label.textContent = user.name || `(User ${id})`; // are User ${this.userId})`;
      }

      li.append(dot, label);
      ul.appendChild(li);
    }
  }

  setupUserListDropdown() {
    const toggle = document.getElementById("userListToggle");
    const list = document.getElementById("userList");

    if (!toggle || !list) {
      window.addEventListener("DOMContentLoaded", () =>
        this.setupUserListDropdown()
      );
      return;
    }

    toggle.addEventListener("click", () => {
      list.classList.toggle("hidden");
      toggle.classList.toggle("open"); // ← flip the arrow
    });
  }

  positionDockedList() {
    if (!this.dockedUserList) return; // ignore while user drags

    const caret = document.getElementById("userListToggle");
    const list = document.getElementById("userList");
    if (!caret || !list || list.style.display !== "block") return;

    const r = caret.getBoundingClientRect();
    list.style.left = `${r.right - list.offsetWidth}px`; // right-align to caret
    list.style.top = `${r.bottom + 24}px`; // 24 px gap
  }

  initFloatingUserList() {
    const caret = document.getElementById("userListToggle");
    const list = document.getElementById("userList");
    if (!caret || !list) return;

    /* detach once so the list is no longer constrained by the toolbar */
    if (!list.detached) {
      document.body.appendChild(list);
      list.detached = true;
    }

    /* toggle open/closed + position it under the caret */
    caret.addEventListener("click", () => {
      const open = list.style.display !== "block";
      if (!open) {
        list.style.display = "none";
        this.dockedUserList = true;
        this.renderUserList();

        return;
      }

      list.style.display = "block";
      this.dockedUserList = true;
      this.positionDockedList();
      this.renderUserList();
    });

    /* simple drag‑loop on the list itself (caret stays put) */
    let dragging = false,
      offX = 0,
      offY = 0;

    list.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return; // only left‑click
      dragging = true;
      this.dockedUserList = false;
      this.renderUserList();

      offX = e.clientX - list.offsetLeft;
      offY = e.clientY - list.offsetTop;
      e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      list.style.left = `${e.clientX - offX}px`;
      list.style.top = `${e.clientY - offY}px`;
    });

    list.addEventListener(
      "wheel",
      (e) => {
        const canScroll = list.scrollHeight > list.clientHeight;
        if (!canScroll) return; // list is shorter than viewport

        const delta = e.deltaY;
        const atTop = list.scrollTop === 0;
        const atBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 1; // ±1 for float errors

        /* Scroll up but not at very top → keep event inside the list        */
        /* Scroll down but not at very bottom → keep event inside the list   */
        if ((delta < 0 && !atTop) || (delta > 0 && !atBottom)) {
          e.stopPropagation(); // don’t reach canvas / body
          // (no preventDefault; browser handles the actual scrolling)
        }
        // else: we’re at the edge → bubble up so the canvas can zoom/pan
      },
      { passive: true }
    );

    window.addEventListener("mouseup", () => (dragging = false));
  }
}
