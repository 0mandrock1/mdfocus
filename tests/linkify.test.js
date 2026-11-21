'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

// Exercise the functions that the browser executes, without a DOM dependency.
const source = fs.readFileSync(path.join(__dirname, '../web/app.js'), 'utf8');
const start = source.indexOf('  // ---------------------------------------------------------------- URL autolinks');
const end = source.indexOf('  // ----------------------------------------------------------- image viewer', start);
assert.ok(start > 0 && end > start, 'autolink code found');

const document = {
  createTextNode: value => ({ type: 'text', value }),
  createElement: tag => ({ type: tag, href: '', textContent: '' }),
  createDocumentFragment: () => ({ children: [], appendChild(child) { this.children.push(child); } }),
  createTreeWalker: root => {
    let i = -1;
    return {
      currentNode: null,
      nextNode() {
        i++;
        this.currentNode = root.nodes[i] || null;
        return !!this.currentNode;
      },
    };
  },
};
const context = vm.createContext({ document, NodeFilter: { SHOW_TEXT: 4 }, URL });
vm.runInContext(source.slice(start, end), context);
const matches = text => JSON.parse(JSON.stringify(vm.runInContext(`autolinkMatches(${JSON.stringify(text)})`, context)));
const linkify = root => {
  context.root = root;
  vm.runInContext('linkifyTextUrls(root)', context);
};
const textNode = (value, inside = '') => ({
  nodeValue: value,
  parentElement: { closest: () => inside ? {} : null },
  replaceWith(replacement) { this.replacement = replacement; },
});

test('custom schemes and query strings become complete links', () => {
  const value = 'Open craftdocs://open?documentId=a&spaceId=b and obsidian://open?vault=Notes.';
  const links = matches(value);
  assert.deepEqual(links.map(x => x.label), [
    'craftdocs://open?documentId=a&spaceId=b',
    'obsidian://open?vault=Notes',
  ]);
  assert.deepEqual(links.map(x => x.href), links.map(x => x.label));
});

test('web URLs, www, and different custom URI schemes', () => {
  const links = matches('https://example.com/a?x=2 www.example.org/f ftp://files.example.org vscode://file/foo');
  assert.deepEqual(links.map(x => x.href), [
    'https://example.com/a?x=2',
    'https://www.example.org/f',
    'ftp://files.example.org',
    'vscode://file/foo',
  ]);
});

test('punctuation is excluded but balanced URL parentheses are kept', () => {
  const links = matches('(https://en.wikipedia.org/wiki/Function_(mathematics)), [craftdocs://open?x=1].');
  assert.deepEqual(links.map(x => x.label), [
    'https://en.wikipedia.org/wiki/Function_(mathematics)',
    'craftdocs://open?x=1',
  ]);
});

test('incomplete URLs and dangerous schemes stay as plain text', () => {
  assert.deepEqual(matches('javascript://alert(1) data://x file://private blob://foo about://blank https:// www.invalid'), []);
});

test('only eligible text nodes are replaced; existing links and code remain unchanged', () => {
  const plain = textNode('See (craftdocs://open) and https://example.org.');
  const anchor = textNode('craftdocs://open', 'a');
  const code = textNode('craftdocs://open', 'code');
  const pre = textNode('https://example.org', 'pre');
  const root = { nodes: [plain, anchor, code, pre] };
  linkify(root);
  assert.equal(anchor.replacement, undefined);
  assert.equal(code.replacement, undefined);
  assert.equal(pre.replacement, undefined);
  assert.deepEqual(plain.replacement.children.map(x => x.type), ['text', 'a', 'text', 'a', 'text']);
  assert.deepEqual(plain.replacement.children.filter(x => x.type === 'a').map(x => x.href), [
    'craftdocs://open', 'https://example.org',
  ]);
  assert.equal(plain.replacement.children.map(x => x.type === 'text' ? x.value : x.textContent).join(''), plain.nodeValue);
});
