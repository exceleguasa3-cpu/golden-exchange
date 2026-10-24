// Base44 sandbox preview server for this repository.
//
// This repo is a plain static site (HTML + inline CSS/JS, no build step, no
// package manager), so the preview is served straight from the cloned source
// with Node's built-in modules only — no dependencies to install.
//
// What it does:
//   * serves the repository root on PORT (default 3000), bound to 0.0.0.0
//   * "/" -> Index.html (the GOLDEN.EX trading dashboard), falling back to index.html
//   * "/game.html" (and "/game") -> index.html (the Subway Gold game)
//   * injects a tiny live-reload client into HTML responses, so edits to the
//     source show up in the browser without restarting anything
//
// It accepts any Host/Origin (the sandbox preview is proxied under a hostname
// that changes between environments), so no host allowlist or preview-mode
// branch is needed here.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

const ENTRY = 'Index.html'; // GOLDEN.EX dashboard — the repo's main page
const GAME = 'index.html'; // Subway Gold game

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const RELOAD_CLIENT = `<script>/* base44 live reload */(function(){try{var es=new EventSource('/__base44_reload');es.onmessage=function(){location.reload();};}catch(e){}})();</script>`;

// ---- live reload -----------------------------------------------------------
const listeners = new Set();

function handleReloadStream(req, res) {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-store',
    connection: 'keep-alive',
  });
  res.write(': connected\n\n');
  listeners.add(res);
  req.on('close', () => listeners.delete(res));
}

let reloadTimer = null;
try {
  fs.watch(ROOT, { recursive: true }, (_event, filename) => {
    if (filename && path.relative(ROOT, path.join(ROOT, filename)).startsWith('.git')) return;
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      for (const res of listeners) res.write('data: reload\n\n');
    }, 150);
  });
} catch (err) {
  console.warn('[base44] file watching unavailable:', err.message);
}

// ---- static files ----------------------------------------------------------
function resolveTarget(pathname) {
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (rel === '/' || rel === '') rel = `/${ENTRY}`;
  if (rel === '/game' || rel === '/game.html') rel = `/${GAME}`;

  const full = path.normalize(path.join(ROOT, rel));
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) return null; // path traversal
  const segments = path.relative(ROOT, full).split(path.sep);
  if (segments.some((s) => s.startsWith('.'))) return null; // .git, .base44, dotfiles

  const candidates = [full];
  if (rel === `/${ENTRY}`) candidates.push(path.join(ROOT, GAME)); // entry fallback
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');

  if (pathname === '/__base44_reload') return handleReloadStream(req, res);

  const file = resolveTarget(pathname);
  if (!file) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end(`Not found: ${pathname}\n`);
  }

  const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';

  if (type.startsWith('text/html')) {
    let html = fs.readFileSync(file, 'utf8');
    html = html.includes('</body>')
      ? html.replace(/<\/body>/i, `${RELOAD_CLIENT}</body>`)
      : html + RELOAD_CLIENT;
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
    return res.end(req.method === 'HEAD' ? undefined : html);
  }

  res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`[base44] serving ${ROOT} at http://${HOST}:${PORT} (entry: /${ENTRY}, game: /game.html)`);
});
