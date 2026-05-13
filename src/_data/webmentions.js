// Build-time Webmentions fetcher.
//
// Pulls every mention webmention.io has received for this domain and
// groups them by target URL so templates can look up `webmentions[page.url]`.
//
// Output shape:
//   {
//     "/news/some-article/": {
//       replies:  [{ author, content, url, published, ... }, ...],
//       likes:    [{ author, url, published }, ...],
//       reposts:  [{ author, url, published }, ...],
//       mentions: [{ ... }, ... ],   // generic "mention-of" references
//       total:    N
//     },
//     ...
//   }
//
// Build-time means new mentions don't appear until the next deploy.
// Cached 24h via @11ty/eleventy-fetch so dev builds stay fast. The cache
// lives in .cache/ — delete it to force a fresh pull.
//
// Safe on failure: if webmention.io is unreachable or the token is blank,
// returns {} and templates render their empty state.

const EleventyFetch = require('@11ty/eleventy-fetch');
const site = require('./site.js');

const API_BASE = 'https://webmention.io/api/mentions.jf2';

// Normalise any incoming URL into a key that matches Eleventy's page.url
// ("/section/slug/"). webmention.io returns the full URL; strip origin +
// trailing index.html if present.
function normaliseUrl(u) {
  if (!u) return '';
  try {
    var parsed = new URL(u);
    var path = parsed.pathname || '/';
    path = path.replace(/\/index\.html?$/i, '/');
    if (!path.endsWith('/') && !/\.[a-z0-9]+$/i.test(path)) path += '/';
    return path;
  } catch (_) {
    return u;
  }
}

function isBlocked(mention, blocklist) {
  if (!blocklist || !blocklist.length) return false;
  var authorUrl = (mention.author && mention.author.url) || '';
  var sourceUrl = mention.url || '';
  var hay = (authorUrl + ' ' + sourceUrl).toLowerCase();
  return blocklist.some(function (term) { return term && hay.indexOf(String(term).toLowerCase()) !== -1; });
}

function bucketFor(type) {
  switch (type) {
    case 'in-reply-to': return 'replies';
    case 'like-of':
    case 'favorite-of': return 'likes';
    case 'repost-of': return 'reposts';
    case 'bookmark-of':
    case 'mention-of':
    default:            return 'mentions';
  }
}

module.exports = async function () {
  const cfg = site.webmention || {};
  if (!cfg.token || !cfg.domain) return {};

  const url = API_BASE
    + '?domain=' + encodeURIComponent(cfg.domain)
    + '&token='  + encodeURIComponent(cfg.token)
    + '&per-page=1000';

  let data;
  try {
    data = await EleventyFetch(url, {
      duration: '1d',
      type: 'json',
      directory: '.cache',
      verbose: false
    });
  } catch (e) {
    console.warn('[webmentions] fetch failed:', e.message);
    return {};
  }

  const items = (data && data.children) || [];
  const grouped = {};

  items.forEach(function (m) {
    if (m['wm-private']) return;
    if (isBlocked(m, cfg.blocklist)) return;
    var target = normaliseUrl(m['wm-target'] || m.url || '');
    if (!target) return;
    if (!grouped[target]) grouped[target] = { replies: [], likes: [], reposts: [], mentions: [], total: 0 };
    var bucket = bucketFor(m['wm-property']);
    grouped[target][bucket].push({
      id: m['wm-id'],
      property: m['wm-property'],
      url: m.url,
      published: m.published || m['wm-received'],
      author: m.author || {},
      content: (m.content && (m.content.text || m.content.html)) || '',
      name: m.name || ''
    });
    grouped[target].total += 1;
  });

  // Newest first per bucket.
  Object.keys(grouped).forEach(function (k) {
    ['replies', 'likes', 'reposts', 'mentions'].forEach(function (b) {
      grouped[k][b].sort(function (a, c) {
        return new Date(c.published || 0) - new Date(a.published || 0);
      });
    });
  });

  // Demo mode: set WEBMENTIONS_DEMO=1 locally (or in a preview branch)
  // to inject fake mentions on the most recent article so you can see
  // the template render without waiting for real ones. Never runs in
  // production — the env var is not set in Cloudflare Pages.
  if (process.env.WEBMENTIONS_DEMO === '1') {
    // Grab the most recent article URL from the site's collections. We
    // don't have direct access here, so target "/" plus whatever looks
    // like a recent article pattern. Cleanest: target '/' so it appears
    // on the home page too — but actually we want it on an article.
    // Safest: iterate collections in the template. For the data file, we
    // wire a sample target that any article layout can look up by also
    // merging into any article URL that's seen.
    //
    // Simpler: attach the demo bundle to a magic key "__demo" that the
    // partial can pick up when no real mentions exist for the page.
    grouped.__demo = {
      replies: [
        {
          id: 'demo-1',
          property: 'in-reply-to',
          url: 'https://example.com/alice/2026/04/reply-to-freethinking-times',
          published: '2026-04-14T11:32:00Z',
          author: {
            name: 'Alice Renfield',
            url: 'https://aliceblog.example.com',
            photo: ''
          },
          content: 'This is exactly the framing we have been missing in coverage of institutional capture. The section on regulatory drift alone is worth the subscription.',
          name: ''
        },
        {
          id: 'demo-2',
          property: 'in-reply-to',
          url: 'https://mastodon.social/@someone/11144223',
          published: '2026-04-13T22:05:00Z',
          author: {
            name: 'Dr M. Hirsch',
            url: 'https://hirsch.example.org',
            photo: ''
          },
          content: 'Pinned. Will be assigning this to my graduate seminar next week.',
          name: ''
        }
      ],
      likes: [
        { id: 'demo-l-1', property: 'like-of', url: 'https://x.example.com/a/status/1', published: '2026-04-14T09:00:00Z', author: { name: 'J. Rivera',  url: 'https://jrivera.example.com',  photo: '' } },
        { id: 'demo-l-2', property: 'like-of', url: 'https://x.example.com/b/status/2', published: '2026-04-14T08:12:00Z', author: { name: 'K. Osei',    url: 'https://osei.example.net',     photo: '' } },
        { id: 'demo-l-3', property: 'like-of', url: 'https://x.example.com/c/status/3', published: '2026-04-13T19:44:00Z', author: { name: 'P. Ortega',  url: 'https://ortega.example.com',   photo: '' } },
        { id: 'demo-l-4', property: 'like-of', url: 'https://x.example.com/d/status/4', published: '2026-04-13T17:08:00Z', author: { name: 'S. Nakagawa',url: 'https://nakagawa.example.jp',  photo: '' } },
        { id: 'demo-l-5', property: 'like-of', url: 'https://x.example.com/e/status/5', published: '2026-04-13T12:00:00Z', author: { name: 'R. Bellamy', url: 'https://bellamy.example.uk',   photo: '' } }
      ],
      reposts: [
        { id: 'demo-r-1', property: 'repost-of', url: 'https://bsky.example.com/post/1', published: '2026-04-14T07:30:00Z', author: { name: 'L. Cho',    url: 'https://cho.example.com',    photo: '' } },
        { id: 'demo-r-2', property: 'repost-of', url: 'https://bsky.example.com/post/2', published: '2026-04-13T21:00:00Z', author: { name: 'A. Kowalski', url: 'https://kowalski.example.pl', photo: '' } }
      ],
      mentions: [
        {
          id: 'demo-m-1',
          property: 'mention-of',
          url: 'https://thoughtful-reader.example.com/2026/04/15/further-reading',
          published: '2026-04-15T10:00:00Z',
          author: { name: 'The Thoughtful Reader', url: 'https://thoughtful-reader.example.com', photo: '' },
          content: ''
        }
      ],
      total: 2 + 5 + 2 + 1
    };
  }

  return grouped;
};
