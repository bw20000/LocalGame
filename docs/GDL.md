# GDL — the Game Definition Language

Every game the studio makes is one JSON document: the **game definition**. The engine
(`engine/`) reads it and runs the simulation and the interface. The studio's design stages
write it. The modify, balance and redesign workflows change it through targeted patches.
Validation (`engine/validate.js`) checks every formula, name and reference, and dry-runs the
game before anything is saved.

A compact version used inside model prompts lives in `library/gdl-cheatsheet.md`. Full examples:

- `library/packs/airline.js` — complete airline game
- `library/packs/archetypes/*.js` — genre archetypes
- `tests/engine/tiny.gdl.json` — 100-line lemonade-stand game

## 1. Top level

```jsonc
{
  "gdl": 1,
  "meta": { "id", "title", "tagline", "genre", "role", "fantasy": [], "universe": "realistic-fictional|fictional|mixed", "disclaimer", "goal", "howToPlay" },
  "time": { "unit": "week|month|day", "start": "2026-01-05" },
  "currency": { "symbol": "$" },
  "warmup": 26,                 // ticks simulated before the player starts, so the world has history
  "params": { },                // balance parameters (auto-tuner knobs refer to these)
  "difficulty": { "<id>": { "label", "params": { } } },
  "finance": { "baseRate", "creditLimit" },
  "world": { "vars": [], "cycle": { }, "seasonality": [12 numbers] },
  "resources": [], "kinds": { }, "markets": { }, "orgs": { },
  "actions": [], "policies": [], "projects": [], "negotiations": [], "stakeholders": [], "events": [],
  "people": { }, "progression": { }, "history": { }, "needs": [], "newGame": { "options": [] },
  "ui": { "topbar": [], "nav": [], "screens": { } }, "theme": { }, "onboarding": { }, "glossary": [],
  "balance": { "knobs": [], "targets": { } }
}
```

## 2. Formulas — the expression language

Formulas are strings, compiled once into closures. There is no `eval`, and they cannot reach
the browser or the file system.

| Feature | Syntax |
|---|---|
| Numbers | `12`, `1.5M`, `20k`, `3e6` |
| Strings | `'text'` |
| Operators | `+ - * / % **`, `== != < <= > >=`, `and or not` (also `&& || !`), `a ? b : c`, `a ?? b` |
| Lists | `[1, 2, 3]`, `list[0]` |
| Members | `self.price`, `self.city.pop` (ref fields resolve automatically), `org.cash`, `world.fuel` |

**Roots.** Which roots are available depends on where the formula runs:

| Root | Meaning |
|---|---|
| `self` | Current entity |
| `org` | Acting company |
| `player` | The player's company |
| `world` | Variables, plus `world.demand`, `world.phase`, `world.season` |
| `params` | Balance parameters |
| `time` | `tick`, `year`, `month`, `week`, `yearsElapsed` |
| `param` | Action parameters |
| `fc` | Forecast result |
| `it` | Current item inside a list function |
| `outer` | The enclosing `it` |
| `them`, `terms` | Negotiations |
| `p` | Project data |
| `group` | Showcase tiles |
| `v` | Current value, in tone formulas |

**Company fields.**

- `org.cash`, `org.debt`
- `org.<resource>`, e.g. `org.brand`
- Metrics: `org.revenueYear`, `org.profitYear`, `org.value`, and `org.<metric id>`
- `org.isPlayer`, `org.name`

**Functions.**

- Math: `min max clamp abs round floor ceil sqrt log exp pow lerp sigmoid`
- Random, seeded and deterministic: `rand()`, `rand(max)`, `rand(min, max)`, `randn(mean, sd)`, `randInt(a, b)`, `chance(p)`, `pick(list)`
- Lists, where `src` is a kind name or a list and the second argument is evaluated per `it`:
  - `count(src, cond)`, `sum(src, expr, cond)`, `avg`, `maxOf`, `minOf`
  - `find(src, cond)`, `filter`, `any`, `all`
  - `sortBy(src, expr)`, `top(src, expr, n)`, `bestOf`, `map`
  - `distinct`, `concat`, `len`
- World queries:
  - `owned(kind[, org])` — entities a company owns
  - `refs(kind, field, x)` — entities whose field points at `x`
  - `where(kind, field, value)`, `ownsAt(kind, field, value)`
  - `get(kind, id)`, `all(kind)`
  - `distance(a, b)` (km), `pairKey(a, b)`
  - `rivals()`, `isPlayer(org)`, `archetype(org)`, `tierIndex()`, `tierAtLeast(id)`, `policy(id)`
  - `projectsOf(org)`, `creditLimit(org)`, `borrowRoom(org)`, `rateFor(org)`
  - `est(entity, field)` — the player's estimate of a hidden value
- Text: `money pct int num signed name date`

**Templates.** Text fields accept `{expr}` and `{expr|format}`, for example
`"Opened {param.city.name} for {money(cost)}"`.

## 3. World

- `world.vars[]`
  - `{ id, label, format, start, process, shocks[], phase{}, explain }`
  - `process` is one of:
    - `{type:'meanRevert', mean, vol, speed, min, max}`
    - `{type:'walk', vol}`
    - `{type:'trend', drift, vol}`
    - `{type:'formula', expr}`
  - `shocks[]`: `{ id, label, chance, size, duration, news, event }`
- `world.cycle`
  - A Markov chain of economic phases: `{ start, phases: [{ id, label, demand, credit, minTicks, maxTicks, next: { phaseId: weight }, news, event }] }`
  - `world.demand` multiplies market sizes. `credit` shifts interest rates.
- `world.seasonality` — 12 monthly demand multipliers, available as `world.season`.

## 4. Kinds (entities)

```jsonc
"route": {
  "label": "Route", "plural": "Routes", "glyph": "route",
  "records": [ { "id": "...", "name": "..." } ],     // static catalog (airports, aircraft types…)
  "fields": { "a": { "type": "ref", "ref": "airport" }, "fareMult": { "type": "number", "default": 1 } },
  "derived": { "seats": "sum(refs('aircraft', 'route', self), it.type.seats)" },
  "generate": { "count": 40, "set": { } },            // procedural entities at world creation
  "upkeep": [ { "label": "Parking", "expr": "...", "when": "...", "nonCash": false } ],
  "operate": { "market": "air", "capacity": "self.seats * self.freq", "price": "self.refFare * self.fareMult",
               "attrs": { "freq": "log(1 + self.freq)", "brand": "org.brand / 50" },
               "revenue": [ ], "costs": [ { "label": "Fuel", "expr": "..." } ], "after": [ /* ops */ ] },
  "display": { "title": "{self.name}", "subtitle": "...", "stats": [ { "label", "expr", "format" } ] },
  "explain": { "drivers": [ { "label", "expr" } ] }
}
```

- **Field types:** `number`, `int`, `money`, `pct`, `text`, `enum` (with `options`), `ref`,
  `refs`, `list`, `bool`. Add `hidden: true` for values the player only sees as estimates.
- **Operating units** sell capacity in a market every tick. Their results are available as
  `self._sold _demand _cap _load _rev _cost _profit`, with history in `self._hp`.

## 5. Markets

```jsonc
"air": { "key": "self.key", "size": "params.demandK * ...", "refPrice": "self.refFare", "outside": "params.outsideBase",
  "segments": [ { "id": "business", "label": "Business", "share": 0.22, "priceSens": 0.6, "priceMult": "1.5 + min(2.6, self.dist / 2800)",
                  "capShare": "...", "weights": { "freq": 1.4, "onTime": 1.2, "brand": 0.6 } } ] }
```

- Units with the same `key` compete with each other.
- Each segment chooses by **multinomial logit** over the units' `attrs` and price. Each
  segment's `outside` option is "don't buy".
- Capacity is shared by `capShare`. Premium segments are served first, and spill-over is sold
  down.

## 6. Organizations (player and rivals)

```jsonc
"orgs": { "label": "Airline", "plural": "Airlines", "fields": { }, "metrics": [ { "id", "label", "expr", "format", "track" } ],
  "assets": "expr", "valuation": "expr", "costs": [ { "label", "expr" } ], "tick": [ /* ops each tick */ ],
  "player": { "name", "cash", "set": { }, "start": [ /* ops */ ] },
  "rivals": { "count": { "full": 7, "light": 5, "background": 18 }, "entryChance", "maxActive", "failGrace", "leadershipChange",
              "archetypes": [ { "id", "label", "risk", "tempo", "cash", "set": { }, "policies": { }, "weights": { "actionId": 1.5 }, "start": [ ] } ] },
  "onFail": [ /* ops when a company fails */ ] }
```

**Simulation levels.**

- Level 1 (full): rivals act every `aiEvery` ticks.
- Level 2 (light): rivals act less often.
- Level 3 (background): rivals are statistical.

Rivals use **the same actions as the player**, choosing by each action's `ai.score`. Their
memory and rivalry, `remember(a, b, key)`, influence their choices.

## 7. Actions

```jsonc
{ "id": "openRoute", "label": "Open a route", "verb": "Launch", "kind": null /* or entity kind for row actions */,
  "category": "network", "icon": "route", "primary": true, "tier": "national",
  "describe": "...", "tradeoff": "what you give up", "risk": "what could go wrong",
  "params": [ { "id": "dest", "type": "entity", "kind": "airport", "filter": "...", "sort": "..." },
              { "id": "fare", "type": "choice", "options": [ { "value": 1, "label": "Market" } ], "aiValue": "..." } ],
  "vars": { "dist": "distance(param.origin, param.dest)" },
  "requires": [ { "expr": "...", "msg": "why not" } ], "cost": { "cash": "..." }, "costCategory": "Route launches",
  "forecast": { "kind": "route", "set": { } },        // hypothetical unit run through the market → fc.*
  "preview": [ { "label": "Expected weekly profit", "expr": "fc.profit", "format": "signedMoney" } ],
  "effects": [ /* ops */ ], "result": "Launched {param.dest.code}", "cooldown": 4,
  "ai": { "score": "fc.profit * 26 - cost", "candidates": 4, "news": "{org.name} launches …" }, "playerOnly": false, "aiOnly": false }
```

The action dialog shows the parameters, the live forecast and preview, the cost, *what you
give up* and *what could go wrong*. A disabled action always explains why.

## 8. Effect operations

| Op | Shape |
|---|---|
| set / add / mul | `{op, path:'self.field', value}` or `{op:'set', target, field, value}` |
| cash | `{op:'cash', amount, category}` |
| resource / stake | `{op:'resource', id, add}` · `{op:'stake', id, add}` |
| create / remove / transfer | `{op:'create', kind, set{}, count, as}` · `{op:'remove', target}` · `{op:'transfer', target, to}` |
| project / negotiate / event | `{op:'project', id, set{}, name}` · `{op:'negotiate', id, with}` · `{op:'event', id, delay, bind{}}` |
| feedback | `{op:'news', text, tag}` · `{op:'moment', title, text, tone, stat}` · `{op:'toast', text}` |
| control flow | `{op:'if', cond, then[], else[]}` · `{op:'chance', p, then[], else[]}` · `{op:'each', list, filter, as, do[]}` · `{op:'let', name, value}` · `{op:'stop'}` |
| finance | `{op:'loan', amount, years}` · `{op:'repay', amount}` · `{op:'forgiveDebt', fraction}` |
| companies | `{op:'acquireOrg', target, to}` · `{op:'remember', a, b, key, add}` · `{op:'endGame', outcome, text}` |
| delegation | `{op:'autoAct', action, max, minScore}` — staff take the best-scoring instance of an action (as rivals do) |
| misc | `{op:'policy', id, value}` · `{op:'flag', name, value}` · `{op:'observe', target, field, quality}` · `{op:'hook', name, args}` (custom JS) |

## 9. Policies (delegation)

```jsonc
{ "id": "routeGrowth", "label": "Route strategy", "scope": "org" /* or "kind:route" */, "default": "steady", "aiDefault": "manual", "every": 4,
  "describe": "...", "options": [ { "value": "manual", "label": "Manual" },
                                  { "value": "steady", "label": "Steady growth", "describe": "...", "effects": [ { "op": "autoAct", "action": "openRoute", "max": "2" } ] } ] }
```

A policy's effects run every `every` ticks, for each company: the player uses its chosen
value, and rivals use `aiDefault` or their archetype's value. With `scope: "kind:x"` the
effects run once per owned entity, with `self` set to that entity.

## 10. Projects, negotiations, stakeholders, people

- **Projects:**
  - `{ id, label, stages: [{ id, label, duration, cost, risk: {chance, effects}, gate: {label, describe, options: [{label, cancel}]} }], onComplete: [] }`
  - Projects take multiple turns and can have go/no-go gates.
- **Negotiations:**
  - `{ id, label, with, patience, terms: [{ id, label, type, default, min, max }], value, reservation, counter: { term }, reasons: [{ when, text }], onAccept: [], onReject: [] }`
  - The counterparty has a hidden reservation value.
  - Its counters are solved from `value`.
  - Its reasons are written from state.
  - It remembers how you treated it.
- **Stakeholders:**
  - `{ id, label, start, base, speed, drivers: [{label, expr}], thresholds: [{ below|above, event }] }`
  - Examples: board, union, regulators, fans.
  - Their mood moves toward `base + Σ drivers`, and each driver is shown under "Why?".
- **People:** careers, ratings with hidden true values, aging, and retirement. See `engine/sim/people.js`.

## 11. Events

```jsonc
{ "id": "fareWar", "title": "Fare war on {r.name}", "text": "...", "priority": "critical|important|routine|background",
  "chance": "0.02", "when": "...", "cooldown": 30, "once": false, "expires": 4,
  "bind": { "r": { "kind": "route", "owner": "player", "filter": "it._load > 0.8", "pick": "max", "by": "it._profit" } },
  "choices": [ { "label": "Match their fares", "describe": "...", "cost": "...", "requires": "...", "effects": [ ], "result": "..." },
               { "label": "Hold the line", "effects": [ ] } ], "default": 1 }
```

- Events come from state through `bind` and `when`.
- How events reach the player depends on priority:
  - **Critical:** stops time.
  - **Important:** goes into *Needs you*.
  - **Routine:** goes to the news.
  - **Background:** goes to history only.
- The engine rate-limits interruptions.
- Choices the player can't afford are disabled, with the reason shown.

## 12. Progression and history

- `progression.tiers[]` — `{ id, label, when, text, unlocks }`.
- `progression.objectives` — board objectives with rewards and penalties.
- `progression.failure` — `{ when, grace, warning, rescue: [ { id, label, describe, effects, once } ], gameOver }`.
- `progression.victory[]`.
- `history.records[]`, `history.awards[]` and `history.milestones[]` are evaluated from state.
  Annual reviews, the timeline and the anti-portfolio are built in.

## 13. Interface

**Navigation.** `ui.nav` has seven items or fewer: `{ id, label, icon }`. History, Saves &
settings, Help and Commissioner are added automatically.

**Screens.** `ui.screens.<id>` = `{ title, subtitle, actions: [ids], sections: [] | tabs: [ { id, label, sections: [] } ] }`.

**Sections.** All sections take `{ type, title, width: full|half|third|twoThirds, when, tour }`
plus type-specific fields:

| Type | Purpose |
|---|---|
| `goal`, `needs`, `upcoming`, `objectives` | Orientation: what to do now |
| `metrics{items:[{label, expr, format, metric, explain, sub}]}` | Headline numbers with history and "Why?" |
| `table{kind, owner, columns, rowActions, search, limit, sort}` | Lists (paged, sortable, searchable) |
| `cards{kind, owner, glyph, glyphColor, badge, stats, actions, groupBy, size}` | Visual entity cards |
| `showcase{kind, owner, groupBy, glyph, headline, meters, stats, dots}` | One large tile per group: silhouette, headline number, meters, status dots |
| `mix{kind, groupBy, weight}` | Composition donut |
| `histogram{kind, expr, bins, tone}` | Distribution (e.g. fleet age) |
| `board{kind, columns, status}` | Departure-board style signature panel |
| `map{nodes, links, basemap:'world'}` | Geographic map with Natural Earth coastlines |
| `chart{series:[{label, metric|ledger|world}], window}` | Trends |
| `pipeline` | Projects in progress |
| `ledger`, `finance` | P&L and balance sheet, loans |
| `rankings{metric}`, `rivals{stats}`, `world`, `feed{tag}` | Competition and news |
| `stakeholders`, `resources`, `policies{ids}`, `negotiations` | Relationships and delegation |
| `records`, `awards`, `timeline`, `milestones`, `antiPortfolio`, `annual`, `text` | Story |

**Formats.** `money`, `signedMoney`, `pct`, `pct1`, `int`, `num`, `score`, `x`, `km`, `text`.

## 14. Theme and onboarding

- **Theme:**
  - `{ motif, mode: light|dark, palette: { bg, surface, ink, accent, accent2, good, bad, warn }, fonts: { display, body, mono }, logoText }`
  - Motifs: `departure-board`, `playbill`, `broadcast`, `editorial`, `blueprint`, `ledger`,
    `menu-card`, `terminal`, `deal-room`, `atelier`, `resort`, `paddock`.
  - Fonts are system font stacks, so nothing is loaded from the internet.
- **Onboarding:**
  - `{ intro: { title, text, bullets: [ { icon, title, text } ] }, steps: [ { text, target, nav, event | done } ] }`
  - Coach marks point at real interface elements: `action:<id>`, `nav:<id>`, `policy:<id>`,
    `tab:<id>`, or a section `tour` name.

## 15. Balance metadata

```jsonc
"balance": { "knobs": [ { "path": "params.demandK", "label": "Market size", "effect": "easier|harder", "min", "max", "phase": "late", "step" } ],
             "targets": { "smartMargin": [0.04, 0.17], "maxGrowth": 12 } }
```

The Balance Lab:

1. Plays the game with eight bot strategies: passive, conservative, balanced, smart,
   aggressive, expansion, high-debt and careless.
2. Detects failure patterns: too easy or too hard, runaway growth, snowballing, death spirals,
   dominant strategies, passive play winning, notification fatigue, and a static world.
3. Moves the knobs toward the targets.
4. Simulates again.

## 16. Custom code (optional)

`game/src/custom/*.js` can register hooks:

```js
LGE.hooks.register('name', (game, scope, args) => { … })   // built-in names: 'start', 'tick', 'remove'
```

The GDL calls them with `{op:'hook', name}`. Use custom code only for mechanics the GDL can't
express. It is bundled into the standalone HTML and covered by the generated tests.
