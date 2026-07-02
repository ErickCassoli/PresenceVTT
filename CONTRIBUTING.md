# Contribuindo com o PresenceVTT

Valeu por querer ajudar! 🎲 O **PresenceVTT** é um **apresentador de mapas** com fog of war
para RPG de mesa **presencial** — mapa numa TV/projetor, o mestre controla de outra tela.

## A regra de ouro (leia antes de propor features)

O PresenceVTT **não é um VTT** e não pretende virar um. Duas linhas vermelhas:

- **Sem automação de regras.** Trackers e referência são **manuais**: nada rola dado, aplica
  efeito ou calcula resultado. Se um recurso faz algo automático, ele não entra.
- **1 gesto.** Toda ação central do mestre ao vivo deve ser 1 clique/arraste/atalho, sem
  configuração no meio da cena. Setup fica **fora** da cena.

Se a sua ideia respeita isso, manda ver.

## Rodando o projeto

Sem build step. Precisa de Node.

```bash
npm install
npm start            # abre o app Electron (mestre + projeção)
```

Para gerar o instalador/portátil do Windows: `npm run build` (saída em `dist/`).

## Arquitetura (resumo)

- **JS puro, sem framework, sem bundler.** Nada de ES modules (`import`/`export` quebram em
  `file://`) — só `<script src="...">`. A ordem dos scripts importa.
- Cada **novo recurso = um novo arquivo `.js`** (ex.: `ruler.js`, `tokens.js`, `aoe.js`,
  `soundboard.js`). **Todo `.js` novo precisa entrar em `package.json` → `build.files`**,
  senão não vai no pacote Electron.
- O `<script>` inline gigante do `index.html` é **legado** — não adicione lógica nova nele.
- Veja `CLAUDE.md` para o mapa completo de módulos e as decisões de arquitetura.

## Criando e compartilhando SISTEMAS (o jeito mais fácil de contribuir)

Você **não precisa programar** para contribuir com sistemas de jogo (Daggerheart, D&D,
Ordem Paranormal, Tormenta, o que for):

1. No app: **📖 Regras → ＋ Novo** (ou **✎ Editar** partindo de um preset).
2. Preencha **condições** (menu do token), **bandas de range**, **contadores**, **referência**
   e o **estilo dos trackers** (vida em pontinhos ou número x/x).
3. **Exportar** → gera um `.json`. Compartilhe com a comunidade, ou:
4. Abra um **Pull Request** adicionando seu sistema como preset em `systems.js` (texto de
   referência deve ser **paráfrase original**, não cópia de livro — respeite os direitos das
   editoras).

Sistemas viajam junto no **Perfil** (Cenas → Perfil ⬆/⬇), então dá pra levar tudo pronto
entre PCs e entre pessoas.

## Código

1. Faça um fork e crie um branch (`feat/minha-coisa`).
2. Siga o estilo do código ao redor (comentários, nomes, idioma).
3. Teste rodando o app de verdade (`npm start`), não só na teoria.
4. Abra o PR descrevendo o **gesto** que o recurso adiciona e por que respeita a regra de ouro.

## Bugs e ideias

Abra uma **Issue** com passos pra reproduzir (ou um print). Ideias de sistemas, mapas de
exemplo e melhorias de UX são muito bem-vindas.

## Créditos

PresenceVTT é um fork do **[Evermist](https://github.com/Hinnful/Evermist)** (© Hinnful, MIT).
Ao contribuir, você concorda em licenciar sua contribuição sob a **MIT License** do projeto.
