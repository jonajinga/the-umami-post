/* ============================================================
   THE FREETHINKING TIMES — Events Calendar
   Editorial-style calendar with recurrence, keyboard nav,
   hash state, and responsive views.
   ============================================================ */
(function () {
  'use strict';

  /* ── Constants ─────────────────────────────────────────────── */
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var DAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  var MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  var TYPE_COLORS = {
    conference: 'opinion', convention: 'accent', meetup: 'science',
    online: 'arts-culture', observance: 'history'
  };
  var MAX_DOTS = 4;

  /* ── State ─────────────────────────────────────────────────── */
  var rawEvents = [];
  var expanded = [];
  var state = { view: 'month', date: new Date(), filterType: '', filterRegion: '', showPast: false };
  var isMobile = function () { return window.innerWidth <= 768; };

  /* ── Helpers ───────────────────────────────────────────────── */
  function dk(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function pd(s) { return new Date(s + 'T00:00:00'); }
  function fmtDate(s) { var d = pd(s); return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(); }
  function fmtRange(e) { var s = fmtDate(e.date); if (e.endDate && e.endDate !== e.date) s += ' — ' + fmtDate(e.endDate); return s; }
  function isToday(d) { var t = new Date(); return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate(); }
  function startOfWeek(d) { var r = new Date(d); r.setDate(r.getDate() - r.getDay()); return r; }
  function typeName(t) { return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''; }
  function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  function eventOnDate(evt, d) {
    var key = dk(d);
    if (evt.date === key) return true;
    if (evt.endDate) return evt.date <= key && key <= evt.endDate;
    return false;
  }

  /* ── Recurrence Engine ─────────────────────────────────────── */
  function nthWeekday(year, month, week, day) {
    // week: 1-5 (5 = last), day: 0=Sun..6=Sat
    var first = new Date(year, month, 1);
    var firstDay = first.getDay();
    var offset = (day - firstDay + 7) % 7;
    var d = 1 + offset + (week - 1) * 7;
    if (week === 5) {
      // "last" — find the last occurrence
      var last = new Date(year, month + 1, 0).getDate();
      d = 1 + offset + 3 * 7; // start from 4th occurrence
      if (d + 7 <= last) d += 7; // if 5th fits, use it
    }
    var result = new Date(year, month, d);
    if (result.getMonth() !== month) return null; // overflowed
    return result;
  }

  function expandRecurrences(events) {
    var today = new Date();
    var rangeStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    var rangeEnd = new Date(today.getFullYear() + 1, today.getMonth() + 1, 0);
    var out = [];

    for (var i = 0; i < events.length; i++) {
      var e = events[i];
      if (!e.recurrence) {
        out.push(Object.assign({}, e, { id: 'evt-' + i + '-' + e.date, _src: i }));
        continue;
      }

      var duration = 0;
      if (e.endDate) duration = (pd(e.endDate) - pd(e.date)) / 86400000;

      if (e.recurrence === 'weekly') {
        var wd = e.recurrenceDay != null ? e.recurrenceDay : pd(e.date).getDay();
        var cur = new Date(rangeStart);
        cur.setDate(cur.getDate() + ((wd - cur.getDay() + 7) % 7));
        while (cur <= rangeEnd) {
          var key = dk(cur);
          var endKey = duration ? dk(new Date(cur.getTime() + duration * 86400000)) : null;
          out.push(Object.assign({}, e, { date: key, endDate: endKey, id: 'evt-' + i + '-' + key, _src: i, _recurring: true }));
          cur.setDate(cur.getDate() + 7);
        }
      } else if (e.recurrence === 'monthly') {
        var mw = e.recurrenceWeek || 1;
        var md = e.recurrenceDay != null ? e.recurrenceDay : 0;
        for (var m = new Date(rangeStart); m <= rangeEnd; m.setMonth(m.getMonth() + 1)) {
          var dt = nthWeekday(m.getFullYear(), m.getMonth(), mw, md);
          if (dt && dt >= rangeStart && dt <= rangeEnd) {
            var mk = dk(dt);
            var mek = duration ? dk(new Date(dt.getTime() + duration * 86400000)) : null;
            out.push(Object.assign({}, e, { date: mk, endDate: mek, id: 'evt-' + i + '-' + mk, _src: i, _recurring: true }));
          }
        }
      } else if (e.recurrence === 'annual') {
        for (var y = rangeStart.getFullYear(); y <= rangeEnd.getFullYear(); y++) {
          var ad;
          if (e.recurrenceMonth && e.recurrenceDay && !e.recurrenceWeek) {
            ad = new Date(y, e.recurrenceMonth - 1, e.recurrenceDay);
          } else if (e.recurrenceMonth && e.recurrenceWeek != null && e.recurrenceDay != null) {
            ad = nthWeekday(y, e.recurrenceMonth - 1, e.recurrenceWeek, e.recurrenceDay);
          } else {
            // No detail fields — only show the original date
            if (pd(e.date).getFullYear() === y) {
              out.push(Object.assign({}, e, { id: 'evt-' + i + '-' + e.date, _src: i }));
            }
            continue;
          }
          if (ad && ad >= rangeStart && ad <= rangeEnd) {
            var ak = dk(ad);
            var aek = duration ? dk(new Date(ad.getTime() + duration * 86400000)) : null;
            out.push(Object.assign({}, e, { date: ak, endDate: aek, id: 'evt-' + i + '-' + ak, _src: i, _recurring: true }));
          }
        }
      }
    }
    return out;
  }

  /* ── Filtering ─────────────────────────────────────────────── */
  function filteredExpanded() {
    var today = dk(new Date());
    return expanded.filter(function (e) {
      if (state.filterType && e.type !== state.filterType) return false;
      if (state.filterRegion && e.region !== state.filterRegion) return false;
      var end = e.endDate || e.date;
      if (!state.showPast && end < today) return false;
      if (state.showPast && end >= today) return false;
      return true;
    });
  }

  function eventsForDate(d) {
    return filteredExpanded().filter(function (e) { return eventOnDate(e, d); });
  }

  /* ── URL Hash State ────────────────────────────────────────── */
  function readHash() {
    var h = location.hash.slice(1);
    if (!h) return;
    var params = {};
    h.split('&').forEach(function (p) { var kv = p.split('='); if (kv.length === 2) params[kv[0]] = decodeURIComponent(kv[1]); });
    if (params.view && /^(month|week|day|list)$/.test(params.view)) state.view = params.view;
    if (params.date) {
      var parts = params.date.split('-');
      if (parts.length >= 2) state.date = new Date(+parts[0], +parts[1] - 1, parts[2] ? +parts[2] : 1);
    }
    if (params.type) state.filterType = params.type;
    if (params.region) state.filterRegion = params.region;
    if (params.past === '1') state.showPast = true;
  }

  function writeHash(push) {
    var d = state.date;
    var dateStr = state.view === 'month' || state.view === 'list'
      ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
      : dk(d);
    var parts = ['view=' + state.view, 'date=' + dateStr];
    if (state.filterType) parts.push('type=' + encodeURIComponent(state.filterType));
    if (state.filterRegion) parts.push('region=' + encodeURIComponent(state.filterRegion));
    if (state.showPast) parts.push('past=1');
    var hash = '#' + parts.join('&');
    if (push) history.pushState(null, '', hash);
    else history.replaceState(null, '', hash);
  }

  /* ── Render Dispatcher ─────────────────────────────────────── */
  function render() {
    var root = document.getElementById('cal-root');
    if (!root) return;
    var html = renderToolbar();
    var view = isMobile() && state.view === 'week' ? 'list' : state.view;

    var hasSidebar = !isMobile();
    if (hasSidebar) html += '<div class="cal-layout">' + renderLeftSidebar() + '<div class="cal-layout__main">';

    switch (view) {
      case 'month': html += renderMonth(); break;
      case 'week':  html += renderWeek(); break;
      case 'day':   html += renderDay(); break;
      case 'list':  html += renderList(); break;
    }

    if (hasSidebar) html += '</div>' + renderRightSidebar() + '</div>';

    // Legend and organizations removed — cluttered the page
    root.innerHTML = html;
    bind();
    writeHash(false);
  }

  /* ── Toolbar ───────────────────────────────────────────────── */
  function renderToolbar() {
    var title = '';
    if (state.view === 'month') title = MONTHS[state.date.getMonth()] + ' ' + state.date.getFullYear();
    else if (state.view === 'week') {
      var ws = startOfWeek(state.date), we = new Date(ws); we.setDate(we.getDate() + 6);
      title = MONTHS[ws.getMonth()] + ' ' + ws.getDate() + ' — ' + we.getDate() + ', ' + we.getFullYear();
    } else if (state.view === 'day') title = fmtDate(dk(state.date));
    else title = state.showPast ? 'Past Events' : 'Upcoming Events';

    var views = ['month', 'week', 'day', 'list'];
    if (isMobile()) views = ['month', 'day', 'list'];
    var viewBtns = views.map(function (v) {
      return '<button class="cal-seg__btn' + (state.view === v ? ' cal-seg__btn--active' : '') + '" data-view="' + v + '">' + typeName(v) + '</button>';
    }).join('');

    var types = [], regions = [];
    rawEvents.forEach(function (e) {
      if (e.type && types.indexOf(e.type) === -1) types.push(e.type);
      if (e.region && regions.indexOf(e.region) === -1) regions.push(e.region);
    });
    regions.sort();

    var typeOpts = '<option value="">All Types</option>' + types.map(function (t) {
      return '<option value="' + t + '"' + (state.filterType === t ? ' selected' : '') + '>' + typeName(t) + '</option>';
    }).join('');

    var regionOpts = '<option value="">All Regions</option>' + regions.map(function (r) {
      return '<option value="' + r + '"' + (state.filterRegion === r ? ' selected' : '') + '>' + r + '</option>';
    }).join('');

    return '<div class="cal-toolbar">' +
      '<div class="cal-toolbar__nav">' +
        '<button class="cal-nav-btn cal-nav-btn--arrow" data-nav="prev" aria-label="Previous"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>' +
        '<button class="cal-nav-btn" data-nav="today">Today</button>' +
        '<button class="cal-nav-btn cal-nav-btn--arrow" data-nav="next" aria-label="Next"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>' +
      '</div>' +
      '<div class="cal-toolbar__title">' + title + '</div>' +
      '<div class="cal-toolbar__right">' +
        '<div class="cal-seg">' + viewBtns + '</div>' +
        '<select class="cal-toolbar__select" data-filter="type" aria-label="Filter by type">' + typeOpts + '</select>' +
        '<select class="cal-toolbar__select" data-filter="region" aria-label="Filter by region">' + regionOpts + '</select>' +
        '<div class="cal-seg">' +
          '<button class="cal-seg__btn' + (!state.showPast ? ' cal-seg__btn--active' : '') + '" data-time="upcoming">Upcoming</button>' +
          '<button class="cal-seg__btn' + (state.showPast ? ' cal-seg__btn--active' : '') + '" data-time="past">Past</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ── Month View ────────────────────────────────────────────── */
  function renderMonth() {
    var y = state.date.getFullYear(), m = state.date.getMonth();
    var firstDay = new Date(y, m, 1).getDay();
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var prevDays = new Date(y, m, 0).getDate();
    var mobile = isMobile();
    var headers = mobile ? DAYS_SHORT : DAYS;

    var html = '<div class="cal-grid" role="grid" aria-label="' + MONTHS[m] + ' ' + y + '">';

    // Headers
    html += '<div role="row" style="display:contents">';
    for (var h = 0; h < 7; h++) html += '<div class="cal-grid__header" role="columnheader">' + headers[h] + '</div>';
    html += '</div>';

    // Previous month fill
    for (var p = firstDay - 1; p >= 0; p--) {
      html += '<div class="cal-grid__cell cal-grid__cell--outside" role="gridcell"><span class="cal-grid__num">' + (prevDays - p) + '</span></div>';
    }

    // Current month
    for (var d = 1; d <= daysInMonth; d++) {
      var thisDate = new Date(y, m, d);
      var key = dk(thisDate);
      var dayEvts = eventsForDate(thisDate);
      var todayCls = isToday(thisDate) ? ' cal-grid__num--today' : '';
      var hasCls = dayEvts.length ? ' cal-grid__cell--has-events' : '';

      html += '<div class="cal-grid__cell' + hasCls + '" data-date="' + key + '" role="gridcell" tabindex="-1">';
      html += '<span class="cal-grid__num' + todayCls + '">' + d + '</span>';

      if (dayEvts.length) {
        html += '<div class="cal-dots">';
        var shown = Math.min(dayEvts.length, MAX_DOTS);
        for (var di = 0; di < shown; di++) {
          html += '<span class="cal-dot cal-dot--' + (dayEvts[di].type || '') + '"></span>';
        }
        if (dayEvts.length > MAX_DOTS) html += '<span class="cal-dots__more">+' + (dayEvts.length - MAX_DOTS) + '</span>';
        html += '</div>';

        // Tooltip (desktop only)
        if (!mobile) {
          html += '<div class="cal-tip">';
          dayEvts.forEach(function (evt) {
            html += '<div class="cal-tip__item cal-tip__item--' + (evt.type || '') + '" data-evt-id="' + evt.id + '">' + esc(evt.name) + '</div>';
          });
          html += '</div>';
        }
      }
      html += '</div>';
    }

    // Next month fill
    var total = firstDay + daysInMonth;
    var remaining = (7 - total % 7) % 7;
    for (var n = 1; n <= remaining; n++) {
      html += '<div class="cal-grid__cell cal-grid__cell--outside" role="gridcell"><span class="cal-grid__num">' + n + '</span></div>';
    }

    html += '</div>';
    return html;
  }

  /* ── Week View ─────────────────────────────────────────────── */
  function renderWeek() {
    var ws = startOfWeek(state.date);
    var html = '<div class="cal-week">';
    for (var i = 0; i < 7; i++) {
      var d = new Date(ws); d.setDate(d.getDate() + i);
      var dayEvts = eventsForDate(d);
      html += '<div class="cal-week__col">';
      html += '<div class="cal-week__day-hd">' + DAYS[i] + '</div>';
      html += '<div class="cal-week__day-num">' + d.getDate() + '</div>';
      dayEvts.forEach(function (evt) {
        html += '<div class="cal-week__chip cal-week__chip--' + (evt.type || '') + '" data-evt-id="' + evt.id + '">' + esc(evt.name) + '</div>';
      });
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  /* ── Day View ──────────────────────────────────────────────── */
  function renderDay() {
    var dayEvts = eventsForDate(state.date);
    var html = '<div class="cal-list">';
    html += '<div class="cal-day-hd">' + fmtDate(dk(state.date)) + '</div>';
    if (!dayEvts.length) html += '<p class="cal-empty">No events on this date.</p>';
    else dayEvts.forEach(function (e) { html += renderCard(e); });
    html += '</div>';
    return html;
  }

  /* ── List View ─────────────────────────────────────────────── */
  function renderList() {
    var events = filteredExpanded();
    events.sort(function (a, b) { return state.showPast ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date); });
    var html = '<div class="cal-list">';
    if (!events.length) html += '<p class="cal-empty">' + (state.showPast ? 'No past events match your filters.' : 'No upcoming events match your filters.') + '</p>';
    else events.forEach(function (e) { html += renderCard(e); });
    html += '</div>';
    return html;
  }

  /* ── Event Card ────────────────────────────────────────────── */
  function renderCard(e) {
    return '<article class="cal-card cal-card--' + (e.type || '') + '" data-evt-id="' + e.id + '">' +
      '<div class="cal-card__kicker">' +
        '<span class="cal-card__type cal-card__type--' + (e.type || '') + '">' + typeName(e.type) + '</span>' +
        ' &middot; ' + fmtRange(e) +
      '</div>' +
      '<h3 class="cal-card__headline">' + esc(e.name) + '</h3>' +
      '<p class="cal-card__dek">' + esc(e.description) + '</p>' +
      '<div class="cal-card__meta">' + esc(e.location) + (e.region && e.region !== e.location ? ' &middot; ' + esc(e.region) : '') + '</div>' +
    '</article>';
  }

  /* ── Sidebar ────────────────────────────────────────────────── */
  /* ── Left Sidebar (This Month) ───────────────────────────── */
  function renderLeftSidebar() {
    var y = state.date.getFullYear(), m = state.date.getMonth();
    var monthStart = dk(new Date(y, m, 1));
    var monthEnd = dk(new Date(y, m + 1, 0));
    var monthEvts = expanded.filter(function (e) {
      return e.date >= monthStart && e.date <= monthEnd;
    });
    var typeCounts = {};
    monthEvts.forEach(function (e) {
      var t = e.type || 'other';
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    });

    var html = '<aside class="cal-sidebar cal-sidebar--left">' +
      '<div class="cal-sidebar__section">' +
      '<p class="cal-sidebar__heading">This Month</p>' +
      '<p class="cal-sidebar__stat">' + monthEvts.length + ' event' + (monthEvts.length !== 1 ? 's' : '') + '</p>';
    Object.keys(typeCounts).forEach(function (t) {
      html += '<div class="cal-sidebar__type-row">' +
        '<span class="cal-dot cal-dot--' + t + '"></span> ' +
        typeName(t) + ': ' + typeCounts[t] +
      '</div>';
    });
    html += '</div></aside>';
    return html;
  }

  /* ── Right Sidebar (Next Up) ───────────────────────────────── */
  function renderRightSidebar() {
    var today = dk(new Date());
    var upcoming = expanded.filter(function (e) {
      var end = e.endDate || e.date;
      return end >= today;
    });
    upcoming.sort(function (a, b) { return a.date.localeCompare(b.date); });
    var nextUp = upcoming.slice(0, 5);

    var html = '<aside class="cal-sidebar cal-sidebar--right">' +
      '<div class="cal-sidebar__section">' +
      '<p class="cal-sidebar__heading">Next Up</p>';
    if (!nextUp.length) {
      html += '<p class="cal-sidebar__empty">No upcoming events.</p>';
    } else {
      nextUp.forEach(function (e) {
        html += '<div class="cal-sidebar__item" data-evt-id="' + e.id + '">' +
          '<span class="cal-dot cal-dot--' + (e.type || '') + '" style="flex-shrink:0;margin-top:4px"></span>' +
          '<div>' +
            '<span class="cal-sidebar__name">' + esc(e.name) + '</span>' +
            '<span class="cal-sidebar__date">' + fmtDate(e.date) + '</span>' +
          '</div>' +
        '</div>';
      });
    }
    html += '</div></aside>';
    return html;
  }

  /* ── Organizations Directory (bottom section) ──────────────── */
  function renderOrganizations() {
    var orgMap = {};
    expanded.forEach(function (e) {
      if (e._recurring) {
        if (!orgMap[e.name]) orgMap[e.name] = { type: e.type };
      }
    });
    rawEvents.forEach(function (e) {
      if (!e.recurrence && !orgMap[e.name]) {
        orgMap[e.name] = { type: e.type };
      }
    });

    var orgNames = Object.keys(orgMap).sort();
    if (!orgNames.length) return '';

    var html = '<div class="cal-orgs">' +
      '<p class="cal-orgs__heading">Organizations & Events</p>' +
      '<div class="cal-orgs__grid">';
    orgNames.forEach(function (name) {
      var o = orgMap[name];
      html += '<div class="cal-orgs__item">' +
        '<span class="cal-dot cal-dot--' + (o.type || '') + '"></span> ' +
        esc(name) +
      '</div>';
    });
    html += '</div></div>';
    return html;
  }

  /* ── Legend ────────────────────────────────────────────────── */
  function renderLegend() {
    var types = [
      { type: 'conference', label: 'Conference' },
      { type: 'convention', label: 'Convention' },
      { type: 'meetup', label: 'Meetup' },
      { type: 'online', label: 'Online' },
      { type: 'observance', label: 'Observance' }
    ];
    return '<div class="cal-legend">' +
      types.map(function (t) {
        return '<div class="cal-legend__item"><span class="cal-legend__dot cal-legend__dot--' + t.type + '"></span>' + t.label + '</div>';
      }).join('') +
    '</div>';
  }

  /* ── Detail Panel ──────────────────────────────────────────── */
  function findEvent(id) {
    for (var i = 0; i < expanded.length; i++) { if (expanded[i].id === id) return expanded[i]; }
    return null;
  }

  function openDetail(id) {
    var evt = findEvent(id);
    if (!evt) return;
    closeDetail();

    var backdrop = document.createElement('div');
    backdrop.className = 'cal-detail-backdrop cal-detail-backdrop--open';
    backdrop.onclick = closeDetail;

    var panel = document.createElement('div');
    panel.className = 'cal-detail';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', evt.name);

    panel.innerHTML =
      '<button class="cal-detail__close" aria-label="Close" onclick="document.querySelector(\'.cal-detail-backdrop\').click()">&#10005;</button>' +
      '<p class="cal-detail__type cal-detail__type--' + (evt.type || '') + '">' + typeName(evt.type) + '</p>' +
      '<h2 class="cal-detail__name">' + esc(evt.name) + '</h2>' +
      '<p class="cal-detail__row"><strong>Date:</strong> ' + fmtRange(evt) + '</p>' +
      '<p class="cal-detail__row"><strong>Location:</strong> ' + esc(evt.location) + '</p>' +
      (evt.region ? '<p class="cal-detail__row"><strong>Region:</strong> ' + esc(evt.region) + '</p>' : '') +
      '<p class="cal-detail__desc">' + esc(evt.description) + '</p>' +
      (evt.url && evt.url !== '#' ? '<a class="cal-detail__link" href="' + esc(evt.url) + '" target="_blank" rel="noopener noreferrer">Visit website &rarr;</a>' : '') +
      (evt._recurring ? '<p class="cal-detail__recurrence">This event repeats ' + (evt.recurrence || '') + 'ly.</p>' : '');

    document.body.appendChild(backdrop);
    document.body.appendChild(panel);
    document.body.style.overflow = 'hidden';

    // Trigger transition
    requestAnimationFrame(function () { panel.classList.add('cal-detail--open'); });

    // Escape to close
    document.addEventListener('keydown', detailEsc);
  }

  function closeDetail() {
    var bd = document.querySelector('.cal-detail-backdrop');
    var p = document.querySelector('.cal-detail');
    if (bd) bd.remove();
    if (p) p.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', detailEsc);
  }

  function detailEsc(e) { if (e.key === 'Escape') closeDetail(); }

  /* ── Navigation ────────────────────────────────────────────── */
  function navigate(dir) {
    if (state.view === 'month') state.date.setMonth(state.date.getMonth() + dir);
    else if (state.view === 'week') state.date.setDate(state.date.getDate() + dir * 7);
    else if (state.view === 'day') state.date.setDate(state.date.getDate() + dir);
    else state.date.setMonth(state.date.getMonth() + dir);
  }

  /* ── Event Binding (delegation) ────────────────────────────── */
  function bind() {
    var root = document.getElementById('cal-root');
    if (!root) return;

    root.onclick = function (e) {
      var el = e.target;

      // Event detail trigger
      var evtEl = el.closest('[data-evt-id]');
      if (evtEl) { openDetail(evtEl.dataset.evtId); return; }

      // Day cell click (month view) — open day view
      var cell = el.closest('[data-date]');
      if (cell && !el.closest('.cal-tip')) {
        var parts = cell.dataset.date.split('-');
        state.date = new Date(+parts[0], +parts[1] - 1, +parts[2]);
        state.view = 'day';
        writeHash(true);
        render();
        return;
      }

      // Nav buttons
      var nav = el.closest('[data-nav]');
      if (nav) {
        if (nav.dataset.nav === 'today') state.date = new Date();
        else if (nav.dataset.nav === 'prev') navigate(-1);
        else navigate(1);
        render();
        return;
      }

      // View buttons
      var view = el.closest('[data-view]');
      if (view) {
        state.view = view.dataset.view;
        if (isMobile() && state.view === 'week') state.view = 'list';
        writeHash(true);
        render();
        return;
      }

      // Time toggle
      var time = el.closest('[data-time]');
      if (time) {
        state.showPast = time.dataset.time === 'past';
        render();
        return;
      }
    };

    // Filter selects
    root.querySelectorAll('[data-filter]').forEach(function (sel) {
      sel.onchange = function () {
        if (sel.dataset.filter === 'type') state.filterType = sel.value;
        else state.filterRegion = sel.value;
        render();
      };
    });

    // Keyboard navigation
    root.onkeydown = function (e) {
      if (state.view !== 'month') return;
      var key = e.key;
      var moved = false;

      if (key === 'ArrowLeft') { state.date.setDate(state.date.getDate() - 1); moved = true; }
      else if (key === 'ArrowRight') { state.date.setDate(state.date.getDate() + 1); moved = true; }
      else if (key === 'ArrowUp') { state.date.setDate(state.date.getDate() - 7); moved = true; }
      else if (key === 'ArrowDown') { state.date.setDate(state.date.getDate() + 7); moved = true; }
      else if (key === 'PageUp') { state.date.setMonth(state.date.getMonth() - 1); moved = true; }
      else if (key === 'PageDown') { state.date.setMonth(state.date.getMonth() + 1); moved = true; }
      else if (key === 'Enter' || key === ' ') {
        var evts = eventsForDate(state.date);
        if (evts.length === 1) openDetail(evts[0].id);
        else if (evts.length > 1) { state.view = 'day'; writeHash(true); render(); }
        e.preventDefault();
        return;
      }

      if (moved) {
        e.preventDefault();
        render();
        // Restore focus to the current date cell
        var cell = document.querySelector('[data-date="' + dk(state.date) + '"]');
        if (cell) cell.focus();
      }
    };
  }

  /* ── Touch/Swipe ───────────────────────────────────────────── */
  function initSwipe() {
    var root = document.getElementById('cal-root');
    if (!root) return;
    var startX = 0, startY = 0;
    root.addEventListener('touchstart', function (e) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    root.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - startX;
      var dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 50 && Math.abs(dy) < 30 && state.view === 'month') {
        if (dx < 0) navigate(1); else navigate(-1);
        render();
      }
    }, { passive: true });
  }

  /* ── Popstate ──────────────────────────────────────────────── */
  window.addEventListener('popstate', function () {
    readHash();
    render();
  });

  /* ── Init ──────────────────────────────────────────────────── */
  function init() {
    var dataEl = document.getElementById('cal-data');
    if (!dataEl) return;
    try { rawEvents = JSON.parse(dataEl.textContent); } catch (e) { rawEvents = []; }

    expanded = expandRecurrences(rawEvents);
    readHash();
    if (isMobile() && state.view === 'week') state.view = 'month';
    render();
    initSwipe();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
