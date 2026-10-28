# Brick Game (vendored)

Source: [Nabeelshar/Retro-Brick-Game](https://github.com/Nabeelshar/Retro-Brick-Game),
MIT licence (see `LICENSE`, copyright 2022 阙开华). Based on chvin/react-tetris.

Built inside the NOMAD Arcade image (`Dockerfile`, stage `brick`) and served at `/brick/`.

Changes for NOMAD:

- `src/components/guide/index.js`: hooks are called before the mobile early
  return (they must run in the same order on every render), and the QR code is
  generated once instead of on every render.
- `src/utils/music.js` and the guide use `window.location` (lint rule that failed the build).
- Removed `src/resource/image/*.gif` and `src/resource/music/music.wav`: README
  demos, not used by the game (14 MB).
