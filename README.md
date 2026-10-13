# Almost There

A tiny, brutal 2D browser game. Carry a birthday cake 100 metres to the party table through a dozen or more hazards that are different every run: fences, walls that need a double jump, holes, a charging dog, a rolling skateboard, a swooping pigeon, a pig charging from behind, bees, beams and hopping slimes you must run under, cows, chickens, snakes, moles, a finance bro with a dip, a swinging spiked ball, trampolines, egg rain, falling knives, blackouts, ice, crates, cracks, banana peels and gusts, across meadow, desert, snow and night. Reaching the table is a real win and happens about once in twenty good runs. The run log remembers what got you.

Design spec: [docs/GAME-DESIGN.md](docs/GAME-DESIGN.md). Owner decisions: [docs/DECISIONS.md](docs/DECISIONS.md).

No framework, no bundler. One HTML page, a few ES modules, pixel-art sprites from Kenney's CC0 packs plus a few hand-pixeled ones, and a CC0 chiptune. Everything is free to use; sources are listed in [assets/LICENSES.md](assets/LICENSES.md).

## Run

```bash
npm run dev
```

Opens a static server on http://localhost:5300 (ES modules need a server; `file://` will not work). Any static host works for deployment: the folder is deployable as-is.

## Test

```bash
npm test
```

Vitest covers the pure logic: course generation (limits, ordering, 500 seeds all beatable by the flawless player, a human-like player reaching the table 25–45 % of the time), double jump, holes, wall and combo, every hazard type in isolation, the frozen DEAD state, the ending pool and no-repeat picker, and journal persistence. Rendering is verified with headless Chrome screenshots (`?autoplay=1&advance=S`).

## How it works

- `src/game.js` is a pure state machine: `createState`, `startRun`, `step(state, input, dt)`, plus `generateCourse(rng)` for the seeded per-run course. Phases: `TITLE → RUNNING → (DEAD | ENDING) → LOST`. Hitting a hazard is an *honest* loss: the game freezes on a fail card until the player retries. Reaching the table always triggers an ending.
- `src/autopilot.js` is the competent player used by the tests and `?autopilot=1`.
- `src/endings.js` holds the 22 endings and `pickEnding(rng, seenIds, lastId)`, which never repeats an ending until all have been seen.
- `src/journal.js` stores seen endings, attempts and the (rigged) personal best in `localStorage` under `almost-there:v1`.
- `src/sprites.js` maps sprite names to sheet tiles and draws them crisp at 3×; `src/pixelart.js` holds hand-pixeled sprites as string grids.
- `src/render.js` draws the world (parallax, ground with holes, hazards, hero, cake, table), overlays and HUD; `src/main.js` wires input, loading, the loop and the DOM panels; `src/audio.js` plays the CC0 music loop and effects.

The progress bar never reports 100 % while you can still see it move, and the "personal best" creeps up a tenth at a time so a new record keeps appearing.

## Adding an ending

Append an object to `ENDINGS` in `src/endings.js`:

```js
{
  id: 'unique-id',
  title: 'Shown on the loss card',
  caption: 'One line of consolation.',
  duration: 3.5,              // seconds before the loss card; Infinity for interactive endings
  setup(s) {},                // runs once; s is the game state
  update(s, dt) {},           // runs every frame; use at(s, time, key, fn) for timed beats
  drawWorld(g, s) {},         // optional, drawn inside the camera transform
  drawScreen(g, s) {},        // optional, drawn in screen space
}
```

Useful knobs on the state: `s.player.pose` (`run | jump | stand | fall | slip | sad | cheer | float`), `s.player.say`, `s.kid.say`, `s.cake.visible`, `launchCake(s, vx, vy)`, `s.table.vx`, `s.table.collapsed`, `s.camera.zoom / focusX / shake / pan`, `s.gravitySign`, `s.overlay` (`modal | card | win | toast | fade | clock`) and `spawnFx`. Interactive endings set `s.ending.waiting = true` and resolve through `s.ui.showDialog` / `s.ui.showTerms`. The test suite runs every ending to completion automatically.

## Dev query params

- `?seed=N` reproduces a course; `?course=dog@1500,pig@2600` builds one explicitly (type@x in px). Types: `fence wall puddle dog skate pigeon pig pit pitwide bee meteor crack peel wind beam cow chickens slime snake mole bro pendulum trampoline eggrain knives blackout ice`.
- `?endings=1` brings back the 22 joke endings at the table; `?ending=<id>` forces one of them.
- `?autopilot=1` makes a flawless synthetic player play the course.
- `?autoplay=1` starts without a click and `?advance=S` steps the simulation S seconds at boot (used for headless screenshots).
- `?debug` exposes `window.__almost` with `state`, `journal`, `restart()`, `setAutopilot(bool)` and `advance(seconds)` for deterministic stepping.

Ending ids: `banana pigeon bennyhill areyousure gravityflip wrongday connection sneeze disqualified sprinklers cat level404 repoman terms shoelace earthquake physicsquit dream fakewin nah displayonly wrongtable`.
