/* mdfocus reader module — reusable core of the mdfocus "focus tokens" (section pacing + progress
 * rail, six-line focus window, optional brown/pink/white/violet noise). No dependencies, no network, no
 * telemetry. Used by mdfocus itself and (vendored) by Atlas.
 *
 * MdfocusReader.init(root, options) -> instance { destroy(), refresh(), setLineFocus(on),
 *   startNoise(), stopNoise(), resetPrefs(), state() }
 *
 * DOM contract (all optional except root):
 *   root                      element whose children are the text blocks
 *   options.sections          'auto' (split root.children at H1/H2, default) | 'existing'
 *                              ('existing' = use root.querySelectorAll(options.sectionSelector))
 *   options.sectionSelector   default 'section[data-reader-section]'
 *   options.ui = { fill, counter, lineFocus, noiseOn, noiseType, noiseVolume, reset }  (elements)
 *   options.prefsKey          localStorage namespace, default 'mdfocus:tokens' (Atlas: 'atlas:reader:v1')
 *   options.lineFocusDefault  default true (mdfocus) — Atlas passes false
 *   options.railMode          'position' (default: 0% at top, 100% only at the bottom, reading
 *                              position — NOT a read/understood claim) | 'legacy' (mdfocus: idx/total)
 *   options.counterText       function(idx,total)->string
 *   options.ambient           true -> call window.mandrock0Ambient.reseed per section (mdfocus only)
 *   options.focusSelector     blocks used for reading position and focus
 *   Focus grip position is saved under prefsKey + ':focus-position'.
 * Noise never starts on init, never restores from prefs: it needs a click in THIS page view.
 * Prefs are versioned by prefsKey, can be reset, and never leave the browser.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MdfocusReader = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PALETTE = ['lime', 'cyan', 'purple', 'crimson'];

  function lsGet(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } }
  function lsSet(key, v) { try { window.localStorage.setItem(key, v); } catch (e) { /* private mode */ } }
  function lsDel(key) { try { window.localStorage.removeItem(key); } catch (e) { /* ignore */ } }

  function noiseBuffer(ctx, type) {
    var n = ctx.sampleRate * 3, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0), i;
    if (type === 'white' || type === 'violet') {
      var previous = 0;
      for (i = 0; i < n; i++) {
        var sample = Math.random() * 2 - 1;
        d[i] = type === 'violet' ? (sample - previous) * 0.35 : sample * 0.5;
        previous = sample;
      }
    } else if (type === 'pink') {
      var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (i = 0; i < n; i++) {
        var w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      }
    } else {
      var last = 0, max = 0;
      for (i = 0; i < n; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last; if (Math.abs(last) > max) max = Math.abs(last); }
      if (max > 0) for (i = 0; i < n; i++) d[i] = d[i] / max * 0.6;
    }
    return buf;
  }

  function init(rootEl, options) {
    if (!rootEl) throw new Error('MdfocusReader.init: root element required');
    var o = options || {};
    var ui = o.ui || {};
    var prefsKey = o.prefsKey || 'mdfocus:tokens';
    var focusSel = o.focusSelector || 'p, li, blockquote, pre, h1, h2, h3, h4, h5, h6';
    var railMode = o.railMode || 'position';
    var counterText = o.counterText || function (i, t) { return 'секція ' + i + ' / ' + t; };
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var destroyed = false, listeners = [], sections = [], blocks = [], active = [];
    var lastIdx = null, lineOn = false;
    var noise = { ctx: null, src: null, gain: null, on: false };
    var focusPositionKey = prefsKey + ':focus-position';
    var savedPosition = Number(lsGet(focusPositionKey));
    var focusY = savedPosition >= 0.05 && savedPosition <= 0.95 ? savedPosition : 0.5;
    var grip = document.createElement('button');
    grip.type = 'button';
    grip.className = 'focus-grip';
    grip.textContent = '⋮⋮';
    grip.title = 'Перетягнути лінію фокусу';
    grip.setAttribute('aria-label', 'Перемістити лінію фокусу');
    document.body.appendChild(grip);

    function on(target, ev, fn, opts) { target.addEventListener(ev, fn, opts); listeners.push([target, ev, fn, opts]); }

    // ---- prefs
    var defaults = { lineFocus: o.lineFocusDefault !== false, noiseType: 'brown', volume: 0.3 };
    function loadPrefs() {
      var p = {};
      try { p = JSON.parse(lsGet(prefsKey) || '{}') || {}; } catch (e) { p = {}; }
      return { lineFocus: typeof p.lineFocus === 'boolean' ? p.lineFocus : defaults.lineFocus,
               noiseType: ['brown', 'pink', 'white', 'violet'].includes(p.noiseType) ? p.noiseType : 'brown',
               volume: typeof p.volume === 'number' && p.volume >= 0 && p.volume <= 1 ? p.volume : defaults.volume };
    }
    var prefs = loadPrefs();
    function savePrefs() { lsSet(prefsKey, JSON.stringify(prefs)); }   // noise on/off is deliberately NOT stored

    // ---- sections
    function buildSections() {
      if (o.sections === 'existing') {
        sections = Array.prototype.slice.call(rootEl.querySelectorAll(o.sectionSelector || 'section[data-reader-section]'));
        sections.forEach(function (s, i) { s.setAttribute('data-idx', String(i + 1)); });
        if (!sections.length) sections = [rootEl];
        return;
      }
      var kids = Array.prototype.slice.call(rootEl.children), groups = [], cur = [];
      kids.forEach(function (n) {
        if (/^H[12]$/.test(n.tagName) && cur.length) { groups.push(cur); cur = []; }
        cur.push(n);
      });
      if (cur.length) groups.push(cur);
      if (groups.length < 2) groups = [kids];
      groups.forEach(function (g, i) {
        var s = document.createElement('section');
        s.className = 'mdfocus-section'; s.setAttribute('data-idx', String(i + 1));
        rootEl.insertBefore(s, g[0]);
        g.forEach(function (n) { s.appendChild(n); });
        sections.push(s);
      });
    }

    // ---- rail
    function currentIdx() {
      var line = window.innerHeight * 0.3, a = sections[0];
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].getBoundingClientRect().top <= line) a = sections[i]; else break;
      }
      return Number(a.getAttribute('data-idx')) || 1;
    }
    function docFraction() {
      var h = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      return Math.min(1, Math.max(0, (window.pageYOffset || document.documentElement.scrollTop || 0) / h));
    }
    function paintRail() {
      var idx = lastIdx || 1, total = sections.length;
      if (ui.fill) {
        var pct = railMode === 'legacy' ? Math.round(idx / total * 100) : Math.round(docFraction() * 100);
        ui.fill.style.width = pct + '%';
        if (ui.fill.parentElement) ui.fill.parentElement.setAttribute('aria-valuenow', String(pct));
      }
      if (ui.counter) ui.counter.textContent = counterText(idx, total);
    }
    function ambientReseed(idx) {
      if (!o.ambient || !window.mandrock0Ambient || typeof window.mandrock0Ambient.reseed !== 'function') return;
      var sc = document.querySelector('script[data-seed]'); if (!sc) return;
      var seed = parseInt(sc.getAttribute('data-seed'), 10); if (isNaN(seed)) return;
      try { window.mandrock0Ambient.reseed((seed + idx) >>> 0); } catch (e) { /* ignore */ }
    }
    function accent() {
      var step = Math.floor(((window.pageYOffset || document.documentElement.scrollTop || 0) + window.innerHeight * 0.5) / (window.innerHeight * 0.8));
      var value = 'var(--accent-' + PALETTE[step % PALETTE.length] + ', var(--rd-accent, currentColor))';
      rootEl.style.setProperty('--focus-accent', value);
      grip.style.setProperty('--focus-accent', value);
    }

    // ---- focus one paragraph; shorten at its end, then jump to the next
    function clearFocus() {
      active.forEach(function (block) {
        block.classList.remove('line-active');
        block.style.removeProperty('--focus-top');
        block.style.removeProperty('--focus-height');
      });
      active = [];
    }
    function applyFocus() {
      var anchor = focusY * window.innerHeight;
      var chosen = null, rect = null;
      if (lineOn) {
        accent();
        for (var i = 0; i < blocks.length; i++) {
          var candidate = blocks[i].getBoundingClientRect();
          if (candidate.height && candidate.bottom > anchor) {
            chosen = blocks[i]; rect = candidate; break;
          }
        }
      }
      if (!chosen || rect.top >= window.innerHeight) {
        clearFocus(); grip.classList.remove('visible'); return;
      }
      var sample = rootEl.querySelector('p') || rootEl;
      var lineHeight = parseFloat(getComputedStyle(sample).lineHeight) || 27;
      var start = Math.max(rect.top, anchor);
      var end = Math.min(rect.bottom, start + lineHeight * 6);
      if (end <= start) { clearFocus(); grip.classList.remove('visible'); return; }
      if (active[0] !== chosen) clearFocus();
      chosen.style.setProperty('--focus-top', (start - rect.top) + 'px');
      chosen.style.setProperty('--focus-height', (end - start) + 'px');
      chosen.classList.add('line-active');
      active = [chosen];
      grip.style.top = start + 'px';
      grip.style.left = Math.max(28, rect.left) + 'px';
      grip.classList.add('visible');
    }
    function setLineFocus(onNow) {
      lineOn = !!onNow;
      applyFocus();
      if (ui.lineFocus) ui.lineFocus.checked = lineOn;
    }
    function moveFocus(fraction) {
      focusY = Math.max(0.05, Math.min(0.95, fraction));
      lsSet(focusPositionKey, String(focusY));
      onScroll();
    }
    var dragOffset = 0;
    on(grip, 'pointerdown', function (event) {
      dragOffset = event.clientY - focusY * window.innerHeight;
      grip.setPointerCapture(event.pointerId);
      grip.classList.add('dragging');
      event.preventDefault();
    });
    on(grip, 'pointermove', function (event) {
      if (grip.hasPointerCapture(event.pointerId)) moveFocus((event.clientY - dragOffset) / window.innerHeight);
    });
    function stopDrag(event) {
      if (grip.hasPointerCapture(event.pointerId)) grip.releasePointerCapture(event.pointerId);
      grip.classList.remove('dragging');
    }
    on(grip, 'pointerup', stopDrag);
    on(grip, 'pointercancel', stopDrag);
    on(grip, 'keydown', function (event) {
      if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
      var sample = rootEl.querySelector('p') || rootEl;
      var step = (parseFloat(getComputedStyle(sample).lineHeight) || 27) / window.innerHeight;
      var next = event.key === 'Home' ? 0.05 : event.key === 'End' ? 0.95 :
        focusY + (event.key === 'ArrowUp' ? -step : step);
      moveFocus(next);
      event.preventDefault();
    });

    // ---- noise (click-initiated only)
    function startNoise() {
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
      if (!noise.ctx) noise.ctx = new AC();
      if (noise.ctx.state === 'suspended') noise.ctx.resume();
      stopNoise(true);
      var src = noise.ctx.createBufferSource(); src.buffer = noiseBuffer(noise.ctx, prefs.noiseType); src.loop = true;
      if (!noise.gain) { noise.gain = noise.ctx.createGain(); noise.gain.connect(noise.ctx.destination); }
      var t = noise.ctx.currentTime;
      noise.gain.gain.cancelScheduledValues(t); noise.gain.gain.setValueAtTime(0, t);
      noise.gain.gain.linearRampToValueAtTime(prefs.volume * prefs.volume, t + 1);
      src.connect(noise.gain); src.start(); noise.src = src; noise.on = true;
      return true;
    }
    function stopNoise(immediate) {
      if (!noise.ctx || !noise.gain) { noise.on = false; return; }
      var t = noise.ctx.currentTime, s = noise.src; noise.src = null; noise.on = false;
      noise.gain.gain.cancelScheduledValues(t);
      if (immediate) { noise.gain.gain.setValueAtTime(0, t); if (s) try { s.stop(); } catch (e) {} return; }
      noise.gain.gain.setValueAtTime(noise.gain.gain.value, t); noise.gain.gain.linearRampToValueAtTime(0, t + 1);
      setTimeout(function () { if (s) try { s.stop(); } catch (e) {} }, 1050);
    }

    // ---- wiring
    var ticking = false;
    function onScroll() {
      if (ticking || destroyed) return; ticking = true;
      requestAnimationFrame(function () {
        ticking = false; if (destroyed) return;
        var idx = currentIdx();
        if (idx !== lastIdx) { lastIdx = idx; ambientReseed(idx); accent(idx); }
        paintRail(); applyFocus();
      });
    }
    function refresh() {
      clearFocus();
      blocks = Array.prototype.slice.call(rootEl.querySelectorAll(focusSel)).filter(function (b) { return !b.closest('table, [data-reader-skip]') && !b.querySelector(focusSel); });
      onScroll();
    }

    buildSections();
    refresh();
    on(window, 'scroll', onScroll, { passive: true });
    on(window, 'resize', onScroll, { passive: true });
    lastIdx = currentIdx(); accent(lastIdx); paintRail();
    setLineFocus(prefs.lineFocus);

    if (ui.noiseType) ui.noiseType.value = prefs.noiseType;
    if (ui.noiseVolume) ui.noiseVolume.value = String(prefs.volume);
    if (ui.noiseOn) ui.noiseOn.checked = false;            // never auto-start, never restore
    if (ui.lineFocus) on(ui.lineFocus, 'change', function () { prefs.lineFocus = ui.lineFocus.checked; savePrefs(); setLineFocus(prefs.lineFocus); });
    if (ui.noiseOn) on(ui.noiseOn, 'change', function () { if (ui.noiseOn.checked) { if (!startNoise()) ui.noiseOn.checked = false; } else stopNoise(false); });
    if (ui.noiseType) on(ui.noiseType, 'change', function () { prefs.noiseType = ['brown', 'pink', 'white', 'violet'].includes(ui.noiseType.value) ? ui.noiseType.value : 'brown'; savePrefs(); if (noise.on) startNoise(); });
    if (ui.noiseVolume) on(ui.noiseVolume, 'input', function () {
      prefs.volume = Math.min(1, Math.max(0, Number(ui.noiseVolume.value))); savePrefs();
      if (noise.gain && noise.ctx) noise.gain.gain.setValueAtTime(prefs.volume * prefs.volume, noise.ctx.currentTime);
    });
    function setNoiseOptions(type, volume) {
      var nextType = ['brown', 'pink', 'white', 'violet'].includes(type) ? type : 'brown';
      var nextVolume = Math.min(1, Math.max(0, Number(volume)));
      var typeChanged = prefs.noiseType !== nextType;
      prefs.noiseType = nextType;
      prefs.volume = Number.isFinite(nextVolume) ? nextVolume : defaults.volume;
      savePrefs();
      if (noise.on && typeChanged) startNoise();
      else if (noise.on && noise.gain && noise.ctx)
        noise.gain.gain.setValueAtTime(prefs.volume * prefs.volume, noise.ctx.currentTime);
    }
    function resetPrefs() {
      lsDel(prefsKey); prefs = loadPrefs(); setLineFocus(prefs.lineFocus); stopNoise(true);
      if (ui.noiseOn) ui.noiseOn.checked = false;
      if (ui.noiseType) ui.noiseType.value = prefs.noiseType;
      if (ui.noiseVolume) ui.noiseVolume.value = String(prefs.volume);
    }
    if (ui.reset) on(ui.reset, 'click', resetPrefs);

    function destroy() {
      if (destroyed) return; destroyed = true;
      listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
      stopNoise(true);
      clearFocus();
      grip.remove();
      if (ui.fill) ui.fill.style.width = '0%';
      if (o.sections !== 'existing') {
        sections.forEach(function (s) { while (s.firstChild) s.parentNode.insertBefore(s.firstChild, s); s.parentNode.removeChild(s); });
      }
      sections = []; blocks = []; active = [];
    }
    return { destroy: destroy, refresh: refresh, setLineFocus: setLineFocus, startNoise: startNoise, stopNoise: stopNoise, setNoiseOptions: setNoiseOptions,
             resetPrefs: resetPrefs, state: function () { return { section: lastIdx, total: sections.length, lineFocus: lineOn, noise: noise.on, reducedMotion: reduceMotion, prefs: prefs }; } };
  }
  return { init: init, version: '1.0.0' };
});
