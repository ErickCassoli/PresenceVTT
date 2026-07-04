# presenceVTT

***Português** · [English](README.en.md)*

**Apresentador de mapas com _fog of war_ para RPG de mesa presencial.**

Põe o mapa numa TV/projetor e deixa você revelar o cenário ao vivo de uma segunda tela — o mestre controla, os jogadores só veem o que você quiser.

![Revelando fog na tela dos jogadores](assets/reveal.gif)

[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

> **Não é um VTT completo.** Sem ficha, sem token com regra, sem dado, sem iniciativa, sem login, sem nuvem, sem multiplayer remoto. Ele faz uma coisa — mostrar um mapa e esconder partes dele — e faz bem.

> **Fork do [Evermist](https://github.com/Hinnful/Evermist)** (MIT, © 2026 Hinnful). O crédito original é preservado no [NOTICE](NOTICE) e na [LICENSE](LICENSE).

## O que dá pra fazer

### Duas telas em sincronia
Uma janela de **mestre** com todos os controles e uma janela de **projeção** limpa — sem botões, sem cursor, só o mapa. Arraste a projeção pra TV, ponha em tela cheia, e a mesa vê só o combinado.

Revele uma sala no seu notebook e ela aparece na TV na hora. Ou use o modo manual, prepare a próxima revelação em segredo e empurre com **Ir ao vivo** quando a party cruzar a porta.

### Fog of war vivo
A névoa é macia, com nuvens que derivam devagar — não um preto chapado. Você descobre o mapa como a cena pedir: **Pincel**, **Retângulo**, **Círculo**, **Polígono**, **Revelar/Ocultar**, e **Selecionar** pra editar depois.

### Régua de distância
Meça distância em **células do grid** direto no mapa. As réguas ficam como anotações, grudam em centro/canto/aresta da célula, e dá pra **mostrar aos jogadores** com um toggle.

### Blackout instantâneo
Apague a projeção na hora com **Shift+B** (ou o botão ⬛). A tela dos jogadores fica preta; o mestre continua vendo tudo.

### Mapas que se mexem, grid, cenas
Mapas animados (MP4/WebM), grid quadrado ou hex ajustável, e várias cenas com troca suave entre elas. Aguenta mapas grandes (10000×6000) com pan/zoom liso.

> **Dica:** aperte `?` na janela do mestre pra ver todos os atalhos.

### Tokens pra trackear as minis
Marque no mapa onde cada mini está: tokens-âncora com **cor, nome e retrato PNG/JPG** pra
alinhar no grid, **condições** (ícones que os players enxergam) e **bandas de range** — tudo
espelhado na projeção. É rastreio visual, não uma ficha.

### Áreas (AoE)
Burst, cone, linha e emanação medidos em **células**: arraste pra criar, e depois **mova e
redimensione**. Puramente visual, aparece na mesa.

### Marcações: ping, traçado, risco
Chame atenção com um **ping**, deixe um **traçado** que some sozinho, ou um **risco** que fica
até apagar. Em cima do mapa, sincronizado com a projeção.

### Aba de Regras (só-mestre)
Referência **buscável** (condições, ranges, tabelas de dano, GM moves) + **trackers manuais**:
Fear, contagens regressivas e **vida de adversários**. Nada rola dado nem calcula — é
apresentador, **não VTT**.

### Sistemas de jogo trocáveis e editáveis
Vem com **Daggerheart, D&D 5e e Ordem Paranormal**. Troque num clique (muda condições, ranges,
referência e o estilo dos trackers) e **crie o seu dentro do app**, sem programar. Exporte e
importe sistemas como **JSON** pra compartilhar com a comunidade.

### Soundboard
Pads de **ambiente** (loop com crossfade) e **one-shots** por cima (porta, espada, trovão),
com atalhos, volume por pad, **botão de pânico** e opção de tocar o som **pela tela da mesa**.

### Perfil portátil
Exporte **cenas + sons + sistemas** num único arquivo `.zip` e leve sua mesa montada pra
outro PC ou compartilhe com outro mestre.

### Dois idiomas
A interface toda está disponível em **português e inglês**, com troca num clique pelo botão
**PT / EN** no canto superior esquerdo. Começa no idioma do seu navegador/SO e lembra a escolha.

## Rodando do código-fonte

Sem build step — é JavaScript puro num shell Electron.

```bash
npm install     # uma vez, depois de clonar
npm start       # abre o app
```

## Gerar o executável

```bash
npm run build         # Windows portable .exe
npm run build:mac     # macOS .dmg
npm run build:linux   # Linux AppImage
```

O resultado sai na pasta **`dist/`**:

| Sistema | Arquivo | Como rodar |
|---------|---------|-----------|
| Windows | `dist/presenceVTT.exe` | **Duplo-clique.** Portátil, sem instalação. Cria uma pasta `presencevtt-data/` ao lado do `.exe` (todos os dados ficam ali — dá pra copiar a pasta inteira entre PCs). |
| macOS | `dist/presenceVTT.dmg` | Universal (Intel + Apple Silicon). |
| Linux | `dist/presenceVTT.AppImage` | `chmod +x` e rode. |

O app **não é assinado** (certificado custa dinheiro), então na 1ª vez o sistema mostra um aviso de segurança: no Windows, "Mais informações" → "Executar assim mesmo".

> O *build* baixa ferramentas do electron-builder na primeira vez (precisa de internet **só pra buildar**). O app **em si** não usa rede nenhuma em runtime, exceto a checagem de atualização abaixo.

## Atualizações

As versões instaladas do **Windows (instalador NSIS)** e do **Linux (AppImage)** checam por uma nova release no GitHub ao abrir, baixam em segundo plano e oferecem um botão **Reiniciar e atualizar** na janela do mestre. O **portátil** do Windows e o macOS não-assinado não se auto-atualizam — nesses casos, baixe de novo na página de [Releases](https://github.com/ErickCassoli/PresenceVTT/releases).

## Atalhos

Toda ação principal do mestre é **um gesto**. Aperte `?` na janela do mestre pra abrir esta lista — e **todos os atalhos são personalizáveis**: clique em **✎ Editar** na legenda e pressione a tecla que você quiser.

| Tecla | Ação |
|-------|------|
| `1` `2` `3` `4` `5` | **Selecionar/Mover · Pincel · Retângulo · Círculo · Polígono** (as letras `V`/`E`/`C`/`P` continuam valendo) |
| `S` | Alterna **Revelar / Ocultar** |
| `R` | **Régua** — mede em células do grid · `T` **Token** |
| `Shift + R` | **Mostrar a régua aos jogadores** (liga/desliga) |
| `B` | **Blackout** — apaga a projeção na hora (o mestre continua vendo) |
| `Espaço` | **Ir ao vivo** — mostra o estado atual na projeção · `Shift + S` ir ao vivo no modo manual |
| `G` | Grid liga/desliga · `A` animação do fog · `N` grudar no grid |
| `F` | Ajustar à tela (na projeção: tela cheia) · `[` `]` tamanho do pincel · `Ctrl Z/Y` desfazer/refazer |
| **Cenas** (barra) | Abrir / trocar o mapa |

## Limites conhecidos

- É um **apresentador de mapas, não um VTT**: sem ficha, token com regra, dado, iniciativa, login, nuvem ou multiplayer remoto. De propósito.
- Roda sobre **Electron/Chromium**: o teto de tamanho de mapa é o do canvas do navegador (~16384×16384 px). Mapas até ~10000×6000 pan/zoom lisos; acima disso pode pesar.
- **Régua e Blackout são só do mestre** na origem; a régua vai à projeção apenas quando você liga o `👁`/`Shift+R`.
- Desempenho de vídeo depende da GPU (mapas animados são decodificados pelo Chromium).

## Arquitetura

Curioso sobre como o fog é renderizado ou como as duas janelas sincronizam? Veja [ARCHITECTURE.md](ARCHITECTURE.md) e [CLAUDE.md](CLAUDE.md).

## Contribuindo

Contribuições são muito bem-vindas, de três jeitos:

- **Pull Request direto no repo** — correções, features e melhorias de UX. Toda PR passa por
  **CI de validação** antes de entrar na `main`. Veja o **[CONTRIBUTING.md](CONTRIBUTING.md)**.
- **Criar e compartilhar sistemas** (Daggerheart, D&D, Ordem, Tormenta…) **sem programar** —
  monte no editor do app, exporte o JSON e compartilhe, ou mande num PR pra `systems.js`.
- **Fork pra versões mais profundas** — quer mods mais complexos, automação ou um rumo
  diferente? Faça um **fork** e leve o projeto pra onde quiser (é MIT).

Regra de ouro do repo principal: é um **apresentador**, **não um VTT** — trackers e referência
são **manuais**, sem automação de regras. Ideias que cruzam essa linha combinam melhor num fork.

## Licença

[MIT](LICENSE) — livre para usar, modificar e compartilhar. Fork do Evermist; veja o [NOTICE](NOTICE) para os créditos (incluindo a fonte Cinzel, OFL-1.1, usada no wordmark).
