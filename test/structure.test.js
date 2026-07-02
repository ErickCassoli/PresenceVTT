// Structural / regression tests for PresenceVTT — run with `node --test`.
//
// The app has no unit-testable core yet (browser-coupled globals; decoupling is
// an ongoing goal, see CLAUDE.md). Until then these guard the things that
// actually break in practice: a script that doesn't parse, an unbalanced <style>
// block, and — the classic footgun — a new .js loaded by index.html but not
// added to package.json build.files (so it silently ships broken in Electron).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const buildFiles = ((pkg.build && pkg.build.files) || []);

const coveredByBuildFiles = (rel) =>
  buildFiles.some((f) => f === rel || (f.includes('*') && rel.startsWith(f.split('*')[0])));

test('index.html inline <script> blocks parse', () => {
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  let n = 0;
  while ((m = re.exec(html))) {
    n++;
    assert.doesNotThrow(() => new vm.Script(m[1]), `inline <script> #${n} failed to parse`);
  }
  assert.ok(n > 0, 'expected at least one inline script in index.html');
});

test('index.html <style> braces are balanced', () => {
  const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/) || [])[1] || '';
  let bal = 0;
  for (const c of css) {
    if (c === '{') bal++;
    else if (c === '}') bal--;
  }
  assert.strictEqual(bal, 0, `CSS braces unbalanced by ${bal}`);
});

test('every non-glob build.files entry exists on disk', () => {
  const missing = buildFiles.filter((f) => !/[*?]/.test(f) && !fs.existsSync(path.join(root, f)));
  assert.deepStrictEqual(missing, [], `build.files entries missing on disk: ${missing.join(', ')}`);
});

test('every <script src> module is packaged in build.files', () => {
  const re = /<script[^>]*\bsrc=["']([^"']+)["']/g;
  let m;
  const notPackaged = [];
  while ((m = re.exec(html))) {
    const src = m[1];
    if (/^https?:/i.test(src) || src.startsWith('//')) continue; // external, N/A
    const rel = src.replace(/^\.\//, '');
    if (!coveredByBuildFiles(rel)) notPackaged.push(rel);
  }
  assert.deepStrictEqual(notPackaged, [], `scripts loaded by index.html but absent from build.files: ${notPackaged.join(', ')}`);
});

test('all top-level .js modules parse', () => {
  const failed = [];
  for (const f of fs.readdirSync(root)) {
    if (!f.endsWith('.js')) continue;
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    try {
      new vm.Script(src); // parse only — does not execute require()/browser code
    } catch (e) {
      failed.push(`${f}: ${e.message}`);
    }
  }
  assert.deepStrictEqual(failed, [], `modules failed to parse:\n${failed.join('\n')}`);
});
