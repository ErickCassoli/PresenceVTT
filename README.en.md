# presenceVTT

*[Português](README.md) · **English***

**A map presenter with _fog of war_ for in-person tabletop RPGs.**

Put the map on a TV/projector and reveal the scene live from a second screen — the GM controls, the players only see what you want.

![Revealing fog on the players' screen](assets/reveal.gif)

[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

> **Not a full VTT.** No character sheets, no rules-bearing tokens, no dice, no initiative, no login, no cloud, no remote multiplayer. It does one thing — show a map and hide parts of it — and does it well.

> **Fork of [Evermist](https://github.com/Hinnful/Evermist)** (MIT, © 2026 Hinnful). The original credit is kept in [NOTICE](NOTICE) and [LICENSE](LICENSE).

## What it does

### Two screens in sync
A **master** window with all the controls and a clean **projection** window — no buttons, no cursor, just the map. Drag the projection to the TV, go full screen, and the table only sees what you agreed to show.

Reveal a room on your laptop and it appears on the TV instantly. Or use manual mode: prep the next reveal in secret and push it with **Go live** when the party crosses the door.

### Living fog of war
The fog is soft, with clouds that drift slowly — not a flat black. You uncover the map as the scene calls for: **Brush**, **Rectangle**, **Circle**, **Polygon**, **Reveal/Hide**, and **Select** to edit later.

### Distance ruler
Measure distance in **grid cells** right on the map. Rulers act like annotations, snap to a cell's center/corner/edge, and you can **show them to players** with a toggle.

### Instant blackout
Kill the projection instantly with **B** (or the ⬛ button). The players' screen goes black; the GM keeps seeing everything.

### Moving maps, grid, scenes
Animated maps (MP4/WebM), an adjustable square or hex grid, and multiple scenes with smooth transitions between them. Handles large maps (10000×6000) with smooth pan/zoom.

> **Tip:** press `?` in the master window to see every shortcut.

### Tokens to track the minis
Mark where each mini is on the map: anchor-tokens with **color, name and a PNG/JPG portrait** to line up on the grid, **conditions** (icons the players can see) and **range bands** — all mirrored on the projection. It's visual tracking, not a character sheet.

### Areas (AoE)
Burst, cone, line and emanation measured in **cells**: drag to create, then **move and resize**. Purely visual, shown at the table.

### Markings: ping, trace, scribble
Draw attention with a **ping**, leave a **trace** that fades on its own, or a **scribble** that stays until cleared. On top of the map, synced to the projection.

### Rules tab (GM-only)
A **searchable** reference (conditions, ranges, damage tables, GM moves) + **manual trackers**: Fear, countdowns and **adversary HP**. Nothing rolls dice or calculates — it's a presenter, **not a VTT**.

### Swappable, editable game systems
Ships with **Daggerheart, D&D 5e and Ordem Paranormal**. Switch in one click (changes conditions, ranges, reference and tracker styling) and **build your own inside the app**, no coding. Export and import systems as **JSON** to share with the community.

### Soundboard
**Ambience** pads (loop with crossfade) and **one-shots** over the top (door, sword, thunder), with shortcuts, per-pad volume, a **panic button** and an option to play sound **through the table screen**.

### Portable profile
Export **scenes + sounds + systems** in a single `.zip` and carry your set-up table to another PC or share it with another GM.

### Two languages
The whole UI is available in **English and Portuguese**, switchable in a click via the **PT / EN** toggle in the top-left corner. It defaults to your browser/OS language and remembers your choice.

## Running from source

No build step — it's plain JavaScript in an Electron shell.

```bash
npm install     # once, after cloning
npm start       # opens the app
```

## Building the executable

```bash
npm run build         # Windows: NSIS installer + portable .exe
npm run build:mac     # macOS .dmg
npm run build:linux   # Linux AppImage
```

The result lands in the **`dist/`** folder:

| OS | File | How to run |
|---------|---------|-----------|
| Windows | `presenceVTT-Setup-<version>.exe` | Installer (auto-updates). Also `presenceVTT-Portable-<version>.exe` — double-click, no install, keeps a copyable `presencevtt-data/` folder next to it. |
| macOS | `presenceVTT.dmg` | Universal (Intel + Apple Silicon). |
| Linux | `presenceVTT.AppImage` | `chmod +x` and run. |

The app is **unsigned** (certificates cost money), so on first launch the OS shows a security warning: on Windows, "More info" → "Run anyway".

> The *build* downloads electron-builder tools the first time (internet needed **only to build**). The app **itself** uses no network at runtime, except the optional update check below.

## Updates

The installed **Windows (NSIS installer)** and **Linux (AppImage)** builds check for a new release on GitHub at launch, download it in the background, and offer a **Restart and update** button in the master window. The Windows *portable* build and unsigned macOS don't auto-update — re-download those from the [Releases](https://github.com/ErickCassoli/PresenceVTT/releases) page.

## Shortcuts

Every main GM action is **one gesture**. Press `?` in the master window to open this list.

| Key | Action |
|-------|------|
| `1` `2` `3` `4` `5` | **Select/Move · Brush · Rectangle · Circle · Polygon** (letters `V`/`E`/`C`/`P` still work) |
| `S` | Toggle **Reveal / Hide** |
| `R` | **Ruler** — measure in grid cells · `T` **Token** |
| `Shift + R` | **Show the ruler to players** (on/off) |
| `B` | **Blackout** — kill the projection instantly (the GM keeps seeing) |
| `Space` | **Go live** — show the current state on the projection · `Shift + S` go live in manual mode |
| `G` | Grid on/off · `A` fog animation · `N` snap to grid |
| `F` | Fit to screen (on the projection: full screen) · `[` `]` brush size · `Ctrl Z/Y` undo/redo |
| **Scenes** (toolbar) | Open / switch the map |

## Known limits

- It's a **map presenter, not a VTT**: no character sheets, rules-bearing tokens, dice, initiative, login, cloud or remote multiplayer. On purpose.
- Runs on **Electron/Chromium**: the map-size ceiling is the browser canvas one (~16384×16384 px). Maps up to ~10000×6000 pan/zoom smoothly; above that it can get heavy.
- **Ruler and Blackout are GM-only** by origin; the ruler reaches the projection only when you enable `👁`/`Shift+R`.
- Video performance depends on the GPU (animated maps are decoded by Chromium).

## Architecture

Curious how the fog is rendered or how the two windows sync? See [ARCHITECTURE.md](ARCHITECTURE.md) and [CLAUDE.md](CLAUDE.md).

## Contributing

Contributions are very welcome, in three ways:

- **Pull Request straight to the repo** — fixes, features and UX improvements. Every PR goes through **validation CI** before landing on `main`. See **[CONTRIBUTING.md](CONTRIBUTING.md)**.
- **Create and share systems** (Daggerheart, D&D, Ordem, Tormenta…) **without coding** — build them in the app's editor, export the JSON and share it, or send a PR to `systems.js`.
- **Fork for deeper versions** — want more complex mods, automation or a different direction? **Fork** it and take the project wherever you like (it's MIT).

Golden rule of the main repo: it's a **presenter**, **not a VTT** — trackers and reference are **manual**, no rules automation. Ideas that cross that line fit better in a fork.

## License

[MIT](LICENSE) — free to use, modify and share. Fork of Evermist; see [NOTICE](NOTICE) for credits (including the Cinzel font, OFL-1.1, used in the wordmark).
