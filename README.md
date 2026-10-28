# Almost There

A tiny, brutal 2D browser game. Carry a birthday cake 100 metres to the party table through a dozen or more hazards that are different every run: fences, walls that need a double jump, holes, a charging dog, a rolling skateboard, a swooping pigeon, a pig charging from behind, bees, beams and hopping slimes you must run under, cows, chickens, snakes, moles, a finance bro with a dip, a swinging spiked ball, trampolines, egg rain, falling knives, blackouts, ice, crates, cracks, banana peels and gusts, across meadow, desert, snow and night. Reaching the table is a real win and happens about once in twenty good runs. The run log remembers what got you.

A second mode on the title screen, **Ship the project**, runs the same course as an office parody: you carry a laptop with the release to the go-live demo past an amok scrum master, Jira tickets, an agile coach yelling "PIVOT!", complaining colleagues and customers, a steering committee, reply-all emails, a reorg wrecking ball and a forced OS update. Same physics and hazards underneath; only words and pictures change.

Design spec: [docs/GAME-DESIGN.md](docs/GAME-DESIGN.md). Owner decisions: [docs/DECISIONS.md](docs/DECISIONS.md). Product, architecture and visual design: [docs/PRD.md](docs/PRD.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DESIGN.md](docs/DESIGN.md).

No framework, no bundler. One HTML page, a few ES modules, pixel-art sprites from Kenney's CC0 packs plus a few hand-pixeled ones, and a CC0 chiptune. Everything is free to use; sources are listed in [assets/LICENSES.md](assets/LICENSES.md).

## Play

Live: **https://almost-there-delta.vercel.app** (works on phones: landscape shows the full course, portrait zooms in on a narrower view; tap anywhere to jump, tap again mid-air to double jump; add it to the home screen for a full-screen app). With *reduce motion* switched on in the OS, the game skips screen shake and dims the lights instead of blacking out.

Source: https://github.com/Maxbase91/almost-there. Pushes to `main` auto-deploy to Vercel (project `almost-there`); `vercel.json` sets security headers, no-cache for the page and scripts, and a day of caching for assets.

## Run locally

```bash
npm run dev
```

Opens a static server on http://localhost:5300 (ES modules need a server; `file://` will not work). Any static host works for deployment: the folder is deployable as-is.

## Test

```bash
npm test
```

GitHub Actions runs the same suite on every push to `main` and on pull requests (`.github/workflows/ci.yml`).

Vitest covers the pure logic: course generation (limits, ordering, 500 seeds all beatable by the flawless player, a human-like player reaching the table 2–20 % of the time), double jump, holes, wall and combo, every hazard type in isolation, the frozen DEAD state, the ending pool and no-repeat picker, and journal persistence. Rendering is verified with headless Chrome screenshots (`?autoplay=1&advance=S`).

## How it works

- `src/game.js` is a pure state machine: `createState`, `startRun`, `step(state, input, dt)`, plus `generateCourse(rng)` for the seeded per-run course. Phases: `TITLE → RUNNING → (DEAD | ENDING) → LOST`. Hitting a hazard is an *honest* loss: the game freezes on a fail card until the player retries. Reaching the table always triggers an ending.
- `src/autopilot.js` is the competent player used by the tests and `?autopilot=1`.
- `src/endings.js` holds the 22 endings and `pickEnding(rng, seenIds, lastId)`, which never repeats an ending until all have been seen.
- `src/themes.js` holds the two modes (cake, office) as skins: sprite slots, speech-bubble words, hazard labels, death-screen copy and DOM text. Hazard ids and physics are shared, so tests and the autopilot cover both.
- `src/journal.js` stores seen endings, attempts and the (rigged) personal best in `localStorage` under `almost-there:v2` (plus the run log: deaths per hazard, wins, best distance); the office mode keeps its own run log under `almost-there:office:v1`, the last picked mode lives under `almost-there:mode` and the mute toggle under `almost-there:mute`.
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

- `?seed=N` reproduces a course; `?course=dog@1500,pig@2600` builds one explicitly (type@x in px). Types: `fence wall puddle dog skate pigeon pig pit pitwide bee meteor crack peel wind beam cow chick slime snake mole bro pendulum trampoline egg knife blackout ice` (unknown types are ignored).
- `?mode=office` starts in the project-delivery mode (`?mode=cake` for the cake); without it the last mode picked on the title screen is used.
- `?endings=1` brings back the 22 joke endings at the table (cake mode only); `?ending=<id>` forces one of them.
- `?autopilot=1` makes a flawless synthetic player play the course.
- `?autoplay=1` starts without a click and `?advance=S` steps the simulation S seconds at boot, capped at 600 (used for headless screenshots).
- `?debug` exposes `window.__almost` with `state`, `journal`, `restart()`, `setAutopilot(bool)` and `advance(seconds)` for deterministic stepping.

Ending ids: `banana pigeon bennyhill areyousure gravityflip wrongday connection sneeze disqualified sprinklers cat level404 repoman terms shoelace earthquake physicsquit dream fakewin nah displayonly wrongtable`.
