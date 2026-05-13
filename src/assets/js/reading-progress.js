/**
 * Per-article reading progress tracking.
 *
 * 1. On article pages (pages with an .article-body), tracks the user's scroll
 *    percentage through the article and saves it to localStorage under
 *    `{prefix}-read-pct` keyed by URL. Throttled so writes don't thrash.
 *
 * 2. On any page displaying .article-card elements, reads the stored
 *    percentages and renders a subtle progress bar on cards whose articles
 *    have been partially read (>= 5%). Articles marked "finished" (>= 95%)
 *    get a "Read" badge instead.
 */
(function () {
  'use strict';

  var PREFIX = window.__PREFIX || 'tft';
  var KEY = PREFIX + '-read-pct';

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(data) { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} }

  // ── Tracking on article pages ────────────────────────────────
  var articleBody = document.querySelector('.article-body, .library-body');
  if (articleBody && location.pathname && location.pathname !== '/') {
    var url = location.pathname;
    var lastWritten = 0;
    var lastPct = 0;

    function measure() {
      var rect = articleBody.getBoundingClientRect();
      var scrollTop = window.scrollY;
      var dist = rect.bottom + scrollTop - window.innerHeight;
      return dist > 0 ? Math.min((scrollTop / dist) * 100, 100) : 100;
    }

    function maybePersist() {
      var pct = Math.round(measure());
      // Only write if changed by 3+ points, or on reaching 100%, and throttle to once per 2s
      var now = Date.now();
      if (pct === 100 && lastPct < 100) {
        var data = load(); data[url] = 100; save(data); lastPct = 100; return;
      }
      if (Math.abs(pct - lastPct) < 3) return;
      if (now - lastWritten < 2000) return;
      var data = load();
      data[url] = pct;
      save(data);
      lastPct = pct;
      lastWritten = now;
    }

    window.addEventListener('scroll', maybePersist, { passive: true });
    window.addEventListener('beforeunload', maybePersist);
    // Initial read — the page might have restored scroll position
    setTimeout(maybePersist, 500);
  }

  // ── Display progress on article cards ────────────────────────
  var cards = document.querySelectorAll('.article-card');
  if (!cards.length) return;

  var data = load();
  var keys = Object.keys(data);
  if (!keys.length) return;

  cards.forEach(function (card) {
    // Find the first link that points to an article
    var link = card.querySelector('a[href^="/"]:not([href="/"])');
    if (!link) return;
    var href = link.getAttribute('href');
    // Normalize trailing slash
    var pct = data[href] || data[href.replace(/\/$/, '')] || data[href + '/'];
    if (!pct || pct < 5) return;

    if (pct >= 95) {
      // Completed: show a "Read" pill
      var pill = document.createElement('span');
      pill.className = 'article-card__read-pill';
      pill.textContent = 'Read';
      pill.setAttribute('aria-label', 'You have finished reading this article');
      card.appendChild(pill);
      card.classList.add('article-card--read');
    } else {
      // Partial: show a progress bar along the bottom edge of the card
      var bar = document.createElement('div');
      bar.className = 'article-card__progress';
      bar.setAttribute('aria-label', pct + '% read');
      bar.setAttribute('role', 'progressbar');
      bar.setAttribute('aria-valuenow', String(pct));
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', '100');
      var fill = document.createElement('div');
      fill.className = 'article-card__progress-fill';
      fill.style.width = pct + '%';
      bar.appendChild(fill);
      card.appendChild(bar);
      card.classList.add('article-card--in-progress');
    }
  });
})();
