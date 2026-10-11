#!/usr/bin/env node
/* Produces dist/our-world.html — one self-contained file you can open with a
   double-click or host anywhere static. Inlines geo.js and the dev shell.
   This is NOT what you publish to Claude Artifacts: publish src/index.html. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const frag  = fs.readFileSync(path.join(ROOT, 'src', 'index.html'), 'utf8');
const geo   = fs.readFileSync(path.join(ROOT, 'src', 'geo.js'), 'utf8');
const shell = fs.readFileSync(path.join(ROOT, 'dev', 'index.html'), 'utf8');

const inlined = frag.replace(
  /<script src="geo\.js"><\/script>/,
  '<script>\n/* geo.js inlined */\n' + geo + '\n</script>'
);
if (inlined === frag) {
  console.error('WARNING: geo.js script tag not found — check src/index.html');
}

const out = shell.replace('<!--#include src/index.html -->', inlined);
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
const dest = path.join(ROOT, 'dist', 'our-world.html');
fs.writeFileSync(dest, out);
console.log('wrote', dest, (out.length / 1024).toFixed(0) + 'KB');
