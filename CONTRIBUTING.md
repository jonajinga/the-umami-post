# Contributing to The Freethinking Times

Thanks for your interest. This document covers the **process** for contributing —
how to set up locally, how articles move from draft to published, how to add an
author, and how to submit code changes.

For editorial standards — voice, tone, section descriptions, sourcing, the
corrections policy, and the publishing checklist — see [EDITORIAL.md](EDITORIAL.md).

---

## Contents

- [For Writers and Journalists](#for-writers-and-journalists)
  - [Using Decap CMS](#using-decap-cms-recommended)
  - [Submitting via Pull Request](#submitting-via-pull-request)
  - [Frontmatter Reference](#frontmatter-reference)
  - [Editorial Workflow](#editorial-workflow)
- [For Editors and Staff](#for-editors-and-staff)
  - [Reviewing Submissions](#reviewing-submissions)
  - [Publishing](#publishing)
  - [Corrections](#corrections)
  - [Managing Authors](#managing-authors)
- [For Developers](#for-developers)
  - [Local Setup](#local-setup)
  - [Project Conventions](#project-conventions)
  - [Commit Style](#commit-style)
  - [Pull Request Process](#pull-request-process)
  - [Issue Etiquette](#issue-etiquette)

---

## For Writers and Journalists

### Using Decap CMS (recommended)

[Decap CMS](https://decapcms.org) provides a web-based editor for all content
collections — no Git knowledge required.

**Getting access:**

1. Email [hello@thefreethinkingtimes.com](mailto:hello@thefreethinkingtimes.com) to
   request contributor access. You will need a free GitHub account.
2. Once your email and GitHub account are added, visit
   [thefreethinkingtimes.com/admin/](https://thefreethinkingtimes.com/admin/).
3. Enter the one-time PIN sent to your email, then sign in with GitHub.
4. All collections appear in the left sidebar: News, Opinion, Analysis, Arts & Culture,
   Science & Technology, History, Letters, Reviews, Glossary, Bookshelf, and more.

**How saving works:**

When you save a draft in Decap CMS, it creates a pull request branch rather than
committing directly to the live site. Your article enters the editorial queue
(Drafts → In Review → Ready to Publish). An editor reviews and merges the PR
to publish. This means nothing you save goes live until an editor approves it.

---

### Submitting via Pull Request

If you're comfortable with Git:

1. Fork the repo. Create a branch: `git checkout -b content/your-article-slug`
2. Create a Markdown file in the correct section folder:
   `src/content/<section>/your-article-slug.md`
3. Write your article. Fill in the frontmatter (see reference below).
4. Set `draft: true` and `status: draft` in the frontmatter.
5. Commit and open a PR. Title format: `[Section] Working Title`
6. An editor will review, request changes if needed, and handle publication.

**Section folder names** (use these exactly):

| Section | Folder |
|---|---|
| News | `src/content/news/` |
| Opinion | `src/content/opinion/` |
| Analysis | `src/content/analysis/` |
| Arts & Culture | `src/content/arts-culture/` |
| Science & Technology | `src/content/science-technology/` |
| History | `src/content/history/` |
| Letters | `src/content/letters/` |
| Reviews | `src/content/reviews/` |

---

### Frontmatter Reference

Every article is a Markdown file with a YAML frontmatter block at the top.
Below is the complete reference. Only a handful of fields are required — the rest
are optional features you can use when they apply.

```yaml
---
# --- Required ---
layout: article
title: "Your Article Title"
description: "1–2 sentence summary. Used in article cards, social shares, and RSS.
              Keep it under 180 characters. Must work without the headline."
section: News              # See valid values below
author: author-slug        # Must match a slug in src/_data/authorProfiles/
authorName: Display Name   # Human-readable name for bylines
date: 2026-04-01           # Publication date (YYYY-MM-DD). Future dates schedule publishing.

# --- Recommended ---
image: /assets/img/your-image.jpg
imageAlt: "Descriptive alt text for the image — describe content and context."
tags:
  - topic-one
  - topic-two
status: draft              # draft | review | published

# --- Controls visibility ---
draft: true                # true = hidden from all collections. Remove to publish.
                           # Important: this is different from status: — see note below.

# --- Optional: metadata and display ---
updated: 2026-04-05        # Date of last significant edit
location: "Denver, Colorado"  # Dateline (News articles)
edition: 1                 # Issue/print edition number
profile: standard          # standard | interview | longread | photoessay |
                           # podcast | datavisualization | brief | explainer

# --- Profile-specific (only read when profile matches) ---
audioUrl: "https://..."    # Required when profile: podcast
embedUrl: "https://..."    # Required when profile: datavisualization

# --- Series ---
series: "Series Title"     # Groups multi-part articles together
seriesPart: 1              # Part number within the series

# --- Dialogue ---
responseTo: "/opinion/the-original-article/"  # Renders a "responds to" notice

# --- Editorial controls ---
featured: true             # Promotes to homepage hero slot
emailOnly: false           # true = newsletter-only; no web page, but still in RSS
                           # and newsletter collections

# --- Corrections (append; do not delete previous entries) ---
corrections:
  - date: "2026-04-03"
    description: "An earlier version stated X. It has been corrected to Y."

# --- File attachments ---
attachments:
  - name: "Source document"
    path: "/assets/files/document.pdf"
    description: "The original records this article draws on."
---
```

#### Field quick reference

| Field | Required? | Notes |
|---|---|---|
| `layout` | Yes | Always `article` for editorial content |
| `title` | Yes | The published headline |
| `description` | Yes | ≤180 chars; used in cards, SEO, RSS — must work standalone |
| `section` | Yes | Exactly one of 8 values — see table above (exact capitalization) |
| `author` | Yes | Must match a file slug in `src/_data/authorProfiles/` |
| `authorName` | Yes | Display name for the byline |
| `date` | Yes | YYYY-MM-DD. Future dates schedule the article — it hides until that date. |
| `image` | Recommended | Path to featured image |
| `imageAlt` | Required if `image` is set | Alt text — describe content and context |
| `tags` | Recommended | Kebab-case tags; drive the tag archive and related articles |
| `status` | Recommended | `draft` \| `review` \| `published` — **editorial label only** |
| `draft` | Set by editors | `true` suppresses the article from all collections and the site. **This is what actually hides the article** — `status:` does not. |
| `profile` | No | Defaults to `standard` if omitted |
| `audioUrl` | Only for `profile: podcast` | Full URL to the audio file or embed |
| `embedUrl` | Only for `profile: datavisualization` | Full URL to the embed |
| `series` | No | Exact string that groups related articles |
| `seriesPart` | No | Integer; used to order parts |
| `responseTo` | No | URL of the article this responds to |
| `featured` | No | `true` adds the article to homepage hero slots |
| `emailOnly` | No | `true` suppresses the web page but keeps the article in RSS/newsletter |
| `corrections` | No | Array of correction objects — append, never delete |
| `edition` | No | Issue number; groups articles into editions |
| `location` | No | Dateline for news pieces |

**Critical distinction — `draft` vs `status`:**

- `draft: true` is a **rendering switch**. It tells Eleventy to exclude the article
  from all collections and not generate a web page. Nothing with `draft: true` appears
  on the live site, regardless of what `status:` says.
- `status:` is an **editorial label** for tracking. It has no effect on rendering.
  `status: published` does not make an article visible if `draft: true` is also set.

When publishing, an editor removes `draft: true` and sets `status: published`.

---

### Editorial Workflow

```
Writer creates article → status: draft, draft: true
         ↓
Writer submits for review (Decap CMS save creates a PR, or manual PR)
         ↓
Editor reviews → status: review (draft: true remains — still hidden)
         ↓
Editor approves and publishes
   → removes draft: true
   → sets status: published
   → sets date: to a future date for scheduled publish, or leaves as-is for immediate
         ↓
Article goes live (immediately, or at next daily cron if future-dated)
```

**Scheduling:** Set `date:` to a future date. The daily cron job fires at 00:05 UTC
and triggers a Cloudflare Pages rebuild. Articles dated on or before that day become
visible. Allow up to 24 hours for a scheduled article to appear.

**Email-only content:** Set `emailOnly: true` to publish content to the newsletter and
RSS feed without creating a public web page. Useful for newsletter-exclusive pieces.

---

## For Editors and Staff

### Reviewing Submissions

**Via PR:** The PR queue in GitHub shows all pending submissions. Look for PRs with
title format `[Section] Title`. Check:
- Frontmatter is complete and valid (required fields present, `section:` matches a
  valid value, `author:` matches a profile slug).
- `draft: true` and `status: draft` or `status: review` are set.
- Sources are documented (in the piece or in PR comments).

**Via Decap CMS:** Drafts saved in Decap CMS appear as open PRs. Move them from
"Drafts" to "In Review" in the Decap editorial board, or change `status: review` in
the frontmatter to flag them for editorial attention.

Request changes via PR review comments or by editing the file directly and committing.

---

### Publishing

1. Open the article's Markdown file.
2. Remove `draft: true` from the frontmatter.
3. Change `status:` to `published`.
4. To publish immediately: ensure `date:` is today or in the past. Commit to `main`.
5. To schedule: set `date:` to a future date. The cron job will publish it.

**Note:** The `notify-on-publish` GitHub Actions workflow fires whenever a new `.md`
file is pushed to `src/content/**` on `main`. If `WEBHOOK_URL` is configured, it
will POST article metadata to that endpoint — useful for triggering newsletter drafts
or social posts via Zapier, Make, or a custom webhook handler.

---

### Corrections

**Never silently edit published prose.** If a factual error, misquotation, or
materially misleading statement needs correction, log it.

1. Make the correction in the article body.
2. Append a new entry to the `corrections:` array in the frontmatter:

   ```yaml
   corrections:
     - date: "2026-04-03"
       description: "An earlier version of this article stated the contract was awarded
                     in March 2025. It was awarded in September 2024."
   ```

   Include what was wrong and what it now says — not just "a date was corrected."

3. The corrections block renders automatically at the bottom of the article.

For the full policy — when a correction vs. note vs. retraction is appropriate —
see [EDITORIAL.md § Corrections Policy](EDITORIAL.md#corrections-policy).

---

### Managing Authors

Author profiles live in `src/_data/authorProfiles/<slug>.json`. Each profile
auto-generates an author page at `/author/<slug>/` with a bio, article list,
and contribution stats.

**Adding a new author:**

Create `src/_data/authorProfiles/<slug>.json`:

```json
{
  "slug": "author-slug",
  "name": "Full Name",
  "bio": "One paragraph bio. Supports Markdown.",
  "role": "Contributing Writer"
}
```

Minimum required fields: `slug`, `name`, `bio`. All other fields are optional
but recommended for a complete profile:

```json
{
  "slug": "author-slug",
  "name": "Full Name",
  "role": "Contributing Writer",
  "title": "Journalist and researcher",
  "location": "Chicago, Illinois",
  "bio": "Short bio for bylines and cards.",
  "bioLong": "<p>Full HTML bio for the author page.</p>",
  "photo": "src/assets/img/authors/author-slug.webp",
  "social": {
    "x": "https://x.com/handle",
    "bluesky": "https://bsky.app/profile/handle.bsky.social",
    "mastodon": "",
    "linkedin": "",
    "github": "",
    "threads": "",
    "instagram": "",
    "website": "",
    "email": ""
  },
  "tipping": {
    "kofi": "",
    "bmac": "",
    "patreon": ""
  }
}
```

The slug must match the `author:` field in the article frontmatter exactly.

---

## For Developers

### Local Setup

**Prerequisites:** Node.js 18+, npm, git.

```bash
git clone https://github.com/jonajinga/the-freethinking-times.git
cd the-freethinking-times
npm install
cp .env.example .env       # all values optional for local builds
npm start                  # → http://localhost:8080 with live reload
```

`npm start` and `npm run dev` are identical.

**Full production build** (including Pagefind search index):

```bash
npm run build
npx serve _site            # serve the built site locally — search works here
```

**Preview future-dated articles:**

```bash
SHOW_FUTURE=1 npm start
```

**Verbose Eleventy output for debugging:**

```bash
npm run debug
```

**Build structure — what happens when you run `npm run build`:**

1. Eleventy generates all HTML, CSS, and asset output into `_site/`.
2. Pagefind crawls `_site/` and builds the search index into `_site/pagefind/`.
3. Eleventy re-runs (second pass) to pick up any build artifacts.
4. The build hook rasterizes OG SVGs to PNGs using `@resvg/resvg-js`.

In dev (`npm start`), Pagefind doesn't run — search shows a "no index" message.
This is expected. Use `npm run build:search` to rebuild just the search index.

---

### Project Conventions

#### CSS

- **Vanilla CSS with custom properties.** No frameworks, no preprocessors.
- **Rebrand by editing `tokens.css` only.** All colors, fonts, and spacing variables
  live there. Component files reference tokens; they don't define colors directly.
- **File responsibilities:**
  - `tokens.css` — CSS custom properties (design tokens)
  - `base.css` — Reset and typography defaults
  - `layout.css` — Page structure and grid
  - `components.css` — Buttons, cards, forms, modals, nav, dropdowns
  - `article.css` — Article-specific: byline, footnotes, pull quotes, corrections
  - `library.css` — Full-text library reading features
  - `main.css` — Entry point; all partials are concatenated here at build time
- **Never use CSS `@import` in production.** The build concatenates CSS partials via
  a custom Eleventy extension. `@import` creates a waterfall of sequential requests.
- **Never split by component.** One output file (`main.css`) per build.

#### JavaScript

- **Vanilla JS, no bundler.** Files are loaded by individual templates as needed —
  there is no global JS bundle.
- **Feature-specific files.** Each file has one job (`theme.js`, `search.js`,
  `reading-settings.js`, etc.). Add new behavior in a new file; don't grow existing
  files.
- **Progressive enhancement.** Core content is accessible without JS. Interactive
  features layer on top.
- **Always add inline `onclick` handlers** on interactive elements (toggles, modals,
  search) as a fallback — the HTML minifier can break deferred event listener binding.

#### Templates

- **Nunjucks.** Prefer composing partials over duplicating markup.
- **Keep logic out of templates.** Filters and shortcodes live in `.eleventy.js`.
  Data processing belongs in `_data/` files or `.11tydata.js` files — not in template
  logic.
- **Layout aliases** are defined in `.eleventy.js` — use the short name
  (`layout: article`, not `layout: layouts/article.njk`).

#### Accessibility

- WCAG 2.2 AA minimum.
- Semantic HTML throughout — no `div` soup.
- All interactive elements keyboard-navigable.
- 4.5:1 contrast for normal text; 3:1 for large text (≥18pt or ≥14pt bold).
- Visible focus indicators (never `outline: none` without a replacement).
- Test with keyboard navigation before opening a PR.

#### Performance

- Lazy-load images.
- Minimize JS loaded per page — only include scripts that the page actually uses.
- Target < 100ms TTFB from Cloudflare's edge.
- Run `npm run build` and check the HTML output size before opening a PR for
  changes that touch layout or CSS.

---

### Commit Style

Conventional commits are preferred. Use these types:

| Prefix | Use for |
|---|---|
| `feat:` | New feature or page |
| `fix:` | Bug fix |
| `content:` | Article addition or edit (non-standard extension — makes `git log` useful for a publication) |
| `style:` | CSS/visual changes with no behavior change |
| `refactor:` | Code restructuring without behavior change |
| `docs:` | Documentation changes |
| `chore:` | Dependency updates, config, tooling |
| `ci:` | GitHub Actions workflow changes |

**Format:** imperative subject line, ≤72 characters, body explains why not what.

```
fix: prevent corrections array from rendering when empty

Nunjucks renders an empty <ul> when corrections is an empty array,
adding a blank section to articles with no corrections. Add a
length check before rendering the block.
```

---

### Pull Request Process

1. Fork the repo and create a feature branch:
   `git checkout -b feat/your-change` or `git checkout -b fix/the-bug`
2. Make your changes. One focused concern per PR.
3. Run `npm run build` and confirm no errors.
4. Verify affected pages in the dev server (`npm start`).
5. Open a PR. Fill in the PR template — delete the section that doesn't apply.
6. The `build.yml` workflow runs automatically. It must pass.
7. At least one review is required for changes to:
   - `src/assets/css/tokens.css` or layout files
   - `.eleventy.js`
   - `.github/workflows/`
   - `.pages.yml`

Smaller, focused PRs are strongly preferred. If your change touches multiple
concerns, split it.

---

### Issue Etiquette

- Use the issue templates — they route your report to the right people.
- Search open and closed issues before filing a new one.
- For security vulnerabilities, do not open a public issue — see [SECURITY.md](SECURITY.md).
- For factual errors in published articles, use the Correction Report template or
  email [hello@thefreethinkingtimes.com](mailto:hello@thefreethinkingtimes.com).

---

## Questions

Open an issue or email [hello@thefreethinkingtimes.com](mailto:hello@thefreethinkingtimes.com).
