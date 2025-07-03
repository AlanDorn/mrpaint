import WebSocket from "ws";
import CanvasState from "./canvasstate";
import { OPCODE, OPCODE_NAME } from "./shared/instructionset.js";

class UserMap<V> extends Map<number, V> {}

export default class CanvasLobby {
  id: string;

  transactionIndex = 0; //To init a user the first byte has to be the userId
  transactions: Uint8Array = new Uint8Array(2 ** 27);
  
  activeUsers = new UserMap<WebSocket>();
  syncingUsers = new UserMap<WebSocket>();
  syncingData = new UserMap<Uint8Array[]>();
  canvasState: CanvasState = new CanvasState(1);
  buildStates = new UserMap<CanvasState>();

  //combine these two three! A new UserMap that contains UserID | userName | userColor right?
  userId = 0;
  userColors = new UserMap<Uint8Array>();
  userNames = new UserMap<Uint8Array>();

  constructor(id: string) {
    this.id = id;
    this.canvasState.snapshotCount = 0;
  }

  addUser(ws: WebSocket) {
    const buildState = new CanvasState(this.transactionIndex);

    this.userId++;

    this.syncingUsers.set(this.userId, ws);
    this.syncingData.set(this.userId, []);
    this.buildStates.set(this.userId, buildState);

    ws.send(new Uint8Array([OPCODE.ASSIGN_USER_ID, this.userId])); //communicate to client what their userID is

    const previousCanvasData = this.transactions.subarray(
      0,
      this.transactionIndex
    );

    // console.log(`@canvaslobby@adduser\n ${previousCanvasData}`);

    ws.send(
      new Uint8Array([
        OPCODE.TS_TRANSACTION_HISTORY,
        this.userId,
        ...previousCanvasData,
      ])
    ); //communicate to new client any and all canvas edits

    this.canvasState.send(this.userId, ws);

    // console.log(
    //   `User ${this.userId} joined. Current users & colours →`,
    //   Array.from(this.userColors.entries()).map(
    //     ([id, rgb]) => `id=${id}  rgb=[${rgb.join(",")}]`
    //   )
    // );

    this.userColors.forEach((rgb, userId) => {
      ws.send(new Uint8Array([OPCODE.USER_COLOR_UPDATE, userId, ...rgb]));
    });

    this.userNames.forEach((names, userId) => {
      ws.send(new Uint8Array([OPCODE.USERNAME_UPDATE, userId, ...names]));
    });

    return this.userId;
  }

  deleteUser(userId: number) {
    this.activeUsers.delete(userId);
    this.syncingUsers.delete(userId);
    this.syncingData.delete(userId);
    this.buildStates.delete(userId);
    this.userColors.delete(userId);

    this.activeUsers.forEach((ws) => ws.send([OPCODE.USER_LEFT, userId]));

    console.log(
      `\n@canvaslobby-delete \t User ${userId} deleted\nCurrent Unique Users:`,
      Array.from(this.userColors.entries()).map(
        ([userId, rgb]) => `id=${userId}  rgb=[${rgb.join(",")}]`
      )
    );

    // console.log(`\n@canvaslobby-delete2 \t Current Users:`, Array.from(this.userColors.entries()).map(
    //   ([id, rgb]) => `id=${id}  rgb=[${rgb.join(",")}]`));
  }

  handle(userId: number, event: WebSocket.RawData) {
    if (this.activeUsers.has(userId)) this.send(userId, event);
    else this.sync(userId, event);
  }

  // send(senderId: number, event: WebSocket.RawData) {
  //   const eventData = new Uint8Array(event as Buffer);

  //   const opcode = eventData[0];
  //   const userId = eventData[1];
  //   const payload = eventData.subarray(2);

  //   if (opcode === OPCODE.USER_COLOR_UPDATE) {
  //     this.activeUsers.forEach((ws, otherId) => {
  //       if (otherId !== senderId) ws.send(eventData);
  //     });
  //     this.syncingData.forEach((list) => list.push(eventData)); // joiners get it

  //     this.userColors.set(senderId, payload.subarray(0, 3));

  //     console.log(
  //       "\n@canvaslobby-send\nCurrent colors:",
  //       Array.from(this.userColors.entries()).map(
  //         ([otherId, rgb]) => `id=${otherId}  rgb=[${rgb.join(",")}]`
  //       )
  //     );

  //     return;
  //   }

  //   this.activeUsers.forEach((socket, otherId) => {
  //     if (otherId !== senderId) socket.send(eventData);
  //   });

  //   this.syncingData.forEach((eventList) => eventList.push(eventData));
  //   const justTransactions = eventData.subarray(2);
  //   this.transactions.set(justTransactions, this.transactionIndex);
  //   this.transactionIndex += justTransactions.length;
  // }

  send(senderId: number, event: WebSocket.RawData) {
    // Ensure we’re working with a Uint8Array
    const eventData =
      event instanceof Uint8Array
        ? event
        : new Uint8Array(event as ArrayBuffer);

    const opcode = eventData[0]; // first byte
    const userId = eventData[1]; // always the *sender’s* ID in this protocol
    const payload = eventData.subarray(2);

    /* ─────────────────────────  USER COLOR UPDATE  ─────────────────────────── */
    if (opcode === OPCODE.USER_COLOR_UPDATE) {
      // cache the colour ([r,g,b])
      this.userColors.set(senderId, payload.subarray(0, 3));

      // broadcast to everyone except the sender
      this.activeUsers.forEach((ws, id) => {
        if (id !== senderId) ws.send(eventData);
      });

      // make sure late joiners get it during sync
      this.syncingData.forEach((list) => list.push(eventData));

      console.log(
        "\n@canvaslobby-send\nCurrent colors:",
        Array.from(this.userColors.entries()).map(
          ([id, rgb]) => `id=${id}  rgb=[${rgb.join(",")}]`
        )
      );

      return;
    }

    if (opcode === OPCODE.USERNAME_UPDATE) {
      // cache the name
      this.userNames.set(senderId, payload);

      // broadcast to everyone except the sender
      this.activeUsers.forEach((ws, id) => {
        if (id !== senderId) ws.send(eventData);
      });

      // make sure late joiners get it during sync
      this.syncingData.forEach((list) => list.push(eventData));

      const decoder = new TextDecoder();
      const name = decoder.decode(payload);

      console.log(
        `@canvaslobby-send\nCurrent usernames:`,
        Array.from(this.userNames.entries()).map(
          ([id, nameBytes]) =>
            `id=${id}  name=${new TextDecoder().decode(nameBytes)}`
        )
      );

      return;
    }

    /* ──────────────────  HANDLE ALL OTHER OPCODES  ─────────────────────────── */
    switch (opcode) {
      /* server-originated packets: send to EVERYONE */
      case OPCODE.ASSIGN_USER_ID:
      case OPCODE.USER_LEFT:
      case OPCODE.TS_SNAPSHOT_COUNT:
      case OPCODE.TS_SNAPSHOT:
      case OPCODE.TS_PNG:
      case OPCODE.TS_TRANSACTION_HISTORY: {
        // this.activeUsers.forEach((ws) => ws.send(eventData));
        break;
      }

      /* client-originated packets: skip the sender */
      default: {
        this.activeUsers.forEach((ws, id) => {
          if (id !== senderId) ws.send(eventData);
        });
      }
    }

    /* store in per-joiner sync buffer (everyone needs full history) */
    this.syncingData.forEach((list) => list.push(eventData));

    /* ────────────────  append to rolling transaction log  ──────────────────── */
    if (opcode === OPCODE.TRANSACTION_UPDATE) {
      const txnBytes = eventData.subarray(2); // header is now only 2 bytes
      this.transactions.set(txnBytes, this.transactionIndex);
      this.transactionIndex += txnBytes.length;
    }
  }

  // sync(userId: number, event: WebSocket.RawData) {
  //   console.log(`\n[SYNC] Called for user ${userId}`);
  //   console.log(`[SYNC] Raw event bytes:`, new Uint8Array(event as Buffer));

  //   const buildState = this.buildStates.get(userId);
  //   if (!buildState) {
  //     console.warn(`[SYNC] No buildState found for user ${userId}`);
  //     return;
  //   }

  //   console.log(`[SYNC] Using buildState with index ${buildState.index}`);

  //   buildState.handle(event);

  //   console.log(
  //     `[SYNC] buildState status: snapshotCount=${buildState.snapshotCount}, snapshots=${buildState.snapshots.length}, pngLength=${buildState.png.length}`
  //   );

  //   if (!buildState.isFinished()) {
  //     console.log(`[SYNC] buildState for user ${userId} not finished yet`);
  //     return;
  //   }

  //   console.log(`[SYNC] buildState for user ${userId} is finished!`);

  //   if (buildState.index > this.canvasState.index) {
  //     console.log(
  //       `[SYNC] buildState index ${buildState.index} is newer than canvasState index ${this.canvasState.index}. Overwriting canvasState.`
  //     );
  //     this.canvasState = buildState;
  //   } else {
  //     console.log(
  //       `[SYNC] Keeping existing canvasState index ${this.canvasState.index}`
  //     );
  //   }

  //   this.buildStates.delete(userId);

  //   const socket = this.syncingUsers.get(userId);
  //   const syncingData = this.syncingData.get(userId);
  //   if (!socket || !syncingData) {
  //     console.warn(`[SYNC] Missing socket or syncingData for user ${userId}`);
  //     return;
  //   }

  //   this.activeUsers.set(userId, socket);
  //   this.syncingData.delete(userId);
  //   this.syncingUsers.delete(userId);

  //   console.log(
  //     `[SYNC] Promoting user ${userId} to activeUsers. Sending ${syncingData.length} buffered events.`
  //   );

  //   syncingData.forEach((data, i) => {
  //     console.log(
  //       `[SYNC] Sending buffered event ${i + 1}/${syncingData.length}`
  //     );
  //     socket.send(data);
  //   });
  // }

  sync(userId: number, event: WebSocket.RawData) {
    const eventData =
      event instanceof Uint8Array
        ? event
        : new Uint8Array(event as ArrayBuffer); //I dont think this is needed as canvasState already does this right?

    const buildState = this.buildStates.get(userId);
    if (!buildState) return;
    buildState.handle(event);

    if (!buildState.isFinished()) {
      console.log(
        `@sync → buildState for user ${userId} not finished. Waiting...`
      );

      return;
    }
    // console.log(`\n@sync → buildState is finished for user ${userId}`);
    // console.log(`@sync → buildState.index = ${buildState.index}`);
    // console.log(
    //   `@sync → current canvasState.index = ${this.canvasState.index}`
    // );
    // this.canvasState = buildState.index > this.canvasState.index ? buildState : this.canvasState;
    if (buildState.index > this.canvasState.index) {
      console.log(`@sync → Promoting buildState to global canvasState`);
      this.canvasState = buildState;
    } else {
      console.warn(
        `@sync → buildState is older or same as current. Not promoting.`
      );
    }
    this.buildStates.delete(userId);
    const socket = this.syncingUsers.get(userId);
    const syncingData = this.syncingData.get(userId);
    if (!socket || !syncingData) return;
    this.activeUsers.set(userId, socket);
    this.syncingData.delete(userId);
    this.syncingUsers.delete(userId);
    syncingData.forEach((data) => socket.send(data));
  }

  print() {
    console.log("==========================");
    console.log(`Lobby:    ${this.id}`);
    console.log(`Size:     ${formatBytes(this.transactionIndex)}`);
  }
}

function formatBytes(bytes: number, decimals = 3) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024,
    dm = decimals < 0 ? 0 : decimals,
    sizes = ["Bs", "KBs", "MBs", "GBs", "TBs"],
    i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}
