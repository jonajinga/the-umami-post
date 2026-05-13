/* wake-lock.js — toggle the Screen Wake Lock API on/off from any
 * element marked with `[data-wake-lock-toggle]`. The element gets
 * `aria-pressed="true"` when active and emits a visible 'is-on'
 * class for CSS styling.
 *
 * Re-acquires the lock on visibilitychange (the browser drops
 * wake locks when the tab is backgrounded). Falls back silently
 * on browsers without the API. */
(function () {
  'use strict';

  if (window.__umamiWakeLockBootstrapped) return;
  window.__umamiWakeLockBootstrapped = true;

  var wakeLock = null;
  var wanted   = false;

  function supported() {
    return 'wakeLock' in navigator && typeof navigator.wakeLock.request === 'function';
  }

  function setPressed(state) {
    document.querySelectorAll('[data-wake-lock-toggle]').forEach(function (el) {
      el.setAttribute('aria-pressed', state ? 'true' : 'false');
      el.classList.toggle('is-on', !!state);
    });
  }

  async function acquire() {
    if (!supported() || wakeLock) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', function () { wakeLock = null; });
      setPressed(true);
    } catch (e) {
      // Permission denied / not allowed in this context (e.g. iframe
      // without permissions-policy). Drop the wanted flag so we
      // don't keep retrying on every visibilitychange.
      wanted = false;
      setPressed(false);
    }
  }

  function release() {
    if (wakeLock) {
      try { wakeLock.release(); } catch (e) {}
      wakeLock = null;
    }
    setPressed(false);
  }

  function toggle() {
    if (!supported()) return;
    wanted = !wanted;
    if (wanted) acquire(); else release();
  }

  function bind() {
    document.querySelectorAll('[data-wake-lock-toggle]').forEach(function (el) {
      if (el.dataset.wakeBound === '1') return;
      el.dataset.wakeBound = '1';
      // Hide the toggle entirely on browsers without the API so we
      // don't promise a feature we can't deliver.
      if (!supported()) { el.hidden = true; return; }
      el.addEventListener('click', function (e) {
        e.preventDefault();
        toggle();
      });
    });
    setPressed(wanted && !!wakeLock);
  }

  // Re-acquire on visibility change — the browser drops wake locks
  // when the tab goes to the background. Cooking-mode runs the
  // same dance internally for ?cook=1; this keeps a manual toggle
  // alive across visibility changes too.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && wanted && !wakeLock) {
      acquire();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
  document.addEventListener('spa:contentswap', bind);

  // Expose a public API for cooking-mode.js (or anything else)
  // that needs to flip the toggle programmatically.
  window.__umamiWakeLock = {
    acquire: function () { wanted = true; return acquire(); },
    release: function () { wanted = false; release(); },
    isActive: function () { return !!wakeLock; },
    isSupported: supported
  };
})();
