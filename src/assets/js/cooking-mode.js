/* Cooking mode -- hands-free recipe view.
   - Activates on ?cook=1 in the URL or via a future toggle button.
   - Adds body.cooking-mode (CSS scales the type and hides chrome).
   - Requests a screen wake lock (Chromium / Safari 16.4+; degrades).
   - Releases on visibilitychange + when the user exits the mode. */
(function () {
  'use strict';

  var wakeLock = null;

  function isCookParam() {
    try { return new URLSearchParams(location.search).has('cook'); }
    catch (e) { return false; }
  }

  function enter() {
    if (document.body.classList.contains('cooking-mode')) return;
    document.body.classList.add('cooking-mode');
    request();
  }

  function exit() {
    document.body.classList.remove('cooking-mode');
    release();
  }

  function request() {
    if (!('wakeLock' in navigator)) return;
    navigator.wakeLock.request('screen').then(function (lock) {
      wakeLock = lock;
      lock.addEventListener('release', function () { wakeLock = null; });
    }).catch(function () { /* user denied or unsupported -- silent */ });
  }

  function release() {
    if (wakeLock) {
      try { wakeLock.release(); } catch (e) {}
      wakeLock = null;
    }
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && document.body.classList.contains('cooking-mode')) {
      request();
    } else if (document.visibilityState === 'hidden') {
      release();
    }
  });

  function init() {
    if (isCookParam() && document.querySelector('.recipe')) enter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  document.addEventListener('spa:contentswap', init);
})();
