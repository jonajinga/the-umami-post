/**
 * Global Display Settings — applies site-wide font, size, spacing, background.
 * Stored in localStorage. Loaded on every page via base.njk.
 */
(function () {
  'use strict';

  var _p = window.__PREFIX || 'tft';
  var K = {
    fontSize: _p + '-gs-font-size',
    font:     _p + '-gs-font',
    spacing:  _p + '-gs-spacing',
    wordspace: _p + '-gs-wordspace',
    bg:       _p + '-gs-bg'
  };
  // Article-tool keys reuse the legacy `rs-` prefix so existing user
  // preferences carry over from the old per-article reading-settings panel.
  var AK = {
    paraNums:    _p + '-rs-paraNums',
    ruler:       _p + '-rs-ruler',
    rulerColor:  _p + '-rs-rulerColor',
    rulerStyle:  _p + '-rs-rulerStyle',
    autoscroll:  _p + '-rs-autoscroll',
    scrollSpeed: _p + '-rs-scrollSpeed'
  };

  var root = document.documentElement;
  var prefs = {
    fontSize:  parseInt(localStorage.getItem(K.fontSize), 10) || 0,
    font:      localStorage.getItem(K.font) || 'default',
    spacing:   localStorage.getItem(K.spacing) || 'normal',
    wordspace: localStorage.getItem(K.wordspace) || 'normal',
    bg:        localStorage.getItem(K.bg) || 'default',
    // Article-tool prefs. Ruler + autoscroll are session-ephemeral (don't
    // auto-restore), but their colour / style / speed do persist.
    paraNums:    localStorage.getItem(AK.paraNums) === 'true',
    rulerColor:  localStorage.getItem(AK.rulerColor) || 'accent',
    rulerStyle:  localStorage.getItem(AK.rulerStyle) || 'solid',
    scrollSpeed: parseInt(localStorage.getItem(AK.scrollSpeed), 10) || 3
  };

  function save(key, val) {
    try { localStorage.setItem(K[key], val); } catch (e) {}
  }
  function saveArt(key, val) {
    try { localStorage.setItem(AK[key], val); } catch (e) {}
  }

  // Quick profile presets
  var PROFILES = {
    /* Text-size selector retired — profiles never override the
     * site's typography scale anymore. Preserve fontSize: 0 so
     * applyAll's `if (prefs.fontSize > 0)` guard stays inert. */
    'default':    { fontSize: 0, font: 'default',  spacing: 'normal',  wordspace: 'normal', theme: 'auto' },
    'comfort':    { fontSize: 0, font: 'lora',     spacing: 'relaxed', wordspace: 'wide',   theme: 'sepia' },
    'low-vision': { fontSize: 0, font: 'atkinson', spacing: 'relaxed', wordspace: 'wider',  theme: 'light' },
    'night':      { fontSize: 0, font: 'literata', spacing: 'relaxed', wordspace: 'wide',   theme: 'dark' }
  };

  // On-demand web font loading via Bunny Fonts
  var webFonts = {
    inter: 'inter:wght@400;600;700',
    merriweather: 'merriweather:wght@400;700',
    roboto: 'roboto:wght@400;700',
    opensans: 'open-sans:wght@400;600;700',
    baskerville: 'libre-baskerville:wght@400;700',
    crimson: 'crimson-pro:wght@400;600;700',
    ibmplex: 'ibm-plex-serif:wght@400;600;700',
    literata: 'literata:wght@400;600;700',
    atkinson: 'atkinson-hyperlegible:wght@400;700'
  };
  var loadedFonts = {};

  function loadWebFont(key) {
    if (loadedFonts[key] || !webFonts[key]) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.bunny.net/css?family=' + webFonts[key] + '&display=swap';
    document.head.appendChild(link);
    loadedFonts[key] = true;
  }

  // ── Apply ──
  function applyAll() {
    if (prefs.fontSize > 0) root.style.fontSize = prefs.fontSize + 'px';
    else root.style.fontSize = '';

    root.removeAttribute('data-gs-font');
    if (prefs.font !== 'default') {
      root.setAttribute('data-gs-font', prefs.font);
      if (webFonts[prefs.font]) loadWebFont(prefs.font);
    }

    var spacingMap = { tight: '1.3', normal: '', relaxed: '1.8' };
    if (prefs.spacing !== 'normal') {
      root.style.setProperty('--leading-normal', spacingMap[prefs.spacing]);
      root.style.setProperty('--leading-relaxed', (parseFloat(spacingMap[prefs.spacing]) + 0.2).toString());
      root.style.setProperty('--leading-loose', (parseFloat(spacingMap[prefs.spacing]) + 0.4).toString());
    } else {
      root.style.removeProperty('--leading-normal');
      root.style.removeProperty('--leading-relaxed');
      root.style.removeProperty('--leading-loose');
    }

    // Word spacing: set a CSS custom property on :root so a low-specificity
    // rule applies it everywhere. Direct body inline style got overridden
    // by element-level rules on .article-body.
    var wsMap = { normal: '0', wide: '0.18em', wider: '0.35em' };
    root.style.setProperty('--gs-word-spacing', wsMap[prefs.wordspace] || '0');

    root.removeAttribute('data-gs-bg');
    if (prefs.bg !== 'default') root.setAttribute('data-gs-bg', prefs.bg);
  }

  applyAll();

  // ── Article tools (ruler / paragraph numbers / auto-scroll) ──
  // These only take effect on pages with an .article-body element.
  var rulerColorMap = {
    accent: 'var(--color-accent)',
    red: '#e53e3e',
    blue: '#3182ce',
    green: '#38a169',
    yellow: '#d69e2e',
    black: '#111',
    white: '#eee'
  };
  var isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  var rulerBounds = { left: 0, width: 0, top: 0, bottom: 0 };
  var _mousemoveBound = false;
  var _rulerListenersBound = false;
  var scrollAnim = null;

  function articleBody() { return document.querySelector('.article-body'); }

  function updateRulerBounds() {
    var body = articleBody();
    if (!body) return;
    var rect = body.getBoundingClientRect();
    rulerBounds.left = rect.left;
    rulerBounds.width = rect.width;
    rulerBounds.top = rect.top;
    rulerBounds.bottom = rect.bottom;
    var ruler = document.getElementById('rs-reading-ruler');
    if (ruler) {
      ruler.style.left = rect.left + 'px';
      ruler.style.width = rect.width + 'px';
      if (isTouchDevice) {
        ruler.style.top = Math.round(window.innerHeight * 0.4) + 'px';
      }
    }
  }
  function moveRuler(e) {
    var ruler = document.getElementById('rs-reading-ruler');
    if (!ruler) return;
    var y = e.clientY;
    if (y < rulerBounds.top || y > rulerBounds.bottom) {
      ruler.style.opacity = '0';
    } else {
      ruler.style.opacity = '';
      ruler.style.top = y + 'px';
    }
  }
  function applyRulerStyle() {
    var ruler = document.getElementById('rs-reading-ruler');
    if (!ruler) return;
    var thick = 2;
    var color = rulerColorMap[prefs.rulerColor] || rulerColorMap.accent;
    ruler.style.height = thick + 'px';
    ruler.style.background = color;
    ruler.style.borderTop = 'none';
    ruler.style.boxShadow = 'none';
    if (prefs.rulerStyle === 'dashed') {
      ruler.style.background = 'none';
      ruler.style.borderTop = thick + 'px dashed ' + color;
      ruler.style.height = '0';
    } else if (prefs.rulerStyle === 'dotted') {
      ruler.style.background = 'none';
      ruler.style.borderTop = thick + 'px dotted ' + color;
      ruler.style.height = '0';
    } else if (prefs.rulerStyle === 'glow') {
      ruler.style.boxShadow = '0 0 ' + (thick * 3) + 'px ' + thick + 'px ' + color;
    }
  }
  function applyRuler(on) {
    var body = articleBody();
    var existing = document.getElementById('rs-reading-ruler');
    if (on && body && !existing) {
      var ruler = document.createElement('div');
      ruler.id = 'rs-reading-ruler';
      ruler.className = 'rs-ruler-line';
      document.body.appendChild(ruler);
      applyRulerStyle();
      updateRulerBounds();
      if (isTouchDevice) {
        ruler.style.top = Math.round(window.innerHeight * 0.4) + 'px';
        ruler.style.opacity = '';
      } else if (!_mousemoveBound) {
        document.addEventListener('mousemove', moveRuler);
        _mousemoveBound = true;
      }
      if (!_rulerListenersBound) {
        window.addEventListener('resize', updateRulerBounds);
        window.addEventListener('scroll', updateRulerBounds, { passive: true });
        document.addEventListener('selectionchange', function () {
          var r = document.getElementById('rs-reading-ruler');
          if (!r) return;
          var sel = window.getSelection();
          r.style.visibility = (sel && sel.toString().length > 0) ? 'hidden' : '';
        });
        _rulerListenersBound = true;
      }
    } else if (!on && existing) {
      existing.remove();
    }
  }
  function applyParaNums(on) {
    var body = articleBody();
    if (body) body.classList.toggle('rs-para-numbers', on);
  }
  function applyAutoscroll(on) {
    if (on) {
      var speed = prefs.scrollSpeed || 3;
      function tick() {
        window.scrollBy(0, speed * 0.3);
        scrollAnim = requestAnimationFrame(tick);
      }
      if (scrollAnim) cancelAnimationFrame(scrollAnim);
      scrollAnim = requestAnimationFrame(tick);
    } else {
      if (scrollAnim) cancelAnimationFrame(scrollAnim);
      scrollAnim = null;
    }
  }
  // Apply persisted article-tool prefs on load. Ruler and autoscroll are
  // ephemeral (start off on each pageload), but paraNums + ruler style
  // should stick.
  if (prefs.paraNums) applyParaNums(true);

  // Auto-turn-off the article-only tools when we navigate to a page with
  // no article body (e.g. an edition index, the events calendar). Fires
  // on initial load AND on SPA content swaps.
  function autoDisableArticleToolsIfNotArticle() {
    if (articleBody()) return;
    if (document.getElementById('rs-reading-ruler')) applyRuler(false);
    if (scrollAnim) applyAutoscroll(false);
  }
  autoDisableArticleToolsIfNotArticle();
  document.addEventListener('spa:contentswap', autoDisableArticleToolsIfNotArticle);

  // Auto-scroll should yield to the reader the moment they try to scroll
  // themselves. Any wheel / touchmove / pageup-down / arrow-key input
  // stops the animation so the reader isn't fighting their own browser.
  function userInterruptAutoscroll() {
    if (!scrollAnim) return;
    applyAutoscroll(false);
    var panel = document.getElementById('global-settings-panel');
    if (panel) {
      panel.querySelectorAll('[data-gs-autoscroll]').forEach(function (b) {
        b.classList.toggle('is-active', b.dataset.gsAutoscroll === 'off');
      });
      panel.querySelectorAll('.gs-autoscroll-opts').forEach(function (r) {
        r.hidden = true;
      });
    }
  }
  window.addEventListener('wheel', userInterruptAutoscroll, { passive: true });
  window.addEventListener('touchmove', userInterruptAutoscroll, { passive: true });
  window.addEventListener('keydown', function (e) {
    var keys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Space'];
    if (keys.indexOf(e.key) !== -1) userInterruptAutoscroll();
  });

  // ── Bind panel (runs after DOM ready) ──
  function bindPanel() {
    var panel = document.getElementById('global-settings-panel');
    if (!panel) return;

    var slider   = document.getElementById('gs-font-size');
    var sizeOut  = document.getElementById('gs-font-size-value');
    var fontSel  = document.getElementById('gs-font-select');
    var profBtns = panel.querySelectorAll('[data-gs-profile]');
    var themeGroup = document.getElementById('gs-theme-group');
    var themeBtns  = themeGroup ? themeGroup.querySelectorAll('[data-gs-theme]') : [];

    function updateSizeReadout() {
      if (sizeOut) sizeOut.textContent = (prefs.fontSize || 16) + 'px';
    }

    // Font size slider
    if (slider) {
      slider.value = prefs.fontSize || 16;
      updateSizeReadout();
      slider.addEventListener('input', function () {
        prefs.fontSize = parseInt(this.value, 10);
        save('fontSize', prefs.fontSize);
        applyAll();
        updateSizeReadout();
      });
    }

    // Font select
    if (fontSel) {
      fontSel.value = prefs.font;
      fontSel.addEventListener('change', function () {
        prefs.font = this.value;
        save('font', prefs.font);
        applyAll();
      });
    }

    // Segmented groups (spacing, wordspace)
    function dataKeyFor(el, attr) {
      var rawKey = attr.replace(/^data-/, '').replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); });
      return rawKey;
    }
    function bindGroup(attr, prefKey) {
      var buttons = panel.querySelectorAll('[' + attr + ']');
      buttons.forEach(function (b) {
        var dk = dataKeyFor(b, attr);
        b.classList.toggle('is-active', b.dataset[dk] === prefs[prefKey]);
        b.addEventListener('click', function () {
          prefs[prefKey] = b.dataset[dk];
          save(prefKey, prefs[prefKey]);
          applyAll();
          buttons.forEach(function (x) {
            x.classList.toggle('is-active', x.dataset[dk] === prefs[prefKey]);
          });
        });
      });
    }
    bindGroup('data-gs-spacing', 'spacing');
    bindGroup('data-gs-wordspace', 'wordspace');

    // Theme buttons — also drive the `data-theme` + bg attrs
    function currentThemeKey() {
      var t = localStorage.getItem(_p + '-theme');
      var b = localStorage.getItem(K.bg);
      if (t === 'dark') return 'dark';
      if (b === 'sepia') return 'sepia';
      if (b === 'cream') return 'cream';
      if (t === 'light') return 'light';
      return 'auto';
    }
    function setTheme(v) {
      if (v === 'auto') {
        root.removeAttribute('data-theme'); root.removeAttribute('data-gs-bg');
        localStorage.removeItem(_p + '-theme'); localStorage.removeItem(K.bg);
        prefs.bg = 'default';
      } else if (v === 'dark') {
        root.setAttribute('data-theme', 'dark'); root.removeAttribute('data-gs-bg');
        localStorage.setItem(_p + '-theme', 'dark'); localStorage.removeItem(K.bg);
        prefs.bg = 'default';
      } else if (v === 'sepia' || v === 'cream') {
        root.setAttribute('data-theme', 'light'); root.setAttribute('data-gs-bg', v);
        localStorage.setItem(_p + '-theme', 'light'); localStorage.setItem(K.bg, v);
        prefs.bg = v;
      } else {
        root.setAttribute('data-theme', 'light'); root.removeAttribute('data-gs-bg');
        localStorage.setItem(_p + '-theme', 'light'); localStorage.removeItem(K.bg);
        prefs.bg = 'default';
      }
      themeBtns.forEach(function (x) { x.classList.toggle('is-active', x.dataset.gsTheme === v); });
    }
    if (themeBtns.length) {
      var active = currentThemeKey();
      themeBtns.forEach(function (b) {
        b.classList.toggle('is-active', b.dataset.gsTheme === active);
        b.addEventListener('click', function () { setTheme(b.dataset.gsTheme); });
      });
    }

    // Quick profile presets
    function applyProfile(key) {
      var p = PROFILES[key];
      if (!p) return;
      prefs.fontSize = p.fontSize;
      prefs.font     = p.font;
      prefs.spacing  = p.spacing;
      prefs.wordspace = p.wordspace;
      if (p.fontSize) save('fontSize', p.fontSize); else localStorage.removeItem(K.fontSize);
      save('font', p.font);
      save('spacing', p.spacing);
      save('wordspace', p.wordspace);
      setTheme(p.theme);
      applyAll();
      // Sync control UI
      if (slider) slider.value = p.fontSize || 16;
      updateSizeReadout();
      if (fontSel) fontSel.value = p.font;
      panel.querySelectorAll('[data-gs-spacing]').forEach(function (x) {
        x.classList.toggle('is-active', x.dataset.gsSpacing === p.spacing);
      });
      panel.querySelectorAll('[data-gs-wordspace]').forEach(function (x) {
        x.classList.toggle('is-active', x.dataset.gsWordspace === p.wordspace);
      });
      profBtns.forEach(function (x) { x.classList.toggle('is-active', x.dataset.gsProfile === key); });
    }
    profBtns.forEach(function (b) {
      b.addEventListener('click', function () { applyProfile(b.dataset.gsProfile); });
    });

    // Close on outside click (with grace period for drawer button).
    // Also moves focus back to the trigger when the panel closes so
    // keyboard users don't lose their place.
    var panelOpenTime = 0;
    var panelOpener = null;
    function isOpen() { return panel.classList.contains('is-open'); }
    function closePanel() {
      if (!isOpen()) return;
      panel.classList.remove('is-open');
      if (panelOpener && typeof panelOpener.focus === 'function') {
        panelOpener.focus();
        panelOpener = null;
      }
    }
    new MutationObserver(function () {
      if (isOpen()) {
        panelOpenTime = Date.now();
        if (document.activeElement && document.activeElement !== document.body) {
          panelOpener = document.activeElement;
        }
        var firstFocusable = panel.querySelector('button, [href], select, input, [tabindex]:not([tabindex="-1"])');
        if (firstFocusable) {
          try { firstFocusable.focus(); } catch (e) {}
        }
      }
    }).observe(panel, { attributes: true, attributeFilter: ['class'] });

    document.addEventListener('click', function (e) {
      if (!isOpen()) return;
      if (Date.now() - panelOpenTime < 200) return;
      var btn = document.getElementById('global-settings-btn');
      if (btn && btn.contains(e.target)) return;
      if (panel.contains(e.target)) return;
      closePanel();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) closePanel();
    });

    panel.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' || !isOpen()) return;
      var focusables = panel.querySelectorAll('button:not([disabled]), [href], select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    // ── Article-tool controls ──
    var rulerOptsRows = panel.querySelectorAll('.gs-ruler-opts');
    var autoscrollOptsRows = panel.querySelectorAll('.gs-autoscroll-opts');
    var rulerColorSel = document.getElementById('gs-ruler-color');
    var autoscrollSpeed = document.getElementById('gs-autoscroll-speed');

    function toggleGroup(rows, show) {
      rows.forEach(function (r) { r.hidden = !show; });
    }
    function syncSegmented(attr, val) {
      panel.querySelectorAll('[' + attr + ']').forEach(function (b) {
        var dk = Object.keys(b.dataset).find(function (k) { return k.indexOf('gs') === 0; });
        b.classList.toggle('is-active', b.dataset[dk] === val);
      });
    }

    // Ruler
    panel.querySelectorAll('[data-gs-ruler]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.dataset.gsRuler;
        syncSegmented('data-gs-ruler', v);
        var on = v === 'on';
        applyRuler(on);
        toggleGroup(rulerOptsRows, on);
      });
    });
    if (rulerColorSel) {
      rulerColorSel.value = prefs.rulerColor;
      rulerColorSel.addEventListener('change', function () {
        prefs.rulerColor = this.value;
        saveArt('rulerColor', prefs.rulerColor);
        applyRulerStyle();
      });
    }
    panel.querySelectorAll('[data-gs-ruler-style]').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.gsRulerStyle === prefs.rulerStyle);
      b.addEventListener('click', function () {
        prefs.rulerStyle = b.dataset.gsRulerStyle;
        saveArt('rulerStyle', prefs.rulerStyle);
        syncSegmented('data-gs-ruler-style', prefs.rulerStyle);
        applyRulerStyle();
      });
    });

    // Paragraph numbers
    syncSegmented('data-gs-paranums', prefs.paraNums ? 'on' : 'off');
    panel.querySelectorAll('[data-gs-paranums]').forEach(function (b) {
      b.addEventListener('click', function () {
        var on = b.dataset.gsParanums === 'on';
        prefs.paraNums = on;
        saveArt('paraNums', on);
        syncSegmented('data-gs-paranums', on ? 'on' : 'off');
        applyParaNums(on);
      });
    });

    // Auto-scroll
    panel.querySelectorAll('[data-gs-autoscroll]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.dataset.gsAutoscroll;
        syncSegmented('data-gs-autoscroll', v);
        var on = v === 'on';
        applyAutoscroll(on);
        toggleGroup(autoscrollOptsRows, on);
      });
    });
    if (autoscrollSpeed) {
      autoscrollSpeed.value = prefs.scrollSpeed || 3;
      autoscrollSpeed.addEventListener('input', function () {
        prefs.scrollSpeed = parseInt(this.value, 10);
        saveArt('scrollSpeed', prefs.scrollSpeed);
      });
    }

    // Reset
    window.__resetGlobalSettings = function () {
      Object.keys(K).forEach(function (k) { localStorage.removeItem(K[k]); });
      Object.keys(AK).forEach(function (k) { localStorage.removeItem(AK[k]); });
      localStorage.removeItem(_p + '-theme');
      root.removeAttribute('data-theme');
      root.removeAttribute('data-gs-bg');
      root.removeAttribute('data-gs-font');
      prefs = {
        fontSize: 0, font: 'default', spacing: 'normal', wordspace: 'normal', bg: 'default',
        paraNums: false, rulerColor: 'accent', rulerStyle: 'solid', scrollSpeed: 3
      };
      applyAll();
      applyRuler(false);
      applyParaNums(false);
      applyAutoscroll(false);
      if (slider) slider.value = 16;
      updateSizeReadout();
      if (fontSel) fontSel.value = 'default';
      panel.querySelectorAll('[data-gs-spacing]').forEach(function (x) {
        x.classList.toggle('is-active', x.dataset.gsSpacing === 'normal');
      });
      panel.querySelectorAll('[data-gs-wordspace]').forEach(function (x) {
        x.classList.toggle('is-active', x.dataset.gsWordspace === 'normal');
      });
      syncSegmented('data-gs-ruler', 'off');
      syncSegmented('data-gs-paranums', 'off');
      syncSegmented('data-gs-autoscroll', 'off');
      syncSegmented('data-gs-ruler-style', 'solid');
      toggleGroup(rulerOptsRows, false);
      toggleGroup(autoscrollOptsRows, false);
      if (rulerColorSel) rulerColorSel.value = 'accent';
      if (autoscrollSpeed) autoscrollSpeed.value = 3;
      themeBtns.forEach(function (x) { x.classList.toggle('is-active', x.dataset.gsTheme === 'auto'); });
      profBtns.forEach(function (x) { x.classList.remove('is-active'); });
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindPanel);
  else bindPanel();
})();
