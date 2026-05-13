/**
 * Keyboard shortcuts for power readers.
 *
 * Active shortcuts (shown in ? overlay):
 *   /   Focus the search input (wherever it is on the page)
 *   r   Toggle the reader panel (highlights / notes / bookmarks / related)
 *   g   Go to top / go to bottom (g g for top, G for bottom)
 *   n   Next article in the section (when on an article page)
 *   p   Previous article in the section
 *   ?   Open/close the keyboard shortcuts overlay
 *   Esc Close overlays and panels
 *
 * Shortcuts are suppressed while typing into inputs, textareas, or contentEditable.
 */
(function () {
  'use strict';

  // Shortcuts are global to the site, so the script should initialise its
  // document listeners exactly once even though spa-nav re-injects it on
  // article SPA swaps (the re-inject is meant for other bundles that
  // actually need fresh per-page binding).
  if (window.__keyboardShortcutsBootstrapped) return;
  window.__keyboardShortcutsBootstrapped = true;

  // Don't fire shortcuts when the user is typing into a field
  function isTyping(e) {
    var t = e.target;
    if (!t) return false;
    var tag = (t.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (t.isContentEditable) return true;
    return false;
  }

  // Click the element matching the selector if it exists
  function click(sel) {
    var el = document.querySelector(sel);
    if (el) { el.click(); return true; }
    return false;
  }

  function focusSearch() {
    var input = document.getElementById('sp-input') || document.querySelector('#search-modal input, .site-search__input, [role="search"] input');
    if (input) { input.focus(); input.select && input.select(); return true; }
    // Fall back to navigating to /search/
    var btn = document.getElementById('search-toggle') || document.querySelector('[aria-controls="search-modal"]');
    if (btn) { btn.click(); return true; }
    return false;
  }

  function toggleReaderPanel() {
    // Article reader panel toggle button (from library-reading-header)
    var btn = document.querySelector('.article-notes-toggle, .library-panel-toggle');
    if (btn) { btn.click(); return true; }
    return false;
  }

  // Navigate to next/previous article in the section via footer nav
  function gotoAdjacent(direction) {
    // Look for standard prev/next article links on article pages
    var sel = direction === 'next'
      ? 'a[rel="next"], .article-nav__next, .prev-next__next'
      : 'a[rel="prev"], .article-nav__prev, .prev-next__prev';
    var link = document.querySelector(sel);
    if (link && link.href) { location.href = link.href; return true; }
    return false;
  }

  var lastKey = null;
  var lastKeyTime = 0;

  document.addEventListener('keydown', function (e) {
    if (isTyping(e)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    var k = e.key;

    // Escape closes overlays first
    if (k === 'Escape') {
      // Close shortcuts overlay if open
      var sc = document.getElementById('kb-shortcuts-overlay');
      if (sc && !sc.hidden) { sc.hidden = true; return; }
      // Let other handlers (panels) run naturally — don't preventDefault
      return;
    }

    // ? opens the shortcuts overlay
    if (k === '?' || (k === '/' && e.shiftKey)) {
      e.preventDefault();
      toggleShortcutsOverlay();
      return;
    }

    // / focuses search
    if (k === '/') {
      if (focusSearch()) e.preventDefault();
      return;
    }

    // g g → top; G → bottom (vim-style)
    if (k === 'g' && !e.shiftKey) {
      var now = Date.now();
      if (lastKey === 'g' && (now - lastKeyTime) < 500) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        lastKey = null;
        return;
      }
      lastKey = 'g';
      lastKeyTime = now;
      return;
    }
    if (k === 'G') {
      e.preventDefault();
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      return;
    }

    // Single-letter shortcuts
    if (k === 'r') { if (toggleReaderPanel()) e.preventDefault(); return; }
    if (k === 'n') { if (gotoAdjacent('next')) e.preventDefault(); return; }
    if (k === 'p') { if (gotoAdjacent('prev')) e.preventDefault(); return; }
  });

  // ── Shortcuts overlay ─────────────────────────────────────────
  function toggleShortcutsOverlay() {
    var overlay = document.getElementById('kb-shortcuts-overlay');
    if (overlay) { overlay.hidden = !overlay.hidden; return; }
    overlay = document.createElement('div');
    overlay.id = 'kb-shortcuts-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Keyboard shortcuts');
    overlay.innerHTML =
      '<div class="kb-backdrop" data-kb-close></div>' +
      '<div class="kb-panel">' +
        '<div class="kb-header">' +
          '<h2 class="kb-title">Keyboard Shortcuts</h2>' +
          '<button type="button" class="kb-close" aria-label="Close" data-kb-close>&times;</button>' +
        '</div>' +
        '<table class="kb-list">' +
          row('/', 'Search') +
          row('r', 'Toggle reader panel') +
          row('n', 'Next article') +
          row('p', 'Previous article') +
          row('g g', 'Scroll to top') +
          row('G', 'Scroll to bottom') +
          row('?', 'Show this help') +
          row('Esc', 'Close overlays') +
        '</table>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.querySelectorAll('[data-kb-close]').forEach(function (b) {
      b.addEventListener('click', function () { overlay.hidden = true; });
    });
    function row(key, label) {
      return '<tr><td class="kb-key"><kbd>' + key.split(' ').map(function (k) { return '<span>' + k + '</span>'; }).join(' ') + '</kbd></td><td class="kb-desc">' + label + '</td></tr>';
    }
  }
})();
