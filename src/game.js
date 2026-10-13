// Pure game state + physics. No DOM, no canvas. Deterministic given rng.
// Spec: docs/GAME-DESIGN.md. Decisions: docs/DECISIONS.md.

export const W = 960;
export const H = 540;
export const GROUND_Y = 440;
export const PX_PER_M = 100;
export const COURSE_M = 100;
export const TABLE_X = COURSE_M * PX_PER_M; // 3600
export const BASE_SPEED = 300;
export const SPEED_RAMP = 0.75; // +75 % by the table: 525 px/s at the finish (D18)
export const RUN_SPEED = BASE_SPEED; // kept for callers that need a nominal speed
export const GRAVITY = 1500;
export const JUMP_V = -560; // a tap is always a full jump (≈0.75 s air, ≈105 px high)
export const DOUBLE_JUMP_V = -440; // lower than the first jump: distance, not a free escape (D15)
export const HOLD_GRAVITY_SCALE = 0.95; // almost no float (D18)
export const MAX_JUMPS = 2;

export const PLAYER_W = 30;
export const PLAYER_H = 62;

export const BIOMES = ['meadow', 'desert', 'snow', 'night'];
export function biomeAt(x) {
  const k = Math.max(0, Math.min(3, Math.floor((x / TABLE_X) * 4)));
  return BIOMES[k];
}

export function runSpeed(x) {
  const k = Math.max(0, Math.min(1, x / TABLE_X));
  return BASE_SPEED * (1 + SPEED_RAMP * k);
}

// ---------- Hazard definitions (see GAME-DESIGN.md §3) ----------
export const HAZARD_TYPES = {
  fence: { label: 'fence', w: 54, h: 58, line: 'It was 58 cm high and wider than it looked.' },
  wall: { label: 'wall', w: 54, h: 128, line: 'That one needed a double jump.' },
  puddle: { label: 'puddle', w: 96, h: 6, line: 'Cake does not float.' },
  dog: { label: 'dog', w: 52, h: 38, line: 'He just wanted the cake.' },
  skate: { label: 'skateboard', w: 84, h: 18, line: 'Nobody knows whose it is.' },
  pigeon: { label: 'pigeon', w: 36, h: 30, line: 'Straight for the cake.' },
  pig: { label: 'pig', w: 56, h: 30, line: 'You were supposed to jump.' },
  pit: { label: 'hole', w: 190, h: 0, line: 'It was right there. It was also wide.' },
  pitwide: { label: 'big hole', w: 280, h: 0, line: 'Two jumps. It needed two good jumps.' },
  bee: { label: 'bee', w: 40, h: 34, line: 'Jumping was the wrong call. Run under it.' },
  meteor: { label: 'crate', w: 54, h: 54, line: 'It came from above. The shadow was the hint.' },
  crack: { label: 'crack', w: 130, h: 0, line: 'The ground opened. It rumbled first.' },
  peel: { label: 'banana peel', w: 30, h: 10, line: 'You slid straight into the next thing.' },
  wind: { label: 'gust', w: 600, h: 0, line: '' }, // not lethal: a stretch of head- or tailwind
  beam: { label: 'beam', w: 420, h: 0, line: 'Low beam. Jumping under it was the mistake.' },
  // v6 (D19)
  cow: { label: 'cow', w: 130, h: 56, line: 'She was not in a hurry. You were.' },
  chick: { label: 'chicken', w: 30, h: 30, line: 'Three of them. You counted two.' },
  slime: { label: 'slime', w: 40, h: 36, line: 'It was up. Then it wasn\'t.' },
  snake: { label: 'snake', w: 110, h: 18, line: 'Longer than it looked.' },
  mole: { label: 'mole', w: 40, h: 40, line: 'Early. It popped late.' },
  bro: { label: 'finance bro', w: 40, h: 60, line: 'He bought the dip. You fell in it.' },
  pendulum: { label: 'spiked ball', w: 40, h: 40, line: 'Spiked. Swinging. You jumped anyway.' },
  trampoline: { label: 'trampoline', w: 36, h: 18, line: 'Boing. Then the beam.' },
  egg: { label: 'egg', w: 26, h: 26, line: 'Fresh from the chicken.' },
  knife: { label: 'knife', w: 12, h: 30, line: 'Who is throwing these?' },
  blackout: { label: 'blackout', w: 500, h: 0, line: '' }, // not lethal: lights go out
  ice: { label: 'ice', w: 500, h: 0, line: 'Nothing to grip.' }, // not lethal itself: landings slide
};
const COW_TRIGGER = 500;
const COW_SPEED = 40;
const CHICK_TRIGGER = 560;
const CHICK_SPEED = 90;
const SLIME_CYCLE = { trigger: 1.25, hopAt: 0.9, upFrom: 0.95, upTo: 1.75, height: 110 }; // seconds after trigger (trigger = seconds of running)
const SNAKE_TRIGGER = 600;
const SNAKE_SPEED = 60;
const MOLE_TRIGGER_SEC = 1.2;
const MOLE_SPRAY = 0.3;
export const PENDULUM = { trigger: 1.4, period: 1.3, chain: 100, pivotUp: 120, amp: 0.9, radius: 18, sweep: 96, height: 76 }; // a low wrecking ball: hits runners anywhere in its sweep, jump it
const TRAMPOLINE_V = -900;
const EGG = { warn: 0.6, lead: -10 }; // aimed at where a runner will be
const KNIFE = { warn: 0.45, lead: -10 };
const ICE_SLIDE = 0.35;
export const BLACKOUT = { flicker: 0.5, dark: 1.0, darkNight: 1.5, spot: 150 };
export const BEAM_CLEARANCE = 74; // beam underside above the ground: a standing player (62 px) fits, any hop does not
export const BEAM_THICK = 18;
export const LANDING_LAG = 0; // D17 lag removed in D18: at this density it made landings unwinnable; beams and bees punish spam instead
const BEAM_TIGHT_GAP = 0.5; // seconds between a beam's end and the hazard that follows it (≈0.2 s jump window at base speed)
const WIND_HEAD = 0.8;
const WIND_TAIL = 1.25;
const METEOR_WARN = 1.0; // seconds between shadow and impact
const METEOR_TRIGGER = 650; // px ahead at which the shadow appears
const CRACK_WARN = 0.8;
const CRACK_TRIGGER = 640;
const PEEL_SLIDE = 0.6; // seconds of uncontrollable slide
const PEEL_SLIDE_MULT = 1.5;

const BEE_HOVER_Y = 150; // bottom of the bee above the ground: a standing player passes, a jumper does not
const BEE_TRIGGER = 520;
const BEE_DRIFT = 40;

export const COURSE = {
  minHazards: 15,
  maxHazards: 16,
  firstX: 480, // 4.8 m
  lastX: 9650, // 96.5 m
  gapSecStart: 0.8, // seconds of running between hazards near the start
  gapSecEnd: 0.55, // ...and near the table (the landing from a well-timed jump still clears the next hazard's front)
  comboGap: 30, // px between a combo's fence and its pit
  comboPitW: 140,
};

const DOG_TRIGGER = 450;
const DOG_SPEED = 80;
const PUDDLE_TRIGGER = 700;
const PUDDLE_GROW_TIME = 1.0;
const SKATE_TRIGGER = 600;
const PIGEON_TRIGGER = 480;
const PIGEON_DIVE_TIME = 1.0;
const PIGEON_SKIM_TIME = 0.5;
const PIGEON_SKIM_SPEED = 250;
export const PIG_LEAD = 520; // spawns this far behind the player
export const PIG_SPEED_MULT = 2.6; // D18: faster pig, shorter warning

export const PHASE = {
  TITLE: 'TITLE',
  RUNNING: 'RUNNING',
  DEAD: 'DEAD',
  ENDING: 'ENDING',
  LOST: 'LOST',
  WIN: 'WIN',
};

// Small seeded PRNG so a course can be reproduced (tests, ?seed=).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeHazard(type, x, extra = {}) {
  const def = HAZARD_TYPES[type];
  const h = {
    type,
    label: def.label,
    line: def.line,
    anchorX: x, // where the hazard lives (or, for the pig, where the encounter happens)
    x, // current left edge
    y: GROUND_Y, // bottom edge
    w: def.w,
    h: def.h,
    vx: 0,
    vy: 0,
    state: 'idle', // idle | active | done
    t: 0,
    warn: '',
    visible: true,
    ...extra,
  };
  if (type === 'puddle') h.w = 0;
  if (type === 'pigeon') h.y = GROUND_Y - 150;
  if (type === 'bee') h.y = GROUND_Y - BEE_HOVER_Y;
  if (type === 'meteor') {
    h.y = -200; // falling crate, drawn in the air until impact
    h.visible = false;
  }
  if (type === 'crack') h.w = 0; // opens later
  if (type === 'wind') {
    h.visible = false;
    h.dir = extra.dir ?? 0;
  }
  if (type === 'beam') h.y = GROUND_Y - BEAM_CLEARANCE; // underside
  if (type === 'slime') h.phase = 'down';
  if (type === 'mole') h.popped = false;
  if (type === 'pendulum') {
    // The hazard box is the whole sweep (what a jump must clear); the real hit test uses the ball itself.
    h.x = x - PENDULUM.sweep;
    h.w = PENDULUM.sweep * 2;
    h.h = PENDULUM.height;
  }
  if (type === 'egg' || type === 'knife') {
    h.y = -200;
    h.visible = false;
  }
  if (type === 'blackout' || type === 'ice') h.visible = false;
  if (type === 'pig') {
    // The pig closes PIG_LEAD at (MULT-1)× the player's speed, so the pass happens PIG_LEAD/(MULT-1) px after the trigger.
    h.triggerX = x - PIG_LEAD / (PIG_SPEED_MULT - 1);
    h.x = -1000;
    h.visible = false;
  }
  return h;
}

const POOL = [
  ['fence', 1.0],
  ['puddle', 0.9],
  ['dog', 1.0],
  ['skate', 0.9],
  ['pigeon', 0.8],
  ['pig', 1.6],
  ['pit', 1.1],
  ['pitwide', 0.7],
  ['wall', 0.8],
  ['combo', 0.7],
  ['bee', 3.0],
  ['meteor', 1.4],
  ['crack', 1.2],
  ['peel', 1.2],
  ['wind', 1.2],
  ['beam', 3.0],
  // v6
  ['cow', 1.2],
  ['chickens', 1.2],
  ['slime', 1.4],
  ['snake', 1.0],
  ['mole', 1.2],
  ['bro', 1.1],
  ['pendulum', 1.2],
  ['trampoline', 1.1],
  ['eggrain', 1.0],
  ['knives', 1.0],
  ['blackout', 1.4],
  ['ice', 1.2],
];
const V6_LIMITS = { cow: 2, chickens: 2, slime: 3, snake: 2, mole: 2, bro: 2, pendulum: 2, trampoline: 2, eggrain: 2, knives: 2, blackout: 3, ice: 2 };

function pickType(rng, prev, counts, slotIndex, slots, biome = 'meadow') {
  // Every course has a pig (D4/D10): if none so far, the last slot is the pig.
  if (slotIndex === slots - 1 && !(counts.pig ?? 0)) return 'pig';
  const candidates = POOL.filter(([t]) => {
    if (t === prev) return false;
    if (V6_LIMITS[t] != null && (slotIndex === 0 || (counts[t] ?? 0) >= V6_LIMITS[t])) return false;
    if (t === 'ice' && biome !== 'snow') return false;
    if (t === 'blackout' && biome === 'meadow') return false;
    if (t === 'pig' && (counts.pig ?? 0) >= 3) return false;
    if (t === 'pig' && slotIndex === 0) return false; // needs run-up
    if (t === 'bee' && (slotIndex === 0 || (counts.bee ?? 0) >= 3)) return false;
    if (['meteor', 'crack', 'peel'].includes(t) && (slotIndex === 0 || (counts[t] ?? 0) >= 2)) return false;
    if (t === 'wind' && (counts.wind ?? 0) >= 3) return false;
    if (t === 'beam' && (slotIndex === 0 || (counts.beam ?? 0) >= 5)) return false;
    if (['pigeon', 'wall', 'pitwide', 'combo'].includes(t) && (counts[t] ?? 0) >= 1) return false;
    if (t === 'pigeon' && (counts.pig ?? 0) > 0 && slotIndex - (counts.lastPigSlot ?? -9) < 2) return false;
    if (t === 'pig' && (counts.pigeon ?? 0) > 0 && slotIndex - (counts.lastPigeonSlot ?? -9) < 2) return false;
    void slots;
    return true;
  });
  const total = candidates.reduce((a, [t, w]) => a + (t === 'blackout' && biome === 'night' ? w * 2 : w), 0);
  let r = rng() * total;
  for (const [t, w] of candidates) {
    r -= t === 'blackout' && biome === 'night' ? w * 2 : w;
    if (r <= 0) return t;
  }
  return candidates[candidates.length - 1][0];
}

/**
 * Build a course from a seeded rng (D9/D10). 5–7 slots walked from firstX toward lastX; the gap between
 * slots shrinks from gapSecStart to gapSecEnd (in seconds at the local run speed). A "combo" slot is a
 * fence followed closely by a pit: the landing point of a normal jump is inside the pit, so the player
 * must double jump. At most two pigs, one pigeon, one wall, one wide pit per course.
 */
export function generateCourse(rng) {
  const target = COURSE.minHazards + Math.floor(rng() * (COURSE.maxHazards - COURSE.minHazards + 1));
  const hazards = [];
  const counts = {};
  let prev = null;
  let tightNext = false;
  let x = COURSE.firstX + rng() * 150;
  for (let i = 0; i < target && x <= COURSE.lastX; i++) {
    // Right after a beam, the next hazard may be a plain jump placed so close that the jump must come
    // the instant the beam ends (D17).
    const type = tightNext ? (rng() < 0.5 ? 'fence' : 'pit') : pickType(rng, prev, counts, i, target, biomeAt(x));
    counts[type] = (counts[type] ?? 0) + 1;
    if (type === 'pig') counts.lastPigSlot = i;
    if (type === 'pigeon') counts.lastPigeonSlot = i;
    // A pigeon needs the previous obstacle finished before its dive starts (trigger is 480 px early).
    if (type === 'pigeon' && hazards.length) {
      const prevH = hazards[hazards.length - 1];
      x = Math.max(x, prevH.anchorX + prevH.w + PIGEON_TRIGGER + 160);
    }
    // A hazard that moves toward the player closes part of the gap itself: give it room.
    if (['dog', 'skate', 'snake', 'cow'].includes(type) && hazards.length) x += 0.3 * runSpeed(x);
    if (type === 'chickens' && hazards.length) x += 0.7 * runSpeed(x); // three runners closing in need a clean landing before them
    // "Do not jump" hazards and timed pop-ups must not sit where the previous landing happens.
    if (['slime', 'pendulum', 'mole', 'trampoline'].includes(type) && hazards.length) x += 0.6 * runSpeed(x);
    if (['eggrain', 'knives', 'bro'].includes(type) && hazards.length) x += 0.5 * runSpeed(x);
    // A bee must never hang where the landing from the previous jump happens; same for a banana peel.
    if ((type === 'bee' || type === 'peel') && hazards.length) x += 0.6 * runSpeed(x);
    // Events need the player on the ground when they resolve.
    if ((type === 'meteor' || type === 'crack') && hazards.length) x += 0.5 * runSpeed(x);
    // A beam must start after the landing from whatever came before it.
    if (type === 'beam' && hazards.length) x += 0.25 * runSpeed(x);
    // A wall needs run-up: the double jump must start well before it.
    if (type === 'wall' && hazards.length) x += 0.5 * runSpeed(x);
    // The pig passes under the player at its anchor; the player must be on the ground and ready before that.
    if (type === 'pig' && hazards.length) x += 0.8 * runSpeed(x);
    const ax = Math.round(x);
    const extent = { pitwide: 330, combo: 300, peel: 520, pit: 210, crack: 130, wind: 800, beam: 900, chickens: 260, bro: 300, eggrain: 900, knives: 800, trampoline: 1000, blackout: 1150, ice: 1000, pendulum: 260, chickens: 300 }[type] ?? HAZARD_TYPES[type]?.w ?? 60;
    if (ax + extent > TABLE_X - 300) break;
    if (type === 'peel') {
      hazards.push(makeHazard('peel', ax));
      // The fence sits beyond a normal jump's landing but inside the slide: step on the peel and you cannot avoid it.
      hazards.push(makeHazard('fence', ax + Math.round(0.88 * runSpeed(ax)), { combo: true, afterPeel: true }));
    } else if (type === 'wind') {
      hazards.push(makeHazard('wind', ax, { w: Math.round(1.6 * runSpeed(ax)), dir: rng() < 0.5 ? -1 : 1 }));
    } else if (type === 'beam') {
      hazards.push(makeHazard('beam', ax, { w: Math.round((1.2 + rng() * 0.6) * runSpeed(ax)) }));
    } else if (type === 'chickens') {
      for (let c = 0; c < 3; c++) hazards.push(makeHazard('chick', ax + c * 100, { group: ax, combo: c > 0 }));
    } else if (type === 'bro') {
      // The dip opens in front of him when he yells; jump dip and bro in one jump + double jump.
      hazards.push(makeHazard('crack', ax, { w: 0, dipW: 110, bro: true }));
      hazards.push(makeHazard('bro', ax + 120, { combo: true }));
    } else if (type === 'eggrain') {
      const v = runSpeed(ax);
      for (let c = 0; c < 4; c++) hazards.push(makeHazard('egg', ax + Math.round(c * 0.45 * v), { combo: c > 0 }));
    } else if (type === 'knives') {
      const v = runSpeed(ax);
      for (let c = 0; c < 3; c++) hazards.push(makeHazard('knife', ax + Math.round(c * 0.4 * v), { combo: c > 0 }));
    } else if (type === 'trampoline') {
      // A spring, then a beam placed after a normal jump's landing but inside the launched flight.
      const v = runSpeed(ax);
      hazards.push(makeHazard('trampoline', ax));
      hazards.push(makeHazard('beam', ax + Math.round(0.95 * v), { w: Math.round(1.0 * v), combo: true }));
    } else if (type === 'blackout') {
      const night = biomeAt(ax) === 'night';
      hazards.push(makeHazard('blackout', ax, { w: Math.round((BLACKOUT.flicker + (night ? BLACKOUT.darkNight : BLACKOUT.dark)) * runSpeed(ax)), night }));
    } else if (type === 'ice') {
      hazards.push(makeHazard('ice', ax, { w: Math.round((1.2 + rng() * 0.6) * runSpeed(ax)) }));
    } else if (type === 'combo') {
      hazards.push(makeHazard('fence', ax, { combo: true }));
      hazards.push(makeHazard('pit', ax + HAZARD_TYPES.fence.w + COURSE.comboGap, { w: COURSE.comboPitW, combo: true }));
    } else if (type === 'pit') {
      hazards.push(makeHazard('pit', ax, { w: 160 + Math.round(rng() * 40) }));
    } else if (type === 'pitwide') {
      hazards.push(makeHazard('pitwide', ax, { w: 230 + Math.round(rng() * 50) }));
    } else {
      hazards.push(makeHazard(type, ax));
    }
    const last = hazards[hazards.length - 1];
    // Puddles and cracks start with w = 0 (they form later): space the next slot from their full width.
    const nominalW = last.type === 'crack' ? last.dipW ?? HAZARD_TYPES.crack.w : last.type === 'puddle' ? HAZARD_TYPES.puddle.w : last.w;
    const endX = last.anchorX + nominalW;
    const k = Math.max(0, Math.min(1, endX / TABLE_X));
    let gapSec = COURSE.gapSecStart + (COURSE.gapSecEnd - COURSE.gapSecStart) * k;
    tightNext = type === 'beam' && rng() < 0.8;
    if (tightNext) gapSec = BEAM_TIGHT_GAP;
    // Obstacles that need a double jump keep the player airborne ≈1.3 s; whatever follows must not arrive under them.
    if (['wall', 'pitwide', 'combo', 'pit', 'cow', 'bro', 'pendulum', 'mole'].includes(type)) gapSec += 0.7;
    if (['bee', 'chickens', 'ice', 'trampoline'].includes(type)) gapSec += 0.4;
    if (type === 'eggrain' || type === 'knives') gapSec += 0.7;
    x = endX + gapSec * runSpeed(endX) + (tightNext ? 0 : rng() * 120);
    prev = type;
  }
  // The walk can run out of room before the last slot; still guarantee one pig per course.
  if (!hazards.some((h) => h.type === 'pig') && hazards.length > 1) {
    let last = hazards[hazards.length - 1];
    if (last.combo) {
      hazards.splice(hazards.length - 2, 2);
      last = hazards[hazards.length - 1];
    }
    // Replace the last hazard with the pig, keeping the pig's run-up after whatever precedes it.
    const popped = hazards.length > 1 ? hazards.pop() : null;
    const prev = hazards[hazards.length - 1];
    const minAt = prev.anchorX + prev.w + 0.9 * runSpeed(prev.anchorX);
    const at = Math.min(TABLE_X - 260, Math.max(popped ? popped.anchorX : minAt, minAt));
    hazards.push(makeHazard('pig', Math.round(at)));
  }
  return hazards;
}

/** Build a course from an explicit list, for tests and ?course= debugging. */
export function courseFromSpec(spec) {
  return spec.map(({ type, x, ...extra }) => makeHazard(type, x, extra));
}

export function createState({ rng = Math.random, attempts = 0, seed = null, course = null } = {}) {
  const courseSeed = seed ?? Math.floor(rng() * 4294967296);
  return {
    phase: PHASE.TITLE,
    t: 0,
    rng,
    attempts,
    seed: courseSeed,
    gravitySign: 1,
    speed: BASE_SPEED,
    player: {
      x: 120,
      y: GROUND_Y,
      vy: 0,
      onGround: true,
      jumpsLeft: MAX_JUMPS,
      pose: 'run',
      facing: 1,
      visible: true,
      say: '',
      airT: 0,
      lag: 0,
    },
    cake: { x: 0, y: 0, vx: 0, vy: 0, attached: true, visible: true, splat: false, rot: 0, label: '' },
    table: { x: TABLE_X, y: GROUND_Y, visible: true, collapsed: false, vx: 0 },
    kid: { visible: true, say: '' },
    camera: { x: 0, shake: 0, zoom: 1, focusX: null, focusY: null, pan: 0 },
    hazards: course ?? generateCourse(mulberry32(courseSeed)),
    overlay: null, // { title, lines, style }
    fx: [], // particles { x, y, vx, vy, life, color, size, char }
    events: [], // one-frame events for audio/juice: 'jump' | 'doublejump' | 'land' | 'hit' | 'oink' | 'flap' | 'slip' | 'wind' | 'quake' | 'impact' | 'win'
    hitStop: 0,
    slide: 0, // seconds left of banana/ice slide (no jumping)
    iceSlide: false,
    dark: 0, // blackout level for the renderer
    wind: { t: 0, mult: 1 }, // gust state (set by 'wind' course slots)
    winT: 0,
    distance: 0, // honest best-distance tracking (m)
    deadT: 0,
    deadBy: null,
    ending: null, // { def, t, data, waiting, done }
    lastEndingId: null,
  };
}

export function startRun(state, { seed = null, course = null, wind = true } = {}) {
  const fresh = createState({ rng: state.rng, attempts: state.attempts + 1, seed, course });
  fresh.phase = PHASE.RUNNING;
  fresh.lastEndingId = state.lastEndingId;
  if (!wind) fresh.hazards = fresh.hazards.filter((h) => h.type !== 'wind');
  resetCake(fresh);
  return fresh;
}

// Positions the carried cake in the player's hands. Does not touch visibility: endings hide it.
export function attachCake(state) {
  const p = state.player;
  state.cake.x = p.x + 22 * (p.facing || 1);
  state.cake.y = p.y - 44;
  state.cake.attached = true;
  state.cake.rot = 0;
}

export function resetCake(state) {
  state.cake.visible = true;
  state.cake.splat = false;
  state.cake.label = '';
  attachCake(state);
}

// Rigged: never reports 100 % while the player can still see it move.
export function progress(state) {
  const raw = Math.max(0, Math.min(1, state.player.x / TABLE_X));
  if (state.phase === PHASE.ENDING || state.phase === PHASE.LOST || state.phase === PHASE.WIN) return 1;
  return state.endingsMode ? Math.min(raw, 0.999) : raw;
}

export function playerBox(state) {
  const p = state.player;
  return { x: p.x - PLAYER_W / 2, y: p.y - PLAYER_H, w: PLAYER_W, h: PLAYER_H };
}

export function hazardBox(h) {
  return { x: h.x, y: h.y - h.h, w: h.w, h: h.h };
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function isPit(h) {
  return h.type === 'pit' || h.type === 'pitwide' || (h.type === 'crack' && h.state === 'open');
}

/** Whether a hazard can currently hurt the player. */
export function isLethal(h) {
  if (h.state === 'done') return false;
  if (h.type === 'puddle') return h.w > 10;
  if (h.type === 'pig') return h.state === 'active';
  if (h.type === 'pigeon') return h.state === 'active' && h.phase !== 'away' && h.y >= GROUND_Y - 70;
  if (h.type === 'meteor') return h.state === 'landed' || h.state === 'impact';
  if (h.type === 'crack') return h.state === 'open';
  if (h.type === 'peel') return h.state === 'rest';
  if (h.type === 'wind' || h.type === 'blackout' || h.type === 'ice') return false;
  if (h.type === 'mole') return h.popped;
  if (h.type === 'egg') return h.state === 'impact';
  if (h.type === 'knife') return h.state === 'landed' || h.state === 'impact';
  if (h.type === 'trampoline') return h.state !== 'used';
  return true;
}

export function pendulumBall(h, t) {
  const theta = h.state === 'idle' ? PENDULUM.amp : PENDULUM.amp * Math.cos((2 * Math.PI * (t - (h.t0 ?? 0))) / PENDULUM.period);
  // (idle: parked at the side, visible from afar)
  const px = h.anchorX + PENDULUM.chain * Math.sin(theta);
  const py = GROUND_Y - PENDULUM.pivotUp + PENDULUM.chain * Math.cos(theta);
  return { x: px, y: py, theta };
}

export function beamBox(h) {
  return { x: h.x, y: GROUND_Y - BEAM_CLEARANCE - BEAM_THICK, w: h.w, h: BEAM_THICK };
}

/** True when a point on the ground at x is over a pit. */
export function overPit(state, x) {
  return state.hazards.find((h) => isPit(h) && x > h.x + 8 && x < h.x + h.w - 8) ?? null;
}

export function hitHazard(state) {
  const pb = playerBox(state);
  const p = state.player;
  for (const h of state.hazards) {
    if (!isLethal(h)) continue;
    if (isPit(h)) {
      if (p.onGround && p.x > h.x + 8 && p.x < h.x + h.w - 8) return h;
      continue;
    }
    if (h.type === 'beam') {
      if (!p.onGround && overlaps(pb, beamBox(h))) return h;
      continue;
    }
    if (h.type === 'pendulum') {
      const b = pendulumBall(h, state.t);
      const r = PENDULUM.radius;
      if (overlaps(pb, { x: b.x - r, y: b.y - r, w: 2 * r, h: 2 * r })) return h;
      continue;
    }
    if (h.type === 'trampoline') {
      const hb0 = hazardBox(h);
      const feetOn = p.onGround && pb.x + pb.w - 8 > hb0.x && pb.x + 8 < hb0.x + hb0.w;
      if (feetOn) {
        h.state = 'used';
        p.vy = TRAMPOLINE_V;
        p.onGround = false;
        p.jumpsLeft = 0;
        p.pose = 'flip';
        p.airT = 0;
        state.events.push('boing');
      }
      continue;
    }
    const hb = hazardBox(h);
    if (h.type === 'peel') {
      const feetOn = p.onGround && pb.x + pb.w - 8 > hb.x && pb.x + 8 < hb.x + hb.w;
      if (feetOn) {
        h.state = 'used';
        state.slide = PEEL_SLIDE;
        p.jumpsLeft = 0;
        state.events.push('slip');
      }
      continue;
    }
    if (h.type === 'puddle') {
      // Only the feet count: you must actually be standing in it.
      const feetIn = p.onGround && pb.x + pb.w - 6 > hb.x && pb.x + 6 < hb.x + hb.w;
      if (feetIn) return h;
    } else if (overlaps(pb, hb)) {
      return h;
    }
  }
  return null;
}

function stepHazards(state, dt) {
  const px = state.player.x;
  const v = state.speed;
  for (const h of state.hazards) {
    if (h.state === 'done') {
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      continue;
    }
    h.t += dt;
    switch (h.type) {
      case 'puddle':
        if (h.state === 'idle' && px > h.anchorX - PUDDLE_TRIGGER) {
          h.state = 'active';
          h.t = 0;
        }
        if (h.state === 'active') h.w = HAZARD_TYPES.puddle.w * Math.min(1, h.t / PUDDLE_GROW_TIME);
        break;
      case 'dog':
        if (h.state === 'idle' && px > h.anchorX - DOG_TRIGGER) {
          h.state = 'active';
          h.vx = -DOG_SPEED;
          h.warn = '!';
          h.t = 0;
        }
        if (h.state === 'active') {
          h.x += h.vx * dt;
          if (h.t > 0.7) h.warn = '';
          if (h.x + h.w < px - 200) h.state = 'done';
        }
        break;
      case 'skate':
        if (h.state === 'idle' && px > h.anchorX - SKATE_TRIGGER) {
          h.state = 'active';
          h.vx = -(60 + state.rng() * 60);
        }
        if (h.state === 'active') {
          h.x += h.vx * dt;
          if (h.x + h.w < px - 200) h.state = 'done';
        }
        break;
      case 'pigeon':
        if (h.state === 'idle' && px > h.anchorX - PIGEON_TRIGGER) {
          h.state = 'active';
          h.phase = 'dive';
          h.t = 0;
          h.warn = '!';
          state.events.push('flap');
          h.targetX = px + v * PIGEON_DIVE_TIME + 40;
          h.startX = h.x;
          h.startY = h.y;
        }
        if (h.state === 'active') {
          if (h.phase === 'dive') {
            const k = Math.min(1, h.t / PIGEON_DIVE_TIME);
            h.x = h.startX + (h.targetX - h.startX) * k;
            h.y = h.startY + (GROUND_Y - 6 - h.startY) * k * k;
            if (h.t > 0.5) h.warn = '';
            if (k >= 1) {
              h.phase = 'skim';
              h.t = 0;
              h.vx = -PIGEON_SKIM_SPEED;
            }
          } else if (h.phase === 'skim') {
            h.x += h.vx * dt;
            if (h.t > PIGEON_SKIM_TIME) {
              h.phase = 'away';
              h.vy = -260;
            }
          } else {
            h.x += h.vx * dt;
            h.y += h.vy * dt;
            if (h.y < -100) h.state = 'done';
          }
        }
        break;
      case 'bee':
        if (h.state === 'idle' && px > h.anchorX - BEE_TRIGGER) {
          h.state = 'active';
          h.vx = -BEE_DRIFT;
          h.t = 0;
        }
        h.y = GROUND_Y - BEE_HOVER_Y + Math.sin(state.t * 5 + h.anchorX) * 12;
        if (h.state === 'active') {
          h.x += h.vx * dt;
          if (h.x + h.w < px - 200) h.state = 'done';
        }
        break;
      case 'meteor':
        if (h.state === 'idle' && px > h.anchorX - METEOR_TRIGGER && state.player.onGround) {
          h.state = 'falling';
          h.t = 0;
          h.visible = true;
          h.y = -120;
        }
        if (h.state === 'falling') {
          h.y = -120 + (GROUND_Y + 120) * Math.pow(Math.min(1, h.t / METEOR_WARN), 2);
          if (h.t >= METEOR_WARN) {
            h.state = 'impact';
            h.y = GROUND_Y;
            state.camera.shake = Math.max(state.camera.shake, 0.6);
            state.events.push('impact');
          }
        } else if (h.state === 'impact') {
          h.state = 'landed'; // from now on a plain crate to jump over
        }
        break;
      case 'crack':
        if (h.state === 'idle' && px > h.anchorX - CRACK_TRIGGER && state.player.onGround) {
          h.state = 'warn';
          h.t = 0;
          state.camera.shake = Math.max(state.camera.shake, 0.5);
          state.events.push('quake');
        }
        if (h.state === 'warn' && h.t >= CRACK_WARN) {
          h.state = 'open';
          h.w = h.dipW ?? HAZARD_TYPES.crack.w;
        }
        break;
      case 'peel':
        if (h.state === 'idle' && px > h.anchorX - 950) {
          h.state = 'sliding';
          h.x = h.anchorX + 500;
          h.vx = -700;
        }
        if (h.state === 'sliding') {
          h.x += h.vx * dt;
          if (h.x <= h.anchorX) {
            h.x = h.anchorX;
            h.state = 'rest';
          }
        }
        break;
      case 'cow':
        if (h.state === 'idle' && px > h.anchorX - COW_TRIGGER) {
          h.state = 'active';
          h.vx = -COW_SPEED;
          h.warn = 'MOO';
          h.t = 0;
        }
        if (h.state === 'active') {
          h.x += h.vx * dt;
          if (h.t > 1.0) h.warn = '';
          if (h.x + h.w < px - 200) h.state = 'done';
        }
        break;
      case 'chick':
        if (h.state === 'idle' && px > h.group - CHICK_TRIGGER) {
          h.state = 'active';
          h.vx = -CHICK_SPEED;
          h.warn = h.anchorX === h.group ? 'BAWK' : '';
          h.t = 0;
        }
        if (h.state === 'active') {
          h.x += h.vx * dt;
          if (h.t > 0.8) h.warn = '';
          if (h.x + h.w < px - 200) h.state = 'done';
        }
        break;
      case 'slime': {
        if (h.state === 'idle' && px > h.anchorX - SLIME_CYCLE.trigger * runSpeed(h.anchorX)) {
          h.state = 'active';
          h.t = 0;
        }
        if (h.state === 'active') {
          const c = SLIME_CYCLE;
          let height = 0;
          if (h.t >= c.hopAt && h.t < c.upFrom) height = c.height * ((h.t - c.hopAt) / (c.upFrom - c.hopAt));
          else if (h.t >= c.upFrom && h.t < c.upTo) height = c.height;
          else if (h.t >= c.upTo && h.t < c.upTo + 0.12) height = c.height * (1 - (h.t - c.upTo) / 0.12);
          h.y = GROUND_Y - height;
          h.phase = height > 0 ? 'up' : h.t > c.hopAt - 0.2 && h.t < c.hopAt ? 'squash' : 'down';
          if (h.x + h.w < px - 200) h.state = 'done';
        }
        break;
      }
      case 'snake':
        if (h.state === 'idle' && px > h.anchorX - SNAKE_TRIGGER) {
          h.state = 'active';
          h.vx = -SNAKE_SPEED;
          h.warn = 'sss';
        }
        if (h.state === 'active') {
          h.x += h.vx * dt;
          if (h.t > 1.0) h.warn = '';
          if (h.x + h.w < px - 200) h.state = 'done';
        }
        break;
      case 'mole':
        if (h.state === 'idle' && px > h.anchorX - MOLE_TRIGGER_SEC * runSpeed(h.anchorX)) {
          h.state = 'spray';
          h.t = 0;
        }
        if (h.state === 'spray' && h.t >= MOLE_SPRAY) {
          h.state = 'up';
          h.popped = true;
          h.warn = '!';
        }
        if (h.state === 'up' && h.t > MOLE_SPRAY + 0.6) h.warn = '';
        break;
      case 'bro':
        if (h.state === 'idle' && px > h.anchorX - 120 - CRACK_TRIGGER) {
          h.state = 'active';
          h.warn = 'BUY THE DIP';
          h.vx = -20;
          h.t = 0;
        }
        if (h.state === 'active') {
          if (h.x > h.anchorX - 30) h.x += h.vx * dt;
          if (h.t > 1.6) h.warn = h.t % 2 < 1 ? 'HODL' : '';
          if (h.x + h.w < px - 200) h.state = 'done';
        }
        break;
      case 'pendulum':
        if (h.state === 'idle' && px > h.anchorX - PENDULUM.trigger * runSpeed(h.anchorX)) {
          h.state = 'active';
          h.t0 = state.t;
        }
        if (h.state === 'active' && h.anchorX + 200 < px) h.state = 'done';
        break;
      case 'trampoline':
        break;
      case 'egg':
      case 'knife': {
        const cfg = h.type === 'egg' ? EGG : KNIFE;
        if (h.state === 'idle' && px > h.anchorX - cfg.warn * v - cfg.lead && state.player.onGround) {
          h.state = 'falling';
          h.t = 0;
          h.visible = true;
          h.y = -60;
        }
        if (h.state === 'falling') {
          h.y = -60 + (GROUND_Y + 60) * Math.pow(Math.min(1, h.t / cfg.warn), 2);
          if (h.t >= cfg.warn) {
            h.state = 'impact';
            h.y = GROUND_Y;
            state.events.push(h.type === 'egg' ? 'splat' : 'clink');
          }
        } else if (h.state === 'impact') {
          h.state = h.type === 'egg' ? 'splatted' : 'landed';
          if (h.type === 'egg') {
            h.state = 'done';
            spawnFx(state, 10, { x: h.x + h.w / 2, y: GROUND_Y - 6, color: ['#fff', '#ffd166'], size: 4, speed: 160, life: 0.8 });
          }
        }
        break;
      }
      case 'pig':
        if (h.state === 'idle' && px > h.triggerX) {
          h.state = 'active';
          h.visible = true;
          h.x = px - PIG_LEAD;
          h.vx = runSpeed(px) * PIG_SPEED_MULT; // independent of gusts, so the pass is predictable
          h.warn = 'OINK';
          h.t = 0;
          state.events.push('oink');
        }
        if (h.state === 'active') {
          h.x += h.vx * dt;
          if (h.x > px + 40) h.warn = '';
          if (h.x > px + 300) h.state = 'done';
        }
        break;
      default:
        break;
    }
  }
}

// Blackout slots: 0 = lights on, 0..1 flicker, 1 = dark (a spotlight stays around the player in render).
export function blackoutLevel(state) {
  const p = state.player;
  for (const h of state.hazards) {
    if (h.type !== 'blackout') continue;
    const v = runSpeed(h.anchorX);
    const flickerStart = h.anchorX - BLACKOUT.flicker * v;
    if (p.x >= flickerStart && p.x < h.anchorX) return 0.5 + 0.5 * Math.sin(state.t * 40) > 0.6 ? 0.6 : 0.15;
    if (p.x >= h.anchorX && p.x < h.anchorX + h.w) return 1;
  }
  return 0;
}

// Gusts are course slots (type 'wind'): while the player is inside the stretch the speed is multiplied.
// The gust holds until the player is back on the ground so a jump is never shortened mid-air.
function stepWind(state) {
  const w = state.wind;
  const p = state.player;
  const inside = state.hazards.find((h) => h.type === 'wind' && p.x >= h.anchorX && p.x < h.anchorX + h.w);
  if (inside) {
    if (w.mult === 1) state.events.push('wind');
    w.mult = inside.dir < 0 ? WIND_HEAD : WIND_TAIL;
    w.t = 1;
    inside.state = 'active';
  } else if (w.mult !== 1 && p.onGround) {
    w.mult = 1;
    w.t = 0;
    for (const h of state.hazards) if (h.type === 'wind' && h.state === 'active' && p.x >= h.anchorX + h.w) h.state = 'done';
  }
}

export function timeToGround(y, vy, g = GRAVITY) {
  // y + vy t + 0.5 g t^2 = GROUND_Y
  const d = GROUND_Y - y;
  if (d <= 0 && vy >= 0) return 0;
  const disc = vy * vy + 2 * g * d;
  if (disc < 0) return 0;
  return (-vy + Math.sqrt(disc)) / g;
}

/**
 * Advance the simulation.
 * input: { jumpPressed: boolean (edge), jumpHeld: boolean }
 */
export function step(state, input, dt) {
  state.events.length = 0;
  if (state.hitStop > 0) {
    state.hitStop = Math.max(0, state.hitStop - dt);
    return state;
  }
  state.t += dt;
  const p = state.player;

  if (state.phase === PHASE.RUNNING) {
    stepWind(state);
    if (state.slide > 0) {
      state.slide = Math.max(0, state.slide - dt);
      if (state.slide === 0) state.iceSlide = false;
    }
    state.speed = runSpeed(p.x) * state.wind.mult * (state.slide > 0 && !state.iceSlide ? PEEL_SLIDE_MULT : 1);
    state.dark = blackoutLevel(state);
    p.x += state.speed * dt;
    state.distance = Math.max(state.distance, p.x / PX_PER_M);
    if (p.lag > 0) p.lag = Math.max(0, p.lag - dt);
    if (input.jumpPressed && p.jumpsLeft > 0 && state.slide <= 0 && p.lag <= 0) {
      const second = !p.onGround;
      p.vy = second ? DOUBLE_JUMP_V : JUMP_V;
      p.onGround = false;
      p.jumpsLeft -= 1;
      p.airT = 0;
      p.pose = second ? 'flip' : 'jump';
      state.events.push(second ? 'doublejump' : 'jump');
    }
    const wasAir = !p.onGround;
    integratePlayer(state, dt, input.jumpHeld);
    if (p.onGround) {
      if (wasAir) {
        state.events.push('land');
        p.jumpsLeft = MAX_JUMPS;
        p.lag = LANDING_LAG;
        const ice = state.hazards.find((h) => h.type === 'ice' && p.x >= h.anchorX && p.x < h.anchorX + h.w);
        if (ice) {
          state.slide = Math.max(state.slide, ICE_SLIDE);
          state.iceSlide = true;
          state.events.push('slip');
        }
      }
      p.pose = 'run';
    } else {
      p.airT += dt;
      if (p.pose !== 'flip' || p.airT > 0.45) p.pose = 'jump';
    }
    if (state.cake.attached) attachCake(state);
    stepHazards(state, dt);

    const h = hitHazard(state);
    if (h) {
      state.phase = PHASE.DEAD;
      state.deadBy = h;
      state.deadT = 0;
      state.hitStop = 0.12;
      state.camera.shake = 0.8;
      state.events.push('hit');
      p.pose = 'fall';
      if (isPit(h)) {
        p.onGround = false;
        p.vy = 120;
        p.x = Math.max(h.x + 24, Math.min(p.x, h.x + h.w - 24));
      }
      launchCake(state, 80, -300);
    } else if (p.x >= TABLE_X - 90) {
      p.x = TABLE_X - 90;
      p.pose = 'stand';
      p.vy = 0;
      p.y = GROUND_Y;
      p.onGround = true;
      state.cake.attached = true;
      attachCake(state);
      if (state.endingsMode) {
        state.phase = PHASE.ENDING;
      } else {
        state.phase = PHASE.WIN;
        state.winT = 0;
        state.kid.say = 'CAKE!';
        state.events.push('win');
      }
    }
  } else if (state.phase === PHASE.WIN) {
    state.winT += dt;
    p.pose = 'cheer';
    if (state.winT < 2.5 && Math.floor(state.winT * 30) % 3 === 0) {
      spawnFx(state, 3, { x: state.camera.x + 480, y: -10, spread: 960, color: ['#ff5c8a', '#ffd166', '#06d6a0', '#118ab2', '#fff'], size: 6, speed: 60, vy: 120, gravity: 200, life: 2.5 });
    }
  } else if (state.phase === PHASE.DEAD) {
    // Frozen. Only the cake finishes falling (and the player, into a pit). Leaving DEAD requires an explicit restart (D2).
    state.deadT += dt;
    integrateCake(state, dt);
    if (state.deadBy && isPit(state.deadBy) && p.y < GROUND_Y + 110) {
      p.vy += GRAVITY * dt;
      p.y += p.vy * dt;
    }
  } else if (state.phase === PHASE.ENDING && state.ending) {
    const e = state.ending;
    e.t += dt;
    if (!e.done) e.def.update(state, dt);
    if (state.cake.attached) attachCake(state);
    integrateCake(state, dt);
    if (!e.done && !e.waiting && e.t >= e.def.duration) e.done = true;
    if (e.done) state.phase = PHASE.LOST;
  }

  // Shared cosmetic physics
  state.camera.shake = Math.max(0, state.camera.shake - dt * 2.5);
  if (state.table.vx) state.table.x += state.table.vx * dt;
  stepFx(state, dt);
  updateCamera(state, dt);
  return state;
}

function integratePlayer(state, dt, held) {
  const p = state.player;
  const floaty = held && p.vy < 0 ? HOLD_GRAVITY_SCALE : 1;
  p.vy += GRAVITY * floaty * state.gravitySign * dt;
  p.y += p.vy * dt;
  if (state.gravitySign > 0 && p.y >= GROUND_Y) {
    // Landing over a pit does not stop the fall; hitHazard handles it next.
    p.y = GROUND_Y;
    p.vy = 0;
    p.onGround = true;
  }
}

export function launchCake(state, vx, vy) {
  const c = state.cake;
  c.attached = false;
  c.vx = vx;
  c.vy = vy;
  c.splat = false;
}

export function integrateCake(state, dt) {
  const c = state.cake;
  if (c.attached || c.splat || !c.visible) return;
  c.vy += GRAVITY * state.gravitySign * dt;
  c.x += c.vx * dt;
  c.y += c.vy * dt;
  c.rot += c.vx * 0.01 * dt;
  const ceiling = 40;
  const floor = overPit(state, c.x) ? GROUND_Y + 90 : GROUND_Y;
  if (state.gravitySign > 0 && c.y >= floor) {
    c.y = floor;
    c.splat = true;
    c.vx = 0;
    c.vy = 0;
  } else if (state.gravitySign < 0 && c.y <= ceiling) {
    c.y = ceiling;
    c.splat = true;
    c.vx = 0;
    c.vy = 0;
  }
}

export function spawnFx(state, n, opts) {
  const rng = state.rng;
  for (let i = 0; i < n; i++) {
    state.fx.push({
      x: opts.x + (rng() - 0.5) * (opts.spread ?? 20),
      y: opts.y + (rng() - 0.5) * (opts.spread ?? 20),
      vx: (rng() - 0.5) * (opts.speed ?? 200),
      vy: -rng() * (opts.speed ?? 200) + (opts.vy ?? 0),
      life: opts.life ?? 1.2,
      color: Array.isArray(opts.color) ? opts.color[Math.floor(rng() * opts.color.length)] : opts.color ?? '#f6c',
      size: opts.size ?? 5,
      char: opts.char ?? null,
      gravity: opts.gravity ?? 600,
    });
  }
}

function stepFx(state, dt) {
  for (const f of state.fx) {
    f.vy += f.gravity * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.life -= dt;
  }
  state.fx = state.fx.filter((f) => f.life > 0);
}

function updateCamera(state, dt) {
  const cam = state.camera;
  const target = cam.focusX != null ? cam.focusX - W / 2 : state.player.x - W * 0.3;
  const clamped = Math.max(0, Math.min(target, TABLE_X + 400 - W + cam.pan));
  // During a run the camera is locked to the player; endings may ease it.
  if (state.phase === PHASE.RUNNING || state.phase === PHASE.TITLE || state.phase === PHASE.WIN) cam.x = clamped;
  else cam.x += (clamped - cam.x) * Math.min(1, dt * 4);
}

export function beginEnding(state, def) {
  state.ending = { def, t: 0, data: {}, waiting: false, done: false };
  state.lastEndingId = def.id;
  def.setup(state);
}

// Rigged personal best. It creeps up a tenth at a time so a new "record" keeps appearing.
export function fakeBest(prevBest, rng) {
  if (prevBest <= 0) return Math.round((95 + rng() * 2) * 10) / 10;
  const bump = rng() < 0.45 ? Math.round(rng() * 6) / 10 : 0; // 0.0 .. 0.6
  return Math.min(Math.round((prevBest + bump) * 10) / 10, 99.9);
}
