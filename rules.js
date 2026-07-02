// rules.js — DM-only Rules tab: system picker + reference + MANUAL trackers (PresenceVTT).
//
// Part of PresenceVTT, a fork of Evermist (MIT, Copyright (c) 2026 Hinnful).
//
// RED LINE (do not cross): reference text + manual trackers ONLY. Nothing applies an effect,
// rolls a die, or calculates. Every number changes only when the DM clicks it. A tracker that
// does something automatic would make this a VTT — so it doesn't.
//
// System-aware: a <select> swaps the active game system (systems.js → conditions, ranges,
// reference, and the seeded counters). Counters are generic manual tallies kept PER SYSTEM
// (Daggerheart seeds "Fear"; add your own for D&D, Ordem, etc.). Clocks are shared.
//
// Fully isolated module: builds its own DOM + CSS, persists to localStorage, and does NOTHING
// on the projection (?mode=player). Loaded after systems.js. Plain <script>, no ES modules.

(function () {
  if (new URLSearchParams(location.search).get('mode') === 'player') return; // projection stays clean

  const LS_KEY = 'presencevtt-rules-state';
  let _nid = 1;
  const nid = () => _nid++;

  // countersBySystem: { [systemId]: [{ id, name, value }] }  ·  clocks shared across systems
  let state = { countersBySystem: {}, clocks: [], foesBySystem: {}, spotlight: [], open: false, tab: 'trackers' };
  function loadState() {
    try { state = Object.assign(state, JSON.parse(localStorage.getItem(LS_KEY) || '{}')); } catch (e) {}
    if (!state.countersBySystem || typeof state.countersBySystem !== 'object') state.countersBySystem = {};
    if (!Array.isArray(state.clocks)) state.clocks = [];
    if (!state.foesBySystem || typeof state.foesBySystem !== 'object') state.foesBySystem = {};
    if (Array.isArray(state.foes)) delete state.foes; // old global foes dropped — shape/style is per-system now
    if (!Array.isArray(state.spotlight)) state.spotlight = [];
    for (const c of state.clocks) if (c.id >= _nid) _nid = c.id + 1;
    for (const k in state.foesBySystem) for (const f of state.foesBySystem[k]) if (f.id >= _nid) _nid = f.id + 1;
    for (const k in state.countersBySystem) for (const c of state.countersBySystem[k]) if (c.id >= _nid) _nid = c.id + 1;
  }
  function saveState() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {} }

  const sysId = () => (typeof activeSystemId !== 'undefined' ? activeSystemId : 'daggerheart');

  // Counters for the active system — seeded from the preset the first time it's used.
  function counters() {
    const id = sysId();
    if (!state.countersBySystem[id]) {
      const seed = (typeof activeSystem === 'function' ? (activeSystem().counters || []) : []);
      state.countersBySystem[id] = seed.map(c => ({ id: nid(), name: c.name || 'Contador', value: c.value | 0 }));
    }
    return state.countersBySystem[id];
  }

  let anchor, countersBox, panel, clockList, foeList, refResults, refSearch, refCatsEl, sysSelect;
  let refCat = 'Tudo'; // active reference category filter (chips)

  function build() {
    loadState();
    injectStyle();

    anchor = document.createElement('div');
    anchor.id = 'rules-anchor';
    anchor.innerHTML = `
      <button id="btn-rules" title="Abrir/fechar a aba de Regras">📖 Regras</button>
      <div id="rules-panel" hidden>
        <label class="rp-syslbl">Sistema
          <select id="rules-system" title="Trocar o sistema de jogo"></select>
        </label>
        <div class="rp-sysbtns">
          <button id="rules-sys-edit" title="Editar o sistema atual (presets viram cópia)">✎ Editar</button>
          <button id="rules-sys-new" title="Criar um sistema novo (a partir do atual)">＋ Novo</button>
          <button id="rules-sys-del" title="Excluir o sistema atual (só os seus; presets não)">🗑</button>
        </div>
        <div class="rp-tabs">
          <button class="rp-tab" data-tab="trackers">Trackers</button>
          <button class="rp-tab" data-tab="ref">Referência</button>
        </div>
        <div class="rp-tabbody" data-body="trackers">
          <div class="rp-sec">Contadores</div>
          <div id="rules-counters"></div>
          <button id="rules-counter-add" class="rp-add" title="Adicionar um contador manual (ex.: Fear)">＋ contador</button>

          <div class="rp-sec">Contagens regressivas</div>
          <div class="rp-clock-new">
            <input id="rules-clock-name" type="text" placeholder="Nome (ex.: Ritual)" maxlength="28">
            <input id="rules-clock-size" type="number" min="2" max="12" value="6" title="Segmentos">
            <button id="rules-clock-add" title="Criar contagem">＋</button>
          </div>
          <div id="rules-clock-list"></div>

          <div class="rp-sec">Vida de adversários</div>
          <div class="rp-foe-new">
            <input id="rules-foe-name" type="text" placeholder="Nome (ex.: Goblin)" maxlength="28">
            <input id="rules-foe-hp" type="number" min="0" value="10" title="Vida inicial">
            <button id="rules-foe-add" title="Adicionar adversário">＋</button>
          </div>
          <div id="rules-foe-list"></div>
        </div>
        <div class="rp-tabbody" data-body="ref" hidden>
          <input id="rules-ref-search" type="text" placeholder="Buscar (ex.: Vulnerável)…" autocomplete="off">
          <div id="rules-ref-cats" class="rp-ref-cats"></div>
          <div id="rules-ref-results"></div>
        </div>
      </div>`;
    document.body.appendChild(anchor);

    countersBox = anchor.querySelector('#rules-counters');
    panel       = anchor.querySelector('#rules-panel');
    clockList   = anchor.querySelector('#rules-clock-list');
    foeList     = anchor.querySelector('#rules-foe-list');
    refResults  = anchor.querySelector('#rules-ref-results');
    refSearch   = anchor.querySelector('#rules-ref-search');
    refCatsEl   = anchor.querySelector('#rules-ref-cats');
    sysSelect   = anchor.querySelector('#rules-system');

    // System picker
    const list = (typeof gameSystemList === 'function') ? gameSystemList() : [];
    sysSelect.innerHTML = list.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
    sysSelect.value = sysId();
    sysSelect.onchange = () => { if (typeof applyGameSystem === 'function') applyGameSystem(sysSelect.value); };
    anchor.querySelector('#rules-sys-edit').onclick = () => { if (typeof openSystemEditor === 'function') openSystemEditor(sysId(), 'edit'); };
    anchor.querySelector('#rules-sys-new').onclick  = () => { if (typeof openSystemEditor === 'function') openSystemEditor(sysId(), 'clone'); };
    anchor.querySelector('#rules-sys-del').onclick  = () => {
      const id = sysId();
      if (typeof isCustomSystem === 'function' && !isCustomSystem(id)) { alert('Presets (Daggerheart, D&D, Ordem) não podem ser excluídos. Crie o seu com ＋ Novo — aí dá pra excluir a cópia.'); return; }
      const nm = (typeof activeSystem === 'function') ? activeSystem().name : id;
      if (typeof window.confirm === 'function' && !window.confirm('Excluir o sistema "' + nm + '"? Não dá pra desfazer.')) return;
      if (typeof deleteCustomSystem === 'function') deleteCustomSystem(id);
      const list = (typeof gameSystemList === 'function') ? gameSystemList() : [];
      const next = (list[0] && list[0].id) || 'daggerheart';
      if (typeof applyGameSystem === 'function') applyGameSystem(next);
    };

    anchor.querySelector('#rules-counter-add').onclick = addCounter;
    anchor.querySelector('#btn-rules').onclick = togglePanel;
    anchor.querySelectorAll('.rp-tab').forEach(t => { t.onclick = () => setTab(t.dataset.tab); });
    anchor.querySelector('#rules-clock-add').onclick = addClock;
    anchor.querySelector('#rules-clock-name').addEventListener('keydown', e => { if (e.key === 'Enter') addClock(); });
    anchor.querySelector('#rules-foe-add').onclick = addFoe;
    anchor.querySelector('#rules-foe-name').addEventListener('keydown', e => { if (e.key === 'Enter') addFoe(); });
    refSearch.addEventListener('input', renderReference);

    renderCounters();
    renderClocks();
    renderFoes();
    syncFoeInput();
    renderReference();
    setTab(state.tab);
    panel.hidden = !state.open;
    anchor.querySelector('#btn-rules').classList.toggle('active', state.open);
  }

  // Called by applyGameSystem() when the DM switches systems (exposed on window below).
  function onSystemChanged() {
    if (!anchor) return;
    if (sysSelect) {
      const list = (typeof gameSystemList === 'function') ? gameSystemList() : [];
      sysSelect.innerHTML = list.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
      sysSelect.value = sysId();
    }
    renderCounters();
    renderFoes();
    syncFoeInput();
    renderReference();
  }

  // ── Counters (manual tallies, per system) ─────────────────────────────────────
  function addCounter() { counters().push({ id: nid(), name: 'Contador', value: 0 }); renderCounters(); saveState(); }
  function setCounter(id, v) { const c = counters().find(c => c.id === id); if (!c) return; c.value = Math.max(0, v | 0); renderCounters(); saveState(); }
  function renameCounter(id, name) { const c = counters().find(c => c.id === id); if (!c) return; c.name = name; saveState(); }
  function deleteCounter(id) { state.countersBySystem[sysId()] = counters().filter(c => c.id !== id); renderCounters(); saveState(); }

  function renderCounters() {
    if (!countersBox) return;
    countersBox.innerHTML = '';
    for (const c of counters()) {
      const card = document.createElement('div');
      card.className = 'rc-card';
      const name = document.createElement('input');
      name.className = 'rc-name'; name.value = c.name; name.title = 'Renomear'; name.maxLength = 18;
      name.oninput = () => renameCounter(c.id, name.value);
      const row = document.createElement('div');
      row.className = 'rc-row';
      const dec = document.createElement('button'); dec.className = 'rc-btn'; dec.textContent = '−'; dec.title = '−1';
      dec.onclick = () => setCounter(c.id, c.value - 1);
      const num = document.createElement('div'); num.className = 'rc-num'; num.textContent = c.value;
      const inc = document.createElement('button'); inc.className = 'rc-btn'; inc.textContent = '+'; inc.title = '+1';
      inc.onclick = () => setCounter(c.id, c.value + 1);
      const del = document.createElement('button'); del.className = 'rc-del'; del.textContent = '✕'; del.title = 'Remover contador';
      del.onclick = () => deleteCounter(c.id);
      row.appendChild(dec); row.appendChild(num); row.appendChild(inc); row.appendChild(del);
      card.appendChild(name); card.appendChild(row);
      countersBox.appendChild(card);
    }
  }

  // ── Panel / tabs ──────────────────────────────────────────────────────────────
  function togglePanel() {
    state.open = !state.open;
    panel.hidden = !state.open;
    document.getElementById('btn-rules').classList.toggle('active', state.open);
    saveState();
  }
  function setTab(tab) {
    state.tab = tab;
    panel.querySelectorAll('.rp-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    panel.querySelectorAll('.rp-tabbody').forEach(b => { b.hidden = b.dataset.body !== tab; });
    saveState();
  }

  // ── Clocks (manual: click a segment to fill/unfill) ───────────────────────────
  function addClock() {
    const nameEl = document.getElementById('rules-clock-name');
    const sizeEl = document.getElementById('rules-clock-size');
    const name = (nameEl.value || '').trim() || 'Clock';
    let size = parseInt(sizeEl.value, 10); if (!(size >= 2)) size = 6; if (size > 12) size = 12;
    state.clocks.push({ id: nid(), name, size, filled: 0 });
    nameEl.value = '';
    renderClocks(); saveState();
  }
  function setClockFilled(id, n) {
    const c = state.clocks.find(c => c.id === id); if (!c) return;
    c.filled = Math.max(0, Math.min(c.size, n));
    renderClocks(); saveState();
  }
  function deleteClock(id) { state.clocks = state.clocks.filter(c => c.id !== id); renderClocks(); saveState(); }

  function renderClocks() {
    if (!clockList) return;
    clockList.innerHTML = '';
    if (!state.clocks.length) { clockList.innerHTML = '<div class="rp-empty">Nenhum clock. Crie um acima.</div>'; return; }
    for (const c of state.clocks) {
      const row = document.createElement('div');
      row.className = 'rp-clock';
      const head = document.createElement('div');
      head.className = 'rp-clock-head';
      head.innerHTML = `<span class="rp-clock-name">${escapeHtml(c.name)}</span>
                        <span class="rp-clock-count">${c.filled}/${c.size}</span>
                        <button class="rp-clock-del" title="Apagar clock">🗑</button>`;
      head.querySelector('.rp-clock-del').onclick = () => deleteClock(c.id);
      const pips = document.createElement('div');
      pips.className = 'rp-pips';
      for (let i = 0; i < c.size; i++) {
        const pip = document.createElement('button');
        pip.className = 'rp-pip' + (i < c.filled ? ' on' : '');
        pip.title = (i + 1) + '/' + c.size;
        pip.onclick = () => setClockFilled(c.id, (c.filled === i + 1) ? i : i + 1);
        pips.appendChild(pip);
      }
      row.appendChild(head); row.appendChild(pips);
      clockList.appendChild(row);
    }
  }

  // ── Adversary HP — the STYLE comes from the active system (clock = pips / hp = cur/max) ─
  function foes() { const id = sysId(); if (!state.foesBySystem[id]) state.foesBySystem[id] = []; return state.foesBySystem[id]; }
  function foeTrackers() { const s = (typeof activeSystem === 'function') ? activeSystem() : null; return (s && s.trackers && s.trackers.foes) || { style: 'clock', size: 8 }; }
  function foeStyle() { return foeTrackers().style === 'hp' ? 'hp' : 'clock'; }
  function foeDefault() { const t = foeTrackers(); return foeStyle() === 'hp' ? (t.max || 20) : (t.size || 8); }
  function syncFoeInput() { const el = document.getElementById('rules-foe-hp'); if (el && document.activeElement !== el) { el.value = foeDefault(); el.title = foeStyle() === 'hp' ? 'Vida máxima' : 'Nº de pontos'; } }

  function addFoe() {
    const nameEl = document.getElementById('rules-foe-name');
    const hpEl = document.getElementById('rules-foe-hp');
    const name = (nameEl.value || '').trim() || 'Adversário';
    let n = parseInt(hpEl.value, 10); if (!(n >= 1)) n = 1;
    if (foeStyle() === 'hp') { if (n > 999) n = 999; foes().push({ id: nid(), name, cur: n, max: n }); }
    else { if (n > 40) n = 40; foes().push({ id: nid(), name, size: n, filled: n }); } // pips start full
    nameEl.value = '';
    renderFoes(); saveState();
  }
  function setFoe(id, n) { const f = foes().find(f => f.id === id); if (!f) return; f.filled = Math.max(0, Math.min(f.size, n)); renderFoes(); saveState(); }
  function setFoeCur(id, v) { const f = foes().find(f => f.id === id); if (!f) return; f.cur = Math.max(0, Math.min(f.max, v)); renderFoes(); saveState(); }
  function deleteFoe(id) { state.foesBySystem[sysId()] = foes().filter(f => f.id !== id); renderFoes(); saveState(); }

  function renderFoes() {
    if (!foeList) return;
    const list = foes();
    foeList.innerHTML = '';
    if (!list.length) { foeList.innerHTML = '<div class="rp-empty">Nenhum adversário. Adicione acima.</div>'; return; }
    const hp = foeStyle() === 'hp';
    for (const f of list) foeList.appendChild(hp ? foeHpRow(f) : foeClockRow(f));
  }

  function foeClockRow(f) {
    const row = document.createElement('div');
    row.className = 'rp-clock' + (f.filled <= 0 ? ' down' : '');
    const head = document.createElement('div');
    head.className = 'rp-clock-head';
    head.innerHTML = `<span class="rp-clock-name">${escapeHtml(f.name)}</span>
                      <span class="rp-clock-count">${f.filled}/${f.size}</span>
                      <button class="rp-clock-del" title="Remover adversário">🗑</button>`;
    head.querySelector('.rp-clock-del').onclick = () => deleteFoe(f.id);
    const pips = document.createElement('div');
    pips.className = 'rp-pips';
    for (let i = 0; i < f.size; i++) {
      const pip = document.createElement('button');
      pip.className = 'rp-pip' + (i < f.filled ? ' on' : '');
      pip.title = (i + 1) + '/' + f.size;
      pip.onclick = () => setFoe(f.id, (f.filled === i + 1) ? i : i + 1);
      pips.appendChild(pip);
    }
    row.appendChild(head); row.appendChild(pips);
    return row;
  }

  function foeHpRow(f) {
    const row = document.createElement('div');
    row.className = 'rp-foe-hp-row' + (f.cur <= 0 ? ' down' : '');
    const name = document.createElement('span'); name.className = 'rp-foe-hp-name'; name.textContent = f.name; name.title = f.name;
    const dec = document.createElement('button'); dec.className = 'rp-foe-hp-btn'; dec.textContent = '−'; dec.title = '−1'; dec.onclick = () => setFoeCur(f.id, f.cur - 1);
    const val = document.createElement('span'); val.className = 'rp-foe-hp-val'; val.textContent = f.cur + '/' + f.max;
    const inc = document.createElement('button'); inc.className = 'rp-foe-hp-btn'; inc.textContent = '+'; inc.title = '+1'; inc.onclick = () => setFoeCur(f.id, f.cur + 1);
    const del = document.createElement('button'); del.className = 'rp-foe-hp-del'; del.textContent = '🗑'; del.title = 'Remover'; del.onclick = () => deleteFoe(f.id);
    row.appendChild(name); row.appendChild(dec); row.appendChild(val); row.appendChild(inc); row.appendChild(del);
    return row;
  }

  // ── Reference (read-only search; never applies anything) ──────────────────────
  function renderReference() {
    if (!refResults) return;
    const idx = (typeof RULES_INDEX !== 'undefined') ? RULES_INDEX : [];

    // Category filter chips (Tudo + each distinct category present).
    if (refCatsEl) {
      const cats = ['Tudo'];
      for (const e of idx) if (cats.indexOf(e.cat) === -1) cats.push(e.cat);
      if (cats.indexOf(refCat) === -1) refCat = 'Tudo';
      refCatsEl.innerHTML = '';
      for (const c of cats) {
        const b = document.createElement('button');
        b.className = 'rp-refcat' + (c === refCat ? ' on' : '');
        b.textContent = c;
        b.onclick = () => { refCat = c; renderReference(); };
        refCatsEl.appendChild(b);
      }
    }

    const q = (refSearch.value || '').trim().toLowerCase();
    const hits = idx.filter(e =>
      (refCat === 'Tudo' || e.cat === refCat) &&
      (!q || (e.name + ' ' + e.text + ' ' + (e.details || '') + ' ' + e.cat).toLowerCase().includes(q))
    );
    refResults.innerHTML = '';
    if (!hits.length) { refResults.innerHTML = '<div class="rp-empty">Nada encontrado.</div>'; return; }
    for (const e of hits) {
      const hasDet = !!(e.details && e.details.trim());
      const openIt = hasDet && !!q;                 // searching → reveal the detail straight away
      const item = document.createElement('div');
      item.className = 'rp-ref' + (hasDet ? ' has-det' : '') + (openIt ? ' open' : '');
      const icon = e.icon ? `<span class="rp-ref-icn">${escapeHtml(e.icon)}</span>` : '';
      item.innerHTML = `<div class="rp-ref-top">
          ${icon}
          <span class="rp-ref-cat">${escapeHtml(e.cat)}</span>
          <span class="rp-ref-name">${escapeHtml(e.name)}</span>
          ${hasDet ? '<span class="rp-ref-chev">▸</span>' : ''}
        </div>
        <div class="rp-ref-text">${escapeHtml(e.text)}</div>
        ${hasDet ? `<div class="rp-ref-details"${openIt ? '' : ' hidden'}>${escapeHtml(e.details)}</div>` : ''}`;
      if (hasDet) {
        item.querySelector('.rp-ref-top').onclick = () => {
          const open = item.classList.toggle('open');
          item.querySelector('.rp-ref-details').hidden = !open;
        };
      }
      refResults.appendChild(item);
    }
  }

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // ── Styles (scoped by #rules-anchor; reuses the app's CSS variables) ──────────
  function injectStyle() {
    const css = `
      #rules-anchor { position: fixed; top: 12px; left: 12px; z-index: 200; display: flex; flex-direction: column; gap: 8px;
        align-items: flex-start; zoom: var(--ui-zoom, 1.2); font: 13px system-ui, "Segoe UI", sans-serif; }
      #rules-counters { display: flex; flex-direction: column; gap: 6px; }
      .rc-card { background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 5px 8px 6px; }
      .rc-name { width: 100%; box-sizing: border-box; background: transparent; border: none; color: var(--muted);
        font: 700 10px system-ui; letter-spacing: 0.16em; text-transform: uppercase; text-align: center; padding: 1px 0; }
      .rc-name:focus { outline: none; color: var(--accent); }
      .rc-row { display: flex; align-items: center; gap: 6px; justify-content: center; }
      .rc-num { font: 800 22px/1 "Cinzel", Georgia, serif; color: var(--accent); min-width: 40px; text-align: center; }
      .rc-btn { width: 26px; height: 26px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg);
        color: var(--text); font-size: 16px; line-height: 1; cursor: pointer; }
      .rc-btn:hover { border-color: var(--accent); color: var(--accent); }
      .rc-del { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 11px; padding: 2px; }
      .rc-del:hover { color: #e0564e; }
      #rules-counter-add { background: var(--surface-2); border: 1px dashed var(--border); color: var(--muted);
        border-radius: 8px; padding: 4px 10px; cursor: pointer; font-size: 11px; margin: 6px 0 4px; }
      #rules-counter-add:hover { border-color: var(--accent); color: var(--accent); }
      /* Adversary HP — pip clock (reuses .rp-clock / .rp-pip); dead = dimmed */
      .rp-foe-new { display: flex; gap: 6px; margin-bottom: 8px; }
      .rp-foe-new input[type=text] { flex: 1; min-width: 0; }
      .rp-foe-new input[type=number] { width: 56px; }
      #rules-foe-add { width: 32px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); border-radius: 6px; font-size: 16px; cursor: pointer; }
      #rules-foe-add:hover { border-color: var(--accent); color: var(--accent); }
      .rp-clock.down { opacity: 0.5; }
      .rp-foe-hp-row { display: flex; align-items: center; gap: 6px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 9px; padding: 5px 7px; margin-bottom: 6px; }
      .rp-foe-hp-row.down { opacity: 0.5; }
      .rp-foe-hp-name { flex: 1; min-width: 0; color: var(--text); font: 600 12px system-ui; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .rp-foe-hp-btn { width: 26px; height: 26px; border-radius: 7px; border: 1px solid var(--border); background: var(--bg); color: var(--text); font-size: 16px; line-height: 1; cursor: pointer; }
      .rp-foe-hp-btn:hover { border-color: var(--accent); color: var(--accent); }
      .rp-foe-hp-val { min-width: 54px; text-align: center; font: 800 15px "Cinzel", Georgia, serif; color: var(--accent); }
      .rp-foe-hp-del { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 12px; }
      .rp-foe-hp-del:hover { color: #e0564e; }
      #btn-rules { background: var(--surface); border: 1px solid var(--border); color: var(--text); border-radius: 9px;
        padding: 6px 12px; cursor: pointer; font-weight: 600; }
      #btn-rules:hover { border-color: var(--accent); color: var(--accent); }
      #btn-rules.active { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); color: var(--accent); }
      #rules-panel { width: 272px; max-height: calc((100vh - 210px) / var(--ui-zoom, 1.2)); overflow-y: auto;
        background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 10px;
        box-shadow: 0 8px 28px rgba(0,0,0,0.5); scrollbar-width: thin; scrollbar-color: var(--surface-2) transparent; }
      #rules-panel::-webkit-scrollbar { width: 10px; }
      #rules-panel::-webkit-scrollbar-track { background: transparent; }
      #rules-panel::-webkit-scrollbar-thumb { background: var(--surface-2); border: 2px solid var(--surface); border-radius: 8px; }
      #rules-panel::-webkit-scrollbar-thumb:hover { background: var(--border); }
      .rp-syslbl { display: flex; align-items: center; gap: 7px; font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
        text-transform: uppercase; color: var(--muted); margin-bottom: 9px; }
      #rules-system { flex: 1; background: var(--surface-2); border: 1px solid var(--border); color: var(--text);
        border-radius: 6px; padding: 5px 7px; font: 13px system-ui; text-transform: none; letter-spacing: normal; }
      .rp-sysbtns { display: flex; gap: 6px; margin: -3px 0 9px; }
      .rp-sysbtns button { flex: 1; background: var(--surface-2); border: 1px solid var(--border); color: var(--muted);
        border-radius: 7px; padding: 4px 0; cursor: pointer; font-size: 11px; font-weight: 600; }
      .rp-sysbtns button:hover { border-color: var(--accent); color: var(--accent); }
      #rules-sys-del { flex: 0 0 34px; }
      #rules-sys-del:hover { border-color: #e0564e; color: #e0564e; }
      .rp-tabs { display: flex; gap: 6px; margin-bottom: 8px; }
      .rp-tab { flex: 1; background: var(--surface-2); border: 1px solid var(--border); color: var(--muted);
        border-radius: 7px; padding: 5px 0; cursor: pointer; font-weight: 600; }
      .rp-tab.active { color: var(--text); border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
      .rp-sec { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); margin: 4px 0 6px; }
      .rp-empty { color: var(--muted); font-size: 12px; padding: 6px 2px; }
      .rp-clock-new { display: flex; gap: 6px; margin-bottom: 8px; }
      .rp-clock-new input[type=text] { flex: 1; min-width: 0; }
      .rp-clock-new input[type=number] { width: 48px; }
      #rules-anchor input[type=text], #rules-anchor input[type=number] { background: var(--surface-2); border: 1px solid var(--border);
        color: var(--text); border-radius: 6px; padding: 5px 7px; font: inherit; }
      #rules-anchor input:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
      #rules-clock-add { width: 32px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); border-radius: 6px; font-size: 16px; cursor: pointer; }
      #rules-clock-add:hover { border-color: var(--accent); color: var(--accent); }
      .rp-clock { background: var(--surface-2); border: 1px solid var(--border); border-radius: 9px; padding: 8px; margin-bottom: 8px; }
      .rp-clock-head { display: flex; align-items: center; gap: 6px; margin-bottom: 7px; }
      .rp-clock-name { font-weight: 600; color: var(--text); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .rp-clock-count { color: var(--muted); font-size: 11px; }
      .rp-clock-del { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 13px; }
      .rp-clock-del:hover { color: #e0564e; }
      .rp-pips { display: flex; flex-wrap: wrap; gap: 5px; }
      .rp-pip { width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--border); background: transparent; cursor: pointer; }
      .rp-pip:hover { border-color: var(--accent); }
      .rp-pip.on { background: var(--accent); border-color: var(--accent); }
      #rules-ref-search { width: 100%; box-sizing: border-box; margin-bottom: 8px; position: sticky; top: 0; z-index: 1; }
      .rp-ref-cats { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
      .rp-refcat { font-size: 10px; background: var(--surface-2); border: 1px solid var(--border); color: var(--muted);
        border-radius: 6px; padding: 2px 8px; cursor: pointer; }
      .rp-refcat:hover { border-color: var(--accent); color: var(--accent); }
      .rp-refcat.on { color: var(--text); border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
      .rp-ref-icn { font-size: 15px; line-height: 1; flex: 0 0 auto; }
      .rp-ref { border-bottom: 1px solid var(--border); padding: 7px 2px; }
      .rp-ref-top { display: flex; align-items: center; gap: 7px; }
      .rp-ref.has-det .rp-ref-top { cursor: pointer; }
      .rp-ref.has-det:hover .rp-ref-name { color: var(--accent); }
      .rp-ref-cat { font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--bg);
        background: var(--accent); border-radius: 4px; padding: 1px 5px; white-space: nowrap; }
      .rp-ref-name { font-weight: 600; color: var(--text); }
      .rp-ref-chev { margin-left: auto; color: var(--muted); font-size: 11px; transition: transform 0.15s ease; }
      .rp-ref.open .rp-ref-chev { transform: rotate(90deg); color: var(--accent); }
      .rp-ref-text { color: var(--muted); font-size: 12px; line-height: 1.4; margin-top: 3px; }
      .rp-ref-details { color: var(--text); font-size: 12px; line-height: 1.5; margin-top: 6px; padding: 7px 9px;
        background: var(--surface-2); border: 1px solid var(--border); border-radius: 7px; white-space: pre-line; }
    `;
    const style = document.createElement('style');
    style.id = 'rules-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // Expose the refresh hook so systems.js can call it after a switch.
  window.rulesOnSystemChanged = onSystemChanged;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
