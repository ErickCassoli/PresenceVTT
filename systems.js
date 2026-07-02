// systems.js — swappable GAME SYSTEMS: conditions, ranges, reference, counters (PresenceVTT).
//
// Part of PresenceVTT, a fork of Evermist (MIT, Copyright (c) 2026 Hinnful).
//
// The app is system-agnostic: pick a system and it drives the token CONDITIONS, the token
// RANGE_BANDS, the searchable reference (RULES_INDEX) and the Rules-tab counters. PURE DATA
// + a tiny apply function — nothing here rolls, applies or calculates anything (that stays
// the table's job). Loaded BEFORE conditions.js so the globals exist when everything else
// initialises. Plain <script>, no ES modules.
//
// Reference texts are ORIGINAL paraphrases in Portuguese written to jog the DM's memory —
// not reproductions of any book. D&D leans on the open 5e SRD (CC-BY); Daggerheart leans on
// the Darrington Press SRD; Ordem Paranormal is © Jambô, so that preset stays short. `text`
// is the one-line gist (collapsed); `details` is the fuller reminder shown when you tap a card.
// Edit any of it to match your table.

// ── Active-system globals (mutated by applyGameSystem; read everywhere else) ─────
let CONDITIONS   = [];   // [{ id, name, glyph, color, text, details }]
let RANGE_BANDS  = [];   // [{ id, name, cells, color, text, details }]
let RULES_INDEX  = [];   // flattened, category-tagged reference for the search box
let activeSystemId = 'daggerheart';

// ── System presets ───────────────────────────────────────────────────────────────
const GAME_SYSTEMS = {
  daggerheart: {
    id: 'daggerheart', name: 'Daggerheart',
    counters: [{ name: 'Fear' }],
    trackers: { foes: { style: 'clock', size: 8 } }, // vida de adversário = relógio de pontos

    conditions: [
      { id: 'restrained', name: 'Contido',    glyph: '🕸', color: '#c8a24a',
        text: 'Não sai do lugar, mas ainda age.',
        details: 'A criatura não consegue se deslocar da posição atual, mas continua agindo normalmente — pode atacar, usar habilidades e reagir. Sai da condição quando algo na ficção a liberta (um aliado corta as amarras, ela se solta, etc.).' },
      { id: 'vulnerable', name: 'Vulnerável', glyph: '🎯', color: '#e0564e',
        text: 'Rolagens contra ela têm vantagem.',
        details: 'Enquanto vulnerável, TODA rolagem feita contra a criatura é feita com vantagem. É a condição que você quer impor antes de um golpe importante — costuma vir de manobras, cercos ou efeitos que deixam o alvo exposto.' },
      { id: 'hidden', name: 'Oculto', glyph: '🌫', color: '#8b95a7',
        text: 'Rolagens contra você têm desvantagem.',
        details: 'Enquanto estiver fora da linha de visão dos inimigos e em silêncio, rolagens contra você são feitas com desvantagem. A condição termina assim que você age abertamente, ataca, é revelado ou entra claramente no campo de visão.' },
      { id: 'burning', name: 'Em chamas', glyph: '🔥', color: '#e0763a',
        text: '[Marcador da mesa] Está queimando.',
        details: 'Marcador da mesa (não é condição oficial): use como lembrete de que a criatura está pegando fogo. Narre o dano contínuo e a chance de apagar as chamas quando fizer sentido — sem cálculo automático.' },
      { id: 'poisoned', name: 'Envenenado', glyph: '🧪', color: '#5ec46a',
        text: '[Marcador da mesa] Sob veneno.',
        details: 'Marcador da mesa. Lembrete de que a criatura está envenenada; decida os efeitos narrativos/mecânicos na hora conforme sua mesa.' },
      { id: 'stunned', name: 'Atordoado', glyph: '💫', color: '#e0c34e',
        text: '[Marcador da mesa] Atordoado.',
        details: 'Marcador da mesa. A criatura está desorientada/atordoada — o mestre narra a limitação temporária.' },
      { id: 'marked', name: 'Marcado', glyph: '❗', color: '#7c5cff',
        text: '[Marcador da mesa] Alvo em foco.',
        details: 'Marcador da mesa. Destaca um alvo para a atenção do grupo (foco de ataques, objetivo da cena, etc.).' },
    ],
    ranges: [
      { id: 'melee',     name: 'Corpo a corpo', cells: 1,  color: '#e0564e',
        text: 'Toque / arma corporal.', details: 'Praticamente na mesma célula: ataques desarmados, armas corporais e agarrões acontecem aqui.' },
      { id: 'veryclose', name: 'Muito Perto',   cells: 3,  color: '#e0954e',
        text: 'Poucos passos.', details: 'Um deslocamento curto alcança. Muitas habilidades de curto alcance operam nesta faixa.' },
      { id: 'close',     name: 'Perto',         cells: 6,  color: '#c8a24a',
        text: 'Mesma sala/área.', details: 'Alcançável com um movimento típico dentro da cena; boa parte das ações de alcance médio acontece aqui.' },
      { id: 'far',       name: 'Longe',         cells: 12, color: '#4ec9e0',
        text: 'Precisa de alcance/deslocamento.', details: 'Interagir exige arma de alcance, magia de longo alcance ou gastar movimento para chegar mais perto.' },
      { id: 'veryfar',   name: 'Muito Longe',   cells: 20, color: '#7c5cff',
        text: 'No limite da cena.', details: 'Praticamente o limite do que dá para afetar; em geral é preciso se aproximar antes de agir.' },
    ],
    notes: [
      { cat: 'Dano', name: 'Limiares de dano',
        text: 'Compare o dano com Maior e Severo.',
        details: 'Cada PJ tem dois limiares: Maior e Severo. Ao sofrer dano, compare o total contra eles para saber quantos pontos de vida marcar.' },
      { cat: 'Dano', name: 'Quanto marcar',
        text: 'Abaixo do Maior = 1 · Maior = 2 · Severo = 3.',
        details: 'Dano abaixo do limiar Maior → marca 1 PV. Dano igual/acima do Maior (e abaixo do Severo) → marca 2 PV. Dano igual/acima do Severo → marca 3 PV. Algumas mesas usam “dano massivo” (≥ dobro do Severo) → 4 PV.' },
      { cat: 'GM move', name: 'Rolou com Medo',
        text: 'Mestre age e ganha 1 Fear.',
        details: 'Quando uma rolagem de jogador sai com Medo (o dado de Medo vence), o spotlight pode voltar para o mestre: ele faz um movimento e ganha 1 Fear para gastar depois.' },
      { cat: 'GM move', name: 'Gastar Fear',
        text: 'Interromper, mover de novo, destacar inimigo.',
        details: 'Gaste Fear para interromper os PJs e tomar o spotlight, fazer um adversário agir mais de uma vez, ou ativar movimentos/efeitos mais fortes na cena.' },
      { cat: 'GM move', name: 'Movimento suave',
        text: 'Avance a ameaça sem dano direto.',
        details: 'Telegrafe o perigo, mude a cena, revele uma complicação, peça uma rolagem ou coloque os PJs numa posição difícil — sem causar dano imediato.' },
      { cat: 'GM move', name: 'Movimento duro',
        text: 'Consequência direta e concreta.',
        details: 'Cause dano, tire um recurso, separe o grupo, avance um relógio de perigo — uma consequência que os jogadores sentem na hora.' },
    ],
  },

  dnd5e: {
    id: 'dnd5e', name: 'D&D 5e',
    counters: [],
    trackers: { foes: { style: 'hp', max: 20 } }, // vida de adversário = número atual/máx

    conditions: [
      { id: 'blinded', name: 'Cego', glyph: '🕶', color: '#8b95a7',
        text: 'Não enxerga; ataques contra têm vantagem, os dela desvantagem.',
        details: 'Não enxerga e falha automaticamente em testes que dependam de visão. Jogadas de ataque contra a criatura têm vantagem, e as jogadas de ataque dela têm desvantagem.' },
      { id: 'charmed', name: 'Enfeitiçado', glyph: '💗', color: '#e05a9e',
        text: 'Não ataca quem a enfeitiçou.',
        details: 'Não pode atacar quem a enfeitiçou nem escolhê-lo como alvo de habilidade ou efeito mágico prejudicial. Quem a enfeitiçou tem vantagem em testes de habilidade para interagir socialmente com ela.' },
      { id: 'deafened', name: 'Surdo', glyph: '🔇', color: '#8b95a7',
        text: 'Não escuta.',
        details: 'Não consegue ouvir e falha automaticamente em qualquer teste de habilidade que dependa da audição.' },
      { id: 'frightened', name: 'Amedrontado', glyph: '😱', color: '#e0763a',
        text: 'Desvantagem enquanto vê a fonte; não se aproxima.',
        details: 'Tem desvantagem em testes de habilidade e jogadas de ataque enquanto a fonte do medo estiver na sua linha de visão. Além disso, não pode se mover voluntariamente para mais perto da fonte.' },
      { id: 'grappled', name: 'Agarrado', glyph: '✊', color: '#c8a24a',
        text: 'Deslocamento 0.',
        details: 'O deslocamento vira 0 e ela não se beneficia de bônus de deslocamento. Termina se o agarrador ficar incapacitado ou se algum efeito tirar a criatura do alcance do agarrador.' },
      { id: 'incapacitated', name: 'Incapacitado', glyph: '🚫', color: '#e0564e',
        text: 'Sem ações nem reações.',
        details: 'A criatura não pode realizar ações nem reações.' },
      { id: 'invisible', name: 'Invisível', glyph: '👻', color: '#6ea8ff',
        text: 'Ataques contra têm desvantagem, os dela vantagem.',
        details: 'Impossível de ver sem magia ou sentido especial; conta como muito bem escondida (a posição pode ser deduzida por ruído/pegadas). Ataques contra a criatura têm desvantagem, e as jogadas de ataque dela têm vantagem.' },
      { id: 'paralyzed', name: 'Paralisado', glyph: '🥶', color: '#4ec9e0',
        text: 'Não age; crítico de perto.',
        details: 'Está incapacitada, não se move nem fala. Falha automaticamente em testes de resistência de Força e Destreza. Ataques contra ela têm vantagem, e qualquer acerto vindo de até 1,5 m é um acerto crítico.' },
      { id: 'poisoned', name: 'Envenenado', glyph: '🧪', color: '#5ec46a',
        text: 'Desvantagem em ataques e testes.',
        details: 'Tem desvantagem em jogadas de ataque e em testes de habilidade.' },
      { id: 'prone', name: 'Caído', glyph: '⬇️', color: '#c8a24a',
        text: 'Engatinha; desvantagem ao atacar.',
        details: 'Só se move engatinhando (ou gastando metade do deslocamento para levantar). Tem desvantagem nas jogadas de ataque. Ataques contra ela têm vantagem se o atacante estiver a até 1,5 m; caso contrário têm desvantagem.' },
      { id: 'restrained', name: 'Impedido', glyph: '🕸', color: '#e0954e',
        text: 'Deslocamento 0; desvantagem em Des.',
        details: 'O deslocamento vira 0. Ataques contra ela têm vantagem, e as jogadas de ataque dela têm desvantagem. Tem desvantagem em testes de resistência de Destreza.' },
      { id: 'stunned', name: 'Atordoado', glyph: '💫', color: '#e0c34e',
        text: 'Incapacitado; falha For/Des.',
        details: 'Está incapacitada, não se move e fala com dificuldade. Falha automaticamente em testes de resistência de Força e Destreza. Ataques contra ela têm vantagem.' },
      { id: 'unconscious', name: 'Inconsciente', glyph: '💤', color: '#8b95a7',
        text: 'Incapacitado e caído; crítico de perto.',
        details: 'Está incapacitada, não se move nem fala e não percebe o ambiente. Larga o que segura e cai. Falha em resistências de Força e Destreza. Ataques contra ela têm vantagem, e acertos vindos de até 1,5 m são críticos.' },
    ],
    ranges: [
      { id: 'melee', name: 'Corpo a corpo', cells: 1,  color: '#e0564e', text: 'Adjacente (~1,5 m / 5 pés).', details: 'Alcance de armas corpo a corpo e agarrões: a criatura precisa estar adjacente (1 quadrado / 5 pés).' },
      { id: 'short', name: 'Curto',         cells: 6,  color: '#c8a24a', text: '~9 m / 30 pés.', details: 'Distância típica de muitas magias e do alcance curto de armas de arremesso.' },
      { id: 'mid',   name: 'Médio',         cells: 12, color: '#4ec9e0', text: '~18 m / 60 pés.', details: 'Alcance comum de magias de ataque e de armas à distância dentro do incremento normal.' },
      { id: 'long',  name: 'Longo',         cells: 24, color: '#7c5cff', text: '~36 m / 120 pés.', details: 'Faixa longa: fora do incremento curto, tiros à distância costumam ser com desvantagem.' },
    ],
    notes: [
      { cat: 'Regra', name: 'Vantagem/Desvantagem',
        text: 'Role 2d20, use o maior/menor.',
        details: 'Com vantagem, role 2d20 e use o maior; com desvantagem, use o menor. Não acumulam: se houver ambas, elas se cancelam e você rola 1d20 normal, independentemente de quantas fontes existam.' },
      { cat: 'Regra', name: 'Cobertura',
        text: 'Meia +2 · 3/4 +5 · total intocável.',
        details: 'Meia cobertura: +2 na CA e em resistências de Destreza. Três-quartos: +5. Cobertura total: não pode ser alvo direto de ataque ou magia.' },
      { cat: 'Regra', name: 'Testes de morte',
        text: '3 sucessos estabiliza; 3 falhas morre.',
        details: 'Com 0 PV, no seu turno role 1d20: 10+ é sucesso, 9- é falha. 3 sucessos → estável; 3 falhas → morre. Um 1 natural conta como 2 falhas; um 20 natural o traz de volta com 1 PV. Sofrer dano com 0 PV gera 1 falha (2 se for crítico ou dano corpo a corpo).' },
    ],
  },

  ordem: {
    id: 'ordem', name: 'Ordem Paranormal',
    counters: [],
    trackers: { foes: { style: 'hp', max: 30 } }, // vida de adversário = número atual/máx (PV)

    conditions: [
      { id: 'abalado',      name: 'Abalado',      glyph: '😰', color: '#e0763a',
        text: 'Penalidade perto da fonte do medo.',
        details: 'Sob forte medo/perturbação, a criatura recebe penalidade em testes enquanto a fonte estiver por perto. Ajuste o valor ao seu material.' },
      { id: 'sangrando',    name: 'Sangrando',    glyph: '🩸', color: '#e0564e',
        text: 'Perde vida por turno até estabilizar.',
        details: 'A criatura perde pontos de vida no início dos seus turnos até que alguém a estabilize ou o efeito termine.' },
      { id: 'debilitado',   name: 'Debilitado',   glyph: '🤢', color: '#5ec46a',
        text: 'Penalidade grande num atributo/tipo.',
        details: 'Recebe uma penalidade acentuada em testes de um atributo ou categoria indicada pela fonte do efeito.' },
      { id: 'enredado',     name: 'Enredado',     glyph: '🕸', color: '#c8a24a',
        text: 'Preso; deslocamento reduzido/anulado.',
        details: 'Fica presa no lugar; o deslocamento é reduzido ou anulado até se soltar.' },
      { id: 'caido',        name: 'Caído',        glyph: '⬇️', color: '#8b95a7',
        text: 'No chão; penalidades em ataque/defesa.',
        details: 'Está no chão e sofre penalidades em ataques e na defesa até gastar movimento para levantar.' },
      { id: 'atordoado',    name: 'Atordoado',    glyph: '💫', color: '#e0c34e',
        text: 'Não age nem reage por um tempo.',
        details: 'Fica sem poder agir ou reagir durante o efeito.' },
      { id: 'vulneravel',   name: 'Vulnerável',   glyph: '🎯', color: '#e05a9e',
        text: 'Exposto: penalidade na Defesa.',
        details: 'Fica exposta a acertos: penalidade na Defesa (ou os ataques contra ela ficam mais fáceis), conforme sua mesa.' },
      { id: 'inconsciente', name: 'Inconsciente', glyph: '💤', color: '#6ea8ff',
        text: 'Desacordado e indefeso.',
        details: 'Está desacordada e indefesa; não percebe o ambiente e não pode agir.' },
    ],
    ranges: [
      { id: 'curto',   name: 'Curto',   cells: 1,  color: '#e0564e', text: 'Adjacente / ~1,5 m.', details: 'Alcance de corpo a corpo: a criatura precisa estar praticamente adjacente.' },
      { id: 'medio',   name: 'Médio',   cells: 6,  color: '#c8a24a', text: '~9 m.', details: 'Distância intermediária, alcance de muitas armas e habilidades.' },
      { id: 'longo',   name: 'Longo',   cells: 12, color: '#4ec9e0', text: '~18 m.', details: 'Faixa longa; costuma pedir arma/efeito de alcance.' },
      { id: 'extremo', name: 'Extremo', cells: 24, color: '#7c5cff', text: 'Muito distante.', details: 'No limite do que dá para afetar na cena.' },
    ],
    notes: [
      { cat: 'Regra', name: 'Graduação de perícia',
        text: 'Destreinado/Treinado/Veterano/Expert.',
        details: 'A graduação em uma perícia altera o bônus recebido (e pode adicionar dados extras). Consulte a graduação de cada personagem no material.' },
      { cat: 'Nota', name: 'Personalize',
        text: 'Ajuste ao seu material.',
        details: 'Este preset é um resumo curto e editável — preencha condições, efeitos e valores conforme o livro que você usa na mesa.' },
    ],
  },
};

// ── Apply / query ─────────────────────────────────────────────────────────────────
function buildRulesIndex(sys) {
  const out = [];
  for (const c of (sys.conditions || [])) out.push({ cat: 'Condição', name: c.name, text: c.text || '', details: c.details || '', icon: c.glyph || '', color: c.color || '' });
  for (const r of (sys.ranges || [])) out.push({ cat: 'Range', name: r.name, text: (r.text ? r.text + ' ' : '') + '(' + r.cells + ' célula' + (r.cells === 1 ? '' : 's') + ')', details: r.details || '', icon: '', color: r.color || '' });
  for (const n of (sys.notes || [])) out.push({ cat: n.cat || 'Nota', name: n.name, text: n.text || '', details: n.details || '', icon: n.icon || '', color: n.color || '' });
  return out;
}

function activeSystem() { return GAME_SYSTEMS[activeSystemId] || GAME_SYSTEMS.daggerheart; }
function gameSystemList() { return Object.keys(GAME_SYSTEMS).map(k => ({ id: k, name: GAME_SYSTEMS[k].name })); }

// Swap the active system: repoint the globals and refresh whatever UI is already up.
// Runs once at load (all refresh hooks still undefined → skipped) and again on each user switch.
function applyGameSystem(id) {
  const sys = GAME_SYSTEMS[id] || GAME_SYSTEMS.daggerheart;
  activeSystemId  = sys.id;
  CONDITIONS  = sys.conditions || [];
  RANGE_BANDS = sys.ranges || [];
  RULES_INDEX = buildRulesIndex(sys);
  try { localStorage.setItem('presencevtt-system', sys.id); } catch (e) {}
  if (typeof tokenBuildPopup === 'function') tokenBuildPopup();                    // rebuild token chips
  if (typeof tokensDirty !== 'undefined') { tokensDirty = true; if (typeof scheduleRender === 'function') scheduleRender(); }
  if (typeof window !== 'undefined' && typeof window.rulesOnSystemChanged === 'function') window.rulesOnSystemChanged();
}

// ── Custom systems (built by the DM in the editor; persisted + shareable) ─────────
const BUILTIN_SYSTEM_IDS = ['daggerheart', 'dnd5e', 'ordem'];
const CUSTOM_SYSTEMS_LS = 'presencevtt-custom-systems';

function isCustomSystem(id) { return !!id && BUILTIN_SYSTEM_IDS.indexOf(id) === -1; }

// Merge any saved custom systems into the registry (called once at load).
function loadCustomSystems() {
  try {
    const obj = JSON.parse(localStorage.getItem(CUSTOM_SYSTEMS_LS) || '{}');
    for (const id in obj) { const s = obj[id]; if (s && s.id && isCustomSystem(s.id)) GAME_SYSTEMS[s.id] = s; }
  } catch (e) {}
}
function persistCustomSystems() {
  const out = {};
  for (const id in GAME_SYSTEMS) if (isCustomSystem(id)) out[id] = GAME_SYSTEMS[id];
  try { localStorage.setItem(CUSTOM_SYSTEMS_LS, JSON.stringify(out)); } catch (e) {}
}

// Only the shareable content (no runtime junk) — used for export + as the storage shape.
function stripSystem(s) {
  return { name: s.name, counters: s.counters || [], conditions: s.conditions || [], ranges: s.ranges || [], notes: s.notes || [], trackers: s.trackers || { foes: { style: 'clock', size: 8 } } };
}

function slugifySystemId(name) {
  // NFD splits accents into combining marks; the [^a-z0-9] pass then drops them → clean ascii slug.
  let base = String(name || 'sistema').toLowerCase().normalize('NFD')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'sistema';
  let id = base, n = 2;
  while (GAME_SYSTEMS[id]) { id = base + '-' + n; n++; }
  return id;
}
function svColor(c) { return (typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c)) ? c : '#c8a24a'; }
function svCells(v) { v = parseInt(v, 10); if (!(v >= 1)) v = 1; if (v > 200) v = 200; return v; }
function svStr(s, n) { return String(s == null ? '' : s).slice(0, n); }
function normTrackers(t) {
  const f = (t && t.foes) || {};
  return { foes: { style: f.style === 'hp' ? 'hp' : 'clock', size: svCells(f.size || 8), max: svCells(f.max || 20) } };
}

// Clean + shape whatever the editor/import gives us into a valid system object.
function normalizeSystem(sys, id) {
  return {
    id: id, name: svStr(sys.name || 'Sistema', 40) || 'Sistema', custom: true,
    counters: (Array.isArray(sys.counters) ? sys.counters : []).map(c => ({ name: svStr(c && c.name || 'Contador', 24) || 'Contador' })),
    conditions: (Array.isArray(sys.conditions) ? sys.conditions : []).map((c, i) => ({
      id: svStr((c && c.id) || ('c' + (i + 1)), 32) || ('c' + (i + 1)),
      name: svStr(c && c.name, 40), glyph: svStr((c && c.glyph) || '●', 4) || '●',
      color: svColor(c && c.color), text: svStr(c && c.text, 160), details: svStr(c && c.details, 1200),
    })),
    ranges: (Array.isArray(sys.ranges) ? sys.ranges : []).map((r, i) => ({
      id: svStr((r && r.id) || ('r' + (i + 1)), 32) || ('r' + (i + 1)),
      name: svStr(r && r.name, 40), cells: svCells(r && r.cells),
      color: svColor(r && r.color), text: svStr(r && r.text, 160), details: svStr(r && r.details, 1200),
    })),
    notes: (Array.isArray(sys.notes) ? sys.notes : []).map(n => ({
      icon: svStr(n && n.icon, 4), cat: svStr((n && n.cat) || 'Nota', 20) || 'Nota', name: svStr(n && n.name, 60),
      text: svStr(n && n.text, 160), details: svStr(n && n.details, 1200),
    })),
    trackers: normTrackers(sys.trackers),
  };
}

// Create/update a custom system. existingId (if custom) → update in place; else a new id.
function saveCustomSystem(sys, existingId) {
  const id = (existingId && isCustomSystem(existingId) && GAME_SYSTEMS[existingId]) ? existingId : slugifySystemId(sys.name);
  GAME_SYSTEMS[id] = normalizeSystem(sys, id);
  persistCustomSystems();
  return id;
}
function deleteCustomSystem(id) {
  if (!isCustomSystem(id) || !GAME_SYSTEMS[id]) return false;
  delete GAME_SYSTEMS[id];
  persistCustomSystems();
  return true;
}
function exportSystemJSON(sysOrId) {
  const s = (typeof sysOrId === 'string') ? GAME_SYSTEMS[sysOrId] : sysOrId;
  return JSON.stringify(stripSystem(s || {}), null, 2);
}
function importSystemJSON(text) {
  const obj = JSON.parse(text); // throws on bad JSON — caller catches
  if (!obj || typeof obj !== 'object' || !obj.name) throw new Error('JSON sem "name" — não parece um sistema.');
  return saveCustomSystem(obj); // returns the new id
}

// Initialise: load custom systems, then the saved active choice (default Daggerheart).
loadCustomSystems();
try { const s = localStorage.getItem('presencevtt-system'); if (s && GAME_SYSTEMS[s]) activeSystemId = s; } catch (e) {}
applyGameSystem(activeSystemId);
