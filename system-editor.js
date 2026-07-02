// system-editor.js — visual editor to create/edit/share game systems (PresenceVTT addition).
//
// Part of PresenceVTT, a fork of Evermist (MIT, Copyright (c) 2026 Hinnful).
//
// No-code editor so the community can build a system (conditions → token menu, ranges → range
// bands, counters → trackers, notes → reference) and SHARE it via export/import JSON. Custom
// systems live in localStorage (see systems.js) and appear in the Rules-tab system picker next
// to the built-ins. PURE data authoring — nothing here rolls or applies a rule. DM-only:
// inert on the projection (?mode=player). Loaded after rules.js. Plain <script>, no ES modules.

(function () {
  if (new URLSearchParams(location.search).get('mode') === 'player') return;

  let modal, body, io, ioText, ioTitle, ioDo, deleteBtn;
  let draft = null;      // { name, counters:[{name}], conditions:[...], ranges:[...], notes:[...] }
  let editingId = null;  // id of the custom system being edited in place, or null for a new one

  function clone(o) { try { return JSON.parse(JSON.stringify(o)); } catch (e) { return {}; } }

  // mode: 'edit' (custom → in place; preset → becomes a copy on save) | 'clone' | 'blank'
  function openSystemEditor(baseId, mode) {
    injectStyle(); ensureModal();
    if (mode === 'blank') {
      draft = { name: 'Meu sistema', counters: [{ name: 'Contador' }], conditions: [], ranges: [], notes: [] };
      editingId = null;
    } else {
      const src = (typeof GAME_SYSTEMS !== 'undefined' && GAME_SYSTEMS[baseId]) ? GAME_SYSTEMS[baseId] : null;
      draft = src ? clone(typeof stripSystem === 'function' ? stripSystem(src) : src)
                  : { name: 'Meu sistema', counters: [], conditions: [], ranges: [], notes: [] };
      const custom = (typeof isCustomSystem === 'function' && isCustomSystem(baseId));
      if (mode === 'clone' || !custom) { editingId = null; draft.name = (draft.name || 'Sistema') + ' (cópia)'; }
      else { editingId = baseId; }
    }
    hideIO();
    renderEditor();
    modal.style.display = 'flex';
  }
  window.openSystemEditor = openSystemEditor;
  function closeEditor() { if (modal) modal.style.display = 'none'; }

  function ensureModal() {
    if (modal) return;
    modal = document.createElement('div');
    modal.id = 'sysed-backdrop';
    modal.innerHTML =
      '<div id="sysed">' +
        '<div class="se-hdr"><h3>Editor de sistema</h3><button class="se-x" id="se-close" title="Fechar">✕</button></div>' +
        '<div class="se-body" id="se-body"></div>' +
        '<div class="se-io" id="se-io" hidden>' +
          '<div class="se-io-title" id="se-io-title"></div>' +
          '<textarea id="se-io-text" spellcheck="false" placeholder="Cole aqui o JSON de um sistema…"></textarea>' +
          '<div class="se-io-btns"><button id="se-io-do" class="se-primary"></button><button id="se-io-download">⬇ Baixar .json</button><button id="se-io-cancel">Fechar</button></div>' +
        '</div>' +
        '<div class="se-ftr">' +
          '<button id="se-blank">＋ Em branco</button>' +
          '<button id="se-export">⬆ Exportar</button>' +
          '<button id="se-import">⬇ Importar</button>' +
          '<span class="se-spacer"></span>' +
          '<button id="se-delete" class="se-danger">🗑 Excluir</button>' +
          '<button id="se-save" class="se-primary">Salvar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    body = modal.querySelector('#se-body');
    io = modal.querySelector('#se-io');
    ioText = modal.querySelector('#se-io-text');
    ioTitle = modal.querySelector('#se-io-title');
    ioDo = modal.querySelector('#se-io-do');
    deleteBtn = modal.querySelector('#se-delete');
    modal.addEventListener('mousedown', e => { if (e.target === modal) closeEditor(); });
    modal.querySelector('#se-close').onclick = closeEditor;
    modal.querySelector('#se-save').onclick = onSave;
    deleteBtn.onclick = onDelete;
    modal.querySelector('#se-export').onclick = showExport;
    modal.querySelector('#se-import').onclick = showImport;
    modal.querySelector('#se-blank').onclick = () => openSystemEditor(null, 'blank');
    modal.querySelector('#se-io-cancel').onclick = hideIO;
    modal.querySelector('#se-io-download').onclick = downloadDraft;
  }

  // ── Render the form from `draft` ──────────────────────────────────────────────
  function el(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function bindInput(obj, key, opts) {
    opts = opts || {};
    const e = document.createElement(opts.textarea ? 'textarea' : 'input');
    if (!opts.textarea) e.type = opts.type || 'text';
    if (opts.ph) e.placeholder = opts.ph;
    if (opts.title) e.title = opts.title;
    if (opts.cls) e.className = opts.cls;
    if (opts.max) e.maxLength = opts.max;
    e.value = (obj[key] != null ? obj[key] : '');
    e.oninput = () => { obj[key] = e.value; };
    return e;
  }
  function delBtn(fn) { const b = el('button', 'se-del', '🗑'); b.title = 'Remover'; b.onclick = fn; return b; }
  function sel(opts, val) {
    const s = document.createElement('select');
    for (const o of opts) { const opt = document.createElement('option'); opt.value = o[0]; opt.textContent = o[1]; if (o[0] === val) opt.selected = true; s.appendChild(opt); }
    return s;
  }

  function section(title, addLabel, onAdd) {
    const wrap = el('div', 'se-sec');
    const hd = el('div', 'se-sec-hd');
    hd.appendChild(el('span', 'se-sec-t', title));
    const add = el('button', 'se-add', addLabel || '＋ adicionar'); add.onclick = onAdd;
    hd.appendChild(add);
    wrap.appendChild(hd);
    return wrap;
  }

  function renderEditor() {
    body.innerHTML = '';

    // Name
    const nameRow = el('div', 'se-name');
    nameRow.appendChild(el('label', null, 'Nome do sistema'));
    nameRow.appendChild(bindInput(draft, 'name', { ph: 'ex.: Tormenta 20', max: 40, cls: 'se-name-input' }));
    body.appendChild(nameRow);
    const hint = el('div', 'se-hint', editingId ? 'Editando um sistema seu — Salvar atualiza no lugar.'
      : 'Salvar cria um sistema novo (presets nunca são sobrescritos).');
    body.appendChild(hint);

    // Conditions → token menu
    const cs = section('Condições (menu do token)', '＋ condição', () => { draft.conditions.push({ glyph: '●', name: '', color: '#c8a24a', text: '', details: '' }); renderEditor(); });
    draft.conditions.forEach((c) => {
      const card = el('div', 'se-card');
      const top = el('div', 'se-line');
      top.appendChild(bindInput(c, 'glyph', { ph: '●', max: 4, cls: 'se-glyph', title: 'Emoji/ícone' }));
      top.appendChild(bindInput(c, 'name', { ph: 'Nome', max: 40, cls: 'se-grow' }));
      top.appendChild(bindInput(c, 'color', { type: 'color', cls: 'se-color', title: 'Cor' }));
      top.appendChild(delBtn(() => { draft.conditions.splice(draft.conditions.indexOf(c), 1); renderEditor(); }));
      card.appendChild(top);
      card.appendChild(bindInput(c, 'text', { ph: 'Resumo (1 linha)', max: 160, cls: 'se-full' }));
      card.appendChild(bindInput(c, 'details', { ph: 'Detalhe completo (aparece ao clicar na referência)', textarea: true, max: 1200, cls: 'se-full se-area' }));
      cs.appendChild(card);
    });
    body.appendChild(cs);

    // Ranges → range bands
    const rs = section('Bandas de range (células)', '＋ range', () => { draft.ranges.push({ name: '', cells: 1, color: '#c8a24a', text: '', details: '' }); renderEditor(); });
    draft.ranges.forEach((r) => {
      const card = el('div', 'se-card');
      const top = el('div', 'se-line');
      top.appendChild(bindInput(r, 'name', { ph: 'Nome', max: 40, cls: 'se-grow' }));
      const cells = bindInput(r, 'cells', { type: 'number', cls: 'se-cells', title: 'Distância em células' }); cells.min = 1; cells.max = 200;
      top.appendChild(cells);
      top.appendChild(el('span', 'se-unit', 'cél.'));
      top.appendChild(bindInput(r, 'color', { type: 'color', cls: 'se-color', title: 'Cor' }));
      top.appendChild(delBtn(() => { draft.ranges.splice(draft.ranges.indexOf(r), 1); renderEditor(); }));
      card.appendChild(top);
      card.appendChild(bindInput(r, 'text', { ph: 'Resumo (1 linha)', max: 160, cls: 'se-full' }));
      card.appendChild(bindInput(r, 'details', { ph: 'Detalhe completo', textarea: true, max: 1200, cls: 'se-full se-area' }));
      rs.appendChild(card);
    });
    body.appendChild(rs);

    // Counters → trackers
    const ns = section('Contadores (trackers)', '＋ contador', () => { draft.counters.push({ name: 'Contador' }); renderEditor(); });
    draft.counters.forEach((c) => {
      const line = el('div', 'se-line');
      line.appendChild(bindInput(c, 'name', { ph: 'ex.: Fear', max: 24, cls: 'se-grow' }));
      line.appendChild(delBtn(() => { draft.counters.splice(draft.counters.indexOf(c), 1); renderEditor(); }));
      ns.appendChild(line);
    });
    body.appendChild(ns);

    // Notes → reference
    const ms = section('Referência (regras/notas)', '＋ nota', () => { draft.notes.push({ icon: '', cat: 'Regra', name: '', text: '', details: '' }); renderEditor(); });
    draft.notes.forEach((n) => {
      const card = el('div', 'se-card');
      const top = el('div', 'se-line');
      top.appendChild(bindInput(n, 'icon', { ph: '🔖', max: 4, cls: 'se-glyph', title: 'Ícone/emoji (opcional)' }));
      top.appendChild(bindInput(n, 'cat', { ph: 'Categoria', max: 20, cls: 'se-cat' }));
      top.appendChild(bindInput(n, 'name', { ph: 'Título', max: 60, cls: 'se-grow' }));
      top.appendChild(delBtn(() => { draft.notes.splice(draft.notes.indexOf(n), 1); renderEditor(); }));
      card.appendChild(top);
      card.appendChild(bindInput(n, 'text', { ph: 'Resumo (1 linha)', max: 160, cls: 'se-full' }));
      card.appendChild(bindInput(n, 'details', { ph: 'Detalhe completo', textarea: true, max: 1200, cls: 'se-full se-area' }));
      ms.appendChild(card);
    });
    body.appendChild(ms);

    // Trackers — style of the adversary-HP tracker for this system.
    if (!draft.trackers) draft.trackers = { foes: { style: 'clock', size: 8, max: 20 } };
    if (!draft.trackers.foes) draft.trackers.foes = { style: 'clock', size: 8, max: 20 };
    const ts = section('Trackers', '', null);
    ts.querySelector('.se-add').style.display = 'none';
    const tcard = el('div', 'se-card');
    const trow = el('div', 'se-line');
    const tlbl = el('span', null, 'Vida de adversário'); tlbl.style.cssText = 'flex:1;color:var(--muted);font-size:12px;';
    trow.appendChild(tlbl);
    const styleSel = sel([['clock', '◍ Pontinhos'], ['hp', '▸ Número x/x']], draft.trackers.foes.style);
    styleSel.style.flex = '0 0 130px';
    styleSel.addEventListener('change', () => { draft.trackers.foes.style = styleSel.value; });
    trow.appendChild(styleSel);
    tcard.appendChild(trow);
    ts.appendChild(tcard);
    body.appendChild(ts);

    deleteBtn.style.display = editingId ? '' : 'none';
  }

  // ── Save / delete ─────────────────────────────────────────────────────────────
  function onSave() {
    if (!draft.name || !draft.name.trim()) { flashName(); return; }
    if (typeof saveCustomSystem !== 'function') return;
    const id = saveCustomSystem(draft, editingId);
    editingId = id;
    if (typeof applyGameSystem === 'function') applyGameSystem(id); // repoints globals + refreshes token/reference/counter menus
    closeEditor();
  }
  function onDelete() {
    if (!editingId || typeof deleteCustomSystem !== 'function') return;
    const wasActive = (typeof activeSystemId !== 'undefined' && activeSystemId === editingId);
    deleteCustomSystem(editingId);
    if (wasActive && typeof applyGameSystem === 'function') applyGameSystem('daggerheart');
    else if (typeof window.rulesOnSystemChanged === 'function') window.rulesOnSystemChanged();
    closeEditor();
  }
  function flashName() {
    const i = body.querySelector('.se-name-input');
    if (i) { i.focus(); i.style.borderColor = '#e0564e'; setTimeout(() => { i.style.borderColor = ''; }, 900); }
  }

  // ── Export / import (share) ───────────────────────────────────────────────────
  function draftJSON() { return JSON.stringify({ name: draft.name, counters: draft.counters, conditions: draft.conditions, ranges: draft.ranges, notes: draft.notes }, null, 2); }
  function hideIO() { if (io) io.hidden = true; }
  function showExport() {
    ioTitle.textContent = 'Copie este JSON (ou baixe) e compartilhe:';
    ioText.value = draftJSON();
    ioText.readOnly = true;
    ioDo.textContent = '⧉ Copiar';
    ioDo.onclick = copyIO;
    modal.querySelector('#se-io-download').style.display = '';
    io.hidden = false;
    ioText.focus(); ioText.select();
  }
  function showImport() {
    ioTitle.textContent = 'Cole o JSON de um sistema e clique Importar:';
    ioText.value = '';
    ioText.readOnly = false;
    ioDo.textContent = '⬇ Importar';
    ioDo.onclick = doImport;
    modal.querySelector('#se-io-download').style.display = 'none';
    io.hidden = false;
    ioText.focus();
  }
  function copyIO() {
    ioText.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    if (!ok && navigator.clipboard) { navigator.clipboard.writeText(ioText.value).catch(() => {}); }
    ioTitle.textContent = 'Copiado! Cole onde quiser compartilhar.';
  }
  function doImport() {
    let obj;
    try { obj = JSON.parse(ioText.value); }
    catch (e) { ioTitle.textContent = '⚠ JSON inválido — confira o texto colado.'; return; }
    if (!obj || typeof obj !== 'object' || !obj.name) { ioTitle.textContent = '⚠ JSON sem "name" — não parece um sistema.'; return; }
    draft = { name: obj.name, counters: obj.counters || [], conditions: obj.conditions || [], ranges: obj.ranges || [], notes: obj.notes || [] };
    editingId = null; // imported = a new system for this table
    hideIO();
    renderEditor();
  }
  function downloadDraft() {
    try {
      const blob = new Blob([draftJSON()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (draft.name || 'sistema').replace(/[^a-z0-9\-_ ]/gi, '').trim().replace(/\s+/g, '-').toLowerCase() + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (e) { ioTitle.textContent = '⚠ Não foi possível baixar — use Copiar.'; }
  }

  // ── Styles ────────────────────────────────────────────────────────────────────
  function injectStyle() {
    if (document.getElementById('sysed-style')) return;
    const css = `
      #sysed-backdrop { position: fixed; inset: 0; z-index: 14000; display: none; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.55); backdrop-filter: blur(2px); }
      #sysed { width: min(520px, 92vw); max-height: 88vh; display: flex; flex-direction: column;
        background: var(--surface); border: 1px solid var(--border); border-radius: 14px; box-shadow: 0 20px 60px rgba(0,0,0,0.6);
        font: 13px system-ui, "Segoe UI", sans-serif; color: var(--text); }
      #sysed .se-hdr { display: flex; align-items: center; padding: 12px 14px; border-bottom: 1px solid var(--border); }
      #sysed .se-hdr h3 { margin: 0; font: 600 15px "Cinzel", Georgia, serif; color: var(--accent); flex: 1; }
      #sysed .se-x { background: none; border: none; color: var(--muted); font-size: 16px; cursor: pointer; }
      #sysed .se-x:hover { color: var(--text); }
      #sysed .se-body { padding: 12px 14px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--surface-2) transparent; }
      #sysed .se-body::-webkit-scrollbar { width: 10px; }
      #sysed .se-body::-webkit-scrollbar-thumb { background: var(--surface-2); border: 2px solid var(--surface); border-radius: 8px; }
      #sysed .se-name { display: flex; flex-direction: column; gap: 4px; }
      #sysed .se-name label { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
      #sysed .se-hint { color: var(--muted); font-size: 11px; margin: 6px 0 12px; }
      #sysed .se-sec { margin-bottom: 14px; }
      #sysed .se-sec-hd { display: flex; align-items: center; margin-bottom: 7px; }
      #sysed .se-sec-t { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); flex: 1; }
      #sysed .se-add { background: var(--surface-2); border: 1px dashed var(--border); color: var(--muted); border-radius: 7px; padding: 3px 9px; cursor: pointer; font-size: 11px; }
      #sysed .se-add:hover { border-color: var(--accent); color: var(--accent); }
      #sysed .se-card { background: var(--surface-2); border: 1px solid var(--border); border-radius: 9px; padding: 8px; margin-bottom: 8px; }
      #sysed .se-line { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
      #sysed .se-line:last-child { margin-bottom: 0; }
      #sysed input, #sysed textarea { background: var(--bg); border: 1px solid var(--border); color: var(--text); border-radius: 6px; padding: 6px 8px; font: inherit; }
      #sysed input:focus, #sysed textarea:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
      #sysed .se-name-input { width: 100%; box-sizing: border-box; }
      #sysed .se-grow { flex: 1; min-width: 0; }
      #sysed .se-glyph { width: 44px; text-align: center; }
      #sysed .se-cat { width: 92px; }
      #sysed .se-cells { width: 62px; }
      #sysed .se-unit { color: var(--muted); font-size: 11px; }
      #sysed .se-color { width: 34px; height: 30px; padding: 2px; }
      #sysed .se-full { width: 100%; box-sizing: border-box; margin-bottom: 6px; }
      #sysed .se-area { min-height: 46px; resize: vertical; line-height: 1.4; margin-bottom: 0; }
      #sysed .se-del { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 13px; padding: 4px; }
      #sysed .se-del:hover { color: #e0564e; }
      #sysed .se-ftr { display: flex; align-items: center; gap: 8px; padding: 11px 14px; border-top: 1px solid var(--border); flex-wrap: wrap; }
      #sysed .se-ftr .se-spacer { flex: 1; }
      #sysed .se-ftr button { background: var(--surface-2); border: 1px solid var(--border); color: var(--text); border-radius: 8px; padding: 6px 12px; cursor: pointer; font-weight: 600; }
      #sysed .se-ftr button:hover { border-color: var(--accent); color: var(--accent); }
      #sysed .se-primary { background: var(--accent) !important; color: var(--bg) !important; border-color: var(--accent) !important; }
      #sysed .se-primary:hover { filter: brightness(1.08); }
      #sysed .se-danger:hover { border-color: #e0564e !important; color: #e0564e !important; }
      #sysed .se-io { padding: 10px 14px; border-top: 1px solid var(--border); background: var(--surface-2); }
      #sysed .se-io-title { font-size: 12px; color: var(--muted); margin-bottom: 6px; }
      #sysed .se-io textarea { width: 100%; box-sizing: border-box; height: 150px; resize: vertical; font-family: ui-monospace, Consolas, monospace; font-size: 11px; }
      #sysed .se-io-btns { display: flex; gap: 8px; margin-top: 8px; }
      #sysed .se-io-btns button { background: var(--surface); border: 1px solid var(--border); color: var(--text); border-radius: 7px; padding: 5px 11px; cursor: pointer; }
      #sysed .se-io-btns button:hover { border-color: var(--accent); color: var(--accent); }
      #sysed .se-io-btns .se-primary { background: var(--accent); color: var(--bg); border-color: var(--accent); }
    `;
    const style = document.createElement('style');
    style.id = 'sysed-style';
    style.textContent = css;
    document.head.appendChild(style);
  }
})();
