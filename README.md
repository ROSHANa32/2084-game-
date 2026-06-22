# Fusion — Number Merge Puzzle

A calming, mobile-first number puzzle. Swipe to slide tiles; when two tiles
with the same number touch, they **fuse** into their sum. Keep merging to reach
the **2048** tile — then keep going for a high score.

> Fusion is an original game inspired by the classic sliding-merge genre.
> It ships with its own branding, artwork, and code — no third-party assets.

## Features

- **Mobile-first**: swipe controls, responsive board, safe-area aware, no zoom jank.
- **Smooth animations**: tiles slide, spawn, and pop on merge.
- **Undo**: step back up to 20 moves.
- **Auto-save**: your board, score, and best score persist locally (offline-friendly).
- **Installable PWA**: add to home screen and play offline.
- **Keyboard support**: arrow keys or `W` `A` `S` `D`.
- **Zero dependencies, zero build step** — pure HTML, CSS, and JavaScript.

## How to play

1. Swipe (or press arrow keys / `WASD`) to move all tiles in one direction.
2. Two tiles with the same number merge into one tile of double the value.
3. A new tile (2 or 4) appears after every move.
4. Reach **2048** to win — keep playing for an even higher score.
5. The game ends when the board is full and no merges are possible.

## Run locally

It's a static site, so any static server works:

```bash
# Python
python3 -m http.server 8080

# or Node
npx serve .
```

Then open `http://localhost:8080`.

> A server (not opening the file directly) is recommended so the service worker
> and PWA manifest load correctly.

## Publish

Because it's fully static, you can deploy the folder as-is to:

- **GitHub Pages** — push to a repo and enable Pages on the branch root.
- **Netlify / Vercel / Cloudflare Pages** — drag-and-drop or connect the repo.

No build configuration is required.

## Project structure

```
.
├── index.html          # markup + PWA wiring
├── styles.css          # mobile-first UI, themes, animations
├── manifest.json       # PWA manifest
├── sw.js               # service worker (offline cache)
├── js/
│   ├── game.js         # framework-free game engine
│   └── app.js          # rendering, input, persistence
└── icons/              # app icons (svg + png)
```

## License

MIT — see `LICENSE`.
