#!/usr/bin/env node
/* Extracts every inline <script> from src/index.html and syntax-checks it,
   plus geo.js. Run before publishing — there is no compiler to catch you. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let bad = 0;

function check(label, code) {
  try { new vm.Script(code, { filename: label }); console.log('  ok   ' + label); }
  catch (e) { bad++; console.error('  FAIL ' + label + ' — ' + e.message); }
}

const html = fs.readFileSync(path.join(ROOT, 'src', 'index.html'), 'utf8');
const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
console.log('inline scripts in src/index.html: ' + blocks.length);
blocks.forEach((b, i) => check('src/index.html #' + (i + 1), b));
check('src/geo.js', fs.readFileSync(path.join(ROOT, 'src', 'geo.js'), 'utf8'));

// geography pack must decode
const g = {};
new vm.Script(fs.readFileSync(path.join(ROOT, 'src', 'geo.js'), 'utf8'))
  .runInNewContext({ window: g, btoa: s => Buffer.from(s, 'binary').toString('base64'),
                     atob: s => Buffer.from(s, 'base64').toString('binary') });
const ok = g.OW_GEO && g.OW_GEO.states.length && g.OW_TOWNS.length && g.OW_AREAS.length;
console.log(ok ? '  ok   geography pack: ' + g.OW_GEO.states.length + ' states, ' +
  g.OW_AREAS.length + ' areas, ' + g.OW_TOWNS.length + ' towns, ' +
  g.OW_ROUTES.length + ' routes' : '  FAIL geography pack did not load');
if (!ok) bad++;

process.exit(bad ? 1 : 0);
