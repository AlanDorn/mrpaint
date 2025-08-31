import { ws, input, virtualCanvas } from "./client.js";
import { OP_TYPE, OP_PRESENCE } from "./shared/instructionset.js";
import { encodePosition } from "./transaction.js";
import UserManager from "./usermanager.js";
// import PreviewManager from "./previewmanager.js";

export default class PresenceManager {
  constructor() {
    this.userId = Math.floor(Math.random() * 256);

    this.userManager = new UserManager(virtualCanvas, this.userId);
    // this.previewManager = new PreviewManager(input, virtualCanvas);

    setInterval(() => {
      if (!ws.open) return;
      // console.log(encodePosition(input.x, input.y));
      ws.send(
        new Uint8Array([
          OP_TYPE.PRESENCE,
          OP_PRESENCE.MOUSE_POSITION,
          this.userId,
          ...encodePosition(virtualCanvas.positionInCanvas(input.x, input.y)),
        ])
      );
    }, 1000 / 60);

    setInterval(() => {
      if (!ws.open) return;
      ws.send(
        new Uint8Array([
          OP_TYPE.PRESENCE,
          OP_PRESENCE.USER_COLOR_UPDATE,
          this.userId,
          ...this.userManager.color,
        ])
      );
    }, 1000 / 4);

    setInterval(() => {
      if (!ws.open) return;
      ws.send(
        new Uint8Array([
          OP_TYPE.PRESENCE,
          OP_PRESENCE.USERNAME_UPDATE,
          this.userId,
          ...new TextEncoder().encode(this.userManager.username),
        ])
      );
    }, 1000 / 4);

    ws.socketSelector[OP_TYPE.PRESENCE] = (eventData) =>
      this.handle(eventData.subarray(1));
  }

  handle(eventData) {
    const subType = eventData[0]; //SINCE we are in presenceManager, OP_TYPE.PRESENCE is already stripped in socket. good idea? yay or nay?
    const senderId = eventData[1];
    const payload = eventData.subarray(2);

    this.userManager.trackUser(senderId);
    if (senderId === this.userId) this.userId = Math.floor(Math.random() * 256);

    switch (subType) {
      case OP_PRESENCE.MOUSE_POSITION:
        this.userManager.updateCursor(senderId, payload);
        break;

      case OP_PRESENCE.USERNAME_UPDATE:
        this.userManager.updateName(senderId, payload);
        break;
      case OP_PRESENCE.USER_COLOR_UPDATE:
        this.userManager.updateColor(senderId, payload);
        break;
      case OP_PRESENCE.PREVIEW_LINE:
        // this.previewManager.handlePreviewLine(senderId, payload);
        break;
      case OP_PRESENCE.TOOL_UPDATE:
        // this.previewManager.handleToolUpdate(senderId, payload);
        break;
    }
  }
}
