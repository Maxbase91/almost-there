# Almost There — Game Design

Status: v8 spec (2026-11-10): ten levels, 32 hazard types. Supersedes v6 (two modes, 27 types).
Decisions behind this spec are logged in [DECISIONS.md](DECISIONS.md).

## 1. Premise

Carry a birthday cake 100 m to the party table. The course is beatable with skill, brutally hard, and different every
run. Reaching the table is a real win (D16) and should be rare: about 1 in 20 runs for a good player. The player keeps
trying because every death is attributable, the next course is new, and the run log shows how far they got.

Two kinds of loss exist and they must feel different:

| Loss | Cause | Feedback | Counts in Journal |
| --- | --- | --- | --- |
| Honest loss | Touching a hazard, falling in a hole, a crate from above, being caught by the pig | Hit-stop + shake, game freezes, fail card names the hazard and the distance, player taps to retry. Never auto-restarts. | Run log: deaths per hazard, best distance |
| Win | Reaching the table | Fanfare, confetti, "CAKE DELIVERED", win counter | Run log: wins |

The 22 joke endings from v1–v3 still exist in `src/endings.js` and run only with `?endings=1`.

Target (D16): a good player reaches the table about **1 in 20 runs**. Measured with a synthetic "human-ish" player
(reaction jitter σ = 0.13 s, 14 % dropped inputs, occasional panic jumps under bees) over 2 000 seeded courses:
**≈ 14 %** reach the table (real players do worse: the proxy has no panic, fatigue or touch latency, and it knows where every beam, slime and blackout is). A flawless synthetic player reaches it on **100 %** of seeds, so every course is beatable.

## 2. Core loop

1. Loading screen (sprites, font) → title → "Deliver the cake".
2. A course is generated from a fresh seed (§3). Nothing is previewed.
3. Auto-run right. Speed ramps from 300 px/s to 525 px/s (1.75×) across the course (D18). Gust stretches change it by ×0.8 or ×1.25.
4. One input: jump (Space / ↑ / W / tap). A tap is always a full jump; holding floats a little higher.
   A second press in the air is a **double jump** (D9), lower than the first: it buys distance, not a free escape (D15). Jumps reset on landing (the D17 landing lag was removed in D18).
5. Hazard hit or fall → `DEAD`: 120 ms hit-stop, shake, cake flies, fail card. Space/tap retries once the card has been visible for 0.4 s.
6. Table reached → `WIN`: cheer, confetti, win screen after 2 s. Again generates a new course.

Phases: `TITLE → RUNNING → DEAD | WIN` (`ENDING → LOST` only with `?endings=1`). No transition out of `DEAD` without an explicit player action (D2).

## 3. Course generation

`generateCourse(rng)` in `src/game.js`, deterministic per seed (`?seed=`).

- Length 100 m (10000 px). Player starts at 1.2 m. Table at 100 m.
- 16–17 slots walked from 4.8 m toward 96.5 m (plus gust stretches). The gap between slots shrinks from 0.8 s to 0.55 s of running (at the local speed); anything that needs a double jump (wall, holes, combo) gets +0.7 s after it, moving hazards, pigs, bees, beams and peels get run-up before them. A course stops early when it runs out of room; the average is ≈ 13 hazards.
- Extra room: +0.7 s after anything that needs a double jump (the player is airborne ≈ 1.3 s), +0.3 s before a dog or skateboard, +0.5 s before a wall, +0.8 s before a pig, +0.6 s before a bee, and a pigeon always gets its full dive run-up.
- Limits per course: 1–3 pigs (never first; one is guaranteed), ≤ 3 bees, ≤ 1 pigeon, ≤ 1 wall, ≤ 1 wide hole, ≤ 1 combo, ≤ 1 boomerang, ≤ 2 each of creep, grower, canopy and popup; no type twice in a row; chasers (pig, pigeon, boomerang) at least two slots apart; a popup never directly follows a blackout or the other way round.
- `generateCourse(rng, profile)`: a level's profile scales pool weights, may raise a limit by one and says which stretches allow ice and blackouts (§3b, D22). The default profile is the birthday-cake course.

### Hazard pool

| Type | Behaviour | How to clear | Art |
| --- | --- | --- | --- |
| Fence | Static, 58 px. | Jump | Pixel Platformer fence tile |
| Wall | Static stack, 172 px: a single jump cannot clear it. | Jump, then double jump near the apex | Three crates + flag |
| Hole | 160–200 px gap in the ground. Standing over it = fall; most need a double jump. | Jump, usually twice | Ground tiles removed, dark pit |
| Big hole | 230–280 px gap, wider than a single jump. | Jump + a well-timed double jump | Same |
| Combo | Fence followed 60 px later by a 170 px hole: a normal jump lands inside the hole. | Jump the fence, double jump mid-air | Fence + hole |
| Puddle | A dark raining cloud marks the spot (damp line underneath); the puddle forms when the player is within 7 m. Only standing in it hurts. | Jump | Pixel cloud + stepped puddle |
| Bee | Hovers at jump height with a shadow on the ground, drifts toward the player. Standing players pass under it; jumping into it is a fail. | Do not jump | Pixel Platformer bee, 2 frames |
| Crate (meteor) | A shadow appears ahead and grows for 1 s, then a crate crashes down (shake). Under it at impact = fail; afterwards it is a plain crate to jump. | Avoid the shadow, then jump the crate | Crate tile falling |
| Crack | The ground rumbles and cracks for 0.8 s, then a 130 px hole opens. | Jump it once it opens (or before) | Cracks, then a hole |
| Banana peel | Slides in from the right and comes to rest. Stepping on it: 0.6 s uncontrollable slide at 1.5×, no jumping, straight into the fence placed inside the slide. | Jump the peel | Hand-pixeled banana |
| Beam | A low wooden span over 1.2–1.8 s of ground ("MIND YOUR HEAD"). Standing players pass; any hop hits it. Often followed 0.5 s later by a fence or hole, so the jump must come the instant the beam ends. | Do not jump until you are out | Pixel beam on posts |
| Cow | 130 px wide, plods toward you, moos. | Jump + double jump | Tiny Farm cow ×2 |
| Chickens | Three run at you in a line, 80 px apart. | Jump, land between, jump; or one double jump | Tiny Farm chicken |
| Slime | Hops up as you arrive and hovers for 0.8 s. | Run under it; never jump into it | Pixel Platformer slime |
| Snake | 110 px long, low, slithers toward you. | Jump from the edge | hand-pixeled |
| Mole | Mound; pops up 0.3 s after the dirt spray when you are 1.2 s away. | Hop it after it pops | hand-pixeled |
| Finance bro | Yells "BUY THE DIP"; a 110 px dip opens in front of him 0.8 s later. | Jump the dip and him in one jump + double jump | repo-man sprite + phone |
| Spiked ball | Low wrecking ball swinging across a 192 px sweep. | Jump the whole sweep (double jump at low speed) | Pixel Platformer spike ball + chain |
| Trampoline | Spring that launches a runner high with no control, into a beam placed past a normal landing. | Jump over the spring, then run under the beam | hand-pixeled spring |
| Egg rain | A line of four eggs falls where a runner will be, 0.6 s shadow each. | Jump each landing spot (or let it land behind you) | hand-pixeled egg |
| Knives | Three knives fall with 0.45 s glints and stay stuck as 30 px obstacles. | Dodge the drop, hop the stuck knives | hand-pixeled knife |
| Blackout | Lights flicker, then darkness except a circle around you (1 s; 1.5 s at night). Nothing physical changes. | Remember what you saw | render overlay |
| Ice (snow) | A stretch where every landing slides 0.35 s with no jump control. | Land early | ice tiles |
| Creep (v8) | A 190 px hole that starts sliding toward you at 70 px/s once you are within 6 m. | Jump earlier than it looks | Hole with crumbling rim, or goalposts |
| Grower (v8) | Knee-high (36 px) until you are ≈ 1.25 s away, then shoots up to wall height in 0.3 s. | Jump + double jump, like the wall | Beanstalk, or a growing pile of paper |
| Canopy (v8) | A bar 190 px up over 0.9 s of ground with a fence under it. A single jump (head at ≈ 172 px) fits under the bar; a double jump does not. | One hop over the fence, no second press | Bunting line, or a glass slab |
| Boomerang (v8) | Appears ahead, flies over at bee height, turns around behind you and returns along the ground at pig speed. Edge marker on the return. | Stay down for the fly-over, jump the return | hand-pixeled boomerang / task card |
| Popup (v8) | Not lethal. Fog (cake family) or windows (office family) cover the view ahead for ≈ 1.4 s; nothing is placed inside. | Remember what you saw | render overlay |
| Gust | Not a hazard: a stretch of ground with a headwind (×0.8) or tailwind (×1.25), marked by leaves, announced by a label. Placed with normal spacing on both sides and held until you land, so it only disturbs timing. | Re-time your jumps | Leaves, label |
| Dog | Sits until the player is within 4.5 m, then charges. | Jump as it arrives | Hand-pixeled dog with "!" |
| Skateboard | Rolls toward the player from 6 m, random speed. | Jump | Hand-pixeled board |
| Pigeon | Perches on a pole; within 4.8 m it dives for the cake and skims the ground. | Jump as it arrives | Pixel Platformer bird, 3 frames |
| Pig | Spawns 5.2 m behind, runs 2.6× player speed, passes about a second after the "OINK" and edge indicator. | Jump so it passes underneath | Hand-pixeled pig |

Measured single-jump windows at base speed are 0.30–0.45 s per type; the speed ramp compresses them toward the end.

## 3b. Levels and stretches (D22)

Ten levels in two families. A level reskins every hazard, brings four backdrops and a course profile; rules and
physics are shared. How to write one: [LEVELS.md](LEVELS.md).

| Family | Level | Carry → goal | Stretches (25 m each) | Plays like |
| --- | --- | --- | --- | --- |
| cake | Deliver the cake | birthday cake → party table | meadow, desert, snow, night | the original mix |
| cake | Save the wedding | wedding cake → beach altar | beach, pier, palm jungle, sunset | wind, tide pools, seagulls |
| cake | Pumpkin pie run | pie → haunted party | pumpkin field, graveyard, haunted forest, storm castle | dark, things that pop up and swing |
| cake | Pizza before midnight | pizza box → hungry customer | high street, park, rooftops, neon district | traffic and things from above |
| cake | Last present | present → tree | village, pine forest, frozen lake, aurora night | ice almost everywhere |
| office | Ship the project | laptop → go-live demo | open plan, server room, cold meeting room, after hours | the original mix |
| office | Close the quarter | quarterly report → board | finance floor, archive, boardroom, night desk | paper from above, a CFO behind |
| office | Migrate to the cloud | database → cutover console | server hall, the cloud, legacy cave, 3 am war room | outages and holes |
| office | Survive the offsite | flipchart → closing circle | hotel lobby, conference hall, ropes course, karaoke bar | trampolines, swings, queues |
| office | Run the tender | signed contract → supplier | sourcing desk, supplier warehouse, legal library, negotiation room | committees and paperwork |

The birthday-cake biomes below are that level's four stretches.

### Birthday-cake biomes

Four 25 m segments: **meadow**, **desert** (sand ground, orange hills, big sun; walls are giant cacti and skateboards are tumbleweeds), **snow** (snow ground, pale hills, snowmen, ice patches), **night** (stars, lanterns, darker and longer blackouts). Ground tiles and props swap at the boundary; ice only appears in snow, blackouts never in the meadow and twice as often at night.

## 4. Endings at the table

22 scripted and interactive endings in `src/endings.js`, picked without repeats until all have been seen.
All drawn with sprites (hero, cake, table, kid, pigeon, cat, referee, repo man, banana, clock, flame); no emoji.

## 5. Presentation

- **Art:** pixel art at 3× (18 px tiles → 54 px). Kenney CC0 packs for tiles, hero, bird, backgrounds, props and UI; hand-pixeled sprites in `src/pixelart.js` for everything else. Sources in `assets/LICENSES.md`.
- **Parallax:** pale far layer (0.15), green hills (0.4), clouds (0.3), ground.
- **Juice:** landing dust, running dust, double-jump puff and afterimage, hit-stop, shake, a soft flash and a zoom punch on death, speed lines above 1.22×, cake bob, debris on impacts, fireworks on a win, a banner naming each stretch.
- **Ambient (D24):** per stretch: snow, rain, storm, leaves, petals, embers, fireflies, bats, sea spray, fog, paper, sparks, dust, aurora, music notes. Reduced motion halves it and drops every flash.
- **HUD:** pixel panels with distance and honest progress, speed chevrons, tries, wins, best distance, sound state; "HEADWIND/TAILWIND" and "SLIDING!" labels.
- **UI:** title, fail card, loss card, dialog, terms and journal are DOM panels in the same pixel style with the Press Start 2P font.
- **Audio:** CC0 chiptune loop (Lasso Lady) + Kenney SFX for jump, double jump, hit, oink, flap, fanfare, loss, clicks. Starts on the first gesture; mute button and `M` key, persisted.

## 6. Controls and platforms

Desktop: Space / ↑ / W, M to mute. Mobile: tap anywhere (the canvas or the space around it); second tap mid-air double-jumps. Landscape shows the full 960 px view; portrait crops it to 600 px around the same centre so sprites draw about 1.6× bigger (480 px of lookahead instead of 672, D21). The layout stays inside the iPhone safe area, menus go full screen in portrait, and touch targets are at least 44 pt.

Levels (D20, D22): ten levels in two families share every hazard and rule; a level reskins them and tunes the mix (§3b, `src/themes.js`, `src/levels/`).

## 7. Non-goals

Leaderboards, course preview or seed sharing UI, level unlocks, pig ending, branching routes.

## 8. Dev parameters

`?seed=N`, `?course=fence@700,pig@2600` (type@x px), `?level=<id>` (`cake wedding pumpkin pizza xmas office quarter cloud offsite tender`), `?autopilot=1` (flawless player), `?ending=<id>`,
`?autoplay=1` (start without a click), `?advance=S` (step S seconds at boot, for headless screenshots), `?endings=1` (joke endings at the table),
`?debug` (`window.__almost`: `state`, `journal`, `restart()`, `advance(s)`, `press()`).
