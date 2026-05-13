/**
 * Manual read-state + reading history.
 *
 * Two storage keys, both keyed by article URL:
 *
 *   tft-read-pct      → { "/section/slug/": 0–100 }
 *                       Owned by reading-progress.js. Auto-updated as the
 *                       reader scrolls. We mirror entries that hit 100 into
 *                       the manual-read map so a finished scroll counts as
 *                       "read" for the history page.
 *
 *   tft-read-manual   → { "/section/slug/": { title, section, markedAt } }
 *                       Set when the reader clicks the explicit "Mark as
 *                       read" button on an article, or unset when they
 *                       toggle it off. Source of truth for the history page.
 *
 * Article-page UI: a button in the article meta strip toggles the manual
 * record. The button reads the article's <h1> + section attribute on first
 * click so we capture readable metadata without a server round-trip.
 *
 * Reading-history page: reads tft-read-manual + tft-read-pct, merges, and
 * renders the list. See src/pages/reading-history.njk.
 */
(function () {
  'use strict';

  var PCT_KEY    = 'tft-read-pct';
  var MANUAL_KEY = 'tft-read-manual';

  function load(key) { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { return {}; } }
  function save(key, data) { try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) {} }

  function init() {
    var btn = document.getElementById('mark-read-btn');
    if (!btn) return;
    var url = btn.getAttribute('data-url') || location.pathname;
    var title = btn.getAttribute('data-title') || (document.querySelector('h1') ? document.querySelector('h1').textContent.trim() : document.title);
    var section = btn.getAttribute('data-section') || '';

    function refresh() {
      var manual = load(MANUAL_KEY);
      var isRead = !!manual[url];
      btn.setAttribute('aria-pressed', isRead ? 'true' : 'false');
      btn.classList.toggle('is-read', isRead);
      var label = btn.querySelector('.mark-read-btn__label');
      if (label) label.textContent = isRead ? 'Read' : 'Mark as read';
    }

    btn.addEventListener('click', function () {
      var manual = load(MANUAL_KEY);
      if (manual[url]) {
        delete manual[url];
      } else {
        manual[url] = { title: title, section: section, markedAt: new Date().toISOString() };
      }
      save(MANUAL_KEY, manual);
      refresh();
      if (window.umami) {
        try { umami.track(manual[url] ? 'mark-read' : 'mark-unread', { url: url }); } catch (e) {}
      }
    });

    refresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  document.addEventListener('spa:contentswap', init);
})();
