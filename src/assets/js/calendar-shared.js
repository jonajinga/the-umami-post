/**
 * Shared calendar engine — drives both /editorial-calendar/ and
 * /reading-calendar/. Owns:
 *
 *   - data loading from #cal-articles-data (the inline JSON block
 *     emitted by the partials/calendar-data.njk include)
 *   - day / week / month / year views with prev/next + today nav
 *   - article-card rendering that mirrors partials/article-card.njk
 *     (section badge, dateline, headline, dek, listen pill, byline)
 *
 * Each page mounts the engine via window.TFTCalendar.mount({ root,
 * mode, history }) where:
 *
 *   root      - DOM element to render into
 *   mode      - "editorial" (show every article on its publish date)
 *               or "reading" (show only articles the reader has read,
 *               on the date they read them)
 *   history   - for reading mode: { url -> 'yyyy-mm-dd' } map of read
 *               dates pulled from localStorage by the page wrapper
 */
(function () {
  'use strict';

  var DAY_NAMES_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var DAY_NAMES_LONG  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var MONTH_NAMES     = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  // ── Helpers ────────────────────────────────────────────────────
  function pad2(n) { return String(n).padStart(2, '0'); }
  function isoOf(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function parseISODay(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3]);
  }
  function startOfWeek(d) {
    var x = new Date(d);
    x.setDate(x.getDate() - x.getDay()); // Sunday-start
    x.setHours(0,0,0,0);
    return x;
  }
  function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function startOfYear(d)  { return new Date(d.getFullYear(), 0, 1); }
  function addDays(d, n)   { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function addMonths(d, n) { var x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
  function addYears(d, n)  { var x = new Date(d); x.setFullYear(x.getFullYear() + n); return x; }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }
  function slugify(s) {
    return String(s || '').toLowerCase().trim()
      .replace(/&/g, '-and-')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
  function readableDate(d) {
    return DAY_NAMES_LONG[d.getDay()] + ', ' + MONTH_NAMES[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }
  function readingTimeText(words) {
    var mins = Math.max(1, Math.ceil((+words || 0) / 200));
    return mins + ' min read';
  }
  function wordCountText(words) {
    var n = +words || 0;
    return n.toLocaleString('en-US') + ' words';
  }

  // ── Article card renderer (mirrors partials/article-card.njk) ──
  function renderCard(a, opts) {
    opts = opts || {};
    var sectionKey = slugify(a.section);
    var dateObj = parseISODay(a.date);
    var dateAttr = a.date;
    var dateShort = dateObj ? (MONTH_NAMES[dateObj.getMonth()].slice(0,3) + ' ' + dateObj.getDate() + ', ' + dateObj.getFullYear()) : '';
    var html = '<article class="article-card article-card--cal">';
    html += '<div class="article-card__eyebrow">';
    if (a.section) {
      html += '<a href="/' + sectionKey + '/" class="section-badge section-badge--' + sectionKey + '">' + escapeHtml(a.section) + '</a>';
    }
    if (a.subsection && a.section) {
      html += '<a href="/' + sectionKey + '/?s=' + slugify(a.subsection) + '" class="dateline dateline--link">' + escapeHtml(a.subsection) + '</a>';
    }
    if (dateObj) {
      html += '<a href="/archives/#' + dateAttr + '" class="dateline"><time datetime="' + dateAttr + '">' + escapeHtml(dateShort) + '</time></a>';
    }
    html += '</div>';
    html += '<a class="article-card__headline article-card__headline--md" href="' + a.url + '">' + escapeHtml(a.title) + '</a>';
    if (a.description) {
      html += '<p class="article-card__dek">' + escapeHtml(a.description) + '</p>';
    }
    if (a.hasAudio && a.audioMp3) {
      // Mirror the listen-button.njk partial exactly so audio-bar.js
      // wires the click via the same [data-tft-audio-trigger] hook
      // and the button inherits the same styling as cards on the
      // home page / section indexes.
      var mins = Math.max(1, Math.ceil((+a.audioDuration || 0) / 60));
      var minLabel = mins + ' ' + (mins === 1 ? 'minute' : 'minutes');
      html += '<div class="article-card__listen">'
            + '<button type="button" class="listen-btn listen-btn--sm" '
            + 'data-tft-audio-trigger '
            + 'data-tft-audio-src="' + escapeHtml(a.audioMp3) + '" '
            + 'data-tft-audio-url="' + escapeHtml(a.url) + '" '
            + 'data-tft-audio-title="' + escapeHtml(a.title) + '" '
            + 'data-tft-audio-duration="' + (+a.audioDuration || 0) + '" '
            + 'data-umami-event="card-listen" '
            + 'aria-label="Listen to ' + escapeHtml(a.title) + ', ' + minLabel + '" '
            + 'title="Listen, ' + minLabel + '">'
            + '<span class="listen-btn__icon" aria-hidden="true">'
              + '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>'
            + '</span>'
            + '<span class="listen-btn__label">Listen</span>'
            + '<span class="listen-btn__sep" aria-hidden="true">&middot;</span>'
            + '<span class="listen-btn__time">' + mins + ' min</span>'
            + '</button></div>';
    }
    html += '<p class="article-card__byline">';
    if (a.authorName || a.author) {
      var authorSlug = slugify(a.author || a.authorName);
      html += '<span class="article-card__byline-item">By <a href="/author/' + authorSlug + '/">'
            + escapeHtml(a.authorName || a.author) + '</a></span>';
    }
    if (a.wordCount) {
      html += '<span class="article-card__byline-item">' + readingTimeText(a.wordCount) + '</span>';
      html += '<span class="article-card__byline-item">' + wordCountText(a.wordCount) + '</span>';
    }
    html += '</p>';
    html += '</article>';
    return html;
  }

  // ── List-row renderer (used by density === 'list') ────────────
  // Single-row, scan-optimised markup. Five columns: date · section ·
  // title · author · word-count. Clicking the row navigates to the
  // article. Independent from the cards renderer so the row layout
  // isn't constrained by the .article-card structure.
  function renderListRow(a, opts) {
    opts = opts || {};
    var sectionKey = slugify(a.section);
    var dateObj = parseISODay(a.date);
    var dateAttr = a.date;
    var dateShort = dateObj ? (MONTH_NAMES[dateObj.getMonth()].slice(0,3) + ' ' + dateObj.getDate()) : '';
    var html = '<a class="cal-list__row" href="' + a.url + '">';
    html += '<time class="cal-list__date" datetime="' + dateAttr + '">' + escapeHtml(dateShort) + '</time>';
    if (a.section) {
      html += '<span class="cal-list__section section-badge section-badge--' + sectionKey + '">' + escapeHtml(a.section) + '</span>';
    } else {
      html += '<span class="cal-list__section"></span>';
    }
    html += '<span class="cal-list__title">' + escapeHtml(a.title) + '</span>';
    var byline = '';
    if (a.authorName || a.author) byline = escapeHtml(a.authorName || a.author);
    html += '<span class="cal-list__author">' + byline + '</span>';
    html += '<span class="cal-list__words">'
          + (a.wordCount ? readingTimeText(a.wordCount) : '')
          + '</span>';
    html += '</a>';
    return html;
  }

  // Dispatch — emit either a card or a list row depending on density.
  function renderEntry(article, density) {
    return density === 'list' ? renderListRow(article) : renderCard(article);
  }

  // Container classlist for the entry collection (cards grid vs. list).
  function entriesContainerOpen(density, extraClass) {
    if (density === 'list') {
      return '<div class="cal-list' + (extraClass ? ' ' + extraClass : '') + '"><div class="cal-list__head" aria-hidden="true">'
        + '<span>Date</span><span>Section</span><span>Title</span><span>Author</span><span>Length</span>'
        + '</div>';
    }
    return '<div class="cal-view__cards' + (extraClass ? ' ' + extraClass : '') + '">';
  }

  // ── Index articles by date ─────────────────────────────────────
  function indexByDate(articles, history) {
    var byDate = Object.create(null);
    var counts = Object.create(null);
    articles.forEach(function (a) {
      var d = history ? history[a.url] : a.date;
      if (!d) return;
      d = String(d).slice(0, 10);
      (byDate[d] = byDate[d] || []).push({ article: a, day: d });
      counts[d] = (counts[d] || 0) + 1;
    });
    // Sort each day newest-section-first by article date desc
    Object.keys(byDate).forEach(function (k) {
      byDate[k].sort(function (a, b) { return b.article.date.localeCompare(a.article.date); });
    });
    return { byDate: byDate, counts: counts };
  }

  // ── View renderers ─────────────────────────────────────────────
  function renderDayView(state) {
    var d = state.cursor;
    var iso = isoOf(d);
    var entries = state.byDate[iso] || [];
    var dueToday = (state.deadlines || []).filter(function (dl) { return dl.dueDate === iso; });
    var html = '<header class="cal-view__header">'
             + '<h2 class="cal-view__title">' + readableDate(d) + '</h2>'
             + '<p class="cal-view__sub">' + entries.length + ' published'
             + (dueToday.length ? ' &middot; ' + dueToday.length + ' due' : '')
             + '</p>'
             + '</header>';
    if (!entries.length && !dueToday.length) {
      html += '<p class="cal-view__empty">Nothing on this day.</p>';
    } else {
      if (entries.length) {
        html += entriesContainerOpen(state.density);
        entries.forEach(function (e) { html += renderEntry(e.article, state.density); });
        html += '</div>';
      }
      if (dueToday.length) {
        html += '<h3 class="cal-view__sub" style="margin-top:1.25rem">Deadlines</h3>'
              + '<div class="cal-view__cards cal-view__cards--list">';
        dueToday.forEach(function (dl) {
          html += '<a class="cal-view__overlay-card" href="' + dl.url + '">'
                + '<span class="cal-view__overlay-pill">' + (dl.status || 'due').toUpperCase() + '</span>'
                + escapeHtml(dl.title)
                + (dl.author ? ' &middot; ' + escapeHtml(dl.author) : '')
                + '</a>';
        });
        html += '</div>';
      }
    }
    return html;
  }

  // Week view, swim-lane variant: rows are sections, columns are
  // the seven days of the week. Cells hold matching cards.
  function renderWeekSwimView(state) {
    var start = startOfWeek(state.cursor);
    var end = addDays(start, 6);
    // Collect sections present in the filtered article pool that touch
    // this week. Fall back to the full article list if no week match
    // (otherwise an empty week would render an empty grid head).
    var weekArticles = [];
    for (var i = 0; i < 7; i++) {
      var iso = isoOf(addDays(start, i));
      (state.byDate[iso] || []).forEach(function (e) { weekArticles.push(e); });
    }
    var sectionSet = new Set();
    weekArticles.forEach(function (e) { if (e.article.section) sectionSet.add(e.article.section); });
    if (!sectionSet.size) {
      (state.filtered || state.articles).forEach(function (a) { if (a.section) sectionSet.add(a.section); });
    }
    var sections = [...sectionSet].sort();

    var html = '<header class="cal-view__header">'
             + '<h2 class="cal-view__title">Week of ' + MONTH_NAMES[start.getMonth()] + ' ' + start.getDate() + ', ' + start.getFullYear() + '</h2>'
             + '<p class="cal-view__sub">' + isoOf(start) + ' to ' + isoOf(end) + ' &middot; swim-lane by section</p>'
             + '</header>';
    html += '<div class="cal-view__week--swim">';
    // Header row: empty corner + 7 day heads
    html += '<div class="cal-view__week-section-head" aria-hidden="true"></div>';
    for (var dh = 0; dh < 7; dh++) {
      var dd = addDays(start, dh);
      html += '<div class="cal-view__week-day-head">' + DAY_NAMES_SHORT[dd.getDay()] + ' ' + dd.getDate() + '</div>';
    }
    // For each section: row label + 7 cells
    sections.forEach(function (sec) {
      html += '<div class="cal-view__week-section-head">' + escapeHtml(sec) + '</div>';
      for (var dx = 0; dx < 7; dx++) {
        var dayDate = addDays(start, dx);
        var dayIso = isoOf(dayDate);
        var inCell = (state.byDate[dayIso] || []).filter(function (e) { return e.article.section === sec; });
        html += '<div class="cal-view__week-cell">';
        inCell.forEach(function (e) {
          html += '<a class="cal-view__overlay-card" href="' + e.article.url + '" style="border-style:solid;border-color:var(--color-rule);">'
                + escapeHtml(e.article.title)
                + '</a>';
        });
        html += '</div>';
      }
    });
    html += '</div>';
    return html;
  }

  function renderWeekView(state) {
    var start = startOfWeek(state.cursor);
    var end = addDays(start, 6);
    var html = '<header class="cal-view__header">'
             + '<h2 class="cal-view__title">Week of ' + MONTH_NAMES[start.getMonth()] + ' ' + start.getDate() + ', ' + start.getFullYear() + '</h2>'
             + '<p class="cal-view__sub">' + isoOf(start) + ' to ' + isoOf(end) + '</p>'
             + '</header>';
    html += '<div class="cal-view__week">';
    for (var i = 0; i < 7; i++) {
      var d = addDays(start, i);
      var iso = isoOf(d);
      var entries = state.byDate[iso] || [];
      html += '<section class="cal-view__day' + (entries.length ? ' cal-view__day--has' : '') + '">';
      html += '<header class="cal-view__day-head">'
            + '<span class="cal-view__day-name">' + DAY_NAMES_LONG[d.getDay()] + '</span>'
            + '<span class="cal-view__day-num">' + MONTH_NAMES[d.getMonth()].slice(0,3) + ' ' + d.getDate() + '</span>'
            + '<span class="cal-view__day-count">' + entries.length + '</span>'
            + '</header>';
      if (entries.length) {
        html += entriesContainerOpen(state.density);
        entries.forEach(function (e) { html += renderEntry(e.article, state.density); });
        html += '</div>';
      }
      html += '</section>';
    }
    html += '</div>';
    return html;
  }

  function renderMonthView(state) {
    var first = startOfMonth(state.cursor);
    var lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    var leading = first.getDay();
    var monthLabel = MONTH_NAMES[first.getMonth()] + ' ' + first.getFullYear();
    var todayISO = isoOf(new Date());

    // Bucket deadline overlays by date for quick lookup
    var deadlineByDay = {};
    (state.deadlines || []).forEach(function (dl) {
      if (!dl.dueDate) return;
      (deadlineByDay[dl.dueDate] = deadlineByDay[dl.dueDate] || []).push(dl);
    });

    var html = '<header class="cal-view__header">'
             + '<h2 class="cal-view__title">' + monthLabel + '</h2>'
             + '</header>';

    html += '<div class="cal-view__month-grid">'
          + '<div class="cal-view__weekdays" aria-hidden="true">'
          + DAY_NAMES_SHORT.map(function (n) { return '<span>' + n + '</span>'; }).join('')
          + '</div>'
          + '<div class="cal-view__grid" role="grid">';

    for (var p = 0; p < leading; p++) {
      html += '<div class="cal-view__cell cal-view__cell--blank" role="gridcell" aria-hidden="true"></div>';
    }
    for (var d = 1; d <= lastDay; d++) {
      var date = new Date(first.getFullYear(), first.getMonth(), d);
      var iso = isoOf(date);
      var count = (state.counts[iso] || 0);
      var has = count > 0;
      var weekday = date.getDay();
      var isWeekend = (weekday === 0 || weekday === 6);
      var isToday = iso === todayISO;
      var deadlineCount = (deadlineByDay[iso] || []).length;
      var classList = ['cal-view__cell'];
      if (has) classList.push('cal-view__cell--has');
      if (isToday) classList.push('cal-view__cell--today');
      if (isWeekend) classList.push('cal-view__cell--weekend');
      html += '<button type="button" class="' + classList.join(' ') + '" role="gridcell" data-jump-day="' + iso + '"'
            + (isToday ? ' aria-current="date"' : '')
            + '>'
            + '<span class="cal-view__cell-num">' + d + '</span>'
            + (has ? '<span class="cal-view__cell-count">' + count + '</span>' : '')
            + (deadlineCount ? '<span class="cal-view__overlay-pill" title="' + deadlineCount + ' deadline' + (deadlineCount > 1 ? 's' : '') + '">DUE ' + deadlineCount + '</span>' : '')
            + '</button>';
    }
    html += '</div></div>';

    // List all articles for the month below the grid
    var monthEntries = [];
    Object.keys(state.byDate).forEach(function (k) {
      if (k.slice(0, 7) === isoOf(first).slice(0, 7)) {
        monthEntries = monthEntries.concat(state.byDate[k]);
      }
    });
    monthEntries.sort(function (a, b) { return b.day.localeCompare(a.day); });
    if (monthEntries.length) {
      html += '<div class="cal-view__month-list"><h3 class="cal-view__month-list-title">All articles &middot; ' + monthLabel + '</h3>';
      // Force list-style for the month tail regardless of density —
      // it's already a long flat scroll, and the row layout reads
      // better than tiled cards in that context.
      html += entriesContainerOpen('list');
      monthEntries.forEach(function (e) { html += renderListRow(e.article); });
      html += '</div></div>';
    }
    return html;
  }

  function renderYearView(state) {
    var year = state.cursor.getFullYear();
    var html = '<header class="cal-view__header">'
             + '<h2 class="cal-view__title">' + year + '</h2>'
             + '</header>';
    html += '<div class="cal-view__year-grid">';
    for (var m = 0; m < 12; m++) {
      var first = new Date(year, m, 1);
      var lastDay = new Date(year, m + 1, 0).getDate();
      var leading = first.getDay();
      var monthCount = 0;
      Object.keys(state.byDate).forEach(function (k) {
        if (k.slice(0, 7) === year + '-' + pad2(m + 1)) monthCount += state.byDate[k].length;
      });
      html += '<button type="button" class="cal-view__year-month" data-jump-month="' + year + '-' + pad2(m + 1) + '-01">';
      html += '<header class="cal-view__year-month-head">'
            + '<span>' + MONTH_NAMES[m] + '</span>'
            + '<span class="cal-view__year-month-count">' + monthCount + '</span>'
            + '</header>';
      html += '<div class="cal-view__mini-grid">';
      for (var p = 0; p < leading; p++) html += '<span class="cal-view__mini cal-view__mini--blank"></span>';
      for (var d = 1; d <= lastDay; d++) {
        var iso = year + '-' + pad2(m + 1) + '-' + pad2(d);
        var c = state.counts[iso] || 0;
        var heat = c >= 5 ? 4 : c >= 3 ? 3 : c >= 2 ? 2 : c >= 1 ? 1 : 0;
        html += '<span class="cal-view__mini' + (heat ? ' cal-view__mini--heat-' + heat : '') + '" title="' + iso + ': ' + c + '"></span>';
      }
      html += '</div></button>';
    }
    html += '</div>';
    return html;
  }

  // ── URL-state contract ────────────────────────────────────────
  function readUrlState() {
    try {
      var u = new URL(window.location.href);
      return {
        view:    u.searchParams.get('view') || null,
        date:    u.searchParams.get('date') || null,
        section: u.searchParams.get('section') || '',
        author:  u.searchParams.get('author') || '',
        density: u.searchParams.get('density') || 'cards',
        swim:    u.searchParams.get('swim') === '1',
      };
    } catch (e) { return {}; }
  }
  function writeUrlState(state) {
    try {
      var u = new URL(window.location.href);
      function setParam(k, v) {
        if (v == null || v === '' || v === false || v === 'cards') u.searchParams.delete(k);
        else u.searchParams.set(k, v === true ? '1' : v);
      }
      setParam('view', state.view !== 'month' ? state.view : '');
      setParam('date', isoOf(state.cursor));
      setParam('section', state.section);
      setParam('author', state.author);
      setParam('density', state.density);
      setParam('swim', state.swim);
      window.history.replaceState({}, '', u.toString());
    } catch (e) {}
  }

  function loadDeadlines() {
    var node = document.getElementById('cal-deadline-data');
    if (!node) return [];
    try { return JSON.parse(node.textContent.trim()) || []; } catch (e) { return []; }
  }

  function recomputeIndex(state, history) {
    var pool = state.articles.filter(function (a) {
      if (state.section && a.section !== state.section) return false;
      if (state.author && a.author !== state.author) return false;
      return true;
    });
    var idx = indexByDate(pool, history || null);
    state.byDate = idx.byDate;
    state.counts = idx.counts;
    state.filtered = pool;
  }

  // ── Engine ────────────────────────────────────────────────────
  function mount(opts) {
    var root = opts.root;
    if (!root) return;
    var dataNode = document.getElementById('cal-articles-data');
    var raw = { articles: [] };
    if (dataNode) {
      try { raw = JSON.parse(dataNode.textContent.trim()); } catch (e) {}
    }
    var articles = raw.articles || [];
    var urlState = readUrlState();
    var initialView = urlState.view && /^(day|week|month|year)$/.test(urlState.view) ? urlState.view : 'month';
    var initialCursor = urlState.date ? (parseISODay(urlState.date) || new Date()) : new Date();
    var initialDensity = /^(cards|compact|list)$/.test(urlState.density) ? urlState.density : 'cards';
    // <360px viewport: 7-col calendar grid is genuinely unusable and
    // even the cards layout cramps. Default to list density unless
    // the URL explicitly overrode it. The user can still toggle back
    // via the toolbar.
    if (!urlState.density && typeof window !== 'undefined' && window.innerWidth && window.innerWidth < 360) {
      initialDensity = 'list';
    }

    if (opts.mode === 'reading') {
      var hist = opts.history || {};
      var readUrls = Object.keys(hist);
      if (!readUrls.length) {
        root.innerHTML = '<p class="cal-view__empty">'
          + 'No reading history on this device yet. Mark articles as read on the article page to populate this calendar.'
          + '</p>';
        return;
      }
      articles = articles.filter(function (a) { return hist[a.url]; });
      var state = {
        view: initialView,
        cursor: initialCursor,
        articles: articles,
        section: urlState.section || '',
        author:  urlState.author  || '',
        density: initialDensity,
        swim:    urlState.swim || false,
        deadlines: [],
        history: hist,
        mode: 'reading',
      };
      recomputeIndex(state, hist);
      attachShell(root, state, opts);
    } else {
      var state2 = {
        view: initialView,
        cursor: initialCursor,
        articles: articles,
        section: urlState.section || '',
        author:  urlState.author  || '',
        density: initialDensity,
        swim:    urlState.swim || false,
        deadlines: loadDeadlines(),
        history: null,
        mode: 'editorial',
      };
      recomputeIndex(state2);
      attachShell(root, state2, opts);
    }
  }

  function attachShell(root, state, opts) {
    function recompute() { recomputeIndex(state, state.history); }
    function nav(direction) {
      if (state.view === 'day')   state.cursor = addDays(state.cursor, direction);
      else if (state.view === 'week')  state.cursor = addDays(state.cursor, direction * 7);
      else if (state.view === 'month') state.cursor = addMonths(state.cursor, direction);
      else if (state.view === 'year')  state.cursor = addYears(state.cursor, direction);
      paint();
    }
    function setView(v) { state.view = v; paint(); }
    function jumpToday() { state.cursor = new Date(); paint(); }

    function chipListFromNode(id) {
      var node = document.getElementById(id);
      if (!node) return [];
      try { return JSON.parse(node.textContent.trim()) || []; } catch (e) { return []; }
    }

    function shellHTML(body) {
      var sections = chipListFromNode('cal-section-list');
      var authors  = chipListFromNode('cal-author-list');
      var chipsHTML = '';
      if ((sections && sections.length) || (authors && authors.length) || state.mode === 'editorial') {
        chipsHTML = '<div class="cal-view__chips" role="group" aria-label="Filter calendar">'
          + (sections.length ? sections.map(function (s) {
              return '<button type="button" class="cal-view__chip' + (state.section === s ? ' cal-view__chip--active' : '') + '" data-cal-section="' + s + '">' + s + '</button>';
            }).join('') : '')
          + (authors.length ? authors.map(function (a) {
              return '<button type="button" class="cal-view__chip' + (state.author === a ? ' cal-view__chip--active' : '') + '" data-cal-author="' + a + '">' + a + '</button>';
            }).join('') : '')
          + (state.view === 'week' ? '<button type="button" class="cal-view__chip' + (state.swim ? ' cal-view__chip--active' : '') + '" data-cal-swim="toggle">Swim by section</button>' : '')
          + '</div>';
      }
      var densityHTML = '<div class="cal-toolbar__views" role="tablist" aria-label="Density">'
        + ['cards','compact','list'].map(function (v) {
            return '<button type="button" class="cal-toolbar__view' + (state.density === v ? ' is-active' : '') + '" data-cal-density="' + v + '">' + v.charAt(0).toUpperCase() + v.slice(1) + '</button>';
          }).join('')
        + '</div>';
      return ''
        + chipsHTML
        + '<div class="cal-toolbar" role="toolbar" aria-label="Calendar navigation">'
          + '<div class="cal-toolbar__nav">'
            + '<button type="button" class="cal-toolbar__btn" data-cal-nav="prev"  aria-label="Previous (left arrow)">&larr;</button>'
            + '<button type="button" class="cal-toolbar__btn cal-toolbar__btn--today" data-cal-today aria-label="Jump to today (t)">Today</button>'
            + '<button type="button" class="cal-toolbar__btn" data-cal-nav="next"  aria-label="Next (right arrow)">&rarr;</button>'
          + '</div>'
          + '<div class="cal-toolbar__views" role="tablist">'
            + ['day','week','month','year'].map(function (v, i) {
                return '<button type="button" role="tab" class="cal-toolbar__view' + (state.view === v ? ' is-active' : '') + '" data-cal-view="' + v + '" aria-selected="' + (state.view === v) + '" title="' + v + ' (' + (i + 1) + ')">' + v.charAt(0).toUpperCase() + v.slice(1) + '</button>';
              }).join('')
          + '</div>'
          + densityHTML
        + '</div>'
        + '<div class="cal-view cal-view--' + state.view + ' cal-view--density-' + state.density + '">' + body + '</div>';
    }

    function paint() {
      recompute();
      var body = '';
      if (state.view === 'day')   body = renderDayView(state);
      else if (state.view === 'week')  body = state.swim ? renderWeekSwimView(state) : renderWeekView(state);
      else if (state.view === 'month') body = renderMonthView(state);
      else if (state.view === 'year')  body = renderYearView(state);
      root.innerHTML = shellHTML(body);
      writeUrlState(state);
    }

    paint();

    root.addEventListener('click', function (e) {
      var navBtn = e.target.closest('[data-cal-nav]');
      if (navBtn) { nav(navBtn.dataset.calNav === 'prev' ? -1 : 1); return; }
      var today = e.target.closest('[data-cal-today]');
      if (today) { jumpToday(); return; }
      var viewBtn = e.target.closest('[data-cal-view]');
      if (viewBtn) { setView(viewBtn.dataset.calView); return; }
      var densityBtn = e.target.closest('[data-cal-density]');
      if (densityBtn) { state.density = densityBtn.dataset.calDensity; paint(); return; }
      var sectionChip = e.target.closest('[data-cal-section]');
      if (sectionChip) {
        state.section = state.section === sectionChip.dataset.calSection ? '' : sectionChip.dataset.calSection;
        paint();
        return;
      }
      var authorChip = e.target.closest('[data-cal-author]');
      if (authorChip) {
        state.author = state.author === authorChip.dataset.calAuthor ? '' : authorChip.dataset.calAuthor;
        paint();
        return;
      }
      var swimChip = e.target.closest('[data-cal-swim]');
      if (swimChip) {
        state.swim = !state.swim;
        paint();
        return;
      }
      var jumpDay = e.target.closest('[data-jump-day]');
      if (jumpDay) {
        state.cursor = parseISODay(jumpDay.dataset.jumpDay);
        state.view = 'day';
        paint();
        return;
      }
      var jumpMonth = e.target.closest('[data-jump-month]');
      if (jumpMonth) {
        state.cursor = parseISODay(jumpMonth.dataset.jumpMonth);
        state.view = 'month';
        paint();
        return;
      }
    });

    // Keyboard nav — only when the calendar root is focused or a non-
    // input element is focused. Arrow keys move cursor; t = today;
    // 1-4 switch view modes.
    document.addEventListener('keydown', function (e) {
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!root.isConnected) return;
      switch (e.key) {
        case 'ArrowLeft':  nav(-1); e.preventDefault(); break;
        case 'ArrowRight': nav(1);  e.preventDefault(); break;
        case 'ArrowUp':
          if (state.view === 'month' || state.view === 'week') {
            state.cursor = addDays(state.cursor, -7);
            paint();
            e.preventDefault();
          } else if (state.view === 'year') {
            state.cursor = addMonths(state.cursor, -3);
            paint();
            e.preventDefault();
          }
          break;
        case 'ArrowDown':
          if (state.view === 'month' || state.view === 'week') {
            state.cursor = addDays(state.cursor, 7);
            paint();
            e.preventDefault();
          } else if (state.view === 'year') {
            state.cursor = addMonths(state.cursor, 3);
            paint();
            e.preventDefault();
          }
          break;
        case 't': case 'T': jumpToday(); break;
        case '1': setView('day'); break;
        case '2': setView('week'); break;
        case '3': setView('month'); break;
        case '4': setView('year'); break;
      }
    });
  }

  window.TFTCalendar = { mount: mount };

  // ── Auto-bootstrap ────────────────────────────────────────────
  // Pages just include this script and add a mount element with the
  // expected id; this block detects which kind of calendar page we're
  // on and mounts itself. Re-runs on SPA contentswap so the engine
  // doesn't depend on per-page inline scripts (which don't execute
  // when innerHTML is swapped in).
  function readLocalArr(key) {
    try { return JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { return {}; }
  }
  function buildReadingHistory() {
    var PREFIX     = (window.__PREFIX || 'tft');
    var KEY_MANUAL = PREFIX + '-read-manual';
    var KEY_PCT    = PREFIX + '-read-pct';
    var manual = readLocalArr(KEY_MANUAL);
    var pct    = readLocalArr(KEY_PCT);
    var todayISO = new Date().toISOString().slice(0, 10);
    var hist = Object.create(null);
    Object.keys(manual).forEach(function (url) {
      var rec = manual[url];
      if (!rec) return;
      hist[url] = (rec.markedAt || todayISO + 'T00:00:00').slice(0, 10);
    });
    Object.keys(pct).forEach(function (url) {
      if (hist[url]) return;
      if (pct[url] >= 95) hist[url] = todayISO;
    });
    return hist;
  }
  function paintReadingSummary(hist) {
    var summary = document.getElementById('reading-cal-summary');
    if (!summary) return;
    var urls = Object.keys(hist);
    if (!urls.length) { summary.innerHTML = ''; return; }
    var dateSet = new Set(urls.map(function (u) { return hist[u]; }));
    var monthSet = new Set([...dateSet].map(function (d) { return d.slice(0, 7); }));
    summary.innerHTML =
      '<div class="reading-cal__stat"><span class="reading-cal__stat-num">' + urls.length + '</span> articles read</div>'
    + '<div class="reading-cal__stat"><span class="reading-cal__stat-num">' + dateSet.size + '</span> reading days</div>'
    + '<div class="reading-cal__stat"><span class="reading-cal__stat-num">' + monthSet.size + '</span> months active</div>';
  }
  function bootstrap() {
    var ed = document.getElementById('ed-cal-mount');
    if (ed) {
      mount({ root: ed, mode: 'editorial' });
      return;
    }
    var rd = document.getElementById('reading-cal-mount');
    if (rd) {
      var hist = buildReadingHistory();
      paintReadingSummary(hist);
      mount({ root: rd, mode: 'reading', history: hist });
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
  document.addEventListener('spa:contentswap', bootstrap);
})();
