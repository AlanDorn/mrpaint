import { transactionLog, virtualCanvas } from "./client.js";
import { operationId, pencilTransaction } from "./transaction.js";

const START_INTERVAL = 1000 / 60; // ≈16.66ms per frame

// ─── shared constants ───────────────────────────────────────────────────────
const MAX_ACCEL = 3;
const VELOCITY_DAMP = 0.98;
const MAX_SPEED = 100;

const REST = 127;
const STIFFNESS = 0.01;
const COLOR_DAMP = 0.01;
const NOISE = 10;

// ─── per-drawing state storage ──────────────────────────────────────────────
let nextDrawingId = 1;
const drawings = new Map(); // id → { lagMS, x,y,lastX,lastY, vx,vy, r,vr, g,vg, b,vb }

// ─── helper functions (only one copy!) ─────────────────────────────────────
function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function stepColor(channel, velocity) {
  const springF = (REST - channel) * STIFFNESS;
  const dampF = -velocity * COLOR_DAMP;
  const noiseF = (Math.random() * 2 - 1) * NOISE;
  const accel = springF + dampF + noiseF;
  velocity += accel;
  channel += velocity;
  return [clamp(channel, 0, 255), velocity];
}

function nextPosition(state) {
  state.lastX = state.x;
  state.lastY = state.y;

  const ax = (Math.random() * 2 - 1) * MAX_ACCEL;
  const ay = (Math.random() * 2 - 1) * MAX_ACCEL;
  state.vx += ax;
  state.vy += ay;

  // clamp speed
  const speed = Math.hypot(state.vx, state.vy);
  if (speed > MAX_SPEED) {
    state.vx = (state.vx / speed) * MAX_SPEED;
    state.vy = (state.vy / speed) * MAX_SPEED;
  }
  state.vx *= VELOCITY_DAMP;
  state.vy *= VELOCITY_DAMP;

  state.x += state.vx;
  state.y += state.vy;

  const W = virtualCanvas.width;
  const H = virtualCanvas.height;
  if (state.x < 0) state.x += W;
  if (state.y < 0) state.y += H;
  if (state.x >= W) state.x -= W;
  if (state.y >= H) state.y -= H;

  state.x = Math.floor(state.x);
  state.y = Math.floor(state.y);
}

function randomPoints(state) {
  const p0 = [state.lastX, state.lastY];
  const p1 = [state.x, state.y];
  nextPosition(state);
  const p2 = [state.x, state.y];

  // wrap‐around shortcut
  if (Math.abs(p1[0] - p2[0]) > 50)
    p2[0] = (p2[0] - virtualCanvas.width + 1) * -1;
  if (Math.abs(p1[1] - p2[1]) > 50)
    p2[1] = (p2[1] - virtualCanvas.height + 1) * -1;

  return [p0, p1, p2];
}

function randomColor(state) {
  [state.r, state.vr] = stepColor(state.r, state.vr);
  [state.g, state.vg] = stepColor(state.g, state.vg);
  [state.b, state.vb] = stepColor(state.b, state.vb);
  return [Math.round(state.r), Math.round(state.g), Math.round(state.b)];
}

// ─── the single ticker ───────────────────────────────────────────────────────
let globalTicker = null;
function tick() {
  for (const state of drawings.values()) {
    const txn = pencilTransaction(
      operationId(),
      randomColor(state),
      20,
      ...randomPoints(state)
    );
    setTimeout(
      () => transactionLog.pushClient(txn),
      state.lagMS / 4 + (state.lagMS / 2) * Math.random()
    );
  }
}

// ─── public API ─────────────────────────────────────────────────────────────
window.startRandomDrawing = (lagMS = 40) => {
  const id = nextDrawingId++;
  drawings.set(id, {
    lagMS,
    x: 0,
    y: 0,
    lastX: 0,
    lastY: 0,
    vx: 0,
    vy: 0,
    r: Math.random() * 256,
    vr: 0,
    g: Math.random() * 256,
    vg: 0,
    b: Math.random() * 256,
    vb: 0,
  });

  if (!globalTicker) {
    globalTicker = setInterval(tick, START_INTERVAL);
  }

  return `Random drawing started (id=${id}).`;
};

window.stopRandomDrawing = (id) => {
  if (!drawings.has(id)) {
    return `No drawing with id=${id} to stop.`;
  }
  drawings.delete(id);

  if (drawings.size === 0 && globalTicker) {
    clearInterval(globalTicker);
    globalTicker = null;
  }

  return `Stopped random drawing id=${id}.`;
};
