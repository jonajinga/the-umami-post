/**
 * audio-bar.js — global persistent TTS player.
 *
 * Owns the singleton <audio id="audio-bar-source"> element rendered
 * in base.njk by partials/audio-bar.njk. Click any element with
 * the right data-tft-audio-* attributes anywhere on the site (an
 * article card, a reading-list row, a knowledge-map related item)
 * and the bar loads + plays that article's MP3, persisting across
 * SPA navigation.
 *
 * Trigger contract:
 *   data-tft-audio-trigger
 *   data-tft-audio-src    = "/assets/audio/news/foo.mp3"
 *   data-tft-audio-url    = "/news/foo/"
 *   data-tft-audio-title  = "Foo article title"
 *   data-tft-audio-duration = 234     (seconds, optional)
 *
 * Coordinates with the inline article-page <audio data-tft-audio>:
 * if both elements point at the same MP3, they share state — pause
 * one, the other reflects the same position. The article-page
 * partial uses preload="none" so this hook-up is cheap.
 */
(function () {
  'use strict';

  var bar, audio, btnPlay, iconPlay, iconPause;
  var titleEl, timeCur, timeDur, scrub, btnClose;
  var inlineAudio = null;
  var lastSrc = '';
  var isFirstRun = !window.__tftAudioBarBootstrapped;
  window.__tftAudioBarBootstrapped = true;

  function fmt(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + (s < 10 ? '0' + s : s);
  }

  function refreshBtn() {
    if (!btnPlay || !audio) return;
    var playing = !audio.paused && !audio.ended;
    // CSS toggles the icon based on aria-pressed; we don't fiddle
    // with the `hidden` attribute on the SVGs anymore (that path
    // was getting beaten by attribute/CSS specificity weirdness).
    btnPlay.setAttribute('aria-pressed', playing ? 'true' : 'false');
    btnPlay.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    btnPlay.setAttribute('title', playing ? 'Pause' : 'Play');
    // Mirror the playing/paused state to every page-level trigger
    // button (article listen, card listen, etc.) so each one's
    // play/pause icon flips when its own audio is what's loaded.
    var currentSrc = (audio.currentSrc || audio.src || '');
    document.querySelectorAll('[data-tft-audio-trigger]').forEach(function (t) {
      var src = t.getAttribute('data-tft-audio-src') || '';
      var match = src && currentSrc && (currentSrc.indexOf(src) !== -1 || src.indexOf(currentSrc) !== -1);
      t.classList.toggle('is-playing', !!(match && playing));
      t.setAttribute('aria-pressed', match && playing ? 'true' : 'false');
    });
  }

  function show() { if (bar && bar.hidden) bar.hidden = false; document.body.classList.add('has-audio-bar'); }
  function hide() {
    if (bar) bar.hidden = true;
    document.body.classList.remove('has-audio-bar');
    if (audio) { try { audio.pause(); } catch (e) {} }
  }

  // ── Inline article-page audio coordination ────────────────────
  // When the article page is open and its inline <audio data-tft-audio>
  // points at the same src as the bar, mirror state both ways: a
  // pause on either reflects on the other; scrubbing on one tracks
  // the other. This means the bar and the inline player are two
  // surfaces over a single shared audio stream rather than competing.
  function bindInlineSync() {
    var inline = document.querySelector('audio[data-tft-audio]');
    if (!inline || inline === inlineAudio) return;
    if (inlineAudio) {
      inlineAudio.removeEventListener('play',  onInlinePlay);
      inlineAudio.removeEventListener('pause', onInlinePause);
      inlineAudio.removeEventListener('seeked', onInlineSeek);
    }
    inlineAudio = inline;
    inline.addEventListener('play',  onInlinePlay);
    inline.addEventListener('pause', onInlinePause);
    inline.addEventListener('seeked', onInlineSeek);
  }
  function sameSrcAsInline() {
    if (!inlineAudio || !audio) return false;
    var a = (audio.currentSrc || audio.src || '').replace(location.origin, '');
    var b = (inlineAudio.currentSrc || inlineAudio.src || '').replace(location.origin, '');
    return a && b && a === b;
  }
  function onInlinePlay() {
    if (!sameSrcAsInline()) return;
    // The reader started the inline player. Mirror its position to
    // the bar but don't double-play; let the inline element be the
    // primary playback surface. The bar stays visible & in-sync.
    if (audio && !audio.paused) audio.pause();
    show();
    if (titleEl) refreshTitleFromInline();
    refreshBtn();
  }
  function onInlinePause() {
    if (!sameSrcAsInline()) return;
    refreshBtn();
  }
  function onInlineSeek() {
    if (!sameSrcAsInline() || !audio || !inlineAudio) return;
    if (Math.abs(audio.currentTime - inlineAudio.currentTime) > 0.5) {
      audio.currentTime = inlineAudio.currentTime;
    }
  }
  function refreshTitleFromInline() {
    var h = document.querySelector('h1.article-header__headline, h1');
    if (h && titleEl) {
      titleEl.textContent = h.textContent.trim();
      titleEl.href = location.pathname;
    }
  }

  // ── Public API ────────────────────────────────────────────────
  function play(src, title, url, durationHint) {
    if (!audio) return;
    if (lastSrc !== src) {
      audio.src = src;
      lastSrc = src;
    }
    if (titleEl) {
      titleEl.textContent = title || 'Untitled';
      titleEl.href = url || '#';
    }
    if (timeDur && durationHint) timeDur.textContent = fmt(durationHint);
    show();
    // Mutual exclusion with the music player: dispatch a public event
    // that music-player.js listens for and pauses its YouTube player.
    document.dispatchEvent(new CustomEvent('tft:tts-playing'));
    var p = audio.play();
    if (p && typeof p.catch === 'function') p.catch(function (err) {
      console.warn('[audio-bar] play() failed:', err);
    });
  }

  function init() {
    bar       = document.getElementById('audio-bar');
    audio     = document.getElementById('audio-bar-source');
    btnPlay   = document.getElementById('audio-bar-play');
    iconPlay  = bar && bar.querySelector('.audio-bar__icon-play');
    iconPause = bar && bar.querySelector('.audio-bar__icon-pause');
    titleEl   = document.getElementById('audio-bar-title');
    timeCur   = document.getElementById('audio-bar-current');
    timeDur   = document.getElementById('audio-bar-duration');
    scrub     = document.getElementById('audio-bar-scrub');
    btnClose  = document.getElementById('audio-bar-close');
    if (!bar || !audio) return;

    // Pause TTS bar whenever the music player starts (custom event
    // dispatched from music-player.js). Mutual exclusion: only one
    // soundtrack at a time. Fired on first run only — this is a
    // document-level listener so it survives SPA-nav.
    if (isFirstRun) {
      document.addEventListener('tft:music-playing', function () {
        if (audio && !audio.paused) { try { audio.pause(); } catch (e) {} }
      });
    }

    // Wire native audio events
    audio.addEventListener('loadedmetadata', function () {
      if (timeDur && Number.isFinite(audio.duration)) timeDur.textContent = fmt(audio.duration);
    });
    audio.addEventListener('timeupdate', function () {
      if (timeCur) timeCur.textContent = fmt(audio.currentTime);
      if (scrub && Number.isFinite(audio.duration) && audio.duration > 0) {
        scrub.value = String(Math.round((audio.currentTime / audio.duration) * 1000));
      }
    });
    audio.addEventListener('play',  function () {
      refreshBtn();
      document.dispatchEvent(new CustomEvent('tft:tts-playing'));
    });
    audio.addEventListener('pause', refreshBtn);
    audio.addEventListener('ended', refreshBtn);

    if (btnPlay) {
      btnPlay.addEventListener('click', function () {
        if (audio.paused) audio.play().catch(function (e) { console.warn('[audio-bar] play():', e); });
        else audio.pause();
      });
    }
    if (scrub) {
      scrub.addEventListener('input', function () {
        if (!Number.isFinite(audio.duration)) return;
        var t = (Number(scrub.value) / 1000) * audio.duration;
        audio.currentTime = t;
        if (sameSrcAsInline() && inlineAudio) inlineAudio.currentTime = t;
      });
    }
    if (btnClose) {
      btnClose.addEventListener('click', function () { hide(); lastSrc = ''; });
    }

    // Mutual exclusion: when ANY <audio> element starts playing,
    // pause every other one on the page. Stops the inline article
    // player and the global bar (and any future audio surface) from
    // ever speaking over each other when a reader hits play in two
    // places. Capture phase so we catch the event before the
    // individual element handlers run.
    if (isFirstRun) {
      document.addEventListener('play', function (e) {
        var t = e.target;
        if (!t || t.tagName !== 'AUDIO') return;
        document.querySelectorAll('audio').forEach(function (other) {
          if (other !== t && !other.paused) {
            try { other.pause(); } catch (err) {}
          }
        });
      }, true);
    }

    // Delegate listen-button clicks on every page. Capture phase so
    // we run BEFORE other document-level click handlers (e.g.
    // spa-nav.js intercepting <a> clicks). This matters for cases
    // where the listen button is wrapped inside an <a> — like the
    // archives showcase or timeline rows — where the SPA navigation
    // handler would otherwise consume the click first and the bar
    // would never open.
    if (isFirstRun) {
      document.addEventListener('click', function (e) {
        var t = e.target.closest && e.target.closest('[data-tft-audio-trigger]');
        if (!t) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        var src   = t.getAttribute('data-tft-audio-src');
        var title = t.getAttribute('data-tft-audio-title') || '';
        var url   = t.getAttribute('data-tft-audio-url') || '';
        var dur   = Number(t.getAttribute('data-tft-audio-duration')) || 0;
        if (!src) return;
        // Toggle: re-clicking the trigger that's already loaded just
        // pauses; clicking a *different* trigger swaps source.
        if (lastSrc === src && audio && !audio.paused) {
          audio.pause();
          return;
        }
        play(src, title, url, dur);
      }, true);
    }

    bindInlineSync();
    refreshBtn();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  // SPA-nav swaps the inline article-page audio element; rebind on
  // contentswap so we keep mirroring the right element.
  document.addEventListener('spa:contentswap', function () {
    inlineAudio = null;
    bindInlineSync();
  });

  // ── Manifest helper: lets JS-rendered surfaces (reading-list,
  //    reading-history, print-basket, knowledge map related panel)
  //    add a listen button to their items without server-side
  //    re-rendering. JSON shipped via the inline #audio-manifest-data
  //    script in partials/audio-bar.njk.
  var manifestCache = null;
  function getManifest() {
    if (manifestCache) return manifestCache;
    var el = document.getElementById('audio-manifest-data');
    if (!el) return (manifestCache = {});
    try { manifestCache = JSON.parse(el.textContent || '{}'); }
    catch (e) { manifestCache = {}; }
    return manifestCache;
  }
  function audioFor(url) {
    if (!url) return null;
    var m = getManifest();
    return m[url] || m[url + '/'] || m[url.replace(/\/$/, '')] || null;
  }
  // Builds the same markup as partials/listen-button.njk so JS
  // surfaces stay in visual sync with server-rendered cards: pill
  // shape, play triangle in an accent circle, "LISTEN · N MIN" label.
  function renderListenButton(url, title) {
    var aud = audioFor(url);
    if (!aud) return '';
    var mins = Math.max(1, Math.ceil((aud.duration || 0) / 60));
    var minLabel = mins + (mins === 1 ? ' minute' : ' minutes');
    var safeTitle = String(title || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    return '<button type="button" class="listen-btn listen-btn--sm" ' +
      'data-tft-audio-trigger ' +
      'data-tft-audio-src="' + aud.mp3 + '" ' +
      'data-tft-audio-url="' + url + '" ' +
      'data-tft-audio-title="' + safeTitle + '" ' +
      'data-tft-audio-duration="' + (aud.duration || 0) + '" ' +
      'aria-label="Listen to ' + safeTitle + ', ' + minLabel + '" ' +
      'title="Listen, ' + minLabel + '">' +
      '<span class="listen-btn__icon" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>' +
      '</span>' +
      '<span class="listen-btn__label">Listen</span>' +
      '<span class="listen-btn__sep" aria-hidden="true">·</span>' +
      '<span class="listen-btn__time">' + mins + ' min</span>' +
      '</button>';
  }

  window.__tftAudioBar = {
    play: play,
    hide: hide,
    show: show,
    audioFor: audioFor,
    renderListenButton: renderListenButton
  };
})();
