# Local Game Studio — Architecture

## 1. The central decision: a game engine plus a design language, not "LLM writes HTML"

A local 8–20B model on a 24 GB Mac cannot reliably write a coherent 10,000-line management game
in one go, and the reference games show that depth comes from *interlocking systems*, not from
line count. So the studio splits the work the way a real studio does:

```
                ┌──────────────────────────── Local Game Studio ───────────────────────────┐
 your brief ──► │ Prompt Compiler → Producer → Designer → Systems → Economy → World →       │
                │ Content → UX/IA → Creative Director   (local LLM, staged, schema-checked) │
                │                         │                                                │
                │                         ▼                                                │
                │          GAME DEFINITION (GDL JSON)  ◄── targeted patches for            │
                │          + optional custom JS modules    "modify / balance / redesign"   │
                │                         │                                                │
                │   Validator → Linter/Enricher → Build → Tests → Bots → Balance Lab →     │
                │   UX checks + screenshots → Critics → Repair loop → Final Audit →       │
                │   Bundler (standalone HTML)                                             │
                └──────────────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
                 ENGINE (hand-built, tested): simulation kernel + UI runtime
```

* **The engine** (`engine/`) is a hand-built, tested runtime. It provides the mechanics found
  across the reference games: a segment-logit market model, operations and P&L, capital
  assets, projects with stages and gates, negotiation with memory, stakeholders, world cycles
  and shocks, rival AI using the player's own action set, simulation levels, history and
  records, progression tiers, policies and delegation, saves, commissioner, onboarding, "Why?"
  driver explanations, moments, a needs-you queue, and themes with genre motifs.
* **The Game Definition Language** (`docs/GDL.md`) is a JSON design document. It declares a
  game's entities, formulas, actions, markets, events, progression, screens and visual
  identity. It describes the *design*, not a template: entity kinds, causal formulas, actions
  and screens are all authored per game.
* **The local LLM** does what LLMs are good at: interpreting long briefs, making design
  decisions, choosing and parameterizing mechanics, writing domain formulas and content,
  critiquing, and planning targeted changes. For mechanics the engine cannot express, it writes
  **custom JS modules** against a small hook API (`engine/core/hooks.js`), and tests check them.
* **Deterministic software** does arithmetic, simulation, validation, testing, balancing (a
  parameter auto-tuner), rendering, persistence and bundling (Rule 44).

This is what makes "remaster / expand / rebalance / redesign the fleet page" possible later:
the studio edits a structured design and a few modules instead of regenerating a monolith.

## 2. Local inference stack (Apple Silicon, 24 GB)

| Option | Verdict |
|---|---|
| **Ollama** (default) | One-click macOS app, Metal acceleration, model library with sizes, JSON-schema-constrained output (`format`), streaming `/api/pull` for in-app model installs, runs as a localhost service. Best install simplicity for a non-programmer, and structured output is critical for the staged pipeline. |
| **LM Studio / mlx-lm server** (supported) | Apple MLX can be faster on M-series chips. Both expose an OpenAI-compatible endpoint, which the studio supports as a second provider type, so you can switch without code changes. |
| llama.cpp server (supported) | Also OpenAI-compatible, so the same provider works. |
| Cloud providers | Optional and **disabled by default**. They must be enabled explicitly in Settings with your own key, every premium call needs deliberate selection, and nothing calls out silently. |

**Memory budget.** macOS lets the GPU wire roughly two thirds of unified memory by default on a
24 GB machine (~16 GB). The model manager reads the real figure (`sysctl iogpu.wired_limit_mb`,
`hw.memsize`). It computes `model file size + KV cache(context) + overhead` from the *actual*
size reported by Ollama for installed models, and from the catalog size before download, then
labels each model **Fits / Tight / Won't fit**. Recommendations (`studio/server/llm/presets.json`):

* **Fast**: ~8B instruct model (~5 GB). Classification, extraction, summaries.
* **Balanced** (default main model): ~14B instruct model (~9 GB) at 16–32k context.
* **Best that fits**: a ~20B model (~13–14 GB) at moderate context. The fit is computed, not assumed.

Models load **sequentially**, so only one big model is resident at a time. Roles (fast / main /
critic) map to models in Settings, and they can all be the same model. A built-in model
benchmark measures tokens/sec and JSON-schema compliance on *your* machine and stores the
result so recommendations reflect reality.

## 3. Pipeline (state machine, resumable)

Each stage is a function `(projectContext) → artifact` with a JSON schema, a validator and a
repair strategy. Artifacts are stored as project memory documents (Rule 22). On failure the
orchestrator repairs the failing artifact only (Rule 34). The checkpoint is saved after every
stage, so a crashed build resumes where it stopped.

1. **Prompt Compiler.** Long briefs are chunked (map-reduce). Extracts MUST / SHOULD / OPTIONAL /
   NEGATIVE / VISUAL / SIMULATION / CONTENT / SANDBOX requirements, inferred settings and
   conflicts. → `REQUIREMENTS.json`
2. **Executive Producer.** Fantasy, role, era, scope, tone, universe mode. → `GAME_BRIEF.md`
3. **Lead Game Designer.** Pillars, core loop, decision cadence, progression, failure and
   recovery, archetype strategies, and a *what not to simulate* list. Every candidate feature is
   scored with the anti-bloat rubric. → `DESIGN_PILLARS.md`, `CORE_LOOP.md`
4. **Systems Designer.** System map with inputs, decisions, state, outputs, dependencies,
   feedback and failure modes, then GDL fragments per system. → `SYSTEM_MAP.md`, GDL `kinds/markets/actions/...`
5. **Economy & Balance Designer.** Parameters and target curves (time to first expansion,
   runway, late-game pressure). → GDL `params`, `balance.targets`, `ECONOMY_RULES.md`
6. **World Simulation Designer.** Rival archetypes, world variables, shocks, trends, entrants
   and exits, simulation levels.
7. **Content Designer.** State-bound events, crises, milestones, awards, news templates.
8. **UX / Information Architect.** ≤7 task-based destinations, home, inspectors, onboarding. → `UI_MAP.md`
9. **Creative Director.** Palette, typography, motif and signature visualization. → `VISUAL_DIRECTION.md`
10. **Assemble → Validate → Lint/Enrich.** Schema, references, formula compilation, a dry-run
    simulation and the anti-bloat lint. Commissioner, save and history standards are enforced
    automatically.
11. **Build.** Writes the project's modular source tree (`game/src`, `game/data`, `game/styles`,
    `game/tests`).
12. **QA.** Unit/integration tests run headless in Node; browser tests run in Chromium when
    available.
13. **Playtest bots + Balance Lab.** 9 strategies × N seeds. A detector suite covers dominant
    strategy, snowball, death spiral, passive play and notification fatigue, and an auto-tuner
    adjusts balance parameters.
14. **Critics.** Game-design and UX critics combine deterministic detectors with LLM review of
    metrics and screenshots. Findings become GDL patches, then the build re-runs from step 10
    (bounded iterations).
15. **Final Auditor.** A requirements matrix (requirement → implemented? tested? where? notes)
    built from trace links. Quality gates 1–10.
16. **Package.** Standalone HTML, a folder build, release notes.

## 4. Projects (Rule 7, 22, 33)

```
projects/<slug>/
  project.json            status, versions, settings
  prompt.md               original brief (+ attachments/)
  memory/                 GAME_BRIEF.md DESIGN_PILLARS.md CORE_LOOP.md SYSTEM_MAP.md ENTITY_SCHEMA.md
                          ECONOMY_RULES.md UI_MAP.md VISUAL_DIRECTION.md COMMISSIONER_SPEC.md
                          REQUIREMENTS_MATRIX.md KNOWN_BUGS.md BALANCE_REPORT.md CHANGELOG.md
  game/                   current development source (modular)
    index.html            dev loader (opens directly in a browser)
    engine/               engine copy pinned to this project
    data/game.json        the Game Definition
    src/custom/           game-specific modules
    styles/theme.css      generated visual identity
    tests/                generated test suite
  versions/v0-design … v5-release/   snapshots (restorable)
  reports/                tests, playtests, balance, UX, audit, screenshots
  releases/<slug>.html    standalone build
```

## 5. Runtime separation inside every generated game (Rule 9, 43)

`engine/core` (rng, expressions, utils, hooks) → `engine/sim` (state, kernel, modules) → `engine/ui`
(shell, sections, dialogs, themes) → `engine/persist` (IndexedDB slots, export/import,
migration). The simulation never touches the DOM, so the same code runs headless in Node for
tests, bots and the Balance Lab.

## 6. Security / locality (Rule 36)

The server binds to `127.0.0.1` only. There is no telemetry. Cloud providers are off by
default and can only be reached when you explicitly enable them. Generated games make no
network requests (the release linter rejects external URLs).
