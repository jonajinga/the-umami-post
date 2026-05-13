/**
 * Smart Header — swaps masthead for article/library reading header on scroll.
 * The masthead is always compact (no size change on scroll).
 */
(function () {
  'use strict';

  var masthead = document.querySelector('.masthead');
  if (!masthead) return;

  var readingHeader = document.querySelector('.article-reading-header') || document.querySelector('.library-reading-header');
  if (!readingHeader) return;

  var THRESHOLD = 200;
  var ticking = false;
  var swapped = false;

  function update() {
    var y = window.scrollY;
    if (!swapped && y > THRESHOLD) {
      swapped = true;
      masthead.classList.add('is-replaced');
      readingHeader.classList.add('is-visible');
    } else if (swapped && y <= THRESHOLD) {
      swapped = false;
      masthead.classList.remove('is-replaced');
      readingHeader.classList.remove('is-visible');
    }
    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (ticking) return;
    requestAnimationFrame(update);
    ticking = true;
  }, { passive: true });

  if (window.scrollY > THRESHOLD) {
    swapped = true;
    masthead.classList.add('is-replaced');
    readingHeader.classList.add('is-visible');
  }
})();
