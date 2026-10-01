# Comparative Audit of the Reference Games

This audit came first, before any generator code was written. Its findings feed the
**Game Design Intelligence Library** (`library/`), the engine's mechanic kernel
(`engine/`), and the critics' checklists (`studio/server/qa/`).

Method: static analysis of every script (functions, state, navigation, constants), headless
Chromium runs of each title screen, new-game wizard and opening "command center", plus close
reading of the core systems (demand, negotiation, tasks, explanations, time, saves, AI players).
The structured version of this audit is `library/reference-audit.json`. You can regenerate the
raw inventory with the built-in analyzer: `node studio/cli.js analyze reference-games/<file>.html`.

## 1. The library at a glance

| Game | Size | Functions | Sidebar items | Role / fantasy | Time step | Architecture |
|---|---|---|---|---|---|---|
| Billionaire Empire | 717 KB | ~590 | 37 (+ hidden) | Capital allocator who builds a conglomerate | Day, with +D/+W/+M/+Q/+Y and "next event" | Single file, one global `G`, shared shell with Broadway |
| Broadway Producer | 604 KB | ~550 | 32 (renders 41) | Producer: option rights, raise money, cast, open, run | Day, with week box office | Same shell as Billionaire |
| College Football Empire | 558 KB | ~580 | **50** | Head coach / AD: recruit, develop, win, survive the hot seat | Day, with week games | Same shell family |
| Front Office | 1.2 MB | ~930 | Tabbed per area | GM of a club in one of 5 sports | Day / week / phase | **Modular source** (`src/core`, `src/sim`, `src/ai`, `web/ui`) bundled into one file |
| Hollywood Empire | 677 KB | ~540 | 18 | Studio head: develop, greenlight, cast, release, win awards | Day, with weekly box office | Single file, screen registry (`SCREENS`) |

All five run fully offline and save to IndexedDB with import/export. None loads a framework.
Only Hollywood Empire makes a network request (Google Fonts), which fails offline. That is a
small breach of portability.

## 2. What these games do well, and the engine must keep

1. **Real causal economics, not random numbers.** Broadway's `demandAll` is a multinomial-logit
   demand model over audience segments (tourists, theater lovers, groups and others). Each show's
   utility comes from its features, awareness, segment boosts and a price index, and the result
   feeds a capacity-constrained `sellWeek` that supports premium and discount pricing. Billionaire
   values companies on ROIC, margins, leverage and macro rates. This depth is why the games feel
   real. → The engine ships a **segment logit market model** (`engine/sim/market.js`) that every
   generated game can configure.
2. **Negotiation with reasons and memory.** Billionaire's `evalOffer` scores an offer against the
   counterparty's reservation price. The score moves with deal structure (stock vs. cash,
   earnouts), seller type, credit conditions and *remembered past dealings*. The seller then
   accepts, counters or rejects **and says why**. → Generic **negotiation module** with
   reservation values, terms, patience, stated reasons and relationship memory.
3. **"Needs you" task queue.** `computeTasks()` builds a prioritized list of things that need a
   decision, such as counter-offers, deadlines, expiring options and missing roles. It is the best
   antidote to menu mazes in the library. → The engine generates a **Needs You queue** from
   events, negotiations, project gates, stakeholder thresholds and objectives.
4. **Explanations ("Why?").** `why()`/`explain()`/`drvList()` show driver breakdowns, for example
   why a stock moved or why demand changed. → Every key metric in the definition language can be
   declared as **named drivers**, and the UI renders "Why?" automatically.
5. **Time controls.** +D/+W/+M plus "⏭ next event" (`nextEventDay`), with **auto-pause
   categories** (Broadway `PAUSE_OPTS`, Billionaire `settings.pause`). → Engine time system with
   priority-based auto-pause.
6. **Moments.** `moment()` queues full-screen presentations for openings, awards, takeovers and
   crises. → **Moment presentations** for milestones and crises, rate-limited.
7. **Memory and history.** Anti-portfolio (deals you passed on that later boomed), annual and
   decade reviews, records, timelines and halls of fame all create stories. → A **history
   module** with records, awards, milestones, an anti-portfolio, annual reviews and a news
   archive.
8. **Delegation.** Broadway hires staff and toggles delegation (`setDeleg`). CFB delegates
   recruiting. Billionaire has auto-refinance and auto-repay rules. → **Policies & delegation**
   are first-class, and staff quality affects how well routine work is done.
9. **Imperfect information.** CFB scouting (`seenOvr`, `seenPot`), Hollywood estimate bands
   (`estBand`, `trueFit` vs. `projectedFit`), and Front Office scouting confidence ranges make
   evaluation a skill. → Entities can declare **hidden true values with observed estimates**,
   and scouting or diligence actions narrow them.
10. **A built-in AI player.** Broadway and Billionaire have `autoPlayer()` and a headless flag.
    The authors could soak-test the economy. → Every generated game exposes a **headless API**
    and **strategy bots**, which the Balance Lab runs by the thousand.
11. **Robustness.** Hollywood's `findBadNumbers`/`fixBadNumbers`/`repairState`, Front Office's
    `clampFinite`, and Billionaire's `validateSave`/`migrate`. → The engine validates state every
    tick in debug mode and **migrates saves by filling defaults from the schema**.
12. **Front Office's architecture.** Its source is truly modular (`src/core/rng.js`,
    `src/sim/engine.js`, `src/ai/trade.js`, `web/ui/screens_*.js`) and bundled into one HTML
    file. It has a seeded RNG with independent child streams. Its commissioner is real: edit,
    create, move, relocate and expand teams, force results, regenerate draft classes. This is the
    model for the generated-project structure and the commissioner standard.
13. **Honest real/fictional framing.** Every title screen separates real starting context from
    simulated fiction. → The engine requires a `universe` mode and generates a disclaimer.

## 3. Where they fall short (what "better" means)

| Failure pattern (see `library/failure-taxonomy.json`) | Evidence |
|---|---|
| **Menu maze / navigation by database table** | CFB has **50** sidebar destinations, Billionaire 37 and Broadway 32 (41 rendered). Groups mirror data tables ("Ownership Tree", "Public Stakes", "Private Companies") rather than player tasks. |
| **Dashboard syndrome** | Every command center opens with a row of 6 KPI tiles, then tables. Billionaire's opening screen has ~490 DOM nodes, ~90 clickable controls and a 10-column holdings table. It reads like corporate BI software. |
| **Generic visual design** | Billionaire, Broadway and CFB share the *same* CSS token set (`--panel`, `--gold`, `--burg`…) and layout: dark panels, a left sidebar and gold accents. Hollywood switches to green and brass but keeps the structure. Strip the logo and a screenshot does not tell you the industry (fails the **Screenshot Test**). |
| **Empty commissioner (partly)** | Broadway's and Billionaire's commissioners are mostly *cheat toggles* ("Guaranteed rave reviews", "Infinite demand"). They bypass the simulation instead of editing the world. Front Office is the exception and the standard to beat. |
| **Configuration-wizard front-loading** | Broadway has 5 wizard steps and 9 modes. Hollywood shows 7 difficulty sliders, 6 scenarios and 5 culture options before you play. Many of these choices mean nothing to a new player. |
| **Number soup** | Billionaire's home screen shows net worth, personal cash, holdco cash, EV, revenue, EBITDA, FCF, debt and subsidiary cash at once, before the player has made a single decision. |
| **Text-wall onboarding** | Getting-started cards are well written but long paragraphs ("No show happens without capitalization. Pitch investors, sign co-producers…"). They explain rather than guide a first action. |
| **Redundant destinations** | Broadway has Inbox + Task Center + Calendar + Watchlists + News, five overlapping "what's happening" surfaces. Billionaire splits History into Deals, Capital Allocation Record, Records, Timeline and Anti-Portfolio. |
| **Monolithic code (4 of 5)** | 550–600 terse global functions in one file with cryptic names (`sl`, `D_`, `S$`, `C$`). Hard to modify safely, which matters because the studio must edit games later. |
| **Online dependency** | Hollywood loads Google Fonts. It degrades offline but breaks "portable". |

## 4. Design lessons by game

**Billionaire Empire.** The fantasy is control and compounding: buy, fix, finance and sell. Its
best system is deal-making with reasons and memory. Its weakest point is that the player faces
the whole capital structure of a conglomerate on day one. Lesson: *start with one company and a
holdco, then unlock layers (public markets, funds, family office) as the empire grows*. That is
progressive disclosure tied to progression tiers.

**Broadway Producer.** It has the strongest **project lifecycle** (rights → draft → workshop →
capitalization → rehearsal → previews → opening → run → closing/tour/licensing), each stage with
real decisions and estimates under uncertainty. Weakness: running shows are mostly weekly
numbers. Lesson: *lifecycles with decision gates are the backbone of creative-industry games*.

**College Football Empire.** It has the strongest **people pipeline** (recruiting points,
visits, promises, scouting fog, portal, NIL, development, depth charts) and **hot-seat
pressure** from boosters and the AD. Weakness: 50 destinations, and the season repeats with the
same chores. Lesson: *pressure from stakeholders creates stakes; repeated chores need
delegation*.

**Front Office.** It has the strongest **simulation engineering** (5 sport engines, seeded RNG,
valuation AI, trade AI, real commissioner, modular source). It has the weakest **game feel**:
almost no moments, explanations or delegation, and it is functional but gray. Lesson: *great
engines still need feedback and drama on top*.

**Hollywood Empire.** It has the strongest **production drama**: dailies, test screenings,
reshoots, trailer predictions, festival runs and an awards race, plus scenarios and challenges.
It also has the most compact navigation (18). Lesson: *uncertainty that resolves on a schedule
(opening weekend, reviews, awards night) is the emotional core of management games*.

## 5. Design principles derived for the generator

1. **Fantasy first.** Name the 5–10 verbs the player fantasizes about before choosing mechanics.
2. **Task-based navigation, ≤ 7 destinations.** Group by what the player is doing (Operate, Grow,
   People, Market, History), never by data table. Add depth with tabs *inside* a destination.
3. **The home screen answers "what now?"** Show the needs-you queue, at most 4 headline numbers,
   the next scheduled moment of truth, and 1–3 primary actions.
4. **Every number that moves must be explainable.** Declare drivers, show "Why?", and make
   consequences visible after each decision.
5. **Uncertainty with scheduled resolution.** Estimates now, truth revealed later (openings,
   earnings, season results), presented as a moment.
6. **Delegate the routine.** Staff and policies handle pricing, renewals and minor negotiations,
   and the quality of the people delegated to matters.
7. **Progressive unlocking.** Layers of the simulation appear when the player's organization
   reaches the tier that needs them.
8. **Commissioner edits the world, not the dice.** Edit entities, organizations, markets, rules
   and time. Cheat toggles are optional extras.
9. **Distinct visual identity per game.** Its own palette (light or dark), typography, motif and
   signature visualization (network map, pipeline board, roster cards, cap table…).
10. **Modular source, single-file release.** Follow Front Office: modules in development, one
    bundled HTML file for release, no network dependencies.
