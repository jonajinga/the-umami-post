/**
 * Native PDF viewer — open in-page via the browser's built-in PDF
 * engine instead of forcing a tab navigation or download. Catches
 * clicks on any <a href="*.pdf"> on the same origin (or anywhere
 * we explicitly opt in via data-pdf-viewer="true").
 *
 * Uses an <iframe src="{pdf}#toolbar=1&navpanes=0&view=FitH"> in a
 * full-screen modal. Every modern desktop browser (Chrome, Edge,
 * Firefox, Safari) renders the PDF inline via its own engine; on
 * mobile Safari + Android Chrome the iframe falls back to opening
 * the PDF in a new tab, which is the right behaviour there anyway.
 *
 * Opt-out per link with data-pdf-no-viewer or rel="external".
 *
 * Wired via spa-nav.js re-inject list so it survives content swaps.
 * Single document-level listener guarded by isFirstRun.
 */
(function () {
  'use strict';

  var isFirstRun = !window.__pdfViewerBootstrapped;
  window.__pdfViewerBootstrapped = true;
  if (!isFirstRun) return;

  var SAME_ORIGIN_HOSTS = [location.hostname];

  function looksLikePdf(href) {
    if (!href) return false;
    // Path component ends in .pdf (ignoring query/hash); covers
    //   /docs/foo.pdf
    //   https://example.com/foo.pdf?download=1
    var path = href.split('#')[0].split('?')[0];
    return /\.pdf$/i.test(path);
  }

  function shouldIntercept(a, href) {
    if (!a || !href) return false;
    if (a.dataset.pdfNoViewer != null) return false;
    if ((a.getAttribute('rel') || '').indexOf('external') !== -1) return false;
    if (a.dataset.pdfViewer === 'true') return true; // explicit opt-in
    if (!looksLikePdf(href)) return false;
    // Only same-origin or relative links by default — third-party
    // hosting may set X-Frame-Options that block embedding.
    try {
      var u = new URL(href, location.href);
      if (u.origin === location.origin) return true;
      return SAME_ORIGIN_HOSTS.indexOf(u.hostname) !== -1;
    } catch (_) {
      return false;
    }
  }

  // ── Modal element (singleton, lazy-built on first PDF click) ────
  var modal, frame, titleEl, lastTrigger;

  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'pdf-modal';
    modal.id = 'pdf-modal-global';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'PDF viewer');
    modal.hidden = true;
    modal.innerHTML =
      '<div class="pdf-modal__backdrop" data-pdf-close="true"></div>' +
      '<div class="pdf-modal__panel">' +
        '<header class="pdf-modal__head">' +
          '<span class="pdf-modal__title" id="pdf-modal-title">Document</span>' +
          '<a class="pdf-modal__action" id="pdf-modal-open" href="#" target="_blank" rel="noopener">Open in new tab &nearr;</a>' +
          '<a class="pdf-modal__action" id="pdf-modal-download" href="#" download>Download</a>' +
          '<button class="pdf-modal__close" type="button" data-pdf-close="true" aria-label="Close PDF viewer">&times;</button>' +
        '</header>' +
        '<iframe class="pdf-modal__frame" id="pdf-modal-frame" title="PDF document"></iframe>' +
      '</div>';
    document.body.appendChild(modal);
    titleEl = modal.querySelector('.pdf-modal__title');
    frame   = modal.querySelector('#pdf-modal-frame');

    modal.addEventListener('click', function (e) {
      if (e.target.dataset.pdfClose === 'true') closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) closeModal();
    });
    return modal;
  }

  function openPdf(href, label) {
    ensureModal();
    titleEl.textContent = label || 'Document';
    var openLink = modal.querySelector('#pdf-modal-open');
    var dlLink   = modal.querySelector('#pdf-modal-download');
    openLink.href = href;
    dlLink.href = href;
    // #toolbar=1 keeps the browser's native PDF toolbar visible
    // (zoom, page nav, print). #view=FitH starts at fit-width.
    frame.src = href + (href.indexOf('#') === -1 ? '#toolbar=1&navpanes=0&view=FitH' : '');
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    if (window.umami && typeof window.umami.track === 'function') {
      try { umami.track('pdf-open', { url: href }); } catch (_) {}
    }
  }

  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    if (frame) frame.src = 'about:blank'; // free the resource
    document.body.style.overflow = '';
    if (lastTrigger && typeof lastTrigger.focus === 'function') lastTrigger.focus();
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href');
    if (!shouldIntercept(a, href)) return;
    // Ctrl/Cmd/middle click — let the browser handle natively.
    if (e.ctrlKey || e.metaKey || e.button === 1 || a.target === '_blank') return;
    e.preventDefault();
    lastTrigger = a;
    openPdf(href, a.textContent.trim() || a.getAttribute('aria-label') || 'Document');
  });
})();
