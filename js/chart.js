/* ==========================================================================
   ORRERY — Chart
   Draws a natal wheel from geocentric ecliptic longitudes. Houses are equal
   from the Ascendant (not Placidus) and the caption says so — the positions
   are astronomical, the house system is a declared choice.
   ========================================================================== */
(function (root) {
  'use strict';

  var EPH = root.ASTRO_EPH, DATA = root.ASTRO_DATA;
  var D2R = Math.PI / 180, TAU = Math.PI * 2;
  var Z = DATA.ZODIAC;

  var GLYPH = {
    sun: '☉', moon: '☽', mercury: '☿', venus: '♀', mars: '♂',
    jupiter: '♃', saturn: '♄', uranus: '♅', neptune: '♆', pluto: '♇'
  };
  var ORDER = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

  /* element tints for the sign ring */
  var EL = {
    Fire:  [201, 118, 62],
    Earth: [124, 160, 104],
    Air:   [126, 168, 196],
    Water: [110, 134, 190]
  };

  function rgba(c, a) {
    return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
  }

  /* --------------------------------------------------------- aspects list */
  function aspects(bodies) {
    var out = [], i, j;
    for (i = 0; i < ORDER.length; i++) {
      for (j = i + 1; j < ORDER.length; j++) {
        var a = bodies[ORDER[i]], b = bodies[ORDER[j]];
        if (!a || !b) continue;
        var d = Math.abs(EPH.wrap180(a.lon - b.lon));
        for (var k = 0; k < DATA.ASPECTS.length; k++) {
          var asp = DATA.ASPECTS[k];
          var orb = Math.abs(d - asp.angle);
          /* tighter orbs for the luminaries and for the slower bodies */
          var tight = (ORDER[i] === 'sun' || ORDER[i] === 'moon') ? 1.35 : 1;
          if (asp.angle === 60 || asp.angle === 120) tight *= 0.85;
          if (asp.angle === 0) tight *= 1.25;
          if (orb <= asp.orb * tight) {
            out.push({ a: ORDER[i], b: ORDER[j], asp: asp, exact: asp.angle - d,
                       orb: orb, deg: d });
            break;
          }
        }
      }
    }
    out.sort(function (p, q) { return p.orb - q.orb; });
    return out;
  }

  /* --------------------------------------------------------------- drawing */
  function draw(cv, opts) {
    var dpr = Math.min(root.devicePixelRatio || 1, 2);
    var size = cv.clientWidth || 520;
    cv.width = Math.round(size * dpr);
    cv.height = Math.round(size * dpr);
    var c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, size, size);

    var S = size, cx = S / 2, cy = S / 2;
    var R = S * 0.470;
    var rSignOut = R, rSignIn = R * 0.845;
    var rHouseIn = R * 0.822;
    var rPlanet = R * 0.700;
    var rTick = R * 0.826;
    var rAspect = R * 0.560;

    var asc = opts.asc, bodies = opts.bodies;

    /* screen angle for an ecliptic longitude: Ascendant on the left */
    function ang(lon) { return (180 + (lon - asc)) * D2R; }
    function at(r, a) { return { x: cx + Math.cos(a) * r, y: cy - Math.sin(a) * r }; }

    c.save();

    /* ---- sign ring ---- */
    for (var k = 0; k < 12; k++) {
      var mid = k * 30 + 15;
      var a0 = ang(k * 30), a1 = ang((k + 1) * 30);
      var tint = EL[Z[k].el];
      var p0 = at(rSignOut, a0), p1 = at(rSignOut, a1);
      var p2 = at(rSignIn, a1), p3 = at(rSignIn, a0);
      c.beginPath();
      c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.lineTo(p2.x, p2.y); c.lineTo(p3.x, p3.y);
      c.closePath();
      c.fillStyle = rgba(tint, k % 2 ? 0.055 : 0.028);
      c.fill();
      c.strokeStyle = 'rgba(242,237,227,0.10)';
      c.lineWidth = 1;
      c.stroke();
    }

    /* ---- degree ticks on the inner edge of the ring ---- */
    for (var d = 0; d < 360; d += 5) {
      var major = d % 30 === 0, mid = d % 10 === 0;
      var ad = ang(d);
      var t1 = at(rSignIn, ad), t2 = at(rSignIn - (major ? 11 : mid ? 6 : 3.2), ad);
      c.beginPath();
      c.moveTo(t1.x, t1.y); c.lineTo(t2.x, t2.y);
      c.strokeStyle = major ? 'rgba(217,180,92,0.55)' : 'rgba(242,237,227,0.16)';
      c.lineWidth = major ? 1 : 0.75;
      c.stroke();
    }

    /* ---- sign glyphs + names ---- */
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (var s = 0; s < 12; s++) {
      var ac = ang(s * 30 + 15);
      var gp = at((rSignOut + rSignIn) / 2 + (rSignOut - rSignIn) * 0.16, ac);
      c.font = (S * 0.052) + 'px "Apple Symbols","Segoe UI Symbol",serif';
      c.fillStyle = rgba(EL[Z[s].el], 0.95);
      c.fillText(Z[s].glyph, gp.x, gp.y - S * 0.012);
      var np = at(rSignIn - S * 0.030, ac);
      c.font = '500 ' + (S * 0.0165) + 'px ui-monospace,SFMono-Regular,Menlo,monospace';
      c.fillStyle = 'rgba(242,237,227,0.34)';
      var nm = Z[s].name.toUpperCase();
      c.save();
      c.translate(np.x, np.y);
      c.fillText(nm, 0, 0);
      c.restore();
    }

    /* ---- houses: equal from the Ascendant ---- */
    for (var h = 0; h < 12; h++) {
      var ah = ang(asc + h * 30);
      var q1 = at(rSignIn, ah), q2 = at(rHouseIn, ah);
      c.beginPath();
      c.moveTo(q1.x, q1.y); c.lineTo(q2.x, q2.y);
      c.strokeStyle = h % 3 === 0 ? 'rgba(217,180,92,0.34)' : 'rgba(242,237,227,0.12)';
      c.lineWidth = h % 3 === 0 ? 1.1 : 0.8;
      c.stroke();
      var hp = at(rHouseIn + S * 0.032, ah);
      c.font = '500 ' + (S * 0.0155) + 'px ui-monospace,SFMono-Regular,Menlo,monospace';
      c.fillStyle = h === 0 ? 'rgba(217,180,92,0.95)' : 'rgba(242,237,227,0.30)';
      c.fillText(String(h + 1), hp.x, hp.y);
    }

    /* ---- MC and ASC axes ---- */
    [[opts.mc, 'MC'], [asc, 'ASC']].forEach(function (pair) {
      var aa = ang(pair[0]);
      var m1 = at(rSignOut * 1.012, aa), m2 = at(rAspect * 0.42, aa);
      c.beginPath();
      c.moveTo(m1.x, m1.y); c.lineTo(m2.x, m2.y);
      c.strokeStyle = 'rgba(217,180,92,0.40)';
      c.lineWidth = 1.2;
      c.setLineDash([]);
      c.stroke();
      var lp = at(rSignOut * 1.012, aa);
      c.font = '500 ' + (S * 0.019) + 'px ui-monospace,SFMono-Regular,Menlo,monospace';
      c.fillStyle = 'rgba(217,180,92,0.95)';
      c.save();
      c.translate(lp.x, lp.y);
      c.fillText(pair[1], 0, S * 0.026);
      c.restore();
    });

    /* ---- outer and inner hairlines ---- */
    [[rSignOut, 'rgba(242,237,227,0.20)'], [rSignIn, 'rgba(242,237,227,0.16)'],
     [rHouseIn, 'rgba(242,237,227,0.10)']].forEach(function (p) {
      c.beginPath(); c.arc(cx, cy, p[0], 0, TAU);
      c.strokeStyle = p[1]; c.lineWidth = 1; c.stroke();
    });

    /* ---- aspect lines ---- */
    var asp = aspects(bodies);
    var pos = {};
    ORDER.forEach(function (id) {
      if (bodies[id]) pos[id] = at(rAspect, ang(bodies[id].lon));
    });
    c.save();
    c.lineCap = 'round';
    asp.forEach(function (A) {
      var p1 = pos[A.a], p2 = pos[A.b];
      if (!p1 || !p2) return;
      c.beginPath();
      c.moveTo(p1.x, p1.y); c.lineTo(p2.x, p2.y);
      c.strokeStyle = A.asp.colour;
      c.globalAlpha = Math.max(0.10, 0.42 - A.orb * 0.055);
      c.lineWidth = A.asp.angle === 0 ? 2.2 : (A.asp.angle === 60 ? 0.9 : 1.5);
      if (A.asp.angle === 60) c.setLineDash([3, 3]); else c.setLineDash([]);
      c.stroke();
    });
    c.restore();

    /* ---- planets ---- */
    var placed = [];
    ORDER.forEach(function (id) {
      if (!bodies[id]) return;
      placed.push({ id: id, lon: bodies[id].lon });
    });
    /* simple anti-collision: nudge glyphs apart along the ring */
    placed.sort(function (a, b) { return a.lon - b.lon; });
    for (var i = 0; i < placed.length; i++) {
      for (var j = i + 1; j < placed.length; j++) {
        var dd = placed[j].lon - placed[i].lon;
        if (dd < 5.5) { placed[j].lon += (5.5 - dd) * 0.5; placed[i].lon -= (5.5 - dd) * 0.5; }
      }
    }

    placed.forEach(function (pl) {
      var a = ang(pl.lon), p = at(rPlanet, a);
      var t = at(rTick, a);
      c.beginPath();
      c.moveTo(t.x, t.y);
      c.lineTo(p.x + (p.x - cx) * 0.055, p.y + (p.y - cy) * 0.055);
      c.strokeStyle = 'rgba(217,180,92,0.45)';
      c.lineWidth = 0.9;
      c.stroke();

      var lum = pl.id === 'sun' || pl.id === 'moon';
      c.beginPath();
      c.arc(p.x, p.y, S * (lum ? 0.049 : 0.042), 0, TAU);
      c.fillStyle = lum ? 'rgba(217,180,92,0.16)' : 'rgba(242,237,227,0.07)';
      c.fill();
      c.strokeStyle = lum ? 'rgba(240,215,154,0.55)' : 'rgba(242,237,227,0.20)';
      c.lineWidth = 1;
      c.stroke();

      c.font = (S * 0.040) + 'px "Apple Symbols","Segoe UI Symbol",serif';
      c.fillStyle = lum ? '#f0d79a' : '#f2ede3';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(GLYPH[pl.id], p.x, p.y + S * 0.002);

      var deg = pl.lon - Math.floor(pl.lon / 30) * 30;
      var dp = at(rPlanet - S * 0.062, a);
      c.font = '500 ' + (S * 0.0155) + 'px ui-monospace,SFMono-Regular,Menlo,monospace';
      c.fillStyle = 'rgba(242,237,227,0.42)';
      c.fillText(Math.floor(deg) + '°', dp.x, dp.y);
    });

    /* ---- centre: ascendant degree + sidereal time ---- */
    c.textAlign = 'center';
    var ascSign = Math.floor(asc / 30);
    c.font = '500 ' + (S * 0.018) + 'px ui-monospace,SFMono-Regular,Menlo,monospace';
    c.fillStyle = 'rgba(242,237,227,0.30)';
    c.fillText('ASC', cx, cy - S * 0.052);
    c.font = (S * 0.072) + 'px "Apple Symbols","Segoe UI Symbol",serif';
    c.fillStyle = 'rgba(240,215,154,0.92)';
    c.fillText(Z[ascSign].glyph, cx, cy + S * 0.006);
    c.font = '400 ' + (S * 0.018) + 'px ui-monospace,SFMono-Regular,Menlo,monospace';
    c.fillStyle = 'rgba(242,237,227,0.34)';
    c.fillText(Math.floor(asc % 30) + '° ' + Z[ascSign].name, cx, cy + S * 0.058);

    c.restore();
  }

  /* -------------------------------------------------------------- readout */
  function signOf(lon) {
    var i = Math.floor(EPH.norm360(lon) / 30) % 12;
    var deg = EPH.norm360(lon) - i * 30;
    return { sign: Z[i], deg: deg, text: Z[i].name + ' ' + Math.floor(deg) + '°' + Math.floor((deg % 1) * 60) + '′' };
  }

  function lightTime(au) {
    var m = au * 149597870.7 / 299792.458;
    if (m < 90) return m.toFixed(1) + ' s';
    if (m < 90 * 60) return (m / 60).toFixed(1) + ' min';
    return (m / 3600).toFixed(2) + ' h';
  }

  root.ASTRO_CHART = {
    draw: draw, aspects: aspects, signOf: signOf,
    lightTime: lightTime, GLYPH: GLYPH, ORDER: ORDER
  };
})(window);
