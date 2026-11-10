import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { HAZARD_TYPES, POOL_TYPES, POOL_LIMITS, PHASE, createState, startRun, step, mulberry32, generateCourse } from '../src/game.js';
import { perfectInput, createHumanInput } from '../src/autopilot.js';
import { PALETTE, PIXEL_NAMES, buildPixelSprites } from '../src/pixelart.js';
import { SPRITES } from '../src/sprites.js';
import { SHAPES, FEATURES, AMBIENTS, ORBS, GROUND_TILES } from '../src/scenery.js';
import { LEVELS, THEMES, MODES, LEVEL_SPRITES, levelsOf, getTheme, isLevel, hazardText, deathText, journalLabel } from '../src/themes.js';

const LEVEL_DIR = fileURLToPath(new URL('../src/levels/', import.meta.url));
const files = readdirSync(LEVEL_DIR).filter((f) => f.endsWith('.js')).sort();
const modules = await Promise.all(files.map(async (f) => [f.replace(/\.js$/, ''), (await import(pathToFileURL(path.join(LEVEL_DIR, f)).href)).default]));

const HEX = /^#[0-9a-fA-F]{6}$/;
const RGBA = /^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(0|1|0?\.\d+)\s*\)$/;
const ART_SLOTS = ['cake', 'cakeSplat', 'cakeDisplay', 'table', 'kid', 'balloon', 'hero', 'fence', 'wall', 'wallTop', 'rainCloud', 'dog', 'skate', 'pigeon', 'bee', 'meteor', 'peel', 'cow', 'chick', 'slime', 'snake', 'mound', 'mole', 'bro', 'broProp', 'pendulum', 'trampoline', 'egg', 'knife', 'pig', 'boomerang', 'creepPost'];
const HEROES = ['hero', 'heroBlue', 'heroPink', 'heroYellow'];
const SAY_WORDS = ['MOO', 'BAWK', 'sss', 'BUY THE DIP', 'HODL', 'OINK', 'CAKE!', 'WHOOSH'];
const NOT_LETHAL = ['wind', 'blackout', 'popup'];
const TEXT_MAX = { beam: 16, canopy: 16, pigMarker: 14, boomMarker: 14, dark: 28, dim: 28, fog: 16, headwind: 22, tailwind: 22, sliding: 12, win: 22, winSub: 30 };
const BASE_SPRITES = new Set([...PIXEL_NAMES, ...Object.keys(SPRITES)]);

describe('level files (docs/LEVELS.md)', () => {
  it('has the eight level files', () => {
    expect(modules.map(([id]) => id)).toEqual(['cloud', 'offsite', 'pizza', 'pumpkin', 'quarter', 'tender', 'wedding', 'xmas']);
  });

  for (const [id, lv] of modules) {
    describe(`level ${id}`, () => {
      const own = new Set(Object.keys(lv.sprites ?? {}));
      const known = (name) => BASE_SPRITES.has(name) || own.has(name);

      it(`${id}: is real content with the right identity`, () => {
        expect(lv.stub, 'still a placeholder').toBeUndefined();
        expect(lv.id).toBe(id);
        expect(MODES).toContain(lv.family);
        expect(lv.name).toBe(lv.name.toUpperCase());
        expect(lv.name.length).toBeLessThanOrEqual(22);
        expect(lv.journalKey).toBe(`almost-there:${id}:v1`);
      });

      it(`${id}: relabels at least 14 hazards and gives each lethal one its own death title`, () => {
        const types = Object.keys(lv.hazards ?? {});
        expect(types.length).toBeGreaterThanOrEqual(14);
        for (const t of types) {
          expect(Object.hasOwn(HAZARD_TYPES, t), `unknown hazard ${t}`).toBe(true);
          const h = lv.hazards[t];
          expect(typeof h.label, t).toBe('string');
          expect(h.label.length, t).toBeGreaterThan(1);
          expect(typeof h.line, t).toBe('string');
          expect(h.line.length, `${t} line too long`).toBeLessThanOrEqual(70);
          if (NOT_LETHAL.includes(t)) continue;
          expect(h.line.length, `${t} needs a line`).toBeGreaterThan(0);
          expect(lv.deathTitles?.[t], `deathTitles.${t}`).toBeTruthy();
        }
        if (lv.hazards?.bro) expect(lv.deathTitles?.crackBro, 'deathTitles.crackBro').toBeTruthy();
        for (const t of Object.keys(lv.deathTitles ?? {})) expect(t === 'crackBro' || Object.hasOwn(HAZARD_TYPES, t), `deathTitles.${t}`).toBe(true);
      });

      it(`${id}: draws its sprites as rectangular grids in palette colours, named after the level`, () => {
        expect(own.size).toBeGreaterThanOrEqual(8);
        for (const [name, rows] of Object.entries(lv.sprites)) {
          expect(name.startsWith(id), `${name} must start with ${id}`).toBe(true);
          expect(BASE_SPRITES.has(name), `${name} shadows a base sprite`).toBe(false);
          expect(rows.length, name).toBeGreaterThanOrEqual(4);
          for (const r of rows) {
            expect(r.length, `${name}: ragged row "${r}"`).toBe(rows[0].length);
            for (const ch of r) expect(ch in PALETTE, `${name}: unknown colour '${ch}'`).toBe(true);
          }
        }
        expect(() => buildPixelSprites(lv.sprites)).not.toThrow();
      });

      it(`${id}: points sprite slots only at sprites that exist and replaces the signature five`, () => {
        for (const [slot, name] of Object.entries(lv.art ?? {})) {
          expect(ART_SLOTS, `art.${slot}`).toContain(slot);
          expect(known(name), `art.${slot} → ${name}`).toBe(true);
        }
        for (const slot of ['cake', 'cakeSplat', 'table', 'kid', 'pig']) expect(own.has(lv.art?.[slot]), `art.${slot} must be the level's own sprite`).toBe(true);
        if (lv.art?.hero) expect(HEROES).toContain(lv.art.hero);
        // every own sprite is used somewhere: a slot or a decor list
        const used = new Set([...Object.values(lv.art ?? {}), ...lv.scene.stretches.flatMap((s) => s.decor ?? [])]);
        for (const name of own) expect(used.has(name), `${name} is never used`).toBe(true);
      });

      it(`${id}: words fit their boxes`, () => {
        for (const [k, v] of Object.entries(lv.say ?? {})) {
          expect(SAY_WORDS, `say.${k}`).toContain(k);
          expect(v.length, `say.${k}`).toBeLessThanOrEqual(20);
        }
        expect(lv.say?.OINK).toBeTruthy();
        expect(lv.say?.['CAKE!']).toBeTruthy();
        const baseText = THEMES[lv.family].text;
        for (const [k, v] of Object.entries(lv.text ?? {})) {
          expect(Object.hasOwn(baseText, k), `text.${k}`).toBe(true);
          if (TEXT_MAX[k]) expect(v.length, `text.${k} "${v}"`).toBeLessThanOrEqual(TEXT_MAX[k]);
        }
        expect(lv.text?.win).toBeTruthy();
        expect(lv.text?.winSub).toBeTruthy();
        if (lv.text?.pigMarker) expect(lv.text.pigMarker.startsWith('< ')).toBe(true);
        if (lv.text?.boomMarker) expect(lv.text.boomMarker.startsWith('< ')).toBe(true);
        if (lv.family === 'office') {
          expect(lv.text.popups.length).toBeGreaterThanOrEqual(5);
          expect(lv.text.popups.length).toBeLessThanOrEqual(7);
          for (const [title, line] of lv.text.popups) {
            expect(title.length, title).toBeLessThanOrEqual(12);
            expect(line.length, line).toBeLessThanOrEqual(18);
          }
        }
        for (const k of ['loading', 'pitch', 'winTitle', 'closeJournal']) expect(lv.dom?.[k], `dom.${k}`).toBeTruthy();
        expect(lv.winLines).toHaveLength(4);
      });

      it(`${id}: has four valid stretches`, () => {
        expect(lv.scene.stretches).toHaveLength(4);
        for (const s of lv.scene.stretches) {
          expect(s.name).toBe(s.name.toUpperCase());
          expect(s.name.length).toBeLessThanOrEqual(20);
          expect(AMBIENTS, `${s.name} ambient`).toContain(s.ambient);
          for (const d of s.decor ?? []) expect(known(d), `${s.name} decor ${d}`).toBe(true);
          if (s.kind === 'indoor') {
            for (const k of ['wall', 'trim', 'floor', 'floorMark', 'fill']) expect(s[k], `${s.name}.${k}`).toMatch(HEX);
            expect(FEATURES, `${s.name} feature`).toContain(s.feature);
            for (const k of ['win', 'city', 'accent']) if (s[k] != null) expect(s[k], `${s.name}.${k}`).toMatch(HEX);
            for (const c of s.spines ?? []) expect(c).toMatch(HEX);
          } else {
            expect(s.kind).toBe('outdoor');
            expect([2, 6]).toContain(s.sky.length);
            for (const c of s.sky) expect(c).toMatch(HEX);
            expect(ORBS, `${s.name} orb`).toContain(s.orb);
            for (const layer of [s.far, s.mid]) {
              expect(SHAPES, `${s.name} shape`).toContain(layer.shape);
              expect(layer.shape).not.toBe('tiles'); // the Kenney parallax tiles belong to the birthday-cake level
              if (layer.shape !== 'none') expect(layer.color, `${s.name} ${layer.shape} colour`).toMatch(HEX);
              if (layer.color2 != null) expect(layer.color2).toMatch(HEX);
            }
            if (s.ground.tiles) {
              expect(GROUND_TILES).toContain(s.ground.tiles);
              if (s.ground.tint != null) expect(s.ground.tint).toMatch(RGBA);
            } else for (const k of ['top', 'mark', 'fill']) expect(s.ground[k], `${s.name} ground.${k}`).toMatch(HEX);
            for (const c of Object.values(s.pit ?? {})) expect(c).toMatch(HEX);
          }
        }
      });

      it(`${id}: keeps its course profile inside the allowed range`, () => {
        const c = lv.course ?? {};
        for (const [t, w] of Object.entries(c.weights ?? {})) {
          expect(POOL_TYPES, `weights.${t}`).toContain(t);
          expect(w).toBeGreaterThanOrEqual(0);
          expect(w).toBeLessThanOrEqual(2.5);
        }
        expect(Object.keys(c.weights ?? {}).length).toBeGreaterThanOrEqual(6);
        for (const [t, n] of Object.entries(c.limits ?? {})) {
          expect(POOL_TYPES, `limits.${t}`).toContain(t);
          expect(n).toBeLessThanOrEqual((POOL_LIMITS[t] ?? 99) + 1);
          expect(n).toBeGreaterThanOrEqual(0);
        }
        expect(c.stretches ?? [0, 0, 0, 0]).toHaveLength(4);
        for (const s of c.stretches ?? []) {
          if (s.ice != null) expect(typeof s.ice).toBe('boolean');
          if (s.dark != null) expect([0, 1, 2]).toContain(s.dark);
        }
      });
    });
  }
});

describe('level registry (D22)', () => {
  it('has ten levels, five per family, each family led by its base', () => {
    expect(LEVELS).toHaveLength(10);
    expect(levelsOf('cake').map((l) => l.id)).toEqual(['cake', 'wedding', 'pumpkin', 'pizza', 'xmas']);
    expect(levelsOf('office').map((l) => l.id)).toEqual(['office', 'quarter', 'cloud', 'offsite', 'tender']);
    expect(isLevel('quarter')).toBe(true);
    expect(isLevel('__proto__')).toBe(false);
    expect(isLevel('constructor')).toBe(false);
    expect(getTheme('nope').id).toBe('cake');
  });

  it('gives every level its own run log key and title', () => {
    expect(new Set(LEVELS.map((l) => l.journalKey)).size).toBe(LEVELS.length);
    expect(new Set(LEVELS.map((l) => l.name)).size).toBe(LEVELS.length);
    expect(THEMES.cake.journalKey).toBe('almost-there:v2');
    expect(THEMES.office.journalKey).toBe('almost-there:office:v1');
  });

  it('labels every hazard in every level and never shows a stale family title for a relabelled one', () => {
    for (const lv of LEVELS) {
      for (const type of Object.keys(HAZARD_TYPES)) {
        const { label } = hazardText(lv, type);
        expect(label, `${lv.id} ${type}`).toBeTruthy();
        expect(journalLabel(lv, type), `${lv.id} ${type}`).toBeTruthy();
        const title = deathText(lv, { type }).title;
        expect(title, `${lv.id} ${type}`).toBeTruthy();
      }
    }
    expect(deathText(THEMES.quarter, { type: 'pig' }).title).toBe('The CFO got you.');
    expect(deathText(THEMES.quarter, { type: 'crack' }).title).toBe('The books opened under you.');
    expect(deathText(THEMES.quarter, { type: 'crack', bro: true }).title).toBe('You fell in the forecast gap.');
    // not relabelled in the quarter level: inherited from the office family
    expect(deathText(THEMES.quarter, { type: 'pendulum' }).title).toBe('The reorg got you.');
    expect(journalLabel(THEMES.quarter, 'pig')).toBe('CFO');
  });

  it('merges level sprites into the atlas without collisions and resolves every slot and decor name', () => {
    const all = buildPixelSprites(LEVEL_SPRITES);
    const known = new Set([...Object.keys(all), ...Object.keys(SPRITES)]);
    for (const lv of LEVELS) {
      for (const [slot, name] of Object.entries(lv.art)) expect(known.has(name), `${lv.id} art.${slot} → ${name}`).toBe(true);
      expect(lv.scene.stretches).toHaveLength(4);
      for (const s of lv.scene.stretches) for (const d of s.decor ?? []) expect(known.has(d), `${lv.id} decor ${d}`).toBe(true);
    }
    const names = LEVELS.flatMap((l) => Object.keys(l.sprites ?? {}));
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('every level stays fair (D16, D22)', () => {
  const DT = 1 / 120;
  const run = (lv, seed, policy) => {
    const s = startRun(createState({ rng: mulberry32(seed), profile: lv.profile }), { seed });
    for (let t = 0; s.phase === PHASE.RUNNING && t < 60; t += DT) step(s, policy(s), DT);
    return s;
  };

  for (const lv of LEVELS) {
    it(`${lv.id}: the flawless player wins 150 seeded courses`, { timeout: 30000 }, () => {
      for (let seed = 1000; seed < 1150; seed++) {
        const s = run(lv, seed, perfectInput);
        expect(s.phase, `seed ${seed} died on ${s.deadBy?.type} at ${Math.round(s.player.x)}`).toBe(PHASE.WIN);
      }
    });

    it(`${lv.id}: the human-ish player reaches the goal rarely, but does (2–25 %)`, { timeout: 30000 }, () => {
      const N = 300;
      let reached = 0;
      for (let seed = 0; seed < N; seed++) if (run(lv, seed, createHumanInput(mulberry32(seed * 7919 + 13))).phase === PHASE.WIN) reached++;
      expect(reached / N).toBeGreaterThanOrEqual(0.02);
      expect(reached / N).toBeLessThanOrEqual(0.25);
    });

    it(`${lv.id}: every course has a chaser from behind and enough to do`, () => {
      for (let seed = 0; seed < 60; seed++) {
        const hz = generateCourse(mulberry32(seed), lv.profile);
        expect(hz.some((h) => h.type === 'pig')).toBe(true);
        expect(hz.filter((h) => !h.combo).length).toBeGreaterThanOrEqual(2);
        for (let i = 1; i < hz.length; i++) expect(hz[i].anchorX).toBeGreaterThan(hz[i - 1].anchorX);
      }
    });
  }
});
