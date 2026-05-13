# Plan: Greatly enhance Editorial Dashboard + Editorial Board

Working notes / architecture draft. Not user-facing copy. Anything in here is debatable; this is what I'd build given a free hand, ranked by leverage.

## Context

Today (2026-04-25) we have two related surfaces:

- **`/dashboard/`** — status counts, active assignments, per-section breakdown. ~440 lines of inline Nunjucks. Useful glance, not actionable.
- **`/editorial/board/`** — three-column kanban (Draft / Review / Published) filtered by section. Useful as a worklist, not a workflow tool.

Both are read-only views of `collections.allContent`. Because the site is statically generated on every push, **anything that requires "click to change article status" is impossible without a server.** Every enhancement below is read-only — it surfaces information the build already has access to but doesn't currently expose.

The team this serves: solo editor + small contributor pool, not a 50-person newsroom. Editorial overhead has to stay low.

---

## Editorial Dashboard — proposed enhancements

### 1. Production pulse (cards-per-week sparkline)
A small bar chart along the top that shows articles published per week for the last 12 weeks. Built from `collections.allContent` filtered by `date`. CSS-only with `:nth-child` widths derived from build-time data, no charting library. **Why:** instant signal of whether output is steady, dropping, or spiking.

### 2. Per-author scoreboard
Table sorted by lifetime word count: author name, articles published, drafts in flight, last-published date, average reading time, last 3 article titles. Pulled from `authorList` cross-referenced with `collections.allContent`. **Why:** shows which contributors are warm, which have gone quiet, who has unfinished work.

### 3. Stale-content alerts
A "needs attention" panel that lists:
- Drafts older than 14 days (front-matter `date` ≥14 days ago, `status: draft`)
- Articles with corrections logged in the last 30 days
- Articles with `lastUpdated` older than 6 months in fast-moving sections (News, Politics)
- Articles whose `inResponseTo` target no longer exists (broken response chains)

Each item links straight to the article and a "spike" suggestion. **Why:** kills the "I forgot about that draft" failure mode.

### 4. Coverage gap report
A grid showing each editorial section with: last published date, articles in last 14 days, articles in last 90 days. Sections with zero in last 14 are flagged amber; zero in last 90 are flagged red. **Why:** prevents sections from quietly dying.

### 5. Webmention + comment moderation feed
A live-ish panel pulling the most recent 10 webmentions and the most recent 10 Cusdis comments (via Cusdis API at build time). Each row links to the article + the source. **Why:** the dashboard becomes the single place to triage incoming reader engagement.

### 6. Engagement funnel (Umami-fed)
A four-step bar: Drafts in pipeline → In review → Published this month → Tipped this month. Tip count from Umami's `support-author` event aggregate. **Why:** a quick "is this whole machine working" read.

### 7. Scheduling agenda strip
A horizontal week strip showing the next 14 days. Each day cell shows count of scheduled posts (front-matter `date` in the future, with `SHOW_FUTURE` honored). **Why:** prevents Tuesday mornings with three pieces all queued for the same hour.

### 8. Per-author tip totals (Umami-fed, optional)
For each author, total `support-author` clicks where `data-umami-event-feed=author-{slug}` matches. Surfaces which writers' work is converting to actual tips. Skip if it'd publicly show "writer X gets few tips" — could become awkward. Default to editor-only or off.

### 9. Public/private toggle
Right now `/dashboard/` is `eleventyExcludeFromCollections: true` but the URL is reachable by anyone who guesses it. Either:
- Add a `data-public-dashboard` site-setting flag and conditionally remove sensitive panels for the public view (per-author tip totals, stale alerts), OR
- Ship a stripped-down public dashboard at `/dashboard/` and keep the full one at `/dashboard/internal/` behind a basic-auth Cloudflare Pages rule.

The current build is already public — section 5 (comments to moderate) and section 8 (per-author tips) cross a line if left there.

---

## Editorial Board — proposed enhancements

### 1. Five-column workflow (replace the current three)
**Pitched** → **Drafting** → **In review** → **Scheduled** → **Published**, plus a sixth muted **Spiked / Held** column for cancelled work.

Add a `status` enum to article front matter: `pitched | drafting | review | scheduled | published | spiked`. Default is current behavior (`status: draft` maps to `drafting` for back-compat). Computed status: any article with a future `date` automatically reads as `scheduled` regardless of explicit `status`.

### 2. Author swim-lanes (toggle)
Stack cards into rows by `author` instead of just packing them into columns by status. Useful when triaging "what does this writer have in flight."

### 3. Card metadata
Each card surfaces:
- Section badge
- Title
- Author (linked to /author/{slug}/)
- Word count (from `collections.allContent[i].templateContent | wordCount`)
- Days in current status (computed from `lastStatusChange` field; falls back to `date`)
- Editor + reviewer if `editor:` / `reviewer:` are set in front matter
- Due date if `dueDate:` is set; cards turn red when overdue

### 4. Stuck-card alerts
Cards in the same column for >7 days get an amber dot. Cards >14 days get a red dot. Reduces "where did that pitch go" oversights.

### 5. Filters + view toggles
- Section filter (already there)
- Author filter
- Tag filter
- "My queue" toggle that filters to a configured editor's slug
- "Stuck only" view

### 6. Card detail modal
Click a card → modal with: full front matter, first 200 words of body, last commit message + author from git history, link to open in editor (`vscode://...` URL scheme). No drag-and-drop; static site can't write back.

### 7. Per-status SLA bands at the column header
Small text under each column heading: "median age 4d • oldest 23d". Quickly shows where backups are forming.

### 8. Per-day publishing rhythm chart at top
A 7-day strip showing what's published this week + what's scheduled. Same pattern as Dashboard #7 but trimmed for board context.

### 9. RSS-style edit log
Hidden by default, openable via a "Recent edits" link: pulls `git log --name-only --pretty=format:%h|%an|%ad|%s -- src/content/` at build time and lists the 30 most recent commits to articles. **Why:** "what changed" is currently hard to answer without the terminal.

---

## Required front-matter additions

To support the above, articles will need optional new fields. All default-off so existing pieces don't break:

| Field | Type | Default | Used by |
|---|---|---|---|
| `status` | enum | `drafting` | Board workflow |
| `editor` | author-slug | `null` | Card metadata |
| `reviewer` | author-slug | `null` | Card metadata |
| `dueDate` | ISO date | `null` | Overdue highlights |
| `lastStatusChange` | ISO date | `date` | Stuck-card alerts |
| `pitchedDate` | ISO date | `null` | Pipeline length stats |
| `spikedReason` | string | `null` | Documentation when killing a piece |
| `inResponseTo` | URL | `null` | Already documented; surfaces in dashboard "broken response chains" check |

Add these to `src/admin/config.yml` for Decap CMS so editors can fill them in via UI without remembering the YAML.

---

## Ranking by leverage

If only one round of work happens:

1. **Stale-content alerts (Dashboard #3) + Five-column workflow (Board #1)** — together these fix the biggest editorial failure mode (drafts forgotten in transit) for a small amount of code.
2. **Coverage gap report (Dashboard #4)** — prevents the publication from quietly dying on the Letters or Reviews axis.
3. **Public/private toggle (Dashboard #9)** — has to happen before #5 / #8, full stop.
4. **Production pulse + Per-author scoreboard (Dashboard #1, #2)** — low-effort, high-signal.
5. Everything else.

## Out of scope

- **Server-side editorial workflow.** No Sanity/Strapi/Notion integration. The static-site model is the trade-off.
- **CMS itself.** Decap is the editor surface; this plan only adds new fields and views, not a new authoring tool.
- **Cross-publication newsroom features.** Single-publication scope.
- **Analytics dashboards beyond Umami events we already capture.** No new tracking, no new dependencies.

## Verification (for a future implementation pass)

1. Add a fake `lastUpdated` more than 6 months ago to one article, set its `section` to News — Dashboard #3 should flag it.
2. Add `status: pitched` to a new draft — Board #1 should slot it in the leftmost column.
3. Set a future `date` on an article — Board #1 should auto-place it in Scheduled regardless of explicit `status`.
4. Run `git log` against `src/content/` to confirm the data exists for Board #9.
5. Build + Lighthouse the new `/dashboard/` to confirm no regressions in INP / CLS from added panels.
