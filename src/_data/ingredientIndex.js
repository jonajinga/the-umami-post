const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

module.exports = function () {
  const dir = path.join(__dirname, '..', 'content', 'recipes');
  if (!fs.existsSync(dir)) return [];

  const map = new Map();
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));

  for (const f of files) {
    const raw = fs.readFileSync(path.join(dir, f), 'utf8');
    const parsed = matter(raw);
    const slug = f.replace(/\.md$/, '');
    const recipe = {
      url: `/recipes/${slug}/`,
      title: parsed.data.title || slug,
      hero: parsed.data.hero || null
    };
    const ings = parsed.data.ingredients || [];
    for (const ing of ings) {
      if (!ing || !ing.name) continue;
      const key = String(ing.name).trim().toLowerCase();
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, { slug: key.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''), name: ing.name, recipes: [] });
      }
      map.get(key).recipes.push(recipe);
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
};
