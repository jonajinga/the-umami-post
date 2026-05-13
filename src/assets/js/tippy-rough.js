/* tippy-rough.js
 *
 * Wraps every Tippy.js tooltip on the site in a rough.js sketched
 * rectangle, so the tooltips read as hand-drawn cards instead of
 * default rounded boxes. Works across the four tippy callers on the
 * site: glossary-tips.js, author-bio-tippy.js, badge-tips.js, and
 * footer-tips.js.
 *
 * Mechanism: tippy.setDefaultProps({ onMount, onHide }) hook. On
 * mount, find the popper's .tippy-box, suppress its native border /
 * background, and append a rough.js SVG that fills the box. The SVG
 * uses currentColor so dark mode auto-flips. */

(function () {
  'use strict';

  var ROUGH_URL = '/assets/js/vendor/rough.esm.js';
  var roughPromise = null;
  function loadRough() {
    if (!roughPromise) roughPromise = import(ROUGH_URL).then(m => m.default || m);
    return roughPromise;
  }

  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function paintBox(box, rough) {
    if (!box) return;
    var existing = box.querySelector(':scope > svg[data-tippy-rough]');
    if (existing) existing.remove();
    var rect = box.getBoundingClientRect();
    var w = Math.max(rect.width || 0, 48);
    var h = Math.max(rect.height || 0, 24);
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('data-tippy-rough', 'true');
    s.setAttribute('width', w);
    s.setAttribute('height', h);
    s.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    s.setAttribute('aria-hidden', 'true');
    s.style.position = 'absolute';
    s.style.inset = '0';
    s.style.pointerEvents = 'none';
    var rc = rough.svg(s);
    var ink  = cssVar('--color-ink', '#2B1F18');
    var bg   = cssVar('--color-bg-alt', '#F2EBDE');
    s.appendChild(rc.rectangle(2, 2, w - 4, h - 4, {
      stroke: ink,
      strokeWidth: 1.4,
      roughness: 1.8,
      fill: bg,
      fillStyle: 'solid'
    }));
    // Slip the SVG underneath the content so text renders crisply on top.
    box.insertBefore(s, box.firstChild);
    box.style.background = 'transparent';
    box.style.border = '0';
    box.style.boxShadow = 'none';
    box.style.position = 'relative';
  }

  function hookTippy() {
    if (!window.tippy || typeof window.tippy.setDefaultProps !== 'function') return false;
    window.tippy.setDefaultProps({
      onMount: function (instance) {
        loadRough().then(function (rough) {
          // Wait one frame so popper has placed the box at its final size.
          requestAnimationFrame(function () {
            try { paintBox(instance.popper && instance.popper.querySelector('.tippy-box'), rough); }
            catch (e) {}
          });
        });
      },
      onShown: function (instance) {
        // Re-paint after :shown in case the box resized post-mount
        // (e.g. content that lazy-loaded a glossary definition).
        loadRough().then(function (rough) {
          requestAnimationFrame(function () {
            try { paintBox(instance.popper && instance.popper.querySelector('.tippy-box'), rough); }
            catch (e) {}
          });
        });
      }
    });
    return true;
  }

  // tippy.min.js is loaded with defer, so it may not be available when
  // this script first runs. Poll a few times before giving up.
  function waitForTippy() {
    if (hookTippy()) return;
    var tries = 0;
    var iv = setInterval(function () {
      tries += 1;
      if (hookTippy() || tries > 40) clearInterval(iv);
    }, 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForTippy);
  } else {
    waitForTippy();
  }
  document.addEventListener('spa:contentswap', waitForTippy);
})();
