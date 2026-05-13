#!/usr/bin/env node
/**
 * send-webmentions.mjs — outgoing webmention dispatcher.
 *
 * Walks the published RSS feed, fetches each article's HTML, extracts
 * every external link from `.article-body`, discovers each target's
 * webmention endpoint, and POSTs source -> target pairs.
 *
 * Idempotent on the receiving side: webmention endpoints dedupe by
 * (source, target) so running this repeatedly is safe. No local cache
 * of sent mentions is kept, which means no state to manage and no
 * risk of drift between CI runs and the actual receivers.
 *
 * Env:
 *   SITE_URL        — defaults to https://thefreethinkingtimes.com
 *   FEED_PATH       — defaults to /feed.xml
 *   WEBMENTIONS_DRY — "1" to discover + log without POSTing
 *
 * Usage:
 *   node scripts/send-webmentions.mjs
 *   WEBMENTIONS_DRY=1 node scripts/send-webmentions.mjs   # discover-only
 */

import Parser from 'rss-parser';

const SITE_URL = (process.env.SITE_URL || 'https://thefreethinkingtimes.com').replace(/\/$/, '');
const FEED_URL = SITE_URL + (process.env.FEED_PATH || '/feed.xml');
const DRY      = process.env.WEBMENTIONS_DRY === '1';
const UA       = 'TFT-Webmention-Sender/1.0 (+' + SITE_URL + ')';

const HDR = { 'User-Agent': UA };

// Hosts that never accept webmentions and aren't worth probing every run.
// Saves network time + noise in logs. Everything else gets discovered.
const SKIP_HOSTS = [
  'youtube.com', 'youtu.be', 'www.youtube.com',
  'x.com', 'twitter.com', 'www.twitter.com',
  'facebook.com', 'www.facebook.com',
  'instagram.com', 'www.instagram.com',
  'linkedin.com', 'www.linkedin.com',
  'web.archive.org',
  'archive.org', 'archive.today', 'archive.is', 'archive.ph'
];

const parser = new Parser({ customFields: { item: [['content:encoded', 'contentEncoded']] } });

function log(...a) { console.log('[webmentions]', ...a); }
function warn(...a) { console.warn('[webmentions]', ...a); }

/** Extract external absolute URLs from an article HTML string. */
function extractExternalLinks(html, articleUrl) {
  if (!html) return [];
  const urls = new Set();
  // Match absolute href values. Simple regex; we don't need DOM parsing here.
  const re = /href\s*=\s*["'](https?:\/\/[^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = m[1].trim();
    try {
      const u = new URL(href);
      if (u.host.endsWith('thefreethinkingtimes.com')) continue;
      if (SKIP_HOSTS.includes(u.host)) continue;
      // Strip any #fragment — webmentions are per-page.
      u.hash = '';
      urls.add(u.toString());
    } catch (_) { /* skip malformed */ }
  }
  return [...urls];
}

/** Discover the webmention endpoint for a target URL.
 *  Per spec: check the Link header first, then <link rel="webmention">
 *  / <a rel="webmention"> in the document HTML. Returns absolute URL
 *  or null. */
async function discoverEndpoint(target) {
  // HEAD first for link headers; some servers don't like HEAD, fall back to GET.
  let headers = new Headers();
  let body = '';
  try {
    const res = await fetch(target, { method: 'HEAD', headers: HDR, redirect: 'follow' });
    headers = res.headers;
    if (!res.ok) throw new Error('HEAD ' + res.status);
  } catch (_) {
    try {
      const res = await fetch(target, { headers: HDR, redirect: 'follow' });
      if (!res.ok) return null;
      headers = res.headers;
      body = await res.text();
    } catch (e) { return null; }
  }

  // Link header support (RFC 8288).
  const linkHdr = headers.get('link') || headers.get('Link');
  if (linkHdr) {
    const match = linkHdr.match(/<([^>]+)>\s*;\s*rel\s*=\s*["']?[^"',]*webmention[^"',]*["']?/i);
    if (match) {
      try { return new URL(match[1], target).toString(); } catch (_) {}
    }
  }

  // Document scan if we haven't pulled it yet.
  if (!body) {
    try {
      const res = await fetch(target, { headers: HDR, redirect: 'follow' });
      if (!res.ok) return null;
      body = await res.text();
    } catch (_) { return null; }
  }

  // <link rel="webmention" href="..."> or <a rel="webmention" href="...">.
  const docMatch = body.match(/<(?:link|a)[^>]+rel\s*=\s*["'][^"']*webmention[^"']*["'][^>]*href\s*=\s*["']([^"']+)["']/i)
    || body.match(/<(?:link|a)[^>]+href\s*=\s*["']([^"']+)["'][^>]+rel\s*=\s*["'][^"']*webmention[^"']*["']/i);
  if (docMatch) {
    try { return new URL(docMatch[1], target).toString(); } catch (_) {}
  }
  return null;
}

async function sendOne(source, target, endpoint) {
  if (DRY) {
    log('  DRY', target, '->', endpoint);
    return { ok: true, dry: true };
  }
  const body = new URLSearchParams({ source, target });
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { ...HDR, 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, body: text.slice(0, 200) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function run() {
  log('feed:', FEED_URL, DRY ? '(dry run)' : '');
  const feed = await parser.parseURL(FEED_URL);
  const items = feed.items || [];
  log('articles:', items.length);

  let totalTargets = 0;
  let sent = 0;
  let noEndpoint = 0;
  let failed = 0;

  for (const item of items) {
    const source = item.link;
    if (!source) continue;
    // Prefer content:encoded for full HTML; fall back to content.
    const html = item.contentEncoded || item.content || '';
    const targets = extractExternalLinks(html, source);
    if (!targets.length) continue;
    log('•', source, `(${targets.length} external links)`);

    for (const target of targets) {
      totalTargets++;
      const endpoint = await discoverEndpoint(target);
      if (!endpoint) {
        noEndpoint++;
        continue;
      }
      const r = await sendOne(source, target, endpoint);
      if (r.ok) { sent++; log('  ✓', target, r.dry ? '' : '(' + r.status + ')'); }
      else     { failed++; warn('  ✗', target, r.status || '', r.error || r.body || ''); }
    }
  }

  log('summary:',
    'targets=' + totalTargets,
    'sent=' + sent,
    'no-endpoint=' + noEndpoint,
    'failed=' + failed);
  if (failed > 0) process.exitCode = 1;
}

run().catch(e => {
  warn('fatal:', e.message);
  process.exit(1);
});
