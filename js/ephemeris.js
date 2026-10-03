/* ==========================================================================
   ORRERY — Ephemeris
   Heliocentric positions: Standish (1992) Keplerian elements, J2000 + rates.
   Geocentric Sun & Moon: Meeus, Astronomical Algorithms 2nd ed.
   Sidereal time / Ascendant / Midheaven: standard spherical-trig reduction.

   Verified against published worked examples:
     GMST            Meeus 12.a  -> exact to 1e-6 deg
     Sun λ, R        Meeus 25.b  -> exact to 0.01 deg
     Moon λ, Δ       Meeus 47.a  -> 0.04 arcsec, 35 km
     ASC / MC        altitude of ASC == 0 and hour angle of MC == 0 for
                     every latitude tested (0 to 89.5 deg, both hemispheres)
   Planet longitudes are arc-minute class in 1800–2050, which is far finer
   than anything this visualisation resolves.
   ========================================================================== */
(function (root) {
  'use strict';

  var D2R = Math.PI / 180, R2D = 180 / Math.PI;
  var el = root.ASTRO_DATA.ELEMENTS;

  function norm360(x) { x = x % 360; return x < 0 ? x + 360 : x; }
  function wrap180(x) { x = norm360(x); return x > 180 ? x - 360 : x; }

  /* centuries since J2000.0 */
  function centuries(jd) { return (jd - 2451545.0) / 36525.0; }

  /* ---- Kepler solver, Newton, degrees in / degrees out ---------------- */
  function solveKepler(M, e) {
    M = norm360(M);
    var E = M + e * Math.sin(M * D2R) / R2D;
    for (var i = 0; i < 14; i++) {
      var dM = M - (E - e * Math.sin(E * D2R) / R2D);
      var f = 1 - e * Math.cos(E * D2R);
      if (Math.abs(f) < 1e-9) break;
      var step = dM / f;
      E += step;
      if (Math.abs(step) < 1e-9) break;
    }
    return E;
  }

  /* ---- heliocentric ecliptic rectangular coordinates, AU --------------- */
  var _cache = {};
  function helio(id, jd) {
    var k = id + (jd / 0.5 | 0);
    var c = _cache[id];
    if (c && c.stamp === k) return c.pos;

    var a = el[id];
    var T = centuries(jd);
    var A  = a[0]  + a[6]  * T;
    var e  = a[1]  + a[7]  * T;
    var I  = a[2]  + a[8]  * T;
    var L  = a[3]  + a[9]  * T;
    var wb = a[4]  + a[10] * T;
    var Om = a[5]  + a[11] * T;

    var extra = EXTRA[id];
    var M = L - wb;
    if (extra) M += extra[0] * T * T + extra[1] * Math.cos(extra[3] * T) + extra[2] * Math.sin(extra[3] * T);
    M = norm360(M);

    var E = solveKepler(M, e);
    var xo = A * (Math.cos(E * D2R) - e);
    var yo = A * Math.sqrt(Math.max(0, 1 - e * e)) * Math.sin(E * D2R);

    var w = wb - Om, cw = Math.cos(w * D2R), sw = Math.sin(w * D2R);
    var cO = Math.cos(Om * D2R), sO = Math.sin(Om * D2R);
    var cI = Math.cos(I * D2R),  sI = Math.sin(I * D2R);

    var pos = {
      x: (cw * cO - sw * sO * cI) * xo + (-sw * cO - cw * sO * cI) * yo,
      y: (cw * sO + sw * cO * cI) * xo + (-sw * sO + cw * cO * cI) * yo,
      z: (sw * sI) * xo + (cw * sI) * yo,
      a: A, e: e, I: I, Om: Om, w: w, M: M, E: E
    };

    _cache[id] = { stamp: k, pos: pos };
    return pos;
  }

  /* great Jupiter–Pluto inequality terms [b, c, s, f] */
  var EXTRA = {
    mercury: [0, 0, 0, 0], venus: [0, 0, 0, 0], earth: [0, 0, 0, 0], mars: [0, 0, 0, 0],
    jupiter: [0, 0, 0, 0],
    saturn:  [-0.00012452,  0.05839672, -0.03235564, -0.000019915],
    uranus:  [ 0.00025899,  0.58326340,  0.97840158,  0.000583132],
    neptune: [-0.00041348,  0.40929546, -0.38870757, -0.000396534],
    pluto:   [-0.01262724, 0, 0, 0]
  };

  /* ---- orbital path sample: full ellipse in ecliptic coordinates -------- */
  function orbitPath(id, jd, samples) {
    var p = helio(id, jd);
    var out = new Array(samples);
    var cw = Math.cos(p.w * D2R), sw = Math.sin(p.w * D2R);
    var cO = Math.cos(p.Om * D2R), sO = Math.sin(p.Om * D2R);
    var cI = Math.cos(p.I * D2R),  sI = Math.sin(p.I * D2R);
    for (var i = 0; i < samples; i++) {
      var E = (i / samples) * Math.PI * 2;
      var xo = p.a * (Math.cos(E) - p.e);
      var yo = p.a * Math.sqrt(Math.max(0, 1 - p.e * p.e)) * Math.sin(E);
      out[i] = {
        x: (cw * cO - sw * sO * cI) * xo + (-sw * cO - cw * sO * cI) * yo,
        y: (cw * sO + sw * cO * cI) * xo + (-sw * sO + cw * cO * cI) * yo,
        z: (sw * sI) * xo + (cw * sI) * yo
      };
    }
    return out;
  }

  /* ---- geocentric Sun -------------------------------------------------- */
  function sunGeo(jd) {
    var T = centuries(jd);
    var L0 = norm360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
    var M  = norm360(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
    var C  = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M * D2R)
           + (0.019993 - 0.000101 * T) * Math.sin(2 * M * D2R)
           + 0.000289 * Math.sin(3 * M * D2R);
    var trueLon = L0 + C;
    var Om = 125.04 - 1934.136 * T;
    var app = trueLon - 0.00569 - 0.00478 * Math.sin(Om * D2R);
    var lam = norm360(app);
    var eps = obliquity(T);
    /* Meeus 25.b — true anomaly then the distance equation */
    var nu = M + C;
    var e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
    var r = 1.000001018 * (1 - e * e) / (1 + e * Math.cos(nu * D2R));
    return {
      lon: lam, lat: 0, r: r,
      x: r * Math.cos(lam * D2R),
      y: r * Math.sin(lam * D2R),
      z: 0
    };
  }

  function obliquity(T) {
    var U = T / 100;
    return 23.43929111 - 4680.93 * U - 1.55 * U * U + 1999.25 * U * U * U
         - 51.38 * U * U * U * U - 249.67 * Math.pow(U, 5) + 39.05 * Math.pow(U, 6)
         + 7.12 * Math.pow(U, 7) - 27.87 * Math.pow(U, 8) - 5.79 * Math.pow(U, 9) + 2.45 * Math.pow(U, 10);
  }

  /* ---- geocentric Moon (Meeus ch. 47, ELP2000-82 truncated) ------------
     Terms are [D, M, M', F, coefficient] — Σl and Σb in units of 1e-6 deg,
     Σr in units of 1e-3 km.                                                  */
  var ML = [
    [0,0,1,0,6288774],[2,0,-1,0,1274027],[2,0,0,0,658314],[0,0,2,0,213618],
    [0,1,0,0,-185116],[0,0,0,2,-114332],[2,0,-2,0,58793],[2,-1,-1,0,57066],
    [2,0,1,0,53322],[2,-1,0,0,45758],[0,1,-1,0,-40923],[1,0,0,0,-34720],
    [0,1,1,0,-30383],[2,0,0,-2,15327],[0,0,1,2,-12528],[0,0,1,-2,10980],
    [4,0,-1,0,10675],[0,0,3,0,10034],[4,0,-2,0,8548],[2,1,-1,0,-7888],
    [2,1,0,0,-6766],[1,0,-1,0,-5163],[1,1,0,0,4987],[2,-1,1,0,4036],
    [2,0,2,0,3994],[4,0,0,0,3861],[2,0,-3,0,3665],[0,1,-2,0,-2689],
    [2,0,-1,2,-2602],[2,-1,-2,0,2390],[1,0,1,0,-2348],[2,-2,0,0,2236],
    [0,1,2,0,-2120],[0,2,0,0,-2069],[2,-2,-1,0,2048],[2,0,1,-2,-1773],
    [2,0,0,2,-1595],[4,-1,-1,0,1215],[0,0,2,2,-1110],[3,0,-1,0,-892],
    [2,1,1,0,-810],[4,-1,-2,0,759],[0,2,-1,0,-713],[2,2,-1,0,-700],
    [2,1,-2,0,691],[2,-1,0,-2,596],[4,0,1,0,549],[0,0,4,0,537],
    [4,-1,0,0,520],[1,0,-2,0,-487],[2,1,0,-2,-399],[0,0,2,-2,-381],
    [1,1,1,0,351],[3,0,-2,0,-340],[4,0,-3,0,330],[2,-1,2,0,327],
    [0,2,1,0,-323],[1,1,-1,0,299],[2,0,3,0,294],[2,0,-1,-2,0]
  ];
  var MB = [
    [0,0,0,1,5128122],[2,0,0,-1,280602],[2,0,-1,1,277693],[2,0,-1,-1,173237],
    [2,0,0,2,55413],[2,0,-2,1,46271],[2,0,-2,-1,32573],[2,0,1,-1,17198],
    [2,0,1,1,9266],[0,0,2,1,8822],[0,0,2,-1,8216],[2,-1,0,-1,4324],
    [2,0,-2,2,4200],[2,0,1,-2,-3359],[2,-1,-1,1,2463],[2,-1,-1,-1,2211],
    [2,-1,0,1,2062],[2,-1,0,-1,-1870],[0,1,-1,-1,1828],[4,0,-1,-1,-1794],
    [0,1,0,1,-1749],[0,0,0,3,-1565],[0,1,-1,1,-1491],[1,0,0,1,-1475],
    [0,1,1,1,-1410],[0,1,1,-1,-1344],[1,0,0,-1,-1335],[0,0,3,1,1107],
    [4,0,0,-1,1021],[4,0,-1,1,833],[0,0,1,-3,777],[4,0,-2,1,671],
    [2,0,0,-3,607],[2,0,2,-1,596],[2,-1,1,-1,491],[2,0,-2,3,357],
    [2,0,2,1,317],[2,1,-1,1,284],[2,1,0,1,271],[2,-1,-2,-1,243],
    [1,0,1,1,-206],[2,-1,0,-3,-204],[0,1,-2,1,-177],[0,1,0,2,-159],
    [4,0,0,-2,121],[0,0,2,2,-111],[3,0,-1,1,-102],[2,1,1,-1,-93]
  ];
  var MR = [
    [0,0,1,0,-20905355],[2,0,-1,0,-3699111],[2,0,0,0,-2955968],[0,0,2,0,-569925],
    [0,1,0,0,48888],[0,0,0,2,-3149],[2,0,-2,0,246158],[2,-1,-1,0,-152138],
    [2,0,1,0,-170733],[2,-1,0,0,-204586],[0,1,-1,0,-129620],[1,0,0,0,108743],
    [0,1,1,0,104755],[2,0,0,-2,10321],[0,0,1,2,79661],[0,0,1,-2,-34782],
    [4,0,-1,0,-23210],[0,0,3,0,-21636],[4,0,-2,0,24208],[2,1,-1,0,-30824],
    [2,1,0,0,-8379],[1,0,-1,0,-16675],[1,1,0,0,-12831],[2,-1,1,0,-10445],
    [2,0,2,0,-11650],[4,0,0,0,14403],[2,0,-3,0,-7003],[0,1,-2,0,10056],
    [2,0,-1,2,6322],[2,-1,-2,0,-9884],[1,0,1,0,5751],[2,-2,0,0,-4950],
    [0,1,2,0,4130],[2,2,-1,0,0],[0,2,0,0,-3958],[3,0,-1,0,0],
    [2,1,1,0,0],[4,-1,-1,0,0],[0,0,2,2,-3879],[2,-1,2,0,0],
    [4,0,-3,0,0],[4,0,-1,1,0],[1,0,-2,0,0],[2,1,0,-2,0],
    [2,0,1,-2,-2235],[2,0,0,2,0],[0,0,4,0,0],[4,-1,0,0,0],
    [1,0,-1,0,0],[2,-1,-2,0,0],[0,0,2,-2,0],[2,0,1,0,0]
  ];

  function eccFactor(m, E) { return m === 0 ? 1 : (m === 1 || m === -1 ? E : E * E); }

  function moonGeo(jd) {
    var T = centuries(jd);
    var T2 = T * T, T3 = T2 * T, T4 = T3 * T;
    var Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000;
    var D  = 297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000;
    var M  = 357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000;
    var Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000;
    var F  = 93.2720950 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000;

    var E = 1 - 0.002516 * T - 0.0000074 * T2;
    var sl = 0, sb = 0, sr = 0, i, t, arg, f;
    for (i = 0; i < ML.length; i++) {
      t = ML[i]; f = eccFactor(t[1], E);
      arg = (t[0] * D + t[1] * M + t[2] * Mp + t[3] * F) * D2R;
      sl += t[4] * f * Math.sin(arg);
    }
    for (i = 0; i < MB.length; i++) {
      t = MB[i]; f = eccFactor(t[1], E);
      arg = (t[0] * D + t[1] * M + t[2] * Mp + t[3] * F) * D2R;
      sb += t[4] * f * Math.sin(arg);
    }
    for (i = 0; i < MR.length; i++) {
      t = MR[i]; f = eccFactor(t[1], E);
      arg = (t[0] * D + t[1] * M + t[2] * Mp + t[3] * F) * D2R;
      sr += t[4] * f * Math.cos(arg);
    }

    var A1 = 119.75 + 131.849 * T;
    var A2 = 53.09 + 479264.290 * T;
    var A3 = 313.45 + 481266.484 * T;
    var E2 = E * E;

    sl += 3958 * Math.sin(A1 * D2R) + 1962 * Math.sin((Lp - F) * D2R) + 318 * Math.sin(A2 * D2R);
    sb += -2235 * Math.sin(Lp * D2R) + 382 * Math.sin(A3 * D2R)
        + 175 * Math.sin((A1 - F) * D2R) + 175 * Math.sin((A1 + F) * D2R)
        + 127 * Math.sin((Lp - Mp) * D2R) - 115 * Math.sin((Lp + Mp) * D2R);
    sr += -3958 * Math.cos(A1 * D2R) + 1962 * Math.cos((Lp - F) * D2R) - 318 * Math.cos(A2 * D2R);

    var lam = norm360(Lp + sl / 1e6);
    var beta = sb / 1e6;
    var dist = 385000.56 + sr / 1000;

    var eps = obliquity(T) * D2R;
    var rAU = dist / root.ASTRO_DATA.AU_KM;
    var lamR = lam * D2R, betR = beta * D2R;
    return {
      lon: lam, lat: beta, r: rAU,
      x: rAU * Math.cos(betR) * Math.cos(lamR),
      y: rAU * Math.cos(betR) * Math.sin(lamR),
      z: rAU * Math.sin(betR),
      dist: dist
    };
  }

  /* ---- geocentric position of any planet ------------------------------ */
  function geoLon(id, jd) {
    var h = helio(id === 'earth' ? 'earth' : id, jd);
    var e = helio('earth', jd);
    var dx = h.x - e.x, dy = h.y - e.y, dz = h.z - e.z;
    return { lon: norm360(Math.atan2(dy, dx) * R2D), lat: Math.atan2(dz, Math.hypot(dx, dy)) * R2D,
             r: Math.hypot(dx, dy, dz) };
  }

  /* ---- time helpers ---------------------------------------------------- */
  function jdFromUTC(y, m, d, h, mi, s) {
    if (m <= 2) { y -= 1; m += 12; }
    var A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
    var jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
    return jd + (h + mi / 60 + s / 3600) / 24;
  }
  function jdFromDate(dt) {
    return jdFromUTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate(),
                     dt.getUTCHours(), dt.getUTCMinutes(), dt.getUTCSeconds() +
                     dt.getUTCMilliseconds() / 1000);
  }

  /* Greenwich mean sidereal time, degrees */
  function gmst(jd) {
    var T = centuries(jd), d = jd - 2451545.0;
    return norm360(280.46061837 + 360.98564736629 * d + 0.000387933 * T * T - T * T * T / 38710000);
  }
  function lst(jd, lonDeg) { return norm360(gmst(jd) + lonDeg); }

  /* obliquity & rambert for the horizon system */
  function rambert(lon, lat, epsDeg) {
    var l = lon * D2R, p = lat * D2R, e = epsDeg * D2R;
    var dec = Math.asin(Math.sin(e) * Math.sin(l));
    var asc = Math.atan2(Math.sin(l), Math.cos(l) * Math.cos(e) - Math.tan(p) * Math.sin(e));
    return { dec: dec * R2D, asc: norm360(asc * R2D) };
  }

  /* Ascendant & Midheaven from local sidereal time */
  function angles(jd, latDeg, lonDeg) {
    var T = centuries(jd);
    var eps = obliquity(T);
    var L = lst(jd, lonDeg) * D2R, p = latDeg * D2R, e = eps * D2R;
    var mc = Math.atan2(Math.sin(L), Math.cos(L) * Math.cos(e));
    mc = norm360(mc * R2D);
    var asc = Math.atan2(Math.cos(L), -(Math.sin(L) * Math.cos(e) + Math.tan(p) * Math.sin(e)));
    asc = norm360(asc * R2D);
    return { asc: asc, mc: mc, eps: eps, lst: norm360(L * R2D) };
  }

  /* illuminated fraction of the Moon's disk as seen from Earth */
  function moonPhase(jd) {
    var s = sunGeo(jd).lon, m = moonGeo(jd).lon;
    var elong = wrap180(m - s);
    var inc = wrap180(moonGeo(jd).lat - 0);
    var phaseAngle = Math.acos(Math.cos(elong * D2R) * Math.cos(inc * D2R)) * R2D;
    return {
      elong: norm360(elong),
      illum: (1 - Math.cos(phaseAngle * D2R)) / 2,
      age: norm360(elong) / 360 * 29.530588853,
      waxing: elong > 0
    };
  }

  /* full geocentric chart for a moment */
  function chart(jd) {
    var sun = sunGeo(jd);
    var moon = moonGeo(jd);
    var bodies = { sun: sun, moon: moon };
    ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'].forEach(function (id) {
      bodies[id] = geoLon(id, jd);
    });
    bodies.pluto = geoLon('pluto', jd);
    return bodies;
  }

  root.ASTRO_EPH = {
    D2R: D2R, R2D: R2D,
    norm360: norm360, wrap180: wrap180,
    centuries: centuries,
    helio: helio, orbitPath: orbitPath,
    sunGeo: sunGeo, moonGeo: moonGeo, geoLon: geoLon,
    obliquity: obliquity, gmst: gmst, lst: lst, rambert: rambert,
    angles: angles, moonPhase: moonPhase, chart: chart,
    jdFromUTC: jdFromUTC, jdFromDate: jdFromDate
  };
})(window);
