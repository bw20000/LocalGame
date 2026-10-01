# Game Design Intelligence Library

Persistent, local, editable knowledge the studio retrieves during design, critique and repair.

| File | Contents | Used by |
|---|---|---|
| `reference-audit.json` | Structured audit of the provided games (keep / fix lists) | Producer, Designer, Remaster workflow |
| `core-loops.json` | Loop patterns, time scales, pacing rules | Lead Game Designer |
| `mechanics.json` | ~40 reusable mechanics mapped to GDL constructs | Systems Designer, Content Designer |
| `ui-patterns.json` | UI patterns, navigation rules, visual motifs | UX Architect, Creative Director, UX Critic |
| `failure-taxonomy.json` | 25 bad patterns with automated detectors and fixes | Game Design Critic, UX Critic, Balance Lab |
| `fun-patterns.json` | Fun principles with apply/test rules | Lead Game Designer, Critic |
| `fantasies.json` | 35 management genres: fantasy verbs, tensions, entities, signature visuals, what NOT to simulate | Prompt Compiler, Producer, Creative Director |
| `feature-rubric.json` | Anti-bloat scoring rubric (Rule 27) | Lead Game Designer |
| `exemplars/` | Complete example game definitions used as few-shot references | All design stages |

Edit freely: the studio re-reads these files on every build. Your personal preferences live
separately in `studio-data/preferences.json`.
