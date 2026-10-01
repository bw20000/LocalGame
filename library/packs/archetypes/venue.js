/* Archetype: VENUE OPERATOR (operate-and-expand in local markets).
   Restaurants, hotels, theme parks, casinos, gyms, cinemas, shops… The player opens venues of a
   chosen concept in cities, staffs them with talent, prices them, and grows into a group.
   Genre lexicons below make each genre its own game (vocabulary, concepts, talent, motif). */
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('../common');

const LEX = {
  restaurant: { demandMult: 1, startCash: 6000000, title: 'Mise en Place', tagline: 'From one dining room to a restaurant empire.', org: 'Restaurant group', orgs: 'Restaurant groups', unit: 'restaurant', units: 'restaurants', capUnit: 'covers', priceLabel: 'Average check', talent: 'chef', talents: 'chefs', motif: 'menu-card', glyph: 'dish', award: 'Restaurant of the Year', critic: 'food critic', rating: 'Critic rating',
    concepts: [['bistro', 'Neighborhood bistro', 48, 62, 1300, 0.32], ['fastcasual', 'Fast casual', 19, 46, 3600, 0.28], ['steak', 'Steakhouse', 88, 70, 950, 0.36], ['noodle', 'Noodle bar', 24, 56, 2600, 0.27], ['seafood', 'Seafood brasserie', 72, 68, 1050, 0.35], ['tasting', 'Tasting-menu restaurant', 230, 90, 380, 0.4]],
    rivals: ['Copper Pot Hospitality', 'Saltgrass Group', 'Maison Verde', 'Harbor & Vine', 'Lantern Kitchens', 'Ember Collective'], verbs: ['Open a hot new concept', 'Earn a star', 'Poach a great chef', 'Survive a bad review', 'Build a group across cities'] },
  'hotel-resort': { demandMult: 0.9, startCash: 30000000, title: 'Grand Arrival', tagline: 'Build a hospitality empire, one property at a time.', org: 'Hospitality group', orgs: 'Hospitality groups', unit: 'hotel', units: 'hotels', capUnit: 'room-nights', priceLabel: 'Average daily rate', talent: 'general manager', talents: 'general managers', motif: 'resort', glyph: 'building', award: 'Hotel Group of the Year', critic: 'travel critic', rating: 'Guest score',
    concepts: [['budget', 'Budget hotel', 95, 48, 1500, 0.3], ['business', 'Business hotel', 185, 63, 1100, 0.33], ['boutique', 'Boutique hotel', 290, 76, 500, 0.35], ['resort', 'Luxury resort', 520, 88, 650, 0.38]],
    rivals: ['Meridian Hotels', 'Coral & Pine Resorts', 'Atlas Stays', 'Juniper Hospitality', 'Solace Hotels'], verbs: ['Open a landmark resort', 'Rebrand a tired property', 'Dominate a destination', 'Acquire a rival chain'] },
  'theme-park': { demandMult: 6, startCash: 90000000, title: 'Thrill Republic', tagline: 'Build parks people cross the world to visit.', org: 'Park company', orgs: 'Park companies', unit: 'park', units: 'parks', capUnit: 'visits', priceLabel: 'Ticket price', talent: 'creative director', talents: 'creative directors', motif: 'resort', glyph: 'star', award: 'Park of the Year', critic: 'enthusiast press', rating: 'Guest rating',
    concepts: [['family', 'Family park', 62, 60, 26000, 0.34], ['thrill', 'Thrill park', 78, 68, 22000, 0.36], ['water', 'Water park', 48, 55, 18000, 0.3], ['immersive', 'Immersive themed resort', 135, 85, 30000, 0.4]],
    rivals: ['Wonderland Parks', 'Apex Coaster Co.', 'Lagoon Leisure', 'Starfall Resorts'], verbs: ['Build a record-breaking coaster', 'Open a new park', 'License a beloved story world', 'Survive a ride accident'] },
  casino: { demandMult: 6, startCash: 160000000, title: 'House Edge', tagline: 'Every resort tells a story. The house always tells it last.', org: 'Casino company', orgs: 'Casino companies', unit: 'casino', units: 'casinos', capUnit: 'guest visits', priceLabel: 'Spend per visit', talent: 'property president', talents: 'property presidents', motif: 'resort', glyph: 'star', award: 'Casino Resort of the Year', critic: 'gaming press', rating: 'Guest rating',
    concepts: [['locals', 'Locals casino', 70, 52, 30000, 0.55], ['strip', 'Destination resort', 160, 72, 26000, 0.58], ['integrated', 'Integrated luxury resort', 320, 88, 20000, 0.6]],
    rivals: ['Golden Oasis', 'Neon Crown', 'Marina Bay Gaming', 'Desert Rose'], verbs: ['Open a megaresort', 'Court high rollers', 'Win a license in a new market'] },
  'hospital-system': { demandMult: 1.4, startCash: 45000000, title: 'Bedside', tagline: 'Better care, fuller wards, a system people trust.', org: 'Health system', orgs: 'Health systems', unit: 'hospital', units: 'hospitals', capUnit: 'patient visits', priceLabel: 'Average reimbursement', talent: 'chief of medicine', talents: 'chiefs of medicine', motif: 'blueprint', glyph: 'building', award: 'Health System of the Year', critic: 'quality inspector', rating: 'Quality rating',
    concepts: [['urgent', 'Urgent-care clinic', 180, 50, 1800, 0.45], ['community', 'Community hospital', 950, 60, 1300, 0.52], ['specialty', 'Specialty center', 2600, 74, 520, 0.5], ['academic', 'Academic medical center', 3800, 88, 900, 0.55]],
    rivals: ['Mercy Ridge Health', 'Northshore Medical', 'Summit Care Partners', 'Riverside Health Alliance', 'Beacon Health'], verbs: ['Open a hospital where care is missing', 'Recruit a famous surgeon', 'Earn the top quality rating', 'Build a regional system'] },
  generic: { demandMult: 1, startCash: 6000000, title: 'Main Street Empire', tagline: 'Open, grow and outlast your rivals.', org: 'Company', orgs: 'Companies', unit: 'location', units: 'locations', capUnit: 'customers', priceLabel: 'Average sale', talent: 'manager', talents: 'managers', motif: 'editorial', glyph: 'building', award: 'Company of the Year', critic: 'critic', rating: 'Rating',
    concepts: [['value', 'Value format', 25, 45, 4000, 0.4], ['standard', 'Standard format', 45, 60, 2500, 0.38], ['premium', 'Premium format', 95, 78, 1200, 0.36]],
    rivals: ['Atlas Group', 'Summit Holdings', 'Cardinal & Co.', 'Northstar Retail'], verbs: ['Open new locations', 'Out-compete rivals', 'Build a national brand'] }
};

function cities() {
  const recs = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'airports.json'), 'utf8')).records;
  const seen = new Set();
  return recs.filter(r => { if (seen.has(r.city)) return false; seen.add(r.city); return true; }).map(r => ({ id: r.code, name: r.city, country: r.country, region: r.region, lat: r.lat, lon: r.lon, pop: r.pop, wealth: r.wealth, tourism: r.tourism, rent: +(0.6 + r.wealth * 0.5 + Math.min(1.2, r.pop / 20)).toFixed(2) }));
}

function build(opts = {}) {
  const genre = LEX[opts.genre] ? opts.genre : 'generic';
  const L = Object.assign({}, LEX[genre], opts.lexicon || {});
  const f = Object.assign({ talent: true, acquisitions: true, critics: true, recessions: true }, opts.features || {});
  const title = opts.title || L.title;
  const concepts = L.concepts.map(([id, name, price, quality, cap, costPct]) => ({ id, name, price, quality, cap, costPct }));
  const homes = ['AUS', 'BNA', 'PDX', 'MAN', 'LYS', 'LIS', 'YYC', 'SAN'];
  const gdl = {
    gdl: 1,
    meta: { id: opts.id || genre + '-' + 'venue', version: 1, title, tagline: L.tagline, genre: opts.genre || genre, role: opts.role || 'Founder & CEO', fantasy: L.verbs,
      pillars: ['Every location is a bet on a city', 'Talent makes or breaks a venue', 'Rivals and critics keep you honest'], universe: 'realistic-fictional',
      disclaimer: 'Cities are real places with approximate, rounded figures. Every company, person, critic and event is fictional.',
      goal: `Grow {player.name} from a single ${L.unit} into a celebrated ${L.org.toLowerCase()}.` },
    time: { unit: 'week', start: '2026-01-05' }, currency: { symbol: '$' }, warmup: 20,
    params: { demandK: 2.4 * (L.demandMult || 1), priceSens: 1, rentBase: 2200, wageBase: 1150 },
    world: {
      seasonality: genre === 'theme-park' ? [0.4, 0.45, 0.7, 0.9, 1.05, 1.4, 1.6, 1.55, 1.0, 0.85, 0.6, 0.7] : [0.9, 0.88, 0.97, 1.0, 1.03, 1.06, 1.1, 1.08, 1.0, 1.0, 0.98, 1.1],
      cycle: C.cycle({ recession: f.recessions }),
      vars: [
        { id: 'inputCost', label: genre === 'restaurant' ? 'Food costs' : 'Operating input costs', format: 'x', start: 1, process: { type: 'meanRevert', mean: 1, vol: 0.012, speed: 0.04, min: 0.6, max: 2.5 }, shocks: [{ id: 'supplyShock', label: 'Supply shock', chance: 0.004, size: 1.35, duration: 20, news: 'Supply shock: input costs jump', event: 'costShock' }] },
        { id: 'wageIndex', label: 'Market wages', format: 'x', start: 1, process: { type: 'trend', drift: 0.0006, vol: 0.0004 } },
        { id: 'tourism', label: 'Tourism index', format: 'x', start: 1, process: { type: 'meanRevert', mean: 1, vol: 0.01, speed: 0.03, phase: { recession: 0.85, expansion: 1.05 } } }
      ]
    },
    resources: [{ id: 'reputation', label: 'Reputation', format: 'score', start: 40, min: 0, max: 100, base: '35', speed: 0.03, describe: 'How much customers and the trade trust your name.',
      drivers: [{ label: 'Quality across your ' + L.units, expr: "(avg(owned('venue', org), it.quality) - 60) * 0.5" }, { label: L.rating + 's', expr: "(avg(owned('venue', org), it.rating) - 60) * 0.3" }, { label: 'Marketing', expr: '(org.mktPct - 0.03) * 400' }, { label: 'Scale', expr: "log(1 + count(owned('venue', org))) * 4" }] }],
    kinds: {
      city: { label: 'City', plural: 'Cities', records: cities(), fields: { country: 'text', region: 'text', lat: 'number', lon: 'number', pop: { type: 'number', label: 'Metro population (M)' }, wealth: { type: 'number', label: 'Wealth index' }, tourism: { type: 'number', label: 'Tourism index' }, rent: { type: 'number', label: 'Rent index' } },
        display: { title: '{self.name}', subtitle: '{self.region} · {num(self.pop)}M people' } },
      concept: { label: 'Concept', plural: 'Concepts', records: concepts, fields: { price: 'money', quality: 'number', cap: { type: 'int', label: `Capacity (${L.capUnit}/week)` }, costPct: { type: 'pct', label: 'Variable cost share' } },
        display: { title: '{self.name}', subtitle: '{money(self.price)} · {int(self.cap)} ' + L.capUnit + '/wk' } },
      talent: { label: L.talent[0].toUpperCase() + L.talent.slice(1), plural: L.talents[0].toUpperCase() + L.talents.slice(1), name: { generator: 'person' },
        fields: { skill: { type: 'number', label: 'Skill' }, potential: { type: 'number', label: 'Potential', hidden: true, noise: 12 }, age: 'int', salary: { type: 'money', label: 'Salary / year' }, venue: { type: 'ref', ref: 'venue', label: 'Works at' }, loyalty: { type: 'number', default: 60 } },
        generate: { count: '40', set: { skill: 'clamp(randn(55, 14), 20, 95)', potential: 'clamp(self.skill + randn(8, 10), 25, 99)', age: 'randInt(24, 58)', salary: '60000 + pow(self.skill / 100, 2) * 240000' } },
        display: { title: '{self.name}', subtitle: 'Skill {int(self.skill)} · {money(self.salary)}/yr{self.venue ? " · " + self.venue.name : " · available"}', glyph: "'person'" } },
      venue: {
        label: L.unit[0].toUpperCase() + L.unit.slice(1), plural: L.units[0].toUpperCase() + L.units.slice(1), idPrefix: 'v',
        name: { template: '{pick(["The ","",""])}{pick(["Copper","Juniper","Harbor","Lantern","Saffron","Marble","Ember","Willow","Ivory","Cobalt","Orchard","Meridian"])} {pick(["House","Room","Hall","Garden","Works","Social","Table","Court"])}' },
        fields: { city: { type: 'ref', ref: 'city' }, concept: { type: 'ref', ref: 'concept' }, quality: { type: 'number', default: 60, min: 0, max: 100, label: 'Quality' }, rating: { type: 'number', default: 60, min: 0, max: 100, label: L.rating }, buzz: { type: 'number', default: 1, label: 'Buzz' }, priceMult: { type: 'number', default: 1, min: 0.6, max: 1.8, label: 'Price level' }, sizeMult: { type: 'number', default: 1, label: 'Size' }, opened: 'int', renovated: 'int' },
        derived: { chefSkill: "maxOf(refs('talent', 'venue'), it.skill)", age: '(time.tick - max(self.opened, self.renovated)) / 52' },
        upkeep: [{ label: 'Rent', expr: 'params.rentBase * self.city.rent * self.sizeMult * pow(self.concept.cap / 1000, 0.55) * (1 + self.concept.quality / 200)' }, { label: 'Staff wages', expr: 'params.wageBase * world.wageIndex * org.staffing * self.sizeMult * pow(self.concept.cap / 1000, 0.6) * (0.6 + self.concept.quality / 100) * 3' }, { label: L.talents[0].toUpperCase() + L.talents.slice(1), expr: "sum(refs('talent', 'venue'), it.salary) / 52" }],
        operate: {
          market: 'local', salesLabel: 'Sales',
          capacity: 'self.concept.cap * self.sizeMult * (org.closedForStrike > 0 ? 0.4 : 1)',
          price: 'self.concept.price * self.priceMult * org.priceLevel',
          attrs: { quality: '(self.quality - 60) / 15', rating: '(self.rating - 60) / 15', buzz: 'log(max(0.2, self.buzz))', brand: '(org.reputation - 50) / 25', novelty: 'max(-1, 0.6 - self.age * 0.15)', tier: 'self.concept.quality / 50 - 1' },
          costs: [{ label: genre === 'restaurant' ? 'Food & beverage cost' : 'Variable costs', expr: 'revenue * self.concept.costPct * world.inputCost * (1 - org.costDiscipline)' }, { label: 'Card fees & supplies', expr: 'revenue * 0.04' }],
          after: [{ op: 'set', path: 'self.buzz', value: 'max(0.3, self.buzz * 0.97 + (self._load > 0.95 ? 0.03 : 0))' }, { op: 'set', path: 'self.quality', value: 'clamp(self.quality + (self.concept.quality * 0.6 + self.chefSkill * 0.4 * (self.chefSkill > 0 ? 1 : 0.6) + (org.staffing - 1) * 40 - self.quality) * 0.04 - self.age * 0.02, 5, 99)' }]
        },
        explain: { title: 'Why {self.name} performs this way', drivers: [{ label: 'Weekly demand', expr: 'self._demand' }, { label: 'Capacity', expr: 'self._cap' }, { label: 'Quality', expr: 'self.quality' }, { label: L.rating, expr: 'self.rating' }, { label: 'Buzz ×100', expr: 'self.buzz * 100' }, { label: 'Competitors in town', expr: "count(where('venue', 'city', self.city), it.owner != self.owner)" }, { label: 'Weekly profit after rent & staff', expr: 'self._profit - (params.rentBase * self.city.rent * self.sizeMult * pow(self.concept.cap / 1000, 0.55) * (1 + self.concept.quality / 200))' }] },
        display: { title: '{self.name}', subtitle: '{self.concept.name} · {self.city.name}', glyph: "'" + L.glyph + "'", stats: [{ label: 'Full', expr: 'self._load', format: 'pct' }, { label: 'Profit/wk', expr: 'self._profit', format: 'money' }] }
      }
    },
    markets: {
      local: { label: 'Local market', key: 'self.city.id', refPrice: 'self.concept.price',
        size: `params.demandK * self.city.pop * 1000 * pow(self.city.wealth, 0.5) * (0.6 + 0.4 * self.city.tourism * world.tourism) * world.demand * world.season`,
        outside: '1.2',
        segments: [
          { id: 'value', label: 'Value seekers', size: 'size * 0.45', priceSens: 2.4, weights: { quality: 0.4, brand: 0.3, buzz: 0.3, tier: -0.6 } },
          { id: 'regulars', label: 'Regulars', size: 'size * 0.35', priceSens: 1.4, weights: { quality: 0.8, rating: 0.4, brand: 0.5, novelty: 0.2 } },
          { id: 'premium', label: 'Premium guests', size: 'size * 0.12 * self.city.wealth', priceSens: 0.6, priceMult: 1.2, weights: { quality: 1.2, rating: 1.2, brand: 0.8, tier: 0.9, buzz: 0.4 } },
          { id: 'visitors', label: 'Visitors', size: 'size * 0.15 * self.city.tourism', priceSens: 1.2, weights: { buzz: 0.9, rating: 0.7, brand: 0.6, novelty: 0.4 } }
        ] }
    },
    orgs: {
      label: L.org, plural: L.orgs,
      fields: { priceLevel: { type: 'number', default: 1 }, staffing: { type: 'number', default: 1 }, mktPct: { type: 'number', default: 0.03 }, costDiscipline: { type: 'number', default: 0 }, closedForStrike: { type: 'number', default: 0 }, safety: { type: 'number', default: 1 }, homeCode: { type: 'text', default: 'AUS' } },
      metrics: [
        { id: 'units', label: L.units[0].toUpperCase() + L.units.slice(1), expr: "count(owned('venue', org))", format: 'int' },
        { id: 'cities', label: 'Cities', expr: "len(distinct(map(owned('venue', org), it.city)))", format: 'int' },
        { id: 'regions', label: 'Regions', expr: "len(distinct(map(owned('venue', org), it.city.region)))", format: 'int' },
        { id: 'guests', label: L.capUnit[0].toUpperCase() + L.capUnit.slice(1) + ' / week', expr: "sum(owned('venue', org), it._sold)", format: 'int' },
        { id: 'utilization', label: 'Utilization', expr: "sum(owned('venue', org), it._sold) / max(1, sum(owned('venue', org), it._cap))", format: 'pct' },
        { id: 'avgQuality', label: 'Average quality', expr: "avg(owned('venue', org), it.quality)", format: 'score' },
        { id: 'avgRating', label: 'Average ' + L.rating.toLowerCase(), expr: "avg(owned('venue', org), it.rating)", format: 'score' },
        { id: 'margin', label: 'Operating margin', expr: 'org.profitYear / max(1, org.revenueYear)', format: 'pct1' },
        { id: 'weeklyProfit', label: 'Weekly profit', expr: 'org.m.profit', format: 'money' }
      ],
      assets: "count(owned('venue', org)) * 1500000",
      tick: [{ op: 'set', path: 'org.closedForStrike', value: 'max(0, org.closedForStrike - 1)' }],
      costs: [{ label: 'Head office', expr: '25000 + org.revenue * 0.04 + 2500 * pow(org.units, 1.15)' }, { label: 'Marketing', expr: 'org.revenue * org.mktPct' }, { label: 'Safety & maintenance', expr: 'org.revenue * 0.012 * org.safety' }],
      player: { name: L.unit === 'restaurant' ? 'Saffron & Salt' : 'Juniper ' + (L.org.split(' ')[0]), cash: String(L.startCash || 6e6),
        start: [{ op: 'create', kind: 'venue', set: { city: 'org.homeCode', concept: `'${concepts[0].id}'`, opened: '-52', quality: '62', rating: '60' } }] },
      rivals: { count: { full: 4, light: 4, background: 12 }, aiEvery: 4, entryChance: '0.4', maxActive: 12, failGrace: 16, fixed: L.rivals.slice(0, 8).map((n, i) => ({ name: n, archetype: ['chain', 'boutique', 'chain', 'boutique'][i % 4] })),
        archetypes: [
          { id: 'chain', label: 'Fast-growing chain', risk: 0.6, tempo: 2, color: '#b5651d', cash: String(Math.round((L.startCash || 6e6) * 6.7)), set: { priceLevel: '0.92', mktPct: '0.04' }, policies: { pricing: 'value', staffing: 'lean' }, weights: { openVenue: 1.6, closeVenue: 1 },
            start: [{ op: 'create', kind: 'venue', count: 'randInt(3, 6)', set: { city: "pick(all('city')).id", concept: "pick(all('concept')).id", opened: '-randInt(10, 300)' } }] },
          { id: 'boutique', label: 'Prestige operator', risk: 0.4, tempo: 1, color: '#5b3a8c', cash: String(Math.round((L.startCash || 6e6) * 4.2)), set: { priceLevel: '1.08', mktPct: '0.03' }, policies: { pricing: 'premium', staffing: 'generous' }, weights: { openVenue: 1, hireTalent: 1.4 },
            start: [{ op: 'create', kind: 'venue', count: 'randInt(2, 4)', set: { city: "pick(all('city')).id", concept: `'${concepts[concepts.length - 1].id}'`, opened: '-randInt(10, 300)', quality: '75' } }] }
        ] }
    },
    people: [{ kind: 'talent', age: 'age', skills: ['skill'], potential: 'potential', peak: 40, plateau: 10, retireAge: [60, 70], replenish: '4', newcomer: { skill: 'clamp(randn(45, 12), 20, 80)', potential: 'clamp(self.skill + randn(15, 10), 30, 99)', age: 'randInt(22, 30)', salary: '55000 + pow(self.skill / 100, 2) * 200000' }, hallOfFame: 'self.skill >= 88', hofText: 'A legend of the trade' }]
  };
  // policies
  gdl.policies = [
    { id: 'pricing', label: 'Pricing stance', scope: 'org', default: 'standard', describe: 'Group-wide price positioning.', options: [{ value: 'value', label: 'Value', describe: '−10% prices, more volume', effects: [{ op: 'set', path: 'org.priceLevel', value: '0.9' }] }, { value: 'standard', label: 'Market', effects: [{ op: 'set', path: 'org.priceLevel', value: '1' }] }, { value: 'premium', label: 'Premium', describe: '+12% prices; needs quality to justify it', effects: [{ op: 'set', path: 'org.priceLevel', value: '1.12' }] }] },
    { id: 'staffing', label: 'Staffing levels', scope: 'org', default: 'standard', describe: 'More staff raises quality and wage costs.', options: [{ value: 'lean', label: 'Lean', effects: [{ op: 'set', path: 'org.staffing', value: '0.85' }] }, { value: 'standard', label: 'Standard', effects: [{ op: 'set', path: 'org.staffing', value: '1' }] }, { value: 'generous', label: 'Generous', effects: [{ op: 'set', path: 'org.staffing', value: '1.18' }] }] },
    { id: 'safety', label: 'Safety & maintenance standards', scope: 'org', default: 'standard', describe: 'Inspections, maintenance and crowd control across every location.',
      options: [{ value: 'lean', label: 'Lean', describe: 'Cheaper; incidents become likely.', effects: [{ op: 'set', path: 'org.safety', value: '0.6' }] }, { value: 'standard', label: 'Standard', effects: [{ op: 'set', path: 'org.safety', value: '1' }] }, { value: 'rigorous', label: 'Rigorous', describe: 'Costs more; guests and regulators trust you.', effects: [{ op: 'set', path: 'org.safety', value: '1.5' }] }] },
    { id: 'marketing', label: 'Marketing budget', scope: 'org', default: 'standard', options: [{ value: 'low', label: 'Lean (1.5%)', effects: [{ op: 'set', path: 'org.mktPct', value: '0.015' }] }, { value: 'standard', label: 'Standard (3%)', effects: [{ op: 'set', path: 'org.mktPct', value: '0.03' }] }, { value: 'heavy', label: 'Heavy (6%)', effects: [{ op: 'set', path: 'org.mktPct', value: '0.06' }] }] }
  ];
  const b = C.board();
  gdl.stakeholders = [b.stakeholder, { id: 'staffMorale', label: 'Staff morale', start: 60, base: '58', speed: 0.06, describe: 'Your front-line teams.', drivers: [{ label: 'Staffing levels', expr: '(org.staffing - 1) * 80' }, { label: 'Wages vs market', expr: '(1 - world.wageIndex) * 60' }, { label: 'Cost cuts', expr: '-org.costDiscipline * 200' }], thresholds: [{ below: 28, event: 'walkout', cooldown: 30 }] }];
  const sizeOpts = [{ value: 0.7, label: 'Small', describe: 'Lower rent, fewer ' + L.capUnit }, { value: 1, label: 'Standard' }, { value: 1.4, label: 'Large', describe: 'Flagship scale' }];
  gdl.actions = [
    { id: 'openVenue', label: `Open a ${L.unit}`, verb: 'Open', category: 'grow', icon: 'plus', primary: true,
      describe: `Choose a city and a concept. Each ${L.unit} competes with everyone else in that city.`, tradeoff: 'Fit-out costs money now; new places need time to build a reputation.', risk: 'A crowded city or the wrong concept can bleed cash for months.',
      params: [{ id: 'city', label: 'City', type: 'entity', kind: 'city', sort: "it.pop * sqrt(it.wealth) / (1 + count(where('venue', 'city', it)) * 0.25) * (it.id == org.homeCode ? 2 : 1) * (len(owned('venue')) == 0 || ownsAt('venue', 'city', it) || tierIndex() >= 1 || it.region == get('city', org.homeCode).region ? 1 : 0.2)", filter: "tierIndex() >= 2 || it.region == get('city', org.homeCode).region || !org.isPlayer" },
        { id: 'concept', label: 'Concept', type: 'entity', kind: 'concept', sort: 'it.quality' },
        { id: 'size', label: 'Size', type: 'choice', default: '1', aiValue: '1', options: sizeOpts }],
      cost: { cash: 'param.concept.price * param.concept.cap * 32 * param.size * param.city.rent' }, capex: true,
      forecast: { kind: 'venue', set: { city: 'param.city', concept: 'param.concept', sizeMult: '+param.size', quality: 'param.concept.quality * 0.9', rating: '58', buzz: '1.4', opened: 'time.tick', renovated: 'time.tick', chefSkill: '0', age: '0' } },
      preview: [{ label: `Expected ${L.capUnit} / week`, expr: 'fc.sold', format: 'int' }, { label: 'Expected utilization', expr: 'fc.load', format: 'pct' }, { label: 'Contribution / week (before rent & staff)', expr: 'fc.profit', format: 'signedMoney' }, { label: 'Rent + staff / week (est.)', expr: 'params.rentBase * param.city.rent * param.size * pow(param.concept.cap / 1000, 0.55) * (1 + param.concept.quality / 200) + params.wageBase * world.wageIndex * org.staffing * param.size * pow(param.concept.cap / 1000, 0.6) * (0.6 + param.concept.quality / 100) * 3', format: 'money' }, { label: 'Competitors in town', expr: 'fc.competitors', format: 'int' }],
      effects: [{ op: 'create', kind: 'venue', set: { city: 'param.city', concept: 'param.concept', sizeMult: '+param.size', quality: 'param.concept.quality * 0.9', rating: '58', buzz: '1.4', opened: 'time.tick', renovated: 'time.tick' }, as: 'v' }, { op: 'news', text: `New ${L.unit}: {v.name} opens in {param.city.name}` }],
      result: 'Opened {v.name} ({param.concept.name}) in {param.city.name}',
      ai: { score: 'fc.profit * 40 - param.concept.price * param.concept.cap * 32 * param.size * param.city.rent * 0.3', candidates: 3, news: '{org.name} opens a {param.concept.name} in {param.city.name}' } },
    { id: 'setVenuePrice', label: 'Set price level', verb: 'Reprice', kind: 'venue', category: 'operate', icon: 'tag', tradeoff: 'Higher prices mean fewer, richer customers; discounts fill seats at thinner margins.',
      params: [{ id: 'mult', label: L.priceLabel, type: 'choice', default: 'self.priceMult', options: [{ value: 0.85, label: '−15%' }, { value: 0.93, label: '−7%' }, { value: 1, label: 'List' }, { value: 1.08, label: '+8%' }, { value: 1.18, label: '+18%' }, { value: 1.3, label: '+30%' }] }],
      forecast: { kind: 'venue', exclude: 'self', set: { city: 'self.city', concept: 'self.concept', sizeMult: 'self.sizeMult', quality: 'self.quality', rating: 'self.rating', buzz: 'self.buzz', priceMult: '+param.mult', opened: 'self.opened', renovated: 'self.renovated', chefSkill: 'self.chefSkill', age: 'self.age' } },
      preview: [{ label: L.priceLabel, expr: 'self.concept.price * param.mult * org.priceLevel', format: 'money' }, { label: 'Expected utilization', expr: 'fc.load', format: 'pct' }, { label: 'Expected contribution / week', expr: 'fc.profit', format: 'signedMoney' }],
      effects: [{ op: 'set', path: 'self.priceMult', value: '+param.mult' }], result: '{self.name} repriced' },
    { id: 'renovate', label: 'Renovate', verb: 'Renovate', kind: 'venue', category: 'operate', icon: 'wrench', describe: 'Refresh the space: quality and buzz jump, and the place feels new again.', tradeoff: 'Costs cash and a few slow weeks.',
      cost: { cash: 'self.concept.price * self.concept.cap * 10 * self.sizeMult' }, capex: true, cooldown: 52,
      effects: [{ op: 'add', path: 'self.quality', value: '8' }, { op: 'set', path: 'self.buzz', value: 'self.buzz + 0.5' }, { op: 'set', path: 'self.renovated', value: 'time.tick' }], result: '{self.name} renovated' },
    { id: 'closeVenue', label: `Close ${L.unit}`, verb: 'Close', kind: 'venue', category: 'operate', icon: 'close', danger: true, describe: 'Stop the losses. Staff and customers will remember.', tradeoff: 'Ends the losses — and any chance of a turnaround; your foothold in that city goes to rivals.', cost: { cash: 'self.concept.price * self.concept.cap * 3' },
      effects: [{ op: 'each', list: "refs('talent', 'venue', self)", do: [{ op: 'set', path: 'it.venue', value: 'null' }, { op: 'set', path: 'it.owner', value: 'null' }] }, { op: 'resource', id: 'reputation', add: '-1' }, { op: 'news', text: '{self.name} closes its doors' }, { op: 'remove', target: 'self' }],
      result: 'Closed {self.name}', ai: { score: "time.tick - self.opened > 40 && avg(self._hp ?? [], it) < 0 ? 1000000 : 0", selfSample: 6, news: '{org.name} closes {self.name}' } },
    { id: 'marketingPush', label: 'Launch a marketing push', verb: 'Promote', kind: 'venue', category: 'operate', icon: 'megaphone', describe: 'Press, social and partnerships for one location.', tradeoff: 'Cash now for buzz that fades within weeks.', cost: { cash: 'self.concept.price * self.concept.cap * 1.2' }, cooldown: 8,
      effects: [{ op: 'set', path: 'self.buzz', value: 'self.buzz + 0.6' }], result: 'Marketing push for {self.name}' }
  ];
  if (f.talent) gdl.actions.push({ id: 'hireTalent', label: `Hire a ${L.talent}`, verb: 'Hire', category: 'people', icon: 'user', primary: true, describe: `Great ${L.talents} lift quality; skill shown is an estimate until they work for you.`, tradeoff: 'Salaries add up; stars get poached.',
    params: [{ id: 'person', label: L.talent[0].toUpperCase() + L.talent.slice(1), type: 'entity', kind: 'talent', filter: '!it.venue', sort: 'it.skill' }, { id: 'venue', label: `For which ${L.unit}`, type: 'entity', kind: 'venue', filter: "it.owner == org && count(refs('talent', 'venue', it)) == 0", sort: 'it._rev' }],
    cost: { cash: 'param.person.salary * 0.15' }, costCategory: 'Hiring',
    preview: [{ label: 'Salary / year', expr: 'param.person.salary', format: 'money' }, { label: 'Skill (estimated)', expr: 'est(param.person, "skill").value', format: 'score' }, { label: 'Age', expr: 'param.person.age', format: 'int' }],
    effects: [{ op: 'set', target: 'param.person', field: 'venue', value: 'param.venue' }, { op: 'transfer', target: 'param.person', to: 'org' }], result: 'Hired {param.person.name} for {param.venue.name}',
    ai: { score: 'param.person.skill * 2000', candidates: 2, news: '{org.name} hires {param.person.name}' } });
  gdl.actions.push(...C.financeActions());
  if (f.acquisitions) {
    gdl.actions.push({ id: 'acquireRival', label: `Acquire a ${L.org.toLowerCase()}`, verb: 'Make an offer', category: 'deals', icon: 'merge', tier: 'local', describe: `Buy a rival outright: their ${L.units}, staff and debts become yours.`,
      params: [{ id: 'target', label: 'Target', type: 'org', filter: '!it.isPlayer && it.level < 3 && it.value < org.value * 1.5', sort: '-it.value' }],
      preview: [{ label: 'Their value', expr: 'param.target.value', format: 'money' }, { label: `Their ${L.units}`, expr: "count(owned('venue', param.target))", format: 'int' }], effects: [{ op: 'negotiate', id: 'acquisition', with: 'param.target' }], playerOnly: true });
    gdl.negotiations = [{ id: 'acquisition', label: 'Acquisition', with: 'org', patience: 2, counter: { term: 'price' },
      terms: [{ id: 'price', label: 'Offer price', type: 'money', default: 'them.value * 1.1', min: 0, max: 'them.value * 4 + 1', step: 100000 }],
      value: 'terms.price', reservation: 'them.value * 1.3 * (them.cash < 0 ? 0.7 : 1)', reasons: [{ when: 'terms.price < them.value * 1.2', text: 'Owners expect a control premium' }],
      onAccept: [{ op: 'if', cond: 'org.cash < terms.price', then: [{ op: 'loan', amount: 'terms.price - org.cash + 500000', years: '7' }] }, { op: 'cash', amount: '-terms.price', category: 'Acquisitions' }, { op: 'acquireOrg', target: 'them' }, { op: 'flag', name: 'acquired' }],
      acceptNews: 'You acquire {them.name}' }];
  }
  // events
  gdl.events = [b.event, C.recessionEvent(`Close the weakest ${L.unit}`)];
  if (f.critics) gdl.events.push({ id: 'criticVisit', priority: 'important', chance: '0.05', cooldown: 6, title: `A ${L.critic} visits {v.name}`, text: '{v.name} in {v.city.name} runs at {pct(v._load)} with quality {int(v.quality)}. The review lands next week.',
    bind: { v: { kind: 'venue', owner: 'player' } },
    choices: [
      { label: 'Roll out the red carpet', describe: 'Comp the meal, send the best team. Raises the odds of a rave.', cost: 'v.concept.price * 40', effects: [{ op: 'set', path: 'v.rating', value: 'clamp(v.rating + randn(6, 6) + (v.quality - 60) * 0.3, 10, 99)' }], result: 'The review of {v.name}: {int(v.rating)}/100' },
      { label: 'Treat them like anyone else', describe: 'Authentic — and a gamble.', effects: [{ op: 'set', path: 'v.rating', value: 'clamp(v.rating + randn(0, 9) + (v.quality - 60) * 0.3, 10, 99)' }], result: 'The review of {v.name}: {int(v.rating)}/100' }
    ] });
  gdl.events.push(
    { id: 'poach', priority: 'important', chance: '0.03', cooldown: 20, title: '{rv.name} tries to poach {t.name}', text: '{t.name} (skill {int(t.skill)}) runs the kitchen at {t.venue.name}. A rival offers a big raise.',
      bind: { t: { kind: 'talent', owner: 'player', filter: 'it.skill > 55' }, rv: { kind: 'org', filter: '!it.isPlayer' } },
      choices: [{ label: 'Match the offer (+25% salary)', effects: [{ op: 'mul', path: 't.salary', value: '1.25' }, { op: 'add', path: 't.loyalty', value: '10' }], result: '{t.name} stays' }, { label: 'Let them go', effects: [{ op: 'set', path: 't.venue', value: 'null' }, { op: 'transfer', target: 't', to: 'rv' }, { op: 'remember', a: 'rv', b: 'player', key: 'rivalry', add: '6' }], result: '{t.name} leaves for {rv.name}', track: { text: 'Let {t.name} go to {rv.name}' } }] },
    { id: 'inspection', priority: 'important', chance: '0.025', cooldown: 20, title: 'Surprise inspection at {v.name}', text: 'Inspectors found problems. Quality there is {int(v.quality)}.',
      bind: { v: { kind: 'venue', owner: 'player', pick: 'min', by: 'it.quality' } },
      choices: [{ label: 'Close for a deep fix (2 weeks of sales)', cost: 'v.concept.price * v.concept.cap * 1.5', effects: [{ op: 'add', path: 'v.quality', value: '6' }], result: '{v.name} fixed and reopened' }, { label: 'Pay the fine and carry on', cost: 'v.concept.price * v.concept.cap * 0.4', effects: [{ op: 'add', path: 'v.rating', value: '-6' }, { op: 'resource', id: 'reputation', add: '-2' }], result: 'Fine paid; the story makes the papers' }] },
    { id: 'costShock', trigger: 'scheduled', priority: 'critical', title: 'Input costs spike', text: 'Costs are {pct(world.inputCost - 1)} above normal. Margins across all your ' + L.units + ' are under pressure.',
      choices: [{ label: 'Raise prices 6%', effects: [{ op: 'set', path: 'player.priceLevel', value: 'player.priceLevel * 1.06' }, { op: 'resource', id: 'reputation', add: '-2' }], result: 'Prices raised' }, { label: 'Absorb it', effects: [{ op: 'stake', id: 'board', add: '-5' }], result: 'You absorb the cost spike' }, { label: 'Renegotiate suppliers', effects: [{ op: 'set', path: 'player.costDiscipline', value: 'player.costDiscipline + 0.03' }, { op: 'stake', id: 'staffMorale', add: '-4' }], result: 'Supplier terms renegotiated' }] },
    { id: 'walkout', trigger: 'scheduled', priority: 'critical', title: 'Staff walk out', text: 'Morale has collapsed. Teams at several ' + L.units + ' refuse to work.',
      choices: [{ label: 'Raise pay and staffing', effects: [{ op: 'policy', id: 'staffing', value: "'generous'" }, { op: 'stake', id: 'staffMorale', add: '25' }], result: 'Teams return' }, { label: 'Wait it out', effects: [{ op: 'set', path: 'player.closedForStrike', value: '3' }, { op: 'resource', id: 'reputation', add: '-5' }], result: 'Walkout drags on' }] },
    { id: 'rivalNextDoor', priority: 'important', chance: '0.03', cooldown: 16, title: '{rv.owner.name} opens next to {v.name}', text: 'A new {rv.concept.name} is targeting your customers in {v.city.name}.',
      bind: { v: { kind: 'venue', owner: 'player' }, rv: { kind: 'venue', owner: 'rival', filter: 'it.city == v.city && time.tick - it.opened < 8' } },
      choices: [{ label: 'Launch a promotion', cost: 'v.concept.price * v.concept.cap * 0.8', effects: [{ op: 'add', path: 'v.buzz', value: '0.5' }], result: 'Promotion launched at {v.name}' }, { label: 'Trust your quality', effects: [], result: 'You hold steady' }] },
    { id: 'incident', priority: 'critical', chance: '0.008 / max(0.4, player.safety)', cooldown: 26, title: `Incident at {v.name}`, text: `${genre === 'theme-park' ? 'A ride malfunction' : genre === 'hospital-system' ? 'A patient-safety failure' : 'An accident'} at {v.name} — {v._load > 0.95 ? 'the place was packed beyond comfort' : 'investigators are on site'}. The press is calling.`,
      bind: { v: { kind: 'venue', owner: 'player', pick: 'max', by: 'it._load - it.quality / 200' } },
      choices: [{ label: 'Close it for a full review', describe: 'Weeks of lost sales; trust preserved.', cost: 'v.concept.price * v.concept.cap * 2', effects: [{ op: 'add', path: 'v.quality', value: '4' }, { op: 'resource', id: 'reputation', add: '-1' }, { op: 'policy', id: 'safety', value: "'rigorous'" }], result: 'You close {v.name} for review' },
        { label: 'Fix it quietly and reopen', describe: 'Cheaper — unless it happens again.', effects: [{ op: 'resource', id: 'reputation', add: '-6' }, { op: 'add', path: 'v.buzz', value: '-0.5' }], result: '{v.name} reopens after quick repairs' }] },
    { id: 'viralMoment', priority: 'routine', chance: '0.02', cooldown: 10, title: '{v.name} goes viral', bind: { v: { kind: 'venue', owner: 'player', filter: 'it.quality > 65' } }, effects: [{ op: 'add', path: 'v.buzz', value: '0.8' }], news: '{v.name} goes viral — lines around the block' }
  );
  gdl.progression = {
    tiers: [{ id: 'single', label: 'Single ' + L.unit }, { id: 'local', label: 'Local group', when: 'player.units >= 3', text: 'Acquisitions are now possible, and you can open anywhere in your region.' }, { id: 'national', label: 'National group', when: 'player.units >= 8 && player.cities >= 3', text: 'You can now open in other regions of the world.' }, { id: 'global', label: 'Global brand', when: 'player.units >= 25 && player.regions >= 3' }],
    objectives: C.objectives([{ id: 'units', text: `Operate {int(target)} ${L.units}`, metric: 'player.units', target: 'base + 2', reward: [{ op: 'stake', id: 'board', add: '8' }], penalty: [{ op: 'stake', id: 'board', add: '-6' }] }]),
    failure: C.failure({ unit: 'locations' }),
    victory: [{ id: 'top', label: `The biggest ${L.org.toLowerCase()} in the world`, when: "count(rivals(), it.level < 3 && it.value > player.value) == 0 && tierIndex() >= 2", text: 'No rival is worth more than you.' }]
  };
  gdl.history = C.history({ unitLabel: L.units, unitMetric: 'org.units', awardName: L.award, awardScore: 'org.avgQuality + org.avgRating * 0.5 + org.margin * 80' });
  gdl.history.milestones.push({ id: 'second', label: `A second ${L.unit}`, when: 'player.units >= 2', text: 'You are no longer a one-location wonder.' }, { id: 'rating90', label: 'Rave reviews', when: "maxOf(owned('venue'), it.rating) >= 90", text: `One of your ${L.units} is the talk of the trade.` }, { id: 'ten', label: `Ten ${L.units}`, when: 'player.units >= 10', text: 'A real group now.' });
  gdl.needs = [
    { id: 'losing', forEach: 'venue', when: 'time.tick - self.opened > 8 && self._profit < 0', text: '{self.name} is losing {money(-self._profit)} a week', sub: '{self._load < 0.5 ? "Half empty: reprice or promote" : "Costs too high for its sales"}', action: 'setVenuePrice', priority: 1, tone: 'bad' },
    { id: 'full', forEach: 'venue', when: 'self._load > 0.97', text: '{self.name} is turning customers away', sub: 'Overcrowding hurts the experience and safety — raise prices or open another nearby', action: 'setVenuePrice', priority: 1, tone: 'good' },
    { id: 'nochef', forEach: 'venue', when: f.talent ? "count(refs('talent', 'venue', self)) == 0 && time.tick > 2" : 'false', text: `{self.name} has no ${L.talent}`, sub: 'Quality drifts down without one', action: 'hireTalent', priority: 1, tone: 'warn' }
  ];
  const scr = C.standardScreens({
    goal: gdl.meta.goal, primary: ['openVenue'].concat(f.talent ? ['hireTalent'] : []),
    homeSubtitle: '{player.units} ' + L.units + ' · {int(player.guests)} ' + L.capUnit + ' a week',
    metrics: [{ label: 'Weekly profit', expr: 'player.m.profit', format: 'signedMoney', metric: 'weeklyProfit', tone: "v >= 0 ? 'good' : 'bad'" }, { label: 'Cash', expr: 'player.cash', format: 'money' }, { label: L.capUnit[0].toUpperCase() + L.capUnit.slice(1) + ' / week', expr: 'player.guests', format: 'int', metric: 'guests' }, { label: 'Reputation', expr: 'player.reputation', format: 'score', explain: 'resource:reputation' }],
    signature: [{ type: 'cards', title: 'Your ' + L.units, width: 'full', kind: 'venue', owner: 'player', sort: 'it._profit', size: 'm', glyph: "'" + L.glyph + "'", glyphScale: '0.5', glyphColor: "it._profit >= 0 ? 'var(--accent)' : 'var(--bad)'", badge: '{it.concept.name}', stats: [{ label: 'Full', expr: 'it._load', format: 'pct' }, { label: 'Profit/wk', expr: 'it._profit', format: 'signedMoney', tone: "v < 0 ? 'bad' : 'good'" }, { label: 'Quality', expr: 'it.quality', format: 'score' }, { label: L.rating, expr: 'it.rating', format: 'score' }], actions: ['setVenuePrice', 'renovate'], empty: 'Nothing open yet.' }]
  });
  scr.locations = { title: L.units[0].toUpperCase() + L.units.slice(1), subtitle: 'Where you operate and where you could', actions: ['openVenue'],
    tabs: [{ id: 'map', label: 'Map', sections: [{ type: 'map', title: 'Your footprint', width: 'full', basemap: 'world', nodes: { kind: 'city', size: 'max(2, sqrt(it.pop) * 1.4)', label: 'it.name', highlight: "ownsAt('venue', 'city', it)", filter: "ownsAt('venue', 'city', it)" }, toggle: false }, { type: 'table', title: 'All your ' + L.units, width: 'full', kind: 'venue', owner: 'player', sort: 'it._profit', search: true, columns: [{ label: 'Name', expr: 'it.name' }, { label: 'City', expr: 'it.city.name', format: 'text' }, { label: 'Concept', expr: 'it.concept.name', format: 'text' }, { label: 'Full', expr: 'it._load', format: 'pct' }, { label: 'Quality', expr: 'it.quality', format: 'score' }, { label: L.rating, expr: 'it.rating', format: 'score' }, { label: 'Profit/wk', expr: 'it._profit', format: 'signedMoney', tone: "v < 0 ? 'bad' : 'good'" }], rowActions: ['setVenuePrice', 'marketingPush', 'renovate', 'closeVenue'] }] },
      { id: 'cities', label: 'Cities', sections: [{ type: 'table', title: 'Cities', width: 'full', kind: 'city', sort: 'it.pop', search: true, columns: [{ label: 'City', expr: 'it.name' }, { label: 'Region', expr: 'it.region', format: 'text' }, { label: 'Population (M)', expr: 'it.pop', format: 'num' }, { label: 'Wealth', expr: 'it.wealth', format: 'x' }, { label: 'Tourism', expr: 'it.tourism', format: 'x' }, { label: 'Rent', expr: 'it.rent', format: 'x' }, { label: 'Competitors', expr: "count(where('venue', 'city', it))", format: 'int' }] }] }] };
  if (f.talent) scr.people = { title: L.talents[0].toUpperCase() + L.talents.slice(1), subtitle: 'Talent makes or breaks a ' + L.unit, actions: ['hireTalent'], sections: [{ type: 'cards', title: 'Your ' + L.talents, width: 'full', kind: 'talent', owner: 'player', sort: 'it.skill', size: 's', glyph: "'person'", glyphScale: '0.35', stats: [{ label: 'Skill', expr: 'it.skill', format: 'score' }, { label: 'Salary', expr: 'it.salary', format: 'money' }], empty: 'No one hired yet.' }, { type: 'table', title: 'Available ' + L.talents, width: 'full', kind: 'talent', filter: '!it.venue && !it.owner', sort: 'it.skill', limit: 20, columns: [{ label: 'Name', expr: 'it.name' }, { label: 'Skill', expr: 'it.skill', format: 'score' }, { label: 'Age', expr: 'it.age', format: 'int' }, { label: 'Salary', expr: 'it.salary', format: 'money' }] }] };
  gdl.ui = { topbar: [{ label: 'Cash', expr: 'player.cash', format: 'money' }, { label: 'Profit / week', expr: 'player.m.profit', format: 'signedMoney' }, { label: 'Reputation', expr: 'player.reputation', format: 'score', explain: 'resource:reputation' }],
    nav: [{ id: 'home', label: 'Overview', icon: 'home' }, { id: 'locations', label: L.units[0].toUpperCase() + L.units.slice(1), icon: 'map' }].concat(f.talent ? [{ id: 'people', label: L.talents[0].toUpperCase() + L.talents.slice(1), icon: 'users' }] : [], [{ id: 'company', label: 'Company', icon: 'bank' }, { id: 'industry', label: 'Industry', icon: 'globe' }]),
    screens: scr };
  gdl.theme = C.theme(L.motif, { logo: { text: title.split(/\s+/).map(w => w[0]).join('').slice(0, 2) } });
  gdl.onboarding = C.onboarding({ title: 'Welcome, ' + (opts.role || 'founder'), text: `{player.name} is a single ${L.unit} in {get('city', player.homeCode).name} with ${'$' + Math.round((L.startCash || 6e6) / 1e6) + 'M'} in the bank. The board wants a group.`,
    bullets: [{ icon: 'building', title: 'Every location is a bet', text: `Pick cities and concepts; each ${L.unit} competes with the others in town.` }, { icon: 'users', title: 'Talent matters', text: `Great ${L.talents} raise quality — and get poached.` }, { icon: 'alert', title: 'The world pushes back', text: 'Critics, inspectors, cost spikes, recessions and rivals.' }],
    primaryAction: { id: 'openVenue', label: `Open a ${L.unit}` }, primaryNav: 'locations', unitNoun: L.units });
  gdl.newGame = { options: [{ id: 'name', label: 'Company name', type: 'text', default: gdl.orgs.player.name }, { id: 'home', label: 'Home city', type: 'choice', default: 'AUS', choices: homes.map(h => ({ value: h, label: (cities().find(c => c.id === h) || { name: h }).name, effects: [{ op: 'set', path: 'org.homeCode', value: `'${h}'` }] })) }] };
  gdl.glossary = [{ term: 'Utilization', text: `Share of capacity (${L.capUnit}) actually sold.` }, { term: 'Quality', text: `Driven by the concept, your ${L.talent}, staffing and age.` }, { term: L.rating, text: `What ${L.critic}s and guests say. Moves after reviews and incidents.` }, { term: 'Buzz', text: 'Short-term attention: openings, promotions and viral moments. Fades over time.' }];
  gdl.balance = { knobs: [{ path: 'params.demandK', label: 'Market size', effect: 'easier', min: 0.8, max: 6 }, { path: 'params.rentBase', label: 'Rents', effect: 'harder', min: 800, max: 5000 }, { path: 'params.wageBase', label: 'Wages', effect: 'harder', min: 500, max: 2500 }] };
  gdl.meta.howToPlay = `Each turn is a week. Open ${L.units} by choosing a city and a concept; customers in each city split among all ${L.units} there based on price, quality, ${L.rating.toLowerCase()}, buzz and your reputation. Watch utilization and profit per location, reprice, renovate or close. Hire ${L.talents} to raise quality. Policies set group-wide pricing, staffing and marketing. Grow from one ${L.unit} into a group, and beyond.`;
  return gdl;
}

const FEATURES = [
  { id: 'locations', label: 'Open and run locations in real cities', keywords: ['location', 'locations', 'open', 'expand', 'cities', 'restaurants', 'hotels', 'parks', 'venues', 'stores'], paths: ['kinds.venue', 'actions.openVenue'] },
  { id: 'concepts', label: 'Concepts with distinct economics', keywords: ['concept', 'concepts', 'menu', 'format', 'brand'], paths: ['kinds.concept'] },
  { id: 'talent', label: 'Talent: hiring, skill, poaching, careers', keywords: ['chef', 'chefs', 'staff', 'talent', 'manager', 'hire', 'hiring', 'employees'], paths: ['kinds.talent', 'actions.hireTalent', 'events.poach'], flag: 'talent' },
  { id: 'pricing', label: 'Pricing and customer segments', keywords: ['price', 'pricing', 'customers', 'segments', 'demand'], paths: ['markets.local', 'actions.setVenuePrice', 'policies.pricing'] },
  { id: 'safety', label: 'Safety, crowds and incidents', keywords: ['safety', 'crowds', 'crowd', 'accident', 'accidents', 'incidents', 'inspection', 'inspections', 'health inspections'], paths: ['policies.safety', 'events.incident', 'events.inspection'] },
  { id: 'critics', label: 'Critics, ratings and reviews', keywords: ['critic', 'critics', 'review', 'reviews', 'stars', 'rating'], paths: ['events.criticVisit'], flag: 'critics' },
  { id: 'acquisitions', label: 'Acquisitions', keywords: ['acquisition', 'acquire', 'merger', 'buy rivals'], paths: ['actions.acquireRival', 'negotiations.acquisition'], flag: 'acquisitions' },
  { id: 'recessions', label: 'Economic cycles and cost shocks', keywords: ['recession', 'economy', 'costs', 'inflation'], paths: ['world.cycle', 'world.vars.inputCost'], flag: 'recessions' },
  { id: 'rivals', label: 'Competing groups with strategies', keywords: ['rivals', 'competitors', 'competition'], paths: ['orgs.rivals'] },
  { id: 'history', label: 'History, awards and records', keywords: ['history', 'awards', 'records', 'legacy'], paths: ['history'] }
];
module.exports = { id: 'venue', loop: 'operate-and-expand', genres: Object.keys(LEX).filter(k => k !== 'generic'), build, FEATURES, LEX };
