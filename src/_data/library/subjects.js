const works = require('./works.json');

module.exports = function () {
  const subjects = new Set();
  works.forEach(w => (w.subjects || []).forEach(s => subjects.add(s)));
  return [...subjects].sort();
};
