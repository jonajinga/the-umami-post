/**
 * The Freethinking Times — Nav Drawer
 * Slide-out navigation drawer, always available.
 */

(function () {
  'use strict';

  const toggle   = document.getElementById('nav-drawer-toggle');
  const drawer   = document.getElementById('nav-drawer');
  const closeBtn = document.getElementById('nav-drawer-close');

  if (!toggle || !drawer) return;

  function openDrawer() {
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    toggle.setAttribute('aria-expanded', 'true');
    if (closeBtn) closeBtn.focus();
  }

  function closeDrawer() {
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.focus();
  }

  toggle.addEventListener('click', openDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
      closeDrawer();
    }
  });

  document.addEventListener('click', function (e) {
    if (!drawer.classList.contains('is-open')) return;
    if (drawer.contains(e.target) || toggle.contains(e.target)) return;
    closeDrawer();
  });

})();

/* ── Nav dropdowns — all items ───────────────────────────────── */
(function () {
  'use strict';

  var nav = document.querySelector('.site-nav');
  if (!nav) return;

  var keys = ['news', 'opinion', 'analysis', 'arts-culture', 'science-tech', 'history', 'letters', 'reviews', 'library', 'projects', 'games', 'more'];

  function positionDropdown(trigger, dropdown) {
    // Page-width dropdowns: every panel spans the full nav width so
    // they all read as one consistent strip instead of variable-width
    // popovers floating under each trigger.
    dropdown.style.left  = '0';
    dropdown.style.right = '0';
    dropdown.style.width = '100%';
  }

  var pairs = keys.concat(['quotes']).map(function (key) {
    var trigger  = document.getElementById('nav-' + key);
    var dropdown = document.getElementById('dropdown-' + key);
    return (trigger && dropdown) ? { trigger: trigger, dropdown: dropdown } : null;
  }).filter(Boolean);

  function closeAll() {
    pairs.forEach(function (p) {
      p.dropdown.classList.remove('is-open');
      p.trigger.setAttribute('aria-expanded', 'false');
    });
  }

  pairs.forEach(function (p) {
    positionDropdown(p.trigger, p.dropdown);

    var hideTimer = null;

    function show() {
      clearTimeout(hideTimer);
      hideTimer = null;
      // Close any other open dropdown immediately
      pairs.forEach(function (other) {
        if (other !== p) {
          other.dropdown.classList.remove('is-open');
          other.trigger.setAttribute('aria-expanded', 'false');
        }
      });
      p.dropdown.classList.add('is-open');
      p.trigger.setAttribute('aria-expanded', 'true');
      positionDropdown(p.trigger, p.dropdown);
    }

    function scheduleHide() {
      hideTimer = setTimeout(function () {
        p.dropdown.classList.remove('is-open');
        p.trigger.setAttribute('aria-expanded', 'false');
      }, 80);
    }

    p.trigger.addEventListener('mouseenter', show);
    p.trigger.addEventListener('mouseleave', scheduleHide);
    p.dropdown.addEventListener('mouseenter', function () { clearTimeout(hideTimer); });
    p.dropdown.addEventListener('mouseleave', scheduleHide);

    p.trigger.addEventListener('focus', function () {
      p.trigger.setAttribute('aria-expanded', 'true');
    });
    p.trigger.addEventListener('blur', function () {
      setTimeout(function () {
        if (!p.dropdown.contains(document.activeElement)) {
          p.trigger.setAttribute('aria-expanded', 'false');
        }
      }, 100);
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    pairs.forEach(function (p) {
      if (p.trigger === document.activeElement || p.dropdown.contains(document.activeElement)) {
        p.trigger.focus();
        p.trigger.setAttribute('aria-expanded', 'false');
      }
    });
  });

  window.addEventListener('resize', function () {
    pairs.forEach(function (p) { positionDropdown(p.trigger, p.dropdown); });
  }, { passive: true });

}());
