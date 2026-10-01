/* Remaster / Expand intake: analyze an existing HTML game WITHOUT running it and build a feature
   inventory (core, useful, redundant, confusing, cosmetic, broken, automate). The inventory becomes
   must-keep requirements for the new build, so "less overwhelming" never means "remove half the
   simulation". Heuristic and local; a local model can refine the inventory when available. */
'use strict';
const compiler = require('./compiler');

const SYSTEMS = [
  { id: 'saves', label: 'Save / load', re: /localStorage|indexedDB|saveGame|loadGame|save slot/i, cat: 'core' },
  { id: 'commissioner', label: 'Commissioner / god mode', re: /commissioner|god ?mode|sandbox|cheat/i, cat: 'useful' },
  { id: 'negotiation', label: 'Negotiations', re: /negotiat|counter-?offer|haggl|walk away/i, cat: 'core' },
  { id: 'contracts', label: 'Contracts', re: /contract/i, cat: 'core' },
  { id: 'finance', label: 'Finance (loans, debt, interest)', re: /\bloan|interest rate|debt|credit/i, cat: 'core' },
  { id: 'market', label: 'Market / demand model', re: /demand|market share|elasticity|logit|segment/i, cat: 'core' },
  { id: 'rivals', label: 'Rivals / AI competitors', re: /rival|competitor|opponent|\bAI\b/i, cat: 'core' },
  { id: 'events', label: 'Random / story events', re: /event|crisis|scandal|incident/i, cat: 'useful' },
  { id: 'history', label: 'History, records, hall of fame', re: /hall of fame|record book|history|all-time|legacy/i, cat: 'useful' },
  { id: 'staff', label: 'Staff / people management', re: /hire|fire|staff|employee|coach|scout|agent/i, cat: 'core' },
  { id: 'scouting', label: 'Scouting / hidden information', re: /scout|potential|fog|estimate/i, cat: 'useful' },
  { id: 'calendar', label: 'Calendar / time controls', re: /advance|next day|next week|sim(ulate)? to|calendar/i, cat: 'core' },
  { id: 'news', label: 'News feed', re: /news|headline|press/i, cat: 'cosmetic' },
  { id: 'charts', label: 'Charts and graphs', re: /<svg|canvas|chart/i, cat: 'cosmetic' },
  { id: 'tutorial', label: 'Tutorial / onboarding', re: /tutorial|onboard|welcome|how to play/i, cat: 'useful' },
  { id: 'delegation', label: 'Delegation / automation', re: /auto-?(repay|refi|sign|draft|price|manage)|delegat|policy/i, cat: 'useful' },
  { id: 'inbox', label: 'Inbox / tasks', re: /inbox|to-?do|task/i, cat: 'useful' },
  { id: 'macro', label: 'Economic cycle / macro', re: /recession|inflation|economy|cycle|interest rates/i, cat: 'core' },
  { id: 'projects', label: 'Projects with stages', re: /pipeline|development|stage|greenlight|pre-?production/i, cat: 'core' },
  { id: 'achievements', label: 'Achievements', re: /achievement|trophy|badge/i, cat: 'cosmetic' },
  { id: 'draft', label: 'Draft / recruiting', re: /\bdraft\b|recruit/i, cat: 'core' },
  { id: 'trades', label: 'Trades / M&A', re: /\btrade\b|acquisition|acquire|merger/i, cat: 'core' }
];

function stripHtml(s) { return s.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '); }
function analyzeHtml(html, name = 'game.html') {
  const text = String(html);
  const title = (text.match(/<title>([^<]{1,120})<\/title>/i) || [])[1] || name.replace(/\.html?$/i, '');
  const scripts = (text.match(/<script[\s\S]*?<\/script>/gi) || []).join('\n');
  const visible = stripHtml(text);
  const fns = (scripts.match(/function\s+([A-Za-z_$][\w$]*)/g) || []).map(s => s.replace(/function\s+/, ''));
  const navGuess = new Set((scripts.match(/(?:show(?:Page|Tab|Screen|View)|nav(?:igate)?|goTo|setTab|switchTab|openTab)\(\s*['"]([\w-]+)['"]/g) || []).map(s => s.replace(/.*\(\s*['"]|['"]$/g, '')));
  const dataTab = new Set((text.match(/data-(?:tab|page|view|nav|screen)=["']([\w-]+)["']/g) || []).map(s => s.replace(/.*=["']|["']$/g, '')));
  const goCalls = new Set((scripts.match(/\b(?:go|route|openPage|setView|showSection)\(\s*['"]([\w-]+)['"]/g) || []).map(s => s.replace(/.*\(\s*['"]|['"]$/g, '')));
  const navObjs = new Set((scripts.match(/\b(?:id|page|view|key|screen)\s*:\s*['"]([\w-]+)['"]\s*,\s*(?:label|name|title|icon)\s*:/g) || []).map(s => s.replace(/^[^'"]*['"]|['"][\s\S]*$/g, '')));
  const screens = [...new Set([...navGuess, ...dataTab, ...goCalls, ...(navObjs.size < 80 ? navObjs : [])])];
  const external = [...new Set((text.match(/(?:src|href)=["'](https?:\/\/[^"']+)["']/g) || []).map(s => s.replace(/^(?:src|href)=["']|["']$/g, '').replace(/^(https?:\/\/[^/]+).*/, '$1')))];
  const systems = SYSTEMS.map(s => { const m = scripts.match(new RegExp(s.re.source, 'gi')) || []; const v = visible.match(new RegExp(s.re.source, 'gi')) || []; return { id: s.id, label: s.label, hits: m.length + v.length, category: s.cat }; }).filter(s => s.hits >= 3);
  // inventory categories with simple, explainable rules
  const inv = { core: [], useful: [], redundant: [], confusing: [], cosmetic: [], broken: [], automate: [] };
  for (const s of systems) inv[s.category].push(`${s.label} (${s.hits} references)`);
  if (screens.length > 12) inv.confusing.push(`${screens.length} navigation destinations — consolidate into ≤7 task-based screens`);
  const overlaps = ['inbox', 'news', 'events'].filter(id => systems.some(s => s.id === id));
  if (overlaps.length >= 3) inv.redundant.push('Inbox, news and event feeds overlap — merge into one “Needs you” queue + one news feed');
  if (systems.some(s => s.id === 'commissioner') && /infinite (money|cash)|unlimited (money|cash|budget)|cheat ?mode|toggleCheat|cheats?\s*[:=]/i.test(scripts)) inv.confusing.push('Commissioner implemented as cheat toggles — rebuild as a real editor of the simulation');
  for (const s of systems) if (['contracts', 'staff', 'finance', 'market'].includes(s.id)) inv.automate.push(`Routine ${s.label.toLowerCase()} → delegation policies`);
  if (external.length) inv.broken.push(`Depends on external resources offline players may not have: ${external.slice(0, 4).join(', ')}`);
  const todo = (scripts.match(/\b(TODO|FIXME|coming soon|not implemented)\b/gi) || []).length;
  if (todo) inv.broken.push(`${todo} unfinished markers (TODO / coming soon)`);
  const genre = compiler.classifyGenre(visible.slice(0, 200000) + ' ' + title);
  return {
    name, title, bytes: text.length, functions: fns.length, screens, external, systems, inventory: inv, genre,
    architecture: fns.length > 300 && (text.match(/<script/gi) || []).length <= 3 ? `single file, ~${fns.length} global functions` : `${(text.match(/<script/gi) || []).length} script blocks, ${fns.length} functions`,
    sampleText: visible.slice(0, 1500)
  };
}
/* Turn an analysis into a prompt + must-keep requirements for the create pipeline. */
function remasterPrompt(an, userRequest) {
  const keep = an.inventory.core.concat(an.inventory.useful).map(x => x.replace(/ \(\d+ references\)$/, ''));
  const lines = [
    `Remaster of “${an.title}”. ${userRequest || 'Substantially improve the game design, UI, visual identity, onboarding, balance, architecture and performance.'}`,
    '',
    `Keep every system of the original. Must keep: ${keep.join(', ')}.`,
    an.inventory.automate.length ? `Automate where possible: ${an.inventory.automate.join('; ')}.` : '',
    an.inventory.confusing.length ? `Fix: ${an.inventory.confusing.join('; ')}.` : '',
    an.inventory.redundant.length ? `Merge: ${an.inventory.redundant.join('; ')}.` : '',
    'It must have the same or greater strategic depth with lower cognitive friction. Deep but not overwhelming. Commissioner mode. History and records.'
  ].filter(Boolean);
  return lines.join('\n');
}
module.exports = { analyzeHtml, remasterPrompt, SYSTEMS };
