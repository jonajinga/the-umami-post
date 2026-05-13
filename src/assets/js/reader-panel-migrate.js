/**
 * Reader-panel migration + share/print popover wiring.
 *
 * The article HTML still renders the original .article-header__actions block
 * (hidden via CSS) so existing scripts (download.js, progress.js,
 * reading-list.js) keep wiring up by ID. This script:
 *
 *   - moves Save / Feedback buttons into the bottom toolbar
 *   - moves share-panel / download-panel into the Share popover
 *   - wires the Share and Print popovers (toggle + close-on-outside)
 *   - delegates to navigator.share() on mobile if available
 *
 * (The old Reading-settings panel migration is gone; display settings
 * are now unified in the masthead global-settings panel.)
 */
(function () {
  'use strict';

  // Re-execution guard: spa-nav re-injects this script on every article/
  // library page swap so element migration runs against the freshly-
  // rendered DOM. Document-level listeners must only register once.
  var isFirstRun = !window.__readerPanelMigrateBootstrapped;
  window.__readerPanelMigrateBootstrapped = true;

  function move(srcId, slotId) {
    var src = document.getElementById(srcId);
    var slot = document.getElementById(slotId);
    if (src && slot) slot.appendChild(src);
  }

  var panel   = document.getElementById('article-notes-panel') || document.getElementById('library-panel');
  var toolbar = document.getElementById('annotation-toolbar');
  if (!panel && !toolbar) return;

  // ── Bottom toolbar slots
  move('bookmark-btn',   'ann-save-slot');
  move('like-btn',       'ann-like-slot');
  move('mark-read-btn',  'ann-mark-read-slot');
  move('pdf-basket-btn', 'ann-pdf-basket-slot');

  // Reading-pct + back-to-top are now rendered server-side inline
  // inside article.njk's toolbar (gated by isReadingPage). No more
  // DOM-move from base.njk's reading-floats — that path was
  // destructive across SPA nav swaps. The .toolbar-floats class is
  // applied directly in the template.

  // After migration, give each engagement button the toolbar look while
  // keeping its existing id-based bindings intact.
  ['like-btn', 'mark-read-btn', 'pdf-basket-btn'].forEach(function (id) {
    var b = document.getElementById(id);
    if (!b) return;
    b.classList.add('annotation-toolbar__btn');
    b.classList.remove('article-action-btn');
  });

  // Hide the panel-footer "Comments" button if the page has no comments
  // section to scroll to (e.g. comments aren't configured for this site).
  if (!document.getElementById('comments-body')) {
    document.querySelectorAll('.library-panel__footer-btn').forEach(function (b) {
      if ((b.getAttribute('aria-label') || '').toLowerCase().indexOf('comment') !== -1) {
        b.hidden = true;
      }
    });
  }

  // ── Reader panel footer slot for the Feedback button + popup
  // (bar gets too crowded on mobile when this lives inline; the panel
  // is a more natural home for "Send feedback" anyway)
  move('article-feedback-btn',   'ann-feedback-slot');
  // Keep the popup at body level rather than migrating it into the
  // toolbar slot — the toolbar is `position: fixed; z-index: overlay`
  // which creates a stacking context that traps the popup. On mobile
  // the popup goes `position: fixed; z-index: modal` to take over the
  // viewport; with body as its parent the higher z-index actually
  // lifts it above everything else (including the toolbar itself).
  (function () {
    var popup = document.getElementById('article-feedback-popup');
    if (popup && popup.parentNode !== document.body) {
      document.body.appendChild(popup);
    }
  })();

  // ── Share popover slots
  move('share-panel',    'ann-share-slot');
  move('download-panel', 'ann-download-slot');

  // Clear [hidden] on relocated panels — visibility now lives on the new
  // containers (the Share popover).
  ['share-panel', 'download-panel'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) { el.hidden = false; el.classList.add('is-in-panel'); }
  });

  // ── Scroll arrows for the toolbar's main row. Show only when the
  // row actually overflows; hide each arrow when the row is scrolled
  // to the corresponding edge.
  (function bindToolbarScroll() {
    var main = document.querySelector('.annotation-toolbar__main');
    if (!main) return;
    var leftBtn  = document.querySelector('[data-toolbar-scroll="-1"]');
    var rightBtn = document.querySelector('[data-toolbar-scroll="1"]');
    function updateArrows() {
      var hasOverflow = main.scrollWidth > main.clientWidth + 1;
      var atStart = main.scrollLeft <= 1;
      var atEnd   = main.scrollLeft + main.clientWidth >= main.scrollWidth - 1;
      if (leftBtn)  leftBtn.hidden  = !hasOverflow || atStart;
      if (rightBtn) rightBtn.hidden = !hasOverflow || atEnd;
    }
    function bumpScroll(dir) {
      // Jump to the extremes rather than nudging by 60% — users expect the
      // arrows to take them all the way to that edge, and the right arrow
      // never quite hides at the end with a 60% increment because fractional
      // pixels leave a sliver of un-scrolled space.
      if (dir < 0) {
        main.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        main.scrollTo({ left: main.scrollWidth, behavior: 'smooth' });
      }
    }
    if (leftBtn)  leftBtn.addEventListener('click',  function () { bumpScroll(-1); });
    if (rightBtn) rightBtn.addEventListener('click', function () { bumpScroll(1); });
    main.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    // Always start scrolled fully to the left so the leftmost buttons
    // (Listen / reader-tools) are in view on initial paint. Browsers
    // sometimes restore a previous horizontal scroll position on a
    // soft navigation, and the toolbar's `scroll-behavior: smooth`
    // can interfere with a one-shot reset. Force the scroll position
    // immediately, again after the next layout frame, and one more
    // time after a short delay — rAF + setTimeout together cover both
    // first-paint and SPA-nav restoration paths.
    main.scrollLeft = 0;
    requestAnimationFrame(function () {
      main.scrollLeft = 0;
      updateArrows();
    });
    setTimeout(function () { main.scrollLeft = 0; updateArrows(); }, 50);
  })();

  // ── Generic popover wiring used by Share and Print.
  // Toggles `aria-expanded`, dismisses on outside click / Escape / item-click.
  function bindPopover(triggerId, popoverId, opts) {
    var trigger = document.getElementById(triggerId);
    var popover = document.getElementById(popoverId);
    if (!trigger || !popover) return null;

    function open()  { popover.hidden = false; trigger.setAttribute('aria-expanded', 'true');  }
    function close() { popover.hidden = true;  trigger.setAttribute('aria-expanded', 'false'); }

    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      if (opts && opts.onClick && opts.onClick(e) === false) return;
      if (popover.hidden) open(); else close();
    });

    document.addEventListener('click', function (e) {
      if (popover.hidden) return;
      if (!popover.contains(e.target) && e.target !== trigger) close();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !popover.hidden) { close(); trigger.focus(); }
    });

    // Click any link/button inside → close popover (after the click resolves)
    popover.addEventListener('click', function (e) {
      if (e.target.closest('a, button')) setTimeout(close, 50);
    });

    return { open: open, close: close };
  }

  // ── Share button — always opens the popover (on mobile and desktop).
  // Earlier we handed off to navigator.share() on touch devices, but the
  // popover gives users access to specific networks, copy-link, download,
  // and print — all of which the system share sheet doesn't cover.
  var shareBtn = document.getElementById('ann-share-btn');
  var sharePopover = document.getElementById('ann-share-popover');
  if (shareBtn) shareBtn.classList.remove('annotation-toolbar__btn--needs-selection');
  bindPopover('ann-share-btn', 'ann-share-popover');

  // For article+notes print: walk every .library-highlight--note <mark> in
  // the article body and append its note text inline as a .print-inline-note
  // span. CSS reveals these only in print + print-include-notes mode.
  function injectInlineNotes() {
    var key = (window.__PREFIX || 'tft') + '-annotations';
    var ann = [];
    try { ann = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) {}
    var byId = {};
    ann.forEach(function (a) { if (a && a.id) byId[a.id] = a; });
    document.querySelectorAll('mark.library-highlight--note').forEach(function (mark) {
      if (mark.querySelector('.print-inline-note')) return;
      var entry = byId[mark.dataset.annId];
      if (!entry || !entry.note) return;
      var span = document.createElement('span');
      span.className = 'print-inline-note';
      span.textContent = entry.note;
      mark.appendChild(span);
    });
  }
  function stripInlineNotes() {
    document.querySelectorAll('.print-inline-note').forEach(function (n) { n.remove(); });
  }

  // ── Print buttons inside the share popover (all standardized: each
  // calls window.print() with a body class controlling which sections
  // appear in the printout).
  //   article                → no class, just the article (footnotes hidden)
  //   article-with-footnotes → .print-include-footnotes (article + footnotes)
  //   article-with-notes     → .print-include-notes (article + appendix)
  //   notes-only             → .print-notes-only (only the appendix)
  function clearPrintMode() {
    document.body.classList.remove('print-include-notes', 'print-notes-only', 'print-include-footnotes');
    stripInlineNotes();
  }
  // Populate panel sections that render lazily (highlights / notes /
  // bookmarks via annotations.js, footnotes via footnotes.js), so print
  // captures them even when the user never opened the panel/tabs.
  function populatePanelForPrint() {
    if (typeof window.__refreshReaderPanel === 'function') {
      try { window.__refreshReaderPanel(); } catch (e) {}
    }
    // Force the lazy tab populators to run by flipping aria-hidden to
    // "false" for a tick — our populators observe that attribute.
    ['article-panel-footnotes', 'panel-footnotes', 'article-panel-cite-inline', 'panel-cite-inline'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (el.dataset.rendered !== 'true') {
        var prev = el.getAttribute('aria-hidden');
        el.setAttribute('aria-hidden', 'false');
        setTimeout(function () {
          if (prev !== null) el.setAttribute('aria-hidden', prev);
        }, 0);
      }
    });
  }

  if (sharePopover) {
    sharePopover.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-print]');
      if (!btn) return;
      var mode = btn.getAttribute('data-print');
      clearPrintMode();
      if (mode === 'article-with-notes') {
        document.body.classList.add('print-include-notes');
        populatePanelForPrint();
        injectInlineNotes();
      } else if (mode === 'notes-only') {
        document.body.classList.add('print-notes-only');
        populatePanelForPrint();
      } else if (mode === 'article-with-footnotes') {
        document.body.classList.add('print-include-footnotes');
      }
      // Give the populators a tick to finish before opening the print dialog.
      setTimeout(function () {
        window.print();
        setTimeout(clearPrintMode, 100);
      }, 80);
    });
  }

  // ── Export tab — buttons live as panel section content now (they used
  // to be a popover, which was cramped and positioned poorly on mobile).
  // Each button carries data-export="txt|md|json|print" and is wired via
  // document-level delegation so migrated/re-rendered buttons work too.
  if (isFirstRun) document.addEventListener('click', function (e) {
    var btn = e.target.closest('.reader-export-btn, [data-export]');
    if (!btn) return;
    // Print/download data-export buttons also appear inside ann-share-popover;
    // those are already handled above. Skip them here.
    if (btn.closest('#ann-share-popover, #ann-print-popover')) return;
    var kind = btn.getAttribute('data-export');
    if (!kind) return;
    try {
      if (kind === 'print') {
        if (typeof window.__printPanelNotes === 'function') window.__printPanelNotes();
      } else {
        if (typeof window.__exportPanelNotes === 'function') window.__exportPanelNotes(kind);
      }
    } catch (err) { /* silence */ }
  });
})();
