/**
 * The Freethinking Times — Article Download
 * Serves article content as plain text (.txt), Markdown (.md), or ePub (.epub).
 * ePub generation uses JSZip, loaded lazily from CDN on first use.
 */

(function () {
  'use strict';

  var btn   = document.getElementById('download-btn');
  var panel = document.getElementById('download-panel');

  if (!btn || !panel) return;

  // ─── Helpers ──────────────────────────────────────────────────
  function slugify(str) {
    return (str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  function escXml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 150);
  }

  function getArticleText() {
    var el = document.querySelector('.article-body');
    return el ? el.innerText.trim() : '';
  }

  function getMeta() {
    return {
      title:  btn.dataset.title  || document.title,
      author: btn.dataset.author || '',
      date:   btn.dataset.date   || '',
      url:    btn.dataset.url    || window.location.href,
      slug:   btn.dataset.slug   || slugify(btn.dataset.title || document.title)
    };
  }

  // ─── Plain text ───────────────────────────────────────────────
  function downloadTxt() {
    var m = getMeta();
    var body = getArticleText();
    var lines = [
      m.title,
      '='.repeat(Math.min(m.title.length, 60)),
      ''
    ];
    if (m.author) lines.push('By:        ' + m.author);
    if (m.date)   lines.push('Published: ' + m.date);
    if (m.url)    lines.push('Source:    ' + m.url);
    lines.push('\u2500'.repeat(60), '', body);
    downloadBlob(
      new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }),
      m.slug + '.txt'
    );
  }

  // ─── Markdown ─────────────────────────────────────────────────
  function downloadMd() {
    var m = getMeta();
    var body = getArticleText();
    var fm = ['---', 'title: "' + m.title.replace(/"/g, '\\"') + '"'];
    if (m.author) fm.push('author: ' + m.author);
    if (m.date)   fm.push('date: '   + m.date);
    if (m.url)    fm.push('source: ' + m.url);
    fm.push('---', '');
    var content = '# ' + m.title + '\n\n' + body;
    downloadBlob(
      new Blob([fm.join('\n') + content], { type: 'text/markdown;charset=utf-8' }),
      m.slug + '.md'
    );
  }

  // ─── Panel toggle ─────────────────────────────────────────────
  // Skip toggle/auto-close when the download-panel has been relocated —
  // either into the Reader panel's Share tab (older layout) or into the
  // share popover above the annotation toolbar (current).
  function isInReaderPanel() {
    if (!panel.closest) return false;
    return !!(panel.closest('.library-panel') || panel.closest('#ann-share-popover'));
  }

  btn.addEventListener('click', function () {
    if (isInReaderPanel()) return;
    var open = this.getAttribute('aria-expanded') === 'true';
    this.setAttribute('aria-expanded', String(!open));
    panel.hidden = open;
  });

  document.addEventListener('click', function (e) {
    if (isInReaderPanel()) return;
    if (!btn.contains(e.target) && !panel.contains(e.target)) {
      btn.setAttribute('aria-expanded', 'false');
      panel.hidden = true;
    }
  });

  document.addEventListener('keydown', function (e) {
    if (isInReaderPanel()) return;
    if (e.key === 'Escape' && !panel.hidden) {
      panel.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      btn.focus();
    }
  });

  // ─── Bind download buttons ────────────────────────────────────
  var dlTxt = document.getElementById('dl-txt');
  var dlMd  = document.getElementById('dl-md');

  if (dlTxt) dlTxt.addEventListener('click', downloadTxt);
  if (dlMd)  dlMd.addEventListener('click',  downloadMd);

})();
