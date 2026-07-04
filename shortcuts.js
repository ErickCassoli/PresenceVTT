// shortcuts.js — user-configurable keyboard shortcuts (PresenceVTT addition).
//
// Part of PresenceVTT, a fork of Evermist (MIT, Copyright (c) 2026 Hinnful).
//
// The inline keydown handler no longer hardcodes keys: it asks shortcutMatchAction(e)
// which action an event triggers, then runs it. Bindings live here with sensible
// defaults and per-user overrides in localStorage, and the `?` legend doubles as the
// editor — click a key chip in "✎ Editar" mode and press the new key.
//
// Plain <script> (no ES modules), loaded before the inline script so its globals exist
// when the handler runs. DM-only editor UI (guarded by isPlayer). Add to package.json
// build.files so it ships in the Electron package.

(function () {
  'use strict';

  var LS_KEY = 'presencevtt-shortcuts';
  var onPlayer = new URLSearchParams(window.location.search).get('mode') === 'player';

  // ── Action registry (order = match priority = display order) ─────────────────
  // token grammar: modifiers 'ctrl'/'alt'/'shift' then the key, joined with '+'.
  // Letters are lowercased with an explicit 'shift' (so 's' ≠ 'shift+s'); printable
  // symbols/digits keep the character as-is (shift is already baked into it). ' ' → 'space'.
  var ACTIONS = [
    { id: 'tool-select',    cat: 'tools',      label: 'Selecionar / Mover',           defaults: ['1', 'v'] },
    { id: 'tool-brush',     cat: 'tools',      label: 'Pincel',                       defaults: ['2'] },
    { id: 'tool-rect',      cat: 'tools',      label: 'Retângulo',                    defaults: ['3', 'e'] },
    { id: 'tool-circle',    cat: 'tools',      label: 'Círculo',                      defaults: ['4', 'c'] },
    { id: 'tool-poly',      cat: 'tools',      label: 'Polígono',                     defaults: ['5', 'p'] },
    { id: 'reveal-shroud',  cat: 'tools',      label: 'Alterna Revelar / Ocultar',    defaults: ['s'] },
    { id: 'ruler',          cat: 'modes',      label: 'Régua',                        defaults: ['r'] },
    { id: 'token',          cat: 'modes',      label: 'Token',                        defaults: ['t'] },
    { id: 'aoe',            cat: 'modes',      label: 'Área (AoE)',                   defaults: ['a'] },
    { id: 'draw',           cat: 'modes',      label: 'Marcações',                    defaults: ['d'] },
    { id: 'grid',           cat: 'view',       label: 'Grid liga/desliga',            defaults: ['g'] },
    { id: 'snap',           cat: 'view',       label: 'Grudar no grid',               defaults: ['n'] },
    { id: 'fit',            cat: 'view',       label: 'Ajustar à tela',               defaults: ['f'] },
    { id: 'undo',           cat: 'view',       label: 'Desfazer',                     defaults: ['ctrl+z'] },
    { id: 'redo',           cat: 'view',       label: 'Refazer',                      defaults: ['ctrl+y', 'ctrl+shift+z'] },
    { id: 'go-live',        cat: 'projection', label: 'Ir ao vivo',                   defaults: ['space'] },
    { id: 'go-live-manual', cat: 'projection', label: 'Ir ao vivo (modo manual)',     defaults: ['shift+s'] },
    { id: 'ruler-share',    cat: 'projection', label: 'Mostrar régua aos jogadores',  defaults: ['shift+r'] },
    { id: 'blackout',       cat: 'projection', label: 'Blackout da projeção',         defaults: ['b'] },
    { id: 'legend',         cat: 'projection', label: 'Abrir/fechar esta legenda',    defaults: ['?'] }
  ];
  var CATS = [
    { id: 'tools',      label: 'Ferramentas' },
    { id: 'modes',      label: 'Modos' },
    { id: 'view',       label: 'Mapa & Visão' },
    { id: 'projection', label: 'Projeção' }
  ];
  // Non-rebindable structural keys, shown for reference only.
  var FIXED = [
    { keys: 'Del',   label: 'Apagar polígono / vértice' },
    { keys: 'Esc',   label: 'Desselecionar / fechar' },
    { keys: '2×',    label: 'Clique na aresta → insere vértice' },
    { keys: '[ ]',   label: 'Tamanho do pincel −/+' }
  ];

  var byId = {};
  ACTIONS.forEach(function (a) { byId[a.id] = a; });

  // ── Overrides: id → token, or '' meaning "unbound" (no key). ─────────────────
  var overrides = {};
  try { overrides = JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; } catch (e) { overrides = {}; }
  function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(overrides)); } catch (e) {} }

  function effectiveTokens(id) {
    if (Object.prototype.hasOwnProperty.call(overrides, id)) {
      return overrides[id] === '' ? [] : [overrides[id]];
    }
    return byId[id] ? byId[id].defaults.slice() : [];
  }

  // ── Event → token ────────────────────────────────────────────────────────────
  function tokenize(e) {
    var parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.altKey) parts.push('alt');
    var k = e.key;
    if (k === ' ') k = 'space';
    var isLetter = k.length === 1 && /[a-zA-Z]/.test(k);
    if (isLetter) { if (e.shiftKey) parts.push('shift'); k = k.toLowerCase(); }
    else if (k.length > 1) { if (e.shiftKey) parts.push('shift'); k = k.toLowerCase(); }
    // printable symbol/digit (length 1, non-letter): shift already encoded in the char
    parts.push(k);
    return parts.join('+');
  }

  function isModifierKey(e) {
    return e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta';
  }

  // Returns the action id an event triggers, or null. First match in registry order wins.
  function matchAction(e) {
    var token = tokenize(e);
    for (var i = 0; i < ACTIONS.length; i++) {
      if (effectiveTokens(ACTIONS[i].id).indexOf(token) !== -1) return ACTIONS[i].id;
    }
    return null;
  }

  // ── Pretty token for display (PT; i18n translates 'Espaço' etc.) ─────────────
  function tokenLabel(token) {
    return token.split('+').map(function (p) {
      if (p === 'ctrl') return 'Ctrl';
      if (p === 'alt') return 'Alt';
      if (p === 'shift') return 'Shift';
      if (p === 'space') return 'Espaço';
      return p.length === 1 && /[a-z]/.test(p) ? p.toUpperCase() : p;
    }).join(' ');
  }

  // ── Rebinding ────────────────────────────────────────────────────────────────
  function rebind(id, token) {
    // Keep a 1:1 mapping — unbind any other action currently holding this token.
    ACTIONS.forEach(function (a) {
      if (a.id !== id && effectiveTokens(a.id).indexOf(token) !== -1) overrides[a.id] = '';
    });
    overrides[id] = token;
    save();
    render();
  }
  function resetAction(id) { delete overrides[id]; save(); render(); }
  function resetAll() { overrides = {}; save(); render(); }

  // ── Capture: after clicking a chip, the next keypress becomes the binding ─────
  var capturingId = null;
  function beginCapture(id) {
    capturingId = id;
    render();
  }
  function cancelCapture() { capturingId = null; render(); }
  function captureHandler(e) {
    if (capturingId == null) return;
    if (isModifierKey(e)) return;                 // wait for a real key after the modifier
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') { cancelCapture(); return; }
    var id = capturingId;
    capturingId = null;
    rebind(id, tokenize(e));                        // rebind() re-renders
  }

  // ── Editor / legend rendering ────────────────────────────────────────────────
  var editMode = false;

  function chip(text) {
    var k = document.createElement('kbd');
    k.textContent = text;
    return k;
  }

  function makeRow(action) {
    var row = document.createElement('div');
    row.className = 'legend-row sc-row';
    var keysWrap = document.createElement('span');
    keysWrap.className = 'sc-keys';

    var toks = effectiveTokens(action.id);
    if (editMode) {
      var btn = document.createElement('button');
      btn.className = 'sc-chip-btn';
      if (capturingId === action.id) {
        btn.classList.add('capturing');
        btn.textContent = 'Pressione uma tecla…';
      } else {
        btn.textContent = toks.length ? toks.map(tokenLabel).join(' · ') : '—';
      }
      btn.title = 'Clique e pressione a nova tecla (Esc cancela)';
      btn.addEventListener('click', function () {
        if (capturingId === action.id) cancelCapture(); else beginCapture(action.id);
      });
      keysWrap.appendChild(btn);
      // Reset-to-default affordance when customized.
      if (Object.prototype.hasOwnProperty.call(overrides, action.id)) {
        var rst = document.createElement('button');
        rst.className = 'sc-reset';
        rst.textContent = '↺';
        rst.title = 'Restaurar padrão';
        rst.addEventListener('click', function () { resetAction(action.id); });
        keysWrap.appendChild(rst);
      }
    } else {
      if (!toks.length) keysWrap.appendChild(chip('—'));
      else toks.forEach(function (t, i) {
        if (i > 0) { var sep = document.createElement('span'); sep.className = 'sc-or'; sep.textContent = ' · '; keysWrap.appendChild(sep); }
        keysWrap.appendChild(chip(tokenLabel(t)));
      });
    }

    var lbl = document.createElement('span');
    lbl.className = 'sc-lbl';
    lbl.textContent = action.label;

    row.appendChild(keysWrap);
    row.appendChild(lbl);
    return row;
  }

  function render() {
    if (onPlayer) return;
    var body = document.getElementById('legend-body');
    if (!body) return;
    body.innerHTML = '';

    var cols = document.createElement('div');
    cols.className = 'legend-cols';

    // Column 1: tools + modes.  Column 2: view + projection + fixed.
    var col1 = document.createElement('div');
    var col2 = document.createElement('div');
    ['tools', 'modes'].forEach(function (c) { renderCat(col1, c); });
    ['view', 'projection'].forEach(function (c) { renderCat(col2, c); });

    // Fixed (reference-only) keys.
    var fcat = document.createElement('div');
    fcat.className = 'legend-cat';
    fcat.textContent = 'Fixas';
    col2.appendChild(fcat);
    FIXED.forEach(function (f) {
      var row = document.createElement('div');
      row.className = 'legend-row sc-row';
      var kw = document.createElement('span');
      kw.className = 'sc-keys';
      kw.appendChild(chip(f.keys));
      var lbl = document.createElement('span');
      lbl.className = 'sc-lbl';
      lbl.textContent = f.label;
      row.appendChild(kw); row.appendChild(lbl);
      col2.appendChild(row);
    });

    cols.appendChild(col1);
    cols.appendChild(col2);
    body.appendChild(cols);

    // Edit-mode footer.
    var editToggle = document.getElementById('legend-edit-toggle');
    if (editToggle) editToggle.classList.toggle('active', editMode);
    var resetBtn = document.getElementById('legend-reset-all');
    if (resetBtn) resetBtn.style.display = editMode ? '' : 'none';
  }

  function renderCat(col, catId) {
    var cat = CATS.filter(function (c) { return c.id === catId; })[0];
    var head = document.createElement('div');
    head.className = 'legend-cat';
    head.textContent = cat.label;
    col.appendChild(head);
    ACTIONS.filter(function (a) { return a.cat === catId; }).forEach(function (a) {
      col.appendChild(makeRow(a));
    });
  }

  function toggleEdit() {
    editMode = !editMode;
    if (!editMode) capturingId = null;
    render();
  }

  // ── Init ─────────────────────────────────────────────────────────────────────
  function init() {
    if (onPlayer) return;
    window.addEventListener('keydown', captureHandler, true); // capture phase → beats the app handler
    var editToggle = document.getElementById('legend-edit-toggle');
    if (editToggle) editToggle.addEventListener('click', toggleEdit);
    var resetBtn = document.getElementById('legend-reset-all');
    if (resetBtn) resetBtn.addEventListener('click', resetAll);
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // Expose for the inline keydown handler.
  window.shortcutMatchAction = matchAction;
  window.shortcutCapturing = function () { return capturingId != null; };
})();
