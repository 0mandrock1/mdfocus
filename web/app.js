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
    article.classList.add('visible');
    sourcePanel.style.display = 'none';
    resetRow.style.display = '';
    buildSections(article, docId);
    sectionCounter.classList.add('visible');
    tokenControls.classList.add('visible');
    setupLineFocus(article);
    window.scrollTo(0, 0);
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

  // ---------------------------------------------------------------- token: line focus
  // Passive attention token — no input required. A WINDOW of blocks around
  // the reading line (~38% of viewport height) gets an accent highlight
  // (left bar + background tint, see .line-active in index.html); nothing
  // is dimmed — full contrast everywhere. Window = LINE_FOCUS_WINDOW_RADIUS
  // blocks on each side of the closest block (radius 2 => 5 blocks total).
  // The highlight color rotates per document section (not per block, not
  // on a timer) by writing --focus-accent on #article, read from the same
  // system accent tokens as tools.mandrock.me/palettes (accents.css).
  // Position updates via a rAF-throttled scroll listener (not on every raw
  // scroll event).
  var lineFocusState = null;
  var LINE_FOCUS_SELECTOR = 'p, li, blockquote, pre, h1, h2, h3, h4, h5, h6';
  var LINE_FOCUS_PALETTE = ['lime', 'cyan', 'purple', 'crimson'];
  var LINE_FOCUS_WINDOW_RADIUS = 2; // blocks each side of center; total = 2*R+1

  function setLineFocusAccent(sectionIdx) {
    var name = LINE_FOCUS_PALETTE[(sectionIdx - 1) % LINE_FOCUS_PALETTE.length];
    article.style.setProperty('--focus-accent', 'var(--accent-' + name + ')');
  }

  function setupLineFocus(container) {
    teardownLineFocus();

    var blocks = Array.prototype.slice.call(container.querySelectorAll(LINE_FOCUS_SELECTOR));
    if (!blocks.length) return;
    blocks.forEach(function (b) { b.classList.add('mdfocus-focusable'); });

    var state = { blocks: blocks, activeSet: [], onScroll: null, onResize: null, enabled: true };
    lineFocusState = state;

    function findClosestIndex() {
      var line = window.innerHeight * 0.38;
      var bestIdx = -1;
      var bestDist = Infinity;
      for (var i = 0; i < blocks.length; i++) {
        var rect = blocks[i].getBoundingClientRect();
        if (rect.height === 0) continue;
        var mid = rect.top + rect.height / 2;
        var dist = Math.abs(mid - line);
        if (dist < bestDist) { bestDist = dist; bestIdx = i; }
      }
      return bestIdx;
    }

    function apply() {
      if (!state.enabled) return;
      var centerIdx = findClosestIndex();
      var next = [];
      if (centerIdx !== -1) {
        var lo = Math.max(0, centerIdx - LINE_FOCUS_WINDOW_RADIUS);
        var hi = Math.min(blocks.length - 1, centerIdx + LINE_FOCUS_WINDOW_RADIUS);
        for (var i = lo; i <= hi; i++) next.push(blocks[i]);
      }
      var same = next.length === state.activeSet.length &&
        next.every(function (b, i) { return b === state.activeSet[i]; });
      if (same) return;
      state.activeSet.forEach(function (b) { b.classList.remove('line-active'); });
      next.forEach(function (b) { b.classList.add('line-active'); });
      state.activeSet = next;
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
    if (!lineFocusState) { article.classList.toggle('line-focus-on', false); return; }
    lineFocusState.enabled = on;
    article.classList.toggle('line-focus-on', on);
    if (!on && lineFocusState.activeSet.length) {
      lineFocusState.activeSet.forEach(function (b) { b.classList.remove('line-active'); });
      lineFocusState.activeSet = [];
    }
  }

  function teardownLineFocus() {
    article.classList.remove('line-focus-on');
    if (!lineFocusState) return;
    window.removeEventListener('scroll', lineFocusState.onScroll);
    window.removeEventListener('resize', lineFocusState.onResize);
    lineFocusState = null;
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

    if (type === 'pink') {
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
    noiseGain.gain.linearRampToValueAtTime(volume, now + 1);

    source.connect(noiseGain);
    source.start();
    noiseSource = source;
  }

  function setNoiseVolume(volume) {
    if (noiseGain && noiseCtx) {
      noiseGain.gain.setValueAtTime(volume, noiseCtx.currentTime);
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
        noiseType: parsed.noiseType === 'pink' ? 'pink' : 'brown',
        noiseOn: !!parsed.noiseOn,
        volume: typeof parsed.volume === 'number' ? parsed.volume : 0.3,
      };
    } catch (e) {
      return { lineFocus: true, noiseType: 'brown', noiseOn: false, volume: 0.3 };
    }
  }

  function saveTokenPrefs(prefs) {
    try { localStorage.setItem(TOKEN_PREFS_KEY, JSON.stringify(prefs)); } catch (e) { /* ignore */ }
  }

  // ---------------------------------------------------------------- token controls wiring
  (function wireTokenControls() {
    var prefs = loadTokenPrefs();
    var lineFocusChk = document.getElementById('tc-line-focus');
    var noiseOnChk = document.getElementById('tc-noise-on');
    var noiseTypeSel = document.getElementById('tc-noise-type');
    var noiseVolumeRange = document.getElementById('tc-noise-volume');

    lineFocusChk.checked = prefs.lineFocus;
    noiseOnChk.checked = false; // never auto-start audio: user must click
    noiseTypeSel.value = prefs.noiseType;
    noiseVolumeRange.value = String(prefs.volume);

    lineFocusChk.addEventListener('change', function () {
      prefs.lineFocus = lineFocusChk.checked;
      saveTokenPrefs(prefs);
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
