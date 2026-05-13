// Reformat all data collection .md files to use quoted YAML (Pages CMS compatible)
// Run from the project root: node scripts/reformat-data-collections.js
const fs = require('fs');
const path = require('path');
const matter = require('../node_modules/gray-matter');

const root = path.join(__dirname, '..');

function yamlStr(v) {
  return '"' + String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function yamlValue(v, indent) {
  const pad = '  '.repeat(indent);
  if (v === null || v === undefined) return '""';
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return yamlStr(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    if (v.every(i => typeof i !== 'object' || i === null)) {
      return v.map(i => `\n${pad}  - ${yamlValue(i, indent + 1)}`).join('');
    }
    return v.map(obj => {
      const entries = Object.entries(obj).filter(([, val]) => val !== undefined && val !== null && val !== '');
      if (!entries.length) return '';
      const [firstKey, ...rest] = entries;
      let out = `\n${pad}  - ${firstKey[0]}: ${yamlValue(firstKey[1], indent + 2)}`;
      for (const [k, val] of rest) {
        out += `\n${pad}    ${k}: ${yamlValue(val, indent + 2)}`;
      }
      return out;
    }).join('');
  }
  // Object
  const entries = Object.entries(v).filter(([, val]) => val !== undefined && val !== null && val !== '');
  if (!entries.length) return '{}';
  return entries.map(([k, val]) => `\n${pad}  ${k}: ${yamlValue(val, indent + 1)}`).join('');
}

function toFrontmatter(data) {
  const lines = [];
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;

    if (Array.isArray(v)) {
      const isObjArray = v.some(i => typeof i === 'object' && i !== null);
      lines.push(`${k}:`);
      if (isObjArray) {
        for (const obj of v) {
          const entries = Object.entries(obj).filter(([, val]) => val !== undefined && val !== null && val !== '');
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

const dirs = [
  'timeline-data', 'events-data', 'videos-data', 'feeds-data',
  'gallery-data', 'playlists-data', 'songs-data', 'games-data', 'changelog-data'
];

let total = 0;
for (const dir of dirs) {
  const fullDir = path.join(root, 'src', dir);
  if (!fs.existsSync(fullDir)) { console.log(`  skip: ${dir} (not found)`); continue; }
  const files = fs.readdirSync(fullDir).filter(f => f.endsWith('.md'));
  for (const file of files) {
    const filePath = path.join(fullDir, file);
    const { data } = matter(fs.readFileSync(filePath, 'utf8'));
    fs.writeFileSync(filePath, toFrontmatter(data));
    total++;
  }
  console.log(`${dir}: ${files.length} files reformatted`);
}
console.log(`\nTotal: ${total} files reformatted`);
