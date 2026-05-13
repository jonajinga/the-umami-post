const fs = require('fs');
const path = require('path');

module.exports = function () {
  const dir = path.join(__dirname, '..', 'authors-data');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.yml'))
    .map(f => f.replace('.yml', ''));
};
