// ruler.js — DM distance ruler: persistent measurements + optional player mirror (PresenceVTT).
//
// Part of PresenceVTT, a fork of Evermist (MIT, Copyright (c) 2026 Hinnful).
//
// Style mirrors viewport.js: plain <script> (no ES modules), loaded before the inline
// script. Function bodies reference inline-script globals lazily (resolved at CALL time):
// zoom, gridSize, toScreen, screenToMap, drawCursor, cursorCtx, cursorCanvas, container,
// shape, lastScreenX/Y, playerWindow, distPointToSegment (tools.js).
//
// Behaviour (chosen with the user 2026-06-30):
//  • 📏 ruler mode (toolbar toggle). Drag on empty space → a measurement LINE that STAYS
//    (persistent, like a drawing). Lines accumulate in `rulers[]`.
//  • In ruler mode, clicking ON a line deletes just that line. The 🗑 panel button clears all.
//  • Committed lines stay visible even after leaving ruler mode (drawn from drawCursor).
//  • "👁 Mostrar aos players" toggle mirrors the whole set to the projection ('ruler-set').
//    Private by default. The player draws them with ITS OWN pan/zoom (anchored each doRender).
//  • Measures grid CELLS: hypot(dx,dy)/gridSize in WORLD coords (zoom-independent).

// ─── DM state ─────────────────────────────────────────────────────────────────
let rulerModeOn        = false;  // toolbar 📏 toggle
let rulerDragging      = false;  // left button held, drawing a new line
let rulers             = [];     // committed lines: [{ a:{x,y}, b:{x,y} }] in WORLD coords
let rulerDraft         = null;   // in-progress line during a drag: { a, b } (WORLD)
let rulerShareToPlayers = false; // 👁 toggle — mirror the set to the projection

// Future hook — set to a key string (e.g. 'm') from an in-app setting to enable a
// hold-to-measure gesture. rulerTryKeyDown/Up stay inert while null.
let rulerHotkey   = null;

// Optional real-world scale: units per grid cell. null → cells only (no scale exists yet).
let rulerUnitPerCell = null;
let rulerUnitLabel   = '';

// ─── Player mirror state (projection window only) ─────────────────────────────
let playerRulers = []; // [{ a:{x,y}, b:{x,y}, text }]

// ─── Mode (DM) ────────────────────────────────────────────────────────────────
function rulerIsOn() { return rulerModeOn; }

function setRulerMode(on) {
  rulerModeOn = !!on;
  if (rulerModeOn && typeof tokenModeOn !== 'undefined' && tokenModeOn) setTokenMode(false); // exclusive modes
  if (rulerModeOn && typeof aoeModeOn !== 'undefined' && aoeModeOn) setAoeMode(false);
  if (rulerModeOn && typeof drawModeOn !== 'undefined' && drawModeOn) setDrawMode(false);
  if (!rulerModeOn) rulerCancelDraft();
  const btn = document.getElementById('btn-ruler');
  if (btn) btn.classList.toggle('active', rulerModeOn);
  if (typeof container !== 'undefined' && container) {
    container.style.cursor = rulerModeOn ? 'crosshair'
                           : (shape === 'select' ? 'default' : 'crosshair');
  }
  if (typeof updateContextPanels === 'function') updateContextPanels();
  if (typeof drawCursor === 'function') drawCursor(lastScreenX, lastScreenY);
}

function toggleRulerMode() { setRulerMode(!rulerModeOn); }

// ─── Pointer interception (called from index.html DM handlers) ────────────────
// Each returns true when it consumed the event so the caller skips pan/tool logic.
function rulerOnDown(world) {
  if (!rulerModeOn) return false;
  // Click ON an existing line → delete just that one (don't start a new drag).
  const hit = rulerHitTest(world);
  if (hit >= 0) {
    rulers.splice(hit, 1);
    rulerSyncToPlayers();
    return true;
  }
  rulerDragging = true;
  const s = rulerSnap(world);
  rulerDraft = { a: { x: s.x, y: s.y }, b: { x: s.x, y: s.y } };
  return true;
}

function rulerOnMove(world) {
  if (!rulerDragging || !rulerDraft) return false;
  rulerDraft.b = rulerSnap(world);
  if (rulerShareToPlayers) rulerSyncToPlayers(); // live preview to players while sharing
  return true;
}

// Snap a world point to the nearest "meaningful" grid position: a cell CENTER, a
// corner/VERTEX, or an edge MIDPOINT — never anywhere else. Those three together are
// exactly the half-cell lattice (multiples of gridSize/2), so snapping each axis to
// the nearest gridSize/2 step yields only those points. Always on for the ruler
// (independent of the polygon snapToGrid toggle); square grids only, and only when
// the grid is shown (no visible grid → free placement).
function rulerSnap(world) {
  if (!gridEnabled || gridMode !== 'square' || !(gridSize > 0)) return { x: world.x, y: world.y };
  const half = gridSize / 2;
  return {
    x: Math.round((world.x - gridOffsetX) / half) * half + gridOffsetX,
    y: Math.round((world.y - gridOffsetY) / half) * half + gridOffsetY,
  };
}

function rulerOnUp() {
  if (!rulerDragging) return false;
  rulerDragging = false;
  // Commit only if it's an actual drag (a bare click made a zero-length draft → discard).
  if (rulerDraft) {
    const minLen = 3 / (zoom || 1); // ~3 screen px
    if (Math.hypot(rulerDraft.b.x - rulerDraft.a.x, rulerDraft.b.y - rulerDraft.a.y) >= minLen) {
      rulers.push(rulerDraft);
    }
  }
  rulerDraft = null;
  rulerSyncToPlayers();
  return true;
}

function rulerCancelDraft() {
  rulerDragging = false;
  rulerDraft = null;
}

function rulerClearAll() {
  rulers = [];
  rulerDraft = null;
  rulerDragging = false;
  rulerSyncToPlayers();
  if (typeof drawCursor === 'function') drawCursor(lastScreenX, lastScreenY);
}

// World-space hit-test against committed lines; returns index or -1.
function rulerHitTest(world) {
  const tol = 8 / (zoom || 1); // ~8 screen px
  for (let i = rulers.length - 1; i >= 0; i--) {
    const r = rulers[i];
    if (distPointToSegment(world.x, world.y, r.a.x, r.a.y, r.b.x, r.b.y) <= tol) return i;
  }
  return -1;
}

// ─── Player visibility toggle ─────────────────────────────────────────────────
function setRulerShareToPlayers(on) {
  rulerShareToPlayers = !!on;
  const btn = document.getElementById('btn-ruler-share');
  if (btn) btn.classList.toggle('active', rulerShareToPlayers);
  rulerSyncToPlayers();
}
function toggleRulerShareToPlayers() { setRulerShareToPlayers(!rulerShareToPlayers); }

// ─── Sharing to the player ────────────────────────────────────────────────────
// Sends the WHOLE set (or [] when sharing is off) so the projection always matches.
function rulerSyncToPlayers() {
  if (typeof playerWindow === 'undefined' || !playerWindow || playerWindow.closed) return;
  let lines = [];
  if (rulerShareToPlayers) {
    const all = rulerDraft ? rulers.concat([rulerDraft]) : rulers;
    lines = all.map(r => ({
      ax: r.a.x, ay: r.a.y, bx: r.b.x, by: r.b.y, text: rulerTextFor(r.a, r.b),
    }));
  }
  playerWindow.postMessage({ type: 'ruler-set', lines }, '*');
}

// Re-send current state when the projection (re)opens (called from PLAYER_READY).
function rulerResyncToPlayer() { rulerSyncToPlayers(); }

// ─── Future hotkey hooks (inert until rulerHotkey is set by an in-app setting) ──
function rulerTryKeyDown(e) {
  if (!rulerHotkey || e.repeat) return false;
  if ((e.key || '').toLowerCase() !== rulerHotkey) return false;
  setRulerMode(true);
  return true;
}
function rulerTryKeyUp(e) {
  if (!rulerHotkey) return false;
  if ((e.key || '').toLowerCase() !== rulerHotkey) return false;
  setRulerMode(false);
  return true;
}

// ─── Distance text ────────────────────────────────────────────────────────────
function rulerTextFor(a, b) {
  const worldDist = Math.hypot(b.x - a.x, b.y - a.y);
  const cells = gridSize > 0 ? worldDist / gridSize : 0;
  let text = cells.toFixed(1).replace('.', ',') + (cells.toFixed(1) === '1.0' ? ' célula' : ' células');
  if (rulerUnitPerCell) {
    const units = Math.round(cells * rulerUnitPerCell * 10) / 10;
    text += '  ·  ' + String(units).replace('.', ',') + ' ' + rulerUnitLabel;
  }
  return text;
}

// ─── Draw: DM (called from drawCursor; committed lines persist across tools) ───
function drawRuler(ctx) {
  for (const r of rulers) rulerPaintLine(ctx, r.a, r.b, rulerTextFor(r.a, r.b));
  if (rulerDraft) rulerPaintLine(ctx, rulerDraft.a, rulerDraft.b, rulerTextFor(rulerDraft.a, rulerDraft.b));
}

// ─── Draw: player mirror (its own #cursor-canvas, its own pan/zoom) ───────────
function drawPlayerRuler() {
  if (typeof cursorCtx === 'undefined' || !cursorCtx || !cursorCanvas) return;
  cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
  for (const r of playerRulers) rulerPaintLine(cursorCtx, r.a, r.b, r.text);
}

function rulerApplyPlayerSet(msg) {
  const lines = (msg && msg.lines) || [];
  playerRulers = lines.map(L => ({ a: { x: L.ax, y: L.ay }, b: { x: L.bx, y: L.by }, text: L.text || '' }));
  drawPlayerRuler();
}

// ─── Low-level paint (shared by DM + player; uses this window's toScreen) ──────
function rulerPaintLine(ctx, aWorld, bWorld, text) {
  const a = toScreen(aWorld.x, aWorld.y);
  const b = toScreen(bWorld.x, bWorld.y);

  ctx.save();
  ctx.setLineDash([]);

  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 232, 120, 0.95)'; // warm gold — reads over fog/map/grid
  ctx.beginPath();
  ctx.moveTo(a.sx, a.sy);
  ctx.lineTo(b.sx, b.sy);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 232, 120, 0.95)';
  for (const p of [a, b]) {
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  rulerDrawLabel(ctx, b.sx, b.sy, text);
  ctx.restore();
}

function rulerDrawLabel(ctx, x, y, text) {
  ctx.font = '600 14px system-ui, "Segoe UI", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const padX = 7, padY = 4, h = 14;
  const w = ctx.measureText(text).width;
  const bx = x + 14, by = y - 18; // up-and-right of the endpoint

  ctx.fillStyle   = 'rgba(20, 18, 40, 0.85)';
  ctx.strokeStyle = 'rgba(255, 232, 120, 0.6)';
  ctx.lineWidth   = 1;
  rulerRoundRect(ctx, bx - padX, by - h / 2 - padY, w + padX * 2, h + padY * 2, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 245, 210, 0.98)';
  ctx.fillText(text, bx, by);
}

function rulerRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}
