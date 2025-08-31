import { OP_TYPE, OP_PRESENCE } from "./shared/instructionset.js";
import { encodePosition } from "./transaction.js";
import UserManager from "./usermanager.js";

export default class PresenceManager {
  constructor(ws, input, previewManager, virtualCanvas) {
    this.ws = ws;
    this.input = input;
    this.previewManager = previewManager;
    this.virtualCanvas = virtualCanvas;

    this.userManager = new UserManager(input, virtualCanvas);
    
    this.previewManager.attachUserManager(this.userManager);

    this.userId = this.userManager.userId;

    setInterval(() => {
      if (!ws.open) return;
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

    setInterval(() => {
      if (!ws.open) return;
      const previewData = this.previewManager.getPreviewData();
      if (previewData) {
        ws.send(
          new Uint8Array([
            OP_TYPE.PRESENCE,
            OP_PRESENCE.PREVIEW_UPDATE,
            this.userId,
            ...previewData,
          ])
        );
      }
    }, 1000 / 60);
  }

  handle(eventData) {
    const subType = eventData[0]; //SINCE we are in presenceManager, OP_TYPE.PRESENCE is already stripped in socket. good idea? yay or nay?
    const senderId = eventData[1];
    const payload = eventData.subarray(2);

    this.userManager.trackUser(senderId);
    if (senderId === this.userId) {
      //should this logic be moved in userManager?
      this.userId = Math.floor(Math.random() * 256);
      this.userManager.updateUserId(this.userId);
      console.log(`New UserID = ${this.userId}`);
    }

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
      case OP_PRESENCE.PREVIEW_UPDATE:
        this.previewManager.handlePreviewLine(senderId, payload);
        break;
      case OP_PRESENCE.TOOL_UPDATE:
        // this.previewManager.handleToolUpdate(senderId, payload);
        break;
    }
  }
}
