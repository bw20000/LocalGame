# Requirements matrix

| ID | Requirement | Kind | Implemented? | Where |
|---|---|---|---|---|
| R1 | small regional airline | must | implemented | orgs.player.start; progression.tiers.regional |
| R2 | can eventually build a global carrier | must | implemented | progression.tiers; theme; ui.screens.network; ui.screens.fleet |
| R3 | aircraft economics | must | implemented | kinds.aircraftType; kinds.aircraft; kinds.route.operate.costs; actions.orderAircraft |
| R4 | routes | must | implemented | kinds.route; actions.openRoute; actions.setFare; actions.setFrequency |
| R5 | hubs | must | implemented | kinds.base; actions.openBase; actions.upgradeBase; kinds.route.operate.attrs.conn |
| R6 | labor | must | implemented | stakeholders.union; negotiations.laborContract; events.strikeThreat; events.contractTalks |
| R7 | airport negotiations | must | implemented | negotiations.airportDeal; actions.negotiateAirport; kinds.agreement |
| R8 | customer segmentation | must | implemented | markets.airTravel.segments; actions.changeCabin |
| R9 | alliances | must | implemented | kinds.alliance; actions.joinAlliance; negotiations.allianceJoin; events.allianceInvite |
| R10 | acquisitions | must | implemented | actions.acquireAirline; negotiations.acquisition; projects.integration; theme |
| R11 | recessions | must | implemented | world.cycle; events.recessionBoard; World: economic cycle with shocks |
| R12 | fuel prices | must | implemented | world.vars.fuel; policies.fuelHedging; events.fuelSpike |
| R13 | regulators | must | implemented | stakeholders.scrutiny; events.investigation |
| R14 | competitors | must | implemented | orgs.rivals; events.fareWar; Rival organizations using the same actions (heuristic AI with archetypes, memory, entries, exits) |
| R15 | history | must | implemented | history.records; history.awards; history.milestones; History module: records, awards, milestones, timeline, annual reviews |
| R16 | commissioner mode | must | implemented | Engine: Commissioner (edits entities, companies, world, events, rules, time) |
| R17 | very polished visual interface | must | implemented | theme; ui.screens.network; ui.screens.fleet; Theme: departure-board motif, signature visualizations |
| R18 | Make it deep but not overwhelming. | should | implemented | policies; Engine + UI map: ≤7 destinations, needs-you queue, inspectors, Why? explanations, policies |
| R19 | Deep but not overwhelming: progressive disclosure, task-based navigation | must | implemented | kinds.base; actions.openBase; actions.upgradeBase; kinds.route.operate.attrs.conn |
| R20 | Commissioner mode that edits the real simulation | should | implemented | Engine: Commissioner (edits entities, companies, world, events, rules, time) |
| R21 | Robust saves: autosave, slots, export/import | should | implemented | negotiations.airportDeal; actions.negotiateAirport; kinds.agreement; Engine: saves (autosave, slots, rename, duplicate, delete, export/import, migration) |
