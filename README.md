# presenceVTT

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

> O *build* baixa ferramentas do electron-builder na primeira vez (precisa de internet **só pra buildar**). O app **em si** não usa rede nenhuma em runtime.

## Atalhos

Toda ação principal do mestre é **um gesto**. Aperte `?` na janela do mestre pra abrir esta lista.

| Tecla | Ação |
|-------|------|
| `R` | **Régua** (liga/desliga) — mede em células do grid |
| `Shift + R` | **Mostrar a régua aos jogadores** (liga/desliga) |
| `B` | **Blackout** — apaga a projeção na hora (o mestre continua vendo) |
| `Espaço` | **Ir ao vivo** — mostra o estado atual na projeção |
| `Shift + S` | Ir ao vivo no modo manual |
| `G` | Grid liga/desliga · `A` animação do fog · `S` ocultar · `N` grudar no grid |
| `E` / `P` / `C` / `V` | Retângulo · Polígono · Círculo · Selecionar/Mover |
| `F` | Ajustar à tela (na projeção: tela cheia) · `[` `]` tamanho do pincel · `Ctrl Z/Y` desfazer/refazer |
| **Cenas** (barra) | Abrir / trocar o mapa |

*Pincel e Revelar ficam no botão da barra (suas teclas `B`/`R` agora são Blackout/Régua).*

## Limites conhecidos

- É um **apresentador de mapas, não um VTT**: sem ficha, token com regra, dado, iniciativa, login, nuvem ou multiplayer remoto. De propósito.
- Roda sobre **Electron/Chromium**: o teto de tamanho de mapa é o do canvas do navegador (~16384×16384 px). Mapas até ~10000×6000 pan/zoom lisos; acima disso pode pesar.
- **Régua e Blackout são só do mestre** na origem; a régua vai à projeção apenas quando você liga o `👁`/`Shift+R`.
- Desempenho de vídeo depende da GPU (mapas animados são decodificados pelo Chromium).

## Arquitetura

Curioso sobre como o fog é renderizado ou como as duas janelas sincronizam? Veja [ARCHITECTURE.md](ARCHITECTURE.md) e [CLAUDE.md](CLAUDE.md).

## Contribuindo

Quer ajudar — inclusive **criar e compartilhar sistemas** (Daggerheart, D&D, Ordem, Tormenta…), sem programar? Veja o **[CONTRIBUTING.md](CONTRIBUTING.md)**. Regra de ouro: é um **apresentador**, **não um VTT** — trackers e referência são manuais, sem automação de regras.

## Licença

[MIT](LICENSE) — livre para usar, modificar e compartilhar. Fork do Evermist; veja o [NOTICE](NOTICE) para os créditos (incluindo a fonte Cinzel, OFL-1.1, usada no wordmark).
