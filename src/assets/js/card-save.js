/* card-save.js — wires the bookmark button on every recipe /
 * article / technique / review card to the shared reading-list
 * localStorage. Multiple cards can coexist on a single page;
 * each saves independently. Click without navigating to the
 * card link.
 *
 * Storage key matches reading-list.js so the reading list page
 * picks up the same items. */
(function () {
  'use strict';
  if (window.__umamiCardSaveBootstrapped) return;
  window.__umamiCardSaveBootstrapped = true;

  var KEY = (window.__PREFIX || 'umami') + '-reading-list';

  function readList() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch (e) { return []; }
  }
  function writeList(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
  }

  function isSaved(url) {
    return readList().some(function (item) { return item.url === url; });
  }

  function sync(btn) {
    var url = btn.dataset.url;
    if (!url) return;
    btn.classList.toggle('is-saved', isSaved(url));
    btn.setAttribute('aria-pressed', isSaved(url) ? 'true' : 'false');
  }

  function toggle(btn) {
    var url     = btn.dataset.url;
    var title   = btn.dataset.title;
    var section = btn.dataset.section || '';
    var date    = btn.dataset.date || '';
    if (!url) return;
    var list = readList();
    var idx = list.findIndex(function (i) { return i.url === url; });
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.unshift({
        url: url,
        title: title || url,
        section: section,
        date: date,
        savedAt: new Date().toISOString()
      });
    }
    writeList(list);
    sync(btn);
  }

  function bind() {
    document.querySelectorAll('.card__save').forEach(function (btn) {
      sync(btn);
      if (btn.dataset.cardSaveBound === '1') return;
      btn.dataset.cardSaveBound = '1';
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        toggle(btn);
      });
    });

    // Whole-card click target: any element with data-card-link
    // navigates to its href when the user clicks anywhere on the
    // card EXCEPT a nested interactive element (anchor, button,
    // input, [role=button]). Cursor + Enter/Space keyboard support
    // matches the role="link" pattern emitted by recipe-card.njk.
    document.querySelectorAll('[data-card-link]').forEach(function (card) {
      if (card.dataset.cardLinkBound === '1') return;
      card.dataset.cardLinkBound = '1';
      card.style.cursor = 'pointer';
      function go(e) {
        // Don't navigate when the click landed on an actual
        // interactive child element — let its own handler run.
        if (e.target.closest('a, button, input, select, textarea, [role="button"], [role="menuitem"]')) return;
        var href = card.dataset.cardLink;
        if (!href) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey) {
          window.open(href, '_blank', 'noopener');
        } else {
          location.assign(href);
        }
      }
      card.addEventListener('click', go);
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(e); }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
  document.addEventListener('spa:contentswap', bind);
  // Re-sync visible buttons when the list changes in another tab.
  window.addEventListener('storage', function (e) {
    if (e.key === KEY) document.querySelectorAll('.card__save').forEach(sync);
  });
})();
