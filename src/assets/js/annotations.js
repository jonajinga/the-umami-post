/**
 * Article Annotations — highlights, notes, and bookmarks for article pages.
 * Adapted from the library reader system.
 * Stores data in localStorage keyed by page URL slug.
 */
(function () {
  'use strict';

  var _p = window.__PREFIX || 'umami';

  // Only run on article pages (check for the context element)
  var ctx = document.getElementById('annotations-context');
  if (!ctx) return;

  var pageSlug = ctx.dataset.pageSlug || '';
  if (!pageSlug) return;

  var pageUrl   = ctx.dataset.pageUrl || '';
  var pageTitle = ctx.dataset.pageTitle || '';

  // Save page metadata so the /notes/ page can link back
  try {
    localStorage.setItem(_p + '-art-meta-' + pageSlug, JSON.stringify({ url: pageUrl, title: pageTitle }));
  } catch (e) {}

  // ─── Storage helpers ──────────────────────────────────────
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Mini markdown → HTML (bold, italic, code, links, lists, blockquotes)
  function parseMd(str) {
    if (!str) return '';
    var s = escHtml(str);
    // Code blocks (``` ... ```)
    s = s.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    // Inline code
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic
    s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Links [text](url)
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    // Blockquotes (> text)
    s = s.replace(/^&gt;\s?(.+)$/gm, '<blockquote>$1</blockquote>');
    // Unordered list items (- text)
    s = s.replace(/^-\s+(.+)$/gm, '<li>$1</li>');
    s = s.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    // Line breaks
    s = s.replace(/\n/g, '<br>');
    // Clean up br inside block elements
    s = s.replace(/<br><(ul|blockquote|pre)/g, '<$1');
    s = s.replace(/<\/(ul|blockquote|pre)><br>/g, '</$1>');
    return s;
  }

  // Note editor modal (replaces prompt())
  // Sanitize HTML from contenteditable (strip scripts, event handlers)
  function sanitizeHtml(html) {
    var div = document.createElement('div');
    div.innerHTML = html;
    div.querySelectorAll('script,style,iframe,object,embed').forEach(function (el) { el.remove(); });
    div.querySelectorAll('*').forEach(function (el) {
      Array.from(el.attributes).forEach(function (attr) {
        if (attr.name.startsWith('on')) el.removeAttribute(attr.name);
      });
    });
    return div.innerHTML;
  }

  function openNoteEditor(initialText, callback) {
    var existing = document.getElementById('ann-note-editor');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'ann-note-editor';
    overlay.className = 'ann-note-overlay';

    var modal = document.createElement('div');
    modal.className = 'ann-note-modal';
    modal.innerHTML =
      '<div class="ann-note-modal__header">' +
        '<span style="font-family:var(--font-ui);font-size:var(--text-sm);font-weight:700;">Note</span>' +
      '</div>' +
      '<div class="ann-note-toolbar">' +
        '<button type="button" data-cmd="bold" title="Bold"><strong>B</strong></button>' +
        '<button type="button" data-cmd="italic" title="Italic"><em>I</em></button>' +
        '<button type="button" data-cmd="insertUnorderedList" title="List">&#8226;</button>' +
        '<button type="button" data-cmd="formatBlock" data-val="blockquote" title="Quote">&ldquo;</button>' +
        '<button type="button" data-cmd="createLink" title="Link">&#128279;</button>' +
      '</div>' +
      '<div class="ann-note-editable" contenteditable="true" role="textbox" aria-multiline="true"></div>' +
      '<div class="ann-note-modal__footer">' +
        '<button type="button" class="ann-note-btn ann-note-btn--cancel">Cancel</button>' +
        '<button type="button" class="ann-note-btn ann-note-btn--save">Save</button>' +
      '</div>';

    var editor = modal.querySelector('.ann-note-editable');

    // Toolbar: execCommand for WYSIWYG formatting
    modal.querySelectorAll('[data-cmd]').forEach(function (btn) {
      btn.addEventListener('mousedown', function (e) { e.preventDefault(); }); // keep focus in editor
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        editor.focus();
        var cmd = btn.dataset.cmd;
        if (cmd === 'createLink') {
          var url = prompt('Link URL:');
          if (url) document.execCommand('createLink', false, url);
        } else if (btn.dataset.val) {
          document.execCommand(cmd, false, btn.dataset.val);
        } else {
          document.execCommand(cmd, false, null);
        }
      });
    });

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Load initial content (support both HTML and plain text from old notes)
    if (initialText) {
      if (initialText.indexOf('<') !== -1) {
        editor.innerHTML = initialText;
      } else {
        editor.innerHTML = parseMd(initialText);
      }
    }
    setTimeout(function () { editor.focus(); }, 50);

    modal.querySelector('.ann-note-btn--save').addEventListener('click', function () {
      var html = sanitizeHtml(editor.innerHTML).trim();
      // Convert empty editor to empty string
      if (html === '<br>' || html === '<div><br></div>') html = '';
      callback(html);
      overlay.remove();
    });
    modal.querySelector('.ann-note-btn--cancel').addEventListener('click', function () {
      overlay.remove();
    });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });
    document.addEventListener('keydown', function escClose(e) {
      if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escClose); }
    });
  }

  function fmtDate(ts) {
    if (!ts) return '';
    try { return new Date(ts).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }); }
    catch (e) { return ''; }
  }

  // ─── Bookmarks ────────────────────────────────────────────
  var Bookmarks = (function () {
    var KEY = _p + '-art-bookmarks-' + pageSlug;

    function load() {
      try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
      catch (e) { return []; }
    }

    function save(list) {
      try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
      if (window.__refreshReaderPanel) window.__refreshReaderPanel();
    }

    function add(scrollPct, context, bodyOffset, section) {
      var list = load();
      // Skip if a bookmark already exists at this spot. Two bookmarks
      // count as the same location when their scroll positions are
      // within 2 percentage points OR their pixel body offsets are
      // within 60px (covers thumb-jitter and accidental double-taps
      // without merging genuinely adjacent paragraphs).
      var newOffset = bodyOffset != null ? bodyOffset : -1;
      for (var i = 0; i < list.length; i++) {
        var b = list[i];
        var pctClose = Math.abs((b.scrollPct || 0) - scrollPct) < 2;
        var offsetClose = newOffset >= 0 && b.bodyOffset >= 0 && Math.abs(b.bodyOffset - newOffset) < 60;
        if (pctClose || offsetClose) return b.id;
      }
      var id = 'bm-' + Date.now();
      list.push({ id: id, scrollPct: scrollPct, bodyOffset: newOffset, context: context || '', section: section || '', ts: Date.now() });
      save(list);
      return id;
    }

    function remove(id) {
      save(load().filter(function (b) { return b.id !== id; }));
    }

    function render(containerEl, onJump, onChange) {
      var list = load();
      containerEl.innerHTML = '';
      if (!list.length) {
        containerEl.innerHTML =
          '<div class="library-panel__empty">' +
            '<span class="library-panel__empty-title">No bookmarks yet</span>' +
            'Save the spot you\'re reading so you can jump back later.' +
            '<span class="library-panel__empty-hint">Tap the location-pin icon in the toolbar below to bookmark this spot.</span>' +
          '</div>';
        return;
      }
      var ul = document.createElement('div');
      ul.className = 'library-bookmark-list';
      list.sort(function (a, b) { return b.ts - a.ts; }).forEach(function (bm) {
        var item = document.createElement('div');
        item.className = 'library-bookmark-item';
        var contextHtml = bm.context
          ? '<span class="library-bookmark-item__chapter">&ldquo;' + escHtml(bm.context) + '&rdquo;</span>'
          : '';
        item.innerHTML =
          (bm.section ? '<span style="font-family:var(--font-ui);font-size:10px;color:var(--color-ink-faint);text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:2px;">' + escHtml(bm.section) + '</span>' : '') +
          contextHtml +
          '<span class="library-bookmark-item__pos">' + bm.scrollPct + '% through</span>' +
          '<span style="font-size:var(--text-xs);color:var(--color-ink-faint);">' + fmtDate(bm.ts) + '</span>' +
          '<button class="library-bookmark-item__delete" data-bm-id="' + escHtml(bm.id) + '" aria-label="Delete bookmark">Remove</button>';
        item.addEventListener('click', function (e) {
          if (e.target.dataset.bmId) {
            remove(e.target.dataset.bmId);
            render(containerEl, onJump, onChange);
            if (onChange) onChange();
          } else if (onJump) {
            onJump(bm);
          }
        });
        ul.appendChild(item);
      });
      containerEl.appendChild(ul);
    }

    return { add: add, remove: remove, render: render, loadAll: load };
  }());

  // ─── Annotations ──────────────────────────────────────────
  var Annotations = (function () {
    var KEY = _p + '-art-annotations-' + pageSlug;

    function load() {
      try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
      catch (e) { return []; }
    }

    function save(list) {
      try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
      if (window.__refreshReaderPanel) window.__refreshReaderPanel();
    }

    function add(quote, note, section, color) {
      var list = load();
      var id = 'ann-' + Date.now();
      var entry = { id: id, quote: quote, note: note || '', section: section || '', ts: Date.now() };
      if (color && color !== 'yellow') entry.color = color;
      list.push(entry);
      save(list);
      return id;
    }

    function remove(id) {
      save(load().filter(function (a) { return a.id !== id; }));
    }

    function updateNote(id, note) {
      var list = load();
      var ann = list.find(function (a) { return a.id === id; });
      if (ann) { ann.note = note; ann.modified = Date.now(); save(list); }
    }

    function render(containerEl) {
      var list = load();
      containerEl.innerHTML = '';
      if (!list.length) {
        containerEl.innerHTML =
          '<div class="library-panel__empty">' +
            '<span class="library-panel__empty-title">Nothing highlighted yet</span>' +
            'Select any passage in the article; the floating toolbar gives you a highlighter and a note button.' +
            '<span class="library-panel__empty-hint">Everything stays in this browser. Nothing is synced.</span>' +
          '</div>';
        return;
      }
      var wrapper = document.createElement('div');
      wrapper.className = 'library-annotation-list';
      list.sort(function (a, b) { return b.ts - a.ts; }).forEach(function (ann) {
        var item = document.createElement('div');
        item.className = 'library-annotation-item';
        item.className = 'library-annotation-item';
        item.dataset.annId = ann.id;
        item.innerHTML =
          '<p class="library-annotation-item__quote" style="cursor:pointer;" title="Click to scroll to highlight">&ldquo;' + escHtml(ann.quote) + '&rdquo;</p>' +
          (ann.note ? '<div class="library-annotation-item__note">' + (ann.note.indexOf('<') !== -1 ? sanitizeHtml(ann.note) : parseMd(ann.note)) + '</div>' : '') +
          '<div class="library-annotation-item__meta">' + fmtDate(ann.ts) + '</div>' +
          '<div class="library-annotation-item__actions">' +
            '<button class="library-annotation-item__action" data-ann-copy title="Copy text">Copy</button>' +
            '<button class="library-annotation-item__action" data-ann-share title="Share">Share</button>' +
            '<button class="library-annotation-item__action" data-ann-delete="' + escHtml(ann.id) + '">Delete</button>' +
          '</div>';
        // Click quote to scroll to highlight in article
        item.querySelector('.library-annotation-item__quote').addEventListener('click', function () {
          var mark = document.querySelector('.library-highlight[data-ann-id="' + ann.id + '"]');
          if (mark) {
            var top = mark.getBoundingClientRect().top + window.scrollY - 100;
            window.scrollTo({ top: top, behavior: 'smooth' });
            mark.style.transition = 'background 0.3s';
            mark.style.background = 'var(--color-accent)';
            mark.style.color = '#fff';
            setTimeout(function () { mark.style.background = ''; mark.style.color = ''; }, 1500);
          }
        });
        // Copy
        item.querySelector('[data-ann-copy]').addEventListener('click', function () {
          var text = '"' + ann.quote + '"' + (ann.note ? '\n\nNote: ' + ann.note : '');
          navigator.clipboard.writeText(text).then(function () {
            item.querySelector('[data-ann-copy]').textContent = 'Copied!';
            setTimeout(function () { item.querySelector('[data-ann-copy]').textContent = 'Copy'; }, 1500);
          });
        });
        // Share
        item.querySelector('[data-ann-share]').addEventListener('click', function () {
          var text = '"' + ann.quote + '"' + (ann.note ? ' — Note: ' + ann.note : '') + '\n\nFrom: ' + pageTitle + '\n' + location.origin + pageUrl;
          if (navigator.share) {
            navigator.share({ text: text }).catch(function () {});
          } else {
            navigator.clipboard.writeText(text).then(function () {
              item.querySelector('[data-ann-share]').textContent = 'Link copied!';
              setTimeout(function () { item.querySelector('[data-ann-share]').textContent = 'Share'; }, 1500);
            });
          }
        });
        // Delete
        item.querySelector('[data-ann-delete]').addEventListener('click', function () {
          remove(ann.id);
          render(containerEl);
          restoreHighlights(document.querySelector('.article-body'));
        });
        wrapper.appendChild(item);
      });
      containerEl.appendChild(wrapper);
    }

    function restoreHighlights(bodyEl) {
      if (!bodyEl) return;
      // Remove existing highlights first
      bodyEl.querySelectorAll('.library-highlight').forEach(function (mark) {
        var parent = mark.parentNode;
        parent.replaceChild(document.createTextNode(mark.textContent), mark);
        parent.normalize();
      });
      // Re-apply all saved annotations
      var list = load();
      list.forEach(function (ann) {
        try { highlightTextInEl(bodyEl, ann.quote, ann.id, !!ann.note, ann.color); }
        catch (e) {}
      });
    }

    function highlightTextInEl(el, text, annId, hasNote, color) {
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
      var node;
      while ((node = walker.nextNode())) {
        var idx = node.nodeValue.indexOf(text);
        if (idx !== -1) {
          var before = document.createTextNode(node.nodeValue.slice(0, idx));
          var mark = document.createElement('mark');
          var cls = 'library-highlight' + (hasNote ? ' library-highlight--note' : '');
          if (color && color !== 'yellow') cls += ' library-highlight--' + color;
          mark.className = cls;
          mark.dataset.annId = annId;
          mark.textContent = text;
          mark.style.cursor = 'pointer';
          mark.title = 'Click to view in reader panel';
          mark.addEventListener('click', function () {
            if (window.__openReaderPanel) window.__openReaderPanel();
            setTimeout(function () {
              // Switch to the right tab (notes or highlights)
              var targetTab = hasNote ? 'article-panel-notes' : 'article-panel-highlights';
              var tab = document.querySelector('[data-target="' + targetTab + '"]') ||
                        document.querySelector('[data-target="' + (hasNote ? 'panel-notes' : 'panel-highlights') + '"]');
              if (tab) tab.click();
              // Find the matching item
              var panelItem = document.querySelector('.library-annotation-item[data-ann-id="' + annId + '"]');
              if (panelItem) {
                panelItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                panelItem.style.transition = 'background 0.3s';
                panelItem.style.background = 'var(--color-bg-inset)';
                setTimeout(function () { panelItem.style.background = ''; }, 1500);
              }
            }, 150);
          });
          var after = document.createTextNode(node.nodeValue.slice(idx + text.length));
          var parent = node.parentNode;
          parent.insertBefore(before, node);
          parent.insertBefore(mark, node);
          parent.insertBefore(after, node);
          parent.removeChild(node);
          break;
        }
      }
    }

    function renderFiltered(containerEl, filterFn, emptyMsg) {
      var list = load().filter(filterFn);
      containerEl.innerHTML = '';
      if (!list.length) {
        containerEl.innerHTML = '<div class="library-panel__empty">' + emptyMsg + '</div>';
        return;
      }
      var wrapper = document.createElement('div');
      wrapper.className = 'library-annotation-list';
      list.sort(function (a, b) { return b.ts - a.ts; }).forEach(function (ann) {
        var item = document.createElement('div');
        item.className = 'library-annotation-item';
        item.dataset.annId = ann.id;
        item.style.cursor = 'pointer';

        var dateStr = fmtDate(ann.ts);
        var modStr = ann.modified ? ' (edited ' + fmtDate(ann.modified) + ')' : '';

        item.innerHTML =
          (ann.section ? '<p style="font-family:var(--font-ui);font-size:10px;color:var(--color-ink-faint);text-transform:uppercase;letter-spacing:0.06em;margin:0 0 var(--space-1);">' + escHtml(ann.section) + '</p>' : '') +
          '<p class="library-annotation-item__quote">&ldquo;' + escHtml(ann.quote) + '&rdquo;</p>' +
          (ann.note ? '<div class="library-annotation-item__note">' + (ann.note.indexOf('<') !== -1 ? sanitizeHtml(ann.note) : parseMd(ann.note)) + '</div>' : '') +
          '<p style="font-size:var(--text-xs);color:var(--color-ink-faint);margin:var(--space-1) 0 0;">' + dateStr + modStr + '</p>' +
          '<div class="library-annotation-item__actions">' +
            '<button class="library-annotation-item__action" data-ann-copy>Copy</button>' +
            '<button class="library-annotation-item__action" data-ann-share>Share</button>' +
            (ann.note ? '<button class="library-annotation-item__action" data-ann-edit="' + escHtml(ann.id) + '">Edit</button>' : '') +
            '<button class="library-annotation-item__action" data-ann-delete="' + escHtml(ann.id) + '">Delete</button>' +
          '</div>';

        // Click quote to scroll to highlight
        item.querySelector('.library-annotation-item__quote').addEventListener('click', function () {
          var mark = document.querySelector('.library-highlight[data-ann-id="' + ann.id + '"]');
          if (mark) {
            mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
            mark.style.outline = '2px solid var(--color-link)';
            setTimeout(function () { mark.style.outline = ''; }, 2000);
          }
        });

        // Copy
        item.querySelector('[data-ann-copy]').addEventListener('click', function (e) {
          e.stopPropagation();
          var text = '"' + ann.quote + '"' + (ann.note ? '\nNote: ' + ann.note : '');
          navigator.clipboard.writeText(text).then(function () {
            e.target.textContent = 'Copied!';
            setTimeout(function () { e.target.textContent = 'Copy'; }, 1500);
          });
        });
        // Share
        item.querySelector('[data-ann-share]').addEventListener('click', function (e) {
          e.stopPropagation();
          var text = '"' + ann.quote + '"' + (ann.note ? ' — Note: ' + ann.note : '') + '\n\nFrom: ' + pageTitle + '\n' + location.origin + pageUrl;
          if (navigator.share) {
            navigator.share({ text: text }).catch(function () {});
          } else {
            navigator.clipboard.writeText(text).then(function () {
              e.target.textContent = 'Copied!';
              setTimeout(function () { e.target.textContent = 'Share'; }, 1500);
            });
          }
        });

        var editBtn = item.querySelector('[data-ann-edit]');
        if (editBtn) {
          editBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            openNoteEditor(ann.note || '', function (newNote) {
              updateNote(ann.id, newNote);
              renderFiltered(containerEl, filterFn, emptyMsg);
            });
          });
        }

        item.querySelector('[data-ann-delete]').addEventListener('click', function (e) {
          e.stopPropagation();
          remove(ann.id);
          renderFiltered(containerEl, filterFn, emptyMsg);
          restoreHighlights(document.querySelector('.article-body'));
        });
        wrapper.appendChild(item);
      });
      containerEl.appendChild(wrapper);
    }

    function renderHighlights(containerEl) {
      renderFiltered(containerEl, function (a) { return !a.note; },
        '<span class="library-panel__empty-title">No highlights yet</span>' +
        'Select a passage and click the highlighter in the pop-up toolbar to mark it.' +
        '<span class="library-panel__empty-hint">Highlights appear here with the quoted text and a link back to the passage.</span>');
    }

    function renderNotes(containerEl) {
      renderFiltered(containerEl, function (a) { return !!a.note; },
        '<span class="library-panel__empty-title">No notes yet</span>' +
        'Select a passage and click the note icon to attach a thought, reference, or rebuttal.' +
        '<span class="library-panel__empty-hint">Notes are stored in your browser; export them any time from the Export tab.</span>');
    }

    return { add: add, remove: remove, load: load, render: render, renderHighlights: renderHighlights, renderNotes: renderNotes, restoreHighlights: restoreHighlights };
  }());

  // ─── Init ─────────────────────────────────────────────────
  function initAnnotations() {

    // ── Panel ──
    var panelToggles = document.querySelectorAll('.article-notes-toggle, .library-panel-toggle');
    var panel        = document.getElementById('article-notes-panel') || document.getElementById('library-panel');
    var panelOverlay = document.querySelector('.article-notes-overlay');
    var panelClose   = panel ? panel.querySelector('.library-panel__close') : null;
    var panelTitle   = panel ? panel.querySelector('.library-panel__title') : null;

    var PANEL_KEY = (window.__PREFIX || 'umami') + '-reader-panel';

    // Shrink the panel title font-size until the full text fits on <= 3
    // lines without truncation. Long article headlines used to hit the
    // 2-line clamp and show an ellipsis; now they just scale down.
    function fitPanelTitle() {
      if (!panelTitle) return;
      panelTitle.style.fontSize = '';
      var max = 17.92; // 1.12rem at 16-px root
      var min = 11.52; // 0.72rem
      var fs = max;
      var maxHeight = Math.ceil(fs * 1.2) * 3 + 1;
      panelTitle.style.fontSize = fs + 'px';
      while (panelTitle.scrollHeight > maxHeight && fs > min) {
        fs -= 0.5;
        panelTitle.style.fontSize = fs + 'px';
        maxHeight = Math.ceil(fs * 1.2) * 3 + 1;
      }
    }

    // Inject left / right scroll chevrons for the tab strip so readers on
    // narrow viewports can discover more tabs. Arrows auto-hide when the
    // strip can't scroll any further in a given direction.
    var tabsEl = panel ? panel.querySelector('.library-panel__tabs') : null;
    function installTabScrollArrows() {
      if (!tabsEl || tabsEl.__arrowsInstalled) return;
      tabsEl.__arrowsInstalled = true;
      var wrap = document.createElement('div');
      wrap.className = 'library-panel__tabs-wrap';
      tabsEl.parentNode.insertBefore(wrap, tabsEl);
      wrap.appendChild(tabsEl);

      var leftBtn = document.createElement('button');
      leftBtn.type = 'button';
      leftBtn.className = 'library-panel__tabs-arrow library-panel__tabs-arrow--left';
      leftBtn.setAttribute('aria-label', 'Scroll tabs left');
      leftBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>';

      var rightBtn = document.createElement('button');
      rightBtn.type = 'button';
      rightBtn.className = 'library-panel__tabs-arrow library-panel__tabs-arrow--right';
      rightBtn.setAttribute('aria-label', 'Scroll tabs right');
      rightBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>';

      wrap.appendChild(leftBtn);
      wrap.appendChild(rightBtn);

      function updateArrows() {
        var max = tabsEl.scrollWidth - tabsEl.clientWidth - 1;
        var sl = tabsEl.scrollLeft;
        leftBtn.hidden = sl <= 1 || max <= 0;
        rightBtn.hidden = sl >= max;
      }
      function nudge(dir) {
        var step = Math.max(120, Math.round(tabsEl.clientWidth * 0.7));
        tabsEl.scrollBy({ left: dir * step, behavior: 'smooth' });
      }
      leftBtn.addEventListener('click', function () { nudge(-1); });
      rightBtn.addEventListener('click', function () { nudge(1); });
      tabsEl.addEventListener('scroll', updateArrows, { passive: true });
      window.addEventListener('resize', updateArrows);
      // Delay initial measurement a frame so layout has settled.
      requestAnimationFrame(updateArrows);
      setTimeout(updateArrows, 100);
    }
    installTabScrollArrows();

    function openPanel() {
      if (!panel) return;
      panel.setAttribute('aria-hidden', 'false');
      if (panelOverlay) panelOverlay.setAttribute('aria-hidden', 'false');
      panelToggles.forEach(function (t) { t.setAttribute('aria-expanded', 'true'); });
      refreshPanelContents();
      fitPanelTitle();
      try { localStorage.setItem(PANEL_KEY, 'open'); } catch (e) {}
    }

    function closePanel() {
      if (!panel) return;
      panel.setAttribute('aria-hidden', 'true');
      if (panelOverlay) panelOverlay.setAttribute('aria-hidden', 'true');
      panelToggles.forEach(function (t) { t.setAttribute('aria-expanded', 'false'); });
      // Safety: clear any lingering scroll-lock set by another widget (nav
      // drawer, search modal) whose close handler was skipped.
      if (document.body.style.overflow === 'hidden') document.body.style.overflow = '';
      try { localStorage.setItem(PANEL_KEY, 'closed'); } catch (e) {}
    }

    panelToggles.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var expanded = this.getAttribute('aria-expanded') === 'true';
        expanded ? closePanel() : openPanel();
      });
    });
    if (panelClose) panelClose.addEventListener('click', closePanel);
    if (panelOverlay) panelOverlay.addEventListener('click', closePanel);

    // Auto-open on first visit (desktop only), remember preference
    var panelPref = localStorage.getItem(PANEL_KEY);
    if (panelPref !== 'closed' && window.innerWidth > 768) {
      openPanel();
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel && panel.getAttribute('aria-hidden') === 'false') {
        closePanel();
      }
    });

    // ── Panel tabs (only content tabs with data-target, not action buttons) ──
    var tabs = panel ? panel.querySelectorAll('.library-panel__tab[data-target]') : [];
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) {
          t.setAttribute('aria-selected', 'false');
          var target = document.getElementById(t.dataset.target);
          if (target) target.setAttribute('aria-hidden', 'true');
        });
        this.setAttribute('aria-selected', 'true');
        var section = document.getElementById(this.dataset.target);
        if (section) section.setAttribute('aria-hidden', 'false');
      });
    });

    function refreshPanelContents() {
      var hlContainer   = document.getElementById('article-panel-highlights') || document.getElementById('panel-highlights');
      var noteContainer = document.getElementById('article-panel-notes') || document.getElementById('panel-notes');
      var bmContainer   = document.getElementById('article-panel-bookmarks') || document.getElementById('panel-bookmarks');
      if (hlContainer)   Annotations.renderHighlights(hlContainer);
      if (noteContainer) Annotations.renderNotes(noteContainer);
      if (bmContainer) Bookmarks.render(bmContainer, function (bm) {
        // Jump to bookmark position
        var bodyRect = bodyEl ? bodyEl.getBoundingClientRect() : null;
        var bodyAbsTop = bodyRect ? bodyRect.top + (window.scrollY || 0) : 0;
        var scrollTarget = (bm.bodyOffset != null && bm.bodyOffset >= 0 && bodyEl)
          ? bodyAbsTop + bm.bodyOffset
          : Math.round((bm.scrollPct / 100) * (document.documentElement.scrollHeight - window.innerHeight));
        window.scrollTo({ top: Math.max(0, scrollTarget - 60), behavior: 'smooth' });
        closePanel();
      }, renderBookmarkIndicators);
    }

    // Expose globally
    window.__refreshReaderPanel = refreshPanelContents;
    window.__openReaderPanel = openPanel;

    // Export notes in multiple formats
    window.__exportPanelNotes = function (fmt) {
      var all = Annotations.load ? Annotations.load() : [];
      var bms = Bookmarks.loadAll ? Bookmarks.loadAll() : [];
      var highlights = all.filter(function (a) { return !a.note; });
      var notes = all.filter(function (a) { return !!a.note; });

      if (fmt === 'json') {
        var data = { title: pageTitle, url: pageUrl, exported: new Date().toISOString(), highlights: highlights, notes: notes, bookmarks: bms };
        var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        dl(blob, 'notes-' + pageSlug + '.json');
      } else {
        // txt or md (same format)
        var lines = ['# Notes & Highlights', '', pageTitle, pageUrl, '', '---'];
        if (highlights.length) {
          lines.push('', '## Highlights', '');
          highlights.forEach(function (a, i) { lines.push((a.section ? '   [' + a.section + ']' : '') + (i+1) + '. "' + a.quote + '"', '   ' + fmtDate(a.ts), ''); });
        }
        if (notes.length) {
          lines.push('## Notes', '');
          notes.forEach(function (a, i) { lines.push((a.section ? '   [' + a.section + ']' : '') + (i+1) + '. "' + a.quote + '"', '   Note: ' + a.note, '   ' + fmtDate(a.ts), ''); });
        }
        if (bms.length) {
          lines.push('## Bookmarks', '');
          bms.forEach(function (b, i) { lines.push((b.section ? '   [' + b.section + ']' : '') + (i+1) + '. ' + (b.context || 'Position ' + Math.round(b.scrollPct) + '%'), '   ' + fmtDate(b.ts), ''); });
        }
        var ext = fmt === 'md' ? '.md' : '.txt';
        var blob = new Blob([lines.join('\n')], { type: 'text/plain' });
        dl(blob, 'notes-' + pageSlug + ext);
      }
    };

    function dl(blob, name) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.rel = 'noopener';
      // Some browsers (Firefox) require the anchor to be in the DOM
      // for programmatic .click() to trigger a download.
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 200);
    }

    // Print — highlights and notes separated
    window.__printPanelNotes = function () {
      var all = Annotations.load ? Annotations.load() : [];
      var bms = Bookmarks.loadAll ? Bookmarks.loadAll() : [];
      var highlights = all.filter(function (a) { return !a.note; });
      var notes = all.filter(function (a) { return !!a.note; });
      var w = window.open('', '_blank');
      var html = '<html><head><title>Notes — ' + pageTitle + '</title><style>body{font-family:Georgia,serif;max-width:600px;margin:2rem auto;color:#1a1a1a;}h1{font-size:1.4rem;}h2{font-size:1.1rem;margin-top:2rem;border-bottom:2px solid #000;padding-bottom:0.3rem;}blockquote{border-left:3px solid #c0392b;padding-left:1rem;margin:0.75rem 0;font-style:italic;}.note{color:#333;font-size:0.9rem;margin:0.25rem 0 0.75rem 1rem;}.date{color:#888;font-size:0.8rem;margin:0.2rem 0 0.75rem;}</style></head><body>';
      html += '<p style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.1em;color:#888;margin:0 0 0.5rem;">The Umami Post</p>';
      html += '<h1>' + pageTitle + '</h1>';
      html += '<p style="color:#888;font-size:0.85rem;margin-bottom:1.5rem;">' + location.origin + pageUrl + '</p>';

      if (highlights.length) {
        html += '<h2>Highlights</h2>';
        highlights.forEach(function (a) {
          if (a.section) html += '<p style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.06em;color:#999;margin:0.5rem 0 0.2rem;">' + a.section + '</p>';
          html += '<blockquote>&ldquo;' + a.quote + '&rdquo;</blockquote>';
          html += '<p class="date">' + fmtDate(a.ts) + '</p>';
        });
      }

      if (notes.length) {
        html += '<h2>Notes</h2>';
        notes.forEach(function (a) {
          if (a.section) html += '<p style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.06em;color:#999;margin:0.5rem 0 0.2rem;">' + a.section + '</p>';
          html += '<blockquote>&ldquo;' + a.quote + '&rdquo;</blockquote>';
          html += '<p class="note">' + a.note + '</p>';
          html += '<p class="date">' + fmtDate(a.ts) + '</p>';
        });
      }

      if (bms.length) {
        html += '<h2>Bookmarks</h2>';
        bms.forEach(function (b) {
          if (b.section) html += '<p style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.06em;color:#999;margin:0.5rem 0 0.2rem;">' + b.section + '</p>';
          html += '<p>' + (b.context || 'Position ' + Math.round(b.scrollPct) + '%') + '</p>';
          html += '<p class="date">' + fmtDate(b.ts) + '</p>';
        });
      }

      html += '</body></html>';
      w.document.write(html);
      w.document.close();
      w.print();
    };

    // ── Body element (used by toolbar + bookmark indicators) ──
    var bodyEl = document.querySelector('.article-body');

    // ── Annotation toolbar (text selection) ──
    var toolbar = document.getElementById('annotation-toolbar');
    var highlightBtn = document.getElementById('ann-highlight-btn');
    var annotateBtn = document.getElementById('ann-annotate-btn');
    var shareBtn = document.getElementById('ann-share-btn');
    var bookmarkBtn = document.getElementById('ann-bookmark-btn');
    var lastRange = null;

    // Add click handler to a highlight mark to open panel and scroll to entry
    function addMarkClickHandler(mark, annId, hasNote) {
      mark.style.cursor = 'pointer';
      mark.addEventListener('click', function () {
        if (window.__openReaderPanel) window.__openReaderPanel();
        setTimeout(function () {
          var targetTab = hasNote ? 'article-panel-notes' : 'article-panel-highlights';
          var tab = document.querySelector('[data-target="' + targetTab + '"]') ||
                    document.querySelector('[data-target="' + (hasNote ? 'panel-notes' : 'panel-highlights') + '"]');
          if (tab) tab.click();
          var panelItem = document.querySelector('.library-annotation-item[data-ann-id="' + annId + '"]');
          if (panelItem) {
            panelItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            panelItem.style.transition = 'background 0.3s';
            panelItem.style.background = 'var(--color-bg-inset)';
            setTimeout(function () { panelItem.style.background = ''; }, 1500);
          }
        }, 150);
      });
    }

    // Walk every text node intersecting the range and wrap each
    // segment in its own <mark>. Necessary for multi-paragraph
    // selections — Range.surroundContents() throws when the range
    // crosses element boundaries, and the extractContents fallback
    // wraps invalid HTML (<mark> around <p>) which different
    // browsers render differently. Per-text-node wrapping produces
    // valid HTML and survives any cross-paragraph shape.
    function wrapRangeInMarks(range, cls, annId, hasNote) {
      if (!range) return [];
      // Collect text nodes first — splitting + wrapping mid-iteration
      // would invalidate the iterator.
      var iter = document.createNodeIterator(range.commonAncestorContainer, NodeFilter.SHOW_TEXT, null);
      var nodes = [], n;
      while ((n = iter.nextNode())) {
        try { if (range.intersectsNode(n)) nodes.push(n); } catch (e) {}
      }
      var marks = [];
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        var len = node.nodeValue ? node.nodeValue.length : 0;
        if (!len) continue;
        var startOffset = (node === range.startContainer) ? range.startOffset : 0;
        var endOffset   = (node === range.endContainer)   ? range.endOffset   : len;
        if (startOffset >= endOffset) continue;
        // Trim leading whitespace-only segments so the highlight doesn't
        // visibly extend into the gutter at paragraph breaks.
        var slice = node.nodeValue.slice(startOffset, endOffset);
        if (!/\S/.test(slice)) continue;

        var middle = node;
        if (startOffset > 0) {
          try { middle = node.splitText(startOffset); }
          catch (e) { continue; }
        }
        if (endOffset - startOffset < middle.nodeValue.length) {
          try { middle.splitText(endOffset - startOffset); }
          catch (e) {}
        }
        var mark = document.createElement('mark');
        mark.className = cls;
        mark.dataset.annId = annId;
        var parent = middle.parentNode;
        if (!parent) continue;
        parent.insertBefore(mark, middle);
        mark.appendChild(middle);
        addMarkClickHandler(mark, annId, hasNote);
        marks.push(mark);
      }
      return marks;
    }

    // Wrap the saved selection range in <mark> elements. Uses the
    // text-node walker so a single-paragraph selection and a multi-
    // paragraph selection produce identically-valid markup.
    function wrapSelectionInMark(annId, hasNote, color) {
      if (!lastRange) return;
      var cls = 'library-highlight' + (hasNote ? ' library-highlight--note' : '');
      if (color && color !== 'yellow') cls += ' library-highlight--' + color;

      var marks = [];
      if (lastRange.range) marks = wrapRangeInMarks(lastRange.range, cls, annId, hasNote);

      // Fallback: search for the text in the body and wrap it
      if (!marks.length && lastRange.text && bodyEl) {
        highlightTextInEl(bodyEl, lastRange.text, annId, hasNote, color);
      }
    }

    if (toolbar && bodyEl) {
      var selBtns = toolbar.querySelectorAll('.annotation-toolbar__btn--needs-selection');

      function updateSelectionState() {
        if (_actionInProgress) return;
        var sel = window.getSelection();
        var hasSelection = sel && !sel.isCollapsed && sel.rangeCount > 0;
        var inBody = false;

        if (hasSelection) {
          var range = sel.getRangeAt(0);
          inBody = bodyEl.contains(range.commonAncestorContainer);
          var text = sel.toString().trim();
          if (inBody && text) {
            lastRange = { text: text, range: range.cloneRange() };
          } else {
            hasSelection = false;
          }
        }

        if (!hasSelection || !inBody) {
          lastRange = null;
        }

        // Toggle active state on selection-dependent buttons
        selBtns.forEach(function (btn) {
          btn.classList.toggle('is-active', !!(hasSelection && inBody));
        });
      }

      // Find nearest heading above the current selection
      function getNearestHeading() {
        if (!lastRange || !lastRange.range) return '';
        var node = lastRange.range.startContainer;
        if (node.nodeType === 3) node = node.parentNode;
        // Walk up and backwards to find the nearest h2/h3
        var el = node;
        while (el && el !== bodyEl) {
          if (/^H[2-3]$/i.test(el.tagName)) return el.textContent.trim();
          // Check previous siblings
          var prev = el.previousElementSibling;
          while (prev) {
            if (/^H[2-3]$/i.test(prev.tagName)) return prev.textContent.trim();
            prev = prev.previousElementSibling;
          }
          el = el.parentElement;
        }
        return '';
      }

      var _actionInProgress = false;

      function afterAction() {
        lastRange = null;
        _actionInProgress = true;
        selBtns.forEach(function (btn) { btn.classList.remove('is-active'); });
        window.getSelection().removeAllRanges();
        setTimeout(function () { _actionInProgress = false; }, 400);
      }

      document.addEventListener('selectionchange', function () {
        clearTimeout(updateSelectionState._t);
        updateSelectionState._t = setTimeout(updateSelectionState, 200);
      });

      bodyEl.addEventListener('touchend', function () {
        setTimeout(updateSelectionState, 250);
      });

      // Highlights commit immediately on click — single yellow wash,
       // no colour picker. The colour-variant CSS classes are still
       // honoured by Annotations.add for any pre-existing entries
       // saved with a non-yellow colour, but new highlights always
       // land as plain yellow so the click feels instant.
      var lastHlColor = 'yellow';

      function doHighlight(color) {
        if (!lastRange) return;
        var annId = Annotations.add(lastRange.text, '', getNearestHeading(), color);
        wrapSelectionInMark(annId, false, color);
        afterAction();
      }

      if (highlightBtn) {
        highlightBtn.addEventListener('click', function (e) {
          if (!lastRange) return;
          e.stopPropagation();
          doHighlight('yellow');
        });
      }

      if (annotateBtn) {
        annotateBtn.addEventListener('click', function () {
          if (!lastRange) return;
          var savedText = lastRange.text;
          var savedRange = lastRange.range ? lastRange.range.cloneRange() : null;
          var savedHeading = getNearestHeading();
          var savedColor = lastHlColor;
          openNoteEditor('', function (note) {
            lastRange = { text: savedText, range: savedRange };
            var annId = Annotations.add(savedText, note, savedHeading, savedColor);
            wrapSelectionInMark(annId, !!note, savedColor);
            afterAction();
          });
        });
      }

      if (shareBtn) {
        shareBtn.addEventListener('click', function () {
          if (!lastRange) return;
          var shareText = '\u201c' + lastRange.text + '\u201d';
          var shareUrl = window.location.href;

          if (navigator.share) {
            navigator.share({ text: shareText, url: shareUrl }).catch(function () {});
          } else if (navigator.clipboard) {
            navigator.clipboard.writeText(shareText + ' ' + shareUrl).then(function () {
              var orig = shareBtn.textContent;
              shareBtn.textContent = 'Copied!';
              setTimeout(function () { shareBtn.textContent = orig; }, 1200);
            });
          }
          afterAction();
        });
      }

      if (bookmarkBtn) {
        // Disable bookmarking once the reader is at (or past) the
        // bottom of the article — otherwise readers stack a row of
        // bookmarks against the footer that point at nothing they
        // actually want to return to. Watch scroll + resize and
        // sync aria-disabled + a visual greyed-out state.
        function syncBookmarkAvailability() {
          var sTop = window.scrollY || document.documentElement.scrollTop;
          var dHeight = document.documentElement.scrollHeight - window.innerHeight;
          var pct = dHeight > 0 ? (sTop / dHeight) * 100 : 0;
          var atEnd = pct >= 100;
          bookmarkBtn.disabled = atEnd;
          bookmarkBtn.setAttribute('aria-disabled', atEnd ? 'true' : 'false');
          bookmarkBtn.classList.toggle('is-disabled', atEnd);
          bookmarkBtn.title = atEnd
            ? 'You are already at the end of the article'
            : 'Bookmark this spot';
        }
        // SPA-nav re-runs annotations.js, so guard the window-level
        // listeners with a one-shot flag to avoid stacking handlers
        // on every soft navigation.
        if (!window.__bookmarkBtnAvailListener) {
          window.__bookmarkBtnAvailListener = true;
          window.addEventListener('scroll', function () {
            var b = document.getElementById('ann-bookmark-btn');
            if (b && b.__syncAvail) b.__syncAvail();
          }, { passive: true });
          window.addEventListener('resize', function () {
            var b = document.getElementById('ann-bookmark-btn');
            if (b && b.__syncAvail) b.__syncAvail();
          });
        }
        bookmarkBtn.__syncAvail = syncBookmarkAvailability;
        syncBookmarkAvailability();

        // Compute the absolute Y (in document coordinates) where a
        // bookmark would land + the section heading the spot belongs
        // to. Shared by the click handler (commit) and the hover/focus
        // handler (preview), so the indicator and the saved bookmark
        // can never disagree about position.
        function computeBookmarkAnchor() {
          var scrollTop = window.scrollY || document.documentElement.scrollTop;
          var docHeight = document.documentElement.scrollHeight - window.innerHeight;
          var pagePct = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;

          var bodyOffset = -1;
          if (lastRange && lastRange.range && bodyEl) {
            try {
              var selRect = lastRange.range.getBoundingClientRect();
              var bodyRect = bodyEl.getBoundingClientRect();
              bodyOffset = Math.round(selRect.top - bodyRect.top);
            } catch (e) {}
          }

          var anchorY;
          if (lastRange && lastRange.range) {
            try {
              anchorY = lastRange.range.getBoundingClientRect().top + window.scrollY;
            } catch (_) {}
          }
          if (anchorY == null) anchorY = window.scrollY + window.innerHeight * 0.33;

          var bmSection = '';
          if (bodyEl) {
            var allHeadings = bodyEl.querySelectorAll('h2, h3');
            var headings = [];
            for (var hx = 0; hx < allHeadings.length; hx++) {
              if (allHeadings[hx].parentNode === bodyEl) headings.push(allHeadings[hx]);
            }
            if (!headings.length) headings = Array.prototype.slice.call(allHeadings);
            for (var hi = headings.length - 1; hi >= 0; hi--) {
              var absTop = headings[hi].getBoundingClientRect().top + window.scrollY;
              if (absTop <= anchorY) {
                bmSection = headings[hi].textContent.trim();
                break;
              }
            }
          }

          var context = lastRange ? lastRange.text.slice(0, 80) : '';
          return { pagePct: pagePct, bodyOffset: bodyOffset, anchorY: anchorY, section: bmSection, context: context };
        }

        // Placement indicator — a thin horizontal rule at the resolved
        // anchor Y position, spanning the body's column width. Reveals
        // on hover/focus of the bookmark button so readers can see
        // exactly where the pin will land before they commit.
        var previewEl = document.getElementById('bookmark-preview');
        if (!previewEl) {
          previewEl = document.createElement('div');
          previewEl.id = 'bookmark-preview';
          previewEl.className = 'bookmark-preview';
          previewEl.setAttribute('aria-hidden', 'true');
          previewEl.innerHTML = '<span class="bookmark-preview__line"></span><span class="bookmark-preview__pin" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></span>';
          document.body.appendChild(previewEl);
        }
        function positionPreview() {
          if (bookmarkBtn.disabled) { previewEl.classList.remove('is-visible'); return; }
          var anchor = computeBookmarkAnchor();
          var bodyRect = bodyEl ? bodyEl.getBoundingClientRect() : null;
          if (!bodyRect) return;
          // Convert document Y → viewport Y for the position-fixed indicator.
          var viewportY = anchor.anchorY - (window.scrollY || document.documentElement.scrollTop);
          previewEl.style.top = Math.round(viewportY) + 'px';
          previewEl.style.left = Math.round(bodyRect.left) + 'px';
          previewEl.style.width = Math.round(bodyRect.width) + 'px';
          previewEl.classList.add('is-visible');
        }
        function hidePreview() { previewEl.classList.remove('is-visible'); }
        bookmarkBtn.addEventListener('mouseenter', positionPreview);
        bookmarkBtn.addEventListener('focus', positionPreview);
        bookmarkBtn.addEventListener('mouseleave', hidePreview);
        bookmarkBtn.addEventListener('blur', hidePreview);
        // Touch users get a brief preview flash on touchstart so the
        // landing point is visible before the click commits.
        bookmarkBtn.addEventListener('touchstart', function () {
          positionPreview();
          setTimeout(hidePreview, 700);
        }, { passive: true });

        bookmarkBtn.addEventListener('click', function () {
          if (bookmarkBtn.disabled) return;
          var anchor = computeBookmarkAnchor();
          Bookmarks.add(anchor.pagePct, anchor.context, anchor.bodyOffset, anchor.section);
          lastRange = null;
          hidePreview();
          renderBookmarkIndicators();
          bookmarkBtn.classList.add('is-saved-flash');
          setTimeout(function () { bookmarkBtn.classList.remove('is-saved-flash'); }, 1200);
        });
      }

    }

    // Restore saved highlights after DOM is fully settled
    setTimeout(function () {
      if (bodyEl) Annotations.restoreHighlights(bodyEl);
    }, 100);

    // Render bookmark indicators after layout is stable
    if (document.readyState === 'complete') {
      renderBookmarkIndicators();
    } else {
      window.addEventListener('load', renderBookmarkIndicators);
    }

    function renderBookmarkIndicators() {
      document.querySelectorAll('.bookmark-indicator').forEach(function (el) { el.remove(); });

      var list = Bookmarks.loadAll();
      if (!list.length || !bodyEl) return;

      list.forEach(function (bm) {
        var topPx;
        if (bm.bodyOffset != null && bm.bodyOffset >= 0) {
          topPx = bm.bodyOffset;
        } else {
          // Legacy fallback: approximate from page scroll %
          var bodyAbsTop = bodyEl.getBoundingClientRect().top + (window.scrollY || 0);
          var pageScrollHeight = document.documentElement.scrollHeight - window.innerHeight;
          var pageY = Math.round((bm.scrollPct / 100) * pageScrollHeight);
          topPx = Math.max(0, pageY - bodyAbsTop);
        }

        var indicator = document.createElement('div');
        indicator.className = 'bookmark-indicator';
        indicator.setAttribute('aria-hidden', 'true');
        indicator.title = bm.context ? '\u201c' + bm.context.slice(0, 40) + '\u2026\u201d' : bm.scrollPct + '% through';
        indicator.style.top = topPx + 'px';
        indicator.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
        // Compute scroll target at click time, offset for fixed header
        indicator.addEventListener('click', function () {
          var bodyAbsTop = bodyEl.getBoundingClientRect().top + (window.scrollY || 0);
          var headerOffset = 60; // approximate height of sticky reading header
          window.scrollTo({ top: Math.max(0, bodyAbsTop + topPx - headerOffset), behavior: 'smooth' });
        });
        bodyEl.appendChild(indicator);
      });
    }

  } // end initAnnotations

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAnnotations);
  } else {
    initAnnotations();
  }
}());
