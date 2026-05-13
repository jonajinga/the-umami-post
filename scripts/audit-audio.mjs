import fs from 'node:fs';
import path from 'node:path';

function* walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.isFile()) yield p;
  }
}

let totalDur = 0, totalChunks = 0;
const rows = [];
for (const p of walk('src/assets/audio')) {
  if (!p.endsWith('.json')) continue;
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  const slug = p.replace(/\\/g, '/').replace('src/assets/audio/', '').replace('.json', '');
  totalDur += d.durationSec || 0;
  totalChunks += d.chunkCount || 0;
  rows.push({ slug, dur: d.durationSec, chunks: d.chunkCount, src: d.sourceMarkdownLength, voice: d.voice, generated: d.generatedAt });
}
rows.sort((a, b) => a.dur - b.dur);
console.log('SLUG'.padEnd(54) + 'SEC   MIN   CHUNKS  SRC     VOICE');
for (const r of rows) {
  console.log(
    r.slug.padEnd(54) +
    String(Math.round(r.dur)).padStart(4) + '  ' +
    (r.dur / 60).toFixed(1).padStart(4) + '   ' +
    String(r.chunks).padStart(3) + '     ' +
    String(r.src).padStart(5) + '   ' +
    r.voice
  );
}
console.log('---');
console.log('Files:        ' + rows.length);
console.log('Total audio:  ' + Math.round(totalDur / 60) + ' min, ' + totalChunks + ' chunks');
console.log('Min duration: ' + Math.round(rows[0].dur) + ' s');
console.log('Max duration: ' + Math.round(rows[rows.length - 1].dur) + ' s');
