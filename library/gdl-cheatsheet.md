# GDL cheat sheet (Game Definition Language) — for design stages

A game is ONE JSON object. Formulas are strings in a safe JS-like expression language.

## Expression language
- Numbers `1.5M`, `20k`; strings `'text'`; `and or not`, `? :`, `??`, `== != < <= > >=`, `+ - * / % **`.
- Roots: `self` (current entity), `org` (acting company), `player`, `world` (vars + `world.demand`, `world.phase`, `world.season`), `params`, `time` (`tick, year, month, week, yearsElapsed`), `param` (action params), `fc` (forecast result), `it` (item in lambdas), `outer` (enclosing `it`), `them` (negotiation counterparty), `terms` (offer terms), `p` (project data).
- Entity fields: `self.price`; ref fields auto-resolve: `self.city.pop`. `self.owner` → company. Company: `org.cash, org.debt, org.reputation (resource), org.revenueYear, org.profitYear, org.value, org.<metric id>`.
- Functions: `min max clamp abs round floor ceil sqrt log exp pow lerp sigmoid rand randn randInt chance pick`; lists: `count(src, cond)`, `sum(src, expr, cond)`, `avg`, `maxOf`, `minOf`, `find`, `filter`, `any`, `all`, `sortBy`, `top(src, expr, n)`, `map`, `distinct`, `concat`, `len`; where `src` is a kind name `'route'` or a list. `owned('kind')` (acting company's), `refs('aircraft', 'route', x)` (entities whose field points at x), `where(kind, field, value)`, `ownsAt(kind, field, value)`, `get(kind, id)`, `distance(a, b)` (km, lat/lon), `pairKey(a, b)`, `rivals()`, `stake(id)`, `res(id)`, `tierIndex()`, `tierAtLeast(id)`, `policy(id)`, `creditLimit(org)`, `borrowRoom(org)`, `rateFor(org)`, `projectsOf(org)`, `est(entity, field)`; text: `money pct int num signed name date`.
- Templates: `"Opened {param.city.name} for {money(cost)}"` or `{x|money}`.

## Top level
`gdl:1, meta{id,title,tagline,genre,role,fantasy[],pillars[],universe,disclaimer,goal,howToPlay}, time{unit:'week'|'month'|'day', start}, params{}, world{vars[],cycle{phases[]},seasonality[12]}, resources[], kinds{}, markets{}, orgs{}, actions[], policies[], projects[], negotiations[], stakeholders[], events[], progression{tiers[],objectives,failure,victory[]}, history{records[],awards[],milestones[]}, needs[], ui{topbar[],nav[],screens{}}, theme{}, onboarding{intro,steps[]}, newGame{options[]}, glossary[]`.

## kinds.<id>
`{label, plural, records:[{id,name,...}] (static catalog), fields:{f:{type:number|int|money|pct|text|enum|ref|bool, ref, default, min, max, label, hidden}}, derived:{f:"expr"}, generate:{count, set{}}, upkeep:[{label, expr, when, nonCash}], operate:{market, capacity, price, attrs{name:"expr"}, revenue[{label,expr}], costs[{label,expr}], after:[ops]}, display:{title, subtitle, glyph, stats[{label,expr,format}]}, explain:{drivers[{label,expr}]}}`. Operating units sell capacity in `markets.<id>`; per-unit results appear as `self._sold _demand _cap _load _rev _cost _profit`.

## markets.<id>
`{key:"expr grouping competing units", size:"expr total demand per tick", refPrice, outside:"utility of not buying", segments:[{id,label,size:"expr using size", priceSens, priceMult, capShare, weights:{attr:w}}]}` — logit choice over `operate.attrs`.

## orgs
`{label, plural, fields{}, metrics[{id,label,expr,format}], valuation, assets, costs[{label,expr}], tick:[ops], player:{name, cash, set{}, start:[ops]}, rivals:{count{full,light,background}, archetypes:[{id,label,risk,tempo,cash,set{},policies{},weights{actionId:w}, start:[ops]}], entryChance}}`.

## actions[]
`{id, label, verb, kind? (entity action), category, icon, primary, tier, describe, tradeoff, risk, params:[{id,label,type:entity|org|choice|number|money|int|pct|bool|text, kind, filter, sort, options[{value,label,describe}], min, max, default}], vars{}, requires:[{expr,msg}], cost{cash}, capex, forecast{kind,set{}}, preview:[{label,expr,format}], effects:[ops], result, cooldown, ai{score, candidates, news}}`.

## Effect ops (effects, choices, onAccept…)
`{op:'set'|'add'|'mul', path:'self.field', value}` · `{op:'set', target:'param.x', field, value}` · `{op:'cash', amount, category}` · `{op:'resource', id, add}` · `{op:'stake', id, add}` · `{op:'create', kind, set{}, as}` · `{op:'remove', target}` · `{op:'transfer', target, to}` · `{op:'project', id, set{}, name}` · `{op:'negotiate', id, with}` · `{op:'event', id, delay, bind{}}` · `{op:'news', text}` · `{op:'moment', title, text}` · `{op:'if', cond, then[], else[]}` · `{op:'chance', p, then[], else[]}` · `{op:'each', list|kind, filter, as, do[]}` · `{op:'loan', amount, years}` · `{op:'repay', amount}` · `{op:'acquireOrg', target}` · `{op:'remember', a, b, key, add}` · `{op:'policy', id, value}` · `{op:'autoAct', action, max}` (staff perform an action) · `{op:'let', name, value}` · `{op:'flag', name}`.

## events[]
`{id, title, text, priority:critical|important|routine|background, chance:"per-tick prob", when, cooldown, once, bind:{name:{kind, owner:'player'|'rival', filter, pick:'random'|'max'|'min', by}}, choices:[{label, describe, cost, requires, effects[], result, track}], effects[] (no-choice events), news}` — at least 2 meaningfully different choices; reference bound entities and real numbers.

## Other
policies `[{id,label,describe,scope:'org'|'kind:x',default,options:[{value,label,describe,effects[]}]}]`; stakeholders `[{id,label,start,base,speed,drivers[{label,expr}],thresholds[{below|above,event}]}]`; negotiations `[{id,label,with,patience,terms[{id,label,type,default,min,max}],value,reservation,counter{term},reasons[{when,text}],onAccept[],onReject[]}]`; projects `[{id,label,stages[{id,label,duration,cost,risk{chance,effects}}],onComplete[]}]`; progression tiers `[{id,label,when,text}]`, objectives `{count, templates[{id,text,metric,target,reward[],penalty[]}]}`, failure `{when, grace, rescue[{id,label,describe,effects,once}]}`.
UI: `ui.nav` ≤ 7 items `{id,label,icon}`; `ui.screens.<id> = {title, subtitle, actions[ids], tabs[{id,label,sections[]}] | sections[]}`; section types: goal, needs, metrics{items}, actions{ids}, upcoming, objectives, table{kind,owner,columns,rowActions}, cards{kind,owner,glyph,stats,actions,groupBy}, board{kind,columns,status}, map{nodes,links,basemap:'world'}, pipeline, chart{series}, ledger, finance, rankings{metric}, feed, stakeholders, resources, world, policies, rivals, records, awards, timeline, milestones, negotiations, text, showcase{kind,owner,groupBy,glyph,headline{expr,format,label},meters[{label,expr,max,format,tone}],stats[{label,expr}],dots{tone}} (one big tile per group; `group` = the group's entities), mix{kind,groupBy,weight,format} (donut), histogram{kind,expr,bins[],tone}. Formats: money, pct, pct1, int, num, score, signedMoney, text, km, x.
Theme: `{motif: departure-board|playbill|broadcast|editorial|blueprint|ledger|menu-card|terminal|deal-room|atelier|resort|paddock, mode: light|dark, palette{bg,surface,ink,accent,accent2,...}, fonts{display,body,mono}}`.
