/* rough-decorations.js -- draws hand-drawn SVG decorations into any
 * element with a [data-rough] attribute. Loads rough.js as an ESM
 * module from /assets/js/vendor/rough.esm.js (self-hosted).
 *
 * Markup contract:
 *
 *   <div data-rough="divider"
 *        data-rough-color="accent"></div>
 *   <span data-rough="stars" data-rough-rating="4"></span>
 *   <span data-rough="difficulty" data-rough-level="3"></span>
 *   <div data-rough="circle" data-rough-text="1"></div>
 *   <span data-rough="chip">Vegan</span>
 *   <figure data-rough="frame"><img ...></figure>
 *
 * Color hint: data-rough-color="accent" | "olive" | "ink" | "reviews".
 * Reads the matching CSS custom property at draw time, so dark mode
 * works for free.
 *
 * Decorations re-render on theme change and on spa:contentswap so
 * SPA-nav doesn't leave stale strokes. */

(function () {
  'use strict';

  var SCRIPT_PATH = '/assets/js/vendor/rough.esm.js';
  var roughPromise = null;
  function loadRough() {
    if (roughPromise) return roughPromise;
    roughPromise = import(SCRIPT_PATH).then(function (mod) { return mod.default || mod; });
    return roughPromise;
  }

  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function colorFor(hint) {
    switch ((hint || '').toLowerCase()) {
      case 'accent':    return cssVar('--color-accent', '#D4793A');
      case 'olive':     return cssVar('--color-link', '#6B7340');
      case 'ink':       return cssVar('--color-ink', '#2B1F18');
      case 'reviews':   return cssVar('--color-reviews', '#8B6914');
      case 'paprika':   return cssVar('--color-news', '#B6431E');
      case 'plum':      return cssVar('--color-opinion', '#7A3954');
      default:          return cssVar('--color-ink-muted', '#4A382C');
    }
  }

  function svg(w, h) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('width', w);
    s.setAttribute('height', h);
    s.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    s.setAttribute('aria-hidden', 'true');
    s.style.display = 'block';
    return s;
  }

  // -- Decoration drawers --------------------------------------------

  function drawDivider(el, rough) {
    el.innerHTML = '';
    var w = el.clientWidth || 600;
    var h = 24;
    var s = svg(w, h);
    el.appendChild(s);
    var rc = rough.svg(s);
    var color = colorFor(el.getAttribute('data-rough-color') || 'accent');
    // A gentle wave: bezier through three points
    var d = 'M 4 12 Q ' + (w / 4) + ' 4, ' + (w / 2) + ' 12 T ' + (w - 4) + ' 12';
    var path = rc.path(d, {
      stroke: color,
      strokeWidth: 1.5,
      roughness: 0.5,
      bowing: 1,
      disableMultiStroke: false
    });
    s.appendChild(path);
  }

  function drawStars(el, rough) {
    el.innerHTML = '';
    var rating = parseFloat(el.getAttribute('data-rough-rating') || '0');
    var count = 5;
    var size = 22;
    var gap = 4;
    var w = (size * count) + (gap * (count - 1));
    var h = size + 4;
    var s = svg(w, h);
    el.appendChild(s);
    var rc = rough.svg(s);
    var fill = colorFor(el.getAttribute('data-rough-color') || 'reviews');
    var ink  = colorFor('ink');
    for (var i = 0; i < count; i++) {
      var x = i * (size + gap);
      var filled = i < Math.round(rating);
      // A 5-point star path inside size x size box
      var cx = x + size / 2, cy = h / 2;
      var pts = starPoints(cx, cy, size * 0.45, size * 0.18, 5);
      var poly = rc.polygon(pts, {
        stroke: ink,
        strokeWidth: 1.2,
        roughness: 0.5,
        fill: filled ? fill : 'none',
        fillStyle: 'hachure',
        fillWeight: 1.5,
        hachureGap: 3
      });
      s.appendChild(poly);
    }
  }

  function starPoints(cx, cy, rOuter, rInner, n) {
    var pts = [];
    for (var i = 0; i < n * 2; i++) {
      var r = (i % 2 === 0) ? rOuter : rInner;
      var a = (Math.PI / n) * i - Math.PI / 2;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return pts;
  }

  function drawDifficulty(el, rough) {
    el.innerHTML = '';
    var level = parseInt(el.getAttribute('data-rough-level') || '0', 10);
    var max = 5;
    var size = 28;
    var gap = 6;
    var w = (size * max) + (gap * (max - 1));
    var h = size + 4;
    var s = svg(w, h);
    el.appendChild(s);
    var rc = rough.svg(s);
    var fill = colorFor('accent');
    var ink  = colorFor('ink');
    var bg   = cssVar('--color-bg', '#FAF6EF');
    for (var i = 0; i < max; i++) {
      var x = i * (size + gap);
      var filled = i < level;
      var cx = x + size / 2;
      var cy = h / 2;
      // Mushroom cap (half-ellipse with a flat bottom edge)
      var capW = size - 6;
      var capH = size * 0.55;
      var capCy = cy - 3;
      var capPath = 'M ' + (cx - capW / 2) + ' ' + (capCy + capH / 2 - 1) +
                    ' a ' + (capW / 2) + ' ' + capH + ' 0 0 1 ' + capW + ' 0 z';
      s.appendChild(rc.path(capPath, {
        stroke: ink, strokeWidth: 1.1,
        roughness: 0.5,
        fill: filled ? fill : 'none',
        fillStyle: filled ? 'solid' : 'hachure',
        fillWeight: 1.2,
        hachureGap: 3
      }));
      // Stem (small rounded rect)
      var stemW = size * 0.42;
      var stemH = size * 0.36;
      s.appendChild(rc.rectangle(cx - stemW / 2, capCy + capH / 2 - 2, stemW, stemH, {
        stroke: ink, strokeWidth: 1.1,
        roughness: 0.5,
        fill: filled ? colorFor('olive') : 'none',
        fillStyle: 'hachure',
        fillWeight: 1,
        hachureGap: 3
      }));
      // Two cream cap spots, but only on filled mushrooms
      if (filled) {
        s.appendChild(rc.circle(cx - capW * 0.18, capCy - 1, 3, {
          stroke: bg, strokeWidth: 1, roughness: 0.5, fill: bg, fillStyle: 'solid'
        }));
        s.appendChild(rc.circle(cx + capW * 0.18, capCy + 2, 2.5, {
          stroke: bg, strokeWidth: 1, roughness: 0.5, fill: bg, fillStyle: 'solid'
        }));
      }
    }
  }

  function drawCircle(el, rough) {
    el.innerHTML = '';
    var text = el.getAttribute('data-rough-text') || '';
    var size = parseInt(el.getAttribute('data-rough-size') || '44', 10);
    var s = svg(size, size);
    el.appendChild(s);
    var rc = rough.svg(s);
    var fill = colorFor(el.getAttribute('data-rough-color') || 'accent');
    var ink  = colorFor('ink');
    var circle = rc.circle(size / 2, size / 2, size - 6, {
      stroke: ink,
      strokeWidth: 1.2,
      roughness: 0.5,
      fill: fill,
      fillStyle: 'solid'
    });
    s.appendChild(circle);
    if (text) {
      var t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', size / 2);
      t.setAttribute('y', size / 2);
      t.setAttribute('text-anchor', 'middle');
      // dy="0.35em" is the cross-browser-reliable vertical-centre trick;
      // dominant-baseline drifts across engines.
      t.setAttribute('dy', '0.35em');
      t.setAttribute('fill', cssVar('--color-bg', '#FAF6EF'));
      t.setAttribute('font-family', cssVar('--font-headline', 'Georgia, serif'));
      t.setAttribute('font-weight', '700');
      t.setAttribute('font-size', String(Math.round(size * 0.42)));
      t.setAttribute('pointer-events', 'none');
      t.textContent = text;
      s.appendChild(t);
    }
  }

  function drawChip(el, rough) {
    // Wrap the chip text in an SVG with a rough rounded outline behind
    var label = el.dataset.roughLabel || el.textContent.trim();
    if (!label) return;
    el.dataset.roughLabel = label;
    el.innerHTML = '<span class="rough-chip__label">' + label + '</span>';
    var labelEl = el.querySelector('.rough-chip__label');
    labelEl.style.position = 'relative';
    labelEl.style.zIndex = '1';
    labelEl.style.fontFamily = cssVar('--font-ui');
    labelEl.style.fontSize = '0.78rem';
    labelEl.style.fontWeight = '600';
    labelEl.style.letterSpacing = '0.02em';
    labelEl.style.padding = '4px 12px';
    labelEl.style.color = colorFor('ink');
    var w = Math.max(labelEl.offsetWidth + 8, 60);
    var h = Math.max(labelEl.offsetHeight + 6, 28);
    el.style.position = 'relative';
    el.style.display = 'inline-flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.padding = '0';
    var s = svg(w, h);
    s.style.position = 'absolute';
    s.style.inset = '0';
    s.style.width = '100%';
    s.style.height = '100%';
    s.style.zIndex = '0';
    el.appendChild(s);
    var rc = rough.svg(s);
    var color = colorFor(el.getAttribute('data-rough-color') || 'accent');
    var rect = rc.rectangle(2, 2, w - 4, h - 4, {
      stroke: color,
      strokeWidth: 1.2,
      roughness: 0.5,
      fill: cssVar('--color-bg', '#FAF6EF'),
      fillStyle: 'solid'
    });
    s.appendChild(rect);
  }

  function drawFrame(el, rough) {
    var rect = el.getBoundingClientRect();
    var w = rect.width || 600;
    var h = rect.height || 400;
    var existing = el.querySelector('svg[data-rough-frame]');
    if (existing) existing.remove();
    var s = svg(w, h);
    s.setAttribute('data-rough-frame', 'true');
    s.style.position = 'absolute';
    s.style.inset = '0';
    s.style.pointerEvents = 'none';
    el.style.position = el.style.position || 'relative';
    el.appendChild(s);
    var rc = rough.svg(s);
    var color = colorFor(el.getAttribute('data-rough-color') || 'ink');
    var path = rc.rectangle(6, 6, w - 12, h - 12, {
      stroke: color,
      strokeWidth: 1.2,
      roughness: 0.5,
      fill: 'none'
    });
    s.appendChild(path);
  }

  function drawUnderline(el, rough) {
    // Insert an absolutely-positioned SVG behind the heading text
    var existing = el.querySelector('svg[data-rough-underline]');
    if (existing) existing.remove();
    el.style.position = el.style.position || 'relative';
    el.style.display = el.style.display || 'inline-block';
    var w = el.offsetWidth;
    var h = 18;
    var s = svg(w, h);
    s.setAttribute('data-rough-underline', 'true');
    s.style.position = 'absolute';
    s.style.left = '0';
    s.style.bottom = '-12px';
    s.style.pointerEvents = 'none';
    el.appendChild(s);
    var rc = rough.svg(s);
    var color = colorFor(el.getAttribute('data-rough-color') || 'accent');
    var d = 'M 0 8 Q ' + (w / 3) + ' 16, ' + (w / 2) + ' 8 T ' + w + ' 8';
    s.appendChild(rc.path(d, {
      stroke: color, strokeWidth: 2,
      roughness: 0.5, bowing: 1
    }));
  }

  // -- Dispatcher ----------------------------------------------------

  var DRAWERS = {
    divider:    drawDivider,
    stars:      drawStars,
    difficulty: drawDifficulty,
    circle:     drawCircle,
    chip:       drawChip,
    frame:      drawFrame,
    underline:  drawUnderline
  };

  // No-op. Auto-underline on hero / page titles was removed per
  // editorial direction — the wavy underline sat awkwardly under wide
  // headlines. Decoration is now strictly opt-in via [data-rough].
  function autoDecorate() {}

  function renderAll() {
    autoDecorate();
    var els = document.querySelectorAll('[data-rough]');
    if (!els.length) return;
    loadRough().then(function (rough) {
      els.forEach(function (el) {
        var type = el.getAttribute('data-rough');
        var fn = DRAWERS[type];
        if (!fn) return;
        try { fn(el, rough); } catch (e) { /* swallow per-element render errors */ }
      });
    }).catch(function () { /* rough.js failed to load -- silent no-op */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderAll);
  } else {
    renderAll();
  }
  document.addEventListener('spa:contentswap', renderAll);
  // Re-render on theme change so dark-mode colors come through
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderAll);
  document.documentElement.addEventListener('themechange', renderAll);
  // Once images have loaded, re-render frames sized to pre-image dimensions.
  window.addEventListener('load', renderAll);
  // Debounced resize re-render so frames track parent dimensions when
  // the viewport changes (e.g. column reflow at breakpoints).
  var resizeT;
  window.addEventListener('resize', function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(renderAll, 200);
  });
})();
