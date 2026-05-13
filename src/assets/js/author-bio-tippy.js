/**
 * Author bio tooltips — init Tippy on any element carrying
 * data-tippy-theme="author-bio". Covers article bylines, article cards,
 * and contributor card names.
 */
(function () {
  'use strict';
  if (typeof tippy === 'undefined') return;
  var els = document.querySelectorAll('[data-tippy-theme="author-bio"][data-tippy-content]');
  if (!els.length) return;
  tippy(els, {
    theme: 'author-bio',
    placement: 'top-start',
    arrow: true,
    delay: [150, 0],
    maxWidth: 300,
    interactive: false,
    appendTo: function () { return document.body; },
    zIndex: 9999,
    popperOptions: { strategy: 'fixed' }
  });
})();
