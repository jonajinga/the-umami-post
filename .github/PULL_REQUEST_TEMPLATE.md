<!--
  Delete the section below that does not apply to this PR.
  Code/design/infra changes → keep Section A, delete Section B.
  Articles, author profiles, editorial config → keep Section B, delete Section A.
-->

---

## Section A — Code / Design / Infrastructure

### What changed and why

<!-- Describe what this PR does. Focus on *why*, not just what — the diff shows the what. -->

### Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Design / visual change
- [ ] Refactor (no behavior change)
- [ ] CI / tooling
- [ ] Documentation
- [ ] Other: ___

### Checklist

- [ ] `npm run build` passes locally with no errors
- [ ] Affected pages verified in the dev server (`npm start`)
- [ ] No new accessibility regressions (keyboard navigation, contrast, semantic HTML)
- [ ] No new browser console errors or warnings
- [ ] If CSS changes: tested in both light mode and dark mode
- [ ] If JS changes: core content still works with JS disabled
- [ ] If `tokens.css` changed: visual diff described above or in a screenshot
- [ ] Relevant documentation updated (README, CONTRIBUTING, inline comments)

### Related issues

Closes #

---

## Section B — Editorial / Content

### Article details

**Section:** <!-- News | Opinion | Analysis | Arts & Culture | Science & Technology | History | Letters | Reviews -->
**Working title:**
**Brief summary (1–3 sentences):**

### Type of change

- [ ] New article
- [ ] Article update or correction
- [ ] New author profile
- [ ] Editorial config change (site-settings.json, nav.json, etc.)

### Checklist for new articles

- [ ] All required frontmatter fields are present and valid
- [ ] `author:` slug matches an entry in `src/_data/authorProfiles/`
- [ ] `section:` is one of the 8 valid values (exact capitalization)
- [ ] `description:` is ≤180 characters and reads well as a standalone summary
- [ ] `imageAlt:` is present if `image:` is set
- [ ] `draft: true` is set (keeps the article off the live site until editorial approval)
- [ ] `status:` is `draft` or `review` — **not** `published` (editors handle that)
- [ ] Primary sources documented (in the article or in a comment below)
- [ ] Direct quotes confirmed against notes, recording, or correspondence

> **Note for editors:** To publish, remove `draft: true` and set `status: published`.
> To schedule, set `date:` to a future date — the daily cron (00:05 UTC) will
> surface the article automatically.
