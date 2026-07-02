// draw.js — quick table markings: ping, traçado (comet trail), risco (stays) (PresenceVTT addition).
//
// Part of PresenceVTT, a fork of Evermist (MIT, Copyright (c) 2026 Hinnful).
//
// PURELY VISUAL — no rules, no mechanics. Three "1-gesture" markers the DM drops on the
// map and the players see on the table:
//   • Ping    — single click → an expanding pulse that auto-vanishes (~1.5 s). "Olha aqui!"
//   • Traçado — drag → a freehand COMET TRAIL: each point fades on its own, so the tail
//               erases behind the moving cursor. Streamed live to the projection.
//   • Risco   — drag → a freehand line that STAYS until you press 🗑 Limpar.
// Drawn on the shared #token-canvas, ON TOP of tokens/areas (hooked from drawTokens, AFTER
// the token bodies). Synced to the projection ('draw-*'); persistent riscos resync on
// PLAYER_READY. Same load style as aoe.js / tokens.js — plain <script>, lazy globals
// (zoom, gridSize, toScreen, container, shape, lastScreenX/Y, drawCursor, tokenCtx,
// tokensDirty, scheduleRender, playerWindow, updateContextPanels).

let drawModeOn        = false;
let drawTool          = 'ping';   // 'ping' | 'trace' | 'scribble'
let scribbles         = [];       // persistent solid strokes (synced): { id, pts:[{x,y}], color }
let traces            = [];       // comet trails: { pts:[{x,y,t}], color } — per-point fade
let pings             = [];       // expanding markers: { x, y, color, born, ttl }
let liveTrace         = null;     // projection-side in-progress comet (from 'draw-trace-live')
let drawCurrentStroke = null;     // DM in-progress stroke: { pts, color, fade }
let drawPointerDown   = false;
let _nextScribbleId   = 1;
let drawAnimRAF       = null;     // RAF handle while anything is still animating
let _lastTraceLiveSync = 0;       // throttle clock for live trace streaming

const DRAW_COLOR  = '#ffd24a';    // warm amber pen — distinct from ruler gold / token cyan / AoE orange
const PING_COLOR  = '#ff5a5a';    // red attention ping
const TRACE_TTL   = 1400;         // ms each traçado POINT lives → length of the comet tail
const PING_TTL    = 1500;         // ms a ping lives
const DRAW_LINE_W = 4;            // pen width in WORLD px (scaled by zoom when painted)
const DRAW_MIN_PT = 2;            // min screen px between captured points (decimation)
const TRACE_LIVE_MS = 40;         // min ms between live-trace syncs (~25/s)

// Monotonic clock; each window animates from its own receipt time (no cross-window sync needed).
function drawNow() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

function drawIsOn() { return drawModeOn; }

// ─── Mode (DM) ────────────────────────────────────────────────────────────────
function setDrawMode(on) {
  drawModeOn = !!on;
  if (drawModeOn) {
    if (typeof setRulerMode === 'function' && rulerModeOn) setRulerMode(false); // exclusive modes
    if (typeof setTokenMode === 'function' && tokenModeOn) setTokenMode(false);
    if (typeof setAoeMode   === 'function' && aoeModeOn)   setAoeMode(false);
  } else { drawCancelStroke(); }
  const btn = document.getElementById('btn-draw');
  if (btn) btn.classList.toggle('active', drawModeOn);
  if (typeof container !== 'undefined' && container) {
    container.style.cursor = drawModeOn ? 'crosshair' : (shape === 'select' ? 'default' : 'crosshair');
  }
  if (typeof updateContextPanels === 'function') updateContextPanels();
  if (typeof drawCursor === 'function') drawCursor(lastScreenX, lastScreenY);
  drawScheduleRedraw();
}
function toggleDrawMode() { setDrawMode(!drawModeOn); }

function setDrawTool(s) {
  drawTool = s;
  document.querySelectorAll('.draw-tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === s));
}

// ─── Placement (called from index.html DM handlers) ───────────────────────────
function drawOnDown(world) {
  if (!drawModeOn) return false;
  if (drawTool === 'ping') { drawSpawnPing(world.x, world.y); return true; } // single-gesture ping
  const fade = (drawTool === 'trace');
  const first = fade ? { x: world.x, y: world.y, t: drawNow() } : { x: world.x, y: world.y };
  drawCurrentStroke = { pts: [first], color: DRAW_COLOR, fade };
  drawPointerDown = true;
  if (fade) { _lastTraceLiveSync = 0; drawSyncTraceLive(drawCurrentStroke); drawEnsureAnim(); }
  drawScheduleRedraw();
  return true;
}

function drawOnMove(world) {
  if (!drawPointerDown || !drawCurrentStroke) return false;
  const pts = drawCurrentStroke.pts;
  const last = pts[pts.length - 1];
  if (Math.hypot(world.x - last.x, world.y - last.y) >= DRAW_MIN_PT / (zoom || 1)) {
    if (drawCurrentStroke.fade) {
      const now = drawNow();
      pts.push({ x: world.x, y: world.y, t: now });
      drawCurrentStroke.pts = pts.filter(p => now - (p.t || now) < TRACE_TTL); // erase the faded tail
      if (now - _lastTraceLiveSync >= TRACE_LIVE_MS) { drawSyncTraceLive(drawCurrentStroke); _lastTraceLiveSync = now; }
    } else {
      pts.push({ x: world.x, y: world.y });
    }
    drawScheduleRedraw();
  }
  return true;
}

function drawOnUp() {
  if (!drawModeOn) return false;
  if (drawPointerDown) {
    drawPointerDown = false;
    const s = drawCurrentStroke; drawCurrentStroke = null;
    if (s) {
      if (s.fade) {
        if (s.pts.length >= 2) { traces.push({ pts: s.pts, color: s.color }); drawSyncTrace(s); drawEnsureAnim(); }
        else drawSyncTraceClear(); // a bare click in trace mode → nothing to keep; clear the live slot
      } else if (s.pts.length >= 2) {
        scribbles.push({ id: _nextScribbleId++, pts: s.pts, color: s.color }); // risco → persists
        drawSyncScribbles();
      }
    }
    drawScheduleRedraw();
  }
  return true; // in draw mode we always consume the up so the fog tool stays out of it
}

function drawCancelStroke() { drawPointerDown = false; drawCurrentStroke = null; }

function drawSpawnPing(x, y) {
  const p = { x, y, color: PING_COLOR, born: drawNow(), ttl: PING_TTL };
  pings.push(p);
  drawSyncPing(p);
  drawEnsureAnim();
  drawScheduleRedraw();
}

// 🗑 button: wipe only the persistent riscos (traçados/pings vanish on their own).
function drawClearScribbles() { scribbles = []; drawSyncScribbles(); drawScheduleRedraw(); }
// Full wipe (scene switch): everything, both windows.
function drawClearAll() {
  scribbles = []; traces = []; pings = []; liveTrace = null;
  drawCurrentStroke = null; drawPointerDown = false;
  drawSyncClear(); drawScheduleRedraw();
}

// ─── Sync (DM → projection) ───────────────────────────────────────────────────
function drawPost(msg) {
  if (typeof playerWindow === 'undefined' || !playerWindow || playerWindow.closed) return;
  playerWindow.postMessage(msg, '*');
}
// Points are sent as AGES (ms since captured) so each window can re-stamp them against its
// own clock — the comet fades identically on the table without any shared time base.
function traceAges(stroke) {
  const now = drawNow();
  return stroke.pts.map(p => ({ x: p.x, y: p.y, age: now - (p.t || now) }));
}
function drawSyncScribbles()  { drawPost({ type: 'draw-scribbles', scribbles }); }       // idempotent full set
function drawSyncPing(p)      { drawPost({ type: 'draw-ping',  x: p.x, y: p.y, color: p.color, ttl: p.ttl }); }
function drawSyncTraceLive(s) { drawPost({ type: 'draw-trace-live', color: s.color, pts: traceAges(s) }); }
function drawSyncTrace(s)     { drawPost({ type: 'draw-trace', color: s.color, pts: traceAges(s) }); }
function drawSyncTraceClear() { drawPost({ type: 'draw-trace-clear' }); }
function drawSyncClear()      { drawPost({ type: 'draw-clear' }); }
function drawResyncToPlayer() { drawSyncScribbles(); } // only persistent riscos survive a (re)open

// ─── Apply (projection side) ──────────────────────────────────────────────────
function ptsFromAges(arr) {
  const now = drawNow();
  return (arr || []).map(p => ({ x: p.x, y: p.y, t: now - (p.age || 0) }));
}
function drawApplyScribbles(msg) { scribbles = Array.isArray(msg && msg.scribbles) ? msg.scribbles : []; drawScheduleRedraw(); }
function drawApplyPing(msg) {
  pings.push({ x: msg.x, y: msg.y, color: msg.color || PING_COLOR, born: drawNow(), ttl: msg.ttl || PING_TTL });
  drawEnsureAnim(); drawScheduleRedraw();
}
function drawApplyTraceLive(msg) { liveTrace = { color: (msg && msg.color) || DRAW_COLOR, pts: ptsFromAges(msg && msg.pts) }; drawEnsureAnim(); drawScheduleRedraw(); }
function drawApplyTrace(msg)     { traces.push({ color: (msg && msg.color) || DRAW_COLOR, pts: ptsFromAges(msg && msg.pts) }); liveTrace = null; drawEnsureAnim(); drawScheduleRedraw(); }
function drawApplyTraceClear()   { liveTrace = null; drawScheduleRedraw(); }
function drawApplyClear()        { scribbles = []; traces = []; pings = []; liveTrace = null; drawScheduleRedraw(); }

// ─── Redraw + fade animation ──────────────────────────────────────────────────
function drawScheduleRedraw() {
  if (typeof tokensDirty !== 'undefined') tokensDirty = true; // markings share the #token-canvas
  if (typeof scheduleRender === 'function') scheduleRender();
}
function drawEnsureAnim() {
  if (drawAnimRAF) return;
  drawAnimRAF = requestAnimationFrame(drawAnimTick);
}
function drawAnimTick() {
  drawAnimRAF = null;
  const now = drawNow();
  pings = pings.filter(p => now - p.born < p.ttl);
  for (const tr of traces) tr.pts = tr.pts.filter(p => now - (p.t || now) < TRACE_TTL);
  traces = traces.filter(tr => tr.pts.length >= 2);
  if (liveTrace) { liveTrace.pts = liveTrace.pts.filter(p => now - (p.t || now) < TRACE_TTL); if (!liveTrace.pts.length) liveTrace = null; }
  if (drawCurrentStroke && drawCurrentStroke.fade) drawCurrentStroke.pts = drawCurrentStroke.pts.filter(p => now - (p.t || now) < TRACE_TTL);
  drawScheduleRedraw();
  if (pings.length || traces.length || liveTrace || (drawCurrentStroke && drawCurrentStroke.fade)) drawEnsureAnim();
}

// ─── Draw (called from drawTokens, AFTER the tokens, on #token-canvas) ────────
function drawDrawings() {
  if (typeof tokenCtx === 'undefined' || !tokenCtx) return;
  const now = drawNow();
  for (const s of scribbles) drawStroke(s.pts, s.color, 1);          // solid persistent riscos
  for (const tr of traces) drawComet(tr.pts, tr.color, now);         // committed comets
  if (liveTrace) drawComet(liveTrace.pts, liveTrace.color, now);     // projection live comet
  if (drawCurrentStroke) {                                           // DM in-progress
    if (drawCurrentStroke.fade) drawComet(drawCurrentStroke.pts, drawCurrentStroke.color, now);
    else drawStroke(drawCurrentStroke.pts, drawCurrentStroke.color, 1);
  }
  for (const p of pings) drawPing(p, now);
}

function drawStrokePath(pts) {
  tokenCtx.beginPath();
  const p0 = toScreen(pts[0].x, pts[0].y);
  tokenCtx.moveTo(p0.sx, p0.sy);
  if (pts.length === 1) { tokenCtx.lineTo(p0.sx + 0.1, p0.sy + 0.1); return; } // a dot
  for (let i = 1; i < pts.length; i++) {
    const p = toScreen(pts[i].x, pts[i].y);
    tokenCtx.lineTo(p.sx, p.sy);
  }
}

// Solid stroke (risco) — one continuous path with a dark halo.
function drawStroke(pts, color, alpha) {
  if (!pts || pts.length < 1 || alpha <= 0) return;
  const w = Math.max(2, DRAW_LINE_W * (zoom || 1));
  tokenCtx.save();
  tokenCtx.globalAlpha = alpha;
  tokenCtx.lineJoin = 'round';
  tokenCtx.lineCap = 'round';
  tokenCtx.strokeStyle = 'rgba(0,0,0,0.5)';       // halo so the bright pen reads on any map
  tokenCtx.lineWidth = w + 3;
  drawStrokePath(pts); tokenCtx.stroke();
  tokenCtx.strokeStyle = color || DRAW_COLOR;
  tokenCtx.lineWidth = w;
  drawStrokePath(pts); tokenCtx.stroke();
  tokenCtx.restore();
}

// Comet trail (traçado) — each segment's opacity follows the age of its newer point, so the
// tail (old points) is faint and erases away while the head (just-drawn) stays bright.
function drawComet(pts, color, now) {
  if (!pts || pts.length < 2) return;
  const w = Math.max(2, DRAW_LINE_W * (zoom || 1));
  tokenCtx.save();
  tokenCtx.lineJoin = 'round';
  tokenCtx.lineCap = 'round';
  for (let i = 1; i < pts.length; i++) {
    const b = pts[i];
    let k = 1 - (now - (b.t != null ? b.t : now)) / TRACE_TTL;
    if (k <= 0) continue;
    k = k * k; // ease-out
    const pa = toScreen(pts[i - 1].x, pts[i - 1].y);
    const pb = toScreen(b.x, b.y);
    tokenCtx.globalAlpha = k * 0.45; tokenCtx.strokeStyle = 'rgba(0,0,0,0.5)'; tokenCtx.lineWidth = w + 3;
    tokenCtx.beginPath(); tokenCtx.moveTo(pa.sx, pa.sy); tokenCtx.lineTo(pb.sx, pb.sy); tokenCtx.stroke();
    tokenCtx.globalAlpha = k; tokenCtx.strokeStyle = color || DRAW_COLOR; tokenCtx.lineWidth = w;
    tokenCtx.beginPath(); tokenCtx.moveTo(pa.sx, pa.sy); tokenCtx.lineTo(pb.sx, pb.sy); tokenCtx.stroke();
  }
  tokenCtx.restore();
}

function drawPing(p, now) {
  const t = Math.max(0, Math.min(1, (now - p.born) / p.ttl)); // 0 → 1 over its life
  const o = toScreen(p.x, p.y);
  const cell = (typeof gridSize === 'number' && gridSize > 0) ? gridSize : 70;
  const baseR = cell * 0.55 * (zoom || 1);
  const col = p.color || PING_COLOR;
  tokenCtx.save();
  for (let k = 0; k < 2; k++) {                    // two expanding rings, phase-offset
    const tt = t + k * 0.25;
    if (tt > 1) continue;
    tokenCtx.globalAlpha = (1 - tt) * 0.9;
    tokenCtx.strokeStyle = col;
    tokenCtx.lineWidth = 3;
    tokenCtx.beginPath();
    tokenCtx.arc(o.sx, o.sy, baseR * (0.25 + tt * 1.1), 0, Math.PI * 2);
    tokenCtx.stroke();
  }
  tokenCtx.globalAlpha = (1 - t) * 0.95;           // fading center dot
  tokenCtx.fillStyle = col;
  tokenCtx.beginPath();
  tokenCtx.arc(o.sx, o.sy, Math.max(3, baseR * 0.18), 0, Math.PI * 2);
  tokenCtx.fill();
  tokenCtx.restore();
}
