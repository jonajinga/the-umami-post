/* form-decorations.js -- site-wide hand-drawn treatment.
 *
 * Decorates everything you'd expect to feel hand-drawn on a Warm-
 * Magazine food publication:
 *   - Every form.w3f (recipe submit, story pitch, contact, etc.) gets
 *     a rough.js outer frame, plus rough frames on every text input,
 *     textarea, select and submit button inside.
 *   - Newsletter subscribe widgets (.subscribe-form) get the same
 *     treatment so the home + footer signup forms feel consistent.
 *   - Generic .btn / .btn--primary / .btn--ghost (used outside w3f
 *     forms -- "Browse recipes", "Submit a recipe", "Subscribe" CTAs)
 *     get a rough rectangle behind them.
 *   - Standalone <input type="search"> elements outside any form
 *     (e.g. the glossary live-search) get a frame.
 *   - .w3f__required markers get a rough-notation wavy red underline.
 *
 * Selectors are inclusive; ungifted elements are skipped via opt-out
 * data-rough-skip-frame on the element or any ancestor. Idempotent --
 * a `dataset.roughFrameBound` flag prevents double-painting. */

(function () {
  'use strict';

  var ROUGH_URL    = '/assets/js/vendor/rough.esm.js';
  var NOTATION_URL = '/assets/js/vendor/rough-notation.esm.js';
  var roughPromise = null;
  var notationPromise = null;

  function loadRough() {
    if (!roughPromise) roughPromise = import(ROUGH_URL).then(function (m) { return m.default || m; });
    return roughPromise;
  }
  function loadNotation() {
    if (!notationPromise) notationPromise = import(NOTATION_URL);
    return notationPromise;
  }

  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function shouldSkip(el) {
    if (el.closest('[data-rough-skip-frame]')) return true;
    // Skip controls inside hidden containers — getBoundingClientRect
    // returns ~0 there, so paintFrame would draw a 40x24 stub at the
    // top-left of the field. The feedback popup, share popovers, etc.
    // are all initially `hidden`; we just render native browser
    // styling for those forms instead.
    var node = el;
    while (node && node !== document.body) {
      if (node.hidden) return true;
      var style = node.nodeType === 1 ? getComputedStyle(node) : null;
      if (style && (style.display === 'none' || style.visibility === 'hidden')) return true;
      node = node.parentElement;
    }
    return false;
  }

  function paintFrame(host, rough, color, opts) {
    opts = opts || {};
    var existing = host.querySelector(':scope > svg[data-form-frame]');
    if (existing) existing.remove();
    var rect = host.getBoundingClientRect();
    var w = Math.max(rect.width  || 0, 40);
    var h = Math.max(rect.height || 0, 24);
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('data-form-frame', 'true');
    s.setAttribute('width', w);
    s.setAttribute('height', h);
    s.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    s.setAttribute('aria-hidden', 'true');
    s.style.position = 'absolute';
    s.style.inset = '0';
    s.style.pointerEvents = 'none';
    s.style.zIndex = '0';
    var rc = rough.svg(s);
    s.appendChild(rc.rectangle(3, 3, w - 6, h - 6, {
      stroke: color,
      strokeWidth: opts.strokeWidth || 2,
      roughness: opts.roughness || 0.6,
      fill: opts.fill || 'none',
      fillStyle: opts.fillStyle || 'solid'
    }));
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.appendChild(s);
  }

  // Wrap a single form control so the rough frame can paint behind it.
  function wrapControl(el) {
    var parent = el.parentElement;
    if (parent && parent.classList.contains('rough-field')) return parent;
    var w = document.createElement('span');
    w.className = 'rough-field';
    w.style.position = 'relative';
    w.style.display = 'block';
    el.parentNode.insertBefore(w, el);
    w.appendChild(el);
    el.style.border = '0';
    el.style.background = 'transparent';
    el.style.position = 'relative';
    el.style.zIndex = '1';
    return w;
  }

  function bindControl(el, rough, color) {
    if (el.dataset.roughFrameBound === '1') return;
    if (shouldSkip(el)) return;
    el.dataset.roughFrameBound = '1';
    var host = wrapControl(el);
    requestAnimationFrame(function () { paintFrame(host, rough, color); });
  }

  function bindButton(el, rough, color, fillBg) {
    if (el.dataset.roughFrameBound === '1') return;
    if (shouldSkip(el)) return;
    // Skip icon-only buttons (no text content, has only an SVG icon)
    // -- the rough frame around a 32px hamburger looks like a bug.
    if (!el.textContent.trim()) return;
    el.dataset.roughFrameBound = '1';
    el.style.position = 'relative';
    el.style.border = '0';
    el.style.boxShadow = 'none';
    // Lift every child above the rough SVG. Bare text nodes can't
    // carry a z-index, so wrap them in a span first — without this
    // the SVG fill covers the button label completely.
    Array.from(el.childNodes).forEach(function (n) {
      if (n.nodeType === 1) { n.style.position = 'relative'; n.style.zIndex = '1'; }
      else if (n.nodeType === 3 && n.nodeValue && n.nodeValue.trim()) {
        var span = document.createElement('span');
        span.textContent = n.nodeValue;
        span.style.position = 'relative';
        span.style.zIndex = '1';
        n.parentNode.replaceChild(span, n);
      }
    });
    requestAnimationFrame(function () {
      paintFrame(el, rough, color, { fill: fillBg || 'none', fillStyle: fillBg ? 'solid' : 'none' });
    });
  }

  function decorate(rough, RoughNotation) {
    var inkColor    = cssVar('--color-ink', '#2B1F18');
    var redColor    = cssVar('--color-news', '#B6431E');
    var accentColor = cssVar('--color-accent', '#D4793A');
    var bgAlt       = cssVar('--color-bg-alt', '#F2EBDE');

    // 1. Form outer frames — w3f only. Subscribe forms have their
    // input + button already rough-framed; an outer frame on a 100%-
    // wide block paints visibly past the controls (a stray
    // long-rectangle around small content).
    document.querySelectorAll('form.w3f, aside.subscribe-block').forEach(function (form) {
      if (form.dataset.roughFrameBound === '1') return;
      if (shouldSkip(form)) return;
      form.dataset.roughFrameBound = '1';
      form.style.border = '0';
      form.style.boxShadow = 'none';
      requestAnimationFrame(function () { paintFrame(form, rough, accentColor); });
    });

    // 2. Every text-ish input / textarea / select on the page
    document.querySelectorAll(
      'input[type="text"], input[type="email"], input[type="url"], input[type="search"], ' +
      'input[type="tel"], input[type="number"], input[type="date"], input[type="password"], ' +
      'textarea, select'
    ).forEach(function (el) { bindControl(el, rough, inkColor); });

    // 3. Submit buttons and primary CTA buttons — paint the rough
    // frame with a dark fill so the button's bg-colored text reads.
    // The previous cream fill collided with white-on-cream button
    // labels and disappeared the words.
    document.querySelectorAll(
      'button[type="submit"], .w3f__submit, .subscribe-form__btn'
    ).forEach(function (b) {
      bindButton(b, rough, inkColor, inkColor);
      // Force the label color in case the original stylesheet
      // expected a dark CSS background-color we just stripped.
      b.style.color = cssVar('--color-bg', '#FAF6EF');
    });

    // 4. Generic CTA buttons (anywhere on the site)
    document.querySelectorAll('.btn, .btn--primary, .btn--ghost').forEach(function (b) {
      // Skip if the .btn happens to be inside something explicitly opted out.
      if (shouldSkip(b)) return;
      bindButton(b, rough, inkColor);
    });

    // 5. Rough-notation on required markers
    if (RoughNotation && RoughNotation.annotate) {
      document.querySelectorAll('.w3f__required').forEach(function (m) {
        if (m.dataset.notationBound === '1') return;
        m.dataset.notationBound = '1';
        try {
          var ann = RoughNotation.annotate(m, {
            type: 'underline',
            color: redColor,
            strokeWidth: 1.2,
            padding: 1
          });
          ann.show();
        } catch (e) { /* silent */ }
      });
    }
  }

  function init() {
    // Don't load the rough.js bundle if there's literally nothing on the
    // page that we would decorate.
    var hasTargets =
      document.querySelector('form.w3f, form.subscribe-form, aside.subscribe-block, .btn, .subscribe-form__btn') ||
      document.querySelector('input, textarea, select');
    if (!hasTargets) return;
    Promise.all([loadRough(), loadNotation()])
      .then(function (mods) { decorate(mods[0], mods[1]); })
      .catch(function () { /* libs failed to load -- silent no-op */ });
  }

  // Exposed so any consumer that reveals a previously-hidden form
  // (the feedback popup, the share popover, etc.) can trigger a
  // re-decoration once the controls are measurable.
  window.__umamiDecorateForms = init;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  document.addEventListener('spa:contentswap', init);
  window.addEventListener('load', init);

  // Repaint frames on resize so they track host dimensions across breakpoints.
  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      loadRough().then(function (rough) {
        var ink = cssVar('--color-ink', '#2B1F18');
        var accent = cssVar('--color-accent', '#D4793A');
        document.querySelectorAll('.rough-field').forEach(function (h) { paintFrame(h, rough, ink); });
        document.querySelectorAll('form.w3f, form.subscribe-form, aside.subscribe-block').forEach(function (f) {
          paintFrame(f, rough, accent);
        });
        document.querySelectorAll('[data-rough-frame-bound="1"], button[type="submit"], .w3f__submit, .subscribe-form__btn, .btn, .btn--primary, .btn--ghost').forEach(function (b) {
          if (b.dataset.roughFrameBound === '1' && b.textContent.trim()) paintFrame(b, rough, ink);
        });
      });
    }, 200);
  });
})();
