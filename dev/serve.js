#!/usr/bin/env node
/* Zero-dependency dev server. Inlines src/index.html into the dev shell so the
   fragment runs exactly as it does when published. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT || 4173);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
                '.css': 'text/css; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
                '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

function page() {
  const shell = fs.readFileSync(path.join(ROOT, 'dev', 'index.html'), 'utf8');
  const frag  = fs.readFileSync(path.join(ROOT, 'src', 'index.html'), 'utf8');
  return shell.replace('<!--#include src/index.html -->', frag);
}

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/' || url === '/index.html') {
    res.writeHead(200, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-store' });
    return res.end(page());
  }
  /* The page references its assets bare (geo.js), the way the Artifact runtime
     serves them — so look in src/ first, then fall back to the repo root. */
  const rel = url.replace(/^\/+/, '');
  const candidates = [path.join(ROOT, 'src', rel), path.join(ROOT, rel)];
  const file = candidates.find(f => f.startsWith(ROOT) && fs.existsSync(f) && !fs.statSync(f).isDirectory());
  if (!file) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => {
  console.log('Our World  →  http://localhost:' + PORT);
  console.log('src/index.html is the page. Edit and reload; no build step.');
});
