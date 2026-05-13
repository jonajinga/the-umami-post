#!/usr/bin/env node
/**
 * generate-tts.mjs — local Kokoro TTS pipeline.
 *
 * Walks src/content/<section>/<slug>.md, generates an MP3 per article
 * via kokoro-js → ffmpeg, and writes a sidecar JSON describing the
 * source-content hash so subsequent runs skip unchanged articles.
 *
 * Usage:
 *   node scripts/generate-tts.mjs                      # incremental
 *   node scripts/generate-tts.mjs -- --force           # regenerate all
 *   node scripts/generate-tts.mjs -- --only=<slug>     # one article
 *   node scripts/generate-tts.mjs -- --voice=af_bella  # global voice override
 *
 * Outputs:
 *   src/assets/audio/<section>/<slug>.mp3  — committed to git
 *   src/assets/audio/<section>/<slug>.json — { hash, voice, durationSec, byteSize, generatedAt }
 *
 * Notes:
 *   - Model load (~30 s on first call, then cached at ~/.cache/onnx by
 *     transformers.js) happens ONCE per script run, not per article.
 *   - WAV is an intermediate temp file that ffmpeg consumes and we
 *     delete. Only the .mp3 + .json end up on disk.
 *   - 96 kbps mono MP3 for spoken word: ~3 MB / 5 min, well below
 *     Cloudflare Pages' 25 MB per-file limit.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import matter from 'gray-matter';
import removeMd from 'remove-markdown';
import ffmpegPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';
import { KokoroTTS } from 'kokoro-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

ffmpeg.setFfmpegPath(ffmpegPath);

// ── Config ──────────────────────────────────────────────────────
const CONTENT_DIR = path.join(ROOT, 'src', 'content');
const AUDIO_DIR   = path.join(ROOT, 'src', 'assets', 'audio');
const MODEL_ID    = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const DTYPE       = 'q8';
const DEFAULT_VOICE = 'af_heart';
const HASH_VERSION  = 'kokoro-q8-v1';
const MP3_BITRATE   = '96k';

// ── CLI parsing ─────────────────────────────────────────────────
const args = process.argv.slice(2);
const flags = {
  force: args.includes('--force'),
  only:  (args.find(a => a.startsWith('--only=')) || '').split('=')[1] || '',
  voice: (args.find(a => a.startsWith('--voice=')) || '').split('=')[1] || ''
};

// ── Helpers ─────────────────────────────────────────────────────
function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (entry.isFile()) yield p;
  }
}

function relSection(filePath) {
  // src/content/news/foo.md  →  ['news', 'foo']
  const rel = path.relative(CONTENT_DIR, filePath);
  const parts = rel.split(path.sep);
  const slug = parts.pop().replace(/\.md$/, '');
  const section = parts.join('/');
  return { section, slug };
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function sha256(...parts) {
  const h = crypto.createHash('sha256');
  for (const p of parts) h.update(String(p));
  return h.digest('hex');
}

function cleanForTTS(markdown) {
  // Remove footnote markers, image shortcodes, raw HTML, and YAML
  // remnants before handing the text to remove-markdown / kokoro.
  let text = markdown
    .replace(/\{%\s*image[\s\S]*?%\}/g, '')          // {% image ... %}
    .replace(/\[\^[^\]]+\]/g, '')                    // [^1] footnote refs
    .replace(/<!--[\s\S]*?-->/g, '')                  // HTML comments
    .replace(/<[^>]+>/g, ' ')                          // raw HTML tags
    .replace(/```[\s\S]*?```/g, '')                   // fenced code
    .replace(/`[^`\n]*`/g, '');                        // inline code
  text = removeMd(text, { stripListLeaders: true, useImgAltText: false });
  // Collapse whitespace
  return text.replace(/\s+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function transcodeWavToMp3(wavPath, mp3Path) {
  return new Promise((resolve, reject) => {
    ffmpeg(wavPath)
      .audioCodec('libmp3lame')
      .audioBitrate(MP3_BITRATE)
      .audioChannels(1)
      .format('mp3')
      .on('error', reject)
      .on('end', resolve)
      .save(mp3Path);
  });
}

// Build a 16-bit PCM mono WAV file from a Float32Array of audio
// samples + a sample rate. Returns a Node Buffer ready to write to
// disk. Necessary because we concatenate streamed chunks and need
// a single input for ffmpeg.
function float32ToWavBuffer(samples, sampleRate) {
  const numSamples = samples.length;
  const bytesPerSample = 2;
  const byteRate = sampleRate * bytesPerSample;
  const dataSize = numSamples * bytesPerSample;
  const buf = Buffer.alloc(44 + dataSize);
  // RIFF header
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8, 'ascii');
  // fmt chunk
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);            // chunk size
  buf.writeUInt16LE(1, 20);             // PCM format
  buf.writeUInt16LE(1, 22);             // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(bytesPerSample, 32); // block align
  buf.writeUInt16LE(16, 34);            // bits per sample
  // data chunk
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataSize, 40);
  // Float32 [-1, 1] → Int16
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    let s = samples[i];
    if (s > 1)  s = 1;
    if (s < -1) s = -1;
    buf.writeInt16LE(Math.round(s * 32767), offset);
    offset += 2;
  }
  return buf;
}

function concatFloat32(arrays) {
  let total = 0;
  for (const a of arrays) total += a.length;
  const out = new Float32Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

// Split clean article text into Kokoro-friendly sentence chunks.
// We split on terminal punctuation followed by whitespace + capital,
// then pack adjacent very-short fragments together so we don't fire
// the model on one-word sentences (which sometimes upset Kokoro).
function splitSentences(text) {
  const raw = text.split(/(?<=[.!?])\s+(?=[A-Z"'‘“(])/g);
  const out = [];
  let buf = '';
  for (const piece of raw) {
    const t = piece.trim();
    if (!t) continue;
    if ((buf + ' ' + t).length < 240) {
      // Merge with previous fragment if both are short — produces
      // more natural prosody and fewer Kokoro inference calls.
      buf = buf ? (buf + ' ' + t) : t;
    } else {
      if (buf) out.push(buf);
      buf = t;
    }
    // Hard cap per chunk to keep within the model's safe input
    // length. ~600 chars / ~120 words is comfortably under
    // Kokoro's per-call token limit.
    if (buf.length >= 600) {
      out.push(buf);
      buf = '';
    }
  }
  if (buf) out.push(buf);
  return out;
}

// Surface anything that would otherwise crash silently — without these
// handlers, an unhandled promise rejection from inside Kokoro/ONNX can
// terminate the process with no log at all.
process.on('unhandledRejection', (reason) => {
  console.error('\n[unhandledRejection]', reason && reason.stack || reason);
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  console.error('\n[uncaughtException]', err && err.stack || err);
  process.exit(1);
});
process.on('exit', (code) => {
  console.error('[process exit] code=' + code);
});

// ── Main ────────────────────────────────────────────────────────
async function main() {
  ensureDir(AUDIO_DIR);

  // Discover articles
  if (!fs.existsSync(CONTENT_DIR)) {
    console.error('No content directory at', CONTENT_DIR);
    process.exit(1);
  }
  const allMd = [...walk(CONTENT_DIR)].filter(p => p.endsWith('.md'));
  let candidates = allMd;
  if (flags.only) {
    candidates = allMd.filter(p => p.endsWith(flags.only + '.md') || p.includes('/' + flags.only + '/'));
    if (!candidates.length) {
      console.error('No article matched --only=' + flags.only);
      process.exit(1);
    }
  }
  console.log(`Scanning ${candidates.length} article${candidates.length === 1 ? '' : 's'}…`);

  // Decide which ones need work (avoid loading the model if nothing to do)
  const work = [];
  for (const filePath of candidates) {
    const { section, slug } = relSection(filePath);
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = matter(raw);
    const text = cleanForTTS(parsed.content);
    if (!text || text.length < 60) continue; // skip empties / stubs
    const voice = flags.voice || (parsed.data && parsed.data.voice) || DEFAULT_VOICE;
    const hash = sha256(text, voice, HASH_VERSION);
    const outDir = path.join(AUDIO_DIR, section);
    const mp3Path = path.join(outDir, slug + '.mp3');
    const sidecarPath = path.join(outDir, slug + '.json');

    let skip = false;
    if (!flags.force && fs.existsSync(mp3Path) && fs.existsSync(sidecarPath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(sidecarPath, 'utf8'));
        if (existing.hash === hash) skip = true;
      } catch (e) { /* fall through */ }
    }
    if (skip) {
      console.log(`  skip   ${section}/${slug}  (hash match)`);
      continue;
    }
    work.push({ filePath, section, slug, text, voice, hash, outDir, mp3Path, sidecarPath });
  }

  if (!work.length) {
    console.log('Nothing to do. Use --force to regenerate everything.');
    return;
  }
  console.log(`Generating ${work.length} article${work.length === 1 ? '' : 's'}…`);

  // Load model once. `device: 'cpu'` is the documented Node option;
  // letting it default has produced silent native crashes on Windows
  // during inference (the JS-level handlers above don't fire because
  // the crash is in the ONNX runtime native side).
  console.log(`Loading Kokoro model (${MODEL_ID}, dtype=${DTYPE}, device=cpu)…`);
  const t0 = Date.now();
  let tts;
  try {
    tts = await KokoroTTS.from_pretrained(MODEL_ID, { dtype: DTYPE, device: 'cpu' });
  } catch (err) {
    console.error('Could not load Kokoro model:', err.stack || err.message || err);
    process.exit(1);
  }
  console.log(`Model ready in ${((Date.now() - t0) / 1000).toFixed(1)} s.`);

  // Smoke test: a single tiny generate() call before the article loop.
  // If this crashes, the issue is the model + runtime + your machine,
  // not the streaming or text-handling code. Confirms basic inference
  // works and surfaces native-side errors with clear context.
  console.log('Smoke test: generating a 1-sentence sample…');
  try {
    const probe = await tts.generate('This is a smoke test.', { voice: DEFAULT_VOICE });
    const probeLen = probe && probe.audio ? probe.audio.length : 0;
    console.log(`Smoke test ok (${probeLen} samples).`);
  } catch (err) {
    console.error('Smoke test failed — Kokoro inference is broken on this machine:');
    console.error('  ', err.stack || err.message || err);
    console.error('\nTry: 1) `npm install` to refresh node_modules');
    console.error('     2) edit scripts/generate-tts.mjs and change DTYPE to "q4" (smaller model)');
    console.error('     3) check Windows: install latest Visual C++ Redistributable');
    process.exit(1);
  }

  let generated = 0, failed = 0;
  for (const item of work) {
    try {
      ensureDir(item.outDir);
      console.log(`  gen    ${item.section}/${item.slug}  (${item.text.length} chars, voice=${item.voice})`);

      const tStart = Date.now();

      // Manual sentence-by-sentence generation. Kokoro's tts.stream()
      // is convenient but a single bad sentence causes a native
      // ONNX-runtime crash that bypasses Node's error handlers and
      // kills the whole script. Calling tts.generate() per sentence
      // lets us log the offending text, catch JS-level errors, and
      // skip a problematic sentence instead of taking down the whole
      // article.
      const sentences = splitSentences(item.text);
      console.log(`         ${sentences.length} sentences`);
      const chunks = [];
      let sampleRate = 0;
      let chunkCount = 0;
      let skipped = 0;
      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        if (!sentence || sentence.length < 2) continue;
        // Pre-log so we know exactly which sentence killed the
        // process if Kokoro segfaults during inference.
        process.stdout.write(`         [${i + 1}/${sentences.length}] (${sentence.length}c) `);
        process.stdout.write(sentence.slice(0, 60).replace(/\s+/g, ' '));
        process.stdout.write('\n');
        try {
          const audio = await tts.generate(sentence, { voice: item.voice });
          const pcm = audio && (audio.audio || audio.samples || audio.data);
          const rate = audio && (audio.sampling_rate || audio.sampleRate);
          if (!pcm || !pcm.length || !rate) {
            console.warn(`         skip — no audio returned for sentence ${i + 1}`);
            skipped += 1;
            continue;
          }
          chunks.push(pcm);
          sampleRate = sampleRate || rate;
          chunkCount += 1;
        } catch (err) {
          console.warn(`         skip — generate() threw on sentence ${i + 1}: ${err.message || err}`);
          skipped += 1;
        }
      }
      if (!chunks.length || !sampleRate) {
        throw new Error('No audio produced (skipped=' + skipped + ', sentences=' + sentences.length + ')');
      }
      if (skipped) console.log(`         (${skipped} sentence${skipped === 1 ? '' : 's'} skipped)`);

      const samples = concatFloat32(chunks);
      const durationSec = samples.length / sampleRate;
      const wavBuf = float32ToWavBuffer(samples, sampleRate);

      const tmpWav = path.join(os.tmpdir(), `tft-${item.slug}-${Date.now()}.wav`);
      fs.writeFileSync(tmpWav, wavBuf);
      try {
        await transcodeWavToMp3(tmpWav, item.mp3Path);
      } finally {
        try { fs.unlinkSync(tmpWav); } catch (e) {}
      }
      const stat = fs.statSync(item.mp3Path);

      const sidecar = {
        hash: item.hash,
        voice: item.voice,
        durationSec: Math.round(durationSec * 10) / 10,
        byteSize: stat.size,
        sourceMarkdownLength: item.text.length,
        sampleRate,
        chunkCount,
        generatedAt: new Date().toISOString(),
        modelId: MODEL_ID,
        dtype: DTYPE
      };
      fs.writeFileSync(item.sidecarPath, JSON.stringify(sidecar, null, 2));

      const took = ((Date.now() - tStart) / 1000).toFixed(1);
      const mb = (stat.size / 1024 / 1024).toFixed(2);
      const min = (durationSec / 60).toFixed(1);
      console.log(`         done  ${mb} MB, ${min} min audio, ${chunkCount} chunks, took ${took} s`);
      generated += 1;
    } catch (err) {
      failed += 1;
      console.error(`  FAIL   ${item.section}/${item.slug}: ${err.message || err}`);
    }
  }

  console.log('');
  console.log(`Summary: ${generated} generated, ${failed} failed, ${work.length - generated - failed} other.`);
  process.exit(failed > 0 ? failed : 0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
