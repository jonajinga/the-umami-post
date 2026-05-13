/**
 * Editorial Board — client-side filtering, real swim-lanes, card
 * flyout, persisted filter state (URL + localStorage), keyboard
 * shortcuts, and bulk export (Markdown / CSV).
 *
 * URL-state contract (read on load, written on every change):
 *   ?col=<lane>           — drill-through from the dashboard stat cards
 *   ?section=<label>
 *   ?author=<slug>
 *   ?stuck=1
 *   ?overdue=1
 *   ?swim=1
 *
 * localStorage key:
 *   tft-eb-filters → { section, author, stuck, overdue, swim, q }
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'tft-eb-filters';

  function init() {
    var search   = document.getElementById('eb-search');
    var sec      = document.getElementById('eb-section');
    var aut      = document.getElementById('eb-author');
    var stuckOnly  = document.getElementById('eb-stuck');
    var overdueOnly = document.getElementById('eb-overdue');
    var swimBtn  = document.getElementById('eb-swimlanes');
    var copyMd   = document.getElementById('eb-copy-md');
    var copyCsv  = document.getElementById('eb-copy-csv');
    var board    = document.getElementById('eb-board');
    var flyout   = document.getElementById('eb-flyout');
    var flyoutClose = document.getElementById('eb-flyout-close');
    if (!board || !search) return;

    var cards = Array.prototype.slice.call(document.querySelectorAll('.eb-card'));

    // ── Restore state: URL takes precedence; localStorage fallback ──
    var url = new URL(window.location.href);
    var storedRaw = null;
    try { storedRaw = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) {}
    var stored = storedRaw && typeof storedRaw === 'object' ? storedRaw : {};

    var initial = {
      q:       url.searchParams.get('q')       || stored.q       || '',
      section: url.searchParams.get('section') || stored.section || '',
      author:  url.searchParams.get('author')  || stored.author  || '',
      col:     url.searchParams.get('col')     || '',
      stuck:   url.searchParams.get('stuck') === '1' || (!url.searchParams.get('stuck') && stored.stuck) || false,
      overdue: url.searchParams.get('overdue') === '1' || (!url.searchParams.get('overdue') && stored.overdue) || false,
      swim:    url.searchParams.get('swim') === '1' || (!url.searchParams.get('swim') && stored.swim) || false,
    };

    search.value = initial.q;
    if (initial.section) sec.value = initial.section;
    if (initial.author)  aut.value = initial.author;
    stuckOnly.checked   = !!initial.stuck;
    overdueOnly.checked = !!initial.overdue;

    // If ?col= is present, scroll the board so that column is in view
    // and apply a temporary highlight so the editor lands on the right
    // surface after a drill-through from the dashboard.
    if (initial.col) {
      var target = board.querySelector('[data-col="' + initial.col + '"]');
      if (target) {
        setTimeout(function () { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
        target.style.outline = '2px solid var(--color-accent)';
        target.style.outlineOffset = '4px';
        setTimeout(function () { target.style.outline = ''; target.style.outlineOffset = ''; }, 2200);
      }
    }

    // ── State writeback (URL + localStorage) ──────────────────────
    function persist() {
      var u = new URL(window.location.href);
      function setParam(key, value) {
        if (value === '' || value == null || value === false) u.searchParams.delete(key);
        else u.searchParams.set(key, value === true ? '1' : value);
      }
      setParam('q',       search.value.trim());
      setParam('section', sec.value);
      setParam('author',  aut.value);
      setParam('stuck',   stuckOnly.checked);
      setParam('overdue', overdueOnly.checked);
      setParam('swim',    swimBtn.getAttribute('aria-pressed') === 'true');
      // Drop col= once the user starts interacting — it was a one-shot
      // drill-through marker, not persistent state.
      u.searchParams.delete('col');
      window.history.replaceState({}, '', u.toString());
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          q: search.value.trim(),
          section: sec.value,
          author: aut.value,
          stuck: stuckOnly.checked,
          overdue: overdueOnly.checked,
          swim: swimBtn.getAttribute('aria-pressed') === 'true',
        }));
      } catch (e) {}
    }

    // ── Filter visible cards ─────────────────────────────────────
    function applyFilters() {
      var q = (search.value || '').toLowerCase().trim();
      var s = sec.value;
      var a = aut.value;
      var stuck = stuckOnly.checked;
      var overdue = overdueOnly.checked;
      var counts = { pitched: 0, drafting: 0, review: 0, scheduled: 0, published: 0, spiked: 0 };

      cards.forEach(function (c) {
        var matchQ = !q || (c.dataset.search || '').indexOf(q) !== -1;
        var matchS = !s || c.dataset.section === s;
        var matchA = !a || c.dataset.authorSlug === a;
        var matchStuck   = !stuck   || (c.dataset.stuck === 'amber' || c.dataset.stuck === 'red');
        var matchOverdue = !overdue || c.dataset.overdue === 'true';
        var visible = matchQ && matchS && matchA && matchStuck && matchOverdue;
        c.style.display = visible ? '' : 'none';
        if (visible) {
          counts[c.dataset.col] = (counts[c.dataset.col] || 0) + 1;
        }
      });
      Object.keys(counts).forEach(function (k) {
        var el = document.querySelector('[data-col-count="' + k + '"]');
        if (el) el.textContent = counts[k];
      });
      persist();
      if (swimBtn.getAttribute('aria-pressed') === 'true') applySwimLanes();
    }

    search.addEventListener('input', applyFilters);
    sec.addEventListener('change', applyFilters);
    aut.addEventListener('change', applyFilters);
    stuckOnly.addEventListener('change', applyFilters);
    overdueOnly.addEventListener('change', applyFilters);

    // ── Real swim-lanes: regroup column bodies by author slug ────
    // Cache the original ordering on first toggle so we can restore.
    var originalOrder = new Map();
    cards.forEach(function (c, i) { originalOrder.set(c, { parent: c.parentElement, index: i }); });

    function applySwimLanes() {
      board.classList.add('eb-board--swim');
      document.querySelectorAll('.eb-col').forEach(function (col) {
        var body = col.querySelector('.eb-col__body');
        if (!body) return;
        var inCol = Array.prototype.slice.call(body.querySelectorAll('.eb-card'))
          .filter(function (c) { return c.style.display !== 'none'; });
        // Group by author name (display) but key by slug for stability
        var groups = new Map();
        inCol.forEach(function (c) {
          var slug = c.dataset.authorSlug || 'unattributed';
          var name = c.dataset.authorName || 'Unattributed';
          if (!groups.has(slug)) groups.set(slug, { name: name, cards: [] });
          groups.get(slug).cards.push(c);
        });
        // Remove existing lane heads if any
        body.querySelectorAll('.eb-swim-lane').forEach(function (l) {
          // unwrap cards back into body
          Array.prototype.slice.call(l.querySelectorAll('.eb-card')).forEach(function (c) { body.appendChild(c); });
          l.remove();
        });
        // Sort groups by author name
        var sortedGroups = Array.from(groups.entries()).sort(function (a, b) {
          return a[1].name.localeCompare(b[1].name);
        });
        sortedGroups.forEach(function (entry) {
          var lane = document.createElement('div');
          lane.className = 'eb-swim-lane';
          var head = document.createElement('div');
          head.className = 'eb-swim-lane__head';
          head.textContent = entry[1].name + ' · ' + entry[1].cards.length;
          lane.appendChild(head);
          entry[1].cards.forEach(function (c) { lane.appendChild(c); });
          body.appendChild(lane);
        });
        // Append empty / overflow notices last (they aren't .eb-card)
      });
    }
    function removeSwimLanes() {
      board.classList.remove('eb-board--swim');
      document.querySelectorAll('.eb-col__body').forEach(function (body) {
        body.querySelectorAll('.eb-swim-lane').forEach(function (lane) {
          Array.prototype.slice.call(lane.querySelectorAll('.eb-card')).forEach(function (c) { body.appendChild(c); });
          lane.remove();
        });
        // Restore original card order within each column body
        var inCol = Array.prototype.slice.call(body.querySelectorAll('.eb-card'));
        inCol.sort(function (a, b) {
          var ai = (originalOrder.get(a) || {}).index || 0;
          var bi = (originalOrder.get(b) || {}).index || 0;
          return ai - bi;
        });
        inCol.forEach(function (c) { body.appendChild(c); });
      });
    }

    swimBtn.addEventListener('click', function () {
      var pressed = swimBtn.getAttribute('aria-pressed') === 'true';
      var next = !pressed;
      swimBtn.setAttribute('aria-pressed', next ? 'true' : 'false');
      if (next) applySwimLanes(); else removeSwimLanes();
      persist();
    });
    if (initial.swim) {
      swimBtn.setAttribute('aria-pressed', 'true');
      applySwimLanes();
    }

    // ── Flyout ──────────────────────────────────────────────────
    function openFlyout(card) {
      if (!flyout) return;
      var d = card.dataset;
      flyout.querySelector('#eb-flyout-section').textContent = d.section || '';
      flyout.querySelector('#eb-flyout-title').textContent   = d.title || '';
      flyout.querySelector('#eb-flyout-status').textContent  = d.col || '';
      flyout.querySelector('#eb-flyout-author').textContent  = d.authorName || 'Unattributed';
      flyout.querySelector('#eb-flyout-days').textContent    = d.daysInStatus ? d.daysInStatus + 'd' : '—';
      flyout.querySelector('#eb-flyout-due').textContent     = d.dueDate || '—';
      flyout.querySelector('#eb-flyout-words').textContent   = d.wordCount ? d.wordCount + ' words' : '—';
      flyout.querySelector('#eb-flyout-editor').textContent  = d.editor || '—';
      flyout.querySelector('#eb-flyout-reviewer').textContent = d.reviewer || '—';
      flyout.querySelector('#eb-flyout-tags').textContent    = d.tags ? d.tags.split(',').filter(Boolean).join(', ') : '—';
      flyout.querySelector('#eb-flyout-spiked').textContent  = d.spikedReason || '—';
      var openA = flyout.querySelector('#eb-flyout-open');
      if (openA) openA.setAttribute('href', d.url || '#');
      var srcA = flyout.querySelector('#eb-flyout-source');
      if (srcA && d.url) {
        // /section/slug/ → src/content/section/slug.md (best-effort link)
        var parts = d.url.replace(/^\/|\/$/g, '').split('/');
        if (parts.length === 2) {
          srcA.setAttribute('href', 'https://github.com/jonajinga/the-freethinking-times/blob/main/src/content/' + parts[0] + '/' + parts[1] + '.md');
        } else {
          srcA.style.display = 'none';
        }
      }
      flyout.classList.add('is-open');
      flyout.setAttribute('aria-hidden', 'false');
      if (flyoutClose) flyoutClose.focus();
    }
    function closeFlyout() {
      if (!flyout) return;
      flyout.classList.remove('is-open');
      flyout.setAttribute('aria-hidden', 'true');
    }
    board.addEventListener('click', function (e) {
      var card = e.target.closest('.eb-card');
      if (!card) return;
      // Allow internal links to behave normally (none in card markup)
      e.preventDefault();
      openFlyout(card);
    });
    if (flyoutClose) flyoutClose.addEventListener('click', closeFlyout);
    document.addEventListener('click', function (e) {
      if (!flyout || !flyout.classList.contains('is-open')) return;
      if (flyout.contains(e.target)) return;
      if (e.target.closest('.eb-card')) return;
      closeFlyout();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && flyout && flyout.classList.contains('is-open')) {
        closeFlyout();
      }
    });

    // ── Bulk export (Markdown table + CSV) ──────────────────────
    function visibleRows() {
      return cards
        .filter(function (c) { return c.style.display !== 'none'; })
        .map(function (c) {
          var d = c.dataset;
          return {
            col: d.col,
            section: d.section,
            title: d.title,
            author: d.authorName,
            days: d.daysInStatus,
            due: d.dueDate,
            words: d.wordCount,
            url: d.url,
          };
        });
    }
    function copyToClipboard(text) {
      try {
        navigator.clipboard.writeText(text);
      } catch (e) {
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (err) {}
        document.body.removeChild(ta);
      }
    }
    if (copyMd) {
      copyMd.addEventListener('click', function () {
        var rows = visibleRows();
        var header = '| Status | Section | Title | Author | Days | Due | Words |\n|---|---|---|---|---|---|---|';
        var body = rows.map(function (r) {
          return '| ' + (r.col || '') + ' | ' + (r.section || '') + ' | [' + (r.title || '').replace(/\|/g, '\\|') + '](' + (r.url || '') + ') | ' + (r.author || '') + ' | ' + (r.days || '') + ' | ' + (r.due || '') + ' | ' + (r.words || '') + ' |';
        }).join('\n');
        copyToClipboard(header + '\n' + body);
        var orig = copyMd.textContent;
        copyMd.textContent = 'Copied ' + rows.length;
        setTimeout(function () { copyMd.textContent = orig; }, 1500);
      });
    }
    if (copyCsv) {
      copyCsv.addEventListener('click', function () {
        var rows = visibleRows();
        function esc(v) {
          var s = String(v == null ? '' : v);
          if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
          return s;
        }
        var lines = [['Status','Section','Title','Author','Days','Due','Words','URL'].join(',')]
          .concat(rows.map(function (r) {
            return [r.col, r.section, r.title, r.author, r.days, r.due, r.words, r.url].map(esc).join(',');
          }));
        var blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'editorial-board-' + new Date().toISOString().slice(0, 10) + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
      });
    }

    // ── Keyboard shortcuts (board-only) ─────────────────────────
    document.addEventListener('keydown', function (e) {
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') { e.preventDefault(); search.focus(); search.select(); return; }
      if (e.key === 's') { stuckOnly.checked = !stuckOnly.checked; applyFilters(); return; }
      if (e.key === 'o') { overdueOnly.checked = !overdueOnly.checked; applyFilters(); return; }
      if (e.key === 'Escape') {
        if (flyout && flyout.classList.contains('is-open')) return; // handled elsewhere
        search.value = '';
        sec.value = '';
        aut.value = '';
        stuckOnly.checked = false;
        overdueOnly.checked = false;
        applyFilters();
      }
    });

    applyFilters();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  document.addEventListener('spa:contentswap', init);
})();
