/* Serving scaler -- multiplies every [data-base-amount] inside a recipe
   when the user clicks 0.5x / 1x / 2x. Supports unicode fractions
   ("1/2", "1 1/2", "1/4"), decimals, and integers. Re-renders as a
   nice fraction when possible.

   No-JS fallback: the scaler buttons are hidden via CSS (.no-js
   .recipe-scaler { display: none }); ingredients render at base. */
(function () {
  'use strict';

  function parseAmount(str) {
    if (str == null) return null;
    str = String(str).trim();
    // Mixed number "1 1/2"
    var m = str.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (m) return parseInt(m[1], 10) + parseInt(m[2], 10) / parseInt(m[3], 10);
    // Simple fraction "1/2"
    m = str.match(/^(\d+)\/(\d+)$/);
    if (m) return parseInt(m[1], 10) / parseInt(m[2], 10);
    // Decimal or integer
    var n = parseFloat(str);
    return isFinite(n) ? n : null;
  }

  function formatAmount(n) {
    if (n == null || !isFinite(n)) return '';
    if (n === Math.floor(n)) return String(n);
    // Try common fractions
    var fracs = [
      [1/8, '1/8'], [1/4, '1/4'], [1/3, '1/3'], [3/8, '3/8'],
      [1/2, '1/2'], [5/8, '5/8'], [2/3, '2/3'], [3/4, '3/4'], [7/8, '7/8']
    ];
    var whole = Math.floor(n);
    var rem = n - whole;
    for (var i = 0; i < fracs.length; i++) {
      if (Math.abs(rem - fracs[i][0]) < 0.02) {
        return whole > 0 ? whole + ' ' + fracs[i][1] : fracs[i][1];
      }
    }
    return n.toFixed(2).replace(/\.?0+$/, '');
  }

  function applyScale(root, scale) {
    var amounts = root.querySelectorAll('[data-base-amount]');
    for (var i = 0; i < amounts.length; i++) {
      var base = parseAmount(amounts[i].getAttribute('data-base-amount'));
      if (base == null) continue;
      amounts[i].textContent = formatAmount(base * scale);
    }
  }

  function init() {
    document.querySelectorAll('[data-recipe-scaler]').forEach(function (scaler) {
      if (scaler.dataset.scalerBound === '1') return;
      scaler.dataset.scalerBound = '1';
      var recipe = scaler.closest('.recipe') || document;
      scaler.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-scale]');
        if (!btn) return;
        var scale = parseFloat(btn.getAttribute('data-scale'));
        if (!isFinite(scale)) return;
        scaler.querySelectorAll('[data-scale]').forEach(function (b) {
          b.classList.remove('serving-scaler__btn--active');
        });
        btn.classList.add('serving-scaler__btn--active');
        applyScale(recipe, scale);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  document.addEventListener('spa:contentswap', init);
})();
