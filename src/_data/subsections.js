// Subsection lists per section — keys MUST match the sectionSlug used in each
// content/<section>/index.njk front-matter, because section.njk looks these
// up by sectionSlug. Values are the visible labels; on-article front-matter
// uses the same label and the runtime slugifies for ?s= URLs and filtering.

module.exports = {
  "news":               ["U.S.", "World", "Politics", "Local", "Climate", "Education", "Health"],
  "opinion":            ["Editorials", "Columns", "Letters to the Editor", "Guest Essays"],
  "analysis":           ["Data", "Explainers", "Context", "Deep Dives"],
  "arts-culture":       ["Books", "Film", "Music", "Television", "Visual Arts", "Theater"],
  "science-technology": ["Science", "Technology", "Space", "Medicine", "Environment", "Climate"],
  "history":            ["Ancient", "Medieval", "Modern", "U.S. History", "World History", "Ideas"],
  "letters":            ["On the News", "On Opinion", "On Analysis", "On Culture", "On Science", "On History", "Expert Voices", "International", "Corrections Requested"],
  "reviews":            ["Books", "Film", "Music", "Television", "Theater", "Games", "Podcasts", "Documentaries"]
};
