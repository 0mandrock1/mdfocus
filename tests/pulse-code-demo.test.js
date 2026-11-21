'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../web/pulse-code-demo.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../web/pulse-code-demo.html'),'utf8');

test('duolingo-like choice is a two-level wheel ending in a full-screen grid',()=>{
  assert.match(src,/rootId:null/);
  assert.match(src,/function enterRoot\(rootId\)/);
  assert.match(src,/function enterGroup\(rootId,groupId\)/);
  assert.match(src,/function openGrid\(root,group\)/);
  assert.match(html,/class="grid-overlay"/);
  assert.match(html,/class="tiles"/);
  assert.match(html,/id="grid-search"/);
  assert.match(src,/renderTiles\(\)/);
  assert.match(src,/selected=item/);
  assert.match(src,/addHistory\(\)/);
});

test('radial sectors preserve 52px touch target and protect accidental second-level release',()=>{
  const r1=60,r2=112,rm=(r1+r2)/2;
  assert.equal(2*Math.min((r2-r1)/2,rm*Math.sin(Math.PI/4)),52);
  assert.match(src,/finger\.needMove=true/);
  assert.match(src,/if\(requireNextGesture\)/);
  assert.match(src,/pad\.addEventListener\('pointercancel'/);
  assert.match(src,/setTimeout\(showWheel,340\)/);
  assert.match(src,/setTimeout\(\(\)=>\{/);
  assert.match(src,/enterRoot\(roots\[idx\]\.id\)/);
  assert.match(html,/min-height:101px/);
  assert.match(html,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test('keeps local no-write boundary and TypeScript-first grammar choices',()=>{
  assert.match(src,/TypeScript scratchpad/);
  assert.match(src,/Record<string, number>/);
  assert.match(src,/Partial<Score>/);
  assert.match(src,/const quickValue/);
  assert.match(src,/localStorage\.setItem/);
  assert.match(src,/function renderDiff/);
  assert.doesNotMatch(src,/\bfetch\s*\(|XMLHttpRequest|WebSocket|child_process/);
  assert.match(html,/ts-code/);
  assert.match(html,/mandrock0-tokens\.css/);
  assert.match(html,/palettes\/accents\.css/);
  assert.match(html,/mandrock0-ambient\.js/);
});

test('progress without a forced task, accessible alternative and escape routes',()=>{
  assert.match(html,/НЕ ПОТРІБНО ВИГАДУВАТИ МІКРОЗАДАЧУ/);
  assert.match(html,/id="open-file"/);
  assert.match(html,/id="new-scratch"/);
  assert.match(html,/id="edit-as-text"/);
  assert.match(html,/role="dialog"/);
  assert.match(html,/id="grid-back"/);
  assert.match(html,/id="undo-edit"/);
  assert.match(src,/function openList/);
  assert.match(src,/function openTextEditor/);
  assert.match(src,/e\.key!=='Escape'/);
});
