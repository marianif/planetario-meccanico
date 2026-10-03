/* ==========================================================================
   ORRERY — Data layer
   Physical: NASA/JPL planetary fact sheet values (radii, rotation, tilt).
   Orbits:   Standish (1992) Keplerian elements, valid 1800–2050 AD.
   Astro:    Classical + modern rulerships, dignities, modalities, elements.
   ========================================================================== */
(function (root) {
  'use strict';

  /* ---------- orbital elements (a AU, e, I°, L°, longPeri°, longNode°) ----------
     values at J2000 with per-century rates. Additional b,c,s,f terms for the
     outer planets reproduce the great Jupiter–Pluto inequality (Standish).   */
  var ELEMENTS = {
    mercury: [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593,
              0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
    venus:   [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255,
              0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418],
    earth:   [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0,
              0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0],
    mars:    [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891,
              0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
    jupiter: [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909,
              -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
    saturn:  [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448,
              -0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
    uranus:  [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503,
              -0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589],
    neptune: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574,
              0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664],
    pluto:   [39.48211675, 0.24882730, 17.14001206, 238.92903833, 224.06891629, 110.30393684,
              -0.00031596, 0.00005170, 0.00004818, 145.20780515, -0.04062942, -0.01183482]
  };

  /* ---------- 12 signs of the ecliptic ---------- */
  var ZODIAC = [
    { key: 'aries',       glyph: '♈', name: 'Aries',       dates: '21 Mar – 19 Apr', el: 'Fire',   mod: 'Cardinal', polarity: 'Yang',  ruler: 'Mars',       rulerGlyph: '♂', house: 'I',   keyword: 'instinct', line: 'I am' },
    { key: 'taurus',      glyph: '♉', name: 'Taurus',      dates: '20 Apr – 20 May', el: 'Earth',  mod: 'Fixed',    polarity: 'Yin',   ruler: 'Venus',      rulerGlyph: '♀', house: 'II',  keyword: 'devotion', line: 'I have' },
    { key: 'gemini',      glyph: '♊', name: 'Gemini',      dates: '21 May – 20 Jun', el: 'Air',    mod: 'Mutable',  polarity: 'Yang',  ruler: 'Mercury',    rulerGlyph: '☿', house: 'III', keyword: 'curiosity', line: 'I think' },
    { key: 'cancer',      glyph: '♋', name: 'Cancer',      dates: '21 Jun – 22 Jul', el: 'Water',  mod: 'Cardinal', polarity: 'Yin',   ruler: 'Moon',       rulerGlyph: '☽', house: 'IV',  keyword: 'belonging', line: 'I feel' },
    { key: 'leo',         glyph: '♌', name: 'Leo',         dates: '23 Jul – 22 Aug', el: 'Fire',   mod: 'Fixed',    polarity: 'Yang',  ruler: 'Sun',        rulerGlyph: '☉', house: 'V',   keyword: 'radiance', line: 'I will' },
    { key: 'virgo',       glyph: '♍', name: 'Virgo',       dates: '23 Aug – 22 Sep', el: 'Earth',  mod: 'Mutable',  polarity: 'Yin',   ruler: 'Mercury',    rulerGlyph: '☿', house: 'VI',  keyword: 'refinement', line: 'I analyse' },
    { key: 'libra',       glyph: '♎', name: 'Libra',       dates: '23 Sep – 22 Oct', el: 'Air',    mod: 'Cardinal', polarity: 'Yang',  ruler: 'Venus',      rulerGlyph: '♀', house: 'VII', keyword: 'justice', line: 'I relate' },
    { key: 'scorpio',     glyph: '♏', name: 'Scorpio',     dates: '23 Oct – 21 Nov', el: 'Water',  mod: 'Fixed',    polarity: 'Yin',   ruler: 'Pluto / Mars', rulerGlyph: '♇', house: 'VIII', keyword: 'depth', line: 'I desire' },
    { key: 'sagittarius', glyph: '♐', name: 'Sagittarius', dates: '22 Nov – 21 Dec', el: 'Fire',   mod: 'Mutable',  polarity: 'Yang',  ruler: 'Jupiter',    rulerGlyph: '♃', house: 'IX',  keyword: 'meaning', line: 'I know' },
    { key: 'capricorn',   glyph: '♑', name: 'Capricorn',   dates: '22 Dec – 19 Jan', el: 'Earth',  mod: 'Cardinal', polarity: 'Yin',   ruler: 'Saturn',     rulerGlyph: '♄', house: 'X',   keyword: 'ambition', line: 'I achieve' },
    { key: 'aquarius',    glyph: '♒', name: 'Aquarius',    dates: '20 Jan – 18 Feb', el: 'Air',    mod: 'Fixed',    polarity: 'Yang',  ruler: 'Saturn / Uranus', rulerGlyph: '♅', house: 'XI', keyword: 'principle', line: 'I know' },
    { key: 'pisces',      glyph: '♓', name: 'Pisces',      dates: '19 Feb – 20 Mar', el: 'Water',  mod: 'Mutable',  polarity: 'Yin',   ruler: 'Jupiter / Neptune', rulerGlyph: '♆', house: 'XII', keyword: 'surrender', line: 'I believe' }
  ];

  /* ---------- bodies ----------
     rKm        equatorial radius, km
     rot        sidereal rotation, days (negative = retrograde)
     tilt       obliquity to orbit, degrees
     moons      confirmed natural satellites
     temp       mean surface / 1-bar temperature
     mass       10^24 kg
     amp        art-directed texture detail 0..1
  */
  var BODIES = [
    {
      id: 'sun', name: 'Sol', glyph: '☉', kind: 'star', order: 0,
      rKm: 696340, rot: 25.38, tilt: 7.25, moons: null, mass: 1.989e6,
      dist: 0, distLabel: '—', period: '—', temp: '5 500 °C surface · 15.7 M °C core',
      hue: [42, 74, 100],
      tex: 'sun', amp: 1,
      archetype: 'The Sovereign',
      role: 'Gravity · Light · Time',
      sub: 'The only body in this system that makes its own light. Everything else is a lantern.',
      keywords: ['identity', 'vitality', 'will', 'authority', 'the father'],
      gift: 'A steady centre. The capacity to hold a direction long enough to become a person.',
      shadow: 'The need to be seen is mistaken for the need to be whole.',
      rulership: 'nothing — and, in the end, everything',
      domicile: 'Leo · exalted in Aries · fall in Aquarius',
      element: 'Fire by nature', modality: 'Fixed spirit',
      story: [
        'Ninety-nine point eight six percent of every gram in this system is here. The remaining planets are rounding errors orbiting a sphere of plasma four hundred and sixty times wider than Earth.',
        'The light you are reading this by left the surface eight minutes and nineteen seconds ago. It spent a hundred thousand years climbing out of the convection zone first — so the sun you see is a historical document, badly out of date, like every other object here.',
        'Astrologically the Sun is the only planet that rules no sign and is therefore the only one that cannot be blamed for anything. It is the Self itself: the deliberate centre of a life, the father, the king, the thing that must be <em>chosen</em> rather than inherited. Its sign is the one you would pick if you could pick freely.'
      ],
      facts: [
        ['Class', 'G2V main-sequence star'],
        ['Age', '4.603 billion years'],
        ['Luminosity', '3.828 × 10²⁶ W'],
        ['Core fusion', 'H → He, 600 Mt/s'],
        ['Photosphere', '5 772 K'],
        ['Galactic orbit', '~230 million years per lap']
      ]
    },
    {
      id: 'mercury', name: 'Mercury', glyph: '☿', kind: 'planet', order: 1,
      rKm: 2439.7, rot: 58.646, tilt: 0.034, moons: 0, mass: 0.330,
      dist: 0.387, distLabel: '0.387 AU · 57.9 M km', period: '87.97 d', temp: '167 °C mean · 430 to −180 °C',
      hue: [38, 8, 46],
      tex: 'mercury', amp: 0.7,
      archetype: 'The Courier',
      role: 'Signal · Transit · The Trickster',
      sub: 'The smallest world and the fastest. Three orbits for every one of Earth\'s.',
      keywords: ['mind', 'speech', 'curiosity', 'restlessness', 'thievery'],
      gift: 'Reflexes. The ability to hold a great many threads at once and speak before you have decided what you think.',
      shadow: 'Nerves instead of nerve. Thinking as a way of not feeling.',
      rulership: 'Gemini and Virgo',
      domicile: 'Exalted in Virgo · fall in Pisces · detriment in Sagittarius',
      element: 'Air', modality: 'Mutable',
      story: [
        'A world the size of Ganymede with the density of lead, scorched on one side and frozen on the other, locked in a three-to-two spin–orbit resonance so that its day outlasts its year. Nothing else in the system behaves like this.',
        'It is also the only planet with essentially no atmosphere — so there is no sky to speak through, no air to carry a voice, no weather to soften an edge. The metaphor is almost too tidy: the messenger is the one body that has never been heard from.',
        'Mercury is the faculty of the mind in motion. Not thought as storage, thought as <em>traffic</em> — the quick read of a room, the shortcut, the joke that lands, the lie that works. In a natal chart it governs what you can say, who you talk to, and how far your attention roams before it comes home.'
      ],
      facts: [
        ['Orbital period', '87.969 days'],
        ['Rotation', '58.646 d retrograde'],
        ['Axial tilt', '0.034°'],
        ['Surface', 'Heavily cratered, ancient crust'],
        ['Exosphere', 'Na, K, O, H — exosphere only'],
        ['Surface gravity', '3.70 m/s²']
      ]
    },
    {
      id: 'venus', name: 'Venus', glyph: '♀', kind: 'planet', order: 2,
      rKm: 6051.8, rot: -243.025, tilt: 177.36, moons: 0, mass: 4.87,
      dist: 0.723, distLabel: '0.723 AU · 108.2 M km', period: '224.70 d', temp: '464 °C · 92 bar surface',
      hue: [42, 55, 72],
      tex: 'venus', amp: 0.85,
      archetype: 'The Beloved',
      role: 'Attraction · Value · The Veil',
      sub: 'Rotates backwards, once every 243 days. Its day is longer than its year.',
      keywords: ['love', 'beauty', 'value', 'grace', 'desire'],
      gift: 'The grace to make things worth wanting. Charm as a form of intelligence.',
      shadow: 'Confusing being desired with being valued. The beautiful prison.',
      rulership: 'Taurus and Libra',
      domicile: 'Exalted in Pisces · fall in Virgo · detriment in Scorpio',
      element: 'Earth', modality: 'Venus is reconciling — mutable earth',
      story: [
        'Venus is what happens when a greenhouse effect wins. Nine hundred and twenty-two millibars of carbon dioxide, sulfuric acid rain that never reaches the ground, a surface hot enough to melt lead, and a cloud deck orbiting sixty times faster than the planet beneath it.',
        'It also reflects almost three quarters of the light it receives, which is why it is the brightest thing in this sky after the moon and the morning star. The second planet from a sun it will never see the surface of.',
        'Astrologically Venus is the principle of attraction and of <em>value</em> — what we choose to call beautiful, and what we therefore believe ourselves to be worth. She rules the body, the taste, the negotiation between people, and the enormous quiet consolation of making something pleasing for no stated reason.'
      ],
      facts: [
        ['Orbital period', '224.701 days'],
        ['Rotation', '243.025 d retrograde'],
        ['Axial tilt', '177.36° (upside down)'],
        ['Atmosphere', '96.5 % CO₂, 92 bar'],
        ['Albedo', '0.688 — brightest planet'],
        ['Surface gravity', '8.87 m/s²']
      ]
    },
    {
      id: 'earth', name: 'Earth', glyph: '⊕', kind: 'planet', order: 3,
      rKm: 6371.0, rot: 0.99727, tilt: 23.44, moons: 1, mass: 5.97,
      dist: 1.0, distLabel: '1.000 AU · 149.6 M km', period: '365.256 d', temp: '15 °C mean',
      hue: [205, 40, 60],
      tex: 'earth', amp: 1,
      archetype: 'The Witness',
      role: 'Life · Relation · The Third',
      sub: 'The only world where the story is being told, and the only one telling it to itself.',
      keywords: ['self', 'relation', 'body', 'belonging', 'the record'],
      gift: 'Awareness. The strange privilege of watching your own life from the inside.',
      shadow: 'Self-consciousness mistaken for self-knowledge.',
      rulership: 'no planetary rule — carries the Sun and the Moon',
      domicile: 'Nothing exalted here; nothing fallen here',
      element: 'Water', modality: 'The mutable witness',
      story: [
        'The axial tilt of 23.44 degrees is the entire reason there is a year. Tilt it a little less and the seasons flatten; a little more and the poles boil. Every ecosystem, every migration, every calendar on this rock is downstream of that one number.',
        'The Moon is 1/6 the width of this planet, which is far too large to be a coincidence — it stabilises the tilt, and the tilt gives us seasons, and the seasons gave us agriculture, and agriculture is the reason any of this is happening.',
        'Astrologically the Earth is the ground of experience: the body, the actual conditions, what is true rather than what is claimed. It is the third term in every relationship — the field in which Sun meets Moon, self meets other. The chart does not predict your life. It describes the ground your life is standing on.'
      ],
      facts: [
        ['Orbital period', '365.256 days'],
        ['Rotation', '23 h 56 m 04 s'],
        ['Axial tilt', '23.44°'],
        ['Hydrosphere', '71 % of surface'],
        ['Atmosphere', '78 % N₂, 21 % O₂'],
        ['Magnetic field', 'Generated by a liquid outer core']
      ]
    },
    {
      id: 'mars', name: 'Mars', glyph: '♂', kind: 'planet', order: 4,
      rKm: 3389.5, rot: 1.02595, tilt: 25.19, moons: 2, mass: 0.642,
      dist: 1.524, distLabel: '1.524 AU · 227.9 M km', period: '686.98 d', temp: '−63 °C mean',
      hue: [18, 68, 52],
      tex: 'mars', amp: 0.95,
      archetype: 'The Warrior',
      role: 'Drive · Anger · The Frontier',
      sub: 'A desert with a canyon four times the length of the Alps and a volcano the size of Arizona.',
      keywords: ['drive', 'desire', 'anger', 'courage', 'the project'],
      gift: 'Momentum. The willingness to be the one who goes first.',
      shadow: 'Conquest as a substitute for a desire that has not been admitted.',
      rulership: 'Aries traditionally, Scorpio in modern practice',
      domicile: 'Exalted in Capricorn · fall in Cancer · detriment in Libra',
      element: 'Fire', modality: 'Cardinal fire',
      story: [
        'Oxidised iron. The entire crust is rust, and the sky is butterscotch because airborne dust is roughly the size of talc and scatters blue light away. Mars has seasons because its tilt is 25°, almost Earth\'s — and a day only forty minutes longer, which is why rovers get confused about time and humans get confused about rovers.',
        'Olympus Mons rises twenty-two kilometres. Valles Marineris runs four thousand. The crust is split by a rift that suggests the planet was once much larger, and lost that bulk fast enough to lose its magnetic field, and lost the atmosphere immediately after.',
        'Astrologically Mars is the principle of <em>appetite</em> — the raw, unsentimental force that goes where it wants. It rules the moment of confrontation, the initiation of a project, the willingness to be disliked. A chart with a strong Mars is a chart that acts before it deliberates, for better and considerably worse.'
      ],
      facts: [
        ['Orbital period', '686.980 days'],
        ['Rotation', '24 h 37 m 22 s'],
        ['Axial tilt', '25.19°'],
        ['Olympus Mons', '21.9 km — tallest volcano'],
        ['Valles Marineris', '4 000 km canyon system'],
        ['Moons', 'Phobos · Deimos']
      ]
    },
    {
      id: 'jupiter', name: 'Jupiter', glyph: '♃', kind: 'planet', order: 5,
      rKm: 69911, rot: 0.41354, tilt: 3.13, moons: 95, mass: 1898,
      dist: 5.203, distLabel: '5.203 AU · 778.5 M km', period: '11.862 yr', temp: '−145 °C at 1 bar',
      hue: [38, 44, 78],
      tex: 'jupiter', amp: 1,
      archetype: 'The Sovereign',
      role: 'Expansion · Authority · The Feast',
      sub: 'Two and a half times the mass of everything else in orbit combined.',
      keywords: ['expansion', 'luck', 'faith', 'authority', 'excess'],
      gift: 'Generosity of scale. The confidence that there is always more room than you thought.',
      shadow: 'Inflation as a personality. Promising the world what it cannot use.',
      rulership: 'Sagittarius traditionally, Pisces in modern practice',
      domicile: 'Exalted in Cancer · fall in Capricorn · detriment in Gemini',
      element: 'Fire', modality: 'Benific mutability',
      story: [
        'Jupiter failed to become a star. It has the mass for deuterium fusion and it does not have quite enough; had it collected a hundred times more material it would be a second sun, and it would not have permitted a single one of the other eight.',
        'It rotates once in just under ten hours, which flattens it visibly at the poles — the largest planet in the system is also the most oblate, a twelve per cent polar flattening you could see with a small telescope. The bands are not decoration: they are jets of cloud and ammonia ice moving in opposite directions at up to five hundred kilometres an hour.',
        'Astrologically Jupiter is the principle of <em>expansion</em> — the faculty that makes things bigger than they need to be, and is right more often than it deserves credit for. It rules travel, higher education, publishing, faith, law, and generosity. Its placement is called the greater benefic because when it operates it tends to operate in your favour.'
      ],
      facts: [
        ['Orbital period', '11.86 years'],
        ['Rotation', '9 h 55 m 30 s — fastest'],
        ['Oblateness', '6.1 % polar flattening'],
        ['Great Red Spot', '~16 000 km, centuries old'],
        ['Magnetosphere', 'Largest structure in the system'],
        ['Moons', '95 confirmed — Io, Europa, Ganymede, Callisto']
      ]
    },
    {
      id: 'saturn', name: 'Saturn', glyph: '♄', kind: 'planet', order: 6,
      rKm: 58232, rot: 0.44401, tilt: 26.73, moons: 274, mass: 568,
      dist: 9.537, distLabel: '9.537 AU · 1.43 B km', period: '29.457 yr', temp: '−178 °C at 1 bar',
      hue: [42, 42, 88],
      tex: 'saturn', amp: 1,
      rings: { inner: 1.24, outer: 2.27, tiltFollows: true },
      archetype: 'The Architect',
      role: 'Structure · Time · The Limit',
      sub: 'Less dense than water. A ring system two hundred and eighty thousand kilometres wide and often ten metres thick.',
      keywords: ['discipline', 'time', 'form', 'duty', 'longevity'],
      gift: 'The long project. The ability to hold a shape for thirty years without needing to be praised.',
      shadow: 'Rigidity mistaken for virtue. The life built to survive rather than to live.',
      rulership: 'Capricorn traditionally, Aquarius in modern practice',
      domicile: 'Exalted in Libra · fall in Aries · detriment in Cancer',
      element: 'Air by rule · Earth by physics', modality: 'Cardinal structure',
      story: [
        'The rings are not a solid disc. They are an enormous sheet of water ice — boulders and house-sized blocks — spread across a volume that would hold the Earth three times over with room to spare, yet are nowhere more than about ten metres thick on average. From certain inclinations they vanish entirely. Cassini flew through the plane of the F ring in 2004 and photographed them edge-on as a line.',
        'Saturn itself has the lowest density of any planet, 0.687 g/cm³. Drop it in a sufficiently large ocean and it would float. It is a gas giant with so much helium it looks like a pale, banded version of Jupiter, and it is being slowly, invisibly losing its atmosphere to that same magnetosphere.',
        'Astrologically Saturn is the principle of <em>limitation</em> — the boundary, the cost, the constraint that turns potential into form. It rules labour, law, structure, time and old age. Traditionally called the greater malefic, but only because it delivers consequences; almost every durable thing anyone has ever built was built under its authority.'
      ],
      facts: [
        ['Orbital period', '29.457 years'],
        ['Rotation', '10 h 33 m 38 s'],
        ['Axial tilt', '26.73° — the ring opening angle'],
        ['Ring span', '282 000 km, mostly < 10 m thick'],
        ['Density', '0.687 g/cm³ — would float'],
        ['Moons', '274 confirmed']
      ]
    },
    {
      id: 'uranus', name: 'Uranus', glyph: '♅', kind: 'planet', order: 7,
      rKm: 25362, rot: -0.71833, tilt: 97.77, moons: 28, mass: 86.8,
      dist: 19.19, distLabel: '19.19 AU · 2.87 B km', period: '84.01 yr', temp: '−224 °C at 1 bar',
      hue: [188, 45, 70],
      tex: 'uranus', amp: 0.8,
      rings: { inner: 1.64, outer: 2.00, faint: true, tiltFollows: true },
      archetype: 'The Awakener',
      role: 'Disruption · Freedom · The Axis',
      sub: 'Tipped over by ninety-eight degrees. It rolls along its orbit like a barrel.',
      keywords: ['disruption', 'originality', 'revolution', 'eccentricity', 'the pattern'],
      gift: 'The ability to see the system instead of inside it. Genuine originality.',
      shadow: 'Rebellion as an identity. Leaving before there is anything to leave.',
      rulership: 'Aquarius, sharing the chair with Saturn',
      domicile: 'Exalted in Scorpio · fall in Taurus · detriment in Leo',
      element: 'Air', modality: 'Fixed',
      story: [
        'Uranus has the coldest atmosphere in the solar system, −224 °C, and yet it radiates more heat than it receives from the Sun. Something down there is still giving off energy — an unaccounted internal source, the kind of loose thread that keeps astronomers awake.',
        'Its magnetic field is tipped fifty-nine degrees from the rotation axis and thrown far out from the planet, so that the poles sit inside their own magnetosphere. It was knocked onto its side by an impact in the first few million years, and it will stay that way for the next few billion.',
        'Astrologically Uranus rules the sudden — the break in a pattern, the invention with no ancestor, the refusal of an inherited arrangement on principle rather than on evidence. It rules technology, reform and the future tense. Where Saturn says <em>this is the cost</em>, Uranus says <em>the cost was never the point</em>.'
      ],
      facts: [
        ['Orbital period', '84.01 years'],
        ['Rotation', '17 h 14 m retrograde'],
        ['Axial tilt', '97.77° — effectively rolling'],
        ['Minimum temp', '−224 °C — coldest measured'],
        ['Internal heat', 'Emits more energy than it receives'],
        ['Rings', '13 narrow, dark, one vertical']
      ]
    },
    {
      id: 'neptune', name: 'Neptune', glyph: '♆', kind: 'planet', order: 8,
      rKm: 24622, rot: 0.67125, tilt: 28.32, moons: 16, mass: 102,
      dist: 30.07, distLabel: '30.07 AU · 4.50 B km', period: '164.8 yr', temp: '−214 °C at 1 bar',
      hue: [225, 60, 60],
      tex: 'neptune', amp: 0.9,
      archetype: 'The Deep',
      role: 'Dissolution · Vision · the Long Cold',
      sub: 'Found with mathematics before it was found with a telescope.',
      keywords: ['dissolution', 'vision', 'compassion', 'illusion', 'the infinite'],
      gift: 'The capacity to dissolve what was never solid. Empathy that includes the difficult.',
      shadow: 'Boundaries dissolved until there is nothing left to feel with.',
      rulership: 'Pisces, sharing the chair with Jupiter',
      domicile: 'Exalted in Cancer · detriment in Virgo · fall in Capricorn',
      element: 'Water', modality: 'Mutable',
      story: [
        'Le Verrier calculated where it had to be from the wobble in Uranus\'s orbit, and on the first night of looking, in September 1846, it was within one degree of the prediction. There is no other planet in this system that arrived like that.',
        'The sunlight that reaches Neptune left the Sun four hours earlier and has lost everything — Neptune receives nine hundred times less light than Earth and photographs like a deep blue ink blot. Winds reach two thousand kilometres an hour, the fastest in the system, in an atmosphere of mostly hydrogen and helium that nobody expected.',
        'Astrologically Neptune rules the dissolve — dreams, faith, art, ocean, madness, longing, and every boundary that is really a fog. It is the most difficult planet to work with and the most rewarding, because it operates exactly as far as you let it.'
      ],
      facts: [
        ['Orbital period', '164.8 years'],
        ['Rotation', '16 h 06 m'],
        ['Axial tilt', '28.32°'],
        ['Discovery', '1846 — predicted by Le Verrier'],
        ['Max winds', '~2 100 km/h'],
        ['Illumination', '900× dimmer than on Earth']
      ]
    }
  ];

  /* ---------- moons worth naming ---------- */
  var MOONS = {
    earth:  [{ id: 'luna',   name: 'Luna',      rKm: 1737.4, a: 384399, period: 27.32166, inc: 5.145, tint: [220, 6, 62] }],
    mars:   [{ id: 'phobos', name: 'Phobos',    rKm: 11.27,   a: 9376,   period: 0.31891,  inc: 1.08,  tint: [30, 8, 40] },
             { id: 'deimos', name: 'Deimos',    rKm: 6.2,     a: 23463,  period: 1.263,    inc: 0.93,  tint: [30, 8, 40] }],
    jupiter:[{ id: 'io',     name: 'Io',        rKm: 1821.6,  a: 421700, period: 1.769,    inc: 0.05,  tint: [48, 75, 78] },
             { id: 'europa', name: 'Europa',    rKm: 1560.8,  a: 671034, period: 3.551,    inc: 0.47,  tint: [35, 12, 74] },
             { id: 'gan',    name: 'Ganymede',  rKm: 2634.1,  a: 1070412,period: 7.155,    inc: 0.20,  tint: [32, 10, 46] },
             { id: 'call',   name: 'Callisto',  rKm: 2410.3,  a: 1882709,period: 16.689,   inc: 0.28,  tint: [30, 8, 34] }],
    saturn: [{ id: 'titan',  name: 'Titan',     rKm: 2574.7,  a: 1221870,period: 15.945,   inc: 0.35,  tint: [38, 68, 62] },
             { id: 'rhea',   name: 'Rhea',      rKm: 763.8,   a: 527108, period: 4.518,    inc: 0.35,  tint: [32, 8, 60] }],
    neptune:[{ id: 'triton', name: 'Triton',    rKm: 1353.4,  a: 354759, period: 5.877,    inc: 156.9,tint: [210, 8, 72] }]
  };

  /* ---------- camera choreography ----------
     dist        camera distance from focus, AU
     elev        elevation above the ecliptic, radians
     azim        azimuth about the ecliptic pole, radians
     target      desired on-screen radius of the focus body, px (0 = true scale)
     shift       focus body's horizontal placement, -1..1 of half-width
     zodiac      zodiac ring opacity
     belt        asteroid / kuiper band opacity
     orbits      orbit path opacity
     labels      body label + glyph opacity                                   */
  var CHAPTERS = [
    { id: 'hero',     focus: 'sun',     dist: 62,   elev: 0.60, azim: 0.55, target: 0,   shift: 0.24, zodiac: 0.85, belt: 1,    orbits: 0.62, labels: 0.8,  hud: 0 },
    { id: 'sun', lift: 1,      focus: 'sun',     dist: 3.2,  elev: 0.06, azim: 0.2,  target: 176, shift: 0.60,  zodiac: 0,    belt: 0,    orbits: 0.18, labels: 0, hud: 0 },
    { id: 'mercury', lift: 1,  focus: 'mercury', dist: 0.14, elev: 0.16, azim: 1.1,  target: 214, shift: 0.56,  zodiac: 0,    belt: 0,    orbits: 0.30, labels: 0, hud: 1 },
    { id: 'venus', lift: 1,    focus: 'venus',   dist: 0.20, elev: -0.20,azim: 2.0,  target: 232, shift: -0.56, zodiac: 0,    belt: 0,    orbits: 0.30, labels: 0, hud: 1 },
    { id: 'earth', lift: 1,    focus: 'earth',   dist: 0.26, elev: 0.34, azim: 3.0,  target: 246, shift: 0.54,  zodiac: 0,    belt: 0,    orbits: 0.34, labels: 0, hud: 1 },
    { id: 'mars', lift: 1,     focus: 'mars',    dist: 0.20, elev: 0.24, azim: 4.1,  target: 216, shift: -0.54, zodiac: 0,    belt: 0,    orbits: 0.32, labels: 0, hud: 1 },
    { id: 'jupiter', lift: 1,  focus: 'jupiter', dist: 0.62, elev: 0.10, azim: 5.0,  target: 274, shift: 0.50,  zodiac: 0,    belt: 0,    orbits: 0.30, labels: 0, hud: 1 },
    { id: 'saturn', lift: 1,   focus: 'saturn',  dist: 0.68, elev: 0.42, azim: 0.35, target: 232, shift: -0.50, zodiac: 0,    belt: 0,    orbits: 0.32, labels: 0, hud: 1 },
    { id: 'uranus', lift: 1,   focus: 'uranus',  dist: 0.52, elev: -0.25,azim: 1.6,  target: 186, shift: 0.52,  zodiac: 0,    belt: 0,    orbits: 0.28, labels: 0, hud: 1 },
    { id: 'neptune', lift: 1,  focus: 'neptune', dist: 0.60, elev: 0.22, azim: 2.6,  target: 190, shift: -0.52, zodiac: 0,    belt: 0,    orbits: 0.28, labels: 0, hud: 1 },
    { id: 'orrery',   focus: 'sun',     dist: 44,   elev: 0.78, azim: 0.9,  target: 0,   shift: 0,     zodiac: 0.85, belt: 1,    orbits: 1.00, labels: 1, hud: 0, free: 1 },
    { id: 'zodiac',   focus: 'sun',     dist: 58,   elev: 1.42, azim: 0.0,  target: 0,   shift: 0,     zodiac: 1,    belt: 0.35, orbits: 0.26, labels: 0.55, hud: 0 },
    { id: 'outro',    focus: 'sun',     dist: 130,  elev: 0.30, azim: 1.2,  target: 0,   shift: 0,     zodiac: 0.4, belt: 0.6,  orbits: 0.28, labels: 0, hud: 0 }
  ];

  var ASPECTS = [
    { name: 'Conjunction', glyph: '☌', angle: 0,   orb: 8,  colour: '#E8CF8A', note: 'fused, unmediated' },
    { name: 'Opposition',  glyph: '☍', angle: 180, orb: 8,  colour: '#F0765A', note: 'polarised, visible' },
    { name: 'Trine',       glyph: '△', angle: 120, orb: 6,  colour: '#7FD1E8', note: 'flowing, by nature' },
    { name: 'Square',      glyph: '□', angle: 90,  orb: 6,  colour: '#E0705A', note: 'friction that builds' },
    { name: 'Sextile',     glyph: '⚹', angle: 60,  orb: 4,  colour: '#8FE0B0', note: 'available talent' }
  ];

  root.ASTRO_DATA = {
    ELEMENTS: ELEMENTS,
    ZODIAC: ZODIAC,
    BODIES: BODIES,
    MOONS: MOONS,
    CHAPTERS: CHAPTERS,
    ASPECTS: ASPECTS,
    AU_KM: 149597870.7,
    EARTH_R: 6371.0
  };
})(window);
