/* Archetype: DEAL & PORTFOLIO (capital allocation).
   Venture capital, private equity, incubators, holding companies. The player runs an investment
   firm: raise funds from LPs, source deals from a living market of companies, negotiate terms,
   support or fix the portfolio, and exit through sales and IPOs. Two modes:
     minority (VC / incubator): many small stakes, power-law outcomes, follow-on decisions;
     control  (PE / holding co.): buy whole companies with leverage, improve operations, exit.
   Companies evolve monthly on their own (growth, burn, margins, fundraising, failure), so the
   portfolio tells stories whether or not the player intervenes. */
'use strict';
const C = require('../common');

const SECTORS = [
  { id: 'software', name: 'Software', growthBase: 0.55, marginMature: 0.24, multiple: 7, vol: 0.25, glyph: 'chart' },
  { id: 'fintech', name: 'Fintech', growthBase: 0.6, marginMature: 0.2, multiple: 6, vol: 0.3, glyph: 'chart' },
  { id: 'health', name: 'Health & bio', growthBase: 0.45, marginMature: 0.18, multiple: 6, vol: 0.38, glyph: 'star' },
  { id: 'consumer', name: 'Consumer', growthBase: 0.45, marginMature: 0.1, multiple: 2.5, vol: 0.3, glyph: 'ticket' },
  { id: 'climate', name: 'Climate & energy', growthBase: 0.5, marginMature: 0.12, multiple: 4, vol: 0.35, glyph: 'tower' },
  { id: 'industrial', name: 'Industrial', growthBase: 0.18, marginMature: 0.15, multiple: 1.8, vol: 0.15, glyph: 'building' },
  { id: 'media', name: 'Media & gaming', growthBase: 0.35, marginMature: 0.15, multiple: 3, vol: 0.28, glyph: 'film' },
  { id: 'ai', name: 'AI infrastructure', growthBase: 0.9, marginMature: 0.22, multiple: 11, vol: 0.45, glyph: 'chart' }
];
const LEX = {
  'venture-capital': { mode: 'minority', title: 'Power Law', tagline: 'Back the outliers. Survive the rest.', org: 'Venture firm', orgs: 'Venture firms', unit: 'portfolio company', units: 'portfolio companies', fund: 100e6, motif: 'deal-room', award: 'Investor of the Year',
    rivals: ['Sandhill Partners', 'Northbeam Ventures', 'Foundry Row Capital', 'Lattice Ventures', 'Blue Meridian', 'First Light Capital', 'Kestrel Partners', 'Archway Ventures'],
    verbs: ['Win a hot deal against bigger firms', 'Back a founder everyone else passed on', 'Watch a seed check become a unicorn', 'Decide who gets your last follow-on dollars', 'Raise a bigger fund on your track record'] },
  'startup-incubator': { mode: 'minority', title: 'Demo Day', tagline: 'Pick the founders. Build the companies. Ring the bell.', org: 'Incubator', orgs: 'Incubators', unit: 'startup', units: 'startups', fund: 40e6, motif: 'blueprint', award: 'Incubator of the Year',
    rivals: ['Launchpad Labs', 'Garage Nine', 'Ignite Collective', 'Seedling & Co.', 'Northbound Studio', 'Atlas Foundry'], verbs: ['Pick founders before anyone else sees them', 'Coach a team through its first crisis', 'Fill a demo day with real traction'] },
  'private-equity': { mode: 'control', title: 'Leverage', tagline: 'Buy it. Fix it. Sell it. Mind the debt.', org: 'Buyout firm', orgs: 'Buyout firms', unit: 'portfolio company', units: 'portfolio companies', fund: 600e6, motif: 'ledger', award: 'Deal of the Year',
    rivals: ['Granite Peak Capital', 'Harborline Partners', 'Whitmore & Vale', 'Ironbridge Equity', 'Summit Ridge Partners', 'Calder Lane Capital', 'Oakmont Holdings'],
    verbs: ['Win an auction for a hidden gem', 'Turn around a tired business', 'Time an exit into a hot market', 'Survive a rate shock with leverage on the books', 'Raise a megafund'] },
  'billionaire-conglomerate': { mode: 'control', title: 'Holding Company', tagline: 'Allocate capital like a legend.', org: 'Holding company', orgs: 'Holding companies', unit: 'subsidiary', units: 'subsidiaries', fund: 400e6, motif: 'editorial', award: 'Capital Allocator of the Year',
    rivals: ['Crestmoor Holdings', 'Valence Group', 'Ashby Industries', 'Kingsway Capital', 'Halvorsen & Sons'], verbs: ['Buy wonderful businesses at fair prices', 'Hold forever — or sell at the top', 'Build a portfolio that outlasts you'] },
  generic: { mode: 'minority', title: 'Capital Allocator', tagline: 'Pick winners. Manage risk. Compound.', org: 'Investment firm', orgs: 'Investment firms', unit: 'holding', units: 'holdings', fund: 150e6, motif: 'deal-room', award: 'Firm of the Year',
    rivals: ['Atlas Capital', 'Northstar Partners', 'Beacon Investments', 'Summit Capital'], verbs: ['Pick winners', 'Raise bigger funds', 'Beat the market'] }
};
const cap = (s) => s[0].toUpperCase() + s.slice(1);
/* Rival firms start with their own holdings (created for them, since the market of companies is
   generated after the firms exist). */
function rivalHoldings(n, control) {
  return [{ op: 'each', list: `[${Array.from({ length: n }, (_, i) => i).join(', ')}]`, do: [
    { op: 'create', kind: 'company', as: 'c', set: { sector: "pick(all('sector')).id", founded: '-randInt(6, 120)' } },
    { op: 'set', path: 'c.quality', value: 'clamp(randn(54, 15), 5, 98)' },
    { op: 'set', path: 'c.revenue', value: control ? 'rand(15M, 150M)' : 'pow(10, rand(5.5, 7.6))' },
    { op: 'set', path: 'c.growth', value: control ? 'rand(0.02, 0.2)' : 'rand(0.3, 1.4)' },
    { op: 'set', path: 'c.margin', value: control ? 'rand(0.05, 0.22)' : 'rand(-2, -0.3)' },
    { op: 'set', path: 'c.cash', value: control ? 'rand(1M, 8M)' : 'rand(1M, 10M)' },
    { op: 'set', path: 'c.stake', value: control ? '1' : 'rand(0.1, 0.25)' },
    { op: 'set', path: 'c.debt', value: control ? 'max(0, c.revenue * c.margin) * 3' : '0' },
    { op: 'set', path: 'c.invested', value: control ? 'c.equity * 0.85' : 'c.valuation * c.stake * 0.7' },
    { op: 'set', path: 'c.acquiredAt', value: '-randInt(6, 48)' }
  ] }];
}

function build(opts = {}) {
  const genre = LEX[opts.genre] ? opts.genre : (opts.genre === 'hedge-fund' || opts.genre === 'auction-house' || opts.genre === 'luxury-conglomerate' ? 'billionaire-conglomerate' : 'generic');
  const L = Object.assign({}, LEX[genre], opts.lexicon || {});
  const control = L.mode === 'control';
  const f = Object.assign({ acquisitions: true, recessions: true, lps: true, antiPortfolio: true, operations: true }, opts.features || {});
  const title = opts.title || L.title;
  const U = cap(L.unit), Us = cap(L.units);
  const fundM = Math.round(L.fund / 1e6);
  const gdl = {
    gdl: 1,
    meta: { id: opts.id || genre + '-portfolio', version: 1, title, tagline: L.tagline, genre: opts.genre || genre, role: opts.role || (control ? 'Managing Partner' : 'General Partner'), fantasy: L.verbs,
      pillars: ['Capital is the scarce resource: every check is an opportunity cost', 'Companies live their own lives — you influence, you do not control the market', 'Returns are judged by your LPs, in cash, over years'], universe: 'fictional',
      disclaimer: 'All companies, founders, funds and investors are fictional. Market behavior is simplified and illustrative, not investment advice.',
      goal: control ? 'Turn {player.name}\'s fund into a top-quartile track record: buy well, improve, exit, and raise bigger funds.' : 'Build {player.name} into a legendary firm: back the outliers, manage the follow-ons, return real cash to your LPs.' },
    time: { unit: 'month', start: '2026-01-01' }, currency: { symbol: '$' }, warmup: 18,
    params: { dealFlow: control ? 0.1 : 0.3, startCompanies: control ? 55 : 80, feePct: 0.02, exitPremium: 1.25, failRate: 1, teamCost: 55000 },
    finance: { baseRate: '0.05', creditLimit: 'max(5000000, org.committed * 0.1)' },
    world: {
      cycle: C.cycle({ boom: 1.04, bust: 0.88, recession: f.recessions, perYear: 12, news: { expansion: 'Risk-on: valuations are rising and exits are easy', recession: 'Risk-off: valuations crash and the IPO window slams shut', slowdown: 'Investors grow cautious; rounds take longer to close', recovery: 'Capital is flowing again' } }),
      vars: [
        { id: 'sentiment', label: 'Valuation sentiment', format: 'x', start: 1, process: { type: 'meanRevert', mean: 1, vol: 0.03, speed: 0.06, min: 0.45, max: 1.9, phase: { expansion: 1.12, slowdown: 0.95, recession: 0.7, recovery: 0.92 } },
          explain: 'How richly the market prices companies relative to normal. Drives entry prices, exit values and whether rounds get done.' },
        { id: 'rates', label: 'Interest rates', format: 'pct1', start: 0.045, process: { type: 'meanRevert', mean: 0.045, vol: 0.002, speed: 0.04, min: 0.005, max: 0.14, phase: { recession: 0.8, expansion: 1.05 } },
          shocks: [{ id: 'rateShock', label: 'Rate shock', chance: 0.006, size: 1.6, duration: 18, news: 'Central banks shock markets with a sharp rate hike', event: control ? 'rateShock' : undefined }] },
        { id: 'ipoWindow', label: 'IPO window', format: 'pct', start: 0.6, process: { type: 'formula', expr: 'clamp(world.ipoWindow * 0.8 + clamp((world.sentiment - 0.85) * 1.6, 0, 1) * 0.2, 0, 1)' }, explain: 'How open public markets are to new listings.' }
      ]
    },
    resources: [{ id: 'reputation', label: 'Reputation with founders', format: 'score', start: 40, min: 0, max: 100, base: '35', speed: 0.04, describe: 'Whether the best founders and sellers want you on their cap table.',
      drivers: [{ label: 'Great exits', expr: 'min(25, log(1 + org.bestExit / 50M) * 8)' }, { label: 'Founder support', expr: 'org.supportLevel * 6' }, { label: 'Write-offs', expr: '-min(15, org.writeOffs * 1.5)' }, { label: 'Firm size', expr: 'log(1 + org.committed / 100M) * 4' }] }],
    kinds: {
      sector: { label: 'Sector', plural: 'Sectors', records: SECTORS.map(s => Object.assign({ heat: 1 }, s)),
        fields: { growthBase: { type: 'pct', label: 'Typical growth' }, marginMature: { type: 'pct', label: 'Mature margin' }, multiple: { type: 'number', label: 'Revenue multiple' }, vol: { type: 'number', label: 'Volatility' }, heat: { type: 'number', label: 'Heat', default: 1 }, glyph: 'text' },
        tick: [
          { op: 'set', path: 'self.heat', value: 'clamp(self.heat + (1 - self.heat) * 0.06 + randn(0, 0.05 + self.vol * 0.05), 0.5, 2.2)' },
          { op: 'chance', p: 'params.dealFlow * self.heat * world.demand', then: [
            { op: 'create', kind: 'company', as: 'c', owner: "'none'", set: { sector: 'self', founded: 'time.tick' } },
            { op: 'set', path: 'c.quality', value: 'clamp(randn(52, 16), 5, 98)' },
            { op: 'set', path: 'c.revenue', value: control ? 'rand(15M, 120M)' : 'rand(0.05M, 0.6M)' },
            { op: 'set', path: 'c.growth', value: control ? 'self.growthBase * rand(0.2, 0.6)' : 'self.growthBase * rand(1.2, 2.6)' },
            { op: 'set', path: 'c.margin', value: control ? 'self.marginMature * rand(0.4, 1.1)' : '-rand(1.5, 3)' },
            { op: 'set', path: 'c.cash', value: control ? 'c.revenue * 0.05' : 'rand(0.15M, 0.5M)' },
            { op: 'set', path: 'c.raising', value: 'true' }, { op: 'set', path: 'c.raiseOpened', value: 'time.tick' },
            { op: 'set', path: 'c.raiseAmount', value: control ? '0' : 'rand(1M, 3M)' }
          ] },
          { op: 'each', list: "filter(all('company'), it.sector == outer.self && it.status != 'active' && time.tick - it.ended > 36 && !it.keep)", do: [{ op: 'remove', target: 'it' }] }
        ],
        display: { title: '{self.name}', subtitle: 'Heat ×{num(self.heat)} · {pct(self.growthBase)} typical growth', glyph: 'self.glyph' } },
      company: {
        label: U, plural: Us, idPrefix: 'co',
        name: { template: '{pick(["Nova","Lumen","Quanta","Helio","Brightpath","Kinetic","Arbor","Cobalt","Vantage","Parallax","Sable","Tidal","Orbit","Fathom","Juniper","Halcyon","Monarch","Ridgeline","Verity","Cinder","Zephyr","Atlas","Northwind","Ember"])}{pick(["", "", " Labs", " AI", " Health", " Systems", " Works", " Bio", " Pay", " Energy", " Robotics", " Logistics"])}' },
        fields: {
          sector: { type: 'ref', ref: 'sector' }, stage: { type: 'text', default: 'Seed' }, revenue: { type: 'money', label: 'Revenue run-rate', default: 300000 }, growth: { type: 'pct', label: 'Growth (annual)', default: 0.8 }, margin: { type: 'pct', label: 'Margin', default: -2 },
          quality: { type: 'number', label: 'Team & product', hidden: true, noise: 16, default: 50 }, cash: { type: 'money', label: 'Company cash', default: 300000 }, debt: { type: 'money', label: 'Company debt', default: 0 },
          stake: { type: 'pct', label: 'Your ownership', default: 0 }, invested: { type: 'money', label: 'Invested', default: 0 }, raising: { type: 'bool', default: false }, raiseAmount: { type: 'money', label: 'Round size', default: 0 },
          status: { type: 'text', default: 'active' }, founded: 'int', raiseOpened: { type: 'int', default: 0 }, ended: 'int', exitValue: { type: 'money', default: 0 }, boardSeat: { type: 'bool', default: false }, opsBoost: { type: 'pct', default: 0 }, keep: { type: 'bool', default: false }, acquiredAt: 'int'
        },
        derived: {
          valuation: control ? 'max(5M, max(self.revenue * self.margin, 0) * 9 * world.sentiment * self.sector.heat * (1 + clamp(self.growth, -0.2, 0.6)) + self.revenue * 0.25)' : 'max(1.2M + self.quality * 30k, self.revenue * self.sector.multiple * world.sentiment * self.sector.heat * (1 + clamp(self.growth, -0.4, 2) * 1.6))',
          equity: 'max(0, self.valuation + self.cash * 0.5 - self.debt)', ebitda: 'self.revenue * self.margin',
          burn: 'max(0, -self.revenue * self.margin / 12) + self.debt * world.rates / 12',
          runway: 'self.burn > 1 ? max(0, self.cash) / self.burn : 99',
          moic: 'self.invested > 0 ? self.equity * self.stake / self.invested : 0',
          holdValue: 'self.equity * self.stake'
        },
        tickWhen: "self.status == 'active'",
        tick: [
          { op: 'set', path: 'self.growth', value: 'clamp(self.growth * 0.986 + (self.quality - 55) * 0.0003 + (self.sector.heat - 1) * 0.003 - log(1 + self.revenue / 40M) * 0.003 + randn(0, self.sector.vol * 0.025), -0.5, 3)' },
          { op: 'set', path: 'self.revenue', value: 'max(20k, self.revenue * (1 + self.growth / 12 + (world.demand - 1) * 0.03))' },
          { op: 'set', path: 'self.margin', value: 'clamp(self.margin + (self.sector.marginMature + self.opsBoost - 2.6 * exp(-self.revenue / 9M) + (self.quality - 55) * 0.002 - self.margin) * 0.05, -4, 0.6)' },
          { op: 'set', path: 'self.cash', value: 'self.cash + self.revenue * self.margin / 12 - self.debt * world.rates / 12' },
          { op: 'set', path: 'self.stage', value: "self.revenue < 1M ? 'Seed' : self.revenue < 6M ? 'Series A' : self.revenue < 25M ? 'Series B' : self.revenue < 90M ? 'Growth' : 'Mature'" },
          // needs money → opens a round
          { op: 'if', cond: '!self.raising && self.runway < 7 && self.burn > 0', then: [{ op: 'set', path: 'self.raising', value: 'true' }, { op: 'set', path: 'self.raiseOpened', value: 'time.tick' }, { op: 'set', path: 'self.raiseAmount', value: 'max(1M, self.burn * 24)' }] },
          // the outside market funds some rounds (dilutes the owner); otherwise the company may die
          { op: 'if', cond: 'self.raising && self.raiseAmount > 0 && self.runway < 2', then: [
            { op: 'chance', p: 'clamp(0.22 * world.sentiment * self.sector.heat * (self.quality / 55) * (self.growth > 0.2 ? 1.2 : 0.6), 0.02, 0.6)', then: [
              { op: 'set', path: 'self.stake', value: 'self.stake * self.valuation / (self.valuation + self.raiseAmount)' },
              { op: 'set', path: 'self.cash', value: 'self.cash + self.raiseAmount' }, { op: 'set', path: 'self.raising', value: 'false' }
            ] }
          ] },
          { op: 'if', cond: 'self.cash < -self.burn * 1.5 * params.failRate && self.burn > 0', then: [
            { op: 'set', path: 'self.status', value: "'failed'" }, { op: 'set', path: 'self.ended', value: 'time.tick' },
            { op: 'if', cond: 'self.owner && isPlayer(self.owner)', then: [{ op: 'news', text: '{self.name} shuts down — {money(self.invested)} written off', always: true }, { op: 'set', path: 'player.writeOffs', value: 'player.writeOffs + 1' }, { op: 'resource', id: 'reputation', add: '-1' }] },
            { op: 'if', cond: 'self.owner', then: [{ op: 'set', path: 'self.owner.writeOffs', value: 'self.owner.writeOffs + (isPlayer(self.owner) ? 0 : 1)' }, { op: 'set', path: 'self.owner', value: 'null' }] }
          ] },
          // unowned companies sometimes exit on their own (keeps the market moving)
          { op: 'if', cond: '!self.owner && self.revenue > 20M', then: [{ op: 'chance', p: '0.006 * world.sentiment', then: [{ op: 'set', path: 'self.status', value: "'exited'" }, { op: 'set', path: 'self.ended', value: 'time.tick' }, { op: 'set', path: 'self.exitValue', value: 'self.valuation' }] }] }
        ],
        explain: { title: 'Why {self.name} is worth what it is', drivers: [{ label: 'Revenue run-rate', expr: 'self.revenue' }, { label: 'Growth', expr: 'self.growth * 100' }, { label: 'Margin', expr: 'self.margin * 100' }, { label: 'Sector heat ×100', expr: 'self.sector.heat * 100' }, { label: 'Market sentiment ×100', expr: 'world.sentiment * 100' }, { label: 'Months of runway', expr: 'min(99, self.runway)' }, { label: 'Debt', expr: 'self.debt' }] },
        display: { title: '{self.name}', subtitle: '{self.sector.name} · {self.stage} · {money(self.revenue)} revenue', glyph: 'self.sector.glyph', stats: [{ label: 'Value', expr: 'self.valuation', format: 'money' }, { label: 'Growth', expr: 'self.growth', format: 'pct' }] }
      },
      lp: { label: 'Limited partner', plural: 'Limited partners', records: [
        { id: 'pension', name: 'State Teachers Pension', appetite: 1.0, kind: 'Pension' }, { id: 'endow', name: 'Northfield University Endowment', appetite: 1.15, kind: 'Endowment' },
        { id: 'sovereign', name: 'Gulf Horizon Sovereign Fund', appetite: 1.3, kind: 'Sovereign wealth' }, { id: 'family', name: 'Halloran Family Office', appetite: 0.9, kind: 'Family office' },
        { id: 'fof', name: 'Keystone Fund of Funds', appetite: 1.05, kind: 'Fund of funds' }],
        fields: { appetite: 'number', kind: 'text' }, display: { title: '{self.name}', subtitle: '{self.kind}' } }
    },
    orgs: {
      label: L.org, plural: L.orgs,
      fields: { committed: { type: 'money', default: L.fund }, fundNo: { type: 'int', default: 1 }, lastFund: { type: 'int', default: 0 }, partners: { type: 'int', default: control ? 3 : 2 }, distributed: { type: 'money', default: 0 }, realized: { type: 'money', default: 0 },
        bestExit: { type: 'money', default: 0 }, writeOffs: { type: 'int', default: 0 }, feePct: { type: 'pct', default: 0.02 }, supportLevel: { type: 'number', default: 1 }, exits: { type: 'int', default: 0 }, reserve: { type: 'pct', default: 0.3 } },
      metrics: [
        { id: 'nav', label: 'Portfolio value (NAV)', expr: "sum(owned('company', org), it.holdValue)", format: 'money' },
        { id: 'holdings', label: Us, expr: "count(owned('company', org))", format: 'int' },
        { id: 'investedNow', label: 'Cost of current holdings', expr: "sum(owned('company', org), it.invested)", format: 'money' },
        { id: 'tvpi', label: 'TVPI', expr: '(org.cash + org.nav + org.distributed) / max(1, org.committed)', format: 'x', describe: 'Total value to paid-in: (cash + portfolio value + distributions) ÷ committed capital.' },
        { id: 'dpi', label: 'DPI', expr: 'org.distributed / max(1, org.committed)', format: 'x', describe: 'Cash actually returned to LPs ÷ committed capital.' },
        { id: 'deployed', label: 'Capital deployed', expr: 'clamp(1 - org.cash / max(1, org.committed), 0, 1.5)', format: 'pct' },
        { id: 'capacity', label: 'Partner capacity', expr: `org.partners * ${control ? 3 : 7}`, format: 'int' },
        { id: 'avgMoic', label: 'Average multiple', expr: "avg(owned('company', org), it.moic)", format: 'x' },
        { id: 'winners', label: 'Holdings above 3×', expr: "count(owned('company', org), it.moic >= 3)", format: 'int' }
      ],
      valuation: 'max(0, org.cash + org.nav - org.debt)',
      assets: 'org.nav',
      income: [{ label: 'Management fees', expr: 'org.committed * org.feePct / 12' }],
      costs: [{ label: 'Partners & team', expr: 'params.teamCost * org.partners + 40000 + org.committed * 0.0006' }],
      player: { name: control ? 'Ashgrove Capital' : 'Lighthouse Ventures', cash: String(L.fund), set: { committed: String(L.fund) },
        start: control ? [] : [{ op: 'each', list: "top(filter(all('company'), it.status == 'active' && !it.owner && it.revenue < 1.5M), it.quality + randn(0, 25), 3)", do: [{ op: 'transfer', target: 'it', to: 'org' }, { op: 'set', path: 'it.stake', value: '0.12' }, { op: 'set', path: 'it.invested', value: 'it.valuation * 0.12' }, { op: 'cash', amount: '-it.valuation * 0.12', category: 'Investments', capex: true }, { op: 'set', path: 'it.boardSeat', value: 'true' }] }] },
      rivals: { count: { full: 4, light: 3, background: 10 }, aiEvery: 2, entryChance: '0.15', maxActive: 10, failGrace: 6, backgroundValue: String(L.fund * 2),
        fixed: L.rivals.slice(0, 7).map((n, i) => ({ name: n, archetype: ['aggressive', 'disciplined', 'aggressive', 'disciplined'][i % 4] })),
        archetypes: [
          { id: 'aggressive', label: control ? 'Megafund' : 'Spray and pray', risk: 0.7, tempo: 2, color: '#b5651d', cash: String(L.fund * 2.5), set: { committed: String(L.fund * 2.5), partners: control ? '5' : '4' }, weights: { [control ? 'buyCompany' : 'joinRound']: 1.6 },
            start: rivalHoldings(control ? 3 : 8, control) },
          { id: 'disciplined', label: control ? 'Operator' : 'Concentrated', risk: 0.4, tempo: 1, color: '#2c5e8f', cash: String(L.fund * 1.6), set: { committed: String(L.fund * 1.6), partners: '3' }, weights: { [control ? 'operationsPlan' : 'followOn']: 1.4 },
            start: rivalHoldings(control ? 2 : 5, control) }
        ] }
    }
  };
  const k = gdl.kinds.company;
  k.generate = { count: 'params.startCompanies', set: control ? {
    sector: "pick(all('sector')).id", quality: 'clamp(randn(52, 16), 5, 98)', revenue: 'rand(12M, 180M)', growth: 'rand(0.02, 0.2)', margin: 'rand(0.04, 0.24)', cash: 'rand(1M, 10M)', founded: '-randInt(60, 400)', stage: "'Growth'"
  } : {
    sector: "pick(all('sector')).id", quality: 'clamp(randn(52, 16), 5, 98)', revenue: 'pow(10, rand(4.8, 7.6))', growth: 'rand(0.3, 1.6)', margin: 'rand(-2.5, -0.2)', cash: 'rand(0.3M, 6M)', founded: '-randInt(3, 80)', raising: 'chance(0.4)', raiseAmount: 'rand(1M, 12M)', raiseOpened: '0'
  } };

  /* ---------------- actions ---------------- */
  const capacityOk = "count(owned('company', org)) < org.capacity";
  gdl.actions = [];
  if (!control) {
    gdl.actions.push(
      { id: 'joinRound', label: 'Invest in a round', verb: 'Invest', category: 'deals', icon: 'plus', primary: true,
        describe: 'Take part in a company\'s open round on the terms offered. Fast and certain — but you pay the asking price.', tradeoff: 'Every dollar here is a dollar you cannot use for follow-ons in your winners.', risk: 'Most early-stage companies fail. Team quality is only an estimate until you sit on the board.',
        params: [{ id: 'company', label: 'Company', type: 'entity', kind: 'company', filter: "it.status == 'active' && !it.owner && it.raising && it.raiseAmount > 0", sort: "est(it, 'quality').value * (1 + it.growth) * it.sector.heat" },
          { id: 'share', label: 'Your part of the round', type: 'choice', default: '1', aiValue: '1', options: [{ value: 0.5, label: 'Half — co-invest', describe: 'Smaller stake, no board seat' }, { value: 1, label: 'Lead it all', describe: 'Board seat; full round' }] }],
        vars: { amt: 'param.company.raiseAmount * param.share', post: 'param.company.valuation + param.company.raiseAmount' },
        requires: [{ expr: 'org.cash >= amt', msg: 'Not enough dry powder' }, { expr: capacityOk, msg: 'Your partners are at capacity — hire a partner first' }],
        cost: { cash: 'amt' }, costCategory: 'Investments', capex: true,
        preview: [{ label: 'Pre-money valuation', expr: 'param.company.valuation', format: 'money' }, { label: 'Your ownership after the round', expr: 'amt / post', format: 'pct1' }, { label: 'Team & product (estimate)', expr: "est(param.company, 'quality').value", format: 'score' }, { label: 'Growth', expr: 'param.company.growth', format: 'pct' }, { label: 'Months of runway after the round', expr: '(param.company.cash + param.company.raiseAmount) / max(1, param.company.burn)', format: 'int' }],
        effects: [{ op: 'transfer', target: 'param.company', to: 'org' }, { op: 'set', target: 'param.company', field: 'stake', value: 'amt / post' }, { op: 'set', target: 'param.company', field: 'invested', value: 'amt' }, { op: 'set', target: 'param.company', field: 'cash', value: 'param.company.cash + param.company.raiseAmount' }, { op: 'set', target: 'param.company', field: 'raising', value: 'false' }, { op: 'set', target: 'param.company', field: 'boardSeat', value: 'param.share >= 1' }, { op: 'set', target: 'param.company', field: 'acquiredAt', value: 'time.tick' }],
        result: 'Invested {money(amt)} in {param.company.name} for {pct(amt / post)}',
        ai: { score: `(${capacityOk}) && org.cash > amt * (1 + org.reserve * 2) && (isPlayer(org) || time.tick - param.company.raiseOpened >= 2) ? ((param.company.quality + randn(0, 14)) - 58) * 1000 * param.company.sector.heat : 0`, candidates: 4, news: '{org.name} leads a round in {param.company.name}' } },
      { id: 'negotiateRound', label: 'Negotiate a term sheet', verb: 'Negotiate', category: 'deals', icon: 'handshake',
        describe: 'Offer your own valuation for a company that is raising. Founders weigh price against who you are.', tradeoff: 'A lower price means more ownership; push too hard and they go elsewhere — and remember it.',
        params: [{ id: 'company', label: 'Company', type: 'entity', kind: 'company', filter: "it.status == 'active' && !it.owner && it.raising && it.raiseAmount > 0", sort: "est(it, 'quality').value * (1 + it.growth)" }],
        requires: [{ expr: 'org.cash >= param.company.raiseAmount', msg: 'Not enough dry powder' }, { expr: capacityOk, msg: 'Your partners are at capacity' }],
        effects: [{ op: 'negotiate', id: 'termSheet', with: 'param.company' }], playerOnly: true },
      { id: 'followOn', label: 'Follow on', verb: 'Follow on', kind: 'company', category: 'portfolio', icon: 'up',
        describe: 'Put more money into one of your companies when it raises. Protects your ownership — concentrates your bets.', tradeoff: 'Reserves spent on one company cannot save another.',
        params: [{ id: 'share', label: 'How much of the round', type: 'choice', default: '1', aiValue: '1', options: [{ value: 0.35, label: 'Pro-rata only' }, { value: 1, label: 'The whole round' }] }],
        vars: { amt: 'self.raiseAmount * param.share', post: 'self.valuation + self.raiseAmount' },
        requires: [{ expr: 'self.raising && self.raiseAmount > 0', msg: 'Not raising right now' }, { expr: 'org.cash >= amt', msg: 'Not enough dry powder' }],
        cost: { cash: 'amt' }, costCategory: 'Investments', capex: true,
        preview: [{ label: 'Round size', expr: 'self.raiseAmount', format: 'money' }, { label: 'Valuation (pre-money)', expr: 'self.valuation', format: 'money' }, { label: 'Your ownership after', expr: '(self.stake * self.valuation + amt) / post', format: 'pct1' }, { label: 'Team & product (estimate)', expr: "est(self, 'quality').value", format: 'score' }, { label: 'Current multiple on your money', expr: 'self.moic', format: 'x' }],
        effects: [{ op: 'set', path: 'self.stake', value: '(self.stake * self.valuation + amt) / post' }, { op: 'set', path: 'self.invested', value: 'self.invested + amt' }, { op: 'set', path: 'self.cash', value: 'self.cash + self.raiseAmount' }, { op: 'set', path: 'self.raising', value: 'false' }],
        result: 'Followed on in {self.name} with {money(amt)}',
        ai: { score: "self.raising && org.cash > self.raiseAmount * 1.5 && (self.quality + randn(0, 10)) > 50 ? self.raiseAmount : 0", selfSample: 8, news: '{org.name} doubles down on {self.name}' } },
      { id: 'boardWork', label: 'Roll up your sleeves', verb: 'Help', kind: 'company', category: 'portfolio', icon: 'wrench', cooldown: 6,
        describe: 'Spend partner time: recruiting, intros, strategy. Raises execution quality — and you learn how good the team really is.', tradeoff: 'Partner time is finite; it costs travel and focus.',
        cost: { cash: '25000' }, costCategory: 'Portfolio support',
        effects: [{ op: 'add', path: 'self.quality', value: 'rand(2, 6)' }, { op: 'observe', target: 'self', field: 'quality', quality: '0.85' }, { op: 'resource', id: 'reputation', add: '0.3' }],
        result: 'You spent a month helping {self.name}', ai: { score: 'self.moic > 1.5 && self.boardSeat ? 1000 : 0', selfSample: 3 } }
    );
  } else {
    gdl.actions.push(
      { id: 'buyCompany', label: 'Buy a company', verb: 'Buy', category: 'deals', icon: 'merge', primary: true,
        describe: 'Acquire 100% of a company at the seller\'s asking price, financed with your equity plus acquisition debt.', tradeoff: 'More debt means more upside on your equity — and less room when things go wrong.', risk: 'Rates can rise; recessions cut cash flow; covenants bite.',
        params: [{ id: 'company', label: 'Target', type: 'entity', kind: 'company', filter: "it.status == 'active' && !it.owner && it.ebitda > 0", sort: "it.ebitda * (1 + it.growth) / max(1, it.valuation) * est(it, 'quality').value" },
          { id: 'lev', label: 'Leverage (× EBITDA)', type: 'choice', default: '4', aiValue: "archetype(org) == 'aggressive' ? 6 : 3", options: [{ value: 0, label: 'No debt' }, { value: 3, label: '3× EBITDA' }, { value: 4, label: '4× EBITDA' }, { value: 6, label: '6× EBITDA', describe: 'Aggressive' }] }],
        vars: { price: 'param.company.valuation * params.exitPremium', debtAmt: 'min(price * 0.75, max(0, param.company.ebitda) * param.lev)', check: 'price - debtAmt' },
        requires: [{ expr: 'org.cash >= check', msg: 'Not enough equity for this deal' }, { expr: capacityOk, msg: 'Your partners are at capacity — hire a partner first' }],
        cost: { cash: 'check' }, costCategory: 'Investments', capex: true,
        preview: [{ label: 'Purchase price', expr: 'price', format: 'money' }, { label: 'Price ÷ EBITDA', expr: 'price / max(1, param.company.ebitda)', format: 'x' }, { label: 'Acquisition debt', expr: 'debtAmt', format: 'money' }, { label: 'Your equity check', expr: 'check', format: 'money' }, { label: 'Interest per year', expr: 'debtAmt * world.rates', format: 'money' }, { label: 'Management quality (estimate)', expr: "est(param.company, 'quality').value", format: 'score' }],
        effects: [{ op: 'transfer', target: 'param.company', to: 'org' }, { op: 'set', target: 'param.company', field: 'stake', value: '1' }, { op: 'set', target: 'param.company', field: 'invested', value: 'check' }, { op: 'set', target: 'param.company', field: 'debt', value: 'param.company.debt + debtAmt' }, { op: 'set', target: 'param.company', field: 'acquiredAt', value: 'time.tick' }, { op: 'set', target: 'param.company', field: 'raising', value: 'false' }, { op: 'news', text: '{org.name} acquires {param.company.name} for {money(price)}' }],
        result: 'Acquired {param.company.name} for {money(price)} ({money(check)} equity)',
        ai: { score: `(${capacityOk}) && org.cash > check * (1 + org.reserve) && (isPlayer(org) || time.tick - param.company.founded >= 3) ? (param.company.quality + randn(0, 12) - 52) * 10000 + param.company.ebitda * 0.5 : 0`, candidates: 4, news: '{org.name} buys {param.company.name}' } },
      { id: 'negotiateBuyout', label: 'Negotiate a buyout', verb: 'Negotiate', category: 'deals', icon: 'handshake',
        describe: 'Make your own offer to the owners instead of paying the asking price.', tradeoff: 'Lowball and the seller remembers; overpay and your returns suffer for years.',
        params: [{ id: 'company', label: 'Target', type: 'entity', kind: 'company', filter: "it.status == 'active' && !it.owner && it.ebitda > 0", sort: 'it.ebitda' }],
        requires: [{ expr: capacityOk, msg: 'Your partners are at capacity' }],
        effects: [{ op: 'negotiate', id: 'buyout', with: 'param.company' }], playerOnly: true },
      { id: 'operationsPlan', label: 'Launch an operations plan', verb: 'Improve', kind: 'company', category: 'portfolio', icon: 'wrench', cooldown: 18,
        describe: 'Pricing, procurement, systems, talent. Costs money now; lifts margins over the next two years.', tradeoff: 'Disruption; a weak team may not deliver.',
        cost: { cash: 'max(1M, self.ebitda * 0.25)' }, costCategory: 'Portfolio support',
        effects: [{ op: 'set', path: 'self.opsBoost', value: 'self.opsBoost + (self.quality > 45 ? rand(0.02, 0.05) : rand(-0.01, 0.03))' }, { op: 'observe', target: 'self', field: 'quality', quality: '0.8' }],
        result: 'Operations plan launched at {self.name}', ai: { score: 'self.opsBoost < 0.05 && org.cash > max(1M, self.ebitda * 0.25) * 4 ? self.ebitda * 0.1 : 0', selfSample: 4 } },
      { id: 'dividendRecap', label: 'Dividend recap', verb: 'Recap', kind: 'company', category: 'portfolio', icon: 'bank', cooldown: 24,
        describe: 'Load the company with more debt and pay yourself a dividend. Returns cash to your LPs early.', tradeoff: 'More interest; less room in a downturn.', risk: 'If rates or earnings move against you, the company can default.',
        requires: [{ expr: 'self.ebitda > 0 && self.debt < self.ebitda * 5', msg: 'The company cannot carry more debt' }],
        effects: [{ op: 'let', name: 'amt', value: 'self.ebitda * 1.5' }, { op: 'set', path: 'self.debt', value: 'self.debt + amt' }, { op: 'cash', amount: 'amt', category: 'Dividends from holdings' }, { op: 'set', path: 'self.invested', value: 'max(0, self.invested - amt * 0.5)' }],
        result: 'Recapitalized {self.name}', ai: { score: "archetype(org) == 'aggressive' && self.debt < self.ebitda * 3 && world.rates < 0.05 ? self.ebitda : 0", selfSample: 3 } },
      { id: 'replaceCEO', label: 'Replace the CEO', verb: 'Replace', kind: 'company', category: 'portfolio', icon: 'user', cooldown: 24,
        describe: 'Bring in new leadership. Could transform the company — or set it back a year.', cost: { cash: '1.5M' },
        effects: [{ op: 'set', path: 'self.quality', value: 'clamp(self.quality + randn(6, 14), 5, 98)' }, { op: 'set', path: 'self.growth', value: 'self.growth - 0.03' }],
        result: 'New CEO at {self.name}' }
    );
  }
  // exits & firm actions (both modes)
  gdl.actions.push(
    { id: 'sellStake', label: control ? 'Sell the company' : 'Sell your stake', verb: 'Sell', kind: 'company', category: 'exits', icon: 'tag',
      describe: control ? 'Run a sale process to a strategic buyer or another firm.' : 'Sell your shares to a strategic acquirer or on the secondary market.', tradeoff: 'Certain cash now versus a possibly much bigger outcome later.',
      vars: { proceeds: control ? 'self.equity * (0.9 + world.sentiment * 0.2)' : 'self.equity * self.stake * (0.75 + world.sentiment * 0.2)' },
      preview: [{ label: 'Proceeds', expr: 'proceeds', format: 'money' }, { label: 'Invested', expr: 'self.invested', format: 'money' }, { label: 'Multiple on your money', expr: 'proceeds / max(1, self.invested)', format: 'x' }, { label: 'Market sentiment', expr: 'world.sentiment', format: 'x' }],
      effects: [{ op: 'cash', amount: 'proceeds', category: 'Exit proceeds' }, { op: 'set', path: 'org.realized', value: 'org.realized + proceeds' }, { op: 'set', path: 'org.bestExit', value: 'max(org.bestExit, proceeds)' }, { op: 'set', path: 'org.exits', value: 'org.exits + 1' }, { op: 'set', path: 'self.exitValue', value: 'self.valuation' },
        { op: 'if', cond: control ? 'true' : 'false', then: [{ op: 'set', path: 'self.status', value: "'exited'" }, { op: 'set', path: 'self.ended', value: 'time.tick' }] },
        { op: 'set', path: 'self.stake', value: '0' }, { op: 'set', path: 'self.invested', value: '0' }, { op: 'transfer', target: 'self', to: 'null' },
        { op: 'if', cond: 'proceeds > 1000000000', then: [{ op: 'moment', title: 'A billion-dollar exit', text: 'You sold {self.name} for {money(proceeds)}.', stat: '{num(proceeds / max(1, self.invested))}×' }] }],
      result: 'Sold {self.name} for {money(proceeds)}',
      ai: { score: control ? '(self.moic > 2.2 && world.sentiment > 1) || time.tick - self.acquiredAt > 84 ? self.equity : 0' : 'self.moic > 6 && world.sentiment > 1.05 ? self.equity * self.stake : 0', selfSample: 6, news: '{org.name} sells {self.name}' } },
    { id: 'ipo', label: 'Take it public', verb: 'IPO', kind: 'company', category: 'exits', icon: 'up',
      describe: 'List the company on a stock exchange. The biggest outcomes happen here — when the window is open.', tradeoff: 'Bankers take fees; a weak market prices it down.',
      requires: [{ expr: 'self.revenue >= 60M', msg: 'Needs at least $60M of revenue' }, { expr: 'world.ipoWindow >= 0.5', msg: 'The IPO window is shut' }, { expr: 'self.growth > 0.05', msg: 'Public investors want growth' }],
      vars: { proceeds: `${control ? 'self.equity' : 'self.equity * self.stake'} * (0.85 + world.ipoWindow * 0.4) * 0.95` },
      preview: [{ label: 'Expected proceeds', expr: 'proceeds', format: 'money' }, { label: 'IPO window', expr: 'world.ipoWindow', format: 'pct' }, { label: 'Multiple on your money', expr: 'proceeds / max(1, self.invested)', format: 'x' }],
      effects: [{ op: 'cash', amount: 'proceeds', category: 'Exit proceeds' }, { op: 'set', path: 'org.realized', value: 'org.realized + proceeds' }, { op: 'set', path: 'org.bestExit', value: 'max(org.bestExit, proceeds)' }, { op: 'set', path: 'org.exits', value: 'org.exits + 1' }, { op: 'set', path: 'self.status', value: "'public'" }, { op: 'set', path: 'self.ended', value: 'time.tick' }, { op: 'set', path: 'self.exitValue', value: 'self.valuation' }, { op: 'set', path: 'self.keep', value: 'true' },
        { op: 'set', path: 'self.stake', value: '0' }, { op: 'transfer', target: 'self', to: 'null' }, { op: 'resource', id: 'reputation', add: '4' },
        { op: 'moment', title: '{self.name} rings the bell', text: 'Your stake is worth {money(proceeds)} — {num(proceeds / max(1, self.invested))}× your money.', stat: '{money(proceeds)}' }],
      result: '{self.name} is public', ai: { score: 'self.moic > 3 ? self.equity : 0', selfSample: 4, news: '{self.name} goes public; {org.name} cashes out' } },
    { id: 'writeOff', label: 'Write it off', verb: 'Write off', kind: 'company', category: 'portfolio', icon: 'close', danger: true,
      describe: 'Stop supporting a company and free the partner\'s time. It will likely fail without you.', tradeoff: 'Honest marks build LP trust; founders remember who walked away.',
      effects: [{ op: 'set', path: 'org.writeOffs', value: 'org.writeOffs + 1' }, { op: 'remember', a: 'self', b: 'org', key: 'relationship', add: '-10' }, { op: 'set', path: 'self.stake', value: '0' }, { op: 'transfer', target: 'self', to: 'null' }, { op: 'stake', id: 'lps', add: '1' }],
      result: 'Wrote off {self.name}', ai: { score: 'self.moic < 0.2 && self.runway < 3 ? 1000 : 0', selfSample: 6 } },
    { id: 'raiseFund', label: 'Raise a new fund', verb: 'Raise', category: 'firm', icon: 'bank', primary: true,
      describe: 'Go back to your LPs for a new, hopefully bigger fund. They judge you on TVPI, DPI and reputation.', tradeoff: 'A bigger fund means bigger fees — and a much harder target to beat.',
      requires: [{ expr: 'time.tick - org.lastFund >= 30', msg: 'LPs expect at least 2½ years between funds' }, { expr: 'org.deployed >= 0.55', msg: 'Deploy more than half of the current fund first' }],
      params: [{ id: 'lp', label: 'Anchor LP', type: 'entity', kind: 'lp', sort: 'it.appetite' }],
      effects: [{ op: 'negotiate', id: 'fundraise', with: 'param.lp' }], playerOnly: true },
    { id: 'distribute', label: 'Return cash to LPs', verb: 'Distribute', category: 'firm', icon: 'bank',
      describe: 'Send realized gains back to your investors. DPI is the number LPs trust most.', tradeoff: 'Less dry powder for new deals and follow-ons.',
      params: [{ id: 'amount', label: 'Amount', type: 'money', min: '1000000', max: 'max(1000000, org.cash)', default: 'max(1000000, org.cash * 0.3)' }],
      requires: [{ expr: 'org.cash > 1000000', msg: 'Not enough cash' }],
      effects: [{ op: 'cash', amount: '-param.amount', category: 'Distributions to LPs', capex: true }, { op: 'set', path: 'org.distributed', value: 'org.distributed + param.amount' }, { op: 'stake', id: 'lps', add: 'min(12, param.amount / max(1, org.committed) * 40)' }],
      result: 'Distributed {money(param.amount)} to LPs', ai: { score: 'org.cash > org.committed * 0.6 && org.deployed > 0.5 ? org.cash * 0.1 : 0' } },
    { id: 'hirePartner', label: 'Hire a partner', verb: 'Hire', category: 'firm', icon: 'user',
      describe: `Each partner can actively manage about ${control ? 3 : 7} ${L.units}.`, tradeoff: 'Salaries and carry dilution.',
      cost: { cash: '250000' }, costCategory: 'Hiring', requires: [{ expr: 'org.partners < 12', msg: 'The partnership is big enough' }],
      effects: [{ op: 'set', path: 'org.partners', value: 'org.partners + 1' }], result: 'A new partner joins {org.name}', ai: { score: `count(owned('company', org)) >= org.capacity - 1 && org.cash > 20M ? 5000 : 0` } }
  );
  gdl.actions.push(...C.financeActions());

  /* ---------------- negotiations ---------------- */
  gdl.negotiations = [
    { id: 'fundraise', label: 'Fundraise', with: 'lp', patience: 3, counter: { term: 'size' },
      terms: [{ id: 'size', label: 'Fund size', type: 'money', default: 'org.committed * 1.6', min: 'org.committed * 0.5', max: 'org.committed * 5', step: 5000000 }, { id: 'fee', label: 'Management fee', type: 'choice', default: '0.02', options: [{ value: 0.015, label: '1.5%' }, { value: 0.02, label: '2%' }, { value: 0.025, label: '2.5%' }] }],
      value: '(org.committed * (0.7 + max(0, org.tvpi - 0.9) * 1.4 + org.dpi * 0.6) * (1 + (org.reputation - 50) / 120) * them.appetite * (0.02 / terms.fee) * (world.sentiment > 0.9 ? 1 : 0.75)) / max(1, terms.size)', reservation: '1',
      reasons: [{ when: 'org.tvpi < 1.1', text: 'Your current fund is not clearly making money yet' }, { when: 'org.dpi < 0.2', text: 'LPs want to see cash back, not paper gains' }, { when: 'terms.fee > 0.02', text: 'Fees above 2% are a hard sell' }, { when: 'world.sentiment < 0.9', text: 'LPs are pulling back across the industry' }],
      onAccept: [{ op: 'cash', amount: 'terms.size', category: 'LP commitments', capex: true }, { op: 'set', path: 'org.committed', value: 'org.committed + terms.size' }, { op: 'set', path: 'org.fundNo', value: 'org.fundNo + 1' }, { op: 'set', path: 'org.lastFund', value: 'time.tick' }, { op: 'set', path: 'org.feePct', value: '+terms.fee' }, { op: 'stake', id: 'lps', add: '8' },
        { op: 'moment', title: 'Fund {org.fundNo} closes', text: '{them.name} anchors a {money(terms.size)} fund.', stat: '{money(terms.size)}' }],
      acceptNews: '{org.name} closes Fund {org.fundNo}' }
  ];
  if (!control) gdl.negotiations.push({ id: 'termSheet', label: 'Term sheet', with: 'company', patience: 2, counter: { term: 'premoney' },
    context: { amount: 'them.raiseAmount' },
    terms: [{ id: 'premoney', label: 'Pre-money valuation', type: 'money', default: 'them.valuation * 0.8', min: 'them.valuation * 0.3', max: 'them.valuation * 3', step: 250000 }],
    value: 'terms.premoney * (1 + (org.reputation - 50) / 150)', reservation: 'them.valuation * (0.8 + them.sector.heat * 0.15) * (them.quality > 70 ? 1.1 : 1)',
    reasons: [{ when: 'terms.premoney < them.valuation * 0.8', text: 'The founders think you are lowballing them' }, { when: 'them.sector.heat > 1.3', text: 'Other firms are circling — this sector is hot' }, { when: 'org.reputation > 65', text: 'They would love you on their cap table' }],
    onAccept: [{ op: 'cash', amount: '-amount', category: 'Investments', capex: true }, { op: 'transfer', target: 'them', to: 'org' }, { op: 'set', path: 'them.stake', value: 'amount / (terms.premoney + amount)' }, { op: 'set', path: 'them.invested', value: 'amount' }, { op: 'set', path: 'them.cash', value: 'them.cash + amount' }, { op: 'set', path: 'them.raising', value: 'false' }, { op: 'set', path: 'them.boardSeat', value: 'true' }, { op: 'set', path: 'them.acquiredAt', value: 'time.tick' }],
    acceptNews: '{org.name} leads {them.name}\'s round at {money(terms.premoney)} pre-money' });
  else gdl.negotiations.push({ id: 'buyout', label: 'Buyout', with: 'company', patience: 3, counter: { term: 'price' },
    terms: [{ id: 'price', label: 'Enterprise value offered', type: 'money', default: 'them.valuation', min: 'them.valuation * 0.4', max: 'them.valuation * 3', step: 1000000 }, { id: 'lev', label: 'Debt (× EBITDA)', type: 'choice', default: '4', options: [{ value: 0, label: 'None' }, { value: 3, label: '3×' }, { value: 4, label: '4×' }, { value: 6, label: '6×' }] }],
    value: 'terms.price * (1 + (org.reputation - 50) / 200)', reservation: 'them.valuation * (1.05 + them.sector.heat * 0.1)',
    reasons: [{ when: 'terms.price < them.valuation', text: 'The owners will not sell below what the business is worth today' }, { when: 'them.growth > 0.15', text: 'They believe their growth deserves a premium' }],
    onAccept: [{ op: 'let', name: 'debtAmt', value: 'min(terms.price * 0.75, max(0, them.ebitda) * terms.lev)' }, { op: 'if', cond: 'org.cash < terms.price - debtAmt', then: [{ op: 'loan', amount: 'terms.price - debtAmt - org.cash + 1000000', years: '5' }] },
      { op: 'cash', amount: '-(terms.price - debtAmt)', category: 'Investments', capex: true }, { op: 'transfer', target: 'them', to: 'org' }, { op: 'set', path: 'them.stake', value: '1' }, { op: 'set', path: 'them.invested', value: 'terms.price - debtAmt' }, { op: 'set', path: 'them.debt', value: 'them.debt + debtAmt' }, { op: 'set', path: 'them.acquiredAt', value: 'time.tick' }],
    acceptNews: '{org.name} buys {them.name} for {money(terms.price)}' });

  /* ---------------- policies (delegation) ---------------- */
  gdl.policies = [
    { id: 'followOns', label: control ? 'Add-on capital' : 'Follow-on policy', scope: 'org', default: control ? 'manual' : 'winners', aiDefault: 'manual', every: 1,
      describe: control ? 'Whether your team automatically funds operations plans at holdings that qualify.' : 'What your team does when a portfolio company raises again.',
      options: control ? [{ value: 'manual', label: 'Case by case' }, { value: 'auto', label: 'Fund qualifying plans', effects: [{ op: 'autoAct', action: 'operationsPlan', max: '1' }] }]
        : [{ value: 'manual', label: 'Ask me every time', describe: 'Raises show up in Needs you.' }, { value: 'winners', label: 'Back the winners', describe: 'Follow on when the team looks strong.', effects: [{ op: 'autoAct', action: 'followOn', max: '2' }] }, { value: 'none', label: 'Never follow on', describe: 'Spread capital over more new bets.' }] },
    { id: 'support', label: 'Portfolio support', scope: 'org', default: 'standard', describe: 'How much partner time goes into existing companies versus new deals.',
      options: [{ value: 'light', label: 'Hands-off', describe: 'Founders run their companies.', effects: [{ op: 'set', path: 'org.supportLevel', value: '0' }] }, { value: 'standard', label: 'Supportive', effects: [{ op: 'set', path: 'org.supportLevel', value: '1' }, { op: 'each', list: "filter(owned('company', org), it.boardSeat || it.stake >= 0.5)", do: [{ op: 'chance', p: '0.08', then: [{ op: 'add', path: 'it.quality', value: '1' }] }] }] }, { value: 'heavy', label: 'Hands-on', describe: 'More improvement, less capacity.', effects: [{ op: 'set', path: 'org.supportLevel', value: '2' }, { op: 'each', list: "filter(owned('company', org), it.boardSeat || it.stake >= 0.5)", do: [{ op: 'chance', p: '0.16', then: [{ op: 'add', path: 'it.quality', value: '1' }] }] }] }] },
    { id: 'reserves', label: 'Reserve discipline', scope: 'org', default: 'balanced', describe: 'How much dry powder you keep back before writing new checks.',
      options: [{ value: 'aggressive', label: 'Deploy fast', effects: [{ op: 'set', path: 'org.reserve', value: '0.1' }] }, { value: 'balanced', label: 'Balanced', effects: [{ op: 'set', path: 'org.reserve', value: '0.3' }] }, { value: 'conservative', label: 'Keep big reserves', effects: [{ op: 'set', path: 'org.reserve', value: '0.5' }] }] }
  ];

  /* ---------------- stakeholders ---------------- */
  gdl.stakeholders = [{ id: 'lps', label: 'LP confidence', start: 62, base: '55', speed: 0.08, describe: 'Your limited partners. They decide whether there is a next fund.',
    drivers: [
      { label: 'Fund performance (TVPI)', expr: 'time.tick < 24 ? 0 : clamp((org.tvpi - 1.05) * 45, -30, 25)' },
      { label: 'Cash returned (DPI)', expr: 'clamp(org.dpi * 30, 0, 20)' },
      { label: 'Deployment pace', expr: 'time.tick > 24 && org.deployed < 0.25 ? -12 : 0' },
      { label: 'Write-offs', expr: '-min(15, org.writeOffs * 1.2)' },
      { label: 'Reputation', expr: '(org.reputation - 50) * 0.2' }
    ], thresholds: [{ below: 25, event: 'lpRevolt', cooldown: 18 }] }];

  /* ---------------- events ---------------- */
  gdl.events = [
    { id: 'lpRevolt', trigger: 'scheduled', priority: 'critical', title: 'Your LPs are losing patience', text: 'TVPI {num(player.tvpi)}×, DPI {num(player.dpi)}×. The advisory committee wants answers.',
      choices: [{ label: 'Cut fees for this fund', describe: 'Less income; more goodwill.', effects: [{ op: 'set', path: 'player.feePct', value: 'max(0.01, player.feePct - 0.005)' }, { op: 'stake', id: 'lps', add: '14' }], result: 'You cut fees' },
        { label: 'Sell holdings to return cash', describe: 'Locks in DPI; sells winners early.', effects: [{ op: 'each', list: "top(owned('company', player), it.holdValue, 2)", do: [{ op: 'cash', amount: 'it.holdValue * 0.8', category: 'Exit proceeds' }, { op: 'set', path: 'player.distributed', value: 'player.distributed + it.holdValue * 0.8' }, { op: 'cash', amount: '-it.holdValue * 0.8', category: 'Distributions to LPs', capex: true }, { op: 'set', path: 'it.stake', value: '0' }, { op: 'transfer', target: 'it', to: 'null' }] }, { op: 'stake', id: 'lps', add: '18' }], result: 'Secondary sale completed' },
        { label: 'Hold firm', effects: [{ op: 'stake', id: 'lps', add: '-6' }], result: 'You ask for patience' }] },
    { id: 'recessionBoard', trigger: 'scheduled', priority: 'critical', title: 'Markets crash: the investment committee meets', text: 'Valuations are down {pct(1 - world.sentiment)}. Your portfolio is worth {money(player.nav)} on paper.',
      choices: [{ label: 'Protect the portfolio', describe: 'Keep big reserves for follow-ons.', effects: [{ op: 'policy', id: 'reserves', value: "'conservative'" }, { op: 'stake', id: 'lps', add: '5' }], result: 'Reserves protected' },
        { label: 'Be greedy when others are fearful', describe: 'Deploy into cheap valuations.', effects: [{ op: 'policy', id: 'reserves', value: "'aggressive'" }, { op: 'resource', id: 'reputation', add: '3' }], result: 'You lean into the downturn' },
        { label: 'Mark everything down honestly', describe: 'LPs respect it; your numbers look worse.', effects: [{ op: 'stake', id: 'lps', add: '8' }, { op: 'resource', id: 'reputation', add: '-1' }], result: 'Honest marks sent to LPs' }] }
  ];
  if (!control) gdl.events.push(
    { id: 'hotDeal', priority: 'important', chance: '0.06', cooldown: 4, title: '{c.name} is raising — and everyone wants in', text: '{c.sector.name}, growing {pct(c.growth)} a year. They want {money(c.raiseAmount)} at {money(c.valuation)}. Term sheets are due Friday.',
      bind: { c: { kind: 'company', filter: "it.status == 'active' && !it.owner && it.raising && it.quality > 60 && it.raiseAmount > 0", pick: 'max', by: 'it.growth * it.sector.heat' } },
      choices: [{ label: 'Pre-empt at a premium', describe: 'Pay 25% more to win it outright.', cost: 'c.raiseAmount', requires: "count(owned('company', player)) < player.capacity",
          effects: [{ op: 'transfer', target: 'c', to: 'player' }, { op: 'set', path: 'c.stake', value: 'c.raiseAmount / (c.valuation * 1.25 + c.raiseAmount)' }, { op: 'set', path: 'c.invested', value: 'c.raiseAmount' }, { op: 'set', path: 'c.cash', value: 'c.cash + c.raiseAmount' }, { op: 'set', path: 'c.raising', value: 'false' }, { op: 'set', path: 'c.boardSeat', value: 'true' }, { op: 'set', path: 'c.acquiredAt', value: 'time.tick' }], result: 'You won {c.name}' },
        { label: 'Pass', describe: 'Too hot, too expensive.', effects: [], result: 'You passed on {c.name}', track: { text: 'Passed on {c.name} at {money(c.valuation)}', ref: 'c', value: 'c.valuation' } }] },
    { id: 'downRound', priority: 'critical', chance: '0.25', cooldown: 2, title: '{c.name} is running out of money', text: '{int(c.runway)} months of cash left and no lead investor. Your stake: {pct(c.stake)} ({money(c.invested)} invested).',
      bind: { c: { kind: 'company', owner: 'player', filter: 'it.raising && it.runway < 3 && world.sentiment < 1', pick: 'min', by: 'it.runway' } },
      choices: [{ label: 'Lead a down round', describe: 'Buy a lot more of the company at half the price.', cost: 'c.raiseAmount', effects: [{ op: 'set', path: 'c.stake', value: '(c.stake * c.valuation * 0.5 + c.raiseAmount) / (c.valuation * 0.5 + c.raiseAmount)' }, { op: 'set', path: 'c.invested', value: 'c.invested + c.raiseAmount' }, { op: 'set', path: 'c.cash', value: 'c.cash + c.raiseAmount' }, { op: 'set', path: 'c.raising', value: 'false' }, { op: 'remember', a: 'c', b: 'player', key: 'relationship', add: '8' }], result: 'Down round closed for {c.name}' },
        { label: 'Bridge loan', describe: 'Six more months to prove it.', cost: 'c.burn * 6', effects: [{ op: 'set', path: 'c.cash', value: 'c.cash + c.burn * 6' }, { op: 'set', path: 'c.debt', value: 'c.debt + c.burn * 6' }, { op: 'set', path: 'c.invested', value: 'c.invested + c.burn * 6' }], result: 'Bridge to {c.name}' },
        { label: 'Let the market decide', describe: 'If nobody funds it, it dies.', effects: [], result: 'You hold back on {c.name}' }] },
    { id: 'founderConflict', priority: 'important', chance: '0.03', cooldown: 10, title: 'Trouble at {c.name}', text: 'The co-founders of {c.name} have stopped speaking. The board meets next week.',
      bind: { c: { kind: 'company', owner: 'player', filter: 'it.boardSeat' } },
      choices: [{ label: 'Back the CEO', effects: [{ op: 'set', path: 'c.quality', value: 'clamp(c.quality + randn(0, 9), 5, 98)' }], result: 'You back the CEO of {c.name}' },
        { label: 'Bring in a seasoned CEO', cost: '400000', effects: [{ op: 'set', path: 'c.quality', value: 'clamp(c.quality + randn(5, 12), 5, 98)' }, { op: 'remember', a: 'c', b: 'player', key: 'relationship', add: '-5' }, { op: 'resource', id: 'reputation', add: '-1' }], result: 'New CEO at {c.name}' },
        { label: 'Mediate', describe: 'Weeks of your time.', effects: [{ op: 'set', path: 'c.quality', value: 'clamp(c.quality + randn(2, 5), 5, 98)' }, { op: 'resource', id: 'reputation', add: '1' }], result: 'You mediate at {c.name}' }] });
  else gdl.events.push(
    { id: 'rateShock', trigger: 'scheduled', priority: 'critical', title: 'Rates spike: your leverage bites', text: 'Rates are now {pct(world.rates)}. Your holdings carry {money(sum(owned(\'company\', player), it.debt))} of debt.',
      choices: [{ label: 'Inject equity to pay down debt', cost: "sum(owned('company', player), it.debt) * 0.15", effects: [{ op: 'each', list: "owned('company', player)", do: [{ op: 'set', path: 'it.debt', value: 'it.debt * 0.85' }] }], result: 'Debt paid down' },
        { label: 'Renegotiate with lenders', effects: [{ op: 'chance', p: '0.5', then: [{ op: 'news', text: 'Lenders extend your maturities' }], else: [{ op: 'each', list: "owned('company', player)", do: [{ op: 'set', path: 'it.margin', value: 'it.margin - 0.02' }] }] }], result: 'You meet the lenders' },
        { label: 'Ride it out', effects: [{ op: 'stake', id: 'lps', add: '-5' }], result: 'You ride it out' }] },
    { id: 'auction', priority: 'important', chance: '0.05', cooldown: 6, title: 'Bankers are auctioning {c.name}', text: '{c.sector.name}, {money(c.revenue)} revenue, {pct(c.margin)} margins. The bid deadline is close.',
      bind: { c: { kind: 'company', filter: "it.status == 'active' && !it.owner && it.ebitda > 3M", pick: 'max', by: 'it.quality + rand() * 30' } },
      choices: [{ label: 'Bid to win (+20%)', requires: "count(owned('company', player)) < player.capacity", cost: '(c.valuation * 1.2 - min(c.valuation * 1.2 * 0.75, max(0, c.ebitda) * 4))',
          effects: [{ op: 'let', name: 'debtAmt', value: 'min(c.valuation * 1.2 * 0.75, max(0, c.ebitda) * 4)' }, { op: 'transfer', target: 'c', to: 'player' }, { op: 'set', path: 'c.stake', value: '1' }, { op: 'set', path: 'c.invested', value: 'c.valuation * 1.2 - debtAmt' }, { op: 'set', path: 'c.debt', value: 'c.debt + debtAmt' }, { op: 'set', path: 'c.acquiredAt', value: 'time.tick' }], result: 'You win the auction for {c.name}' },
        { label: 'Pass', effects: [], result: 'You pass on {c.name}', track: { text: 'Passed on {c.name} at {money(c.valuation)}', ref: 'c', value: 'c.valuation' } }] },
    { id: 'covenant', priority: 'critical', chance: '0.3', cooldown: 6, title: '{c.name} breaches its loan covenants', text: 'Debt is {num(c.debt / max(1, c.ebitda))}× EBITDA and lenders can take the keys.',
      bind: { c: { kind: 'company', owner: 'player', filter: 'it.debt > max(1, it.ebitda) * 7 || (it.debt > 0 && it.ebitda <= 0)' } },
      choices: [{ label: 'Cure it with fresh equity', cost: 'c.debt * 0.3', effects: [{ op: 'set', path: 'c.debt', value: 'c.debt * 0.7' }, { op: 'set', path: 'c.invested', value: 'c.invested + c.debt * 0.3 / 0.7' }], result: 'Covenant cured at {c.name}' },
        { label: 'Hand the keys to the lenders', effects: [{ op: 'set', path: 'c.status', value: "'failed'" }, { op: 'set', path: 'c.ended', value: 'time.tick' }, { op: 'set', path: 'player.writeOffs', value: 'player.writeOffs + 1' }, { op: 'set', path: 'c.stake', value: '0' }, { op: 'transfer', target: 'c', to: 'null' }, { op: 'resource', id: 'reputation', add: '-4' }], result: 'Lenders take {c.name}' }] });
  gdl.events.push(
    { id: 'acquisitionOffer', priority: 'important', chance: '0.035', cooldown: 6, title: 'A buyer wants {c.name}', text: 'A strategic acquirer offers {money(c.valuation * 1.3)} for the whole company — your share would be {money(c.equity * c.stake * 1.3)} ({num(c.equity * c.stake * 1.3 / max(1, c.invested))}× your money).',
      bind: { c: { kind: 'company', owner: 'player', filter: 'it.revenue > 3M && it.invested > 0', pick: 'random' } },
      choices: [{ label: 'Accept', effects: [{ op: 'let', name: 'pr', value: 'c.equity * c.stake * 1.3' }, { op: 'cash', amount: 'pr', category: 'Exit proceeds' }, { op: 'set', path: 'player.realized', value: 'player.realized + pr' }, { op: 'set', path: 'player.bestExit', value: 'max(player.bestExit, pr)' }, { op: 'set', path: 'player.exits', value: 'player.exits + 1' }, { op: 'set', path: 'c.status', value: "'exited'" }, { op: 'set', path: 'c.ended', value: 'time.tick' }, { op: 'set', path: 'c.exitValue', value: 'c.valuation * 1.3' }, { op: 'set', path: 'c.keep', value: 'true' }, { op: 'set', path: 'c.stake', value: '0' }, { op: 'transfer', target: 'c', to: 'null' }], result: 'Sold {c.name}' },
        { label: 'Hold out for more', describe: 'The buyer might come back higher — or walk.', effects: [{ op: 'chance', p: '0.4', then: [{ op: 'event', id: 'acquisitionOffer', delay: '2', bind: { c: 'c' } }] }], result: 'You hold out' },
        { label: 'Decline', describe: 'You think it can be much bigger.', effects: [], result: 'You decline the offer for {c.name}', track: { text: 'Declined {money(c.valuation * 1.3)} for {c.name}', ref: 'c', value: 'c.valuation' } }] },
    { id: 'fraud', priority: 'critical', chance: '0.004', cooldown: 60, title: 'Accounting irregularities at {c.name}', text: 'An internal audit at {c.name} finds revenue that does not exist.',
      bind: { c: { kind: 'company', owner: 'player', pick: 'random' } },
      choices: [{ label: 'Go public with it', describe: 'Painful and honest.', effects: [{ op: 'set', path: 'c.revenue', value: 'c.revenue * 0.4' }, { op: 'set', path: 'c.quality', value: 'max(5, c.quality - 30)' }, { op: 'stake', id: 'lps', add: '-6' }, { op: 'resource', id: 'reputation', add: '2' }], result: 'You disclose the fraud at {c.name}' },
        { label: 'Quietly restructure', describe: 'If it leaks, it is far worse.', effects: [{ op: 'set', path: 'c.revenue', value: 'c.revenue * 0.5' }, { op: 'chance', p: '0.35', then: [{ op: 'resource', id: 'reputation', add: '-15' }, { op: 'stake', id: 'lps', add: '-20' }, { op: 'news', text: 'Cover-up exposed: {player.name} hid fraud at {c.name}' }] }], result: 'Quiet restructuring at {c.name}' }] }
  );

  /* ---------------- progression & history ---------------- */
  const tierFund = (x) => Math.round(L.fund * x);
  gdl.progression = {
    tiers: [{ id: 'emerging', label: 'Emerging manager' }, { id: 'established', label: 'Established firm', when: `player.fundNo >= 2 && player.committed >= ${tierFund(2.2)}`, text: 'LPs take your calls. Bigger deals are open to you.' },
      { id: 'top', label: 'Top-quartile firm', when: `player.committed >= ${tierFund(6)} && player.tvpi >= 1.6`, text: 'The best founders and sellers come to you first.' }, { id: 'legend', label: 'Legendary firm', when: `player.committed >= ${tierFund(20)} && player.bestExit >= ${control ? 2e9 : 1e9}`, text: 'Your name is on the industry\'s all-time lists.' }],
    objectives: { count: 2, templates: [
      { id: 'tvpi', text: 'Get fund TVPI to {num(target)}×', metric: 'player.tvpi', target: 'max(1.1, base + 0.15)', weight: 2, reward: [{ op: 'stake', id: 'lps', add: '10' }], penalty: [{ op: 'stake', id: 'lps', add: '-10' }] },
      { id: 'deploy', text: 'Deploy {pct(target)} of committed capital', metric: 'player.deployed', target: 'min(0.9, base + 0.2)', reward: [{ op: 'stake', id: 'lps', add: '6' }], penalty: [{ op: 'stake', id: 'lps', add: '-8' }] },
      { id: 'dpi', text: 'Return {money(target)} to LPs', metric: 'player.distributed', target: 'base + player.committed * 0.1', reward: [{ op: 'stake', id: 'lps', add: '12' }], penalty: [{ op: 'stake', id: 'lps', add: '-6' }] },
      { id: 'rep', text: 'Reach a reputation of {int(target)} with founders', metric: 'player.reputation', target: 'min(95, base + 8)', reward: [{ op: 'stake', id: 'lps', add: '5' }], penalty: [] }] },
    failure: { when: "stake('lps') < 8 || player.cash < -creditLimit(player)", grace: 3, warningTitle: 'Your LPs want out', warning: 'Your investors are moving to replace the general partner. You have three months.',
      gameOver: 'Your LPs have voted to remove you. {player.name} is being wound down by another firm.',
      rescue: [{ id: 'feeCut', label: 'Waive fees for a year', describe: 'A big concession to keep the LPs on side.', once: true, effects: [{ op: 'set', path: 'player.feePct', value: '0.005' }, { op: 'stake', id: 'lps', add: '20' }] },
        { id: 'secondary', label: 'Sell the portfolio to a secondary buyer', describe: 'Return cash now at a 30% discount.', effects: [{ op: 'each', list: "owned('company', player)", do: [{ op: 'cash', amount: 'it.holdValue * 0.7', category: 'Secondary sale' }, { op: 'set', path: 'it.stake', value: '0' }, { op: 'transfer', target: 'it', to: 'null' }] }, { op: 'stake', id: 'lps', add: '15' }] },
        { id: 'merge', label: 'Merge into a bigger firm', describe: 'Keep the team; lose your name on the door.', once: true, effects: [{ op: 'stake', id: 'lps', add: '25' }, { op: 'resource', id: 'reputation', add: '-10' }] }] },
    victory: [{ id: 'top', label: `The most valuable ${L.org.toLowerCase()}`, when: 'count(rivals(), it.level < 3 && it.value > player.value) == 0 && tierIndex() >= 2', text: 'No rival manages more value than you.' }]
  };
  gdl.history = {
    records: [{ id: 'value', label: 'Largest firm', expr: 'org.value', format: 'money' }, { id: 'bestExit', label: 'Biggest single exit', expr: 'org.bestExit', format: 'money' }, { id: 'tvpi', label: 'Highest TVPI', expr: 'org.tvpi', format: 'x' }, { id: 'committed', label: 'Largest fund family', expr: 'org.committed', format: 'money' }],
    awards: [{ id: 'award', label: L.award, score: 'org.tvpi * 20 + org.reputation * 0.3 + log(1 + org.bestExit / 10M) * 3', noise: 2, prize: [{ op: 'resource', id: 'reputation', add: '4' }] }],
    milestones: [{ id: 'firstExit', label: 'First exit', when: 'player.exits >= 1', text: 'Real cash back from a real company.' }, { id: 'unicorn', label: control ? 'A billion-dollar sale' : 'A unicorn', when: `player.bestExit >= ${control ? 1e9 : 3e8} || maxOf(owned('company', player), it.valuation) >= 1000000000`, text: control ? 'You sold a company for over a billion.' : 'One of your bets is worth a billion dollars.' }, { id: 'fund2', label: 'Fund II', when: 'player.fundNo >= 2', text: 'LPs came back for more.' }, { id: 'dpi1', label: 'Money back', when: 'player.dpi >= 1', text: 'Every LP dollar returned in cash.' }]
  };
  gdl.needs = [
    { id: 'raising', forEach: 'company', when: 'self.owner && isPlayer(self.owner) && self.raising && self.raiseAmount > 0', text: '{self.name} is raising {money(self.raiseAmount)}', sub: 'Follow on, or let others lead (you get diluted)', action: control ? 'operationsPlan' : 'followOn', priority: 1, tone: 'warn' },
    { id: 'capacity', when: "count(owned('company', player)) >= player.capacity", text: 'Your partners are at capacity', sub: 'Hire a partner before taking on new deals', action: 'hirePartner', priority: 1, tone: 'warn' },
    { id: 'raiseNow', when: 'player.deployed >= 0.7 && time.tick - player.lastFund >= 30', text: 'Time to raise your next fund', sub: 'You have deployed {pct(player.deployed)} of Fund {player.fundNo}', action: 'raiseFund', priority: 1, tone: 'good' },
    { id: 'idle', when: 'time.tick > 12 && player.deployed < 0.25', text: 'Your LPs expect you to deploy their money', sub: '{pct(player.deployed)} deployed after {int(time.tick)} months', action: control ? 'buyCompany' : 'joinRound', priority: 2, tone: 'warn' }
  ];

  /* ---------------- interface ---------------- */
  const sectorGlyph = 'it.sector.glyph';
  const scr = C.standardScreens({
    goal: gdl.meta.goal, primary: [control ? 'buyCompany' : 'joinRound', 'raiseFund'],
    homeSubtitle: 'Fund {player.fundNo} · {money(player.committed)} committed · {player.holdings} ' + L.units,
    metrics: [{ label: 'Portfolio value', expr: 'player.nav', format: 'money', metric: 'nav' }, { label: 'Dry powder', expr: 'player.cash', format: 'money' }, { label: 'TVPI', expr: 'player.tvpi', format: 'x', metric: 'tvpi' }, { label: 'LP confidence', expr: "stake('lps')", format: 'score', explain: 'stake:lps' }],
    signature: [{ type: 'cards', title: 'Your ' + L.units, width: 'full', kind: 'company', owner: 'player', sort: 'it.holdValue', size: 'm', glyph: sectorGlyph, glyphScale: '0.42', glyphColor: "it.moic >= 1 ? 'var(--good)' : it.runway < 6 ? 'var(--bad)' : 'var(--accent)'", badge: '{it.stage}', badgeTone: "it.raising ? 'warn' : 'info'",
      stats: [{ label: 'Your stake', expr: 'it.holdValue', format: 'money' }, { label: 'Multiple', expr: 'it.moic', format: 'x', tone: "v >= 1 ? 'good' : 'bad'" }, { label: 'Growth', expr: 'it.growth', format: 'pct' }, { label: 'Runway (mo)', expr: 'min(99, it.runway)', format: 'int', tone: "v < 6 ? 'bad' : ''" }], actions: control ? ['operationsPlan', 'sellStake'] : ['followOn', 'boardWork'], empty: 'No holdings yet — find a deal.' },
      { type: 'chart', width: 'full', title: 'Fund value', series: [{ label: 'Portfolio value', metric: 'nav' }], format: 'money', window: 120 }]
  });
  scr.deals = { title: 'Deal flow', subtitle: control ? 'Companies you could buy' : 'Companies raising money right now', actions: control ? ['buyCompany', 'negotiateBuyout'] : ['joinRound', 'negotiateRound'],
    tabs: [{ id: 'open', label: control ? 'Targets' : 'Raising now', sections: [
      { type: 'table', title: control ? 'Acquisition targets' : 'Open rounds', width: 'full', kind: 'company', search: true, key: 'deals', limit: 25,
        filter: control ? "it.status == 'active' && !it.owner && it.ebitda > 0" : "it.status == 'active' && !it.owner && it.raising && it.raiseAmount > 0",
        sort: control ? 'it.ebitda' : "est(it, 'quality').value",
        columns: control ? [{ label: 'Company', expr: 'it.name' }, { label: 'Sector', expr: 'it.sector.name', format: 'text' }, { label: 'Revenue', expr: 'it.revenue', format: 'money' }, { label: 'EBITDA', expr: 'it.ebitda', format: 'money' }, { label: 'Growth', expr: 'it.growth', format: 'pct' }, { label: 'Asking price', expr: 'it.valuation * params.exitPremium', format: 'money' }, { label: 'Price ÷ EBITDA', expr: 'it.valuation * params.exitPremium / max(1, it.ebitda)', format: 'x' }, { label: 'Mgmt (est.)', expr: "est(it, 'quality').value", format: 'score' }]
          : [{ label: 'Company', expr: 'it.name' }, { label: 'Sector', expr: 'it.sector.name', format: 'text' }, { label: 'Stage', expr: 'it.stage', format: 'text' }, { label: 'Revenue', expr: 'it.revenue', format: 'money' }, { label: 'Growth', expr: 'it.growth', format: 'pct' }, { label: 'Raising', expr: 'it.raiseAmount', format: 'money' }, { label: 'Valuation', expr: 'it.valuation', format: 'money' }, { label: 'Team (est.)', expr: "est(it, 'quality').value", format: 'score' }],
        empty: 'Nobody is raising right now — check back next month.' }] },
      { id: 'sectors', label: 'Sectors', sections: [{ type: 'cards', title: 'Where the market is hot', width: 'full', kind: 'sector', sort: 'it.heat', size: 's', glyph: 'it.glyph', glyphScale: '0.35', glyphColor: "it.heat > 1.2 ? 'var(--bad)' : it.heat < 0.85 ? 'var(--info)' : 'var(--accent)'", stats: [{ label: 'Heat', expr: 'it.heat', format: 'x' }, { label: 'Raising', expr: "count(all('company'), it.sector == outer && it.raising && !it.owner && it.status == 'active')", format: 'int' }, { label: 'Multiple', expr: 'it.multiple', format: 'x' }] },
        { type: 'mix', title: 'Where companies are raising', width: 'half', kind: 'company', filter: "it.status == 'active' && it.raising", groupBy: 'it.sector.name', format: 'int', centerLabel: 'rounds open' },
        { type: 'chart', width: 'half', title: 'Market sentiment', series: [{ label: 'Sentiment', world: 'sentiment' }, { label: 'IPO window', world: 'ipoWindow' }], format: 'x', window: 120 }] },
      { id: 'passed', label: 'Anti-portfolio', sections: [{ type: 'antiPortfolio', width: 'full', title: 'The ones that got away' }] }] };
  scr.portfolio = { title: 'Portfolio', subtitle: '{player.holdings} ' + L.units + ' · average {num(player.avgMoic)}× · {player.winners} above 3×',
    tabs: [{ id: 'all', label: 'Holdings', sections: [{ type: 'table', title: 'Every holding', width: 'full', kind: 'company', owner: 'player', sort: 'it.holdValue', search: true, key: 'port',
        columns: [{ label: 'Company', expr: 'it.name' }, { label: 'Stage', expr: 'it.stage', format: 'text' }, { label: 'Stake', expr: 'it.stake', format: 'pct1' }, { label: 'Invested', expr: 'it.invested', format: 'money' }, { label: 'Value', expr: 'it.holdValue', format: 'money' }, { label: 'Multiple', expr: 'it.moic', format: 'x', tone: "v >= 1 ? 'good' : 'bad'" }, { label: 'Runway (mo)', expr: 'min(99, it.runway)', format: 'int', tone: "v < 6 ? 'bad' : ''" }].concat(control ? [{ label: 'Debt ÷ EBITDA', expr: 'it.debt / max(1, it.ebitda)', format: 'x' }] : []),
        rowActions: control ? ['operationsPlan', 'dividendRecap', 'sellStake', 'ipo'] : ['followOn', 'boardWork', 'sellStake', 'ipo', 'writeOff'] }] },
      { id: 'shape', label: 'Shape of the fund', sections: [
        { type: 'histogram', title: 'Holdings by multiple on invested capital', width: 'half', kind: 'company', owner: 'player', expr: 'it.moic', bins: [0, 0.5, 1, 2, 3, 5, 10], tone: "v >= 3 ? 'good' : v >= 1 ? '' : 'bad'", unit: 'The power law: a few winners pay for everything.' },
        { type: 'mix', title: 'Value by sector', width: 'half', kind: 'company', owner: 'player', groupBy: 'it.sector.name', weight: 'it.holdValue', format: 'money', centerLabel: 'portfolio value' },
        { type: 'showcase', title: 'By stage', width: 'full', kind: 'company', owner: 'player', groupBy: 'it.stage', glyph: 'it.sector.glyph', glyphScale: '0.6', headline: { expr: 'sum(group, it.holdValue)', format: 'money', label: 'your value' }, meters: [{ label: 'Above cost', expr: 'count(group, it.moic >= 1) / max(1, len(group))', format: 'pct', tone: "v < 0.5 ? 'warn' : 'good'" }], stats: [{ label: 'Companies', expr: 'len(group)', format: 'int' }, { label: 'Invested', expr: 'sum(group, it.invested)', format: 'money' }], dots: { tone: "it.moic >= 1 ? 'good' : it.runway < 6 ? 'bad' : 'warn'" } }] }] };
  scr.company.title = 'Firm'; scr.company.subtitle = 'Funds, LPs, partners and policies'; scr.company.actions = ['raiseFund', 'distribute', 'hirePartner', 'borrow', 'repay'];
  scr.company.tabs[1].label = 'LPs & policies';
  scr.company.tabs[0].sections.unshift({ type: 'metrics', width: 'full', key: 'fund', items: [{ label: 'Committed capital', expr: 'player.committed', format: 'money' }, { label: 'TVPI', expr: 'player.tvpi', format: 'x', metric: 'tvpi' }, { label: 'DPI', expr: 'player.dpi', format: 'x', metric: 'dpi' }, { label: 'Deployed', expr: 'player.deployed', format: 'pct' }, { label: 'Partners', expr: 'player.partners', format: 'int', sub: 'capacity {player.capacity} ' + L.units }] });
  scr.industry.sections.splice(2, 0, { type: 'cards', title: 'Sectors', width: 'full', kind: 'sector', sort: 'it.heat', size: 's', glyph: 'it.glyph', glyphScale: '0.3', stats: [{ label: 'Heat', expr: 'it.heat', format: 'x' }, { label: 'Typical growth', expr: 'it.growthBase', format: 'pct' }] });
  gdl.ui = { topbar: [{ label: 'Dry powder', expr: 'player.cash', format: 'money' }, { label: 'NAV', expr: 'player.nav', format: 'money' }, { label: 'TVPI', expr: 'player.tvpi', format: 'x' }, { label: 'LPs', expr: "stake('lps')", format: 'score', explain: 'stake:lps' }],
    nav: [{ id: 'home', label: 'Overview', icon: 'home' }, { id: 'deals', label: 'Deal flow', icon: 'handshake' }, { id: 'portfolio', label: 'Portfolio', icon: 'chart' }, { id: 'company', label: 'Firm', icon: 'bank' }, { id: 'industry', label: 'Market', icon: 'globe' }],
    screens: scr };
  gdl.theme = C.theme(L.motif, { logo: { text: title.split(/\s+/).map(w => w[0]).join('').slice(0, 2) } });
  gdl.onboarding = C.onboarding({ title: 'Welcome, ' + (opts.role || gdl.meta.role), text: control ? `{player.name} has just closed a ${fundM >= 1000 ? '$' + fundM / 1000 + 'B' : '$' + fundM + 'M'} fund. Your LPs expect you to buy, improve and sell — and return real cash.` : `{player.name} has a ${'$' + fundM + 'M'} fund and three seed bets. Most startups fail; your job is to find the few that will not.`,
    bullets: control ? [{ icon: 'merge', title: 'Buy well', text: 'Price ÷ EBITDA, growth and management quality decide your entry.' }, { icon: 'wrench', title: 'Make them better', text: 'Operations plans lift margins; leverage multiplies — both ways.' }, { icon: 'up', title: 'Sell at the right time', text: 'Exit into strong markets. Return cash. Raise the next fund.' }]
      : [{ icon: 'handshake', title: 'Back the outliers', text: 'One great company can return the whole fund.' }, { icon: 'up', title: 'Manage follow-ons', text: 'Reserves are the decision: double down, or spread your bets?' }, { icon: 'alert', title: 'Markets swing', text: 'Valuations and IPO windows open and close with the cycle.' }],
    primaryAction: { id: control ? 'buyCompany' : 'joinRound', label: control ? 'Buy a company' : 'Invest in a round' }, primaryNav: 'deals', unitNoun: L.units });
  gdl.onboarding.steps.splice(3, 0, { text: 'TVPI is total value ÷ committed capital. DPI is cash you actually returned. LPs watch both.', nav: 'company', event: 'nav:company' });
  gdl.newGame = { options: [{ id: 'name', label: 'Firm name', type: 'text', default: gdl.orgs.player.name }] };
  gdl.glossary = [{ term: 'TVPI', text: 'Total value to paid-in capital: (cash + portfolio value + distributions) ÷ committed.' }, { term: 'DPI', text: 'Distributions to paid-in: cash actually returned to LPs ÷ committed.' }, { term: 'Dry powder', text: 'Uninvested capital you can still deploy.' }, { term: 'Follow-on', text: 'Investing again in a company you already own when it raises its next round.' }, { term: 'Runway', text: 'Months until a company runs out of cash at its current burn.' }].concat(control ? [{ term: 'EBITDA', text: 'Operating profit before interest, taxes, depreciation and amortization.' }, { term: 'Leverage', text: 'Acquisition debt as a multiple of EBITDA. Magnifies returns and risk.' }, { term: 'Dividend recap', text: 'Adding debt to a portfolio company to pay the owner a dividend.' }] : [{ term: 'Pre-money', text: 'What the company is worth before the new money comes in.' }, { term: 'Anti-portfolio', text: 'The great companies you passed on.' }]);
  gdl.balance = { knobs: [{ path: 'params.dealFlow', label: 'Deal flow', effect: 'easier', min: 0.04, max: 0.4 }, { path: 'params.failRate', label: 'How fast weak companies fail', effect: 'harder', min: 0.5, max: 2.5 }, { path: 'params.exitPremium', label: control ? 'Asking price premium' : 'Exit premium', effect: control ? 'harder' : 'easier', min: 1, max: 1.6 }, { path: 'params.teamCost', label: 'Team costs', effect: 'harder', min: 30000, max: 120000, phase: 'late' }],
    targets: { smartMargin: [-1, 5], maxGrowth: 6 } };
  gdl.meta.howToPlay = control ? 'Each turn is a month. Find companies on the Deal flow screen and buy them — at the asking price or by negotiating. Financing with debt multiplies your returns and your risk; interest rates move with the economy. Improve holdings with operations plans, recapitalize, and sell or IPO them when markets are strong. Your LPs judge you on TVPI and DPI; keep them happy and raise bigger funds. Policies delegate routine portfolio work.'
    : 'Each turn is a month. Companies on the Deal flow screen are raising money; invest at their terms or negotiate. Most will fail — a few will grow enormously. When your companies raise again, decide whether to follow on (or set a policy). Sell stakes or take companies public when markets are hot. Your LPs judge you on TVPI and DPI; return cash and raise bigger funds. Team quality is an estimate until you work closely with a company.';
  return gdl;
}

const FEATURES = [
  { id: 'dealflow', label: 'A living market of companies raising money', keywords: ['startups', 'startup', 'companies', 'deal flow', 'source', 'sourcing', 'evaluate', 'deals'], paths: ['kinds.company', 'kinds.sector'] },
  { id: 'terms', label: 'Term sheets and negotiated buyouts', keywords: ['term sheet', 'term sheets', 'negotiate', 'negotiations', 'valuation', 'terms'], paths: ['negotiations'] },
  { id: 'portfolio', label: 'Portfolio support, follow-ons and fixes', keywords: ['portfolio', 'board', 'boards', 'follow on', 'follow-on', 'operational', 'operations', 'improvement', 'management'], paths: ['actions', 'policies.followOns', 'policies.support'] },
  { id: 'exits', label: 'Exits: sales and IPOs', keywords: ['exit', 'exits', 'ipo', 'ipos', 'sell', 'sale', 'write off', 'write-off'], paths: ['actions.sellStake', 'actions.ipo'] },
  { id: 'lps', label: 'Fundraising from LPs (TVPI, DPI)', keywords: ['lp', 'lps', 'limited partners', 'raise funds', 'fund', 'funds', 'investors', 'track record'], paths: ['negotiations.fundraise', 'stakeholders.lps'], flag: 'lps' },
  { id: 'leverage', label: 'Leverage, refinancing and interest rates', keywords: ['leverage', 'debt', 'refinance', 'refinancing', 'interest rates', 'credit', 'lbo', 'buyout', 'buyouts'], paths: ['world.vars.rates'] },
  { id: 'cycles', label: 'Market cycles, sentiment and IPO windows', keywords: ['cycle', 'cycles', 'market', 'recession', 'sentiment', 'credit cycles'], paths: ['world.cycle', 'world.vars.sentiment'], flag: 'recessions' },
  { id: 'anti', label: 'Anti-portfolio of deals you passed on', keywords: ['anti-portfolio', 'anti portfolio', 'passed'], paths: ['events.hotDeal', 'events.auction'], flag: 'antiPortfolio' },
  { id: 'rivals', label: 'Rival firms with strategies', keywords: ['rivals', 'competitors', 'competition', 'other firms'], paths: ['orgs.rivals'] },
  { id: 'history', label: 'History, records and awards', keywords: ['history', 'records', 'track record', 'legacy'], paths: ['history'] }
];
module.exports = { id: 'portfolio', loop: 'deal-and-portfolio', genres: Object.keys(LEX).filter(k => k !== 'generic'), build, FEATURES, LEX };
