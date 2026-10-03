/* ==========================================================================
   ORRERY — Procedural surface generator
   Value-noise fBm evaluated in 3D on the unit sphere, so every equirectangular
   map is seamless and free of polar pinching. Colours are art-directed toward
   measured photometry where it matters (ice caps, band latitudes, ring gaps).
   Textures are built in time-sliced chunks so the page never blocks.
   ========================================================================== */
(function (root) {
  'use strict';

  var D2R = Math.PI / 180;

  /* ------------------------------------------------------------------ noise */
  function hash3(x, y, z) {
    var h = (x | 0) * 374761393 + (y | 0) * 668265263 + (z | 0) * 1274126177;
    h = (h ^ (h >>> 13)) >>> 0;
    h = Math.imul(h, 1274126177) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
    return h / 4294967295;
  }

  function vnoise3(x, y, z) {
    var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    var xf = x - xi, yf = y - yi, zf = z - zi;
    var u = xf * xf * (3 - 2 * xf);
    var v = yf * yf * (3 - 2 * yf);
    var w = zf * zf * (3 - 2 * zf);

    var c000 = hash3(xi, yi, zi),         c100 = hash3(xi + 1, yi, zi);
    var c010 = hash3(xi, yi + 1, zi),     c110 = hash3(xi + 1, yi + 1, zi);
    var c001 = hash3(xi, yi, zi + 1),     c101 = hash3(xi + 1, yi, zi + 1);
    var c011 = hash3(xi, yi + 1, zi + 1), c111 = hash3(xi + 1, yi + 1, zi + 1);

    var x00 = c000 + (c100 - c000) * u, x10 = c010 + (c110 - c010) * u;
    var x01 = c001 + (c101 - c001) * u, x11 = c011 + (c111 - c011) * u;
    var y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
    return y0 + (y1 - y0) * w;
  }

  function fbm(x, y, z, oct, lac, gain) {
    var a = 0.5, f = 1, sum = 0, norm = 0;
    for (var i = 0; i < oct; i++) {
      sum += a * vnoise3(x * f, y * f, z * f);
      norm += a; a *= gain; f *= lac;
    }
    return sum / norm;
  }

  function ridged(x, y, z, oct, lac, gain) {
    var a = 0.5, f = 1, sum = 0, norm = 0;
    for (var i = 0; i < oct; i++) {
      var n = 1 - Math.abs(vnoise3(x * f, y * f, z * f) * 2 - 1);
      sum += a * n * n; norm += a; a *= gain; f *= lac;
    }
    return sum / norm;
  }

  /* -------------------------------------------------------------- utilities */
  function mix(a, b, t) { return a + (b - a) * t; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smoothstep(e0, e1, x) {
    var t = clamp01((x - e0) / (e1 - e0));
    return t * t * (3 - 2 * t);
  }
  function hex(h) {
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }

  /* Sample an equirectangular pixel -> 3D direction on the sphere.
     Returns scratch-friendly values through the module-level object.       */
  function dirOf(u, v) {
    var lon = u * Math.PI * 2;
    var lat = (0.5 - v) * Math.PI;
    var cl = Math.cos(lat);
    return [cl * Math.cos(lon), Math.sin(lat), cl * Math.sin(lon)];
  }

  /* --------------------------------------------------------------- job list */
  /* Each job fills a band of rows per frame; `rows` advances until done.     */

  function SphereJob(w, h, fn) {
    this.w = w; this.h = h;
    this.canvas = document.createElement('canvas');
    this.canvas.width = w; this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: false });
    this.img = this.ctx.createImageData(w, h);
    this.data = this.img.data;
    this.fn = fn;
    this.y0 = 0;
    this.done = false;
  }
  SphereJob.prototype.step = function (rows) {
    var end = Math.min(this.h, this.y0 + rows);
    var d = this.data, w = this.w, fn = this.fn;
    for (var y = this.y0; y < end; y++) {
      var v = (y + 0.5) / this.h;
      var base = y * w * 4;
      for (var x = 0; x < w; x++) {
        var u = (x + 0.5) / w;
        var o = base + x * 4;
        fn(u, v, d, o);
      }
    }
    this.y0 = end;
    if (this.y0 >= this.h) {
      this.ctx.putImageData(this.img, 0, 0);
      this.done = true;
    }
    return this.done;
  };

  /* ------------------------------------------------------------- painters  */

  function rocky(cfg) {
    var W = cfg.w || 512, H = cfg.h || 256;
    var low = hex(cfg.low), mid = hex(cfg.mid), hi = hex(cfg.high);
    var crater = cfg.crater ? 1 : 0;
    var fscale = cfg.scale || 2.2;
    return new SphereJob(W, H, function (u, v, d, o) {
      var p = dirOf(u, v);
      var lat = Math.asin(p[1]);                       /* radians */
      var alat = Math.abs(lat) / (Math.PI / 2);

      var n1 = fbm(p[0] * fscale, p[1] * fscale, p[2] * fscale, 4, 2.1, 0.52);
      var n2 = ridged(p[0] * fscale * 2.4, p[1] * fscale * 2.4, p[2] * fscale * 2.4, 3, 2.2, 0.5);
      var t = clamp01(n1 * 0.75 + n2 * 0.25);
      var w = clamp01(n2 * 0.8 + n1 * 0.2);

      var r, g, b;
      var s = smoothstep(0.34, 0.72, t);
      r = mix(low[0], mid[0], s); g = mix(low[1], mid[1], s); b = mix(low[2], mid[2], s);
      var s2 = smoothstep(0.55, 0.88, t);
      r = mix(r, hi[0], s2); g = mix(g, hi[1], s2); b = mix(b, hi[2], s2);

      if (crater) {
        var c = Math.pow(clamp01(1 - Math.abs(n2 - 0.62) * 6.5), 3) *
                (vnoise3(p[0] * 14, p[1] * 14, p[2] * 14) > 0.55 ? 1 : 0);
        var lift = c * 26;
        r += lift; g += lift * 0.96; b += lift * 0.9;
        var rim = Math.pow(clamp01(1 - Math.abs(n2 - 0.78) * 9), 4) * 20;
        r -= rim * 0.5; g -= rim * 0.5; b -= rim * 0.45;
      }

      /* brightening toward the sub-solar point: rough surfaces scatter more
         when lit near-normal, which is what real airless bodies do          */
      var lam = clamp01(0.5 + 0.5 * p[1]);
      var scatter = 0.72 + 0.28 * lam * (0.5 + 0.5 * w);
      r *= scatter; g *= scatter; b *= scatter;

      d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
    });
  }

  function banded(cfg) {
    var W = cfg.w || 576, H = cfg.h || 288;
    var stops = cfg.stops;                     /* [[lat°, hex], ...] sorted  */
    var warp = cfg.warp === undefined ? 0.28 : cfg.warp;
    var fscale = cfg.scale || 1.7;
    var oct = cfg.oct || 5;
    var swirl = cfg.swirl || 0;
    var spots = cfg.spots || [];
    var hexes = stops.map(function (s) { return hex(s[1]); });

    function bandColour(latDeg) {
      var t = latDeg;
      for (var i = 0; i < stops.length - 1; i++) {
        var a = stops[i][0], b = stops[i + 1][0];
        if (t >= a && t <= b) {
          var k = smoothstep(0, 1, (t - a) / (b - a));
          return [mix(hexes[i][0], hexes[i + 1][0], k),
                  mix(hexes[i][1], hexes[i + 1][1], k),
                  mix(hexes[i][2], hexes[i + 1][2], k)];
        }
      }
      return t < stops[0][0] ? hexes[0] : hexes[hexes.length - 1];
    }

    return new SphereJob(W, H, function (u, v, d, o) {
      var p = dirOf(u, v);
      var latDeg = Math.asin(p[1]) / (Math.PI / 2) * 90;

      /* the jets are faster at the equator, so noise is stretched in
         longitude as the latitude falls away from it */
      var stretch = 1 / Math.max(0.16, Math.cos(latDeg / 90 * Math.PI / 2));
      var q0 = p[0] * fscale * stretch, q1 = p[1] * fscale, q2 = p[2] * fscale * stretch;

      var w1 = (fbm(q0 * 0.9, q1 * 5.5, q2 * 0.9, oct, 2.0, 0.55) - 0.5) * warp;
      var w2 = (fbm(q0 * 3.1 + 11, q1 * 9, q2 * 3.1, 3, 2.3, 0.5) - 0.5) * warp * 0.42;
      if (swirl) {
        var ang = swirl * (fbm(q0 * 1.4, q1 * 3, q2 * 1.4, 3, 2, 0.5) - 0.5) * 2;
        var ca = Math.cos(ang), sa = Math.sin(ang);
        var rx = q0 * ca - q2 * sa;
        q2 = q0 * sa + q2 * ca; q0 = rx;
      }

      var latw = latDeg + (w1 + w2) * 26;
      var col = bandColour(latw);

      /* fine turbulence modulating lightness, never hue — reuse the second
         warp field rather than paying for a third full evaluation. Capped at
         1.0 so pale gas giants do not clip to white in their albedo map. */
      var lum = 0.80 + 0.20 * clamp01(w2 / (warp * 0.42 || 1) * 0.5 + 0.5);

      /* polar hoods */
      var alat = Math.abs(latDeg) / 90;
      if (cfg.polar) {
        var hood = smoothstep(0.72, 0.99, alat);
        var pc = hex(cfg.polar);
        col = [mix(col[0], pc[0], hood * 0.85),
               mix(col[1], pc[1], hood * 0.85),
               mix(col[2], pc[2], hood * 0.85)];
      }

      /* anticyclonic ovals */
      for (var i = 0; i < spots.length; i++) {
        var s = spots[i];
        var sx = p[0] - s.x, sy = p[1] - s.y, sz = p[2] - s.z;
        var dd = Math.sqrt(sx * sx + sy * sy + sz * sz);
        if (dd >= s.r) continue;
        var rad = 1 - smoothstep(s.r * 0.55, s.r, dd);
        var k = rad * (s.a === undefined ? 0.9 : s.a);
        col = [mix(col[0], s.c[0], k), mix(col[1], s.c[1], k), mix(col[2], s.c[2], k)];
      }

      d[o] = clamp01(col[0] * lum / 255) * 255;
      d[o + 1] = clamp01(col[1] * lum / 255) * 255;
      d[o + 2] = clamp01(col[2] * lum / 255) * 255;
      d[o + 3] = 255;
    });
  }

  /* Earth: separate surface, cloud and night-lights maps so the renderer can
     rotate the cloud deck independently and light the dark side.            */
  function earthSurface(cfg) {
    var W = 512, H = 256;
    var deep = hex('#062a52'), shallow = hex('#0f5f8c'), shelf = hex('#1d86a8');
    var sand = hex('#9c8a54'), grass = hex('#33633a'), forest = hex('#20482c');
    var rock = hex('#6b6455'), ice = hex('#e8eef2'), snow = hex('#f4f7f9');
    return new SphereJob(W, H, function (u, v, d, o) {
      var p = dirOf(u, v);
      var lat = Math.asin(p[1]);
      var latDeg = lat / (Math.PI / 2) * 90;
      var alat = Math.abs(latDeg);

      /* continents: warped fBm thresholded against a latitude-varying sea level
         so the tropics stay wet and the subtropics go arid                    */
      var wx = fbm(p[0] * 1.5 + 3.2, p[1] * 1.5, p[2] * 1.5, 2, 2, 0.5) - 0.5;
      var wy = fbm(p[0] * 1.5, p[1] * 1.5 + 7.7, p[2] * 1.5, 2, 2, 0.5) - 0.5;
      var cont = fbm(p[0] * 1.35 + wx * 0.7, p[1] * 1.35 + wy * 0.7, p[2] * 1.35, 5, 2.05, 0.52);
      var seaLevel = 0.5 + 0.055 * Math.cos(lat * 2.0) - 0.02 * alat / 90;
      var isLand = cont > seaLevel;
      var h = (cont - seaLevel) / 0.5;

      var r, g, b;
      if (!isLand) {
        var dep = smoothstep(seaLevel, seaLevel - 0.16, cont);
        var sh = smoothstep(seaLevel - 0.02, seaLevel - 0.09, cont);
        r = mix(shallow[0], deep[0], dep); g = mix(shallow[1], deep[1], dep); b = mix(shallow[2], deep[2], dep);
        var shf = smoothstep(seaLevel - 0.005, seaLevel, cont);
        r = mix(r, shelf[0], shf * 0.5); g = mix(g, shelf[1], shf * 0.5); b = mix(b, shelf[2], shf * 0.5);
      } else {
        var arid = smoothstep(0.55, 0.9, Math.abs(latDeg) / 30) * smoothstep(0.25, 0.6, 1 - cont * 1.4);
        var detail = fbm(p[0] * 9, p[1] * 9, p[2] * 9, 4, 2.2, 0.5);
        var greenT = clamp01(0.45 + detail * 0.7 - alat / 90 * 0.9);
        r = mix(sand[0], grass[0], greenT); g = mix(sand[1], grass[1], greenT); b = mix(sand[2], grass[2], greenT);
        var dark = smoothstep(0.55, 0.85, detail);
        r = mix(r, forest[0], dark * 0.7); g = mix(g, forest[1], dark * 0.7); b = mix(b, forest[2], dark * 0.7);
        r = mix(r, sand[0], arid * 0.85); g = mix(g, sand[1], arid * 0.85); b = mix(b, sand[2], arid * 0.85);
        var mountains = Math.pow(clamp01(ridged(p[0] * 7, p[1] * 7, p[2] * 7, 3, 2.3, 0.5) - 0.45) * 2.6, 2) *
                        smoothstep(0.02, 0.16, h);
        r = mix(r, rock[0], mountains); g = mix(g, rock[1], mountains); b = mix(b, rock[2], mountains);
        var beach = smoothstep(0.0, 0.02, h) * 0.35;
        r = mix(r, sand[0] * 1.1, beach); g = mix(g, sand[1] * 1.1, beach); b = mix(b, sand[2] * 1.1, beach);
      }

      /* cryosphere: sea ice then land snow, permanent above ~66 deg latitude  */
      var iceLine = 66 - 22 * smoothstep(0.1, 0.55, h);
      var icy = smoothstep(iceLine - 6, iceLine + 8, alat);
      var snowCover = clamp01(icy * (isLand ? 1 : smoothstep(iceLine + 14, iceLine + 1, alat)));
      var iceCol = h > 0.25 ? snow : ice;
      r = mix(r, iceCol[0], snowCover); g = mix(g, iceCol[1], snowCover); b = mix(b, iceCol[2], snowCover);

      d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
    });
  }

  function clouds() {
    var W = 448, H = 224;
    return new SphereJob(W, H, function (u, v, d, o) {
      var p = dirOf(u, v);
      var latDeg = Math.asin(p[1]) / (Math.PI / 2) * 90;
      var alat = Math.abs(latDeg);

      var wx = fbm(p[0] * 1.8, p[1] * 1.8, p[2] * 1.8, 2, 2, 0.5) - 0.5;
      var n = fbm(p[0] * 2.4 + wx * 1.4, p[1] * 2.4, p[2] * 2.4 + wx * 1.4, 5, 2.15, 0.52);
      var n2 = ridged(p[0] * 5, p[1] * 5, p[2] * 5, 3, 2.2, 0.5);

      /* the ITCZ and the mid-latitude storm tracks carry most of the cloud */
      var belt = 0.52
        + 0.14 * Math.exp(-Math.pow((alat - 4) / 9, 2))
        + 0.13 * Math.exp(-Math.pow((alat - 52) / 16, 2))
        - 0.18 * Math.exp(-Math.pow((alat - 26) / 9, 2));

      d[o] = 255; d[o + 1] = 255; d[o + 2] = 255;
      d[o + 3] = clamp01(smoothstep(belt, belt + 0.16, n * 0.78 + n2 * 0.22) * 1.15) * 226;
    });
  }

  function cityLights() {
    var W = 448, H = 224;
    var clusters = [];
    var i, a;
    /* Rough population centres, weighted by real megacity regions: the point is
       a plausible night side, not a census. */
    var seeds = [
      [-74, 40.7, 1.0], [-87, 41.9, 0.7], [-118, 34, 0.8], [-95, 30, 0.7],
      [-99, 19, 0.9], [-46, -23, 0.8], [-58, -34, 0.6], [-3, 51, 0.7],
      [2.3, 48.9, 0.7], [13.4, 52.5, 0.6], [31.2, 30, 0.8], [37.6, 55.8, 0.7],
      [72.9, 19.1, 0.9], [77.2, 28.6, 0.9], [90.4, 23.8, 0.8], [100.5, 13.8, 0.7],
      [103.8, 1.3, 0.6], [116.4, 39.9, 0.9], [121.5, 31.2, 0.9], [114.2, 22.3, 0.8],
      [139.7, 35.7, 0.9], [135.5, 34.7, 0.8], [127, 37.6, 0.8], [151.2, -33.9, 0.6],
      [28, -26.2, 0.7], [18.4, -33.9, 0.5], [3.4, 6.5, 0.6], [-7.6, 33.6, 0.5],
      [-43.2, -22.9, 0.7], [-56.2, -34.9, 0.4], [-70.6, -33.4, 0.5], [-75, 40, 0.5]
    ];
    for (i = 0; i < seeds.length; i++) {
      var s = seeds[i];
      var lon = s[0] * Math.PI / 180, lt = s[1] * Math.PI / 180;
      var cl = Math.cos(lt);
      var n = 26 + (s[2] * 90) | 0;
      for (var k = 0; k < n; k++) {
        a = hash3(i * 131 + k, 7, 3) * Math.PI * 2;
        var rad = Math.pow(hash3(i * 17 + k, 3, 11), 2.1) * s[2] * 0.42;
        var dlon = Math.cos(a) * rad / Math.max(0.2, cl);
        var dlat = Math.sin(a) * rad;
        var lo = lon + dlon, la = lt + dlat;
        var c2 = Math.cos(la);
        clusters.push([c2 * Math.cos(lo), Math.sin(la), c2 * Math.sin(lo),
                       0.25 + hash3(k, i, 5) * 0.75 * s[2]]);
      }
    }
    /* broad faint glow so populated corridors read at low zoom */
    return new SphereJob(W, H, function (u, v, d, o) {
      var p = dirOf(u, v);
      var glow = 0, bright = 0;
      for (var i2 = 0; i2 < clusters.length; i2++) {
        var c = clusters[i2];
        var dx = p[0] - c[0], dy = p[1] - c[1], dz = p[2] - c[2];
        var dd = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dd < 0.006) {
          var core = 1 - dd / 0.006;
          glow += core * core * c[3] * 190;
          bright = Math.max(bright, core * c[3]);
        }
      }
      glow = Math.min(255, glow);
      d[o] = 255;
      d[o + 1] = 214 - glow * 0.16;
      d[o + 2] = 150 - glow * 0.32;
      d[o + 3] = glow;
    });
  }

  function sunDisc() {
    var W = 512, H = 256;
    return new SphereJob(W, H, function (u, v, d, o) {
      var p = dirOf(u, v);
      var gran = fbm(p[0] * 26, p[1] * 26, p[2] * 26, 5, 2.1, 0.55);
      var supergran = fbm(p[0] * 7, p[1] * 7, p[2] * 7, 3, 2, 0.5);
      var fac = clamp01(gran * 0.7 + supergran * 0.3);

      /* faculae bright, plage dark */
      var t = fac;
      var r = mix(255, 255, t);
      var g = mix(196, 250, t);
      var b = mix(96, 208, t);

      /* sunspots in the active latitudes only */
      var latDeg = Math.asin(p[1]) / (Math.PI / 2) * 90;
      var belt = Math.exp(-Math.pow((Math.abs(latDeg) - 18) / 13, 2));
      var spotN = fbm(p[0] * 9 + 31, p[1] * 9, p[2] * 9, 4, 2.2, 0.5);
      var sp = smoothstep(0.66, 0.80, spotN) * belt;
      if (sp > 0) {
        var k = sp * 0.86;
        r = mix(r, 128, k); g = mix(g, 58, k); b = mix(b, 22, k);
      }
      /* limb darkening, baked in — the renderer adds the rim glow */
      var mu = clamp01(p[1] * 0.5 + 0.5);
      var limb = 0.62 + 0.38 * Math.pow(mu, 0.55);
      d[o] = r * limb; d[o + 1] = g * limb; d[o + 2] = b * limb; d[o + 3] = 255;
    });
  }

  /* ------------------------------------------------------------- galaxy
     A band map: the vertical axis is galactic latitude, the horizontal axis
     galactic longitude. Stretched across the frame it reads as the Milky Way
     rather than as a map. The bright bulge sits at galactic longitude 0,
     which is the direction of the centre of our galaxy, and the dust lanes
     cut through it. Generated in the same time-sliced queue as the planets
     so it never blocks the first paint.                                   */
  function galaxy() {
    var W = 1024, H = 384;
    return new SphereJob(W, H, function (u, v, d, o) {
      var b = (0.5 - v) * 180;                      /* galactic latitude, deg */
      var l = u * 360;                              /* galactic longitude    */
      var ab = Math.abs(b);

      /* a thin disc seen edge-on, so the surface brightness piles up near b=0 */
      var disc = Math.exp(-Math.pow(ab / 11, 2)) * 0.66
               + Math.exp(-Math.pow(ab / 26, 2)) * 0.38
               + Math.exp(-Math.pow(ab / 54, 2)) * 0.16;
      /* the bulge: a bright knot toward the galactic centre */
      var dl = Math.abs(wrap180(l));
      var bulge = Math.exp(-Math.pow(ab / 11, 2)) * Math.exp(-Math.pow(dl / 26, 2)) * 1.15;

      var la = l * Math.PI / 180, ba = b * Math.PI / 180;
      var cl = Math.cos(ba);
      var cloud = fbm(Math.cos(la) * cl * 3.4, Math.sin(ba) * 9, Math.sin(la) * cl * 3.4, 4, 2.2, 0.55);
      var fine = fbm(Math.cos(la) * cl * 11, Math.sin(ba) * 26, Math.sin(la) * cl * 11, 2, 2.3, 0.5);
      var lane = smoothstep(0.24, 0.80, ridged(Math.cos(la) * cl * 5, Math.sin(ba) * 16, Math.sin(la) * cl * 5, 2, 2.2, 0.45));

      var val = (disc + bulge) * (0.74 + 0.44 * cloud) * (0.88 + 0.22 * fine);
      val *= (1 - lane * 0.30 * Math.exp(-Math.pow(ab / 5.5, 2)));   /* dust lane */
      val = clamp01(val * 1.15);

      /* unresolved starlight is warm cream; the bulge is warmer still */
      var warm = clamp01(bulge * 0.9);
      d[o] = (196 + 52 * warm) * val;
      d[o + 1] = (192 + 34 * warm) * val;
      d[o + 2] = (188 - 34 * warm) * val;
      d[o + 3] = Math.pow(val, 1.9) * 214;
    });
  }
  function wrap180(x) { x = x % 360; return x > 180 ? x - 360 : x; }

  /* ---------------------------------------------------------- Saturn's rings
     A 1-D radial map across the ring plane, from inner edge to outer edge.
     Real radii in Saturn radii: D 1.11-1.236, C 1.239-1.527, B 1.527-1.951,
     Cassini 1.951-2.025, A 2.025-2.27, F 2.324. Structure and gaps are real. */
  function ringProfile(kind) {
    var N = 1024;
    var inner = kind === 'faint' ? 1.64 : 1.11;
    var outer = kind === 'faint' ? 2.00 : 2.33;
    var cv = document.createElement('canvas');
    cv.width = N; cv.height = 1;
    var cx = cv.getContext('2d');
    var img = cx.createImageData(N, 1);
    var dd = img.data;

    function band(r, a, t) {
      var x = Math.floor((r - inner) / (outer - inner) * N);
      if (x < 0 || x >= N) return;
      var f = kind === 'faint' ? t : 0.6 + 0.4 * t;
      dd[x * 4] = 255 * (0.82 + 0.18 * t);
      dd[x * 4 + 1] = 238 * (0.80 + 0.20 * t);
      dd[x * 4 + 2] = 206 * (0.74 + 0.26 * t);
      dd[x * 4 + 3] = 255 * a * f;
    }

    for (var i = 0; i < N; i++) {
      var r = inner + (outer - inner) * (i + 0.5) / N;
      var a = 0;
      if (r < 1.11) a = 0;
      else if (r < 1.236) a = 0.22;                        /* D ring, faint */
      else if (r < 1.527) a = 0.30 + 0.16 * (r - 1.239) / 0.288;   /* C ring */
      else if (r < 1.950) a = 0.92;                         /* B ring, dense */
      else if (r < 2.025) a = 0.06;                         /* Cassini division */
      else if (r < 2.267) a = 0.66;                         /* A ring */
      else if (r < 2.275) a = 0.10;                         /* Encke gap */
      else if (r < 2.320) a = 0.20;                         /* Roche/Keeler */
      else if (r < 2.329) a = 0.30;                         /* F ring, narrow */

      /* fine ringlet structure */
      var fine = 0.5 + 0.5 * Math.sin(r * 260) * Math.sin(r * 91.7 + 1.3);
      var med = 0.5 + 0.5 * Math.sin(r * 47 + 0.6);
      a *= 0.72 + 0.34 * fine + 0.16 * med;
      if (kind === 'faint') a *= 0.30;
      dd[i * 4] = 255 * (0.84 + 0.16 * fine);
      dd[i * 4 + 1] = 240 * (0.82 + 0.18 * fine);
      dd[i * 4 + 2] = 210 * (0.76 + 0.24 * fine);
      dd[i * 4 + 3] = Math.max(0, Math.min(255, a * 255));
    }
    cx.putImageData(img, 0, 0);
    /* the radius span the profile covers, so callers can map a drawn ring
       radius back onto the right column of the map */
    return { canvas: cv, inner: inner, outer: outer };
  }

  /* ------------------------------------------------------------- registry  */
  var RECIPES = {
    sun:     function () { return sunDisc(); },
    mercury: function () { return rocky({ low: '#40392f', mid: '#7d7466', high: '#b9ad9c', crater: 1, scale: 2.6 }); },
    venus:   function () { return banded({
                    stops: [[-90, '#d8b878'], [-40, '#e8cf9c'], [0, '#f2e0b4'], [40, '#e8cf9c'], [90, '#d0ae6c']],
                    warp: 0.5, scale: 1.5, oct: 6, swirl: 0.5, polar: '#c8a463' }); },
    earth:   function () { return earthSurface({}); },
    clouds:  function () { return clouds(); },
    lights:  function () { return cityLights(); },
    mars:    function () { return rocky({ low: '#5a2415', mid: '#a8462a', high: '#d98a52', crater: 1, scale: 2.1 }); },
    jupiter: function () { return banded({
                    stops: [[-90, '#8a7a5f'], [-62, '#b09377'], [-44, '#e2d3b4'], [-30, '#f0e5cc'],
                            [-16, '#c9a97e'], [-4, '#e8dcc0'], [8, '#a97f56'], [20, '#efe4c9'],
                            [34, '#c1a179'], [48, '#e6dbc0'], [64, '#a89070'], [90, '#7d6f57']],
                    warp: 0.42, scale: 1.5, oct: 6, swirl: 0.35, polar: '#8d7f66',
                    spots: [{ x: 0.62, y: -0.31, z: 0.72, r: 0.20, c: [193, 97, 60], a: 0.88 },
                            { x: -0.55, y: 0.18, z: 0.81, r: 0.09, c: [240, 232, 210], a: 0.7 }] }); },
    saturn:  function () { return banded({
                    stops: [[-90, '#a3906a'], [-46, '#cdb88a'], [-22, '#efdfb4'], [-6, '#f7ecd0'],
                            [8, '#ddc79a'], [24, '#f2e5c0'], [42, '#d8c096'], [64, '#b7a179'], [90, '#93825e']],
                    warp: 0.22, scale: 1.35, oct: 6, swirl: 0.12, polar: '#8f8368' }); },
    uranus:  function () { return banded({
                    stops: [[-90, '#a9e3e8'], [-40, '#bdeaf0'], [0, '#a8e2ea'], [40, '#bdeaf0'], [90, '#a9e3e8']],
                    warp: 0.09, scale: 1.2, oct: 5, swirl: 0, polar: '#c8f0f4' }); },
    neptune: function () { return banded({
                    stops: [[-90, '#2a4a9e'], [-38, '#3d68c4'], [-8, '#4d7fe0'], [18, '#3a63bd'],
                            [44, '#507fdc'], [70, '#2e4f9f'], [90, '#22408c']],
                    warp: 0.3, scale: 1.5, oct: 6, swirl: 0.28, polar: '#3d68c4',
                    spots: [{ x: 0.55, y: -0.36, z: 0.75, r: 0.15, c: [24, 44, 110], a: 0.9 },
                            { x: -0.7, y: 0.42, z: 0.58, r: 0.06, c: [236, 244, 255], a: 0.8 }] }); },
    luna:    function () { return rocky({ low: '#3a3733', mid: '#8d8781', high: '#cfc9c0', crater: 1, scale: 2.4 }); },
    moon:    function () { return rocky({ low: '#2e2b27', mid: '#7a746c', high: '#bcb6ac', crater: 1, scale: 2.8 }); },
    io:      function () { return banded({
                    stops: [[-90, '#c9a24a'], [-30, '#e8d67a'], [0, '#f2e08c'], [30, '#d9b95c'], [90, '#a8863c']],
                    warp: 0.5, scale: 2.4, oct: 5, swirl: 0.3 }); },
    europa:  function () { return rocky({ low: '#8d7f6a', mid: '#d8cdb8', high: '#f4efe4', crater: 0, scale: 1.8 }); },
    ganymede:function () { return rocky({ low: '#3a332c', mid: '#7d7266', high: '#b3a898', crater: 1, scale: 2.2 }); },
    callisto:function () { return rocky({ low: '#241d18', mid: '#5c4e42', high: '#8d7c6a', crater: 1, scale: 2.6 }); },
    titan:   function () { return banded({
                    stops: [[-90, '#8a6a3c'], [-30, '#c99a54'], [0, '#e0b268'], [30, '#c99a54'], [90, '#8a6a3c']],
                    warp: 0.34, scale: 1.6, oct: 5, swirl: 0.2 }); },
    rhea:    function () { return rocky({ low: '#4a4741', mid: '#9a958c', high: '#d2cdc4', crater: 1, scale: 2.6 }); },
    phobos:  function () { return rocky({ low: '#221d19', mid: '#4e453c', high: '#776a5d', crater: 1, scale: 3.2 }); },
    deimos:  function () { return rocky({ low: '#2b2622', mid: '#5c5248', high: '#877a6c', crater: 1, scale: 3.2 }); },
    triton: function () { return rocky({ low: '#7a6a72', mid: '#d0c0c4', high: '#f0e6e8', crater: 0, scale: 2.0 }); },
    phobos2: function () { return rocky({ low: '#8a8378', mid: '#cdc4b6', high: '#efe8dc', crater: 1, scale: 2.4 }); },
    generic: function () { return rocky({ low: '#2c2a28', mid: '#6d6763', high: '#a8a29c', crater: 1, scale: 2.2 }); },
    galaxy: function () { return galaxy(); }
  };

  /* --------------------------------------------------------------- manager
     Maps are generated in time-sliced chunks. `request` returns immediately
     and the renderer polls `isReady(id)` each frame.                         */
  var Manager = {
    maps: {},
    pending: {},
    queue: [],
    order: [],
    total: 0,
    built: 0,
    request: function (id, opts) {
      if (this.maps[id] || this.pending[id]) return;
      var make = RECIPES[id] || RECIPES.generic;
      var job = make(opts || {});
      job.key = id;
      this.pending[id] = job;
      this.queue.push(job);
      this.total++;
      this.order.push(id);
    },
    pump: function (ms) {
      var t0 = performance.now(), rows = 20;
      while (this.queue.length && performance.now() - t0 < ms) {
        var job = this.queue[0];
        if (job.step(rows)) {
          this.maps[job.key] = job.canvas;
          delete this.pending[job.key];
          this.queue.shift();
          this.built++;
        }
      }
      return this.queue.length === 0;
    },
    get progress() { return this.total ? this.built / this.total : 1; },
    isReady: function (id) { return !!this.maps[id]; },
    map: function (id) { return this.maps[id] || null; }
  };

  root.ASTRO_TEX = {
    hash3: hash3, vnoise3: vnoise3, fbm: fbm, ridged: ridged,
    mix: mix, clamp01: clamp01, smoothstep: smoothstep, hex: hex, dirOf: dirOf,
    SphereJob: SphereJob, rocky: rocky, banded: banded, clouds: clouds,
    cityLights: cityLights, sunDisc: sunDisc, ringProfile: ringProfile, galaxy: galaxy,
    Manager: Manager
  };
})(window);
