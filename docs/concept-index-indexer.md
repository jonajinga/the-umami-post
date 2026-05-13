# Concept Index — Indexer Prompt + Schema

The back-of-book index lives in `src/_data/conceptIndex.json` and renders at `/back-of-book/`. It's modelled on a scholarly back-of-book index: three-tier hierarchy, conceptual mapping, and cross-references — not a flat keyword list.

## Schema

```json
[
  {
    "term": "Main Subject",
    "see": ["Synonym preferred form"],
    "see_also": ["Related Term"],
    "entries": [
      {
        "sub_term": "specific context or action",
        "references": [
          { "title": "Article Title", "url": "/section/slug/", "date": "2026-03-15", "section": "News" }
        ],
        "sub_sub_entries": [
          {
            "term": "even more specific detail",
            "references": [
              { "title": "Article Title", "url": "/section/slug/", "date": "2026-03-15", "section": "News" }
            ]
          }
        ]
      }
    ]
  }
]
```

### Field notes

- **term** — the main heading. Capitalised.
- **see** — redirects readers to a preferred synonym (rendered as "See: X"). Use when a term should always be looked up under another heading.
- **see_also** — related concepts the reader should also check (rendered as "See also: X"). Use generously.
- **entries[]** — sub-entries under the main heading. Each gives context (e.g. `"in federal regulatory enforcement"`).
- **references[]** — articles where the entry is substantively discussed. Each carries `title`, `url`, optional `date`, optional `section` for the small uppercase section badge.
- **sub_sub_entries[]** — third-tier specificity when sub-entries split further.

Both `see` cross-refs and `see_also` cross-refs anchor-jump within the page (`#entry-<slug>` of the target term). They only resolve if the target term exists; orphan xrefs are silent.

## Indexer prompt (LLM)

> **Role:** You are a Professional Academic Indexer specializing in long-form journalism, philosophy, and the history of ideas.
>
> **Task:** Perform "Deep Conceptual Indexing" of the provided articles from *The Freethinking Times*. Your goal is an index with the complexity and hierarchical depth found in a scholarly textbook.
>
> **Indexing Standards**
>
> - **Conceptual mapping.** Index ideas, not just keywords. If a passage discusses "separation of church and state" without using those exact words, index it under that heading.
> - **Hierarchical depth.** Three-tier structure: Main Entry → Sub-entry → Sub-sub-entry.
> - **Cross-referencing.** Use `see` for synonyms ("Atheism, see Unbelief") and `see_also` for related concepts ("Secularism; see also Agnosticism").
> - **Contextual clarity.** Sub-entries must provide context (instead of just "Death," use "Death, views on immortality and").
> - **Filter noise.** Do not index passing mentions that provide no substantive information.
> - **Consistency.** Alphabetise terms; group similar concepts under a single normalised heading.
>
> **Identify**
>
> - Every proper noun (person, deity, geographic location).
> - Philosophical themes — heavy emphasis on liberty, reason, science, theology, human rights.
> - Recurring concepts across articles (the same idea appearing in News, Analysis, and Letters should land under one main term with sub-entries by context).
>
> **Output format (JSON)**
>
> Return a JSON array conforming to the schema below. Each reference must include `title`, `url`, and `section`; `date` is optional but recommended.
>
> *(Schema as above.)*

## Map-Reduce workflow for large corpora

The Dresden Edition pattern applies here too: don't try to index hundreds of articles in one pass.

1. **Map** — process one section (or one article) at a time. Save each result as a partial JSON file.
2. **Reduce / Merge** — second pass that consolidates duplicate `term` entries, merges their `entries[]`, deduplicates `references[]`, normalises `see_also` lists, and ensures alphabetisation across the whole index.

A simple Node script can do the merge: read all partials, group by `term`, concatenate `entries[]`, dedupe references by URL.

## Editorial workflow

1. New article ships → assign 3–8 candidate index terms in the article front matter (or in a sidecar issue).
2. Run the indexer pass on the article.
3. Hand-edit the resulting JSON fragment for context lines.
4. Merge into `src/_data/conceptIndex.json`.
5. The page rebuilds; the A-Z nav and filter pick up the new entry automatically.
