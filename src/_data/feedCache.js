// Fetch RSS feeds at build time with disk caching via @11ty/eleventy-fetch
const EleventyFetch = require("@11ty/eleventy-fetch");
const Parser = require("rss-parser");
const parser = new Parser({ timeout: 10000 });
const feeds = require("./feeds.js")();

module.exports = async function () {
  const results = {};

  await Promise.all(feeds.map(async (feed) => {
    try {
      // Fetch with 1-hour cache — avoids hitting feeds on every build
      const xml = await EleventyFetch(feed.url, {
        duration: "1h",
        type: "text",
        fetchOptions: {
          headers: { "User-Agent": "TheFreethinkingTimes/1.0 (RSS Reader)" }
        }
      });

      const data = await parser.parseString(xml);
      results[feed.url] = (data.items || []).slice(0, 20).map(item => ({
        title: item.title || "",
        link: item.link || "",
        description: (item.contentSnippet || item.content || "").slice(0, 200),
        date: item.isoDate || item.pubDate || "",
        feedName: feed.name
      }));
    } catch (e) {
      console.warn("Feed failed:", feed.name, "-", e.message);
      results[feed.url] = [];
    }
  }));

  return results;
};
