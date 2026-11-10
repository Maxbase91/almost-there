# Levels

A level is a skin plus a course profile over the shared simulation (D20, D22). It never changes physics or hazard
type ids, so the autopilot and the fairness tests cover it automatically. Two families exist: `cake` (deliver
something, outdoors) and `office` (ship something, corporate parody). The family bases live in `src/themes.js`;
every other level is one plain-data file `src/levels/<id>.js` with a default export and no imports.
Whatever a level does not override comes from its family base.

Reference level: [`src/levels/quarter.js`](../src/levels/quarter.js). Schema test: `tests/levels.test.js`
(`npx vitest run tests/levels.test.js -t "<id>"`).

## File shape

```js
export default {
  id: 'quarter',                          // = file name
  family: 'office',                       // 'cake' | 'office'
  name: 'CLOSE THE QUARTER',              // title-screen button, upper case, ≤ 22 chars
  journalKey: 'almost-there:quarter:v1',  // always almost-there:<id>:v1
  art: { cake: 'quarterReport', pig: 'quarterCfo', … },   // sprite slot → sprite name
  say: { OINK: 'FORECAST!', 'CAKE!': 'SIGNED OFF!', … },  // speech bubbles
  hazards: { pig: { label: 'CFO', line: 'The CFO wanted the forecast. Yesterday.' }, … },
  deathTitles: { pig: 'The CFO got you.', crack: '…', crackBro: '…', … },
  text: { win: 'QUARTER CLOSED!', … },    // canvas banners
  dom: { loading: '…', pitch: '…', winTitle: '…', closeJournal: '…' },
  winLines: ['…', '…', '…', '…'],
  scene: { stretches: [ {…}, {…}, {…}, {…} ] },           // four 25 m backdrops
  course: { weights: {…}, limits: {…}, stretches: [ {…} ×4 ] },
  sprites: { quarterReport: ['……', …], … },               // hand-pixeled art owned by the level
};
```

## Hazards, labels and death copy

Hazard type ids (keys of `hazards` and `deathTitles`):

`fence wall puddle dog skate pigeon pig pit pitwide bee meteor crack peel wind beam cow chick slime snake mole bro
pendulum trampoline egg knife blackout ice creep grower canopy boomerang popup`

What each one does is in [GAME-DESIGN.md](GAME-DESIGN.md) §3; the office base in `src/themes.js` shows one full
reskin. Relabel at least 14 types. `label` is lower case and fits "You hit the {label}." `line` is one dry sentence
that names the mistake (≤ 70 chars); `wind`, `blackout` and `popup` are not lethal and take `line: ''`.

Every lethal type you relabel needs its own `deathTitles[type]` (a full sentence). `crack` takes `deathTitles.crack`;
if you relabel `bro`, also give `deathTitles.crackBro` (the dip the bro opens).

`say` translates the bubbles the simulation emits. Keys: `MOO` (cow), `BAWK` (first chicken), `sss` (snake),
`BUY THE DIP` and `HODL` (bro), `OINK` (pig), `CAKE!` (recipient at the goal), `WHOOSH` (boomerang returning).
Values ≤ 20 chars. `OINK` and `CAKE!` are required.

## Text

`text` keys (all optional, inherited from the family): `beam` (on the low beam, ≤ 16 chars), `canopy` (on the high
bar, ≤ 16), `pigMarker` and `boomMarker` (edge warnings, start with `< `, ≤ 14), `dark` (blackout caption, ≤ 28),
`dim` (its reduced-motion version), `fog` (popup caption, ≤ 16), `headwind` (starts `<< `), `tailwind` (ends ` >>`),
`sliding`, `win` (≤ 22), `winSub` (≤ 30), `popups` (office family: 5–7 pairs `[TITLE ≤ 12, line ≤ 18]` for the
notification storm).

`dom`: `loading` ("LOADING …"), `pitch` (one sentence on the title screen), `winTitle`, `closeJournal` (button).
`winLines`: four one-liners for the win card.

Style: short sentences, dry, concrete. No real company, product or person names. No emoji.

## Art

Sprites are string grids, one character per pixel, drawn at 3×. Every row of a sprite has the same length and uses
only palette characters from `src/pixelart.js` (`PALETTE`): `.` transparent, `K` outline, `W w` whites, `S s D e E`
greys to black, `R r X` reds, `P p M F f` pinks, `O o Y y k` oranges/yellows/gold, `B b d Z` browns, `H h` sand and
cream, `T` skin, `G g` greens, `C c` teals, `L l I` light blues, `J N a A` blues, `V U u` purples.

Sprite names start with the level id (`quarterCfo`), so levels never collide. A level owns at least 8 sprites and
must replace `cake`, `cakeSplat`, `table`, `kid` and `pig`.

Slots and the grid size to draw (same size as the sprite it replaces, so what you see is what hits you):

| Slot | Is | Size (w×h) | Notes |
| --- | --- | --- | --- |
| `cake` / `cakeDisplay` | carried item | 16×16 | `cakeDisplay` may reuse `cake` |
| `cakeSplat` | dropped item | 16×8 | |
| `table` | goal | 32×16 | |
| `kid` | recipient at the goal | 16×16 | faces left |
| `balloon` | decoration at the goal | 8×16 | |
| `hero` | runner | — | one of `hero heroBlue heroPink heroYellow` |
| `fence` | 58 px obstacle | 18×18 | |
| `wall` / `wallTop` | stacked ×3 plus a top | 18×18 / 18×8–18 | |
| `rainCloud` | marks the puddle | 16×8 | |
| `dog` | charges | 16×16 | faces left |
| `skate` | rolls at you | 28×6 to 16×8 | |
| `pigeon` | dives | 12×10 | faces left |
| `bee` | hovers at jump height | 12×12 | |
| `meteor` | falls, then blocks | 18×18 | |
| `peel` | slip trap | 12×8 | |
| `cow` | wide, slow | 44×19 | drawn at hitbox size |
| `chick` | three in a line | 12×12 | |
| `slime` | hops up as you arrive | 14×12 | |
| `snake` | long and low | 16×8 | |
| `mound` / `mole` | pop-up | 16×6 / 16×14 | |
| `bro` / `broProp` | stands by a dip | 16×24 / 6×8 | |
| `pendulum` | swinging ball | 24×24 | centred |
| `trampoline` | launcher | 12×8 | |
| `egg` / `knife` | fall from above | 8×10 / 6×16 | |
| `pig` | chaser from behind | 18×16 | faces left |
| `boomerang` | flies over, returns | 14×8 | |
| `creepPost` | posts at the moving hole | 6×22 | optional |

Values may also name any existing sprite (`PIXEL_NAMES` in `src/pixelart.js`, `SPRITES` in `src/sprites.js`).

Other look options: `beamColors: [fill, mark]`, `growerStyle: 'stalk' | 'stack'` with `growerColors: [fill, shade,
accent]`, `canopyStyle: 'bunting' | 'glass'`, `popupStyle: 'fog' | 'windows'`.

## Scene

Four stretches, 25 m each, in course order. Each has `name` (banner, upper case, ≤ 20 chars), `kind`, `decor`
(sprite names placed on the ground every 2.6 m; soft, round-ish props only: boxy decor reads as an obstacle) and
`ambient`. Colours are `#rrggbb`.

**Outdoor** (`kind: 'outdoor'`):

- `sky`: two colours (top, horizon) or six bands, top to bottom.
- `orb`: `sun bigsun sunset moon bigmoon none`. `stars: true` for a night sky.
- `far` and `mid`: parallax silhouette layers `{ shape, color, color2?, alpha? }`. `color2` is the detail colour
  (lit windows, snow caps, wave crests, neon). Shapes: `hills dunes mountains skyline neon forest palms sea icebergs
  graves deadtrees castle cloudsea houses pier rooftops ropes none`.
- `clouds`: `true` for drifting clouds.
- `ground`: Kenney tiles `{ tiles: 'grass' | 'sand' | 'snow', tint?: 'rgba(r,g,b,a)' }` or flat
  `{ top, mark, fill }`. Optional `pit: { fill, edge, deep }` for hole colours.

**Indoor** (`kind: 'indoor'`): `wall`, `trim`, `floor`, `floorMark`, `fill` plus a wall `feature`:
`window` (`win`, `city`, `lit`), `racks`, `whiteboard`, `charts`, `shelves` (`spines: [colours]`), `screens`
(`alert: true` for red), `stage`, `bar`, `portraits`, `crates`, `reception`, `cave`, `plan`. `accent` tints the
feature where it has one.

**Ambient**: `none snow rain storm leaves petals embers fireflies bats spray fog paper sparks dust aurora notes`.
`storm` is rain with lightning (skipped under reduced motion).

## Course profile

`course.weights`: multiplier (0–2.5) on a pool type's chance. Pool types: `fence puddle dog skate pigeon pig pit
pitwide wall combo bee meteor crack peel wind beam cow chickens slime snake mole bro pendulum trampoline eggrain
knives blackout ice creep grower canopy boomerang popup`. Pick 6–10 that fit the level and leave the rest at 1.

`course.limits`: most of a type per course, at most one above the default in `POOL_LIMITS` (`src/game.js`).

`course.stretches`: four `{ ice: boolean, dark: 0 | 1 | 2 }`. `ice` allows slide stretches there; `dark` 0 means no
blackout, 1 normal, 2 twice as likely and longer. Default: `[{}, {dark: 1}, {ice: true, dark: 1}, {dark: 2}]`.

Every level must stay beatable: `tests/levels.test.js` runs the flawless synthetic player over seeded courses for
each profile. If it fails, lower the weight of the type it died on.
