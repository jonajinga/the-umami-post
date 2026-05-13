/**
 * Footer tooltips — init Tippy.js on any link in the footer that carries
 * a data-tippy-content attribute. Gives richer hover explanations than
 * the native browser title tooltip, styled to match the site.
 */
(function () {
  'use strict';
  if (typeof tippy === 'undefined') return;

  // Skip on touch / no-hover devices. Tooltips require hover to be useful;
  // on phones they either never show or show on tap (hijacking the link).
  var hasHover = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!hasHover) return;

  // Exclude .tip-badge, already handled by badge-tips.js (would double-init).
  var els = document.querySelectorAll('.site-footer a[data-tippy-content]:not(.tip-badge), .nav-drawer a[data-tippy-content]:not(.tip-badge)');
  if (!els.length) return;
  tippy(els, {
    theme: 'badge',
    arrow: true,
    delay: [250, 0],
    maxWidth: 320,
    placement: 'top',
    interactive: false,
    appendTo: function () { return document.body; },
    zIndex: 9999,
    popperOptions: { strategy: 'fixed' }
  });
})();
