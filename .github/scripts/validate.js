// CI validation for PresenceVTT (no build/test framework — this IS the test).
// Checks: index.html inline <script> blocks parse, CSS braces balance, and every
// non-glob package.json build.files entry actually exists on disk.
'use strict';
const fs = require('fs');
const vm = require('vm');
let fail = 0;

const html = fs.readFileSync('index.html', 'utf8');
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
let m, n = 0;
while ((m = re.exec(html))) {
  n++;
  try { new vm.Script(m[1]); }
  catch (e) { console.error('inline <script> #' + n + ' error: ' + e.message); fail = 1; }
}
const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/) || [])[1] || '';
let bal = 0;
for (const c of css) { if (c === '{') bal++; else if (c === '}') bal--; }
if (bal !== 0) { console.error('CSS braces unbalanced by ' + bal); fail = 1; }
console.log('index.html: ' + n + ' inline scripts, css balanced=' + (bal === 0));

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
for (const f of ((pkg.build && pkg.build.files) || [])) {
  if (/[*?]/.test(f)) continue; // skip globs
  if (!fs.existsSync(f)) { console.error('build.files entry missing on disk: ' + f); fail = 1; }
}
console.log(fail ? 'VALIDATION FAILED' : 'validation OK');
process.exit(fail);
