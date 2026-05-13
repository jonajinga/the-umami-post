/**
 * Article TTS — Kokoro (high-quality) with Web Speech fallback.
 *
 * Two engines:
 *   1. Web Speech API (built-in to the browser) — instant, no download.
 *      Voice quality depends entirely on the platform. We pick the best
 *      available voice automatically.
 *   2. Kokoro-js — runs an 82M-parameter ONNX TTS model in the browser
 *      via Transformers.js. Studio-quality voices, but the first
 *      activation downloads ~82 MB of weights. Subsequent uses are
 *      cached by the browser's Cache API and load in ~1-2 s.
 *
 * The first time a reader clicks Listen we show an inline picker:
 *   - Use device voice now (instant)
 *   - Download Kokoro (~82 MB, one-time)
 * Their choice is saved to localStorage. A small "Voice settings"
 * button inside the popover lets them switch engines/voices later.
 *
 * Per-article resume: the sentence index is saved as the reader plays
 * so closing and reopening the article picks up where they left off.
 */
(function () {
  'use strict';

  // ── Storage keys ──
  var K_ENGINE   = 'tft-tts-engine';   // 'kokoro' | 'webspeech' | (unset)
  var K_VOICE    = 'tft-tts-voice';    // 'af_heart' or webspeech voiceURI
  var K_RATE     = 'tft-tts-rate';     // float
  var K_POS_PFX  = 'tft-tts-pos:';     // per-url sentence index

  // ── Kokoro source + model ──
  // esm.sh resolves transitive ESM deps (Transformers.js, ONNX
  // Runtime, etc.) reliably for browser use. jsdelivr's `+esm` is
  // hit-or-miss for packages with complex peer-dep graphs.
  var KOKORO_ESM = 'https://esm.sh/kokoro-js@1.2.1';
  var KOKORO_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
  var KOKORO_DTYPE = 'q8'; // q4 ≈ 50 MB but lower quality; q8 is the sweet spot
  var DEFAULT_VOICE = 'af_heart';

  // Browser pre-flight: WebAssembly is required (Transformers.js
  // depends on it). WebGPU is optional but speeds things up if
  // available. We don't gate on WebGPU — Kokoro falls back to WASM.
  function browserSupportsKokoro() {
    if (typeof WebAssembly !== 'object' || typeof WebAssembly.instantiate !== 'function') {
      return { ok: false, reason: 'WebAssembly is not supported in this browser. Try a recent version of Chrome, Edge, Firefox, or Safari.' };
    }
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      return { ok: false, reason: 'Kokoro needs HTTPS (or localhost) to use the browser cache. Visit the live site to download the model.' };
    }
    return { ok: true };
  }

  // Curated voice catalog — Kokoro's full v1.0 voice list, grouped for
  // a sensible dropdown. Labels prefer the most natural human-readable
  // form. If kokoro-js exposes more voices at runtime they get added
  // automatically into the "Other" group.
  var VOICE_CATALOG = [
    { group: 'American — Female', voices: [
      { id: 'af_heart',    name: 'Heart' },
      { id: 'af_alloy',    name: 'Alloy' },
      { id: 'af_aoede',    name: 'Aoede' },
      { id: 'af_bella',    name: 'Bella' },
      { id: 'af_jessica',  name: 'Jessica' },
      { id: 'af_kore',     name: 'Kore' },
      { id: 'af_nicole',   name: 'Nicole' },
      { id: 'af_nova',     name: 'Nova' },
      { id: 'af_river',    name: 'River' },
      { id: 'af_sarah',    name: 'Sarah' },
      { id: 'af_sky',      name: 'Sky' }
    ]},
    { group: 'American — Male', voices: [
      { id: 'am_adam',     name: 'Adam' },
      { id: 'am_echo',     name: 'Echo' },
      { id: 'am_eric',     name: 'Eric' },
      { id: 'am_fenrir',   name: 'Fenrir' },
      { id: 'am_liam',     name: 'Liam' },
      { id: 'am_michael',  name: 'Michael' },
      { id: 'am_onyx',     name: 'Onyx' },
      { id: 'am_puck',     name: 'Puck' },
      { id: 'am_santa',    name: 'Santa' }
    ]},
    { group: 'British — Female', voices: [
      { id: 'bf_alice',    name: 'Alice' },
      { id: 'bf_emma',     name: 'Emma' },
      { id: 'bf_isabella', name: 'Isabella' },
      { id: 'bf_lily',     name: 'Lily' }
    ]},
    { group: 'British — Male', voices: [
      { id: 'bm_daniel',   name: 'Daniel' },
      { id: 'bm_fable',    name: 'Fable' },
      { id: 'bm_george',   name: 'George' },
      { id: 'bm_lewis',    name: 'Lewis' }
    ]}
  ];

  function ls(key, fallback) { try { return localStorage.getItem(key) || fallback; } catch (e) { return fallback; } }
  function lset(key, value)  { try { localStorage.setItem(key, value); } catch (e) {} }
  function lremove(key)      { try { localStorage.removeItem(key); } catch (e) {} }

  // ── State ──
  var state = {
    btn: null,
    body: null,
    sentences: [],
    cursor: 0,
    speaking: false,
    paused: false,
    rate: parseFloat(ls(K_RATE, '1')) || 1,
    engine: ls(K_ENGINE, ''),
    voice: ls(K_VOICE, DEFAULT_VOICE),
    webSpeechVoice: null,
    kokoroTTS: null,
    kokoroLoading: null,
    audio: null,
    // sentence pipeline cache: { index → Audio element }
    pipeline: {}
  };

  // ── Article body extraction ──
  function pickArticleBody() {
    return document.querySelector('.article-body, .library-body, [data-pagefind-body]');
  }

  function extractSentences(root) {
    if (!root) return [];
    var clone = root.cloneNode(true);
    clone.querySelectorAll([
      'script', 'style',
      '.article-action-btn', '.annotation-toolbar',
      '.share-panel', '.share-wrap',
      '.responses-section', '.article-comments',
      '.tip-buttons', '.tip-badge', '.article-header__support-row',
      '[data-tts-skip]',
      'pre', 'code'
    ].join(',')).forEach(function (n) { n.remove(); });
    var text = clone.textContent.replace(/\s+/g, ' ').trim();
    if (!text) return [];
    var raw = text.split(/(?<=[.!?])\s+(?=[A-Z"'‘“])/);
    return raw.map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function posKey(url) { return K_POS_PFX + (url || location.pathname); }
  function savePos()   { if (state.cursor > 0) lset(posKey(), String(state.cursor)); else lremove(posKey()); }
  function loadPos()   {
    var v = parseInt(ls(posKey(), '0'), 10);
    return Number.isFinite(v) && v >= 0 ? v : 0;
  }

  // ── Web Speech voice picker ──
  function pickWebSpeechVoice() {
    if (!('speechSynthesis' in window)) return null;
    var voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    function score(v) {
      var name = (v.name || '').toLowerCase();
      var lang = (v.lang || '').toLowerCase();
      var s = 0;
      if (lang.indexOf('en-us') === 0) s += 30;
      else if (lang.indexOf('en-gb') === 0) s += 20;
      else if (lang.indexOf('en') === 0) s += 10;
      if (name.indexOf('google') !== -1)   s += 25;
      if (name.indexOf('natural') !== -1)  s += 25;
      if (name.indexOf('premium') !== -1)  s += 20;
      if (name.indexOf('enhanced') !== -1) s += 18;
      if (name.indexOf('neural') !== -1)   s += 18;
      if (name.indexOf('siri') !== -1)     s += 15;
      if (v.localService) s += 4;
      if (name.indexOf('compact') !== -1) s -= 12;
      return s;
    }
    var saved = ls(K_VOICE, '');
    if (saved) {
      var match = voices.find(function (v) { return v.voiceURI === saved || v.name === saved; });
      if (match) return match;
    }
    return voices.slice().sort(function (a, b) { return score(b) - score(a); })[0] || null;
  }

  // ── Kokoro loading ──
  function ensureKokoro(onProgress) {
    if (state.kokoroTTS) return Promise.resolve(state.kokoroTTS);
    if (state.kokoroLoading) return state.kokoroLoading;

    var pre = browserSupportsKokoro();
    if (!pre.ok) return Promise.reject(new Error(pre.reason));

    state.kokoroLoading = import(/* webpackIgnore: true */ KOKORO_ESM)
      .catch(function (err) {
        // Friendly diagnostic for module-load failures (CSP, network,
        // CDN outage). Re-throw so the caller's catch sees it.
        console.error('[tts] kokoro-js ESM import failed:', err);
        throw new Error('Could not load the Kokoro library from esm.sh. ' +
          'Open the browser DevTools console for details.');
      })
      .then(function (mod) {
        if (!mod || !mod.KokoroTTS || typeof mod.KokoroTTS.from_pretrained !== 'function') {
          throw new Error('Kokoro library loaded but the KokoroTTS class is missing.');
        }
        return mod.KokoroTTS.from_pretrained(KOKORO_MODEL_ID, {
          dtype: KOKORO_DTYPE,
          progress_callback: function (p) {
            try { if (onProgress) onProgress(p); } catch (e) { console.warn('[tts] progress cb error:', e); }
          }
        });
      })
      .then(function (tts) {
        if (!tts || typeof tts.generate !== 'function') {
          throw new Error('Kokoro initialised but the generate() method is missing.');
        }
        state.kokoroTTS = tts;
        return tts;
      })
      .catch(function (err) {
        console.error('[tts] Kokoro initialisation failed:', err);
        state.kokoroLoading = null;
        throw err;
      });

    return state.kokoroLoading;
  }

  // ── Settings popover ──
  function ensurePopover() {
    var pop = document.getElementById('tts-popover');
    if (pop) return pop;
    pop = document.createElement('div');
    pop.id = 'tts-popover';
    pop.className = 'tts-popover';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'Text-to-speech settings');
    pop.hidden = true;
    pop.innerHTML = ''; // populated dynamically
    document.body.appendChild(pop);
    document.addEventListener('click', function (e) {
      if (pop.hidden) return;
      if (pop.contains(e.target)) return;
      if (e.target.closest && e.target.closest('#tts-btn')) return;
      pop.hidden = true;
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !pop.hidden) pop.hidden = true;
    });
    return pop;
  }

  function positionPopover() {
    var pop = document.getElementById('tts-popover');
    var btn = state.btn || document.getElementById('tts-btn');
    if (!pop || !btn) return;
    var btnR = btn.getBoundingClientRect();
    var pw = pop.offsetWidth || 280;
    var ph = pop.offsetHeight || 280;
    var left = Math.max(8, Math.min(window.innerWidth - pw - 8, btnR.left + btnR.width / 2 - pw / 2));
    var top  = btnR.top - ph - 8;
    if (top < 8) top = btnR.bottom + 8; // flip below if no space above
    pop.style.left = left + 'px';
    pop.style.top  = top + 'px';
  }

  function renderEnginePicker() {
    var pop = ensurePopover();
    var pre = browserSupportsKokoro();
    var kokoroDescription = pre.ok
      ? 'One-time ~82 MB download. Cached for repeat use. Best on desktop.'
      : 'Unavailable: ' + pre.reason;
    pop.innerHTML =
      '<div class="tts-popover__head">' +
        '<strong>Listen to this article</strong>' +
        '<button type="button" class="tts-popover__close" aria-label="Close">&times;</button>' +
      '</div>' +
      '<p class="tts-popover__lede">Choose a voice. You can change this later.</p>' +
      '<div class="tts-popover__choices">' +
        '<button type="button" class="tts-popover__choice" data-tts-engine="webspeech">' +
          '<strong>Device voice</strong>' +
          '<span>Instant. Quality depends on your browser/OS.</span>' +
        '</button>' +
        '<button type="button" class="tts-popover__choice" data-tts-engine="kokoro"' + (pre.ok ? '' : ' disabled style="opacity:0.5;cursor:not-allowed"') + '>' +
          '<strong>Kokoro (studio quality)</strong>' +
          '<span>' + kokoroDescription + '</span>' +
        '</button>' +
      '</div>';
    pop.hidden = false;
    positionPopover();
    pop.querySelector('.tts-popover__close').addEventListener('click', function () { pop.hidden = true; });
    pop.querySelectorAll('[data-tts-engine]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.disabled) return;
        var eng = b.getAttribute('data-tts-engine');
        state.engine = eng;
        lset(K_ENGINE, eng);
        if (eng === 'kokoro') renderKokoroLoadingThenSettings();
        else { pop.hidden = true; play(); }
      });
    });
  }

  function renderKokoroLoadingThenSettings() {
    var pop = ensurePopover();
    pop.innerHTML =
      '<div class="tts-popover__head">' +
        '<strong>Loading Kokoro</strong>' +
        '<button type="button" class="tts-popover__close" aria-label="Close">&times;</button>' +
      '</div>' +
      '<p class="tts-popover__lede">Downloading the voice model. Cached by your browser, so this only happens once.</p>' +
      '<div class="tts-progress">' +
        '<div class="tts-progress__bar"><span class="tts-progress__fill" style="width:0%"></span></div>' +
        '<div class="tts-progress__line"><span class="tts-progress__pct">0%</span> &middot; <span class="tts-progress__file">starting…</span></div>' +
      '</div>';
    pop.hidden = false;
    positionPopover();
    pop.querySelector('.tts-popover__close').addEventListener('click', function () { pop.hidden = true; });

    var fillEl = pop.querySelector('.tts-progress__fill');
    var pctEl  = pop.querySelector('.tts-progress__pct');
    var fileEl = pop.querySelector('.tts-progress__file');

    ensureKokoro(function (p) {
      if (!p) return;
      // Progress callback shape varies; cope with what's there
      var pct = (p.progress != null) ? Math.round(p.progress)
             : (p.loaded && p.total) ? Math.round(p.loaded / p.total * 100) : null;
      if (pct != null) {
        fillEl.style.width = pct + '%';
        pctEl.textContent = pct + '%';
      }
      if (p.file) fileEl.textContent = p.file;
      if (p.status === 'ready' || p.status === 'done') fileEl.textContent = 'ready';
    }).then(function () {
      renderKokoroSettings();
    }).catch(function (err) {
      var msg = (err && err.message) ? err.message : 'Unknown error';
      pop.innerHTML =
        '<div class="tts-popover__head"><strong>Kokoro could not load</strong>' +
        '<button type="button" class="tts-popover__close" aria-label="Close">&times;</button></div>' +
        '<p class="tts-popover__lede">' + msg + '</p>' +
        '<p class="tts-popover__lede" style="font-size: 0.7rem">Open browser DevTools (F12) → Console for full details.</p>' +
        '<div class="tts-popover__choices">' +
          '<button type="button" class="tts-popover__choice" data-tts-retry>Try again</button>' +
          '<button type="button" class="tts-popover__choice" data-tts-fallback>Use device voice instead</button>' +
        '</div>';
      pop.querySelector('.tts-popover__close').addEventListener('click', function () { pop.hidden = true; });
      pop.querySelector('[data-tts-retry]').addEventListener('click', function () {
        state.kokoroLoading = null;
        renderKokoroLoadingThenSettings();
      });
      pop.querySelector('[data-tts-fallback]').addEventListener('click', function () {
        state.engine = 'webspeech';
        lset(K_ENGINE, 'webspeech');
        pop.hidden = true;
        play();
      });
    });
  }

  function getKokoroVoiceList() {
    // Merge our curated catalog with anything kokoro-js exposes that we
    // haven't catalogued, so new voices appear without a code change.
    var groups = VOICE_CATALOG.map(function (g) { return { group: g.group, voices: g.voices.slice() }; });
    var seen = {};
    groups.forEach(function (g) { g.voices.forEach(function (v) { seen[v.id] = true; }); });
    var extra = [];
    try {
      var native = state.kokoroTTS && state.kokoroTTS.list_voices && state.kokoroTTS.list_voices();
      if (native && typeof native === 'object') {
        Object.keys(native).forEach(function (id) {
          if (!seen[id]) extra.push({ id: id, name: native[id].name || id });
        });
      }
    } catch (e) {}
    if (extra.length) groups.push({ group: 'Other', voices: extra });
    return groups;
  }

  function renderKokoroSettings() {
    var pop = ensurePopover();
    var groups = getKokoroVoiceList();
    var voiceOpts = groups.map(function (g) {
      return '<optgroup label="' + g.group + '">' +
        g.voices.map(function (v) {
          return '<option value="' + v.id + '"' + (state.voice === v.id ? ' selected' : '') + '>' + v.name + '</option>';
        }).join('') +
      '</optgroup>';
    }).join('');

    pop.innerHTML =
      '<div class="tts-popover__head">' +
        '<strong>Voice &amp; speed</strong>' +
        '<button type="button" class="tts-popover__close" aria-label="Close">&times;</button>' +
      '</div>' +
      '<label class="tts-field"><span>Voice</span>' +
        '<select id="tts-voice-select">' + voiceOpts + '</select>' +
      '</label>' +
      '<label class="tts-field"><span>Speed <em data-tts-rate-label>' + state.rate.toFixed(2) + '×</em></span>' +
        '<input type="range" id="tts-rate-input" min="0.7" max="1.6" step="0.05" value="' + state.rate + '">' +
      '</label>' +
      '<div class="tts-popover__row">' +
        '<button type="button" class="tts-popover__btn" data-tts-action="play">Play sample</button>' +
        '<button type="button" class="tts-popover__btn" data-tts-action="switch">Switch to device voice</button>' +
      '</div>';
    pop.hidden = false;
    positionPopover();

    var sel  = pop.querySelector('#tts-voice-select');
    var rate = pop.querySelector('#tts-rate-input');
    var rateLbl = pop.querySelector('[data-tts-rate-label]');
    sel.addEventListener('change', function () { state.voice = sel.value; lset(K_VOICE, state.voice); });
    rate.addEventListener('input', function () {
      state.rate = parseFloat(rate.value) || 1;
      lset(K_RATE, String(state.rate));
      rateLbl.textContent = state.rate.toFixed(2) + '×';
    });
    pop.querySelector('.tts-popover__close').addEventListener('click', function () { pop.hidden = true; });
    pop.querySelector('[data-tts-action="play"]').addEventListener('click', function () {
      pop.hidden = true;
      // Play a one-sentence sample by overriding the queue temporarily
      sampleKokoro('This is the voice you have chosen — it will be used for the rest of this article.');
    });
    pop.querySelector('[data-tts-action="switch"]').addEventListener('click', function () {
      state.engine = 'webspeech';
      lset(K_ENGINE, 'webspeech');
      pop.hidden = true;
      stop();
      renderEnginePicker(); // back to picker so they can re-pick if they change their mind
    });
  }

  function sampleKokoro(text) {
    if (!state.kokoroTTS) return;
    state.kokoroTTS.generate(text, { voice: state.voice }).then(function (audio) {
      var url = URL.createObjectURL(audio.toBlob());
      var el = new Audio(url);
      el.playbackRate = state.rate;
      el.onended = function () { URL.revokeObjectURL(url); };
      el.play().catch(function () {});
    }).catch(function () {});
  }

  // ── Playback button state ──
  function setBtnState(playing) {
    if (!state.btn) return;
    state.btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
    state.btn.classList.toggle('is-playing', playing);
    var play  = state.btn.querySelector('.tts-icon-play');
    var pause = state.btn.querySelector('.tts-icon-pause');
    if (play)  play.hidden  = playing;
    if (pause) pause.hidden = !playing;
    var label = state.btn.querySelector('.tts-btn__label');
    if (label) label.textContent = playing ? 'Pause' : 'Listen';
  }

  // ── Web Speech path ──
  function speakWebSpeech() {
    if (!('speechSynthesis' in window)) return;
    if (state.cursor >= state.sentences.length) { stop(); return; }
    var u = new SpeechSynthesisUtterance(state.sentences[state.cursor]);
    u.rate  = state.rate;
    u.pitch = 1.0;
    if (state.webSpeechVoice) { u.voice = state.webSpeechVoice; u.lang = state.webSpeechVoice.lang; }
    u.onend = function () {
      if (!state.speaking) return;
      state.cursor += 1;
      savePos();
      speakWebSpeech();
    };
    u.onerror = function () { stop(); };
    window.speechSynthesis.speak(u);
  }

  // ── Kokoro pipeline (generate N+1 while N plays) ──
  function generateKokoroAudio(index) {
    if (state.pipeline[index] !== undefined) return state.pipeline[index];
    if (!state.kokoroTTS) return Promise.reject(new Error('Kokoro not loaded'));
    var sentence = state.sentences[index];
    if (!sentence) return Promise.reject(new Error('No sentence'));
    var p = Promise.resolve()
      .then(function () { return state.kokoroTTS.generate(sentence, { voice: state.voice }); })
      .then(function (audio) {
        if (!audio) throw new Error('Kokoro returned no audio for sentence ' + index);
        // kokoro-js exposes .toBlob() in v1.2+. Older versions use
        // .audio (Float32Array) — fall back to wav blob building.
        if (typeof audio.toBlob === 'function') return URL.createObjectURL(audio.toBlob());
        if (typeof audio.toWav === 'function')  return URL.createObjectURL(new Blob([audio.toWav()], { type: 'audio/wav' }));
        throw new Error('Kokoro audio object has no toBlob/toWav method');
      });
    state.pipeline[index] = p;
    return p;
  }

  function speakKokoro() {
    if (state.cursor >= state.sentences.length) { stop(); return; }
    var idx = state.cursor;
    // Kick off generation for the next sentence in parallel
    if (idx + 1 < state.sentences.length) {
      generateKokoroAudio(idx + 1).catch(function (e) { console.warn('[tts] prefetch failed:', e); });
    }
    generateKokoroAudio(idx).then(function (url) {
      if (!state.speaking) { URL.revokeObjectURL(url); return; }
      var el = new Audio(url);
      state.audio = el;
      el.playbackRate = state.rate;
      el.onended = function () {
        URL.revokeObjectURL(url);
        delete state.pipeline[idx];
        if (!state.speaking) return;
        state.cursor += 1;
        savePos();
        speakKokoro();
      };
      el.onerror = function (e) {
        console.error('[tts] audio playback error for sentence', idx, e);
        // Skip this sentence rather than killing the whole session
        delete state.pipeline[idx];
        URL.revokeObjectURL(url);
        if (!state.speaking) return;
        state.cursor += 1;
        savePos();
        speakKokoro();
      };
      el.play().catch(function (e) { console.error('[tts] play() rejected:', e); stop(); });
    }).catch(function (err) {
      console.error('[tts] Kokoro generate() failed for sentence', idx, err);
      // First failure: try Web Speech for THIS sentence and continue
      // (don't permanently switch engines — the next sentence may
      // generate fine).
      var fallback = new SpeechSynthesisUtterance(state.sentences[idx]);
      fallback.rate = state.rate;
      if (state.webSpeechVoice) { fallback.voice = state.webSpeechVoice; fallback.lang = state.webSpeechVoice.lang; }
      fallback.onend = function () {
        if (!state.speaking) return;
        state.cursor += 1;
        savePos();
        speakKokoro();
      };
      fallback.onerror = function () { stop(); };
      try { window.speechSynthesis.speak(fallback); } catch (e) { stop(); }
    });
  }

  function play() {
    if (!state.body) state.body = pickArticleBody();
    if (!state.sentences.length) {
      state.sentences = extractSentences(state.body);
      if (state.cursor === 0) state.cursor = Math.min(loadPos(), Math.max(0, state.sentences.length - 1));
    }
    if (!state.sentences.length) return;
    state.speaking = true;
    state.paused = false;
    setBtnState(true);
    if (state.engine === 'kokoro' && state.kokoroTTS) {
      speakKokoro();
    } else {
      if (!state.webSpeechVoice) state.webSpeechVoice = pickWebSpeechVoice();
      speakWebSpeech();
    }
  }

  function pause() {
    state.speaking = false;
    state.paused = true;
    setBtnState(false);
    if (state.audio) { try { state.audio.pause(); } catch (e) {} }
    if ('speechSynthesis' in window) { try { window.speechSynthesis.cancel(); } catch (e) {} }
    savePos();
  }

  function stop() {
    state.speaking = false;
    state.paused = false;
    state.cursor = 0;
    setBtnState(false);
    if (state.audio) { try { state.audio.pause(); } catch (e) {} state.audio = null; }
    Object.keys(state.pipeline).forEach(function (k) {
      var p = state.pipeline[k];
      if (p && p.then) p.then(function (url) { URL.revokeObjectURL(url); }).catch(function () {});
    });
    state.pipeline = {};
    if ('speechSynthesis' in window) { try { window.speechSynthesis.cancel(); } catch (e) {} }
    lremove(posKey());
  }

  // ── First-click / button behaviour ──
  function handlePrimaryClick(e) {
    // Alt+click or shift+click opens settings instead of play
    if (e.altKey || e.shiftKey) { openSettings(); return; }
    if (state.speaking) { pause(); return; }
    if (state.paused)   { play();  return; }
    // Idle: if no engine chosen, prompt; if Kokoro chosen but model not
    // loaded yet, lazy-load; otherwise just play.
    if (!state.engine) { renderEnginePicker(); return; }
    if (state.engine === 'kokoro' && !state.kokoroTTS) {
      renderKokoroLoadingThenSettings();
      // Once model is ready, the popover stays open for voice selection
      // — the user can hit the in-popover Play button OR close the
      // popover and click the toolbar Listen button again to start.
      return;
    }
    play();
  }

  function openSettings() {
    if (state.engine === 'kokoro' && state.kokoroTTS) renderKokoroSettings();
    else renderEnginePicker();
  }

  function init() {
    var btn = document.getElementById('tts-btn');
    if (!btn) return;
    state.btn = btn;
    state.body = pickArticleBody();
    state.sentences = [];
    state.cursor = 0;
    state.speaking = false;
    state.paused = false;
    state.webSpeechVoice = null;
    state.pipeline = {};

    // ── Build-time MP3 path ────────────────────────────────────
    // If a pre-generated <audio data-tft-audio> element exists on
    // the page (written by partials/article-audio.njk when the
    // audioManifest has an entry for this URL), the toolbar
    // Listen button just play/pauses that native element.
    // No Kokoro download, no Web Speech, no sentence pipeline.
    var staticAudio = document.querySelector('audio[data-tft-audio]');
    if (staticAudio) {
      btn.addEventListener('click', function () {
        if (staticAudio.paused) {
          var p = staticAudio.play();
          if (p && typeof p.catch === 'function') {
            p.catch(function (err) { console.warn('[tts] static audio play failed:', err); });
          }
        } else {
          staticAudio.pause();
        }
      });
      staticAudio.addEventListener('play',  function () { setBtnState(true);  });
      staticAudio.addEventListener('pause', function () { setBtnState(false); });
      staticAudio.addEventListener('ended', function () { setBtnState(false); });
      // Stash a tiny public API so the rest of the codebase can
      // pause/stop on SPA-nav without poking internals.
      window.__tftStaticAudio = staticAudio;
      return;
    }
    // No static audio for this article — fall through to the
    // existing client-side TTS bootstrap (Web Speech / opt-in
    // Kokoro), unchanged.

    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = function () {
        if (!state.webSpeechVoice) state.webSpeechVoice = pickWebSpeechVoice();
      };
    }

    btn.addEventListener('click', handlePrimaryClick);
    // Long-press → settings (mobile)
    var longPress = null;
    btn.addEventListener('touchstart', function () {
      longPress = setTimeout(function () { longPress = null; openSettings(); }, 600);
    }, { passive: true });
    btn.addEventListener('touchend', function () {
      if (longPress) { clearTimeout(longPress); longPress = null; }
    });

    document.addEventListener('spa:contentswap', function () { stop(); }, { once: true });
    window.addEventListener('resize', positionPopover);

    // Public-ish API for the console / future settings panel
    window.__tftTTS = {
      openSettings: openSettings,
      stop: stop,
      pause: pause,
      play: play,
      switchToKokoro: function () { state.engine = 'kokoro'; lset(K_ENGINE, 'kokoro'); renderKokoroLoadingThenSettings(); },
      switchToWebSpeech: function () { state.engine = 'webspeech'; lset(K_ENGINE, 'webspeech'); }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  document.addEventListener('spa:contentswap', function () {
    // Pause any in-flight static <audio> playback before re-init,
    // so it doesn't keep narrating the previous article.
    if (window.__tftStaticAudio && typeof window.__tftStaticAudio.pause === 'function') {
      try { window.__tftStaticAudio.pause(); } catch (e) {}
      window.__tftStaticAudio = null;
    }
    init();
  });
})();
