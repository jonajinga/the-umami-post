# The Freethinking Times

Independent journalism. Investigative. Philosophical. Adversarial to power.

[![Build & Validate](https://github.com/jonajinga/the-freethinking-times/actions/workflows/build.yml/badge.svg)](https://github.com/jonajinga/the-freethinking-times/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](package.json)
[![Deployed on Cloudflare Pages](https://img.shields.io/badge/deployed-Cloudflare%20Pages-orange)](https://pages.cloudflare.com/)

Built with [Eleventy v3](https://www.11ty.dev/) and hosted on [Cloudflare Pages](https://pages.cloudflare.com/).
Content is managed via [Decap CMS](https://decapcms.org) (`/admin/`) or direct Markdown files.

**License:** [MIT](LICENSE) for code. Editorial content remains the copyright of its
authors — see the note in [LICENSE](LICENSE) if you intend to fork.

---

## Getting Started

---

### For developers

**Prerequisites:** Node.js 18 or higher, npm, git.

```bash
git clone https://github.com/jonajinga/the-freethinking-times.git
cd the-freethinking-times
npm install
cp .env.example .env       # fill in values — all optional for local builds
npm start                  # dev server at http://localhost:8080
```

The build is two-phase: Eleventy generates HTML, then Pagefind indexes it for search.
`npm start` runs both automatically. Search won't work in dev (`npm start`) — run
`npm run build && npx serve _site` to test search locally.

```bash
# Preview scheduled (future-dated) content locally:
SHOW_FUTURE=1 npm start

# Verbose build output for debugging:
npm run debug
```

See [CONTRIBUTING.md](CONTRIBUTING.md#for-developers) for coding conventions, commit
style, and the PR process.

---

### For writers and journalists

**Path 1 — Decap CMS (recommended if you don't use Git):**

1. Contact [hello@thefreethinkingtimes.com](mailto:hello@thefreethinkingtimes.com)
   to be added as a contributor (requires a free GitHub account).
2. Once added, visit [thefreethinkingtimes.com/admin/](https://thefreethinkingtimes.com/admin/)
   and authenticate with your GitHub account.
3. All content collections (News, Opinion, Analysis, Glossary, Bookshelf, etc.)
   appear in the left sidebar.

**Path 2 — Pull request (if you're comfortable with Git):**

1. Fork the repo and create a branch (`git checkout -b content/your-article-slug`).
2. Create a Markdown file in `src/content/<section>/your-slug.md`.
3. Fill in the frontmatter — see the [full reference in CONTRIBUTING.md](CONTRIBUTING.md#frontmatter-reference).
4. Set `draft: true` and `status: draft` until it's ready for review.
5. Open a PR with title format `[Section] Working Title`.

Read [EDITORIAL.md](EDITORIAL.md) before writing — it covers what belongs in each
section, sourcing standards, voice, and the corrections policy.

---

### For editors and staff

Articles move through three states controlled by frontmatter:

| State | `draft:` | `status:` | Visible on site? |
|---|---|---|---|
| Draft | `true` | `draft` | No |
| In review | `true` | `review` | No |
| Published | _(removed)_ | `published` | Yes |

To **schedule** publication, set `date:` to a future date. The daily cron job
(00:05 UTC) triggers a rebuild so the article goes live automatically.

See [CONTRIBUTING.md](CONTRIBUTING.md#for-editors-and-staff) for the full
editorial workflow, corrections process, and how to add new authors.

---

## What's Included

**Editorial features**
- 8 content sections (News, Opinion, Analysis, Arts & Culture, Science & Technology,
  History, Letters, Reviews) plus Glossary, Bookshelf, Thought Experiments, and
  Trials of Thought
- Multi-author support with auto-generated author pages and contribution stats
- 8 content profiles: standard, interview, longread, photoessay, podcast,
  datavisualization, brief, explainer
- Editorial workflow: draft → review → published
- Scheduled publishing (future-dated articles go live via daily cron)
- Email-only mode (newsletter-exclusive content — no web page, still in RSS)
- Corrections log (tracked in frontmatter, rendered automatically)
- Multi-part series with ordering and navigation
- Response threading (`responseTo:` links articles in dialogue)
- Featured article slots for homepage promotion
- Edition/issue grouping

**Reader features**
- Full-text search powered by Pagefind
- Dark/light/reading mode with no flash of wrong theme
- Customizable reading settings (font, size, line spacing)
- Reading progress indicator
- Persistent reading list ("save for later")
- Text annotations and notes
- Inline footnotes with tooltips
- Glossary term tooltips
- Keyboard shortcuts for navigation
- Newsletter subscription (Buttondown)
- Comments (Cusdis)
- RSS and Atom feeds
- Progressive Web App (installable, works offline)

**Technical**
- 100% static output (Eleventy v3)
- Zero bundler — vanilla CSS and JS
- Cloudflare Pages auto-deploy on push to `main`
- Decap CMS for non-technical contributors (with Cloudflare Access gates)
- Webhook notifications on article publish
- Scheduled daily rebuild (for future-dated articles)
- Responsive images (AVIF + WebP + JPEG, lazy-loaded)
- Auto-generated OG images (SVG → PNG)
- Sitemap, robots.txt, RSS feed
- Pagefind search index built at deploy time
- WCAG 2.2 AA accessibility target

---

## Architecture

```
.
├── .env.example              # Environment variable reference — copy to .env
├── .pages.yml.bak            # Archived Pages CMS config (superseded by src/admin/config.yml)
├── .eleventy.js              # Eleventy config: plugins, collections, filters, shortcodes
├── .github/
│   ├── workflows/
│   │   ├── build.yml             # Build & validate on every push/PR
│   │   ├── notify-on-publish.yml # Webhook on new article publish
│   │   └── scheduled-publish.yml # Daily cron to surface future-dated articles
│   ├── ISSUE_TEMPLATE/       # Bug reports, submissions, corrections, feature requests
│   └── PULL_REQUEST_TEMPLATE.md
├── src/
│   ├── _data/
│   │   ├── site.js               # Env-aware global config (reads .env + site-settings.json)
│   │   ├── site-settings.json    # CMS-editable settings (title, tagline, social, tipping)
│   │   ├── authorProfiles/       # One JSON file per author — auto-generates /author/<slug>/
│   │   ├── nav.json              # Main navigation items
│   │   ├── authors.js            # Loads all authorProfiles/ into a single data object
│   │   └── ...                   # quotes, events, gallery, playlists, library, etc.
│   ├── _includes/
│   │   ├── layouts/              # base, article, section, home, author, tag,
│   │   │                         # glossary-term, book-entry, library-*, document
│   │   └── partials/             # header, footer, article-card, author-hero, etc.
│   ├── assets/
│   │   ├── css/
│   │   │   ├── tokens.css        # ← Edit this file to rebrand the entire site
│   │   │   ├── base.css          # Reset and typography defaults
│   │   │   ├── layout.css        # Page structure and grid
│   │   │   ├── components.css    # Buttons, cards, forms, modals, nav
│   │   │   ├── article.css       # Article byline, footnotes, pull quotes, corrections
│   │   │   ├── library.css       # Full-text library reading features
│   │   │   └── main.css          # Entry point — concatenated at build time
│   │   └── js/                   # Vanilla JS, no bundler, ~28 feature-specific files
│   ├── content/
│   │   ├── content.11tydata.js   # Scheduled publish + emailOnly logic for all articles
│   │   ├── news/                 # *.md articles + news.json section metadata
│   │   ├── opinion/
│   │   ├── analysis/
│   │   ├── arts-culture/
│   │   ├── science-technology/
│   │   ├── history/
│   │   ├── letters/
│   │   └── reviews/
│   ├── glossary/                 # Freethought vocabulary entries
│   ├── bookshelf/                # Annotated reading list entries
│   ├── thought-experiments/      # Classic thought experiments
│   ├── trials/                   # Landmark trials of ideas
│   ├── library/                  # Full-text classic works (chapter by chapter)
│   ├── pages/                    # Static pages: about, ethics, masthead, style-guide, ...
│   └── api/                      # JSON endpoints: /api/articles/, /api/authors/, etc.
└── scripts/                  # Build utilities (e.g. split-gutenberg.js for library imports)
```

The canonical design system is at [`/style-guide/`](src/pages/style-guide.njk) and
pulls directly from [`tokens.css`](src/assets/css/tokens.css). Edit the tokens to
retheme the entire site.

---

## Environment Variables

All variables are optional for local development — the site builds and renders without
them, but service integrations will be no-ops.

Copy `.env.example` to `.env` and fill in the values you need.

### Core

| Variable | Required in prod? | Purpose |
|---|---|---|
| `SITE_URL` | Yes | Canonical URL (e.g. `https://thefreethinkingtimes.com`) — used in sitemaps, OG tags, RSS |
| `SITE_EMAIL` | No | Contact email; falls back to value in `site-settings.json` |

### Analytics (Umami)

| Variable | Default | Purpose |
|---|---|---|
| `UMAMI_WEBSITE_ID` | _(disabled)_ | Umami site ID — analytics only run when this is set |
| `UMAMI_SRC` | `https://cloud.umami.is/script.js` | Umami script URL (override for self-hosted) |
| `UMAMI_DASHBOARD_URL` | _(none)_ | Link to analytics dashboard (editorial use only) |

### Newsletter (Buttondown)

| Variable | Purpose |
|---|---|
| `BUTTONDOWN_USERNAME` | Your Buttondown username — powers subscribe widget |

### Comments (Cusdis)

| Variable | Purpose |
|---|---|
| `CUSDIS_APP_ID` | Cusdis app ID — comments render when this is set |

### Contact Form (Web3Forms)

| Variable | Purpose |
|---|---|
| `WEB3FORMS_ACCESS_KEY` | Web3Forms key for the contact/submission forms |

### Reader Support / Tipping

| Variable | Purpose |
|---|---|
| `KOFI_URL` | Ko-fi page URL — overrides the value in `site-settings.json` |
| `BMAC_URL` | Buy Me a Coffee URL — overrides `site-settings.json` |
| `PATREON_URL` | Patreon URL — overrides `site-settings.json` |

### GitHub Actions Secrets

These are set in **Settings → Secrets and variables → Actions** in the GitHub repo,
not in `.env`:

| Secret | Purpose |
|---|---|
| `CLOUDFLARE_DEPLOY_HOOK` | Triggers a Cloudflare Pages rebuild (used by scheduled-publish workflow) |
| `WEBHOOK_URL` | Endpoint to POST article metadata when a new article is published |
| `WEBHOOK_SECRET` | Optional — sent as `X-Webhook-Secret` header for webhook verification |

**Local-only flag (never set in production):**

```bash
SHOW_FUTURE=1 npm start   # Renders future-dated articles so you can preview them
```

---

## Deployment

### Cloudflare Pages

1. Push this repo to GitHub.
2. In Cloudflare Pages, connect the repo.
3. Set **Build command:** `npm run build`
4. Set **Output directory:** `_site`
5. Set **Environment variable:** `NODE_VERSION = 18`
6. Set `SITE_URL` to your production domain.

Cloudflare builds and deploys on every push to `main`. Pagefind indexing runs as
part of `npm run build`, so search works automatically in production.

### GitHub Actions secrets (for full automation)

- **Scheduled publishing:** Add `CLOUDFLARE_DEPLOY_HOOK` (from Cloudflare Pages →
  Settings → Deploy Hooks) to trigger a daily rebuild.
- **Publish notifications:** Add `WEBHOOK_URL` to fire a webhook when new articles land.

---

## Customisation

**Rebrand the site:** Edit [`src/assets/css/tokens.css`](src/assets/css/tokens.css).
Colors, fonts, spacing, dark mode palette — all visual variables live there.

**Site globals:** [`src/_data/site.js`](src/_data/site.js) reads from `site-settings.json`
and environment variables. Non-secret settings (title, description, social links,
tipping URLs) live in `site-settings.json` and are editable via Decap CMS.

**Navigation:** [`src/_data/nav.json`](src/_data/nav.json).

**Sections:** Defined in [`src/_data/site.js`](src/_data/site.js) — labels, colors,
and descriptions.

---

## Forking for Your Own Publication

1. Fork the repo and clone your fork.
2. `npm install && cp .env.example .env`, then fill in `.env` with your credentials.
3. **Authors:** The default author is `jon-ajinga`. Replace or rename
   `src/_data/authorProfiles/jon-ajinga.json` with your own. Update the default author
   slug in `.pages.yml` (search for `jon-ajinga`).
4. **Branding:** Update publication name and URL in `.env` and `src/_data/site-settings.json`,
   design tokens in `src/assets/css/tokens.css`, and favicon/OG image in `src/assets/`.
5. **Content:** Replace editorial content in `src/content/` with your own. The MIT
   license covers the code — it does not cover published articles, which remain the
   copyright of their authors.
6. **Deploy:** Follow the Cloudflare Pages steps above, or deploy to any static host
   that can run `npm run build`.

### Decap CMS setup

1. Create a [GitHub OAuth App](https://github.com/settings/developers) — set the callback URL to `https://[your-domain]/admin/`.
2. Add the Client ID to `src/admin/config.yml` as `app_id`.
3. Set up [Cloudflare Zero Trust Access](https://one.dash.cloudflare.com/) to gate `[your-domain]/admin/` with an email allowlist.
4. Add writers as GitHub collaborators (Write access) and to the Cloudflare Access allowlist.
5. Visit `/admin/` — Cloudflare email OTP → GitHub auth → all 26 collections appear in the sidebar.

---

## Documentation

| Document | Audience | Contents |
|---|---|---|
| [CONTRIBUTING.md](CONTRIBUTING.md) | All contributors | Setup, frontmatter reference, editorial workflow, coding standards |
| [EDITORIAL.md](EDITORIAL.md) | Writers, journalists, editors | Mission, voice, sections, sourcing, corrections, publishing checklist |
| [SECURITY.md](SECURITY.md) | Security researchers | Responsible disclosure process |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | All participants | Community standards |
| [LICENSE](LICENSE) | Everyone | MIT license (code) + editorial content note |
