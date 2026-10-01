# Evaluation: generated games vs. the reference games

The brief asked for games that are *better than the uploaded examples*. Not bigger: "deep game +
easy interface". This page compares the studio's output with the five reference games. The
evidence comes from the studio's own tooling: browser QA DOM metrics, playtest bots, quality
gates, and the reference audit in `docs/REFERENCE_AUDIT.md`. Re-run these measurements with
`npm test`, the Benchmarks page, and the Audit button on any project.

## Interface load

| | Top-level destinations | Home screen | Commissioner | Onboarding |
|---|---|---|---|---|
| Billionaire Empire | 37 | ~30 numbers at start, dashboard of everything | cheat toggles | text wall |
| Broadway Producer | 41 | overlapping inbox / tasks / calendar / news | cheat toggles | 5-step wizard, 9 modes |
| College Football Empire | ~50 | dense tables | cheat toggles | wizard |
| Front Office | tabbed, deep | strong but dense | deep editor (best of the five) | wizard |
| Hollywood Empire | 18 | busy | cheat toggles | text-heavy |
| **Generated: Jetstream (airline)** | **6** (+ History, Saves, Help, Commissioner) | goal, needs-you queue, 4 headline metrics, departure board, objectives | full editor of the live simulation, verified in the browser | intro + 6 coach marks tied to real controls |
| **Generated: other benchmarks** | 4–5 | the same structure; signature panel per genre | the same | the same |

Measured by browser QA on the final airline build. Headline numbers include every figure on the
screen.

| Screen | Panels | Words | Numbers | Buttons | Visual elements |
|---|---|---|---|---|---|
| Home | 8 | 230 | 50 | 7 | 3 |
| Network → Strategy | 2 | 159 | 3 | 15 | 0 |
| Network → Route map | 2 | 51 | 4 | 10 | 1 (world map) |
| Fleet (after "make it more visual") | 3–4 | 104–327 | 38–156 | 5–37 | 5–6 (silhouette tiles, donut, histogram) |
| Industry | 5 | 244 | 65 | 21 | 5 |

Depth lives one level down. Every list row opens an inspector with "Why?" drivers. Routine work
is delegated through policies, and screens are tabbed by task rather than by data table.

## Depth (systems per game)

The airline game has:

- multinomial-logit demand across 3 traveler segments
- route frequency and capacity
- aircraft lease, buy-used and order pipelines
- hubs and focus cities
- slot-constrained airports with negotiated agreements
- labor with a union and strikes
- regulators
- fuel with hedging
- a 4-phase economic cycle with shocks
- alliances and acquisitions
- 12+ rival airlines with archetypes, memory and rivalry, entry and exit
- tiers, board objectives, and a rescue plan on failure
- records, awards, milestones, annual reviews and an anti-portfolio

That is comparable in functional depth to the reference games, with fewer controls on screen.

## Engineering

| | References | Generated games |
|---|---|---|
| Structure | 4 of 5 are single files with hundreds of global functions; Front Office is modular source bundled into one file | Shared tested engine (~4.6k lines) + a JSON game definition per game + optional custom modules; dev project and standalone build |
| Tests | none shipped | 13 generated simulation tests per game; browser QA (11–13 checks); 8 bot strategies × seeds in the Balance Lab |
| Saves | ad hoc localStorage | IndexedDB slots with autosave, rename, duplicate, export/import, migration, recovery |
| Offline | one loads Google Fonts | no network requests; the standalone HTML inlines everything |

## Benchmark builds (no local model; deterministic designer)

Final run, after the improvements listed below.

| Brief | Design | Score | Gates | Design review |
|---|---|---|---|---|
| A Airline CEO | airline pack | 99 | 10/10 | 10/10 |
| B Sports agent | agency (representation) | 100 | 10/10 | 10/10 |
| C Restaurant group | venue | 95 | 10/10 | 9/10 |
| D Venture capital | portfolio (minority) | 79 | 9/10 | 7/10 |
| E Broadway producer | slate | 77 | 9/10 | 7/10 |
| F Theme park | venue | 81 | 9/10 | 8/10 |
| G Private equity | portfolio (control) | 91 | 10/10 | 8/10 |
| H University AD | institution | 74 | 9/10 | 6/10 |

Every remaining gate warning is a balance finding from the Balance Lab, reported rather than
hidden:

- **D:** power-law growth is still generous.
- **E:** flop-heavy economics make doing nothing look competitive.
- **F:** margins are high for aggressive play.

The project's Balance button or a "too easy / too hard" request tunes these further. Since
those runs, the portfolio, slate and venue economics have been recalibrated further: VC growth
caps, neutral starting stakes, theme-park demand, Broadway market size and financing.

## How the benchmarks improved the studio

The process rule was to use the generated games' failures to improve the studio, then re-run.
The first benchmark round found these problems, all fixed in the studio rather than in
individual games:

* A fragile generated commissioner test failed games before anything was running. The test now
  measures world demand only when there is some, and adds an entity-edit check.
* Requirement tracing missed genre statements and features named in the game's own vocabulary.
  An evidence search now checks the definition's actions, events, kinds and policies.
* Comma lists of activities ("raise funds, source startups, negotiate term sheets…") were one
  requirement. They are now split.
* "Build a … game" matched the UI standard because "build" contains "ui". Matching now uses word
  boundaries.
* Venue economics only fit restaurants, and theme parks went bankrupt in 100% of runs. Each genre
  now sets its own audience scale and starting capital.
* The institution archetype ran a structural deficit and rewarded hoarding cash.
* Many actions didn't say what you give up, sequels had no preview, and agency games lacked
  late-game pressure, state-driven events and a signature visual.
* The death-spiral and dominant-strategy detectors fired on 1–2 samples. They now need a minimum
  number of cases.
* A "late game too easy" rebalance could overshoot and make the whole game harder. Guardrails on
  competent survival and early-game growth now keep the best configuration that passes and report
  what was reverted.

## What is not better (yet)

* Without a local model, a genre with no dedicated design gets the nearest archetype's generic
  variant: real estate, logistics and cruise lines use the generic venue game. It plays, but it
  is not domain-specific. With a model installed, the feature engineer and change planner can
  add domain systems as validated patches.
* The playtest bots are decent but not expert players. "Too easy" claims are judged on the
  stronger half of runs, and the player's report is always treated as a signal.
* Sports simulations are season- and standings-level. They don't simulate individual plays the
  way College Football Empire does.
