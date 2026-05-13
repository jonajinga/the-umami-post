/**
 * audioManifest — exposes per-article audio metadata to templates.
 *
 * Walks src/assets/audio/<section>/<slug>.json sidecars (written by
 * scripts/generate-tts.mjs) and keys them by the article URL so the
 * article-audio partial can do:
 *
 *   {% set _aud = audioManifest[page.url] %}
 *   {% if _aud %} ... {% endif %}
 *
 * Sidecar shape:
 *   { hash, voice, durationSec, byteSize, sourceMarkdownLength,
 *     generatedAt, modelId, dtype }
 *
 * The build never fails when audio files are missing — articles
 * without a generated MP3 simply don't appear in the manifest.
 */
const fs = require('fs');
const path = require('path');

function* walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (entry.isFile()) yield p;
  }
}

module.exports = function () {
  const audioDir = path.resolve(__dirname, '..', 'assets', 'audio');
  const manifest = {};
  for (const p of walk(audioDir)) {
    if (!p.endsWith('.json')) continue;
    let data;
    try { data = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { continue; }
    // src/assets/audio/news/foo.json  →  url "/news/foo/"
    const rel = path
      .relative(audioDir, p)
      .replace(/\\/g, '/')
      .replace(/\.json$/, '');
    const url = '/' + rel + '/';
    manifest[url] = {
      mp3: '/assets/audio/' + rel + '.mp3',
      voice: data.voice || '',
      duration: Number(data.durationSec) || 0,
      bytes: Number(data.byteSize) || 0,
      generated: data.generatedAt || ''
    };
  }
  return manifest;
};
