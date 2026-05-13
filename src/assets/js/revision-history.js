/**
 * Revision history viewer — fetches GitHub commits for the current article
 * and renders them inline inside the Reader panel's History tab.
 *
 * Repo is configured via window.__repo = { owner, name, branch }.
 * Source path comes from a #cite-data[data-source-path] attribute or
 * #revision-history-btn[data-source-path] (legacy).
 */
(function () {
  'use strict';

  var slot = document.getElementById('article-panel-history');
  if (!slot) return;

  var repo = window.__repo;
  if (!repo || !repo.owner || !repo.name) return;

  // Source path: prefer the legacy revision-history-btn (still rendered in
  // the hidden article-header__actions block) for its data-source-path.
  var btn = document.getElementById('revision-history-btn');
  var sourcePath = btn ? btn.getAttribute('data-source-path') : null;
  if (!sourcePath) return;
  sourcePath = sourcePath.replace(/^\.\//, '');

  var loaded = false;

  function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function formatDate(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) { return iso; }
  }

  function render(commits, err) {
    var url = 'https://github.com/' + repo.owner + '/' + repo.name + '/commits/' + (repo.branch || 'main') + '/' + sourcePath;
    var html;
    if (err) {
      html = '<p class="rh-empty">' + esc(err) + '</p>' +
        '<p class="rh-empty"><a href="' + url + '" target="_blank" rel="noopener">View on GitHub \u2197</a></p>';
    } else if (!commits.length) {
      html = '<p class="rh-empty">No commits found for this article.</p>';
    } else {
      html = '<ol class="rh-list">';
      commits.forEach(function (c) {
        var msg    = (c.commit.message || '').split('\n')[0];
        var author = c.author ? c.author.login : (c.commit.author && c.commit.author.name) || 'Unknown';
        var avatar = c.author && c.author.avatar_url;
        var sha    = c.sha.substring(0, 7);
        html += '<li class="rh-item">' +
          '<div class="rh-item__meta">' +
            (avatar ? '<img class="rh-avatar" src="' + esc(avatar) + '&s=32" alt="" width="20" height="20">' : '') +
            '<span class="rh-author">' + esc(author) + '</span>' +
            '<span class="rh-date">' + formatDate(c.commit.author && c.commit.author.date) + '</span>' +
          '</div>' +
          '<div class="rh-message">' + esc(msg) + '</div>' +
          '<a class="rh-sha" href="' + esc(c.html_url) + '" target="_blank" rel="noopener">' + sha + ' \u2197</a>' +
        '</li>';
      });
      html += '</ol>';
      html += '<p class="rh-empty"><a href="' + url + '" target="_blank" rel="noopener">Full history on GitHub \u2197</a></p>';
    }
    slot.innerHTML = html;
  }

  function load() {
    if (loaded) return;
    slot.innerHTML = '<p class="rh-empty">Loading commits from GitHub\u2026</p>';
    var api = 'https://api.github.com/repos/' + repo.owner + '/' + repo.name + '/commits?path=' + encodeURIComponent(sourcePath) + '&per_page=50';
    fetch(api, { headers: { 'Accept': 'application/vnd.github+json' } })
      .then(function (r) {
        if (r.status === 403) throw new Error('GitHub API rate limit reached. Try again in an hour.');
        if (r.status === 404) throw new Error('This repository is private, so revision history cannot be loaded without authentication.');
        if (!r.ok) throw new Error('Could not load commit history (HTTP ' + r.status + ').');
        return r.json();
      })
      .then(function (data) { loaded = true; render(data || []); })
      .catch(function (e) { render([], e.message); });
  }

  // Lazy-load: fetch only when the History tab section becomes visible,
  // so we don't burn through the unauthenticated GitHub rate limit on
  // pages where the user never opens the tab. Watching aria-hidden on
  // the section catches every activation path (click, keyboard, programmatic).
  if (slot.getAttribute('aria-hidden') === 'false') {
    load();
  } else if (typeof MutationObserver === 'function') {
    var mo = new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        if (records[i].attributeName === 'aria-hidden' &&
            slot.getAttribute('aria-hidden') === 'false') {
          load();
          mo.disconnect();
          break;
        }
      }
    });
    mo.observe(slot, { attributes: true, attributeFilter: ['aria-hidden'] });
  }
})();
