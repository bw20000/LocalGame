/* Genre pack: AIRLINE CEO.
   Design knowledge the studio composes into a Game Definition. The LLM pipeline may extend or
   override any part; the deterministic designer uses it directly. Real airports and aircraft
   types are reference data (starting facts); every airline is fictional.

   Economic calibration notes (weekly ticks):
   - Demand: gravity model  K·(popA·popB)^0.75·sqrt(wealthA·wealthB)/dist^0.7. With K≈480k this gives
     ~20k weekly O&D trips for Denver–Austin and ~140k for New York–Los Angeles (both directions),
     in line with public traffic statistics.
   - An A320neo on a 1,200 km route: ~18 legs/week, ~3,200 seats, ~16% margin at 80% load.
*/
'use strict';
const path = require('path');
const fs = require('fs');

const DATA = path.join(__dirname, '..', 'data');
const airports = () => JSON.parse(fs.readFileSync(path.join(DATA, 'airports.json'), 'utf8')).records;
const aircraft = () => JSON.parse(fs.readFileSync(path.join(DATA, 'aircraft.json'), 'utf8')).records;

const HOME_CHOICES = [
  ['AUS', 'Austin', 'Fast-growing Texas market between two big carriers\' hubs'],
  ['BNA', 'Nashville', 'Leisure boomtown with thin nonstop coverage'],
  ['PDX', 'Portland', 'Pacific Northwest base with West Coast reach'],
  ['YYC', 'Calgary', 'Canadian prairie gateway'],
  ['MAN', 'Manchester', 'Harder start: crowded out of London, fierce low-cost rivals'],
  ['LYS', 'Lyon', 'Harder start: French regional capital near the Alps'],
  ['HAM', 'Hamburg', 'Harder start: wealthy German port city'],
  ['LIS', 'Lisbon', 'Harder start: Atlantic gateway with tourism tailwinds']
];

const RIVALS = [
  { name: 'Meridian Airways', archetype: 'legacy', hub: 'ATL', hub2: 'JFK', nb: 46, wb: 10, alliance: 'skyward' },
  { name: 'Northstar Air', archetype: 'legacy', hub: 'ORD', hub2: 'DEN', nb: 40, wb: 8, alliance: 'polaris' },
  { name: 'Atlantica', archetype: 'legacy', hub: 'LHR', hub2: 'FRA', nb: 38, wb: 12, alliance: 'skyward' },
  { name: 'Brightjet', archetype: 'lcc', hub: 'LAS', hub2: 'MCO', nb: 44, wb: 0 },
  { name: 'Vela Express', archetype: 'lcc', hub: 'BCN', hub2: 'BER', nb: 34, wb: 0 },
  { name: 'Falcon Gulf', archetype: 'superconnector', hub: 'DXB', hub2: null, nb: 10, wb: 26 },
  { name: 'Orion Pacific', archetype: 'legacy', hub: 'HND', hub2: 'SIN', nb: 24, wb: 14, alliance: 'polaris' },
  { name: 'Cobalt Regional', archetype: 'regional', hub: 'CLT', hub2: null, nb: 0, rj: 20, level: 2 },
  { name: 'Harbor Air', archetype: 'regional', hub: 'YYZ', hub2: 'YVR', nb: 10, rj: 10, level: 2 },
  { name: 'Sable Aerolineas', archetype: 'legacy', hub: 'GRU', hub2: 'BOG', nb: 18, wb: 4, level: 2 },
  { name: 'Kestrel Asia', archetype: 'lcc', hub: 'KUL', hub2: 'BKK', nb: 22, wb: 0, level: 2 },
  { name: 'Halcyon Air', archetype: 'boutique', hub: 'SFO', hub2: null, nb: 8, wb: 4, level: 2 }
];

function build(opts = {}) {
  const f = Object.assign({ alliances: true, labor: true, regulators: true, acquisitions: true, fuel: true, recessions: true, history: true, commissioner: true }, opts.features || {});
  const title = opts.title || 'Jetstream: Airline CEO';
  const R = (name, extra) => Object.assign({ name }, extra || {});
  const fixedRivals = RIVALS.map(r => ({ name: r.name, archetype: r.archetype, set: { hubCode: `'${r.hub}'`, hub2Code: r.hub2 ? `'${r.hub2}'` : 'null', nb: String(r.nb || 0), wb: String(r.wb || 0), rj: String(r.rj || 0), allianceStart: r.alliance && f.alliances ? `'${r.alliance}'` : 'null' } }));

  const gdl = {
    gdl: 1,
    meta: {
      id: 'airline', version: 1, title, tagline: 'From a handful of turboprops to a global carrier.',
      genre: 'airline', role: 'Chief Executive Officer',
      fantasy: ['Open a bold new route and watch it fill', 'Buy the right aircraft at the right time', 'Build a fortress hub', 'Win slots at a congested airport', 'Survive an oil shock or a recession', 'Launch a premium cabin', 'Acquire a rival', 'Join a global alliance', 'Grow from regional to global carrier'],
      pillars: ['Network strategy over spreadsheet chores', 'Every aircraft is a bet', 'The world fights back: fuel, cycles, rivals, unions, regulators', 'A carrier with a story'],
      universe: 'realistic-fictional',
      disclaimer: 'Airports and aircraft types are real-world reference points with approximate, rounded game figures. Every airline, executive, union and event is fictional. Nothing that happens after the game starts describes real companies.'
    },
    time: { unit: 'week', start: '2026-01-05' },
    currency: { symbol: '$' },
    warmup: 30,
    params: {
      demandK: 73400, distExp: 0.7, intlFactor: 0.75, outsideBase: 0.34,
      fareBase: 48, farePerKm: 0.075, fareLongKm: 0.05, feeBase: 1145,
      launchCostBase: 150000, launchCostPerKm: 55, baseCost: 4000000,
      scaleCostK: 3900, scaleCostExp: 1.3
    },
    difficulty: {
      relaxed: { label: 'Relaxed', params: { demandK: 84000, outsideBase: 0.3, fareBase: 53 } },
      normal: { label: 'Normal', params: {} },
      cutthroat: { label: 'Cutthroat', params: { demandK: 68000, outsideBase: 0.42 } }
    },
    finance: { baseRate: '0.045', creditLimit: 'max(15000000, org.m.value * 0.12 + org.m.revenueYear * 0.06)' },
    world: {
      seasonality: [0.88, 0.86, 0.96, 1.0, 1.03, 1.12, 1.18, 1.16, 1.0, 0.98, 0.92, 1.0],
      cycle: {
        start: 'expansion',
        phases: [
          { id: 'expansion', label: 'Expansion', demand: 1.04, credit: -0.005, minTicks: 104, maxTicks: 312, next: { slowdown: 1 }, news: 'Economy in expansion: travel demand is strong' },
          { id: 'slowdown', label: 'Slowdown', demand: 0.97, credit: 0.005, minTicks: 20, maxTicks: 70, next: { recession: f.recessions ? 0.6 : 0, expansion: 0.4 }, news: 'Economists warn of a slowdown; corporate travel budgets tighten' },
          { id: 'recession', label: 'Recession', demand: 0.86, credit: 0.02, minTicks: 26, maxTicks: 78, next: { recovery: 1 }, news: 'Recession: air travel demand falls sharply', severity: 'bad', event: f.recessions ? 'recessionBoard' : undefined },
          { id: 'recovery', label: 'Recovery', demand: 0.97, credit: 0.005, minTicks: 26, maxTicks: 60, next: { expansion: 1 }, news: 'Recovery: passengers are coming back' }
        ]
      },
      vars: [
        { id: 'fuel', label: 'Jet fuel', unit: '$/gal', format: 'money', start: 2.6, process: { type: 'meanRevert', mean: 2.6, vol: 0.025, speed: 0.05, min: 1.2, max: 8, phase: { recession: 0.8, expansion: 1.05 } },
          shocks: f.fuel ? [{ id: 'oilShock', label: 'Oil shock', chance: 0.0035, size: 1.75, duration: 30, news: 'Oil shock: jet fuel prices spike', event: 'fuelSpike' }, { id: 'refinery', label: 'Refinery outage', chance: 0.006, size: 1.22, duration: 8, news: 'Refinery outage pushes jet fuel higher' }] : [],
          explain: 'Spot price paid for unhedged fuel. Your hedging policy blends it with the recent average.' },
        { id: 'fuelAvg', label: 'Fuel (26-week average)', format: 'money', start: 2.6, process: { type: 'formula', expr: 'world.fuelAvg + (world.fuel - world.fuelAvg) * 0.04' }, hidden: true },
        { id: 'bizTravel', label: 'Business travel index', format: 'x', start: 1, process: { type: 'meanRevert', mean: 1, vol: 0.006, speed: 0.03, phase: { recession: 0.82, slowdown: 0.95, expansion: 1.05 } } },
        { id: 'wageIndex', label: 'Market crew wages', format: 'x', start: 1, process: { type: 'trend', drift: 0.0006, vol: 0.0005 } }
      ]
    },
    resources: [
      { id: 'brand', label: 'Brand strength', format: 'score', start: 35, min: 0, max: 100, base: '28', speed: 0.025,
        describe: 'How strongly travelers prefer you, all else equal. Built by punctuality, product and marketing; hurt by incidents and strikes.',
        drivers: [
          { label: 'Marketing spend', expr: '(org.mktPct - 0.02) * 500' },
          { label: 'Punctuality', expr: '(org.onTime - 0.82) * 140' },
          { label: 'Cabin product', expr: '(org.productLevel - 1) * 6' },
          { label: 'Customer satisfaction', expr: '(org.satisfaction - 60) * 0.3' },
          { label: 'Network size', expr: 'log(1 + org.fleet) * 4' }
        ] }
    ],
    kinds: {
      airport: {
        label: 'Airport', plural: 'Airports', glyph: 'airport', records: airports(),
        fields: { code: 'text', city: 'text', airport: 'text', country: 'text', region: 'text', lat: 'number', lon: 'number',
          pop: { type: 'number', label: 'Metro population (M)' }, wealth: { type: 'number', label: 'Wealth index' }, tourism: { type: 'number', label: 'Tourism index' },
          congestion: { type: 'pct', label: 'Slot congestion' }, incentiveBy: { type: 'text', default: '' }, incentiveDue: { type: 'number', default: 0 } },
        display: { title: '{self.city} ({self.code})', subtitle: '{self.airport} · {self.region}', stats: [{ label: 'Metro pop.', expr: 'self.pop', format: 'num', suffix: 'M' }, { label: 'Congestion', expr: 'self.congestion', format: 'pct' }] }
      },
      aircraftType: {
        label: 'Aircraft type', plural: 'Aircraft types', records: aircraft(),
        fields: { name: 'text', category: { type: 'enum', options: ['turboprop', 'regional', 'narrowbody', 'widebody', 'jumbo'] }, seats: 'int', range: { type: 'number', label: 'Range (km)' }, speed: 'number', price: 'money', leaseMonthly: 'money',
          burnGalHr: { type: 'number', label: 'Fuel burn (gal/hr)' }, maintHr: { type: 'money', label: 'Maintenance $/hr' }, crewHr: { type: 'money', label: 'Crew $/hr' }, utilHours: { type: 'number', label: 'Max block hours/week' },
          firstYear: 'int', usedOnly: 'bool', leadWeeks: { type: 'int', label: 'Factory lead time (weeks)' } }
      },
      alliance: {
        label: 'Alliance', plural: 'Alliances',
        records: f.alliances ? [{ id: 'skyward', name: 'Skyward Alliance', prestige: 16, color: '#2f6fb3' }, { id: 'polaris', name: 'Polaris Group', prestige: 15, color: '#9a3b52' }, { id: 'meridianone', name: 'Horizon One', prestige: 11, color: '#3f8f6b' }] : [],
        fields: { prestige: 'number', color: 'text' }
      },
      union: { label: 'Union', records: [{ id: 'union', name: 'Air Crew Association' }], fields: {} },
      base: {
        label: 'Base', plural: 'Bases', glyph: 'hub', idPrefix: 'base',
        fields: { airport: { type: 'ref', ref: 'airport' }, level: { type: 'int', default: 1, min: 1, max: 3, label: 'Level' } },
        upkeep: [{ label: 'Bases & hubs', expr: 'self.level == 1 ? 45000 : self.level == 2 ? 180000 : 520000' }],
        display: { title: '{self.airport.city} {self.level == 3 ? "hub" : self.level == 2 ? "focus city" : "base"}', subtitle: '{self.airport.airport}' }
      },
      agreement: {
        label: 'Airport agreement', plural: 'Airport agreements',
        fields: { airport: { type: 'ref', ref: 'airport' }, fee: { type: 'money', label: 'Annual fee' }, expires: { type: 'int', label: 'Expires (tick)' } },
        upkeep: [{ label: 'Airport agreements', expr: 'self.fee / 52' }],
        display: { title: '{self.airport.city} slots & fees', subtitle: 'Expires {date(self.expires)}' }
      },
      aircraft: {
        label: 'Aircraft', plural: 'Aircraft', glyph: 'plane', idPrefix: 'ac',
        name: { template: 'N{randInt(100, 989)}{upper(pick(["JT","AX","LS","RW","KP","MV","TC","BZ"]))}' },
        fields: { type: { type: 'ref', ref: 'aircraftType' }, route: { type: 'ref', ref: 'route', label: 'Assigned route' }, age: { type: 'number', default: 0, label: 'Age (years)' }, leased: { type: 'bool', default: false } },
        derived: {
          legs: 'self.route ? floor(self.type.utilHours * org.utilMult / (self.route.dist / self.type.speed + 0.6)) : 0',
          blockHrs: 'self.route ? self.legs * (self.route.dist / self.type.speed + 0.6) : 0',
          value: 'self.type.price * max(0.12, 1 - self.age / 30) * (0.7 + 0.3 * world.demand)'
        },
        upkeep: [{ label: 'Aircraft leases & insurance', when: '!self.route', expr: 'self.leased ? self.type.leaseMonthly * 12 / 52 : self.type.price * 0.0004' },
          { label: 'Depreciation', nonCash: true, expr: 'self.leased ? 0 : self.type.price / 25 / 52' }],
        onOwnerFail: 'release',
        display: { title: '{self.name}', subtitle: '{self.type.name} · {int(self.age)} yrs{self.leased ? " · leased" : ""}', stats: [{ label: 'Seats', expr: 'self.type.seats', format: 'int' }, { label: 'Route', expr: 'self.route ? self.route.a.code + "–" + self.route.b.code : "Idle"', format: 'text' }] }
      },
      route: {
        label: 'Route', plural: 'Routes', glyph: 'route', idPrefix: 'rt',
        name: { template: '{self.a.code}–{self.b.code}' },
        fields: { a: { type: 'ref', ref: 'airport', label: 'Origin' }, b: { type: 'ref', ref: 'airport', label: 'Destination' }, dist: { type: 'number', label: 'Distance (km)' }, key: 'text',
          fareMult: { type: 'number', default: 1, min: 0.6, max: 1.6, label: 'Fare level' }, launched: 'int',
          freqTarget: { type: 'number', default: 0, min: 0, label: 'Planned round trips / week (0 = maximum)' } },
        derived: {
          nAircraft: "count(refs('aircraft', 'route'))",
          maxLegs: "sum(refs('aircraft', 'route'), it.legs)",
          scale: 'self.freqTarget > 0 ? min(1, 2 * self.freqTarget / max(1, self.maxLegs)) : 1',
          seats: "sum(refs('aircraft', 'route'), it.legs * it.type.seats) * self.scale",
          freq: 'self.maxLegs * self.scale / 2',
          fuelBurn: "sum(refs('aircraft', 'route'), it.blockHrs * it.type.burnGalHr) * self.scale",
          crewBase: "sum(refs('aircraft', 'route'), it.blockHrs * it.type.crewHr) * self.scale",
          maintBase: "sum(refs('aircraft', 'route'), it.blockHrs * it.type.maintHr * (1 + it.age * 0.035)) * self.scale",
          ownCost: "sum(refs('aircraft', 'route'), it.leased ? it.type.leaseMonthly * 12 / 52 : it.type.price * 0.0004)",
          hubLvl: "sum(ownedWhere('base', 'airport', self.a), it.level) + sum(ownedWhere('base', 'airport', self.b), it.level)",
          refFare: 'params.fareBase + params.farePerKm * min(self.dist, 2000) + params.fareLongKm * max(0, self.dist - 2000)',
          feeAvg: "(params.feeBase * (0.6 + 0.6 * self.a.wealth + 2 * self.a.congestion) * (1 - (ownsAt('agreement', 'airport', self.a) ? 0.15 : 0) - 0.04 * sum(ownedWhere('base', 'airport', self.a), it.level)) + params.feeBase * (0.6 + 0.6 * self.b.wealth + 2 * self.b.congestion) * (1 - (ownsAt('agreement', 'airport', self.b) ? 0.15 : 0) - 0.04 * sum(ownedWhere('base', 'airport', self.b), it.level))) / 2"
        },
        operate: {
          market: 'airTravel', salesLabel: 'Ticket revenue',
          capacity: 'self.seats * (org.strikeLeft > 0 ? 0.35 : 1) * (1 - min(0.5, org.disruption))',
          price: 'self.refFare * self.fareMult',
          attrs: { freq: 'log(1 + self.freq) - 2.7', product: 'org.productLevel - 1', ontime: '(org.onTime - 0.82) * 10', brand: '(org.brand - 50) / 25', conn: 'min(3, self.hubLvl) * 0.5 - 0.5', alliance: 'org.alliance ? 1 : 0' },
          revenue: [{ label: 'Ancillary revenue', expr: 'sold * (org.productLevel == 0 ? 24 : org.productLevel == 1 ? 15 : 11)' }],
          costs: [
            { label: 'Fuel', expr: 'self.fuelBurn * org.fuelPriceEff * (org.strikeLeft > 0 ? 0.35 : 1)' },
            { label: 'Crew', expr: 'self.crewBase * org.payPolicy * org.payContract * (org.strikeLeft > 0 ? 0.6 : 1)' },
            { label: 'Maintenance', expr: 'self.maintBase * org.maintMult' },
            { label: 'Aircraft leases & insurance', expr: 'self.ownCost' },
            { label: 'Airport & navigation fees', expr: 'self.seats / 150 * self.feeAvg' },
            { label: 'Passenger services', expr: 'sold * (6 + 0.004 * self.dist) * (org.productLevel == 0 ? 0.75 : org.productLevel == 1 ? 1 : 1.4)' },
            { label: 'Distribution & sales', expr: 'revenue * 0.045' }
          ]
        },
        explain: { title: 'Why {self.name} performs this way', drivers: [
          { label: 'Weekly demand captured', expr: 'self._demand' }, { label: 'Seats offered', expr: 'self._cap' }, { label: 'Load factor %', expr: 'self._load * 100' },
          { label: 'Average fare', expr: 'self.refFare * self.fareMult' }, { label: 'Competitors on this pair', expr: "count(where('route', 'key', self.key), it.owner != self.owner)" },
          { label: 'Weekly revenue', expr: 'self._rev' }, { label: 'Weekly costs', expr: '-self._cost' }, { label: 'Weekly profit', expr: 'self._profit' } ] },
        display: { title: '{self.a.city} – {self.b.city}', subtitle: '{int(self.dist)} km · {self.nAircraft} aircraft · {round(self.freq)}×/wk',
          stats: [{ label: 'Load', expr: 'self._load', format: 'pct' }, { label: 'Profit/wk', expr: 'self._profit', format: 'money' }] }
      }
    },
    markets: {
      airTravel: {
        label: 'Air travel market', key: 'self.key', refPrice: 'self.refFare',
        size: 'params.demandK * pow(self.a.pop * self.b.pop, 0.75) * pow(self.a.wealth * self.b.wealth, 0.25) / pow(max(self.dist, 300), params.distExp) * (self.a.country == self.b.country ? 1 : self.a.region == self.b.region ? 0.92 : params.intlFactor) * world.demand * world.season',
        outside: 'params.outsideBase + (self.dist < 600 ? 1.2 : self.dist < 900 ? 0.5 : 0)',
        segments: [
          { id: 'business', label: 'Business', size: 'size * 0.2 * world.bizTravel * clamp(sqrt(self.a.wealth * self.b.wealth) / 1.3, 0.4, 1.4)', priceSens: 1.0, priceMult: '1.5 + min(2.6, self.dist / 2800)', capShare: 'org.productLevel >= 2 ? 0.16 : org.productLevel >= 1 ? 0.1 : 0.04', weights: { freq: 0.9, product: 0.8, ontime: 1.6, brand: 1.0, conn: 0.6, alliance: 0.5 } },
          { id: 'leisure', label: 'Leisure', size: 'size * 0.55 * (self.a.tourism + self.b.tourism) / 2.4', priceSens: 2.4, priceMult: 1.0, weights: { freq: 0.35, product: 0.25, ontime: 0.5, brand: 0.8, conn: 0.3, alliance: 0.15 } },
          { id: 'vfr', label: 'Visiting friends & family', size: 'size * 0.25', priceSens: 3.0, priceMult: 0.85, weights: { freq: 0.2, brand: 0.4, ontime: 0.3, conn: 0.2 } }
        ]
      }
    },
    orgs: {
      label: 'Airline', plural: 'Airlines',
      fields: {
        homeCode: { type: 'text', default: 'AUS' }, hubCode: { type: 'text', default: '' }, hub2Code: { type: 'text', default: '' }, nb: 'number', wb: 'number', rj: 'number', allianceStart: { type: 'text', default: '' },
        productLevel: { type: 'number', default: 1, label: 'Cabin product (0 no-frills, 1 standard, 2 premium)' },
        payPolicy: { type: 'number', default: 1 }, payContract: { type: 'number', default: 1 }, maintMult: { type: 'number', default: 1 }, utilMult: { type: 'number', default: 1 },
        fuelPriceEff: { type: 'number', default: 2.6 }, mktPct: { type: 'number', default: 0.02 }, onTime: { type: 'number', default: 0.84 },
        alliance: { type: 'text', default: '' }, strikeLeft: { type: 'number', default: 0 }, disruption: { type: 'number', default: 0 }, acquisitions: { type: 'number', default: 0 }, contractUntil: { type: 'number', default: 150 }
      },
      metrics: [
        { id: 'fleet', label: 'Fleet', expr: "count(owned('aircraft', org))", format: 'int' },
        { id: 'idle', label: 'Idle aircraft', expr: "count(owned('aircraft', org), !it.route)", format: 'int' },
        { id: 'routes', label: 'Routes', expr: "count(owned('route', org))", format: 'int' },
        { id: 'destinations', label: 'Destinations', expr: "len(distinct(concat(map(owned('route', org), it.a), map(owned('route', org), it.b))))", format: 'int' },
        { id: 'weeklyPax', label: 'Passengers / week', expr: "sum(owned('route', org), it._sold)", format: 'int' },
        { id: 'loadFactor', label: 'Load factor', expr: "sum(owned('route', org), it._sold) / max(1, sum(owned('route', org), it._cap))", format: 'pct' },
        { id: 'yield', label: 'Revenue per passenger', expr: "sum(owned('route', org), it._rev) / max(1, org.weeklyPax)", format: 'money' },
        { id: 'fleetAge', label: 'Average fleet age', expr: "avg(owned('aircraft', org), it.age)", format: 'num' },
        { id: 'longHaul', label: 'Long-haul routes', expr: "count(owned('route', org), it.dist > 5000)", format: 'int' },
        { id: 'intlRoutes', label: 'International routes', expr: "count(owned('route', org), it.a.country != it.b.country)", format: 'int' },
        { id: 'regions', label: 'Regions served', expr: "len(distinct(concat(map(owned('route', org), it.a.region), map(owned('route', org), it.b.region))))", format: 'int' },
        { id: 'hubCongestion', label: 'Base congestion', expr: "avg(owned('base', org), it.airport.congestion)", format: 'pct', track: false },
        { id: 'hubDominance', label: 'Share of seats at your biggest base', expr: "maxOf(owned('base', org), (sum(where('route', 'a', it.airport), it._cap, it.owner == org) + sum(where('route', 'b', it.airport), it._cap, it.owner == org)) / max(1, sum(where('route', 'a', it.airport), it._cap) + sum(where('route', 'b', it.airport), it._cap)))", format: 'pct' },
        { id: 'satisfaction', label: 'Customer satisfaction', expr: 'clamp(55 + org.productLevel * 7 + (org.onTime - 0.8) * 150 - max(0, org.loadFactor - 0.86) * 120 + (org.brand - 50) * 0.15, 0, 100)', format: 'score' },
        { id: 'marketShare', label: 'Global passenger share', expr: "org.weeklyPax / max(1, sum(all('route'), it._sold))", format: 'pct1' },
        { id: 'margin', label: 'Operating margin', expr: 'org.profitYear / max(1, org.revenueYear)', format: 'pct1' },
        { id: 'maxRange', label: 'Network reach (km)', expr: "org.isPlayer ? (tierIndex() == 0 ? 2500 : tierIndex() == 1 ? 4800 : tierIndex() == 2 ? 9500 : 20000) : 20000", format: 'int', track: false }
      ],
      assets: "sum(owned('aircraft', org), it.leased ? 0 : it.value) + sum(owned('base', org), it.level * 6000000)",
      valuation: 'max(0, org.m.assets + org.cash - org.debt + max(0, org.profitYear) * 6 + org.revenueYear * 0.12)',
      costs: [
        { label: 'Overhead & IT', expr: '60000 + org.revenue * 0.045 + params.scaleCostK * pow(org.fleet, params.scaleCostExp)' },
        { label: 'Marketing', expr: 'org.revenue * org.mktPct' },
        { label: 'Alliance dues', expr: 'org.alliance ? 55000 : 0' },
        { label: 'Idle aircraft parking', expr: 'org.idle * 9000' }
      ],
      tick: [
        { op: 'set', path: 'org.strikeLeft', value: 'max(0, org.strikeLeft - 1)' },
        { op: 'set', path: 'org.disruption', value: 'org.disruption * 0.5' },
        { op: 'set', path: 'org.onTime', value: 'clamp(0.875 + (org.maintMult - 1) * 0.15 - org.fleetAge * 0.003 - org.hubCongestion * 0.06 - org.disruption * 0.6 - max(0, org.utilMult - 1) * 0.5 + randn(0, 0.008), 0.55, 0.97)' }
      ],
      player: {
        name: 'Bluebird Air', cash: '60000000',
        set: { productLevel: '1', mktPct: '0.02' },
        start: [
          { op: 'let', name: 'home', value: "get('airport', org.homeCode)" },
          { op: 'create', kind: 'base', set: { airport: 'home', level: '1' } },
          { op: 'create', kind: 'aircraft', count: '4', set: { type: "'E175'", age: 'randInt(2, 8)', leased: 'true' } },
          { op: 'create', kind: 'aircraft', count: '2', set: { type: "'AT76'", age: 'randInt(3, 9)', leased: 'false' } },
          { op: 'each', list: "top(filter(all('airport'), it != home && it.region == home.region && distance(home, it) <= 2200 && distance(home, it) >= 450 && it.congestion < 0.75), it.pop * it.wealth / pow(distance(home, it), 0.7), 2)", as: 'dest', do: [
            { op: 'create', kind: 'route', set: { a: 'home', b: 'dest', dist: 'distance(home, dest)', key: 'pairKey(home, dest)', launched: '0' }, as: 'r' },
            { op: 'each', list: "top(filter(owned('aircraft', org), !it.route && it.type.id == 'E175'), 1, 1)", do: [{ op: 'set', path: 'it.route', value: 'r' }] }
          ] },
          { op: 'each', list: "top(filter(all('airport'), it != home && distance(home, it) <= 900 && distance(home, it) >= 200 && it.congestion < 0.75 && !ownsAt('route', 'key', pairKey(home, it))), it.pop * it.wealth * (it.region == home.region ? 1 : 0) / pow(distance(home, it), 0.7), 1)", as: 'dest', do: [
            { op: 'create', kind: 'route', set: { a: 'home', b: 'dest', dist: 'distance(home, dest)', key: 'pairKey(home, dest)', launched: '0', freqTarget: '14' }, as: 'r' },
            { op: 'each', list: "top(filter(owned('aircraft', org), !it.route && it.type.id == 'AT76'), 1, 1)", do: [{ op: 'set', path: 'it.route', value: 'r' }] }
          ] }
        ]
      },
      rivals: {
        count: { full: 7, light: 5, background: 18 }, fixed: fixedRivals, aiEvery: 4, entryChance: '0.35', maxActive: 15, failGrace: 12, leadershipChange: 0.25,
        suffixes: ['Airways', 'Air', 'Airlines', 'Aviation', 'Jet'], backgroundValue: '900000000',
        archetypes: [
          { id: 'legacy', label: 'Legacy network carrier', share: 2, risk: 0.45, tempo: 2, color: '#3b5b92', cash: '900000000',
            set: { productLevel: '2', brand: '60', mktPct: '0.02' },
            policies: { revenueMgmt: 'yield', maintenance: 'standard', crewPay: 'above', fuelHedging: 'partial', marketing: 'standard' },
            weights: { openRoute: 1.2, addAircraft: 1.2, orderAircraft: 1, leaseAircraft: 0.6, upgradeBase: 0.5, closeRoute: 1, acquireAirline: 0.3 } },
          { id: 'lcc', label: 'Low-cost carrier', share: 2, risk: 0.65, tempo: 3, color: '#e8a33d', cash: '350000000',
            set: { productLevel: '0', brand: '48', mktPct: '0.035' },
            policies: { revenueMgmt: 'volume', maintenance: 'standard', crewPay: 'below', fuelHedging: 'none', marketing: 'heavy' },
            weights: { openRoute: 1.6, addAircraft: 1.3, orderAircraft: 1.1, leaseAircraft: 0.8, closeRoute: 1.2, acquireAirline: 0 } },
          { id: 'superconnector', label: 'Global super-connector', share: 0.5, risk: 0.5, tempo: 2, color: '#8a6d3b', cash: '1500000000',
            set: { productLevel: '2', brand: '72', mktPct: '0.025' },
            policies: { revenueMgmt: 'yield', maintenance: 'premium', crewPay: 'market', fuelHedging: 'full', marketing: 'standard' },
            weights: { openRoute: 1.3, addAircraft: 1.1, orderAircraft: 1.2, closeRoute: 0.8 } },
          { id: 'regional', label: 'Regional operator', share: 1, risk: 0.4, tempo: 1, color: '#5a8f7b', cash: '120000000',
            set: { productLevel: '1', brand: '40', mktPct: '0.015' },
            policies: { revenueMgmt: 'balanced', maintenance: 'standard', crewPay: 'market', fuelHedging: 'partial', marketing: 'low' },
            weights: { openRoute: 1.2, addAircraft: 1, leaseAircraft: 1, closeRoute: 1 } },
          { id: 'boutique', label: 'Premium boutique', share: 0.6, risk: 0.5, tempo: 1, color: '#7b4a8f', cash: '250000000',
            set: { productLevel: '2', brand: '58', mktPct: '0.03' },
            policies: { revenueMgmt: 'yield', maintenance: 'premium', crewPay: 'above', fuelHedging: 'partial', marketing: 'heavy' },
            weights: { openRoute: 1, addAircraft: 0.8, leaseAircraft: 1 } }
        ],
        start: [
          { op: 'let', name: 'hub', value: "get('airport', org.hubCode ? org.hubCode : pick(['DFW','PHX','SEA','MIA','MAD','FCO','IST','ICN','SYD','MEX']))" },
          { op: 'create', kind: 'base', set: { airport: 'hub', level: "org.archetype == 'regional' || org.archetype == 'boutique' ? 2 : 3" } },
          { op: 'if', cond: 'org.hub2Code', then: [{ op: 'create', kind: 'base', set: { airport: "get('airport', org.hub2Code)", level: '2' } }] },
          { op: 'create', kind: 'aircraft', count: 'org.nb ? org.nb : randInt(8, 18)', set: { type: "org.archetype == 'lcc' ? pick(['A20N','B38M','A21N','B738']) : pick(['A20N','B38M','A21N','A223','B738'])", age: 'randInt(1, 16)', leased: 'chance(0.4)' } },
          { op: 'create', kind: 'aircraft', count: 'org.wb', set: { type: "pick(['B789','A359','A339','B77W'])", age: 'randInt(1, 14)', leased: 'chance(0.3)' } },
          { op: 'create', kind: 'aircraft', count: 'org.rj', set: { type: "pick(['E175','CRJ9','AT76'])", age: 'randInt(2, 15)', leased: 'chance(0.5)' } },
          { op: 'if', cond: 'org.allianceStart', then: [{ op: 'set', path: 'org.alliance', value: 'org.allianceStart' }] }
        ]
      },
      onFail: [{ op: 'event', id: 'distressedFleet', bind: { failed: 'org' } }]
    },
    people: [{ kind: 'aircraft', age: 'age', skills: [], retireAge: [27, 34], retireText: '{self.name} ({self.type.name}) retired after {int(self.age)} years' }]
  };

  /* ---------------- policies (delegation) ---------------- */
  const rm = (target, up, down, lo, hi) => [
    { op: 'if', cond: `self._cap > 0 && self._load > ${target} + 0.04 && self.fareMult < ${hi}`, then: [{ op: 'mul', path: 'self.fareMult', value: String(1 + up) }] },
    { op: 'if', cond: `self._cap > 0 && self._load < ${target} - 0.06 && self.fareMult > ${lo}`, then: [{ op: 'mul', path: 'self.fareMult', value: String(1 - down) }] }
  ];
  gdl.policies = [
    { id: 'revenueMgmt', label: 'Revenue management', scope: 'kind:route', default: 'balanced', aiDefault: 'balanced', every: 2,
      describe: 'Your pricing team adjusts every route\'s fares each fortnight toward a target load factor. Set to Manual to price routes yourself.',
      options: [
        { value: 'manual', label: 'Manual', describe: 'You set fares route by route.' },
        { value: 'volume', label: 'Fill the planes', describe: 'Targets ~90% load: more passengers, lower fares.', effects: rm(0.9, 0.02, 0.03, 0.7, 1.15) },
        { value: 'balanced', label: 'Balanced', describe: 'Targets ~83% load.', effects: rm(0.84, 0.02, 0.025, 0.75, 1.25) },
        { value: 'yield', label: 'Maximize yield', describe: 'Targets ~76% load: premium fares, more empty seats.', effects: rm(0.78, 0.025, 0.02, 0.85, 1.35) }
      ] },
    { id: 'maintenance', label: 'Maintenance program', scope: 'org', default: 'standard',
      describe: 'Cheaper maintenance flies aircraft harder but hurts punctuality and safety.',
      options: [
        { value: 'minimal', label: 'Minimal', describe: '−20% maintenance cost, +4% utilization, worse punctuality, regulators notice.', effects: [{ op: 'set', path: 'org.maintMult', value: '0.8' }, { op: 'set', path: 'org.utilMult', value: '1.04' }] },
        { value: 'standard', label: 'Standard', describe: 'Industry practice.', effects: [{ op: 'set', path: 'org.maintMult', value: '1' }, { op: 'set', path: 'org.utilMult', value: '1' }] },
        { value: 'premium', label: 'Premium', describe: '+20% cost, better punctuality and safety record.', effects: [{ op: 'set', path: 'org.maintMult', value: '1.2' }, { op: 'set', path: 'org.utilMult', value: '0.98' }] }
      ] },
    { id: 'crewPay', label: 'Crew pay stance', scope: 'org', default: 'market',
      describe: 'Pay relative to the market. Paying below market saves money and angers the union.',
      options: [
        { value: 'below', label: 'Below market', describe: '−8% crew cost, union unrest.', effects: [{ op: 'set', path: 'org.payPolicy', value: '0.92' }] },
        { value: 'market', label: 'Market rate', describe: 'Neutral.', effects: [{ op: 'set', path: 'org.payPolicy', value: '1' }] },
        { value: 'above', label: 'Above market', describe: '+10% crew cost, loyal crews.', effects: [{ op: 'set', path: 'org.payPolicy', value: '1.1' }] }
      ] },
    { id: 'fuelHedging', label: 'Fuel hedging', scope: 'org', default: 'partial',
      describe: 'Hedging smooths fuel costs toward the 26-week average, for a small premium. Great in a spike, costly when prices fall.',
      options: [
        { value: 'none', label: 'Unhedged', describe: 'Pay spot price.', effects: [{ op: 'set', path: 'org.fuelPriceEff', value: 'world.fuel' }] },
        { value: 'partial', label: 'Half hedged', describe: '50% at the average + 1%.', effects: [{ op: 'set', path: 'org.fuelPriceEff', value: '0.5 * world.fuel + 0.5 * world.fuelAvg * 1.01' }] },
        { value: 'full', label: 'Fully hedged', describe: 'Average price + 3%.', effects: [{ op: 'set', path: 'org.fuelPriceEff', value: 'world.fuelAvg * 1.03' }] }
      ] },
    { id: 'marketing', label: 'Marketing budget', scope: 'org', default: 'standard',
      describe: 'Share of revenue spent on brand. Brand lifts demand on every route, slowly.',
      options: [
        { value: 'low', label: 'Lean (1%)', effects: [{ op: 'set', path: 'org.mktPct', value: '0.01' }] },
        { value: 'standard', label: 'Standard (2%)', effects: [{ op: 'set', path: 'org.mktPct', value: '0.02' }] },
        { value: 'heavy', label: 'Heavy (4%)', effects: [{ op: 'set', path: 'org.mktPct', value: '0.04' }] }
      ] }
  ];

  /* ---------------- stakeholders ---------------- */
  gdl.stakeholders = [];
  if (f.labor) gdl.stakeholders.push({ id: 'union', label: 'Crew union morale', start: 60, base: '58', speed: 0.06, describe: 'Pilots and cabin crew. Low morale means strikes.',
    drivers: [
      { label: 'Pay vs. market wages', expr: 'clamp((org.payPolicy * org.payContract / world.wageIndex - 1) * 160, -30, 20)' },
      { label: 'Profits not shared', expr: 'org.margin > 0.1 && org.payPolicy <= 1 ? -8 : 0' },
      { label: 'Contract expired', expr: 'time.tick > org.contractUntil ? -10 : 0' },
      { label: 'Overworked crews', expr: 'org.utilMult > 1 ? -6 : 0' }
    ],
    thresholds: [{ below: 30, event: 'strikeThreat', cooldown: 26 }] });
  if (f.regulators) gdl.stakeholders.push({ id: 'scrutiny', label: 'Regulatory scrutiny', start: 20, base: '18', speed: 0.05, describe: 'How closely aviation and competition regulators watch you. Higher is worse.', higherIsWorse: true,
    drivers: [
      { label: 'Dominance at your bases', expr: 'max(0, org.hubDominance - 0.45) * 90' },
      { label: 'Fleet age & maintenance', expr: 'max(0, org.fleetAge - 12) * 2 + (org.maintMult < 1 ? 12 : 0)' },
      { label: 'Delays', expr: 'max(0, 0.8 - org.onTime) * 90' },
      { label: 'Global market share', expr: 'max(0, org.marketShare - 0.1) * 120' }
    ],
    thresholds: [{ above: 65, event: 'investigation', cooldown: 52 }] });
  gdl.stakeholders.push({ id: 'board', label: 'Board confidence', start: 60, base: '55', speed: 0.05, describe: 'Your directors. Lose them and you lose the job.',
    drivers: [
      { label: 'Profitability', expr: 'time.tick < 26 ? 0 : clamp((org.margin - 0.04) * 250, -25, 20)' },
      { label: 'Cash position', expr: 'org.cash < 0 ? -15 : org.cash > org.revenueYear * 0.15 ? 5 : 0' },
      { label: 'Punctuality', expr: 'clamp((org.onTime - 0.8) * 60, -6, 6)' },
      { label: 'Growth tier', expr: 'tierIndex() * 4' }
    ],
    thresholds: [{ below: 25, event: 'boardUltimatum', cooldown: 26 }] });

  /* ---------------- actions ---------------- */
  const legsExpr = (ac, dist) => `floor(${ac}.type.utilHours * org.utilMult / (${dist} / ${ac}.type.speed + 0.6))`;
  const routeForecast = (a, b, ac, fare, freq) => {
    const mx = legsExpr(ac, 'dist');
    const legs = freq ? `(${freq} > 0 ? min(${mx}, 2 * ${freq}) : ${mx})` : mx;
    const blk = `(dist / ${ac}.type.speed + 0.6)`;
    return {
      kind: 'route',
      set: {
        a, b, dist: 'dist', key: `pairKey(${a}, ${b})`, fareMult: fare, freqTarget: freq || '0',
        seats: `${legs} * ${ac}.type.seats`, freq: `${legs} / 2`, nAircraft: '1', maxLegs: mx, scale: '1',
        fuelBurn: `${legs} * ${blk} * ${ac}.type.burnGalHr`,
        crewBase: `${legs} * ${blk} * ${ac}.type.crewHr`,
        maintBase: `${legs} * ${blk} * ${ac}.type.maintHr * (1 + ${ac}.age * 0.035)`,
        ownCost: `${ac}.leased ? ${ac}.type.leaseMonthly * 12 / 52 : ${ac}.type.price * 0.0004`
      }
    };
  };
  const FREQ_OPTS = [{ value: 0, label: 'Maximum', describe: 'Fly the aircraft as much as possible' }, { value: 28, label: '4× daily' }, { value: 21, label: '3× daily' }, { value: 14, label: '2× daily' }, { value: 7, label: 'Daily' }, { value: 4, label: '4× weekly' }];
  const slotOk = (ap) => `${ap}.congestion < 0.75 || ownsAt('agreement', 'airport', ${ap}) || !org.isPlayer`;
  gdl.actions = [
    { id: 'openRoute', label: 'Open a route', verb: 'Launch', category: 'network', icon: 'route', primary: true,
      describe: 'Start nonstop service between one of your bases and a new destination with an idle aircraft.',
      tradeoff: 'Uses an idle aircraft and launch marketing money; new routes take a few weeks to mature.',
      risk: 'Competitors may respond with fare cuts; demand estimates can be off by ±15%.',
      params: [
        { id: 'origin', label: 'From (your base)', type: 'entity', kind: 'airport', filter: "ownsAt('base', 'airport', it)", sort: 'it.pop' },
        { id: 'dest', label: 'To', type: 'entity', kind: 'airport', filter: "it != param.origin && (it.congestion < 0.75 || ownsAt('agreement', 'airport', it) || !org.isPlayer) && distance(param.origin, it) >= 250 && distance(param.origin, it) <= org.maxRange && !ownsAt('route', 'key', pairKey(param.origin, it)) && (org.isPlayer == false || tierIndex() > 0 || it.region == param.origin.region)",
          sort: 'it.pop * sqrt(it.wealth) * (1 + it.tourism * 0.3) / pow(max(300, distance(param.origin, it)), 0.7) / (1 + 0.35 * count(where(\'route\', \'key\', pairKey(param.origin, it))))' },
        { id: 'aircraft', label: 'Aircraft', type: 'entity', kind: 'aircraft', filter: 'it.owner == org && !it.route && it.type.range >= distance(param.origin, param.dest)', sort: '-abs(it.type.seats - 160)' },
        { id: 'fare', label: 'Fare positioning', type: 'choice', default: '1', aiValue: "archetype(org) == 'lcc' ? 0.88 : archetype(org) == 'legacy' ? 1.05 : 1",
          options: [{ value: 0.85, label: 'Low fares', describe: 'Steal share, thinner margins' }, { value: 1, label: 'Market fares', describe: 'Match the market' }, { value: 1.15, label: 'Premium fares', describe: 'Higher yield, fewer passengers' }] },
        { id: 'freq', label: 'Frequency', type: 'choice', default: '0', aiValue: '0', options: FREQ_OPTS }
      ],
      vars: { dist: 'distance(param.origin, param.dest)' },
      requires: [
        { expr: slotOk('param.dest'), msg: '{param.dest.city} is slot-constrained: negotiate an airport agreement first' },
        { expr: slotOk('param.origin'), msg: '{param.origin.city} is slot-constrained: negotiate an airport agreement first' }
      ],
      cost: { cash: 'params.launchCostBase + params.launchCostPerKm * dist' }, costCategory: 'Route launches',
      forecast: routeForecast('param.origin', 'param.dest', 'param.aircraft', '+param.fare', '+param.freq'),
      preview: [
        { label: 'Weekly travelers in this market', expr: 'fc.marketSize', format: 'int' },
        { label: 'Your seats / week', expr: 'fc.capacity', format: 'int' },
        { label: 'Your expected passengers / week', expr: 'fc.sold', format: 'int' },
        { label: 'Expected load factor', expr: 'fc.load', format: 'pct' },
        { label: 'Expected weekly profit', expr: 'fc.profit', format: 'signedMoney', tone: "fc.profit >= 0 ? 'good' : 'bad'" },
        { label: 'Competitors already flying it', expr: 'fc.competitors', format: 'int' },
        { label: 'Launch cost', expr: 'params.launchCostBase + params.launchCostPerKm * dist', format: 'money' }
      ],
      effects: [
        { op: 'create', kind: 'route', set: { a: 'param.origin', b: 'param.dest', dist: 'dist', key: 'pairKey(param.origin, param.dest)', fareMult: '+param.fare', freqTarget: '+param.freq', launched: 'time.tick' }, as: 'r' },
        { op: 'set', target: 'param.aircraft', field: 'route', value: 'r' },
        { op: 'each', list: "where('route', 'key', r.key)", filter: 'it.owner != org', do: [{ op: 'remember', a: 'it.owner', b: 'org', key: 'rivalry', add: '3' }] },
        { op: 'news', text: 'New route: {param.origin.city} – {param.dest.city} ({int(dist)} km)' }
      ],
      result: 'Launched {param.origin.code}–{param.dest.code} with {param.aircraft.type.name} {param.aircraft.name}',
      ai: { score: 'fc.profit * 26 - (params.launchCostBase + params.launchCostPerKm * dist) + (fc.load > 0.55 ? 0 : -1e9)', candidates: 4, news: '{org.name} launches {param.origin.city} – {param.dest.city}' } },
    { id: 'addAircraft', label: 'Add an aircraft', verb: 'Add capacity', kind: 'route', category: 'network', icon: 'plus',
      describe: 'Put another idle aircraft on this route to add frequencies and seats.',
      tradeoff: 'More seats lower your load factor unless demand is spilling.',
      params: [{ id: 'aircraft', label: 'Aircraft', type: 'entity', kind: 'aircraft', filter: 'it.owner == org && !it.route && it.type.range >= self.dist', sort: 'it.type.seats' }],
      preview: [{ label: 'Current load factor', expr: 'self._load', format: 'pct' }, { label: 'Unserved demand / week', expr: 'max(0, self._demand - self._sold)', format: 'int' }, { label: 'Added seats / week', expr: `${legsExpr('param.aircraft', 'self.dist')} * param.aircraft.type.seats`, format: 'int' }],
      effects: [{ op: 'set', target: 'param.aircraft', field: 'route', value: 'self' }],
      result: 'Added {param.aircraft.name} to {self.name}',
      ai: { score: '(self._load > 0.9 && self._profit > 0 && self.scale >= 1) ? (self._demand - self._sold) * self.refFare : 0', candidates: 2, selfSample: 6 } },
    { id: 'removeAircraft', label: 'Pull an aircraft', verb: 'Reduce capacity', kind: 'route', category: 'network', icon: 'minus',
      describe: 'Take an aircraft off this route; it becomes idle and can fly elsewhere.',
      params: [{ id: 'aircraft', label: 'Aircraft', type: 'entity', kind: 'aircraft', filter: 'it.route == self', sort: '-it.type.seats' }],
      requires: [{ expr: 'self.nAircraft > 1', msg: 'This is the only aircraft — close the route instead' }],
      effects: [{ op: 'set', target: 'param.aircraft', field: 'route', value: 'null' }], result: 'Pulled {param.aircraft.name} from {self.name}' },
    { id: 'closeRoute', label: 'Close route', verb: 'Close', kind: 'route', category: 'network', icon: 'close', danger: true,
      describe: 'End service. Aircraft become idle. Customers notice abandoned cities.',
      tradeoff: 'Stops losses now; costs a small brand hit and wind-down fees.',
      cost: { cash: '50000 + self.dist * 20' }, costCategory: 'Route closures',
      effects: [{ op: 'each', list: "refs('aircraft', 'route', self)", do: [{ op: 'set', path: 'it.route', value: 'null' }] }, { op: 'resource', id: 'brand', add: '-0.5' }, { op: 'news', text: 'Route closed: {self.name}' }, { op: 'remove', target: 'self' }],
      result: 'Closed {self.name}',
      ai: { score: "time.tick - self.launched > 30 && avg(self._hp ?? [], it) < 0 ? 1e6 - avg(self._hp ?? [], it) : 0", selfSample: 8, news: '{org.name} exits {self.name}' } },
    { id: 'setFare', label: 'Set fare level', verb: 'Reprice', kind: 'route', category: 'commercial', icon: 'tag',
      describe: 'Override this route\'s fare. Revenue management will keep adjusting unless set to Manual.',
      params: [{ id: 'mult', label: 'Fare level', type: 'choice', default: 'self.fareMult', options: [{ value: 0.8, label: '−20%' }, { value: 0.9, label: '−10%' }, { value: 1, label: 'Market' }, { value: 1.1, label: '+10%' }, { value: 1.2, label: '+20%' }, { value: 1.35, label: '+35%' }] }],
      forecast: { kind: 'route', exclude: 'self', set: { a: 'self.a', b: 'self.b', dist: 'self.dist', key: 'self.key', fareMult: '+param.mult', freqTarget: 'self.freqTarget', maxLegs: 'self.maxLegs', scale: 'self.scale', seats: 'self.seats', freq: 'self.freq', nAircraft: 'self.nAircraft', fuelBurn: 'self.fuelBurn', crewBase: 'self.crewBase', maintBase: 'self.maintBase', ownCost: 'self.ownCost', hubLvl: 'self.hubLvl', feeAvg: 'self.feeAvg', refFare: 'self.refFare' } },
      preview: [{ label: 'Average fare', expr: 'self.refFare * param.mult', format: 'money' }, { label: 'Expected load factor', expr: 'fc.load', format: 'pct' }, { label: 'Expected weekly profit', expr: 'fc.profit', format: 'signedMoney' }, { label: 'Profit last week', expr: 'self._profit', format: 'signedMoney' }],
      effects: [{ op: 'set', path: 'self.fareMult', value: '+param.mult' }], result: '{self.name} fares set to {pct(param.mult)} of market' },
    { id: 'setFrequency', label: 'Set frequency', verb: 'Reschedule', kind: 'route', category: 'network', icon: 'calendar',
      describe: 'Fewer flights save fuel, crew, maintenance and fees — but business travelers value frequency.',
      tradeoff: 'Aircraft costs (leases) stay the same however much you fly them.',
      params: [{ id: 'freq', label: 'Round trips per week', type: 'choice', default: 'self.freqTarget', options: FREQ_OPTS }],
      vars: { sc2: "+param.freq > 0 ? min(1, 2 * param.freq / max(1, self.maxLegs)) : 1" },
      forecast: { kind: 'route', exclude: 'self', set: { a: 'self.a', b: 'self.b', dist: 'self.dist', key: 'self.key', fareMult: 'self.fareMult', freqTarget: '+param.freq', nAircraft: 'self.nAircraft', maxLegs: 'self.maxLegs', scale: 'sc2', seats: 'self.seats / self.scale * sc2', freq: 'self.maxLegs * sc2 / 2', fuelBurn: 'self.fuelBurn / self.scale * sc2', crewBase: 'self.crewBase / self.scale * sc2', maintBase: 'self.maintBase / self.scale * sc2', ownCost: 'self.ownCost', hubLvl: 'self.hubLvl', feeAvg: 'self.feeAvg', refFare: 'self.refFare' } },
      preview: [{ label: 'Round trips / week', expr: 'round(self.maxLegs * sc2 / 2)', format: 'int' }, { label: 'Expected load factor', expr: 'fc.load', format: 'pct' }, { label: 'Expected weekly profit', expr: 'fc.profit', format: 'signedMoney' }, { label: 'Profit last week', expr: 'self._profit', format: 'signedMoney' }],
      effects: [{ op: 'set', path: 'self.freqTarget', value: '+param.freq' }], result: '{self.name} rescheduled' },
    { id: 'orderAircraft', label: 'Order new aircraft', verb: 'Order', category: 'fleet', icon: 'factory', primary: true,
      describe: 'Order factory-fresh aircraft. Cheapest to operate, but you wait for a production slot.',
      tradeoff: '20% deposit now, the rest at delivery. Long lead times mean you are betting on future demand.',
      risk: 'A downturn could hit just as they arrive; used-aircraft values swing with the cycle.',
      params: [
        { id: 'type', label: 'Aircraft type', type: 'entity', kind: 'aircraftType', filter: "!it.usedOnly && it.firstYear <= time.year && ((it.category != 'widebody' && it.category != 'jumbo') || !org.isPlayer || tierIndex() >= 2)", sort: '-it.price' },
        { id: 'qty', label: 'Quantity', type: 'int', min: 1, max: 12, default: 2, aiValue: 'randInt(2, 6)' },
        { id: 'finance', label: 'Pay the balance with', type: 'choice', default: 'cash', options: [{ value: 'cash', label: 'Cash at delivery' }, { value: 'loan', label: 'Aircraft loan (10 yrs)' }], aiValue: "org.cash > param.type.price * param.qty * 1.5 ? 'cash' : 'loan'" }
      ],
      cost: { cash: 'param.type.price * param.qty * 0.2' }, capex: true, costCategory: 'Capex',
      preview: [{ label: 'List price total', expr: 'param.type.price * param.qty', format: 'money' }, { label: 'Deposit now', expr: 'param.type.price * param.qty * 0.2', format: 'money' }, { label: 'Delivery in', expr: 'param.type.leadWeeks + " weeks (" + date(time.tick + param.type.leadWeeks) + ")"', format: 'text' }, { label: 'Seats each', expr: 'param.type.seats', format: 'int' }, { label: 'Range', expr: 'param.type.range', format: 'km' }],
      effects: [{ op: 'project', id: 'aircraftOrder', set: { type: 'param.type', qty: 'param.qty', finance: 'param.finance' }, name: '{param.qty}× {param.type.name}' }],
      result: 'Ordered {param.qty}× {param.type.name}',
      ai: { score: "org.idle + sum(projectsOf(org), it.qty ?? 1) < 1 + org.fleet * 0.04 && org.cash > param.type.price * param.qty * 0.6 && org.loadFactor > 0.82 && org.margin > 0 ? param.qty * param.type.seats * 4000 : 0", candidates: 2, news: '{org.name} orders {param.qty} {param.type.name}' } },
    { id: 'leaseAircraft', label: 'Lease aircraft', verb: 'Lease', category: 'fleet', icon: 'key',
      describe: 'Lease mid-life aircraft from a lessor. Fast and capital-light, expensive over time.',
      tradeoff: 'No big outlay, but monthly lease payments for as long as you keep them.',
      params: [
        { id: 'type', label: 'Aircraft type', type: 'entity', kind: 'aircraftType', filter: "it.firstYear <= time.year - 2 && ((it.category != 'widebody' && it.category != 'jumbo') || !org.isPlayer || tierIndex() >= 2)", sort: '-it.seats' },
        { id: 'qty', label: 'Quantity', type: 'int', min: 1, max: 8, default: 1, aiValue: 'randInt(1, 3)' }
      ],
      cost: { cash: 'param.type.leaseMonthly * param.qty' }, costCategory: 'Lease deposits',
      preview: [{ label: 'Lease per aircraft', expr: 'param.type.leaseMonthly', format: 'money' }, { label: 'Weekly cost (all)', expr: 'param.type.leaseMonthly * 12 / 52 * param.qty', format: 'money' }, { label: 'Delivery', expr: '"8 weeks"', format: 'text' }],
      effects: [{ op: 'project', id: 'leaseDelivery', set: { type: 'param.type', qty: 'param.qty' }, name: '{param.qty}× {param.type.name} (lease)' }],
      result: 'Leasing {param.qty}× {param.type.name}',
      ai: { score: "org.idle + sum(projectsOf(org), it.qty ?? 1) < 1 && org.loadFactor > 0.84 && org.margin > -0.02 ? param.qty * param.type.seats * 2500 : 0", candidates: 2, news: '{org.name} leases {param.qty} {param.type.name}' } },
    { id: 'buyUsed', label: 'Buy used aircraft', verb: 'Buy used', category: 'fleet', icon: 'tag',
      describe: 'Buy an older aircraft on the secondary market. Cheap now, thirstier and costlier to maintain.',
      tradeoff: 'About half the price of new, but older airframes burn more maintenance and draw regulator attention.',
      params: [{ id: 'type', label: 'Aircraft type', type: 'entity', kind: 'aircraftType', filter: "it.firstYear <= time.year - 8 && ((it.category != 'widebody' && it.category != 'jumbo') || tierIndex() >= 2)", sort: '-it.seats' }],
      cost: { cash: 'param.type.price * 0.42 * (0.8 + 0.2 * world.demand)' }, capex: true, costCategory: 'Capex',
      preview: [{ label: 'Price', expr: 'param.type.price * 0.42 * (0.8 + 0.2 * world.demand)', format: 'money' }, { label: 'Typical age', expr: '"10–16 years"', format: 'text' }, { label: 'Delivery', expr: '"4 weeks"', format: 'text' }],
      effects: [{ op: 'project', id: 'usedDelivery', set: { type: 'param.type' }, name: 'Used {param.type.name}' }], result: 'Bought a used {param.type.name}' },
    { id: 'sellAircraft', label: 'Sell / return aircraft', verb: 'Dispose', kind: 'aircraft', category: 'fleet', icon: 'close', danger: true,
      describe: 'Owned aircraft are sold at market value; leased aircraft are returned with a 3-month penalty.',
      preview: [{ label: 'Cash effect', expr: 'self.leased ? -self.type.leaseMonthly * 3 : self.value', format: 'signedMoney' }, { label: 'Currently flying', expr: 'self.route ? self.route.name : "Idle"', format: 'text' }],
      effects: [{ op: 'cash', amount: 'self.leased ? -self.type.leaseMonthly * 3 : self.value', category: 'Asset sales' }, { op: 'remove', target: 'self' }],
      result: '{self.leased ? "Returned" : "Sold"} {self.name} ({self.type.name})',
      ai: { score: '!self.route && org.cash < 0 ? self.value : 0', selfSample: 4 } },
    { id: 'reassignAircraft', label: 'Assign to a route', verb: 'Assign', kind: 'aircraft', category: 'fleet', icon: 'route',
      describe: 'Move this aircraft to one of your routes.',
      params: [{ id: 'route', label: 'Route', type: 'entity', kind: 'route', filter: 'it.owner == org && it.dist <= self.type.range && it != self.route', sort: 'it._load' }],
      effects: [{ op: 'set', path: 'self.route', value: 'param.route' }], result: '{self.name} now flies {param.route.name}' },
    { id: 'openBase', label: 'Open a base', verb: 'Open base', category: 'network', icon: 'hub',
      describe: 'Station crews and aircraft at a new airport so routes can start there.',
      tradeoff: 'Upfront cost and weekly upkeep; spreads your network thinner.',
      params: [{ id: 'airport', label: 'Airport', type: 'entity', kind: 'airport', filter: "!ownsAt('base', 'airport', it) && (ownsAt('route', 'a', it) || ownsAt('route', 'b', it))", sort: 'it.pop * it.wealth' }],
      requires: [{ expr: "count(owned('base', org)) < 2 + org.fleet / 12", msg: 'Grow your fleet before opening more bases (one base per ~12 aircraft)' }],
      cost: { cash: 'params.baseCost * (0.6 + param.airport.wealth * 0.4)' }, capex: true,
      preview: [{ label: 'Opening cost', expr: 'params.baseCost * (0.6 + param.airport.wealth * 0.4)', format: 'money' }, { label: 'Weekly upkeep', expr: '45000', format: 'money' }],
      effects: [{ op: 'create', kind: 'base', set: { airport: 'param.airport', level: '1' } }, { op: 'news', text: 'New base at {param.airport.city}' }],
      result: 'Opened a base at {param.airport.city}',
      ai: { score: "count(owned('base', org)) < 2 + org.fleet / 12 && org.cash > 50000000 ? param.airport.pop * 1000000 : 0", candidates: 2 } },
    { id: 'upgradeBase', label: 'Upgrade to focus city / hub', verb: 'Upgrade', kind: 'base', category: 'network', icon: 'up',
      describe: 'Hubs make every connecting route more attractive and cut airport costs, but they are expensive to run.',
      tradeoff: 'Big investment and weekly upkeep; concentration attracts regulators.',
      requires: [{ expr: 'self.level < 3', msg: 'Already a hub' }, { expr: 'self.level == 1 ? org.fleet >= 12 : org.fleet >= 35', msg: 'Needs {self.level == 1 ? 12 : 35}+ aircraft' }],
      cost: { cash: 'self.level == 1 ? 25000000 : 90000000' }, capex: true,
      preview: [{ label: 'Cost', expr: 'self.level == 1 ? 25000000 : 90000000', format: 'money' }, { label: 'New weekly upkeep', expr: 'self.level == 1 ? 180000 : 520000', format: 'money' }, { label: 'Routes touching it', expr: "count(owned('route', org), it.a == self.airport || it.b == self.airport)", format: 'int' }],
      effects: [{ op: 'add', path: 'self.level', value: '1' }, { op: 'news', text: '{self.airport.city} becomes a {self.level == 3 ? "hub" : "focus city"}' }],
      result: '{self.airport.city} upgraded',
      ai: { score: "org.cash > (self.level == 1 ? 60000000 : 250000000) ? count(owned('route', org), it.a == self.airport || it.b == self.airport) * 1000 : 0", selfSample: 2 } },
    { id: 'negotiateAirport', label: 'Negotiate an airport agreement', verb: 'Negotiate', category: 'network', icon: 'handshake',
      describe: 'Secure slots at a congested airport and a 15% fee discount, for an annual commitment.',
      params: [{ id: 'airport', label: 'Airport', type: 'entity', kind: 'airport', filter: "!ownsAt('agreement', 'airport', it) && (it.congestion >= 0.6 || ownsAt('base', 'airport', it))", sort: 'it.congestion' }],
      effects: [{ op: 'negotiate', id: 'airportDeal', with: 'param.airport' }], playerOnly: true },
    { id: 'changeCabin', label: 'Change cabin product', verb: 'Refit', category: 'commercial', icon: 'seat',
      describe: 'Reposition the whole airline: no-frills, standard, or a premium cabin.',
      tradeoff: 'Premium attracts business travelers and raises costs per passenger; no-frills sells ancillaries.',
      params: [{ id: 'level', label: 'Product', type: 'choice', default: '1', options: [{ value: 0, label: 'No-frills', describe: 'Cheapest service, best ancillaries' }, { value: 1, label: 'Standard', describe: 'Comfortable economy' }, { value: 2, label: 'Premium cabin', describe: 'Lie-flat & lounges: business travelers love it' }] }],
      requires: [{ expr: '+param.level != org.productLevel', msg: 'That is already your product' }],
      cost: { cash: "sum(owned('aircraft', org), it.type.category == 'widebody' || it.type.category == 'jumbo' ? 4000000 : it.type.seats > 100 ? 1200000 : 300000) * (+param.level == 2 ? 1 : 0.35)" }, capex: true, cooldown: 26,
      preview: [{ label: 'Refit cost', expr: "sum(owned('aircraft', org), it.type.category == 'widebody' || it.type.category == 'jumbo' ? 4000000 : it.type.seats > 100 ? 1200000 : 300000) * (+param.level == 2 ? 1 : 0.35)", format: 'money' }],
      effects: [{ op: 'set', path: 'org.productLevel', value: '+param.level' }, { op: 'news', text: 'Cabin product relaunched' }, { op: 'if', cond: '+param.level == 2', then: [{ op: 'flag', name: 'premiumCabin' }] }],
      result: 'New cabin product launched' },
    { id: 'brandCampaign', label: 'Launch a brand campaign', verb: 'Advertise', category: 'commercial', icon: 'megaphone',
      describe: 'A one-off campaign that lifts brand strength (with diminishing returns).',
      params: [{ id: 'size', label: 'Campaign size', type: 'choice', default: 'medium', options: [{ value: 'small', label: 'Regional ($3M)' }, { value: 'medium', label: 'National ($10M)' }, { value: 'large', label: 'Global ($30M)' }] }],
      vars: { spend: "param.size == 'small' ? 3000000 : param.size == 'medium' ? 10000000 : 30000000" },
      cost: { cash: 'spend' }, costCategory: 'Marketing', cooldown: 13,
      preview: [{ label: 'Brand now', expr: 'org.brand', format: 'score' }, { label: 'Expected brand gain', expr: '(100 - org.brand) * (spend / (spend + 25000000)) * 0.6', format: 'num' }],
      effects: [{ op: 'resource', id: 'brand', add: '(100 - org.brand) * (spend / (spend + 25000000)) * 0.6' }], result: 'Brand campaign launched' },
    { id: 'borrow', label: 'Borrow', verb: 'Borrow', category: 'finance', icon: 'bank',
      describe: 'Take a term loan. Rates depend on the economy and your leverage.',
      params: [{ id: 'amount', label: 'Amount', type: 'money', min: 1000000, max: 'max(1000000, borrowRoom(org))', step: 1000000, default: 'min(20000000, max(1000000, borrowRoom(org)))' }, { id: 'years', label: 'Term (years)', type: 'int', min: 2, max: 10, default: 5 }],
      requires: [{ expr: 'borrowRoom(org) >= 1000000', msg: 'Lenders will not extend more credit right now' }],
      preview: [{ label: 'Interest rate', expr: 'rateFor(org)', format: 'pct1' }, { label: 'Borrowing room', expr: 'borrowRoom(org)', format: 'money' }, { label: 'Weekly interest', expr: 'param.amount * rateFor(org) / 52', format: 'money' }],
      effects: [{ op: 'loan', amount: 'param.amount', years: 'param.years' }], result: 'Borrowed {money(param.amount)}' },
    { id: 'repay', label: 'Repay debt', verb: 'Repay', category: 'finance', icon: 'bank',
      params: [{ id: 'amount', label: 'Amount', type: 'money', min: 1000000, max: 'max(1000000, min(org.debt, org.cash))', step: 1000000, default: 'max(1000000, min(org.debt, org.cash * 0.3))' }],
      requires: [{ expr: 'org.debt > 0', msg: 'No debt to repay' }],
      effects: [{ op: 'repay', amount: 'param.amount' }], result: 'Repaid debt' },
    { id: 'issueEquity', label: 'Raise equity', verb: 'Raise', category: 'finance', icon: 'chart', tier: 'national',
      describe: 'Sell new shares to investors: cash now, at the cost of dilution and board patience.',
      cost: {}, cooldown: 52,
      preview: [{ label: 'Cash raised', expr: 'org.value * 0.12', format: 'money' }],
      effects: [{ op: 'cash', amount: 'org.value * 0.12', category: 'Equity' }, { op: 'stake', id: 'board', add: '-8' }], result: 'Raised {money(org.value * 0.12)} in new equity' }
  ];
  if (f.alliances) gdl.actions.push(
    { id: 'joinAlliance', label: 'Join an alliance', verb: 'Apply', category: 'partners', icon: 'globe', tier: 'national',
      describe: 'Alliance membership makes you more attractive to business travelers everywhere you fly.',
      tradeoff: 'Annual dues and a share of your independence.',
      params: [{ id: 'alliance', label: 'Alliance', type: 'entity', kind: 'alliance', sort: 'it.prestige' }],
      requires: [{ expr: '!org.alliance', msg: 'Leave your current alliance first' }],
      effects: [{ op: 'negotiate', id: 'allianceJoin', with: 'param.alliance' }], playerOnly: true },
    { id: 'leaveAlliance', label: 'Leave alliance', verb: 'Leave', category: 'partners', icon: 'close',
      requires: [{ expr: 'org.alliance', msg: 'Not in an alliance' }],
      effects: [{ op: 'set', path: 'org.alliance', value: "''" }, { op: 'news', text: 'You left your alliance' }], result: 'Left the alliance', playerOnly: true });
  if (f.acquisitions) gdl.actions.push(
    { id: 'acquireAirline', label: 'Acquire an airline', verb: 'Make an offer', category: 'deals', icon: 'merge', tier: 'national',
      describe: 'Buy a rival outright: its fleet, routes, bases and debts become yours.',
      tradeoff: 'Expensive, unsettles your unions and draws regulators.',
      risk: 'Integration takes months; you inherit their problems.',
      params: [{ id: 'target', label: 'Target airline', type: 'org', filter: '!it.isPlayer && it.level < 3 && it.value < org.value * 1.6', sort: '-it.value' }],
      requires: [{ expr: f.regulators ? "stake('scrutiny') < 70 || !org.isPlayer" : 'true', msg: 'Regulators would block any deal right now (scrutiny too high)' }],
      preview: [{ label: 'Target valuation', expr: 'param.target.value', format: 'money' }, { label: 'Their fleet', expr: "count(owned('aircraft', param.target))", format: 'int' }, { label: 'Their debt', expr: 'param.target.debt', format: 'money' }],
      effects: [{ op: 'negotiate', id: 'acquisition', with: 'param.target' }],
      ai: { score: "org.cash > param.target.value * 1.6 && param.target.cash < 0 ? param.target.value * 0.2 : 0", candidates: 2 } });

  /* ---------------- projects ---------------- */
  gdl.projects = [
    { id: 'aircraftOrder', label: 'Aircraft order', capex: true,
      stages: [{ id: 'build', label: 'In production', duration: 'p.type.leadWeeks' }],
      onComplete: [
        { op: 'create', kind: 'aircraft', count: 'p.qty', set: { type: 'p.type', age: '0', leased: 'false' } },
        { op: 'if', cond: "p.finance == 'loan'", then: [{ op: 'loan', amount: 'p.type.price * p.qty * 0.8', years: '10' }] },
        { op: 'cash', amount: '-p.type.price * p.qty * 0.8', category: 'Capex', capex: true },
        { op: 'news', text: 'Delivered: {p.qty}× {p.type.name} — assign them to routes' }
      ], doneNews: 'Delivery complete: {p.name}', donePriority: 'important' },
    { id: 'earlyDelivery', label: 'Early delivery', capex: true,
      stages: [{ id: 'build', label: 'Final assembly', duration: '26' }],
      onComplete: [
        { op: 'create', kind: 'aircraft', count: 'p.qty', set: { type: 'p.type', age: '0', leased: 'false' } },
        { op: 'if', cond: 'player.cash < p.type.price * p.qty * 0.74', then: [{ op: 'loan', amount: 'p.type.price * p.qty * 0.74', years: '10' }] },
        { op: 'cash', amount: '-p.type.price * p.qty * 0.74', category: 'Capex', capex: true },
        { op: 'news', text: 'Delivered early: {p.qty}× {p.type.name} — assign them to routes' }
      ], donePriority: 'important' },
    { id: 'leaseDelivery', label: 'Lease delivery', stages: [{ id: 'deliver', label: 'Ferrying from lessor', duration: '8' }],
      onComplete: [{ op: 'create', kind: 'aircraft', count: 'p.qty', set: { type: 'p.type', age: 'randInt(3, 9)', leased: 'true' } }] },
    { id: 'usedDelivery', label: 'Used aircraft', stages: [{ id: 'deliver', label: 'Inspection & ferry', duration: '4' }],
      onComplete: [{ op: 'create', kind: 'aircraft', set: { type: 'p.type', age: 'randInt(10, 16)', leased: 'false' } }] },
    { id: 'integration', label: 'Merger integration', stages: [{ id: 'integrate', label: 'Integrating operations', duration: '26', cost: 'p.cost / 26', risk: { chance: '0.02', effects: [{ op: 'set', path: 'org.disruption', value: '0.25' }], news: 'Integration glitch: crews and IT systems clash' } }],
      onComplete: [{ op: 'news', text: 'Integration complete: {p.name}' }] }
  ];

  /* ---------------- negotiations ---------------- */
  gdl.negotiations = [
    { id: 'airportDeal', label: 'Airport agreement', with: 'airport', patience: 3, counter: { term: 'fee' },
      terms: [{ id: 'fee', label: 'Annual fee', type: 'money', default: '(1000000 + 5000000 * them.congestion * them.wealth) * 0.7', min: 0, max: '50000000', step: 100000 }, { id: 'years', label: 'Years', type: 'int', default: 5, min: 3, max: 10 }],
      value: 'terms.fee * (1 + 0.04 * terms.years)', reservation: '(1000000 + 5000000 * them.congestion * them.wealth) * (1 + 0.5 * them.congestion) * 1.2',
      reasons: [{ when: 'terms.fee < them.congestion * 3000000', text: 'Slots at {them.city} are scarce — they expect a premium' }, { when: 'terms.years < 5', text: 'They prefer a longer commitment' }],
      onAccept: [{ op: 'create', kind: 'agreement', set: { airport: 'them', fee: 'terms.fee', expires: 'time.tick + terms.years * 52' } }, { op: 'news', text: 'Airport agreement signed at {them.city}: slots secured' }],
      acceptNews: 'Agreement signed with {them.city} airport' },
    { id: 'laborContract', label: 'Union contract', with: 'union', patience: 3, counter: { term: 'raise' },
      terms: [{ id: 'raise', label: 'Pay raise', type: 'pct', default: '0.02', min: 0, max: 0.25, step: 0.005 }, { id: 'years', label: 'Contract years', type: 'int', default: 3, min: 2, max: 5 }],
      value: 'terms.raise + 0.004 * (terms.years - 3)',
      reservation: "max(0.01, 0.022 + max(0, org.margin) * 0.22 + (world.wageIndex / org.payContract - 1) + (stake('union') < 40 ? 0.015 : 0))",
      reasons: [{ when: 'org.margin > 0.1', text: 'Crews know the airline is very profitable' }, { when: 'world.wageIndex > org.payContract * 1.03', text: 'Market wages have outpaced your pay scale' }],
      onAccept: [{ op: 'mul', path: 'org.payContract', value: '1 + terms.raise' }, { op: 'set', path: 'org.contractUntil', value: 'time.tick + terms.years * 52' }, { op: 'stake', id: 'union', add: '20' }],
      onReject: [{ op: 'stake', id: 'union', add: '-10' }], acceptNews: 'New union contract: {pct1(terms.raise)} raise for {terms.years} years' },
    { id: 'allianceJoin', label: 'Alliance membership', with: 'alliance', patience: 3, counter: { term: 'fee' },
      terms: [{ id: 'fee', label: 'Annual contribution', type: 'money', default: '2000000', min: 0, max: '40000000', step: 250000 }],
      value: 'terms.fee / 1000000 + org.fleet * 0.2 + org.brand * 0.1 + org.destinations * 0.1', reservation: 'them.prestige',
      reasons: [{ when: 'org.fleet < 20', text: 'Your network is small for an alliance of this stature' }, { when: 'org.brand < 45', text: 'Members worry about your brand' }],
      onAccept: [{ op: 'set', path: 'org.alliance', value: 'them.id' }, { op: 'cash', amount: '-terms.fee', category: 'Alliance dues' }, { op: 'flag', name: 'joinedAlliance' }],
      acceptNews: 'You joined {them.name}' },
    { id: 'acquisition', label: 'Acquisition', with: 'org', patience: 2, counter: { term: 'price' },
      terms: [{ id: 'price', label: 'Offer price', type: 'money', default: 'them.value * 1.1', min: 0, max: 'them.value * 4 + 1', step: 1000000 }],
      value: 'terms.price', reservation: "them.value * (1.25 + (them.archetype == 'legacy' ? 0.2 : 0)) * (them.cash < 0 ? 0.7 : 1)",
      reasons: [{ when: 'terms.price < them.value * 1.2', text: 'Shareholders expect a control premium' }, { when: 'them.cash < 0', text: 'They are short of cash — motivated sellers' }],
      onAccept: [
        { op: 'if', cond: 'org.cash < terms.price', then: [{ op: 'loan', amount: 'terms.price - org.cash + 10000000', years: '7' }] },
        { op: 'cash', amount: '-terms.price', category: 'Acquisitions' },
        { op: 'project', id: 'integration', set: { cost: 'terms.price * 0.04' }, name: 'Integrating {them.name}' },
        { op: 'acquireOrg', target: 'them' }, { op: 'add', path: 'org.acquisitions', value: '1' },
        { op: 'stake', id: 'union', add: '-10' }, { op: 'stake', id: 'scrutiny', add: '12' }
      ], acceptNews: 'Deal done: you acquire {them.name} for {money(terms.price)}' }
  ];

  /* ---------------- events (bound to real state) ---------------- */
  gdl.events = [
    { id: 'fuelSpike', trigger: 'scheduled', priority: 'critical', title: 'Oil shock: jet fuel at {money(world.fuel)}/gal',
      text: 'Fuel is {pct(world.fuel / world.fuelAvg - 1)} above its recent average. Your hedging: {policy("fuelHedging")}. Every week at these prices costs you more.',
      choices: [
        { label: 'Add a fuel surcharge', describe: 'Fares +6% on every route. Travelers notice.', effects: [{ op: 'each', list: "owned('route')", do: [{ op: 'mul', path: 'it.fareMult', value: '1.06' }] }, { op: 'resource', id: 'brand', add: '-3' }], result: 'Fuel surcharge added across the network' },
        { label: 'Absorb it', describe: 'Protect market share and brand; the board will not love the margins.', effects: [{ op: 'resource', id: 'brand', add: '2' }, { op: 'stake', id: 'board', add: '-5' }], result: 'You absorb the fuel spike' },
        { label: 'Lock in a full hedge now', describe: 'Pay a premium of {money(player.revenueYear * 0.004)} to hedge everything going forward.', cost: 'player.revenueYear * 0.004', effects: [{ op: 'policy', id: 'fuelHedging', value: "'full'" }], result: 'Fuel fully hedged' }
      ] },
    { id: 'recessionBoard', trigger: 'scheduled', priority: 'critical', title: 'Recession: the board wants a plan',
      text: 'Bookings are falling across the industry. You fly {int(player.routes)} routes; the weakest is losing {money(-minOf(owned("route"), it._profit))} a week.',
      choices: [
        { label: 'Cut the three weakest routes', describe: 'Frees aircraft, stops the bleeding, abandons some cities.', effects: [{ op: 'each', list: "top(owned('route'), -it._profit, 3)", filter: 'it._profit < 0', do: [{ op: 'each', list: "refs('aircraft', 'route', it)", as: 'ac', do: [{ op: 'set', path: 'ac.route', value: 'null' }] }, { op: 'remove', target: 'it' }] }, { op: 'stake', id: 'board', add: '8' }], result: 'Weak routes cut; the board approves' },
        { label: 'Discount to fill seats', describe: 'Fares −8% everywhere. Keeps crews flying and customers loyal.', effects: [{ op: 'each', list: "owned('route')", do: [{ op: 'mul', path: 'it.fareMult', value: '0.92' }] }, { op: 'resource', id: 'brand', add: '3' }], result: 'Recession fare sale launched' },
        { label: 'Hold course', describe: 'Bet on a short downturn.', effects: [{ op: 'stake', id: 'board', add: '-10' }], result: 'You hold course' }
      ] },
    { id: 'distressedFleet', trigger: 'scheduled', scope: 'world', priority: 'important', title: '{failed.name} has collapsed',
      text: 'Liquidators are selling its aircraft at fire-sale prices. Its passengers are looking for a new airline.',
      choices: [
        { label: 'Buy two narrowbodies at 40% of value', describe: 'Two A320neo-family jets for {money(get("aircraftType", "A20N").price * 0.8)} — about half their market value.', cost: 'get("aircraftType", "A20N").price * 0.8', effects: [{ op: 'create', kind: 'aircraft', count: '2', set: { type: "'A20N'", age: 'randInt(4, 9)', leased: 'false' } }], result: 'Picked up two jets from the liquidation' },
        { label: 'Pass', effects: [], result: 'You pass on the liquidation sale', track: { text: 'Passed on {failed.name}\'s liquidation' } }
      ] }
  ];
  if (f.labor) gdl.events.push(
    { id: 'strikeThreat', trigger: 'scheduled', priority: 'critical', title: 'The crew union threatens to strike',
      text: 'Morale has collapsed to {int(stake("union"))}. A strike would ground about two-thirds of your flights.',
      choices: [
        { label: 'Offer a 6% raise', describe: 'Raises crew costs permanently.', effects: [{ op: 'mul', path: 'player.payContract', value: '1.06' }, { op: 'stake', id: 'union', add: '28' }], result: 'Strike averted with a 6% raise' },
        { label: 'Call their bluff', describe: 'Maybe they will not walk out…', effects: [{ op: 'chance', p: '0.55', then: [{ op: 'set', path: 'player.strikeLeft', value: '3' }, { op: 'resource', id: 'brand', add: '-7' }, { op: 'stake', id: 'union', add: '6' }, { op: 'moment', title: 'Strike!', text: 'Crews walk out. Most flights are grounded for three weeks.', tone: 'bad' }, { op: 'timeline', text: 'Crew strike grounds the airline' }], else: [{ op: 'stake', id: 'union', add: '5' }, { op: 'news', text: 'The union backs down — for now' }] }], result: 'You call the union\'s bluff' },
        { label: 'Bring in a mediator', describe: 'Costs $2M and a 3% raise.', cost: '2000000', effects: [{ op: 'mul', path: 'player.payContract', value: '1.03' }, { op: 'stake', id: 'union', add: '15' }], result: 'Mediation calms the dispute' }
      ] },
    { id: 'contractTalks', priority: 'important', chance: '0.25', when: 'time.tick > player.contractUntil - 6', cooldown: 40, title: 'Union contract talks',
      text: 'The crew contract {time.tick > player.contractUntil ? "has expired" : "expires soon"}. Market wages are {pct(world.wageIndex / player.payContract - 1)} above your scale.',
      choices: [
        { label: 'Open negotiations', effects: [{ op: 'negotiate', id: 'laborContract', with: "get('union', 'union')" }], result: 'Contract negotiations open' },
        { label: 'Impose a pay freeze', describe: 'Saves money; morale plunges.', effects: [{ op: 'stake', id: 'union', add: '-25' }, { op: 'set', path: 'player.contractUntil', value: 'time.tick + 52' }, { op: 'stake', id: 'board', add: '4' }], result: 'Pay freeze imposed' }
      ] });
  gdl.events.push(
    { id: 'fareWar', priority: 'important', chance: '0.05', cooldown: 20, title: '{rv.owner.name} undercuts you on {r.name}',
      text: 'A rival dropped fares on the {r.a.city}–{r.b.city} route, where you carry {int(r._sold)} passengers a week at {pct(r._load)} load.',
      bind: { r: { kind: 'route', owner: 'player', filter: 'it._sold > 300' }, rv: { kind: 'route', owner: 'rival', filter: 'it.key == r.key' } },
      choices: [
        { label: 'Match their fares', describe: 'Fares −15% on this route.', effects: [{ op: 'mul', path: 'r.fareMult', value: '0.85' }, { op: 'remember', a: 'rv.owner', b: 'player', key: 'rivalry', add: '5' }], result: 'You match the fare cut on {r.name}' },
        { label: 'Hold your fares', describe: 'Trust your product and schedule.', effects: [{ op: 'remember', a: 'rv.owner', b: 'player', key: 'rivalry', add: '2' }], result: 'You hold fares on {r.name}' },
        { label: 'Add capacity and fight', describe: 'Put an idle aircraft on the route.', requires: "count(owned('aircraft'), !it.route && it.type.range >= r.dist) > 0", effects: [{ op: 'set', path: 'r.fareMult', value: 'r.fareMult * 0.92' }, { op: 'each', list: "top(filter(owned('aircraft'), !it.route && it.type.range >= r.dist), it.type.seats, 1)", do: [{ op: 'set', path: 'it.route', value: 'r' }] }, { op: 'remember', a: 'rv.owner', b: 'player', key: 'rivalry', add: '8' }], result: 'You flood {r.name} with capacity' }
      ] },
    { id: 'incident', priority: 'critical', chance: "0.004 * (player.maintMult < 1 ? 3 : 1)", cooldown: 26, title: 'Safety incident: {ac.name} ({ac.type.name})',
      text: 'A {int(ac.age)}-year-old aircraft suffered an engine problem on {ac.route ? ac.route.name : "a ferry flight"}. Nobody was hurt; the press is asking questions.',
      bind: { ac: { kind: 'aircraft', owner: 'player', filter: 'it.age >= 12', pick: 'max', by: 'it.age' } },
      choices: [
        { label: 'Ground the aircraft for a full inspection', describe: 'Takes it out of service.', effects: [{ op: 'set', path: 'ac.route', value: 'null' }, { op: 'resource', id: 'brand', add: '-2' }, { op: 'stake', id: 'scrutiny', add: '3' }], result: '{ac.name} grounded for inspection' },
        { label: 'Retire it now', describe: 'Sell it for scrap value.', effects: [{ op: 'cash', amount: 'ac.value * 0.3', category: 'Asset sales' }, { op: 'remove', target: 'ac' }, { op: 'resource', id: 'brand', add: '-1' }], result: '{ac.name} retired' },
        { label: 'Quick check, keep flying', describe: 'Cheapest — regulators will not like it.', effects: [{ op: 'stake', id: 'scrutiny', add: '12' }, { op: 'resource', id: 'brand', add: '-6' }], result: 'Quick check only; regulators take note' }
      ] },
    { id: 'airportIncentive', priority: 'important', chance: '0.025', cooldown: 30, minTick: 6, title: '{d.city} wants you',
      text: '{d.airport} offers {money(1500000 + d.pop * 300000)} in marketing support if you launch service within a quarter.',
      bind: { d: { kind: 'airport', filter: "!ownsAt('route', 'a', it) && !ownsAt('route', 'b', it) && it.congestion < 0.6 && minOf(owned('base'), distance(it.airport, outer)) <= player.maxRange && minOf(owned('base'), distance(it.airport, outer)) >= 300" } },
      choices: [
        { label: 'Accept the deal', describe: 'Cash now — repay double if no route by the deadline.', effects: [{ op: 'cash', amount: '1500000 + d.pop * 300000', category: 'Incentives' }, { op: 'set', path: 'd.incentiveBy', value: 'player.id' }, { op: 'set', path: 'd.incentiveDue', value: 'time.tick + 13' }, { op: 'event', id: 'incentiveCheck', delay: '13', bind: { d: 'd' } }], result: 'Incentive accepted: launch a route to {d.city} within 13 weeks' },
        { label: 'Decline', effects: [], result: 'You decline {d.city}\'s offer', track: { text: 'Declined launch incentives from {d.city}', ref: 'd', value: "sum(where('route','b', d), it._sold) + sum(where('route','a', d), it._sold)" } }
      ] },
    { id: 'incentiveCheck', trigger: 'scheduled', priority: 'routine', title: 'Incentive deadline: {d.city}',
      effects: [{ op: 'if', cond: "!ownsAt('route', 'a', d) && !ownsAt('route', 'b', d)", then: [{ op: 'cash', amount: '-(1500000 + d.pop * 300000) * 2', category: 'Penalties' }, { op: 'news', text: 'You missed the {d.city} launch deadline and repaid the incentive with a penalty', priority: 'important' }], else: [{ op: 'news', text: '{d.city} incentive earned — service launched on time' }] }] },
    { id: 'winterStorm', priority: 'routine', chance: '(time.month == 12 || time.month <= 2) ? 0.08 : 0', cooldown: 4, title: 'Winter storm hits {b.airport.city}',
      bind: { b: { kind: 'base', owner: 'player', filter: 'it.airport.lat > 38 || it.airport.lat < -38' } },
      effects: [{ op: 'add', path: 'player.disruption', value: '0.12' }], news: 'Winter storm snarls operations at {b.airport.city}; delays ripple through the network' },
    { id: 'manufacturerOffer', priority: 'important', chance: '0.012', cooldown: 52, minTick: 20, title: 'A manufacturer offers early delivery slots',
      text: 'A customer cancelled. You can take two {t.name} in 26 weeks instead of {t.leadWeeks}, at 8% off list.',
      bind: { t: { kind: 'aircraftType', filter: "!it.usedOnly && it.firstYear <= time.year && (it.category == 'narrowbody' || (tierIndex() >= 2 && it.category == 'widebody'))" } },
      choices: [
        { label: 'Take the slots (20% deposit)', describe: 'Deposit {money(t.price * 2 * 0.2 * 0.92)} now; the balance (financed if needed) on delivery in 26 weeks.', cost: 't.price * 2 * 0.2 * 0.92', effects: [{ op: 'project', id: 'earlyDelivery', set: { type: 't', qty: '2' }, name: '2× {t.name} (early slots)' }], result: 'Two {t.name} arriving in 26 weeks' },
        { label: 'Pass', effects: [], result: 'You pass on the delivery slots' }
      ] },
    { id: 'boardUltimatum', trigger: 'scheduled', priority: 'critical', title: 'The board loses patience',
      text: 'Confidence is down to {int(stake("board"))}. Directors want results this year — or a new CEO.',
      choices: [
        { label: 'Announce cost cuts', describe: 'Crew pay −3%. The union will be furious.', effects: [{ op: 'mul', path: 'player.payContract', value: '0.97' }, { op: 'stake', id: 'union', add: '-15' }, { op: 'stake', id: 'board', add: '15' }], result: 'Cost-cutting plan approved' },
        { label: 'Sell and lease back five jets', describe: 'Cash now, higher costs later.', requires: "count(owned('aircraft'), !it.leased) >= 5", effects: [{ op: 'each', list: "top(filter(owned('aircraft'), !it.leased), it.value, 5)", do: [{ op: 'cash', amount: 'it.value * 0.9', category: 'Asset sales' }, { op: 'set', path: 'it.leased', value: 'true' }] }, { op: 'stake', id: 'board', add: '10' }], result: 'Sale-leaseback completed' },
        { label: 'Ask for more time', effects: [{ op: 'chance', p: '0.5', then: [{ op: 'stake', id: 'board', add: '6' }], else: [{ op: 'stake', id: 'board', add: '-6' }] }], result: 'You ask the board for patience' }
      ] },
    { id: 'viral', priority: 'routine', chance: '0.01', cooldown: 26, when: 'player.brand > 45', title: 'A viral moment',
      effects: [{ op: 'resource', id: 'brand', add: '3' }], news: 'A crew\'s kindness to a stranded family goes viral — bookings tick up' }
  );
  if (f.regulators) gdl.events.push(
    { id: 'investigation', trigger: 'scheduled', priority: 'important', title: 'Regulators open an investigation',
      text: 'Scrutiny has reached {int(stake("scrutiny"))}. Investigators cite {player.hubDominance > 0.6 ? "your dominance at your hub" : player.fleetAge > 14 ? "your aging fleet" : "your operational record"}.',
      choices: [
        { label: 'Cooperate and settle', describe: 'Fine of about {money(player.revenueYear * 0.01 + 1000000)}.', cost: 'player.revenueYear * 0.01 + 1000000', effects: [{ op: 'stake', id: 'scrutiny', add: '-22' }], result: 'Investigation settled' },
        { label: 'Fight it', describe: 'Maybe you win. Maybe it gets worse.', effects: [{ op: 'chance', p: '0.5', then: [{ op: 'stake', id: 'scrutiny', add: '-10' }, { op: 'news', text: 'You beat the regulators' }], else: [{ op: 'cash', amount: '-(player.revenueYear * 0.03 + 3000000)', category: 'Fines' }, { op: 'resource', id: 'brand', add: '-5' }, { op: 'news', text: 'You lose the case: a heavy fine and bad press', priority: 'important' }] }], result: 'You fight the regulators' }
      ] });
  if (f.alliances) gdl.events.push(
    { id: 'allianceInvite', priority: 'important', chance: '0.02', cooldown: 52, when: "!player.alliance && tierIndex() >= 1 && player.fleet >= 18", title: '{al.name} wants to talk',
      text: 'Members see your network as a useful complement. Membership would lift your appeal to business travelers.',
      bind: { al: { kind: 'alliance' } },
      choices: [{ label: 'Open membership talks', effects: [{ op: 'negotiate', id: 'allianceJoin', with: 'al' }], result: 'Alliance talks open' }, { label: 'Stay independent', effects: [], result: 'You stay independent' }] });

  /* ---------------- progression ---------------- */
  gdl.progression = {
    tiers: [
      { id: 'regional', label: 'Regional airline', describe: 'Domestic routes up to 2,500 km.' },
      { id: 'national', label: 'National carrier', when: 'player.fleet >= 18 && player.destinations >= 12', text: 'International routes up to 4,800 km, alliances, acquisitions and equity raises are now open.' },
      { id: 'continental', label: 'Continental carrier', when: 'player.fleet >= 45 && player.revenueYear >= 1200000000', text: 'Widebody aircraft and routes up to 9,500 km are now open.' },
      { id: 'global', label: 'Global carrier', when: 'player.fleet >= 110 && player.longHaul >= 8 && player.regions >= 3', text: 'You fly the world. Every route is open — and every regulator is watching.' }
    ],
    objectives: {
      count: 3,
      templates: [
        { id: 'margin', text: 'Deliver an operating margin of at least {pct(target)}', metric: 'player.margin', target: 'max(0.03, min(0.12, base + 0.02))', weight: 2, reward: [{ op: 'stake', id: 'board', add: '12' }], penalty: [{ op: 'stake', id: 'board', add: '-14' }] },
        { id: 'pax', text: 'Grow to {int(target)} passengers a week', metric: 'player.weeklyPax', target: 'max(base * 1.25, base + 2000)', weight: 2, reward: [{ op: 'stake', id: 'board', add: '10' }], penalty: [{ op: 'stake', id: 'board', add: '-10' }] },
        { id: 'dest', text: 'Serve {int(target)} destinations', metric: 'player.destinations', target: 'base + 4', reward: [{ op: 'stake', id: 'board', add: '8' }], penalty: [{ op: 'stake', id: 'board', add: '-8' }] },
        { id: 'ontime', text: 'Run at least {pct(target)} on time', metric: 'player.onTime', target: '0.82', reward: [{ op: 'resource', id: 'brand', add: '3' }, { op: 'stake', id: 'board', add: '6' }], penalty: [{ op: 'stake', id: 'board', add: '-6' }] },
        { id: 'load', text: 'Average a {pct(target)} load factor', metric: 'player.loadFactor', target: '0.8', reward: [{ op: 'stake', id: 'board', add: '8' }], penalty: [{ op: 'stake', id: 'board', add: '-8' }] },
        { id: 'debt', when: 'player.debt > 20000000', text: 'Cut debt below {money(target)}', metric: 'player.debt', check: '<=', target: 'base * 0.8', reward: [{ op: 'stake', id: 'board', add: '10' }], penalty: [{ op: 'stake', id: 'board', add: '-8' }] }
      ]
    },
    failure: {
      when: "player.cash < -creditLimit(player) || stake('board') < 6",
      grace: 10, warningTitle: 'Crisis at the top',
      warning: 'Lenders are calling and the board is meeting without you. Pick a rescue plan within ten weeks.',
      gameOver: 'The board has replaced you as CEO. {player.name} will carry on without you.',
      rescue: [
        { id: 'equity', label: 'Emergency equity from investors', describe: 'Raise {money(max(30000000, player.value * 0.25))}; investors take a big stake and the board loses faith.', once: true, effects: [{ op: 'cash', amount: 'max(30000000, player.value * 0.25)', category: 'Equity' }, { op: 'stake', id: 'board', add: '15' }] },
        { id: 'saleLeaseback', label: 'Sell and lease back the owned fleet', describe: 'Turn owned aircraft into cash at 85% of value; pay leases from now on.', requires: "count(owned('aircraft'), !it.leased) > 0", effects: [{ op: 'each', list: "filter(owned('aircraft'), !it.leased)", do: [{ op: 'cash', amount: 'it.value * 0.85', category: 'Asset sales' }, { op: 'set', path: 'it.leased', value: 'true' }] }, { op: 'stake', id: 'board', add: '10' }] },
        { id: 'restructure', label: 'Court-supervised restructuring', describe: 'Halve your debts. Crews take a pay cut, the brand suffers.', once: true, effects: [{ op: 'forgiveDebt', fraction: '0.5' }, { op: 'mul', path: 'player.payContract', value: '0.9' }, { op: 'stake', id: 'union', add: '-30' }, { op: 'resource', id: 'brand', add: '-15' }, { op: 'stake', id: 'board', add: '20' }] }
      ]
    },
    victory: [
      { id: 'top3', label: 'One of the big three', when: "count(rivals(), it.level < 3 && it.weeklyPax > player.weeklyPax) <= 2 && tierIndex() >= 2", text: 'Only two airlines in the world carry more passengers than you.' },
      { id: 'globalLeader', label: 'World\'s largest airline', when: "count(rivals(), it.level < 3 && it.weeklyPax > player.weeklyPax) == 0 && tierIndex() >= 3", text: 'No airline on Earth carries more passengers.' }
    ]
  };

  /* ---------------- history ---------------- */
  gdl.history = {
    records: [
      { id: 'fleet', label: 'Largest fleet', expr: 'org.fleet', format: 'int' },
      { id: 'pax', label: 'Most passengers in a week', expr: 'org.weeklyPax', format: 'int' },
      { id: 'profitYear', label: 'Highest annual profit', expr: 'org.profitYear', format: 'money', period: 'year' },
      { id: 'longest', label: 'Longest route', scope: 'kind:route', expr: 'self.dist', format: 'km' },
      { id: 'loadYear', label: 'Best annual load factor', expr: 'org.loadFactor', format: 'pct', period: 'year', min: 0.3 }
    ],
    awards: [
      { id: 'airlineOfYear', label: 'Airline of the Year', score: 'org.satisfaction + org.onTime * 60 + org.margin * 120 + log(1 + org.fleet) * 3', noise: 2, prize: [{ op: 'resource', id: 'brand', add: '4' }] },
      { id: 'mostPunctual', label: 'Most Punctual Airline', score: 'org.onTime * 100', filter: 'org.fleet >= 6', noise: 0.5, prize: [{ op: 'resource', id: 'brand', add: '2' }] },
      { id: 'bestValue', label: 'Best Value Carrier', score: 'org.loadFactor * 60 - org.yield / 10 + org.satisfaction * 0.3', filter: 'org.productLevel <= 1 && org.fleet >= 6', noise: 1.5, prize: [{ op: 'resource', id: 'brand', add: '2' }] }
    ],
    milestones: [
      { id: 'firstRoute', label: 'Your first new route', when: "count(owned('route'), it.launched > 0) >= 1", text: 'The first route of your own design is flying.', moment: false },
      { id: 'firstJet', label: 'First mainline jet', when: "count(owned('aircraft'), it.type.seats >= 140) >= 1", text: 'A real mainline jet in your colors.' },
      { id: 'firstIntl', label: 'Going international', when: 'player.intlRoutes >= 1', text: 'Your first international route takes off.' },
      { id: 'firstHub', label: 'A true hub', when: "count(owned('base'), it.level == 3) >= 1", text: 'Connecting passengers now flow through your own hub.' },
      { id: 'fleet25', label: '25 aircraft', when: 'player.fleet >= 25', text: 'Twenty-five aircraft wear your livery.' },
      { id: 'firstLongHaul', label: 'Long haul', when: 'player.longHaul >= 1', text: 'Your first flight across an ocean.' },
      { id: 'millionPax', label: 'A million passengers a year', when: 'player.weeklyPax * 52 >= 1000000', text: 'One million passengers a year trust you to fly them.' },
      { id: 'fleet100', label: '100 aircraft', when: 'player.fleet >= 100', text: 'A hundred aircraft. You are a major airline.' },
      { id: 'alliance', label: 'Alliance member', when: 'player.alliance', text: 'Your passengers can now reach the whole world.' },
      { id: 'acquirer', label: 'First acquisition', when: 'player.acquisitions >= 1', text: 'You bought a rival. The industry is paying attention.' },
      { id: 'profitYear', label: 'First profitable year', when: 'time.tick >= 52 && player.profitYear > 0', text: 'A full year in the black.' }
    ]
  };

  /* ---------------- needs-you hints (state-driven, not spam) ---------------- */
  gdl.needs = [
    { id: 'idle', when: 'player.idle > 0', text: '{player.idle} idle {player.idle == 1 ? "aircraft is" : "aircraft are"} costing money on the ground', sub: 'Open a route or add them to busy routes', action: 'openRoute', priority: 2, tone: 'warn' },
    { id: 'losing', forEach: 'route', when: 'time.tick - self.launched > 6 && self._profit < -40000', text: '{self.name} is losing {money(-self._profit)} a week', sub: '{self._load < 0.6 ? "Only " + pct(self._load) + " full: cut frequency or use a smaller aircraft" : "Raise fares, add hub connections or close it"}', action: 'setFrequency', priority: 1, tone: 'bad' },
    { id: 'full', forEach: 'route', when: 'self._load > 0.97 && self._demand > self._sold * 1.25', text: '{self.name} is turning away {int(self._demand - self._sold)} travelers a week', sub: 'Add an aircraft or raise fares', priority: 1, tone: 'good' },
    { id: 'cash', when: 'player.cash < 0', text: 'Cash is negative — you are running on your credit line', sub: 'Borrow, sell idle aircraft or cut losing routes', priority: 3, tone: 'bad', nav: 'corporate' }
  ];

  /* ---------------- new game ---------------- */
  gdl.newGame = {
    options: [
      { id: 'name', label: 'Airline name', type: 'text', default: 'Bluebird Air' },
      { id: 'home', label: 'Home base', type: 'choice', default: 'AUS', choices: HOME_CHOICES.map(([v, l, d]) => ({ value: v, label: l, describe: d, effects: [{ op: 'set', path: 'org.homeCode', value: `'${v}'` }] })) },
      { id: 'difficulty', label: 'Difficulty', type: 'choice', default: 'normal', choices: [{ value: 'relaxed', label: 'Relaxed' }, { value: 'normal', label: 'Normal' }, { value: 'cutthroat', label: 'Cutthroat' }] }
    ]
  };
  /* ---------------- presentation ---------------- */
  gdl.orgs.metrics.push({ id: 'weeklyProfit', label: 'Weekly profit', expr: 'org.m.profit', format: 'money' }, { id: 'cashTrack', label: 'Cash', expr: 'org.cash', format: 'money' });
  gdl.theme = Object.assign({
    name: 'Jetstream', mode: 'light', motif: 'departure-board', layout: 'sidebar', texture: 'none', radius: 6,
    palette: { bg: '#eef1f4', surface: '#ffffff', surface2: '#e8edf2', ink: '#0f1924', ink2: '#2e3c4b', muted: '#687685', line: '#d4dbe3', accent: '#0b5fa5', accentInk: '#ffffff', accent2: '#f2a516', good: '#1f8a55', bad: '#c2412d', warn: '#c98a12', info: '#2c6cb0', band: '#0d1620', bandInk: '#e9eef3' },
    paletteDark: { bg: '#0b1118', surface: '#111a24', surface2: '#18232f', ink: '#e8eef4', ink2: '#c3cdd8', muted: '#8696a7', line: '#243241', accent: '#4aa3ff', accentInk: '#06121f', accent2: '#f6b73c', good: '#4fd08a', bad: '#ff7a66', warn: '#f6b73c', info: '#6fb2ff', band: '#060b10', bandInk: '#e9eef3' },
    fonts: { display: 'condensed', body: 'sans', mono: 'board' },
    logo: { text: 'J', shape: 'tail' }
  }, opts.theme || {});
  const routeStatus = "self._cap == 0 ? 'GROUNDED' : self._profit < 0 ? 'LOSING' : self._load > 0.95 ? 'FULL' : self._load < 0.6 ? 'EMPTY SEATS' : 'ON TIME'";
  const routeTone = "self._cap == 0 || self._profit < 0 ? 'bad' : self._load > 0.95 ? 'good' : self._load < 0.6 ? 'warn' : 'good'";
  gdl.ui = {
    topbar: [
      { label: 'Cash', expr: 'player.cash', format: 'money' },
      { label: 'Profit / week', expr: 'player.m.profit', format: 'signedMoney' },
      { label: 'Load factor', expr: 'player.loadFactor', format: 'pct' },
      { label: 'Brand', expr: 'player.brand', format: 'score', explain: 'resource:brand' }
    ],
    nav: [
      { id: 'home', label: 'Operations', icon: 'home', badge: "count(owned('aircraft'), !it.route)" },
      { id: 'network', label: 'Network', icon: 'map' },
      { id: 'fleet', label: 'Fleet', icon: 'plane' },
      { id: 'commercial', label: 'Commercial', icon: 'tag' },
      { id: 'corporate', label: 'Corporate', icon: 'bank' },
      { id: 'industry', label: 'Industry', icon: 'globe' }
    ],
    screens: {
      home: {
        title: '{player.name}', subtitle: '{player.weeklyPax|int} passengers a week · {player.routes} routes · {player.fleet} aircraft',
        actions: ['openRoute', 'leaseAircraft'],
        sections: [
          { type: 'goal', width: 'full', text: 'Grow {player.name} from a regional airline into a global carrier.' },
          { type: 'needs', width: 'half', tour: 'needs', calm: 'Every aircraft is flying. Look for the next market to win.' },
          { type: 'metrics', width: 'half', key: 'home', items: [
            { label: 'Weekly profit', expr: 'player.m.profit', format: 'signedMoney', metric: 'weeklyProfit', tone: "v >= 0 ? 'good' : 'bad'" },
            { label: 'Cash', expr: 'player.cash', format: 'money', metric: 'cashTrack', sub: 'Credit line {money(creditLimit(player))}' },
            { label: 'Passengers / week', expr: 'player.weeklyPax', format: 'int', metric: 'weeklyPax' },
            { label: 'On-time', expr: 'player.onTime', format: 'pct', tone: "v >= 0.82 ? 'good' : v < 0.75 ? 'bad' : ''" }
          ] },
          { type: 'board', title: 'Departures — your routes', width: 'full', kind: 'route', owner: 'player', sort: 'it._profit', limit: 12, tour: 'board',
            columns: [{ label: 'Route', expr: 'it.name' }, { label: 'Aircraft', expr: "it.nAircraft" }, { label: 'Freq/wk', expr: 'round(it.freq)', align: 'right' }, { label: 'Load', expr: 'it._load', format: 'pct', align: 'right' }, { label: 'Avg fare', expr: 'it.refFare * it.fareMult', format: 'money', align: 'right' }, { label: 'Profit/wk', expr: 'it._profit', format: 'signedMoney', align: 'right' }],
            status: '{' + routeStatus.replace(/self\./g, 'it.') + '}', statusTone: routeTone.replace(/self\./g, 'it.'), empty: 'No routes yet — open one from the Network screen.' },
          { type: 'objectives', width: 'half' },
          { type: 'upcoming', width: 'half' },
          { type: 'world', width: 'half', vars: ['fuel', 'bizTravel'], title: 'Fuel & economy' },
          { type: 'feed', title: 'Latest', width: 'half', limit: 7, mine: true }
        ]
      },
      network: {
        title: 'Network', subtitle: '{player.destinations} destinations from {count(owned("base"))} {count(owned("base")) == 1 ? "base" : "bases"} · reach {int(player.maxRange)} km',
        actions: ['openRoute', 'openBase', 'negotiateAirport'],
        tabs: [
          { id: 'map', label: 'Route map', sections: [
            { type: 'map', title: 'Route map', width: 'full', basemap: 'world', tour: 'map',
              nodes: { kind: 'airport', size: 'max(2, sqrt(it.pop) * 1.4)', label: 'it.code', highlight: "ownsAt('base', 'airport', it)", filter: "ownsAt('base', 'airport', it)" },
              links: { kind: 'route', a: 'a', b: 'b', width: '1 + it.nAircraft', tone: 'it._profit / max(1, it._rev)' },
              legend: [{ label: 'Profitable', color: 'var(--good)' }, { label: 'Losing money', color: 'var(--bad)' }, { label: 'Rival routes', color: 'var(--muted)' }] },
            { type: 'cards', title: 'Bases & hubs', width: 'full', kind: 'base', owner: 'player', size: 's', glyph: "'hub'", sort: 'it.level', actions: ['upgradeBase'],
              stats: [{ label: 'Level', expr: "it.level == 3 ? 'Hub' : it.level == 2 ? 'Focus city' : 'Base'", format: 'text' }, { label: 'Routes', expr: "count(owned('route'), it.a == outer.airport || it.b == outer.airport)", format: 'int' }] }
          ] },
          { id: 'routes', label: 'All routes', sections: [
            { type: 'table', title: 'Your routes', width: 'full', kind: 'route', owner: 'player', sort: 'it._profit', search: true, key: 'myroutes', limit: 30,
              columns: [{ label: 'Route', expr: 'it.name' }, { label: 'Distance', expr: 'it.dist', format: 'km' }, { label: 'Aircraft', expr: 'it.nAircraft', format: 'int' }, { label: 'Seats/wk', expr: 'it._cap', format: 'int' }, { label: 'Load', expr: 'it._load', format: 'pct', tone: "v < 0.6 ? 'warn' : v > 0.95 ? 'good' : ''" }, { label: 'Fare level', expr: 'it.fareMult', format: 'pct' }, { label: 'Competitors', expr: "count(where('route', 'key', it.key)) - 1", format: 'int' }, { label: 'Profit/wk', expr: 'it._profit', format: 'signedMoney', tone: "v < 0 ? 'bad' : 'good'" }],
              rowActions: ['setFare', 'setFrequency', 'addAircraft', 'closeRoute'], empty: 'No routes yet.' }
          ] },
          { id: 'airports', label: 'Airports', sections: [
            { type: 'table', title: 'Airports in range', width: 'full', kind: 'airport', search: true, key: 'airports', sort: 'it.pop', limit: 30,
              filter: "minOf(owned('base'), distance(it.airport, outer)) <= player.maxRange",
              columns: [{ label: 'Airport', expr: "it.city + ' (' + it.code + ')'" }, { label: 'Region', expr: 'it.region', format: 'text' }, { label: 'Metro pop. (M)', expr: 'it.pop', format: 'num' }, { label: 'Wealth', expr: 'it.wealth', format: 'x' }, { label: 'Tourism', expr: 'it.tourism', format: 'x' }, { label: 'Congestion', expr: 'it.congestion', format: 'pct', tone: "v >= 0.75 ? 'bad' : ''" }, { label: 'Airlines here', expr: "len(distinct(map(concat(where('route','a', it), where('route','b', it)), it.owner)))", format: 'int' }] }
          ] }
        ]
      },
      fleet: {
        title: 'Fleet', subtitle: '{player.fleet} aircraft · average age {round(player.fleetAge, 1)} years · {player.idle} idle',
        actions: ['orderAircraft', 'leaseAircraft', 'buyUsed'],
        sections: [
          { type: 'cards', title: 'Your aircraft', width: 'full', kind: 'aircraft', owner: 'player', groupBy: 'it.type.name', sort: 'it.route ? 1 : 2', size: 'm', tour: 'fleet',
            glyph: "'plane-' + (it.type.category == 'turboprop' ? 'turboprop' : it.type.category == 'regional' ? 'regional' : it.type.category == 'narrowbody' ? 'narrowbody' : it.type.category == 'jumbo' ? 'jumbo' : 'widebody')",
            glyphColor: "it.route ? 'var(--accent)' : 'var(--muted)'", glyphScale: '0.55',
            badge: "{it.route ? 'Flying' : 'Idle'}", badgeTone: "it.route ? 'good' : 'warn'",
            stats: [{ label: 'Route', expr: "it.route ? it.route.name : '—'", format: 'text' }, { label: 'Age', expr: 'it.age', format: 'num' }, { label: 'Seats', expr: 'it.type.seats', format: 'int' }, { label: 'Ownership', expr: "it.leased ? 'Leased' : 'Owned'", format: 'text' }],
            actions: ['reassignAircraft', 'sellAircraft'], empty: 'No aircraft.' },
          { type: 'pipeline', title: 'On order & in delivery', width: 'full', empty: 'Nothing on order. New aircraft take 6–24 months; leases about 8 weeks.' },
          { type: 'table', title: 'Aircraft market', width: 'full', kind: 'aircraftType', sort: 'it.seats', key: 'types', limit: 20, filter: 'it.firstYear <= time.year',
            columns: [{ label: 'Type', expr: 'it.name' }, { label: 'Seats', expr: 'it.seats', format: 'int' }, { label: 'Range', expr: 'it.range', format: 'km' }, { label: 'New price', expr: "it.usedOnly ? 'Used only' : money(it.price)", format: 'text' }, { label: 'Lease / mo', expr: 'it.leaseMonthly', format: 'money' }, { label: 'Fuel gal/hr', expr: 'it.burnGalHr', format: 'int' }, { label: 'Fuel / seat-hr', expr: 'it.burnGalHr / it.seats', format: 'num' }, { label: 'Lead time', expr: "it.usedOnly ? '—' : it.leadWeeks + ' wks'", format: 'text' }] }
        ]
      },
      commercial: {
        title: 'Commercial', subtitle: 'Fares, product, brand and partners',
        actions: ['changeCabin', 'brandCampaign'].concat(f.alliances ? ['joinAlliance'] : []),
        sections: [
          { type: 'metrics', width: 'full', key: 'com', items: [
            { label: 'Revenue per passenger', expr: 'player.yield', format: 'money', metric: 'yield' },
            { label: 'Load factor', expr: 'player.loadFactor', format: 'pct', metric: 'loadFactor' },
            { label: 'Customer satisfaction', expr: 'player.satisfaction', format: 'score', metric: 'satisfaction' },
            { label: 'Brand strength', expr: 'player.brand', format: 'score', explain: 'resource:brand' },
            { label: 'Cabin product', expr: "player.productLevel == 0 ? 'No-frills' : player.productLevel == 1 ? 'Standard' : 'Premium'", format: 'text', sub: "{player.alliance ? 'Alliance: ' + name(get('alliance', player.alliance)) : 'No alliance'}" }
          ] },
          { type: 'policies', width: 'half', ids: ['revenueMgmt', 'marketing'], title: 'Commercial policies' },
          { type: 'rankings', width: 'half', title: 'Passengers per week — industry', metric: 'org.weeklyPax', format: 'int' },
          { type: 'chart', width: 'full', title: 'Load factor and satisfaction', series: [{ label: 'Load factor', metric: 'loadFactor' }], format: 'pct', window: 104 }
        ]
      },
      corporate: {
        title: 'Corporate', subtitle: 'Money, people, the board — and deals',
        actions: ['borrow', 'repay', 'issueEquity'].concat(f.acquisitions ? ['acquireAirline'] : []),
        tabs: [
          { id: 'money', label: 'Finances', sections: [
            { type: 'ledger', width: 'half' }, { type: 'finance', width: 'half' },
            { type: 'chart', width: 'full', title: 'Cash and weekly profit', series: [{ label: 'Cash', ledger: 'cash' }, { label: 'Weekly profit', ledger: 'profit' }], format: 'money', window: 156 }
          ] },
          { id: 'people', label: 'Board, crews & regulators', sections: [
            { type: 'stakeholders', width: 'half' }, { type: 'objectives', width: 'half' },
            { type: 'policies', width: 'full', ids: ['maintenance', 'crewPay', 'fuelHedging'], title: 'Operating policies' },
            { type: 'negotiations', width: 'half' }
          ] }
        ]
      },
      industry: {
        title: 'Industry', subtitle: 'Competitors, markets and the wider economy',
        sections: [
          { type: 'world', width: 'half' },
          { type: 'rankings', width: 'half', title: 'Most valuable airlines', metric: 'org.m.value', format: 'money' },
          { type: 'rivals', width: 'full', stats: [{ label: 'Fleet', expr: 'org.fleet', format: 'int' }, { label: 'Pax/wk', expr: 'org.weeklyPax', format: 'int' }, { label: 'Profit (yr)', expr: 'org.profitYear', format: 'money' }] },
          { type: 'chart', width: 'half', title: 'Jet fuel ($/gal)', series: [{ label: 'Spot', world: 'fuel' }, { label: '26-week average', world: 'fuelAvg' }], format: 'money', window: 156 },
          { type: 'feed', width: 'half', title: 'Rival moves', tag: 'rival', includeBackground: true, limit: 14 }
        ]
      }
    }
  };
  // the board column with the first aircraft type name (computed per row)
  gdl.ui.screens.home.sections[3].columns[1].expr = "it.nAircraft ? it.nAircraft + ' × ' + (find(refs('aircraft', 'route', it), true) ? find(refs('aircraft', 'route', it), true).type.name : '') : '—'";
  gdl.ui.screens.home.sections[3].columns[1].format = 'text';
  gdl.onboarding = {
    intro: { title: 'Welcome aboard, CEO', text: '{player.name} is a small regional airline: six aircraft, three routes, sixty million dollars — and a board that wants growth.', button: 'Take the controls',
      bullets: [
        { icon: 'route', title: 'Fill seats at good fares', text: 'Each week every route earns or loses money. Demand depends on fares, frequency, punctuality, your brand and your hubs.' },
        { icon: 'plane', title: 'Every aircraft is a bet', text: 'Lease fast, buy cheap and old, or order new and wait. Idle aircraft cost money.' },
        { icon: 'alert', title: 'The world fights back', text: 'Fuel spikes, recessions, rivals, unions and regulators will test you.' },
        { icon: 'target', title: 'Climb the ranks', text: 'Grow from regional airline to national, continental and finally global carrier.' }
      ] },
    steps: [
      { text: 'Three aircraft are sitting idle. Open your first new route: press “Open a route”.', target: 'action:openRoute', nav: 'network', event: 'acted:openRoute' },
      { text: 'Advance one week with “Next week” (or press Space). Your routes report their first results.', target: 'advance', done: 'time.tick >= 1' },
      { text: 'The Departures board shows every route. Click one to see why it is (or isn’t) making money.', target: 'board', nav: 'home', event: 'inspect' },
      { text: 'Your pricing team adjusts fares automatically. Check “Revenue management” under Commercial.', target: 'policy:revenueMgmt', nav: 'commercial', event: 'nav:commercial' },
      { text: 'More aircraft: leasing takes ~8 weeks, new orders over a year. Have a look at Fleet.', target: 'nav:fleet', event: 'nav:fleet' },
      { text: 'Meet the board’s objectives on the Operations screen, and keep an eye on the “Needs you” list. Good luck.', done: 'time.tick >= 3' }
    ]
  };
  gdl.meta.goal = 'Grow {player.name} from a regional airline into a global carrier.';
  gdl.meta.howToPlay = 'Each turn is one week. Your routes sell seats to business, leisure and visiting-family travelers; each segment cares about different things (price, frequency, punctuality, cabin product, brand, connections).\n\nOpen routes from your bases with idle aircraft. Watch the Departures board: add aircraft to full routes, reprice or close losing ones. Grow your fleet by leasing (fast), buying used (cheap, old) or ordering new (efficient, slow).\n\nPolicies let your teams handle routine work: revenue management, maintenance, crew pay, fuel hedging and marketing. Hubs make connections attractive. Alliances, acquisitions and long-haul routes unlock as you grow.\n\nKeep the board, the crew union and the regulators on side. If cash runs out you get a few weeks to choose a rescue plan.';
  gdl.glossary = [
    { term: 'Load factor', text: 'Share of seats filled. Below ~65% you fly empty seats; above ~95% you are turning travelers away.' },
    { term: 'Yield', text: 'Average revenue per passenger.' },
    { term: 'Base / focus city / hub', text: 'Airports where your crews and aircraft are stationed. Routes must start at a base. Hubs make every connecting route more attractive and cut airport fees.' },
    { term: 'Slots', text: 'Congested airports (London Heathrow, New York JFK, Tokyo Haneda…) require an airport agreement before you can fly there.' },
    { term: 'Revenue management', text: 'Automatic fare adjustment toward a target load factor.' },
    { term: 'Fuel hedging', text: 'Locking in fuel near its recent average price. Smooths costs, costs a small premium.' },
    { term: 'Depreciation', text: 'The yearly loss in value of owned aircraft. It reduces reported profit but not cash.' },
    { term: 'Tier', text: 'Regional → National → Continental → Global. Each unlocks longer routes and new strategic options.' }
  ];
  gdl.balance = { knobs: [
    { path: 'params.demandK', label: 'Market size', effect: 'easier', min: 50000, max: 140000 },
    { path: 'params.outsideBase', label: 'Strength of other carriers & ground transport', effect: 'harder', min: 0, max: 1.4 },
    { path: 'params.feeBase', label: 'Airport fees', effect: 'harder', min: 600, max: 2200 },
    { path: 'params.fareBase', label: 'Base fare', effect: 'easier', min: 35, max: 90 },
    { path: 'params.scaleCostK', label: 'Complexity cost of a large fleet', effect: 'harder', min: 1500, max: 12000, phase: 'late' },
    { path: 'params.scaleCostExp', label: 'How fast complexity costs grow with size', effect: 'harder', min: 1.1, max: 1.45, phase: 'late', step: 0.04 }
  ], targets: { smartMargin: [0.04, 0.17], maxGrowth: 12, passiveSurvivesYears: 1.5, carelessFailsBy: 6 } };
  gdl.trace = {};
  return gdl;
}

/* Feature catalog: which requirement keywords each system satisfies, and where it lives in the
   definition. Used for requirement tracing (the final audit) and for the anti-bloat review. */
const FEATURES = [
  { id: 'regional-start', label: 'Start as a small regional airline', keywords: ['regional', 'small airline', 'start small', 'start with'], paths: ['orgs.player.start', 'progression.tiers.regional'] },
  { id: 'global-growth', label: 'Grow into a global carrier (tiers)', keywords: ['global carrier', 'global', 'grow', 'eventually', 'progression'], paths: ['progression.tiers'] },
  { id: 'aircraft-economics', label: 'Realistic aircraft economics (seats, range, burn, crew, maintenance, leases, depreciation)', keywords: ['aircraft', 'fleet', 'plane', 'economics'], paths: ['kinds.aircraftType', 'kinds.aircraft', 'kinds.route.operate.costs', 'actions.orderAircraft', 'actions.leaseAircraft', 'actions.buyUsed'] },
  { id: 'routes', label: 'Routes with fares, frequency and capacity', keywords: ['route', 'routes', 'network', 'destinations', 'flights'], paths: ['kinds.route', 'actions.openRoute', 'actions.setFare', 'actions.setFrequency', 'actions.closeRoute'] },
  { id: 'hubs', label: 'Bases, focus cities and hubs with connectivity effects', keywords: ['hub', 'hubs', 'base', 'bases'], paths: ['kinds.base', 'actions.openBase', 'actions.upgradeBase', 'kinds.route.operate.attrs.conn'] },
  { id: 'labor', label: 'Crew union morale, contracts and strikes', keywords: ['labor', 'labour', 'union', 'unions', 'crew', 'pilots', 'strike', 'staff'], paths: ['stakeholders.union', 'negotiations.laborContract', 'events.strikeThreat', 'events.contractTalks', 'policies.crewPay'], flag: 'labor' },
  { id: 'airport-negotiations', label: 'Airport slot & fee negotiations', keywords: ['airport negotiation', 'airport negotiations', 'slots', 'airport'], paths: ['negotiations.airportDeal', 'actions.negotiateAirport', 'kinds.agreement'] },
  { id: 'segmentation', label: 'Customer segmentation (business, leisure, visiting friends & family)', keywords: ['segment', 'segmentation', 'customers', 'business travelers', 'leisure'], paths: ['markets.airTravel.segments', 'actions.changeCabin'] },
  { id: 'alliances', label: 'Airline alliances', keywords: ['alliance', 'alliances', 'partners', 'codeshare'], paths: ['kinds.alliance', 'actions.joinAlliance', 'negotiations.allianceJoin', 'events.allianceInvite'], flag: 'alliances' },
  { id: 'acquisitions', label: 'Acquisitions and mergers', keywords: ['acquisition', 'acquisitions', 'acquire', 'merger', 'mergers', 'buy rivals', 'takeover'], paths: ['actions.acquireAirline', 'negotiations.acquisition', 'projects.integration'], flag: 'acquisitions' },
  { id: 'recessions', label: 'Economic cycle with recessions', keywords: ['recession', 'recessions', 'economy', 'economic cycle', 'downturn'], paths: ['world.cycle', 'events.recessionBoard'], flag: 'recessions' },
  { id: 'fuel', label: 'Volatile fuel prices, shocks and hedging', keywords: ['fuel', 'oil', 'jet fuel', 'hedging'], paths: ['world.vars.fuel', 'policies.fuelHedging', 'events.fuelSpike'], flag: 'fuel' },
  { id: 'regulators', label: 'Regulators: scrutiny, investigations, merger blocks', keywords: ['regulator', 'regulators', 'regulation', 'antitrust', 'government'], paths: ['stakeholders.scrutiny', 'events.investigation'], flag: 'regulators' },
  { id: 'competitors', label: 'Strategic rival airlines with archetypes, memory and lifecycles', keywords: ['competitor', 'competitors', 'rivals', 'rival', 'competition'], paths: ['orgs.rivals', 'events.fareWar'] },
  { id: 'history', label: 'History: records, awards, milestones, timeline, annual reviews', keywords: ['history', 'records', 'awards', 'legacy', 'milestones'], paths: ['history.records', 'history.awards', 'history.milestones'], flag: 'history' },
  { id: 'board', label: 'Board objectives and confidence', keywords: ['board', 'objectives', 'goals', 'ceo'], paths: ['stakeholders.board', 'progression.objectives'] },
  { id: 'delegation', label: 'Delegation via policies (revenue management, maintenance, pay, hedging, marketing)', keywords: ['delegate', 'delegation', 'automation', 'automate', 'not overwhelming', 'tedious'], paths: ['policies'] },
  { id: 'visual', label: 'Distinct visual identity: departure-board motif, world route map, aircraft silhouettes', keywords: ['visual', 'polished', 'interface', 'ui', 'beautiful', 'map'], paths: ['theme', 'ui.screens.network', 'ui.screens.fleet'] }
];

module.exports = { id: 'airline', genres: ['airline'], build, HOME_CHOICES, RIVALS, FEATURES };
