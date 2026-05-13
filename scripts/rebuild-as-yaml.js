// Convert all data collection .md files to pure .yml files (no frontmatter markers)
// Run from the project root: node scripts/rebuild-as-yaml.js
const fs = require('fs');
const path = require('path');
const matter = require('../node_modules/gray-matter');
const yaml = require('../node_modules/js-yaml');

const root = path.join(__dirname, '..');

const dirs = [
  'authors-data', 'quotes-data',
  'timeline-data', 'events-data', 'videos-data', 'feeds-data',
  'gallery-data', 'playlists-data', 'songs-data', 'games-data', 'changelog-data'
];

let total = 0;
for (const dir of dirs) {
  const fullDir = path.join(root, 'src', dir);
  if (!fs.existsSync(fullDir)) { console.log(`  skip: ${dir}`); continue; }

  const mdFiles = fs.readdirSync(fullDir).filter(f => f.endsWith('.md'));
  for (const file of mdFiles) {
    const filePath = path.join(fullDir, file);
    const { data } = matter(fs.readFileSync(filePath, 'utf8'));

    // Write as pure YAML (no --- markers)
    const ymlPath = filePath.replace(/\.md$/, '.yml');
    fs.writeFileSync(ymlPath, yaml.dump(data, { lineWidth: 120, quotingType: '"', forceQuotes: false }));

    // Delete old .md file
    fs.unlinkSync(filePath);
    total++;
  }
  console.log(`${dir}: ${mdFiles.length} files converted to .yml`);
}
console.log(`\nTotal: ${total} files converted`);
