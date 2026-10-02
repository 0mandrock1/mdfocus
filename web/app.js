/* mdfocus: client-side markdown reader with attention-pacing "tokens".
 * No word/token counters — "tokens" here means focus/concentration technique,
 * not LLM tokens. All state is local to the browser (localStorage), nothing
 * is persisted server-side except the SSRF-guarded URL fetch proxy. */
(function () {
  'use strict';

  var article = document.getElementById('article');
  var sourcePanel = document.getElementById('source-panel');
  var resetRow = document.getElementById('reset-row');
  var statusLine = document.getElementById('status-line');
  var progressFill = document.getElementById('progress-fill');
  var sectionCounter = document.getElementById('section-counter');
  var tokenControls = document.getElementById('token-controls');
  var resumeBtn = document.getElementById('tc-resume');

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
  // Small deterministic hash of the raw markdown text. Intended as a
  // localStorage-key namespace for per-document token settings; currently
  // only threaded through as docId (unused inside buildSections) — token
  // prefs (TOKEN_PREFS_KEY below) are still global across all documents.
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
    loadMarkdown(text);
  });

  document.getElementById('file-input').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () { loadMarkdown(String(reader.result || '')); };
    reader.onerror = function () { setStatus('не вдалося прочитати файл', true); };
    reader.readAsText(file);
  });

  document.getElementById('url-load-btn').addEventListener('click', function () {
    var url = document.getElementById('url-input').value.trim();
    if (!url) { setStatus('вкажи URL', true); return; }
    setStatus('завантаження…');
    fetch('api/fetch?url=' + encodeURIComponent(url))
      .then(function (r) {
        return r.text().then(function (body) {
          if (!r.ok) throw new Error(body || ('http ' + r.status));
          return body;
        });
      })
      .then(function (text) {
        setStatus('');
        loadMarkdown(text);
      })
      .catch(function (e) {
        setStatus('помилка завантаження: ' + e.message, true);
      });
  });

  document.getElementById('reset-btn').addEventListener('click', function () {
    article.classList.remove('visible');
    article.innerHTML = '';
    sourcePanel.style.display = '';
    resetRow.style.display = 'none';
    document.getElementById('paste-area').value = '';
    document.getElementById('url-input').value = '';
    document.getElementById('file-input').value = '';
    setStatus('');
    teardownTracking();
    sectionCounter.classList.remove('visible');
    tokenControls.classList.remove('visible');
    teardownLineFocus();
    teardownBookmark();
    teardownSkimAmbient();
    teardownBionic();
    article.classList.remove('reading-lane');
    document.body.classList.remove('reading-wide');
    stopNoise(true);
    document.getElementById('tc-noise-on').checked = false;
    window.scrollTo(0, 0);
  });

  // ---------------------------------------------------------------- render
  function loadMarkdown(raw) {
    if (typeof marked === 'undefined') {
      setStatus('marked.js ще не завантажився, спробуй ще раз за секунду', true);
      return;
    }
    var docId = hashText(raw);
    var html = marked.parse(raw);
    article.innerHTML = html;
    wrapTables(article);
    article.classList.add('visible');
    sourcePanel.style.display = 'none';
    resetRow.style.display = '';
    buildSections(article, docId);
    sectionCounter.classList.add('visible');
    tokenControls.classList.add('visible');
    setupLineFocus(article);
    prepareBionic(article);
    applyReadingPrefs();
    window.scrollTo(0, 0);
    setupSkimAmbient();
    setupBookmark(docId);
  }

  // mdfocus:tables — wrap every rendered <table> in a scrollable container so
  // a wide table scrolls within itself instead of stretching the page. Runs
  // right after innerHTML is set, before buildSections() groups top-level
  // children, so the wrapper <div> (not the <table>) becomes the section
  // child — it never matches LINE_FOCUS_SELECTOR and is not picked up as a
  // focusable block.
  function wrapTables(container) {
    var tables = Array.prototype.slice.call(container.querySelectorAll('table'));
    tables.forEach(function (table) {
      var wrap = document.createElement('div');
      wrap.className = 'table-wrap';
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
      function upd() {
        var max = wrap.scrollWidth - wrap.clientWidth;
        wrap.classList.toggle('can-scroll-r', max > 1 && wrap.scrollLeft < max - 1);
        wrap.classList.toggle('can-scroll-l', wrap.scrollLeft > 1);
      }
      wrap.addEventListener('scroll', upd, { passive: true });
      window.addEventListener('resize', upd);
      upd();
      if (window.requestAnimationFrame) requestAnimationFrame(upd);
    });
  }

  // ---------------------------------------------------------------- sections
  // Sections are used only for pacing (progress rail / fixed counter /
  // ambient reseed) — no visible separators or per-section input are
  // inserted into the text flow, so reading is an uninterrupted stream.
  function buildSections(container, docId) {
    var children = Array.prototype.slice.call(container.children);
    var groups = [];
    var current = [];

    children.forEach(function (node) {
      if (/^H[12]$/.test(node.tagName) && current.length) {
        groups.push(current);
        current = [];
      }
      current.push(node);
    });
    if (current.length) groups.push(current);
    if (groups.length < 2) groups = [children]; // whole doc = one section

    var total = groups.length;
    var sections = [];

    groups.forEach(function (group, i) {
      var idx = i + 1;
      var section = document.createElement('section');
      section.className = 'mdfocus-section';
      section.setAttribute('data-idx', String(idx));

      var anchor = group[0];
      container.insertBefore(section, anchor);
      group.forEach(function (node) { section.appendChild(node); });

      sections.push(section);
    });

    setupTracking(sections, total);
  }

  // ---------------------------------------------------------------- pacing / dwell / ambient
  var trackingState = null;

  function ambientReseed(idx) {
    if (!window.mandrock0Ambient || typeof window.mandrock0Ambient.reseed !== 'function') return;
    var script = document.querySelector('script[data-seed]');
    if (!script) return;
    var seed = parseInt(script.getAttribute('data-seed'), 10);
    if (isNaN(seed)) return;
    try { window.mandrock0Ambient.reseed((seed + idx) >>> 0); } catch (e) { /* ignore */ }
  }

  function currentSectionIdx(sections) {
    var threshold = window.innerHeight * 0.3;
    var active = sections[0];
    for (var i = 0; i < sections.length; i++) {
      var rect = sections[i].getBoundingClientRect();
      if (rect.top <= threshold) active = sections[i];
      else break;
    }
    return Number(active.getAttribute('data-idx'));
  }

  function setupTracking(sections, total) {
    teardownTracking();

    var state = {
      sections: sections,
      total: total,
      lastIdx: null,
      dwellStart: Date.now(),
      onScroll: null,
      onResize: null,
    };
    trackingState = state;

    function updateProgressRail() {
      var idx = state.lastIdx || 1;
      var pct = Math.round((idx / state.total) * 100);
      progressFill.style.width = pct + '%';
      sectionCounter.textContent = 'секція ' + idx + ' / ' + state.total;
    }

    function onSectionChange(idx) {
      state.lastIdx = idx;
      state.dwellStart = Date.now();
      ambientReseed(idx);
      updateProgressRail();
      setLineFocusAccent(idx);
    }

    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        var idx = currentSectionIdx(state.sections);
        if (idx !== state.lastIdx) onSectionChange(idx);
      });
    }

    state.onScroll = onScroll;
    state.onResize = onScroll;
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    onSectionChange(currentSectionIdx(sections));
  }

  function teardownTracking() {
    if (!trackingState) { progressFill.style.width = '0%'; return; }
    window.removeEventListener('scroll', trackingState.onScroll);
    window.removeEventListener('resize', trackingState.onResize);
    trackingState = null;
    progressFill.style.width = '0%';
  }

  // A three-line reading guide follows the viewport, not paragraph boundaries.
  var lineFocusState = null;
  var LINE_FOCUS_SELECTOR = 'p, li, blockquote, pre, h1, h2, h3, h4, h5, h6';
  var LINE_FOCUS_PALETTE = ['lime', 'cyan', 'purple', 'crimson'];

  function setLineFocusAccent(sectionIdx) {
    var name = LINE_FOCUS_PALETTE[(sectionIdx - 1) % LINE_FOCUS_PALETTE.length];
    if (lineFocusState) lineFocusState.band.style.setProperty('--focus-accent', 'var(--accent-' + name + ')');
  }

  function setupLineFocus(container) {
    teardownLineFocus();
    var blocks = Array.prototype.slice.call(container.querySelectorAll(LINE_FOCUS_SELECTOR));
    var band = document.createElement('div');
    band.className = 'reading-focus-band';
    band.setAttribute('aria-hidden', 'true');
    document.body.appendChild(band);
    var state = { blocks: blocks, band: band, onScroll: null, onResize: null, enabled: true };
    lineFocusState = state;

    function apply() {
      var rect = container.getBoundingClientRect();
      var top = window.innerHeight * 0.56;
      var lineHeight = parseFloat(getComputedStyle(container.querySelector('p') || container).lineHeight) || 27;
      band.style.left = Math.max(0, rect.left) + 'px';
      band.style.width = Math.min(window.innerWidth - Math.max(0, rect.left), rect.width) + 'px';
      band.style.height = lineHeight * 3 + 'px';
      band.classList.toggle('visible', state.enabled && rect.top <= top && rect.bottom >= top + lineHeight * 3);
    }
    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; apply(); });
    }
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
    lineFocusState.band.classList.toggle('visible', false);
    if (on) lineFocusState.onScroll();
  }

  function teardownLineFocus() {
    if (!lineFocusState) return;
    window.removeEventListener('scroll', lineFocusState.onScroll);
    window.removeEventListener('resize', lineFocusState.onResize);
    lineFocusState.band.remove();
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
  function setupSkimAmbient() {
    teardownSkimAmbient();
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

  // ---------------------------------------------------------------- token: return to reading position
  var bookmarkState = null;
  function setupBookmark(docId) {
    teardownBookmark();
    var blocks = lineFocusState ? lineFocusState.blocks : [];
    if (!blocks.length) return;
    var key = 'mdfocus:position:' + docId;
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { /* private mode */ }
    if (!saved || !Number.isInteger(saved.index) || saved.index < 0 ||
        saved.index >= blocks.length || !Number.isFinite(saved.y) || saved.y < 0) saved = null;
    resumeBtn.hidden = !saved || saved.y < 20;
    var state = { blocks: blocks, key: key, y: window.scrollY, timer: null, onScroll: null, onPageHide: null };
    function savePosition() {
      var line = window.innerHeight * 0.38;
      var best = -1;
      var distance = Infinity;
      blocks.forEach(function (block, i) {
        var rect = block.getBoundingClientRect();
        if (!rect.height) return;
        var next = Math.abs(rect.top + rect.height / 2 - line);
        if (next < distance) { best = i; distance = next; }
      });
      if (best >= 0) {
        try {
          localStorage.setItem(key, JSON.stringify({ index: best, y: Math.round(window.scrollY) }));
        } catch (e) { /* private mode */ }
      }
    }
    function onScroll() {
      var y = window.scrollY;
      if (Math.abs(y - state.y) < 2) return;
      state.y = y;
      clearTimeout(state.timer);
      state.timer = setTimeout(savePosition, 1000);
    }
    state.onScroll = onScroll;
    state.onPageHide = function () { if (state.timer) savePosition(); };
    bookmarkState = state;
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', state.onPageHide);
    resumeBtn.onclick = function () {
      if (!saved) return;
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: Math.max(0, Math.min(saved.y, document.documentElement.scrollHeight - window.innerHeight)),
        behavior: reduce ? 'auto' : 'smooth' });
      resumeBtn.hidden = true;
    };
  }

  function teardownBookmark() {
    if (bookmarkState) {
      window.removeEventListener('scroll', bookmarkState.onScroll);
      window.removeEventListener('pagehide', bookmarkState.onPageHide);
      clearTimeout(bookmarkState.timer);
      bookmarkState = null;
    }
    resumeBtn.hidden = true;
    resumeBtn.onclick = null;
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
        noiseType: ['brown', 'pink', 'white', 'violet'].includes(parsed.noiseType) ? parsed.noiseType : 'brown',
        noiseOn: !!parsed.noiseOn,
        volume: typeof parsed.volume === 'number' && parsed.volume >= 0 && parsed.volume <= 1 ? parsed.volume : 0.3,
      };
    } catch (e) {
      return { lineFocus: true, bionic: false, readingLane: false, readingWide: false, noiseType: 'brown', noiseOn: false, volume: 0.3 };
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
    var noiseOnChk = document.getElementById('tc-noise-on');
    var noiseTypeSel = document.getElementById('tc-noise-type');
    var noiseVolumeRange = document.getElementById('tc-noise-volume');

    lineFocusChk.checked = prefs.lineFocus;
    bionicChk.checked = prefs.bionic;
    readingLaneChk.checked = prefs.readingLane && !prefs.readingWide;
    readingWideChk.checked = prefs.readingWide;
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
