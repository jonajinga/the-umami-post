# The Umami Post

A community food publication. Tested recipes, technique guides, food journalism, and reviews -- written by cooks, for cooks. Free and open source.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](package.json)
[![Deployed on Cloudflare Pages](https://img.shields.io/badge/deployed-Cloudflare%20Pages-orange)](https://pages.cloudflare.com/)

Built with [Eleventy v3](https://www.11ty.dev/) and hosted on [Cloudflare Pages](https://pages.cloudflare.com/).
Editorial content is licensed Creative Commons. The code is MIT.

---

## Why

Most food media is owned by people who do not cook for a living and answer to advertisers who do not eat the food they sponsor. The result is content engineered for engagement rather than the dinner table.

The Umami Post is community-owned: every contributor is a cook, every recipe is tested, every line of code is on GitHub. Submit a recipe, pitch a story, or open a pull request. The site belongs to the cooks who use it.

---

## What's on the site

- **Recipes** -- structured, scaleable, with ingredient checklists and a hands-free cooking mode
- **Techniques** -- step-by-step how-to guides linked from every recipe that uses them
- **Stories** -- food journalism, food culture, food science, food history, opinion
- **Reviews** -- cookbooks, restaurants, equipment, pantry staples, honestly assessed
- **Submission forms** for every content type
- **Cook profiles** for every contributor

Every recipe carries Schema.org Recipe markup, prep/cook/total times, dietary tags, and a serving scaler. Search runs locally via Pagefind. Comments via Cusdis. Newsletter via Buttondown. Analytics via Umami.

---

## Getting started

```bash
git clone https://github.com/jonajinga/the-umami-post.git
cd the-umami-post
npm install
cp .env.example .env       # optional for local builds
npm start                  # dev server at http://localhost:8080
```

The build is two-phase: Eleventy generates HTML, then Pagefind indexes it for search. `npm start` runs Eleventy with the live-reload server. Run `npm run build && npx serve _site` to test the full build (Pagefind only runs on full builds).

---

## Contributing

Three paths:

**1. Submit a recipe from the website.** No GitHub needed. The [`/submit/recipe/`](https://theumamipost.com/submit/recipe/) form goes to our editorial inbox. We test, edit, credit you, and publish under Creative Commons.

**2. Pitch a story, technique, or review.** [`/submit/`](https://theumamipost.com/submit/) lists every contribution path.

**3. Open a pull request.** For code or for content. See [CONTRIBUTING.md](CONTRIBUTING.md) for conventions and the editorial workflow in [EDITORIAL.md](EDITORIAL.md).

---

## Tech

- [Eleventy v3](https://www.11ty.dev/) static site generator
- Nunjucks templates, Markdown content, vanilla CSS and JS, no bundler
- CSS concatenated at build time (no `@import` waterfall)
- [Pagefind](https://pagefind.app/) for client-side search
- [Web3Forms](https://web3forms.com/) for submissions
- [Buttondown](https://buttondown.com/) for newsletter
- [Cusdis](https://cusdis.com/) for comments
- [Umami](https://umami.is/) for analytics
- [Cloudflare Pages](https://pages.cloudflare.com/) for hosting

Responsive images (AVIF / WebP / JPEG) via `@11ty/eleventy-img`. WCAG 2.2 AA. Square-corner editorial design. Warm magazine palette: cream `#FAF6EF`, cocoa `#2B1F18`, saffron `#D4793A`, olive `#6B7340`. Playfair Display + Source Serif 4 + Inter, served from [Bunny Fonts](https://fonts.bunny.net/).

---

## Project structure

```
.
├── .eleventy.js              # Eleventy config: plugins, filters, shortcodes, PurgeCSS, Pagefind
├── src/
│   ├── _data/
│   │   ├── site.js               # Global config (env-aware)
│   │   ├── site-settings.json    # Editor-facing settings
│   │   ├── nav.json, megaMenu.json, drawerLinks.json, footerLinks.json
│   │   ├── subsections.js        # per-section subsection labels
│   │   ├── authors.js            # aggregates src/authors-data/*.yml
│   │   └── ingredients.js        # auto-built from recipe front-matter
│   ├── _includes/
│   │   ├── layouts/              # base, recipe, technique, review, article, section, ...
│   │   └── partials/             # header, footer, recipe-meta-bar, ingredient-list,
│   │                             # instruction-list, recipe-card, recipe-jsonld, ...
│   ├── assets/
│   │   ├── css/                  # tokens.css + base/layout/components/article/recipe/...
│   │   └── js/                   # serving-scaler, ingredient-checklist, cooking-mode, ...
│   ├── content/
│   │   ├── recipes/              # *.md files with structured front-matter
│   │   ├── techniques/
│   │   ├── reviews/
│   │   ├── news/, opinion/, deep-dives/, food-culture/, food-science/,
│   │   │   food-history/, cooks-letters/
│   │   └── content.11tydata.js
│   ├── authors-data/             # one *.yml per cook contributor
│   ├── pages/                    # static pages: submission forms, about, ethics, ...
│   └── api/                      # JSON endpoints
├── _headers, _redirects          # Cloudflare Pages
└── scripts/                      # build utilities
```

To rebrand: edit [`src/assets/css/tokens.css`](src/assets/css/tokens.css). All colors, fonts, spacing, and dark-mode palette live there.

---

## License

- **Code:** [MIT](LICENSE) -- use, fork, modify, redistribute.
- **Recipes:** Creative Commons Attribution-ShareAlike 4.0 -- cook, copy, adapt, republish with credit.
- **Editorial articles, reviews, photography:** Copyright the individual authors. Contact the author for republishing rights.

---

## Deployment

Cloudflare Pages:

1. Push to GitHub.
2. Connect the repo in Cloudflare Pages.
3. Build command: `npm run build`
4. Output directory: `_site`
5. Env: `NODE_VERSION=20`, `SITE_URL=https://theumamipost.com`
6. Optional: `WEB3FORMS_ACCESS_KEY`, `UMAMI_WEBSITE_ID`, `BUTTONDOWN_USERNAME`, `CUSDIS_APP_ID`

Pushes to `main` build and deploy automatically.

---

Built with care by [Pikes Peak Web Designs](https://pikespeakwebdesigns.com).
