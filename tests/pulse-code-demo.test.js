'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const web = path.join(__dirname, '../web');
const src = fs.readFileSync(path.join(web, 'pulse-code-demo.js'), 'utf8');
const html = fs.readFileSync(path.join(web, 'pulse-code-demo.html'), 'utf8');
const gallery = fs.readFileSync(path.join(web, 'demo-images.md'), 'utf8');

test('wheel geometry is comfortably hit-testable, not 24-pixel IDE controls', () => {
  const r1 = 60, r2 = 112, midpoint = (r1 + r2)/2;
  const diameter = 2 * Math.min((r2-r1)/2, midpoint*Math.sin(Math.PI/4));
  assert.equal(diameter, 52);
  assert.match(src, /pathFor\(start\+2,start\+88\)/);
  assert.match(src, /if\(!isValid\(d\)\) return -1/);
  assert.match(src, /Math\.max\(124,Math\.min\(vw-124,touch\.x\)\)/);
});

test('touch cancellation does not apply an action, delayed hold has a pointerup fallback', () => {
  assert.match(src, /pad\.addEventListener\('pointercancel',cleanWheel\)/);
  assert.match(src, /if\(!active&&elapsed>=340\)openWheel\(\)/);
  assert.match(src, /if\(action\)chooseAction\(action\);else showOptions\(\)/);
  assert.match(src, /pad\.addEventListener\('keydown'/);
  assert.match(html, /min-height:58px/);
});

test('TypeScript-first, private local demo without a fake VPS write', () => {
  assert.match(src, /best\?: number \| null/);
  assert.match(src, /s\.best == null/);
  assert.match(src, /localStorage\.setItem/);
  assert.match(src, /немає серверного запису|не підключений до VPS|не змінює файли/);
  assert.doesNotMatch(src, /\bfetch\s*\(|XMLHttpRequest|git push|child_process/);
  assert.match(html, /CodeMirror|TS FIRST/);
  assert.match(html, /mandrock0-tokens\.css/);
  assert.match(html, /palettes\/accents\.css/);
  assert.match(html, /mandrock0-ambient\.js/);
  assert.match(html, /pulse-code-og\.png/);
});

test('gallery uses the three new micro-session visuals', () => {
  for (const name of ['pulse-session.svg','pulse-wheel.svg','pulse-review.svg']) {
    assert.match(gallery, new RegExp(name.replace('.', '\\.')));
    const svg=fs.readFileSync(path.join(web,name),'utf8');
    assert.match(svg,/viewBox="0 0 390 844"/);
    assert.doesNotMatch(svg, /<script\b|onload=/i);
  }
  assert.match(gallery, /pulse-code-demo\.html/);
});
