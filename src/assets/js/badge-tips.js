/**
 * Badge tooltips — init Tippy on any .tip-badge that carries
 * data-tippy-content and data-tippy-theme="badge".
 */
(function () {
  'use strict';
  if (typeof tippy === 'undefined') return;
  var els = document.querySelectorAll('.tip-badge[data-tippy-content]');
  if (!els.length) return;
  tippy(els, {
    theme: 'badge',
    arrow: true,
    delay: [200, 0],
    maxWidth: 260,
    interactive: false,
    appendTo: function () { return document.body; },
    zIndex: 9999,
    popperOptions: { strategy: 'fixed' }
  });
})();
