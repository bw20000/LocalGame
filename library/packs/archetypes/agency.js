/* Archetype: CLIENT AGENCY (relationships → deals → reputation).
   representation mode — sports agents, talent agencies: sign clients, negotiate their contracts
     with buyers (teams, studios), land endorsements, manage careers; the agency earns commission.
   service mode — ad agencies, law firms, political consultancies, investment banks: win client
     accounts, staff them with your people, deliver great work, renew and grow fees.
   Clients have hidden ability, visible fame, ambitions and loyalty; rival agencies poach the
   unhappy ones. Capacity (agents / staff) is the scarce resource. */
'use strict';
const C = require('../common');

const LEX = {
  'sports-agent': { mode: 'rep', title: 'Show Me the Money', tagline: 'Sign them young. Get them paid. Keep them loyal.', org: 'Sports agency', orgs: 'Sports agencies', client: 'athlete', clients: 'athletes', buyer: 'team', buyers: 'teams', staff: 'agent', staffs: 'agents', motif: 'broadcast', award: 'Agent of the Year', salary: 6e6, commission: 0.05, careerPeak: 28, careerEnd: [33, 38], sponsorWord: 'Endorsement',
    roles: ['Quarterback', 'Point guard', 'Striker', 'Pitcher', 'Winger', 'Center', 'Forward', 'Defender'], buyerNames: ['Harbor City Hawks', 'River Valley Kings', 'Northshore Mariners', 'Capital Comets', 'Desert Suns', 'Lakeside Lions', 'Mountain Grizzlies', 'Bayview Sharks', 'Ironworks Titans', 'Prairie Storm', 'Coastal Pilots', 'Twin Rivers FC', 'Metro Monarchs', 'Pine Hill Rangers', 'Redstone Rebels', 'Summit Stallions'],
    rivals: ['Apex Sports Group', 'Prime Athletes', 'Linewood Management', 'Elite Talent Partners', 'Crown Sports'], verbs: ['Sign a teenage phenom before anyone else', 'Win a bidding war for your star', 'Land a career-defining endorsement', 'Keep a client through a scandal', 'Build the most powerful agency in sports'] },
  'talent-agency': { mode: 'rep', title: 'Ten Percent', tagline: 'Stars, scripts and the art of the deal.', org: 'Talent agency', orgs: 'Talent agencies', client: 'client', clients: 'clients', buyer: 'studio', buyers: 'studios', staff: 'agent', staffs: 'agents', motif: 'atelier', award: 'Agency of the Year', salary: 3e6, commission: 0.1, careerPeak: 38, careerEnd: [55, 75], sponsorWord: 'Brand deal',
    roles: ['Actor', 'Actress', 'Director', 'Writer', 'Musician', 'Comedian', 'Host'], buyerNames: ['Silverlight Pictures', 'Northstar Studios', 'Halcyon Films', 'Channel North', 'Lighthouse TV', 'Meridian Networks', 'Redline Entertainment', 'Starfield Media', 'Lumiere West', 'Apex Broadcasting', 'Neon Wave Records', 'Bluebird Music'],
    rivals: ['Crescent Artists', 'Marquee Talent', 'Bright Lights Agency', 'Sterling & Rowe', 'Vantage Creative'], verbs: ['Discover a star in a tiny theater', 'Package a blockbuster', 'Get your client the role of a lifetime', 'Survive a client walking out'] },
  'ad-agency': { mode: 'service', title: 'Big Idea', tagline: 'Win the pitch. Keep the account. Make the work famous.', org: 'Ad agency', orgs: 'Ad agencies', client: 'account', clients: 'accounts', staff: 'creative team', staffs: 'creative teams', motif: 'editorial', award: 'Agency of the Year', retainer: 2.5e6, award2: 'Golden Pencil',
    roles: ['Automotive', 'Beverage', 'Tech', 'Retail', 'Finance', 'Fashion', 'Telecom', 'Travel'], rivals: ['Hartwell & Finch', 'Bold Arrow', 'Copperline Creative', 'Northlight Advertising', 'Saltwater Agency'], verbs: ['Win a pitch against the giants', 'Make an ad the whole country talks about', 'Keep a demanding client happy for a decade'] },
  'law-firm': { mode: 'service', title: 'The Firm', tagline: 'Billable hours, big cases, bigger clients.', org: 'Law firm', orgs: 'Law firms', client: 'client', clients: 'clients', staff: 'partner team', staffs: 'partner teams', motif: 'ledger', award: 'Firm of the Year', retainer: 4e6, award2: 'Case of the Year',
    roles: ['M&A', 'Litigation', 'IP', 'Regulatory', 'Employment', 'Restructuring', 'Tax'], rivals: ['Whitmore Vale LLP', 'Ashby & Crane', 'Kingsway Halvorsen', 'Calder Lane LLP', 'Granite Peak Law'], verbs: ['Win the case nobody thought you could', 'Land a blue-chip client', 'Make partner-level money for everyone'] },
  'political-consulting': { mode: 'service', title: 'War Room', tagline: 'Candidates, campaigns and election night.', org: 'Consultancy', orgs: 'Consultancies', client: 'campaign', clients: 'campaigns', staff: 'strategist team', staffs: 'strategist teams', motif: 'broadcast', award: 'Strategist of the Year', retainer: 1.2e6, award2: 'Upset of the Year',
    roles: ['Senate', 'Governor', 'Mayor', 'House', 'Ballot measure', 'Party committee'], rivals: ['Red Line Strategies', 'Blue Harbor Group', 'Capitol Partners', 'Front Porch Consulting'], verbs: ['Turn an underdog into a winner', 'Survive an October surprise', 'Build a client list of winners'] },
  'investment-bank': { mode: 'service', title: 'Bulge Bracket', tagline: 'Mandates, league tables and the deal of the year.', org: 'Bank', orgs: 'Banks', client: 'mandate', clients: 'mandates', staff: 'deal team', staffs: 'deal teams', motif: 'deal-room', award: 'Bank of the Year', retainer: 8e6, award2: 'Deal of the Year',
    roles: ['M&A advisory', 'IPO', 'Debt financing', 'Restructuring', 'Equity raise'], rivals: ['Sterling Brothers', 'Kingsley & Co.', 'Meridian Capital Markets', 'Harbor Rock Partners'], verbs: ['Top the league tables', 'Advise on the deal of the year', 'Build a franchise clients trust'] },
  generic: { mode: 'service', title: 'The Agency', tagline: 'Clients, craft and reputation.', org: 'Agency', orgs: 'Agencies', client: 'client', clients: 'clients', staff: 'team', staffs: 'teams', motif: 'editorial', award: 'Agency of the Year', retainer: 2e6, award2: 'Project of the Year',
    roles: ['Strategy', 'Design', 'Operations', 'Technology'], rivals: ['Atlas Partners', 'Northstar Group', 'Beacon & Co.', 'Summit Advisory'], verbs: ['Win great clients', 'Do great work', 'Grow the firm'] }
};
const cap = (s) => s[0].toUpperCase() + s.slice(1);

function build(opts = {}) {
  const genre = LEX[opts.genre] ? opts.genre : 'generic';
  const L = Object.assign({}, LEX[genre], opts.lexicon || {});
  const rep = L.mode === 'rep';
  const f = Object.assign({ endorsements: true, poaching: true, scandals: true, recessions: true, acquisitions: false }, opts.features || {});
  const title = opts.title || L.title;
  const Cl = cap(L.client), Cls = cap(L.clients), St = cap(L.staff), Sts = cap(L.staffs);
  const roles = JSON.stringify(L.roles).replace(/"/g, "'");
  const scale = rep ? L.salary : L.retainer;
  const cap0 = rep ? 7 : 3; // clients per staff
  const gdl = {
    gdl: 1,
    meta: { id: opts.id || genre + '-agency', version: 1, title, tagline: L.tagline, genre: opts.genre || genre, role: opts.role || (rep ? 'Founding agent' : 'Managing partner'), fantasy: L.verbs,
      pillars: ['People are the product: ability, ambition and loyalty', 'Capacity is scarce — every client you take on is attention you cannot give another', 'Reputation compounds; so do broken promises'], universe: 'fictional',
      disclaimer: 'All people, teams, companies and organizations are fictional.',
      goal: rep ? `Build {player.name} into the agency every ${L.client} wants to sign with.` : `Build {player.name} into the ${L.org.toLowerCase()} every client wants on their side.` },
    time: { unit: 'week', start: '2026-01-05' }, currency: { symbol: '$' }, warmup: 26,
    params: { scale, commission: rep ? L.commission : 0, prospectFlow: rep ? 0.35 : 0.15, poachRate: 1, staffCost: rep ? 4000 : Math.round(scale * 0.55 / 52), workCostPct: rep ? 0 : 0.002 },
    world: { cycle: C.cycle({ boom: 1.04, bust: 0.88, recession: f.recessions }), vars: [{ id: 'market', label: rep ? 'Salary market' : 'Client spending', format: 'x', start: 1, process: { type: 'meanRevert', mean: 1, vol: 0.006, speed: 0.02, min: 0.6, max: 1.6, phase: { recession: 0.85, expansion: 1.06 } } }] },
    resources: [{ id: 'reputation', label: 'Reputation', format: 'score', start: 35, min: 0, max: 100, base: '30', speed: 0.03, describe: `Whether the best ${L.clients} want to work with you.`,
      drivers: [{ label: `Happy ${L.clients}`, expr: `(avg(owned('client', org), it.happiness) - 55) * 0.3` }, { label: 'Big names', expr: `min(20, count(owned('client', org), it.fame > 70) * 4)` }, { label: 'Lost clients', expr: '-min(15, org.lost * 1.5)' }, { label: 'Awards', expr: 'min(15, org.awards * 4)' }] }],
    kinds: {
      client: { label: Cl, plural: Cls, idPrefix: 'cl', name: rep ? { generator: 'person' } : { template: '{pick(["Northwind","Helio","Vantage","Cobalt","Sable","Juniper","Meridian","Atlas","Summit","Harbor","Orchid","Kestrel","Granite","Lumen"])} {pick(["Motors","Foods","Bank","Group","Health","Systems","Retail","Air","Labs","Holdings","Energy","Media"])}' },
        fields: {
          role: 'text', ability: { type: 'number', label: rep ? 'Ability' : 'Strategic potential', hidden: true, noise: 14 }, fame: { type: 'number', label: rep ? 'Fame' : 'Profile' }, age: 'int',
          value: { type: 'money', label: rep ? 'Market value / yr' : 'Annual budget' }, deal: { type: 'money', label: rep ? 'Current contract / yr' : 'Fees to you / yr', default: 0 },
          dealUntil: { type: 'int', default: 0 }, buyer: { type: 'ref', ref: 'buyer' }, endorse: { type: 'money', label: L.sponsorWord ? L.sponsorWord + 's / yr' : 'Extras / yr', default: 0 },
          happiness: { type: 'number', label: 'Happiness', default: 60 }, loyalty: { type: 'number', default: 50 }, ambition: { type: 'number', default: 50 }, form: { type: 'number', default: 0 },
          workload: { type: 'number', default: 1 }, signed: 'int', status: { type: 'text', default: 'active' }, hof: { type: 'bool', default: false }, results: { type: 'number', default: 50 }
        },
        derived: { expiring: 'self.owner && self.dealUntil - time.tick <= 8', free: 'self.dealUntil <= time.tick' },
        tickWhen: "self.status == 'active'", tickEvery: 4,
        tick: rep ? [
          { op: 'set', path: 'self.age', value: 'self.age + 4 / 52' },
          { op: 'set', path: 'self.ability', value: `clamp(self.ability + (self.age < ${L.careerPeak} ? 0.35 : self.age < ${L.careerPeak + 4} ? 0 : -0.45) + randn(0, 0.8), 5, 99)` },
          { op: 'set', path: 'self.form', value: 'clamp(self.form * 0.7 + randn(0, 6), -25, 25)' },
          { op: 'set', path: 'self.fame', value: 'clamp(self.fame + (self.ability + self.form - 60) * 0.03 + randn(0, 0.6), 1, 99)' },
          { op: 'set', path: 'self.value', value: `params.scale * pow(max(1, self.ability) / 60, 3) * (0.7 + self.fame / 120) * world.market` },
          { op: 'if', cond: 'self.owner', then: [{ op: 'set', path: 'self.happiness', value: 'clamp(self.happiness + (self.deal >= self.value * 0.9 || self.free ? 0.6 : -1.2) + (self.workload <= 1 ? 0.3 : -1.5) - (self.ambition - 50) * 0.01 + randn(0, 1), 0, 100)' }] },
          { op: 'if', cond: `self.age > ${L.careerEnd[0]} && chance((self.age - ${L.careerEnd[0]}) / ${(L.careerEnd[1] - L.careerEnd[0]) * 4})`, then: [
            { op: 'set', path: 'self.status', value: "'retired'" }, { op: 'set', path: 'self.hof', value: 'self.fame >= 85' },
            { op: 'if', cond: 'self.owner && isPlayer(self.owner)', then: [{ op: 'news', text: '{self.name} retires{self.hof ? " — a legend of the game" : ""}', always: true }] },
            { op: 'transfer', target: 'self', to: 'null' }] }
        ] : [
          { op: 'set', path: 'self.value', value: 'max(params.scale * 0.2, self.value * (1 + randn(0.003, 0.02)) * (world.market > 1 ? 1.001 : 0.999))' },
          { op: 'if', cond: 'self.owner', then: [
            { op: 'set', path: 'self.results', value: 'clamp(self.results * 0.85 + (self.owner.craft * 0.6 + self.ability * 0.4 - (self.workload - 1) * 25 + randn(0, 8)) * 0.15, 0, 100)' },
            { op: 'set', path: 'self.happiness', value: 'clamp(self.happiness + (self.results - 55) * 0.05 - (self.workload > 1.1 ? 1.5 : 0) + randn(0, 0.8), 0, 100)' }] }
        ],
        generate: { count: '70', set: rep ? { role: `pick(${roles})`, age: `randInt(${L.careerPeak - 9}, ${L.careerEnd[0] + 2})`, ability: 'clamp(randn(52, 15), 10, 97)', fame: 'clamp(randn(35, 20), 1, 95)', loyalty: 'clamp(randn(50, 18), 5, 95)', ambition: 'clamp(randn(50, 20), 5, 95)', value: `params.scale * pow(max(1, self.ability) / 60, 3)`, dealUntil: 'randInt(-10, 150)', deal: 'self.value * rand(0.6, 1.1)' }
          : { role: `pick(${roles})`, ability: 'clamp(randn(50, 15), 10, 95)', fame: 'clamp(randn(40, 20), 1, 95)', loyalty: 'clamp(randn(50, 18), 5, 95)', ambition: 'clamp(randn(50, 20), 5, 95)', value: `params.scale * rand(0.3, 2.5)`, dealUntil: '0' } },
        explain: { title: rep ? 'What drives {self.name}\'s value' : 'How {self.name} feels about you', drivers: rep ? [{ label: 'Ability (estimate)', expr: "est(self, 'ability').value" }, { label: 'Fame', expr: 'self.fame' }, { label: 'Form', expr: 'self.form' }, { label: 'Age', expr: 'self.age' }, { label: 'Happiness', expr: 'self.happiness' }] : [{ label: 'Results you deliver', expr: 'self.results' }, { label: 'Team workload ×100', expr: 'self.workload * 100' }, { label: 'Happiness', expr: 'self.happiness' }] },
        display: { title: '{self.name}', subtitle: rep ? '{self.role} · age {int(self.age)} · fame {int(self.fame)}' : '{self.role} · budget {money(self.value)}', glyph: rep ? "'person'" : "'building'", stats: [{ label: rep ? 'Contract / yr' : 'Fees / yr', expr: 'self.deal', format: 'money' }, { label: 'Happiness', expr: 'self.happiness', format: 'score' }] }
      },
      buyer: rep ? { label: cap(L.buyer), plural: cap(L.buyers), records: L.buyerNames.map((n, i) => ({ id: 'b' + i, name: n, budget: 0, prestige: 40 + (i * 37) % 55, need: L.roles[i % L.roles.length] })),
        fields: { budget: { type: 'money', label: 'Spending room this year' }, prestige: { type: 'number', label: 'Prestige' }, need: 'text' },
        tick: [{ op: 'if', cond: 'time.tickOfYear == 0', then: [{ op: 'set', path: 'self.budget', value: 'params.scale * rand(2, 6) * world.market' }, { op: 'set', path: 'self.need', value: `pick(${roles})` }] }],
        display: { title: '{self.name}', subtitle: 'Room {money(self.budget)} · needs a {self.need}' } } : { label: 'Market', plural: 'Markets', records: [{ id: 'm0', name: 'Domestic', budget: 0, prestige: 50, need: '' }], fields: { budget: 'money', prestige: 'number', need: 'text' } }
    },
    orgs: {
      label: L.org, plural: L.orgs,
      fields: { staff: { type: 'int', default: 2, label: Sts }, lost: { type: 'int', default: 0 }, awards: { type: 'int', default: 0 }, craft: { type: 'number', default: 55, label: 'Craft' }, careLevel: { type: 'number', default: 1 }, wins: { type: 'int', default: 0 } },
      metrics: [
        { id: 'clientCount', label: Cls, expr: "count(owned('client', org))", format: 'int' },
        { id: 'capacity', label: rep ? 'Capacity' : 'Fee capacity', expr: rep ? `org.staff * ${cap0}` : 'org.staff * params.scale', format: rep ? 'int' : 'money' },
        { id: 'load', label: 'Workload', expr: rep ? 'org.clientCount / max(1, org.capacity)' : "sum(owned('client', org), it.deal) / max(1, org.capacity)", format: 'pct' },
        { id: 'book', label: rep ? 'Client earnings / yr' : 'Annual fees', expr: "sum(owned('client', org), it.deal + it.endorse)", format: 'money' },
        { id: 'commissionYear', label: rep ? 'Commission / yr' : 'Fees / yr', expr: rep ? 'org.book * params.commission' : 'org.book', format: 'money' },
        { id: 'happy', label: 'Client happiness', expr: "avg(owned('client', org), it.happiness)", format: 'score' },
        { id: 'stars', label: rep ? 'Star clients' : 'Marquee clients', expr: "count(owned('client', org), it.fame > 70)", format: 'int' },
        { id: 'margin', label: 'Operating margin', expr: 'org.profitYear / max(1, org.revenueYear)', format: 'pct1' }
      ],
      valuation: 'max(0, org.cash - org.debt + org.commissionYear * 2.5 + org.reputation * params.scale * 0.02)',
      assets: 'org.commissionYear * 2',
      costs: [{ label: `${Sts} & salaries`, expr: 'params.staffCost * org.staff + 3000' }, { label: 'Client care & travel', expr: rep ? '1500 * org.clientCount * org.careLevel' : 'org.book * params.workCostPct * org.careLevel' }],
      player: { name: rep ? 'Northbridge Sports' : genre === 'law-firm' ? 'Ashgrove & Lin LLP' : genre === 'investment-bank' ? 'Ashgrove Partners' : 'Ashgrove Agency', cash: String(rep ? 1.5e6 : scale * 1.2),
        start: [{ op: 'each', list: rep ? "top(filter(all('client'), !it.owner && it.ability < 60), it.ability + randn(0, 15), 3)" : "top(filter(all('client'), !it.owner), it.value * rand(), 2)", do: [{ op: 'transfer', target: 'it', to: 'org' }, { op: 'set', path: 'it.signed', value: '0' }, { op: 'set', path: 'it.happiness', value: '65' }].concat(rep ? [] : [{ op: 'set', path: 'it.deal', value: 'it.value * 0.4' }]) }] },
      rivals: { count: { full: 4, light: 3, background: 8 }, aiEvery: 2, entryChance: '0.3', maxActive: 9, failGrace: 20, backgroundValue: String(scale * 6),
        fixed: L.rivals.slice(0, 5).map((n, i) => ({ name: n, archetype: ['shark', 'boutique'][i % 2] })),
        archetypes: [
          { id: 'shark', label: rep ? 'Shark' : 'Powerhouse', risk: 0.7, tempo: 2, color: '#b5651d', cash: String(scale * (rep ? 3 : 3)), set: { staff: '5' }, weights: { signClient: 1.5 },
            start: [{ op: 'each', list: rep ? "top(filter(all('client'), !it.owner), it.fame + randn(0, 20), 10)" : "top(filter(all('client'), !it.owner), it.value * rand(), 5)", do: [{ op: 'transfer', target: 'it', to: 'org' }].concat(rep ? [] : [{ op: 'set', path: 'it.deal', value: 'it.value * 0.4' }]) }] },
          { id: 'boutique', label: rep ? 'Boutique' : 'Boutique', risk: 0.4, tempo: 1, color: '#5b3a8c', cash: String(scale * 1.5), set: { staff: '3', careLevel: '1.3' }, weights: {},
            start: [{ op: 'each', list: rep ? "top(filter(all('client'), !it.owner), it.ability + randn(0, 20), 6)" : "top(filter(all('client'), !it.owner), it.ability, 3)", do: [{ op: 'transfer', target: 'it', to: 'org' }].concat(rep ? [] : [{ op: 'set', path: 'it.deal', value: 'it.value * 0.4' }]) }] }
        ] }
    }
  };
  if (rep) gdl.kinds.client.income = [{ label: 'Commissions', expr: 'self.deal * params.commission / 52' }, { label: L.sponsorWord + ' commissions', expr: 'self.endorse * 0.15 / 52' }];
  else gdl.kinds.client.income = [{ label: 'Client fees', expr: 'self.deal / 52' }];
  // prospects keep arriving
  gdl.kinds.buyer.tick = (gdl.kinds.buyer.tick || []).concat([{ op: 'if', cond: "self.id == 'b0' || self.id == 'm0'", then: [{ op: 'chance', p: 'params.prospectFlow', then: [{ op: 'create', kind: 'client', owner: "'none'", as: 'c', set: { role: `pick(${roles})` } },
    { op: 'set', path: 'c.ability', value: 'clamp(randn(50, 16), 10, 97)' }, { op: 'set', path: 'c.fame', value: 'clamp(randn(22, 14), 1, 80)' }, { op: 'set', path: 'c.age', value: rep ? `randInt(${L.careerPeak - 10}, ${L.careerPeak - 4})` : '0' }, { op: 'set', path: 'c.loyalty', value: 'clamp(randn(50, 18), 5, 95)' }, { op: 'set', path: 'c.ambition', value: 'clamp(randn(50, 20), 5, 95)' },
    { op: 'set', path: 'c.value', value: rep ? 'params.scale * pow(max(1, c.ability) / 60, 3) * 0.6' : 'params.scale * rand(0.3, 2.5)' }, { op: 'set', path: 'c.dealUntil', value: rep ? 'time.tick' : '0' }] }] },
    { op: 'each', list: "filter(all('client'), it.status != 'active' && !it.hof && time.tick - it.signed > 520)", do: [{ op: 'remove', target: 'it' }] }]);

  /* ---------------- actions ---------------- */
  const capOk = rep ? "count(owned('client', org)) < org.staff * " + cap0 + ' + 1' : "sum(owned('client', org), it.deal) < org.staff * params.scale * 1.05";
  gdl.actions = [
    { id: 'signClient', label: rep ? `Sign ${L.client === 'athlete' ? 'an athlete' : 'a client'}` : `Pitch for an ${L.client === 'account' ? 'account' : L.client}`, verb: rep ? 'Sign' : 'Pitch', category: 'clients', icon: 'handshake', primary: true,
      describe: rep ? `Offer representation. Better-known ${L.clients} want a strong agency — and promises.` : `Pitch for the business. Your reputation and craft decide the odds.`, tradeoff: 'Each client takes capacity; overloaded teams make everyone unhappy.', risk: rep ? 'Ability is an estimate until you work together.' : 'Losing a pitch costs time and money.',
      params: [{ id: 'c', label: Cl, type: 'entity', kind: 'client', filter: "!it.owner && it.status == 'active'", sort: rep ? "est(it, 'ability').value + it.fame * 0.5" : 'it.value' }],
      vars: { odds: rep ? 'clamp(0.35 + (org.reputation - param.c.fame) / 90 + (param.c.loyalty - 50) / 300, 0.05, 0.92)' : 'clamp(0.2 + (org.reputation - 40) / 120 + (org.craft - 55) / 150, 0.05, 0.75)' },
      requires: [{ expr: capOk, msg: `Your ${L.staffs} are at capacity — hire before you sign more` }],
      cost: { cash: rep ? 'max(10000, param.c.value * 0.004)' : 'param.c.value * 0.03' }, costCategory: rep ? 'Recruiting' : 'Pitch costs',
      preview: [{ label: rep ? 'Chance they say yes' : 'Chance you win the pitch', expr: 'odds', format: 'pct' }, { label: rep ? 'Ability (estimate)' : 'Potential (estimate)', expr: "est(param.c, 'ability').value", format: 'score' }, { label: rep ? 'Market value / yr' : 'Annual budget', expr: 'param.c.value', format: 'money' }, { label: rep ? 'Your commission at that value' : 'Likely fees / yr', expr: rep ? 'param.c.value * params.commission' : 'param.c.value * 0.4', format: 'money' }],
      effects: [{ op: 'chance', p: 'odds', then: [{ op: 'transfer', target: 'param.c', to: 'org' }, { op: 'set', target: 'param.c', field: 'signed', value: 'time.tick' }, { op: 'set', target: 'param.c', field: 'happiness', value: '62' }].concat(rep ? [] : [{ op: 'set', target: 'param.c', field: 'deal', value: 'param.c.value * 0.4' }, { op: 'set', path: 'org.wins', value: 'org.wins + 1' }]),
        else: [{ op: 'news', text: `{param.c.name} ${rep ? 'signs elsewhere' : 'picks another firm'}` }, { op: 'remember', a: 'param.c', b: 'org', key: 'relationship', add: '-3' }] }],
      result: rep ? 'Offer made to {param.c.name}' : 'Pitch delivered to {param.c.name}',
      ai: { score: `(${capOk}) && org.cash > param.c.value * 0.05 ? (${rep ? 'param.c.ability + param.c.fame * 0.4 + randn(0, 12) - 62' : 'param.c.value / params.scale * 20 + randn(0, 10) - 25'}) * 100 : 0`, candidates: 3, news: rep ? '{org.name} signs {param.c.name}' : '{org.name} wins {param.c.name}' } },
    { id: 'hireStaff', label: `Hire ${L.staff === 'agent' ? 'an agent' : 'a ' + L.staff}`, verb: 'Hire', category: 'firm', icon: 'user',
      describe: rep ? `Each ${L.staff} can look after about ${cap0} ${L.clients}.` : `Each ${L.staff} can deliver about ${'$'}${Math.round(scale / 1e5) / 10}M of annual fees.`, tradeoff: 'Salaries every week whether or not you have the clients.',
      cost: { cash: 'params.staffCost * 8' }, costCategory: 'Hiring', requires: [{ expr: 'org.staff < 40', msg: 'Big enough' }],
      effects: [{ op: 'set', path: 'org.staff', value: 'org.staff + 1' }, { op: 'set', path: 'org.craft', value: 'clamp(org.craft + randn(0, 2), 20, 95)' }], result: `A new ${L.staff} joins {org.name}`,
      ai: { score: `${rep ? `count(owned('client', org)) >= org.staff * ${cap0} - 1` : 'org.load > 0.85'} && org.cash > params.staffCost * 40 ? 2000 : 0` } },
    { id: 'releaseClient', label: 'Part ways', verb: 'Release', kind: 'client', category: 'clients', icon: 'close', danger: true,
      describe: 'End the relationship and free up capacity.', tradeoff: 'Word gets around.',
      effects: [{ op: 'transfer', target: 'self', to: 'null' }, { op: 'resource', id: 'reputation', add: '-1' }, { op: 'news', text: 'You part ways with {self.name}' }], result: 'You part ways with {self.name}',
      ai: { score: rep ? 'self.value < params.scale * 0.15 && self.deal < params.scale * 0.2 ? 500 : 0' : 'self.deal < params.scale * 0.15 ? 500 : 0', selfSample: 4 } }
  ];
  if (rep) {
    gdl.actions.push(
      { id: 'takeBestOffer', label: 'Take the best offer', verb: 'Close the deal', kind: 'client', category: 'deals', icon: 'check',
        describe: `Accept the best offer on the table for your ${L.client}. Quick and safe — you might leave money behind.`, tradeoff: 'Certain money now versus a better deal by negotiating.',
        requires: [{ expr: 'self.free || self.expiring', msg: 'Under contract' }],
        vars: { offer: 'self.value * rand(0.82, 1.0) * (self.form > 5 ? 1.05 : 1)', yrs: 'randInt(2, 5)' },
        preview: [{ label: 'Market value / yr', expr: 'self.value', format: 'money' }, { label: 'Your commission / yr', expr: 'self.value * 0.9 * params.commission', format: 'money' }],
        effects: [{ op: 'let', name: 'b', value: "bestOf(all('buyer'), it.budget * (it.need == outer.self.role ? 1.5 : 1))" }, { op: 'set', path: 'self.deal', value: 'offer' }, { op: 'set', path: 'self.dealUntil', value: 'time.tick + yrs * 52' }, { op: 'set', path: 'self.buyer', value: 'b' }, { op: 'if', cond: 'b', then: [{ op: 'set', path: 'b.budget', value: 'max(0, b.budget - offer)' }] }, { op: 'set', path: 'self.happiness', value: 'clamp(self.happiness + (offer / max(1, self.value) - 0.9) * 40, 0, 100)' }],
        result: '{self.name} signs for {money(self.deal)} a year', ai: { score: 'self.free || self.expiring ? self.value * params.commission : 0', selfSample: 10, news: '{self.name} signs a new deal' } },
      { id: 'negotiateDeal', label: 'Negotiate a contract', verb: 'Negotiate', kind: 'client', category: 'deals', icon: 'handshake',
        describe: `Go to the ${L.buyer} with the most room and fight for your ${L.client}. Overreach and they walk.`, tradeoff: 'Pushing too hard can sour relationships with that ' + L.buyer + '.',
        requires: [{ expr: 'self.free || self.expiring', msg: 'Under contract' }],
        params: [{ id: 'b', label: cap(L.buyer), type: 'entity', kind: 'buyer', sort: "it.budget * (it.need == self.role ? 1.5 : 1)" }],
        effects: [{ op: 'negotiate', id: 'contract', with: 'param.b', set: {} }], playerOnly: true },
      { id: 'pitchEndorsement', label: `Land ${L.sponsorWord === 'Endorsement' ? 'an endorsement' : 'a brand deal'}`, verb: 'Pitch', kind: 'client', category: 'deals', icon: 'star', cooldown: 52,
        describe: 'Brands pay for fame and a clean image.', requires: [{ expr: 'self.fame >= 45', msg: 'Not famous enough yet' }],
        cost: { cash: '15000' }, costCategory: 'Marketing',
        effects: [{ op: 'chance', p: 'clamp(self.fame / 110, 0.1, 0.9)', then: [{ op: 'set', path: 'self.endorse', value: 'self.endorse + params.scale * pow(self.fame / 100, 2) * rand(0.2, 0.8)' }, { op: 'add', path: 'self.happiness', value: '5' }, { op: 'news', text: '{self.name} lands a {money(self.endorse)}-a-year deal' }], else: [{ op: 'news', text: 'No brand bites for {self.name}' }] }],
        result: 'Pitched brands for {self.name}', ai: { score: 'self.fame >= 55 ? self.fame * 100 : 0', selfSample: 4 } },
      { id: 'careerPlan', label: 'Invest in their career', verb: 'Invest', kind: 'client', category: 'clients', icon: 'up', cooldown: 26,
        describe: 'Trainers, coaches, media training. Raises ability, form and loyalty.', cost: { cash: 'max(20000, self.value * 0.01)' }, costCategory: 'Client development',
        effects: [{ op: 'add', path: 'self.ability', value: `self.age < ${L.careerPeak} ? rand(1, 4) : rand(0, 1.5)` }, { op: 'add', path: 'self.loyalty', value: '6' }, { op: 'add', path: 'self.happiness', value: '6' }, { op: 'observe', target: 'self', field: 'ability', quality: '0.8' }],
        result: 'Career plan for {self.name}', ai: { score: `self.age < ${L.careerPeak} && self.ability > 55 ? self.value * 0.002 : 0`, selfSample: 3 } });
    gdl.negotiations = [{ id: 'contract', label: 'Contract', with: 'buyer', patience: 3, counter: { term: 'salary' }, context: { client: 'self' },
      terms: [{ id: 'salary', label: 'Salary / yr', type: 'money', default: 'client.value * 1.15', min: 'client.value * 0.4', max: 'client.value * 3', step: 50000 }, { id: 'years', label: 'Years', type: 'choice', default: '3', options: [{ value: 1, label: '1 year' }, { value: 3, label: '3 years' }, { value: 5, label: '5 years' }] }],
      value: '(client.value * (them.need == client.role ? 1.25 : 1) * (1 + (them.prestige - 50) / 200) * (terms.years >= 5 && client.age > ' + (L.careerPeak + 3) + ' ? 0.85 : 1)) / max(1, terms.salary)', reservation: 'them.budget >= terms.salary ? 1 : 1.6',
      reasons: [{ when: 'them.budget < terms.salary', text: 'They do not have the room under their budget' }, { when: 'terms.salary > client.value * 1.3', text: 'They think you are asking far above market' }, { when: 'them.need != client.role', text: `They are not desperate for a ${'{client.role}'}` }],
      onAccept: [{ op: 'set', path: 'client.deal', value: 'terms.salary' }, { op: 'set', path: 'client.dealUntil', value: 'time.tick + terms.years * 52' }, { op: 'set', path: 'client.buyer', value: 'them' }, { op: 'set', path: 'them.budget', value: 'max(0, them.budget - terms.salary)' }, { op: 'set', path: 'client.happiness', value: 'clamp(client.happiness + (terms.salary / max(1, client.value) - 0.95) * 50, 0, 100)' }, { op: 'resource', id: 'reputation', add: 'terms.salary > client.value * 1.2 ? 2 : 0.5' },
        { op: 'if', cond: 'terms.salary >= params.scale * 4', then: [{ op: 'moment', title: 'A record deal', text: '{client.name} signs with {them.name} for {money(terms.salary)} a year.', stat: '{money(terms.salary * terms.years)}' }] }],
      acceptNews: '{client.name} signs with {them.name}: {money(terms.salary)} × {terms.years} years' }];
  } else {
    gdl.actions.push(
      { id: 'renewAccount', label: 'Renegotiate fees', verb: 'Renegotiate', kind: 'client', category: 'deals', icon: 'handshake',
        describe: 'Ask for a bigger share of their budget. Great results make it easy; weak results make it dangerous.', requires: [{ expr: 'time.tick - self.signed > 26', msg: 'Too soon after winning the business' }],
        effects: [{ op: 'negotiate', id: 'fees', with: 'self' }], playerOnly: true },
      { id: 'raiseFees', label: 'Propose a scope expansion', verb: 'Expand', kind: 'client', category: 'deals', icon: 'up', cooldown: 52,
        describe: 'Offer more services for more money. Works when the client is happy.', requires: [{ expr: 'self.happiness >= 55', msg: 'They are not happy enough to buy more' }],
        effects: [{ op: 'chance', p: 'clamp((self.happiness - 50) / 80, 0.05, 0.6)', then: [{ op: 'set', path: 'self.deal', value: 'min(self.value * 0.7, self.deal * rand(1.05, 1.2))' }, { op: 'set', path: 'self.workload', value: 'self.workload + 0.1' }], else: [{ op: 'add', path: 'self.happiness', value: '-4' }] }],
        result: 'Proposal made to {self.name}', ai: { score: 'self.happiness > 65 && self.deal < self.value * 0.6 ? self.value * 0.01 : 0', selfSample: 4 } },
      { id: 'starTeam', label: 'Put your best people on it', verb: 'Prioritize', kind: 'client', category: 'clients', icon: 'star', cooldown: 13,
        describe: 'Better work for this client this quarter — at the expense of the others.', cost: { cash: 'self.deal * 0.03' }, costCategory: 'Delivery',
        effects: [{ op: 'set', path: 'self.results', value: 'min(100, self.results + rand(6, 14))' }, { op: 'each', list: "filter(owned('client', org), it != outer.self)", do: [{ op: 'add', path: 'it.results', value: '-1' }] }],
        result: 'Your best people focus on {self.name}', ai: { score: 'self.happiness < 45 && self.deal > params.scale * 0.5 ? self.deal * 0.01 : 0', selfSample: 3 } },
      { id: 'invest', label: 'Invest in craft', verb: 'Invest', category: 'firm', icon: 'wrench', cooldown: 26,
        describe: 'Training, tools, senior hires. Raises the quality of all your work.', cost: { cash: 'params.staffCost * org.staff * 4' }, costCategory: 'Training',
        effects: [{ op: 'set', path: 'org.craft', value: 'min(95, org.craft + rand(2, 5))' }], result: 'Craft improves at {org.name}', ai: { score: 'org.craft < 70 && org.cash > params.staffCost * org.staff * 20 ? 3000 : 0' } });
    gdl.negotiations = [{ id: 'fees', label: 'Fee negotiation', with: 'client', patience: 2, counter: { term: 'fees' },
      terms: [{ id: 'fees', label: 'Annual fees', type: 'money', default: 'them.deal * 1.25', min: 'them.deal * 0.5', max: 'them.value', step: 25000 }],
      value: '(them.deal * (0.8 + them.results / 120) * (1 + (them.happiness - 50) / 150)) / max(1, terms.fees) * 1.15', reservation: '1',
      reasons: [{ when: 'them.results < 50', text: 'They are not impressed with recent work' }, { when: 'terms.fees > them.value * 0.6', text: 'That is most of their budget' }],
      onAccept: [{ op: 'set', path: 'them.deal', value: 'terms.fees' }, { op: 'add', path: 'them.happiness', value: '-3' }], onReject: [{ op: 'add', path: 'them.happiness', value: '-6' }],
      acceptNews: '{them.name} agrees to {money(terms.fees)} a year' }];
  }
  gdl.actions.push(...C.financeActions());

  /* ---------------- policies ---------------- */
  gdl.policies = [
    { id: 'care', label: 'Client care', scope: 'org', default: 'standard', describe: 'Time and money spent keeping clients happy.',
      options: [{ value: 'lean', label: 'Lean', describe: 'Cheaper; clients feel it.', effects: [{ op: 'set', path: 'org.careLevel', value: '0.6' }, { op: 'each', list: "owned('client', org)", do: [{ op: 'add', path: 'it.happiness', value: '-0.4' }] }] }, { value: 'standard', label: 'Standard', effects: [{ op: 'set', path: 'org.careLevel', value: '1' }] }, { value: 'white-glove', label: 'White-glove', describe: 'Expensive; loyal clients.', effects: [{ op: 'set', path: 'org.careLevel', value: '1.6' }, { op: 'each', list: "owned('client', org)", do: [{ op: 'add', path: 'it.happiness', value: '0.4' }, { op: 'add', path: 'it.loyalty', value: '0.1' }] }] }] },
    { id: 'workload', label: 'Workload', scope: 'org', every: 4, default: 'track', describe: 'Spread work across your teams (updates client workload).',
      options: [{ value: 'track', label: 'Track automatically', effects: [{ op: 'each', list: "owned('client', org)", do: [{ op: 'set', path: 'it.workload', value: 'org.load' }] }] }] }
  ];
  if (rep) gdl.policies.push({ id: 'renewals', label: 'Contract renewals', scope: 'org', default: 'ask', describe: 'What your agents do when a contract comes up.', every: 2,
    options: [{ value: 'ask', label: 'Ask me', describe: 'Each expiring deal goes to Needs you.' }, { value: 'auto', label: 'Close the best offer', describe: 'Safe, fast, sometimes leaves money on the table.', effects: [{ op: 'autoAct', action: 'takeBestOffer', max: '3' }] }] });
  const b = C.board();
  b.stakeholder.label = 'Partners\' confidence'; b.stakeholder.describe = 'Your senior partners and backers.';
  gdl.stakeholders = [b.stakeholder];

  /* ---------------- events ---------------- */
  gdl.events = [b.event, C.recessionEvent('Cut costs and staff'),
    { id: 'poached', priority: 'important', chance: 'params.poachRate * 0.04', cooldown: 8, title: '{rv.name} is courting {c.name}', text: '{c.name} (happiness {int(c.happiness)}) has been seen with {rv.name}.',
      bind: { c: { kind: 'client', owner: 'player', filter: 'it.happiness < 55 || it.fame > 70', pick: 'min', by: 'it.happiness + it.loyalty' }, rv: { kind: 'org', filter: '!it.isPlayer && it.level < 3' } },
      choices: [{ label: 'Make them feel valued', describe: 'A personal visit, a better plan.', cost: rep ? 'max(20000, c.value * 0.01)' : 'c.deal * 0.05', effects: [{ op: 'add', path: 'c.happiness', value: '15' }, { op: 'add', path: 'c.loyalty', value: '5' }], result: '{c.name} stays' },
        { label: rep ? 'Cut your commission for them' : 'Cut fees 15%', effects: rep ? [{ op: 'add', path: 'c.happiness', value: '20' }, { op: 'set', path: 'c.endorse', value: 'c.endorse * 0.9' }] : [{ op: 'set', path: 'c.deal', value: 'c.deal * 0.85' }, { op: 'add', path: 'c.happiness', value: '18' }], result: 'You keep {c.name} on better terms' },
        { label: 'Let them go if they want', effects: [{ op: 'chance', p: 'clamp((70 - c.happiness - c.loyalty * 0.3) / 60, 0.05, 0.9)', then: [{ op: 'transfer', target: 'c', to: 'rv' }, { op: 'set', path: 'player.lost', value: 'player.lost + 1' }, { op: 'remember', a: 'rv', b: 'player', key: 'rivalry', add: '8' }, { op: 'news', text: '{c.name} leaves for {rv.name}' }] }], result: 'You wait and see', track: { text: 'Let {c.name} go to {rv.name}', ref: 'c' } }] }
  ];
  if (rep) gdl.events.push(
    { id: 'biddingWar', priority: 'important', chance: '0.03', cooldown: 10, title: 'A bidding war for {c.name}', text: '{b1.name} and {b2.name} both want {c.name}. Market value: {money(c.value)} a year.',
      bind: { c: { kind: 'client', owner: 'player', filter: 'it.free || it.expiring', pick: 'max', by: 'it.value' }, b1: { kind: 'buyer', pick: 'max', by: 'it.budget' }, b2: { kind: 'buyer', filter: 'it != b1', pick: 'max', by: 'it.budget * rand()' } },
      choices: [{ label: 'Play them against each other', describe: 'Big upside; one may walk.', effects: [{ op: 'chance', p: '0.65', then: [{ op: 'set', path: 'c.deal', value: 'c.value * rand(1.15, 1.45)' }, { op: 'set', path: 'c.dealUntil', value: 'time.tick + 156' }, { op: 'set', path: 'c.buyer', value: 'b1' }, { op: 'add', path: 'c.happiness', value: '15' }, { op: 'resource', id: 'reputation', add: '2' }], else: [{ op: 'set', path: 'c.deal', value: 'c.value * 0.85' }, { op: 'set', path: 'c.dealUntil', value: 'time.tick + 104' }, { op: 'set', path: 'c.buyer', value: 'b2' }, { op: 'remember', a: 'b1', b: 'player', key: 'relationship', add: '-10' }] }], result: '{c.name} signs' },
        { label: 'Take the safe offer now', effects: [{ op: 'set', path: 'c.deal', value: 'c.value * 1.05' }, { op: 'set', path: 'c.dealUntil', value: 'time.tick + 156' }, { op: 'set', path: 'c.buyer', value: 'b1' }, { op: 'add', path: 'c.happiness', value: '5' }], result: '{c.name} signs with {b1.name}' }] },
    { id: 'injury', priority: 'important', chance: '0.02', cooldown: 12, title: '{c.name} is injured', text: 'Doctors say it could cost a season. Their value is about to drop.',
      bind: { c: { kind: 'client', owner: 'player', filter: 'it.age > 22' } },
      choices: [{ label: 'Pay for the best specialists', cost: 'max(30000, c.value * 0.02)', effects: [{ op: 'add', path: 'c.ability', value: '-rand(0, 3)' }, { op: 'add', path: 'c.loyalty', value: '10' }], result: '{c.name} begins recovery' }, { label: 'Let the team handle it', effects: [{ op: 'add', path: 'c.ability', value: '-rand(2, 9)' }, { op: 'add', path: 'c.happiness', value: '-6' }], result: '{c.name} rehabs with the team' }] });
  if (f.scandals) gdl.events.push({ id: 'scandal', priority: 'critical', chance: '0.012', cooldown: 30, title: 'Scandal: {c.name}', text: 'Headlines everywhere. Sponsors are calling, and so are reporters.',
    bind: { c: { kind: 'client', owner: 'player', filter: 'it.fame > 35', pick: 'max', by: 'it.fame' } },
    choices: [{ label: 'Stand by them and manage the story', cost: rep ? 'max(40000, c.value * 0.01)' : 'c.deal * 0.05', effects: [{ op: 'add', path: 'c.loyalty', value: '20' }, { op: 'resource', id: 'reputation', add: '-2' }], result: 'You stand by {c.name}' },
      { label: 'Distance the agency', effects: [{ op: 'add', path: 'c.happiness', value: '-25' }, { op: 'resource', id: 'reputation', add: '1' }], result: 'You distance yourself from {c.name}' },
      { label: 'Drop them', effects: [{ op: 'transfer', target: 'c', to: 'null' }, { op: 'resource', id: 'reputation', add: '-1' }], result: 'You drop {c.name}' }].concat(rep ? [] : []) });
  if (!rep) gdl.events.push({ id: 'bigPitch', priority: 'important', chance: '0.03', cooldown: 12, title: '{c.name} is reviewing its {c.role} business', text: 'A {money(c.value)} budget is up for grabs. The pitch is in three weeks.',
    bind: { c: { kind: 'client', filter: '!it.owner || !isPlayer(it.owner)', pick: 'max', by: 'it.value * rand()' } },
    choices: [{ label: 'Go all in on the pitch', cost: 'c.value * 0.05', requires: 'player.load < 1', effects: [{ op: 'chance', p: 'clamp(0.35 + (player.reputation - 40) / 100 + (player.craft - 55) / 120, 0.1, 0.85)', then: [{ op: 'transfer', target: 'c', to: 'player' }, { op: 'set', path: 'c.deal', value: 'c.value * 0.45' }, { op: 'set', path: 'c.signed', value: 'time.tick' }, { op: 'set', path: 'c.happiness', value: '65' }, { op: 'set', path: 'player.wins', value: 'player.wins + 1' }, { op: 'moment', title: 'You won {c.name}', text: '{money(c.deal)} a year in new business.', stat: '{money(c.deal)}' }], else: [{ op: 'news', text: 'You lose the {c.name} pitch' }] }], result: 'Pitch delivered' },
      { label: 'Sit this one out', effects: [], result: 'You pass', track: { text: 'Passed on the {c.name} pitch', ref: 'c' } }] },
    { id: 'clientLeaves', priority: 'critical', chance: '0.25', cooldown: 4, title: '{c.name} puts its business up for review', text: 'Results {int(c.results)}/100, happiness {int(c.happiness)}. They are talking to other firms.',
      bind: { c: { kind: 'client', owner: 'player', filter: 'it.happiness < 30' } },
      choices: [{ label: 'Rescue the account', describe: 'Your best people and a fee cut.', effects: [{ op: 'set', path: 'c.deal', value: 'c.deal * 0.85' }, { op: 'set', path: 'c.results', value: 'c.results + 15' }, { op: 'add', path: 'c.happiness', value: '25' }], result: 'You fight for {c.name}' },
        { label: 'Let them go', effects: [{ op: 'transfer', target: 'c', to: 'null' }, { op: 'set', path: 'player.lost', value: 'player.lost + 1' }], result: '{c.name} leaves' }] });
  gdl.events.push({ id: 'awardSeason', priority: 'routine', when: 'time.tickOfYear == 48', cooldown: 40, title: (L.award2 || L.award) + ' shortlist', bind: { c: { kind: 'client', owner: 'player', filter: rep ? 'it.fame > 75' : 'it.results > 75', pick: 'max', by: rep ? 'it.fame' : 'it.results' } },
    effects: [{ op: 'chance', p: '0.4', then: [{ op: 'set', path: 'player.awards', value: 'player.awards + 1' }, { op: 'resource', id: 'reputation', add: '4' }, { op: 'moment', title: (L.award2 || L.award), text: `Your work with {c.name} wins ${L.award2 || L.award}.`, stat: '🏆' }] }], news: '{c.name} is shortlisted for ' + (L.award2 || L.award) });

  /* ---------------- progression, history, needs ---------------- */
  gdl.progression = {
    tiers: [{ id: 'startup', label: rep ? 'One-agent shop' : 'Boutique' }, { id: 'established', label: 'Established', when: `player.clientCount >= ${rep ? 10 : 5} && player.commissionYear >= ${Math.round(scale * (rep ? 0.5 : 2))}`, text: 'The big names start returning your calls.' }, { id: 'power', label: 'Powerhouse', when: `player.stars >= ${rep ? 4 : 3} && player.commissionYear >= ${Math.round(scale * (rep ? 2.5 : 8))}`, text: 'You set the market.' }, { id: 'legend', label: 'Legendary', when: `player.commissionYear >= ${Math.round(scale * (rep ? 8 : 25))} && player.awards >= 3` }],
    objectives: C.objectives([{ id: 'clients', text: `Represent {int(target)} ${L.clients}`, metric: 'player.clientCount', target: 'base + 2', reward: [{ op: 'stake', id: 'board', add: '8' }], penalty: [{ op: 'stake', id: 'board', add: '-6' }] }, { id: 'happy', text: 'Keep average client happiness above {int(target)}', metric: 'player.happy', target: 'max(55, min(75, base + 4))', reward: [{ op: 'stake', id: 'board', add: '6' }], penalty: [{ op: 'stake', id: 'board', add: '-6' }] }]),
    failure: C.failure({ unit: 'client contracts' }),
    victory: [{ id: 'top', label: `The most powerful ${L.org.toLowerCase()}`, when: 'count(rivals(), it.level < 3 && it.value > player.value) == 0 && tierIndex() >= 2', text: 'No rival agency comes close.' }]
  };
  gdl.history = C.history({ unitLabel: L.clients, unitMetric: 'org.clientCount', awardName: L.award, awardScore: 'org.commissionYear / params.scale * 10 + org.happy * 0.3 + org.reputation * 0.3' });
  gdl.history.records.push({ id: 'book', label: rep ? 'Biggest client book' : 'Biggest fee book', expr: 'org.book', format: 'money' });
  gdl.history.milestones.push({ id: 'star', label: rep ? 'First star client' : 'First marquee client', when: 'player.stars >= 1', text: 'A name everyone knows.' }, { id: 'ten', label: `Ten ${L.clients}`, when: 'player.clientCount >= 10', text: 'A real roster.' });
  gdl.needs = [
    { id: 'expiring', forEach: 'client', when: rep ? 'self.owner && isPlayer(self.owner) && (self.free || self.expiring)' : 'false', text: '{self.name} needs a new contract', sub: 'Negotiate, or take the best offer', action: 'negotiateDeal', priority: 1, tone: 'warn' },
    { id: 'unhappy', forEach: 'client', when: 'self.owner && isPlayer(self.owner) && self.happiness < 40', text: '{self.name} is unhappy ({int(self.happiness)})', sub: rep ? 'Get them a better deal or invest in their career' : 'Put your best people on it', action: rep ? 'careerPlan' : 'starTeam', priority: 1, tone: 'bad' },
    { id: 'overloaded', when: "player.load > 1.05", text: `Your ${L.staffs} are overloaded`, sub: `Hire, or let a ${L.client} go`, action: 'hireStaff', priority: 1, tone: 'warn' }
  ];

  /* ---------------- interface ---------------- */
  const scr = C.standardScreens({
    goal: gdl.meta.goal, primary: ['signClient', 'hireStaff'],
    homeSubtitle: '{player.clientCount} ' + L.clients + ' · ' + (rep ? '{money(player.commissionYear)} a year in commission' : '{money(player.commissionYear)} a year in fees'),
    metrics: [{ label: rep ? 'Commission / yr' : 'Fees / yr', expr: 'player.commissionYear', format: 'money' }, { label: 'Cash', expr: 'player.cash', format: 'money' }, { label: 'Client happiness', expr: 'player.happy', format: 'score' }, { label: 'Reputation', expr: 'player.reputation', format: 'score', explain: 'resource:reputation' }],
    signature: [{ type: 'cards', title: 'Your ' + L.clients, width: 'full', kind: 'client', owner: 'player', sort: rep ? 'it.deal + it.endorse' : 'it.deal', size: 'm', glyph: rep ? "'person'" : "'building'", glyphScale: '0.36', glyphColor: "it.happiness >= 60 ? 'var(--good)' : it.happiness < 40 ? 'var(--bad)' : 'var(--accent)'", badge: rep ? "{it.free ? 'Free agent' : it.expiring ? 'Expiring' : it.role}" : '{it.role}', badgeTone: "it.free || it.expiring ? 'warn' : 'info'",
      stats: rep ? [{ label: 'Contract / yr', expr: 'it.deal', format: 'money' }, { label: 'Market value', expr: 'it.value', format: 'money' }, { label: 'Fame', expr: 'it.fame', format: 'score' }, { label: 'Happiness', expr: 'it.happiness', format: 'score', tone: "v < 40 ? 'bad' : v > 65 ? 'good' : ''" }] : [{ label: 'Fees / yr', expr: 'it.deal', format: 'money' }, { label: 'Results', expr: 'it.results', format: 'score' }, { label: 'Happiness', expr: 'it.happiness', format: 'score', tone: "v < 40 ? 'bad' : v > 65 ? 'good' : ''" }],
      actions: rep ? ['takeBestOffer', 'careerPlan'] : ['starTeam', 'raiseFees'], empty: `No ${L.clients} yet.` }]
  });
  scr.clients = { title: Cls, subtitle: `{player.clientCount} of {player.capacity} capacity · workload {pct(player.load)}`, actions: ['signClient', 'hireStaff'],
    tabs: [{ id: 'roster', label: 'Your ' + L.clients, sections: [{ type: 'table', title: 'Roster', width: 'full', kind: 'client', owner: 'player', sort: 'it.deal', search: true, key: 'roster',
        columns: rep ? [{ label: Cl, expr: 'it.name' }, { label: 'Role', expr: 'it.role', format: 'text' }, { label: 'Age', expr: 'it.age', format: 'int' }, { label: 'Ability (est.)', expr: "est(it, 'ability').value", format: 'score' }, { label: 'Fame', expr: 'it.fame', format: 'score' }, { label: 'Contract / yr', expr: 'it.deal', format: 'money' }, { label: 'Ends', expr: "it.free ? 'Free' : int((it.dealUntil - time.tick) / 52 * 10) / 10 + ' yrs'", format: 'text' }, { label: 'Happiness', expr: 'it.happiness', format: 'score', tone: "v < 40 ? 'bad' : ''" }]
          : [{ label: Cl, expr: 'it.name' }, { label: 'Sector', expr: 'it.role', format: 'text' }, { label: 'Budget', expr: 'it.value', format: 'money' }, { label: 'Fees / yr', expr: 'it.deal', format: 'money' }, { label: 'Results', expr: 'it.results', format: 'score' }, { label: 'Happiness', expr: 'it.happiness', format: 'score', tone: "v < 40 ? 'bad' : ''" }],
        rowActions: rep ? ['takeBestOffer', 'negotiateDeal', 'pitchEndorsement', 'careerPlan', 'releaseClient'] : ['renewAccount', 'raiseFees', 'starTeam', 'releaseClient'] },
      { type: 'histogram', title: rep ? 'Roster by age' : 'Accounts by happiness', width: 'half', kind: 'client', owner: 'player', expr: rep ? 'it.age' : 'it.happiness', bins: rep ? [18, 22, 26, 30, 34, 38, 45] : [0, 20, 40, 55, 70, 85], tone: rep ? `v >= ${L.careerPeak + 4} ? 'warn' : 'good'` : "v < 40 ? 'bad' : v >= 70 ? 'good' : ''" },
      { type: 'mix', title: rep ? 'Earnings by role' : 'Fees by sector', width: 'half', kind: 'client', owner: 'player', groupBy: 'it.role', weight: 'it.deal', format: 'money', centerLabel: rep ? 'contracts / yr' : 'fees / yr' }] },
      { id: 'prospects', label: rep ? 'Prospects' : 'New business', sections: [{ type: 'table', title: rep ? 'Unrepresented ' + L.clients : 'Prospective clients', width: 'full', kind: 'client', filter: "!it.owner && it.status == 'active'", sort: rep ? "est(it, 'ability').value" : 'it.value', search: true, limit: 25,
        columns: rep ? [{ label: Cl, expr: 'it.name' }, { label: 'Role', expr: 'it.role', format: 'text' }, { label: 'Age', expr: 'it.age', format: 'int' }, { label: 'Ability (est.)', expr: "est(it, 'ability').value", format: 'score' }, { label: 'Fame', expr: 'it.fame', format: 'score' }, { label: 'Market value', expr: 'it.value', format: 'money' }] : [{ label: Cl, expr: 'it.name' }, { label: 'Sector', expr: 'it.role', format: 'text' }, { label: 'Budget', expr: 'it.value', format: 'money' }, { label: 'Profile', expr: 'it.fame', format: 'score' }] }] }]
      .concat(rep ? [{ id: 'buyers', label: cap(L.buyers), sections: [{ type: 'table', title: cap(L.buyers), width: 'full', kind: 'buyer', sort: 'it.budget', columns: [{ label: cap(L.buyer), expr: 'it.name' }, { label: 'Spending room', expr: 'it.budget', format: 'money' }, { label: 'Needs', expr: 'it.need', format: 'text' }, { label: 'Prestige', expr: 'it.prestige', format: 'score' }] }] }] : []) };
  scr.company.title = 'Agency'; scr.company.actions = ['hireStaff'].concat(rep ? [] : ['invest'], ['borrow', 'repay']);
  gdl.ui = { topbar: [{ label: 'Cash', expr: 'player.cash', format: 'money' }, { label: rep ? 'Commission / yr' : 'Fees / yr', expr: 'player.commissionYear', format: 'money' }, { label: 'Reputation', expr: 'player.reputation', format: 'score', explain: 'resource:reputation' }],
    nav: [{ id: 'home', label: 'Overview', icon: 'home' }, { id: 'clients', label: Cls, icon: 'users' }, { id: 'company', label: 'Agency', icon: 'bank' }, { id: 'industry', label: 'Industry', icon: 'globe' }],
    screens: scr };
  gdl.theme = C.theme(L.motif, { logo: { text: title.split(/\s+/).map(w => w[0]).join('').slice(0, 2) } });
  gdl.onboarding = C.onboarding({ title: 'Welcome, ' + gdl.meta.role.toLowerCase(), text: rep ? `{player.name} represents three young ${L.clients}. Sign better ones, get them paid, and keep them happy.` : `{player.name} has two ${L.clients}. Win more business, do great work, and grow your fees.`,
    bullets: rep ? [{ icon: 'handshake', title: 'Sign talent', text: 'Ability is hidden; fame is not. Young players grow; veterans decline.' }, { icon: 'bank', title: 'Win the negotiation', text: `Your commission is ${Math.round(L.commission * 100)}% of every deal you close.` }, { icon: 'users', title: 'Keep them happy', text: 'Unhappy clients get poached.' }]
      : [{ icon: 'handshake', title: 'Win the pitch', text: 'Reputation and craft decide who wins new business.' }, { icon: 'users', title: 'Capacity matters', text: 'Overloaded teams deliver worse work.' }, { icon: 'up', title: 'Grow accounts', text: 'Happy clients spend more.' }],
    primaryAction: { id: 'signClient', label: rep ? 'Sign a client' : 'Pitch' }, primaryNav: 'clients', unitNoun: L.clients });
  gdl.newGame = { options: [{ id: 'name', label: 'Agency name', type: 'text', default: gdl.orgs.player.name }] };
  gdl.glossary = [{ term: 'Capacity', text: `How many ${L.clients} your ${L.staffs} can handle well.` }, { term: 'Happiness', text: 'Clients compare what they get with what they expect; unhappy clients leave.' }].concat(rep ? [{ term: 'Market value', text: 'What a ' + L.buyer + ' would pay per year, driven by ability, fame and form.' }, { term: 'Commission', text: `Your share of every contract (${Math.round(L.commission * 100)}%).` }] : [{ term: 'Results', text: 'The quality of your recent work for that client — driven by your craft and workload.' }]);
  gdl.balance = { knobs: [{ path: 'params.prospectFlow', label: 'New prospects', effect: 'easier', min: 0.1, max: 1 }, { path: 'params.staffCost', label: 'Staff costs', effect: 'harder', min: 1000, max: 30000 }, { path: 'params.poachRate', label: 'Rival poaching', effect: 'harder', min: 0.3, max: 3, phase: 'late' }], targets: { smartMargin: [0.03, 0.35], maxGrowth: 10 } };
  gdl.meta.howToPlay = rep ? `Each turn is a week. Sign ${L.clients} from the Prospects list — ability is an estimate, fame is visible, and younger players improve. When contracts end, negotiate with ${L.buyers} (or take the best offer); you earn ${Math.round(L.commission * 100)}% commission on every deal and a share of endorsements. Keep clients happy or rivals will poach them. Hire ${L.staffs} to grow your capacity.`
    : `Each turn is a week. Pitch for new ${L.clients}; your reputation and craft decide the odds. Every client pays fees and needs your teams' attention — overloaded teams deliver weaker results, and unhappy clients put their business up for review. Grow fees with great work, invest in craft, and hire as you grow.`;
  return gdl;
}

const FEATURES = [
  { id: 'clients', label: 'Clients with hidden ability, fame, ambition and loyalty', keywords: ['client', 'clients', 'athletes', 'athlete', 'sign', 'roster', 'talent', 'accounts', 'careers', 'career'], paths: ['kinds.client', 'actions.signClient'] },
  { id: 'deals', label: 'Contract negotiations', keywords: ['contract', 'contracts', 'negotiate', 'negotiation', 'negotiations', 'deal', 'deals', 'fees', 'salary'], paths: ['negotiations'] },
  { id: 'endorsements', label: 'Endorsements and brand deals', keywords: ['endorsement', 'endorsements', 'sponsor', 'sponsorship', 'brand deals'], paths: ['actions.pitchEndorsement'], flag: 'endorsements' },
  { id: 'rivals', label: 'Rival agencies that poach unhappy clients', keywords: ['rival', 'rivals', 'competition', 'competitors', 'poach', 'rival agencies'], paths: ['orgs.rivals', 'events.poached'], flag: 'poaching' },
  { id: 'reputation', label: 'Reputation and client relationships', keywords: ['reputation', 'relationships', 'relationship', 'loyalty'], paths: ['resources.reputation'] },
  { id: 'capacity', label: 'Staff capacity and workload', keywords: ['staff', 'agents', 'hire', 'team', 'capacity'], paths: ['actions.hireStaff', 'policies.workload'] },
  { id: 'scandals', label: 'Scandals and crises', keywords: ['scandal', 'scandals', 'crisis', 'pr'], paths: ['events.scandal'], flag: 'scandals' },
  { id: 'history', label: 'History, records and awards', keywords: ['history', 'records', 'legacy', 'hall of fame'], paths: ['history'] }
];
module.exports = { id: 'agency', loop: 'client-agency', genres: Object.keys(LEX).filter(k => k !== 'generic'), build, FEATURES, LEX };
