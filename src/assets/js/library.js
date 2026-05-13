/**
 * The Umami Post — Public Domain Library
 * Modules: ReadingPosition, ChapterCompletion, Bookmarks, Annotations
 * Context is read from #library-context (data-work-slug, data-chapter-slug, data-chapter-title).
 */
(function () {
  'use strict';

  var _p = window.__PREFIX || 'umami';

  // ─── Context ──────────────────────────────────────────────
  var ctx = document.getElementById('library-context');
  if (!ctx) return;

  var workSlug    = ctx.dataset.workSlug    || '';
  var chapterSlug = ctx.dataset.chapterSlug || '';
  var chapterTitle = ctx.dataset.chapterTitle || '';

  var isChapterPage = chapterSlug !== '';

  // Save page metadata so the /notes/ page can link back
  try {
    localStorage.setItem(_p + '-lib-meta-' + workSlug, JSON.stringify({
      url: '/library/' + workSlug + '/',
      title: ctx.dataset.workTitle || workSlug
    }));
  } catch (e) {}

  // ─── ReadingPosition ──────────────────────────────────────
  var ReadingPosition = (function () {
    var KEY_PREFIX = _p + '-lib-pos-';
    var EXPIRY_MS  = 30 * 24 * 60 * 60 * 1000; // 30 days

    function storageKey(slug) {
      return KEY_PREFIX + slug;
    }

    function save(slug, pct) {
      try {
        localStorage.setItem(storageKey(slug), JSON.stringify({
          pct: pct,
          ts:  Date.now()
        }));
      } catch (e) {}
    }

    function load(slug) {
      try {
        var raw = localStorage.getItem(storageKey(slug));
        if (!raw) return null;
        var obj = JSON.parse(raw);
        if (Date.now() - obj.ts > EXPIRY_MS) {
          localStorage.removeItem(storageKey(slug));
          return null;
        }
        return obj.pct;
      } catch (e) { return null; }
    }

    function remove(slug) {
      try { localStorage.removeItem(storageKey(slug)); } catch (e) {}
    }

    function getScrollPct() {
      var scrollTop  = window.scrollY || document.documentElement.scrollTop;
      var docHeight  = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return 100;
      return Math.min(100, Math.round((scrollTop / docHeight) * 100));
    }

    // Restore scroll position on load
    function restore(slug) {
      var pct = load(slug);
      if (pct == null || pct === 0) return;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        window.scrollTo(0, Math.round((pct / 100) * docHeight));
      }
    }

    return { save: save, load: load, remove: remove, getScrollPct: getScrollPct, restore: restore };
  }());

  // ─── ChapterCompletion ────────────────────────────────────
  var ChapterCompletion = (function () {
    var KEY = _p + '-lib-completed-' + workSlug;
    var COMPLETE_THRESHOLD = 88; // percent

    function getCompleted() {
      try {
        return JSON.parse(localStorage.getItem(KEY) || '[]');
      } catch (e) { return []; }
    }

    function markComplete(slug) {
      var list = getCompleted();
      if (list.indexOf(slug) === -1) {
        list.push(slug);
        try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
      }
    }

    function isComplete(slug) {
      return getCompleted().indexOf(slug) !== -1;
    }

    return {
      getCompleted:    getCompleted,
      markComplete:    markComplete,
      isComplete:      isComplete,
      COMPLETE_THRESHOLD: COMPLETE_THRESHOLD
    };
  }());

  // ─── Bookmarks ────────────────────────────────────────────
  var Bookmarks = (function () {
    var KEY = _p + '-lib-bookmarks-' + workSlug;

    function load() {
      try {
        return JSON.parse(localStorage.getItem(KEY) || '[]');
      } catch (e) { return []; }
    }

    function save(list) {
      try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
    }

    function add(chapter, scrollPct) {
      var list = load();
      // Skip if a bookmark already exists at this spot in the same
      // chapter. Treat scroll positions within 2 percentage points as
      // the same location (covers double-taps and thumb-jitter).
      for (var i = 0; i < list.length; i++) {
        var b = list[i];
        if (b.chapter === chapter && Math.abs((b.scrollPct || 0) - scrollPct) < 2) {
          return b.id;
        }
      }
      var id   = 'bm-' + Date.now();
      list.push({ id: id, chapter: chapter, scrollPct: scrollPct, ts: Date.now() });
      save(list);
      return id;
    }

    function remove(id) {
      save(load().filter(function (b) { return b.id !== id; }));
    }

    function render(containerEl, onJump) {
      var list = load();
      containerEl.innerHTML = '';
      if (!list.length) {
        containerEl.innerHTML = '<p class="library-panel__empty">No bookmarks yet.</p>';
        return;
      }
      var ul = document.createElement('div');
      ul.className = 'library-bookmark-list';
      list.sort(function (a, b) { return b.ts - a.ts; }).forEach(function (bm) {
        var item = document.createElement('div');
        item.className = 'library-bookmark-item';
        item.innerHTML =
          '<span class="library-bookmark-item__chapter">' + escHtml(bm.chapter) + '</span>' +
          '<span class="library-bookmark-item__pos">' + bm.scrollPct + '% through</span>' +
          '<button class="library-bookmark-item__delete" data-bm-id="' + escHtml(bm.id) + '" aria-label="Delete bookmark">Remove</button>';
        item.addEventListener('click', function (e) {
          if (e.target.dataset.bmId) {
            remove(e.target.dataset.bmId);
            render(containerEl, onJump);
          } else if (onJump) {
            onJump(bm);
          }
        });
        ul.appendChild(item);
      });
      containerEl.appendChild(ul);
    }

    return { add: add, remove: remove, render: render, load: load };
  }());

  // ─── Annotations ──────────────────────────────────────────
  var Annotations = (function () {
    var KEY = _p + '-lib-annotations-' + workSlug;

    function load() {
      try {
        return JSON.parse(localStorage.getItem(KEY) || '[]');
      } catch (e) { return []; }
    }

    function save(list) {
      try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
    }

    function add(chapter, quote, note) {
      var list = load();
      var id   = 'ann-' + Date.now();
      list.push({ id: id, chapter: chapter, quote: quote, note: note || '', ts: Date.now() });
      save(list);
      return id;
    }

    function remove(id) {
      save(load().filter(function (a) { return a.id !== id; }));
    }

    function updateNote(id, note) {
      var list = load();
      var ann  = list.find(function (a) { return a.id === id; });
      if (ann) { ann.note = note; ann.modified = Date.now(); save(list); }
    }

    function render(containerEl) {
      var list = load().filter(function (a) { return a.chapter === chapterSlug || !chapterSlug; });
      containerEl.innerHTML = '';
      if (!list.length) {
        containerEl.innerHTML = '<p class="library-panel__empty">No annotations for this chapter.</p>';
        return;
      }
      var wrapper = document.createElement('div');
      wrapper.className = 'library-annotation-list';
      list.sort(function (a, b) { return b.ts - a.ts; }).forEach(function (ann) {
        var item = document.createElement('div');
        item.className = 'library-annotation-item';
        item.innerHTML =
          '<p class="library-annotation-item__quote">&ldquo;' + escHtml(ann.quote) + '&rdquo;</p>' +
          (ann.note ? '<p class="library-annotation-item__note">' + escHtml(ann.note) + '</p>' : '') +
          '<div class="library-annotation-item__actions">' +
            '<button class="library-annotation-item__action" data-ann-delete="' + escHtml(ann.id) + '">Delete</button>' +
          '</div>';
        item.querySelector('[data-ann-delete]').addEventListener('click', function () {
          remove(ann.id);
          render(containerEl);
        });
        wrapper.appendChild(item);
      });
      containerEl.appendChild(wrapper);
    }

    // Restore highlight spans for saved annotations in the body
    function restoreHighlights(bodyEl) {
      if (!bodyEl) return;
      var list = load().filter(function (a) { return a.chapter === chapterSlug; });
      list.forEach(function (ann) {
        try {
          highlightTextInEl(bodyEl, ann.quote, ann.id, !!ann.note);
        } catch (e) {}
      });
    }

    // Simple text-match highlight (first occurrence only)
    function highlightTextInEl(el, text, annId, hasNote) {
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
      var node;
      while ((node = walker.nextNode())) {
        var idx = node.nodeValue.indexOf(text);
        if (idx !== -1) {
          var before  = document.createTextNode(node.nodeValue.slice(0, idx));
          var mark    = document.createElement('mark');
          mark.className  = 'library-highlight' + (hasNote ? ' library-highlight--note' : '');
          mark.dataset.annId = annId;
          mark.textContent = text;
          var after   = document.createTextNode(node.nodeValue.slice(idx + text.length));
          var parent  = node.parentNode;
          parent.insertBefore(before, node);
          parent.insertBefore(mark, node);
          parent.insertBefore(after, node);
          parent.removeChild(node);
          break;
        }
      }
    }

    function renderFiltered(containerEl, filterFn, emptyMsg) {
      var list = load().filter(function (a) { return a.chapter === chapterSlug || !chapterSlug; }).filter(filterFn);
      containerEl.innerHTML = '';
      if (!list.length) {
        containerEl.innerHTML = '<p class="library-panel__empty">' + emptyMsg + '</p>';
        return;
      }
      var wrapper = document.createElement('div');
      wrapper.className = 'library-annotation-list';
      list.sort(function (a, b) { return b.ts - a.ts; }).forEach(function (ann) {
        var item = document.createElement('div');
        item.className = 'library-annotation-item';
        item.style.cursor = 'pointer';

        var dateStr = fmtDate(ann.ts);
        var modStr = ann.modified ? ' (edited ' + fmtDate(ann.modified) + ')' : '';

        item.innerHTML =
          '<p class="library-annotation-item__quote">&ldquo;' + escHtml(ann.quote) + '&rdquo;</p>' +
          (ann.note ? '<p class="library-annotation-item__note">' + escHtml(ann.note) + '</p>' : '') +
          '<p style="font-size:var(--text-xs);color:var(--color-ink-faint);margin:var(--space-1) 0 0;">' + dateStr + modStr + '</p>' +
          '<div class="library-annotation-item__actions">' +
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

        var editBtn = item.querySelector('[data-ann-edit]');
        if (editBtn) {
          editBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            var newNote = prompt('Edit note:', ann.note || '');
            if (newNote !== null) {
              updateNote(ann.id, newNote);
              renderFiltered(containerEl, filterFn, emptyMsg);
            }
          });
        }

        item.querySelector('[data-ann-delete]').addEventListener('click', function (e) {
          e.stopPropagation();
          remove(ann.id);
          renderFiltered(containerEl, filterFn, emptyMsg);
        });
        wrapper.appendChild(item);
      });
      containerEl.appendChild(wrapper);
    }

    function renderHighlights(containerEl) {
      renderFiltered(containerEl, function (a) { return !a.note; }, 'No highlights yet. Select text and click Highlight.');
    }

    function renderNotes(containerEl) {
      renderFiltered(containerEl, function (a) { return !!a.note; }, 'No notes yet. Select text and click Note to add one.');
    }

    return { add: add, remove: remove, updateNote: updateNote, render: render, renderHighlights: renderHighlights, renderNotes: renderNotes, restoreHighlights: restoreHighlights };
  }());

  // ─── Utility ──────────────────────────────────────────────
  function fmtDate(ts) {
    if (!ts) return '';
    try { return new Date(ts).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }); }
    catch (e) { return ''; }
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  // ─── Init: Chapter reading page ───────────────────────────
  // SPA-compatible: spa-nav re-injects library.js on every content swap,
  // so we run the init immediately if the DOM is already parsed instead
  // of waiting for a DOMContentLoaded that'll never fire a second time.
  var isFirstRun = !window.__libraryJsBootstrapped;
  window.__libraryJsBootstrapped = true;

  function initLibraryPage() {

    // ── Progress bar ──
    var progressBar = document.querySelector('.library-reading-progress__bar');
    function updateProgress() {
      var pct = ReadingPosition.getScrollPct();
      if (progressBar) progressBar.style.width = pct + '%';

      // Auto-complete at threshold
      if (isChapterPage && pct >= ChapterCompletion.COMPLETE_THRESHOLD) {
        ChapterCompletion.markComplete(chapterSlug);
      }
    }

    // ── Save / restore position ──
    var savePosition = debounce(function () {
      if (isChapterPage) {
        ReadingPosition.save(chapterSlug, ReadingPosition.getScrollPct());
      }
    }, 500);

    if (isChapterPage) {
      ReadingPosition.restore(chapterSlug);
    }

    if (isFirstRun) window.addEventListener('scroll', function () {
      updateProgress();
      savePosition();
    }, { passive: true });

    updateProgress();

    // ── Panel (skip if annotations.js handles it) ──
    var _annCtx = document.getElementById('annotations-context');
    if (!_annCtx) {
    var panelToggles = document.querySelectorAll('.library-panel-toggle');
    var panel        = document.getElementById('library-panel');
    var panelOverlay = document.querySelector('.library-panel-overlay');
    var panelClose   = document.querySelector('.library-panel__close');

    function openPanel() {
      if (!panel) return;
      panel.setAttribute('aria-hidden', 'false');
      if (panelOverlay) panelOverlay.setAttribute('aria-hidden', 'false');
      panelToggles.forEach(function (t) { t.setAttribute('aria-expanded', 'true'); });
      refreshPanelContents();
    }

    function closePanel() {
      if (!panel) return;
      panel.setAttribute('aria-hidden', 'true');
      if (panelOverlay) panelOverlay.setAttribute('aria-hidden', 'true');
      panelToggles.forEach(function (t) { t.setAttribute('aria-expanded', 'false'); });
      // Safety: clear any lingering scroll-lock
      if (document.body.style.overflow === 'hidden') document.body.style.overflow = '';
    }

    panelToggles.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var expanded = this.getAttribute('aria-expanded') === 'true';
        expanded ? closePanel() : openPanel();
      });
    });

    if (panelClose) panelClose.addEventListener('click', closePanel);
    if (panelOverlay) panelOverlay.addEventListener('click', closePanel);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel && panel.getAttribute('aria-hidden') === 'false') {
        closePanel();
      }
    });

    // ── Panel tabs ── (skip the export/print buttons that share the
    // .library-panel__tab class but have no data-target — they handle
    // their own clicks via reader-panel-migrate.js)
    var tabs = document.querySelectorAll('.library-panel__tab[data-target]');
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
      var hlContainer   = document.getElementById('panel-highlights');
      var noteContainer = document.getElementById('panel-notes');
      var bmContainer   = document.getElementById('panel-bookmarks');
      if (hlContainer)   Annotations.renderHighlights(hlContainer);
      if (noteContainer) Annotations.renderNotes(noteContainer);
      if (bmContainer)   Bookmarks.render(bmContainer, function (bm) {
        var docHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (docHeight > 0) window.scrollTo(0, Math.round((bm.scrollPct / 100) * docHeight));
        closePanel();
      });
    }

    // ── Bookmark button ──
    var bookmarkBtn = document.querySelector('.library-bookmark-btn');
    if (bookmarkBtn && isChapterPage) {
      bookmarkBtn.addEventListener('click', function () {
        var pct = ReadingPosition.getScrollPct();
        Bookmarks.add(chapterTitle || chapterSlug, pct);
        this.setAttribute('aria-pressed', 'true');
        setTimeout(function () {
          if (bookmarkBtn) bookmarkBtn.setAttribute('aria-pressed', 'false');
        }, 1500);
      });
    }

    // ── Annotation toolbar ──
    var toolbar       = document.getElementById('annotation-toolbar');
    var highlightBtn  = document.getElementById('ann-highlight-btn');
    var annotateBtn   = document.getElementById('ann-annotate-btn');
    var shareBtn      = document.getElementById('ann-share-btn');
    var toolbarBmBtn  = document.getElementById('ann-bookmark-btn');
    var bodyEl        = document.querySelector('.library-body');
    var lastRange     = null;

    // Wrap the live selection range in a <mark> for immediate visual feedback
    function wrapSelectionInMark(annId, hasNote) {
      if (!lastRange) return;
      var cls = 'library-highlight' + (hasNote ? ' library-highlight--note' : '');
      var done = false;

      if (lastRange.range) {
        try {
          var mark = document.createElement('mark');
          mark.className = cls;
          mark.dataset.annId = annId;
          lastRange.range.surroundContents(mark);
          done = true;
        } catch (e) {
          try {
            var fragment = lastRange.range.extractContents();
            var mark2 = document.createElement('mark');
            mark2.className = cls;
            mark2.dataset.annId = annId;
            mark2.appendChild(fragment);
            lastRange.range.insertNode(mark2);
            done = true;
          } catch (e2) {}
        }
      }

      if (!done && lastRange.text && bodyEl) {
        highlightTextInEl(bodyEl, lastRange.text, annId, hasNote);
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

        selBtns.forEach(function (btn) {
          btn.classList.toggle('is-active', !!(hasSelection && inBody));
        });
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

      if (highlightBtn) {
        highlightBtn.addEventListener('click', function () {
          if (!lastRange) return;
          var annId = Annotations.add(chapterSlug, lastRange.text, '');
          wrapSelectionInMark(annId, false);
          afterAction();
        });
      }

      if (annotateBtn) {
        annotateBtn.addEventListener('click', function () {
          if (!lastRange) return;
          var note = prompt('Add a note (optional):') || '';
          var annId = Annotations.add(chapterSlug, lastRange.text, note);
          wrapSelectionInMark(annId, !!note);
          afterAction();
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

      if (toolbarBmBtn && isChapterPage) {
        toolbarBmBtn.addEventListener('click', function () {
          var pct = ReadingPosition.getScrollPct();
          Bookmarks.add(chapterTitle || chapterSlug, pct);
          afterAction();
          toolbarBmBtn.classList.add('is-saved-flash');
          setTimeout(function () { toolbarBmBtn.classList.remove('is-saved-flash'); }, 1200);
        });
      }

      // Restore saved highlights on load
      Annotations.restoreHighlights(bodyEl);
    }
    } // end annotations-context panel guard

  } // end initLibraryPage

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLibraryPage);
  } else {
    initLibraryPage();
  }

  // ─── Expose for work landing page (continue reading) ──────
  window.LibraryChapterCompletion = ChapterCompletion;
  window.LibraryReadingPosition   = ReadingPosition;

}());
