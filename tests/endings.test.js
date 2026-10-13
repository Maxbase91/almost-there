import { describe, it, expect } from 'vitest';
import { ENDINGS, ENDING_IDS, pickEnding, getEnding } from '../src/endings.js';
import { createState, startRun, step, beginEnding, PHASE, TABLE_X, GROUND_Y } from '../src/game.js';

const DT = 1 / 60;

function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function stubUi() {
  const ui = { dialog: null, terms: null, hidden: 0 };
  ui.showDialog = (opts) => (ui.dialog = opts);
  ui.showTerms = (opts) => (ui.terms = opts);
  ui.hideDialog = () => {
    ui.hidden++;
    ui.dialog = null;
    ui.terms = null;
  };
  return ui;
}

const stubG = {
  ctx: {},
  emoji() {},
  sprite() {},
  panel() {},
  bubble() {},
  lace() {},
  sign() {},
  text() {},
};

function stateAtTable() {
  const s = startRun(createState({ rng: seeded(3) }));
  s.player.x = TABLE_X - 90;
  s.player.y = GROUND_Y;
  s.player.onGround = true;
  s.phase = PHASE.ENDING;
  s.endingsMode = true;
  s.ui = stubUi();
  return s;
}

describe('ending pool', () => {
  it('has 22 endings with unique ids and the required shape', () => {
    expect(ENDINGS.length).toBe(22);
    expect(new Set(ENDING_IDS).size).toBe(22);
    for (const e of ENDINGS) {
      expect(typeof e.id).toBe('string');
      expect(e.title.length).toBeGreaterThan(0);
      expect(e.caption.length).toBeGreaterThan(0);
      expect(typeof e.setup).toBe('function');
      expect(typeof e.update).toBe('function');
      if (e.interactive) expect(e.duration).toBe(Infinity);
      else expect(Number.isFinite(e.duration) && e.duration > 0).toBe(true);
    }
    expect(getEnding('banana').title).toBe('Banana');
    expect(getEnding('nope')).toBeNull();
  });

  it('pickEnding never repeats until the pool is exhausted', () => {
    const rng = seeded(11);
    const seen = [];
    for (let i = 0; i < ENDINGS.length; i++) {
      const e = pickEnding(rng, seen, seen.at(-1) ?? null);
      expect(seen).not.toContain(e.id);
      seen.push(e.id);
    }
    expect(new Set(seen).size).toBe(ENDINGS.length);
  });

  it('after exhaustion it keeps drawing from the full pool without immediate repeats', () => {
    const rng = seeded(5);
    const seen = [...ENDING_IDS];
    let last = seen.at(-1);
    for (let i = 0; i < 300; i++) {
      const e = pickEnding(rng, seen, last);
      expect(e.id).not.toBe(last);
      last = e.id;
    }
  });
});

// Endings whose gag removes the cake must leave it hidden at the end (regression: attachCake used to reset visibility).
const CAKE_HIDDEN = ['pigeon', 'connection', 'disqualified', 'sprinklers', 'level404', 'repoman', 'fakewin'];

describe('every ending runs to LOST', () => {
  for (const def of ENDINGS) {
    it(`${def.id} resolves and the cake is not delivered`, () => {
      const s = stateAtTable();
      beginEnding(s, def);
      expect(s.lastEndingId).toBe(def.id);
      let t = 0;
      let poked = false;
      while (s.phase !== PHASE.LOST && t < 15) {
        step(s, { jumpPressed: false, jumpHeld: false }, DT);
        t += DT;
        if (def.drawWorld) def.drawWorld(stubG, s);
        if (def.drawScreen) def.drawScreen(stubG, s);
        if (def.interactive && !poked && t > 0.5) {
          poked = true;
          if (s.ui.dialog) s.ui.dialog.buttons[0].onClick();
          else if (s.ui.terms) s.ui.terms.onExpire();
        }
      }
      expect(s.phase).toBe(PHASE.LOST);
      expect(t).toBeLessThan(15);
      if (def.interactive) expect(s.ui.hidden).toBe(1);
      // "Delivered" would mean the cake is intact and on the table. It never is.
      const onTable = s.cake.visible && !s.cake.splat && s.cake.x >= s.table.x && s.cake.x <= s.table.x + 140 && s.cake.y <= s.table.y - 50;
      expect(onTable).toBe(false);
      if (CAKE_HIDDEN.includes(def.id)) expect(s.cake.visible).toBe(false);
    });
  }

  it('interactive endings wait for input and do not time out on their own', () => {
    const s = stateAtTable();
    beginEnding(s, getEnding('areyousure'));
    for (let t = 0; t < 10; t += DT) step(s, { jumpPressed: false, jumpHeld: false }, DT);
    expect(s.phase).toBe(PHASE.ENDING);
    expect(s.ui.dialog.buttons.map((b) => b.label)).toEqual(['No', 'No']);
  });
});
