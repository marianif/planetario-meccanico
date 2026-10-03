/* ==========================================================================
   ORRERY — Application
   Builds the planet chapters from the data layer, drives the camera from
   scroll position, runs the ephemeris each frame, and wires the orrery and
   the chart.
   ========================================================================== */
(function (root) {
  'use strict';

  var DATA = root.ASTRO_DATA, EPH = root.ASTRO_EPH, TEX = root.ASTRO_TEX;
  var R = root.ASTRO_RENDER, CH = root.ASTRO_CHART;
  var D2R = Math.PI / 180;
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var sstep = function (t) { return t * t * (3 - 2 * t); };
  var wrap360 = function (x) { x = x % 360; return x < 0 ? x + 360 : x; };

  var REDUCED = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var AU = DATA.AU_KM, J2000 = 2451545.0;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var renderer, bodyEl, clockUtc, clockSid, railFill, dotsEl;
  var chapters = DATA.CHAPTERS;
  var keys = [];                 /* chapter keyframes: {el, y, cfg} */
  var smoothY = 0, targetY = 0;
  var orbitCache = {};
  var state = {
    offsetDays: 0, fixedJD: null,
    labels: 1, orbits: 1, zodiac: 1,
    dragAz: 0, dragEl: 0,
    hover: null, jd: 0, frame: 0, fps: 60
  };
  var liveEls = [], liveIndex = null;

  /* ======================================================================
     1. Chapter construction — one source of truth for copy and physics
     ====================================================================== */

  /* direction the spin axis leans, in ecliptic longitude. Saturn's and
     Uranus' are chosen so the rings open toward the camera in their chapter */
  var AXIS_NODE = {
    sun: 0, mercury: 40, venus: 300, earth: 90, mars: 82,
    jupiter: 268, saturn: 40, uranus: 170, neptune: 30
  };
  var ATMO = {
    mercury: null, venus: [255, 226, 168], earth: [96, 156, 255],
    mars: [226, 142, 108], jupiter: [232, 208, 160], saturn: [240, 222, 172],
    uranus: [168, 240, 246], neptune: [110, 158, 255]
  };
  var CLOUDY = { earth: 0.9 };
  /* how smeared the day/night line is: airless regolith gives a knife edge,
     a deep atmosphere smears the terminator over tens of degrees */
  var SOFT = {
    sun: 1, mercury: 0.22, venus: 1.15, earth: 1.20, mars: 0.62,
    jupiter: 0.95, saturn: 0.95, uranus: 1.0, neptune: 1.0
  };

  function statBlock(b) {
    return '' +
      '<dl class="rail-stats">' +
        '<div><dt>From Earth</dt><dd data-live="dist" data-id="' + b.id + '">—</dd></div>' +
        '<div><dt>Light time</dt><dd data-live="lt" data-id="' + b.id + '">—</dd></div>' +
        '<div><dt>Right now</dt><dd data-live="sign" data-id="' + b.id + '">—</dd></div>' +
        '<div><dt>Orbit</dt><dd>' + (b.period === '—' ? '—' : b.period) + '</dd></div>' +
        '<div><dt>Rotation</dt><dd>' + (b.rot === '—' ? '—' :
          (b.rot < 0 ? '↺ ' : '') + Math.abs(b.rot).toFixed(2) + ' d') + '</dd></div>' +
        '<div><dt>Moons</dt><dd>' + (b.moons === null ? '—' : b.moons) + '</dd></div>' +
      '</dl>';
  }

  function chapterHTML(b) {
    var cfg = chapters.filter(function (c) { return c.id === b.id; })[0];
    var flip = cfg && cfg.shift < 0;
    var arch = b.archetype ? b.archetype : b.role;
    var story = b.story.map(function (p) { return '<p>' + p + '</p>'; }).join('');
    var chips = b.keywords.map(function (k) { return '<li>' + k + '</li>'; }).join('');
    var facts = b.facts.map(function (f) {
      return '<div><dt>' + f[0] + '</dt><dd>' + f[1] + '</dd></div>';
    }).join('');

    /* Two beats share the pinned screen. The identity arrives first, then the
       reading rises over it — which keeps the whole chapter legible in one
       viewport instead of overflowing it. */
    return '' +
    '<section class="chapter chapter--body" id="' + b.id + '" data-chapter="' + b.id + '">' +
      '<div class="sticky"><div class="wrap body-split' + (flip ? ' body-split--r' : '') + '">' +

        '<div class="beat beat--id" data-beat="0">' +
          '<div class="body-split__title">' +
            '<span class="body-split__glyph">' + b.glyph + '</span>' +
            '<h2 class="body-split__name split">' + b.name + '</h2>' +
          '</div>' +
          '<p class="body-split__role">' + arch + ' · ' + b.role + '</p>' +
          '<p class="body-split__sub">' + b.sub + '</p>' +
          statBlock(b) +
          '<ul class="chips">' + chips + '</ul>' +
          '<ol class="beat__pips" aria-hidden="true"><li class="is-on"></li><li></li></ol>' +
        '</div>' +

        '<div class="beat beat--read" data-beat="1">' +
          '<p class="beat__label">' + b.name + ' · ' + b.role + '</p>' +
          '<div class="astro">' +
            '<div class="astro__dignity">' +
              '<div><dt>Ruled</dt><dd>' + b.rulership + '</dd></div>' +
              '<div><dt>Dignities</dt><dd>' + b.domicile + '</dd></div>' +
              '<div><dt>Nature</dt><dd>' + b.element + ' · ' + b.modality + '</dd></div>' +
            '</div>' +
            '<div class="prose">' + story + '</div>' +
          '</div>' +
          '<dl class="gift">' +
            '<div class="gift__g"><dt>The gift</dt><dd>' + b.gift + '</dd></div>' +
            '<div class="gift__s"><dt>The shadow</dt><dd>' + b.shadow + '</dd></div>' +
          '</dl>' +
          '<details class="facts"><summary>Physical record</summary><dl class="facts__grid">' +
            facts + '</dl></details>' +
        '</div>' +

      '</div></div>' +
    '</section>';
  }

  function buildChapters() {
    var html = DATA.BODIES.map(function (b, i) { return chapterHTML(b, i); }).join('');
    bodyEl.innerHTML = html;
  }

  /* ======================================================================
     2. Per-frame body payloads
     ====================================================================== */

  function axisWorld(b) {
    var tilt = b.tilt * D2R;
    var node = (AXIS_NODE[b.id] === undefined ? 0 : AXIS_NODE[b.id]) * D2R;
    return { x: Math.sin(tilt) * Math.cos(node),
             y: Math.sin(tilt) * Math.sin(node),
             z: Math.cos(tilt) };
  }

  function moonList(b, jd) {
    var list = DATA.MOONS[b.id];
    if (!list) return null;
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      var ph = ((jd - J2000) / m.period) % 1;
      if (ph < 0) ph += 1;
      var ang = ph * Math.PI * 2;
      var inc = m.inc * D2R;
      /* offsets from the parent, in AU — the renderer positions them with a
         camera-space offset transform, so they must be small world units */
      var aAU = m.a / AU;
      out.push({
        x: aAU * Math.cos(ang),
        y: aAU * Math.sin(ang) * Math.cos(inc),
        z: aAU * Math.sin(ang) * Math.sin(inc),
        rAU: m.rKm / AU,
        rot: ((jd - J2000) / m.period * 360) % 360,
        tex: m.tex || m.id,
        atmo: m.id === 'titan' ? [230, 180, 110] : null
      });
    }
    return out;
  }

  function orbitFor(id, jd) {
    var c = orbitCache[id];
    if (c && Math.abs(c.jd - jd) < 400) return c.path;
    var path = EPH.orbitPath(id, jd, 200);
    orbitCache[id] = { jd: jd, path: path };
    return path;
  }

  function buildBodies(jd, weights, targets) {
    var out = [];
    for (var i = 0; i < DATA.BODIES.length; i++) {
      var b = DATA.BODIES[i];
      var w = weights[b.id] || 0;
      var p;
      if (b.id === 'sun') p = { x: 0, y: 0, z: 0 };
      else p = EPH.helio(b.id, jd);
      out.push({
        id: b.id, name: b.name, glyph: b.glyph, tex: b.id === 'earth' ? 'earth' : b.tex,
        p: { x: p.x, y: p.y, z: p.z },
        rAU: b.rKm / AU,
        rot: wrap360((jd - J2000) / b.rot * 360),
        weight: w, target: targets[b.id] || 0,
        soft: SOFT[b.id] === undefined ? 0.6 : SOFT[b.id],
        ambient: b.id === 'venus' ? 0.10 : (b.id === 'uranus' || b.id === 'neptune' ? 0.08 : 0.05),
        atmo: ATMO[b.id] ? ATMO[b.id].slice() : null,
        atmoK: b.id === 'earth' ? 1.25 : (b.id === 'venus' ? 1.1 : 0.7),
        cloud: CLOUDY[b.id] ? 'clouds' : null,
        cloudAlpha: CLOUDY[b.id] || 0,
        cloudRot: b.id === 'earth' ? wrap360((jd - J2000) / b.rot * 360 * 0.92) : 0,
        night: b.id === 'earth' ? 'lights' : null,
        specK: b.id === 'earth' ? 1 : 0,
        rings: b.rings || null,
        ringTex: b.id,
        axisWorld: axisWorld(b),
        moons: moonList(b, jd),
        orbit: b.id === 'sun' ? null : orbitFor(b.id, jd)
      });
    }
    /* the Moon rides with Earth and is drawn in the Moon's own frame */
    var moon = EPH.moonGeo(jd);
    var earth = null;
    for (var k = 0; k < out.length; k++) if (out[k].id === 'earth') earth = out[k];
    if (earth) {
      earth.moons = [{
        x: moon.x, y: moon.y, z: moon.z,
        rAU: 1737.4 / AU, rot: wrap360((jd - J2000) / 27.321661 * 360),
        tex: 'luna'
      }];
      earth.moonPhase = EPH.moonPhase(jd);
    }
    return out;
  }

  /* ======================================================================
     3. Camera choreography from scroll
     ====================================================================== */

  function measureKeys() {
    keys = [];
    for (var i = 0; i < chapters.length; i++) {
      var el = document.getElementById(chapters[i].id);
      if (!el) continue;
      var r = el.getBoundingClientRect();
      var top = r.top + root.scrollY;
      var h = el.offsetHeight;
      var vh = root.innerHeight;
      keys.push({ el: el, cfg: chapters[i], y: top + Math.max(0, (h - vh)) / 2, top: top, h: h,
                  beat0: el.querySelector('[data-beat="0"]'),
                  beat1: el.querySelector('[data-beat="1"]'),
                  pips: el.querySelectorAll('.beat__pips li') });
    }
  }

  function chapterAt(y) {
    if (y <= keys[0].y) return { i: 0, j: 0, t: 0 };
    for (var i = 0; i < keys.length - 1; i++) {
      if (y >= keys[i].y && y <= keys[i + 1].y) {
        var span = keys[i + 1].y - keys[i].y;
        var t = span > 0 ? (y - keys[i].y) / span : 0;
        return { i: i, j: i + 1, t: sstep(clamp(t, 0, 1)) };
      }
    }
    return { i: keys.length - 1, j: keys.length - 1, t: 0 };
  }

  function focusPos(cfg, jd) {
    if (cfg.focus === 'sun') return { x: 0, y: 0, z: 0 };
    var p = EPH.helio(cfg.focus, jd);
    return { x: p.x, y: p.y, z: p.z };
  }

  function updateCamera(jd, dt) {
    var k = chapterAt(smoothY);
    var a = keys[k.i] ? keys[k.i].cfg : chapters[0];
    var b = keys[k.j] ? keys[k.j].cfg : chapters[0];
    var t = k.t;
    var cam = renderer.cam;
    var fa = focusPos(a, jd), fb = focusPos(b, jd);

    cam.fx = lerp(fa.x, fb.x, t);
    cam.fy = lerp(fa.y, fb.y, t);
    cam.fz = lerp(fa.z, fb.z, t);
    cam.dist = lerp(a.dist, b.dist, t);
    cam.elev = lerp(a.elev, b.elev, t);
    cam.azim = lerp(a.azim, b.azim, t);
    cam.shiftX = lerp(a.shift, b.shift, t) * renderer.W * 0.5;

    var freeA = a.free ? 1 : 0, freeB = b.free ? 1 : 0;
    var free = lerp(freeA, freeB, t);
    cam.azim += state.dragAz;
    cam.elev = clamp(cam.elev + state.dragEl, -1.44, 1.44);
    /* ease the user's manual orbit back to the authored one on exit */
    if (free < 0.5) {
      var back = Math.pow(0.90, dt * 60);
      state.dragAz *= back; state.dragEl *= back;
    }

    var st = renderer.state;
    st.orbits = lerp(a.orbits, b.orbits, t) * (state.orbits ? 1 : 0);
    st.zodiac = lerp(a.zodiac, b.zodiac, t) * (state.zodiac ? 1 : 0);
    st.belt = lerp(a.belt, b.belt, t);
    st.labels = lerp(a.labels, b.labels, t) * (state.labels ? 1 : 0);
    st.sunGlow = 1 - Math.max(lerp(a.hud, b.hud, t), 0);
    st.vignette = 1;
    st.grain = !REDUCED;
    st.bloom = renderer.quality > 0.5 ? 1 : 0;

    var weights = {}, targets = {};
    /* On a phone the copy has to own the frame, so the planet shrinks and
       rides above the text instead of sitting behind it. */
    var narrow = renderer.W < 900;
    var kScale = narrow ? 0.42 : 1;
    function put(cfg, w) {
      if (w <= 0.001) return;
      weights[cfg.focus] = Math.max(weights[cfg.focus] || 0, w);
      targets[cfg.focus] = cfg.target * kScale;
    }
    put(a, 1 - t);
    put(b, t);
    var liftA = a.lift ? 1 : 0, liftB = b.lift ? 1 : 0;
    cam.shiftY = narrow ? -renderer.H * 0.30 * lerp(liftA, liftB, t) : 0;
    return { weights: weights, targets: targets, chapter: t > 0.5 ? b : a, blend: t, free: free };
  }

  /* The one cheat, measured and stated: a planet at true angular size from a
     camera a fraction of an astronomical unit away is a sub-pixel speck. */
  var scaleNoteEl, scaleNoteText;
  function updateScaleNote(camInfo) {
    if (!scaleNoteEl) return;
    var cfg = camInfo.chapter, id = cfg.focus;
    if (!cfg.target || cfg.target < 1) { scaleNoteEl.classList.remove('is-on'); return; }
    var meta = null;
    for (var i = 0; i < DATA.BODIES.length; i++) if (DATA.BODIES[i].id === id) meta = DATA.BODIES[i];
    if (!meta) { scaleNoteEl.classList.remove('is-on'); return; }
    var truePx = renderer.cam.focal / renderer.cam.dist * (meta.rKm / AU);
    var amp = truePx > 0.0001 ? cfg.target / truePx : 0;
    scaleNoteText.textContent = meta.name + ' drawn ×' +
      (amp >= 1000 ? Math.round(amp / 100) * 100 : Math.round(amp)) +
      ' its true size from here · orbit, phase and light are not drawn to scale of the disc';
    scaleNoteEl.classList.add('is-on');
  }

  /* ======================================================================
     4. Live readouts
     ====================================================================== */

  function jdNow() { return EPH.jdFromDate(new Date()); }

  function sceneJD() {
    var base = state.fixedJD === null ? jdNow() : state.fixedJD;
    return base + state.offsetDays;
  }

  function fmtJD(jd) {
    var ms = (jd - 2440587.5) * 86400000;
    var d = new Date(ms);
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) +
           ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ':' + p(d.getUTCSeconds());
  }

  /* one pass over the bodies, then write into the three live cells of each */
  function updateLive(jd) {
    var earth = EPH.helio('earth', jd);
    var sun = EPH.sunGeo(jd);
    var cells = liveIndex || (liveIndex = buildLiveIndex());
    for (var i = 0; i < DATA.BODIES.length; i++) {
      var b = DATA.BODIES[i];
      var cell = cells[b.id];
      if (!cell) continue;
      var rSun, dE, lon;
      if (b.id === 'sun') {
        rSun = 0;
        dE = Math.sqrt(earth.x * earth.x + earth.y * earth.y + earth.z * earth.z);
        lon = sun.lon;
      } else {
        var p = EPH.helio(b.id, jd);
        var dx = p.x - earth.x, dy = p.y - earth.y, dz = p.z - earth.z;
        dE = Math.sqrt(dx * dx + dy * dy + dz * dz);
        rSun = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
        lon = EPH.norm360(Math.atan2(dy, dx) * 180 / Math.PI);
      }
      if (cell.dist) cell.dist.textContent =
        dE < 0.005 ? (dE * AU).toFixed(0) + ' km' : dE.toFixed(dE < 10 ? 3 : 2) + ' AU';
      if (cell.lt) cell.lt.textContent = CH.lightTime(dE);
      if (cell.sign) {
        var s = CH.signOf(lon);
        cell.sign.textContent = s.sign.name + ' ' + Math.floor(s.deg) + '°';
      }
    }
  }

  function buildLiveIndex() {
    var map = {};
    liveEls.forEach(function (el) {
      var id = el.dataset.id;
      if (!map[id]) map[id] = {};
      map[id][el.dataset.live] = el;
    });
    return map;
  }

  function updateClock(jd) {
    var frac = jd + 0.5;
    var h = Math.floor(frac) % 24, m = Math.floor((frac % 1) * 60), s = Math.floor(((frac * 60) % 1) * 60);
    var p = function (n) { return String(n).padStart(2, '0'); };
    clockUtc.textContent = p(h) + ':' + p(m) + ':' + p(s);
    var L = EPH.lst(jd, 0);
    clockSid.textContent = Math.floor(L) + '°' + String(Math.floor((L % 1) * 60)).padStart(2, '0') + '′';
  }

  /* Each planet chapter holds two beats on one pinned screen. Drive their
     cross-fade from how far through its own pinned range the reader is. */
  function updateBeats(y) {
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (!k.beat0) continue;
      var span = Math.max(1, k.h - root.innerHeight);
      var p = clamp((y - k.top) / span, 0, 1);
      /* The camera keyframe for a chapter is the midpoint of its pinned
         range, which is exactly where a naive cross-fade would leave both
         beats half-faded. Resolve the handover well before that point so
         arriving by nav link, dot or scroll always lands on a whole beat. */
      var a, b;
      if (p < 0.34)      { a = 1; b = 0; }
      else if (p < 0.44) { a = 1 - (p - 0.34) / 0.10; b = 0; }
      else if (p < 0.48) { a = 0; b = (p - 0.44) / 0.04; }
      else               { a = 0; b = 1; }
      if (a < 0.999) a *= a;                       /* ease the identity out */
      k.beat0.style.opacity = a.toFixed(3);
      k.beat0.style.transform = 'translateY(' + (-22 * (1 - a)).toFixed(1) + 'px)';
      k.beat1.style.opacity = b.toFixed(3);
      k.beat1.style.transform = 'translateY(' + (30 * (1 - b)).toFixed(1) + 'px)';
      var pips = k.pips;
      if (pips) {
        pips[0].classList.toggle('is-on', a > 0.5);
        pips[1].classList.toggle('is-on', b > 0.5);
      }
    }
  }

  /* ======================================================================
     5. Orrery deck interaction
     ====================================================================== */

  function bindOrrery() {
    var deck = $('#orreryDeck'), scrub = $('#timeScrub'), input = $('#epochInput');
    var read = $('#orreryRead');
    var drag = null;

    deck.addEventListener('pointerdown', function (e) {
      drag = { x: e.clientX, y: e.clientY, az: state.dragAz, el: state.dragEl };
      deck.classList.add('is-drag');
      deck.setPointerCapture(e.pointerId);
    });
    deck.addEventListener('pointermove', function (e) {
      if (drag) {
        state.dragAz = drag.az + (e.clientX - drag.x) * 0.0062;
        state.dragEl = clamp(drag.el + (e.clientY - drag.y) * 0.0042, -1.0, 1.0);
      }
      hitTest(e.clientX, e.clientY);
    });
    function endDrag(e) {
      drag = null;
      deck.classList.remove('is-drag');
      if (deck.hasPointerCapture && e.pointerId != null && deck.hasPointerCapture(e.pointerId)) {
        deck.releasePointerCapture(e.pointerId);
      }
    }
    deck.addEventListener('pointerup', endDrag);
    deck.addEventListener('pointercancel', endDrag);
    deck.addEventListener('pointerleave', function () { state.hover = null; renderRead(read, null); });

    scrub.addEventListener('input', function () {
      state.offsetDays = Number(scrub.value) * 1.2;
      syncInput(input);
    });

    input.addEventListener('change', function () {
      var v = input.value;
      if (!v) return;
      var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v);
      if (!m) return;
      state.fixedJD = EPH.jdFromUTC(+m[1], +m[2], +m[3], +m[4], +m[5], 0);
      scrub.value = 0; state.offsetDays = 0;
    });

    $$('[data-jump]', deck.parentNode).forEach(function (b) {
      b.addEventListener('click', function () {
        state.offsetDays += Number(b.dataset.jump);
        scrub.value = clamp(state.offsetDays / 1.2, -1000, 1000);
        syncInput(input);
      });
    });
    var nowBtn = $('[data-now]');
    if (nowBtn) nowBtn.addEventListener('click', function () {
      state.fixedJD = null; state.offsetDays = 0; scrub.value = 0; syncInput(input);
    });

    var toggles = { labels: 1, orbits: 1, zodiac: 1 };
    $$('[data-toggle]').forEach(function (b) {
      var k = b.dataset.toggle;
      b.classList.add('is-on');
      b.addEventListener('click', function () {
        state[k] = state[k] ? 0 : 1;
        b.classList.toggle('is-on', !!state[k]);
      });
    });

    var ticks = $('#scrubTicks');
    if (ticks) ticks.innerHTML = '<span>−16 mo</span><span>now</span><span>+16 mo</span>';
    syncInput(input);
  }

  function syncInput(input) {
    var jd = sceneJD();
    var d = new Date((jd - 2440587.5) * 86400000);
    var p = function (n) { return String(n).padStart(2, '0'); };
    input.value = d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) +
                  'T' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes());
  }

  function hitTest(mx, my) {
    var q = renderer.lastQueue;
    if (!q) return;
    var best = null, bestD = 1e9;
    for (var i = 0; i < q.length; i++) {
      var it = q[i];
      var r = Math.max(it.r || 0, 7);
      var dx = mx - it.x, dy = my - it.y;
      var d = Math.hypot(dx, dy);
      if (d < r + 4 && d < bestD) { bestD = d; best = it; }
    }
    var id = best ? best.b.id : null;
    if (id !== state.hover) {
      state.hover = id;
      renderRead($('#orreryRead'), id);
    }
  }

  function renderRead(el, id) {
    if (!el) return;
    if (!id) {
      el.innerHTML = '<p class="read__hint">Hover a world to read its live state.</p>';
      return;
    }
    var meta = null;
    for (var i = 0; i < DATA.BODIES.length; i++) if (DATA.BODIES[i].id === id) meta = DATA.BODIES[i];
    if (!meta) return;
    el.innerHTML =
      '<div class="read__top"><span class="read__glyph">' + meta.glyph + '</span>' +
      '<span class="read__name">' + meta.name + '</span></div>' +
      '<dl class="read__grid">' +
        '<div><dt>From Sun</dt><dd data-r="a"></dd></div>' +
        '<div><dt>From Earth</dt><dd data-r="d"></dd></div>' +
        '<div><dt>Light time</dt><dd data-r="lt"></dd></div>' +
        '<div><dt>Sign now</dt><dd data-r="s"></dd></div>' +
      '</dl>';
    fillRead(el, id);
  }

  function fillRead(el, id) {
    var jd = sceneJD();
    var meta = null;
    for (var i = 0; i < DATA.BODIES.length; i++) if (DATA.BODIES[i].id === id) meta = DATA.BODIES[i];
    if (!meta) return;
    var e = EPH.helio('earth', jd);
    var eR = Math.sqrt(e.x * e.x + e.y * e.y + e.z * e.z);
    if (meta.id === 'sun') {
      setRead(el, 'a', '0 AU'); setRead(el, 'd', eR.toFixed(4) + ' AU');
      setRead(el, 'lt', CH.lightTime(eR));
      setRead(el, 's', CH.signOf(EPH.sunGeo(jd).lon).sign.name);
      return;
    }
    var b = EPH.helio(meta.id, jd);
    var rSun = Math.hypot(b.x, b.y, b.z);
    var dE = Math.hypot(b.x - e.x, b.y - e.y, b.z - e.z);
    var lon = EPH.norm360(Math.atan2(b.y - e.y, b.x - e.x) * 180 / Math.PI);
    setRead(el, 'a', rSun.toFixed(3) + ' AU');
    setRead(el, 'd', dE.toFixed(3) + ' AU');
    setRead(el, 'lt', CH.lightTime(dE));
    var s = CH.signOf(lon);
    setRead(el, 's', s.sign.name + ' ' + Math.floor(s.deg) + '°');
  }
  function setRead(el, k, v) {
    var n = el.querySelector('[data-r="' + k + '"]');
    if (n) n.textContent = v;
  }

  /* ======================================================================
     6. Chart
     ====================================================================== */

  function castChart(caption) {
    var y = Number($('#cDate').value.slice(0, 4));
    var mo = Number($('#cDate').value.slice(5, 7));
    var da = Number($('#cDate').value.slice(8, 10));
    var tm = $('#cTime').value.split(':');
    var hh = Number(tm[0]), mi = Number(tm[1] || 0);
    var lat = Number($('#cLat').value), lon = Number($('#cLon').value);
    var tz = Number($('#cTz').value) || 0;
    if (!y || !mo || !da || isNaN(lat) || isNaN(lon)) return;
    var jd = EPH.jdFromUTC(y, mo, da, hh + tz, mi, 0);
    var bodies = EPH.chart(jd);
    var ang = EPH.angles(jd, lat, lon);
    var wheel = $('#wheel');
    CH.draw(wheel, { bodies: bodies, asc: ang.asc, mc: ang.mc, eps: ang.eps });
    wheel.classList.add('is-in');
    var name = $('#cName').value.trim();
    $('#wheelCap').textContent = (name ? name + ' · ' : '') + (caption || 'Natal chart');
    $('#chartForm').closest('.chart').classList.add('has-chart');

    var list = $('#aspectsList'), asp = CH.aspects(bodies), html = '';
    for (var i = 0; i < asp.length; i++) {
      var A = asp[i];
      html += '<li><b style="color:' + A.asp.colour + '">' + A.a.charAt(0).toUpperCase() + A.a.slice(1, 3) +
              ' ' + A.asp.glyph + ' ' + A.b.charAt(0).toUpperCase() + A.b.slice(1, 3) + '</b>' +
              '<span><em>' + Math.abs(A.exact).toFixed(1) + '°</em> · ' + A.asp.note + '</span></li>';
    }
    list.innerHTML = html || '<li><span>No major aspects within orb.</span></li>';
    $('#aspects').hidden = false;
  }

  function bindChart() {
    var now = new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    $('#cDate').value = now.getFullYear() + '-' + p(now.getMonth() + 1) + '-' + p(now.getDate());
    var tz = -now.getTimezoneOffset() / 60;
    $('#cTz').value = (Math.round(tz * 4) / 4);
    $('#chartForm').addEventListener('submit', function (e) {
      e.preventDefault();
      castChart(null);
    });
    /* open on tonight's sky so the wheel is never empty */
    var lon0 = Number($('#cLon').value), lat0 = Number($('#cLat').value);
    var jd = jdNow() - lon0 / 360;
    var bodies = EPH.chart(jd);
    var ang = EPH.angles(jd, lat0, lon0);
    CH.draw($('#wheel'), { bodies: bodies, asc: ang.asc, mc: ang.mc, eps: ang.eps });
    $('#wheel').classList.add('is-in');
    $('#wheelCap').textContent = 'The sky tonight · Greenwich';
    $('#cDate').addEventListener('change', function () { castChart(null); });
    $('#cTime').addEventListener('change', function () { castChart(null); });
    root.addEventListener('resize', debounce(function () {
      if (!$('#chartForm').closest('.chart').classList.contains('has-chart')) {
        var a = EPH.angles(jdNow() - lon0 / 360, lat0, lon0);
        CH.draw($('#wheel'), { bodies: EPH.chart(jdNow()), asc: a.asc, mc: a.mc, eps: a.eps });
      }
    }, 220));
  }

  function debounce(fn, ms) {
    var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  /* ======================================================================
     7. Reveals, nav, dots
     ====================================================================== */

  function splitWords(el) {
    var lines = el.querySelectorAll('span, em');
    if (!lines.length) lines = [el];
    Array.prototype.forEach.call(lines, function (line) {
      var text = line.textContent.trim();
      if (!text) return;
      line.textContent = '';
      var words = text.split(/\s+/);
      words.forEach(function (w, i) {
        var s = document.createElement('span');
        s.className = 'word';
        s.style.setProperty('--w', i);
        s.textContent = w;
        line.appendChild(s);
        if (i < words.length - 1) line.appendChild(document.createTextNode(' '));
      });
      line.classList.add('split');
    });
  }

  function bindObservers() {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '-8% 0px -18% 0px', threshold: 0.05 });

    $$('.reveal, .split').forEach(function (el) {
      var d = el.dataset.d;
      if (d) el.style.setProperty('--d', d);
      io.observe(el);
    });

    /* chapters get an active class for the deck ring etc. */
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        e.target.classList.toggle('is-active', e.isIntersecting);
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    $$('.chapter').forEach(function (el) { cio.observe(el); });
  }

  function buildDots() {
    dotsEl.innerHTML = '';
    chapters.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      var meta = null;
      for (var i = 0; i < DATA.BODIES.length; i++) if (DATA.BODIES[i].id === c.focus) meta = DATA.BODIES[i];
      b.dataset.label = c.id === 'orrery' ? 'Orrery' : c.id === 'zodiac' ? 'Chart' :
                       (meta ? meta.name : c.id.charAt(0).toUpperCase() + c.id.slice(1));
      b.setAttribute('aria-label', b.dataset.label);
      b.innerHTML = '<i></i>';
      b.addEventListener('click', function () {
        var el = document.getElementById(c.id);
        if (el) root.scrollTo({ top: el.getBoundingClientRect().top + root.scrollY +
          Math.max(0, (el.offsetHeight - root.innerHeight)) / 2, behavior: 'smooth' });
      });
      dotsEl.appendChild(b);
    });
  }

  function bindNav() {
    var nav = $('#nav');
    var links = $$('.nav__links a');
    var lastY = 0;
    root.addEventListener('scroll', function () {
      var y = root.scrollY;
      nav.classList.toggle('is-stuck', y > 40);
      nav.classList.toggle('is-hidden', y > lastY + 4 && y > 320);
      lastY = y;
      var doc = y + root.innerHeight * 0.45;
      var act = null;
      keys.forEach(function (k) { if (doc >= k.top) act = k.el.id; });
      links.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('href') === '#' + act); });
      var d = $$('#dots button');
      d.forEach(function (b, i) { b.classList.toggle('is-active', keys[i] && keys[i].el.id === act); });
    }, { passive: true });

    links.forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href').slice(1);
        var el = document.getElementById(id);
        if (!el) return;
        e.preventDefault();
        root.scrollTo({ top: el.getBoundingClientRect().top + root.scrollY +
          Math.max(0, (el.offsetHeight - root.innerHeight)) / 2, behavior: 'smooth' });
      });
    });
  }

  /* ======================================================================
     8. Main loop
     ====================================================================== */

  var last = 0, acc = 0, frames = 0, fpsT = 0;

  function loop(now) {
    root.requestAnimationFrame(loop);
    var dt = last ? Math.min(0.1, (now - last) / 1000) : 0.016;
    last = now;
    state.frame++;

    /* scroll damping — the camera lags the wheel, the page itself does not */
    targetY = root.scrollY;
    if (REDUCED) smoothY = targetY;
    else smoothY += (targetY - smoothY) * (1 - Math.pow(0.02, dt));

    /* adaptive quality */
    frames++; fpsT += dt;
    if (fpsT > 1) {
      var fps = frames / fpsT;
      state.fps = fps;
      if (fps < 34 && renderer.quality > 0.45) { renderer.quality = 0.4; renderer.state.bloom = 0; }
      else if (fps > 52 && renderer.quality < 1 && state.frame > 180) renderer.quality = 1;
      frames = 0; fpsT = 0;
    }

    var jd = sceneJD();
    state.jd = jd;
    var cam = updateCamera(jd, dt);
    /* state.t is wall-clock seconds and drives twinkle and drift; epoch is
       real ephemeris time and drives the sun's own rotation. They must not
       be confused or scrubbing the date would make the sky flicker. */
    renderer.state.t = REDUCED ? 0 : now / 1000;
    renderer.state.epoch = jd - J2000;
    renderer.state.ui = clamp(renderer.W / 1440, 0.72, 1.15);
    renderer.state.highlight = state.hover;

    var bodies = buildBodies(jd, cam.weights, cam.targets);
    renderer.draw(bodies);
    updateScaleNote(cam);
    if (state.frame % 2 === 0) updateBeats(smoothY);

    if (state.frame % 4 === 0) {
      updateLive(jd);
      updateClock(jd);
      railFill.style.width = (root.scrollY /
        Math.max(1, document.body.scrollHeight - root.innerHeight) * 100).toFixed(2) + '%';
    }
    if (state.hover && state.frame % 8 === 0) fillRead($('#orreryRead'), state.hover);
  }

  /* ======================================================================
     9. Boot
     ====================================================================== */

  var PHASE1 = ['sun', 'mercury', 'venus', 'earth', 'clouds', 'lights',
                'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'luna'];
  var PHASE2 = ['io', 'europa', 'ganymede', 'callisto', 'titan', 'rhea',
                'triton', 'phobos', 'deimos'];

  function boot() {
    bodyEl = $('#bodyChapters');
    clockUtc = $('#utc'); clockSid = $('#sidereal'); railFill = $('#railFill');
    dotsEl = $('#dots');
    scaleNoteEl = $('#scaleNote'); scaleNoteText = $('#scaleNoteText');

    buildChapters();
    liveEls = $$('[data-live]');

    renderer = new R.Renderer($('#sky'));
    renderer.resize();
    renderer.build();
    /* a small handle for inspection from the console */
    root.ORRERY = { renderer: renderer, state: state, data: DATA, eph: EPH };

    measureKeys();
    buildDots();
    bindNav();
    /* the word split has to happen before the observer queries for .split */
    splitWords($('.hero .display'));
    splitWords($('.outro .display'));
    bindObservers();
    bindOrrery();
    bindChart();

    var loader = $('#loader'), fill = $('#loadFill'), pct = $('#loadPct');
    var phase = 0;

    PHASE1.forEach(function (id) { TEX.Manager.request(id); });

    function pump() {
      TEX.Manager.pump(13);
      var p = TEX.Manager.progress;
      fill.style.width = (p * 100).toFixed(1) + '%';
      pct.textContent = Math.round(p * 100) + '%';

      /* the critical set is everything the opening chapters need */
      if (phase === 0 && TEX.Manager.queue.length === 0) {
        phase = 1;
        loader.classList.add('is-done');
        measureKeys();
        $('#heroEpoch').textContent = 'Live ephemeris · ' + fmtJD(sceneJD());
        setTimeout(function () { loader.setAttribute('hidden', ''); }, 1000);
        /* moons and satellites stream in behind the curtain */
        PHASE2.forEach(function (id) { TEX.Manager.request(id); });
      }
      if (phase === 1 && TEX.Manager.queue.length === 0) clearInterval(timer);
    }
    var timer = setInterval(pump, 16);
    /* never let a stalled job trap the visitor on the loader */
    setTimeout(function () {
      clearInterval(timer);
      if (!loader.hasAttribute('hidden')) loader.classList.add('is-done');
    }, 25000);

    var rz = debounce(function () {
      renderer.resize();
      measureKeys();
    }, 140);
    root.addEventListener('resize', rz);

    root.requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
