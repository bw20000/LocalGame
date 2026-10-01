/* Archetype: INSTITUTION OF PROGRAMS IN SEASONS (stewardship + competition).
   University athletic directors, college football, sports front offices, motorsport teams. The player
   runs a department of programs (sports, squads, teams). Every school/club in the world has its own
   programs; each in-season week every program plays a real game against another program of the same
   sport (win probability from strength, coaching and home advantage). Seasons end with champions,
   recruiting and coaching carousels. Money comes from tickets, media deals and boosters; it goes to
   coaches, budgets and facilities. Presidents, boosters and compliance officers all want different
   things. */
'use strict';
const C = require('../common');

const SPORTS = {
  university: [
    { id: 'football', name: 'Football', start: 34, len: 14, revenue: 1, rev: 900000, cost: 420000, pop: 1.0, glyph: 'tower' },
    { id: 'mbb', name: "Men's basketball", start: 44, len: 18, revenue: 1, rev: 260000, cost: 140000, pop: 0.7, glyph: 'star' },
    { id: 'wbb', name: "Women's basketball", start: 44, len: 18, revenue: 0, rev: 50000, cost: 80000, pop: 0.35, glyph: 'star' },
    { id: 'baseball', name: 'Baseball', start: 6, len: 14, revenue: 0, rev: 30000, cost: 60000, pop: 0.25, glyph: 'chart' },
    { id: 'soccer', name: "Women's soccer", start: 33, len: 12, revenue: 0, rev: 15000, cost: 45000, pop: 0.2, glyph: 'chart' },
    { id: 'volley', name: 'Volleyball', start: 34, len: 13, revenue: 0, rev: 20000, cost: 40000, pop: 0.2, glyph: 'chart' }],
  'college-football': [
    { id: 'football', name: 'Football', start: 34, len: 14, revenue: 1, rev: 1100000, cost: 500000, pop: 1.0, glyph: 'tower' },
    { id: 'mbb', name: "Men's basketball", start: 44, len: 18, revenue: 1, rev: 200000, cost: 120000, pop: 0.6, glyph: 'star' }],
  'sports-front-office': [
    { id: 'first', name: 'First team', start: 32, len: 34, revenue: 1, rev: 1800000, cost: 1300000, pop: 1.0, glyph: 'tower' },
    { id: 'reserves', name: 'Reserve team', start: 32, len: 34, revenue: 0, rev: 30000, cost: 90000, pop: 0.2, glyph: 'chart' },
    { id: 'academy', name: 'Academy', start: 32, len: 34, revenue: 0, rev: 0, cost: 60000, pop: 0.1, glyph: 'star' }],
  motorsport: [
    { id: 'f1', name: 'Grand Prix team', start: 10, len: 36, revenue: 1, rev: 2200000, cost: 2000000, pop: 1.0, glyph: 'route' },
    { id: 'junior', name: 'Junior series team', start: 10, len: 30, revenue: 0, rev: 40000, cost: 160000, pop: 0.2, glyph: 'route' }]
};
const LEX = {
  university: { title: 'Athletic Director', tagline: 'Win games. Balance the budget. Keep everyone — almost — happy.', org: 'Athletic department', orgs: 'Athletic departments', unit: 'program', units: 'programs', coach: 'coach', coaches: 'coaches', motif: 'broadcast', boss: 'University president', fans: 'Boosters', champ: 'national championship', award: 'Athletic Director of the Year', conf: 'conference',
    schools: ['Northfield State', 'Riverbend University', 'Coastal Tech', 'Lakeshore College', 'Pine Ridge University', 'Highland A&M', 'Western Plains', 'Eastbrook University', 'Summit State', 'Bayview University', 'Granite College', 'Sunvale State'],
    verbs: ['Hire the coach who changes everything', 'Build a stadium the boosters will pay for', 'Win a national championship', 'Survive a compliance scandal', 'Balance the budget without cutting a team'] },
  'college-football': { title: 'Saturday Dynasty', tagline: 'Recruit, scheme, win — and keep the boosters writing checks.', org: 'Program', orgs: 'Programs', unit: 'team', units: 'teams', coach: 'coordinator', coaches: 'coaches', motif: 'broadcast', boss: 'Athletic director', fans: 'Boosters', champ: 'national title', award: 'Coach of the Year', conf: 'conference',
    schools: ['Northfield State', 'Riverbend', 'Coastal Tech', 'Lakeshore', 'Pine Ridge', 'Highland A&M', 'Western Plains', 'Eastbrook', 'Summit State', 'Bayview', 'Granite', 'Sunvale State'], verbs: ['Turn a doormat into a contender', 'Beat your rival on the last play', 'Win the national title'] },
  'sports-front-office': { title: 'Front Office', tagline: 'Build the club. Win the league. Answer to the owner.', org: 'Club', orgs: 'Clubs', unit: 'squad', units: 'squads', coach: 'head coach', coaches: 'coaches', motif: 'paddock', boss: 'Owner', fans: 'Supporters', champ: 'league championship', award: 'Executive of the Year', conf: 'league',
    schools: ['Harbor City FC', 'River Valley United', 'Northshore Athletic', 'Capital City', 'Desert Sun FC', 'Lakeside Rovers', 'Mountain Town', 'Bayview Albion', 'Ironworks FC', 'Prairie United', 'Coastal Wanderers', 'Twin Rivers'], verbs: ['Hire the manager who builds a dynasty', 'Develop academy stars', 'Win the league'] },
  motorsport: { title: 'Pole Position', tagline: 'Engineers, drivers and the championship.', org: 'Team', orgs: 'Teams', unit: 'car program', units: 'car programs', coach: 'technical director', coaches: 'technical directors', motif: 'paddock', boss: 'Team principal\'s board', fans: 'Sponsors', champ: 'world championship', award: 'Team of the Year', conf: 'series',
    schools: ['Vantage Racing', 'Corsa Rossa', 'Apex Motorsport', 'Northwind GP', 'Blue Arrow Racing', 'Ironclad Racing', 'Solaris GP', 'Meridian Motorsport', 'Falcon Racing', 'Velocity Works'], verbs: ['Hire a genius technical director', 'Win the championship on the last lap', 'Build a team that lasts'] }
};
LEX.generic = LEX.university;
const cap = (s) => s[0].toUpperCase() + s.slice(1);

function build(opts = {}) {
  const alias = { 'hospital-system': 'university', 'university': 'university' };
  const genre = LEX[opts.genre] ? opts.genre : (alias[opts.genre] || 'university');
  const L = Object.assign({}, LEX[genre], opts.lexicon || {});
  const sports = SPORTS[genre] || SPORTS.university;
  const f = Object.assign({ facilities: true, media: true, compliance: true, boosters: true, recessions: true }, opts.features || {});
  const title = opts.title || L.title;
  const U = cap(L.unit), Us = cap(L.units), Co = cap(L.coach), Cos = cap(L.coaches);
  const schools = L.schools;
  const nSchools = schools.length;
  const gdl = {
    gdl: 1,
    meta: { id: opts.id || genre + '-institution', version: 1, title, tagline: L.tagline, genre: opts.genre || genre, role: opts.role || (genre === 'university' ? 'Athletic Director' : genre === 'college-football' ? 'Head Coach & GM' : genre === 'motorsport' ? 'Team Principal' : 'General Manager'), fantasy: L.verbs,
      pillars: ['Winning costs money; money comes from winning — break the loop the right way', 'Coaches are the biggest decisions you make', `Every stakeholder wants something different: ${L.boss.toLowerCase()}, ${L.fans.toLowerCase()}, compliance`], universe: 'fictional',
      disclaimer: 'All schools, clubs, people and competitions are fictional.',
      goal: `Turn {player.name} into a ${L.champ} contender — without breaking the budget or the rules.` },
    time: { unit: 'week', start: '2026-01-05' }, currency: { symbol: '$' }, warmup: 52,
    params: { homeAdv: 0.35, regress: 0.12, recruitK: 1, revenueK: 1, mediaBase: genre === 'motorsport' ? 30e6 : genre === 'sports-front-office' ? 40e6 : 22e6, boosterBase: genre === 'motorsport' ? 20e6 : 8e6 },
    world: { cycle: C.cycle({ boom: 1.03, bust: 0.9, recession: f.recessions }), vars: [{ id: 'mediaMarket', label: 'Media rights market', format: 'x', start: 1, process: { type: 'trend', drift: 0.0008, vol: 0.002 } }] },
    resources: [{ id: 'reputation', label: 'Prestige', format: 'score', start: 35, min: 0, max: 100, base: '30', speed: 0.03, describe: 'How recruits, coaches and media see your department.',
      drivers: [{ label: 'Winning', expr: "(avg(owned('program', org), it.winPctLast) - 0.5) * 60" }, { label: 'Titles', expr: 'min(25, org.titles * 5)' }, { label: 'Facilities', expr: "(avg(owned('program', org), it.facilities) - 50) * 0.2" }, { label: 'Scandals', expr: '-min(20, org.violations * 5)' }] }],
    kinds: {
      sport: { label: 'Sport', plural: 'Sports', records: sports.map(s => ({ id: s.id, name: s.name, start: s.start, len: s.len, revenue: s.revenue, rev: s.rev, cost: s.cost, pop: s.pop, glyph: s.glyph })),
        fields: { start: 'int', len: 'int', revenue: 'int', rev: 'money', cost: 'money', pop: 'number', glyph: 'text' },
        derived: { inSeason: '((time.tickOfYear - self.start + 52) % 52) < self.len', seasonEnd: '((time.tickOfYear - self.start + 52) % 52) == self.len' },
        display: { title: '{self.name}', subtitle: '{self.inSeason ? "In season" : "Off-season"}', glyph: 'self.glyph' } },
      coach: { label: Co, plural: Cos, name: { generator: 'person' },
        fields: { skill: { type: 'number', label: 'Coaching', hidden: true, noise: 12 }, recruiting: { type: 'number', label: 'Recruiting', hidden: true, noise: 14 }, age: 'int', salary: { type: 'money', label: 'Salary / yr' }, until: { type: 'int', default: 0 }, fame: { type: 'number', default: 30 }, sport: { type: 'ref', ref: 'sport' }, wins: { type: 'int', default: 0 }, titles: { type: 'int', default: 0 } },
        generate: { count: String(sports.length * (nSchools + 8)), set: { sport: `pick(${JSON.stringify(sports.map(s => s.id)).replace(/"/g, "'")})`, skill: 'clamp(randn(52, 15), 10, 97)', recruiting: 'clamp(randn(52, 15), 10, 97)', age: 'randInt(34, 66)', fame: 'clamp(randn(30, 18), 1, 95)', salary: 'get(\'sport\', self.sport).cost * 52 * 0.15 * (0.5 + self.fame / 60)' } },
        display: { title: '{self.name}', subtitle: '{self.sport.name} · fame {int(self.fame)} · {money(self.salary)}/yr', glyph: "'person'" } },
      program: { label: U, plural: Us, idPrefix: 'pg',
        fields: { sport: { type: 'ref', ref: 'sport' }, coach: { type: 'ref', ref: 'coach' }, strength: { type: 'number', label: 'Roster strength', default: 50 }, facilities: { type: 'number', label: 'Facilities', default: 50 }, budgetLevel: { type: 'number', default: 1, label: 'Budget level' }, fan: { type: 'number', label: 'Fan interest', default: 50 },
          wins: { type: 'int', default: 0 }, losses: { type: 'int', default: 0 }, winPctLast: { type: 'pct', default: 0.5, label: 'Last season' }, titles: { type: 'int', default: 0 }, allWins: { type: 'int', default: 0 }, streak: { type: 'int', default: 0 }, nil: { type: 'number', default: 0 }, building: { type: 'bool', default: false }, lastOpp: 'text', lastResult: 'text', lastRecord: { type: 'text', default: '—' }, school: 'text' },
        derived: { winPct: 'self.wins + self.losses > 0 ? self.wins / (self.wins + self.losses) : self.winPctLast', power: 'self.strength + (self.coach ? (self.coach.skill - 50) * 0.35 : -8) + (self.facilities - 50) * 0.08' },
        upkeep: [{ label: 'Program budgets', expr: 'self.sport.cost * self.budgetLevel' }, { label: `${Cos}' salaries`, expr: 'self.coach ? self.coach.salary / 52 : 0' }, { label: 'NIL & player support', expr: 'self.nil / 52' }],
        income: [{ label: 'Tickets & game-day', expr: 'self.sport.inSeason ? self.sport.rev * params.revenueK * (0.35 + self.fan / 90) * world.demand : 0' }],
        tick: [
          { op: 'if', cond: 'self.sport.inSeason', then: [
            { op: 'let', name: 'opp', value: "pick(filter(all('program'), it.sport == outer.self.sport && it != outer.self))" },
            { op: 'if', cond: 'opp', then: [
              { op: 'let', name: 'pw', value: 'sigmoid((self.power - opp.power) / 9 + (chance(0.5) ? params.homeAdv : -params.homeAdv))' },
              { op: 'set', path: 'self.lastOpp', value: 'opp.school' },
              { op: 'chance', p: 'pw', then: [{ op: 'set', path: 'self.wins', value: 'self.wins + 1' }, { op: 'set', path: 'self.streak', value: 'max(1, self.streak + 1)' }, { op: 'set', path: 'self.lastResult', value: "'W'" }, { op: 'set', path: 'self.fan', value: 'min(100, self.fan + 0.8 * self.sport.pop)' },
                { op: 'if', cond: 'self.owner && isPlayer(self.owner) && self.sport.revenue && pw < 0.3', then: [{ op: 'moment', title: 'Upset!', text: '{self.sport.name} stuns {opp.school}.', stat: '{int(self.wins)}–{int(self.losses)}' }] }],
                else: [{ op: 'set', path: 'self.losses', value: 'self.losses + 1' }, { op: 'set', path: 'self.streak', value: 'min(-1, self.streak - 1)' }, { op: 'set', path: 'self.lastResult', value: "'L'" }, { op: 'set', path: 'self.fan', value: 'max(0, self.fan - 0.6 * self.sport.pop)' }] }] }] },
          { op: 'if', cond: 'self.sport.seasonEnd', then: [
            { op: 'set', path: 'self.lastRecord', value: "int(self.wins) + '–' + int(self.losses)" },
            { op: 'set', path: 'self.winPctLast', value: 'self.winPct' },
            { op: 'set', path: 'self.allWins', value: 'self.allWins + self.wins' },
            { op: 'if', cond: 'self.coach', then: [{ op: 'set', path: 'self.coach.wins', value: 'self.coach.wins + self.wins' }, { op: 'set', path: 'self.coach.fame', value: 'clamp(self.coach.fame + (self.winPct - 0.5) * 12, 1, 99)' }] },
            // recruiting & development for next season
            { op: 'set', path: 'self.strength', value: 'clamp(self.strength + (50 - self.strength) * params.regress + (self.coach ? (self.coach.recruiting - 50) * 0.12 : -3) * params.recruitK + (self.facilities - 50) * 0.06 + (self.winPct - 0.5) * 8 + (self.budgetLevel - 1) * 6 + min(8, self.nil / max(1, self.sport.cost * 52) * 10) + (org ? (org.reputation - 40) * 0.05 : 0) + randn(0, 4), 5, 99)' },
            { op: 'set', path: 'self.facilities', value: 'max(10, self.facilities - 1.5)' },
            { op: 'set', path: 'self.wins', value: '0' }, { op: 'set', path: 'self.losses', value: '0' }, { op: 'set', path: 'self.streak', value: '0' }
          ] }
        ],
        explain: { title: 'Why {self.name} wins (or doesn\'t)', drivers: [{ label: 'Roster strength', expr: 'self.strength' }, { label: `${Co} (estimate)`, expr: "self.coach ? est(self.coach, 'skill').value : 0" }, { label: 'Facilities', expr: 'self.facilities' }, { label: 'Budget level ×100', expr: 'self.budgetLevel * 100' }, { label: 'Fan interest', expr: 'self.fan' }] },
        display: { title: '{self.school} {self.sport.name}', subtitle: '{self.sport.inSeason ? int(self.wins) + "–" + int(self.losses) + " this season" : "Last season " + self.lastRecord}', glyph: 'self.sport.glyph', stats: [{ label: 'Strength', expr: 'self.strength', format: 'score' }, { label: 'Facilities', expr: 'self.facilities', format: 'score' }] } },
      network: { label: 'Media partner', plural: 'Media partners', records: [{ id: 'n1', name: 'National Sports Network', appetite: 1.2 }, { id: 'n2', name: 'StreamMax Sports', appetite: 1.0 }, { id: 'n3', name: 'Regional Broadcasting Group', appetite: 0.7 }], fields: { appetite: 'number' }, display: { title: '{self.name}' } }
    },
    orgs: {
      label: L.org, plural: L.orgs,
      fields: { media: { type: 'money', label: 'Media deal / yr', default: 0 }, mediaUntil: { type: 'int', default: 0 }, donations: { type: 'money', label: 'Booster giving / yr', default: 0 }, titles: { type: 'int', default: 0 }, violations: { type: 'int', default: 0 }, ticketMult: { type: 'number', default: 1 }, school: 'text', compliance: { type: 'number', default: 1 } },
      metrics: [
        { id: 'programs', label: Us, expr: "count(owned('program', org))", format: 'int' },
        { id: 'flagship', label: 'Flagship record', expr: "maxOf(filter(owned('program', org), it.sport.revenue), it.winPct)", format: 'pct' },
        { id: 'winning', label: 'Overall win rate', expr: "avg(owned('program', org), it.winPct)", format: 'pct' },
        { id: 'margin', label: 'Operating margin', expr: 'org.profitYear / max(1, org.revenueYear)', format: 'pct1' },
        { id: 'facilitiesAvg', label: 'Facilities', expr: "avg(owned('program', org), it.facilities)", format: 'score' }
      ],
      valuation: "max(0, org.cash - org.debt + org.media * 3 + org.donations * 3 + org.reputation * 1000000 + org.titles * 5000000 + sum(owned('program', org), it.facilities * it.sport.cost * 2 + it.strength * it.sport.cost * 3))",
      income: [{ label: 'Media rights', expr: 'org.media / 52' }, { label: L.fans + ' donations', expr: `org.donations / 52` }, { label: 'Institutional support', expr: genre === 'university' ? '120000' : '0' }],
      costs: [{ label: 'Administration & compliance', expr: '60000 + 25000 * org.compliance' }],
      player: { name: schools[0], cash: '12000000', set: { media: 'params.mediaBase * 0.6', mediaUntil: '156', donations: 'params.boosterBase * 0.6', school: `'${schools[0]}'` }, start: [] },
      rivals: { count: { full: nSchools - 1, light: 0, background: 0 }, aiEvery: 4, entryChance: '0', maxActive: nSchools, failGrace: 999,
        fixed: schools.slice(1).map((n, i) => ({ name: n, archetype: ['powerhouse', 'builder', 'scrappy'][i % 3] })),
        archetypes: [
          { id: 'powerhouse', label: 'Powerhouse', risk: 0.5, tempo: 1, color: '#b5651d', cash: '30000000', set: { media: 'params.mediaBase * 1.2', donations: 'params.boosterBase * 1.4' }, weights: { hireCoach: 1.4 } },
          { id: 'builder', label: 'Builder', risk: 0.4, tempo: 1, color: '#2c5e8f', cash: '18000000', set: { media: 'params.mediaBase * 0.8', donations: 'params.boosterBase * 0.9' }, weights: { facilityProject: 1.5 } },
          { id: 'scrappy', label: 'Scrappy', risk: 0.6, tempo: 1, color: '#5b8f2c', cash: '10000000', set: { media: 'params.mediaBase * 0.5', donations: 'params.boosterBase * 0.5' }, weights: {} }
        ] },
      onFail: []
    }
  };
  // every school gets the full set of programs, a coach each, and strengths by archetype
  const programStart = (strengthExpr) => [{ op: 'set', path: 'org.school', value: 'org.name' }, { op: 'each', list: "all('sport')", as: 'sp', do: [
    { op: 'create', kind: 'program', as: 'pg', set: { sport: 'sp', school: 'org.name', strength: strengthExpr, facilities: 'clamp(randn(50, 12), 20, 90)', fan: 'clamp(randn(50, 15), 10, 95)' } },
    { op: 'let', name: 'ch', value: "bestOf(filter(all('coach'), it.sport == sp && count(all('program'), it.coach == outer.it) == 0), rand())" },
    { op: 'if', cond: 'ch', then: [{ op: 'set', path: 'pg.coach', value: 'ch' }, { op: 'set', path: 'ch.until', value: 'randInt(20, 200)' }] }] }];
  gdl.orgs.player.start = programStart('clamp(randn(46, 8), 20, 75)');
  gdl.orgs.rivals.archetypes[0].start = programStart('clamp(randn(62, 9), 25, 92)');
  gdl.orgs.rivals.archetypes[1].start = programStart('clamp(randn(52, 9), 25, 85)');
  gdl.orgs.rivals.archetypes[2].start = programStart('clamp(randn(45, 9), 20, 80)');
  // championships: at each sport's season end, the best record wins (sport-level tick)
  gdl.kinds.sport.tick = [{ op: 'if', cond: 'self.seasonEnd', then: [
    { op: 'let', name: 'champ', value: "bestOf(filter(all('program'), it.sport == outer.self), it.wins - it.losses + it.power / 1000)" },
    { op: 'if', cond: 'champ', then: [{ op: 'set', path: 'champ.titles', value: 'champ.titles + 1' }, { op: 'if', cond: 'champ.owner', then: [{ op: 'set', path: 'champ.owner.titles', value: 'champ.owner.titles + 1' }] },
      { op: 'if', cond: 'champ.coach', then: [{ op: 'set', path: 'champ.coach.titles', value: 'champ.coach.titles + 1' }, { op: 'set', path: 'champ.coach.fame', value: 'min(99, champ.coach.fame + 12)' }] },
      { op: 'if', cond: 'champ.owner && isPlayer(champ.owner)', then: [{ op: 'moment', title: 'Champions!', text: `{champ.school} wins the {self.name} ${L.champ}.`, stat: '{int(champ.wins)}–{int(champ.losses)}', always: true }, { op: 'resource', id: 'reputation', add: '6', org: 'champ.owner' }],
        else: [{ op: 'news', text: '{champ.school} wins the {self.name} title', always: true, tag: 'rival' }] }] }] }];

  /* ---------------- actions ---------------- */
  gdl.actions = [
    { id: 'hireCoach', label: `Hire a ${L.coach}`, verb: 'Hire', kind: 'program', category: 'people', icon: 'user', primary: true,
      describe: `Replace the ${L.coach} of a ${L.unit}. Coaching skill wins games; recruiting skill builds the roster.`, tradeoff: 'Big salaries and the buyout of the current contract.', risk: 'Skill is an estimate — a famous name is not always a good coach.',
      params: [{ id: 'c', label: Co, type: 'entity', kind: 'coach', filter: "it.sport == self.sport && count(all('program'), it.coach == outer.it) == 0", sort: "est(it, 'skill').value + it.fame * 0.4" }, { id: 'yrs', label: 'Contract', type: 'choice', default: '4', options: [{ value: 2, label: '2 years' }, { value: 4, label: '4 years' }, { value: 6, label: '6 years' }] }],
      vars: { buyout: 'self.coach ? max(0, self.coach.until - time.tick) / 52 * self.coach.salary * 0.5 : 0', sal: 'param.c.salary * (1 + param.c.fame / 200) * (org.reputation > 60 ? 0.9 : 1.1)' },
      cost: { cash: 'buyout + sal * 0.25' }, costCategory: 'Coaching changes',
      preview: [{ label: 'Coaching (estimate)', expr: "est(param.c, 'skill').value", format: 'score' }, { label: 'Recruiting (estimate)', expr: "est(param.c, 'recruiting').value", format: 'score' }, { label: 'Salary / yr', expr: 'sal', format: 'money' }, { label: 'Buyout of current coach', expr: 'buyout', format: 'money' }, { label: 'Current coach (estimate)', expr: "self.coach ? est(self.coach, 'skill').value : 0", format: 'score' }],
      effects: [{ op: 'set', target: 'param.c', field: 'salary', value: 'sal' }, { op: 'set', target: 'param.c', field: 'until', value: 'time.tick + param.yrs * 52' }, { op: 'set', path: 'self.coach', value: 'param.c' }, { op: 'news', text: '{self.school} hires {param.c.name} to lead {self.sport.name}' }],
      result: 'Hired {param.c.name}', ai: { score: '(self.winPctLast < 0.4 || !self.coach) && org.cash > sal * 2 ? (param.c.skill + param.c.recruiting * 0.5 + randn(0, 10) - (self.coach ? self.coach.skill + self.coach.recruiting * 0.5 : 0) - 10) * 10000 : 0', selfSample: 6, candidates: 3, news: '{org.name} hires {param.c.name}' } },
    { id: 'setBudget', label: 'Set program budget', verb: 'Budget', kind: 'program', category: 'money', icon: 'bank',
      describe: 'Scholarships, staff, travel, recruiting. More money builds stronger rosters next season.',
      params: [{ id: 'lvl', label: 'Budget level', type: 'choice', default: 'self.budgetLevel', options: [{ value: 0.6, label: 'Cut (−40%)', describe: 'Saves money; the roster weakens' }, { value: 1, label: 'Standard' }, { value: 1.4, label: 'Invest (+40%)' }, { value: 2, label: 'All in (×2)', describe: 'Expensive — and the compliance office watches' }] }],
      preview: [{ label: 'Weekly cost at this level', expr: 'self.sport.cost * param.lvl', format: 'money' }, { label: 'Current level', expr: 'self.budgetLevel', format: 'x' }],
      effects: [{ op: 'set', path: 'self.budgetLevel', value: '+param.lvl' }].concat(genre === 'university' ? [{ op: 'if', cond: 'param.lvl < 0.7 && !self.sport.revenue', then: [{ op: 'stake', id: 'students', add: '-6' }] }] : []), result: '{self.sport.name} budget set',
      ai: { score: 'self.sport.revenue && self.budgetLevel < 1.4 && org.cash > 20000000 ? 3000 : 0', selfSample: 3 } },
    { id: 'nilFund', label: 'Fund player support (NIL)', verb: 'Fund', kind: 'program', category: 'money', icon: 'up', cooldown: 52,
      describe: 'Name-image-likeness and player support money. Directly lifts recruiting; compliance is watching.', tradeoff: 'Pure cost; rules keep shifting.',
      requires: [{ expr: 'self.sport.revenue', msg: 'Only for revenue sports' }],
      params: [{ id: 'amt', label: 'Per year', type: 'choice', default: '1', options: [{ value: 0.5, label: 'Modest' }, { value: 1, label: 'Competitive' }, { value: 2, label: 'Market-leading' }] }],
      effects: [{ op: 'set', path: 'self.nil', value: 'self.sport.cost * 52 * 0.25 * param.amt' }, { op: 'if', cond: 'param.amt >= 2', then: [{ op: 'stake', id: 'scrutiny', add: '6' }] }], result: 'Player support set for {self.sport.name}',
      ai: { score: "archetype(org) == 'powerhouse' && self.nil == 0 ? 2000 : 0", selfSample: 3 } },
    { id: 'facilityProject', label: 'Build or renovate facilities', verb: 'Build', kind: 'program', category: 'build', icon: 'building',
      describe: 'Stadiums, arenas, training centers. Recruits and fans notice — for decades.', tradeoff: 'Huge upfront cost and a year or more of construction.', risk: 'Overruns happen.',
      params: [{ id: 'size', label: 'Project', type: 'choice', default: '1', options: [{ value: 0.5, label: 'Renovation' }, { value: 1, label: 'New training center' }, { value: 2, label: 'New stadium / arena' }] }],
      vars: { costX: 'self.sport.cost * 52 * 1.2 * param.size' },
      requires: [{ expr: 'org.cash >= costX * 0.3', msg: 'Need about a third of the cost up front' }, { expr: '!self.building', msg: 'Already building here' }],
      preview: [{ label: 'Total cost', expr: 'costX', format: 'money' }, { label: 'Facilities now', expr: 'self.facilities', format: 'score' }, { label: 'Facilities after', expr: 'min(99, self.facilities + 18 * param.size)', format: 'score' }],
      effects: [{ op: 'set', path: 'self.building', value: 'true' }, { op: 'project', id: 'facility', target: 'self', set: { size: '+param.size', cost: 'costX' }, name: '{self.school} {self.sport.name} facility' }, { op: 'stake', id: 'boosters', add: '4' }],
      result: 'Construction approved', ai: { score: "!self.building && self.facilities < 45 && org.cash > costX * 0.8 ? (60 - self.facilities) * 10000 : 0", selfSample: 3, news: '{org.name} breaks ground on a new facility' } },
    { id: 'negotiateMedia', label: 'Negotiate media rights', verb: 'Negotiate', category: 'money', icon: 'handshake',
      describe: 'Sell your games to a broadcaster. Winning and fan interest drive the price.', requires: [{ expr: 'time.tick >= player.mediaUntil - 26', msg: 'Your current deal runs until {date(org.mediaUntil)}' }],
      params: [{ id: 'n', label: 'Partner', type: 'entity', kind: 'network', sort: 'it.appetite' }],
      effects: [{ op: 'negotiate', id: 'mediaDeal', with: 'param.n' }], playerOnly: true },
    { id: 'campaign', label: `Launch a ${L.fans.toLowerCase()} campaign`, verb: 'Fundraise', category: 'money', icon: 'megaphone', cooldown: 52,
      describe: 'Dinners, naming rights, a capital campaign. Giving rises with winning and new facilities.', cost: { cash: '400000' }, costCategory: 'Fundraising',
      effects: [{ op: 'set', path: 'org.donations', value: "org.donations * (1.02 + max(0, avg(filter(owned('program', org), it.sport.revenue), it.winPctLast) - 0.5) * 0.5 + (stake('boosters') - 50) / 500)" }, { op: 'stake', id: 'boosters', add: '3' }], result: 'Campaign launched',
      ai: { score: 'org.cash > 5000000 ? 2000 : 0' } }
  ];
  gdl.actions.push(...C.financeActions());
  gdl.projects = [{ id: 'facility', label: 'Facility', name: '{p.name}', capex: true, costCategory: 'Facilities',
    stages: [{ id: 'design', label: 'Design & permits', duration: '13', cost: 'p.cost * 0.1 / 13' }, { id: 'build', label: 'Construction', duration: '39 * p.size', cost: 'p.cost * 0.9 / (39 * p.size)', risk: { chance: '0.01', effects: [{ op: 'cash', amount: '-p.cost * 0.1', category: 'Facilities' }], news: 'Construction overrun at {p.name}' } }],
    onCancel: [{ op: 'set', path: 'self.building', value: 'false' }],
    onComplete: [{ op: 'set', path: 'self.building', value: 'false' }, { op: 'set', path: 'self.facilities', value: 'min(99, self.facilities + 18 * p.size)' }, { op: 'set', path: 'self.fan', value: 'min(100, self.fan + 6 * p.size)' }, { op: 'moment', title: 'Ribbon cutting', text: '{p.name} opens.', stat: '{money(p.cost)}' }] }];
  gdl.negotiations = [{ id: 'mediaDeal', label: 'Media rights', with: 'network', patience: 3, counter: { term: 'fee' },
    terms: [{ id: 'fee', label: 'Rights fee / yr', type: 'money', default: 'org.media * 1.3 + params.mediaBase * 0.2', min: 'params.mediaBase * 0.2', max: 'params.mediaBase * 4', step: 250000 }, { id: 'years', label: 'Years', type: 'choice', default: '5', options: [{ value: 3, label: '3 years' }, { value: 5, label: '5 years' }, { value: 8, label: '8 years' }] }],
    value: "(params.mediaBase * world.mediaMarket * them.appetite * (0.5 + avg(filter(owned('program', org), it.sport.revenue), it.fan) / 80) * (0.7 + org.reputation / 100) * (terms.years >= 8 ? 1.08 : 1)) / max(1, terms.fee)", reservation: '1',
    reasons: [{ when: "avg(filter(owned('program', org), it.sport.revenue), it.fan) < 45", text: 'Your audience numbers are soft' }, { when: 'org.reputation < 40', text: 'You are not a national brand yet' }],
    onAccept: [{ op: 'set', path: 'org.media', value: 'terms.fee' }, { op: 'set', path: 'org.mediaUntil', value: 'time.tick + terms.years * 52' }, { op: 'moment', title: 'A new media deal', text: '{them.name}: {money(terms.fee)} a year for {terms.years} years.', stat: '{money(terms.fee * terms.years)}' }],
    acceptNews: 'New media deal: {money(terms.fee)} a year' }];

  /* ---------------- policies, stakeholders ---------------- */
  gdl.policies = [
    { id: 'tickets', label: 'Ticket pricing', scope: 'org', default: 'standard', describe: 'Prices for every home game.',
      options: [{ value: 'cheap', label: 'Fill the seats', effects: [{ op: 'set', path: 'org.ticketMult', value: '0.85' }, { op: 'each', list: "owned('program', org)", do: [{ op: 'add', path: 'it.fan', value: '0.05' }] }] }, { value: 'standard', label: 'Standard', effects: [{ op: 'set', path: 'org.ticketMult', value: '1' }] }, { value: 'premium', label: 'Premium', effects: [{ op: 'set', path: 'org.ticketMult', value: '1.2' }, { op: 'each', list: "owned('program', org)", do: [{ op: 'add', path: 'it.fan', value: '-0.05' }] }] }] },
    { id: 'compliance', label: 'Compliance culture', scope: 'org', default: 'standard', describe: 'How hard you police your own programs.',
      options: [{ value: 'loose', label: 'Look the other way', describe: 'Cheaper; violations become likely.', effects: [{ op: 'set', path: 'org.compliance', value: '0.4' }] }, { value: 'standard', label: 'Standard', effects: [{ op: 'set', path: 'org.compliance', value: '1' }] }, { value: 'strict', label: 'Strict', describe: 'Costs more; far fewer scandals.', effects: [{ op: 'set', path: 'org.compliance', value: '1.8' }] }] },
    { id: 'coachingSearch', label: 'Coaching carousel', scope: 'org', default: 'manual', aiDefault: 'manual', every: 4, describe: `Let your staff replace ${L.coaches} of programs that keep losing.`,
      options: [{ value: 'manual', label: 'I decide' }, { value: 'auto', label: 'Replace chronic losers', effects: [{ op: 'autoAct', action: 'hireCoach', max: '1' }] }] }
  ];
  const b = C.board();
  b.stakeholder.label = L.boss; b.stakeholder.describe = 'Your boss. Wants a balanced budget, no scandals, and pride.';
  b.stakeholder.drivers = [{ label: 'Budget', expr: 'time.tick < 26 ? 0 : clamp((org.profitYear / max(1, org.revenueYear)) * 120, -25, 15)' }, { label: 'Winning', expr: '(org.winning - 0.5) * 40' }, { label: 'Scandals', expr: '-min(25, org.violations * 8)' }, { label: 'Titles', expr: 'min(15, org.titles * 3)' }];
  gdl.stakeholders = [b.stakeholder,
    { id: 'boosters', label: L.fans, start: 55, base: '50', speed: 0.06, describe: 'They pay for facilities and expect to win the big games.', drivers: [{ label: 'Flagship winning', expr: '(org.flagship - 0.5) * 70' }, { label: 'Facilities', expr: '(org.facilitiesAvg - 50) * 0.3' }], thresholds: [{ below: 25, event: 'boosterRevolt', cooldown: 52 }] },
    { id: 'scrutiny', label: 'Compliance scrutiny', start: 20, base: '15', speed: 0.05, higherIsWorse: true, describe: 'How closely regulators watch you. Higher is worse.', drivers: [{ label: 'Spending', expr: "avg(owned('program', org), it.budgetLevel) > 1.4 ? 12 : 0" }, { label: 'Player support money', expr: "min(15, sum(owned('program', org), it.nil) / 1000000)" }, { label: 'Compliance culture', expr: '-(org.compliance - 1) * 15' }], thresholds: [{ above: 60, event: 'investigation', cooldown: 52 }] }
  ].concat(genre === 'university' ? [{ id: 'students', label: 'Students & faculty', start: 55, base: '55', speed: 0.04, describe: 'They care about Olympic sports, academics and equity.', drivers: [{ label: 'Non-revenue sports funding', expr: "(avg(filter(owned('program', org), !it.sport.revenue), it.budgetLevel) - 1) * 40" }] }] : []);

  /* ---------------- events ---------------- */
  gdl.events = [b.event,
    { id: 'recessionBoard', trigger: 'scheduled', priority: 'critical', title: 'Budget crunch', text: `The economy is shrinking ticket sales and donations. ${L.boss} wants a plan.`,
      choices: [{ label: 'Cut non-revenue budgets', describe: 'Saves money; the people who love those programs will not forget.', effects: [{ op: 'each', list: "filter(owned('program', player), !it.sport.revenue)", do: [{ op: 'set', path: 'it.budgetLevel', value: 'max(0.6, it.budgetLevel * 0.8)' }] }, { op: 'stake', id: 'board', add: '8' }].concat(genre === 'university' ? [{ op: 'stake', id: 'students', add: '-10' }] : []), result: 'Budgets cut' },
        { label: `Ask the ${L.fans.toLowerCase()} for help`, effects: [{ op: 'set', path: 'player.donations', value: 'player.donations * 1.08' }, { op: 'stake', id: 'boosters', add: '-6' }], result: 'You pass the hat' },
        { label: 'Borrow and hold course', effects: [{ op: 'loan', amount: '5000000', years: '5' }, { op: 'stake', id: 'board', add: '-6' }], result: 'You borrow to hold course' }] },
    { id: 'coachPoached', priority: 'important', chance: '0.03', cooldown: 20, title: '{rv.name} wants your {pg.sport.name} {pg.coach.name}', text: '{pg.coach.name} went {pg.lastRecord} last season. A bigger program is offering a raise.',
      bind: { pg: { kind: 'program', owner: 'player', filter: 'it.coach && it.winPctLast > 0.62', pick: 'max', by: 'it.winPctLast' }, rv: { kind: 'org', filter: '!it.isPlayer' } },
      choices: [{ label: 'Match it with an extension', cost: 'pg.coach.salary * 0.5', effects: [{ op: 'set', path: 'pg.coach.salary', value: 'pg.coach.salary * 1.35' }, { op: 'set', path: 'pg.coach.until', value: 'time.tick + 260' }], result: '{pg.coach.name} stays' },
        { label: 'Wish them well', describe: 'Collect the buyout; find a new coach.', effects: [{ op: 'cash', amount: 'pg.coach.salary', category: 'Buyouts received' }, { op: 'set', path: 'pg.coach', value: 'null' }, { op: 'stake', id: 'boosters', add: '-6' }], result: 'Your coach leaves', track: { text: 'Let {pg.coach.name} go to {rv.name}' } }] },
    { id: 'violation', priority: 'critical', chance: '0.006 / max(0.3, player.compliance)', cooldown: 52, title: 'Compliance violation in {pg.sport.name}', text: 'Improper benefits to recruits. The investigators want documents.',
      bind: { pg: { kind: 'program', owner: 'player', pick: 'max', by: 'it.budgetLevel + it.nil / 1000000' } },
      choices: [{ label: 'Self-report and sanction yourselves', describe: 'Painful now, lighter penalties.', effects: [{ op: 'set', path: 'pg.strength', value: 'pg.strength - 6' }, { op: 'set', path: 'player.violations', value: 'player.violations + 1' }, { op: 'stake', id: 'scrutiny', add: '-10' }], result: 'You self-report' },
        { label: 'Fight it', describe: 'Lawyers, delay — and risk.', cost: '1500000', effects: [{ op: 'chance', p: '0.5', then: [{ op: 'stake', id: 'scrutiny', add: '5' }], else: [{ op: 'set', path: 'pg.strength', value: 'pg.strength - 14' }, { op: 'set', path: 'player.violations', value: 'player.violations + 2' }, { op: 'resource', id: 'reputation', add: '-8' }, { op: 'news', text: 'Investigators hit {pg.school} with heavy sanctions' }] }], result: 'You fight the allegations' }] },
    { id: 'investigation', trigger: 'scheduled', priority: 'critical', title: 'A formal investigation opens', text: 'Scrutiny is at {int(stake("scrutiny"))}. Every program\'s books are under review.',
      choices: [{ label: 'Clean house', describe: 'Strict compliance and spending cuts.', effects: [{ op: 'policy', id: 'compliance', value: "'strict'" }, { op: 'each', list: "owned('program', player)", do: [{ op: 'set', path: 'it.nil', value: 'it.nil * 0.5' }] }, { op: 'stake', id: 'scrutiny', add: '-25' }], result: 'You clean house' },
        { label: 'Cooperate quietly', effects: [{ op: 'stake', id: 'scrutiny', add: '-8' }, { op: 'set', path: 'player.violations', value: 'player.violations + 1' }], result: 'You cooperate' }] },
    { id: 'boosterRevolt', trigger: 'scheduled', priority: 'critical', title: `${L.fans} want blood`, text: 'The flagship program is losing and the big donors are threatening to stop giving.',
      choices: [{ label: `Fire the flagship ${L.coach}`, effects: [{ op: 'each', list: "top(filter(owned('program', player), it.sport.revenue), it.sport.pop, 1)", do: [{ op: 'set', path: 'it.coach', value: 'null' }] }, { op: 'stake', id: 'boosters', add: '20' }], result: 'You make a change' },
        { label: 'Promise a new facility', effects: [{ op: 'stake', id: 'boosters', add: '10' }, { op: 'set', path: 'player.donations', value: 'player.donations * 1.05' }], result: 'You promise new facilities' },
        { label: 'Stand firm', effects: [{ op: 'set', path: 'player.donations', value: 'player.donations * 0.8' }, { op: 'stake', id: 'boosters', add: '-5' }], result: 'You stand firm' }] },
    { id: 'realignment', priority: 'important', chance: '0.004', once: true, title: `A bigger ${L.conf} calls`, text: `A power ${L.conf} invites {player.name} to join: much more media money — and much tougher opponents.`,
      choices: [{ label: 'Join', describe: 'Media money ×1.6; opponents stronger.', effects: [{ op: 'set', path: 'player.media', value: 'player.media * 1.6' }, { op: 'each', list: "filter(all('program'), !isPlayer(it.owner))", do: [{ op: 'add', path: 'it.strength', value: '3' }] }, { op: 'resource', id: 'reputation', add: '5' }], result: `You join the bigger ${L.conf}` },
        { label: 'Stay', effects: [{ op: 'stake', id: 'board', add: '3' }], result: 'You stay put', track: { text: `Turned down a power ${L.conf}` } }] },
    { id: 'rivalryWeek', priority: 'routine', chance: '0.03', cooldown: 30, title: 'Rivalry week', bind: { pg: { kind: 'program', owner: 'player', filter: 'it.sport.revenue && it.sport.inSeason' } }, effects: [{ op: 'add', path: 'pg.fan', value: '2' }], news: 'Rivalry week: {pg.school} {pg.sport.name} sells out' }
  ];

  /* ---------------- progression, history, needs ---------------- */
  gdl.progression = {
    tiers: [{ id: 'midmajor', label: genre === 'university' || genre === 'college-football' ? 'Mid-major' : 'Also-ran' }, { id: 'contender', label: 'Contender', when: 'player.flagship >= 0.62 && player.reputation >= 45', text: 'Recruits and coaches start to listen.' }, { id: 'power', label: 'National power', when: 'player.titles >= 1 && player.reputation >= 60' }, { id: 'dynasty', label: 'Dynasty', when: 'player.titles >= 5' }],
    objectives: C.objectives([{ id: 'flag', text: 'Win {pct(target)} of flagship games', metric: 'player.flagship', target: 'max(0.45, min(0.8, base + 0.08))', weight: 2, reward: [{ op: 'stake', id: 'board', add: '10' }, { op: 'stake', id: 'boosters', add: '8' }], penalty: [{ op: 'stake', id: 'board', add: '-8' }] }]),
    failure: C.failure({ unit: 'naming rights and land' }),
    victory: [{ id: 'dynasty', label: 'A dynasty', when: 'player.titles >= 8', text: 'Eight titles. They will name a building after you.' }]
  };
  gdl.history = { records: [{ id: 'titles', label: 'Most titles', expr: 'org.titles', format: 'int' }, { id: 'winning', label: 'Best overall win rate', expr: 'org.winning', format: 'pct', period: 'year' }, { id: 'value', label: 'Most valuable department', expr: 'org.value', format: 'money' }],
    awards: [{ id: 'ad', label: L.award, score: 'org.winning * 100 + org.titles * 8 + org.margin * 40', noise: 3, prize: [{ op: 'resource', id: 'reputation', add: '4' }] }],
    milestones: [{ id: 'title', label: 'First title', when: 'player.titles >= 1', text: 'Banners go up.' }, { id: 'winning', label: 'Winning department', when: 'time.tick > 52 && player.winning > 0.6', text: 'Your programs win six games in ten.' }] };
  gdl.needs = [
    { id: 'noCoach', forEach: 'program', when: 'self.owner && isPlayer(self.owner) && !self.coach', text: `{self.sport.name} has no ${L.coach}`, sub: 'Hire one before recruiting season', action: 'hireCoach', priority: 1, tone: 'bad' },
    { id: 'losing', forEach: 'program', when: 'self.owner && isPlayer(self.owner) && self.sport.revenue && self.winPctLast < 0.35 && time.tick > 40', text: '{self.sport.name} went {self.lastRecord}', sub: `${L.fans} are restless — coach, budget or facilities?`, action: 'hireCoach', priority: 1, tone: 'warn' },
    { id: 'media', when: 'time.tick >= player.mediaUntil - 26', text: 'Your media deal is expiring', sub: 'Negotiate a new one', action: 'negotiateMedia', priority: 1, tone: 'warn' }
  ];

  /* ---------------- interface ---------------- */
  const scr = C.standardScreens({
    goal: gdl.meta.goal, primary: ['negotiateMedia', 'campaign'],
    homeSubtitle: '{player.programs} ' + L.units + ' · {int(player.titles)} titles · overall {pct(player.winning)}',
    metrics: [{ label: 'Flagship win rate', expr: 'player.flagship', format: 'pct' }, { label: 'Cash', expr: 'player.cash', format: 'money' }, { label: L.boss, expr: "stake('board')", format: 'score', explain: 'stake:board' }, { label: 'Prestige', expr: 'player.reputation', format: 'score', explain: 'resource:reputation' }],
    signature: [{ type: 'board', title: 'Scoreboard', width: 'full', kind: 'program', owner: 'player', sort: 'it.sport.pop', limit: 10, tour: 'board',
      columns: [{ label: U, expr: 'it.sport.name' }, { label: 'This season', expr: "it.sport.inSeason ? int(it.wins) + '–' + int(it.losses) : '—'", format: 'text' }, { label: 'Last', expr: 'it.lastResult', format: 'text' }, { label: 'Last season', expr: 'it.lastRecord', format: 'text' }, { label: 'Strength', expr: 'it.strength', format: 'score' }, { label: Co, expr: "it.coach ? it.coach.name : 'VACANT'", format: 'text' }],
      status: "it.sport.inSeason ? (it.streak >= 3 ? 'Hot' : it.streak <= -3 ? 'Cold' : 'In season') : 'Off-season'" }]
  });
  scr.programs = { title: Us, subtitle: 'Coaches, budgets, facilities',
    tabs: [{ id: 'mine', label: 'Your ' + L.units, sections: [{ type: 'cards', title: Us, width: 'full', kind: 'program', owner: 'player', sort: 'it.sport.pop', size: 'm', glyph: 'it.sport.glyph', glyphScale: '0.4', glyphColor: "it.winPct >= 0.6 ? 'var(--good)' : it.winPct < 0.4 ? 'var(--bad)' : 'var(--accent)'", badge: "{it.sport.inSeason ? int(it.wins) + '–' + int(it.losses) : 'Last ' + it.lastRecord}",
      stats: [{ label: 'Strength', expr: 'it.strength', format: 'score' }, { label: 'Facilities', expr: 'it.facilities', format: 'score' }, { label: 'Fans', expr: 'it.fan', format: 'score' }, { label: 'Budget', expr: 'it.budgetLevel', format: 'x' }], actions: ['hireCoach', 'setBudget', 'facilityProject', 'nilFund'] }, { type: 'pipeline', title: 'Construction', width: 'full', empty: 'Nothing under construction.' }] },
      { id: 'coaches', label: Cos, sections: [{ type: 'table', title: `Available ${L.coaches}`, width: 'full', kind: 'coach', filter: "count(all('program'), it.coach == outer.it) == 0", sort: 'it.fame', search: true, limit: 25, columns: [{ label: 'Name', expr: 'it.name' }, { label: 'Sport', expr: 'it.sport.name', format: 'text' }, { label: 'Coaching (est.)', expr: "est(it, 'skill').value", format: 'score' }, { label: 'Recruiting (est.)', expr: "est(it, 'recruiting').value", format: 'score' }, { label: 'Fame', expr: 'it.fame', format: 'score' }, { label: 'Titles', expr: 'it.titles', format: 'int' }, { label: 'Salary', expr: 'it.salary', format: 'money' }] }] }] };
  scr.standings = { title: 'Standings', subtitle: `The ${L.conf} this season`,
    tabs: sports.map(sp => ({ id: sp.id, label: sp.name, sections: [{ type: 'table', title: sp.name, width: 'full', kind: 'program', filter: `it.sport.id == '${sp.id}'`, sort: 'it.wins - it.losses + it.winPctLast / 10', key: 'st_' + sp.id, limit: 20,
      columns: [{ label: 'School', expr: 'it.school' }, { label: 'W', expr: 'it.wins', format: 'int' }, { label: 'L', expr: 'it.losses', format: 'int' }, { label: 'Last season', expr: 'it.lastRecord', format: 'text' }, { label: 'Strength', expr: 'it.strength', format: 'score' }, { label: 'Titles', expr: 'it.titles', format: 'int' }] }] })) };
  scr.company.title = 'Department'; scr.company.actions = ['negotiateMedia', 'campaign', 'borrow', 'repay'];
  gdl.ui = { topbar: [{ label: 'Cash', expr: 'player.cash', format: 'money' }, { label: 'Flagship', expr: 'player.flagship', format: 'pct' }, { label: L.boss, expr: "stake('board')", format: 'score', explain: 'stake:board' }],
    nav: [{ id: 'home', label: 'Overview', icon: 'home' }, { id: 'programs', label: Us, icon: 'users' }, { id: 'standings', label: 'Standings', icon: 'chart' }, { id: 'company', label: 'Department', icon: 'bank' }, { id: 'industry', label: 'Rivals', icon: 'globe' }],
    screens: scr };
  gdl.theme = C.theme(L.motif, { logo: { text: title.split(/\s+/).map(w => w[0]).join('').slice(0, 2) } });
  gdl.onboarding = C.onboarding({ title: 'Welcome, ' + gdl.meta.role.toLowerCase(), text: `{player.name} is a middle-of-the-pack ${L.org.toLowerCase()} with ambitions. ${L.boss}, ${L.fans.toLowerCase()} and the compliance office are all watching.`,
    bullets: [{ icon: 'user', title: `${Cos} matter most`, text: 'Coaching wins games now; recruiting builds next season\'s roster.' }, { icon: 'building', title: 'Invest wisely', text: 'Budgets, player support and facilities raise strength — and costs.' }, { icon: 'bank', title: 'Money follows winning', text: 'Tickets, media rights and boosters all grow with success.' }],
    primaryAction: { id: 'hireCoach', label: `Hire a ${L.coach}` }, primaryNav: 'programs', unitNoun: L.units });
  gdl.onboarding.steps[0] = { text: `Open ${Us} and look at your ${L.coaches}: one bad hire can sink a program for years.`, nav: 'programs', event: 'nav:programs' };
  gdl.newGame = { options: [{ id: 'name', label: 'Name', type: 'text', default: gdl.orgs.player.name }] };
  gdl.glossary = [{ term: 'Strength', text: 'Roster quality. Changes between seasons with recruiting, budgets, facilities, winning and player support.' }, { term: 'Power', text: 'Game-day strength: roster + coaching + facilities.' }, { term: 'Compliance scrutiny', text: 'How closely investigators watch you. Higher is worse.' }];
  gdl.balance = { knobs: [{ path: 'params.revenueK', label: 'Game-day revenue', effect: 'easier', min: 0.5, max: 2 }, { path: 'params.recruitK', label: 'Recruiting impact', effect: 'easier', min: 0.5, max: 2 }, { path: 'params.regress', label: 'Regression to the mean', effect: 'harder', min: 0.05, max: 0.3, phase: 'late' }], targets: { smartMargin: [-0.1, 0.25], maxGrowth: 6 } };
  gdl.meta.howToPlay = `Each turn is a week. Every ${L.unit} plays one game a week in its season against another ${L.conf} team; strength, coaching and facilities decide the odds. At season's end, rosters change: good ${L.coaches} recruit well, budgets and facilities help, and everyone regresses toward the middle. Hire and fire ${L.coaches}, set budgets, build facilities and negotiate media rights. Keep ${L.boss.toLowerCase()}, ${L.fans.toLowerCase()} and the compliance office on side.`;
  return gdl;
}

const FEATURES = [
  { id: 'programs', label: 'Programs that play real seasons', keywords: ['sports', 'programs', 'teams', 'seasons', 'games', 'win', 'winning', 'football', 'basketball', 'league', 'conference', 'standings'], paths: ['kinds.program', 'kinds.sport'] },
  { id: 'coaches', label: 'Hiring and firing coaches', keywords: ['coach', 'coaches', 'hire', 'fire', 'staff'], paths: ['kinds.coach', 'actions.hireCoach'] },
  { id: 'budgets', label: 'Program budgets and player support', keywords: ['budget', 'budgets', 'money', 'nil', 'scholarships'], paths: ['actions.setBudget', 'actions.nilFund'] },
  { id: 'facilities', label: 'Facilities projects', keywords: ['facilities', 'facility', 'stadium', 'arena'], paths: ['projects.facility'], flag: 'facilities' },
  { id: 'media', label: 'Media rights negotiations', keywords: ['media', 'tv', 'broadcast', 'conference deals', 'media deals', 'rights'], paths: ['negotiations.mediaDeal'], flag: 'media' },
  { id: 'boosters', label: 'Boosters and donors', keywords: ['boosters', 'donors', 'fundraising', 'donations'], paths: ['stakeholders.boosters'], flag: 'boosters' },
  { id: 'compliance', label: 'Compliance and investigations', keywords: ['compliance', 'ncaa', 'rules', 'violations', 'investigation'], paths: ['stakeholders.scrutiny', 'events.violation'], flag: 'compliance' },
  { id: 'president', label: 'The president / owner', keywords: ['president', 'owner', 'board', 'university'], paths: ['stakeholders.board'] },
  { id: 'history', label: 'Titles, records and history', keywords: ['history', 'records', 'championship', 'titles', 'dynasty'], paths: ['history'] }
];
module.exports = { id: 'institution', loop: 'institution-stewardship', genres: Object.keys(LEX).filter(k => k !== 'generic'), build, FEATURES, LEX };
