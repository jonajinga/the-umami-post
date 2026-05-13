/**
 * Per-paragraph permalinks for articles and library entries.
 *
 * Walks every direct <p> child of .article-body or .library-body,
 * assigns a stable id (`p1`, `p2`, ...) based on document order, and
 * appends a hover-revealed pilcrow (¶) anchor that, when clicked,
 * copies the full canonical URL with #pN to the clipboard, updates
 * the address bar without a history entry, and briefly flashes a
 * "Copied" tooltip on the anchor.
 *
 * Skip rules:
 *  - Paragraphs inside <aside>, <figure>, <blockquote>, <details>,
 *    .pullquote, .callout, .republish, .funding (these are decoration
 *    or chrome, not the body of the piece).
 *  - Empty paragraphs and paragraphs containing only an <img> or <br>.
 *
 * Re-runnable on SPA-nav: bound via spa-nav.js re-inject list.
 */
(function () {
  'use strict';

  var isFirstRun = !window.__paraAnchorsBootstrapped;
  window.__paraAnchorsBootstrapped = true;

  var SKIP_PARENT_SELECTOR = 'aside, figure, blockquote, details, .pullquote, .callout, .republish, .funding, .wm, .article-footer, .responses-section, .backlinks-section, .article-comments';

  function isMeaningful(p) {
    if (!p) return false;
    if (p.closest(SKIP_PARENT_SELECTOR)) return false;
    var text = (p.textContent || '').trim();
    if (!text) return false;
    return true;
  }

  function annotate(root) {
    if (!root || root.dataset.paraAnchored === 'true') return;
    var paras = root.querySelectorAll(':scope > p');
    var n = 0;
    paras.forEach(function (p) {
      if (!isMeaningful(p)) return;
      n += 1;
      if (!p.id) p.id = 'p' + n;
      if (p.querySelector(':scope > .para-anchor')) return;
      // Use a <button> rather than <a href="#pN"> so the browser
      // never tries to scroll-to-fragment on click. We still build
      // the URL from data-target when copying to clipboard. Buttons
      // don't generate hashchange events; preventDefault is moot.
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'para-anchor';
      btn.setAttribute('aria-label', 'Copy permalink to paragraph ' + n);
      btn.title = 'Copy permalink to this paragraph';
      // Inline link icon — smaller and cleaner than the heavyweight ¶
      // pilcrow glyph, and reads as "permalink" semantically.
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" width="12" height="12"><path d="M10 14a4 4 0 0 0 5.66 0l3.34-3.34a4 4 0 1 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3.34 3.34a4 4 0 1 0 5.66 5.66l1-1"/></svg>';
      btn.dataset.target = '#' + p.id;
      btn.dataset.umamiEvent = 'para-permalink';
      p.appendChild(btn);
    });
    root.dataset.paraAnchored = 'true';
  }

  function copyAndFlash(a) {
    var hash = a.getAttribute('href') || a.dataset.target || '';
    var url = location.origin + location.pathname + hash;
    var done = function () {
      a.classList.add('para-anchor--copied');
      setTimeout(function () { a.classList.remove('para-anchor--copied'); }, 1400);
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, fallback);
      } else { fallback(); }
    } catch (_) { fallback(); }
    function fallback() {
      // Older browsers / missing permission: select the URL and copy via execCommand
      var ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (_) { /* give up silently */ }
      document.body.removeChild(ta);
    }
  }

  // Pilcrow paragraph-anchors are only meaningful on actual article and
  // library *content* routes — utility pages (about, accessibility,
  // submit forms, etc.) reuse the `.article-body` class for typography
  // but aren't deep-linkable per paragraph and shouldn't render the
  // pilcrow chrome. Gate via route prefix.
  function isContentRoute() {
    var p = location.pathname || '';
    return /^\/(news|opinion|analysis|arts-culture|science-technology|history|letters|reviews|library|glossary|bookshelf)\//.test(p);
  }
  if (!isContentRoute()) return;

  // Annotate fresh content on initial run + every SPA swap (this script
  // is in the spa-nav re-inject list, so this whole IIFE re-runs).
  document.querySelectorAll('.article-body, .library-body').forEach(annotate);

  // Single document-level click handler. Use its own one-shot flag
  // (rather than the IIFE's `isFirstRun`) so the binding survives
  // any race where __paraAnchorsBootstrapped is set by something
  // else before this script runs — that path was leaving the
  // pilcrow click silently unbound on first load.
  if (!window.__paraAnchorClickBound) {
    window.__paraAnchorClickBound = true;
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('.para-anchor');
      if (!a) return;
      // Buttons don't navigate, but stop the click from bubbling to
      // any global scroll-jacking handler just in case.
      e.preventDefault();
      e.stopPropagation();
      copyAndFlash(a);
      // Reflect the permalink in the address bar so the reader can
      // copy from the URL bar too — replaceState doesn't trigger
      // hashchange or scroll.
      var hash = a.dataset.target || a.getAttribute('href') || '';
      if (hash) {
        try { history.replaceState(null, '', hash); } catch (_) {}
      }
    });

    // Highlight + scroll to a paragraph when arriving via a #pN URL.
    // The browser's automatic fragment scroll fires before this script
    // can assign id="pN" to the matching <p>, so anyone who lands
    // directly on /article/#p42 ends up at the top of the page. We
    // re-scroll once ids are in place (block: 'start' with a small
    // top offset to clear the sticky reading header).
    var flashTarget = function () {
      var hash = location.hash || '';
      if (!/^#p\d+$/.test(hash)) return;
      var el = document.getElementById(hash.slice(1));
      if (!el) return;
      // Only re-scroll on initial arrival, not on hashchange (where the
      // browser handles the scroll natively because the id exists by now).
      if (el.dataset.paraScrolled !== 'true') {
        el.dataset.paraScrolled = 'true';
        var top = el.getBoundingClientRect().top + window.scrollY - 96;
        window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
      }
      el.classList.add('para-anchor-target');
      setTimeout(function () { el.classList.remove('para-anchor-target'); }, 2000);
    };
    flashTarget();
    window.addEventListener('hashchange', flashTarget);
    document.addEventListener('spa:contentswap', flashTarget);
  }
})();
