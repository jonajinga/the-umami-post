/**
 * The Freethinking Times — Theme System
 * Handles dark/light mode with no flash on load.
 * This script MUST be inlined in <head> to prevent FOUC.
 */

(function () {
  const STORAGE_KEY = (window.__PREFIX || 'tft') + '-theme';
  const root = document.documentElement;

  function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function getStoredTheme() {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  }

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    root.classList.add('js-enabled');
  }

  // Apply theme immediately (before render)
  const stored = getStoredTheme();
  applyTheme(stored || getSystemTheme());

  // Apply background preset immediately (prevent flash)
  try {
    const bg = localStorage.getItem((window.__PREFIX || 'tft') + '-gs-bg');
    if (bg && bg !== 'default') root.setAttribute('data-gs-bg', bg);

    const gsFont = localStorage.getItem((window.__PREFIX || 'tft') + '-gs-font');
    if (gsFont && gsFont !== 'default') {
      root.setAttribute('data-gs-font', gsFont);
      // Preload web fonts
      const wf = {inter:'inter:wght@400;600;700',merriweather:'merriweather:wght@400;700',roboto:'roboto:wght@400;700',opensans:'open-sans:wght@400;600;700',baskerville:'libre-baskerville:wght@400;700',crimson:'crimson-pro:wght@400;600;700',ibmplex:'ibm-plex-serif:wght@400;600;700',literata:'literata:wght@400;600;700',atkinson:'atkinson-hyperlegible:wght@400;700'};
      if (wf[gsFont]) { const l=document.createElement('link');l.rel='stylesheet';l.href='https://fonts.bunny.net/css?family='+wf[gsFont]+'&display=swap';document.head.appendChild(l); }
    }

    // Text-size selector retired — clear any persisted value so previously
    // saved sizes don't keep overriding the typography scale.
    localStorage.removeItem((window.__PREFIX || 'tft') + '-gs-font-size');

    const gsSpacing = localStorage.getItem((window.__PREFIX || 'tft') + '-gs-spacing');
    if (gsSpacing && gsSpacing !== 'normal') {
      const map = { tight: '1.3', relaxed: '1.8' };
      if (map[gsSpacing]) root.style.lineHeight = map[gsSpacing];
    }

    const gsWordspace = localStorage.getItem((window.__PREFIX || 'tft') + '-gs-wordspace');
    if (gsWordspace && gsWordspace !== 'normal') {
      const wsMap = { wide: '0.12em', wider: '0.25em' };
      if (wsMap[gsWordspace]) root.style.wordSpacing = wsMap[gsWordspace];
    }
  } catch (e) {}

  // After DOM is ready, wire up the toggle button
  document.addEventListener('DOMContentLoaded', function () {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;

    function updateButton(theme) {
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }

    updateButton(root.getAttribute('data-theme'));

    btn.addEventListener('click', function () {
      const current = root.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem(STORAGE_KEY, next); } catch {}
      updateButton(next);
    });

    // Respond to OS theme changes if no user preference is stored
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
      if (!getStoredTheme()) {
        const theme = e.matches ? 'dark' : 'light';
        applyTheme(theme);
        updateButton(theme);
      }
    });
  });
})();
