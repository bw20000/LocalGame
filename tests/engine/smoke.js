const { loadEngine } = require('../../engine/node.js');
const E = loadEngine();
const gdl = require('./tiny.gdl.json');
const g = E.Game.create(gdl, { seed: 7, headless: true });
const p = g.playerOrg();
console.log('orgs', Object.values(g.state.orgs).map(o => `${o.name}[L${o.level}] ${o.archetype||''} cash=${Math.round(o.cash)}`).join(' | '));
console.log('stands', g.all('stand').map(s => `${s.name}@${s.street} ${g.state.orgs[s.owner].name}`).join(', '));
const pr = g.previewAction(g.actionDef('openStand'), p, null, g.resolveParams(g.actionDef('openStand'), {street:'oak'}, p));
console.log('preview', JSON.stringify(pr.items), pr.ok, pr.why);
console.log('act', g.act('openStand', { street: 'oak' }));
for (let i = 0; i < 52; i++) { const r = g.tick(); for (const ev of g.state.events.pending.slice()) g.resolveEvent(ev.iid, 1); }
console.log('after 1y: cash', Math.round(p.cash), 'rev/yr', Math.round(p.m.revenueYear), 'profit/yr', Math.round(p.m.profitYear), 'tier', g.state.progression.tier, 'rep', p.res.reputation.toFixed(1), 'phase', g.state.world.phase, 'sugar', g.state.world.vars.sugar.toFixed(2));
console.log('stands', g.all('stand').map(s => `${s.street}:${(g.state.orgs[s.owner]||{}).name} sold=${Math.round(s._sold||0)} profit=${Math.round(s._profit||0)}`).join(' | '));
console.log('news', g.state.news.slice(0, 8).map(n => n.text));
console.log('awards', g.state.history.awards, 'records', g.state.history.records, 'milestones', g.state.history.milestones);
console.log('errors', g.diag.errors);
const json = g.serialize(); const g2 = E.Game.load(gdl, json, {headless:true}); g2.tick(); console.log('reload ok', g2.state.tick, json.length, 'bytes');
