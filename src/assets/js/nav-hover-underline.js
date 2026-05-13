/* nav-hover-underline.js — hand-drawn straight underline on
 * .site-nav__link hover, powered by rough-notation. Lazy-loads
 * the library only when the user actually hovers a link, then
 * caches the annotation per element so subsequent hovers just
 * re-show. Underlines are removed on mouseleave / focusout. */
(function () {
  'use strict';

  if (window.__umamiNavUnderlineBootstrapped) return;
  window.__umamiNavUnderlineBootstrapped = true;

  var NOTATION_URL = '/assets/js/vendor/rough-notation.esm.js';
  var notationPromise = null;
  function loadNotation() {
    if (!notationPromise) notationPromise = import(NOTATION_URL);
    return notationPromise;
  }

  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function annotate(el) {
    if (el.__navAnn) {
      el.__navAnn.show();
      return;
    }
    loadNotation().then(function (mod) {
      var RN = mod.RoughNotation ? mod : (mod.default || mod);
      var fn = (RN.annotate || (RN.RoughNotation && RN.RoughNotation.annotate));
      if (!fn) return;
      try {
        var ann = fn(el, {
          type: 'underline',
          color: cssVar('--color-accent', '#D4793A'),
          strokeWidth: 2,
          padding: 2,
          animationDuration: 220
        });
        el.__navAnn = ann;
        ann.show();
      } catch (e) {}
    });
  }

  function hide(el) {
    if (el.__navAnn) {
      try { el.__navAnn.hide(); } catch (e) {}
    }
  }

  function bind() {
    var links = document.querySelectorAll('.site-nav__link');
    links.forEach(function (a) {
      if (a.dataset.navUnderlineBound === '1') return;
      a.dataset.navUnderlineBound = '1';
      a.addEventListener('mouseenter', function () { annotate(a); });
      a.addEventListener('mouseleave', function () { hide(a); });
      a.addEventListener('focus',      function () { annotate(a); });
      a.addEventListener('blur',       function () { hide(a); });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
  document.addEventListener('spa:contentswap', bind);
})();
