// Subsection lists per section -- keys MUST match the sectionSlug used in each
// content/<section>/index.njk front-matter, because section.njk looks these
// up by sectionSlug. Values are the visible labels; on-article front-matter
// uses the same label and the runtime slugifies for ?s= URLs and filtering.

module.exports = {
  "recipes":       ["Breakfast", "Lunch", "Dinner", "Sides", "Sauces", "Baking", "Drinks", "Dessert", "Snacks", "Preserves"],
  "techniques":    ["Knife skills", "Heat", "Doughs & batters", "Stocks & sauces", "Fermentation", "Preservation", "Plating"],
  "reviews":       ["Cookbooks", "Restaurants", "Equipment", "Pantry"],
  "news":          ["Industry", "Policy", "Labor", "Supply chain", "Climate & food", "Local"],
  "opinion":       ["Editorials", "Essays", "Cook's letters", "Guest voices"],
  "deep-dives":    ["Investigations", "Origins", "Profiles", "Data"],
  "food-culture":  ["Tradition", "Identity", "Diaspora", "Holidays", "Travel"],
  "food-science":  ["Chemistry", "Nutrition", "Fermentation", "Food safety", "Sensory"],
  "food-history":  ["Ancient", "Medieval", "Modern", "American", "Global", "Ideas"],
  "cooks-letters": ["On recipes", "On techniques", "On reviews", "On policy", "Corrections"]
};
