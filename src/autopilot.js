// Two synthetic players, shared by the test suite and the ?autopilot=1 dev mode.
//  - perfectInput: a flawless player. Every generated course must be beatable by it (fairness test).
//  - humanInput:   reaction jitter + dropped inputs. The course is tuned so it reaches the table ≈ 1 in 3 runs (D11).

import { PLAYER_W, GRAVITY, GROUND_Y, DOUBLE_JUMP_V, HOLD_GRAVITY_SCALE, isLethal, isPit, timeToGround } from './game.js';

const SKIP = new Set(['bee', 'wind', 'beam', 'blackout', 'ice', 'slime']);
const SLIME = { hopAt: 0.9, upFrom: 0.95, upTo: 1.75 };

export const JUMP_AHEAD = 95; // px before a hazard's front edge (static window is ≈50–140 at base speed)
export const PIG_BEHIND = 60; // px from the pig's nose to the player's heels
export const WALL_AHEAD = 150;
export const PIT_AHEAD = 55;

// A pigeon counts as a threat once it is lethal or in the last part of its dive (its path is predictable then).
function pigeonIncoming(h) {
  if (h.state !== 'active' || h.phase === 'away') return false;
  return isLethal(h) || (h.phase === 'dive' && h.t > 0.6);
}

// A slime that is (or will be) up during the crossing is passed on the ground; one that stays down is a small fence.
function slimeMode(h, state) {
  const p = state.player;
  if (h.state === 'done' || p.x > h.x + h.w + 40) return 'none';
  if (h.state !== 'active') return 'jump';
  const tIn = Math.max(0, (h.x - PLAYER_W / 2 - 20 - p.x) / state.speed);
  const tOut = Math.max(0, (h.x + h.w + PLAYER_W / 2 + 20 - p.x) / state.speed);
  const sIn = h.t + tIn;
  const sOut = h.t + tOut;
  if (sIn >= SLIME.upFrom && sOut <= SLIME.upTo) return 'run';
  if (sOut < SLIME.hopAt - 0.05) return 'jump';
  return 'run'; // between states: stay low and hope (generation keeps this rare)
}

// Bees, beams, swinging spikes and slimes that are up: the right move is to stay on the ground.
export function beeOverhead(state, margin = 90) {
  const p = state.player;
  return state.hazards.some(
    (h) =>
      (h.type === 'bee' && h.state !== 'done' && p.x > h.x - margin - 220 && p.x < h.x + h.w + margin) ||
      (h.type === 'beam' && p.x > h.x - 40 && p.x < h.x + h.w + PLAYER_W / 2 + 6) ||

      (h.type === 'slime' && slimeMode(h, state) === 'run' && p.x > h.x - 240 && p.x < h.x + h.w + 40),
  );
}

function threatAhead(state, policy) {
  const p = state.player;
  for (const h of state.hazards) {
    if (h.state === 'done' || (SKIP.has(h.type) && !(h.type === 'slime' && slimeMode(h, state) === 'jump'))) continue;
    if ((h.type === 'meteor' || h.type === 'egg' || h.type === 'knife') && h.state === 'idle') continue; // nothing to see yet
    if (h.type === 'crack' && h.state === 'idle') continue;
    if (h.type === 'peel' && h.state !== 'rest') continue;
    if (h.type === 'mole' && !h.popped) continue;
    if (h.type === 'pig') {
      if (h.state !== 'active') continue;
      const d = p.x - PLAYER_W / 2 - (h.x + h.w);
      const rel = Math.max(60, h.vx - state.speed); // closing speed
      if (d >= 0 && d < policy.pigBehind * (rel / 260)) return h;
      continue;
    }
    if (h.type === 'pigeon' && !pigeonIncoming(h)) continue;
    const front = h.type === 'puddle' ? h.anchorX : h.x;
    const gap = front - p.x;
    // Holes are jumped from the edge so the flight covers as much as possible; everything else a little earlier.
    const ahead = h.type === 'wall' ? policy.wallAhead : isPit(h) || h.type === 'pendulum' ? PIT_AHEAD : policy.jumpAhead;
    if (gap > 0 && gap < ahead * (state.speed / 280)) return h;
  }
  return null;
}

// Forward-simulate an arc (held jump: lighter gravity while rising) and check it stays above `top`
// for the whole span [front, back].
function arcClears(x0, y0, vy0, speed, front, back, top, hvx = 0) {
  let x = x0;
  let y = y0;
  let vy = vy0;
  const dt = 1 / 120;
  for (let i = 0; i < 400; i++) {
    const f = front + hvx * i * dt;
    const b = back + hvx * i * dt;
    if (x > b) return true;
    const g = vy < 0 ? GRAVITY * HOLD_GRAVITY_SCALE : GRAVITY;
    vy += g * dt;
    y += vy * dt;
    x += speed * dt;
    if (y >= GROUND_Y) return x > b;
    if (x >= f && x <= b && y > top) return false;
  }
  return true;
}

// Where would the player land if they did nothing more? Simulated with the held-jump float, which the
// closed-form timeToGround ignores (it under-estimated flights and caused needless double jumps).
function landingX(state) {
  const p = state.player;
  let x = p.x;
  let y = p.y;
  let vy = p.vy;
  const dt = 1 / 120;
  for (let i = 0; i < 400 && y < GROUND_Y; i++) {
    const g = vy < 0 ? GRAVITY * HOLD_GRAVITY_SCALE : GRAVITY;
    vy += g * dt;
    y += vy * dt;
    x += state.speed * dt;
  }
  return x;
}

function needsDoubleJump(state) {
  const p = state.player;
  if (p.onGround || p.jumpsLeft <= 0) return false;
  const lx = landingX(state);
  const tLand = (lx - p.x) / state.speed;
  // Tall obstacles (walls, cows, bros, crates, fences...): if the current arc goes through one, double jump as
  // late as still clears it (near the apex), never so late that it cannot.
  for (const h of state.hazards) {
    if (h.state === 'done' || isPit(h) || h.h < 30 || !isLethal(h)) continue;
    if (['bee', 'pig', 'slime', 'beam', 'wind', 'blackout', 'ice', 'pigeon'].includes(h.type)) continue;
    if ((h.type === 'egg' || h.type === 'knife' || h.type === 'meteor') && h.state !== 'landed') continue;
    const hvx = h.vx || 0;
    const front = h.x - PLAYER_W / 2;
    const back = h.x + h.w + PLAYER_W / 2;
    if (p.x >= back) continue;
    const top = GROUND_Y - h.h - 4;
    if (arcClears(p.x, p.y, p.vy, state.speed, front, back, top, hvx)) continue;
    const now = arcClears(p.x, p.y, DOUBLE_JUMP_V, state.speed, front, back, top, hvx);
    // state a moment later without acting
    const dt = 1 / 30;
    const gNow = p.vy < 0 ? GRAVITY * HOLD_GRAVITY_SCALE : GRAVITY;
    const vy1 = p.vy + gNow * dt;
    const y1 = p.y + p.vy * dt;
    const later = arcClears(p.x + state.speed * dt, y1, DOUBLE_JUMP_V, state.speed, front + hvx * dt, back + hvx * dt, top, hvx);
    if (now && (!later || p.vy >= -120)) return true;
  }
  if (p.vy < -120) return false; // for everything else, wait for the apex so the second jump adds the most distance
  for (const h of state.hazards) {
    if (h.state === 'done') continue;
    const pitLike = isPit(h) || (h.type === 'crack' && h.state === 'warn');
    const pitW = h.type === 'crack' ? 130 : h.w;
    if (pitLike && lx > h.x - 10 && lx < h.x + pitW + 10) return true;
    if (h.type === 'meteor' && h.state !== 'idle' && lx + PLAYER_W / 2 > h.x - 10 && lx - PLAYER_W / 2 < h.x + h.w + 10) return true;
    // Eggs and knives only hurt in the frame they land (knives stay as small obstacles afterwards): double jump
    // only when the landing would coincide with the impact, or onto a stuck knife.
    if (h.type === 'egg' || h.type === 'knife') {
      const over = lx + PLAYER_W / 2 > h.x - 10 && lx - PLAYER_W / 2 < h.x + h.w + 10;
      if (!over) continue;
      if (h.state === 'falling') {
        const warn = h.type === 'egg' ? 0.6 : 0.45;
        if (Math.abs(tLand - (warn - h.t)) < 0.15) return true;
      } else if (h.type === 'knife' && h.state === 'landed') return true;
    }
    if (h.type === 'mole' && h.state !== 'idle' && lx + PLAYER_W / 2 > h.x - 10 && lx - PLAYER_W / 2 < h.x + h.w + 10) return true;
    // A moving (or static) lethal obstacle that will be at the landing spot: jump again over it.
    if (!isPit(h) && !['wall', 'bee', 'meteor', 'pig', 'egg', 'knife', 'mole', 'slime', 'beam', 'wind', 'blackout', 'ice'].includes(h.type) && isLethal(h) && h.h > 0) {
      const hx = h.x + (h.vx || 0) * tLand;
      if (lx + PLAYER_W / 2 > hx - 30 && lx - PLAYER_W / 2 < hx + h.w + 10) return true;
    }
  }
  return false;
}

export function perfectInput(state) {
  const p = state.player;
  if (!p.onGround) {
    if (needsDoubleJump(state)) return { jumpPressed: true, jumpHeld: true };
    return { jumpPressed: false, jumpHeld: true };
  }
  if (beeOverhead(state)) return { jumpPressed: false, jumpHeld: false };
  const h = threatAhead(state, { jumpAhead: JUMP_AHEAD, pigBehind: PIG_BEHIND, wallAhead: WALL_AHEAD });
  if (h) return { jumpPressed: true, jumpHeld: true };
  return { jumpPressed: false, jumpHeld: false };
}

export const autopilotInput = perfectInput;

/**
 * Human-ish player. rng must be seeded for reproducible results.
 * sigmaSec: reaction jitter (std dev, seconds); dropRate: chance to miss an input entirely.
 */
export function createHumanInput(rng, { sigmaSec = 0.13, dropRate = 0.14 } = {}) {
  const decided = new Map(); // hazard → { offsetPx, dropped }
  function plan(h, state) {
    if (!decided.has(h)) {
      // Box–Muller normal
      const u = Math.max(1e-9, rng());
      const v = rng();
      const n = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      decided.set(h, { offsetPx: n * sigmaSec * state.speed, dropped: rng() < dropRate, dropped2: rng() < dropRate });
    }
    return decided.get(h);
  }
  return function humanInput(state) {
    const p = state.player;
    if (!p.onGround) {
      if (needsDoubleJump(state)) {
        const h = state.hazards.find((x) => x.state !== 'done' && (isPit(x) || x.type === 'wall') && x.x + x.w > p.x - 50);
        const d = h ? plan(h, state) : { dropped2: false };
        if (d.dropped2) return { jumpPressed: false, jumpHeld: true };
        return { jumpPressed: true, jumpHeld: true };
      }
      return { jumpPressed: false, jumpHeld: true };
    }
    if (beeOverhead(state)) {
      // a human sometimes panics and jumps into it
      const bee = state.hazards.find((h) => ['bee', 'beam', 'slime'].includes(h.type) && h.state !== 'done' && h.x + h.w > p.x - 200);
      const d = bee ? plan(bee, state) : { dropped: false };
      return { jumpPressed: d.dropped && rng() < 0.5, jumpHeld: false };
    }
    for (const h of state.hazards) {
      if (h.state === 'done' || (SKIP.has(h.type) && !(h.type === 'slime' && slimeMode(h, state) === 'jump'))) continue;
      if ((h.type === 'meteor' || h.type === 'egg' || h.type === 'knife') && h.state === 'idle') continue;
      if (h.type === 'crack' && h.state === 'idle') continue;
      if (h.type === 'peel' && h.state !== 'rest') continue;
      if (h.type === 'mole' && !h.popped) continue;
      const d = plan(h, state);
      if (d.dropped) continue;
      const ahead = (h.type === 'wall' ? WALL_AHEAD : isPit(h) || h.type === 'pendulum' ? PIT_AHEAD : JUMP_AHEAD) * (state.speed / 280) + d.offsetPx;
      if (h.type === 'pig') {
        if (h.state !== 'active') continue;
        const dist = p.x - PLAYER_W / 2 - (h.x + h.w);
        const rel = Math.max(60, h.vx - state.speed);
        if (dist >= 0 && dist < PIG_BEHIND * (rel / 260) + d.offsetPx) return { jumpPressed: true, jumpHeld: true };
        continue;
      }
      if (h.type === 'pigeon' && !pigeonIncoming(h)) continue;
      const front = h.type === 'puddle' ? h.anchorX : h.x;
      const gap = front - p.x;
      if (gap > 0 && gap < ahead) return { jumpPressed: true, jumpHeld: true };
    }
    return { jumpPressed: false, jumpHeld: false };
  };
}
