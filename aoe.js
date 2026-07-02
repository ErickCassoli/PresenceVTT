// aoe.js — area-of-effect templates (PresenceVTT addition).
//
// Part of PresenceVTT, a fork of Evermist (MIT, Copyright (c) 2026 Hinnful).
//
// PURELY VISUAL — no damage, no "who's inside", no rules. Translucent shapes sized in grid
// CELLS. Shapes: burst/circle, cone, line, emanation. Drawn on the shared #token-canvas
// (above grid, BELOW tokens) so minis sit on top of the area. Synced to the projection via
// 'aoe-update' (resynced on PLAYER_READY).
//
// PERSISTENT and EDITABLE, like tokens:
//   • Drag on empty space → create a shape (it STAYS).
//   • Drag a shape's body  → move it (origin snaps to the half-cell lattice).
//   • Drag its tip handle  → resize / re-aim it.
//   • Color picker recolors the selected shape; right-click or Delete removes it; 🗑 clears all.
// Same load style as tokens.js — plain <script>, lazy globals (zoom, gridSize, toScreen,
// tokenSnap, tokenHitTest, container, shape, updateContextPanels, drawCursor, lastScreenX/Y,
// tokenCtx, tokensDirty, scheduleRender, playerWindow).

let aoes        = [];       // persistent areas (synced); on the player, filled from 'aoe-update'
let aoeModeOn   = false;
let aoeShape    = 'burst';  // 'burst' | 'cone' | 'line' | 'emanation'
let aoeColor    = '#ff7a45';// current colour for NEW areas (and the selected one when changed)
let aoeDraft    = null;     // { id, shape, x, y, x2, y2, color } while creating
let aoeDragging = false;    // creating a new area
let aoeSelectedId = null;   // the area being edited
let aoeMoving   = false;    // dragging the body of the selected area
let aoeResizing = false;    // dragging the tip handle of the selected area
let aoeGrabStart = null;    // cursor world pos at move-start
let aoeGrabOrig  = null;    // { x, y, x2, y2 } snapshot of the area at move-start
let _nextAoeId  = 1;
const AOE_COLOR = '#ff7a45'; // default orange — distinct from tokens (cyan) and the ruler (gold)
const AOE_CONE_HALF = Math.PI / 6; // 30° half-angle (60° cone)

function aoeIsOn() { return aoeModeOn; }

function setAoeMode(on) {
  aoeModeOn = !!on;
  if (aoeModeOn) {
    if (typeof setRulerMode === 'function' && rulerModeOn) setRulerMode(false);
    if (typeof setTokenMode === 'function' && tokenModeOn) setTokenMode(false);
    if (typeof drawModeOn !== 'undefined' && drawModeOn) setDrawMode(false);
  } else { aoeCancelDraft(); aoeSelectedId = null; }
  const btn = document.getElementById('btn-aoe');
  if (btn) btn.classList.toggle('active', aoeModeOn);
  if (typeof container !== 'undefined' && container) {
    container.style.cursor = aoeModeOn ? 'crosshair' : (shape === 'select' ? 'default' : 'crosshair');
  }
  if (typeof updateContextPanels === 'function') updateContextPanels();
  if (typeof drawCursor === 'function') drawCursor(lastScreenX, lastScreenY);
  aoeScheduleRedraw();
}
function toggleAoeMode() { setAoeMode(!aoeModeOn); }

function setAoeShape(s) {
  aoeShape = s;
  document.querySelectorAll('.aoe-shape-btn').forEach(b => b.classList.toggle('active', b.dataset.shape === s));
}

// Color picker: recolor the selected area (or set the colour for the next new one).
function setAoeColor(c) {
  aoeColor = c;
  const sel = aoeSelectedId != null ? aoes.find(a => a.id === aoeSelectedId) : null;
  if (sel) { sel.color = c; aoeSyncAndRedraw(); }
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────
function aoeCell() { return (typeof gridSize === 'number' && gridSize > 0) ? gridSize : 70; }
function aoeGeom(a) {
  const cell = aoeCell();
  const cells = aoeSizeCells(a);
  return { cell, cells, sizeW: cells * cell, ang: Math.atan2(a.y2 - a.y, a.x2 - a.x) };
}
// Size in whole grid cells (snaps the radius/length to the grid).
function aoeSizeCells(a) {
  return Math.max(1, Math.round(Math.hypot(a.x2 - a.x, a.y2 - a.y) / aoeCell()));
}
// World point of the resize/re-aim handle (the shape's tip along its drag direction).
function aoeHandlePoint(a) {
  const g = aoeGeom(a);
  return { x: a.x + Math.cos(g.ang) * g.sizeW, y: a.y + Math.sin(g.ang) * g.sizeW };
}
function aoeOnHandle(a, world) {
  const h = aoeHandlePoint(a);
  const tol = Math.max(aoeCell() * 0.35, 14 / (zoom || 1));
  return Math.hypot(world.x - h.x, world.y - h.y) <= tol;
}
// Is the world point inside the painted shape?
function aoePointInShape(a, wx, wy) {
  const g = aoeGeom(a);
  const dx = wx - a.x, dy = wy - a.y;
  if (a.shape === 'line') {
    const along = dx * Math.cos(g.ang) + dy * Math.sin(g.ang);
    const perp  = -dx * Math.sin(g.ang) + dy * Math.cos(g.ang);
    return along >= 0 && along <= g.sizeW && Math.abs(perp) <= g.cell / 2;
  }
  const d = Math.hypot(dx, dy);
  if (d > g.sizeW) return false;
  if (a.shape === 'cone') {
    if (d < 1e-3) return true;
    let da = Math.atan2(dy, dx) - g.ang;
    while (da >  Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    return Math.abs(da) <= AOE_CONE_HALF;
  }
  return true; // burst / emanation → circle
}
function aoeHitBody(world) {
  for (let i = aoes.length - 1; i >= 0; i--) if (aoePointInShape(aoes[i], world.x, world.y)) return aoes[i].id;
  return null;
}

// ─── Placement / editing (called from index.html DM handlers) ─────────────────
function aoeOnDown(world, shift) {
  if (!aoeModeOn) return false;
  // 1) Tip handle of the selected area → resize / re-aim.
  if (aoeSelectedId != null) {
    const sel = aoes.find(a => a.id === aoeSelectedId);
    if (sel && aoeOnHandle(sel, world)) { aoeResizing = true; return true; }
  }
  // 2) Body of an existing area → select + move.
  const hitId = aoeHitBody(world);
  if (hitId != null) {
    aoeSelectedId = hitId;
    const sel = aoes.find(a => a.id === hitId);
    aoeMoving = true;
    aoeGrabStart = { x: world.x, y: world.y };
    aoeGrabOrig  = { x: sel.x, y: sel.y, x2: sel.x2, y2: sel.y2 };
    aoeSyncAndRedraw();
    return true;
  }
  // 3) Empty space → create a new area.
  aoeSelectedId = null;
  let origin = (typeof tokenSnap === 'function') ? tokenSnap(world) : { x: world.x, y: world.y };
  if (aoeShape === 'emanation' && typeof tokenHitTest === 'function') {
    const t = tokenHitTest(world);             // emanation can spring from a token
    if (t) origin = { x: t.x, y: t.y };
  }
  aoeDraft = { id: _nextAoeId++, shape: aoeShape, x: origin.x, y: origin.y, x2: world.x, y2: world.y, color: aoeColor };
  aoeDragging = true;
  aoeSyncAndRedraw();
  return true;
}

function aoeOnMove(world, shift) {
  if (aoeResizing) {
    const sel = aoes.find(a => a.id === aoeSelectedId);
    if (sel) { sel.x2 = world.x; sel.y2 = world.y; aoeSyncAndRedraw(); }
    return true;
  }
  if (aoeMoving) {
    const sel = aoes.find(a => a.id === aoeSelectedId);
    if (sel && aoeGrabStart && aoeGrabOrig) {
      const nx = aoeGrabOrig.x + (world.x - aoeGrabStart.x);
      const ny = aoeGrabOrig.y + (world.y - aoeGrabStart.y);
      const snapped = (typeof tokenSnap === 'function') ? tokenSnap({ x: nx, y: ny }) : { x: nx, y: ny };
      const sdx = snapped.x - aoeGrabOrig.x, sdy = snapped.y - aoeGrabOrig.y; // move origin AND tip together
      sel.x  = aoeGrabOrig.x  + sdx; sel.y  = aoeGrabOrig.y  + sdy;
      sel.x2 = aoeGrabOrig.x2 + sdx; sel.y2 = aoeGrabOrig.y2 + sdy;
      aoeSyncAndRedraw();
    }
    return true;
  }
  if (!aoeDragging || !aoeDraft) return false;
  aoeDraft.x2 = world.x; aoeDraft.y2 = world.y;
  aoeSyncAndRedraw();
  return true;
}

function aoeOnUp() {
  if (aoeResizing) { aoeResizing = false; aoeSyncAndRedraw(); return true; }
  if (aoeMoving)   { aoeMoving = false; aoeGrabStart = aoeGrabOrig = null; aoeSyncAndRedraw(); return true; }
  if (!aoeDragging) return false;
  aoeDragging = false;
  if (aoeDraft) {
    const moved = Math.hypot(aoeDraft.x2 - aoeDraft.x, aoeDraft.y2 - aoeDraft.y);
    if (moved >= 8 / (zoom || 1)) {           // a real drag → keep it (persists, like a token)
      aoes.push(aoeDraft);
      aoeSelectedId = aoeDraft.id;            // select the new area so it can be tuned right away
    }                                          // a bare click on empty space → nothing
  }
  aoeDraft = null;
  aoeSyncAndRedraw();
  return true;
}

function aoeCancelDraft() { aoeDragging = false; aoeDraft = null; aoeMoving = false; aoeResizing = false; }
function aoeClearAll() { aoes = []; aoeDraft = null; aoeDragging = false; aoeMoving = false; aoeResizing = false; aoeSelectedId = null; aoeSyncAndRedraw(); }

function aoeDeleteAt(world) {
  const id = aoeHitBody(world);
  if (id == null) return false;
  aoes = aoes.filter(a => a.id !== id);
  if (aoeSelectedId === id) aoeSelectedId = null;
  aoeSyncAndRedraw();
  return true;
}
function aoeDeleteSelected() {
  if (aoeSelectedId == null) return;
  aoes = aoes.filter(a => a.id !== aoeSelectedId);
  aoeSelectedId = null;
  aoeSyncAndRedraw();
}

// ─── Sync ─────────────────────────────────────────────────────────────────────
function aoesSyncToPlayer() {
  if (typeof playerWindow === 'undefined' || !playerWindow || playerWindow.closed) return;
  const all = aoeDraft ? aoes.concat([aoeDraft]) : aoes; // include the live preview
  playerWindow.postMessage({ type: 'aoe-update', aoes: all }, '*');
}
function aoesResyncToPlayer() { aoesSyncToPlayer(); }
function aoesApplyFromPlayer(msg) {
  aoes = Array.isArray(msg && msg.aoes) ? msg.aoes : []; // idempotent reconcile (incl. the DM's draft)
  aoeScheduleRedraw();
}
function aoeScheduleRedraw() {
  tokensDirty = true; // areas share the #token-canvas → reuse its dirty flag
  if (typeof scheduleRender === 'function') scheduleRender();
}
function aoeSyncAndRedraw() { aoesSyncToPlayer(); aoeScheduleRedraw(); }

// ─── Draw (called from drawTokens, BEFORE the tokens, on #token-canvas) ───────
function drawAoes() {
  if (typeof tokenCtx === 'undefined' || !tokenCtx) return;
  for (const a of aoes) drawAoeShape(a);
  if (aoeDraft) drawAoeShape(aoeDraft);
  // Selection chrome (DM editing only — the player never sets aoeModeOn, so nothing shows there).
  if (aoeModeOn && aoeSelectedId != null) {
    const sel = aoes.find(a => a.id === aoeSelectedId);
    if (sel) drawAoeSelection(sel);
  }
}

function drawAoeShape(a) {
  const g = aoeGeom(a);
  const o = toScreen(a.x, a.y);
  const rs = g.sizeW * zoom;                   // in screen px
  const col = a.color || AOE_COLOR;

  tokenCtx.save();
  tokenCtx.beginPath();
  if (a.shape === 'cone') {
    tokenCtx.moveTo(o.sx, o.sy);
    tokenCtx.arc(o.sx, o.sy, rs, g.ang - AOE_CONE_HALF, g.ang + AOE_CONE_HALF);
    tokenCtx.closePath();
  } else if (a.shape === 'line') {
    const ws = g.cell * zoom;                   // 1-cell wide
    const ex = o.sx + Math.cos(g.ang) * rs, ey = o.sy + Math.sin(g.ang) * rs;
    const nx = -Math.sin(g.ang) * ws / 2, ny = Math.cos(g.ang) * ws / 2;
    tokenCtx.moveTo(o.sx + nx, o.sy + ny);
    tokenCtx.lineTo(ex + nx, ey + ny);
    tokenCtx.lineTo(ex - nx, ey - ny);
    tokenCtx.lineTo(o.sx - nx, o.sy - ny);
    tokenCtx.closePath();
  } else { // burst | emanation → circle
    tokenCtx.arc(o.sx, o.sy, rs, 0, Math.PI * 2);
  }
  tokenCtx.globalAlpha = 0.22; tokenCtx.fillStyle = col; tokenCtx.fill();
  tokenCtx.globalAlpha = 0.95; tokenCtx.lineWidth = 2; tokenCtx.strokeStyle = col;
  if (a.shape === 'emanation') tokenCtx.setLineDash([8, 6]); // aura look
  tokenCtx.stroke();
  tokenCtx.restore();

  // Size label (cells) near the origin.
  tokenCtx.save();
  tokenCtx.font = '700 12px system-ui, "Segoe UI", sans-serif';
  tokenCtx.textAlign = 'center'; tokenCtx.textBaseline = 'middle';
  tokenCtx.lineWidth = 3; tokenCtx.strokeStyle = 'rgba(0,0,0,0.6)';
  tokenCtx.strokeText(g.cells + 'c', o.sx, o.sy);
  tokenCtx.fillStyle = '#fff'; tokenCtx.fillText(g.cells + 'c', o.sx, o.sy);
  tokenCtx.restore();
}

// White move-dot at the origin + a grab handle at the tip (DM only).
function drawAoeSelection(a) {
  const o = toScreen(a.x, a.y);
  const h = toScreen(aoeHandlePoint(a).x, aoeHandlePoint(a).y);
  tokenCtx.save();
  tokenCtx.setLineDash([]);
  // origin (move) marker
  tokenCtx.fillStyle = 'rgba(255,255,255,0.95)';
  tokenCtx.strokeStyle = 'rgba(0,0,0,0.6)'; tokenCtx.lineWidth = 2;
  tokenCtx.beginPath(); tokenCtx.arc(o.sx, o.sy, 4, 0, Math.PI * 2); tokenCtx.fill(); tokenCtx.stroke();
  // tip (resize / re-aim) handle
  tokenCtx.beginPath(); tokenCtx.arc(h.sx, h.sy, 6, 0, Math.PI * 2);
  tokenCtx.fillStyle = '#fff'; tokenCtx.fill();
  tokenCtx.strokeStyle = a.color || AOE_COLOR; tokenCtx.lineWidth = 2.5; tokenCtx.stroke();
  tokenCtx.restore();
}
