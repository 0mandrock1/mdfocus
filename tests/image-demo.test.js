const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const md = fs.readFileSync(path.join(root, 'web/demo-images.md'), 'utf8');
const imageNames = ['pulse-v3-home.png', 'pulse-v3-wheel.png', 'pulse-v3-grid.png'];

test('each UX screenshot is linked and remains valid PNG', () => {
  for (const name of imageNames) {
    assert.ok(md.includes(`](./${name})`), `missing link: ${name}`);
    const svg = fs.readFileSync(path.join(root, 'web', name));
    assert.equal(svg.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.ok(svg.length>20000);
  }
});

test('Markdown image source resolves against the remote document URL', () => {
  const base = 'https://tools.mandrock.me/mdfocus/demo-images.md';
  for (const name of imageNames) {
    const url = new URL(`./${name}`, base);
    assert.equal(url.href, `https://tools.mandrock.me/mdfocus/${name}`);
    assert.equal(url.protocol, 'https:');
  }
});

test('image dialog and source link are wired into the page', () => {
  const html = fs.readFileSync(path.join(root,'web/index.html'),'utf8');
  const js = fs.readFileSync(path.join(root,'web/app.js'),'utf8');
  assert.match(html, /id="mdfocus-image-viewer"/);
  assert.match(html, /id="mdfocus-image-source"/);
  assert.match(js, /imageViewer\.showModal\(\)/);
  assert.match(js, /enhanceImages\(article, sourceUrl\)/);
  assert.match(js, /loadMarkdown\(text, url\)/);
});
