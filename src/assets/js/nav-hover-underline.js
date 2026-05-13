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
    // Apply animated rough-notation hover underline to every link
    // surface that should feel "hand-drawn live" — top nav links,
    // mega-menu items, drawer section tiles, footer link columns,
    // article-card titles, breadcrumb crumbs, and explicit opt-ins
    // via `.rn-hover` or `data-rough-hover="underline"`.
    var sel = [
      '.site-nav__link',
      '.nav-section-col__link',
      '.nav-dropdown__footer-link',
      '.nav-dropdown__footer',
      '.nav-drawer__link',
      '.site-footer__nav a',
      '.breadcrumbs-bar__link',
      '.card__title a',
      '.rn-hover',
      '[data-rough-hover="underline"]'
    ].join(',');
    document.querySelectorAll(sel).forEach(function (a) {
      if (a.dataset.navUnderlineBound === '1') return;
      a.dataset.navUnderlineBound = '1';
      a.addEventListener('mouseenter', function () { annotate(a); });
      a.addEventListener('mouseleave', function () { hide(a); });
      a.addEventListener('focus',      function () { annotate(a); });
      a.addEventListener('blur',       function () { hide(a); });
    });
    // Block-level link rows whose link element is full-width — we
    // need to draw the underline on the inner title span so the
    // rough rule hugs the text. Hover stays bound to the parent
    // so the hot area is still the whole row.
    var rowSelectors = [
      { row: '.nav-mega__link',          inner: '.nav-mega__title' },
      { row: '.nav-section-col__article', inner: '.nav-section-col__article-title' },
      { row: '.nav-drawer__latest-row',   inner: '.nav-drawer__latest-title' }
    ];
    rowSelectors.forEach(function (pair) {
      document.querySelectorAll(pair.row).forEach(function (a) {
        if (a.dataset.navUnderlineBound === '1') return;
        a.dataset.navUnderlineBound = '1';
        var target = a.querySelector(pair.inner) || a;
        a.addEventListener('mouseenter', function () { annotate(target); });
        a.addEventListener('mouseleave', function () { hide(target); });
        a.addEventListener('focus',      function () { annotate(target); });
        a.addEventListener('blur',       function () { hide(target); });
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
  document.addEventListener('spa:contentswap', bind);
})();
