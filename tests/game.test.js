import { describe, it, expect } from 'vitest';
import {
  createState,
  startRun,
  step,
  progress,
  fakeBest,
  launchCake,
  generateCourse,
  courseFromSpec,
  mulberry32,
  runSpeed,
  isPit,
  biomeAt,
  HAZARD_TYPES,
  COURSE,
  PHASE,
  TABLE_X,
  GROUND_Y,
  BASE_SPEED,
  MAX_JUMPS,
} from '../src/game.js';
import { perfectInput, createHumanInput } from '../src/autopilot.js';

const DT = 1 / 120;
const NO_INPUT = () => ({ jumpPressed: false, jumpHeld: false });

function runUntil(state, policy, pred, maxT = 40) {
  let t = 0;
  while (!pred(state) && t < maxT) {
    step(state, policy(state), DT);
    t += DT;
  }
  return state;
}

const leftRunning = (st) => st.phase !== PHASE.RUNNING;
const seeded = (seed) => startRun(createState({ rng: mulberry32(seed) }), { seed });
const withCourse = (spec, seed = 9, wind = false) => startRun(createState({ rng: mulberry32(seed) }), { course: courseFromSpec(spec), wind });

describe('course generation (D9, D10)', () => {
  it('is deterministic for a seed and different across seeds', () => {
    const key = (hz) => hz.map((h) => [h.type, h.anchorX, h.w]);
    expect(key(generateCourse(mulberry32(42)))).toEqual(key(generateCourse(mulberry32(42))));
    expect(key(generateCourse(mulberry32(42)))).not.toEqual(key(generateCourse(mulberry32(43))));
  });

  it('respects count, bounds, ordering and per-type limits for 500 seeds', () => {
    const counts = new Set();
    const typesSeen = new Set();
    for (let seed = 0; seed < 500; seed++) {
      const hz = generateCourse(mulberry32(seed));
      const slots = hz.filter((h) => !h.combo).length;
      counts.add(slots);
      expect(slots).toBeGreaterThanOrEqual(2); // a course may run out of room early; a combo may be swapped for the guaranteed pig
      expect(slots).toBeLessThanOrEqual(COURSE.maxHazards);
      const types = hz.map((h) => h.type);
      types.forEach((t) => typesSeen.add(t));
      expect(types.filter((t) => t === 'pig').length).toBeLessThanOrEqual(3);
      expect(types.filter((t) => t === 'pig').length).toBeGreaterThanOrEqual(1); // every course has a pig
      expect(types.filter((t) => t === 'pigeon').length).toBeLessThanOrEqual(1);
      expect(types.filter((t) => t === 'wall').length).toBeLessThanOrEqual(1);
      expect(types.filter((t) => t === 'pitwide').length).toBeLessThanOrEqual(1);
      expect(hz[0].anchorX).toBeGreaterThanOrEqual(COURSE.firstX);
      expect(hz[0].type).not.toBe('pig');
      for (let i = 1; i < hz.length; i++) expect(hz[i].anchorX).toBeGreaterThan(hz[i - 1].anchorX);
      const last = hz[hz.length - 1];
      expect(last.anchorX + last.w).toBeLessThan(TABLE_X - 200);
    }
    expect(Math.max(...counts)).toBeGreaterThanOrEqual(COURSE.maxHazards - 1);
    expect([...typesSeen].sort()).toEqual(Object.keys(HAZARD_TYPES).sort());
    void isPit;
  });
});

describe('run flow', () => {
  it('starts on the title screen; startRun enters RUNNING with a fresh course', () => {
    const s0 = createState({ rng: mulberry32(1), seed: 7 });
    expect(s0.phase).toBe(PHASE.TITLE);
    const s1 = startRun(s0);
    expect(s1.phase).toBe(PHASE.RUNNING);
    expect(s1.attempts).toBe(1);
    expect(s1.player.jumpsLeft).toBe(MAX_JUMPS);
  });

  it('speed ramps from base to 1.75× at the table (D18)', () => {
    expect(runSpeed(0)).toBe(BASE_SPEED);
    expect(runSpeed(TABLE_X)).toBeCloseTo(BASE_SPEED * 1.75, 5);
    expect(runSpeed(TABLE_X / 2)).toBeCloseTo(BASE_SPEED * 1.375, 5);
  });

  it('a player who never jumps dies on a hazard, for every seed', () => {
    for (let seed = 0; seed < 100; seed++) {
      const s = seeded(seed);
      runUntil(s, NO_INPUT, leftRunning);
      expect(s.phase).toBe(PHASE.DEAD);
      expect(s.deadBy).not.toBeNull();
    }
  });

  it('a perfect player reaches the table on every seed (the course is always beatable)', { timeout: 30000 }, () => {
    for (let seed = 0; seed < 500; seed++) {
      const s = seeded(seed);
      runUntil(s, perfectInput, leftRunning);
      expect(s.phase, `seed ${seed} died on ${s.deadBy?.type} at ${Math.round(s.player.x)}`).toBe(PHASE.WIN);
    }
  });

  it('a human-ish player rarely reaches the table (D16: 2–20 %; the proxy overestimates real players)', { timeout: 30000 }, () => {
    const N = 1000;
    let reached = 0;
    const deaths = {};
    for (let seed = 0; seed < N; seed++) {
      const s = seeded(seed);
      const human = createHumanInput(mulberry32(seed * 7919 + 13));
      runUntil(s, human, leftRunning);
      if (s.phase === PHASE.WIN) reached++;
      else deaths[s.deadBy.type] = (deaths[s.deadBy.type] ?? 0) + 1;
    }
    const rate = reached / N;
    // eslint-disable-next-line no-console
    console.log(`human-ish reach rate: ${(rate * 100).toFixed(1)} %  deaths:`, deaths);
    expect(rate).toBeGreaterThanOrEqual(0.02);
    expect(rate).toBeLessThanOrEqual(0.2);
  });

  it('DEAD never leaves on its own: ten seconds later it is still DEAD', () => {
    const s = seeded(3);
    runUntil(s, NO_INPUT, leftRunning);
    expect(s.phase).toBe(PHASE.DEAD);
    const deadBy = s.deadBy.type;
    for (let t = 0; t < 10; t += DT) step(s, { jumpPressed: true, jumpHeld: true }, DT);
    expect(s.phase).toBe(PHASE.DEAD);
    expect(s.deadBy.type).toBe(deadBy);
    expect(s.deadT).toBeGreaterThan(9.8);
  });

  it('progress never reports 100 % while running, and reports 100 % once the ending starts', () => {
    const s = seeded(5);
    let maxWhileRunning = 0;
    runUntil(s, perfectInput, (st) => {
      if (st.phase === PHASE.RUNNING) maxWhileRunning = Math.max(maxWhileRunning, progress(st));
      return st.phase !== PHASE.RUNNING;
    });
    expect(maxWhileRunning).toBeLessThanOrEqual(1);
    expect(progress(s)).toBe(1);
    expect(s.phase).toBe(PHASE.WIN);
  });
});

describe('double jump (D9)', () => {
  it('a second press in the air jumps again, and jumps reset on landing', () => {
    const s = withCourse([]);
    step(s, { jumpPressed: true, jumpHeld: false }, DT);
    expect(s.player.onGround).toBe(false);
    expect(s.player.jumpsLeft).toBe(1);
    for (let t = 0; t < 0.3; t += DT) step(s, { jumpPressed: false, jumpHeld: false }, DT);
    const yBefore = s.player.y;
    step(s, { jumpPressed: true, jumpHeld: false }, DT);
    expect(s.player.jumpsLeft).toBe(0);
    expect(s.player.vy).toBeLessThan(-400);
    expect(s.player.pose).toBe('flip');
    // a third press does nothing
    step(s, { jumpPressed: true, jumpHeld: false }, DT);
    expect(s.player.jumpsLeft).toBe(0);
    let peak = yBefore;
    runUntil(s, () => ({ jumpPressed: false, jumpHeld: false }), (st) => {
      peak = Math.min(peak, st.player.y);
      return st.player.onGround;
    }, 3);
    expect(peak).toBeLessThan(GROUND_Y - 160); // higher than any single jump
    expect(s.player.jumpsLeft).toBe(MAX_JUMPS);
  });

  it('wall and wide hole cannot be cleared with single jumps but can with the perfect player', () => {
    for (const type of ['wall', 'pitwide']) {
      const singleOnly = (st) => {
        const i = perfectInput(st);
        if (!st.player.onGround) return { jumpPressed: false, jumpHeld: i.jumpHeld };
        return i;
      };
      const dead = withCourse([{ type, x: 1500 }]);
      runUntil(dead, singleOnly, leftRunning);
      expect(dead.phase, `${type} with single jumps`).toBe(PHASE.DEAD);
      expect(dead.deadBy.type).toBe(type);
      const ok = withCourse([{ type, x: 1500 }]);
      runUntil(ok, perfectInput, leftRunning);
      expect(ok.phase, `${type} with double jump`).toBe(PHASE.WIN);
    }
  });

  it('a combo (fence then hole) forces a mid-air double jump', () => {
    const spec = [
      { type: 'fence', x: 1500, combo: true },
      { type: 'pit', x: 1500 + 22 + COURSE.comboGap, w: COURSE.comboPitW, combo: true },
    ];
    const singleOnly = (st) => {
      const i = perfectInput(st);
      if (!st.player.onGround) return { jumpPressed: false, jumpHeld: i.jumpHeld };
      return i;
    };
    const dead = withCourse(spec);
    runUntil(dead, singleOnly, leftRunning);
    expect(dead.phase).toBe(PHASE.DEAD);
    expect(isPit(dead.deadBy)).toBe(true);
    const ok = withCourse(spec);
    runUntil(ok, perfectInput, leftRunning);
    expect(ok.phase).toBe(PHASE.WIN);
  });
});

describe('each hazard type in isolation', () => {
  for (const type of Object.keys(HAZARD_TYPES).filter((t) => !['bee', 'peel', 'wind', 'beam', 'chick', 'slime', 'mole', 'bro', 'pendulum', 'trampoline', 'egg', 'knife', 'blackout', 'ice'].includes(t))) {
    it(`${type}: kills a non-jumper and is cleared by the perfect player`, () => {
      const x = type === 'pig' ? 2400 : 1500;
      const dead = withCourse([{ type, x }]);
      runUntil(dead, NO_INPUT, leftRunning);
      expect(dead.phase).toBe(PHASE.DEAD);
      expect(dead.deadBy.type).toBe(type);
      const ok = withCourse([{ type, x }]);
      runUntil(ok, perfectInput, leftRunning);
      expect(ok.phase, `${type}`).toBe(PHASE.WIN);
    });
  }

  it('bee: jumping under it kills, running under it is safe', () => {
    const jumper = withCourse([{ type: 'bee', x: 1500 }]);
    runUntil(jumper, (st) => ({ jumpPressed: st.player.onGround && st.player.x > 1380, jumpHeld: true }), leftRunning);
    expect(jumper.phase).toBe(PHASE.DEAD);
    expect(jumper.deadBy.type).toBe('bee');
    const runner = withCourse([{ type: 'bee', x: 1500 }]);
    runUntil(runner, NO_INPUT, leftRunning);
    expect(runner.phase).toBe(PHASE.WIN);
  });

  it('meteor: a shadow warns, the crate lands and then blocks the way', () => {
    const s = withCourse([{ type: 'meteor', x: 1500 }]);
    const m = s.hazards[0];
    runUntil(s, NO_INPUT, (st) => m.state !== 'idle');
    expect(m.state).toBe('falling');
    expect(s.player.x).toBeLessThan(1500 - 500);
    runUntil(s, NO_INPUT, (st) => m.state === 'landed' || st.phase !== PHASE.RUNNING);
    expect(m.state).toBe('landed');
    expect(s.phase).toBe(PHASE.RUNNING); // the shadow was far enough ahead not to crush a runner
    runUntil(s, NO_INPUT, leftRunning);
    expect(s.deadBy.type).toBe('meteor');
  });

  it('crack: rumbles, then opens into a hole', () => {
    const s = withCourse([{ type: 'crack', x: 1500 }]);
    const c = s.hazards[0];
    runUntil(s, NO_INPUT, (st) => c.state === 'warn');
    expect(c.w).toBe(0);
    runUntil(s, NO_INPUT, (st) => c.state === 'open');
    expect(c.w).toBe(130);
    runUntil(s, NO_INPUT, leftRunning);
    expect(s.deadBy.type).toBe('crack');
  });

  it('banana peel: sliding disables jumping and carries you into the fence; jumping the peel avoids it', () => {
    const spec = [
      { type: 'peel', x: 1500 },
      { type: 'fence', x: 1500 + 300, combo: true, afterPeel: true },
    ];
    const s = withCourse(spec);
    runUntil(s, NO_INPUT, (st) => st.slide > 0 || st.phase !== PHASE.RUNNING);
    expect(s.slide).toBeGreaterThan(0);
    expect(s.player.jumpsLeft).toBe(0);
    runUntil(s, () => ({ jumpPressed: true, jumpHeld: true }), leftRunning, 2);
    expect(s.phase).toBe(PHASE.DEAD);
    expect(s.deadBy.type).toBe('fence');
    const ok = withCourse(spec);
    runUntil(ok, perfectInput, leftRunning);
    expect(ok.phase).toBe(PHASE.WIN);
  });

  it('wind: a gusty stretch changes speed while inside it and releases on the ground afterwards', () => {
    const s = withCourse([{ type: 'wind', x: 1000, w: 480, dir: -1 }], 9, true);
    runUntil(s, NO_INPUT, (st) => st.wind.mult !== 1, 10);
    expect(s.wind.mult).toBe(0.8);
    expect(s.events).toContain('wind');
    expect(s.player.x).toBeGreaterThanOrEqual(1000);
    runUntil(s, NO_INPUT, (st) => st.wind.mult === 1, 10);
    expect(s.player.x).toBeGreaterThanOrEqual(1480);
    expect(s.hazards[0].state).toBe('done');
  });

  it('beam: any hop under it kills, running under it is safe, and a fence right after it is still clearable', () => {
    const jumper = withCourse([{ type: 'beam', x: 1500, w: 400 }]);
    runUntil(jumper, (st) => ({ jumpPressed: st.player.onGround && st.player.x > 1600, jumpHeld: false }), leftRunning);
    expect(jumper.phase).toBe(PHASE.DEAD);
    expect(jumper.deadBy.type).toBe('beam');
    expect(jumper.player.x).toBeLessThan(1700);
    const runner = withCourse([{ type: 'beam', x: 1500, w: 400 }]);
    runUntil(runner, NO_INPUT, leftRunning);
    expect(runner.phase).toBe(PHASE.WIN);
    const tight = withCourse([{ type: 'beam', x: 1500, w: 400 }, { type: 'fence', x: 1900 + Math.round(0.5 * 300) }]);
    runUntil(tight, perfectInput, leftRunning);
    expect(tight.phase).toBe(PHASE.WIN);
  });

  it('no landing lag: a press right after landing jumps again (D18)', () => {
    const s = withCourse([]);
    step(s, { jumpPressed: true, jumpHeld: false }, DT);
    runUntil(s, NO_INPUT, (st) => st.player.onGround, 3);
    step(s, { jumpPressed: true, jumpHeld: false }, DT);
    expect(s.player.onGround).toBe(false);
  });

  it('v6: cow, chickens, snake, bro dip, knives and eggs kill a non-jumper and are cleared by the flawless player', () => {
    const specs = {
      cow: [{ type: 'cow', x: 1500 }],
      chickens: [0, 100, 200].map((d, i) => ({ type: 'chick', x: 1500 + d, group: 1500, combo: i > 0 })),
      snake: [{ type: 'snake', x: 1500 }],
      bro: [{ type: 'crack', x: 1500, w: 0, dipW: 110, bro: true }, { type: 'bro', x: 1620, combo: true }],
      knives: [0, 120, 240].map((d, i) => ({ type: 'knife', x: 1500 + d, combo: i > 0 })),
      eggs: [0, 135, 270, 405].map((d, i) => ({ type: 'egg', x: 1500 + d, combo: i > 0 })),
      mole: [{ type: 'mole', x: 1500 }],
    };
    for (const [name, spec] of Object.entries(specs)) {
      const dead = withCourse(spec);
      runUntil(dead, NO_INPUT, leftRunning);
      expect(dead.phase, `${name} vs non-jumper`).toBe(PHASE.DEAD);
      const ok = withCourse(spec);
      runUntil(ok, perfectInput, leftRunning);
      expect(ok.phase, `${name} vs flawless`).toBe(PHASE.WIN);
    }
  });

  it('v6: the slime kills a reflex jumper, a runner passes under it, the flawless player runs under', () => {
    const jumper = withCourse([{ type: 'slime', x: 1500 }]);
    runUntil(jumper, (st) => ({ jumpPressed: st.player.onGround && st.player.x > 1500 - 110, jumpHeld: true }), leftRunning);
    expect(jumper.phase).toBe(PHASE.DEAD);
    expect(jumper.deadBy.type).toBe('slime');
    const runner = withCourse([{ type: 'slime', x: 1500 }]);
    runUntil(runner, NO_INPUT, leftRunning);
    expect(runner.phase).toBe(PHASE.WIN);
    const ok = withCourse([{ type: 'slime', x: 1500 }]);
    runUntil(ok, perfectInput, leftRunning);
    expect(ok.phase).toBe(PHASE.WIN);
  });

  it('v6: the swinging spiked ball hits runners in its sweep; the flawless player clears the whole sweep', () => {
    for (const x of [1500, 1540, 1580, 1620, 1660]) {
      const runner = withCourse([{ type: 'pendulum', x }]);
      runUntil(runner, NO_INPUT, leftRunning);
      expect(runner.phase, `pendulum@${x} vs runner`).toBe(PHASE.DEAD);
      const ok = withCourse([{ type: 'pendulum', x }]);
      runUntil(ok, perfectInput, leftRunning);
      expect(ok.phase, `pendulum@${x} vs flawless`).toBe(PHASE.WIN);
    }
  });

  it('v6: a mole can be run over until it pops, then it is an obstacle', () => {
    const s = withCourse([{ type: 'mole', x: 1500 }]);
    runUntil(s, NO_INPUT, (st) => st.hazards[0].state === 'spray');
    expect(s.hazards[0].popped).toBe(false);
    runUntil(s, NO_INPUT, (st) => st.hazards[0].popped);
    expect(s.player.x).toBeLessThan(1500 - 100);
    runUntil(s, NO_INPUT, leftRunning);
    expect(s.deadBy.type).toBe('mole');
  });

  it('v6: the trampoline launches a runner high with no control; the beam after it is then fatal', () => {
    const s = withCourse([{ type: 'trampoline', x: 1500 }]);
    runUntil(s, NO_INPUT, (st) => st.events.includes('boing') || st.phase !== PHASE.RUNNING, 10);
    expect(s.events).toContain('boing');
    expect(s.player.vy).toBeLessThan(-800);
    expect(s.player.jumpsLeft).toBe(0);
    runUntil(s, () => ({ jumpPressed: true, jumpHeld: true }), (st) => st.player.onGround || st.phase !== PHASE.RUNNING, 5);
    expect(s.phase).toBe(PHASE.RUNNING);
    const trap = withCourse([{ type: 'trampoline', x: 1500 }, { type: 'beam', x: 1500 + 285, w: 300, combo: true }]);
    runUntil(trap, NO_INPUT, leftRunning);
    expect(trap.deadBy.type).toBe('beam');
    const ok = withCourse([{ type: 'trampoline', x: 1500 }, { type: 'beam', x: 1500 + 285, w: 300, combo: true }]);
    runUntil(ok, perfectInput, leftRunning);
    expect(ok.phase).toBe(PHASE.WIN);
  });

  it('v6: landing on ice slides with no jump control; a blackout changes nothing physical', () => {
    const s = withCourse([{ type: 'ice', x: 1400, w: 500 }]);
    runUntil(s, (st) => ({ jumpPressed: st.player.onGround && st.player.x > 1300 && st.player.x < 1320, jumpHeld: false }), (st) => st.slide > 0, 10);
    expect(s.slide).toBeGreaterThan(0);
    expect(s.player.x).toBeGreaterThan(1400);
    expect(s.iceSlide).toBe(true);
    const b = withCourse([{ type: 'blackout', x: 1400, w: 450 }]);
    runUntil(b, NO_INPUT, (st) => st.dark >= 1, 10);
    expect(b.dark).toBe(1);
    runUntil(b, NO_INPUT, leftRunning);
    expect(b.phase).toBe(PHASE.WIN);
  });

  it('v6: biomes change every 25 m', () => {
    expect(biomeAt(0)).toBe('meadow');
    expect(biomeAt(2600)).toBe('desert');
    expect(biomeAt(5100)).toBe('snow');
    expect(biomeAt(7600)).toBe('night');
    expect(biomeAt(TABLE_X)).toBe('night');
  });

  it('falling into a hole drops the player below ground on the fail screen', () => {
    const s = withCourse([{ type: 'pit', x: 1500 }]);
    runUntil(s, NO_INPUT, leftRunning);
    expect(s.deadBy.type).toBe('pit');
    for (let t = 0; t < 2; t += DT) step(s, { jumpPressed: false, jumpHeld: false }, DT);
    expect(s.player.y).toBeGreaterThan(GROUND_Y + 60);
    expect(s.phase).toBe(PHASE.DEAD);
  });

  it('the pig only becomes lethal after it spawns behind the player', () => {
    const s = withCourse([{ type: 'pig', x: 2400 }]);
    const pig = s.hazards[0];
    expect(pig.visible).toBe(false);
    runUntil(s, NO_INPUT, (st) => st.hazards[0].state === 'active');
    expect(pig.x).toBeLessThan(s.player.x);
    expect(pig.warn).toBe('OINK');
    expect(s.events).toContain('oink');
    runUntil(s, NO_INPUT, leftRunning);
    expect(s.deadBy.type).toBe('pig');
  });

  it('the puddle forms only when the player approaches', () => {
    const s = withCourse([{ type: 'puddle', x: 1500 }]);
    expect(s.hazards[0].w).toBe(0);
    runUntil(s, NO_INPUT, (st) => st.player.x > 1100);
    expect(s.hazards[0].w).toBeGreaterThan(0);
    runUntil(s, NO_INPUT, (st) => st.player.x > 1400);
    expect(s.hazards[0].w).toBe(HAZARD_TYPES.puddle.w);
  });
});

describe('misc', () => {
  it('reaching the table is a real win with a celebration', () => {
    const s = withCourse([]);
    runUntil(s, NO_INPUT, (st) => st.phase !== PHASE.RUNNING);
    expect(s.phase).toBe(PHASE.WIN);
    expect(s.events).toContain('win');
    for (let t = 0; t < 1; t += DT) step(s, { jumpPressed: false, jumpHeld: false }, DT);
    expect(s.player.pose).toBe('cheer');
    expect(s.fx.length).toBeGreaterThan(0);
    expect(s.phase).toBe(PHASE.WIN);
  });

  it('?endings mode still routes the table to the joke endings', () => {
    const s = withCourse([]);
    s.endingsMode = true;
    runUntil(s, NO_INPUT, (st) => st.phase !== PHASE.RUNNING);
    expect(s.phase).toBe(PHASE.ENDING);
  });

  it('a hit produces a hit event, hit-stop and shake', () => {
    const s = withCourse([{ type: 'fence', x: 1500 }]);
    runUntil(s, NO_INPUT, leftRunning);
    expect(s.events).toContain('hit');
    expect(s.hitStop).toBeGreaterThan(0);
    expect(s.camera.shake).toBeGreaterThan(0);
  });

  it('a launched cake falls and splats on the ground', () => {
    const s = seeded(1);
    s.phase = PHASE.DEAD;
    s.cake.y = GROUND_Y - 100;
    launchCake(s, 50, -100);
    runUntil(s, NO_INPUT, (st) => st.cake.splat, 5);
    expect(s.cake.splat).toBe(true);
    expect(s.cake.y).toBe(GROUND_Y);
  });

  it('fakeBest is monotonic and never reaches 100', () => {
    const rng = mulberry32(7);
    let best = 0;
    for (let i = 0; i < 500; i++) {
      const next = fakeBest(best, rng);
      expect(next).toBeGreaterThanOrEqual(best);
      expect(next).toBeLessThan(100);
      best = next;
    }
    expect(best).toBeLessThanOrEqual(99.9);
    expect(fakeBest(0, () => 0.5)).toBe(96);
    expect(fakeBest(99.9, () => 0.1)).toBe(99.9);
  });
});
