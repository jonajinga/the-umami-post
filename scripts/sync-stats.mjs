#!/usr/bin/env node
/**
 * sync-stats.mjs — pull per-article pageviews + share/like event counts
 * from Umami Cloud and write `src/_data/articleStats.json`.
 *
 * Run:
 *   UMAMI_API_KEY=xxx UMAMI_WEBSITE_ID=xxx node scripts/sync-stats.mjs
 *
 * Required env:
 *   UMAMI_API_KEY      — Cloud API key (Settings → Profile → API)
 *   UMAMI_WEBSITE_ID   — UUID of the website (Settings → Websites → ID)
 *
 * Optional env:
 *   UMAMI_API_BASE     — defaults to https://api.umami.is/v1
 *                        self-hosted: https://your-umami.example/api
 *   STATS_LOOKBACK_DAYS — default 365
 *
 * The script:
 *   1. Lists pageview totals per URL for the lookback window
 *   2. Queries event counts for share-* and article-like
 *   3. Maps them by URL and writes the JSON file the build reads
 *
 * If the JSON file is missing or empty, the article meta line + the
 * /most-read/ chart hide gracefully — nothing visible breaks.
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const API_KEY  = process.env.UMAMI_API_KEY;
const SITE_ID  = process.env.UMAMI_WEBSITE_ID;
const API_BASE = process.env.UMAMI_API_BASE || 'https://api.umami.is/v1';
const LOOKBACK = Number(process.env.STATS_LOOKBACK_DAYS || 365);

if (!API_KEY || !SITE_ID) {
  console.error('Missing UMAMI_API_KEY or UMAMI_WEBSITE_ID env vars.');
  process.exit(1);
}

const startAt = Date.now() - LOOKBACK * 24 * 60 * 60 * 1000;
const endAt   = Date.now();

async function umami(path, params = {}) {
  const url = new URL(API_BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const r = await fetch(url, {
    headers: { 'x-umami-api-key': API_KEY, 'Accept': 'application/json' }
  });
  if (!r.ok) throw new Error(`Umami ${r.status} ${r.statusText} on ${path}`);
  return r.json();
}

function normalizeUrl(u) {
  if (!u) return '';
  let s = u.split('?')[0].split('#')[0];
  if (!s.startsWith('/')) s = '/' + s;
  if (!s.endsWith('/'))   s = s + '/';
  return s;
}

// Get the per-URL count for an event by reading the values of
// the `url` property we attach in the client (see like-btn.js's
// `umami.track('article-like', { url })` call).
//
// Endpoint: /api/websites/{id}/event-data/values
// Params:   startAt, endAt, eventName, propertyName=url
// Returns:  [{ value: "/news/foo/", total: N }, ...]
//
// This is the only Umami query shape that yields per-URL counts of
// custom events. The previous /metrics?type=event approach grouped
// by event NAME (so all 12 likes ended up bucketed under a fake
// /article-like/ path); /events lists records but Cloud doesn't
// expose it for filtered queries the way I assumed.
async function fetchEventValuesByUrl(eventName) {
  const tryEndpoints = [
    '/websites/' + SITE_ID + '/event-data/values',
    '/websites/' + SITE_ID + '/event-data/properties' // last-ditch diagnostic
  ];
  let resp = null;
  let lastErr = null;
  try {
    resp = await umami(tryEndpoints[0], {
      startAt, endAt, eventName, propertyName: 'url'
    });
  } catch (e) {
    lastErr = e;
  }
  if (!resp || (!Array.isArray(resp) && !resp.data)) {
    if (lastErr) throw lastErr;
    return [];
  }
  return Array.isArray(resp) ? resp : (resp.data || []);
}

async function main() {
  // Pageviews per URL
  const pages = await umami(`/websites/${SITE_ID}/metrics`, {
    type: 'url', startAt, endAt, limit: 5000
  });
  const stats = {};
  for (const row of pages || []) {
    const url = normalizeUrl(row.x);
    if (!url || url === '/') continue;
    stats[url] = stats[url] || { views: 0, shares: 0, likes: 0 };
    stats[url].views += Number(row.y || 0);
  }

  // Per-URL event counts via event-data values.
  // article-unlike fires from like-btn.js when a user toggles their
  // like off; we subtract those so the displayed count is the *net*
  // active likes, not gross button clicks. Without this a user who
  // toggled like → unlike → like read as 2 likes when they ended up
  // with 1.
  const events = ['share-twitter', 'share-linkedin', 'share-bluesky',
                  'share-mastodon', 'share-reddit', 'share-facebook',
                  'share-email', 'share-copy',
                  'article-like', 'article-unlike'];
  for (const name of events) {
    let rows = [];
    try {
      rows = await fetchEventValuesByUrl(name);
    } catch (e) {
      console.warn(`event ${name}: ${e.message}`);
      continue;
    }
    let added = 0;
    for (const row of rows) {
      // Defensive across Umami response shapes — different versions
      // have used `value`/`x`/`url` for the property value and
      // `total`/`y`/`count` for the count.
      const raw = row.value != null ? row.value
                : row.x     != null ? row.x
                : row.url   != null ? row.url
                : '';
      const cnt = Number(row.total != null ? row.total
                       : row.y     != null ? row.y
                       : row.count != null ? row.count
                       : 0) || 0;
      const url = normalizeUrl(raw);
      // Skip entries whose value isn't a real article path — Umami
      // can return raw event names if the property wasn't actually
      // attached to the event, and we don't want those to leak into
      // the stats again.
      if (!url || url === '/' || /^\/(article-|share-)/.test(url)) continue;
      stats[url] = stats[url] || { views: 0, shares: 0, likes: 0 };
      if (name === 'article-like')        stats[url].likes  += cnt;
      else if (name === 'article-unlike') stats[url].likes  -= cnt;
      else                                 stats[url].shares += cnt;
      added += cnt;
    }
    if (added) console.log(`  ${name}: ${added} (across ${rows.length} URL${rows.length === 1 ? '' : 's'})`);
    else if (rows.length === 0) console.log(`  ${name}: (no rows)`);
  }
  // Floor likes at 0 — if a URL had more unlike events than likes
  // (e.g. analytics retention dropped some old like events), don't
  // show a negative number.
  for (const url of Object.keys(stats)) {
    if (stats[url].likes < 0) stats[url].likes = 0;
  }

  // Sanity-cap shares relative to views. Umami's data-umami-event
  // auto-track attaches a fresh click listener every time progress.js
  // re-runs (which happens on every SPA nav), so a single click can
  // emit the share-* event multiple times once a reader has navigated
  // around. We saw an article with 87 views and 1000 "shares", which
  // is ~11× more shares than views — implausible for any real article.
  // Cap at 30 % of pageviews (typical viral article tops out around
  // 3-5 %; 30 % is a generous ceiling) so a malformed sync run can't
  // bleed obviously-wrong numbers into the article meta line.
  for (const url of Object.keys(stats)) {
    const cap = Math.max(0, Math.round((stats[url].views || 0) * 0.3));
    if (stats[url].shares > cap) {
      console.warn(`  shares cap: ${url} reduced ${stats[url].shares} -> ${cap} (views: ${stats[url].views})`);
      stats[url].shares = cap;
    }
  }

  const out = join(__dirname, '..', 'src', '_data', 'articleStats.json');
  await writeFile(out, JSON.stringify(stats, null, 2));
  const totals = Object.values(stats).reduce((a, s) => ({ v: a.v + s.views, s: a.s + s.shares, l: a.l + s.likes }), { v: 0, s: 0, l: 0 });
  console.log(`Wrote ${Object.keys(stats).length} article stats → ${out}`);
  console.log(`Totals: ${totals.v} views, ${totals.s} shares, ${totals.l} likes`);
}

main().catch(err => { console.error(err); process.exit(1); });
