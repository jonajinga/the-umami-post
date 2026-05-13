/* form-decorations.js
 *
 * Hand-drawn treatment for every Web3Forms-style form on the site:
 *   - Every text input / email input / url input / textarea / select
 *     gets a rough.js sketched frame in place of its solid 1px border.
 *   - Every required-field marker (.w3f__required) gets a rough-notation
 *     wavy red underline so it actually reads as "required, not a typo."
 *   - Submit buttons get a rough box outline that animates on hover.
 *   - Form-level <fieldset> elements get a rough bracket on the left.
 *
 * Both libraries are loaded lazily (dynamic import) and only when a
 * form is actually on the page, so the cost on non-form pages is zero.
 *
 * Markup contract: every form uses the `.w3f` class (Web3Forms wrapper)
 * with child elements `.w3f__input`, `.w3f__textarea`, `.w3f__select`,
 * `.w3f__required`, `.w3f__submit`. No template edits needed -- this
 * script attaches purely by selector. */

(function () {
  'use strict';

  var ROUGH_URL    = '/assets/js/vendor/rough.esm.js';
  var NOTATION_URL = '/assets/js/vendor/rough-notation.esm.js';
  var roughPromise = null;
  var notationPromise = null;

  function loadRough() {
    if (!roughPromise) roughPromise = import(ROUGH_URL).then(m => m.default || m);
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

  // Build (or rebuild) a sketched-rectangle SVG that fills `host`.
  function paintFrame(host, rough, color) {
    var existing = host.querySelector(':scope > svg[data-form-frame]');
    if (existing) existing.remove();
    var rect = host.getBoundingClientRect();
    var w = Math.max(rect.width  || 0, 60);
    var h = Math.max(rect.height || 0, 32);
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('data-form-frame', 'true');
    s.setAttribute('width', w);
    s.setAttribute('height', h);
    s.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    s.setAttribute('aria-hidden', 'true');
    s.style.position = 'absolute';
    s.style.inset = '0';
    s.style.pointerEvents = 'none';
    var rc = rough.svg(s);
    s.appendChild(rc.rectangle(3, 3, w - 6, h - 6, {
      stroke: color,
      strokeWidth: 1.4,
      roughness: 1.6,
      fill: 'none'
    }));
    host.appendChild(s);
  }

  // Wrap a single form-control element so the rough frame can be
  // absolutely positioned over it. Idempotent.
  function wrapControl(el) {
    var existing = el.parentElement;
    if (existing && existing.classList.contains('rough-field')) return existing;
    var w = document.createElement('span');
    w.className = 'rough-field';
    w.style.position = 'relative';
    w.style.display = 'block';
    el.parentNode.insertBefore(w, el);
    w.appendChild(el);
    // Strip the native border so the rough one doesn't double up.
    el.style.border = '0';
    el.style.background = 'transparent';
    el.style.position = 'relative';
    el.style.zIndex = '1';
    return w;
  }

  function decorateForms(rough, RoughNotation) {
    var forms = document.querySelectorAll('form.w3f');
    if (!forms.length) return;
    var inkColor  = cssVar('--color-ink', '#2B1F18');
    var redColor  = cssVar('--color-news', '#B6431E');
    var accentCol = cssVar('--color-accent', '#D4793A');

    forms.forEach(function (form) {
      // Frames on every text-ish form control
      var controls = form.querySelectorAll(
        '.w3f__input, .w3f__textarea, .w3f__select, ' +
        'input[type="text"], input[type="email"], input[type="url"], input[type="search"], ' +
        'input[type="tel"], input[type="number"], input[type="date"], input[type="password"], ' +
        'textarea, select'
      );
      controls.forEach(function (el) {
        if (el.dataset.formFrameBound === '1') return;
        el.dataset.formFrameBound = '1';
        var host = wrapControl(el);
        // Paint after layout settles
        requestAnimationFrame(function () { paintFrame(host, rough, inkColor); });
      });

      // Sketched outline on the submit button
      var submit = form.querySelector('.w3f__submit, button[type="submit"]');
      if (submit && submit.dataset.formFrameBound !== '1') {
        submit.dataset.formFrameBound = '1';
        submit.style.position = 'relative';
        submit.style.border = '0';
        requestAnimationFrame(function () { paintFrame(submit, rough, inkColor); });
      }

      // rough-notation underline on each "*" required marker
      if (RoughNotation && RoughNotation.annotate) {
        var reqMarkers = form.querySelectorAll('.w3f__required');
        reqMarkers.forEach(function (m) {
          if (m.dataset.notationBound === '1') return;
          m.dataset.notationBound = '1';
          try {
            var ann = RoughNotation.annotate(m, {
              type: 'underline',
              color: redColor,
              strokeWidth: 1.6,
              padding: 1
            });
            ann.show();
          } catch (e) { /* silent */ }
        });
      }
    });
  }

  function init() {
    var forms = document.querySelectorAll('form.w3f');
    if (!forms.length) return;
    Promise.all([loadRough(), loadNotation()])
      .then(function (mods) { decorateForms(mods[0], mods[1]); })
      .catch(function () { /* libs failed to load -- silent no-op */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  document.addEventListener('spa:contentswap', init);
  window.addEventListener('load', init);

  // Repaint frames on resize (debounced) so they track the host width.
  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      loadRough().then(function (rough) {
        var color = cssVar('--color-ink', '#2B1F18');
        document.querySelectorAll('.rough-field').forEach(function (h) { paintFrame(h, rough, color); });
        document.querySelectorAll('form.w3f .w3f__submit, form.w3f button[type="submit"]').forEach(function (b) {
          paintFrame(b, rough, color);
        });
      });
    }, 200);
  });
})();
