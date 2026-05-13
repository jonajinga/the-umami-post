/**
 * Render citation formats inline inside the Reader panel's Cite tab.
 *
 * Reads #cite-data (rendered into article.njk by the article header) and
 * builds APA / MLA / Chicago entries with a copy button for each. Renders
 * into whichever Cite tab section is on the page:
 *   - #article-panel-cite-inline (article layout)
 *   - #panel-cite-inline         (library layouts)
 */
(function () {
  'use strict';

  var data = document.getElementById('cite-data');
  var slot = document.getElementById('article-panel-cite-inline')
          || document.getElementById('panel-cite-inline');
  if (!data || !slot) return;

  var info = {
    title:       data.dataset.title       || document.title,
    author:      data.dataset.author      || '',
    date:        data.dataset.date        || '',
    publication: data.dataset.publication || '',
    url:         data.dataset.url         || window.location.href
  };

  function parseName(full) {
    var parts = full.trim().split(/\s+/);
    var last = parts.pop() || '';
    return { first: parts.join(' '), last: last };
  }
  function fmtDate(iso, style) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var y = d.getUTCFullYear();
    var m = d.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
    var day = d.getUTCDate();
    if (style === 'apa')     return y + ', ' + m + ' ' + day;
    if (style === 'mla')     return day + ' ' + m + ' ' + y;
    if (style === 'chicago') return m + ' ' + day + ', ' + y;
    return String(y);
  }
  function build(format) {
    var n   = parseName(info.author);
    var url = info.url;
    var pub = info.publication;
    var t   = info.title;
    var hasAuthor = !!(n.last);
    if (format === 'apa') {
      var init = n.first ? n.first.split(/\s+/).map(function (w) { return w[0] + '.'; }).join(' ') : '';
      var auth = hasAuthor ? (n.last + (init ? ', ' + init : '') + ' ') : '';
      return auth + '(' + fmtDate(info.date, 'apa') + '). ' + t + '. ' + pub + '. ' + url;
    }
    if (format === 'mla') {
      var auth2 = hasAuthor ? (n.last + (n.first ? ', ' + n.first : '') + '. ') : '';
      return auth2 + '\u201c' + t + '.\u201d ' + pub + ', ' + fmtDate(info.date, 'mla') + ', ' + url + '.';
    }
    if (format === 'chicago') {
      var auth3 = hasAuthor ? (n.last + (n.first ? ', ' + n.first : '') + '. ') : '';
      return auth3 + '\u201c' + t + '.\u201d ' + pub + ', ' + fmtDate(info.date, 'chicago') + '. ' + url + '.';
    }
    return '';
  }

  var COPY_ICON  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  var CHECK_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';

  function copy(text, btn) {
    function done() {
      btn.innerHTML = CHECK_ICON;
      btn.classList.add('is-copied');
      setTimeout(function () {
        btn.innerHTML = COPY_ICON;
        btn.classList.remove('is-copied');
      }, 1500);
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(done);
    } else {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) {}
      document.body.removeChild(ta);
    }
  }

  function render() {
    if (slot.dataset.rendered === 'true') return;
    slot.dataset.rendered = 'true';
    slot.innerHTML = '';
    [['APA 7th', 'apa'], ['MLA 9th', 'mla'], ['Chicago 17th', 'chicago']].forEach(function (pair) {
      var wrap = document.createElement('div');
      wrap.className = 'cite-inline__entry';
      var label = document.createElement('p');
      label.className = 'cite-inline__label';
      label.textContent = pair[0];
      var text = document.createElement('p');
      text.className = 'cite-inline__text';
      text.textContent = build(pair[1]);
      var btn = document.createElement('button');
      btn.className = 'cite-inline__copy';
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Copy ' + pair[0] + ' citation');
      btn.title = 'Copy';
      btn.innerHTML = COPY_ICON;
      btn.addEventListener('click', function () { copy(text.textContent, btn); });
      wrap.appendChild(label);
      wrap.appendChild(text);
      wrap.appendChild(btn);
      slot.appendChild(wrap);
    });
  }

  // Render lazily on first activation. Watching aria-hidden on the section
  // catches every activation path (click, keyboard, programmatic).
  if (slot.getAttribute('aria-hidden') === 'false') {
    render();
  } else if (typeof MutationObserver === 'function') {
    var mo = new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        if (records[i].attributeName === 'aria-hidden' &&
            slot.getAttribute('aria-hidden') === 'false') {
          render();
          mo.disconnect();
          break;
        }
      }
    });
    mo.observe(slot, { attributes: true, attributeFilter: ['aria-hidden'] });
  }
})();
