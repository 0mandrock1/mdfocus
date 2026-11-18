/* mdfocus: client-side markdown reader with attention-pacing "tokens".
 * "Tokens" here means a focus/concentration technique. Reading state lives
 * in browser localStorage; nothing
 * is persisted server-side except the SSRF-guarded URL fetch proxy. */
(function () {
  'use strict';

  var article = document.getElementById('article');
  var readerWrap = article.parentElement;
  var sourcePanel = document.getElementById('source-panel');
  var resetRow = document.getElementById('reset-row');
  var statusLine = document.getElementById('status-line');
  var progressRail = document.getElementById('progress-rail');
  var progressFill = document.getElementById('progress-fill');
  var tokenControls = document.getElementById('token-controls');
  var resumeBtn = document.getElementById('tc-resume');
  var outline = document.getElementById('reader-outline');
  var outlineList = document.getElementById('reader-outline-list');
  var settings = document.getElementById('reader-settings');
  var previousBtn = document.getElementById('reader-prev');
  var nextBtn = document.getElementById('reader-next');
  var pacedBtn = document.getElementById('reader-paced');
  var locationLabel = document.getElementById('reader-location');
  var sourceRequest = 0;

  // ---------------------------------------------------------------- tabs
  document.querySelectorAll('.src-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.src-tab').forEach(function (t) { t.classList.remove('active'); });
      document.querySelectorAll('.src-pane').forEach(function (p) { p.classList.remove('active'); });
      tab.classList.add('active');
      document.getElementById(tab.getAttribute('data-pane')).classList.add('active');
      setStatus('');
    });
  });

  function setStatus(msg, isError) {
    statusLine.textContent = msg || '';
    statusLine.classList.toggle('error', !!isError);
  }

  // ---------------------------------------------------------------- hash
  // Keep existing reading positions addressable by the same document key.
  function hashText(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    }
    return 'doc' + (h >>> 0).toString(36) + '_' + str.length;
  }

  // ---------------------------------------------------------------- load
  document.getElementById('paste-load-btn').addEventListener('click', function () {
    var text = document.getElementById('paste-area').value;
    if (!text.trim()) { setStatus('порожній текст', true); return; }
    sourceRequest++;
    loadMarkdown(text);
  });

  document.getElementById('file-input').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var request = ++sourceRequest;
    var reader = new FileReader();
    reader.onload = function () { if (request === sourceRequest) loadMarkdown(String(reader.result || '')); };
    reader.onerror = function () { if (request === sourceRequest) setStatus('не вдалося прочитати файл', true); };
    reader.readAsText(file);
  });

  document.getElementById('url-load-btn').addEventListener('click', function () {
    var url = document.getElementById('url-input').value.trim();
    if (!url) { setStatus('вкажи URL', true); return; }
    var request = ++sourceRequest;
    setStatus('завантаження…');
    fetch('api/fetch?url=' + encodeURIComponent(url))
      .then(function (r) {
        return r.text().then(function (body) {
          if (!r.ok) throw new Error(body || ('http ' + r.status));
          return body;
        });
      })
      .then(function (text) {
        if (request === sourceRequest) loadMarkdown(text);
      })
      .catch(function (e) {
        if (request === sourceRequest) setStatus('помилка завантаження: ' + e.message, true);
      });
  });

  document.getElementById('reset-btn').addEventListener('click', function () {
    sourceRequest++;
    teardownReading();
    teardownLineFocus();
    teardownSkimAmbient();
    teardownBionic();
    teardownTables();
    article.classList.remove('visible');
    article.replaceChildren();
    sourcePanel.style.display = '';
    resetRow.style.display = 'none';
    document.getElementById('paste-area').value = '';
    document.getElementById('url-input').value = '';
    document.getElementById('file-input').value = '';
    setStatus('');
    article.classList.remove('reading-lane');
    document.body.classList.remove('reading-wide');
    stopNoise(true);
    document.getElementById('tc-noise-on').checked = false;
    window.scrollTo(0, 0);
    document.querySelector('.src-tab.active').focus({ preventScroll: true });
  });

  // ---------------------------------------------------------------- render
  function loadMarkdown(raw) {
    if (typeof marked === 'undefined') {
      setStatus('marked.js ще не завантажився, спробуй ще раз за секунду', true);
      return;
    }
    teardownReading();
    teardownLineFocus();
    teardownTables();
    article.innerHTML = marked.parse(raw);
    wrapTables(article);
    var parts = buildSections(article);
    if (!parts.length) {
      setStatus('немає тексту для читання', true);
      return;
    }
    setStatus('');
    article.classList.add('visible');
    sourcePanel.style.display = 'none';
    resetRow.style.display = '';
    prepareBionic(article);
    applyReadingPrefs();
    window.scrollTo(0, 0);
    setupReading(parts, hashText(raw));
    setupLineFocus(parts);
    setupSkimAmbient();
    article.focus({ preventScroll: true });
  }

  // mdfocus:tables — wrap every rendered <table> in a scrollable container so
  // a wide table scrolls within itself instead of stretching the page. Runs
  // right after innerHTML is set, before buildSections() groups top-level
  // children, so the wrapper <div> (not the <table>) becomes the section
  // child — it never matches LINE_FOCUS_SELECTOR and is not picked up as a
  // focusable block.
  var tableObserver = null;
  function wrapTables(container) {
    var tables = Array.prototype.slice.call(container.querySelectorAll('table'));
    if (!tables.length) return;
    tableObserver = new ResizeObserver(function (entries) {
      entries.forEach(function (entry) {
        updateTable(entry.target.closest('.table-wrap'));
      });
    });
    tables.forEach(function (table) {
      var wrap = document.createElement('div');
      wrap.className = 'table-wrap';
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
      wrap.addEventListener('scroll', function () { updateTable(wrap); }, { passive: true });
      tableObserver.observe(wrap);
      tableObserver.observe(table);
    });
  }

  function updateTable(wrap) {
    var max = wrap.scrollWidth - wrap.clientWidth;
    wrap.classList.toggle('can-scroll-r', max > 1 && wrap.scrollLeft < max - 1);
    wrap.classList.toggle('can-scroll-l', wrap.scrollLeft > 1);
  }

  function teardownTables() {
    if (tableObserver) tableObserver.disconnect();
    tableObserver = null;
  }

  // ---------------------------------------------------------------- reading navigation
  var reading = null;
  var WORDS_PER_PART = 450;
  var HEADING = /^H[1-6]$/;

  function buildSections(container) {
    var parts = [];
    var part = null;
    Array.from(container.childNodes).forEach(function (node) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
        var paragraph = document.createElement('p');
        node.replaceWith(paragraph);
        paragraph.appendChild(node);
        node = paragraph;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      var isHeading = HEADING.test(node.tagName);
      if (!part || isHeading || part.words >= WORDS_PER_PART) {
        var section = document.createElement('section');
        section.className = 'mdfocus-section';
        section.tabIndex = -1;
        container.insertBefore(section, node);
        if (isHeading) node.tabIndex = -1;
        part = {
          element: section,
          heading: isHeading ? node : null,
          words: 0,
          precedingWords: part ? part.precedingWords + Math.max(1, part.words) : 0,
          blocks: [],
        };
        parts.push(part);
      }
      var value = node.textContent.trim();
      part.words += value ? value.split(/\s+/u).length : 0;
      part.element.appendChild(node);
    });
    return parts;
  }

  function ambientReseed(idx) {
    if (!window.mandrock0Ambient || typeof window.mandrock0Ambient.reseed !== 'function') return;
    var script = document.querySelector('script[data-seed]');
    if (!script) return;
    var seed = parseInt(script.getAttribute('data-seed'), 10);
    if (isNaN(seed)) return;
    try { window.mandrock0Ambient.reseed((seed + idx) >>> 0); } catch (e) { /* ignore */ }
  }

  // Positions are in DOM order. Only inspect the elements near the viewport.
  function indexAtY(items, y, element) {
    var first = 0;
    var last = items.length - 1;
    while (first < last) {
      var middle = Math.ceil((first + last) / 2);
      if (element(items[middle]).getBoundingClientRect().top <= y) first = middle;
      else last = middle - 1;
    }
    return first;
  }

  function partElement(part) { return part.element; }
  function sameElement(element) { return element; }
  function readingLine() { return Math.min(88, window.innerHeight * 0.2); }
  function readingBottom() { return tokenControls.getBoundingClientRect().top - 8; }
  function clampUnit(value) { return Math.min(1, Math.max(0, value)); }

  function partIndex(state) {
    if (state.paced || state.jumpY === window.scrollY) return state.index;
    var rect = article.getBoundingClientRect();
    if (window.scrollY > 0 && rect.bottom <= readingBottom()) return state.parts.length - 1;
    return indexAtY(state.parts, readingLine() + 1, partElement);
  }

  function updateReading(state) {
    var index = partIndex(state);
    var part = state.parts[index];
    var rect = (state.paced ? part.element : article).getBoundingClientRect();
    var bottom = readingBottom();
    var progress = 1;
    if (rect.bottom > bottom) {
      progress = clampUnit((readingLine() - rect.top) / Math.max(1, rect.height - bottom + readingLine()));
    }
    if (state.paced) {
      var last = state.parts[state.parts.length - 1];
      var totalWords = last.precedingWords + Math.max(1, last.words);
      progress = (part.precedingWords + progress * Math.max(1, part.words)) / totalWords;
    }
    var percent = Math.round(progress * 100);
    if (percent !== state.percent) {
      state.percent = percent;
      progressFill.style.width = percent + '%';
      progressRail.setAttribute('aria-valuenow', String(percent));
    }
    if (index !== state.shownIndex) {
      if (state.shownIndex !== null) state.entries[state.shownIndex].removeAttribute('aria-current');
      state.entries[index].setAttribute('aria-current', 'location');
      previousBtn.disabled = index === 0;
      nextBtn.disabled = index === state.parts.length - 1;
      if (!document.body.classList.contains('reader-quiet')) ambientReseed(index + 1);
      state.shownIndex = index;
    }
    var label = (index + 1) + '/' + state.parts.length + ' · ' + percent + '%';
    if (locationLabel.textContent !== label) locationLabel.textContent = label;
  }

  function loadPosition(key, parts) {
    try {
      var saved = JSON.parse(localStorage.getItem(key) || 'null');
      if (!saved) return null;
      if (saved.version !== 2) return Number.isFinite(saved.y) && saved.y >= 20 ? saved : null;
      var part = Number.isInteger(saved.part) && parts[saved.part];
      if (part && Number.isInteger(saved.block) && part.element.children[saved.block] &&
          Number.isFinite(saved.offset) && saved.offset >= 0 && saved.offset <= 1) return saved;
    } catch (e) { /* Storage can be unavailable. */ }
    return null;
  }

  function positionAtLine(state) {
    var index = partIndex(state);
    var part = state.parts[index];
    var blocks = part.element.children;
    var line = readingLine();
    var block = indexAtY(blocks, line + 1, sameElement);
    var rect = blocks[block].getBoundingClientRect();
    var offset = rect.height ? clampUnit((line - rect.top) / rect.height) : 0;
    return { version: 2, part: index, block: block, offset: offset, paced: state.paced };
  }

  function savePosition(state) {
    clearTimeout(state.timer);
    state.timer = null;
    var position = positionAtLine(state);
    try {
      if (position.part === 0 && !position.paced && window.scrollY < 20) {
        localStorage.removeItem(state.key);
      } else {
        localStorage.setItem(state.key, JSON.stringify(position));
      }
    } catch (e) { /* Storage can be unavailable. */ }
  }

  function setupReading(parts, docId) {
    var key = 'mdfocus:position:' + docId;
    var state = {
      parts: parts,
      key: key,
      entries: [],
      index: 0,
      shownIndex: null,
      percent: null,
      paced: false,
      jumpY: null,
      scrollY: window.scrollY,
      frame: null,
      timer: null,
      saved: loadPosition(key, parts),
    };
    reading = state;
    tokenControls.classList.add('visible');
    document.body.classList.add('reader-open');
    progressRail.hidden = false;
    pacedBtn.disabled = parts.length < 2;
    resumeBtn.hidden = !state.saved;

    var entries = document.createDocumentFragment();
    parts.forEach(function (part, index) {
      var item = document.createElement('li');
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'reader-control';
      var title = part.heading && part.heading.textContent.replace(/\s+/g, ' ').trim();
      button.textContent = title || ('Частина ' + (index + 1));
      button.dataset.partIndex = String(index);
      item.appendChild(button);
      entries.appendChild(item);
      state.entries.push(button);
    });
    outlineList.appendChild(entries);

    state.refresh = function () {
      if (state.frame !== null) return;
      state.frame = requestAnimationFrame(function () {
        state.frame = null;
        updateReading(state);
      });
    };
    state.onScroll = function () {
      if (state.scrollY !== window.scrollY) {
        state.scrollY = window.scrollY;
        state.jumpY = null;
        if (!state.saved || window.scrollY >= 20) {
          state.saved = null;
          resumeBtn.hidden = true;
          clearTimeout(state.timer);
          state.timer = setTimeout(function () { savePosition(state); }, 250);
        }
      }
      state.refresh();
    };
    state.flush = function () { if (state.timer !== null) savePosition(state); };
    state.onVisibility = function () { if (document.hidden) state.flush(); };
    state.resizeObserver = new ResizeObserver(function () {
      var space = window.innerHeight - tokenControls.getBoundingClientRect().top;
      readerWrap.style.setProperty('--reader-dock-space', Math.ceil(space) + 'px');
      state.refresh();
      if (lineFocusState) lineFocusState.onScroll();
    });
    state.resizeObserver.observe(tokenControls);
    state.resizeObserver.observe(article);
    window.addEventListener('scroll', state.onScroll, { passive: true });
    window.addEventListener('resize', state.refresh);
    window.addEventListener('pagehide', state.flush);
    document.addEventListener('visibilitychange', state.onVisibility);
    updateReading(state);
  }

  function teardownReading() {
    var state = reading;
    if (!state) return;
    state.flush();
    window.removeEventListener('scroll', state.onScroll);
    window.removeEventListener('resize', state.refresh);
    window.removeEventListener('pagehide', state.flush);
    document.removeEventListener('visibilitychange', state.onVisibility);
    state.resizeObserver.disconnect();
    cancelAnimationFrame(state.frame);
    outlineList.replaceChildren();
    tokenControls.classList.remove('visible');
    document.body.classList.remove('reader-open');
    readerWrap.style.removeProperty('--reader-dock-space');
    progressRail.hidden = true;
    progressFill.style.width = '0%';
    pacedBtn.setAttribute('aria-pressed', 'false');
    reading = null;
  }

  function revealPart(index, paced) {
    var state = reading;
    if (state.paced !== paced) {
      state.parts.forEach(function (part, i) { part.element.hidden = paced && i !== index; });
    } else if (paced && state.index !== index) {
      state.parts[state.index].element.hidden = true;
      state.parts[index].element.hidden = false;
    }
    state.paced = paced;
    state.index = index;
    pacedBtn.setAttribute('aria-pressed', String(paced));
  }

  function placeReader(element, fraction) {
    var rect = element.getBoundingClientRect();
    window.scrollTo(0, window.scrollY + rect.top + rect.height * fraction - readingLine());
  }

  function finishMove(remember) {
    var state = reading;
    state.saved = null;
    resumeBtn.hidden = true;
    state.scrollY = state.jumpY = window.scrollY;
    if (remember) savePosition(state);
    updateReading(state);
    if (lineFocusState) lineFocusState.onScroll();
  }

  function goToPart(index) {
    if (index < 0 || index >= reading.parts.length) return;
    revealPart(index, reading.paced);
    var part = reading.parts[index];
    placeReader(part.element, 0);
    (part.heading || part.element).focus({ preventScroll: true });
    finishMove(true);
  }

  previousBtn.addEventListener('click', function () { goToPart(partIndex(reading) - 1); });
  nextBtn.addEventListener('click', function () { goToPart(partIndex(reading) + 1); });
  pacedBtn.addEventListener('click', function () {
    var position = positionAtLine(reading);
    revealPart(position.part, !reading.paced);
    placeReader(reading.parts[position.part].element.children[position.block], position.offset);
    finishMove(true);
  });
  resumeBtn.addEventListener('click', function () {
    var saved = reading.saved;
    if (!saved) return;
    if (saved.version === 2) {
      revealPart(saved.part, saved.paced === true && reading.parts.length > 1);
      var block = reading.parts[saved.part].element.children[saved.block];
      placeReader(block, saved.offset);
    } else {
      window.scrollTo(0, saved.y);
      reading.jumpY = null;
      reading.index = partIndex(reading);
    }
    article.focus({ preventScroll: true });
    finishMove(false);
  });
  document.getElementById('reader-outline-open').addEventListener('click', function () {
    outline.showModal();
    reading.entries[partIndex(reading)].focus();
  });
  outlineList.addEventListener('click', function (event) {
    var button = event.target.closest('button[data-part-index]');
    if (!button) return;
    outline.close();
    goToPart(Number(button.dataset.partIndex));
  });
  document.getElementById('reader-settings-open').addEventListener('click', function () {
    settings.showModal();
  });
  [outline, settings].forEach(function (dialog) {
    dialog.querySelector('[data-close]').addEventListener('click', function () { dialog.close(); });
  });

  // The focus follows one paragraph; its position is draggable within the viewport.
  var lineFocusState = null;
  var LINE_FOCUS_SELECTOR = 'p, li, blockquote, pre, h1, h2, h3, h4, h5, h6';
  var LINE_FOCUS_PALETTE = ['lime', 'cyan', 'purple', 'crimson'];
  var FOCUS_POSITION_KEY = 'mdfocus:focus-position';

  function focusPosition() {
    try {
      var saved = Number(localStorage.getItem(FOCUS_POSITION_KEY));
      return saved >= 0.05 && saved <= 0.95 ? saved : 0.5;
    } catch (e) { return 0.5; }
  }

  function setLineFocusAccent() {
    var step = Math.floor((window.scrollY + window.innerHeight * 0.5) / (window.innerHeight * 0.8));
    var name = LINE_FOCUS_PALETTE[step % LINE_FOCUS_PALETTE.length];
    var value = 'var(--accent-' + name + ')';
    article.style.setProperty('--focus-accent', value);
    if (lineFocusState) lineFocusState.handle.style.setProperty('--focus-accent', value);
  }

  function setupLineFocus(parts) {
    teardownLineFocus();
    parts.forEach(function (part) {
      part.blocks = Array.from(part.element.querySelectorAll(LINE_FOCUS_SELECTOR)).filter(function (block) {
        return !block.querySelector(LINE_FOCUS_SELECTOR);
      });
    });
    var sample = article.querySelector('p') || article;
    var handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'focus-grip';
    handle.textContent = '⋮⋮';
    handle.title = 'Перетягнути лінію фокусу';
    handle.setAttribute('aria-label', 'Перемістити лінію фокусу');
    document.body.appendChild(handle);
    var state = { active: null, handle: handle, position: focusPosition(), enabled: true, onScroll: null, onResize: null };
    lineFocusState = state;

    function clear() {
      if (!state.active) return;
      state.active.classList.remove('line-active');
      state.active.style.removeProperty('--focus-top');
      state.active.style.removeProperty('--focus-height');
      state.active = null;
    }
    function apply() {
      if (lineFocusState !== state || !reading) return;
      var anchor = state.position * window.innerHeight;
      var lineHeight = parseFloat(getComputedStyle(sample).lineHeight) || 27;
      var chosen = null, rect = null;
      if (state.enabled) {
        setLineFocusAccent();
        var first = reading.paced ? reading.index : indexAtY(parts, anchor, partElement);
        var end = reading.paced ? first + 1 : parts.length;
        for (var i = first; i < end && !chosen; i++) {
          if (parts[i].element.getBoundingClientRect().top >= window.innerHeight) break;
          var blocks = parts[i].blocks;
          for (var j = 0; j < blocks.length; j++) {
            var candidate = blocks[j].getBoundingClientRect();
            if (candidate.height && candidate.bottom > anchor) {
              chosen = blocks[j];
              rect = candidate;
              break;
            }
          }
        }
      }
      if (!chosen || rect.top >= window.innerHeight) {
        clear();
        handle.classList.remove('visible');
        return;
      }
      var start = Math.max(rect.top, anchor);
      var end = Math.min(rect.bottom, start + lineHeight * 6);
      if (end <= start) { clear(); handle.classList.remove('visible'); return; }
      if (state.active !== chosen) clear();
      chosen.style.setProperty('--focus-top', (start - rect.top) + 'px');
      chosen.style.setProperty('--focus-height', (end - start) + 'px');
      chosen.classList.add('line-active');
      state.active = chosen;
      handle.style.top = start + 'px';
      handle.style.left = Math.max(28, rect.left) + 'px';
      handle.classList.add('visible');
    }
    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; apply(); });
    }
    function moveTo(fraction) {
      state.position = Math.max(0.05, Math.min(0.95, fraction));
      try { localStorage.setItem(FOCUS_POSITION_KEY, String(state.position)); } catch (e) { /* private mode */ }
      onScroll();
    }
    var dragOffset = 0;
    function pointerDown(event) {
      dragOffset = event.clientY - state.position * window.innerHeight;
      handle.setPointerCapture(event.pointerId);
      handle.classList.add('dragging');
      event.preventDefault();
    }
    function pointerMove(event) {
      if (!handle.hasPointerCapture(event.pointerId)) return;
      moveTo((event.clientY - dragOffset) / window.innerHeight);
    }
    function pointerUp(event) {
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      handle.classList.remove('dragging');
    }
    function keyDown(event) {
      if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
      var step = (parseFloat(getComputedStyle(sample).lineHeight) || 27) / window.innerHeight;
      var next = event.key === 'Home' ? 0.05 : event.key === 'End' ? 0.95 :
        state.position + (event.key === 'ArrowUp' ? -step : step);
      moveTo(next);
      event.preventDefault();
    }
    handle.addEventListener('pointerdown', pointerDown);
    handle.addEventListener('pointermove', pointerMove);
    handle.addEventListener('pointerup', pointerUp);
    handle.addEventListener('pointercancel', pointerUp);
    handle.addEventListener('keydown', keyDown);
    state.onScroll = onScroll;
    state.onResize = onScroll;
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    setLineFocusEnabled(loadTokenPrefs().lineFocus !== false);
    apply();
  }

  function setLineFocusEnabled(on) {
    if (!lineFocusState) return;
    lineFocusState.enabled = on;
    lineFocusState.onScroll();
  }

  function teardownLineFocus() {
    if (!lineFocusState) return;
    window.removeEventListener('scroll', lineFocusState.onScroll);
    window.removeEventListener('resize', lineFocusState.onResize);
    if (lineFocusState.active) {
      lineFocusState.active.classList.remove('line-active');
      lineFocusState.active.style.removeProperty('--focus-top');
      lineFocusState.active.style.removeProperty('--focus-height');
    }
    lineFocusState.handle.remove();
    lineFocusState = null;
  }

  // ---------------------------------------------------------------- token: bionic reading
  // Walk text nodes so Markdown links and inline markup keep their DOM and
  // behaviour. Process in small idle batches for long documents.
  var bionicState = null;
  var BIONIC_SKIP = 'pre,code,kbd,samp,script,style,svg,math,a,h1,h2,h3,h4,h5,h6';

  function prepareBionic(container) {
    teardownBionic();
    var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    var nodes = [];
    var node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue.trim() && !node.parentElement.closest(BIONIC_SKIP)) nodes.push(node);
    }
    bionicState = { nodes: nodes, index: 0, scheduled: false };
  }

  function markBionicWords(node) {
    var value = node.nodeValue;
    var words = /[\p{L}\p{N}][\p{L}\p{M}\p{N}'’]*/gu;
    var fragment = document.createDocumentFragment();
    var last = 0;
    var found = false;
    var match;
    while ((match = words.exec(value))) {
      var letters = Array.from(match[0]);
      if (letters.length < 4) continue;
      found = true;
      fragment.appendChild(document.createTextNode(value.slice(last, match.index)));
      var split = Math.ceil(letters.length * 0.46);
      var prefix = document.createElement('span');
      prefix.className = 'bionic-prefix';
      prefix.textContent = letters.slice(0, split).join('');
      fragment.appendChild(prefix);
      fragment.appendChild(document.createTextNode(letters.slice(split).join('')));
      last = match.index + match[0].length;
    }
    if (!found) return;
    fragment.appendChild(document.createTextNode(value.slice(last)));
    node.parentNode.replaceChild(fragment, node);
  }

  function scheduleBionic() {
    var state = bionicState;
    if (!state || state.scheduled || state.index >= state.nodes.length) return;
    state.scheduled = true;
    var work = function (deadline) {
      state.scheduled = false;
      if (state !== bionicState || !article.classList.contains('bionic-reading-on')) return;
      var count = 0;
      while (state.index < state.nodes.length && count < 80 &&
             (count < 10 || !deadline || deadline.timeRemaining() > 2)) {
        var node = state.nodes[state.index++];
        if (node.parentNode) markBionicWords(node);
        count++;
      }
      scheduleBionic();
    };
    if (window.requestIdleCallback) window.requestIdleCallback(work);
    else setTimeout(work, 0);
  }

  function setBionicEnabled(on) {
    article.classList.toggle('bionic-reading-on', on);
    if (on) scheduleBionic();
  }

  function teardownBionic() {
    bionicState = null;
    article.classList.remove('bionic-reading-on');
  }

  // ---------------------------------------------------------------- token: scroll-responsive ambient
  // A fast skim quiets the background; it returns after scrolling settles.
  var skimState = null;
  function setQuiet(quiet) {
    document.body.classList.toggle('reader-quiet', quiet);
    var ambient = window.mandrock0Ambient;
    if (quiet && ambient && typeof ambient.stop === 'function') ambient.stop();
    if (!quiet && reading) ambientReseed(partIndex(reading) + 1);
    if (reading) setupSkimAmbient();
  }

  function setupSkimAmbient() {
    teardownSkimAmbient();
    if (document.body.classList.contains('reader-quiet')) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var state = { y: window.scrollY, time: performance.now(), timer: null, onScroll: null };
    function onScroll() {
      var now = performance.now();
      var y = window.scrollY;
      var speed = Math.abs(y - state.y) / Math.max(16, now - state.time);
      state.y = y;
      state.time = now;
      var quiet = Math.min(0.75, Math.max(0, (speed - 0.6) / 2.2 * 0.75));
      document.body.style.setProperty('--ambient-focus-opacity', String(1 - quiet));
      clearTimeout(state.timer);
      state.timer = setTimeout(function () {
        document.body.style.setProperty('--ambient-focus-opacity', '1');
      }, 260);
    }
    state.onScroll = onScroll;
    skimState = state;
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  function teardownSkimAmbient() {
    if (skimState) {
      window.removeEventListener('scroll', skimState.onScroll);
      clearTimeout(skimState.timer);
      skimState = null;
    }
    document.body.style.removeProperty('--ambient-focus-opacity');
  }

  // ---------------------------------------------------------------- token: noise
  // Passive attention token — procedural brown/pink noise via Web Audio API,
  // no audio files. Off by default (autoplay policy requires a user click).
  var noiseCtx = null;
  var noiseSource = null;
  var noiseGain = null;

  function makeNoiseBuffer(ctx, type) {
    var duration = 3; // seconds, looped
    var frameCount = ctx.sampleRate * duration;
    var buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
    var data = buffer.getChannelData(0);

    if (type === 'white' || type === 'violet') {
      var previous = 0;
      for (var z = 0; z < frameCount; z++) {
        var sample = Math.random() * 2 - 1;
        data[z] = type === 'violet' ? (sample - previous) * 0.35 : sample * 0.5;
        previous = sample;
      }
    } else if (type === 'pink') {
      // Paul Kellet's refined pink noise filter.
      var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (var i = 0; i < frameCount; i++) {
        var white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        var pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        b6 = white * 0.115926;
        data[i] = pink * 0.11;
      }
    } else {
      // brown noise: leaky-integrated white noise, normalized.
      var lastOut = 0;
      var maxAbs = 0;
      for (var j = 0; j < frameCount; j++) {
        var w = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.02 * w) / 1.02;
        data[j] = lastOut;
        var abs = Math.abs(lastOut);
        if (abs > maxAbs) maxAbs = abs;
      }
      if (maxAbs > 0) {
        for (var k = 0; k < frameCount; k++) data[k] = data[k] / maxAbs * 0.6;
      }
    }
    return buffer;
  }

  function stopNoise(immediate) {
    if (!noiseGain || !noiseCtx) return;
    var now = noiseCtx.currentTime;
    if (immediate) {
      noiseGain.gain.cancelScheduledValues(now);
      noiseGain.gain.setValueAtTime(0, now);
      if (noiseSource) { try { noiseSource.stop(); } catch (e) {} }
      noiseSource = null;
      return;
    }
    noiseGain.gain.cancelScheduledValues(now);
    noiseGain.gain.setValueAtTime(noiseGain.gain.value, now);
    noiseGain.gain.linearRampToValueAtTime(0, now + 1);
    var src = noiseSource;
    noiseSource = null;
    setTimeout(function () { if (src) { try { src.stop(); } catch (e) {} } }, 1050);
  }

  function startNoise(type, volume) {
    if (!noiseCtx) noiseCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (noiseCtx.state === 'suspended') noiseCtx.resume();
    if (noiseSource) stopNoise(true);

    var buffer = makeNoiseBuffer(noiseCtx, type);
    var source = noiseCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    if (!noiseGain) {
      noiseGain = noiseCtx.createGain();
      noiseGain.connect(noiseCtx.destination);
    }
    var now = noiseCtx.currentTime;
    noiseGain.gain.cancelScheduledValues(now);
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(volume * volume, now + 1);

    source.connect(noiseGain);
    source.start();
    noiseSource = source;
  }

  function setNoiseVolume(volume) {
    if (noiseGain && noiseCtx) {
      noiseGain.gain.setValueAtTime(volume * volume, noiseCtx.currentTime);
    }
  }

  // ---------------------------------------------------------------- token prefs (localStorage)
  var TOKEN_PREFS_KEY = 'mdfocus:tokens';

  function loadTokenPrefs() {
    try {
      var raw = localStorage.getItem(TOKEN_PREFS_KEY);
      var parsed = raw ? JSON.parse(raw) : {};
      return {
        lineFocus: parsed.lineFocus !== false,
        bionic: parsed.bionic === true,
        readingLane: parsed.readingLane === true,
        readingWide: parsed.readingWide === true,
        quiet: parsed.quiet === true,
        noiseType: ['brown', 'pink', 'white', 'violet'].includes(parsed.noiseType) ? parsed.noiseType : 'brown',
        noiseOn: !!parsed.noiseOn,
        volume: typeof parsed.volume === 'number' && parsed.volume >= 0 && parsed.volume <= 1 ? parsed.volume : 0.3,
      };
    } catch (e) {
      return { lineFocus: true, bionic: false, readingLane: false, readingWide: false, quiet: false, noiseType: 'brown', noiseOn: false, volume: 0.3 };
    }
  }

  function saveTokenPrefs(prefs) {
    try { localStorage.setItem(TOKEN_PREFS_KEY, JSON.stringify(prefs)); } catch (e) { /* ignore */ }
  }

  function applyReadingPrefs() {
    var prefs = loadTokenPrefs();
    article.classList.toggle('reading-lane', prefs.readingLane && !prefs.readingWide);
    document.body.classList.toggle('reading-wide', prefs.readingWide);
    setBionicEnabled(prefs.bionic);
  }

  // ---------------------------------------------------------------- token controls wiring
  (function wireTokenControls() {
    var prefs = loadTokenPrefs();
    var lineFocusChk = document.getElementById('tc-line-focus');
    var bionicChk = document.getElementById('tc-bionic');
    var readingLaneChk = document.getElementById('tc-reading-lane');
    var readingWideChk = document.getElementById('tc-reading-wide');
    var quietChk = document.getElementById('tc-quiet');
    var noiseOnChk = document.getElementById('tc-noise-on');
    var noiseTypeSel = document.getElementById('tc-noise-type');
    var noiseVolumeRange = document.getElementById('tc-noise-volume');

    lineFocusChk.checked = prefs.lineFocus;
    bionicChk.checked = prefs.bionic;
    readingLaneChk.checked = prefs.readingLane && !prefs.readingWide;
    readingWideChk.checked = prefs.readingWide;
    quietChk.checked = prefs.quiet;
    setQuiet(prefs.quiet);
    noiseOnChk.checked = false; // never auto-start audio: user must click
    noiseTypeSel.value = prefs.noiseType;
    noiseVolumeRange.value = String(prefs.volume);

    lineFocusChk.addEventListener('change', function () {
      prefs.lineFocus = lineFocusChk.checked;
      saveTokenPrefs(prefs);
      setLineFocusEnabled(prefs.lineFocus);
    });

    bionicChk.addEventListener('change', function () {
      prefs.bionic = bionicChk.checked;
      saveTokenPrefs(prefs);
      setBionicEnabled(prefs.bionic);
    });

    readingLaneChk.addEventListener('change', function () {
      prefs.readingLane = readingLaneChk.checked;
      if (prefs.readingLane) { prefs.readingWide = false; readingWideChk.checked = false; document.body.classList.remove('reading-wide'); }
      saveTokenPrefs(prefs);
      article.classList.toggle('reading-lane', prefs.readingLane);
      setLineFocusEnabled(prefs.lineFocus);
    });

    readingWideChk.addEventListener('change', function () {
      prefs.readingWide = readingWideChk.checked;
      if (prefs.readingWide) { prefs.readingLane = false; readingLaneChk.checked = false; article.classList.remove('reading-lane'); }
      saveTokenPrefs(prefs);
      document.body.classList.toggle('reading-wide', prefs.readingWide);
      setLineFocusEnabled(prefs.lineFocus);
    });

    quietChk.addEventListener('change', function () {
      prefs.quiet = quietChk.checked;
      saveTokenPrefs(prefs);
      setQuiet(prefs.quiet);
    });

    noiseOnChk.addEventListener('change', function () {
      prefs.noiseOn = noiseOnChk.checked;
      saveTokenPrefs(prefs);
      if (prefs.noiseOn) startNoise(noiseTypeSel.value, Number(noiseVolumeRange.value));
      else stopNoise(false);
    });

    noiseTypeSel.addEventListener('change', function () {
      prefs.noiseType = noiseTypeSel.value;
      saveTokenPrefs(prefs);
      if (noiseOnChk.checked) startNoise(prefs.noiseType, Number(noiseVolumeRange.value));
    });

    noiseVolumeRange.addEventListener('input', function () {
      prefs.volume = Number(noiseVolumeRange.value);
      saveTokenPrefs(prefs);
      setNoiseVolume(prefs.volume);
    });
  })();

  // ---------------------------------------------------------- deep link
  // ?url=<raw markdown url> — same path as a manual URL-tab click, so it
  // goes through the same SSRF-guarded api/fetch proxy, nothing client-side.
  (function () {
    var params = new URLSearchParams(window.location.search);
    var deepUrl = params.get('url');
    if (!deepUrl) return;
    document.querySelectorAll('.src-tab').forEach(function (t) { t.classList.remove('active'); });
    document.querySelectorAll('.src-pane').forEach(function (p) { p.classList.remove('active'); });
    var urlTab = document.querySelector('.src-tab[data-pane="pane-url"]');
    if (urlTab) urlTab.classList.add('active');
    var urlPane = document.getElementById('pane-url');
    if (urlPane) urlPane.classList.add('active');
    document.getElementById('url-input').value = deepUrl;
    document.getElementById('url-load-btn').click();
  })();
})();
