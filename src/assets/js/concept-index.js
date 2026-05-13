/**
 * Concept index — client-side filter for /back-of-book/.
 *
 * Filters the visible entries by substring match against the term
 * (data-term, lower-cased at render time). When filtering, also hides
 * letter-section headers whose entries are all filtered out.
 *
 * Cross-reference clicks (See / See also) anchor-jump to the target
 * entry — no JS needed for the navigation itself, but we add a brief
 * highlight on the landed-on entry so users can see where they ended
 * up in a long index.
 */
(function () {
  'use strict';

  function init() {
    var input   = document.getElementById('concept-index-filter');
    var count   = document.getElementById('concept-index-count');
    var entries = document.querySelectorAll('.concept-index__entry');
    var sections = document.querySelectorAll('.concept-index__section');
    if (!entries.length) return;

    function applyFilter() {
      var q = input ? input.value.trim().toLowerCase() : '';
      var visible = 0;
      entries.forEach(function (e) {
        var t = e.dataset.term || '';
        var match = !q || t.indexOf(q) !== -1;
        // Also match any sub-term text inside the entry, so users can
        // find sub-entries by their context line ("affordable housing
        // fund", "field guide", etc.) without needing to know the
        // top-level term.
        if (!match) {
          var subText = e.textContent.toLowerCase();
          match = subText.indexOf(q) !== -1;
        }
        e.hidden = !match;
        if (match) visible++;
      });
      // Hide sections whose entries are all filtered out
      sections.forEach(function (s) {
        var any = s.querySelector('.concept-index__entry:not([hidden])');
        s.hidden = !any;
      });
      if (count) {
        count.textContent = visible + (visible === 1 ? ' entry' : ' entries')
                          + (q ? ' matching “' + q + '”' : '');
      }
    }

    if (input) {
      input.addEventListener('input', applyFilter);
    }

    // Highlight the entry the URL hash points at, then again on every
    // in-page xref click. Tiny visual ping so the user can find their
    // target inside a long letter section.
    function flash(target) {
      if (!target) return;
      target.classList.add('concept-index__entry--flash');
      setTimeout(function () {
        target.classList.remove('concept-index__entry--flash');
      }, 1500);
    }
    function flashFromHash() {
      var h = location.hash;
      if (!h) return;
      var t = document.querySelector(h);
      if (t && t.classList.contains('concept-index__entry')) flash(t);
    }
    flashFromHash();
    window.addEventListener('hashchange', flashFromHash);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  document.addEventListener('spa:contentswap', init);
})();
