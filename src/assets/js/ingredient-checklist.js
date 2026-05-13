/* Ingredient checklist -- persists checked items in localStorage
   keyed by recipe slug. Click delegation on the parent ul. */
(function () {
  'use strict';

  function storageKey(slug) {
    var prefix = window.__PREFIX || 'umami';
    return prefix + '-checklist-' + slug;
  }

  function load(slug) {
    try { return JSON.parse(localStorage.getItem(storageKey(slug)) || '[]'); }
    catch (e) { return []; }
  }

  function save(slug, list) {
    try { localStorage.setItem(storageKey(slug), JSON.stringify(list)); }
    catch (e) {}
  }

  function bind(root) {
    if (root.dataset.checklistBound === '1') return;
    root.dataset.checklistBound = '1';
    var slug = root.getAttribute('data-recipe-slug') || 'recipe';
    var items = Array.prototype.slice.call(root.querySelectorAll('.ingredient'));
    var saved = load(slug);

    items.forEach(function (li, idx) {
      var cb = li.querySelector('.ingredient__check');
      if (!cb) return;
      if (saved.indexOf(idx) !== -1) {
        cb.checked = true;
        li.classList.add('ingredient--checked');
      }
      cb.addEventListener('change', function () {
        var current = load(slug);
        var i = current.indexOf(idx);
        if (cb.checked) {
          li.classList.add('ingredient--checked');
          if (i === -1) current.push(idx);
        } else {
          li.classList.remove('ingredient--checked');
          if (i !== -1) current.splice(i, 1);
        }
        save(slug, current);
      });
    });
  }

  function init() {
    document.querySelectorAll('[data-ingredient-list]').forEach(bind);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  document.addEventListener('spa:contentswap', init);
})();
