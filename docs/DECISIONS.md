# Decisions

Owner decisions for Almost There, in the order they were made. Each entry: Context → Decision → Consequences.
Assumptions I made without asking are marked **Assumed** and are open to change.

## D1. Concept and stack (2026-10-10)

Context: a silly 2D game that always lets you lose, with a different flaw each time.
Decision: cake-delivery side-scroller; static HTML + vanilla JS + Canvas in `apps/almost-there/`, Vitest for pure logic.
Consequences: no build step, deployable as static files; rendering is verified in the browser, not in tests.

## D2. Hazard hit = explicit fail card, tap to retry (2026-10-11)

Context: v1 auto-restarted 1.6 s after a hazard hit and any tap during that window restarted immediately. On a phone this read as "the game randomly restarts", and the flat puddle was invisible enough that deaths had no visible cause.
Decision: a hazard hit freezes the game and shows a card naming the hazard. The run restarts only on the Try again button, or Space/tap after the card has been visible for 0.4 s. No auto-restart anywhere.
Consequences: every death is attributable; `DEAD` is a stable state with no timer. Hazard deaths are not Journal entries (option "hazard hit is itself a journaled ending" was declined).

## D3. Random course per run (2026-10-11)

Context: the fixed course made every run identical, so the player never felt the next run could go differently.
Decision: generate 3–5 hazards per attempt from a seeded RNG with random types, positions and timing. No branching routes.
Consequences: `generateCourse(rng)` replaces the `HAZARDS` constant; tests cover spacing, bounds and reproducibility.

## D4. Dynamic hazard pool (2026-10-11)

Decision: dog that charges, puddle that forms under a rain cloud, rolling skateboard, pigeon that swoops mid-course, and a pig that chases from behind. The static fence stays as a baseline.
Consequences: hazards carry per-frame state (position, phase) and need a warning cue so a hit never feels random.

## D5. Pig behaviour (2026-10-11)

Decision (owner wording): "the pig runs faster and you have to jump so it can pass".
Consequences: the pig is a hazard from behind. It spawns 5.2 m behind the player at a trigger point, runs at 2× player speed with an "OINK" warning, and the player must be airborne when it passes. Contact = fail card "The pig got you."
**Assumed:** one pig per run at most, always the last hazard; pig and pigeon never in the same run; the pig does not get its own table ending (that option was not chosen). Speed was set to 2× rather than a smaller margin because a slower pig takes longer to pass underneath and makes the jump window tighter, the opposite of D6.

## D6. Difficulty: forgiving, 3–5 hazards (2026-10-11)

Decision: jump window ≈ 0.35 s, hazards ≥ 2.5 s apart. Most players reach the table in 2–3 tries.
Consequences: jump height and hazard widths are tuned together; a sweep test verifies a single timing window clears every hazard type (measured 0.30–0.45 s per type). Variable jump height was removed as a failure source: a short tap used to give a 16 px hop that cleared nothing, which on a phone looked like dying for no reason.

## D7. No course preview (2026-10-11)

Decision: nothing is shown before a run; variation is discovered while running.
Consequences: no mini-map, no course number on the HUD. A `?seed=` dev param exists for reproduction only.

## D8. Docs location (2026-10-11)

Decision: `docs/GAME-DESIGN.md` (spec) and `docs/DECISIONS.md` (this file) inside the game; README links both; plan in `apps/tasks/todo.md`.

## D9. Double jump (2026-10-11)

Context: owner: "it should be possible to do double jumps". The single jump also made every obstacle the same decision.
Decision: a second press in the air jumps again (slightly lower). New obstacles exist only to use it: a 172 px wall, a 240–290 px wide hole, and a fence-then-hole combo where a normal jump lands inside the hole.
Consequences: `player.jumpsLeft`, `pose: 'flip'`; the autopilot simulates arcs to time its second jump; tests prove single jumps cannot clear the wall or wide hole.

## D10. Speed ramp, holes, denser courses, pig twice (2026-10-11)

Decision (owner picked all four): run speed climbs to 1.4× by the table; gaps in the ground are hazards; 5–7 slots per course with the spacing shrinking toward the end; the pig may charge twice.
Consequences: all hazard triggers use the local speed; course generation walks forward with a shrinking time gap and adds room after double-jump obstacles and before moving hazards (found by the fairness test: a skateboard arriving under a player still airborne from a wall).

## D11. Reach rate ≈ 1 in 3 (2026-10-11)

Decision: a good player should reach the table about one run in three.
Consequences: made measurable with a synthetic "human-ish" player (reaction jitter σ = 0.12 s, 12 % dropped inputs) over 1 000+ seeded courses; the test asserts 25–45 %, measured ≈ 42 %. A flawless synthetic player must reach the table on 100 % of seeds. The noise parameters are a calibration device, not a claim about real players; retune them if the owner finds the game too easy or too hard.

## D12. Pixel art from Kenney CC0 packs (2026-10-11)

Context: owner: "it looks all underwhelming in the UI … needs to remain free, but nice". Downloads approved.
Decision: pixel art at 3× from Kenney "Pixel Platformer" (tiles, hero, bird, backgrounds), "Tiny Farm" (kid, props), "UI Pack – Pixel Adventure" (panels), Press Start 2P font; everything no pack has is hand-pixeled in `src/pixelart.js`. Vanilla canvas kept; no engine switch.
Consequences: `assets/` (≈ 1 MB incl. music) with `LICENSES.md`; `src/sprites.js` atlas; no emoji anywhere; DOM panels restyled to match. Kenney's "New Platformer Pack" turned out to be vector art and was not used.

## D13. Audio (2026-10-11)

Decision: chiptune loop + real SFX, mute button.
Consequences: "Lasso Lady" (CC0, OpenGameArt) loop and Kenney CC0 effects via Web Audio; starts only after the first gesture; mute persisted under `almost-there:mute`; `M` key toggles.

## D14. Re-skin all 22 endings now (2026-10-11)

Decision: every ending uses sprites; ending-specific props (cat, referee, repo man, banana, clock, flame, sprinklers) hand-pixeled.
Consequences: ending timings unchanged; the ending test suite still runs all 22 to completion.

## D15. "Still way too easy with double jumps" (2026-10-11, owner feedback after playing v3)

Context: the double jump had no counter, so any obstacle could be hopped; the puddle's white cloud looked like scenery; the pig was only in ~40 % of courses.
Decision (made by me, open to change): add a **bee** that hovers at jump height and must be run under (jumping into it is a fail card); make the double jump lower (470 vs 600) so it buys distance, not a free escape; raise base speed to 280 and the ramp to 1.55× (434 px/s at the table); hold-float reduced; gaps 1.05 s → 0.7 s; up to 7 slots; bee weight high (≈ 0.6 per course, up to 3). The puddle marker is now a dark raining cloud with a damp-patch line; every course has at least one pig; walls, pigs and bees get extra run-up so the flawless player still clears 100 %.
Consequences: the synthetic human-ish player (σ 0.13 s, 14 % dropped inputs) now reaches the table ≈ 36 % of runs (band 20–40 %). The real test is the owner on the phone; the knobs are `BASE_SPEED`, `SPEED_RAMP`, `DOUBLE_JUMP_V`, `COURSE.gapSec*` and the POOL weights in `src/game.js`.

## D16. Real win, almost impossible, unexpected events (2026-10-11, owner feedback after v3.1)

Context: owner: "still too easy … the comments in the finish are stupid, it should be possible to pass, but it should be super hard to reach the finish, almost impossible, more unexpected events."
Decisions (owner, asked): reaching the table is a **real win** (fanfare, confetti, win screen, win counter); the 22 joke endings are out of play (kept behind `?endings=1`); target about **1 in 20** runs for a good player; all four event types: falling crate, gusts of wind, ground cracks, banana peel.
Decisions (mine): course lengthened to **80 m** so a run has 10–14 decisions instead of 5; gaps between hazards never shorter than one jump's flight (so a landing is never inside the next hazard, found by the fairness sweep); jumps smaller (560 / 440) and hazards wider so timing windows shrink; wall lowered to 140 px to stay clearable with the smaller double jump; the rigged progress bar and fake personal best replaced by honest distance, wins and a run log of what got you; gusts are placed course stretches (not timers), held until landing, and the pig's speed ignores them: time-based gusts kept shortening jumps into the next hazard.
Consequences: the flawless synthetic player clears every seeded course (sweep over 2 000 seeds); the human-ish player (σ 0.13 s, 14 % dropped inputs, panics under bees) reaches the finish ≈ 15 % of runs (the proxy does not model panic, fatigue or phone latency, so real players will do worse). That number is a proxy; the owner's phone is the judge. Levers: `COURSE.gapSec*`, `BASE_SPEED`, `SPEED_RAMP`, `JUMP_V`, hazard widths and POOL weights in `src/game.js`.

## D17. Beams and landing lag (2026-10-11, owner on the real v4 build: "still too easy, make the beams")

Context: the owner's earlier "second try" win was on a cached 36 m build (fixed with no-cache headers and a visible version tag). On the real v4 build the verdict was still "too easy".
Decision (owner): add the anti-air beams.
Decisions (mine): a **beam** is a low wooden span over 1.2–1.8 s of ground; its underside is 74 px up, so a standing player (62 px) passes and any hop hits it. 60 % of beams are followed by a plain fence or hole only 0.5 s after the beam ends, so the jump must come the instant you leave it (≈0.2 s window at base speed). Up to four beams per course, about one per course on average. **Landing lag**: a jump press within 0.1 s of landing is ignored, so spam and late taps stop working. Version tag "v4" shown on title and HUD; `serve.json` disables caching.
Consequences: flawless player still clears 2 000/2 000 seeds. The human-ish proxy stays ≈ 15 % because it knows exactly where beams are; real players will not. Smart jump-spam that avoids bees and beams reaches the finish ≈ 4.5 %.

## D18. "Still too easy, more hurdles, wider holes, faster pig, boring" (2026-10-11, owner on v4 with beams)

Decisions (owner): more hurdles, wider holes, faster pig.
Decisions (mine): course to **100 m** (v5) with 16–17 slots; gaps 0.8 s → 0.55 s; holes 160–200 px (most need a double jump now), big holes 230–280 px, combo hole 140 px; pig at **2.6×** player speed (pass ≈ 1 s after the OINK); no float on held jumps; speed ramp to **1.75×** (525 px/s at the finish); beams and bees weighted up (beams up to 5, pigs up to 3 per course). The **landing lag from D17 was removed**: at this density it made landings unwinnable, which the fairness sweep caught immediately; beams and bees punish spam instead. Two generation bugs surfaced by the sweep were fixed: the pig's trigger assumed 2× speed, and puddles/cracks (which start at zero width) spaced the next hazard from their start instead of their full width.
Consequences: flawless player clears 2 000/2 000 seeds; proxies: human-ish ≈ 11 %, smart spam ≈ 5 %; ≈ 13 hazards per course. The proxies know every hazard's position and timing, so they understate difficulty for real players.

## D19. More variation: new animals, painful flaws, four biomes (2026-10-11, owner: "add more variations, more animals, more painful flaws, be creative")

Decisions (owner, asked): cow, chicken line, slime, snake, mole, a crazy finance bro; blackout, trampoline, egg rain, spike pendulum, falling knives; four biomes.
Decisions (mine, with the same two invariants as always: a warning cue, and the flawless player clears every seeded course):
- **Cow** plods at you, too wide for one jump. **Chickens** run at you in a line of three. **Snake** slithers, long and low. **Mole** pops out of its mound only when you are close, so an early hop lands on it. **Finance bro** stands his ground yelling "BUY THE DIP" and a dip opens in front of him: jump the dip and the bro in one jump + double jump. **Slime** hops up as you arrive: run under it; jumping into it is the mistake.
- **Pendulum** became a low wrecking ball swinging across its sweep: it hits runners anywhere in the sweep, you jump the whole sweep. (A head-height ball with timed windows was tried first: with a fixed arrival time there was often no safe action, so the fairness sweep failed 27 %.)
- **Trampoline** launches a runner with no control into a beam placed just past a normal jump's landing: jump the spring instead. **Egg rain** and **knives** fall on where a runner will be, with 0.6 s / 0.45 s shadow warnings; knives stay stuck as small obstacles. **Blackout** darkens everything except a circle around you (longer at night) and changes nothing physical, so it only hurts humans. **Ice** (snow biome) makes every landing slide with no jump control.
- **Biomes** every 25 m: meadow, desert (sand, cacti, tumbleweed), snow (ice, snowmen), night (stars, lanterns, longer blackouts).
- The flawless player's arc check was generalised from walls to every tall obstacle (cows and bros were being descended into), eggs and knives only trigger a double jump when the landing meets the impact, and both rains get double-jump spacing after them.
Consequences: flawless player clears 2 000 / 2 000 seeds; human-ish proxy ≈ 14 %; 27 hazard types in the pool (plus gust, blackout and ice stretches).

## D20. Office mode: "Ship the project" (2026-10-28, owner: "more parody items, amok IT scrum masters, jira tickets, complaining people … another version … project delivery in a company")

Decision (owner, asked): a mode select on the title screen, cake or project delivery; the carried item in the office is a laptop with the release.
Decisions (mine): the office mode is a **skin, not a second game**. Every hazard type id, its physics and the course generator stay shared; `src/themes.js` maps each id to office art, label, death line and speech-bubble words (pig → amok scrum master yelling "STANDUP!", chickens → Jira tickets "BLOCKER", slime → reopened ticket, mole → complaining colleague over a cubicle wall, dog → complaining customer, cow → steering committee, snake → approval chain, finance bro → agile coach "PIVOT!" with a backlog dip, eggs → reply-all emails, knives → pens, pendulum → reorg, blackout → forced OS update). Art sizes match the existing hitboxes so what you see is what hits you. The four biomes become open-plan, server room, cold meeting room and after hours. Each mode keeps its own run log (`almost-there:office:v1`; the cake log keeps `almost-there:v2`). The legacy joke endings (`?endings=1`) stay cake-only.
Consequences: the autopilot and every mechanics test cover both modes unchanged; new hazards must get office text and art (`tests/themes.test.js` fails otherwise).

## D21. iPhone layout: portrait zooms in (2026-10-28, owner: "optimise this game for the iPhone screen")

Context: in portrait the 960×540 canvas was a 390×219 strip and the menus overflowed it; there was no safe-area handling and pixels were stretched by a non-integer factor.
Decision (owner, asked): portrait zooms in rather than only asking to rotate.
Decisions (mine): portrait renders a **600 px wide** logical view around the same camera centre as landscape (render-only, physics untouched), so sprites draw about 1.6× bigger and the player keeps 480 px of lookahead (was 672). The stage is fitted inside the safe area, the canvas backing store matches device pixels, menus become full-screen panels, SOUND/LOG move above the stage, and tapping anywhere outside the panels jumps. A web manifest and apple-touch-icon make the home-screen app full-screen.
Consequences: portrait is slightly harder (less lookahead) than landscape; the lever is `PORTRAIT_VIEW_W` in `src/main.js`. The legacy endings draw their screen overlays for a 960 px view and can sit off-centre in portrait.
