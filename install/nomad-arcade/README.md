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
- Arcade: snake, match 3 (striped gems and bombs, levels), garden defence
  (lane defence with sunflowers, pea shooters, walnuts and cherries; our own
  take on the genre) and Simon.
- More solitaires and puzzles: Spider (1, 2 or 4 suits), FreeCell (the classic
  numbered deals #1-32000), mahjong solitaire (always solvable deals), nonograms
  (generated, solvable by logic alone), hangman.
- More board games: the Game of the Goose (2-4 players), Battleship against a
  hunting computer, and Word Tiles, a crossword tile game against the computer.
- Brick Game: the handheld classic (Tetris, Breakout, racing, snake, tanks),
  vendored from [Retro-Brick-Game](https://github.com/Nabeelshar/Retro-Brick-Game)
  (MIT) and served at `/brick/`. See `vendor/brick-game/NOMAD.md`.

Spanish and English.

## Third-party content

- Word Tiles dictionaries: `an-array-of-spanish-words` and
  `an-array-of-english-words` (MIT). `scripts/build-words.mjs` turns them into
  `public/words/<lang>.txt` on `npm run dev` / `npm run build` (not committed).
- Brick Game: see above.

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
