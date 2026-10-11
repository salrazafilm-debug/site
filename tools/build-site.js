#!/usr/bin/env node
/* Produces docs/index.html — the static site GitHub Pages serves.

   One self-contained file: the fragment from src/index.html with src/geo.js
   inlined, wrapped in tools/site-shell.html. The shell sets window.__OW_PUBLIC
   so the app explains its offline state as "the open build" rather than as a
   broken connection, and it loads no runtime stub: window.claude is simply
   absent, which is the path the app already handles.

   Fonts come from Google Fonts over the network. Everything else is in the file. */
const fs = require('fs');
const path = require('path');

const ROOT  = path.join(__dirname, '..');
const frag  = fs.readFileSync(path.join(ROOT, 'src', 'index.html'), 'utf8');
const geo   = fs.readFileSync(path.join(ROOT, 'src', 'geo.js'), 'utf8');
const shell = fs.readFileSync(path.join(ROOT, 'tools', 'site-shell.html'), 'utf8');

const inlined = frag.replace(
  /<script src="geo\.js"><\/script>/,
  '<script>\n/* geo.js inlined at build time */\n' + geo + '\n</script>'
);
if (inlined === frag) {
  console.error('ERROR: geo.js script tag not found in src/index.html');
  process.exit(1);
}

/* Nothing personal is allowed into the public build. */
const leaks = [/_blob\/[0-9a-f]{8}/, /assetId:\s*'[0-9a-f]{8}/];
for (const re of leaks) {
  if (re.test(inlined)) {
    console.error('ERROR: build contains a photo reference (' + re + '). Refusing to write.');
    process.exit(1);
  }
}

const out = shell.replace('<!--#include src/index.html -->', inlined);
fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
const dest = path.join(ROOT, 'docs', 'index.html');
fs.writeFileSync(dest, out);
fs.writeFileSync(path.join(ROOT, 'docs', '.nojekyll'), '');
console.log('wrote', dest, (out.length / 1024).toFixed(0) + 'KB');
