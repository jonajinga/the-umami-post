// One-time migration script: convert JSON data arrays to individual .md files
// Run from the project root: node scripts/generate-data-collections.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function slugify(str) {
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Serialize a value to a quoted YAML string, escaping inner double quotes
function yamlStr(v) {
  return '"' + String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

// Serialize a JS value to a YAML value string (inline for primitives/arrays,
// block for objects/arrays-of-objects). indent is the current nesting level.
function yamlValue(v, indent) {
  const pad = '  '.repeat(indent);
  if (v === null || v === undefined) return '""';
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return yamlStr(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    // Array of primitives
    if (v.every(i => typeof i !== 'object' || i === null)) {
      return v.map(i => `\n${pad}  - ${yamlValue(i, indent + 1)}`).join('');
    }
    // Array of objects
    return v.map(obj => {
      const entries = Object.entries(obj).filter(([, val]) => val !== undefined);
      const firstKey = entries[0];
      const rest = entries.slice(1);
      let out = `\n${pad}  - ${firstKey[0]}: ${yamlValue(firstKey[1], indent + 2)}`;
      for (const [k, val] of rest) {
        out += `\n${pad}    ${k}: ${yamlValue(val, indent + 2)}`;
      }
      return out;
    }).join('');
  }
  // Object
  const entries = Object.entries(v).filter(([, val]) => val !== undefined);
  return entries.map(([k, val]) => `\n${pad}  ${k}: ${yamlValue(val, indent + 1)}`).join('');
}

function toFrontmatter(data) {
  const lines = [];
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (Array.isArray(v)) {
      const isObjArray = v.some(i => typeof i === 'object' && i !== null);
      if (isObjArray) {
        lines.push(`${k}:`);
        for (const obj of v) {
          const entries = Object.entries(obj).filter(([, val]) => val !== undefined);
          let first = true;
          for (const [ek, ev] of entries) {
            if (first) {
              lines.push(`  - ${ek}: ${yamlValue(ev, 2)}`);
              first = false;
            } else {
              lines.push(`    ${ek}: ${yamlValue(ev, 2)}`);
            }
          }
        }
      } else {
        lines.push(`${k}:`);
        for (const item of v) {
          lines.push(`  - ${yamlValue(item, 1)}`);
        }
      }
    } else if (typeof v === 'object') {
      lines.push(`${k}:`);
      for (const [ek, ev] of Object.entries(v)) {
        if (ev !== undefined && ev !== null && ev !== '') {
          lines.push(`  ${ek}: ${yamlValue(ev, 1)}`);
        }
      }
    } else {
      lines.push(`${k}: ${yamlValue(v, 0)}`);
    }
  }
  return `---\n${lines.join('\n')}\n---\n`;
}

function writeMd(dir, filename, data) {
  fs.mkdirSync(dir, { recursive: true });
  // Remove undefined/null optional fields to keep files clean
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
  fs.writeFileSync(path.join(dir, filename), toFrontmatter(clean));
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(root, 'src/_data', name), 'utf8'));
}

// ── Helper: wipe a dir and recreate it ──────────────────────────────────────
function resetDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
  fs.mkdirSync(dir);
}

// ── Timeline ──────────────────────────────────────────────────────────────────
const timeline = readJson('timeline.json');
const timelineDir = path.join(root, 'src/timeline-data');
resetDir(timelineDir);
timeline.forEach(item => {
  const yearStr = item.year < 0 ? `bce${Math.abs(item.year)}` : String(item.year);
  const filename = `${yearStr}-${slugify(item.title)}.md`;
  writeMd(timelineDir, filename, item);
});
console.log(`timeline: ${timeline.length} files`);

// ── Events ────────────────────────────────────────────────────────────────────
const events = readJson('events.json');
const eventsDir = path.join(root, 'src/events-data');
resetDir(eventsDir);
events.forEach(item => {
  const filename = `${item.date}-${slugify(item.name)}.md`;
  writeMd(eventsDir, filename, item);
});
console.log(`events: ${events.length} files`);

// ── Videos ────────────────────────────────────────────────────────────────────
const videos = readJson('videos.json');
const videosDir = path.join(root, 'src/videos-data');
resetDir(videosDir);
videos.forEach(item => {
  const filename = `${slugify(item.speaker)}-${slugify(item.title)}.md`;
  writeMd(videosDir, filename, item);
});
console.log(`videos: ${videos.length} files`);

// ── Feeds ─────────────────────────────────────────────────────────────────────
const feeds = readJson('feeds.json');
const feedsDir = path.join(root, 'src/feeds-data');
resetDir(feedsDir);
feeds.forEach(item => {
  const filename = `${slugify(item.name)}.md`;
  writeMd(feedsDir, filename, item);
});
console.log(`feeds: ${feeds.length} files`);

// ── Gallery ───────────────────────────────────────────────────────────────────
const gallery = readJson('gallery.json');
const galleryDir = path.join(root, 'src/gallery-data');
resetDir(galleryDir);
gallery.forEach(item => {
  const filename = `${slugify(item.alt).slice(0, 60)}.md`;
  writeMd(galleryDir, filename, item);
});
console.log(`gallery: ${gallery.length} files`);

// ── Playlists ─────────────────────────────────────────────────────────────────
const playlists = readJson('playlists.json');
const playlistsDir = path.join(root, 'src/playlists-data');
resetDir(playlistsDir);
playlists.forEach(item => {
  const filename = `${slugify(item.name)}.md`;
  writeMd(playlistsDir, filename, item);
});
console.log(`playlists: ${playlists.length} files`);

// ── Songs ─────────────────────────────────────────────────────────────────────
const songs = readJson('songs.json');
const songsDir = path.join(root, 'src/songs-data');
resetDir(songsDir);
songs.forEach(item => {
  const filename = `${slugify(item.artist)}-${slugify(item.title)}.md`;
  writeMd(songsDir, filename, item);
});
console.log(`songs: ${songs.length} files`);

// ── Games ─────────────────────────────────────────────────────────────────────
const games = readJson('games.json');
const gamesDir = path.join(root, 'src/games-data');
resetDir(gamesDir);
games.forEach(item => {
  const filename = `${item.slug}.md`;
  writeMd(gamesDir, filename, item);
});
console.log(`games: ${games.length} files`);

// ── Changelog ─────────────────────────────────────────────────────────────────
const changelog = readJson('changelog.json');
const changelogDir = path.join(root, 'src/changelog-data');
resetDir(changelogDir);
changelog.forEach(item => {
  const filename = `${item.date}-${slugify(item.title).slice(0, 50)}.md`;
  writeMd(changelogDir, filename, item);
});
console.log(`changelog: ${changelog.length} files`);

console.log('\nDone.');
