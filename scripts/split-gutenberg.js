#!/usr/bin/env node
/**
 * Freethinking Times — Gutenberg Text Splitter
 *
 * Splits a Project Gutenberg plain text file into numbered chapter
 * Markdown files ready for the library system.
 *
 * Usage:
 *   node scripts/split-gutenberg.js \
 *     --input path/to/gutenberg.txt \
 *     --output src/library/works/work-slug/ \
 *     --pattern "CHAPTER" \
 *     --wpm 250
 *
 * Options:
 *   --input    Path to the downloaded Gutenberg .txt file (required)
 *   --output   Output directory — the work's folder (required)
 *   --pattern  String or regex pattern that starts each chapter heading (default: "CHAPTER")
 *   --wpm      Words per minute for reading time calculation (default: 250)
 *   --prefix   Chapter file prefix (default: "chapter")
 *   --dry-run  Preview what would be created without writing files
 *
 * The script:
 *   1. Strips the Gutenberg header and footer boilerplate
 *   2. Splits on the chapter pattern
 *   3. Calculates word count and reading time per chapter
 *   4. Writes numbered Markdown files with correct frontmatter
 *   5. Outputs a summary of what was created
 */

const fs = require('fs');
const path = require('path');

// Parse arguments
const args = process.argv.slice(2);
const opts = {};
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    opts[args[i].slice(2)] = args[i + 1] || true;
    i++;
  }
}

if (!opts.input || !opts.output) {
  console.error('Usage: node split-gutenberg.js --input file.txt --output dir/');
  process.exit(1);
}

const WPM = parseInt(opts.wpm || '250', 10);
const PREFIX = opts.prefix || 'chapter';
const PATTERN = opts.pattern || 'CHAPTER';
const DRY_RUN = opts['dry-run'] === true || opts['dry-run'] === 'true';

// Read input
const raw = fs.readFileSync(opts.input, 'utf8');

// Strip Gutenberg boilerplate
function stripGutenberg(text) {
  const startMarkers = [
    '*** START OF THE PROJECT GUTENBERG',
    '*** START OF THIS PROJECT GUTENBERG',
    '*END*THE SMALL PRINT',
  ];
  const endMarkers = [
    '*** END OF THE PROJECT GUTENBERG',
    '*** END OF THIS PROJECT GUTENBERG',
    'End of the Project Gutenberg',
    'End of Project Gutenberg',
  ];

  let start = 0;
  let end = text.length;

  for (const marker of startMarkers) {
    const idx = text.indexOf(marker);
    if (idx > -1) {
      start = text.indexOf('\n', idx) + 1;
      break;
    }
  }

  for (const marker of endMarkers) {
    const idx = text.lastIndexOf(marker);
    if (idx > -1) {
      end = text.lastIndexOf('\n', idx);
      break;
    }
  }

  return text.slice(start, end).trim();
}

// Convert plain text to basic Markdown
function toMarkdown(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Normalize multiple blank lines to double
    .replace(/\n{3,}/g, '\n\n')
    // Basic em dash cleanup
    .replace(/--/g, '—')
    .trim();
}

// Calculate reading time
function readingTime(text) {
  const words = text.split(/\s+/).filter(Boolean).length;
  return { words, minutes: Math.ceil(words / WPM) };
}

// Slugify a heading for the chapter slug
function slugify(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

// Main
const cleaned = stripGutenberg(raw);
const regex = new RegExp(`(^${PATTERN}[^\\n]*)`, 'gim');
const parts = cleaned.split(regex);

// parts[0] is content before first chapter heading (often blank or preamble)
// parts[1], parts[3], parts[5]... are headings
// parts[2], parts[4], parts[6]... are chapter bodies

const chapters = [];

// Handle preamble if substantial
if (parts[0] && parts[0].trim().length > 200) {
  chapters.push({
    heading: 'Preface',
    body: parts[0].trim(),
  });
}

for (let i = 1; i < parts.length; i += 2) {
  const heading = parts[i] ? parts[i].trim() : '';
  const body = parts[i + 1] ? parts[i + 1].trim() : '';
  if (heading || body) {
    chapters.push({ heading, body });
  }
}

if (chapters.length === 0) {
  console.error('No chapters found. Try a different --pattern value.');
  console.error('Common patterns: CHAPTER, PART, SECTION, BOOK');
  process.exit(1);
}

console.log(`\nFound ${chapters.length} chapters\n`);

if (!DRY_RUN) {
  fs.mkdirSync(opts.output, { recursive: true });
}

chapters.forEach((ch, idx) => {
  const num = idx + 1;
  const paddedNum = String(num).padStart(2, '0');
  const slug = `${PREFIX}-${paddedNum}`;
  const { words, minutes } = readingTime(ch.body);
  const title = ch.heading || `${PREFIX.charAt(0).toUpperCase() + PREFIX.slice(1)} ${num}`;
  const md = toMarkdown(ch.body);

  const frontmatter = [
    '---',
    `title: "${title.replace(/"/g, '\\"')}"`,
    `chapterNumber: ${num}`,
    `chapterSlug: "${slug}"`,
    `readingTimeMinutes: ${minutes}`,
    '---',
    '',
    md,
  ].join('\n');

  const filename = path.join(opts.output, `${slug}.md`);

  if (DRY_RUN) {
    console.log(`[dry-run] Would write: ${filename}`);
    console.log(`          Title: ${title}`);
    console.log(`          Words: ${words}, Reading time: ${minutes} min\n`);
  } else {
    fs.writeFileSync(filename, frontmatter);
    console.log(`✓ ${filename} — ${title} (${words} words, ~${minutes} min)`);
  }
});

console.log(`\n${DRY_RUN ? '[dry-run] ' : ''}Done. ${chapters.length} files ${DRY_RUN ? 'would be' : ''} written to ${opts.output}`);
