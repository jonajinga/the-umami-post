/**
 * Per-article engagement stats — keyed by article URL.
 *
 * Source of truth: `src/_data/articleStats.json` (a flat JSON file you can
 * regenerate from Umami's API on a schedule). Shape:
 *
 *   {
 *     "/news/some-article/": { "views": 1234, "shares": 12, "likes": 5 }
 *   }
 *
 * If the JSON file does not exist (clean clone, fresh build, etc.) we fall
 * back to an empty object — the article template hides the stats line when
 * a URL has no entry, so missing data is never visible to readers.
 *
 * To populate: run `npm run sync-stats` (a script that calls
 * https://api.umami.is/v1/websites/<id>/metrics with your API key and writes
 * the JSON). Schedule via cron / GitHub Action; this build step never
 * touches the network.
 */
const fs = require("fs");
const path = require("path");

module.exports = function () {
  try {
    const raw = fs.readFileSync(path.join(__dirname, "articleStats.json"), "utf8");
    const data = JSON.parse(raw);
    return data && typeof data === "object" ? data : {};
  } catch (e) {
    return {};
  }
};
