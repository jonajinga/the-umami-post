# Editorial Dashboard + Board — Internal Guide

How the editor and contributors actually drive `/dashboard/` and `/editorial/board/`. Operational. Pair with [`docs/editorial-enhancement-plan.md`](./editorial-enhancement-plan.md) for the design rationale.

---

## What these surfaces are

- **`/dashboard/`** — the at-a-glance editorial view. Production rhythm, health alerts, section coverage, scheduling agenda, per-author scoreboard. Read this first thing in the morning.
- **`/editorial/board/`** — the detail view. Six-column kanban with every article in flight, filterable by section / author / stuck / overdue, with a recent-edits feed pulling from `git log`.

Both pages are built statically on every push. They surface state — they don't change it. To move a card across the board, you edit the article's front matter (or use Decap CMS), commit, push.

Both URLs are publicly reachable. They're excluded from the sitemap and search index, but anyone who guesses the URL can read them. **Nothing on these pages should be information you wouldn't share with your readers** — see the plan file for the parked "internal-only" hardening.

---

## The article workflow

Every article moves through six states. The state lives in front matter as `status:`.

| Status | Decap label | Meaning | Typical next move |
|---|---|---|---|
| `pitched` | Pitched | Idea lodged, no draft yet | Start drafting → `drafting` |
| `drafting` | Drafting | Active writing | Hand to an editor → `review` |
| `review` | Review | Editor reading / line-editing | Approve → `scheduled` (future date) or `published` (now) |
| `scheduled` | Scheduled | Approved, future date in front matter | Auto-flips to `published` on publish day |
| `published` | Published | Live | Edit-in-place + log corrections; eventually moves to archives |
| `spiked` | Spiked | Killed or held indefinitely | Add `spikedReason:` and leave |

**Computed overrides:**

- A future `date:` always reads as `scheduled`, regardless of explicit `status`. This means scheduled posts don't need babysitting — set the date, set `status: drafting` if it's still being polished, and the board does the right thing.
- `draft: true` (legacy boolean) and `status: draft` (legacy enum value) both map to `drafting` for back-compat with older articles.

**When to bump `lastStatusChange:`**

Update it whenever you move an article between columns. The "stuck-card" amber/red dots on the board count from this date. If you forget, the dot dates from the article's `date:` field — fine for short-lived items, misleading for pieces that linger.

In Decap: change the status select, change `Last Status Change` to today, save. Two clicks.

---

## Front-matter cheat sheet

The fields the new board / dashboard care about:

```yaml
status: drafting              # pitched | drafting | review | scheduled | published | spiked
editor: jon-ajinga            # author slug; surfaces as "ed: …" on the board card
reviewer: another-slug        # author slug; surfaces as "rv: …"
dueDate: 2026-05-15           # ISO date; card turns red when past
lastStatusChange: 2026-04-25  # ISO date; drives stuck-card alerts (≥7d amber, ≥14d red)
pitchedDate: 2026-04-20       # ISO date the piece entered the pipeline
spikedReason: "Source declined to go on the record after weeks of follow-up." # only when status: spiked
inResponseTo: /opinion/some-piece/  # canonical path of an article this responds to
lastUpdated: 2026-04-25       # bump on substantive edits; surfaces as 6-month "stale" alert in fast sections
corrections:                  # list; each surfaces in dashboard "needs attention"
  - date: 2026-04-25
    description: "Updated employment figures from preliminary to revised release."
```

All optional. Existing articles keep working without any of them set.

---

## Reading the dashboard

Top → bottom on `/dashboard/`:

### Stats row (7 cells)

Pipeline counts at a glance: **Total / Pitched / Drafting / Review / Scheduled / Published**, plus a **Needs-attention** cell that only appears when the alerts panel below has something to show.

If "Drafting" or "Review" gets above ~5 it's worth scanning the board to see if something's actually moving or just piling up.

### Production pulse (12-week sparkline)

Bars show articles published per ISO week (Monday–Sunday) for the last twelve weeks. Hover any bar for the count. Use this to:
- Spot dry weeks before they become dry months.
- Calibrate against expected output. If you're aiming for ~3 articles a week and the bars are averaging 1, the news cycle has won.

### Needs attention (auto-hidden when zero)

Four sub-panels:

1. **Drafts >14 days old** — anything `pitched | drafting | review` whose article date is ≥14 days back. Either advance it or spike it.
2. **Recent corrections (last 30d)** — articles where the most recent entry in `corrections:` was within 30 days. Useful as a self-audit: a flurry suggests sourcing slipped.
3. **Fast sections, stale** — articles in News / Opinion / Politics whose `lastUpdated:` (or `date:` if unset) is >6 months old. Time-sensitive coverage that may need a refresh.
4. **Broken response chains** — articles with `inResponseTo: /some/url/` where `/some/url/` no longer resolves on the site. Either the response target was renamed (fix the link) or removed (drop the field).

### Section coverage

Per-section grid: **last published date · 14d count · 90d count**, with health flags:

- **OK** — published in the last 14 days
- **Amber** — zero in last 14d, but at least one in last 90d
- **Red** — zero in last 90 days

Fix: publish something in that section, or accept that the section is dormant and adjust expectations.

### Next 14 days (scheduling agenda)

A 14-day strip of upcoming days, with a count of scheduled posts per day and the titles. Auto-hides when there's nothing scheduled. Use it to:
- Avoid stacking three pieces on the same Tuesday
- See your near-term content commitment at a glance

### Per-author scoreboard

Sorted by lifetime words. Shows articles published, drafts in flight, lifetime words, average length, last-published date, and the three most recent published titles per author.

The "Drafts" column is the operationally interesting one — it tells you which contributors have unfinished work in your pipeline that you may have forgotten about.

### Articles by section / Projects / Library / Infrastructure

Reference counts. Useful for status reports and for double-checking that nothing has silently disappeared.

### Active assignments

Articles with `assignedTo:` set, not yet published, sorted by overdue first. Surfaces what's actually committed-to, with due dates and days-until.

### Recent articles

Last 12 articles published, with section + draft / review flags. Quick "what just shipped" view.

---

## Reading the editorial board

The board (`/editorial/board/`) has six columns and a few extras.

### Columns (left to right)

1. **Pitched** — captured ideas
2. **Drafting** — being written
3. **In Review** — being edited
4. **Scheduled** — approved, future date
5. **Published** — live (recent first, capped at 60 visible)
6. **Spiked / Held** — killed or held indefinitely (muted at 65% opacity)

Each column header shows count + a tiny SLA band: `median Xd · oldest Yd`. Watch for medians creeping up — that's a backup forming.

### Per-day publishing rhythm strip (top of page)

A 7-day strip showing what's scheduled this week. Quick read of weekly load. Cells with content are highlighted in vermillion.

### Toolbar

| Control | Use |
|---|---|
| Search input | Filter cards by title, author, or tag (live, no submit) |
| Section dropdown | Single section at a time |
| Author dropdown | Single author at a time |
| Stuck only checkbox | Hide cards that have moved in the last 7 days |
| Overdue only checkbox | Hide cards without an overdue `dueDate` |
| Swim-lanes toggle | Re-sort cards within columns by author so each writer's pieces cluster |

Filters compose. Counts update as filters apply.

### Card anatomy

Top → bottom on each card:

- Section badge + stuck dot (amber if ≥7d in column, red if ≥14d)
- Title (links to article)
- Author + days-in-status + word count + due date
- Editor / reviewer assignments (if `editor:` / `reviewer:` set)
- Spiked-reason caption (only on cards in the Spiked column with `spikedReason:` set)

### Recent edits (bottom collapsible)

Pulls the last 30 commits to `src/content/` from `git log` at build time. Shows hash, message, author, date. Answers "what changed" without leaving the browser.

If the panel is missing or empty: CF Pages preview environments don't always have full git history. Production builds do.

---

## Common operations

### Move an article from drafting to review

1. Open in Decap (or edit the markdown directly)
2. Change `status: drafting` → `status: review`
3. Set `reviewer: <slug>` if known
4. Set `lastStatusChange: <today>`
5. Commit, push

The card moves to the In Review column on the next build (~2 minutes via CF Pages).

### Schedule an article for next Tuesday

1. Set the `date:` field to the desired publish date in the future
2. Leave `status:` as is — the future `date:` automatically classifies the card as Scheduled
3. Make sure `draft: true` is removed (or set to `false`)
4. Commit, push

The card sits in Scheduled until the publish date, then auto-flips to Published.

### Log a correction on a published piece

In the article's front matter:

```yaml
lastUpdated: 2026-05-02   # bump this whenever you correct
corrections:
  - date: 2026-05-02
    description: "An earlier version said X. The correct figure is Y; source has been re-verified. The piece has been updated."
```

The correction renders automatically in the article footer and surfaces in the Dashboard's "Needs attention" panel for 30 days.

### Spike a piece

```yaml
status: spiked
spikedReason: "Source declined on the record after months of follow-up. Killing the piece rather than running with on-background only."
```

Card moves to the Spiked column at 65% opacity with the reason as a caption underneath. Spiked items are muted but kept on the board indefinitely as institutional memory.

### Mark a piece overdue without committing to a date

```yaml
dueDate: 2026-05-01
```

If today is past the dueDate and the article is in Pitched / Drafting / Review, the card turns red on the board and appears in the "Overdue only" filter.

---

## Troubleshooting

**A card is in the wrong column.** Check the article's `status:` field. If it has a future `date:`, computed status overrides explicit status to `scheduled`. Either move the date or change status.

**Stuck-dot color seems wrong.** The stuck timer counts from `lastStatusChange:` if set, otherwise from `date:`. Bump `lastStatusChange:` whenever you move a card so the timer resets.

**An article shows "0d in drafting" when I just moved it.** That's correct — `lastStatusChange` was just bumped. The dot stays clear until the count crosses 7 days.

**Recent edits panel is empty on the deployed site.** CF Pages preview environments sometimes shallow-clone. Production main branch builds should have full history. If it stays empty after a main branch build, check `git log --name-only -- src/content/` locally to confirm there's history to read.

**The "Needs attention" panel doesn't include something I expected.** The four sub-panels each have specific triggers; see the section above. If a draft 12 days old isn't showing, that's working — the threshold is 14 days. If a fast-section piece doesn't appear stale, check whether `lastUpdated` is set; if not, the trigger uses `date`.

**Word counts are off.** Eleventy can't always read `templateContent` while another template is being rendered, so the dashboard / scoreboard occasionally counts an article as zero words for one build. The numbers self-correct on the next push.

---

## Decap CMS specifics

Every article collection in `src/admin/config.yml` includes the new fields. When editing in Decap:

- **Status** is a select with all six values. Default for new articles is `drafting`.
- **Editor / Reviewer** are free-text fields — use the author's slug as it appears in `src/_data/authors-data/`.
- **Last Status Change / Pitched Date / Due Date** are datetime pickers.
- **Spiked Reason** only matters when status is `spiked`; otherwise leave blank.

Decap saves drafts to a PR; an admin merges to publish. The board only reflects what's on the `main` branch — pieces sitting in open PRs aren't visible until merged.

---

## When to look at what

| Situation | Where to go |
|---|---|
| Morning check-in, "how's the publication doing?" | `/dashboard/` top half |
| "What needs my attention today?" | `/dashboard/` Needs-attention panel |
| "Am I publishing enough?" | Production pulse sparkline |
| "Is anything overdue?" | Editorial Board → Overdue-only filter |
| "What is each contributor working on?" | Per-author scoreboard + Board with swim-lanes on |
| "What changed this week?" | Recent edits collapsible at bottom of board |
| "When am I scheduled to publish next?" | Next-14-days agenda strip |
| "How healthy is the Letters section?" | Section coverage card |

---

## Hard rules

- **Never set `status: published` manually for a future date.** Use a future `date:` and let the auto-flip handle it. Setting both creates an article that's labelled published but isn't actually live yet.
- **Always bump `lastStatusChange:` when moving cards.** Without it the stuck-card dots become misleading.
- **Don't spike without a `spikedReason:`.** Six months from now you won't remember.
- **Don't put internal-only context in the corrections log.** It surfaces publicly.
