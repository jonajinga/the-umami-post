/* Recipe serving scaler + unit toggle.
 *
 * - Preset multipliers (0.5x / 1x / 2x), plus a free-text custom
 *   multiplier the user can type into.
 * - US <-> metric toggle that converts cups / tbsp / tsp / fl oz /
 *   oz / lb / stick / pinch <-> ml / g / kg.
 * - Smart formatting: integers stay integers, halves / thirds /
 *   quarters render as unicode-ish fractions, grams round to the
 *   nearest 5 g, cups to the nearest 1/8.
 *
 * Markup contract (set by ingredient-list.njk):
 *
 *   <div data-recipe-scaler data-base-servings="4">
 *     buttons with data-scale="0.5" | "1" | "2"
 *     button with data-scale="custom" + input.serving-scaler__custom
 *     button.unit-toggle with data-target-unit="us" | "metric"
 *   </div>
 *   <ul data-ingredient-list data-recipe-slug="...">
 *     <li class="ingredient">
 *       <span class="ingredient__amount"
 *             data-base-amount="1 1/2"
 *             data-base-unit="cups">1 1/2</span>
 *       <span class="ingredient__unit">cups</span>
 *       <span class="ingredient__name">flour</span>
 *     </li>
 *   </ul>
 *
 * Falls back gracefully: with JS off, ingredients render at their
 * base amount and unit. */

(function () {
  'use strict';

  // -- amount parsing / formatting -----------------------------------

  var UNICODE_FRAC = {
    '¼': 0.25, '½': 0.5, '¾': 0.75,
    '⅓': 1/3,  '⅔': 2/3,
    '⅛': 1/8,  '⅜': 3/8, '⅝': 5/8, '⅞': 7/8,
    '⅕': 0.2,  '⅖': 0.4, '⅗': 0.6, '⅘': 0.8,
    '⅐': 1/7,  '⅑': 1/9,
    '⅙': 1/6,  '⅚': 5/6
  };

  function parseAmount(str) {
    if (str == null) return null;
    str = String(str).trim();
    if (!str) return null;

    // Unicode fraction by itself or with leading whole
    var first = str.charAt(0);
    if (UNICODE_FRAC[first] != null && str.length === 1) return UNICODE_FRAC[first];
    var m = str.match(/^(\d+)\s*([¼-¾⅐-⅞])$/);
    if (m) return parseInt(m[1], 10) + UNICODE_FRAC[m[2]];

    // Mixed "1 1/2"
    m = str.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (m) return parseInt(m[1], 10) + parseInt(m[2], 10) / parseInt(m[3], 10);

    // Simple fraction "1/2"
    m = str.match(/^(\d+)\/(\d+)$/);
    if (m) return parseInt(m[1], 10) / parseInt(m[2], 10);

    // Range "1-2" -- use midpoint
    m = str.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/);
    if (m) return (parseFloat(m[1]) + parseFloat(m[2])) / 2;

    var n = parseFloat(str);
    return isFinite(n) ? n : null;
  }

  function formatFraction(n) {
    if (n === Math.floor(n)) return String(n);
    var fracs = [
      [1/8, '1/8'], [1/4, '1/4'], [1/3, '1/3'], [3/8, '3/8'],
      [1/2, '1/2'], [5/8, '5/8'], [2/3, '2/3'], [3/4, '3/4'], [7/8, '7/8']
    ];
    var whole = Math.floor(n);
    var rem = n - whole;
    for (var i = 0; i < fracs.length; i++) {
      if (Math.abs(rem - fracs[i][0]) < 0.03) {
        return whole > 0 ? whole + ' ' + fracs[i][1] : fracs[i][1];
      }
    }
    // No clean fraction -- fall back to decimal trimmed to 1-2 places
    return n < 10 ? n.toFixed(1).replace(/\.0$/, '') : String(Math.round(n));
  }

  function formatMetric(n, unit) {
    if (!isFinite(n)) return '';
    if (unit === 'g' || unit === 'ml') {
      // Round to nearest 5 for legibility
      var rounded = Math.round(n / 5) * 5;
      return String(rounded);
    }
    if (unit === 'kg' || unit === 'L') return n.toFixed(2).replace(/\.?0+$/, '');
    return String(Math.round(n));
  }

  // Promote ml >= 1000 to L, g >= 1000 to kg for display
  function promoteUnit(amount, unit) {
    if (unit === 'ml' && amount >= 1000) return { amount: amount / 1000, unit: 'L' };
    if (unit === 'g'  && amount >= 1000) return { amount: amount / 1000, unit: 'kg' };
    return { amount: amount, unit: unit };
  }

  // -- unit conversion ----------------------------------------------

  // Convert from a base US measurement to metric.
  // Returns { amount: Number, unit: String } or null if no conversion.
  var US_TO_METRIC = {
    'cup':       { factor: 240,  unit: 'ml' },
    'cups':      { factor: 240,  unit: 'ml' },
    'tablespoon':{ factor: 15,   unit: 'ml' },
    'tablespoons':{factor: 15,   unit: 'ml' },
    'tbsp':      { factor: 15,   unit: 'ml' },
    'tbs':       { factor: 15,   unit: 'ml' },
    'teaspoon':  { factor: 5,    unit: 'ml' },
    'teaspoons': { factor: 5,    unit: 'ml' },
    'tsp':       { factor: 5,    unit: 'ml' },
    'fl oz':     { factor: 30,   unit: 'ml' },
    'oz':        { factor: 28,   unit: 'g' },   // weight; we assume oz means weight unless explicitly "fl oz"
    'ounce':     { factor: 28,   unit: 'g' },
    'ounces':    { factor: 28,   unit: 'g' },
    'lb':        { factor: 454,  unit: 'g' },
    'lbs':       { factor: 454,  unit: 'g' },
    'pound':     { factor: 454,  unit: 'g' },
    'pounds':    { factor: 454,  unit: 'g' },
    'stick':     { factor: 113,  unit: 'g' },
    'sticks':    { factor: 113,  unit: 'g' },
    'quart':     { factor: 950,  unit: 'ml' },
    'quarts':    { factor: 950,  unit: 'ml' },
    'pint':      { factor: 475,  unit: 'ml' },
    'pints':     { factor: 475,  unit: 'ml' },
    'gallon':    { factor: 3800, unit: 'ml' },
    'gallons':   { factor: 3800, unit: 'ml' }
  };

  function convertToMetric(amount, unit) {
    if (amount == null) return null;
    var key = (unit || '').toLowerCase().trim();
    if (!US_TO_METRIC[key]) return null;
    var entry = US_TO_METRIC[key];
    var v = amount * entry.factor;
    // Promote ml > 1000 to L, g > 1000 to kg (formatMetric handles)
    return { amount: v, unit: entry.unit };
  }

  // -- DOM rendering --------------------------------------------------

  function renderAmounts(root, scale, system) {
    var els = root.querySelectorAll('[data-base-amount]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var baseAmount = parseAmount(el.getAttribute('data-base-amount'));
      var baseUnit = el.getAttribute('data-base-unit') || '';
      if (baseAmount == null) continue;

      var scaled = baseAmount * scale;
      var newAmount = scaled;
      var newUnit = baseUnit;

      if (system === 'metric') {
        var m = convertToMetric(scaled, baseUnit);
        if (m) {
          var promoted = promoteUnit(m.amount, m.unit);
          newAmount = promoted.amount; newUnit = promoted.unit;
        }
      }

      // Render amount
      if (system === 'metric' && (newUnit === 'g' || newUnit === 'ml' || newUnit === 'kg' || newUnit === 'L')) {
        el.textContent = formatMetric(newAmount, newUnit);
      } else {
        el.textContent = formatFraction(newAmount);
      }

      // Update the sibling .ingredient__unit if present (sibling, since unit is rendered separately)
      var unitEl = el.parentElement && el.parentElement.querySelector('.ingredient__unit');
      if (unitEl) unitEl.textContent = newUnit;
    }
  }

  // -- wiring --------------------------------------------------------

  function init() {
    document.querySelectorAll('[data-recipe-scaler]').forEach(function (scaler) {
      if (scaler.dataset.scalerBound === '1') return;
      scaler.dataset.scalerBound = '1';

      var recipe = scaler.closest('.recipe') || document;
      var state = {
        scale: parseFloat(scaler.getAttribute('data-current-scale')) || 1,
        system: scaler.getAttribute('data-unit-system') || 'us'
      };

      function refresh() {
        renderAmounts(recipe, state.scale, state.system);
        // Persist last-used unit preference
        try { localStorage.setItem((window.__PREFIX || 'umami') + '-unit-system', state.system); } catch (e) {}
      }

      // Preset scale buttons
      scaler.querySelectorAll('[data-scale]').forEach(function (btn) {
        if (btn.getAttribute('data-scale') === 'custom') return;
        btn.addEventListener('click', function () {
          var s = parseFloat(btn.getAttribute('data-scale'));
          if (!isFinite(s) || s <= 0) return;
          state.scale = s;
          scaler.querySelectorAll('[data-scale]').forEach(function (b) {
            b.classList.toggle('serving-scaler__btn--active', b === btn);
          });
          var customInput = scaler.querySelector('.serving-scaler__custom');
          if (customInput) customInput.value = '';
          refresh();
        });
      });

      // Custom scale input
      var customInput = scaler.querySelector('.serving-scaler__custom');
      if (customInput) {
        customInput.addEventListener('input', function () {
          var raw = customInput.value.replace(/[x×\s]/gi, '');
          var n = parseFloat(raw);
          if (!isFinite(n) || n <= 0) return;
          state.scale = n;
          scaler.querySelectorAll('[data-scale]').forEach(function (b) {
            b.classList.remove('serving-scaler__btn--active');
          });
          refresh();
        });
      }

      // Unit toggle
      scaler.querySelectorAll('[data-target-unit]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          state.system = btn.getAttribute('data-target-unit');
          scaler.querySelectorAll('[data-target-unit]').forEach(function (b) {
            b.classList.toggle('unit-toggle__btn--active',
                               b.getAttribute('data-target-unit') === state.system);
          });
          refresh();
        });
      });

      // Initial unit preference from localStorage
      try {
        var saved = localStorage.getItem((window.__PREFIX || 'umami') + '-unit-system');
        if (saved && (saved === 'us' || saved === 'metric')) {
          state.system = saved;
          scaler.querySelectorAll('[data-target-unit]').forEach(function (b) {
            b.classList.toggle('unit-toggle__btn--active',
                               b.getAttribute('data-target-unit') === state.system);
          });
        }
      } catch (e) {}

      refresh();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  document.addEventListener('spa:contentswap', init);
})();
