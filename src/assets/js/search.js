/**
 * The Freethinking Times — Search
 * Loads Pagefind on demand (after first keystroke) and displays
 * results in a keyboard-navigable modal overlay.
 */

(function () {
  'use strict';

  let pagefind = null;
  let searchLoaded = false;
  let currentQuery = '';
  let activeSection = '';

  const modal       = document.getElementById('search-modal');
  const overlay     = document.getElementById('search-overlay');
  const input       = document.getElementById('search-input');
  const results     = document.getElementById('search-results');
  const openBtn     = document.getElementById('search-open');
  const closeBtn    = document.getElementById('search-close');
  const filterBtns  = document.querySelectorAll('.search-filter-btn');

  if (!modal || !input) return;

  // ── Load Pagefind lazily ───────────────────────────────────────
  async function loadPagefind() {
    if (searchLoaded) return;
    try {
      // Pagefind generates its bundle into /pagefind/ after build
      pagefind = await import('/pagefind/pagefind.js');
      await pagefind.options({ excerptLength: 20 });
      searchLoaded = true;
    } catch (e) {
      results.innerHTML = `<p class="search-notice">
        Search is loading the index. If this persists, the search index may not have been generated during the last build.
      </p>`;
      // Retry once after a short delay (index may still be generating)
      setTimeout(async function () {
        if (searchLoaded) return;
        try {
          pagefind = await import('/pagefind/pagefind.js');
          await pagefind.options({ excerptLength: 20 });
          searchLoaded = true;
          results.innerHTML = '';
        } catch (e2) {
          results.innerHTML = `<p class="search-notice">
            Search index not available. Run <code>npm run build</code> to generate it.
          </p>`;
        }
      }, 2000);
    }
  }

  // ── Open / Close ───────────────────────────────────────────────
  function openSearch() {
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('is-open');
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    input.focus();
    loadPagefind();
  }

  function closeSearch() {
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('is-open');
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
    input.value = '';
    results.innerHTML = '';
    currentQuery = '';
    openBtn && openBtn.focus();
  }

  // ── Section filter buttons ─────────────────────────────────────
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      activeSection = btn.getAttribute('data-filter-section') || '';
      currentQuery = ''; // force re-search
      runSearch(input.value);
    });
  });

  // ── Search ─────────────────────────────────────────────────────
  async function runSearch(query) {
    if (!searchLoaded) await loadPagefind();
    if (!searchLoaded) return;
    currentQuery = query;

    if (!query.trim() && !activeSection) {
      results.innerHTML = '';
      return;
    }

    results.innerHTML = '<p class="search-notice">Searching…</p>';

    try {
      const opts = {};
      if (activeSection) opts.filters = { section: activeSection };
      const search = await pagefind.search(query.trim() || null, opts);
      const totalCount = search.results.length;
      const pageSize = 5;
      const data = await Promise.all(search.results.slice(0, pageSize).map(r => r.data()));

      if (data.length === 0) {
        const msg = query.trim()
          ? `No results for <strong>${escapeHtml(query)}</strong>.`
          : `No results in <strong>${escapeHtml(activeSection)}</strong>.`;
        results.innerHTML = `<p class="search-notice">${msg}</p>`;
        return;
      }

      // Render up to 4 tag chips as direct flex children of
      // .search-result__meta so they always wrap horizontally and
      // never stack vertically on narrow viewports. Tags come from
      // pagefind's per-page meta capture (data-pagefind-meta="tags")
      // wired in article.njk.
      const tagChipsFor = (item) => {
        const raw = item.meta?.tags || '';
        if (!raw) return '';
        const tags = String(raw).split(',').map(t => t.trim()).filter(Boolean).slice(0, 4);
        if (!tags.length) return '';
        return tags.map(t => `<span class="search-result__tag">${t}</span>`).join('');
      };

      let html = data.map(item => `
        <a class="search-result" href="${item.url}">
          <span class="search-result__meta">
            ${item.meta?.section ? `<span class="search-result__section">${item.meta.section}</span>` : ''}
            ${tagChipsFor(item)}
          </span>
          <span class="search-result__title">${item.meta?.title || 'Untitled'}</span>
          <span class="search-result__excerpt">${item.excerpt}</span>
        </a>
      `).join('');

      // Show more button if there are additional results
      if (totalCount > pageSize) {
        html += `<div class="search-more">
          <button class="search-more__btn" type="button" id="search-show-more" data-shown="${pageSize}" data-total="${totalCount}">
            Show more (${totalCount - pageSize} remaining)
          </button>
          <a class="search-more__link" href="/search/?q=${encodeURIComponent(query.trim())}${activeSection ? '&section=' + encodeURIComponent(activeSection) : ''}">
            View all on search page →
          </a>
        </div>`;
      }

      results.innerHTML = html;

      // Bind show more button
      const moreBtn = document.getElementById('search-show-more');
      if (moreBtn) {
        moreBtn.addEventListener('click', async function () {
          const shown = parseInt(moreBtn.dataset.shown, 10);
          const nextBatch = await Promise.all(search.results.slice(shown, shown + pageSize).map(r => r.data()));
          const newShown = shown + nextBatch.length;
          const moreHtml = nextBatch.map(item => `
            <a class="search-result" href="${item.url}">
              <span class="search-result__meta">
                ${item.meta?.section ? `<span class="search-result__section">${item.meta.section}</span>` : ''}
                ${tagChipsFor(item)}
              </span>
              <span class="search-result__title">${item.meta?.title || 'Untitled'}</span>
              <span class="search-result__excerpt">${item.excerpt}</span>
            </a>
          `).join('');
          moreBtn.parentElement.insertAdjacentHTML('beforebegin', moreHtml);
          moreBtn.dataset.shown = newShown;
          if (newShown >= totalCount) {
            moreBtn.parentElement.remove();
          } else {
            moreBtn.textContent = `Show more (${totalCount - newShown} remaining)`;
          }
        });
      }
    } catch (e) {
      results.innerHTML = '<p class="search-notice">Search error. Please try again.</p>';
    }
  }

  // ── Event Listeners ────────────────────────────────────────────
  openBtn  && openBtn.addEventListener('click', openSearch);
  closeBtn && closeBtn.addEventListener('click', closeSearch);
  overlay  && overlay.addEventListener('click', closeSearch);

  input.addEventListener('input', debounce(e => {
    currentQuery = ''; // force re-search on any input change
    runSearch(e.target.value);
  }, 220));

  // Keyboard: / to open, Escape to close, arrow keys for results
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !isTypingInField()) {
      e.preventDefault();
      openSearch();
    }
    if (e.key === 'Escape' && modal.classList.contains('is-open')) {
      closeSearch();
    }
    if (e.key === 'ArrowDown' && modal.classList.contains('is-open')) {
      e.preventDefault();
      focusResult(1);
    }
    if (e.key === 'ArrowUp' && modal.classList.contains('is-open')) {
      e.preventDefault();
      focusResult(-1);
    }
  });

  // ── Helpers ────────────────────────────────────────────────────
  function focusResult(dir) {
    const items = [...results.querySelectorAll('.search-result')];
    if (!items.length) return;
    const active = document.activeElement;
    const idx    = items.indexOf(active);
    const next   = idx + dir;
    if (next < 0) { input.focus(); return; }
    if (next < items.length) items[next].focus();
  }

  function isTypingInField() {
    const tag = document.activeElement.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement.isContentEditable;
  }

  function debounce(fn, delay) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // ── Voice Search (Web Speech API) ──────────────────────────────
  const voiceBtn = document.getElementById('voice-search-btn');
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (voiceBtn && SpeechRecognition) {
    voiceBtn.hidden = false;
    let listening = false;
    let recognition = null;

    voiceBtn.addEventListener('click', function () {
      if (listening) {
        recognition.stop();
        return;
      }

      recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = function () {
        listening = true;
        voiceBtn.classList.add('is-listening');
        voiceBtn.setAttribute('aria-label', 'Stop voice search');
        input.placeholder = 'Listening…';
      };

      recognition.onresult = function (event) {
        const transcript = event.results[0][0].transcript;
        input.value = transcript;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      };

      recognition.onend = function () {
        listening = false;
        voiceBtn.classList.remove('is-listening');
        voiceBtn.setAttribute('aria-label', 'Search by voice');
        input.placeholder = 'Search articles, topics, authors…';
      };

      recognition.onerror = function (e) {
        listening = false;
        voiceBtn.classList.remove('is-listening');
        input.placeholder = 'Search articles, topics, authors…';
        if (e.error === 'not-allowed') {
          voiceBtn.hidden = true;
        }
      };

      // Open search if not already open
      if (!modal.classList.contains('is-open')) openSearch();
      recognition.start();
    });
  }

})();
