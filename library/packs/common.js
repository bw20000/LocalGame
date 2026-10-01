/* Shared design building blocks used by genre packs and archetype designs. Each helper returns
   plain Game Definition fragments; designs compose them and override anything genre-specific. */
'use strict';

const MOTIFS = {
  'departure-board': { mode: 'light', fonts: { display: 'condensed', body: 'sans', mono: 'board' }, palette: { bg: '#eef1f4', surface: '#ffffff', surface2: '#e8edf2', ink: '#0f1924', ink2: '#2e3c4b', muted: '#687685', line: '#d4dbe3', accent: '#0b5fa5', accentInk: '#ffffff', accent2: '#f2a516', good: '#1f8a55', bad: '#c2412d', warn: '#c98a12', band: '#0d1620', bandInk: '#e9eef3' } },
  playbill: { mode: 'light', fonts: { display: 'didone', body: 'humanist', mono: 'mono' }, palette: { bg: '#f3ecdc', surface: '#fbf7ec', surface2: '#efe4cc', ink: '#1c1410', ink2: '#3d2f26', muted: '#7d6b5c', line: '#d8c7a6', accent: '#8f1d2c', accentInk: '#fff6e5', accent2: '#e2b23a', good: '#2f7a46', bad: '#b0302a', warn: '#b7791f', band: '#1c1410', bandInk: '#f3ecdc' } },
  broadcast: { mode: 'dark', fonts: { display: 'condensed', body: 'sans', mono: 'mono' }, palette: { bg: '#0d1117', surface: '#151b24', surface2: '#1d2531', ink: '#f1f4f8', ink2: '#cfd6df', muted: '#8b97a6', line: '#283241', accent: '#e63946', accentInk: '#ffffff', accent2: '#ffd166', good: '#3ccf8e', bad: '#ff6b5e', warn: '#ffc145', band: '#0a0d12', bandInk: '#f1f4f8' } },
  editorial: { mode: 'light', fonts: { display: 'serif', body: 'serif', mono: 'mono' }, palette: { bg: '#f7f5ef', surface: '#fdfcf8', surface2: '#efece2', ink: '#151515', ink2: '#333333', muted: '#6e6a62', line: '#d9d4c7', accent: '#1a1a1a', accentInk: '#fdfcf8', accent2: '#b5302a', good: '#2b6e3f', bad: '#b5302a', warn: '#a8701a', band: '#151515', bandInk: '#f7f5ef' } },
  blueprint: { mode: 'light', texture: 'grid', fonts: { display: 'geometric', body: 'sans', mono: 'mono' }, palette: { bg: '#eef4f8', surface: '#f8fbfd', surface2: '#e2edf4', ink: '#0d2333', ink2: '#284459', muted: '#5f7a8c', line: '#bcd2e0', accent: '#1565a8', accentInk: '#ffffff', accent2: '#f08a24', good: '#21875a', bad: '#c43d2b', warn: '#c98a12', band: '#0d2333', bandInk: '#eef4f8' } },
  ledger: { mode: 'light', fonts: { display: 'serif', body: 'sans', mono: 'mono' }, palette: { bg: '#f1f3ee', surface: '#fbfcf8', surface2: '#e7ece1', ink: '#13201a', ink2: '#2f4038', muted: '#66766d', line: '#cdd8cc', accent: '#1f5f43', accentInk: '#ffffff', accent2: '#b58b2a', good: '#1f7a49', bad: '#b33b2e', warn: '#a8701a', band: '#13201a', bandInk: '#f1f3ee' } },
  'menu-card': { mode: 'light', texture: 'paper', fonts: { display: 'didone', body: 'humanist', mono: 'mono' }, palette: { bg: '#f5efe4', surface: '#fffaf1', surface2: '#f1e7d6', ink: '#24170f', ink2: '#47352a', muted: '#86705f', line: '#e0cfb6', accent: '#7a2e1f', accentInk: '#fffaf1', accent2: '#5e7a3a', good: '#4c7a32', bad: '#a8321f', warn: '#b7791f', band: '#24170f', bandInk: '#f5efe4' } },
  terminal: { mode: 'dark', fonts: { display: 'mono', body: 'sans', mono: 'mono' }, palette: { bg: '#0a0f0c', surface: '#0f1712', surface2: '#15211a', ink: '#d9f2e3', ink2: '#b5d6c2', muted: '#6f8f7c', line: '#1f3327', accent: '#39d98a', accentInk: '#04140b', accent2: '#ffb347', good: '#39d98a', bad: '#ff6b6b', warn: '#ffb347', band: '#050806', bandInk: '#d9f2e3' } },
  'deal-room': { mode: 'light', fonts: { display: 'serif', body: 'sans', mono: 'mono' }, palette: { bg: '#f2f1ed', surface: '#fcfbf8', surface2: '#e9e6de', ink: '#141a2a', ink2: '#2c3550', muted: '#6a7083', line: '#d6d3c9', accent: '#1d2d5c', accentInk: '#ffffff', accent2: '#b8862b', good: '#25734b', bad: '#a8352b', warn: '#a8701a', band: '#141a2a', bandInk: '#f2f1ed' } },
  atelier: { mode: 'light', fonts: { display: 'didone', body: 'humanist', mono: 'mono' }, palette: { bg: '#f6f4f1', surface: '#ffffff', surface2: '#eeebe6', ink: '#0b0b0b', ink2: '#2b2b2b', muted: '#7a756f', line: '#dcd7cf', accent: '#0b0b0b', accentInk: '#ffffff', accent2: '#b0124e', good: '#2c6e49', bad: '#b0124e', warn: '#9c6d12', band: '#0b0b0b', bandInk: '#f6f4f1' } },
  resort: { mode: 'light', fonts: { display: 'geometric', body: 'sans', mono: 'mono' }, palette: { bg: '#eef6f5', surface: '#ffffff', surface2: '#e3f0ee', ink: '#10292a', ink2: '#2a4a4b', muted: '#5f7e7e', line: '#cfe3e0', accent: '#0f7c7a', accentInk: '#ffffff', accent2: '#f28c5b', good: '#2a8a57', bad: '#c9472f', warn: '#d0901a', band: '#10292a', bandInk: '#eef6f5' } },
  paddock: { mode: 'dark', texture: 'carbon', fonts: { display: 'condensed', body: 'sans', mono: 'mono' }, palette: { bg: '#0e0f11', surface: '#16181c', surface2: '#1e2127', ink: '#f2f3f5', ink2: '#cfd2d8', muted: '#8a9099', line: '#2a2e35', accent: '#ff2d2d', accentInk: '#ffffff', accent2: '#00c2ff', good: '#2fd17c', bad: '#ff5c5c', warn: '#ffbf3c', band: '#08090a', bandInk: '#f2f3f5' } }
};
function theme(motif, overrides = {}) {
  const m = MOTIFS[motif] || MOTIFS.editorial;
  return Object.assign({ motif: MOTIFS[motif] ? motif : 'editorial', layout: 'sidebar', radius: motif === 'resort' ? 14 : 6, mode: m.mode, texture: m.texture || 'none', fonts: m.fonts, palette: m.palette }, overrides);
}

function cycle({ boom = 1.05, slow = 0.97, bust = 0.86, recession = true } = {}) {
  return {
    start: 'expansion',
    phases: [
      { id: 'expansion', label: 'Expansion', demand: boom, credit: -0.005, minTicks: '52 * 2', maxTicks: '52 * 6', next: { slowdown: 1 }, news: 'The economy is expanding; customers are spending' },
      { id: 'slowdown', label: 'Slowdown', demand: slow, credit: 0.005, minTicks: 20, maxTicks: 70, next: { recession: recession ? 0.6 : 0, expansion: 0.4 }, news: 'Growth slows; customers grow cautious' },
      { id: 'recession', label: 'Recession', demand: bust, credit: 0.02, minTicks: 26, maxTicks: 78, next: { recovery: 1 }, news: 'Recession: demand falls across the industry', severity: 'bad', event: recession ? 'recessionBoard' : undefined },
      { id: 'recovery', label: 'Recovery', demand: 0.97, credit: 0.005, minTicks: 26, maxTicks: 60, next: { expansion: 1 }, news: 'Recovery: customers are coming back' }
    ]
  };
}
function financeActions() {
  return [
    { id: 'borrow', label: 'Borrow', verb: 'Borrow', category: 'finance', icon: 'bank', describe: 'Take a term loan. Rates depend on the economy and your leverage.',
      params: [{ id: 'amount', label: 'Amount', type: 'money', min: 'max(100000, borrowRoom(org) * 0.05)', max: 'max(100000, borrowRoom(org))', default: 'max(100000, borrowRoom(org) * 0.4)' }, { id: 'years', label: 'Term (years)', type: 'int', min: 2, max: 10, default: 5 }],
      requires: [{ expr: 'borrowRoom(org) >= 100000', msg: 'Lenders will not extend more credit right now' }],
      preview: [{ label: 'Interest rate', expr: 'rateFor(org)', format: 'pct1' }, { label: 'Borrowing room', expr: 'borrowRoom(org)', format: 'money' }],
      effects: [{ op: 'loan', amount: 'param.amount', years: 'param.years' }], result: 'Borrowed {money(param.amount)}' },
    { id: 'repay', label: 'Repay debt', verb: 'Repay', category: 'finance', icon: 'bank',
      params: [{ id: 'amount', label: 'Amount', type: 'money', min: 'min(100000, max(1, org.debt))', max: 'max(100000, min(org.debt, org.cash))', default: 'max(100000, min(org.debt, org.cash * 0.3))' }],
      requires: [{ expr: 'org.debt > 0', msg: 'No debt to repay' }, { expr: 'org.cash > 0', msg: 'No cash to repay with' }],
      effects: [{ op: 'repay', amount: 'param.amount' }], result: 'Repaid debt' }
  ];
}
function board(marginExpr = 'org.profitYear / max(1, org.revenueYear)') {
  return {
    stakeholder: { id: 'board', label: 'Board confidence', start: 60, base: '55', speed: 0.05, describe: 'Your directors and investors. Lose them and you lose the job.',
      drivers: [
        { label: 'Profitability', expr: `time.tick < 26 ? 0 : clamp((${marginExpr} - 0.04) * 250, -25, 20)` },
        { label: 'Cash position', expr: 'org.cash < 0 ? -15 : 3' },
        { label: 'Growth tier', expr: 'tierIndex() * 4' }
      ], thresholds: [{ below: 25, event: 'boardUltimatum', cooldown: 26 }] },
    event: { id: 'boardUltimatum', trigger: 'scheduled', priority: 'critical', title: 'The board loses patience',
      text: 'Confidence is down to {int(stake("board"))}. Directors want results this year — or a new chief.',
      choices: [
        { label: 'Announce a cost-cutting plan', describe: 'Morale and quality will suffer.', effects: [{ op: 'stake', id: 'board', add: '15' }, { op: 'set', path: 'player.costDiscipline', value: 'player.costDiscipline + 0.04' }], result: 'Cost-cutting plan approved' },
        { label: 'Sell a non-core asset', describe: 'Cash now; a smaller company.', effects: [{ op: 'cash', amount: 'max(1000000, player.value * 0.06)', category: 'Asset sales' }, { op: 'stake', id: 'board', add: '8' }], result: 'Asset sale approved' },
        { label: 'Ask for more time', effects: [{ op: 'chance', p: '0.5', then: [{ op: 'stake', id: 'board', add: '6' }], else: [{ op: 'stake', id: 'board', add: '-6' }] }], result: 'You ask the board for patience' }
      ] }
  };
}
function failure({ unit = 'assets', sellExpr = 'player.value * 0.15' } = {}) {
  return {
    when: "player.cash < -creditLimit(player) || stake('board') < 6", grace: 10, warningTitle: 'Crisis at the top',
    warning: 'Lenders are calling and the board is meeting without you. Pick a rescue plan within ten weeks.',
    gameOver: 'The board has replaced you. {player.name} will carry on without you.',
    rescue: [
      { id: 'equity', label: 'Emergency equity from investors', describe: 'Raise {money(max(2000000, player.value * 0.25))}; investors take a big stake and the board loses faith.', once: true, effects: [{ op: 'cash', amount: 'max(2000000, player.value * 0.25)', category: 'Equity' }, { op: 'stake', id: 'board', add: '15' }] },
      { id: 'fireSale', label: `Sell ${unit} at a discount`, describe: 'Raise cash quickly; the company shrinks.', effects: [{ op: 'cash', amount: sellExpr, category: 'Asset sales' }, { op: 'stake', id: 'board', add: '8' }] },
      { id: 'restructure', label: 'Court-supervised restructuring', describe: 'Halve your debts. Reputation suffers.', once: true, effects: [{ op: 'forgiveDebt', fraction: '0.5' }, { op: 'resource', id: 'reputation', add: '-15' }, { op: 'stake', id: 'board', add: '20' }] }
    ]
  };
}
function objectives(extra = []) {
  return {
    count: 3,
    templates: [
      { id: 'margin', text: 'Deliver an operating margin of at least {pct(target)}', metric: 'player.profitYear / max(1, player.revenueYear)', target: 'max(0.03, min(0.15, base + 0.02))', weight: 2, reward: [{ op: 'stake', id: 'board', add: '12' }], penalty: [{ op: 'stake', id: 'board', add: '-14' }] },
      { id: 'growth', text: 'Grow annual revenue to {money(target)}', metric: 'player.revenueYear', target: 'max(base * 1.2, base + 1000000)', weight: 2, reward: [{ op: 'stake', id: 'board', add: '10' }], penalty: [{ op: 'stake', id: 'board', add: '-10' }] },
      { id: 'value', text: 'Raise company value to {money(target)}', metric: 'player.value', target: 'base * 1.15', reward: [{ op: 'stake', id: 'board', add: '8' }], penalty: [{ op: 'stake', id: 'board', add: '-8' }] },
      { id: 'reputation', text: 'Reach a reputation of {int(target)}', metric: 'player.reputation', target: 'min(95, base + 8)', reward: [{ op: 'stake', id: 'board', add: '6' }], penalty: [{ op: 'stake', id: 'board', add: '-5' }] }
    ].concat(extra)
  };
}
function history({ unitLabel = 'units', unitMetric = 'org.units', awardName = 'Company of the Year', awardScore = 'org.reputation + org.profitYear / max(1, org.revenueYear) * 100' } = {}) {
  return {
    records: [
      { id: 'value', label: 'Most valuable company', expr: 'org.value', format: 'money' },
      { id: 'profitYear', label: 'Highest annual profit', expr: 'org.profitYear', format: 'money', period: 'year' },
      { id: 'size', label: `Most ${unitLabel}`, expr: unitMetric, format: 'int' }
    ],
    awards: [{ id: 'coty', label: awardName, score: awardScore, noise: 2, prize: [{ op: 'resource', id: 'reputation', add: '4' }] }],
    milestones: [
      { id: 'profitYear', label: 'First profitable year', when: 'time.tick >= 52 && player.profitYear > 0', text: 'A full year in the black.' },
      { id: 'tier2', label: 'Moving up', when: 'tierIndex() >= 1', text: 'Your company has grown into the next league.', moment: false }
    ]
  };
}
function recessionEvent(cutLabel = 'Cut the weakest operations') {
  return { id: 'recessionBoard', trigger: 'scheduled', priority: 'critical', title: 'Recession: the board wants a plan',
    text: 'Demand is falling across the industry. Cash: {money(player.cash)}; last year\'s profit: {money(player.profitYear)}.',
    choices: [
      { label: cutLabel, describe: 'Smaller but safer.', effects: [{ op: 'set', path: 'player.costDiscipline', value: 'player.costDiscipline + 0.05' }, { op: 'stake', id: 'board', add: '8' }, { op: 'resource', id: 'reputation', add: '-2' }], result: 'Cost cuts approved' },
      { label: 'Discount to keep customers', describe: 'Protects your reputation, hurts margins.', effects: [{ op: 'set', path: 'player.priceLevel', value: 'max(0.75, player.priceLevel * 0.92)' }, { op: 'resource', id: 'reputation', add: '3' }], result: 'Recession discounts launched' },
      { label: 'Hold course', effects: [{ op: 'stake', id: 'board', add: '-10' }], result: 'You hold course' }
    ] };
}
function standardScreens({ homeTitle = '{player.name}', homeSubtitle = '', goal, metrics = [], signature = [], primary = [], extraHome = [] } = {}) {
  return {
    home: { title: homeTitle, subtitle: homeSubtitle, actions: primary,
      sections: [{ type: 'goal', width: 'full', text: goal }, { type: 'needs', width: 'half' }, { type: 'metrics', width: 'half', key: 'home', items: metrics }].concat(signature, [{ type: 'objectives', width: 'half' }, { type: 'upcoming', width: 'half' }], extraHome, [{ type: 'world', width: 'half' }, { type: 'feed', title: 'Latest', width: 'half', limit: 7, mine: true }]) },
    company: { title: 'Company', subtitle: 'Money, the board and how your teams work', actions: ['borrow', 'repay'],
      tabs: [
        { id: 'money', label: 'Finances', sections: [{ type: 'ledger', width: 'half' }, { type: 'finance', width: 'half' }, { type: 'chart', width: 'full', title: 'Cash and profit', series: [{ label: 'Cash', ledger: 'cash' }, { label: 'Profit per turn', ledger: 'profit' }], format: 'money', window: 104 }] },
        { id: 'people', label: 'Board & policies', sections: [{ type: 'stakeholders', width: 'half' }, { type: 'resources', width: 'half' }, { type: 'policies', width: 'full' }, { type: 'negotiations', width: 'half' }] }
      ] },
    industry: { title: 'Industry', subtitle: 'Competitors and the wider economy',
      sections: [{ type: 'world', width: 'half' }, { type: 'rankings', width: 'half', title: 'Most valuable', metric: 'org.m.value', format: 'money' }, { type: 'rivals', width: 'full' }, { type: 'feed', width: 'full', title: 'Rival moves', tag: 'rival', includeBackground: true, limit: 14 }] }
  };
}
function onboarding({ title, text, bullets, primaryAction, primaryNav, unitNoun = 'units' }) {
  return {
    intro: { title, text, bullets, button: 'Take the controls' },
    steps: [
      { text: `Make your first move: use “${primaryAction.label}”.`, target: 'action:' + primaryAction.id, nav: primaryNav, event: 'acted:' + primaryAction.id },
      { text: 'Advance time with the Next button (or Space). Results arrive each turn.', target: 'advance', done: 'time.tick >= 1' },
      { text: `Click any of your ${unitNoun} to see what drives its results.`, event: 'inspect' },
      { text: 'Policies let your teams handle routine work. Check them under Company.', nav: 'company', event: 'nav:company' },
      { text: 'Meet the board\'s objectives and watch the “Needs you” list. The rest is strategy.', done: 'time.tick >= 3' }
    ]
  };
}
module.exports = { MOTIFS, theme, cycle, financeActions, board, failure, objectives, history, recessionEvent, standardScreens, onboarding };
