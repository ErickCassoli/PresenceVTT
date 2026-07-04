// i18n.js — lightweight source-string internationalization for presenceVTT.
//
// Part of PresenceVTT, a fork of Evermist (MIT, Copyright (c) 2026 Hinnful).
//
// The UI is authored in Portuguese. Rather than tag hundreds of elements with keys,
// this translates *by source string*: the PT text already in the DOM is the key, and
// EN[key] is the English rendering. Anything not in the map (scene names, token
// labels, custom systems, numbers) passes through untouched.
//
// How it works:
//   • On load it walks the DOM once, remembering each text node / title / placeholder's
//     original Portuguese, and renders the active language.
//   • A MutationObserver translates any nodes added later (scene cards, condition
//     chips, rules rows, modals populated on demand) — so dynamic UI is covered too.
//   • setLang() flips every tracked node back to PT or forward to EN in place.
//   • t(src) does the same for JS-composed strings (e.g. the update toast).
//
// Plain <script> (no ES modules), loaded after the inline script. Add to package.json
// build.files so it ships in the Electron package.

(function () {
  'use strict';

  var LS_KEY = 'presencevtt-lang';

  // ── PT source → EN. Keep keys byte-exact with what the UI renders. ─────────────
  var EN = {
    // Toolbar & tool tips
    'Revelar (S alterna)': 'Reveal (S toggles)',
    'Ocultar (S alterna)': 'Hide (S toggles)',
    'Modo revelar': 'Reveal mode',
    'Modo ocultar': 'Hide mode',
    'Selecionar / Mover (1 · V)': 'Select / Move (1 · V)',
    'Selecionar / Mover': 'Select / Move',
    'Polígono (5 · P)': 'Polygon (5 · P)',
    'Polígono': 'Polygon',
    'Retângulo (3 · E)': 'Rectangle (3 · E)',
    'Retângulo': 'Rectangle',
    'Círculo (4 · C)': 'Circle (4 · C)',
    'Círculo': 'Circle',
    'Círculo / Burst': 'Circle / Burst',
    'Pincel (2)': 'Brush (2)',
    'Pincel': 'Brush',
    'Régua — medir distância em células (R)': 'Ruler — measure distance in cells (R)',
    'Token — âncora de mini (T)': 'Token — mini anchor (T)',
    'Área (AoE) — atalho A · arraste cria; fica fixa, move e redimensiona': 'Area (AoE) — shortcut A · drag to create; stays put, moves and resizes',
    'Marcações (D) — ping · traçado some · risco fica': 'Markings (D) — ping · trace fades · scribble stays',

    // Area (AoE) panel
    'Área': 'Area',
    'Cone': 'Cone',
    'Linha': 'Line',
    'Emanação (de um token ou ponto)': 'Emanation (from a token or point)',
    'Cor da área (aplica à selecionada)': 'Area color (applies to the selected one)',
    'arraste cria · corpo move · alça redimensiona · dir. apaga': 'drag creates · body moves · handle resizes · right-click deletes',
    'Limpar todas as áreas': 'Clear all areas',
    '● Burst': '● Burst',
    '◣ Cone': '◣ Cone',
    '▬ Linha': '▬ Line',
    '◎ Eman.': '◎ Eman.',

    // Markings panel
    'Marcações': 'Markings',
    'Ping — clique para chamar atenção (some sozinho)': 'Ping — click to draw attention (fades on its own)',
    'Traçado — arraste; some sozinho depois de soltar': 'Trace — drag; fades on its own after release',
    'Risco — arraste; fica até apagar': 'Scribble — drag; stays until cleared',
    'Apagar os riscos fixos': 'Clear the fixed scribbles',
    '◎ Ping': '◎ Ping',
    '〜 Traçado': '〜 Trace',
    '✎ Risco': '✎ Scribble',

    // Token popup
    'Nome do token': 'Token name',
    'Nome': 'Name',
    'Cor': 'Color',
    'Imagem (clique: escolher · direito: remover)': 'Image (click: choose · right-click: remove)',
    'Apagar (Delete)': 'Delete (Delete)',
    'Tam.': 'Size',
    'Tamanho (células)': 'Size (cells)',
    'Condições': 'Conditions',
    'Bandas de range (células)': 'Range bands (cells)',

    // Ruler panel
    'Régua ·': 'Ruler ·',
    'Régua': 'Ruler',
    'Mostrar réguas aos jogadores (Shift+R)': 'Show rulers to players (Shift+R)',
    'Mostrar régua aos jogadores': 'Show ruler to players',
    'Limpar todas as réguas': 'Clear all rulers',

    // Scenes / backup / profile
    'Cenas': 'Scenes',
    'Abrir o gerenciador de cenas': 'Open the scene manager',
    'Backup de cenas': 'Scene backup',
    'Perfil completo': 'Full profile',
    'Exportar': 'Export',
    'Importar': 'Import',
    'Restaurar': 'Restore',
    'Exportar cenas selecionadas para um .zip': 'Export selected scenes to a .zip',
    'Restaurar cenas de um .zip': 'Restore scenes from a .zip',
    'Exportar o PERFIL completo (todas as cenas + sons + sistemas) para um .zip': 'Export the full PROFILE (all scenes + sounds + systems) to a .zip',
    'Importar um perfil .zip (adiciona cenas, sons e sistemas)': 'Import a .zip profile (adds scenes, sounds and systems)',
    'Exportar backup': 'Export backup',
    'Exportar 0 cenas': 'Export 0 scenes',
    'Cancelar': 'Cancel',
    'Selecionar tudo': 'Select all',
    'Desmarcar tudo': 'Deselect all',
    'Renomear': 'Rename',
    'Renomear cena': 'Rename scene',
    'Apagar cena': 'Delete scene',
    '+ Nova cena': '+ New scene',
    'Nenhuma cena ainda — clique em + Nova cena para adicionar': 'No scenes yet — click + New scene to add',
    'Salvando vídeo do mapa...': 'Saving map video...',

    // Landing
    'Abra': 'Open',
    'na barra para começar': 'in the toolbar to start',

    // Grid panel
    'Ativar/desativar grid (G)': 'Enable/disable grid (G)',
    'Tamanho da célula': 'Cell size',
    'Tamanho da célula (px)': 'Cell size (px)',
    'Deslocamento X do grid': 'Grid X offset',
    'Deslocamento X (px)': 'X offset (px)',
    'Deslocamento Y do grid': 'Grid Y offset',
    'Deslocamento Y (px)': 'Y offset (px)',
    'Espessura da linha': 'Line thickness',
    'Espessura da linha (px)': 'Line thickness (px)',
    'Grid quadrado': 'Square grid',
    'Hex topo plano': 'Flat-top hex',
    'Hex topo pontudo': 'Pointy-top hex',
    'Cor do grid': 'Grid color',
    'Opacidade do grid': 'Grid opacity',
    'Opacidade %': 'Opacity %',
    'Resetar grid': 'Reset grid',
    'Restaurar grid ao padrão': 'Reset grid to default',

    // Fog panel
    'Ativar/desativar animação do fog (A)': 'Enable/disable fog animation (A)',
    'Ocultar tudo': 'Hide all',
    'Revelar tudo': 'Reveal all',
    'Calmo — deriva suave': 'Calm — gentle drift',
    'Padrão — fog equilibrado': 'Default — balanced fog',
    'Rápido — fog agitado': 'Fast — turbulent fog',
    'Configurações avançadas de animação': 'Advanced animation settings',
    'Restaurar ao preset padrão': 'Reset to the default preset',
    'Vel.': 'Speed',
    'Multiplicador geral de velocidade': 'Overall speed multiplier',
    'Velocidade %': 'Speed %',
    'Deriva': 'Drift',
    'Velocidade de deriva (movimento espacial)': 'Drift speed (spatial movement)',
    'Multiplicador de deriva': 'Drift multiplier',
    'Velocidade de morphing da textura': 'Texture morphing speed',
    'Velocidade de morph': 'Morph speed',
    'Intensidade do warp (domain warp)': 'Warp intensity (domain warp)',
    'Intensidade do warp': 'Warp intensity',
    'Raio do warp': 'Warp radius',
    'Pulso': 'Pulse',
    'Amplitude do pulso de alpha': 'Alpha pulse amplitude',
    'Amplitude do pulso': 'Pulse amplitude',
    'Borda': 'Edge',
    'Raio de suavização da borda revelada (px na escala do fog)': 'Feather radius of the revealed edge (px at fog scale)',
    'Raio de suavização': 'Feather radius',

    // Projection (player) section
    'Projeção': 'Projection',
    'Abrir a janela de projeção': 'Open the projection window',
    'Abrir projeção': 'Open projection',
    'Enviar a visão atual do mestre para a projeção': "Send the master's current view to the projection",
    'Sincronizar visão': 'Sync view',
    'Enviar mudanças de fog automaticamente': 'Send fog changes automatically',
    'Alternar tela cheia na projeção': 'Toggle full screen on the projection',
    'Tela cheia': 'Full screen',
    'Mostrar o estado atual na projeção (Espaço)': 'Show the current state on the projection (Space)',
    'Ir ao vivo ▶': 'Go live ▶',
    'Ir ao vivo': 'Go live',
    'Ir ao vivo (modo manual)': 'Go live (manual mode)',
    'Apagar a projeção (B) — o mestre continua vendo': 'Black out the projection (B) — the master keeps seeing',
    '⬛ Blackout': '⬛ Blackout',
    '⬛ BLACKOUT ATIVO': '⬛ BLACKOUT ON',
    'Blackout da projeção': 'Blackout the projection',

    // Polygon context panel
    'Todos os cantos / vértice selecionado': 'All corners / selected vertex',
    'Raio do canto': 'Corner radius',
    'Apagar polígono': 'Delete polygon',
    'Apagar vértice (Del)': 'Delete vertex (Del)',

    // UI scale
    'Escala da interface': 'Interface scale',
    '⚙ Escala': '⚙ Scale',

    // Shortcut legend
    'Atalhos de teclado': 'Keyboard shortcuts',
    'Atalhos de teclado (?)': 'Keyboard shortcuts (?)',
    '? ou Esc para fechar': '? or Esc to close',
    'Ferramentas': 'Tools',
    // Configurable-shortcut editor
    'Personalizar atalhos': 'Customize shortcuts',
    'Restaurar padrões': 'Restore defaults',
    'Restaurar padrão': 'Restore default',
    'Pressione uma tecla…': 'Press a key…',
    'Clique e pressione a nova tecla (Esc cancela)': 'Click and press the new key (Esc cancels)',
    'Modos': 'Modes',
    'Fixas': 'Fixed',
    'Área (AoE)': 'Area (AoE)',
    'Abrir/fechar esta legenda': 'Open/close this legend',
    'Desselecionar / fechar': 'Deselect / close',
    'Alterna Revelar / Ocultar': 'Toggle Reveal / Hide',
    'Grudar no grid': 'Snap to grid',
    'Grudar no grid (N)': 'Snap to grid (N)',
    'Grudar': 'Snap',
    'Tamanho do pincel −/+': 'Brush size −/+',
    'Mapa & Visão': 'Map & View',
    'Abrir/trocar mapa:': 'Open/switch map:',
    'Ajustar à tela': 'Fit to screen',
    'Desfazer': 'Undo',
    'Refazer': 'Redo',
    'Grid liga/desliga': 'Grid on/off',
    'Animação do fog': 'Fog animation',
    'Alternar modo do polígono': 'Toggle polygon mode',
    'Apagar polígono / vértice': 'Delete polygon / vertex',
    'Desselecionar vértice / polígono': 'Deselect vertex / polygon',
    'Clique na aresta → insere vértice': 'Click the edge → insert vertex',
    '(na projeção)': '(on the projection)',
    'Espaço': 'Space',
    '(ou C)': '(or C)',
    '(ou E)': '(or E)',
    '(ou P)': '(or P)',
    '(ou V)': '(or V)',

    // Header tabs / misc
    '👁 Jogadores': '👁 Players',
    '📖 Regras': '📖 Rules',
    '🔊 Sons': '🔊 Sounds',
    '⚙ Setup': '⚙ Setup',
    '✎ Editar': '✎ Edit',
    '🗑 Limpar': '🗑 Clear',
    'Fechar': 'Close',
    'Abrir/fechar a aba de Regras': 'Open/close the Rules tab',
    '＋ categoria': '＋ category',
    '＋ contador': '＋ counter',
    '＋ Escolher arquivos': '＋ Choose files',
    '＋ Novo': '＋ New',

    // Update toast (JS-composed via t())
    'Baixando atualização': 'Downloading update',
    'Atualização pronta': 'Update ready',
    'Reiniciar e atualizar': 'Restart and update',

    // ── Soundboard ────────────────────────────────────────────────────────────
    'Ambientes': 'Ambience',
    'Tela da mesa (projeção)': 'Table screen (projection)',
    'Volume master': 'Master volume',
    'Mudo': 'Muted',
    '⏹ Pânico': '⏹ Panic',
    'Pânico — parar tudo (\\)': 'Panic — stop everything (\\)',
    'Sem sons nesta aba.': 'No sounds in this tab.',
    'aqui (mp3/ogg/wav…) — vira pads nesta categoria': 'here (mp3/ogg/wav…) — becomes pads in this category',
    'Arraste uma': 'Drag a',
    'pasta de sons': 'sound folder',
    'Nova categoria': 'New category',
    'Saída:': 'Output:',
    'Tudo': 'All',

    // ── Rules tab: systems, trackers, reference ───────────────────────────────
    'Sistema': 'System',
    'Trocar o sistema de jogo': 'Switch the game system',
    'Criar um sistema novo (a partir do atual)': 'Create a new system (from the current one)',
    'Editar o sistema atual (presets viram cópia)': 'Edit the current system (presets become a copy)',
    'Excluir o sistema atual (só os seus; presets não)': 'Delete the current system (only yours; not presets)',
    'Referência': 'Reference',
    'Combate': 'Combat',
    'Dano': 'Damage',
    'Buscar (ex.: Vulnerável)…': 'Search (e.g. Vulnerable)…',
    'Nome (ex.: Goblin)': 'Name (e.g. Goblin)',
    'Nome (ex.: Ritual)': 'Name (e.g. Ritual)',
    'Trackers': 'Trackers',
    'Contadores': 'Counters',
    'Contagens regressivas': 'Countdowns',
    'Vida de adversários': 'Adversary HP',
    'Adicionar adversário': 'Add adversary',
    'Adicionar um contador manual (ex.: Fear)': 'Add a manual counter (e.g. Fear)',
    'Remover contador': 'Remove counter',
    'Nenhum adversário. Adicione acima.': 'No adversaries. Add one above.',
    'Nenhum clock. Crie um acima.': 'No clocks. Create one above.',
    'Criar contagem': 'Create countdown',
    'Nº de pontos': 'No. of points',
    'Segmentos': 'Segments',
    'Máquina do mestre': 'GM engine',
    'Gastar Fear': 'Spend Fear',
    'Rolou com Medo': 'Rolled with Fear',
    'Quando marcar': 'When to mark',
    'Quanto marcar': 'How much to mark',
    'Movimento suave': 'Soft move',
    'Movimento duro': 'Hard move',
    'Limiares de dano': 'Damage thresholds',

    // Conditions (names)
    'Vulnerável': 'Vulnerable',
    'Contido': 'Restrained',
    'Atordoado': 'Stunned',
    'Envenenado': 'Poisoned',
    'Em chamas': 'Burning',
    'Marcado': 'Marked',
    'Oculto': 'Hidden',

    // Range bands (name / name — N cells / name · N)
    'Corpo a corpo': 'Melee',
    'Corpo a corpo — 1 células': 'Melee — 1 cell',
    'Corpo a corpo · 1': 'Melee · 1',
    'Muito Perto': 'Very Close',
    'Muito Perto — 3 células': 'Very Close — 3 cells',
    'Muito Perto · 3': 'Very Close · 3',
    'Perto': 'Close',
    'Perto — 6 células': 'Close — 6 cells',
    'Perto · 6': 'Close · 6',
    'Longe': 'Far',
    'Longe — 12 células': 'Far — 12 cells',
    'Longe · 12': 'Far · 12',
    'Muito Longe': 'Very Far',
    'Muito Longe — 20 células': 'Very Far — 20 cells',
    'Muito Longe · 20': 'Very Far · 20',

    // Reference blurbs (conditions)
    'A criatura não consegue se deslocar da posição atual, mas continua agindo normalmente — pode atacar, usar habilidades e reagir. Sai da condição quando algo na ficção a liberta (um aliado corta as amarras, ela se solta, etc.).':
      "The creature can't move from its current position, but keeps acting normally — it can attack, use abilities and react. It leaves the condition when something in the fiction frees it (an ally cuts the bonds, it breaks free, etc.).",
    'Enquanto estiver fora da linha de visão dos inimigos e em silêncio, rolagens contra você são feitas com desvantagem. A condição termina assim que você age abertamente, ataca, é revelado ou entra claramente no campo de visão.':
      'While out of your enemies’ line of sight and silent, rolls against you are made with disadvantage. The condition ends as soon as you act openly, attack, are revealed or clearly enter their field of view.',
    'Enquanto vulnerável, TODA rolagem feita contra a criatura é feita com vantagem. É a condição que você quer impor antes de um golpe importante — costuma vir de manobras, cercos ou efeitos que deixam o alvo exposto.':
      "While vulnerable, EVERY roll made against the creature is made with advantage. It's the condition you want to impose before an important blow — it usually comes from maneuvers, sieges or effects that leave the target exposed.",
    'Rolagens contra ela têm vantagem.': 'Rolls against it have advantage.',
    'Rolagens contra você têm desvantagem.': 'Rolls against you have disadvantage.',
    'Não sai do lugar, mas ainda age.': "Doesn't move, but still acts.",
    '[Marcador da mesa] Alvo em foco.': '[Table marker] Target in focus.',
    '[Marcador da mesa] Atordoado.': '[Table marker] Stunned.',
    '[Marcador da mesa] Está queimando.': '[Table marker] Is burning.',
    '[Marcador da mesa] Sob veneno.': '[Table marker] Poisoned.',
    'Marcador da mesa (não é condição oficial): use como lembrete de que a criatura está pegando fogo. Narre o dano contínuo e a chance de apagar as chamas quando fizer sentido — sem cálculo automático.':
      'Table marker (not an official condition): use it as a reminder that the creature is on fire. Narrate the ongoing damage and the chance to put out the flames when it makes sense — no automatic calculation.',
    'Marcador da mesa. A criatura está desorientada/atordoada — o mestre narra a limitação temporária.':
      'Table marker. The creature is disoriented/stunned — the GM narrates the temporary limitation.',
    'Marcador da mesa. Destaca um alvo para a atenção do grupo (foco de ataques, objetivo da cena, etc.).':
      "Table marker. Highlights a target for the group's attention (focus of attacks, scene objective, etc.).",
    'Marcador da mesa. Lembrete de que a criatura está envenenada; decida os efeitos narrativos/mecânicos na hora conforme sua mesa.':
      'Table marker. A reminder that the creature is poisoned; decide the narrative/mechanical effects on the spot, per your table.',

    // Reference blurbs (ranges)
    'Praticamente na mesma célula: ataques desarmados, armas corporais e agarrões acontecem aqui.':
      'Practically the same cell: unarmed attacks, melee weapons and grapples happen here.',
    'Toque / arma corporal. (1 célula)': 'Touch / melee weapon. (1 cell)',
    'Um deslocamento curto alcança. Muitas habilidades de curto alcance operam nesta faixa.':
      'A short move reaches it. Many short-range abilities operate in this band.',
    'Poucos passos. (3 células)': 'A few steps. (3 cells)',
    'Alcançável com um movimento típico dentro da cena; boa parte das ações de alcance médio acontece aqui.':
      'Reachable with a typical move within the scene; much of the medium-range action happens here.',
    'Mesma sala/área. (6 células)': 'Same room/area. (6 cells)',
    'Interagir exige arma de alcance, magia de longo alcance ou gastar movimento para chegar mais perto.':
      'Interacting requires a ranged weapon, long-range magic or spending movement to get closer.',
    'Precisa de alcance/deslocamento. (12 células)': 'Needs reach/movement. (12 cells)',
    'Praticamente o limite do que dá para afetar; em geral é preciso se aproximar antes de agir.':
      'Practically the limit of what you can affect; usually you must get closer before acting.',
    'No limite da cena. (20 células)': 'At the edge of the scene. (20 cells)',

    // Reference blurbs (damage / GM moves)
    'Cada PJ tem dois limiares: Maior e Severo. Ao sofrer dano, compare o total contra eles para saber quantos pontos de vida marcar.':
      'Each PC has two thresholds: Major and Severe. When taking damage, compare the total against them to know how many hit points to mark.',
    'Abaixo do Maior = 1 · Maior = 2 · Severo = 3.': 'Below Major = 1 · Major = 2 · Severe = 3.',
    'Compare o dano com Maior e Severo.': 'Compare the damage against Major and Severe.',
    'Dano abaixo do limiar Maior → marca 1 PV. Dano igual/acima do Maior (e abaixo do Severo) → marca 2 PV. Dano igual/acima do Severo → marca 3 PV. Algumas mesas usam “dano massivo” (≥ dobro do Severo) → 4 PV.':
      'Damage below the Major threshold → mark 1 HP. Damage at/above Major (and below Severe) → mark 2 HP. Damage at/above Severe → mark 3 HP. Some tables use “massive damage” (≥ twice Severe) → 4 HP.',
    'Cause dano, tire um recurso, separe o grupo, avance um relógio de perigo — uma consequência que os jogadores sentem na hora.':
      'Deal damage, take away a resource, split the group, advance a danger clock — a consequence the players feel right away.',
    'Consequência direta e concreta.': 'Direct, concrete consequence.',
    'Telegrafe o perigo, mude a cena, revele uma complicação, peça uma rolagem ou coloque os PJs numa posição difícil — sem causar dano imediato.':
      'Telegraph the danger, change the scene, reveal a complication, ask for a roll or put the PCs in a tough spot — without dealing immediate damage.',
    'Avance a ameaça sem dano direto.': 'Advance the threat without direct damage.',
    'Interromper, mover de novo, destacar inimigo.': 'Interrupt, move again, highlight an enemy.',
    'Quando uma rolagem de jogador sai com Medo (o dado de Medo vence), o spotlight pode voltar para o mestre: ele faz um movimento e ganha 1 Fear para gastar depois.':
      "When a player's roll comes up with Fear (the Fear die wins), the spotlight can return to the GM: they make a move and gain 1 Fear to spend later.",
    'Gaste Fear para interromper os PJs e tomar o spotlight, fazer um adversário agir mais de uma vez, ou ativar movimentos/efeitos mais fortes na cena.':
      'Spend Fear to interrupt the PCs and take the spotlight, make an adversary act more than once, or trigger stronger moves/effects in the scene.',
    'Mestre age e ganha 1 Fear.': 'GM acts and gains 1 Fear.'
  };

  // ── Engine ─────────────────────────────────────────────────────────────────
  var LANG = (function () {
    try {
      var saved = localStorage.getItem(LS_KEY);
      if (saved === 'pt' || saved === 'en') return saved;
    } catch (e) {}
    return (navigator.language || 'pt').toLowerCase().indexOf('pt') === 0 ? 'pt' : 'en';
  })();

  var textOrig = new WeakMap();   // text node → original PT string
  var attrOrig = new WeakMap();   // element   → { title, placeholder }
  var textNodes = new Set();      // tracked text nodes (re-rendered on lang flip)
  var attrEls   = new Set();      // tracked elements with title/placeholder
  var applying  = false;          // guard: ignore our own DOM writes in the observer

  function renderFull(full) {
    if (LANG !== 'en') return full;             // PT = the stored original
    var key = full.trim();
    if (!key) return full;
    var tr = EN[key];
    if (!tr) return full;
    var i = full.indexOf(key);
    return full.slice(0, i) + tr + full.slice(i + key.length);
  }

  function renderTextNode(node) {
    var o = textOrig.get(node);
    if (o == null) return;
    var next = renderFull(o);
    if (node.nodeValue !== next) node.nodeValue = next;
  }

  function renderAttrEl(el) {
    var o = attrOrig.get(el);
    if (!o) return;
    if (o.title != null) { var t = renderFull(o.title); if (el.getAttribute('title') !== t) el.setAttribute('title', t); }
    if (o.placeholder != null) { var p = renderFull(o.placeholder); if (el.getAttribute('placeholder') !== p) el.setAttribute('placeholder', p); }
  }

  function registerTextNode(node) {
    if (textOrig.has(node)) { renderTextNode(node); return; }
    var v = node.nodeValue;
    if (!v || !/[A-Za-zÀ-ÿ]/.test(v)) return;   // whitespace/punctuation only → skip
    textOrig.set(node, v);
    textNodes.add(node);
    renderTextNode(node);
  }

  function registerAttrEl(el) {
    if (!attrOrig.has(el)) {
      var rec = {};
      if (el.hasAttribute('title')) rec.title = el.getAttribute('title');
      if (el.hasAttribute('placeholder')) rec.placeholder = el.getAttribute('placeholder');
      if (rec.title == null && rec.placeholder == null) return;
      attrOrig.set(el, rec);
      attrEls.add(el);
    }
    renderAttrEl(el);
  }

  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { registerTextNode(root); return; }
    if (root.nodeType !== 1) return;
    var tag = root.nodeName;
    if (tag === 'SCRIPT' || tag === 'STYLE') return;
    if (root.hasAttribute && (root.hasAttribute('title') || root.hasAttribute('placeholder'))) registerAttrEl(root);
    var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode && n.parentNode.nodeName;
        return (p === 'SCRIPT' || p === 'STYLE') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    var n; while ((n = tw.nextNode())) registerTextNode(n);
    var withAttr = root.querySelectorAll ? root.querySelectorAll('[title],[placeholder]') : [];
    for (var i = 0; i < withAttr.length; i++) registerAttrEl(withAttr[i]);
  }

  function applyAll() {
    applying = true;
    try {
      textNodes.forEach(renderTextNode);
      attrEls.forEach(renderAttrEl);
    } finally { applying = false; }
  }

  function setLang(lang) {
    if (lang !== 'pt' && lang !== 'en') return;
    LANG = lang;
    try { localStorage.setItem(LS_KEY, lang); } catch (e) {}
    document.documentElement.lang = lang === 'en' ? 'en' : 'pt-BR';
    applyAll();
    reflectSwitch();
  }

  // t(src): translate a JS-composed source string (used by e.g. the update toast).
  function t(src) { return (LANG === 'en' && EN[src]) ? EN[src] : src; }

  // ── Language switch UI wiring ────────────────────────────────────────────────
  function reflectSwitch() {
    var sw = document.getElementById('lang-switch');
    if (!sw) return;
    sw.querySelectorAll('button[data-lang]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-lang') === LANG);
    });
  }
  function wireSwitch() {
    var sw = document.getElementById('lang-switch');
    if (!sw) return;
    sw.querySelectorAll('button[data-lang]').forEach(function (b) {
      b.addEventListener('click', function () { setLang(b.getAttribute('data-lang')); });
    });
    reflectSwitch();
  }

  // ── Boot ─────────────────────────────────────────────────────────────────────
  var observer = new MutationObserver(function (muts) {
    if (applying) return;
    applying = true;
    try {
      for (var i = 0; i < muts.length; i++) {
        var added = muts[i].addedNodes;
        for (var j = 0; j < added.length; j++) walk(added[j]);
      }
    } finally { applying = false; }
  });

  function init() {
    document.documentElement.lang = LANG === 'en' ? 'en' : 'pt-BR';
    walk(document.body);
    wireSwitch();
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  // Re-walk once more after full load to catch anything built late.
  window.addEventListener('load', function () { walk(document.body); });

  // Expose for the inline script and future callers.
  window.t = t;
  window.setLang = setLang;
  window.getLang = function () { return LANG; };
  window.i18nApply = applyAll;
})();
