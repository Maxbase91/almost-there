import { describe, it, expect } from 'vitest';
import { createState, startRun, step, courseFromSpec, mulberry32, blackoutLevel, CALM_DIM, PHASE } from '../src/game.js';

const DT = 1 / 120;
const NO_INPUT = { jumpPressed: false, jumpHeld: false };

function blackoutRun(reducedMotion) {
  const s = startRun(createState({ rng: mulberry32(3) }), { course: courseFromSpec([{ type: 'blackout', x: 1400, w: 450 }]), wind: false });
  s.reducedMotion = reducedMotion;
  const levels = [];
  const track = [];
  for (let t = 0; t < 8 && s.phase === PHASE.RUNNING; t += DT) {
    step(s, NO_INPUT, DT);
    levels.push(s.dark);
    track.push([s.player.x, s.player.y]);
  }
  return { s, levels, track };
}

describe('reduced motion (prefers-reduced-motion)', () => {
  it('without it, a blackout flickers and goes fully dark', () => {
    const { levels } = blackoutRun(false);
    expect(Math.max(...levels)).toBe(1);
    const flicker = levels.filter((d) => d > 0 && d < 1);
    expect(new Set(flicker).size).toBeGreaterThan(1);
  });

  it('with it, the lights dim smoothly to CALM_DIM: no flicker, never a full blackout', () => {
    const { levels } = blackoutRun(true);
    expect(Math.max(...levels)).toBeCloseTo(CALM_DIM, 5);
    expect(Math.max(...levels)).toBeLessThan(1);
    const start = levels.findIndex((d) => d > 0);
    const peak = levels.indexOf(Math.max(...levels));
    expect(start).toBeGreaterThanOrEqual(0);
    for (let i = start + 1; i <= peak; i++) expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1]);
    // After the dim stretch the level only falls back to 0, it does not oscillate.
    const after = levels.slice(peak).filter((d) => d !== CALM_DIM);
    expect(after.every((d) => d === 0)).toBe(true);
  });

  it('changes nothing physical', () => {
    expect(blackoutRun(true).track).toEqual(blackoutRun(false).track);
  });

  it('blackoutLevel is 0 with no blackout ahead in either mode', () => {
    const s = startRun(createState({ rng: mulberry32(1) }), { course: courseFromSpec([]), wind: false });
    expect(blackoutLevel(s)).toBe(0);
    s.reducedMotion = true;
    expect(blackoutLevel(s)).toBe(0);
  });
});
