/* Archetype: PROJECT SLATE (develop → produce → open → run).
   Broadway producers, film studios, TV networks, record labels, fashion houses. The player options
   properties, attaches talent, takes each production through staged development with go/no-go
   gates (and real costs), then runs it in a shared audience market where it competes with every
   other production on price, quality, reviews, star power and buzz. Hits run for years and spawn
   tours/sequels; flops close fast. Quality is hidden until previews/test screenings. */
'use strict';
const C = require('../common');

const LEX = {
  broadway: { title: 'Opening Night', tagline: 'Every show is a gamble. Some run forever.', org: 'Production company', orgs: 'Producers', unit: 'show', units: 'shows', prop: 'property', props: 'properties', venueWord: 'theater', motif: 'playbill', glyph: 'ticket', award: 'Best Musical', awardShow: 'the Lantern Awards', critic: 'the critics', reviewWord: 'Reviews', audience: 'theatergoers', price: 135, perWeekCap: 9600, marketMult: 5.5, cut: 0.0, decayW: 0.985, budget: 16e6, runCostPct: 0.034, runWord: 'Now playing', closeWord: 'Close the show', sequelWord: 'Launch a national tour', sequelId: 'tour',
    roles: [['director', 'Director'], ['star', 'Star'], ['composer', 'Composer']], genres: ['Musical', 'Revival', 'New play', 'Jukebox musical', 'Drama', 'Comedy'],
    scale: [{ value: 0.6, label: 'Intimate house (≈ 650 seats)' }, { value: 1, label: 'Mid-size house (≈ 1,100 seats)' }, { value: 1.5, label: 'Big musical house (≈ 1,600 seats)' }],
    stages: [['dev', 'Readings & workshops', 10], ['cap', 'Capitalization & casting', 6], ['reh', 'Rehearsals', 6], ['prev', 'Previews', 4], ['open', 'Opening night', 1]],
    rivals: ['Marquee & Main', 'Footlights Group', 'Gilded Stage Productions', 'Curtain Call Partners', 'Starlit Theatricals', 'Proscenium Arts'],
    verbs: ['Option a property nobody else believes in', 'Cast a star who can carry a show', 'Survive a brutal opening-night review', 'Run for a thousand performances', 'Win the season\'s top award'] },
  'movie-studio': { title: 'Final Cut', tagline: 'Greenlight it. Shoot it. Pray at the box office.', org: 'Studio', orgs: 'Studios', unit: 'film', units: 'films', prop: 'script', props: 'scripts', motif: 'broadcast', glyph: 'film', award: 'Best Picture', awardShow: 'the Golden Reel', critic: 'critics', reviewWord: 'Reviews', audience: 'moviegoers', price: 12, perWeekCap: 2600000, marketMult: 4.0, cut: 0.5, decayW: 0.82, budget: 45e6, runCostPct: 0.02, runWord: 'In theaters', closeWord: 'Pull from theaters', sequelWord: 'Greenlight a sequel', sequelId: 'sequel',
    roles: [['director', 'Director'], ['star', 'Lead actor'], ['writer', 'Screenwriter']], genres: ['Action', 'Drama', 'Comedy', 'Horror', 'Animation', 'Sci-fi', 'Thriller'],
    scale: [{ value: 0.5, label: 'Limited release' }, { value: 1, label: 'Wide release' }, { value: 1.6, label: 'Saturation release' }],
    stages: [['dev', 'Development', 12], ['pre', 'Pre-production', 8], ['shoot', 'Principal photography', 10], ['post', 'Post-production', 10], ['open', 'Opening weekend', 1]],
    rivals: ['Silverlight Pictures', 'Paramount Ridge', 'Northstar Studios', 'Halcyon Films', 'Redline Entertainment', 'Lumiere West'],
    verbs: ['Greenlight a risky original', 'Land the star everyone wants', 'Win opening weekend', 'Build a franchise', 'Take home Best Picture'] },
  'tv-network': { title: 'Prime Time', tagline: 'Pilots, pickups and the ratings war.', org: 'Network', orgs: 'Networks', unit: 'series', units: 'series', prop: 'pitch', props: 'pitches', motif: 'broadcast', glyph: 'film', award: 'Best Drama Series', awardShow: 'the Silver Screens', critic: 'TV critics', reviewWord: 'Reviews', audience: 'viewers', price: 0.08, perWeekCap: 30000000, marketMult: 3.0, cut: 0.2, decayW: 0.97, budget: 30e6, runCostPct: 0.03, runWord: 'On air', closeWord: 'Cancel the series', sequelWord: 'Order a spin-off', sequelId: 'spinoff',
    roles: [['director', 'Showrunner'], ['star', 'Lead'], ['writer', 'Head writer']], genres: ['Drama', 'Comedy', 'Reality', 'Crime', 'Prestige limited series', 'Sci-fi'],
    scale: [{ value: 0.6, label: 'Late-night slot' }, { value: 1, label: 'Weeknight slot' }, { value: 1.5, label: 'Prime-time tentpole slot' }],
    stages: [['dev', 'Development', 8], ['pilot', 'Pilot', 8], ['prod', 'Series production', 12], ['open', 'Premiere', 1]],
    rivals: ['Apex Broadcasting', 'Channel North', 'Lighthouse TV', 'Meridian Networks', 'Starfield Media'], verbs: ['Pick up a pilot nobody wanted', 'Win the Thursday ratings war', 'Renew a hit for season five', 'Launch a spin-off'] },
  'record-label': { title: 'Gold Record', tagline: 'Sign them, record them, break them.', org: 'Label', orgs: 'Labels', unit: 'album', units: 'albums', prop: 'demo', props: 'demos', motif: 'terminal', glyph: 'star', award: 'Album of the Year', awardShow: 'the Golden Notes', critic: 'music critics', reviewWord: 'Reviews', audience: 'listeners', price: 1.0, perWeekCap: 250000, marketMult: 3.0, cut: 0.35, decayW: 0.9, budget: 1.2e6, runCostPct: 0.025, runWord: 'In the charts', closeWord: 'Stop promoting', sequelWord: 'Record a follow-up', sequelId: 'followup',
    roles: [['director', 'Producer'], ['star', 'Artist'], ['writer', 'Songwriter']], genres: ['Pop', 'Hip-hop', 'Rock', 'Country', 'Electronic', 'R&B'],
    scale: [{ value: 0.6, label: 'Niche campaign' }, { value: 1, label: 'National campaign' }, { value: 1.6, label: 'Global campaign' }],
    stages: [['dev', 'Writing', 6], ['rec', 'Recording', 8], ['mix', 'Mixing & mastering', 4], ['open', 'Release week', 1]],
    rivals: ['Neon Wave Records', 'Bluebird Music', 'Vinyl & Vine', 'Echo Chamber', 'Night Shift Records'], verbs: ['Sign an unknown before anyone else', 'Break a single worldwide', 'Win Album of the Year', 'Build a roster that lasts'] },
  'fashion-house': { title: 'Maison', tagline: 'Collections, muses and the front row.', org: 'Fashion house', orgs: 'Fashion houses', unit: 'collection', units: 'collections', prop: 'concept', props: 'concepts', motif: 'atelier', glyph: 'star', award: 'Designer of the Year', awardShow: 'the Gilded Thread', critic: 'fashion press', reviewWord: 'Press', audience: 'customers', price: 420, perWeekCap: 2500, marketMult: 3.0, cut: 0.45, decayW: 0.95, budget: 3e6, runCostPct: 0.035, runWord: 'In stores', closeWord: 'End the collection', sequelWord: 'Launch a capsule follow-up', sequelId: 'capsule',
    roles: [['director', 'Creative director'], ['star', 'Muse'], ['writer', 'Head designer']], genres: ['Couture', 'Ready-to-wear', 'Streetwear', 'Accessories', 'Resort'],
    scale: [{ value: 0.6, label: 'Boutique distribution' }, { value: 1, label: 'Department stores' }, { value: 1.6, label: 'Global flagship rollout' }],
    stages: [['dev', 'Concept', 6], ['sample', 'Sampling', 6], ['prod', 'Production', 8], ['open', 'Runway show', 1]],
    rivals: ['Maison Lune', 'Atelier Corvo', 'Velvet & Vane', 'Hartwell Studio', 'Noir Collective'], verbs: ['Discover a muse', 'Stage an unforgettable show', 'Turn a collection into a brand'] },
  generic: { title: 'Greenlight', tagline: 'Develop, produce, launch — and find the hits.', org: 'Studio', orgs: 'Studios', unit: 'project', units: 'projects', prop: 'idea', props: 'ideas', motif: 'editorial', glyph: 'star', award: 'Project of the Year', awardShow: 'the industry awards', critic: 'critics', reviewWord: 'Reviews', audience: 'customers', price: 40, perWeekCap: 15000, marketMult: 3.5, cut: 0.25, decayW: 0.95, budget: 5e6, runCostPct: 0.04, runWord: 'Live', closeWord: 'Wind down', sequelWord: 'Make a follow-up', sequelId: 'followup',
    roles: [['director', 'Lead'], ['star', 'Talent'], ['writer', 'Creator']], genres: ['Mainstream', 'Prestige', 'Niche'], scale: [{ value: 0.6, label: 'Small launch' }, { value: 1, label: 'Standard launch' }, { value: 1.6, label: 'Big launch' }],
    stages: [['dev', 'Development', 8], ['prod', 'Production', 10], ['open', 'Launch', 1]], rivals: ['Atlas Studio', 'Northstar Works', 'Beacon Media', 'Summit Creative'], verbs: ['Find the hits', 'Build a slate'] }
};
const cap = (s) => s[0].toUpperCase() + s.slice(1);

function build(opts = {}) {
  const alias = { 'architecture-firm': 'generic', 'tech-company': 'generic', 'record-label': 'record-label' };
  const genre = LEX[opts.genre] ? opts.genre : (alias[opts.genre] || 'generic');
  const L = Object.assign({}, LEX[genre], opts.lexicon || {});
  const f = Object.assign({ talent: true, investors: true, awards: true, sequels: true, recessions: true, critics: true, acquisitions: false }, opts.features || {});
  const title = opts.title || L.title;
  const U = cap(L.unit), Us = cap(L.units), P = cap(L.prop), Ps = cap(L.props);
  const roleIds = L.roles.map(r => r[0]);
  const roleLabel = Object.fromEntries(L.roles);
  const budgetM = L.budget;
  const isFilm = genre === 'movie-studio';
  const decay = L.decayW || 0.97; // weekly novelty decay
  const stagesTotal = L.stages.reduce((a, s) => a + s[2], 0);
  const gdl = {
    gdl: 1,
    meta: { id: opts.id || genre + '-slate', version: 1, title, tagline: L.tagline, genre: opts.genre || genre, role: opts.role || 'Producer', fantasy: L.verbs,
      pillars: ['Every greenlight is a bet you cannot fully see', 'Talent and timing make hits; budgets only make them possible', 'Hits pay for the flops — manage the slate, not one project'], universe: 'fictional',
      disclaimer: 'All productions, people, companies and awards are fictional.',
      goal: `Build {player.name} into the most celebrated ${L.org.toLowerCase()} — a slate of hits, a wall of awards, a name ${L.audience} trust.` },
    time: { unit: 'week', start: '2026-01-05' }, currency: { symbol: '$' }, warmup: 30,
    params: { demandK: 1, budgetBase: budgetM, priceBase: L.price, runCostPct: L.runCostPct, devCostPct: 0.004, propFlow: 0.25, decay, hitThreshold: 1 },
    world: {
      seasonality: genre === 'broadway' ? [0.78, 0.82, 0.9, 1.0, 1.05, 1.12, 1.18, 1.16, 0.92, 0.95, 1.05, 1.3] : isFilm ? [0.8, 0.85, 0.9, 0.95, 1.15, 1.25, 1.3, 1.15, 0.85, 0.9, 1.1, 1.25] : [0.95, 0.95, 1, 1, 1, 0.95, 0.9, 0.9, 1.05, 1.05, 1.08, 1.12],
      cycle: C.cycle({ boom: 1.04, bust: 0.88, recession: f.recessions }),
      vars: [{ id: 'appetite', label: `${cap(L.audience)}'s appetite`, format: 'x', start: 1, process: { type: 'meanRevert', mean: 1, vol: 0.012, speed: 0.04, min: 0.6, max: 1.5 } },
        { id: 'costIndex', label: 'Production costs', format: 'x', start: 1, process: { type: 'trend', drift: 0.0005, vol: 0.0006 } }],
      trends: []
    },
    resources: [{ id: 'reputation', label: 'Prestige', format: 'score', start: 35, min: 0, max: 100, base: '30', speed: 0.03, describe: `How much ${L.critic}, talent and ${L.audience} respect your name.`,
      drivers: [{ label: L.reviewWord, expr: "avg(filter(owned('production', org), it.reviews > 0), it.reviews) > 0 ? (avg(filter(owned('production', org), it.reviews > 0), it.reviews) - 55) * 0.4 : 0" }, { label: 'Hits', expr: 'min(20, org.hits * 3)' }, { label: 'Awards', expr: 'min(25, org.awards * 5)' }, { label: 'Flops', expr: '-min(15, org.flops * 1.5)' }] }],
    kinds: {
      genreSlot: { label: 'Genre', plural: 'Genres', records: L.genres.map((g, i) => ({ id: 'g' + i, name: g, trend: 1 })), fields: { trend: { type: 'number', label: 'Audience trend', default: 1 } },
        tick: [
          { op: 'set', path: 'self.trend', value: 'clamp(self.trend + (1 - self.trend) * 0.02 + randn(0, 0.025), 0.6, 1.6)' },
          { op: 'chance', p: 'params.propFlow / ' + L.genres.length, then: [{ op: 'create', kind: 'property', owner: "'none'", as: 'pr', set: { genre: 'self', born: 'time.tick' } }, { op: 'set', path: 'pr.appeal', value: 'clamp(randn(52, 17), 5, 98)' }, { op: 'set', path: 'pr.prestige', value: 'clamp(randn(50, 18), 5, 98)' }, { op: 'set', path: 'pr.rightsCost', value: `params.budgetBase * rand(0.01, 0.05)` }] },
          { op: 'each', list: "filter(all('property'), it.genre == outer.self && !it.owner && time.tick - it.born > 156)", do: [{ op: 'remove', target: 'it' }] }
        ],
        display: { title: '{self.name}', subtitle: 'Trend ×{num(self.trend)}' } },
      property: { label: P, plural: Ps, idPrefix: 'pr',
        name: { template: genre === 'record-label' ? '{pick(["Midnight","Golden","Neon","Paper","Silver","Wild","Electric","Velvet","Broken","Summer"])} {pick(["Hearts","Roads","Signals","Skies","Rivers","Dreams","Cities","Lights","Ghosts","Waves"])}' : '{pick(["The ","","", "A "])}{pick(["Last","Silent","Burning","Hidden","Crimson","Endless","Golden","Lost","Broken","Wild","Midnight","Bright"])} {pick(["Garden","Kingdom","Summer","Harbor","Promise","Letter","Crown","Station","Orchard","Season","Empire","Voyage"])}' },
        fields: { genre: { type: 'ref', ref: 'genreSlot' }, appeal: { type: 'number', label: 'Audience appeal', hidden: true, noise: 18 }, prestige: { type: 'number', label: 'Critical potential', hidden: true, noise: 18 }, rightsCost: { type: 'money', label: 'Rights / option cost' }, born: 'int', used: { type: 'bool', default: false }, franchise: { type: 'int', default: 0 } },
        generate: { count: '36', set: { genre: "pick(all('genreSlot')).id", appeal: 'clamp(randn(52, 17), 5, 98)', prestige: 'clamp(randn(50, 18), 5, 98)', rightsCost: 'params.budgetBase * rand(0.01, 0.05)', born: '-randInt(0, 80)' } },
        display: { title: '{self.name}', subtitle: '{self.genre.name} · rights {money(self.rightsCost)}', glyph: `'${L.glyph}'` } },
      talent: { label: 'Talent', plural: 'Talent', name: { generator: 'person' },
        fields: { role: 'text', skill: { type: 'number', label: 'Skill', hidden: true, noise: 14 }, fame: { type: 'number', label: 'Fame' }, fee: { type: 'money', label: 'Fee' }, busyUntil: { type: 'int', default: 0 }, age: 'int', credits: { type: 'int', default: 0 }, hits: { type: 'int', default: 0 } },
        generate: { count: String(roleIds.length * 22), set: { role: `pick(${JSON.stringify(roleIds).replace(/"/g, "'")})`, skill: 'clamp(randn(52, 16), 10, 98)', fame: 'clamp(randn(40, 22), 1, 99)', age: 'randInt(24, 66)', fee: `params.budgetBase * (0.01 + pow(max(1, self.fame) / 100, 2) * 0.08)`, busyUntil: '0' } },
        display: { title: '{self.name}', subtitle: `{self.role == '${roleIds[0]}' ? '${roleLabel[roleIds[0]]}' : self.role == '${roleIds[1]}' ? '${roleLabel[roleIds[1]]}' : '${roleLabel[roleIds[2]]}'} · fame {int(self.fame)} · {money(self.fee)}`, glyph: "'person'" } },
      production: { label: U, plural: Us, idPrefix: 'pd',
        fields: { property: { type: 'ref', ref: 'property' }, director: { type: 'ref', ref: 'talent', label: roleLabel[roleIds[0]] }, star: { type: 'ref', ref: 'talent', label: roleLabel[roleIds[1]] }, writer: { type: 'ref', ref: 'talent', label: roleLabel[roleIds[2]] },
          budget: { type: 'money', label: 'Budget' }, scale: { type: 'number', default: 1 }, quality: { type: 'number', label: 'Quality', hidden: true, noise: 20, default: 50 }, buzz: { type: 'number', default: 1 }, phase: { type: 'text', default: 'development' },
          opened: 'int', closedAt: 'int', reviews: { type: 'number', label: L.reviewWord, default: 0 }, gross: { type: 'money', label: 'Total gross', default: 0 }, net: { type: 'money', label: 'Net from the run', default: 0 }, investorShare: { type: 'pct', default: 0 }, priceMult: { type: 'number', default: 1 }, weeksLosing: { type: 'int', default: 0 }, recouped: { type: 'bool', default: false }, awardsWon: { type: 'int', default: 0 }, sequelOf: { type: 'text', default: '' }, keep: { type: 'bool', default: false } },
        derived: { weeks: "self.phase == 'running' ? time.tick - self.opened : 0", starFame: 'self.star ? self.star.fame : 0', recoupPct: 'max(0, self.net) / max(1, self.budget * (1 - self.investorShare * 0.5))' },
        operate: { market: 'audience', salesLabel: 'Box office', active: "self.phase == 'running'",
          capacity: `${L.perWeekCap} * self.scale`, price: 'params.priceBase * self.priceMult',
          attrs: { quality: '(self.quality - 55) / 14', reviews: '(self.reviews - 55) / 14', buzz: 'log(max(0.15, self.buzz))', fame: '(self.starFame - 40) / 25', genre: 'log(self.property.genre.trend)', brand: '(org.reputation - 40) / 30' },
          costs: [].concat(L.cut ? [{ label: genre === 'movie-studio' ? "Exhibitors' share" : genre === 'record-label' ? 'Platform & retail share' : genre === 'fashion-house' ? 'Retail margin' : 'Distribution fees', expr: `revenue * ${L.cut}` }] : []).concat([{ label: 'Running costs', expr: 'self.budget * params.runCostPct * world.costIndex * pow(self.scale, 0.7)' }, { label: 'Royalties & talent points', expr: 'revenue * 0.1' }, { label: "Investors' share", expr: 'max(0, revenue * 0.9 - self.budget * params.runCostPct * world.costIndex * pow(self.scale, 0.7)) * self.investorShare * 0.45' }]),
          after: [{ op: 'set', path: 'self.gross', value: 'self.gross + self._rev' }, { op: 'set', path: 'self.net', value: 'self.net + self._profit' }, { op: 'set', path: 'self.buzz', value: 'max(0.15, self.buzz * params.decay + (self._load > 0.95 ? 0.04 : 0) + (self.reviews - 60) * 0.0006)' },
            { op: 'if', cond: '!self.recouped && self.net >= self.budget * (1 - self.investorShare * 0.5)', then: [{ op: 'set', path: 'self.recouped', value: 'true' }, { op: 'set', path: 'org.hits', value: 'org.hits + 1' }, { op: 'set', path: 'self.keep', value: 'true' }, { op: 'news', text: `{self.name} has recouped its ${'{money(self.budget)}'} budget`, priority: 'important' }, { op: 'moment', title: '{self.name} recoups', text: 'Every dollar back — everything from here is profit.', stat: '{money(self.gross)} gross' }] },
            { op: 'set', path: 'self.weeksLosing', value: 'self._profit < 0 ? self.weeksLosing + 1 : 0' }] },
        explain: { title: 'Why {self.name} sells like this', drivers: [{ label: 'Weekly demand', expr: 'self._demand' }, { label: 'Capacity', expr: 'self._cap' }, { label: L.reviewWord, expr: 'self.reviews' }, { label: 'Buzz ×100', expr: 'self.buzz * 100' }, { label: roleLabel[roleIds[1]] + ' fame', expr: 'self.starFame' }, { label: 'Genre trend ×100', expr: 'self.property.genre.trend * 100' }, { label: 'Weeks running', expr: 'self.weeks' }] },
        display: { title: '{self.name}', subtitle: "{self.property.genre.name} · {self.phase == 'running' ? 'week ' + int(self.weeks) : self.phase}", glyph: `'${L.glyph}'`, stats: [{ label: 'Gross', expr: 'self.gross', format: 'money' }, { label: L.reviewWord, expr: 'self.reviews', format: 'score' }] } }
    },
    markets: {
      audience: { label: cap(L.audience), key: "'all'", refPrice: 'params.priceBase',
        size: `params.demandK * ${Math.round(L.perWeekCap * (L.marketMult || 4))} * world.demand * world.season * world.appetite`, outside: '0.9',
        segments: [
          { id: 'mass', label: 'Casual ' + L.audience, size: 'size * 0.5', priceSens: 1.8, weights: { buzz: 1.0, fame: 0.8, quality: 0.3, genre: 0.6, brand: 0.2 } },
          { id: 'fans', label: 'Enthusiasts', size: 'size * 0.3', priceSens: 0.9, weights: { quality: 1.1, reviews: 1.2, genre: 0.4, brand: 0.5 } },
          { id: 'premium', label: 'Premium buyers', size: 'size * 0.2', priceSens: 0.5, priceMult: 1.5, weights: { fame: 1.0, reviews: 0.9, quality: 0.8, buzz: 0.5 } }
        ] }
    },
    orgs: {
      label: L.org, plural: L.orgs,
      fields: { hits: { type: 'int', default: 0 }, flops: { type: 'int', default: 0 }, awards: { type: 'int', default: 0 }, mktPct: { type: 'number', default: 1 }, closePolicy: { type: 'int', default: 6 } },
      metrics: [
        { id: 'running', label: L.runWord, expr: "count(owned('production', org), it.phase == 'running')", format: 'int' },
        { id: 'developing', label: 'In development', expr: "count(owned('production', org), it.phase != 'running' && it.phase != 'closed')", format: 'int' },
        { id: 'weeklyGross', label: 'Weekly gross', expr: "sum(owned('production', org), it.phase == 'running' ? it._rev : 0)", format: 'money' },
        { id: 'avgReviews', label: 'Average ' + L.reviewWord.toLowerCase(), expr: "avg(filter(owned('production', org), it.reviews > 0), it.reviews)", format: 'score' },
        { id: 'recoupRate', label: 'Recoupment rate', expr: 'org.hits / max(1, org.hits + org.flops)', format: 'pct' },
        { id: 'margin', label: 'Operating margin', expr: 'org.profitYear / max(1, org.revenueYear)', format: 'pct1' }
      ],
      assets: "sum(owned('property', org), it.rightsCost) + sum(owned('production', org), it.phase == 'running' ? it.budget * 0.3 : 0)",
      valuation: 'max(0, org.m.assets + org.cash - org.debt + max(0, org.profitYear) * 5 + org.reputation * params.budgetBase * 0.05)',
      costs: [{ label: 'Office & staff', expr: `${Math.round(budgetM * 0.0015)} + 400 * pow(count(owned('production', org)), 1.1)` }],
      player: { name: genre === 'broadway' ? 'Lamplight Productions' : isFilm ? 'Northlight Pictures' : genre === 'tv-network' ? 'Channel Seven Arts' : genre === 'record-label' ? 'Halfmoon Records' : genre === 'fashion-house' ? 'Maison Iris' : 'Lamplight Studio', cash: String(budgetM * 2.5),
        start: [{ op: 'each', list: "top(filter(all('property'), !it.owner), it.appeal + randn(0, 20), 2)", do: [{ op: 'transfer', target: 'it', to: 'org' }] }] },
      rivals: { count: { full: 4, light: 2, background: 8 }, aiEvery: 2, entryChance: '0.3', maxActive: 9, failGrace: 20, backgroundValue: String(budgetM * 6),
        fixed: L.rivals.slice(0, 6).map((n, i) => ({ name: n, archetype: ['commercial', 'prestige'][i % 2] })),
        archetypes: [
          { id: 'commercial', label: 'Crowd-pleaser', risk: 0.6, tempo: 2, color: '#b5651d', cash: String(budgetM * 4), weights: { developProduction: 1.5 }, start: [] },
          { id: 'prestige', label: 'Prestige house', risk: 0.4, tempo: 1, color: '#5b3a8c', cash: String(budgetM * 3), weights: { acquireRights: 1.4 }, start: [] }
        ] }
    }
  };

  /* ---------------- the production lifecycle (engine project with gates) ---------------- */
  const stageDefs = L.stages.map(([id, label, dur], i) => {
    const last = i === L.stages.length - 1, prev = i === L.stages.length - 2;
    const sd = { id, label, duration: String(dur), cost: last ? '0' : `p.budget * ${(0.9 / (stagesTotal - 1)).toFixed(4)} * world.costIndex`, costCategory: 'Production costs',
      onEnter: [{ op: 'set', path: 'self.phase', value: `'${label}'` }] };
    if (i === 0) sd.gate = { label: 'Greenlight {p.name} for full production?', describe: 'From here costs climb fast. Development so far: {money(p.spent)}.', options: [{ label: 'Greenlight it' }, { label: 'Shelve it', cancel: true }] };
    if (i === 1 && f.investors) sd.gate = { label: 'How will you finance {p.name}?', describe: 'Budget {money(p.budget)}. Investors pay half now and take a share of the profits.', options: [{ label: 'Self-finance — keep everything' }, { label: 'Bring in investors (half the budget, 45% of profits)', effects: [{ op: 'cash', amount: 'p.budget * 0.5', category: 'Investor capital' }, { op: 'set', path: 'self.investorShare', value: '1' }] }] };
    if (prev) {
      sd.risk = { chance: '0.05', effects: [{ op: 'add', path: 'self.quality', value: '-randInt(3, 10)' }], news: 'Trouble on {p.name}: creative clashes leak to the press' };
      sd.onComplete = [{ op: 'observe', target: 'self', field: 'quality', quality: '0.75' }];
      sd.gate = { label: `${genre === 'broadway' ? 'Previews' : isFilm ? 'Test screenings' : 'Early reactions'} for {p.name} are in`, describe: 'Your best read of the quality: {int(est(self, "quality").value)}/100. Open now, or spend more to fix it?',
        options: [{ label: 'Open as planned' }, { label: 'Delay and rework (+12% budget, a few more weeks)', effects: [{ op: 'cash', amount: '-p.budget * 0.12', category: 'Production costs' }, { op: 'set', path: 'self.quality', value: 'clamp(self.quality + rand(2, 10), 5, 99)' }, { op: 'set', path: 'self.buzz', value: 'self.buzz * 0.9' }] }, { label: 'Cut your losses — cancel', cancel: true }] };
    }
    if (last) sd.onComplete = [
      { op: 'set', path: 'self.phase', value: "'running'" }, { op: 'set', path: 'self.opened', value: 'time.tick' },
      { op: 'set', path: 'self.reviews', value: 'clamp(self.quality * 0.75 + self.property.prestige * 0.25 + randn(0, 9), 5, 99)' },
      { op: 'set', path: 'self.buzz', value: 'max(0.3, 1 + (self.reviews - 55) / 40 + self.starFame / 120 + (org.mktPct - 1) * 0.4)' },
      { op: 'set', path: 'self.director.credits', value: 'self.director.credits + 1' },
      { op: 'news', text: `{self.name} opens — ${L.critic} give it {int(self.reviews)}/100`, priority: 'important' },
      { op: 'if', cond: 'self.reviews >= 85', then: [{ op: 'moment', title: 'A triumph', text: `${cap(L.critic)} adore {self.name}.`, stat: '{int(self.reviews)}/100' }, { op: 'resource', id: 'reputation', add: '3' }] },
      { op: 'if', cond: 'self.reviews < 35', then: [{ op: 'moment', title: 'Savaged', text: `${cap(L.critic)} tear {self.name} apart.`, stat: '{int(self.reviews)}/100', tone: 'bad' }] }
    ];
    return sd;
  });
  gdl.projects = [{ id: 'produce', label: 'Production', name: '{p.name}', stages: stageDefs, costCategory: 'Production costs',
    onCancel: [{ op: 'set', path: 'self.phase', value: "'closed'" }, { op: 'set', path: 'self.closedAt', value: 'time.tick' }, { op: 'set', path: 'org.flops', value: 'org.flops + 1' }, { op: 'news', text: '{self.name} is shelved' }] }];

  /* ---------------- actions ---------------- */
  const freeTalent = (role) => `it.role == '${role}' && it.busyUntil <= time.tick`;
  const budgetOpts = [{ value: 0.6, label: 'Lean budget', describe: 'Cheaper; quality ceiling lower' }, { value: 1, label: 'Standard budget' }, { value: 1.6, label: 'Lavish budget', describe: 'Raises quality and expectations' }];
  gdl.actions = [
    { id: 'acquireRights', label: `Option a ${L.prop}`, verb: 'Option', category: 'develop', icon: 'tag', primary: true,
      describe: `Buy the rights to develop a ${L.prop}. Appeal and critical potential are estimates.`, tradeoff: 'Rights cost money now; most never get made.',
      params: [{ id: 'prop', label: P, type: 'entity', kind: 'property', filter: '!it.owner && !it.used', sort: "est(it, 'appeal').value + est(it, 'prestige').value * 0.5" }],
      cost: { cash: 'param.prop.rightsCost' }, costCategory: 'Rights',
      preview: [{ label: 'Audience appeal (estimate)', expr: "est(param.prop, 'appeal').value", format: 'score' }, { label: 'Critical potential (estimate)', expr: "est(param.prop, 'prestige').value", format: 'score' }, { label: 'Genre trend', expr: 'param.prop.genre.trend', format: 'x' }],
      effects: [{ op: 'transfer', target: 'param.prop', to: 'org' }], result: `Optioned {param.prop.name}`,
      ai: { score: "count(owned('property', org), !it.used) < 3 && org.cash > param.prop.rightsCost * 20 ? (param.prop.appeal + param.prop.prestige * (archetype(org) == 'prestige' ? 1 : 0.4) + randn(0, 15) - 70) * 1000 : 0", candidates: 3, news: '{org.name} options {param.prop.name}' } },
    { id: 'developProduction', label: `Develop a ${L.unit}`, verb: 'Start', category: 'develop', icon: 'play', primary: true,
      describe: `Attach talent and a budget to one of your ${L.props} and start development. You will get go/no-go decisions along the way.`, tradeoff: 'Talent fees and production costs add up before a single ticket is sold.', risk: 'Quality is uncertain until previews; many productions never recoup.',
      params: [{ id: 'prop', label: P, type: 'entity', kind: 'property', filter: 'it.owner == org && !it.used', sort: "est(it, 'appeal').value" },
        { id: 'director', label: roleLabel[roleIds[0]], type: 'entity', kind: 'talent', filter: freeTalent(roleIds[0]), sort: "est(it, 'skill').value + it.fame * 0.3" },
        { id: 'star', label: roleLabel[roleIds[1]], type: 'entity', kind: 'talent', filter: freeTalent(roleIds[1]), sort: 'it.fame' },
        { id: 'writer', label: roleLabel[roleIds[2]], type: 'entity', kind: 'talent', filter: freeTalent(roleIds[2]), sort: "est(it, 'skill').value" },
        { id: 'budget', label: 'Budget', type: 'choice', default: '1', aiValue: "archetype(org) == 'commercial' ? 1.6 : 1", options: budgetOpts },
        { id: 'scale', label: genre === 'broadway' ? 'Theater' : 'Release', type: 'choice', default: '1', aiValue: '1', options: L.scale }],
      vars: { bud: 'params.budgetBase * param.budget * world.costIndex', fees: 'param.director.fee + param.star.fee + param.writer.fee' },
      requires: [{ expr: 'org.cash >= bud * 0.3 + fees', msg: 'Not enough cash to start (you need about a third of the budget plus fees)' }],
      cost: { cash: 'fees' }, costCategory: 'Talent fees',
      preview: [{ label: 'Budget', expr: 'bud', format: 'money' }, { label: 'Talent fees (now)', expr: 'fees', format: 'money' }, { label: 'Appeal (estimate)', expr: "est(param.prop, 'appeal').value", format: 'score' }, { label: `${roleLabel[roleIds[0]]} skill (estimate)`, expr: "est(param.director, 'skill').value", format: 'score' }, { label: `${roleLabel[roleIds[1]]} fame`, expr: 'param.star.fame', format: 'score' }, { label: 'Weeks until opening', expr: String(stagesTotal), format: 'int' }],
      effects: [
        { op: 'create', kind: 'production', as: 'pd', set: { property: 'param.prop', director: 'param.director', star: 'param.star', writer: 'param.writer', budget: 'bud', scale: '+param.scale', phase: "'development'" } },
        { op: 'set', path: 'pd.name', value: 'param.prop.name' },
        { op: 'set', path: 'pd.quality', value: 'clamp(param.prop.appeal * 0.35 + param.prop.prestige * 0.15 + param.director.skill * 0.25 + param.writer.skill * 0.15 + param.star.skill * 0.1 + (param.budget - 1) * 9 + randn(0, 9), 5, 99)' },
        { op: 'set', path: 'param.prop.used', value: 'true' },
        { op: 'each', list: '[param.director, param.star, param.writer]', do: [{ op: 'set', path: 'it.busyUntil', value: `time.tick + ${stagesTotal + 12}` }] },
        { op: 'project', id: 'produce', target: 'pd', set: { budget: 'bud' }, name: '{param.prop.name}' }
      ],
      result: `{param.prop.name} enters development`,
      ai: { score: "org.cash > params.budgetBase * param.budget * 1.3 && count(owned('production', org), it.phase != 'running' && it.phase != 'closed') < 2 ? (param.prop.appeal + param.director.skill * 0.6 + param.star.fame * 0.4 + randn(0, 12) - 75) * 2000 : 0", candidates: 3, news: '{org.name} greenlights {param.prop.name}' } },
    { id: 'marketingPush', label: 'Marketing push', verb: 'Promote', kind: 'production', category: 'run', icon: 'megaphone', cooldown: 8,
      describe: 'Ads, press, appearances. Buzz rises now and fades over time.', tradeoff: 'Real money for attention that fades within weeks.', cost: { cash: 'self.budget * 0.05' }, costCategory: 'Marketing',
      requires: [{ expr: "self.phase == 'running' || self.phase == '" + L.stages[L.stages.length - 2][1] + "'", msg: 'Only once it is about to open or running' }],
      effects: [{ op: 'set', path: 'self.buzz', value: 'self.buzz + 0.3' }], result: 'Marketing push for {self.name}',
      ai: { score: "self.phase == 'running' && self._load < 0.8 && self.reviews > 55 ? self.budget * 0.01 : 0", selfSample: 3 } },
    { id: 'setTicketPrice', label: 'Set prices', verb: 'Reprice', kind: 'production', category: 'run', icon: 'tag', tradeoff: 'Premium prices mean emptier houses; discounts fill seats but cheapen the brand.',
      params: [{ id: 'mult', label: 'Price level', type: 'choice', default: 'self.priceMult', options: [{ value: 0.75, label: '−25% (discount)' }, { value: 0.9, label: '−10%' }, { value: 1, label: 'Standard' }, { value: 1.15, label: '+15%' }, { value: 1.35, label: '+35% (premium)' }] }],
      requires: [{ expr: "self.phase == 'running'", msg: 'Not running' }],
      forecast: { kind: 'production', exclude: 'self', set: { property: 'self.property', star: 'self.star', quality: 'self.quality', reviews: 'self.reviews', buzz: 'self.buzz', scale: 'self.scale', phase: "'running'", priceMult: '+param.mult', opened: 'self.opened', budget: 'self.budget', starFame: 'self.starFame', weeks: 'self.weeks' } },
      preview: [{ label: 'Expected sales / week', expr: 'fc.sold', format: 'int' }, { label: 'Expected capacity used', expr: 'fc.load', format: 'pct' }, { label: 'Expected weekly result', expr: 'fc.profit', format: 'signedMoney' }],
      effects: [{ op: 'set', path: 'self.priceMult', value: '+param.mult' }], result: '{self.name} repriced' },
    { id: 'recast', label: `Recast the ${roleLabel[roleIds[1]].toLowerCase()}`, verb: 'Recast', kind: 'production', category: 'run', icon: 'user', cooldown: 26,
      describe: 'A new star can revive a fading production.', tradeoff: 'Fees, and fans of the old lead may leave.',
      params: [{ id: 'star', label: 'New ' + roleLabel[roleIds[1]].toLowerCase(), type: 'entity', kind: 'talent', filter: freeTalent(roleIds[1]), sort: 'it.fame' }],
      requires: [{ expr: "self.phase == 'running'", msg: 'Not running' }],
      cost: { cash: 'param.star.fee' }, costCategory: 'Talent fees',
      effects: [{ op: 'set', path: 'self.star', value: 'param.star' }, { op: 'set', path: 'param.star.busyUntil', value: 'time.tick + 52' }, { op: 'set', path: 'self.buzz', value: 'self.buzz + param.star.fame / 80' }], result: '{param.star.name} takes over in {self.name}' },
    { id: 'closeProduction', label: L.closeWord, verb: 'Close', kind: 'production', category: 'run', icon: 'close', danger: true,
      describe: 'End the run. Stops the weekly losses — and the weekly income.', tradeoff: 'Unrecouped budget is lost for good.',
      requires: [{ expr: "self.phase == 'running'", msg: 'Not running' }],
      effects: [{ op: 'set', path: 'self.phase', value: "'closed'" }, { op: 'set', path: 'self.closedAt', value: 'time.tick' }, { op: 'if', cond: '!self.recouped', then: [{ op: 'set', path: 'org.flops', value: 'org.flops + 1' }] }, { op: 'news', text: '{self.name} closes after {int(self.weeks)} weeks ({money(self.gross)} gross)' }],
      result: '{self.name} closes', ai: { score: "self.phase == 'running' && self.weeksLosing >= org.closePolicy ? 100000 : 0", selfSample: 6, news: '{org.name} closes {self.name}' } }
  ];
  if (f.sequels) gdl.actions.push({ id: L.sequelId, label: L.sequelWord, verb: 'Greenlight', kind: 'production', category: 'develop', icon: 'up',
    describe: 'Build on a hit: a known title, an audience waiting for it.', tradeoff: 'Diminishing novelty; critics are tougher on follow-ups.',
    preview: [{ label: 'Budget', expr: 'self.budget * 1.15', format: 'money' }, { label: 'Original gross', expr: 'self.gross', format: 'money' }, { label: 'Original reviews', expr: 'self.reviews', format: 'score' }, { label: 'Weeks until it opens', expr: String(stagesTotal), format: 'int' }],
    requires: [{ expr: 'self.recouped', msg: 'Only hits get follow-ups' }, { expr: "count(all('production'), it.sequelOf == self.id) == 0", msg: 'Already done' }],
    cost: { cash: 'self.budget * 0.15' }, costCategory: 'Production costs',
    effects: [{ op: 'create', kind: 'production', as: 'pd', set: { property: 'self.property', director: 'self.director', star: 'self.star', writer: 'self.writer', budget: 'self.budget * 1.15', scale: 'self.scale', phase: "'development'", sequelOf: 'self.id' } },
      { op: 'set', path: 'pd.name', value: `self.name + ' ${genre === 'broadway' ? '(Tour)' : genre === 'tv-network' ? ': Origins' : ' II'}'` },
      { op: 'set', path: 'pd.quality', value: 'clamp(self.quality * 0.85 + randn(0, 8), 5, 99)' }, { op: 'set', path: 'pd.buzz', value: '1.5' },
      { op: 'project', id: 'produce', target: 'pd', set: { budget: 'self.budget * 1.15' }, name: '{pd.name}' }],
    result: 'Follow-up to {self.name} greenlit', ai: { score: 'self.recouped && org.cash > self.budget ? self.gross * 0.01 : 0', selfSample: 3 } });
  gdl.actions.push(...C.financeActions());

  /* ---------------- policies ---------------- */
  gdl.policies = [
    { id: 'closing', label: 'When to close a losing run', scope: 'org', default: 'patient', describe: 'Your general manager closes productions that keep losing money.',
      options: [{ value: 'manual', label: 'Ask me', describe: 'Losers go to Needs you.', effects: [{ op: 'set', path: 'org.closePolicy', value: '999' }] }, { value: 'quick', label: 'Close fast (3 losing weeks)', effects: [{ op: 'set', path: 'org.closePolicy', value: '3' }, { op: 'autoAct', action: 'closeProduction', max: '2' }] }, { value: 'patient', label: 'Give it time (8 losing weeks)', effects: [{ op: 'set', path: 'org.closePolicy', value: '8' }, { op: 'autoAct', action: 'closeProduction', max: '2' }] }] },
    { id: 'marketing', label: 'Marketing intensity', scope: 'org', default: 'standard', describe: 'Opening buzz for every production.',
      options: [{ value: 'low', label: 'Word of mouth', effects: [{ op: 'set', path: 'org.mktPct', value: '0.7' }] }, { value: 'standard', label: 'Standard', effects: [{ op: 'set', path: 'org.mktPct', value: '1' }] }, { value: 'heavy', label: 'Blanket the city', describe: 'Higher opening buzz.', effects: [{ op: 'set', path: 'org.mktPct', value: '1.5' }] }] },
    { id: 'pricing', label: 'Revenue management', scope: 'kind:production', default: 'dynamic', every: 2, describe: 'Your box office adjusts prices toward full houses.',
      options: [{ value: 'manual', label: 'Manual' }, { value: 'dynamic', label: 'Dynamic pricing', effects: [{ op: 'if', cond: "self.phase == 'running' && self._load > 0.97 && self.priceMult < 1.4", then: [{ op: 'mul', path: 'self.priceMult', value: '1.04' }] }, { op: 'if', cond: "self.phase == 'running' && self._load < 0.7 && self.priceMult > 0.7", then: [{ op: 'mul', path: 'self.priceMult', value: '0.96' }] }] }] }
  ];
  const b = C.board();
  gdl.stakeholders = [b.stakeholder];
  if (f.investors) gdl.stakeholders.push({ id: 'backers', label: 'Investor confidence', start: 55, base: '50', speed: 0.05, describe: 'Your backers. They fund half of every production — if they trust you.', drivers: [{ label: 'Recoupment record', expr: '(org.recoupRate - 0.3) * 60' }, { label: 'Hits', expr: 'min(15, org.hits * 3)' }, { label: 'Flops', expr: '-min(20, org.flops * 2)' }] });
  if (f.talent) gdl.stakeholders.push({ id: 'talentRel', label: 'Talent relations', start: 55, base: '50', speed: 0.04, describe: 'Whether agents send you their best clients.', drivers: [{ label: 'Prestige', expr: '(org.reputation - 50) * 0.3' }, { label: 'Hits', expr: 'min(12, org.hits * 2)' }] });

  /* ---------------- events ---------------- */
  gdl.events = [b.event, C.recessionEvent('Shelve the riskiest developments'),
    { id: 'starWalks', priority: 'important', chance: '0.025', cooldown: 20, title: '{s.name} wants out of {pd.name}', text: 'An offer elsewhere — or creative frustration. The ' + roleLabel[roleIds[1]].toLowerCase() + ' threatens to leave.',
      bind: { pd: { kind: 'production', owner: 'player', filter: "it.phase == 'running' && it.star" }, s: { kind: 'talent', filter: 'it == pd.star' } },
      choices: [{ label: 'Pay to keep them (+50% fee)', cost: 's.fee * 0.5', effects: [{ op: 'add', path: 's.fame', value: '1' }], result: '{s.name} stays' }, { label: 'Let them go', effects: [{ op: 'set', path: 'pd.star', value: 'null' }, { op: 'set', path: 'pd.buzz', value: 'pd.buzz * 0.8' }], result: '{s.name} leaves {pd.name}' }] },
    { id: 'viral', priority: 'routine', chance: '0.02', cooldown: 12, title: '{pd.name} goes viral', bind: { pd: { kind: 'production', owner: 'player', filter: "it.phase == 'running' && it.quality > 60" } }, effects: [{ op: 'add', path: 'pd.buzz', value: '0.6' }], news: '{pd.name} goes viral — demand surges' },
    { id: 'rivalHit', priority: 'important', chance: '0.03', cooldown: 16, title: 'A rival smash opens: {rp.name}', text: '{rp.owner.name}\'s {rp.name} opened to {int(rp.reviews)}/100. Audiences are flocking to it.',
      bind: { rp: { kind: 'production', owner: 'rival', filter: "it.phase == 'running' && it.weeks < 3 && it.reviews > 75" } },
      choices: [{ label: 'Counter-program with a marketing blitz', cost: `params.budgetBase * 0.04`, effects: [{ op: 'each', list: "filter(owned('production', player), it.phase == 'running')", do: [{ op: 'add', path: 'it.buzz', value: '0.3' }] }], result: 'You fight for attention' }, { label: 'Ride it out', effects: [], result: 'You hold your fire' }] },
    { id: 'hotProperty', priority: 'important', chance: '0.03', cooldown: 10, title: `A hot ${L.prop} is on the market: {pr.name}`, text: `{pr.genre.name}. Everybody is talking about it — rights {money(pr.rightsCost * 2)} if you move today.`,
      bind: { pr: { kind: 'property', filter: '!it.owner && !it.used && it.appeal > 70', pick: 'max', by: 'it.appeal' } },
      choices: [{ label: 'Pay the premium', cost: 'pr.rightsCost * 2', effects: [{ op: 'transfer', target: 'pr', to: 'player' }], result: 'You option {pr.name}' }, { label: 'Pass', effects: [], result: 'You pass', track: { text: `Passed on {pr.name}`, ref: 'pr' } }] }
  ];
  if (f.awards) gdl.events.push({ id: 'awardsNight', priority: 'important', when: `time.tickOfYear == ${genre === 'broadway' ? 22 : isFilm ? 9 : genre === 'tv-network' ? 37 : genre === 'record-label' ? 5 : 45}`, cooldown: 40, title: `Awards night: ${L.awardShow}`, text: '{pd.name} is nominated for ' + L.award + '. A campaign could tip the voters.',
    bind: { pd: { kind: 'production', owner: 'player', filter: "(it.phase == 'running' || time.tick - it.closedAt < 40) && it.reviews >= 70", pick: 'max', by: 'it.reviews' } },
    choices: [{ label: 'Run an awards campaign', cost: 'params.budgetBase * 0.02', effects: [{ op: 'chance', p: 'clamp((pd.reviews - 60) / 45, 0.1, 0.8)', then: [{ op: 'set', path: 'pd.awardsWon', value: 'pd.awardsWon + 1' }, { op: 'set', path: 'player.awards', value: 'player.awards + 1' }, { op: 'set', path: 'pd.buzz', value: 'pd.buzz + 0.8' }, { op: 'set', path: 'pd.keep', value: 'true' }, { op: 'resource', id: 'reputation', add: '6' }, { op: 'moment', title: '{pd.name} wins ' + L.award, text: 'The room is on its feet.', stat: '🏆' }], else: [{ op: 'news', text: '{pd.name} goes home empty-handed' }] }], result: 'Campaign run' },
      { label: 'Let the work speak', effects: [{ op: 'chance', p: 'clamp((pd.reviews - 65) / 60, 0.05, 0.6)', then: [{ op: 'set', path: 'pd.awardsWon', value: 'pd.awardsWon + 1' }, { op: 'set', path: 'player.awards', value: 'player.awards + 1' }, { op: 'set', path: 'pd.keep', value: 'true' }, { op: 'resource', id: 'reputation', add: '7' }, { op: 'moment', title: '{pd.name} wins ' + L.award, text: 'No campaign — just the work.', stat: '🏆' }] }], result: 'You let the work speak' }] });

  /* ---------------- progression, history, needs ---------------- */
  gdl.progression = {
    tiers: [{ id: 'indie', label: 'Independent' }, { id: 'established', label: 'Established', when: 'player.hits >= 2', text: 'Agents return your calls; bigger budgets are realistic.' }, { id: 'major', label: 'Major player', when: 'player.hits >= 6 && player.reputation >= 55', text: 'You can run a full slate at once.' }, { id: 'legend', label: 'Legendary', when: 'player.hits >= 15 && player.awards >= 3', text: 'Your name sells tickets on its own.' }],
    objectives: C.objectives([{ id: 'hit', text: `Recoup {int(target)} ${L.units}`, metric: 'player.hits', target: 'base + 1', weight: 2, reward: [{ op: 'stake', id: 'board', add: '10' }], penalty: [{ op: 'stake', id: 'board', add: '-8' }] }]),
    failure: C.failure({ unit: 'rights and assets' }),
    victory: [{ id: 'top', label: `The most celebrated ${L.org.toLowerCase()}`, when: 'player.awards >= 5 && count(rivals(), it.level < 3 && it.value > player.value) == 0', text: 'More awards and more value than anyone.' }]
  };
  gdl.history = C.history({ unitLabel: L.units, unitMetric: 'org.hits', awardName: `${L.org} of the Year`, awardScore: 'org.avgReviews + org.hits * 3 + org.margin * 50' });
  gdl.history.records.push({ id: 'longestRun', label: 'Longest run', expr: "maxOf(owned('production', org), it.weeks)", format: 'int' }, { id: 'biggestGross', label: 'Biggest gross', expr: "maxOf(owned('production', org), it.gross)", format: 'money' });
  gdl.history.milestones.push({ id: 'firstOpen', label: 'First opening', when: "count(owned('production', player), it.opened > 0) >= 1", text: 'Your first production meets its audience.' }, { id: 'firstHit', label: 'First hit', when: 'player.hits >= 1', text: 'A production pays back every dollar.' }, { id: 'award', label: 'First major award', when: 'player.awards >= 1', text: L.award + '.' });
  gdl.needs = [
    { id: 'gate', when: 'false', text: '' },
    { id: 'losing', forEach: 'production', when: "self.owner && isPlayer(self.owner) && self.phase == 'running' && self.weeksLosing >= 3", text: '{self.name} has lost money {int(self.weeksLosing)} weeks running', sub: 'Promote it, reprice, recast — or close it', action: 'closeProduction', priority: 1, tone: 'bad' },
    { id: 'noProps', when: "count(owned('property', player), !it.used) == 0 && count(owned('production', player), it.phase != 'running' && it.phase != 'closed') == 0", text: `Your development slate is empty`, sub: `Option a ${L.prop} to keep the pipeline full`, action: 'acquireRights', priority: 1, tone: 'warn' },
    { id: 'idleProps', when: "count(owned('property', player), !it.used) > 0 && count(owned('production', player), it.phase != 'running' && it.phase != 'closed') == 0", text: `You own ${L.props} with nothing in development`, sub: `Attach talent and start a ${L.unit}`, action: 'developProduction', priority: 1, tone: 'info' }
  ];
  gdl.needs = gdl.needs.filter(n => n.id !== 'gate');

  /* ---------------- interface ---------------- */
  const scr = C.standardScreens({
    goal: gdl.meta.goal, primary: ['developProduction', 'acquireRights'],
    homeSubtitle: '{player.running} ' + L.runWord.toLowerCase() + ' · {player.developing} in development · {player.hits} hits',
    metrics: [{ label: 'Weekly gross', expr: 'player.weeklyGross', format: 'money', metric: 'weeklyGross' }, { label: 'Cash', expr: 'player.cash', format: 'money' }, { label: 'Hits', expr: 'player.hits', format: 'int', sub: '{int(player.flops)} flops' }, { label: 'Prestige', expr: 'player.reputation', format: 'score', explain: 'resource:reputation' }],
    signature: [{ type: 'board', title: L.runWord, width: 'full', kind: 'production', owner: 'player', filter: "it.phase == 'running'", sort: 'it._rev', limit: 8, tour: 'board',
      columns: [{ label: U, expr: 'it.name' }, { label: 'Week', expr: 'it.weeks', format: 'int' }, { label: 'Capacity', expr: 'it._load', format: 'pct' }, { label: 'Gross / wk', expr: 'it._rev', format: 'money' }, { label: L.reviewWord, expr: 'it.reviews', format: 'score' }, { label: 'Recouped', expr: 'it.recoupPct', format: 'pct' }],
      status: "it.weeksLosing >= 3 ? 'Losing' : it._load > 0.95 ? 'Sold out' : 'Running'", empty: `Nothing ${L.runWord.toLowerCase()} yet.` },
      { type: 'pipeline', title: 'In development', width: 'full', empty: `Nothing in development. Option a ${L.prop} and start one.` }]
  });
  scr.develop = { title: 'Development', subtitle: `${Ps}, talent and the pipeline`, actions: ['acquireRights', 'developProduction'],
    tabs: [{ id: 'mine', label: 'Your ' + L.props, sections: [{ type: 'cards', title: 'Rights you own', width: 'full', kind: 'property', owner: 'player', filter: '!it.used', size: 's', glyph: `'${L.glyph}'`, glyphScale: '0.35', badge: '{it.genre.name}', stats: [{ label: 'Appeal (est.)', expr: "est(it, 'appeal').value", format: 'score' }, { label: 'Critics (est.)', expr: "est(it, 'prestige').value", format: 'score' }], empty: `No ${L.props} yet.` }, { type: 'pipeline', title: 'Pipeline', width: 'full' }] },
      { id: 'market', label: 'Available', sections: [{ type: 'table', title: `${Ps} on the market`, width: 'full', kind: 'property', filter: '!it.owner && !it.used', sort: "est(it, 'appeal').value", search: true, limit: 25, columns: [{ label: P, expr: 'it.name' }, { label: 'Genre', expr: 'it.genre.name', format: 'text' }, { label: 'Appeal (est.)', expr: "est(it, 'appeal').value", format: 'score' }, { label: 'Critics (est.)', expr: "est(it, 'prestige').value", format: 'score' }, { label: 'Rights', expr: 'it.rightsCost', format: 'money' }] },
        { type: 'cards', title: 'Genre trends', width: 'full', kind: 'genreSlot', sort: 'it.trend', size: 's', stats: [{ label: 'Trend', expr: 'it.trend', format: 'x' }] }] },
      { id: 'talent', label: 'Talent', sections: [{ type: 'table', title: 'Available talent', width: 'full', kind: 'talent', filter: 'it.busyUntil <= time.tick', sort: 'it.fame', search: true, limit: 25, columns: [{ label: 'Name', expr: 'it.name' }, { label: 'Role', expr: L.roles.map(r => `it.role == '${r[0]}' ? '${r[1]}'`).join(' : ') + " : ''", format: 'text' }, { label: 'Skill (est.)', expr: "est(it, 'skill').value", format: 'score' }, { label: 'Fame', expr: 'it.fame', format: 'score' }, { label: 'Fee', expr: 'it.fee', format: 'money' }, { label: 'Credits', expr: 'it.credits', format: 'int' }] }] }] };
  scr.running = { title: L.runWord, subtitle: '{player.running} running · {money(player.weeklyGross)} a week',
    sections: [{ type: 'cards', title: 'Your productions', width: 'full', kind: 'production', owner: 'player', filter: "it.phase == 'running'", sort: 'it._rev', size: 'm', glyph: `'${L.glyph}'`, glyphScale: '0.45', glyphColor: "it._profit >= 0 ? 'var(--accent)' : 'var(--bad)'", badge: '{it.recouped ? "Recouped" : pct(it.recoupPct) + " recouped"}', badgeTone: "it.recouped ? 'good' : 'warn'",
      stats: [{ label: 'Capacity', expr: 'it._load', format: 'pct' }, { label: 'Profit/wk', expr: 'it._profit', format: 'signedMoney', tone: "v < 0 ? 'bad' : 'good'" }, { label: L.reviewWord, expr: 'it.reviews', format: 'score' }, { label: 'Buzz', expr: 'it.buzz', format: 'x' }], actions: ['marketingPush', 'setTicketPrice', 'closeProduction'], empty: `Nothing ${L.runWord.toLowerCase()}.` },
      { type: 'chart', width: 'full', title: 'Weekly gross', series: [{ label: 'Weekly gross', metric: 'weeklyGross' }], format: 'money', window: 104 },
      { type: 'table', title: 'Past productions', width: 'full', kind: 'production', owner: 'player', filter: "it.phase == 'closed'", sort: 'it.gross', limit: 15, columns: [{ label: U, expr: 'it.name' }, { label: 'Weeks', expr: 'it.closedAt - it.opened', format: 'int' }, { label: 'Gross', expr: 'it.gross', format: 'money' }, { label: 'Budget', expr: 'it.budget', format: 'money' }, { label: L.reviewWord, expr: 'it.reviews', format: 'score' }, { label: 'Awards', expr: 'it.awardsWon', format: 'int' }], rowActions: f.sequels ? [L.sequelId] : [] }] };
  gdl.ui = { topbar: [{ label: 'Cash', expr: 'player.cash', format: 'money' }, { label: 'Gross / week', expr: 'player.weeklyGross', format: 'money' }, { label: 'Prestige', expr: 'player.reputation', format: 'score', explain: 'resource:reputation' }],
    nav: [{ id: 'home', label: 'Overview', icon: 'home' }, { id: 'develop', label: 'Development', icon: 'star' }, { id: 'running', label: L.runWord, icon: 'ticket' }, { id: 'company', label: 'Company', icon: 'bank' }, { id: 'industry', label: 'Industry', icon: 'globe' }],
    screens: scr };
  gdl.theme = C.theme(L.motif, { logo: { text: title.split(/\s+/).map(w => w[0]).join('').slice(0, 2) } });
  gdl.onboarding = C.onboarding({ title: 'Welcome, ' + (opts.role || 'producer'), text: `{player.name} owns the rights to two ${L.props} and has ${'$' + Math.round(budgetM * 2.5 / 1e6) + 'M'} in the bank. Make something people will line up for.`,
    bullets: [{ icon: 'star', title: 'Develop', text: `Attach a ${roleLabel[roleIds[0]].toLowerCase()}, a ${roleLabel[roleIds[1]].toLowerCase()} and a budget. Go/no-go decisions come at each stage.` }, { icon: 'ticket', title: 'Open & run', text: `Every running ${L.unit} competes for the same ${L.audience}. ${L.reviewWord} and buzz decide who wins.` }, { icon: 'alert', title: 'Hits pay for flops', text: 'Most productions never recoup. Manage the slate.' }],
    primaryAction: { id: 'developProduction', label: `Develop a ${L.unit}` }, primaryNav: 'develop', unitNoun: L.units });
  gdl.newGame = { options: [{ id: 'name', label: 'Company name', type: 'text', default: gdl.orgs.player.name }] };
  gdl.glossary = [{ term: 'Recoup', text: 'When a production\'s share of the gross has paid back its whole budget.' }, { term: 'Buzz', text: 'Short-term attention; spikes at opening and with marketing, fades every week.' }, { term: L.reviewWord, text: `What ${L.critic} said at opening. Hard to change later.` }, { term: 'Capacity', text: `Share of available ${genre === 'broadway' ? 'seats' : 'reach'} actually sold.` }];
  gdl.balance = { knobs: [{ path: 'params.demandK', label: 'Audience size', effect: 'easier', min: 0.4, max: 3 }, { path: 'params.runCostPct', label: 'Running costs', effect: 'harder', min: 0.01, max: 0.08 }, { path: 'params.propFlow', label: 'New properties', effect: 'easier', min: 0.1, max: 0.8 }], targets: { smartMargin: [0.0, 0.3], maxGrowth: 10 } };
  gdl.meta.howToPlay = `Each turn is a week. Option ${L.props}, then start a ${L.unit}: choose a ${roleLabel[roleIds[0]].toLowerCase()}, a ${roleLabel[roleIds[1]].toLowerCase()}, a ${roleLabel[roleIds[2]].toLowerCase()} and a budget. Development runs in stages with go/no-go decisions; ${genre === 'broadway' ? 'previews' : 'early screenings'} reveal how good it really is. Once it opens, every running ${L.unit} competes for the same ${L.audience} on quality, ${L.reviewWord.toLowerCase()}, star power, buzz and price. Close losers, promote winners, and turn hits into follow-ups. Investors can fund half of each budget for a share of the profits.`;
  return gdl;
}

const FEATURES = [
  { id: 'rights', label: 'Option properties with hidden appeal', keywords: ['rights', 'option', 'property', 'properties', 'script', 'scripts', 'pitch', 'ideas', 'demo'], paths: ['kinds.property', 'actions.acquireRights'] },
  { id: 'talent', label: 'Creative teams and stars', keywords: ['talent', 'stars', 'star', 'creative team', 'creatives', 'director', 'cast', 'casting', 'hire'], paths: ['kinds.talent'], flag: 'talent' },
  { id: 'pipeline', label: 'Staged development with go/no-go gates', keywords: ['develop', 'development', 'previews', 'rehearsal', 'production', 'greenlight', 'pilot', 'workshop', 'openings', 'opening'], paths: ['projects.produce', 'actions.developProduction'] },
  { id: 'investors', label: 'Investors and capitalization', keywords: ['investors', 'investor', 'raise capital', 'capital', 'backers', 'financing'], paths: ['stakeholders.backers'], flag: 'investors' },
  { id: 'market', label: 'Audience market with reviews, buzz and pricing', keywords: ['box office', 'tickets', 'theaters', 'theater', 'audience', 'ratings', 'pricing', 'long runs', 'runs'], paths: ['markets.audience', 'actions.setTicketPrice'] },
  { id: 'critics', label: 'Critics and reviews', keywords: ['critics', 'critic', 'reviews', 'review'], paths: ['projects.produce'], flag: 'critics' },
  { id: 'awards', label: 'Awards season', keywords: ['awards', 'award', 'tony', 'oscar', 'emmy', 'grammy'], paths: ['events.awardsNight'], flag: 'awards' },
  { id: 'sequels', label: 'Tours, sequels and spin-offs', keywords: ['tour', 'tours', 'sequel', 'sequels', 'franchise', 'spin-off', 'spinoff'], paths: ['actions'], flag: 'sequels' },
  { id: 'rivals', label: 'Rival producers', keywords: ['rivals', 'competitors', 'competition'], paths: ['orgs.rivals'] },
  { id: 'history', label: 'History, records and awards', keywords: ['history', 'records', 'legacy'], paths: ['history'] }
];
module.exports = { id: 'slate', loop: 'project-lifecycle', genres: Object.keys(LEX).filter(k => k !== 'generic'), build, FEATURES, LEX };
