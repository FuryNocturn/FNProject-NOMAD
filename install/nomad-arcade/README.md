# NOMAD Arcade

Offline single-player games for Project NOMAD, installed from the Supply Depot
(`nomad_arcade`, port 8510). A static React site served by nginx: no server
code and no volumes. Saved games live in each browser's localStorage.

Games:

- Against the computer, three difficulties: tic-tac-toe, connect four, reversi,
  chess (full rules; checked with perft) and Spanish draughts (flying kings,
  compulsory capture of the most pieces).
- Table games against computer players: parchís (four players, Spanish rules),
  partnership dominoes to 100, poker (no-limit Texas Hold'em and Omaha with side
  pots, plus Jacks or Better video poker) and blackjack (double, split). Play chips only.
- Puzzles: sudoku (generated with a single solution, three difficulties),
  minesweeper (three sizes) and 2048.
- Cards and words: Klondike solitaire (draw 1 or 3, undo, auto-finish), word
  search (themed word lists per language) and memory.
- Arcade: snake.

Spanish and English.

## Develop

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # game logic (AI, puzzle generator, minesweeper rules)
npm run build
```

On Windows, start the dev server from this folder. Started from elsewhere
(for example with `npm --prefix`), Vite failed to load `/src`.

## Image

The catalog entry uses a local image until one is published:

```sh
docker build -t nomad-arcade:0.1.0 install/nomad-arcade
```

The build runs the tests, so a broken AI or generator fails the build.
NOMAD's installer uses a local image when it exists and skips the pull.

## Adding a game

1. Put the rules in `src/games/<id>/logic.ts` with a `logic.test.ts` next to them.
2. Put the screen in `src/games/<id>/<Name>.tsx`, using `GameShell` and
   `usePersistentState('<id>', …)`.
3. Add it to `GAMES` in `src/App.tsx`, plus `<id>.name` and `<id>.blurb` in `src/i18n.tsx`.
