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
      '.nav-section-col__article',
      '.nav-dropdown__footer-link',
      '.nav-dropdown__footer',
      '.nav-drawer__link',
      '.nav-drawer__latest-row',
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
    // Mega menu rows: the .nav-mega__link is full-column-width, so
    // an underline drawn on the link itself spans the whole column.
    // Target the inner .nav-mega__title span (which hugs the text)
    // but trigger on the parent link so the hover area stays wide.
    document.querySelectorAll('.nav-mega__link').forEach(function (a) {
      if (a.dataset.navUnderlineBound === '1') return;
      a.dataset.navUnderlineBound = '1';
      var target = a.querySelector('.nav-mega__title') || a;
      a.addEventListener('mouseenter', function () { annotate(target); });
      a.addEventListener('mouseleave', function () { hide(target); });
      a.addEventListener('focus',      function () { annotate(target); });
      a.addEventListener('blur',       function () { hide(target); });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
  document.addEventListener('spa:contentswap', bind);
})();
