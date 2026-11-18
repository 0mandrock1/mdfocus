/* Reader controls that use text positions without changing Markdown markup. */
(function () {
  'use strict';

  const PROSE = 'p, li, blockquote, h1, h2, h3, h4, h5, h6';
  const SENTENCES = typeof Intl.Segmenter === 'function' ?
    new Intl.Segmenter(['uk', 'en'], { granularity: 'sentence' }) : null;

  function proseBlock(article, node) {
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    const block = element?.closest(PROSE);
    return block && article.contains(block) && !block.closest('table, pre, [hidden]') ? block : null;
  }

  function textMap(block) {
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    const runs = [];
    let text = '';
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (parent.closest(PROSE) !== block || parent.closest('script, style, [hidden]')) continue;
      runs.push({ node, start: text.length });
      text += node.data;
    }
    return { text, runs };
  }

  function textPoint(article, node, offset) {
    const block = proseBlock(article, node);
    if (!block) return null;
    const map = textMap(block);
    const run = map.runs.find(entry => entry.node === node);
    if (run) return { block, offset: run.start + offset };
    if (map.text.trim()) return { block, offset: 0 };
    return null;
  }

  function pointAt(article, x, y) {
    const position = document.caretPositionFromPoint?.(x, y);
    if (position) return textPoint(article, position.offsetNode, position.offset);
    const range = document.caretRangeFromPoint?.(x, y);
    return range ? textPoint(article, range.startContainer, range.startOffset) : null;
  }

  function rangeAt(map, start, end) {
    if (!map.runs.length || end <= start) return null;
    const first = map.runs.find(run => start < run.start + run.node.length);
    const last = map.runs.find(run => end <= run.start + run.node.length);
    if (!first || !last) return null;
    const range = document.createRange();
    range.setStart(first.node, start - first.start);
    range.setEnd(last.node, end - last.start);
    return range;
  }

  function glyphRect(point) {
    const map = textMap(point.block);
    const start = Math.min(point.offset, map.text.length - 1);
    return start >= 0 ? rangeAt(map, start, start + 1)?.getClientRects()[0] : null;
  }

  function sentences(text) {
    const list = [];
    const segments = SENTENCES ? SENTENCES.segment(text) : text.matchAll(/[^.!?…]+(?:[.!?…]+|$)|[.!?…]+/gu);
    for (const item of segments) {
      const raw = item.segment ?? item[0];
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const start = item.index + raw.indexOf(trimmed);
      list.push({ start, end: start + trimmed.length });
    }
    return list;
  }

  function sentenceIndex(list, offset) {
    const index = list.findIndex(sentence => offset < sentence.end);
    return index < 0 ? list.length - 1 : index;
  }

  function markText(name, fallbackClass) {
    let markedBlock = null;
    return function mark(block, sentence) {
      if (markedBlock) markedBlock.classList.remove(fallbackClass);
      markedBlock = null;
      const registry = window.CSS?.highlights;
      if (registry && typeof Highlight === 'function') {
        registry.delete(name);
        if (sentence) {
          const range = rangeAt(textMap(block), sentence.start, sentence.end);
          if (range) registry.set(name, new Highlight(range));
        }
      } else if (sentence) {
        block.classList.add(fallbackClass);
        markedBlock = block;
      }
    };
  }

  function addTextControls(article, readingBottom, hint) {
    const pinButton = document.getElementById('reader-pin');
    const speechButton = document.getElementById('reader-speech');
    const stopButton = document.getElementById('reader-speech-stop');
    const voiceSetting = document.getElementById('reader-voice-language');
    const synth = typeof SpeechSynthesisUtterance === 'function' && window.speechSynthesis;
    const markPin = markText('mdfocus-pin', 'reader-pin-block');
    const markSpeech = markText('mdfocus-speech', 'reader-speech-block');
    let pick = null;
    let pin = null;
    let speech = null;
    let frame = null;
    let repaint = false;
    let voiceLanguage = 'auto';
    const languages = ['auto', 'uk-UA', 'en-US', 'ru-RU'];

    try {
      const saved = localStorage.getItem('mdfocus:voice-language');
      if (languages.includes(saved)) voiceLanguage = saved;
    } catch (error) { /* Storage is optional. */ }
    voiceSetting.value = voiceLanguage;
    voiceSetting.addEventListener('change', function () {
      voiceLanguage = voiceSetting.value;
      try { localStorage.setItem('mdfocus:voice-language', voiceLanguage); } catch (error) { /* Optional. */ }
    });
    speechButton.hidden = !synth;
    document.getElementById('reader-voice-setting').hidden = !synth;

    function updateButtons() {
      article.classList.toggle('reader-pick', !!pick);
      pinButton.setAttribute('aria-pressed', String(pick === 'pin' || !!pin));
      speechButton.setAttribute('aria-pressed', String(pick === 'speech' || !!speech));
      speechButton.textContent = speech ? (speech.utterance ? 'Пауза' : 'Продовжити') : 'Озвучити';
      stopButton.hidden = !speech;
    }

    function geometry() {
      return [innerWidth, article.clientWidth, article.scrollHeight].join(':');
    }

    function refresh(forcePaint = false) {
      if (!pin && (!speech || !forcePaint)) return;
      repaint ||= forcePaint;
      if (frame !== null) return;
      frame = requestAnimationFrame(function () {
        frame = null;
        if (pin) {
          const layout = geometry();
          let rect = glyphRect(pin.point);
          if (rect && layout !== pin.layout && pin.inView) {
            const top = Math.min(Math.max(8, pin.y), Math.max(8, readingBottom() - rect.height));
            if (Math.abs(rect.top - top) > 1) {
              window.scrollBy(0, rect.top - top);
              rect = glyphRect(pin.point);
            }
          }
          pin.layout = layout;
          pin.y = rect?.top ?? -1;
          pin.inView = !!rect && pin.y >= 0 && pin.y < readingBottom();
          if (repaint) markPin(pin.point.block, pin.sentence);
        }
        if (speech && repaint) markSpeech(speech.block, speech.list[speech.index]);
        repaint = false;
      });
    }

    function clearPin() {
      pin = null;
      markPin(null, null);
      updateButtons();
    }

    function pinAt(point) {
      const list = sentences(textMap(point.block).text);
      const sentence = list[sentenceIndex(list, point.offset)];
      const rect = glyphRect(point);
      if (!sentence || !rect) return false;
      pin = { point, sentence, y: rect.top, layout: geometry(), inView: rect.top >= 0 && rect.top < readingBottom() };
      markPin(point.block, sentence);
      return true;
    }

    function preferredLanguage(block, text) {
      if (voiceLanguage !== 'auto') return voiceLanguage;
      const labeled = block.closest('[lang]');
      if (labeled && article.contains(labeled)) return labeled.lang;
      const latin = (text.match(/\p{Script=Latin}/gu) || []).length;
      const cyrillic = (text.match(/\p{Script=Cyrillic}/gu) || []).length;
      return cyrillic > latin ? 'uk-UA' : 'en-US';
    }

    function cancelSpeech(clear) {
      if (!speech) return;
      const wasSpeaking = !!speech.utterance;
      speech.utterance = null;
      if (clear) {
        speech = null;
        markSpeech(null, null);
      }
      if (wasSpeaking) synth.cancel();
      updateButtons();
    }

    function nextSentence(state) {
      state.index++;
      if (state.index < state.list.length) return true;
      while (state.blockIndex + 1 < state.blocks.length) {
        state.block = state.blocks[++state.blockIndex];
        state.list = sentences(textMap(state.block).text);
        state.index = 0;
        if (state.list.length) return true;
      }
      return false;
    }

    function speakSentence() {
      const state = speech;
      const sentence = state.list[state.index];
      const map = textMap(state.block);
      const line = map.text.slice(sentence.start, sentence.end);
      const utterance = new SpeechSynthesisUtterance(line);
      utterance.lang = preferredLanguage(state.block, line);
      state.utterance = utterance;
      markSpeech(state.block, sentence);
      const rect = rangeAt(map, sentence.start, sentence.end)?.getClientRects()[0];
      if (rect && (rect.top < 8 || rect.bottom > readingBottom())) {
        window.scrollBy(0, rect.top - Math.min(80, innerHeight * 0.16));
      }
      updateButtons();
      utterance.onend = function () {
        if (speech !== state || state.utterance !== utterance) return;
        state.utterance = null;
        if (nextSentence(state)) {
          speakSentence();
        } else {
          cancelSpeech(true);
        }
      };
      utterance.onerror = function () {
        if (speech !== state || state.utterance !== utterance) return;
        state.utterance = null;
        cancelSpeech(true);
        hint('Голос недоступний. Спробуй іншу мову в налаштуваннях.');
      };
      synth.speak(utterance);
    }

    function startSpeech(point) {
      const blocks = Array.from(article.querySelectorAll(PROSE)).filter(block => !block.closest('table, pre, [hidden]'));
      const index = blocks.indexOf(point.block);
      const list = sentences(textMap(point.block).text);
      if (index < 0 || !list.length) return false;
      speech = { blocks, block: point.block, blockIndex: index, list, index: sentenceIndex(list, point.offset), utterance: null };
      speakSentence();
      return true;
    }

    function choose(point) {
      if (!point) return;
      const mode = pick;
      pick = null;
      const applied = mode === 'pin' ? pinAt(point) : startSpeech(point);
      if (!applied) pick = mode;
      else hint('');
      updateButtons();
    }

    function arm(mode, instruction) {
      pick = pick === mode ? null : mode;
      hint(pick ? instruction : '', true);
      updateButtons();
      const selection = window.getSelection();
      if (pick && selection?.rangeCount && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        const point = textPoint(article, range.startContainer, range.startOffset);
        if (point) {
          selection.removeAllRanges();
          choose(point);
        }
      }
    }

    pinButton.addEventListener('click', function () {
      if (pin) clearPin();
      else arm('pin', 'Торкнись речення, яке має лишитися на цій висоті.');
    });
    speechButton.addEventListener('click', function () {
      if (speech?.utterance) cancelSpeech(false);
      else if (speech) speakSentence();
      else arm('speech', 'Торкнись речення, з якого почати озвучення.');
    });
    stopButton.addEventListener('click', function () { cancelSpeech(true); speechButton.focus(); });
    article.addEventListener('click', function (event) {
      if (!pick || event.button !== 0 || !proseBlock(article, event.target)) return;
      const point = pointAt(article, event.clientX, event.clientY);
      if (!point) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      choose(point);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && pick) {
        pick = null;
        hint('');
        updateButtons();
      }
    });
    window.addEventListener('scroll', function () { refresh(); }, { passive: true });
    window.addEventListener('resize', function () { refresh(true); });
    window.visualViewport?.addEventListener('resize', function () { refresh(true); });
    window.addEventListener('pagehide', function () { cancelSpeech(false); });

    return {
      refresh,
      reset() {
        pick = null;
        clearPin();
        cancelSpeech(true);
        hint('');
      }
    };
  }

  function addHoldScroll(hint) {
    const button = document.getElementById('reader-drift');
    let active = null;
    let timer = null;

    function stop() {
      if (!active) return;
      const id = active.pointer;
      active = null;
      clearTimeout(timer);
      button.setAttribute('aria-pressed', 'false');
      if (id !== null && button.hasPointerCapture(id)) button.releasePointerCapture(id);
    }

    function tick() {
      const state = active;
      if (!state) return;
      const now = performance.now();
      const elapsed = Math.min(80, now - state.last);
      state.last = now;
      const scroller = document.scrollingElement;
      const limit = scroller.scrollHeight - scroller.clientHeight;
      state.target = Math.min(limit, state.target + state.speed * elapsed / 1000);
      if (elapsed) window.scrollTo(0, state.target);
      if (state.target >= limit) { stop(); return; }
      timer = setTimeout(tick, 16);
    }

    function start(pointer, x) {
      if (active || document.querySelector('.focus-grip.dragging, dialog[open]')) return;
      active = { pointer, x, speed: 120, last: performance.now(), target: window.scrollY };
      button.setAttribute('aria-pressed', 'true');
      timer = setTimeout(tick, 16);
    }

    button.addEventListener('pointerdown', function (event) {
      if (event.button !== 0 || active) return;
      event.preventDefault();
      start(event.pointerId, event.clientX);
      if (active) button.setPointerCapture(event.pointerId);
    });
    button.addEventListener('pointermove', function (event) {
      if (active?.pointer !== event.pointerId) return;
      const delta = event.clientX - active.x;
      active.speed = Math.max(32, Math.min(420, 120 + delta * 2.5));
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      button.addEventListener(type, function (event) { if (active?.pointer === event.pointerId) stop(); });
    }
    button.addEventListener('keydown', function (event) {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      event.preventDefault();
      if (!event.repeat) start(null, 0);
    });
    button.addEventListener('keyup', function (event) {
      if (active?.pointer === null && (event.key === 'Enter' || event.key === ' ')) stop();
    });
    button.addEventListener('blur', stop);
    button.addEventListener('contextmenu', event => event.preventDefault());
    window.addEventListener('blur', stop);
    window.addEventListener('pagehide', stop);
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); });
    button.addEventListener('click', function (event) {
      if (event.detail === 0) hint('Утримуй пробіл або Enter, щоб прокручувати.');
    });

    return stop;
  }

  // Expand each HTML row group into logical columns, including spans from earlier rows.
  function tableColumns(rows) {
    const grid = Array.from(rows, () => []);
    Array.from(rows).forEach(function (row, rowIndex) {
      let column = 0;
      for (const cell of row.cells) {
        while (grid[rowIndex][column]) column++;
        const endRow = Math.min(rows.length, rowIndex + (cell.rowSpan || rows.length));
        for (let y = rowIndex; y < endRow; y++) {
          for (let x = column; x < column + cell.colSpan; x++) grid[y][x] = cell;
        }
        column += cell.colSpan;
      }
    });
    return grid;
  }

  function addTableCards(stopScroll) {
    const dialog = document.getElementById('reader-table');
    const title = document.getElementById('reader-table-title');
    const card = document.getElementById('reader-table-card');
    const count = document.getElementById('reader-table-count');
    const previous = document.getElementById('reader-table-prev');
    const next = document.getElementById('reader-table-next');
    const close = dialog.querySelector('[data-close]');
    let state = null;
    let gesture = null;

    function showRow(index) {
      if (!state || index < 0 || index >= state.rows.length) return;
      const row = state.rows[index];
      const fields = new Map();
      row.forEach(function (cell, column) {
        if (!fields.has(cell)) fields.set(cell, []);
        const headings = state.headers.map(header => header[column]?.textContent.trim()).filter(Boolean);
        fields.get(cell).push(headings.length ? Array.from(new Set(headings)).join(' › ') : 'Колонка ' + (column + 1));
      });
      const content = document.createDocumentFragment();
      fields.forEach(function (headings, cell) {
        const field = document.createElement('div');
        const label = document.createElement('dt');
        label.textContent = Array.from(new Set(headings)).join(' / ');
        const value = document.createElement('dd');
        value.textContent = cell.innerText.trim() || '—';
        field.append(label, value);
        content.appendChild(field);
      });
      card.replaceChildren(content);
      state.index = index;
      count.textContent = (index + 1) + ' / ' + state.rows.length;
      previous.disabled = index === 0;
      next.disabled = index === state.rows.length - 1;
      dialog.scrollTop = 0;
    }

    function openCards(table, row, trigger) {
      stopScroll();
      const groups = Array.from(table.tBodies);
      if (table.tFoot) groups.push(table.tFoot);
      const bodyRows = groups.flatMap(group => Array.from(group.rows));
      const index = row ? Math.max(0, bodyRows.indexOf(row)) : 0;
      state = {
        index,
        headers: table.tHead ? tableColumns(table.tHead.rows) : [],
        rows: groups.flatMap(group => tableColumns(group.rows)),
        trigger,
      };
      title.textContent = table.caption?.textContent.trim() || 'Картки рядків';
      dialog.showModal();
      showRow(index);
    }

    function attach(table, wrap) {
      if (!Array.from(table.tBodies).some(group => group.rows.length) && !table.tFoot?.rows.length) return;
      const tools = document.createElement('div');
      tools.className = 'reader-table-tools';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'reader-control reader-table-open';
      button.textContent = 'Картки рядків';
      button.setAttribute('aria-haspopup', 'dialog');
      tools.appendChild(button);
      wrap.before(tools);

      button.addEventListener('click', function () { openCards(table, null, button); });
      table.addEventListener('click', function (event) {
        if (event.pointerType !== 'touch' && !matchMedia('(pointer:coarse)').matches) return;
        const row = event.target.closest('tbody tr, tfoot tr');
        if (!row || row.closest('table') !== table || event.target.closest('a, button, input, select, textarea, summary') ||
            !window.getSelection()?.isCollapsed) return;
        openCards(table, row, button);
      });
    }

    close.addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('close', function () {
      state?.trigger.focus({ preventScroll: true });
      state = null;
      gesture = null;
      card.replaceChildren();
    });
    previous.addEventListener('click', function () { showRow(state.index - 1); });
    next.addEventListener('click', function () { showRow(state.index + 1); });
    dialog.addEventListener('keydown', function (event) {
      if (!state || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      showRow(state.index + (event.key === 'ArrowRight' ? 1 : -1));
    });
    card.addEventListener('pointerdown', function (event) {
      if (event.pointerType === 'touch' && event.isPrimary) {
        gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
      }
    });
    card.addEventListener('pointerup', function (event) {
      if (!state || gesture?.id !== event.pointerId) return;
      const delta = event.clientX - gesture.x;
      if (Math.abs(delta) >= 46 && Math.abs(delta) > Math.abs(event.clientY - gesture.y) * 1.6) {
        showRow(state.index + (delta < 0 ? 1 : -1));
      }
      gesture = null;
    });
    card.addEventListener('pointercancel', function () { gesture = null; });

    return { attach, close: () => { if (dialog.open) dialog.close(); } };
  }

  window.createMdfocusInteractions = function (article, readingBottom) {
    const message = document.getElementById('reader-tool-hint');
    let hintTimer = null;
    function hint(text, persistent = false) {
      clearTimeout(hintTimer);
      message.textContent = text;
      message.hidden = !text;
      if (text && !persistent) hintTimer = setTimeout(function () { hint(''); }, 3000);
    }

    const textControls = addTextControls(article, readingBottom, hint);
    const stopScroll = addHoldScroll(hint);
    const cards = addTableCards(stopScroll);

    return {
      refresh: textControls.refresh,
      attachTable: cards.attach,
      stopScroll,
      reset() {
        stopScroll();
        textControls.reset();
        cards.close();
      }
    };
  };
})();
