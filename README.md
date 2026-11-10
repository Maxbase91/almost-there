# Almost There

A tiny, brutal 2D browser game. Carry a birthday cake 100 metres to the party table through a dozen or more hazards that are different every run. Reaching the table is a real win and happens about once in twenty good runs. The run log remembers what got you.

Ten levels, all open from the start, in two families:

- **Cake runs:** Deliver the cake (meadow, desert, snow, night), Save the wedding (beach to sunset), Pumpkin pie run (graveyard to storm castle), Pizza before midnight (high street to neon district), Last present (village to aurora night).
- **Office runs:** Ship the project, Close the quarter, Migrate to the cloud, Survive the offsite, Run the tender. Corporate parodies: an amok scrum master, a CFO who wants the forecast, moving goalposts, a glass ceiling, a delegated task that comes back, a notification storm.

Every level has its own four backdrops, cast, death lines, ambient effects and mix of hazards. Underneath they share one simulation with 32 hazard types: things to jump (fences, holes, a charging dog, a pig from behind), things to run under (bees, beams, hopping slimes), things that need the double jump (walls, cows, a beanstalk that shoots up), one that punishes it (a high bar over a fence), things from above (crates, eggs, knives), and stretches where you see nothing (blackouts, fog).

Design spec: [docs/GAME-DESIGN.md](docs/GAME-DESIGN.md). Owner decisions: [docs/DECISIONS.md](docs/DECISIONS.md). Writing a level: [docs/LEVELS.md](docs/LEVELS.md). Product, architecture and visual design: [docs/PRD.md](docs/PRD.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DESIGN.md](docs/DESIGN.md).

No framework, no bundler. One HTML page, a few ES modules, pixel-art sprites from Kenney's CC0 packs plus a few hand-pixeled ones, and a CC0 chiptune. Everything is free to use; sources are listed in [assets/LICENSES.md](assets/LICENSES.md).

## Play

Live: **https://almost-there-delta.vercel.app** (works on phones: landscape shows the full course, portrait zooms in on a narrower view; tap anywhere to jump, tap again mid-air to double jump; add it to the home screen for a full-screen app). With *reduce motion* switched on in the OS, the game skips screen shake, flashes and lightning, and dims the lights instead of blacking out.

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

`scripts/verify.sh` — runs the CI checks locally; runs automatically on `git push`.

GitHub Actions runs the same suite on every push to `main` and on pull requests (`.github/workflows/ci.yml`).

Vitest covers the pure logic: course generation (limits, ordering, profiles, 500 seeds all beatable by the flawless player, a human-like player reaching the table 2–20 % of the time), double jump, holes, wall and combo, every hazard type in isolation, the frozen DEAD state, the ending pool and no-repeat picker, and journal persistence. `tests/levels.test.js` checks every level file against the schema (labels, death titles, sprite grids, scene vocabulary, profile range) and runs the flawless player over 150 seeded courses per level. Rendering is verified with screenshots (`?autoplay=1&advance=S`, or `?debug` and `__almost.advance(s)`). The whole suite takes about a minute.

## How it works

- `src/game.js` is a pure state machine: `createState`, `startRun`, `step(state, input, dt)`, plus `generateCourse(rng, profile)` for the seeded per-run course. Phases: `TITLE → RUNNING → DEAD | WIN` (with `?endings=1`: `RUNNING → ENDING → LOST`). Hitting a hazard is an *honest* loss: the game freezes on a fail card until the player retries. Reaching the table is a win.
- `src/autopilot.js` is the competent player used by the tests and `?autopilot=1`.
- `src/endings.js` holds the 22 endings and `pickEnding(rng, seenIds, lastId)`, which never repeats an ending until all have been seen.
- `src/themes.js` holds the level registry. A level is a skin plus a course profile: sprite slots, speech-bubble words, hazard labels, death-screen copy, DOM text, four backdrops and pool weights. The cake and office levels are the family bases; the other eight are plain-data files in `src/levels/` that inherit from their family. Hazard ids and physics are shared, so tests and the autopilot cover every level.
- `src/scenery.js` draws a level's scene from that data: sky, parallax silhouettes, indoor walls, ground and ambient effects.
- `src/journal.js` stores seen endings, attempts and the (rigged) personal best in `localStorage` under `almost-there:v2` (plus the run log: deaths per hazard, wins, best distance); every other level keeps its own run log under `almost-there:<level>:v1`, the last picked level lives under `almost-there:mode` and the mute toggle under `almost-there:mute`.
- `src/sprites.js` maps sprite names to sheet tiles and draws them crisp at 3×; `src/pixelart.js` holds hand-pixeled sprites as string grids (level files add their own).
- `src/render.js` draws hazards, hero, carried item and goal over the scenery, plus overlays and HUD; `src/main.js` wires input, loading, the loop and the DOM panels; `src/audio.js` plays the CC0 music loop and effects.

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

- `?seed=N` reproduces a course; `?course=dog@1500,pig@2600` builds one explicitly (type@x in px). Types: `fence wall puddle dog skate pigeon pig pit pitwide bee meteor crack peel wind beam cow chick slime snake mole bro pendulum trampoline egg knife blackout ice creep grower canopy boomerang popup` (unknown types are ignored).
- `?level=<id>` starts in a level: `cake wedding pumpkin pizza xmas office quarter cloud offsite tender` (`?mode=office` still works); without it the last level picked on the title screen is used.
- `?endings=1` brings back the 22 joke endings at the table (cake mode only); `?ending=<id>` forces one of them.
- `?autopilot=1` makes a flawless synthetic player play the course.
- `?autoplay=1` starts without a click and `?advance=S` steps the simulation S seconds at boot, capped at 600 (used for headless screenshots).
- `?debug` exposes `window.__almost` with `state`, `journal`, `restart()`, `setAutopilot(bool)` and `advance(seconds)` for deterministic stepping.

Ending ids: `banana pigeon bennyhill areyousure gravityflip wrongday connection sneeze disqualified sprinklers cat level404 repoman terms shoelace earthquake physicsquit dream fakewin nah displayonly wrongtable`.
