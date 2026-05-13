/**
 * Article utilities: reading progress bar, progress %, back to top,
 * copy link, print, table of contents, pullquote share, focus mode.
 */
(function () {
  'use strict';

  var _p = window.__PREFIX || 'tft';

  // Re-execution guard. On SPA content swaps article-layout scripts get
  // re-injected so new #main-content DOM gets fresh bindings; window- and
  // document-level listeners (which live on nodes that survive the swap)
  // must only be registered once.
  var isFirstRun = !window.__progressBootstrapped;
  window.__progressBootstrapped = true;

  /* ── Reading progress bar + % text + back-to-top ─────────── */
  // DOM refs are looked up FRESH inside the scroll handler so SPA-nav
  // content swaps (which destroy and rebuild #main-content) don't leave
  // the listener pointing at a stale detached element — a %through that
  // updates a detached node silently produced the "needs a refresh to
  // work" bug on the second article of a session.
  function updateReadingFloatsAndProgress() {
    var bar    = document.querySelector('.reading-progress');
    var floats = document.getElementById('reading-floats');
    var pctEl  = document.getElementById('reading-pct');
    var target = document.querySelector('.article-body');
    var scrollTop = window.scrollY;

    // Threshold dropped from 400 → 50: the .is-visible class now only
    // drives the back-to-top button's "live" colour state (dim at the
    // top, white once scrolled). Earlier it also gated visibility, but
    // the button is permanently rendered now — flipping the class
    // sooner makes the affordance feel responsive on a quick scroll.
    if (floats) floats.classList.toggle('is-visible', scrollTop > 50);

    var dist;
    if (target) {
      dist = target.getBoundingClientRect().bottom + scrollTop - window.innerHeight;
    } else {
      dist = document.documentElement.scrollHeight - window.innerHeight;
    }
    var pct = dist > 0 ? Math.min((scrollTop / dist) * 100, 100) : 0;
    var pctRounded = Math.round(pct);

    if (bar) bar.style.width = pct + '%';
    if (pctEl) pctEl.textContent = pctRounded + '%';

    // Fire a one-shot Umami "finished-reading" event when the reader has
    // scrolled through 90% of the article body. Gated by pathname so a
    // single session across multiple articles fires once per article,
    // and skipped entirely on non-article pages (no .reading-progress).
    if (bar && pct >= 90) {
      if (!window.__umamiFinished) window.__umamiFinished = {};
      if (!window.__umamiFinished[location.pathname]) {
        window.__umamiFinished[location.pathname] = true;
        if (window.umami && typeof window.umami.track === 'function') {
          umami.track('finished-reading', {
            url: location.pathname,
            title: document.title
          });
        }
      }
    }
  }

  if (isFirstRun) {
    window.addEventListener('scroll', updateReadingFloatsAndProgress, { passive: true });
    window.addEventListener('resize', updateReadingFloatsAndProgress, { passive: true });
    // On SPA nav the previous article's "finished" mark is stale — a new
    // article at the same pathname would never fire otherwise, and a new
    // article at a different pathname is fine either way. Clear the mark
    // for the OUTGOING page; the INCOMING page gets a fresh entry.
    document.addEventListener('spa:contentswap', updateReadingFloatsAndProgress);
  }
  updateReadingFloatsAndProgress();

  var bttBtn = document.getElementById('back-to-top');

  if (bttBtn) {
    bttBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ── Share panel ──────────────────────────────────────────── */
  var shareBtn   = document.getElementById('share-btn');
  var sharePanel = document.getElementById('share-panel');

  if (shareBtn && sharePanel) {
    var shareTitle = shareBtn.dataset.title || document.title;
    var shareUrl   = shareBtn.dataset.url   || window.location.href;
    var encUrl     = encodeURIComponent(shareUrl);
    var encTitle   = encodeURIComponent(shareTitle);

    // Wire social links
    var tw = document.getElementById('share-twitter');
    var fb = document.getElementById('share-facebook');
    var li = document.getElementById('share-linkedin');
    var rd = document.getElementById('share-reddit');
    var bsky = document.getElementById('share-bluesky');
    var masto = document.getElementById('share-mastodon');
    var em = document.getElementById('share-email');
    if (tw)    tw.href   = 'https://twitter.com/intent/tweet?url=' + encUrl + '&text=' + encTitle;
    if (fb)    fb.href   = 'https://www.facebook.com/sharer/sharer.php?u=' + encUrl;
    if (li)    li.href   = 'https://www.linkedin.com/sharing/share-offsite/?url=' + encUrl;
    if (rd)    rd.href   = 'https://www.reddit.com/submit?url=' + encUrl + '&title=' + encTitle;
    if (bsky)  bsky.href = 'https://bsky.app/intent/compose?text=' + encodeURIComponent(shareTitle + '\n\n' + shareUrl);
    if (masto) masto.href = 'https://mastodon.social/share?text=' + encodeURIComponent(shareTitle + '\n\n' + shareUrl);
    if (em)    em.href   = 'mailto:?subject=' + encTitle + '&body=' + encUrl;

    // Track share clicks via explicit umami.track instead of the
    // data-umami-event attribute. progress.js re-runs on every SPA
    // nav, so re-applying the attribute repeatedly was causing the
    // auto-tracker to attach a fresh click listener each time and
    // a single share click ended up emitting the event ~10× by the
    // time the reader had navigated through a few articles. The
    // __shareTracked flag pins each button to a single binding for
    // the page lifetime.
    [
      [tw,    'share-twitter'],
      [fb,    'share-facebook'],
      [li,    'share-linkedin'],
      [rd,    'share-reddit'],
      [bsky,  'share-bluesky'],
      [masto, 'share-mastodon'],
      [em,    'share-email']
    ].forEach(function (pair) {
      var el = pair[0]; var name = pair[1];
      if (!el || el.__shareTracked) return;
      el.__shareTracked = true;
      el.addEventListener('click', function () {
        if (window.umami && typeof window.umami.track === 'function') {
          try { window.umami.track(name, { url: shareUrl }); } catch (e) {}
        }
      });
    });

    // Skip toggle/auto-close when panel has been relocated out of the
    // original header rail (into the Reader panel, or into the share
    // popover above the annotation toolbar). Those containers own the
    // visibility of the share-panel; this script only needs to keep
    // share-panel's social links populated.
    function isShareInReaderPanel() {
      if (!sharePanel.closest) return false;
      return !!(sharePanel.closest('.library-panel') || sharePanel.closest('#ann-share-popover'));
    }

    function openSharePanel() {
      if (isShareInReaderPanel()) return;
      sharePanel.hidden = false;
      shareBtn.setAttribute('aria-expanded', 'true');
    }
    function closeSharePanel() {
      if (isShareInReaderPanel()) return;
      sharePanel.hidden = true;
      shareBtn.setAttribute('aria-expanded', 'false');
    }

    shareBtn.addEventListener('click', function(e) {
      if (isShareInReaderPanel()) return;
      e.stopPropagation();
      if (!sharePanel.hidden) { closeSharePanel(); } else { openSharePanel(); }
    });

    document.addEventListener('click', function(e) {
      if (isShareInReaderPanel()) return;
      if (!sharePanel.hidden && !sharePanel.contains(e.target)) closeSharePanel();
    });
    document.addEventListener('keydown', function(e) {
      if (isShareInReaderPanel()) return;
      if (e.key === 'Escape' && !sharePanel.hidden) { closeSharePanel(); shareBtn.focus(); }
    });

    // Copy link inside panel — gated by __shareTracked so SPA-nav
    // doesn't stack duplicate click listeners (which inflated share
    // counts) and so a single click only fires umami.track once.
    var shareCopy = document.getElementById('share-copy');
    if (shareCopy && !shareCopy.__shareTracked) {
      shareCopy.__shareTracked = true;
      shareCopy.addEventListener('click', function() {
        var orig = shareCopy.textContent.trim();
        function onCopied() {
          shareCopy.textContent = 'Copied!';
          setTimeout(function() { shareCopy.textContent = orig; }, 2000);
        }
        if (navigator.clipboard) {
          navigator.clipboard.writeText(shareUrl).then(onCopied);
        } else {
          var ta = document.createElement('textarea');
          ta.value = shareUrl;
          ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); onCopied(); } catch(e) {}
          document.body.removeChild(ta);
        }
        if (window.umami && typeof window.umami.track === 'function') {
          try { window.umami.track('share-copy', { url: shareUrl }); } catch (e) {}
        }
      });
    }
  }

  /* ── Print ────────────────────────────────────────────────── */
  var printBtn = document.getElementById('print-btn');
  if (printBtn) {
    printBtn.addEventListener('click', function () { window.print(); });
  }


  /* ── Heading anchor links ─────────────────────────────────── */
  (function () {
    var body = document.querySelector('.article-body');
    if (!body) return;
    var headings = body.querySelectorAll('h2[id], h3[id]');
    var linkIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
    Array.prototype.forEach.call(headings, function (h) {
      var a = document.createElement('a');
      a.className = 'heading-anchor';
      a.href = '#' + h.id;
      a.setAttribute('aria-hidden', 'true');
      a.innerHTML = linkIcon;
      h.appendChild(a);
    });
  }());

  /* ── Table of contents ────────────────────────────────────── */
  var articleBody = document.querySelector('.article-body');
  var tocNav      = document.getElementById('toc-nav');
  var tocMasthead = document.querySelector('.masthead');

  if (articleBody && tocNav) {
    var headings = Array.prototype.slice.call(
      articleBody.querySelectorAll('h2, h3')
    );

    if (headings.length >= 2) {
      // Assign IDs to headings that don't already have one
      headings.forEach(function (h, i) {
        if (!h.id) {
          h.id = 'section-' + (h.textContent.trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '') || i);
        }
      });

      // Build TOC list
      var ul = document.createElement('ul');
      ul.className = 'toc-list';

      headings.forEach(function (h) {
        var li   = document.createElement('li');
        li.className = 'toc-list__item toc-list__item--' + h.tagName.toLowerCase();
        var a = document.createElement('a');
        a.className = 'toc-list__link';
        a.href = '#' + h.id;
        a.textContent = h.textContent;
        a.addEventListener('click', function (e) {
          e.preventDefault();
          var headerH = tocMasthead ? tocMasthead.getBoundingClientRect().height : 0;
          var top = h.getBoundingClientRect().top + window.scrollY - headerH - 16;
          window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
          history.replaceState(null, '', '#' + h.id);
        });
        li.appendChild(a);
        ul.appendChild(li);
      });

      tocNav.appendChild(ul);
      // TOC populated in reader panel

      // Scroll spy with IntersectionObserver
      var tocLinks = Array.prototype.slice.call(tocNav.querySelectorAll('.toc-list__link'));
      var activeLink = null;

      function setActive(link) {
        if (activeLink) activeLink.classList.remove('is-active');
        activeLink = link;
        if (activeLink) activeLink.classList.add('is-active');
      }

      if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              var id = entry.target.id;
              var link = tocNav.querySelector('[href="#' + id + '"]');
              if (link) setActive(link);
            }
          });
        }, { rootMargin: '0px 0px -70% 0px', threshold: 0 });

        headings.forEach(function (h) { observer.observe(h); });
      }
    }
  }

  /* ── Inline footnote tooltips ────────────────────────────── */
  // ONE tooltip element, ONE click handler, lifetime-of-session. The
  // tooltip and its listeners live on document.body + document, both of
  // which survive SPA-nav content swaps. Creating a fresh tooltip on
  // each swap (the previous implementation) produced stacked tooltips
  // and double-registered handlers — one of which wrote content into a
  // detached node, which is why the popup appeared as a blank box.
  function getOrCreateFnTooltip() {
    var el = document.getElementById('fn-tooltip-global');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'fn-tooltip-global';
    el.className = 'fn-tooltip';
    el.setAttribute('role', 'tooltip');
    el.hidden = true;
    var close = document.createElement('button');
    close.className = 'fn-tooltip__close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Close footnote');
    close.textContent = '✕';
    close.addEventListener('click', function () { hideFnTooltip(); });
    el.appendChild(close);
    var body = document.createElement('div');
    body.className = 'fn-tooltip__body';
    el.appendChild(body);
    document.body.appendChild(el);
    return el;
  }

  function hideFnTooltip() {
    var t = document.getElementById('fn-tooltip-global');
    if (t) t.hidden = true;
    var prev = document.querySelector('.fn-btn[aria-expanded="true"]');
    if (prev) prev.setAttribute('aria-expanded', 'false');
  }

  if (isFirstRun) {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.fn-btn');
      if (!btn) {
        // Clicks inside the tooltip itself (e.g. links in footnote text)
        // shouldn't close it.
        if (e.target.closest('.fn-tooltip')) return;
        hideFnTooltip();
        return;
      }
      e.stopPropagation();

      // Wide-screen sidenote already visible — just highlight it.
      if (btn.getAttribute('data-has-sidenote')) {
        var snId = btn.getAttribute('aria-controls');
        var sn = snId ? document.getElementById(snId) : null;
        if (sn) {
          sn.classList.add('sidenote--highlight');
          setTimeout(function () { sn.classList.remove('sidenote--highlight'); }, 1200);
        }
        return;
      }

      var tip = getOrCreateFnTooltip();
      var tipBody = tip.querySelector('.fn-tooltip__body');

      var already = btn.getAttribute('aria-expanded') === 'true';
      hideFnTooltip();
      if (already) return;

      // Content lives in <span class="fn-content" hidden> inside
      // <sup class="fn-ref">. Fall back to textContent then to a visible
      // placeholder so the popup is never a silent blank square.
      var supEl = btn.closest('.fn-ref') || btn.parentElement;
      var contentEl = supEl ? supEl.querySelector('.fn-content') : null;
      var content = '';
      if (contentEl) {
        content = (contentEl.innerHTML || '').trim();
        if (!content) content = (contentEl.textContent || '').trim();
      }
      if (!content) content = '<em>Footnote content missing.</em>';
      tipBody.innerHTML = content;

      // Position above the button, centred.
      var rect    = btn.getBoundingClientRect();
      var scrollY = window.scrollY;
      tip.hidden = false;
      var tipW = tip.offsetWidth;
      var tipH = tip.offsetHeight;
      var left = rect.left + rect.width / 2 - tipW / 2;
      var top  = scrollY + rect.top - tipH - 10;

      // Reserve space for the bottom annotation toolbar so the tooltip
      // never lands behind it.
      var annBar  = document.getElementById('annotation-toolbar');
      var barH = annBar ? annBar.offsetHeight : 0;
      var maxBottomPx = scrollY + window.innerHeight - barH - 10;

      left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));
      if (top < scrollY + 8) {
        var below = scrollY + rect.bottom + 10;
        top = (below + tipH < maxBottomPx) ? below : Math.max(scrollY + 8, top);
      }
      if (top + tipH > maxBottomPx) top = Math.max(scrollY + 8, maxBottomPx - tipH);

      tip.style.left = left + 'px';
      tip.style.top  = top  + 'px';
      btn.setAttribute('aria-expanded', 'true');
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') hideFnTooltip();
    });

    // Hide the tooltip before the next SPA navigation swaps content in.
    document.addEventListener('spa:beforeswap', hideFnTooltip);
  }

  /* ── Sidenotes (margin notes on screens ≥ 1400px) ────────── */
  var SIDENOTE_BREAK = 1400;
  var snProseEl = document.querySelector('.article-body');

  function isSidenotesActive() {
    if (!snProseEl) return false;
    if (window.innerWidth < SIDENOTE_BREAK) return false;
    if (snProseEl.getAttribute('data-rs-width') === 'wide') return false;
    return true;
  }

  function clearSidenotes() {
    var existing = document.querySelectorAll('.sidenote');
    existing.forEach(function (el) { el.remove(); });
    document.querySelectorAll('.fn-btn[data-has-sidenote]').forEach(function (btn) {
      btn.removeAttribute('data-has-sidenote');
      btn.removeAttribute('aria-controls');
    });
  }

  function buildSidenotes() {
    clearSidenotes();
    if (!isSidenotesActive()) return;

    var proseTop = snProseEl.getBoundingClientRect().top + window.scrollY;
    var minTop = 0;

    document.querySelectorAll('.fn-btn').forEach(function (btn) {
      var id = btn.getAttribute('data-fn-id') || btn.textContent.trim();
      var contentEl = btn.parentElement.querySelector('.fn-content');
      if (!contentEl) return;

      var sn = document.createElement('aside');
      sn.className = 'sidenote';
      sn.id = 'sidenote-' + id;
      sn.setAttribute('role', 'note');
      sn.setAttribute('aria-label', 'Note ' + id);
      sn.innerHTML =
        '<span class="sidenote__number" aria-hidden="true">' + id + '</span>' +
        '<p class="sidenote__text">' + contentEl.textContent + '</p>';
      snProseEl.appendChild(sn);

      // Align top of sidenote with the vertical position of its fn-ref
      var refRect  = btn.getBoundingClientRect();
      var idealTop = refRect.top + window.scrollY - proseTop;
      var top = Math.max(minTop, idealTop);
      sn.style.top = top + 'px';
      minTop = top + sn.offsetHeight + 8;

      // Mark button so tooltip is suppressed; link to sidenote for a11y
      btn.setAttribute('data-has-sidenote', 'true');
      btn.setAttribute('aria-controls', sn.id);
    });
  }

  if (snProseEl && document.querySelector('.fn-btn')) {
    buildSidenotes();
    setTimeout(buildSidenotes, 400); // rerun after fonts/images settle

    var snResizeTimer;
    if (isFirstRun) window.addEventListener('resize', function () {
      clearTimeout(snResizeTimer);
      snResizeTimer = setTimeout(buildSidenotes, 150);
    }, { passive: true });

    // Rebuild when reading width changes
    if (snProseEl) {
      var snObserver = new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
          if (m.attributeName === 'data-rs-width') {
            buildSidenotes();
          }
        });
      });
      snObserver.observe(snProseEl, { attributes: true });
    }
  }

  /* ── Footnotes (visible + print) ─────────────────────────── */
  var allFnBtns = document.querySelectorAll('.fn-btn');
  var articleFnEl = document.getElementById('article-footnotes');
  var printFnEl = document.getElementById('print-footnotes');

  if (allFnBtns.length) {
    // Build footnotes list. Clickable number jumps to the matching in-body
    // reference (`#fn-ref-N`); the sup wrapper gets a stable id here if it
    // doesn't already have one.
    function buildFnList(className, opts) {
      opts = opts || {};
      var ol = document.createElement('ol');
      ol.className = className;
      allFnBtns.forEach(function (btn) {
        var sup = btn.closest('.fn-ref') || btn.parentElement;
        var contentEl = sup ? sup.querySelector('.fn-content') : null;
        if (!contentEl) return;
        var id = btn.getAttribute('data-fn-id');
        if (sup && !sup.id) sup.id = 'fn-ref-' + (id || '');

        var li = document.createElement('li');
        if (id) li.setAttribute('value', id);
        if (opts.plainText) {
          li.textContent = contentEl.textContent;
        } else {
          var num = document.createElement('a');
          num.className = 'article-footnotes__num';
          num.href = sup && sup.id ? '#' + sup.id : '#';
          num.textContent = '[' + (id || '') + ']';
          num.setAttribute('aria-label', 'Jump to footnote ' + (id || '') + ' in the article');
          li.appendChild(num);
          li.appendChild(document.createTextNode(' '));
          // Flatten the fn-content into inline text so multi-paragraph
          // footnotes don't break the mobile list layout (block-level
          // <p> children inside an inline span produced cases where only
          // the first footnote remained visible, with the rest pushed off
          // the rendering stack by collapsed-height siblings).
          var text = document.createElement('span');
          text.className = 'article-footnotes__text';
          text.textContent = (contentEl.textContent || '').trim();
          li.appendChild(text);
        }
        ol.appendChild(li);
      });
      return ol;
    }

    // Visible footnotes section — collapsed by default so long pieces
    // don't end in a wall of notes; reader reveals on demand.
    // Idempotent: if SPA-nav re-runs this script and the section has
    // already been rendered for this page, leave it alone.
    if (articleFnEl && !articleFnEl.dataset.fnRendered) {
      articleFnEl.innerHTML = '';

      var fnHeader = document.createElement('div');
      fnHeader.className = 'article-footnotes__header';
      fnHeader.innerHTML = '<span class="article-footnotes__title">Footnotes</span>' +
        '<button class="article-footnotes__toggle" type="button" id="fn-toggle" aria-expanded="false" aria-controls="fn-body">Show footnotes</button>';
      articleFnEl.appendChild(fnHeader);

      var fnBody = document.createElement('div');
      fnBody.id = 'fn-body';
      fnBody.hidden = true;
      fnBody.appendChild(buildFnList('article-footnotes__list'));
      articleFnEl.appendChild(fnBody);

      // Clicking a number in the footnotes section scrolls to the matching
      // in-body reference and briefly flashes it, without leaving a jump
      // entry in the browser history.
      fnBody.querySelectorAll('.article-footnotes__num').forEach(function (a) {
        a.addEventListener('click', function (e) {
          var id = this.getAttribute('href').slice(1);
          if (!id) return;
          var target = document.getElementById(id);
          if (!target) return;
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          target.classList.add('footnote-flash');
          setTimeout(function () { target.classList.remove('footnote-flash'); }, 1400);
        });
      });

      fnHeader.querySelector('#fn-toggle').addEventListener('click', function () {
        var body = document.getElementById('fn-body');
        var isHidden = body.hidden;
        body.hidden = !isHidden;
        this.textContent = isHidden ? 'Hide footnotes' : 'Show footnotes';
        this.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
      });

      articleFnEl.dataset.fnRendered = 'true';
    }

    // Print footnotes — always plain text, no clickable numbers.
    if (printFnEl) {
      var pfnHeading = document.createElement('p');
      pfnHeading.className = 'print-footnotes__heading';
      pfnHeading.textContent = 'Notes';
      printFnEl.appendChild(pfnHeading);
      printFnEl.appendChild(buildFnList('print-footnotes__list', { plainText: true }));
    }
  }

  /* ── Pullquote share ──────────────────────────────────────── */
  var shareTooltip = null;

  function makeShareTooltip() {
    var el = document.createElement('button');
    el.className = 'pullquote-share';
    el.setAttribute('aria-label', 'Share this quote');
    el.innerHTML =
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>'
      + ' Share quote';
    document.body.appendChild(el);
    return el;
  }

  function hideShareTooltip() {
    if (shareTooltip) shareTooltip.style.display = 'none';
  }

  // Skip pullquote share if annotation toolbar is present (it has its own share)
  if (articleBody && !document.getElementById('annotation-toolbar')) {
    shareTooltip = makeShareTooltip();

    document.addEventListener('mouseup', function () {
      setTimeout(function () {
        var sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.toString().trim()) {
          hideShareTooltip();
          return;
        }

        // Only trigger within .article-body
        var node = sel.anchorNode;
        var inside = false;
        while (node) {
          if (node === articleBody) { inside = true; break; }
          node = node.parentNode;
        }
        if (!inside) { hideShareTooltip(); return; }

        var text = sel.toString().trim();
        if (text.length < 10 || text.length > 600) { hideShareTooltip(); return; }

        // Position tooltip above the selection
        var range = sel.getRangeAt(0);
        var rect  = range.getBoundingClientRect();
        var scrollY = window.scrollY || document.documentElement.scrollTop;

        shareTooltip.style.display  = 'inline-flex';
        shareTooltip.style.top      = (scrollY + rect.top - 44) + 'px';
        shareTooltip.style.left     = (rect.left + rect.width / 2) + 'px';

        shareTooltip.onclick = function () {
          var shareText = '\u201c' + text + '\u201d';
          var shareUrl  = window.location.href;

          if (navigator.share) {
            navigator.share({ text: shareText, url: shareUrl }).catch(function () {});
          } else if (navigator.clipboard) {
            navigator.clipboard.writeText(shareText + ' ' + shareUrl).then(function () {
              shareTooltip.textContent = 'Copied';
              setTimeout(function () {
                shareTooltip.innerHTML =
                  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>'
                  + ' Share quote';
                hideShareTooltip();
              }, 1500);
            });
          }
        };
      }, 10);
    });

    document.addEventListener('mousedown', function (e) {
      if (shareTooltip && e.target !== shareTooltip) hideShareTooltip();
    });
  }

  /* ── Cite this article ──────────────────────────────────────── */
  var citeBtn     = document.getElementById('cite-btn');
  var citeModal   = document.getElementById('cite-modal');
  var citeOverlay = document.getElementById('cite-overlay');
  var citeClose   = document.getElementById('cite-close');
  var citeText    = document.getElementById('cite-text');
  var citeCopyBtn = document.getElementById('cite-copy-btn');
  var citeTabs    = document.querySelectorAll('.cite-tab');
  var citeData    = document.getElementById('cite-data');

  if (citeBtn && citeModal && citeData) {
    var citeInfo = {
      title:       citeData.dataset.title       || '',
      author:      citeData.dataset.author      || '',
      date:        citeData.dataset.date        || '',
      publication: citeData.dataset.publication || '',
      url:         citeData.dataset.url         || window.location.href
    };

    function parseName(full) {
      var parts = full.trim().split(/\s+/);
      var last  = parts.pop() || '';
      return { first: parts.join(' '), last: last };
    }

    function citeDate(isoStr, style) {
      var d     = new Date(isoStr);
      var year  = d.getUTCFullYear();
      var month = d.toLocaleString('en-US', { month: 'long',  timeZone: 'UTC' });
      var day   = d.getUTCDate();
      if (style === 'apa')     return year + ', ' + month + ' ' + day;
      if (style === 'mla')     return day + ' ' + month + ' ' + year;
      if (style === 'chicago') return month + ' ' + day + ', ' + year;
      return String(year);
    }

    function buildCitation(format) {
      var n   = parseName(citeInfo.author);
      var url = citeInfo.url;
      var pub = citeInfo.publication;
      var t   = citeInfo.title;
      var hasAuthor = !!(n.last);

      if (format === 'apa') {
        var init = n.first ? n.first.split(/\s+/).map(function(w){ return w[0] + '.'; }).join(' ') : '';
        var auth = hasAuthor ? (n.last + (init ? ', ' + init : '') + ' ') : '';
        return auth + '(' + citeDate(citeInfo.date, 'apa') + '). ' + t + '. ' + pub + '. ' + url;
      }
      if (format === 'mla') {
        var auth = hasAuthor ? (n.last + (n.first ? ', ' + n.first : '') + '. ') : '';
        return auth + '\u201c' + t + '.\u201d ' + pub + ', ' + citeDate(citeInfo.date, 'mla') + ', ' + url + '.';
      }
      if (format === 'chicago') {
        var auth = hasAuthor ? (n.last + (n.first ? ', ' + n.first : '') + '. ') : '';
        return auth + '\u201c' + t + '.\u201d ' + pub + ', ' + citeDate(citeInfo.date, 'chicago') + '. ' + url + '.';
      }
      return '';
    }

    /* Populate print citations with all three formats on page load */
    var printCiteEl = document.getElementById('print-citations');
    if (printCiteEl) {
      var cHeading = document.createElement('p');
      cHeading.className = 'print-citations__heading';
      cHeading.textContent = 'How to Cite This Article';
      printCiteEl.appendChild(cHeading);

      [['apa', 'APA 7th'], ['mla', 'MLA 9th'], ['chicago', 'Chicago 17th']].forEach(function (pair) {
        var item = document.createElement('div');
        item.className = 'print-citations__item';

        var fmt = document.createElement('p');
        fmt.className = 'print-citations__format';
        fmt.textContent = pair[1];

        var text = document.createElement('p');
        text.className = 'print-citations__text';
        text.textContent = buildCitation(pair[0]);

        item.appendChild(fmt);
        item.appendChild(text);
        printCiteEl.appendChild(item);
      });
    }

    var currentCiteFormat = 'apa';

    function showCitation(format) {
      currentCiteFormat = format;
      if (citeText) citeText.textContent = buildCitation(format);
      citeTabs.forEach(function(tab) {
        var active = tab.dataset.format === format;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', String(active));
      });
    }

    function openCite() {
      showCitation(currentCiteFormat);
      citeModal.hidden   = false;
      citeOverlay.hidden = false;
      citeBtn.setAttribute('aria-expanded', 'true');
      if (citeClose) citeClose.focus();
    }

    function closeCite() {
      citeModal.hidden   = true;
      citeOverlay.hidden = true;
      citeBtn.setAttribute('aria-expanded', 'false');
      citeBtn.focus();
    }

    citeBtn.addEventListener('click', function() {
      if (!citeModal.hidden) { closeCite(); } else { openCite(); }
    });

    if (citeClose)   citeClose.addEventListener('click', closeCite);
    if (citeOverlay) citeOverlay.addEventListener('click', closeCite);

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && !citeModal.hidden) closeCite();
    });

    citeTabs.forEach(function(tab) {
      tab.addEventListener('click', function() { showCitation(tab.dataset.format); });
    });

    if (citeCopyBtn) {
      citeCopyBtn.addEventListener('click', function() {
        var text = citeText ? citeText.textContent : '';
        if (!text) return;
        var restore = function() {
          setTimeout(function() { citeCopyBtn.textContent = 'Copy citation'; }, 2000);
        };
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(function() {
            citeCopyBtn.textContent = 'Copied!';
            restore();
          }).catch(function() { fallbackCopy(text); });
        } else {
          fallbackCopy(text);
        }
        function fallbackCopy(t) {
          var ta = document.createElement('textarea');
          ta.value = t;
          ta.style.cssText = 'position:fixed;opacity:0';
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); citeCopyBtn.textContent = 'Copied!'; } catch(e) {}
          document.body.removeChild(ta);
          restore();
        }
      });
    }
  }

}());
