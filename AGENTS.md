# Notes for working on this repo

## What this repo is
A **static site** — two self-contained HTML pages, no build step, no package
manager, no backend, no database:

| Path | Page | Notes |
| --- | --- | --- |
| `Index.html` | GOLDEN.EX trading dashboard | The repo's main page; served at `/` |
| `index.html` | Subway Gold (canvas game) | Served at `/game.html` |

Note the two files differ only by letter case. Keep them distinct — a rename or
a case-insensitive checkout will either collide them or shadow one of them.

## Running it (Base44 sandbox)
```bash
docker compose -f docker-compose.base44.yml up -d --build
docker compose -f docker-compose.base44.yml ps
curl -fsS http://localhost:3000/ | grep -o '<title>.*</title>'   # GOLDEN EXCHANGE PRO
curl -fsS http://localhost:3000/game.html | grep -o '<title>.*</title>'  # Subway Gold
```
`.base44/preview-server.mjs` serves the repo root on port 3000 using Node
built-ins only (no install step) and injects a live-reload client into HTML
responses, so edits appear without a restart. It answers `/` with `Index.html`
(falling back to `index.html`), maps `/game.html` to `index.html`, refuses dot
directories, and accepts any Host/Origin — the sandbox hostname changes between
environments, so no allowlist is needed and no preview-mode branch is required
(`BASE44_PREVIEW_MODE` is passed through to the container but unused).

No secrets or external credentials are needed to boot the site.

## Known gaps in the source
These are pre-existing and unrelated to the sandbox setup:

* `Index.html` was saved from a browser (`saved from url=http://127.0.0.1:5500/index.html`),
  but the scraped asset folder `GOLDEN EXCHANGE PRO_files/` was never committed.
  Consequently: `<script src="./GOLDEN EXCHANGE PRO_files/tv.js.download">` 404s,
  so `new TradingView.widget(...)` throws a `ReferenceError` that aborts the
  page's inline script — the chart panel is blank and the Binance price feed
  (`wss://stream.binance.com:9443/ws/paxgusdt@ticker`) never starts, so the price
  stays "Loading..." and the BUY/SELL buttons do nothing.
* The same page expects a WebSocket trading engine at `ws://localhost:3000`
  (portfolio responses of `{status:'SUCCESS', portfolio:{balance, gold}}`).
  No such backend exists in this repo. It would also have to be same-origin
  `wss://` to work through the preview proxy, which serves over https.

## How to check a change
Static pages: reload `/` and `/game.html` and confirm the page renders (the game
starts a run when START RUN is clicked and its score increases). There is no test
suite to run.
