// tokens.js — token-anchor subsystem (PresenceVTT addition).
//
// Part of PresenceVTT, a fork of Evermist (MIT, Copyright (c) 2026 Hinnful).
//
// GOLDEN RULE: a token is a DUMB VISUAL ANCHOR. No HP, no stats, no rules, no turns.
// Just { id, x, y (WORLD coords), size, label, color, conditions:[], rangeBands:[] }.
//
// Style like viewport.js/ruler.js: plain <script> (no ES modules), loaded before the
// inline script; globals referenced lazily (toScreen, zoom, gridSize, container, shape,
// lastScreenX/Y, scheduleRender, tokensDirty, tokenCtx/tokenCanvas, playerWindow,
// drawCursor, updateContextPanels, setRulerMode/rulerModeOn).
//
// Tokens live on their own #token-canvas — above the map/grid, BELOW the ruler — and
// are drawn from doRender in WORLD coords so they stick to the map on pan/zoom. The DM
// places/moves/deletes; the projection mirrors via 'tokens-update' (resynced on
// PLAYER_READY). The token is drawn as a thin RING at the base (not a filled disc that
// would vanish under a physical mini) plus a label just outside.

// ─── State (shared; on the player it's filled from 'tokens-update') ───────────
let tokens           = [];     // [{ id, x, y, size, label, color, conditions, rangeBands }]
let tokenModeOn      = false;  // DM "Token" mode (toolbar 📍 / T)
let selectedTokenId  = null;   // DM selection
let tokenDragging    = false;
let tokenInteracting = false;  // a down→up interaction is in progress (DM)
let tokenPopupOpen   = false;  // the per-token menu is shown only after a double-click
let tokenGrabDX = 0, tokenGrabDY = 0; // grab offset (world) so the token doesn't jump
let _nextTokenId  = 1;         // monotonic id (never reused — keeps selection stable)

const TOKEN_DEFAULT_COLOR = '#5ad1e6'; // cyan — distinct from the gold ruler

// ─── Mode (DM) ────────────────────────────────────────────────────────────────
function tokenIsOn() { return tokenModeOn; }

function setTokenMode(on) {
  tokenModeOn = !!on;
  tokenPopupOpen = false; // start with the menu closed (opens on double-click)
  if (tokenModeOn && typeof setRulerMode === 'function' && rulerModeOn) setRulerMode(false); // exclusive modes
  if (tokenModeOn && typeof aoeModeOn !== 'undefined' && aoeModeOn) setAoeMode(false);
  if (tokenModeOn && typeof drawModeOn !== 'undefined' && drawModeOn) setDrawMode(false);
  if (!tokenModeOn) { tokenDragging = false; tokenInteracting = false; }
  const btn = document.getElementById('btn-token');
  if (btn) btn.classList.toggle('active', tokenModeOn);
  if (typeof container !== 'undefined' && container) {
    container.style.cursor = tokenModeOn ? 'crosshair' : (shape === 'select' ? 'default' : 'crosshair');
  }
  if (typeof updateContextPanels === 'function') updateContextPanels();
  tokenUpdatePopup();
  if (typeof drawCursor === 'function') drawCursor(lastScreenX, lastScreenY);
  tokenScheduleRedraw();
}

function toggleTokenMode() { setTokenMode(!tokenModeOn); }

// ─── Pointer interception (called from index.html DM handlers) ────────────────
// Returns true when it consumed the event so the caller skips pan/tool/ruler logic.
function tokenOnDown(world) {
  if (!tokenModeOn) return false;
  tokenInteracting = true;
  tokenPopupOpen = false; // a plain click/drag just moves the token — no menu

  const hit = tokenHitTest(world);
  if (hit) {
    selectedTokenId = hit.id;          // click on a token → select it
    tokenGrabDX = world.x - hit.x;
    tokenGrabDY = world.y - hit.y;
  } else {
    const s = tokenSnap(world);               // click on empty → drop a new token, snapped to the grid
    const t = createToken(s.x, s.y);
    selectedTokenId = t.id;
    tokenGrabDX = 0; tokenGrabDY = 0;
  }
  tokenDragging = true;
  tokenUpdatePopup();
  tokenSyncAndRedraw();
  return true;
}

function tokenOnMove(world) {
  if (!tokenDragging || selectedTokenId == null) return false;
  const t = tokens.find(tk => tk.id === selectedTokenId);
  if (t) {
    const s = tokenSnap({ x: world.x - tokenGrabDX, y: world.y - tokenGrabDY }); // snap the centre
    t.x = s.x; t.y = s.y;
  }
  tokenSyncAndRedraw();
  return true;
}

function tokenOnUp() {
  if (!tokenInteracting) return false;
  tokenInteracting = false;
  tokenDragging = false;
  tokensSyncToPlayer();
  return true;
}

function tokenCancelDrag() { tokenDragging = false; tokenInteracting = false; }

// Double-click opens the per-token menu (a plain click only selects/moves the token).
function tokenOpenPopupAt(world) {
  if (!tokenModeOn) return false;
  const hit = tokenHitTest(world);
  if (!hit) return false;
  selectedTokenId = hit.id;
  tokenPopupOpen = true;
  tokenScheduleRedraw(); // drawTokens → tokenUpdatePopup positions + shows it
  return true;
}

// ─── Create / delete / size ───────────────────────────────────────────────────
function createToken(x, y) {
  const size = (typeof gridSize === 'number' && gridSize > 0) ? gridSize : 70; // default = 1 cell
  const t = {
    id: _nextTokenId++,
    x, y, size,
    label: nextTokenLabel(),
    color: TOKEN_DEFAULT_COLOR,
    img: null,        // optional PNG/JPG portrait as a small data URL (drawn clipped to the base ring)
    conditions: [],   // reserved (dumb anchor — not rendered/used yet)
    rangeBands: [],    // reserved
  };
  tokens.push(t);
  return t;
}

// ─── Portrait image (PNG/JPG) — optional, drawn clipped to the token's base ring ─
// Kept small (downscaled to TOKEN_IMG_MAX px) so the data URL is light to postMessage
// to the projection on every drag. Decoded Image objects are cached per src on BOTH
// windows so a repeated src never re-decodes; a fresh src decodes async then redraws.
const TOKEN_IMG_MAX = 220;
const tokenImgCache = {}; // src(dataURL) → HTMLImageElement (with ._ready flag)

function tokenGetImage(src) {
  if (!src) return null;
  let img = tokenImgCache[src];
  if (img) return img._ready ? img : null;
  img = new Image();
  img._ready = false;
  img.onload = () => { img._ready = true; tokenScheduleRedraw(); };
  img.onerror = () => { delete tokenImgCache[src]; };
  img.src = src;
  tokenImgCache[src] = img;
  return null;
}

// Read a picked file, downscale to a square-ish thumbnail, and set it on the selected token.
function loadTokenImageFromFile(file) {
  if (!file || selectedTokenId == null) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(1, TOKEN_IMG_MAX / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    // PNG keeps transparency (character art is often cut-out); acceptable size at ≤220px.
    let dataUrl;
    try { dataUrl = cv.toDataURL('image/png'); }
    catch (e) { console.error('token image encode failed', e); return; }
    setSelectedTokenImage(dataUrl);
  };
  img.onerror = () => { URL.revokeObjectURL(url); };
  img.src = url;
}

function setSelectedTokenImage(dataUrl) {
  const t = tokens.find(tk => tk.id === selectedTokenId);
  if (!t) return;
  t.img = dataUrl || null;
  if (dataUrl) tokenGetImage(dataUrl); // warm the cache so it draws as soon as decoded
  tokenSyncAndRedraw();
}

// Smallest positive integer not currently used as a label, so deleting a token frees
// its number (1,2,3 → delete 3 → next is 3) instead of the counter marching on. Only
// considers numeric labels; renamed tokens don't block a number.
function nextTokenLabel() {
  const used = new Set(tokens.map(t => t.label));
  let n = 1;
  while (used.has(String(n))) n++;
  return String(n);
}

function setSelectedTokenLabel(text) {
  const t = tokens.find(tk => tk.id === selectedTokenId);
  if (!t) return;
  t.label = text;
  tokenSyncAndRedraw();
}

function setSelectedTokenColor(hex) {
  const t = tokens.find(tk => tk.id === selectedTokenId);
  if (!t) return;
  t.color = hex;
  tokenSyncAndRedraw();
}

// ─── Conditions & range bands (visual markers only — see conditions.js) ───────
function toggleTokenCondition(condId) {
  const t = tokens.find(tk => tk.id === selectedTokenId);
  if (!t) return;
  if (!Array.isArray(t.conditions)) t.conditions = [];
  const i = t.conditions.indexOf(condId);
  if (i >= 0) t.conditions.splice(i, 1); else t.conditions.push(condId);
  tokenUpdatePopup();
  tokenSyncAndRedraw();
}

// Adjustable range: each band toggles independently on the selected token.
// Cumulative: picking a band shows it AND every closer band (Longe ⇒ Corpo+Perto+…).
// Picking the band that's already the outermost clears the range.
function toggleTokenBand(bandId) {
  const t = tokens.find(tk => tk.id === selectedTokenId);
  if (!t || typeof RANGE_BANDS === 'undefined') return;
  const idx = RANGE_BANDS.findIndex(b => b.id === bandId);
  if (idx < 0) return;
  if (!Array.isArray(t.rangeBands)) t.rangeBands = [];
  t.rangeBands = (t.rangeBands.length === idx + 1)
    ? []                                                    // already the outermost → turn off
    : RANGE_BANDS.slice(0, idx + 1).map(b => ({ ...b }));   // this band + all closer ones
  tokenUpdatePopup();
  tokenSyncAndRedraw();
}

// Build the popup's condition list (glyph + name) and range-band chips (DM, once at init).
function tokenBuildPopup() {
  const cw = document.getElementById('token-conditions');
  if (cw && typeof CONDITIONS !== 'undefined') {
    cw.innerHTML = '';
    for (const c of CONDITIONS) {
      const b = document.createElement('button');
      b.className = 'tp-cond';
      b.dataset.cond = c.id;
      b.innerHTML = '<span class="tp-glyph">' + c.glyph + '</span><span>' + c.name + '</span>';
      b.title = c.name;
      b.style.setProperty('--cond-color', c.color);
      b.onclick = () => toggleTokenCondition(c.id);
      cw.appendChild(b);
    }
  }
  const bw = document.getElementById('token-bands');
  if (bw && typeof RANGE_BANDS !== 'undefined') {
    bw.innerHTML = '';
    for (const bd of RANGE_BANDS) {
      const b = document.createElement('button');
      b.className = 'tp-band';
      b.dataset.band = bd.id;
      b.textContent = bd.name + ' · ' + bd.cells;
      b.title = bd.name + ' — ' + bd.cells + ' células';
      b.style.setProperty('--band-color', bd.color);
      b.onclick = () => toggleTokenBand(bd.id);
      bw.appendChild(b);
    }
  }
}

function deleteSelectedToken() {
  if (selectedTokenId == null) return;
  tokens = tokens.filter(t => t.id !== selectedTokenId);
  selectedTokenId = null;
  tokenPopupOpen = false;
  tokenUpdatePopup();
  tokenSyncAndRedraw();
}

function setSelectedTokenSize(px) {
  const t = tokens.find(tk => tk.id === selectedTokenId);
  if (!t) return;
  t.size = Math.max(8, px);
  tokenSyncAndRedraw();
}

// Map-specific — cleared on scene switch (like the ruler).
function tokensClearAll() {
  tokens = [];
  selectedTokenId = null;
  tokenDragging = false; tokenInteracting = false;
  tokenSyncAndRedraw();
}

// Snap a world point to the grid's half-cell lattice — a cell CENTER, a corner/VERTEX,
// or an edge MIDPOINT, never anywhere else (multiples of gridSize/2). The token's CENTRE
// is what gets snapped. Square grids only, and only when the grid is shown; otherwise the
// token is placed freely. Same lattice the ruler snaps to.
function tokenSnap(world) {
  if (!gridEnabled || gridMode !== 'square' || !(gridSize > 0)) return { x: world.x, y: world.y };
  const half = gridSize / 2;
  return {
    x: Math.round((world.x - gridOffsetX) / half) * half + gridOffsetX,
    y: Math.round((world.y - gridOffsetY) / half) * half + gridOffsetY,
  };
}

// World-space hit-test (topmost first); returns the token or null.
function tokenHitTest(world) {
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    const r = Math.max(t.size / 2, 8 / (zoom || 1));
    if (Math.hypot(world.x - t.x, world.y - t.y) <= r) return t;
  }
  return null;
}

// ─── Token panel (DM) — size of the selected token + delete ───────────────────
// Per-token floating popup: shown at the selected token (DM only), positioned above it
// in screen coords and re-anchored on drag/pan via the drawTokens call at render time.
function tokenUpdatePopup() {
  const pop = document.getElementById('panel-token-bottom');
  if (!pop) return;
  const onPlayer = (typeof isPlayer !== 'undefined' && isPlayer);
  const t = tokens.find(tk => tk.id === selectedTokenId);
  if (onPlayer || !tokenModeOn || !t || !tokenPopupOpen) { pop.style.display = 'none'; return; }

  // Populate from the selected token.
  const slider  = document.getElementById('token-size');
  const val     = document.getElementById('token-size-val');
  const nameEl  = document.getElementById('token-name');
  const colorEl = document.getElementById('token-color');
  const cell = (typeof gridSize === 'number' && gridSize > 0) ? gridSize : 70;
  if (slider) slider.value = Math.round((t.size / cell) * 4) / 4;
  if (val) val.textContent = (Math.round((t.size / cell) * 100) / 100) + 'c';
  if (nameEl && document.activeElement !== nameEl) nameEl.value = t.label; // don't clobber typing
  if (colorEl) colorEl.value = t.color || TOKEN_DEFAULT_COLOR;
  const imgBtn = document.getElementById('btn-token-image');
  if (imgBtn) imgBtn.classList.toggle('active', !!t.img);
  document.querySelectorAll('#token-conditions .tp-cond').forEach(b => {
    b.classList.toggle('active', Array.isArray(t.conditions) && t.conditions.includes(b.dataset.cond));
  });
  document.querySelectorAll('#token-bands .tp-band').forEach(b => {
    b.classList.toggle('active', Array.isArray(t.rangeBands) && t.rangeBands.some(x => x.id === b.dataset.band));
  });

  // Position above the token (flip below / clamp to the viewport).
  pop.style.display = 'flex';
  const c = toScreen(t.x, t.y);
  const rect = container.getBoundingClientRect();
  const r = Math.max(3, (t.size / 2) * zoom);
  const pw = pop.offsetWidth || 220, ph = pop.offsetHeight || 200;
  let left = rect.left + c.sx - pw / 2;
  let top  = rect.top + c.sy - r - ph - 12;
  if (top < 8) top = rect.top + c.sy + r + 12;       // not enough room above → below
  left = Math.max(8, Math.min(left, window.innerWidth  - pw - 8));
  top  = Math.max(8, Math.min(top,  window.innerHeight - ph - 8));
  pop.style.left = left + 'px';
  pop.style.top  = top + 'px';
}

// ─── Sync to the player ───────────────────────────────────────────────────────
function tokensSyncToPlayer() {
  if (typeof playerWindow === 'undefined' || !playerWindow || playerWindow.closed) return;
  playerWindow.postMessage({ type: 'tokens-update', tokens }, '*'); // structured-clone copies the array
}
function tokensResyncToPlayer() { tokensSyncToPlayer(); }
function tokensApplyFromPlayer(msg) {
  tokens = Array.isArray(msg && msg.tokens) ? msg.tokens : [];  // idempotent reconcile
  tokenScheduleRedraw();
}

// ─── Redraw plumbing (token layer only — respects the dirty-flag perf model) ──
function tokenScheduleRedraw() {
  tokensDirty = true;                 // declared in the inline script; consumed by doRender
  if (typeof scheduleRender === 'function') scheduleRender();
}
function tokenSyncAndRedraw() { tokensSyncToPlayer(); tokenScheduleRedraw(); }

// ─── Draw (called from doRender, on #token-canvas: above grid, below the ruler) ─
function drawTokens() {
  if (typeof tokenCtx === 'undefined' || !tokenCtx || !tokenCanvas) return;
  tokenCtx.clearRect(0, 0, tokenCanvas.width, tokenCanvas.height);
  if (typeof drawAoes === 'function') drawAoes(); // areas under the tokens (PresenceVTT)
  // Pass 1: range bands first, so no token's rings bury another token's marker.
  for (const t of tokens) drawTokenRangeBands(t);
  // Pass 2: the token body (ring + fill + conditions + label + selection).
  for (const t of tokens) drawTokenBody(t);
  // Pass 3: pings / traçados / riscos ON TOP of the minis (PresenceVTT).
  if (typeof drawDrawings === 'function') drawDrawings();
  // Re-anchor the DM popup to the selected token (no-op on the player / when none).
  if (typeof isPlayer === 'undefined' || !isPlayer) tokenUpdatePopup();
}

// Concentric TRANSLUCENT rings emanating BEYOND the base, labelled, in grid cells.
function drawTokenRangeBands(t) {
  if (!Array.isArray(t.rangeBands) || !t.rangeBands.length) return;
  const c = toScreen(t.x, t.y);
  const cell = (typeof gridSize === 'number' && gridSize > 0) ? gridSize : 70;
  for (const b of t.rangeBands) {
    const rr = (b.cells || 0) * cell * zoom;
    if (rr < 4) continue;
    const col = b.color || '#888';
    tokenCtx.save();
    tokenCtx.setLineDash([10, 7]);
    // Dark halo underlay so the coloured ring reads on any map.
    tokenCtx.globalAlpha = 0.5;
    tokenCtx.lineWidth = 5.5;
    tokenCtx.strokeStyle = 'rgba(0,0,0,0.6)';
    tokenCtx.beginPath(); tokenCtx.arc(c.sx, c.sy, rr, 0, Math.PI * 2); tokenCtx.stroke();
    // Bold, nearly-opaque coloured ring on top.
    tokenCtx.globalAlpha = 0.95;
    tokenCtx.lineWidth = 3;
    tokenCtx.strokeStyle = col;
    tokenCtx.beginPath(); tokenCtx.arc(c.sx, c.sy, rr, 0, Math.PI * 2); tokenCtx.stroke();
    tokenCtx.restore();
    if (b.name) tokenBandLabel(tokenCtx, c.sx, c.sy - rr, b.name, col); // label on the ring (top)
  }
}

// Token base ring + faint fill + conditions + label + DM selection cue.
function drawTokenBody(t) {
  const c = toScreen(t.x, t.y);
  const r = Math.max(3, (t.size / 2) * zoom);
  const col = t.color || TOKEN_DEFAULT_COLOR;
  const selected = (typeof isPlayer !== 'undefined' && !isPlayer) && t.id === selectedTokenId;

  const portrait = t.img ? tokenGetImage(t.img) : null;

  tokenCtx.save();
  // Portrait (if any) drawn first, clipped to the base circle with a "cover" fit.
  if (portrait) {
    tokenCtx.save();
    tokenCtx.beginPath(); tokenCtx.arc(c.sx, c.sy, r, 0, Math.PI * 2); tokenCtx.clip();
    const s = Math.max((2 * r) / portrait.width, (2 * r) / portrait.height);
    const dw = portrait.width * s, dh = portrait.height * s;
    tokenCtx.drawImage(portrait, c.sx - dw / 2, c.sy - dh / 2, dw, dh);
    tokenCtx.restore();
  }
  // Thin ring at the base of where the mini sits — dark halo + colour for contrast.
  tokenCtx.lineWidth = 4;   tokenCtx.strokeStyle = 'rgba(0,0,0,0.5)';
  tokenCtx.beginPath(); tokenCtx.arc(c.sx, c.sy, r, 0, Math.PI * 2); tokenCtx.stroke();
  tokenCtx.lineWidth = 2.5; tokenCtx.strokeStyle = col;
  tokenCtx.beginPath(); tokenCtx.arc(c.sx, c.sy, r, 0, Math.PI * 2); tokenCtx.stroke();
  // Very faint fill so it reads on busy maps but never hides a mini placed on top —
  // skipped when a portrait fills the ring.
  if (!portrait) {
    tokenCtx.globalAlpha = 0.10; tokenCtx.fillStyle = col;
    tokenCtx.beginPath(); tokenCtx.arc(c.sx, c.sy, r, 0, Math.PI * 2); tokenCtx.fill();
    tokenCtx.globalAlpha = 1;
  }
  if (selected) {
    tokenCtx.setLineDash([4, 3]); tokenCtx.lineWidth = 1.5; tokenCtx.strokeStyle = '#fff';
    tokenCtx.beginPath(); tokenCtx.arc(c.sx, c.sy, r + 5, 0, Math.PI * 2); tokenCtx.stroke();
    tokenCtx.setLineDash([]);
  }
  tokenCtx.restore();

  drawTokenConditions(t, c.sx, c.sy, r);
  if (t.label) tokenDrawLabel(tokenCtx, c.sx, c.sy - r - 6, t.label); // label just OUTSIDE the ring (above)
}

// Condition glyph discs distributed around the base ring (resolved via CONDITIONS).
function drawTokenConditions(t, cx, cy, r) {
  const conds = (Array.isArray(t.conditions) ? t.conditions : [])
    .map(id => (typeof conditionById === 'function' ? conditionById(id) : null)).filter(Boolean);
  const n = conds.length;
  if (!n) return;
  const dr = 13; // disc radius (fixed screen px — big enough to read on a TV)
  const ro = r + dr + 4; // OUTSIDE the base ring so the physical mini never covers the icons
  for (let i = 0; i < n; i++) {
    const ang = Math.PI / 2 + (i / n) * Math.PI * 2; // around the outside, starting at the bottom
    const dx = cx + ro * Math.cos(ang);
    const dy = cy + ro * Math.sin(ang);
    tokenCtx.save();
    // dark disc + coloured ring so the emoji glyph pops against any map
    tokenCtx.fillStyle = 'rgba(18,18,24,0.92)';
    tokenCtx.beginPath(); tokenCtx.arc(dx, dy, dr, 0, Math.PI * 2); tokenCtx.fill();
    tokenCtx.lineWidth = 2.5; tokenCtx.strokeStyle = conds[i].color || '#fff';
    tokenCtx.beginPath(); tokenCtx.arc(dx, dy, dr, 0, Math.PI * 2); tokenCtx.stroke();
    tokenCtx.font = '16px "Segoe UI Emoji", "Apple Color Emoji", system-ui, sans-serif';
    tokenCtx.textAlign = 'center'; tokenCtx.textBaseline = 'middle';
    tokenCtx.fillText(conds[i].glyph, dx, dy + 1);
    tokenCtx.restore();
  }
}

function tokenBandLabel(ctx, x, y, text, color) {
  ctx.save();
  ctx.font = '700 12px system-ui, "Segoe UI", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width;
  const padX = 7, h = 17;
  // Dark pill behind the text + a coloured outline, so the band name pops on any map.
  ctx.fillStyle = 'rgba(12,12,20,0.8)';
  ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  tokenRoundRect(ctx, x - w / 2 - padX, y - h / 2, w + padX * 2, h, 6);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function tokenRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

function tokenDrawLabel(ctx, x, y, text) {
  ctx.font = '600 12px system-ui, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.65)';
  ctx.strokeText(text, x, y);     // dark outline for legibility on any map
  ctx.fillStyle = '#f3f6fa';
  ctx.fillText(text, x, y);
}
