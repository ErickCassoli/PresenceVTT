// soundboard.js — DM soundboard (ambient loops + one-shots) via Howler.js (PresenceVTT addition).
//
// Part of PresenceVTT, a fork of Evermist (MIT, Copyright (c) 2026 Hinnful).
//
// AUDIO ONLY — no visual overlay is synced to the table. Runs in BOTH windows: the DM window
// builds the UI + engine; the projection (?mode=player) runs the engine HEADLESS and only
// reacts to 'sb-cmd' postMessages (so speakers on the table TV can be the output).
//
// SETUP vs LIVE is the core UX rule: setup (add files, organize pads, per-pad key/color/volume)
// is done OUT of the scene; LIVE is strictly 1-touch play/stop. Two pad types: AMBIENT (loop,
// only one active, switching CROSSFADES) and ONE-SHOT (fires over the ambient, may overlap).
// Config persists in localStorage; audio blobs in IndexedDB (shared by both windows). Loaded
// after lib/howler.min.js. Plain <script>, no ES modules.

(function () {
  const IS_PLAYER = new URLSearchParams(location.search).get('mode') === 'player';

  // ── Audio blob storage (IndexedDB; shared origin → both windows read it) ──────
  const DB = 'presencevtt-sound', STORE = 'files';
  function idb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  }
  async function idbPut(k, blob) { const d = await idb(); return new Promise((res, rej) => { const t = d.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(blob, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); }
  async function idbGet(k) { const d = await idb(); return new Promise((res, rej) => { const t = d.transaction(STORE, 'readonly'); const q = t.objectStore(STORE).get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
  async function idbDel(k) { const d = await idb(); return new Promise((res) => { const t = d.transaction(STORE, 'readwrite'); t.objectStore(STORE).delete(k); t.oncomplete = () => res(); t.onerror = () => res(); }); }

  function uid() { return Math.random().toString(36).slice(2, 9) + Math.random().toString(36).slice(2, 6); }

  // ── Config (localStorage) ──────────────────────────────────────────────────────
  const LS = 'presencevtt-soundboard';
  function defaults() { return { master: 0.9, muted: false, crossfadeMs: 1500, output: 'local', categories: ['Ambientes', 'Combate', 'SFX'], activeCat: 'Ambientes', setup: false, pads: [] }; }
  let cfg = defaults();
  function loadCfg() { try { cfg = Object.assign(defaults(), JSON.parse(localStorage.getItem(LS) || '{}')); } catch (e) {} if (!Array.isArray(cfg.categories) || !cfg.categories.length) cfg.categories = ['Ambientes', 'Combate', 'SFX']; if (!Array.isArray(cfg.pads)) cfg.pads = []; if (cfg.categories.indexOf(cfg.activeCat) === -1) cfg.activeCat = cfg.categories[0]; }
  function saveCfg() { try { localStorage.setItem(LS, JSON.stringify(cfg)); } catch (e) {} }
  function padById(id) { return cfg.pads.find(p => p.id === id); }

  // ── Engine (Howler) — used locally on whichever window is the output ──────────
  const howls = {};          // padId -> { howl, url, sid }
  let engAmbient = null;     // padId of the ambient this window's engine is playing

  // DM window pulls the blob from IndexedDB; the projection gets the bytes over postMessage.
  async function ensureHowl(pad, bytes) {
    if (!pad || typeof Howl === 'undefined') return null;
    if (howls[pad.id]) return howls[pad.id];
    let blob = null;
    if (IS_PLAYER) blob = bytes ? new Blob([bytes], { type: 'audio/' + (pad.fmt || 'mpeg') }) : null;
    else if (pad.fileId) blob = await idbGet(pad.fileId);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    const howl = new Howl({ src: [url], format: [pad.fmt || 'mp3'], html5: true, loop: pad.type === 'ambient' && pad.loop !== false, volume: (pad.volume != null ? pad.volume : 0.9) });
    howls[pad.id] = { howl, url, sid: null };
    return howls[pad.id];
  }
  function setOutputVolume(master, muted) { if (typeof Howler !== 'undefined') { Howler.volume(master != null ? master : 0.9); Howler.mute(!!muted); } }

  async function engPlayAmbient(pad, bytes) {
    const dur = cfg.crossfadeMs || 1500;
    const prev = engAmbient;
    const e = await ensureHowl(pad, bytes); if (!e) return;
    e.howl.loop(true);
    const target = (pad.volume != null ? pad.volume : 0.9);
    e.howl.volume(0);
    const id = e.howl.play(); e.sid = id;
    e.howl.fade(0, target, dur, id);
    engAmbient = pad.id;
    if (prev && prev !== pad.id && howls[prev]) {
      const p = howls[prev];
      try { const v = p.howl.volume(); p.howl.fade(typeof v === 'number' ? v : 0.9, 0, dur, p.sid); const sid = p.sid; setTimeout(() => { try { p.howl.stop(sid); } catch (e) {} }, dur + 60); } catch (e) {}
    }
  }
  function engStopAmbient() {
    const cur = engAmbient; engAmbient = null;
    if (cur && howls[cur]) { const p = howls[cur]; const dur = cfg.crossfadeMs || 1500; try { const v = p.howl.volume(); p.howl.fade(typeof v === 'number' ? v : 0.9, 0, dur, p.sid); const sid = p.sid; setTimeout(() => { try { p.howl.stop(sid); } catch (e) {} }, dur + 60); } catch (e) {} }
  }
  async function engOneShot(pad, bytes) { const e = await ensureHowl(pad, bytes); if (!e) return; e.howl.loop(false); const id = e.howl.play(); e.howl.volume(pad.volume != null ? pad.volume : 0.9, id); }
  function engPanic() { for (const k in howls) { try { howls[k].howl.stop(); } catch (e) {} } engAmbient = null; }
  function engExec(cmd, pad, bytes) { if (cmd === 'ambient') engPlayAmbient(pad, bytes); else if (cmd === 'stopAmbient') engStopAmbient(); else if (cmd === 'oneshot') engOneShot(pad, bytes); else if (cmd === 'panic') engPanic(); }

  // ── Projection output (headless engine in the player window) ──────────────────
  function minPad(p) { return { id: p.id, type: p.type, volume: p.volume, loop: p.loop, fileId: p.fileId, fmt: p.fmt }; }
  let sentIds = {}; // pad ids whose bytes the projection already holds (reset when it reopens)
  async function postCmd(cmd, pad) {
    const pw = (typeof playerWindow !== 'undefined') ? playerWindow : null;
    if (!pw || pw.closed) return;
    let buf = null;
    if (pad && pad.fileId && !sentIds[pad.id]) {
      try { const blob = await idbGet(pad.fileId); if (blob) { buf = await blob.arrayBuffer(); sentIds[pad.id] = true; } } catch (e) {}
    }
    pw.postMessage({ type: 'sb-cmd', cmd, master: cfg.master, muted: cfg.muted, pad: pad ? minPad(pad) : null, buf: buf }, '*');
  }
  if (IS_PLAYER) {
    // Headless: obey the DM's audio commands, no UI. Volume/mute + audio bytes ride along.
    window.addEventListener('message', e => {
      const m = e.data;
      if (!m || typeof m !== 'object' || m.type !== 'sb-cmd') return;
      setOutputVolume(m.master, m.muted);
      engExec(m.cmd, m.pad, m.buf);
    });
    return; // no DM UI on the projection
  }

  // ═══════════════ DM-ONLY from here down ═══════════════
  loadCfg();

  let currentAmbient = null;   // UI: which ambient is lit (intended state)
  let ambientStartMs = 0;      // UI: for the progress bar
  let panel, grid, tabsEl, raf = null;

  // Route a trigger to local engine or to the projection, and update UI intent.
  function route(cmd, pad) { if (cfg.output === 'projection') postCmd(cmd, pad); else engExec(cmd, pad); }

  function trigger(pad) {
    if (!pad) return;
    if (pad.type === 'ambient') {
      if (currentAmbient === pad.id) { currentAmbient = null; route('stopAmbient', pad); }
      else { currentAmbient = pad.id; ambientStartMs = Date.now(); route('ambient', pad); ensureRAF(); }
    } else {
      route('oneshot', pad); flash(pad.id);
    }
    render();
  }
  function panic() { currentAmbient = null; engPanic(); if (cfg.output === 'projection') postCmd('panic', null); render(); }
  function applyMasterOut() { if (cfg.output === 'projection') postCmd('master', null); else setOutputVolume(cfg.master, cfg.muted); }

  function flash(id) { const el = grid && grid.querySelector('.sb-pad[data-id="' + id + '"]'); if (el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); } }

  function ensureRAF() { if (raf) return; raf = requestAnimationFrame(tick); }
  function tick() {
    raf = null;
    if (currentAmbient) {
      const pad = padById(currentAmbient);
      const bar = grid && grid.querySelector('.sb-pad[data-id="' + currentAmbient + '"] .sb-prog i');
      if (bar && pad && pad.duration > 0) { const el = (Date.now() - ambientStartMs) / 1000; bar.style.width = ((el % pad.duration) / pad.duration * 100) + '%'; }
      ensureRAF();
    }
  }

  // ── Import (drag a folder, or pick files) ─────────────────────────────────────
  const AUDIO_RE = /\.(mp3|ogg|wav|webm|m4a|aac|flac|opus)$/i;
  function gatherFiles(dt) {
    return new Promise(resolve => {
      const out = [];
      const items = dt && dt.items;
      if (items && items.length && items[0].webkitGetAsEntry) {
        const entries = [];
        for (const it of items) { const en = it.webkitGetAsEntry && it.webkitGetAsEntry(); if (en) entries.push(en); }
        (async () => { for (const en of entries) await walk(en, out); resolve(out); })();
      } else { for (const f of (dt.files || [])) out.push(f); resolve(out); }
    });
  }
  function walk(entry, out) {
    return new Promise(res => {
      if (entry.isFile) { entry.file(f => { out.push(f); res(); }, () => res()); }
      else if (entry.isDirectory) {
        const rd = entry.createReader(); const all = [];
        const batch = () => rd.readEntries(async ents => { if (!ents.length) { for (const c of all) await walk(c, out); res(); } else { all.push.apply(all, ents); batch(); } }, () => res());
        batch();
      } else res();
    });
  }
  function fileDuration(file) {
    return new Promise(res => {
      try { const a = new Audio(); a.preload = 'metadata'; const u = URL.createObjectURL(file); a.onloadedmetadata = () => { const d = a.duration; URL.revokeObjectURL(u); res(isFinite(d) ? d : 0); }; a.onerror = () => { URL.revokeObjectURL(u); res(0); }; a.src = u; } catch (e) { res(0); }
    });
  }
  async function importFiles(files) {
    let added = 0;
    for (const f of files) {
      if (!AUDIO_RE.test(f.name)) continue;
      const fileId = uid();
      try { await idbPut(fileId, f); } catch (e) { continue; }
      const ext = (f.name.split('.').pop() || 'mp3').toLowerCase();
      const dur = await fileDuration(f);
      cfg.pads.push({ id: uid(), name: f.name.replace(/\.[^.]+$/, ''), cat: cfg.activeCat, type: 'oneshot', color: '#7c5cff', key: '', volume: 0.9, loop: true, fileId, fmt: ext, duration: dur });
      added++;
    }
    if (added) { saveCfg(); render(); }
    return added;
  }
  async function deletePad(id) {
    const p = padById(id); if (!p) return;
    if (currentAmbient === id) { currentAmbient = null; route('stopAmbient', p); }
    if (howls[id]) { try { howls[id].howl.unload(); } catch (e) {} delete howls[id]; }
    if (p.fileId) idbDel(p.fileId);
    cfg.pads = cfg.pads.filter(x => x.id !== id);
    saveCfg(); render();
  }

  // ── UI ────────────────────────────────────────────────────────────────────────
  function build() {
    injectStyle();
    const anchor = document.createElement('div'); anchor.id = 'sb-anchor';
    anchor.innerHTML =
      '<button id="sb-toggle" title="Soundboard">🔊 Sons</button>' +
      '<div id="sb-panel" hidden>' +
        '<div class="sb-hdr">' +
          '<div class="sb-mode"><button id="sb-live" class="on">▶ Ao vivo</button><button id="sb-setup">⚙ Setup</button></div>' +
          '<span class="sb-sp"></span>' +
          '<span class="sb-vol">🔊<input id="sb-master" type="range" min="0" max="100" title="Volume master"></span>' +
          '<button id="sb-mute" title="Mudo">🔈</button>' +
          '<button id="sb-panic" title="Pânico — parar tudo (\\)">⏹ Pânico</button>' +
          '<button id="sb-close" title="Fechar">✕</button>' +
        '</div>' +
        '<div class="sb-out" id="sb-out"></div>' +
        '<div class="sb-tabs" id="sb-tabs"></div>' +
        '<div class="sb-import" id="sb-import" hidden>' +
          '<div class="sb-drop" id="sb-drop">Arraste uma <b>pasta de sons</b> aqui (mp3/ogg/wav…) — vira pads nesta categoria</div>' +
          '<div class="sb-imp-row"><input id="sb-file" type="file" accept="audio/*" multiple hidden>' +
          '<button id="sb-pick">＋ Escolher arquivos</button>' +
          '<span class="sb-xf">Crossfade <input id="sb-xf" type="range" min="0" max="4000" step="100"> <b id="sb-xf-v"></b></span></div>' +
          '<div class="sb-newcat"><input id="sb-cat-name" type="text" placeholder="Nova categoria" maxlength="20"><button id="sb-cat-add">＋ categoria</button></div>' +
        '</div>' +
        '<div class="sb-grid" id="sb-grid"></div>' +
      '</div>';
    document.body.appendChild(anchor);
    panel = anchor.querySelector('#sb-panel');
    grid = anchor.querySelector('#sb-grid');
    tabsEl = anchor.querySelector('#sb-tabs');

    anchor.querySelector('#sb-toggle').onclick = () => { panel.hidden = !panel.hidden; };
    anchor.querySelector('#sb-close').onclick = () => { panel.hidden = true; };
    anchor.querySelector('#sb-live').onclick = () => setSetup(false);
    anchor.querySelector('#sb-setup').onclick = () => setSetup(true);
    anchor.querySelector('#sb-panic').onclick = panic;
    const mute = anchor.querySelector('#sb-mute');
    mute.onclick = () => { cfg.muted = !cfg.muted; applyMasterOut(); saveCfg(); renderHeader(); };
    const master = anchor.querySelector('#sb-master');
    master.value = Math.round(cfg.master * 100);
    master.oninput = () => { cfg.master = master.value / 100; applyMasterOut(); renderHeader(); };
    master.onchange = saveCfg;

    const xf = anchor.querySelector('#sb-xf'); xf.value = cfg.crossfadeMs;
    anchor.querySelector('#sb-xf-v').textContent = (cfg.crossfadeMs / 1000).toFixed(1) + 's';
    xf.oninput = () => { cfg.crossfadeMs = parseInt(xf.value, 10) || 0; anchor.querySelector('#sb-xf-v').textContent = (cfg.crossfadeMs / 1000).toFixed(1) + 's'; };
    xf.onchange = saveCfg;

    const pick = anchor.querySelector('#sb-pick'); const fileIn = anchor.querySelector('#sb-file');
    pick.onclick = () => fileIn.click();
    fileIn.onchange = () => { importFiles(Array.from(fileIn.files || [])); fileIn.value = ''; };

    anchor.querySelector('#sb-cat-add').onclick = () => {
      const inp = anchor.querySelector('#sb-cat-name'); const name = (inp.value || '').trim();
      if (!name || cfg.categories.indexOf(name) !== -1) { inp.value = ''; return; }
      cfg.categories.push(name); cfg.activeCat = name; inp.value = ''; saveCfg(); render();
    };

    const drop = anchor.querySelector('#sb-drop');
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); if (ev === 'dragleave') drop.classList.remove('over'); }));
    drop.addEventListener('drop', async e => { e.preventDefault(); e.stopPropagation(); drop.classList.remove('over'); const files = await gatherFiles(e.dataTransfer); const n = await importFiles(files); drop.textContent = n ? (n + ' som(ns) importado(s) ✓') : 'Nenhum áudio encontrado.'; setTimeout(() => { drop.innerHTML = 'Arraste uma <b>pasta de sons</b> aqui (mp3/ogg/wav…) — vira pads nesta categoria'; }, 2200); });

    buildOutputRow(anchor.querySelector('#sb-out'));
    setOutputVolume(cfg.master, cfg.muted);
    render();

    // When the projection (re)opens it holds no audio bytes yet → re-ship on next play.
    window.addEventListener('message', e => { if (e && e.data && e.data.type === 'PLAYER_READY') sentIds = {}; });

    // Live keyboard: digit → pad with that key; backslash → panic. (Skips when typing.)
    document.addEventListener('keydown', e => {
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '\\') { panic(); return; }
      if (/^[0-9]$/.test(e.key)) { const pad = cfg.pads.find(p => String(p.key) === e.key); if (pad) { e.preventDefault(); trigger(pad); } }
    });
  }

  function buildOutputRow(el) {
    el.innerHTML = 'Saída: <label><input type="radio" name="sb-o" value="local"> Máquina do mestre</label>' +
      '<label><input type="radio" name="sb-o" value="projection"> Tela da mesa (projeção)</label>';
    el.querySelectorAll('input[name="sb-o"]').forEach(r => {
      r.checked = (r.value === cfg.output);
      r.onchange = () => { if (!r.checked) return; engPanic(); if (typeof playerWindow !== 'undefined' && playerWindow && !playerWindow.closed) postCmd('panic', null); cfg.output = r.value; currentAmbient = null; applyMasterOut(); saveCfg(); render(); };
    });
  }

  function setSetup(on) { cfg.setup = !!on; saveCfg(); render(); }

  function renderHeader() {
    if (!panel) return;
    panel.querySelector('#sb-live').classList.toggle('on', !cfg.setup);
    panel.querySelector('#sb-setup').classList.toggle('on', cfg.setup);
    panel.querySelector('#sb-mute').textContent = cfg.muted ? '🔇' : '🔈';
    panel.querySelector('#sb-mute').classList.toggle('on', cfg.muted);
  }

  function renderTabs() {
    tabsEl.innerHTML = '';
    for (const c of cfg.categories) {
      const b = document.createElement('button'); b.className = 'sb-tab' + (c === cfg.activeCat ? ' on' : ''); b.textContent = c;
      b.onclick = () => { cfg.activeCat = c; saveCfg(); render(); };
      tabsEl.appendChild(b);
    }
  }

  function render() {
    if (!panel) return;
    renderHeader();
    renderTabs();
    panel.querySelector('#sb-import').hidden = !cfg.setup;
    panel.classList.toggle('is-setup', cfg.setup);
    grid.innerHTML = '';
    const pads = cfg.pads.filter(p => p.cat === cfg.activeCat);
    if (!pads.length) { grid.innerHTML = '<div class="sb-empty">' + (cfg.setup ? 'Sem pads aqui. Arraste uma pasta de sons acima.' : 'Sem sons nesta aba.') + '</div>'; return; }
    for (const p of pads) grid.appendChild(cfg.setup ? padSetupCard(p) : padLiveButton(p));
    if (currentAmbient) ensureRAF();
  }

  function padLiveButton(p) {
    const b = document.createElement('button');
    b.className = 'sb-pad' + (p.type === 'ambient' ? ' amb' : ' one') + (currentAmbient === p.id ? ' lit' : '');
    b.dataset.id = p.id;
    b.style.setProperty('--pc', p.color || '#7c5cff');
    b.innerHTML = '<span class="sb-ic">' + (p.type === 'ambient' ? '∿' : '●') + '</span>' +
      '<span class="sb-nm">' + esc(p.name) + '</span>' +
      (p.key ? '<span class="sb-key">' + esc(String(p.key)) + '</span>' : '') +
      (p.type === 'ambient' ? '<span class="sb-prog"><i></i></span>' : '');
    b.onclick = () => trigger(p);
    return b;
  }

  function padSetupCard(p) {
    const card = document.createElement('div'); card.className = 'sb-card'; card.style.setProperty('--pc', p.color || '#7c5cff');
    const bind = (key, node, ev) => { node.addEventListener(ev || 'input', () => { p[key] = (node.type === 'checkbox') ? node.checked : (node.type === 'range' ? (node.value / 100) : node.value); saveCfg(); if (key === 'color') card.style.setProperty('--pc', p.color); }); };
    const nm = inp('text', p.name, 'Nome'); nm.maxLength = 40; bind('name', nm);
    const type = sel([['oneshot', 'One-shot'], ['ambient', 'Ambiente']], p.type); bind('type', type, 'change');
    const cat = sel(cfg.categories.map(c => [c, c]), p.cat); cat.addEventListener('change', () => { p.cat = cat.value; saveCfg(); render(); });
    const color = inp('color', p.color || '#7c5cff'); color.className = 'sb-c'; bind('color', color);
    const key = sel([['', '—']].concat('0123456789'.split('').map(d => [d, d])), p.key || ''); key.className = 'sb-k'; key.title = 'Atalho numérico'; bind('key', key, 'change');
    const vol = inp('range', Math.round((p.volume != null ? p.volume : 0.9) * 100)); vol.min = 0; vol.max = 100; vol.className = 'sb-v'; vol.title = 'Volume do pad'; bind('volume', vol);
    const loopWrap = document.createElement('label'); loopWrap.className = 'sb-loop'; const loop = inp('checkbox'); loop.checked = p.loop !== false; bind('loop', loop, 'change'); loopWrap.appendChild(loop); loopWrap.appendChild(document.createTextNode(' loop'));
    const del = document.createElement('button'); del.className = 'sb-del'; del.textContent = '🗑'; del.title = 'Apagar pad'; del.onclick = () => deletePad(p.id);
    const l1 = row([nm, del]); const l2 = row([type, cat]); const l3 = row([color, key, loopWrap]); const l4 = row([document.createTextNode('vol'), vol]);
    card.appendChild(l1); card.appendChild(l2); card.appendChild(l3); card.appendChild(l4);
    return card;
  }

  function inp(type, val, ph) { const e = document.createElement('input'); e.type = type; if (val != null) e.value = val; if (ph) e.placeholder = ph; return e; }
  function sel(opts, val) { const s = document.createElement('select'); for (const [v, t] of opts) { const o = document.createElement('option'); o.value = v; o.textContent = t; if (v === val) o.selected = true; s.appendChild(o); } return s; }
  function row(nodes) { const d = document.createElement('div'); d.className = 'sb-row'; nodes.forEach(n => d.appendChild(n)); return d; }
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  function injectStyle() {
    const css = `
      #sb-anchor { position: fixed; left: 12px; bottom: 64px; z-index: 210; zoom: var(--ui-zoom, 1.2); font: 13px system-ui, "Segoe UI", sans-serif; }
      #sb-toggle { background: var(--surface); border: 1px solid var(--border); color: var(--text); border-radius: 10px; padding: 7px 13px; cursor: pointer; font-weight: 600; box-shadow: 0 4px 16px rgba(0,0,0,0.4); }
      #sb-toggle:hover { border-color: var(--accent); color: var(--accent); }
      #sb-panel { position: absolute; left: 0; bottom: 46px; width: 400px; max-height: 56vh; display: flex; flex-direction: column;
        background: var(--surface); border: 1px solid var(--border); border-radius: 14px; box-shadow: 0 12px 40px rgba(0,0,0,0.55); overflow: hidden; }
      #sb-panel[hidden] { display: none; }
      #sb-panel .sb-hdr { display: flex; align-items: center; gap: 8px; padding: 9px 11px; border-bottom: 1px solid var(--border); }
      .sb-mode { display: flex; gap: 4px; }
      .sb-mode button { background: var(--surface-2); border: 1px solid var(--border); color: var(--muted); border-radius: 7px; padding: 4px 9px; cursor: pointer; font-weight: 600; }
      .sb-mode button.on { color: var(--text); border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
      #sb-panel .sb-sp { flex: 1; }
      .sb-vol { display: flex; align-items: center; gap: 4px; color: var(--muted); } .sb-vol input { width: 74px; }
      #sb-mute, #sb-panic, #sb-close { background: var(--surface-2); border: 1px solid var(--border); color: var(--text); border-radius: 7px; padding: 4px 8px; cursor: pointer; }
      #sb-mute.on { color: #e0c34e; border-color: #e0c34e; }
      #sb-panic { color: #e0564e; border-color: rgba(224,86,78,0.5); font-weight: 700; }
      #sb-panic:hover { background: rgba(224,86,78,0.18); }
      #sb-close:hover, #sb-mute:hover { border-color: var(--accent); color: var(--accent); }
      .sb-out { display: none; gap: 12px; align-items: center; padding: 7px 11px; border-bottom: 1px solid var(--border); color: var(--muted); font-size: 12px; }
      #sb-panel.is-setup .sb-out { display: flex; }
      .sb-out label { color: var(--text); cursor: pointer; }
      .sb-tabs { display: flex; gap: 5px; flex-wrap: wrap; padding: 8px 11px; border-bottom: 1px solid var(--border); }
      .sb-tab { background: var(--surface-2); border: 1px solid var(--border); color: var(--muted); border-radius: 7px; padding: 4px 10px; cursor: pointer; font-weight: 600; }
      .sb-tab.on { color: var(--text); border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
      .sb-import { padding: 9px 11px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px; }
      .sb-import[hidden] { display: none; }
      .sb-drop { border: 1px dashed var(--border); border-radius: 9px; padding: 12px; text-align: center; color: var(--muted); font-size: 12px; }
      .sb-drop.over { border-color: var(--accent); color: var(--accent); background: rgba(200,162,74,0.08); }
      .sb-imp-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .sb-import button { background: var(--surface-2); border: 1px solid var(--border); color: var(--text); border-radius: 7px; padding: 4px 10px; cursor: pointer; }
      .sb-import button:hover { border-color: var(--accent); color: var(--accent); }
      .sb-xf { color: var(--muted); font-size: 12px; display: flex; align-items: center; gap: 5px; } .sb-xf input { width: 90px; }
      .sb-newcat { display: flex; gap: 6px; } .sb-newcat input { flex: 1; }
      .sb-import input[type=text] { background: var(--surface-2); border: 1px solid var(--border); color: var(--text); border-radius: 6px; padding: 5px 7px; }
      .sb-grid { padding: 10px 11px; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; scrollbar-width: thin; scrollbar-color: var(--surface-2) transparent; }
      #sb-panel.is-setup .sb-grid { grid-template-columns: 1fr; }
      .sb-grid::-webkit-scrollbar { width: 10px; } .sb-grid::-webkit-scrollbar-thumb { background: var(--surface-2); border: 2px solid var(--surface); border-radius: 8px; }
      .sb-empty { color: var(--muted); font-size: 12px; grid-column: 1/-1; padding: 6px 2px; }
      .sb-pad { position: relative; display: flex; flex-direction: column; align-items: center; gap: 3px; min-height: 62px; justify-content: center;
        background: var(--surface-2); border: 1px solid var(--border); border-left: 3px solid var(--pc); border-radius: 10px; padding: 8px 6px; cursor: pointer; color: var(--text); overflow: hidden; }
      .sb-pad:hover { border-color: var(--pc); }
      .sb-pad .sb-ic { font-size: 15px; color: var(--pc); line-height: 1; }
      .sb-pad .sb-nm { font-size: 11px; text-align: center; line-height: 1.15; max-height: 2.4em; overflow: hidden; }
      .sb-pad .sb-key { position: absolute; top: 3px; right: 5px; font-size: 10px; color: var(--muted); border: 1px solid var(--border); border-radius: 4px; padding: 0 3px; }
      .sb-pad.lit { box-shadow: 0 0 0 2px var(--pc), 0 0 16px -2px var(--pc); background: color-mix(in srgb, var(--pc) 22%, var(--surface-2)); animation: sb-pulse 1.8s ease-in-out infinite; }
      @keyframes sb-pulse { 0%,100% { box-shadow: 0 0 0 2px var(--pc), 0 0 10px -3px var(--pc); } 50% { box-shadow: 0 0 0 2px var(--pc), 0 0 22px 0 var(--pc); } }
      .sb-pad.flash { animation: sb-flash 0.5s ease-out; }
      @keyframes sb-flash { 0% { background: var(--pc); } 100% { background: var(--surface-2); } }
      .sb-prog { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: rgba(255,255,255,0.08); }
      .sb-prog i { display: block; height: 100%; width: 0; background: var(--pc); }
      .sb-card { background: var(--surface-2); border: 1px solid var(--border); border-left: 3px solid var(--pc); border-radius: 10px; padding: 8px; }
      .sb-card .sb-row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
      .sb-card .sb-row:last-child { margin-bottom: 0; }
      .sb-card input[type=text] { flex: 1; min-width: 0; }
      .sb-card input, .sb-card select { background: var(--bg); border: 1px solid var(--border); color: var(--text); border-radius: 6px; padding: 5px 7px; font: inherit; }
      .sb-card select { flex: 1; }
      .sb-card .sb-c { width: 34px; padding: 2px; } .sb-card .sb-k { flex: 0 0 54px; } .sb-card .sb-v { flex: 1; }
      .sb-card .sb-loop { color: var(--muted); font-size: 12px; display: flex; align-items: center; gap: 3px; white-space: nowrap; }
      .sb-card .sb-del { margin-left: auto; background: none; border: none; color: var(--muted); cursor: pointer; font-size: 13px; }
      .sb-card .sb-del:hover { color: #e0564e; }
    `;
    const style = document.createElement('style'); style.id = 'sb-style'; style.textContent = css; document.head.appendChild(style);
  }

  // ── Profile export/import hooks (used by backup.js) ───────────────────────────
  window.sbGetProfile = async function () {
    const sounds = [], seen = {};
    for (const p of cfg.pads) {
      if (!p.fileId || seen[p.fileId]) continue; seen[p.fileId] = true;
      try { const blob = await idbGet(p.fileId); if (blob) sounds.push({ fileId: p.fileId, ext: p.fmt || 'mp3', buffer: await blob.arrayBuffer() }); } catch (e) {}
    }
    return { config: { master: cfg.master, muted: cfg.muted, crossfadeMs: cfg.crossfadeMs, categories: cfg.categories, pads: cfg.pads }, sounds };
  };
  window.sbAddProfile = async function (config, sounds) {
    if (Array.isArray(sounds)) for (const s of sounds) { try { await idbPut(s.fileId, new Blob([s.buffer], { type: 'audio/' + (s.ext || 'mpeg') })); } catch (e) {} }
    if (config) {
      if (Array.isArray(config.categories)) for (const c of config.categories) if (cfg.categories.indexOf(c) === -1) cfg.categories.push(c);
      if (Array.isArray(config.pads)) for (const p of config.pads) if (!cfg.pads.some(x => x.id === p.id)) cfg.pads.push(p);
      saveCfg(); render();
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
