const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const md = fs.readFileSync(path.join(root, 'web/demo-images.md'), 'utf8');
const imageNames = ['pulse-session.svg', 'pulse-wheel.svg', 'pulse-review.svg'];

test('each concept image is linked and remains valid SVG', () => {
  for (const name of imageNames) {
    assert.ok(md.includes(`](./${name})`), `missing link: ${name}`);
    const svg = fs.readFileSync(path.join(root, 'web', name), 'utf8');
    assert.match(svg, /viewBox="0 0 390 844"/);
    assert.doesNotMatch(svg, /<script|onload=|<foreignObject/i);
    const r = spawnSync('python3', ['-c', 'import xml.etree.ElementTree as E,sys;E.parse(sys.argv[1])',path.join(root,'web',name)], { encoding:'utf8' });
    assert.equal(r.status, 0, r.stderr);
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
