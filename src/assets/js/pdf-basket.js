/**
 * PDF basket — collect articles for combined print export.
 *
 * Storage: `tft-pdf-basket` → array of { url, title, section, date, author }.
 * The /print-basket/ page reads the array and renders each article in a
 * print-friendly stack so the reader can hit Print → Save as PDF.
 *
 * Article-page UI: a button (#pdf-basket-btn) toggles membership.
 * Aria-pressed reflects current state. Fires Umami events for adds and
 * removes. The previous floating bottom-right tray was removed — the
 * toolbar button is the single basket affordance, and /print-basket/
 * is reachable from the basket-list link in the reader tools or by
 * direct URL.
 */
(function () {
  'use strict';

  var KEY = 'tft-pdf-basket';

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function save(arr) { try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch (e) {} }
  function indexOf(arr, url) {
    for (var i = 0; i < arr.length; i++) if (arr[i].url === url) return i;
    return -1;
  }

  function init() {
    // Remove any legacy tray injected on prior visits before this
    // floating affordance was retired (sticks around in cached DOM
    // when navigating via spa-nav from a stale page).
    var legacyTray = document.getElementById('pdf-basket-tray');
    if (legacyTray && legacyTray.parentNode) {
      legacyTray.parentNode.removeChild(legacyTray);
    }

    var btn = document.getElementById('pdf-basket-btn');
    if (!btn) return;

    var url = btn.getAttribute('data-url') || location.pathname;

    function refreshBtn() {
      var basket = load();
      var present = indexOf(basket, url) !== -1;
      btn.setAttribute('aria-pressed', present ? 'true' : 'false');
      btn.setAttribute('title', present ? 'Remove from print basket' : 'Add to print basket');
      btn.setAttribute('aria-label', present ? 'Remove from print basket' : 'Add to print basket');
      btn.classList.toggle('is-in-basket', present);
    }

    btn.addEventListener('click', function () {
      var basket = load();
      var idx = indexOf(basket, url);
      if (idx !== -1) {
        basket.splice(idx, 1);
        if (window.umami) try { umami.track('pdf-basket-remove', { url: url }); } catch (e) {}
      } else {
        basket.push({
          url: url,
          title: btn.getAttribute('data-title') || document.title,
          section: btn.getAttribute('data-section') || '',
          date: btn.getAttribute('data-date') || '',
          author: btn.getAttribute('data-author') || ''
        });
        if (window.umami) try { umami.track('pdf-basket-add', { url: url }); } catch (e) {}
      }
      save(basket);
      refreshBtn();
    });

    refreshBtn();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  document.addEventListener('spa:contentswap', init);
})();
