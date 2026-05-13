/**
 * Glossary Tooltips — auto-detect glossary terms in article/library body
 * text and show definitions on hover via Tippy.js.
 */
(function () {
  'use strict';

  // Only run on pages with an article body
  var body = document.querySelector('.article-body') || document.querySelector('.library-body');
  if (!body) return;

  // Glossary data injected at build time via a global
  var terms = window.__glossaryTerms;
  if (!terms || !terms.length) return;

  // Wait for Tippy to load
  if (typeof tippy === 'undefined') return;

  // Build a case-insensitive map
  var termMap = {};
  terms.forEach(function (t) {
    termMap[t.term.toLowerCase()] = t;
  });

  // Create a regex matching all terms (longest first to avoid partial matches)
  var sorted = terms.map(function (t) { return t.term; }).sort(function (a, b) { return b.length - a.length; });
  var pattern = new RegExp('\\b(' + sorted.map(function (t) {
    return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('|') + ')\\b', 'gi');

  // Walk text nodes and wrap matches
  var walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
    acceptNode: function (node) {
      // Skip scripts, styles, already-wrapped terms, headings, and code
      var parent = node.parentNode;
      if (!parent) return NodeFilter.FILTER_REJECT;
      var tag = parent.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'CODE' || tag === 'PRE' ||
          tag === 'A' || tag === 'MARK' || parent.classList.contains('glossary-tip')) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  var nodesToProcess = [];
  var node;
  while ((node = walker.nextNode())) {
    if (pattern.test(node.nodeValue)) {
      nodesToProcess.push(node);
    }
    pattern.lastIndex = 0;
  }

  // Only mark the first occurrence of each term
  var seen = {};

  nodesToProcess.forEach(function (textNode) {
    var text = textNode.nodeValue;
    var frag = document.createDocumentFragment();
    var lastIndex = 0;

    pattern.lastIndex = 0;
    var match;
    while ((match = pattern.exec(text)) !== null) {
      var key = match[1].toLowerCase();
      if (seen[key]) continue;
      seen[key] = true;

      var info = termMap[key];
      if (!info) continue;

      // Text before the match
      if (match.index > lastIndex) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }

      // Wrapped term
      var span = document.createElement('span');
      span.className = 'glossary-tip';
      span.textContent = match[0];
      span.setAttribute('data-tippy-content', info.def);
      span.setAttribute('tabindex', '0');
      frag.appendChild(span);

      lastIndex = match.index + match[0].length;
    }

    // Remaining text
    if (lastIndex < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    if (lastIndex > 0) {
      textNode.parentNode.replaceChild(frag, textNode);
    }
  });

  // Initialize Tippy on all wrapped terms
  tippy('.glossary-tip', {
    theme: 'glossary',
    placement: 'top',
    arrow: true,
    delay: [200, 0],
    maxWidth: 320,
    interactive: false,
    appendTo: document.body,
    // Mobile fix: dismiss on any outside tap AND make sure tapping the
    // trigger again closes the tooltip rather than leaving it open.
    hideOnClick: true,
    // `true` = open on tap (short press) and close on tap-outside. The
    // previous `['hold', 500]` setting forced a 500 ms long-press which
    // readers on mobile kept thinking was broken.
    touch: true
  });

  // Hide any visible tooltips when the page is about to change. Without
  // this, tapping a glossary term on mobile → tapping a link inside it
  // (or navigating away) leaves the tooltip portal floating on the next
  // page because SPA-nav swaps #main-content but not document.body.
  function hideAllTips() {
    if (typeof tippy !== 'undefined' && tippy.hideAll) {
      tippy.hideAll({ duration: 0 });
    }
  }
  document.addEventListener('spa:beforeswap', hideAllTips);
  window.addEventListener('pagehide', hideAllTips);
  // Also dismiss on any link click — covers the case where a glossary
  // term itself contains the destination URL (the tap both opens the
  // tooltip and starts navigation on mobile).
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('a[href]')) hideAllTips();
  }, true);
})();
