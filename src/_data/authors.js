const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

module.exports = function () {
  const dir = path.join(__dirname, '..', 'authors-data');
  if (!fs.existsSync(dir)) return {};
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.yml'))
    .reduce((obj, file) => {
      const data = yaml.load(fs.readFileSync(path.join(dir, file), 'utf8'));
      if (data && data.slug) obj[data.slug] = data;
      return obj;
    }, {});
};
