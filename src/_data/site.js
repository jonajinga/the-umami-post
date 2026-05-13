// Site-wide configuration.
//
// Editor-facing settings (title, description, tipping URLs, etc.) live in
// src/_data/site-settings.json and are managed via Pages CMS.
//
// Secrets and environment-specific values (URL, email, API keys) are read
// from environment variables -- see `.env.example` for the full list. Local
// development loads them from `.env` via dotenv; in CI / Cloudflare Pages
// set them in the dashboard. Env vars always override site-settings.json.

try { require('dotenv').config(); } catch (_) { /* dotenv is optional in prod */ }

const env = process.env;
const s = require('./site-settings.json');

module.exports = {
  title: s.title,
  description: s.description,
  tagline: s.tagline,
  url: env.SITE_URL || "https://theumamipost.com",
  author: s.author,
  email: env.SITE_EMAIL || s.email,
  language: "en",
  founded: s.founded,
  gtranslate: s.gtranslate,
  storagePrefix: "umami",
  repo: {
    owner: "jonajinga",
    name: "the-umami-post",
    branch: "main"
  },
  // Hand-drawn family to match the rough.js sketched frames + chips.
  //   Caveat — masthead + display titles (warm script)
  //   Lora — body prose (humanist serif, readable at length)
  //   Patrick Hand — UI labels, captions, nav (legible handwritten)
  fontsUrl: "https://fonts.bunny.net/css?family=caveat:wght@500;600;700&family=lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=patrick-hand:wght@400&display=swap",
  forms: {
    provider: "web3forms",
    accessKey: env.WEB3FORMS_ACCESS_KEY || ""
  },
  analytics: {
    provider: "umami",
    websiteId: env.UMAMI_WEBSITE_ID || "",
    scriptUrl: env.UMAMI_SRC || "https://cloud.umami.is/script.js",
    dashboardUrl: env.UMAMI_DASHBOARD_URL || ""
  },
  newsletter: {
    provider: s.newsletter.provider,
    username: env.BUTTONDOWN_USERNAME || s.newsletter.username || ""
  },
  indieweb: {
    me: [
      "https://github.com/jonajinga"
    ]
  },
  webmention: {
    endpoint: env.WEBMENTION_ENDPOINT || "https://webmention.io/theumamipost.com/webmention",
    pingback: env.WEBMENTION_PINGBACK || "https://webmention.io/theumamipost.com/xmlrpc",
    token:    env.WEBMENTION_TOKEN    || "",
    domain:   "theumamipost.com",
    blocklist: []
  },
  comments: {
    provider: "cusdis",
    appId: env.CUSDIS_APP_ID || "",
    host: "https://cusdis.com"
  },
  tipping: {
    kofi:    env.KOFI_URL    || s.tipping.kofi    || "",
    bmac:    env.BMAC_URL    || s.tipping.bmac    || "",
    patreon: env.PATREON_URL || s.tipping.patreon || ""
  },
  social: s.social,
  googleNews: s.googleNews || {},
  announcement: s.announcement || {},
  live: s.live || {},
  subscribe: s.subscribe,
  contactSubjects: s.contactSubjects,
  sections: {
    "recipes": {
      label: "Recipes",
      color: "#D4793A",
      description: "Tested recipes from our kitchen and yours."
    },
    "techniques": {
      label: "Techniques",
      color: "#6B7340",
      description: "How to do the things that make cooking work."
    },
    "reviews": {
      label: "Reviews",
      color: "#8B6914",
      description: "Cookbooks, restaurants, equipment, and pantry staples assessed honestly."
    },
    "news": {
      label: "News",
      color: "#B6431E",
      description: "What is happening in food, kitchens, and the supply chain."
    },
    "opinion": {
      label: "Opinion",
      color: "#7A3954",
      description: "Signed essays and editorial positions on how we eat."
    },
    "deep-dives": {
      label: "Deep Dives",
      color: "#5A3B2A",
      description: "Long-form reporting on the systems behind our food."
    },
    "food-culture": {
      label: "Food & Culture",
      color: "#5E3A4E",
      description: "Tradition, identity, diaspora, holidays, and table."
    },
    "food-science": {
      label: "Food Science",
      color: "#5C7752",
      description: "The chemistry, biology, and physics of cooking."
    },
    "food-history": {
      label: "Food History",
      color: "#A57B1A",
      description: "Where dishes, ingredients, and ideas come from."
    },
    "cooks-letters": {
      label: "Cook's Letters",
      color: "#4B5862",
      description: "Reader responses, variations, and corrections."
    },
    "bookshelf": {
      label: "Cookbook Shelf",
      color: "#7A5232",
      description: "Cookbooks we live with."
    },
    "glossary": {
      label: "Cooking Glossary",
      color: "#3D5A47",
      description: "The vocabulary of the kitchen."
    }
  }
};
