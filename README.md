# Local Game Studio

A game studio that runs on your Mac. It designs, builds, tests, playtests, balances and packages
**deep management, tycoon, front-office, career and business simulation games** as HTML files
you can play in any browser.

- **Local and free to run.** It doesn't need a paid AI service. Your prompts, projects and games
  stay on your computer. The studio's server only answers your own computer (`127.0.0.1`).
- **Deep game, easy interface.** Every game gets:
  - a real simulation (markets, rivals, economic cycles, negotiations, projects, history)
  - no more than seven task-based screens
  - a "Needs you" queue
  - "Why?" explanations for every number
  - delegation policies, so you act as the CEO rather than the data-entry clerk
- **Persistent projects.** You can come back later and say *"the late game is too easy"* or
  *"make the fleet page more visual"*. The studio changes the existing game; it doesn't start
  over.

---

## Install and start (Mac)

1. Double-click **`START_GAME_STUDIO.command`**. If macOS says it is from an unidentified
   developer, right-click it, choose **Open**, then confirm.
2. On first run it sets up what it needs:
   - If your Mac doesn't have Node.js 18+, it downloads a private copy (about 45 MB) into
     `runtime/`. The download is checksum-verified.
   - It checks for **Ollama**, the local AI runtime. Ollama is optional; see below.
3. The studio opens in your browser at **http://127.0.0.1:4317**. Close the Terminal window to
   stop the studio.

Later runs just start the studio.

**Optional: local AI (recommended).** Install Ollama from <https://ollama.com/download>, then open
the studio's **Models** page and click **Install** on a model marked **Fits**.

- On a 24 GB Apple-silicon Mac, `qwen3:14b` (Balanced) or `qwen3:8b` (Fast) work well.
- The page shows each model's measured size and whether it fits your GPU memory budget.
- After that one download, everything runs offline.

Without a model, the studio still builds complete, playable games from its design library.
A model adds richer content, critique, and new systems the library doesn't cover yet.

**Optional: browser tests.** Run `scripts/setup-browser-tests.sh` once. It lets the studio play
your games in your installed Chrome or Edge, take screenshots, and check the layout. Simulation
tests run either way.

Linux and other Unix systems: run `scripts/start.sh`. Any OS with Node.js 18+: run
`npm start` (or `node studio/server/index.js`).

---

## Using it

### Create

Type what you want into the big box and press **BUILD GAME**. The prompt can be one sentence
or a 30,000-word specification.

- The studio shows what it understood as you type: genre, must-haves, nice-to-haves, things to
  avoid, and any contradictions.
- *Pause to review the design* stops after the design brief, so you can edit the title, the
  fantasy, and which features to keep, automate, merge or cut.
- **Optional controls** cover depth, realism, session length, universe and visual priority.

You can watch the production stages:

1. Understanding brief
2. Designing core loop
3. Designing simulation
4. Building world model
5. Building interface
6. Implementing systems
7. Running tests
8. Playtesting
9. Balancing
10. Polishing
11. Packaging

Each stage shows its repairs and notes. A full build of the airline game takes about 5–8
minutes on a laptop, and most of that is simulation.

### Control center

Each project has a control center with:

| Button | What it does |
|---|---|
| **Play** | Opens the game in your browser |
| **Modify** | Changes the game from a plain-English request |
| **Audit** | Runs the quality gates and design review without changing anything |
| **Balance** | Simulates, analyzes, rebalances, and simulates again |
| **Export HTML** | Builds one portable `.html` file |
| **Test report** | Shows the simulation and browser test results |
| **Design** | Shows the editable design documents, which are the project's memory |
| **Build history** | Lists the versions V0 design → V1 prototype → V2 functional → V3 playtested → V4 polished → release; you can restore any of them |
| **Remaster** | Rebuilds the game from its prompt with the current studio |

### Modify an existing game

Some requests the studio handles:

- *"The route system is too tedious. Redesign it so I make higher-level network strategy
  decisions."* → adds a strategy layer:
  - growth pace: Manual / Cautious / Steady / Land grab
  - handling of underperforming routes
  - capacity planning

  Your planners run routes using the same forecasts you see, and switching to Manual restores
  full control.
- *"The late game is too easy. Analyze why, rebalance it, and run simulations again."* → runs
  the Balance Lab:
  1. Many playthroughs by bots with different strategies.
  2. Diagnosis, for example "growth keeps accelerating late".
  3. Adjustment of the late-game parameters.
  4. Re-simulation, with a before/after table in the Balance report.
- *"Make the fleet page much more visual."* → redesigns that screen:
  - a tile per aircraft type with a silhouette, live status dots and meters
  - a capacity-mix donut and an age histogram
  - the full list moved to its own tab
- *"Export the finished game."* → produces a standalone HTML file, plus the modular development
  project in `projects/<name>/game/`.

When a local model is installed, requests the built-in recipes don't cover (*"add a loyalty
program"*) go to the model, which plans targeted changes. Every change is validated and tested.
If a change breaks the game, it is reverted automatically.

### Remaster or expand an existing HTML game

Drop the `.html` file onto the Create page (Optional controls → attachment area).

1. The studio inventories its systems as core, useful, redundant, confusing, cosmetic, broken,
   or candidates for automation.
2. It turns that inventory into must-keep requirements.
3. It rebuilds the game with the same or greater depth and lower friction.

### Other pages

- **Models** shows hardware, runtimes, the role each model plays (fast / main / critic), memory
  fit, installs, and a speed and JSON-reliability benchmark.
- **Library** holds the Game Design Intelligence Library:
  - reference-game audit
  - core loops and mechanics
  - UI patterns
  - failure and fun patterns
  - 35 genre fantasies
- **Benchmarks** has eight genre briefs: airline, sports agent, restaurant, VC, Broadway, theme
  park, private equity, university AD. Use it to see how well the studio generalizes.
- **Settings** covers runtimes, the optional cloud provider (off by default; when enabled it is
  used only when you pick it for a build), build settings, and *what the studio has learned
  about you*: editable, local, soft preferences. For example, if you keep saying "too
  overwhelming", new games start more delegated.

---

## What every generated game includes

- **Commissioner mode** that edits the real simulation:
  - any entity, company, world variable, economic phase, shock or event
  - balance parameters, tiers and stakeholders
  - jumping through time
- **Saves:**
  - autosave
  - named slots, rename, duplicate, delete
  - export and import to a file
  - version migration
  - recovery when saved data is damaged
- **Onboarding:** an intro, plus coach marks attached to the real interface.
- **Simulation:**
  - **Time** controls: next turn, a month, or until something needs you, with auto-pause on
    important events.
  - **Simulation levels:** full detail near you, lighter detail further away, and statistical
    background competitors.
  - **Events** in priority tiers: critical / important / routine / background.
  - **Rivals** run by heuristic AI using the same actions you have, with archetypes, memory,
    rivalries, entries, exits and mergers.
- **Story and history:**
  - moments, records, awards, milestones
  - annual reviews and a timeline
  - an anti-portfolio of the opportunities you passed on
- **"Why?" explanations** for key numbers, and **forecasts** before big decisions, including
  what you give up and what could go wrong.
- **Real and fictional content** clearly separated (for example, real airports and fictional
  airlines), with a disclaimer.

## Quality gates

A build counts as **finished** only when it passes all ten gates:

1. Runs without critical errors
2. Primary loop works
3. Save/load works
4. Major requested features exist
5. Economy is stable
6. No dead-end navigation
7. Commissioner works
8. Onboarding explains the game
9. A long-run simulation succeeds
10. A requirements audit is complete

A structured design review also runs. It applies ten tests to evidence from playtests and the
browser: fantasy, 10-minute, 1-hour, 10-hour, late game, failure, screenshot, redundancy,
decision, and story. Everything is written to `reports/AUDIT.md` in the project.

## Where things live

```
START_GAME_STUDIO.command   launcher (macOS)
engine/                     the game engine every game runs on (simulation + interface)
library/                    Game Design Intelligence Library + genre packs and archetypes
studio/server/              the studio: compiler, designer, pipeline, QA, local AI, HTTP API
studio/web/                 the studio's interface
projects/<game>/            one folder per game: prompt, memory/, game/ (dev build), versions/,
                            reports/ (tests, balance, browser, audit, screenshots), releases/
studio-data/                settings, preferences, model call log, caches (local only)
docs/                       architecture, reference audit, GDL reference, evaluation vs. the references
tests/                      the studio's own test suite (npm test)
```

## Command line

```
node studio/cli.js create "Build me a deep restaurant empire game…"
node studio/cli.js modify <project> "The late game is too easy"
node studio/cli.js audit|balance|export <project>
node studio/cli.js remaster old-game.html "make it less overwhelming"
npm test            # full studio test suite: engine, compiler, recipes, Balance Lab, server,
                    # and a mock local-model run of the whole pipeline (npm run test:quick: unit tests only)
```

## How good are the games?

See [docs/EVALUATION.md](docs/EVALUATION.md). It compares generated games with the five reference
games (interface load, depth, engineering) and lists the eight benchmark builds with their quality
gates, design-review results and remaining balance findings.

## Honest limits

- **Genre coverage.** With no model installed, the quality of a new genre depends on the design
  library:
  - The airline genre has a full hand-tuned pack.
  - Other genres use archetypes (venue operators, portfolios, project slates, agencies,
    institutions) re-skinned and re-parameterized for the domain.
  - Requirements the library can't cover are marked **visibly incomplete** in the requirements
    matrix, never faked.
- **Local models are slower than cloud models.** A model-assisted build adds several minutes
  per design stage on a 24 GB Mac.
- **Browser tests need setup.** They require Chrome or Edge plus `scripts/setup-browser-tests.sh`.
  Without them, gate checks rely on simulation tests and say so.
