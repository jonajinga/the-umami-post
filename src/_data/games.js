const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

module.exports = function () {
  const dir = path.join(__dirname, '..', 'games-data');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.yml'))
    .map(file => yaml.load(fs.readFileSync(path.join(dir, file), 'utf8')))
    .filter(g => g && g.slug && g.title);
};
