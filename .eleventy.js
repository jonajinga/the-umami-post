const pluginRss = require("@11ty/eleventy-plugin-rss");
const eleventyImage = require("@11ty/eleventy-img");
const { DateTime } = require("luxon");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const CleanCSS = require("clean-css");
const { PurgeCSS } = require("purgecss");

module.exports = function (eleventyConfig) {

  // ─── Plugins ────────────────────────────────────────────────────────────────
  eleventyConfig.addPlugin(pluginRss);

  // ─── Responsive image shortcode ────────────────────────────────────────────
  // Usage in Markdown: {% image "src/assets/img/foo.jpg", "alt text", "(max-width: 768px) 100vw, 720px" %}
  // Outputs <picture> with AVIF + WebP + fallback, lazy-loaded, with width/height.
  async function imageShortcode(src, alt = "", sizes = "(max-width: 720px) 100vw, 720px", className = "") {
    if (!src) return "";
    // Allow authors to reference images as /assets/img/... — resolve to disk path
    const diskSrc = src.startsWith("/")
      ? path.join("./src", src)
      : src.startsWith("src/") ? src : path.join("./src/assets/img", src);

    let metadata;
    try {
      metadata = await eleventyImage(diskSrc, {
        widths: [400, 800, 1200, null],
        formats: ["avif", "webp", "jpeg"],
        outputDir: "./_site/assets/img/opt/",
        urlPath: "/assets/img/opt/"
      });
    } catch (e) {
      console.warn("image shortcode: failed to process", src, "—", e.message);
      return `<img src="${src}" alt="${alt}" loading="lazy">`;
    }

    return eleventyImage.generateHTML(metadata, {
      alt,
      sizes,
      loading: "lazy",
      decoding: "async",
      class: className || undefined
    });
  }

  eleventyConfig.addAsyncShortcode("image", imageShortcode);
  eleventyConfig.addLiquidShortcode("image", imageShortcode);
  eleventyConfig.addJavaScriptFunction("image", imageShortcode);

  // ─── Passthrough Copies ─────────────────────────────────────────────────────
  // Copy assets but exclude CSS (concatenated at build time below)
  eleventyConfig.addPassthroughCopy({ "src/assets/js": "assets/js" });
  eleventyConfig.addPassthroughCopy({ "src/assets/favicon.svg": "assets/favicon.svg" });
  eleventyConfig.addPassthroughCopy({ "src/assets/favicon-dark.svg": "assets/favicon-dark.svg" });
  eleventyConfig.addPassthroughCopy({ "src/assets/img": "assets/img" });
  eleventyConfig.addPassthroughCopy({ "src/assets/audio": "assets/audio" });
  eleventyConfig.addPassthroughCopy({ "src/humans.txt": "humans.txt" });
  eleventyConfig.addPassthroughCopy({ "src/admin": "admin" });

  // ─── CSS Concatenation (no @import waterfall) ──────────────────────────────
  eleventyConfig.addTemplateFormats("css");
  eleventyConfig.addExtension("css", {
    outputFileExtension: "css",
    compile: function (inputContent, inputPath) {
      // Only process the entry point; skip partials
      if (!inputPath.endsWith("main.css")) return;
      return async function () {
        const cssDir = path.dirname(inputPath);
        const order = [
          "tokens.css", "base.css", "layout.css", "components.css",
          "article.css", "projects.css", "library.css", "calendar.css",
          "editorial.css"
        ];
        let combined = "";
        for (const file of order) {
          try {
            combined += fs.readFileSync(path.join(cssDir, file), "utf8") + "\n";
          } catch (e) {
            console.warn("CSS file not found:", file);
          }
        }
        // Append main.css content (print styles etc.) minus the @import lines
        combined += inputContent.replace(/@import\s+['"][^'"]+['"];?\s*/g, "");

        // ── PurgeCSS: strip rules unused across all templates + content ──────
        const [purged] = await new PurgeCSS().purge({
          content: [
            "src/**/*.njk",
            "src/**/*.md",
            "src/**/*.html",
            "src/assets/js/**/*.js",
          ],
          css: [{ raw: combined }],
          safelist: {
            // ── Explicitly named classes toggled by JS at runtime ────────────
            standard: [
              // Theme init
              "js-enabled",
              // State flags
              "is-open", "is-active", "is-visible", "is-copied", "is-saved",
              "is-saved-flash", "is-listening", "is-replaced", "is-speaking",
              "is-disabled", "is-in-panel", "is-pending", "is-success", "is-error",
              // Header/nav
              "site-header--pinned", "site-header--hidden", "site-header--scrolled",
              // Overlay / drawer
              "overlay--visible", "no-transition",
              // Calendar
              "cal-detail--open", "cal-detail-backdrop--open",
              // Article features
              "footnote-flash", "sidenote--highlight",
              "print-include-notes", "print-notes-only", "rs-para-numbers",
              "article-card--read", "article-card--in-progress",
              // Subscribe form states
              "subscribe-status",
              // Style guide TOC active link
              "sg-active",
              // Dynamically created DOM nodes (JS innerHTML / createElement)
              "ann-note-overlay", "ann-note-modal",
              "hl-color-picker", "hl-color-btn", "bookmark-indicator",
              "glossary-tip", "w3f__dictate",
              "cite-inline__entry", "cite-inline__label",
              "cite-inline__text", "cite-inline__copy",
              "music-bar", "music-bar__info", "music-bar__name",
              "music-bar__title", "music-bar__controls",
              "music-bar__btn", "music-bar__btn--play", "music-bar__vol",
              "article-action-btn", "search-filter-btn",
              "rs-ruler-line", "heading-anchor",
              "toc-list", "toc-list__link",
              "fn-tooltip", "fn-tooltip__close", "fn-tooltip__body",
              "sidenote", "pullquote-share",
              "article-card__read-pill", "article-card__progress",
              "article-card__progress-fill",
              "reading-list", "reading-list__item",
              // Archive-link (link-rot protection) — emitted by markdown-it
              // renderer customization; not visible to PurgeCSS as a literal
              // class in source templates.
              "archive-link",
              // Reader-panel tab-strip scroll chevrons — injected at runtime
              // by annotations.js; invisible to PurgeCSS's source scan.
              "library-panel__tabs-wrap",
              "library-panel__tabs-arrow",
              "library-panel__tabs-arrow--left",
              "library-panel__tabs-arrow--right",
              // Per-paragraph permalinks — injected by paragraph-anchors.js.
              "para-anchor",
              "para-anchor--copied",
              "para-anchor-target",
              // Site-wide announcement + watch-live banners — only
              // render when site.live.active or site.announcement.active
              // is flipped on, so PurgeCSS may scan a build where they
              // are absent and strip them.
              "masthead__lead",
              "masthead__live",
              "masthead__live-dot",
              "masthead__live-label",
              "site-announce",
              "site-announce--info",
              "site-announce--warning",
              "site-announce--breaking",
              "site-announce__inner",
              "site-announce__badge",
              "site-announce__text",
              "site-announce__cta",
              "site-announce__close",
              // Search-result tag chips — injected at runtime by
              // search.js, so PurgeCSS doesn't see them in templates.
              "search-result__section",
              "search-result__tag",
              // Form checkbox grids — used by /survey/ and similar
              // multi-select forms.
              "w3f__checklist",
              "w3f__check",
              // Article engagement buttons — toggled at runtime by
              // like-btn.js, read-state.js, pdf-basket.js, tts.js.
              "is-liked", "is-read", "is-in-basket", "is-playing",
              "sitewide-disclosures",
              "article-audio", "article-audio__head",
              "article-audio__icon", "article-audio__label",
              "article-audio__title", "article-audio__meta",
              "article-audio__player",
              "article-topics", "article-topics__label",
              "article-topics__list",
              "listen-btn", "listen-btn--sm", "listen-btn--md",
              "listen-btn__icon", "listen-btn__label",
              "listen-btn__sep", "listen-btn__time",
              "article-card__listen", "archive-entry__listen",
              "article-card__byline-item",
              "article-list__meta--bars", "article-list__meta-item",
              "is-current",
              "audio-bar", "audio-bar__play",
              "audio-bar__icon-play", "audio-bar__icon-pause",
              "audio-bar__controls", "audio-bar__title",
              "audio-bar__time", "audio-bar__scrub", "audio-bar__close",
              "has-audio-bar",
              "tts-popover", "tts-popover__head", "tts-popover__close",
              "tts-popover__lede", "tts-popover__choices", "tts-popover__choice",
              "tts-popover__row", "tts-popover__btn",
              "tts-progress", "tts-progress__bar", "tts-progress__fill",
              "tts-progress__line", "tts-progress__pct", "tts-progress__file",
              "tts-field",
              "like-count",
              "article-meta-item",
              "article-meta-item--length",
              "article-meta-item--time",
              "article-meta-item--stat",
              "mark-read-btn__label", "pdf-basket-btn__label", "tts-btn__label",
              // Floating PDF-basket tray — appended to <body> when basket
              // first becomes non-empty; never present in template source.
              "pdf-basket-tray",
              "pdf-basket-tray__count",
              // Reading-history list — rendered client-side from
              // localStorage on /reading-history/.
              "reading-history-list",
              "rh-meta", "rh-pill", "rh-pill--manual", "rh-actions",
              // Print-basket renderer — built client-side from fetched
              // article HTML on /print-basket/.
              "pb-list", "pb-meta",
              "pb-preview", "pb-preview__article", "pb-preview__byline",
              // Calendar engine — both /editorial-calendar/ and
              // /reading-calendar/ render their entire UI client-side
              // via assets/js/calendar-shared.js, so every cal-* class
              // would otherwise be purged from the build output.
              "cal-mount", "cal-loading", "cal-noscript",
              "cal-toolbar", "cal-toolbar__nav", "cal-toolbar__btn",
              "cal-toolbar__btn--today", "cal-toolbar__views", "cal-toolbar__view",
              "cal-view", "cal-view__header", "cal-view__title", "cal-view__sub",
              "cal-view__empty", "cal-view__cards", "cal-view__cards--list",
              "cal-view__week", "cal-view__day", "cal-view__day--has",
              "cal-view__day-head", "cal-view__day-name", "cal-view__day-num",
              "cal-view__day-count",
              "cal-view__month-grid", "cal-view__weekdays", "cal-view__grid",
              "cal-view__cell", "cal-view__cell--blank", "cal-view__cell--has",
              "cal-view__cell-num", "cal-view__cell-count",
              "cal-view__month-list", "cal-view__month-list-title",
              "cal-view__year-grid", "cal-view__year-month",
              "cal-view__year-month-head", "cal-view__year-month-count",
              "cal-view__mini-grid", "cal-view__mini",
              "cal-view__mini--blank",
              "cal-view__mini--heat-1", "cal-view__mini--heat-2",
              "cal-view__mini--heat-3", "cal-view__mini--heat-4",
              "article-card--cal",
              // Concept index — flash modifier toggled by JS on hash
              // jump; the rest of the .concept-index__* hierarchy is
              // present in the page source and survives the content
              // scan naturally.
              "concept-index__entry--flash",
              // Editorial chrome — JS-toggled modifiers and runtime-
              // built nodes. Static .ed-pivot__tab / .dash-* / .eb-*
              // classes are present in the templates and survive the
              // content scan; only the dynamic ones need explicit
              // safelist entries.
              "ed-pivot__tab--active",
              "ed-help-overlay", "ed-help-overlay--open",
              "ed-help-overlay__panel", "ed-help-overlay__title",
              "eb-card--age-1", "eb-card--age-2", "eb-card--age-3", "eb-card--age-4",
              "eb-card--overdue",
              "eb-board--swim",
              "eb-swim-lane", "eb-swim-lane__head",
              "eb-col__wip", "eb-col__wip--breach",
              "eb-flyout", "eb-flyout__header", "eb-flyout__close",
              "eb-flyout__body", "eb-flyout__field", "eb-flyout__label",
              "eb-flyout__value", "eb-flyout__actions", "eb-flyout__action",
              "eb-flyout__kicker", "eb-flyout__title",
              "dash-stat--link",
              "dash-cycle", "dash-cycle__col", "dash-cycle__col-title",
              "dash-cycle__bars", "dash-cycle__bar",
              "dash-cycle__bar--fresh", "dash-cycle__bar--warming",
              "dash-cycle__bar--stuck", "dash-cycle__bar--severe",
              "dash-cycle__bar-label", "dash-cycle__bar-track",
              "dash-cycle__bar-fill", "dash-cycle__bar-num",
              "dash-sla__grid", "dash-sla__bucket",
              "dash-sla__bucket--soon", "dash-sla__bucket--late",
              "dash-sla__bucket--severe",
              "dash-sla__bucket-title", "dash-sla__bucket-count",
              "dash-sla__list", "dash-sla__meta", "dash-sla__empty",
              "dash-velocity__row", "dash-velocity__name",
              "dash-velocity__spark", "dash-velocity__spark-bar",
              "dash-velocity__spark-bar--has",
              "dash-velocity__delta",
              "dash-velocity__delta--up", "dash-velocity__delta--flat", "dash-velocity__delta--down",
              "dash-ondeck", "dash-ondeck__title", "dash-ondeck__meta",
              "dash-ondeck__due", "dash-ondeck__due--late", "dash-ondeck__due--soon",
              "dash-card__sub",
              "cal-view__cell--today", "cal-view__cell--weekend",
              "cal-view__chips", "cal-view__chip", "cal-view__chip--active",
              "cal-view--density-cards", "cal-view--density-compact", "cal-view--density-list",
              "cal-view__overlay-card", "cal-view__overlay-pill",
              "cal-view__week--swim", "cal-view__week-section-head",
              "cal-view__week-day-head", "cal-view__week-cell",
              // Dedicated list-density row markup (renderListRow)
              "cal-list", "cal-list__head", "cal-list__row",
              "cal-list__date", "cal-list__section", "cal-list__title",
              "cal-list__author", "cal-list__words",
              // Most-read chart rows — rendered from Umami-stats JSON.
              "mr-row", "mr-row__label", "mr-row__title", "mr-row__sub",
              "mr-row__bar", "mr-row__bar-fill", "mr-row__count",
              // Knowledge-map nodes/links — created by D3.
              "km-node", "km-node--article", "km-node--tag", "km-node--author",
              // PDF viewer modal — built lazily by pdf-viewer.js on
              // first PDF link click; never present in the source scan.
              "pdf-modal",
              "pdf-modal__backdrop",
              "pdf-modal__panel",
              "pdf-modal__head",
              "pdf-modal__title",
              "pdf-modal__action",
              "pdf-modal__close",
              "pdf-modal__frame",
            ],
            // ── Keep any rule whose selector contains these patterns ─────────
            deep: [
              /\[data-theme/,        // dark mode token overrides
              /\[data-gs-/,          // global settings (font, bg, spacing…)
              /\[data-focus-mode/,   // reader focus mode
              /\[data-rs-/,          // reading settings
              /\[data-has-sidenote/, // sidenote presence
              /\[data-page-/,        // page-level metadata attributes
              /\[aria-/,             // aria state selectors (aria-expanded, aria-current…)
              /\[hidden\]/,
              /\[disabled\]/,
              /:root/,               // CSS custom property declarations
              /:has\(/,              // :has() compound selectors (bottom-strip stacking, smart-position rules)
            ],
            // ── Keep any rule where the selector string contains these ───────
            greedy: [
              // Third-party injected classes
              /tippy/,      // Tippy.js tooltip UI
              /pagefind/,   // Pagefind search UI
              /hljs/,       // highlight.js code blocks
              /language-/,  // PrismJS / highlight.js language classes
              /token/,      // syntax highlight tokens
              // Dynamic Nunjucks modifier classes (template variable expands at runtime)
              /section-badge--/,          // --news, --opinion, --history…
              /article-card__headline--/, // --lg, --md, --sm, --xs
              /^cal-view/,                // calendar-shared.js builds every cal-view* node client-side
              /^dash-cycle/,              // dashboard cycle-time histogram bars (Nunjucks loop emits modifiers from data)
              /^dash-sla__bucket--/,      // dashboard SLA bucket modifiers (loop emits)
              /^dash-velocity__delta--/,  // velocity row delta modifiers (loop emits)
              /^eb-card--age-/,           // board card aging gradient modifiers
              /toc-list__item--/,         // --h1 through --h6
              /tip-badge--/,              // --pub, --info
              // JS-built DOM node class patterns
              /print-citations/,
              /print-footnotes/,
              /print-inline-note/,
              /annotation-toolbar/,
              /library-annotation/,
              /library-bookmark/,
              /library-highlight/,
              // Webmentions partial only renders when webmentions[page.url]
              // has entries, so PurgeCSS may miss the classes on a dry build.
              /^wm-/,
              /^wm$/,
              /^wm__/,
              // Dynamic dropdown IDs not visible to PurgeCSS (id="dropdown-{{ item.key }}")
              /dropdown-more/,    // Explore mega-menu width override
              /dropdown-quotes/,  // Quotes fixed-position override
              // Calendar dots/chips — classes built in JS from event.type
              /cal-dot--/,        // colored dots on month view
              /cal-week__chip--/, // colored chip borders on week view
              // body.is-home gate — toggled by spa-nav.js on every
              // navigation. PurgeCSS sees the class only on the home
              // page's static HTML, but it needs to keep the rule
              // because soft-nav can re-add the class to any body.
              /is-home/,
            ],
          },
          variables: false,  // never strip CSS custom property declarations
          keyframes: true,   // keep all @keyframes
          fontFace: false,   // keep @font-face rules
        });

        return new CleanCSS({ level: 2 }).minify(purged.css).styles;
      };
    },
  });
  // robots.txt is now a Nunjucks template (robots.njk)
  eleventyConfig.addPassthroughCopy({ "src/_redirects": "_redirects" });
  eleventyConfig.addPassthroughCopy({ "src/_headers": "_headers" });

  // ─── Watch Targets ──────────────────────────────────────────────────────────
  eleventyConfig.addWatchTarget("src/assets/css/");
  eleventyConfig.addWatchTarget("src/assets/js/");

  // ─── Date Filters ───────────────────────────────────────────────────────────
  eleventyConfig.addFilter("readableDate", (dateObj) => {
    const dt = typeof dateObj === "string"
      ? DateTime.fromISO(dateObj, { zone: "utc" })
      : DateTime.fromJSDate(dateObj, { zone: "utc" });
    return dt.toFormat("LLLL d, yyyy");
  });

  eleventyConfig.addFilter("htmlDateString", (dateObj) => {
    const dt = typeof dateObj === "string"
      ? DateTime.fromISO(dateObj, { zone: "utc" })
      : DateTime.fromJSDate(dateObj, { zone: "utc" });
    return dt.toFormat("yyyy-LL-dd");
  });

  eleventyConfig.addFilter("shortDate", (dateObj) => {
    const dt = typeof dateObj === "string"
      ? DateTime.fromISO(dateObj, { zone: "utc" })
      : DateTime.fromJSDate(dateObj, { zone: "utc" });
    return dt.toFormat("LLLL d, yyyy");
  });

  eleventyConfig.addFilter("isoDate", (dateObj) => {
    const dt = typeof dateObj === "string"
      ? DateTime.fromISO(dateObj, { zone: "utc" })
      : DateTime.fromJSDate(dateObj, { zone: "utc" });
    return dt.toISO();
  });

  eleventyConfig.addFilter("readingTime", (content) => {
    const text = content.replace(/(<([^>]+)>)/gi, "");
    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    const mins = Math.max(1, Math.ceil(words / 200));
    return `${mins} min read`;
  });

  // Returns the raw minute count (integer) — used for data attributes and filtering
  eleventyConfig.addFilter("readingMins", (content) => {
    if (!content) return 1;
    const text = content.replace(/(<([^>]+)>)/gi, "");
    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    return Math.max(1, Math.ceil(words / 200));
  });

  // Compact number formatter for engagement stats (1.2k, 3.4M, 850).
  eleventyConfig.addFilter("numberFmt", (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return "";
    const abs = Math.abs(v);
    if (abs >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    if (abs >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
    return String(Math.round(v));
  });

  // Word count — formatted with thousands separator
  eleventyConfig.addFilter("wordCount", (content) => {
    if (!content) return '0 words';
    const text = content.replace(/(<([^>]+)>)/gi, "");
    const count = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    return count.toLocaleString('en-US') + ' words';
  });

  // Initials — "Jon Ajinga" → "JA". Used as an avatar fallback when
  // an author / contributor has no photo set.
  eleventyConfig.addFilter("initials", (name) => {
    if (!name) return "";
    const parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  });

  // Related articles sorted by number of shared tags, excluding current URL
  eleventyConfig.addFilter("relatedByTags", (allContent, currentTags, currentUrl, limit = 3) => {
    const tags = (currentTags || []).filter(t => t !== "post" && t !== "all");
    if (!tags.length) return [];
    return allContent
      .filter(item => item.url !== currentUrl)
      .map(item => {
        const itemTags = (item.data.tags || []).filter(t => t !== "post" && t !== "all");
        const shared = itemTags.filter(t => tags.includes(t)).length;
        return { item, shared };
      })
      .filter(({ shared }) => shared > 0)
      .sort((a, b) => b.shared - a.shared)
      .slice(0, limit)
      .map(({ item }) => item);
  });

  // Weighted related-articles scorer. Combines:
  //  - tag overlap (3× per shared tag)
  //  - section match (2×)
  //  - title word overlap (1× per shared word > 3 chars, lowercased, stopwords removed)
  //  - recency (soft boost for articles <365 days old, scaled)
  // Returns top N items sorted by score descending. When no tag/section match,
  // still returns same-section articles (if any) or recent articles as fallback.
  eleventyConfig.addFilter("relatedArticles", (allContent, currentData, currentUrl, limit = 4) => {
    if (!currentData) return [];
    const STOP = new Set(["the","and","for","with","from","that","this","have","been","into","about","their","there","which","what","when","where","your","also","more","than","these","those","over","some","other","like","such","just","only","will","was","are","its","our"]);
    const words = (s) => (s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 3 && !STOP.has(w));
    const currentTags = new Set((currentData.tags || []).filter(t => t !== "post" && t !== "all"));
    const currentSection = currentData.section || "";
    const currentWords = new Set(words(currentData.title));
    const now = Date.now();

    const scored = allContent
      .filter(item => item.url !== currentUrl)
      .filter(item => !item.data.draft && !item.data.emailOnly)
      .map(item => {
        let score = 0;
        const itemTags = (item.data.tags || []).filter(t => t !== "post" && t !== "all");
        const sharedTags = itemTags.filter(t => currentTags.has(t)).length;
        score += sharedTags * 3;
        if (item.data.section && item.data.section === currentSection) score += 2;
        const itemWords = words(item.data.title);
        const sharedWords = itemWords.filter(w => currentWords.has(w)).length;
        score += sharedWords;
        // Recency: up to +1.5 for articles within the last year
        const ageDays = item.date ? (now - new Date(item.date).getTime()) / 86400000 : 9999;
        if (ageDays < 365) score += 1.5 * (1 - ageDays / 365);
        return { item, score, sharedTags };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length >= limit) return scored.slice(0, limit).map(({ item }) => item);

    // Fallback: top up with same-section, then most recent
    const chosen = new Set(scored.map(({ item }) => item.url));
    const fallback = allContent
      .filter(item => item.url !== currentUrl && !chosen.has(item.url))
      .filter(item => !item.data.draft && !item.data.emailOnly)
      .sort((a, b) => {
        const aSec = a.data.section === currentSection ? 1 : 0;
        const bSec = b.data.section === currentSection ? 1 : 0;
        if (aSec !== bSec) return bSec - aSec;
        return (b.date || 0) - (a.date || 0);
      });
    return [...scored.map(({ item }) => item), ...fallback].slice(0, limit);
  });

  // All articles in the same series, sorted by seriesPart
  eleventyConfig.addFilter("seriesArticles", (allContent, seriesTitle) => {
    if (!seriesTitle) return [];
    return allContent
      .filter(item => item.data.series === seriesTitle)
      .sort((a, b) => (a.data.seriesPart || 0) - (b.data.seriesPart || 0));
  });

  // Articles belonging to a specific edition number
  eleventyConfig.addFilter("editionArticles", (allContent, editionNum) => {
    return allContent
      .filter(item => Number(item.data.edition) === Number(editionNum))
      .sort((a, b) => b.date - a.date);
  });

  // ─── String Filters ─────────────────────────────────────────────────────────
  eleventyConfig.addFilter("excerpt", (content, length = 160) => {
    const stripped = content.replace(/(<([^>]+)>)/gi, "");
    return stripped.length > length ? stripped.substring(0, length).trim() + "…" : stripped;
  });

  eleventyConfig.addFilter("slugify", (str) => {
    return (str || '').toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  });

  eleventyConfig.addFilter("extractYear", (source, era) => {
    if (!source) return 0;
    const m = source.match(/\((?:c\.\s*)?(-?\d{3,4})/);
    if (m) return parseInt(m[1], 10);
    // Fallback by era for "attributed" quotes
    const eraMap = { 'Ancient': -300, 'Early Modern': 1550, 'Enlightenment': 1760, '18th Century': 1780, '19th Century': 1870, '20th Century': 1950, '21st Century': 2005 };
    return eraMap[era] || 0;
  });

  // Extract YouTube video ID from assorted URL shapes (watch?v=, youtu.be/, embed/)
  eleventyConfig.addFilter("ytVideoId", (url) => {
    if (!url) return "";
    const m = String(url).match(/(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : "";
  });

  eleventyConfig.addFilter("quoteSlug", (q) => {
    const author = (q.author || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const words = (q.quote || "").split(/\s+/).slice(0, 6).join(" ").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    return author + "-" + words;
  });

  eleventyConfig.addFilter("limit", (arr, limit) => arr.slice(0, limit));

  eleventyConfig.addFilter("titleCase", (str) => {
    if (!str) return "";
    const minor = new Set(["a","an","the","and","but","or","for","nor","on","at","to","by","in","of","up","as","is"]);
    return str.replace(/-/g, " ").split(" ").map((word, i) => {
      if (!word) return word;
      return (i === 0 || !minor.has(word.toLowerCase()))
        ? word.charAt(0).toUpperCase() + word.slice(1)
        : word.toLowerCase();
    }).join(" ");
  });

  eleventyConfig.addFilter("topTagsForSection", (collection, limit = 6) => {
    const skip = new Set(["post", "all"]);
    const counts = {};
    for (const item of (collection || [])) {
      for (const tag of (item.data.tags || [])) {
        if (skip.has(tag)) continue;
        counts[tag] = (counts[tag] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tag]) => tag);
  });

  eleventyConfig.addFilter("urlencode", (str) => encodeURIComponent(str || ""));

  // Convert a page URL to a flat slug for OG image filenames
  // e.g. /opinion/my-article/ → opinion-my-article
  eleventyConfig.addFilter("ogSlug", (url) => {
    return (url || "").replace(/\//g, "-").replace(/^-|-$/g, "");
  });

  // Word-wrap a string to an array of lines with at most `max` chars per
  // line, breaking on word boundaries. Used by og-images.njk for native
  // SVG <text> rendering since resvg-js doesn't support foreignObject.
  // Long single words (> max) fall onto their own line uncut.
  eleventyConfig.addFilter("wrap", (text, max) => {
    if (!text) return [];
    const words = String(text).split(/\s+/).filter(Boolean);
    const limit = Math.max(1, max || 40);
    const lines = [];
    let current = "";
    for (const w of words) {
      if (!current.length) { current = w; continue; }
      if (current.length + 1 + w.length > limit) {
        lines.push(current);
        current = w;
      } else {
        current += " " + w;
      }
    }
    if (current) lines.push(current);
    return lines;
  });

  eleventyConfig.addFilter("where", (arr, key, value) => {
    return arr.filter(item => item.data[key] === value);
  });

  // ─── Collections ─────────────────────────────────────────────────────────────
  const siteData = require("./src/_data/site.js");
  const sections = Object.keys(siteData.sections).filter(
    key => !["thought-experiments", "trials-of-thought", "glossary", "bookshelf"].includes(key)
  );

  // Scheduled publishing: exclude articles with future dates (unless SHOW_FUTURE env var set)
  const NOW = new Date();
  const SHOW_FUTURE = process.env.SHOW_FUTURE === "1";
  const isNotFuture = (item) => SHOW_FUTURE || item.date <= NOW;

  // All content across every section, newest first
  eleventyConfig.addCollection("allContent", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/content/**/*.md")
      .filter(item => !item.data.draft && isNotFuture(item))
      .sort((a, b) => b.date - a.date);
  });

  // Featured content for front page
  eleventyConfig.addCollection("featured", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/content/**/*.md")
      .filter(item => item.data.featured && !item.data.draft && isNotFuture(item))
      .sort((a, b) => b.date - a.date);
  });

  // Per-section collections
  sections.forEach(section => {
    eleventyConfig.addCollection(section, (collectionApi) => {
      return collectionApi
        .getFilteredByGlob(`src/content/${section}/*.md`)
        .filter(item => (!item.data.draft || process.env.SHOW_DRAFTS === "1") && isNotFuture(item))
        .sort((a, b) => b.date - a.date);
    });
  });

  // Flat list of section slugs — used by the per-section RSS feed
  // template to paginate and emit /feed-{section}.xml for each one.
  eleventyConfig.addCollection("sectionList", () => sections.slice());

  // All tags across all content (for tag pages)
  eleventyConfig.addCollection("tagList", (collectionApi) => {
    const tagSet = new Set();
    collectionApi.getFilteredByGlob("src/content/**/*.md").forEach(item => {
      (item.data.tags || []).forEach(tag => {
        if (!["post", "all"].includes(tag)) tagSet.add(tag);
      });
    });
    return [...tagSet].sort();
  });

  // Articles with corrections, sorted by most recent correction date
  eleventyConfig.addCollection("correctionsLog", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/content/**/*.md")
      .filter(item => item.data.corrections && item.data.corrections.length > 0)
      .sort((a, b) => {
        const aLast = a.data.corrections[a.data.corrections.length - 1].date;
        const bLast = b.data.corrections[b.data.corrections.length - 1].date;
        return new Date(bLast) - new Date(aLast);
      });
  });

  // Unique edition numbers, sorted descending
  eleventyConfig.addCollection("editionList", (collectionApi) => {
    const editions = new Set();
    collectionApi.getFilteredByGlob("src/content/**/*.md").forEach(item => {
      if (item.data.edition != null) editions.add(Number(item.data.edition));
    });
    return [...editions].sort((a, b) => b - a);
  });

  // Per-author collections
  eleventyConfig.addCollection("authorList", (collectionApi) => {
    const authorSet = new Set();
    collectionApi.getFilteredByGlob("src/content/**/*.md").forEach(item => {
      if (item.data.author) authorSet.add(item.data.author);
    });
    return [...authorSet].sort();
  });

  // Articles that declare themselves a response to the given URL.
  // responseTo may be a string (URL) or { url, title, ... } object —
  // normalise to the URL string before comparing.
  const responseUrlOf = (rt) =>
    rt == null ? null : (typeof rt === "object" ? rt.url : rt);

  eleventyConfig.addFilter("responsesTo", (allContent, targetUrl) => {
    if (!targetUrl) return [];
    return allContent.filter(item => responseUrlOf(item.data.responseTo) === targetUrl);
  });

  // Concept index — group entries by first letter (A-Z, with # for
  // anything non-alpha). Returns [{ letter, entries }] alphabetised.
  eleventyConfig.addFilter("groupConceptIndex", (entries) => {
    const groups = {};
    for (const e of entries || []) {
      const first = String(e.term || '').trim().charAt(0).toUpperCase();
      const key = /^[A-Z]$/.test(first) ? first : '#';
      (groups[key] = groups[key] || []).push(e);
    }
    return Object.keys(groups)
      .sort()
      .map(letter => ({
        letter,
        entries: groups[letter].slice().sort((a, b) =>
          String(a.term).localeCompare(String(b.term), 'en', { sensitivity: 'base' })
        ),
      }));
  });

  // All articles that respond to anything (internal or external),
  // grouped by target URL for the public /responses/ index. Each group
  // contains: { targetUrl, isExternal, targetItem (if internal),
  //             targetTitle, targetPublisher, responses[] }.
  eleventyConfig.addCollection("responseThreads", (collectionApi) => {
    const all = collectionApi
      .getFilteredByGlob("src/content/**/*.md")
      .filter(item => !item.data.draft && (!item.date || item.date <= new Date() || process.env.SHOW_FUTURE === "1"));
    const byTarget = new Map();
    for (const item of all) {
      const rt = item.data.responseTo;
      if (!rt) continue;
      const url = responseUrlOf(rt);
      if (!url) continue;
      if (!byTarget.has(url)) {
        const isExternal = String(url).startsWith("http");
        const targetItem = isExternal ? null : all.find(x => x.url === url);
        byTarget.set(url, {
          targetUrl: url,
          isExternal,
          targetItem,
          targetTitle: targetItem ? targetItem.data.title
            : (typeof rt === "object" && rt.title) ? rt.title : url,
          targetAuthor: (typeof rt === "object" && rt.author) ? rt.author : null,
          targetPublisher: (typeof rt === "object" && rt.publisher) ? rt.publisher : null,
          targetDate: (typeof rt === "object" && rt.date) ? rt.date : (targetItem ? targetItem.date : null),
          responses: [],
        });
      }
      byTarget.get(url).responses.push(item);
    }
    return [...byTarget.values()]
      .map(g => ({
        ...g,
        responses: g.responses.sort((a, b) => b.date - a.date),
        latest: g.responses.reduce((m, r) => (r.date > m ? r.date : m), new Date(0)),
      }))
      .sort((a, b) => b.latest - a.latest);
  });

  // Articles that link to the current page (backlinks / digital garden)
  eleventyConfig.addFilter("backlinksTo", (allContent, currentUrl) => {
    if (!currentUrl) return [];
    const bare = currentUrl.replace(/\/$/, "");
    return allContent.filter(item => {
      const content = item.templateContent || "";
      return content.includes(`href="${currentUrl}"`) || content.includes(`href="${bare}"`);
    });
  });

  // Other articles published on the same date (excludes current URL)
  eleventyConfig.addFilter("sameDate", (allContent, dateObj, currentUrl) => {
    const dateStr = DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("yyyy-LL-dd");
    return allContent.filter(item => {
      if (item.url === currentUrl) return false;
      return DateTime.fromJSDate(item.date, { zone: "utc" }).toFormat("yyyy-LL-dd") === dateStr;
    });
  });

  // Group allContent into [{date, label, articles}] sorted newest first, for archives
  eleventyConfig.addFilter("groupByDate", (allContent) => {
    const groups = {};
    allContent.forEach(item => {
      const dateStr = DateTime.fromJSDate(item.date, { zone: "utc" }).toFormat("yyyy-LL-dd");
      if (!groups[dateStr]) groups[dateStr] = { date: dateStr, articles: [] };
      groups[dateStr].articles.push(item);
    });
    return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
  });

  // Word count for a single content item (reads raw Markdown, strips front matter).
  // Safe to call inside filters — doesn't depend on templateContent being populated.
  const countWords = (item) => {
    try {
      if (item.inputPath && fs.existsSync(item.inputPath)) {
        const raw = fs.readFileSync(item.inputPath, "utf8");
        const body = raw.replace(/^---[\s\S]*?---/, "");
        return body.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
      }
    } catch (e) { /* ignore */ }
    return 0;
  };

  // Load author profiles once so we can resolve slugs -> display names.
  const authorProfiles = (() => {
    try {
      const dir = path.join(__dirname, "src", "_data", "authorProfiles");
      const map = {};
      if (fs.existsSync(dir)) {
        fs.readdirSync(dir).filter(f => f.endsWith(".json")).forEach(f => {
          const data = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
          const slug = data.slug || f.replace(/\.json$/, "");
          map[slug] = data;
        });
      }
      return map;
    } catch (e) { return {}; }
  })();

  // Per-author stats: [{ name, count, totalWords, avgWords, totalReadingMin, sections }]
  // Groups by the author SLUG (item.data.author), not the byline, so every
  // role-based byline (The Editors / Staff Reporter / Staff Critic / Letters
  // Editor) collapses under the real person or staff record.
  eleventyConfig.addFilter("authorStats", (allContent) => {
    const stats = {};
    allContent.forEach(item => {
      const slug = item.data.author || "unknown";
      const displayName = (authorProfiles[slug] && authorProfiles[slug].name) || slug;
      if (!stats[slug]) stats[slug] = { slug, name: displayName, count: 0, totalWords: 0, sections: new Set() };
      stats[slug].count++;
      stats[slug].totalWords += countWords(item);
      if (item.data.section) stats[slug].sections.add(item.data.section);
    });
    return Object.values(stats).map(s => ({
      name: s.name,
      count: s.count,
      totalWords: s.totalWords,
      avgWords: s.count > 0 ? Math.round(s.totalWords / s.count) : 0,
      totalReadingMin: Math.ceil(s.totalWords / 225),
      sections: Array.from(s.sections).join(", ")
    })).sort((a, b) => b.count - a.count);
  });

  // Per-section stats: [{ section, count, totalWords, avgWords, totalReadingMin }]
  eleventyConfig.addFilter("sectionStats", (allContent) => {
    const stats = {};
    allContent.forEach(item => {
      const section = item.data.section || "Uncategorised";
      if (!stats[section]) stats[section] = { section, count: 0, totalWords: 0 };
      stats[section].count++;
      stats[section].totalWords += countWords(item);
    });
    return Object.values(stats).map(s => ({
      section: s.section,
      count: s.count,
      totalWords: s.totalWords,
      avgWords: s.count > 0 ? Math.round(s.totalWords / s.count) : 0,
      totalReadingMin: Math.ceil(s.totalWords / 225)
    })).sort((a, b) => b.totalWords - a.totalWords);
  });

  // Status counts for a collection
  eleventyConfig.addFilter("statusCounts", (allContent) => {
    const counts = { draft: 0, review: 0, published: 0 };
    allContent.forEach(item => {
      if (item.data.status === "draft" || item.data.draft) counts.draft++;
      else if (item.data.status === "review") counts.review++;
      else counts.published++;
    });
    return counts;
  });

  // Serialize value as JSON (pretty-printed for readability)
  eleventyConfig.addFilter("toJSON", (value) => JSON.stringify(value, null, 2));

  // Transform a collection into API records — each item as { ...frontMatter, url }
  // Strips Eleventy internals like `collections`, `eleventy`, `page`, etc.
  eleventyConfig.addFilter("toApiItems", (items, baseUrl) => {
    const strip = new Set(["collections", "eleventy", "page", "pagination", "pkg", "tags", "layout", "permalink", "eleventyComputed", "eleventyExcludeFromCollections", "site", "authors", "quotes", "videos", "events", "timeline", "feeds", "changelog", "gallery", "playlists", "songs", "library", "projects"]);
    return items.map(item => {
      const out = { url: (baseUrl || "") + (item.url || "") };
      Object.keys(item.data || {}).forEach(k => {
        if (!strip.has(k) && typeof item.data[k] !== "function") {
          out[k] = item.data[k];
        }
      });
      return out;
    });
  });

  // Transform a content collection into API-ready article records
  eleventyConfig.addFilter("toApiArticles", (items, baseUrl) => {
    return items.map(item => ({
      title: item.data.title || "",
      description: item.data.description || "",
      url: (baseUrl || "") + (item.url || ""),
      slug: item.fileSlug || "",
      section: item.data.section || "",
      author: item.data.authorName || item.data.author || "",
      date: item.date ? item.date.toISOString().slice(0, 10) : "",
      tags: item.data.tags || [],
      featured: !!item.data.featured
    }));
  });

  // Topic stats: for each tag, returns { tag, count, related: [{ tag, cooccur }], top: [items] }
  // Related tags are ordered by how often they co-occur with the current tag.
  // `limit` controls how many related tags to return per topic (default 5).
  eleventyConfig.addFilter("topicStats", (allContent, limit = 5) => {
    const articlesByTag = new Map();
    allContent.forEach(item => {
      (item.data.tags || []).forEach(t => {
        if (t === "post" || t === "all") return;
        if (!articlesByTag.has(t)) articlesByTag.set(t, []);
        articlesByTag.get(t).push(item);
      });
    });

    const cooccur = new Map(); // "tagA|tagB" → count
    allContent.forEach(item => {
      const tags = (item.data.tags || []).filter(t => t !== "post" && t !== "all");
      for (let i = 0; i < tags.length; i++) {
        for (let j = i + 1; j < tags.length; j++) {
          const key = [tags[i], tags[j]].sort().join("|");
          cooccur.set(key, (cooccur.get(key) || 0) + 1);
        }
      }
    });

    const related = (tag) => {
      const result = [];
      cooccur.forEach((count, key) => {
        const [a, b] = key.split("|");
        if (a === tag) result.push({ tag: b, cooccur: count });
        else if (b === tag) result.push({ tag: a, cooccur: count });
      });
      return result.sort((a, b) => b.cooccur - a.cooccur).slice(0, limit);
    };

    return Array.from(articlesByTag.entries())
      .map(([tag, items]) => ({
        tag,
        count: items.length,
        related: related(tag),
        top: items.sort((a, b) => (b.date || 0) - (a.date || 0)).slice(0, 3)
      }))
      .sort((a, b) => b.count - a.count);
  });

  // Active assignments: articles with an `assignedTo` field that aren't yet published.
  // Returns [{ title, url, assignedTo, dueDate, status, daysUntilDue, overdue }] sorted by due date.
  eleventyConfig.addFilter("activeAssignments", (allContent) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return allContent
      .filter(item => item.data.assignedTo)
      .filter(item => {
        const isPublished = !item.data.draft && item.data.status !== "draft" && item.data.status !== "review";
        return !isPublished;
      })
      .map(item => {
        const due = item.data.dueDate ? new Date(item.data.dueDate) : null;
        const daysUntilDue = due ? Math.ceil((due - today) / 86400000) : null;
        return {
          title: item.data.title,
          url: item.url,
          assignedTo: item.data.assignedTo,
          dueDate: due ? due.toISOString().slice(0, 10) : null,
          status: item.data.draft ? "draft" : (item.data.status || "published"),
          daysUntilDue,
          overdue: due && daysUntilDue < 0
        };
      })
      .sort((a, b) => {
        // Overdue first, then earliest due, then no-due-date last
        if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return 0;
      });
  });

  // Filter a collection by status (draft / review / published)
  eleventyConfig.addFilter("byStatus", (allContent, status) => {
    return allContent.filter(item => {
      const isDraft = item.data.status === "draft" || item.data.draft;
      const isReview = item.data.status === "review";
      if (status === "draft") return isDraft;
      if (status === "review") return isReview && !isDraft;
      if (status === "published") return !isDraft && !isReview;
      return false;
    });
  });

  // ── Enhanced editorial workflow filters ─────────────────────────────────────
  // The five-column board (+ Spiked) uses this taxonomy:
  //   pitched | drafting | review | scheduled | published | spiked
  // Computed from front-matter `status` + a few overrides (future-dated
  // pieces auto-read as scheduled regardless of explicit status; legacy
  // `draft: true` maps to drafting; legacy `status: draft` maps to drafting).
  function computeEnhancedStatus(item) {
    const data = item.data || {};
    const explicit = (data.status || "").toString().toLowerCase();
    if (explicit === "spiked" || explicit === "killed" || explicit === "held") return "spiked";
    // Future-dated articles are scheduled regardless of explicit status.
    const itemDate = item.date || (data.page && data.page.date) || null;
    if (itemDate && new Date(itemDate) > new Date()) return "scheduled";
    if (explicit === "pitched") return "pitched";
    if (explicit === "review") return "review";
    if (explicit === "drafting" || explicit === "draft" || data.draft === true) return "drafting";
    if (explicit === "scheduled") return "scheduled";
    return "published";
  }

  // Object.keys() exposed as a Nunjucks filter — handy for iterating
  // a dict's slugs without a `for k, v in obj` indirection.
  eleventyConfig.addFilter("keys", (obj) => obj && typeof obj === "object" ? Object.keys(obj) : []);

  // Word count read from the raw markdown file. Eleventy filters that
  // run during the templateMap pass can't always access
  // item.templateContent (TemplateContentPrematureUseError), and any
  // word-count derived from that returns 0 on a cold build. Reading
  // the file directly with a tiny fs cache dodges the issue and
  // produces stable counts for the dashboard / scoreboard /
  // contributors filters. Strips front-matter, common markdown
  // punctuation, and HTML tags before splitting on whitespace.
  const _wordCountCache = new Map();
  function rawWords(item) {
    if (!item || !item.inputPath) return 0;
    if (_wordCountCache.has(item.inputPath)) return _wordCountCache.get(item.inputPath);
    let count = 0;
    try {
      const fs = require("fs");
      const raw = fs.readFileSync(item.inputPath, "utf8");
      // Strip the leading YAML / TOML / JSON front-matter block.
      const body = raw.replace(/^---[\s\S]*?\n---\s*\n?/, "");
      // Strip HTML tags and the most common markdown punctuation, then
      // split on whitespace and count non-empty tokens.
      const text = body
        .replace(/<[^>]+>/g, " ")
        .replace(/[`*#>_~|\[\]()!]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      count = text ? text.split(" ").filter(Boolean).length : 0;
    } catch (_) { /* file unreadable — leave 0 */ }
    _wordCountCache.set(item.inputPath, count);
    return count;
  }

  eleventyConfig.addFilter("enhancedStatus", (item) => computeEnhancedStatus(item));

  eleventyConfig.addFilter("byEnhancedStatus", (allContent, status) => {
    return allContent.filter(item => computeEnhancedStatus(item) === status);
  });

  // Days the article has been in its current column. Falls back to
  // article date when no `lastStatusChange` is set.
  eleventyConfig.addFilter("daysInStatus", (item) => {
    const data = item.data || {};
    const ref = data.lastStatusChange ? new Date(data.lastStatusChange) :
                (item.date ? new Date(item.date) : null);
    if (!ref || isNaN(ref.getTime())) return null;
    const days = Math.floor((Date.now() - ref.getTime()) / 86400000);
    return days < 0 ? 0 : days;
  });

  // Editorial-board-ready cards with all the metadata the new board
  // template needs, grouped by enhanced status. Returns:
  //   { pitched: [card,...], drafting: [...], review: [...],
  //     scheduled: [...], published: [...], spiked: [...] }
  // Each card: { url, title, section, sectionSlug, author, authorName,
  //   authorSlug, daysInStatus, stuckLevel ('','amber','red'),
  //   editor, reviewer, dueDate, isOverdue, wordCount, dueDateLabel }
  eleventyConfig.addFilter("editorialBoard", (allContent) => {
    const buckets = { pitched: [], drafting: [], review: [], scheduled: [], published: [], spiked: [] };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    allContent.forEach(item => {
      const status = computeEnhancedStatus(item);
      const data = item.data || {};
      const ref = data.lastStatusChange ? new Date(data.lastStatusChange) :
                  (item.date ? new Date(item.date) : null);
      const daysInStatus = ref && !isNaN(ref.getTime())
        ? Math.max(0, Math.floor((Date.now() - ref.getTime()) / 86400000))
        : null;
      let stuckLevel = "";
      if (daysInStatus != null && status !== "published" && status !== "spiked") {
        if (daysInStatus >= 14) stuckLevel = "red";
        else if (daysInStatus >= 7) stuckLevel = "amber";
      }
      const due = data.dueDate ? new Date(data.dueDate) : null;
      const isOverdue = due && !isNaN(due.getTime()) && due < today && (status === "pitched" || status === "drafting" || status === "review");
      // Word count from the raw markdown file (templateContent isn't
      // accessible while other templates are still rendering).
      const wordCount = rawWords(item) || null;
      const card = {
        url: item.url,
        title: data.title || "(untitled)",
        section: data.section || "",
        sectionSlug: (data.section || "").toLowerCase().replace(/\s+/g, "-").replace(/&/g, ""),
        author: data.authorName || data.author || "",
        authorSlug: data.author || "",
        date: item.date,
        daysInStatus,
        stuckLevel,
        editor: data.editor || null,
        reviewer: data.reviewer || null,
        dueDate: due && !isNaN(due.getTime()) ? due.toISOString().slice(0, 10) : null,
        isOverdue,
        wordCount,
        spikedReason: data.spikedReason || null,
        tags: (data.tags || []).filter(t => t !== "post" && t !== "all")
      };
      if (buckets[status]) buckets[status].push(card);
    });
    // Sort each bucket sensibly:
    //  - overdue first in active columns
    //  - then by daysInStatus desc (most stuck first)
    //  - published most recent first
    //  - spiked most recent first
    Object.keys(buckets).forEach(k => {
      if (k === "published") {
        buckets[k].sort((a, b) => (b.date || 0) - (a.date || 0));
      } else if (k === "spiked") {
        buckets[k].sort((a, b) => (b.date || 0) - (a.date || 0));
      } else {
        buckets[k].sort((a, b) => {
          if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
          return (b.daysInStatus || 0) - (a.daysInStatus || 0);
        });
      }
    });
    return buckets;
  });

  // Per-column "median age Xd · oldest Yd" stats for the SLA bands.
  eleventyConfig.addFilter("editorialBoardStats", (board) => {
    const out = {};
    Object.keys(board).forEach(col => {
      const ages = board[col].map(c => c.daysInStatus).filter(d => d != null);
      if (!ages.length) { out[col] = { count: 0, median: null, oldest: null }; return; }
      const sorted = [...ages].sort((a, b) => a - b);
      const median = sorted.length % 2 === 1
        ? sorted[(sorted.length - 1) / 2]
        : Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2);
      out[col] = { count: ages.length, median, oldest: sorted[sorted.length - 1] };
    });
    return out;
  });

  // Per-column distribution of daysInStatus, bucketed [0-3, 4-7, 8-14, 15+].
  // Feeds the dashboard's cycle-time histogram card.
  eleventyConfig.addFilter("cycleTimeBuckets", (board) => {
    const out = {};
    Object.keys(board).forEach(col => {
      const buckets = { fresh: 0, warming: 0, stuck: 0, severe: 0 };
      board[col].forEach(card => {
        const d = card.daysInStatus;
        if (d == null) return;
        if (d <= 3) buckets.fresh++;
        else if (d <= 7) buckets.warming++;
        else if (d <= 14) buckets.stuck++;
        else buckets.severe++;
      });
      out[col] = buckets;
    });
    return out;
  });

  // Per-author publish velocity: articles published per ISO week for the
  // last N weeks (default 8) plus a 30d-vs-prior-30d delta.
  eleventyConfig.addFilter("velocity", (allContent, weeks) => {
    const N = weeks || 8;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const msWeek = 7 * 86400000;
    // ISO-week-of-year string yyyy-Www
    function isoWeek(d) {
      const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      const day = date.getUTCDay() || 7;
      date.setUTCDate(date.getUTCDate() + 4 - day);
      const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
      const wk = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
      return date.getUTCFullYear() + "-W" + String(wk).padStart(2, "0");
    }
    // Build the rolling N-week label list ending this week
    const labels = [];
    for (let i = N - 1; i >= 0; i--) {
      const d = new Date(today.getTime() - i * msWeek);
      labels.push(isoWeek(d));
    }
    const byAuthor = new Map();
    allContent.forEach(item => {
      const slug = item.data && item.data.author;
      if (!slug || slug === "staff") return;
      if (computeEnhancedStatus(item) !== "published") return;
      if (!item.date) return;
      const wk = isoWeek(new Date(item.date));
      if (!labels.includes(wk)) {
        // Outside the N-week window — only used for the prior-30d delta below
      }
      if (!byAuthor.has(slug)) {
        byAuthor.set(slug, { slug, perWeek: {}, total: 0, last30: 0, prev30: 0 });
      }
      const a = byAuthor.get(slug);
      a.perWeek[wk] = (a.perWeek[wk] || 0) + 1;
      const ageMs = today - new Date(item.date).getTime();
      if (ageMs >= 0 && ageMs <= 30 * 86400000) a.last30++;
      else if (ageMs > 30 * 86400000 && ageMs <= 60 * 86400000) a.prev30++;
    });
    return Array.from(byAuthor.values()).map(a => {
      const weeks = labels.map(wk => ({ week: wk, count: a.perWeek[wk] || 0 }));
      const total = weeks.reduce((s, w) => s + w.count, 0);
      const delta = a.last30 - a.prev30;
      return { slug: a.slug, weeks, total, last30: a.last30, prev30: a.prev30, delta };
    }).sort((a, b) => b.total - a.total);
  });

  // WIP limits per column. No build-snapshot history on a static site, so
  // we use sensible hard limits and surface a `breach: true` flag when
  // the live count exceeds 1.5x the limit.
  eleventyConfig.addFilter("wipLimits", (board) => {
    const limits = { pitched: 8, drafting: 5, review: 3, scheduled: 12 };
    const out = {};
    Object.keys(limits).forEach(col => {
      const n = (board[col] || []).length;
      const limit = limits[col];
      out[col] = { count: n, limit, breach: n > Math.round(limit * 1.5) };
    });
    return out;
  });

  // Late-assignment buckets {soon: 1-3 days, late: 4-7, severe: 8+}.
  // Operates on the `activeAssignments` filter output.
  eleventyConfig.addFilter("slaBreaches", (assignments) => {
    const out = { soon: [], late: [], severe: [] };
    (assignments || []).forEach(a => {
      if (!a.overdue) return;
      const lateBy = -1 * a.daysUntilDue;
      const entry = { ...a, lateBy };
      if (lateBy >= 8) out.severe.push(entry);
      else if (lateBy >= 4) out.late.push(entry);
      else out.soon.push(entry);
    });
    Object.keys(out).forEach(k => {
      out[k].sort((a, b) => b.lateBy - a.lateBy);
    });
    return out;
  });

  // Articles still pitched/drafting/review with a dueDate — for the
  // calendar's deadline-overlay layer (ghost cards on dueDate cells).
  eleventyConfig.addFilter("deadlineOverlays", (allContent) => {
    return (allContent || [])
      .filter(item => {
        const status = computeEnhancedStatus(item);
        return (status === "pitched" || status === "drafting" || status === "review")
            && item.data && item.data.dueDate;
      })
      .map(item => {
        const due = new Date(item.data.dueDate);
        return {
          url: item.url,
          title: item.data.title || "(untitled)",
          section: item.data.section || "",
          author: item.data.authorName || item.data.author || "",
          dueDate: !isNaN(due.getTime()) ? due.toISOString().slice(0, 10) : null,
          status: computeEnhancedStatus(item)
        };
      })
      .filter(o => o.dueDate);
  });

  // Stale-content alert generator for the dashboard.
  // Returns three lists: oldDrafts, recentCorrections, fastSectionStale.
  eleventyConfig.addFilter("staleAlerts", (allContent) => {
    const today = Date.now();
    const FAST_SECTIONS = new Set(["news", "opinion", "politics"]);
    const oldDrafts = [];
    const recentCorrections = [];
    const fastSectionStale = [];
    const brokenResponses = [];
    const urlSet = new Set(allContent.map(i => i.url));
    allContent.forEach(item => {
      const data = item.data || {};
      const status = computeEnhancedStatus(item);
      const itemDate = item.date ? new Date(item.date).getTime() : null;
      const ageDays = itemDate ? Math.floor((today - itemDate) / 86400000) : null;
      // 1. Drafts older than 14 days
      if ((status === "drafting" || status === "pitched" || status === "review") && ageDays != null && ageDays >= 14) {
        oldDrafts.push({
          url: item.url,
          title: data.title || "(untitled)",
          author: data.authorName || data.author || "",
          status,
          ageDays
        });
      }
      // 2. Articles with corrections in the last 30 days
      if (Array.isArray(data.corrections) && data.corrections.length) {
        const last = data.corrections[data.corrections.length - 1];
        const lastDate = last && last.date ? new Date(last.date).getTime() : null;
        if (lastDate != null && (today - lastDate) <= 30 * 86400000) {
          recentCorrections.push({
            url: item.url,
            title: data.title || "(untitled)",
            correctionDate: last.date,
            description: last.description || ""
          });
        }
      }
      // 3. Fast-section articles with lastUpdated > 6 months
      const sectionSlug = (data.section || "").toString().toLowerCase().replace(/\s+/g, "-");
      if (status === "published" && FAST_SECTIONS.has(sectionSlug)) {
        const lu = data.lastUpdated ? new Date(data.lastUpdated).getTime() :
                   (itemDate || null);
        if (lu != null && (today - lu) > 180 * 86400000) {
          fastSectionStale.push({
            url: item.url,
            title: data.title || "(untitled)",
            section: data.section,
            ageDays: Math.floor((today - lu) / 86400000)
          });
        }
      }
      // 4. Broken inResponseTo chains
      if (data.inResponseTo) {
        const target = data.inResponseTo;
        const isInternal = target.startsWith("/") || target.includes((siteData.url || "").replace(/^https?:\/\//, ""));
        if (isInternal) {
          const path = target.replace(/^https?:\/\/[^/]+/, "").replace(/[?#].*$/, "");
          if (path && !urlSet.has(path) && !urlSet.has(path.endsWith("/") ? path : path + "/")) {
            brokenResponses.push({
              url: item.url,
              title: data.title || "(untitled)",
              missingTarget: target
            });
          }
        }
      }
    });
    oldDrafts.sort((a, b) => b.ageDays - a.ageDays);
    fastSectionStale.sort((a, b) => b.ageDays - a.ageDays);
    return { oldDrafts, recentCorrections, fastSectionStale, brokenResponses };
  });

  // Coverage-gap report: per-section pulse over 14d / 90d windows.
  eleventyConfig.addFilter("coverageGaps", (allContent, sectionSlugs) => {
    const sections = Array.isArray(sectionSlugs) ? sectionSlugs : Object.keys(siteData.sections || {});
    const today = Date.now();
    return sections.map(slug => {
      const label = (siteData.sections && siteData.sections[slug] && siteData.sections[slug].label) || slug;
      const items = allContent.filter(item => {
        const sec = (item.data.section || "").toString().toLowerCase().replace(/\s+/g, "-");
        return sec === slug && computeEnhancedStatus(item) === "published";
      });
      let last14 = 0, last90 = 0, lastDate = null;
      items.forEach(item => {
        const t = item.date ? new Date(item.date).getTime() : null;
        if (t == null) return;
        if (today - t <= 14 * 86400000) last14++;
        if (today - t <= 90 * 86400000) last90++;
        if (lastDate == null || t > lastDate) lastDate = t;
      });
      let healthLevel = "ok";
      if (last90 === 0) healthLevel = "red";
      else if (last14 === 0) healthLevel = "amber";
      return {
        slug,
        label,
        last14,
        last90,
        lastDate: lastDate ? new Date(lastDate).toISOString().slice(0, 10) : null,
        daysSince: lastDate ? Math.floor((today - lastDate) / 86400000) : null,
        healthLevel
      };
    });
  });

  // Production pulse: weekly published-article counts for the last N weeks.
  eleventyConfig.addFilter("productionPulse", (allContent, weeks) => {
    const N = weeks || 12;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    // Find Monday of current week.
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7));
    const buckets = [];
    for (let i = N - 1; i >= 0; i--) {
      const start = new Date(monday);
      start.setDate(monday.getDate() - i * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      buckets.push({ start, end, count: 0, label: start.toISOString().slice(5, 10) });
    }
    allContent.forEach(item => {
      if (computeEnhancedStatus(item) !== "published") return;
      const t = item.date ? new Date(item.date).getTime() : null;
      if (t == null) return;
      buckets.forEach(b => {
        if (t >= b.start.getTime() && t < b.end.getTime()) {
          b.count++;
          if (!b.items) b.items = [];
          b.items.push({
            title: item.data.title || "(untitled)",
            url: item.url,
            section: item.data.section || "",
            date: item.date.toISOString().slice(0, 10)
          });
        }
      });
    });
    const max = Math.max(1, ...buckets.map(b => b.count));
    return buckets.map(b => ({
      label: b.label,
      count: b.count,
      pct: Math.round((b.count / max) * 100),
      rangeLabel: b.start.toISOString().slice(0, 10) + " → " + new Date(b.end.getTime() - 86400000).toISOString().slice(0, 10),
      items: (b.items || []).sort((a, c) => c.date.localeCompare(a.date))
    }));
  });

  // Per-author scoreboard for the dashboard.
  eleventyConfig.addFilter("authorScoreboard", (allContent, authorList) => {
    const stats = {};
    (authorList || []).forEach(slug => {
      stats[slug] = { slug, articles: 0, drafts: 0, words: 0, lastDate: null, lastTitles: [] };
    });
    allContent.forEach(item => {
      const data = item.data || {};
      const slug = data.author;
      if (!slug || !stats[slug]) return;
      const status = computeEnhancedStatus(item);
      if (status === "published") {
        stats[slug].articles++;
        stats[slug].words += rawWords(item);
        const t = item.date ? new Date(item.date).getTime() : null;
        if (t != null && (stats[slug].lastDate == null || t > stats[slug].lastDate)) stats[slug].lastDate = t;
        stats[slug].lastTitles.push({ title: data.title || "(untitled)", url: item.url, date: t });
      } else if (status === "pitched" || status === "drafting" || status === "review") {
        stats[slug].drafts++;
      }
    });
    return Object.values(stats).map(s => {
      s.lastTitles.sort((a, b) => (b.date || 0) - (a.date || 0));
      s.lastTitles = s.lastTitles.slice(0, 3);
      s.lastDateIso = s.lastDate ? new Date(s.lastDate).toISOString().slice(0, 10) : null;
      s.avgWords = s.articles ? Math.round(s.words / s.articles) : 0;
      return s;
    }).sort((a, b) => b.words - a.words);
  });

  // 14-day scheduling agenda — count of scheduled posts per day.
  eleventyConfig.addFilter("schedulingAgenda", (allContent, days) => {
    const N = days || 14;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const slots = [];
    for (let i = 0; i < N; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      slots.push({
        iso: d.toISOString().slice(0, 10),
        weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
        dayOfMonth: d.getDate(),
        items: []
      });
    }
    allContent.forEach(item => {
      const t = item.date ? new Date(item.date) : null;
      if (!t || isNaN(t.getTime())) return;
      const iso = t.toISOString().slice(0, 10);
      const slot = slots.find(s => s.iso === iso);
      if (!slot) return;
      // Only future-dated published articles or explicit scheduled.
      if (t.getTime() < today.getTime()) return;
      slot.items.push({ url: item.url, title: item.data.title || "(untitled)", section: item.data.section || "" });
    });
    return slots;
  });

  // Per-author profile + stats for the /contributors/ grid.
  // Returns a map keyed by author slug with: name, role, location, bio,
  // photo, social, lifetime article + word + reading-time totals, last
  // published date, isActive flag (published in last 90d), top 5 tags
  // ("beat"), most recent article {title, url, date, section}, drafts
  // in flight, and the underlying authorData for any extra fields.
  eleventyConfig.addFilter("contributorsRoster", (authorsObj, allContent) => {
    const roster = {};
    Object.keys(authorsObj || {}).forEach(slug => {
      if (slug === "staff") return;
      const a = authorsObj[slug] || {};
      roster[slug] = {
        slug,
        name: a.name || slug,
        role: a.role || "",
        location: a.location || "",
        bio: a.bio || "",
        photo: a.photo || "",
        social: a.social || {},
        tipping: a.tipping || {},
        articles: 0,
        drafts: 0,
        words: 0,
        readingMin: 0,
        lastDate: null,
        recentArticle: null,
        tagCounts: {},
        sectionCounts: {}
      };
    });
    (allContent || []).forEach(item => {
      const data = item.data || {};
      const slug = data.author;
      if (!slug || !roster[slug]) return;
      const status = computeEnhancedStatus(item);
      if (status === "published") {
        roster[slug].articles++;
        const wc = rawWords(item);
        roster[slug].words += wc;
        roster[slug].readingMin += Math.max(1, Math.round(wc / 225));
        const t = item.date ? new Date(item.date).getTime() : null;
        if (t != null) {
          if (roster[slug].lastDate == null || t > roster[slug].lastDate) {
            roster[slug].lastDate = t;
            roster[slug].recentArticle = {
              title: data.title || "(untitled)",
              url: item.url,
              date: t,
              section: data.section || ""
            };
          }
        }
        (data.tags || []).forEach(tag => {
          if (tag === "post" || tag === "all") return;
          roster[slug].tagCounts[tag] = (roster[slug].tagCounts[tag] || 0) + 1;
        });
        if (data.section) {
          roster[slug].sectionCounts[data.section] = (roster[slug].sectionCounts[data.section] || 0) + 1;
        }
      } else if (status === "pitched" || status === "drafting" || status === "review") {
        roster[slug].drafts++;
      }
    });
    const NOW = Date.now();
    return Object.values(roster).map(r => {
      const beat = Object.entries(r.tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag]) => tag);
      const topSection = Object.entries(r.sectionCounts)
        .sort((a, b) => b[1] - a[1])[0];
      const isActive = r.lastDate != null && (NOW - r.lastDate) <= 90 * 86400000;
      const avgWords = r.articles ? Math.round(r.words / r.articles) : 0;
      const lastDateIso = r.lastDate ? new Date(r.lastDate).toISOString().slice(0, 10) : null;
      return {
        ...r,
        beat,
        topSection: topSection ? topSection[0] : null,
        isActive,
        avgWords,
        lastDateIso
      };
    });
  });

  // Recent edits to article content — pulled from git log at build time.
  eleventyConfig.addFilter("recentEdits", (limit) => {
    const N = limit || 30;
    try {
      const { execSync } = require("child_process");
      const out = execSync(
        'git log -n ' + N + ' --pretty=format:"%h%x09%an%x09%aI%x09%s" -- src/content/',
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
      );
      return out.split("\n").filter(Boolean).map(line => {
        const [hash, author, iso, ...rest] = line.split("\t");
        return { hash, author, iso, message: rest.join("\t") };
      });
    } catch (e) {
      // git not available (e.g. CF Pages preview without history). Return [].
      return [];
    }
  });

  // Primary source documents library, newest first
  eleventyConfig.addCollection("documents", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/documents/*.md")
      .filter(item => !item.data.draft)
      .sort((a, b) => b.date - a.date);
  });

  // ─── Project Collections ──────────────────────────────────────────────────────

  // Freethought Glossary — alphabetical by title
  eleventyConfig.addCollection("glossary", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/glossary/*.md")
      .filter(item => !item.data.draft)
      .sort((a, b) => a.data.title.localeCompare(b.data.title));
  });

  // Thought Experiment Library — newest first
  eleventyConfig.addCollection("thought-experiments", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/thought-experiments/*.md")
      .filter(item => !item.data.draft)
      .sort((a, b) => b.date - a.date);
  });

  // Freethinker's Bookshelf — alphabetical by category then title
  eleventyConfig.addCollection("bookshelf", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/bookshelf/*.md")
      .filter(item => !item.data.draft)
      .sort((a, b) => {
        const catA = a.data.category || "";
        const catB = b.data.category || "";
        return catA.localeCompare(catB) || a.data.title.localeCompare(b.data.title);
      });
  });

  // Trials of Thought — chronological by year (negative = BCE)
  eleventyConfig.addCollection("trials-of-thought", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/trials/*.md")
      .filter(item => !item.data.draft)
      .sort((a, b) => (a.data.year || 0) - (b.data.year || 0));
  });

  // ─── Shortcodes ──────────────────────────────────────────────────────────────

  // Inline footnote — renders a clickable superscript; JS shows a tooltip
  // Usage in .md: {% fn 1 %}Footnote text here.{% endfn %}
  eleventyConfig.addPairedShortcode("fn", (content, id) => {
    return `<sup class="fn-ref"><button class="fn-btn" type="button" aria-expanded="false" data-fn-id="${id}">${id}</button><span class="fn-content" hidden>${content.trim()}</span></sup>`;
  });

  // Pull quote
  eleventyConfig.addShortcode("pullquote", (quote, attribution = "") => {
    return `<blockquote class="pullquote">
      <p>${quote}</p>
      ${attribution ? `<cite>${attribution}</cite>` : ""}
    </blockquote>`;
  });

  // Section label badge
  eleventyConfig.addShortcode("sectionBadge", (section) => {
    return `<span class="section-badge section-badge--${section.toLowerCase().replace(/\s+/g, "-")}">${section}</span>`;
  });

  // ─── Markdown Config ─────────────────────────────────────────────────────────
  const markdownIt = require("markdown-it");
  const markdownItAnchor = require("markdown-it-anchor");

  const md = markdownIt({
    html: true,
    breaks: false,
    linkify: true,
    typographer: true,
  });

  md.use(markdownItAnchor, {
    permalink: false,
    slugify: s => s.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-'),
  });

  // ─── Link-rot protection ──────────────────────────────────────────────────
  // For every external link in rendered markdown, emit a sibling archive
  // link pointing to web.archive.org/web/*/URL. The `*` wildcard lets the
  // Internet Archive auto-redirect to the latest available snapshot, so
  // readers can recover the source even after link rot. Archives of our
  // own domain, already-archived URLs, and explicit opt-outs are skipped.
  const isSkippedArchive = (url) => {
    if (!url) return true;
    if (!/^https?:\/\//i.test(url)) return true;
    return /(?:^https?:\/\/)?(?:[a-z0-9.-]*\.)?(?:thefreethinkingtimes\.com|web\.archive\.org|archive\.(?:org|today|is|ph))\b/i.test(url);
  };
  const originalLinkOpen = md.renderer.rules.link_open || function (t, i, o, e, s) { return s.renderToken(t, i, o); };
  const originalLinkClose = md.renderer.rules.link_close || function (t, i, o, e, s) { return s.renderToken(t, i, o); };

  md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
    const token = tokens[idx];
    const hrefIdx = token.attrIndex('href');
    env.__archiveStack = env.__archiveStack || [];
    if (hrefIdx >= 0) {
      const href = token.attrs[hrefIdx][1];
      const noArchive = token.attrGet('data-no-archive') !== null;
      const isExternal = /^https?:\/\//i.test(href) && !/(?:^https?:\/\/)?(?:[a-z0-9.-]*\.)?thefreethinkingtimes\.com\b/i.test(href);
      if (isExternal) {
        // Every outbound citation — Umami event so we can see which
        // sources readers actually verify.
        token.attrSet('data-umami-event', 'citation-click');
      }
      if (!noArchive && !isSkippedArchive(href)) {
        token.attrSet('rel', 'noopener');
        env.__archiveStack.push('https://web.archive.org/web/*/' + href);
      } else {
        env.__archiveStack.push(null);
      }
    } else {
      env.__archiveStack.push(null);
    }
    return originalLinkOpen(tokens, idx, options, env, self);
  };

  md.renderer.rules.link_close = function (tokens, idx, options, env, self) {
    const closeTag = originalLinkClose(tokens, idx, options, env, self);
    const stack = env.__archiveStack || [];
    const archiveUrl = stack.pop();
    if (archiveUrl) {
      return closeTag +
        '<a class="archive-link" href="' + archiveUrl + '" rel="noopener nofollow" ' +
        'target="_blank" aria-label="Archived version" title="Archived version" ' +
        'data-umami-event="archive-click">' +
        '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>' +
        '</a>';
    }
    return closeTag;
  };

  eleventyConfig.setLibrary("md", md);

  // Render a Markdown string to HTML (used for author bios etc.)
  eleventyConfig.addFilter("md", (content) => {
    if (!content) return '';
    return md.render(String(content));
  });

  // ─── Library Filters ─────────────────────────────────────────────────────────

  // Reading time from a raw word count integer — returns "N min" or "Nh Nm"
  eleventyConfig.addFilter("readingTimeFromWords", (wordCount) => {
    const mins = Math.max(1, Math.ceil(wordCount / 200));
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  });

  // Raw word count as integer (distinct from existing `wordCount` which returns a formatted string)
  eleventyConfig.addFilter("wordCountRaw", (content) => {
    if (!content) return 0;
    const text = content.replace(/(<([^>]+)>)/gi, "");
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  });

  // Return chapters for a specific work from the libraryByWork collection
  eleventyConfig.addFilter("chaptersForWork", (byWorkCollection, workSlug) => {
    return (byWorkCollection && byWorkCollection[workSlug]) || [];
  });

  // Format a year integer, handling BCE (negative) values
  eleventyConfig.addFilter("formatYear", (year) => {
    if (!year && year !== 0) return "";
    const n = Number(year);
    return n < 0 ? `${Math.abs(n)} BCE` : String(n);
  });

  // ─── Library Collections ─────────────────────────────────────────────────────

  // All library chapters (every .md under works/ except index files), sorted by chapterNumber
  eleventyConfig.addCollection("libraryChapters", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/library/works/**/*.md")
      .filter(item => !item.inputPath.endsWith('/index.md'))
      .sort((a, b) => (a.data.chapterNumber || 0) - (b.data.chapterNumber || 0));
  });

  // Chapters grouped by workSlug — { [workSlug]: [chapter, ...] }
  // Also includes lecture landing pages (index.md with parentWorkSlug) in their parent's list
  eleventyConfig.addCollection("libraryByWork", (collectionApi) => {
    const allMd = collectionApi.getFilteredByGlob("src/library/works/**/*.md");
    const chapters = allMd
      .filter(item => !item.inputPath.endsWith('/index.md'))
      .sort((a, b) => (a.data.chapterNumber || 0) - (b.data.chapterNumber || 0));
    const lecturePages = allMd
      .filter(item => item.inputPath.endsWith('/index.md') && item.data.parentWorkSlug)
      .sort((a, b) => (a.data.chapterNumber || 0) - (b.data.chapterNumber || 0));

    const byWork = {};
    chapters.forEach(ch => {
      const slug = ch.data.workSlug;
      if (!slug) return;
      if (!byWork[slug]) byWork[slug] = [];
      byWork[slug].push(ch);
    });
    // Add lecture landing pages to their parent work's chapter list
    lecturePages.forEach(lp => {
      const parentSlug = lp.data.parentWorkSlug;
      if (!byWork[parentSlug]) byWork[parentSlug] = [];
      byWork[parentSlug].push(lp);
      byWork[parentSlug].sort((a, b) => (a.data.chapterNumber || 0) - (b.data.chapterNumber || 0));
    });
    return byWork;
  });

  // Work landing pages (index.md files directly inside each work directory)
  eleventyConfig.addCollection("libraryWorks", (collectionApi) => {
    const worksData = JSON.parse(fs.readFileSync("./src/_data/library/works.json", "utf8"));
    const childSlugs = worksData.filter(w => w.parentWork).map(w => w.slug);
    return collectionApi
      .getFilteredByGlob("src/library/works/*/index.md")
      .filter(item => !childSlugs.includes(item.data.workSlug))
      .sort((a, b) => (a.data.title || "").localeCompare(b.data.title || ""));
  });

  // Featured chapters/works
  eleventyConfig.addCollection("libraryFeatured", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/library/works/**/*.md")
      .filter(item => item.data.featured && !item.inputPath.endsWith('/index.md'))
      .sort((a, b) => (a.data.chapterNumber || 0) - (b.data.chapterNumber || 0));
  });

  // ─── Layout Aliases ──────────────────────────────────────────────────────────
  eleventyConfig.addLayoutAlias("base", "layouts/base.njk");
  eleventyConfig.addLayoutAlias("article", "layouts/article.njk");
  eleventyConfig.addLayoutAlias("section", "layouts/section.njk");
  eleventyConfig.addLayoutAlias("home", "layouts/home.njk");
  eleventyConfig.addLayoutAlias("glossary-term", "layouts/glossary-term.njk");
  eleventyConfig.addLayoutAlias("book-entry", "layouts/book-entry.njk");
  eleventyConfig.addLayoutAlias("library-home",    "layouts/library-home.njk");
  eleventyConfig.addLayoutAlias("library-work",    "layouts/library-work.njk");
  eleventyConfig.addLayoutAlias("library-chapter", "layouts/library-chapter.njk");
  eleventyConfig.addLayoutAlias("library-short",   "layouts/library-short.njk");

  // ─── Global Data
  eleventyConfig.addGlobalData("currentYear", () => new Date().getFullYear());
  eleventyConfig.addGlobalData("buildTime", () => Date.now());
  eleventyConfig.addGlobalData("editorialSnapshot", () => new Date().toISOString());

  // ─── Pagefind search index (runs after build) ──────────────────────────────
  eleventyConfig.on("eleventy.after", () => {
    try {
      execSync("npx pagefind --site _site --output-path _site/pagefind", {
        stdio: "inherit",
      });
    } catch (e) {
      console.warn("Pagefind indexing failed:", e.message);
    }
  });

  // ─── OG image rasterization: convert the SVGs in /og/ to PNGs ─────────────
  // Social platforms (Twitter, Facebook, LinkedIn, Slack, Discord) don't
  // render SVG in OG previews. We keep the SVGs (nice for direct viewing)
  // and also write a PNG alongside each one for sharing.
  eleventyConfig.on("eleventy.after", async () => {
    const ogDir = "./_site/og";
    if (!fs.existsSync(ogDir)) return;
    let Resvg;
    try { ({ Resvg } = require("@resvg/resvg-js")); } catch (e) {
      console.warn("@resvg/resvg-js not installed; skipping OG PNG generation.");
      return;
    }
    const files = fs.readdirSync(ogDir).filter(f => f.endsWith(".svg"));
    if (!files.length) return;
    let written = 0;
    for (const file of files) {
      const svgPath = path.join(ogDir, file);
      const pngPath = path.join(ogDir, file.replace(/\.svg$/, ".png"));
      try {
        const svg = fs.readFileSync(svgPath, "utf8");
        const resvg = new Resvg(svg, {
          fitTo: { mode: "width", value: 1200 },
          font: { loadSystemFonts: true }
        });
        const png = resvg.render().asPng();
        fs.writeFileSync(pngPath, png);
        written++;
      } catch (e) {
        console.warn("OG PNG failed for", file, "—", e.message);
      }
    }
    if (written) console.log(`[og] Rasterized ${written} OG image${written === 1 ? '' : 's'} to PNG.`);
  });

  // ─── Build Config ────────────────────────────────────────────────────────────
  return {
    templateFormats: ["md", "njk", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
  };
};

// This line intentionally left blank — see eleventyConfig.addGlobalData below
