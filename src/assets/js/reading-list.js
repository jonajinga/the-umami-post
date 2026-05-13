/**
 * Reading list — localStorage bookmark system.
 * Runs on both article pages (bookmark button) and /reading-list/ (renders saved list).
 */
(function () {
  'use strict';

  var KEY = (window.__PREFIX || 'tft') + '-reading-list';

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function save(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch (e) {}
  }

  function isSaved(url) {
    return load().some(function (item) { return item.url === url; });
  }

  function addItem(item) {
    var list = load();
    if (!list.some(function (i) { return i.url === item.url; })) {
      list.unshift(item);
      save(list);
    }
  }

  function removeItem(url) {
    save(load().filter(function (i) { return i.url !== url; }));
  }

  /* ── Bookmark button (article pages) ─────────────────────── */
  var btn = document.getElementById('bookmark-btn');
  if (btn) {
    var url   = btn.getAttribute('data-url');
    var label = btn.querySelector('.btn-label');
    var icon  = btn.querySelector('.bookmark-icon');

    function syncBtn() {
      var saved = isSaved(url);
      btn.classList.toggle('is-saved', saved);
      btn.setAttribute('aria-label', saved ? 'Remove from reading list' : 'Save to reading list');
      if (label) label.textContent = saved ? 'Saved' : 'Save';
      if (icon)  icon.style.fill = saved ? 'currentColor' : 'none';
    }

    syncBtn();

    btn.addEventListener('click', function () {
      if (isSaved(url)) {
        removeItem(url);
      } else {
        addItem({
          url:     url,
          title:   btn.getAttribute('data-title'),
          section: btn.getAttribute('data-section'),
          date:    btn.getAttribute('data-date'),
          mins:    btn.getAttribute('data-mins')
        });
      }
      syncBtn();
    });
  }

  /* ── Reading list page ────────────────────────────────────── */
  var root = document.getElementById('reading-list-root');
  if (!root) return;

  function render() {
    var list = load();
    root.innerHTML = '';

    // Search input
    var searchRow = document.createElement('div');
    searchRow.style.cssText = 'display:flex;gap:var(--space-3);margin-bottom:var(--space-4);flex-wrap:wrap;align-items:center;';
    var searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.placeholder = 'Filter by title\u2026';
    searchInput.setAttribute('aria-label', 'Filter reading list');
    searchInput.style.cssText = 'flex:1;min-width:160px;padding:var(--space-2) var(--space-3);font-family:var(--font-ui);font-size:var(--text-sm);border:1px solid var(--color-rule);border-radius:var(--radius-sm);background:var(--color-bg);color:var(--color-ink);';
    searchInput.addEventListener('input', function () {
      var q = this.value.toLowerCase();
      root.querySelectorAll('.reading-list__item').forEach(function (item) {
        var title = item.querySelector('.reading-list__title');
        item.style.display = (!q || (title && title.textContent.toLowerCase().indexOf(q) !== -1)) ? '' : 'none';
      });
    });
    searchRow.appendChild(searchInput);
    root.appendChild(searchRow);

    var actions = document.createElement('div');
    actions.style.cssText = 'display:flex;justify-content:flex-end;gap:var(--space-2);margin-bottom:var(--space-4);';

    function rlIconBtn(label, svg, handler) {
      var b = document.createElement('button');
      b.className = 'article-action-btn';
      b.type = 'button';
      b.setAttribute('aria-label', label);
      b.title = label;
      b.innerHTML = svg;
      b.addEventListener('click', handler);
      return b;
    }

    var RL_SVG = {
      upload: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
      download: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
      print: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
      trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
    };

    var importBtn = rlIconBtn('Import', RL_SVG.upload, function () {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.addEventListener('change', function () {
        var file = input.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var data = JSON.parse(reader.result);
            if (Array.isArray(data)) {
              var existing = load();
              var urls = existing.map(function (i) { return i.url; });
              data.forEach(function (item) {
                if (item.url && item.title && urls.indexOf(item.url) === -1) {
                  existing.push(item);
                }
              });
              save(existing);
              alert('Imported ' + data.length + ' items.');
              render();
            }
          } catch (e) {
            alert('Could not read file. Make sure it is a valid JSON export.');
          }
        };
        reader.readAsText(file);
      });
      input.click();
    });
    function dlFile(name, content, type) {
      var blob = new Blob([content], { type: type + ';charset=utf-8' });
      var u = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = u; a.download = name;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(u);
    }

    var exportBtn = rlIconBtn('Export', RL_SVG.download, function () {
      var old = document.getElementById('rl-export-panel');
      if (old) { old.remove(); return; }
      var panel = document.createElement('div');
      panel.id = 'rl-export-panel';
      panel.style.cssText = 'position:fixed;bottom:3.5rem;left:50%;transform:translateX(-50%);z-index:300;min-width:180px;background:var(--color-bg-alt);border:1px solid var(--color-rule-heavy);border-radius:8px;box-shadow:0 4px 24px rgba(0,0,0,.15);padding:8px 0;';
      var items = load();

      function opt(label, fn) {
        var b = document.createElement('button');
        b.style.cssText = 'display:block;width:100%;padding:6px 16px;font-family:var(--font-ui);font-size:14px;color:var(--color-ink);background:none;border:none;text-align:left;cursor:pointer;';
        b.textContent = label;
        b.onmouseover = function () { b.style.background = 'var(--color-bg-inset)'; };
        b.onmouseout = function () { b.style.background = 'none'; };
        b.addEventListener('click', function () { fn(); panel.remove(); });
        panel.appendChild(b);
      }

      opt('Plain text (.txt)', function () {
        var lines = items.map(function (i) { return i.title + '\n  ' + (i.section || '') + ' | ' + (i.url || '') + '\n'; });
        dlFile('reading-list.txt', 'Reading List\n\n' + lines.join('\n'), 'text/plain');
      });
      opt('Markdown (.md)', function () {
        var lines = items.map(function (i) { return '- [' + i.title + '](' + (i.url || '') + ')' + (i.section ? ' (' + i.section + ')' : ''); });
        dlFile('reading-list.md', '# Reading List\n\n' + lines.join('\n'), 'text/markdown');
      });
      opt('JSON (.json)', function () {
        dlFile('reading-list.json', JSON.stringify(items, null, 2), 'application/json');
      });
      opt('PDF (print)', function () { window.print(); });

      document.body.appendChild(panel);
      setTimeout(function () {
        document.addEventListener('mousedown', function closer(e) {
          if (!panel.contains(e.target)) { panel.remove(); document.removeEventListener('mousedown', closer); }
        });
      }, 100);
    });

    var clearAll = rlIconBtn('Clear all', RL_SVG.trash, function () {
      if (confirm('Remove all saved articles?')) { save([]); render(); }
    });

    if (list.length) {
      actions.appendChild(importBtn);
      actions.appendChild(exportBtn);
      actions.appendChild(clearAll);
    } else {
      actions.appendChild(importBtn);
    }
    root.appendChild(actions);

    if (!list.length) {
      var empty = document.createElement('p');
      empty.style.cssText = 'color:var(--color-ink-faint);font-style:italic;padding:var(--space-8) 0;';
      empty.innerHTML = 'No saved articles yet. On any article, click <strong>Save</strong> to add it here.';
      root.appendChild(empty);
      return;
    }

    // Cards rendered using the canonical .article-card class system —
    // matches the home page, section pages, and topic pages so the
    // reading list reads like one consistent listing surface across
    // the site rather than its own bespoke card chrome.
    var grid = document.createElement('div');
    grid.className = 'reading-list-grid';
    grid.setAttribute('role', 'list');

    function escAttr(s) {
      return String(s || '')
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
        .replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function slugify(s) {
      return String(s || '').toLowerCase().trim()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    list.forEach(function (item) {
      var li = document.createElement('article');
      li.className = 'article-card reading-list-card';
      li.setAttribute('role', 'listitem');

      var sectionSlug = slugify(item.section);
      var sectionHtml = item.section
        ? '<a href="/' + sectionSlug + '/" class="section-badge section-badge--' + sectionSlug + '">' + escAttr(item.section) + '</a>'
        : '';
      var dateHtml = item.date
        ? '<a href="/archives/#' + escAttr(item.date) + '" class="dateline"><time datetime="' + escAttr(item.date) + '">' + escAttr(item.date) + '</time></a>'
        : '';

      var listenHtml = (window.__tftAudioBar && window.__tftAudioBar.renderListenButton)
        ? window.__tftAudioBar.renderListenButton(item.url, item.title)
        : '';

      var minsHtml = item.mins
        ? '<span class="article-card__byline-item">' + escAttr(item.mins) + ' min read</span>'
        : '';

      li.innerHTML =
          '<div class="article-card__eyebrow">' + sectionHtml + dateHtml + '</div>'
        + '<a class="article-card__headline article-card__headline--md" href="' + escAttr(item.url) + '">' + escAttr(item.title) + '</a>'
        + (listenHtml ? '<div class="article-card__listen">' + listenHtml + '</div>' : '')
        + '<p class="article-card__byline">'
        +   minsHtml
        +   '<span class="article-card__byline-item"><button class="reading-list-card__remove" type="button" data-url="' + escAttr(item.url) + '" aria-label="Remove from reading list">Remove</button></span>'
        + '</p>';

      li.querySelector('.reading-list-card__remove').addEventListener('click', function () {
        removeItem(item.url);
        render();
      });

      grid.appendChild(li);
    });

    root.appendChild(grid);
  }

  render();
}());
