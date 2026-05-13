/**
 * Article like button (heart).
 *
 * One like per browser per article (idempotent localStorage flag). The first
 * click stores `tft-likes[url] = true` and fires an `article-like` event to
 * Umami so the global counter on the article-stats data file can be
 * incremented out-of-band by the sync-stats job. A second click toggles the
 * personal flag off and fires `article-unlike`.
 *
 * The visible count next to the heart is rendered server-side from
 * articleStats.json, so this script does not synthesise totals client-side.
 */
(function () {
  'use strict';

  var KEY = 'tft-likes';

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(data) { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} }

  function init() {
    var btn = document.getElementById('like-btn');
    if (!btn) return;
    var url = btn.getAttribute('data-url') || location.pathname;

    function refresh() {
      var likes = load();
      var liked = !!likes[url];
      btn.setAttribute('aria-pressed', liked ? 'true' : 'false');
      btn.classList.toggle('is-liked', liked);
    }

    btn.addEventListener('click', function () {
      var likes = load();
      var wasLiked = !!likes[url];
      if (wasLiked) {
        delete likes[url];
      } else {
        likes[url] = true;
      }
      save(likes);
      refresh();
      if (window.umami) {
        try { umami.track(wasLiked ? 'article-unlike' : 'article-like', { url: url }); } catch (e) {}
      }
    });

    refresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  document.addEventListener('spa:contentswap', init);
})();
