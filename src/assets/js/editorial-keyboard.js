/**
 * Cross-surface keyboard shortcuts for the editorial pages
 * (/dashboard/, /editorial/board/, /editorial-calendar/).
 *
 *   g d → Dashboard
 *   g b → Editorial Board
 *   g c → Editorial Calendar
 *   ?   → toggle a help overlay listing all shortcuts
 *   Esc → close the help overlay
 *
 * The `g`-prefix pattern is the Gmail / GitHub convention. State is
 * held in a 1.2-second timeout; second key resolves the navigation.
 * Keys are ignored when an input/textarea/select is focused, so
 * board-page filter-typing and calendar text fields are safe.
 */
(function () {
  'use strict';

  var SHORTCUTS = [
    { keys: 'g d',  label: 'Dashboard' },
    { keys: 'g b',  label: 'Editorial board' },
    { keys: 'g c',  label: 'Editorial calendar' },
    { keys: '?',    label: 'Show this help' },
    { keys: 'Esc',  label: 'Close help / clear filters' },
    { keys: '/',    label: 'Focus filter (board only)' },
    { keys: 's',    label: 'Toggle stuck-only (board only)' },
    { keys: 'o',    label: 'Toggle overdue-only (board only)' },
    { keys: 't',    label: 'Jump to today (calendar only)' },
    { keys: '1–4',  label: 'Switch view: day / week / month / year (calendar)' },
    { keys: '←/→',  label: 'Move cursor (calendar)' },
    { keys: '↑/↓',  label: 'Move cursor by week (calendar)' },
  ];

  function ensureOverlay() {
    var existing = document.getElementById('ed-help-overlay');
    if (existing) return existing;
    var wrap = document.createElement('div');
    wrap.id = 'ed-help-overlay';
    wrap.className = 'ed-help-overlay';
    wrap.innerHTML = ''
      + '<div class="ed-help-overlay__panel" role="dialog" aria-modal="true" aria-labelledby="ed-help-title">'
        + '<h2 class="ed-help-overlay__title" id="ed-help-title">Keyboard shortcuts</h2>'
        + '<dl>'
          + SHORTCUTS.map(function (s) {
              var keys = s.keys.split(' ').map(function (k) { return '<kbd>' + k + '</kbd>'; }).join(' ');
              return '<dt>' + keys + '</dt><dd>' + s.label + '</dd>';
            }).join('')
        + '</dl>'
        + '<p style="margin-top:1rem;font-size:0.78rem;color:var(--color-ink-faint);">Press <kbd>?</kbd> or <kbd>Esc</kbd> to close.</p>'
      + '</div>';
    document.body.appendChild(wrap);
    wrap.addEventListener('click', function (e) {
      if (e.target === wrap) toggleOverlay(false);
    });
    return wrap;
  }
  function toggleOverlay(force) {
    var wrap = ensureOverlay();
    var open = force == null ? !wrap.classList.contains('ed-help-overlay--open') : !!force;
    wrap.classList.toggle('ed-help-overlay--open', open);
  }

  var pendingG = false;
  var pendingTimer = null;

  function handleKey(e) {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key;

    // Help overlay
    if (k === '?') {
      toggleOverlay();
      e.preventDefault();
      return;
    }
    if (k === 'Escape') {
      var wrap = document.getElementById('ed-help-overlay');
      if (wrap && wrap.classList.contains('ed-help-overlay--open')) {
        toggleOverlay(false);
        e.preventDefault();
        return;
      }
    }

    // Two-key g + (d|b|c) navigation
    if (pendingG) {
      pendingG = false;
      clearTimeout(pendingTimer);
      if (k === 'd') { window.location.href = '/dashboard/'; e.preventDefault(); return; }
      if (k === 'b') { window.location.href = '/editorial/board/'; e.preventDefault(); return; }
      if (k === 'c') { window.location.href = '/editorial-calendar/'; e.preventDefault(); return; }
    }
    if (k === 'g') {
      pendingG = true;
      pendingTimer = setTimeout(function () { pendingG = false; }, 1200);
    }
  }

  document.addEventListener('keydown', handleKey);
})();
