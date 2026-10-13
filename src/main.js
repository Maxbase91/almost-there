import { W, H, PHASE, createState, startRun, step, beginEnding, fakeBest, courseFromSpec, spawnFx, GROUND_Y, isPit } from './game.js';
import { ENDINGS, pickEnding, getEnding } from './endings.js';
import { perfectInput } from './autopilot.js';
import { loadJournal, saveJournal, markSeen, recordAttempt, recordRun } from './journal.js';
import { createRenderer } from './render.js';
import { loadImages } from './sprites.js';
import { buildPixelSprites } from './pixelart.js';
import { createAudio } from './audio.js';

const $ = (sel) => document.querySelector(sel);
const canvas = $('#game');
canvas.width = W;
canvas.height = H;

const params = new URLSearchParams(location.search);
const forcedEnding = params.get('ending');
// Dev aids (documented in README): ?autopilot=1 plays the course itself, ?debug exposes state,
// ?seed=N reproduces a course, ?course=dog@1500,pig@2600 builds one explicitly.
let autopilot = params.has('autopilot');
// ?endings=1 restores the v1–v3 joke endings at the table instead of a real win (D16).
const endingsMode = params.has('endings');
const forcedSeed = params.has('seed') ? Number(params.get('seed')) >>> 0 : null;
const forcedCourseSpec = params.has('course')
  ? params
      .get('course')
      .split(',')
      .map((item) => item.split('@'))
      .map(([type, x]) => ({ type, x: Number(x) }))
  : null;

const audio = createAudio();
let journal = loadJournal();
let state = createState({ rng: Math.random, attempts: journal.attempts });
let hud = { attempts: journal.attempts, best: journal.best, prevBest: journal.best, muted: audio.muted, wins: journal.wins, bestM: endingsMode ? null : journal.bestM };
const input = { jumpPressed: false, jumpHeld: false };
let lastPhase = state.phase;
let renderer = null;

// ---------- DOM overlays ----------
const loading = $('#loading');
const title = $('#title');
const lost = $('#lost');
const dead = $('#dead');
const win = $('#win');
const dialog = $('#dialog');
const terms = $('#terms');
const journalPanel = $('#journal');
const muteBtn = $('#mute');

const ui = {
  showDialog({ title: t, body, buttons }) {
    $('#dialog-title').textContent = t;
    $('#dialog-body').textContent = body;
    const row = $('#dialog-buttons');
    row.innerHTML = '';
    for (const b of buttons) {
      const el = document.createElement('button');
      el.className = 'btn';
      el.textContent = b.label;
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        audio.play('click');
        b.onClick();
      });
      row.appendChild(el);
    }
    dialog.hidden = false;
  },
  hideDialog() {
    dialog.hidden = true;
    terms.hidden = true;
    stopTerms();
  },
  showTerms({ seconds, onDecline, onExpire }) {
    terms.hidden = false;
    startTerms(seconds, onDecline, onExpire);
  },
};
state.ui = ui;

// ---------- Terms & Conditions (the Accept button runs away) ----------
let termsTimer = null;
let termsPointerHandler = null;
function startTerms(seconds, onDecline, onExpire) {
  const accept = $('#terms-accept');
  const decline = $('#terms-decline');
  const countdown = $('#terms-countdown');
  const area = $('#terms-area');
  const body = $('#terms-body');
  body.scrollTop = 0;
  let left = seconds;
  countdown.textContent = `${left}`;
  accept.style.left = '40%';
  accept.style.top = '55%';
  let resolved = false;
  const finish = (fn) => {
    if (resolved) return;
    resolved = true;
    fn();
  };
  termsTimer = setInterval(() => {
    left -= 1;
    countdown.textContent = `${Math.max(0, left)}`;
    if (left <= 2) audio.play('click', { volume: 0.5 });
    if (left <= 0) finish(onExpire);
  }, 1000);
  const flee = (px, py) => {
    const r = area.getBoundingClientRect();
    const b = accept.getBoundingClientRect();
    const bx = b.left + b.width / 2;
    const by = b.top + b.height / 2;
    const dx = bx - px;
    const dy = by - py;
    const dist = Math.hypot(dx, dy);
    if (dist > 110) return;
    let nx = bx + (dx / (dist || 1)) * 160;
    let ny = by + (dy / (dist || 1)) * 120;
    if (nx < r.left + 50 || nx > r.right - 50) nx = r.left + 50 + Math.random() * (r.width - 100);
    if (ny < r.top + 30 || ny > r.bottom - 30) ny = r.top + 30 + Math.random() * (r.height - 60);
    accept.style.left = `${((nx - r.left) / r.width) * 100}%`;
    accept.style.top = `${((ny - r.top) / r.height) * 100}%`;
  };
  termsPointerHandler = (ev) => flee(ev.clientX, ev.clientY);
  area.addEventListener('pointermove', termsPointerHandler);
  accept.onpointerdown = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    flee(ev.clientX, ev.clientY);
    // Touch: there's no hover, so the button just teleports on contact.
    accept.style.left = `${10 + Math.random() * 80}%`;
    accept.style.top = `${10 + Math.random() * 80}%`;
    audio.play('error', { volume: 0.4 });
  };
  accept.onclick = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
  };
  decline.onclick = (ev) => {
    ev.stopPropagation();
    audio.play('click');
    finish(onDecline);
  };
}
function stopTerms() {
  if (termsTimer) clearInterval(termsTimer);
  termsTimer = null;
  if (termsPointerHandler) $('#terms-area').removeEventListener('pointermove', termsPointerHandler);
  termsPointerHandler = null;
}

// ---------- Journal panel ----------
function renderJournal() {
  const grid = $('#journal-grid');
  grid.innerHTML = '';
  if (!endingsMode) {
    $('#journal-title').textContent = 'RUN LOG';
    const rows = Object.entries(journal.deaths).sort((a, b) => b[1] - a[1]);
    const label = (t) => ({ pit: 'hole', pitwide: 'big hole', skate: 'skateboard', meteor: 'crate', peel: 'banana' })[t] ?? t;
    for (const [type, n] of rows) {
      const card = document.createElement('div');
      card.className = 'card seen';
      card.innerHTML = `<div class="card-title">${label(type).toUpperCase()}</div><div class="card-cap">got you ${n}×</div>`;
      grid.appendChild(card);
    }
    if (!rows.length) grid.innerHTML = '<div class="card"><div class="card-title">???</div><div class="card-cap">Nothing has got you yet.</div></div>';
    $('#journal-count').textContent = `${journal.wins} win${journal.wins === 1 ? '' : 's'} in ${journal.attempts} tr${journal.attempts === 1 ? 'y' : 'ies'}`;
    $('#journal-stats').textContent = `Best distance: ${(journal.bestM ?? 0).toFixed(1)} m of 100 m`;
    return;
  }
  $('#journal-title').textContent = 'FAILURE JOURNAL';
  const seen = new Set(journal.seen);
  for (const e of ENDINGS) {
    const card = document.createElement('div');
    card.className = 'card' + (seen.has(e.id) ? ' seen' : '');
    card.innerHTML = seen.has(e.id)
      ? `<div class="card-title">${e.title}</div><div class="card-cap">${e.caption}</div>`
      : `<div class="card-title">???</div><div class="card-cap">Not yet lost this way.</div>`;
    grid.appendChild(card);
  }
  $('#journal-count').textContent = `${seen.size} / ${ENDINGS.length} ways to lose`;
  $('#journal-stats').textContent = `Tries: ${journal.attempts} · Best: ${journal.best.toFixed(1)}%`;
}

for (const id of ['#open-journal', '#lost-journal', '#win-journal']) {
  $(id).addEventListener('click', () => {
    audio.play('click');
    renderJournal();
    journalPanel.hidden = false;
  });
}
$('#close-journal').addEventListener('click', () => {
  audio.play('click');
  journalPanel.hidden = true;
});
$('#reset-journal').addEventListener('click', () => {
  if (!confirm('Forget every way you have lost?')) return;
  journal = { seen: [], attempts: 0, best: 0, wins: 0, bestM: 0, deaths: {} };
  saveJournal(journal);
  hud.attempts = 0;
  hud.best = 0;
  hud.prevBest = 0;
  hud.wins = 0;
  hud.bestM = endingsMode ? null : 0;
  renderJournal();
});

function syncMute() {
  hud.muted = audio.muted;
  muteBtn.textContent = audio.muted ? 'MUTED' : 'SOUND';
  muteBtn.setAttribute('aria-label', audio.muted ? 'Unmute' : 'Mute');
}
muteBtn.addEventListener('click', (ev) => {
  ev.stopPropagation();
  audio.unlock();
  audio.setMuted(!audio.muted);
  syncMute();
});
syncMute();

// ---------- Flow ----------
function restart() {
  ui.hideDialog();
  lost.hidden = true;
  dead.hidden = true;
  win.hidden = true;
  title.hidden = true;
  // A fresh course every attempt (D3). ?seed / ?course pin it for debugging.
  state = startRun({ ...state, attempts: hud.attempts }, { seed: forcedSeed, course: forcedCourseSpec ? courseFromSpec(forcedCourseSpec) : null });
  state.ui = ui;
  state.endingsMode = endingsMode;
  hud.attempts = state.attempts;
  lastPhase = state.phase;
}

for (const id of ['#start', '#retry', '#dead-retry', '#win-again']) {
  $(id).addEventListener('click', () => {
    audio.unlock();
    audio.play('click');
    restart();
  });
}

function onEnterEnding() {
  const def = (forcedEnding && getEnding(forcedEnding)) || pickEnding(Math.random, journal.seen, state.lastEndingId);
  beginEnding(state, def);
  if (def.id === 'fakewin') audio.play('fanfare');
}

function onWin() {
  journal = recordRun(journal, { distanceM: 100, won: true });
  saveJournal(journal);
  hud.wins = journal.wins;
  hud.bestM = journal.bestM;
  $('#win-stats').textContent = `Win ${journal.wins} · Try ${journal.attempts}`;
  const lines = ['The kid is speechless. So are we.', 'Nobody expected that. Least of all the pig.', 'Frame this. It will not happen again soon.', 'The cake is slightly dented. Nobody minds.'];
  $('#win-line').textContent = lines[journal.wins % lines.length];
  audio.play('fanfare');
  setTimeout(() => {
    if (state.phase === PHASE.WIN) win.hidden = false;
  }, 2200);
}

function onLost() {
  const def = state.ending.def;
  journal = markSeen(journal, def.id);
  journal = recordAttempt(journal, fakeBest(journal.best, Math.random));
  saveJournal(journal);
  hud.best = journal.best;
  $('#lost-title').textContent = def.title;
  $('#lost-caption').textContent = def.caption;
  $('#lost-count').textContent = `Journal ${journal.seen.length} / ${ENDINGS.length}`;
  const newRecord = journal.best > hud.prevBest;
  $('#lost-record').hidden = !newRecord;
  hud.prevBest = journal.best;
  lost.hidden = false;
  audio.play('lose');
}

// Honest loss (D2): freeze, name the hazard, wait for the player.
function onDead() {
  const h = state.deadBy;
  let t = `You hit the ${h.label}.`;
  if (h.type === 'pig') t = 'The pig got you.';
  if (isPit(h)) t = h.type === 'pitwide' ? 'You fell in the big hole.' : 'You fell in the hole.';
  if (h.type === 'meteor') t = 'A crate fell on you.';
  if (h.type === 'crack') t = h.bro ? 'You fell in the dip.' : 'The ground opened under you.';
  const titles = { mole: 'The mole got you.', pendulum: 'The spiked ball got you.', egg: 'An egg landed on you.', knife: 'A knife landed on you.', chick: 'You hit a chicken.', bro: 'The finance bro got you.', slime: 'You jumped into the slime.', cow: 'You ran into the cow.', snake: 'You stepped on the snake.' };
  if (titles[h.type]) t = titles[h.type];
  $('#dead-title').textContent = t;
  $('#dead-line').textContent = h.line;
  journal = recordRun(journal, { distanceM: state.distance, won: false, deathType: h.type });
  saveJournal(journal);
  hud.bestM = endingsMode ? null : journal.bestM;
  const best = journal.bestM >= state.distance - 0.05 && journal.bestM <= state.distance + 0.05 && !endingsMode;
  $('#dead-dist').textContent = `${state.distance.toFixed(1)} m${best ? ' · new best' : ''}. Different course next time.`;
  dead.hidden = false;
}

// ---------- Input ----------
function press() {
  if (state.phase === PHASE.TITLE || state.phase === PHASE.LOST) return;
  if (state.phase === PHASE.WIN) {
    if (state.winT > 2.4) {
      audio.play('click');
      restart();
    }
    return;
  }
  if (state.phase === PHASE.DEAD) {
    // Only an intentional tap retries: a jump-tap that lands just after the hit is ignored.
    if (state.deadT > 0.4) {
      audio.play('click');
      restart();
    }
    return;
  }
  input.jumpPressed = true;
  input.jumpHeld = true;
}
function release() {
  input.jumpHeld = false;
}
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    audio.unlock();
    if (state.phase === PHASE.LOST || state.phase === PHASE.TITLE || (state.phase === PHASE.WIN && state.winT > 2.4)) {
      if (!loading.hidden) return;
      restart();
      return;
    }
    press();
  }
  if (e.code === 'KeyM') {
    audio.setMuted(!audio.muted);
    syncMute();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') release();
});
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  audio.unlock();
  press();
});
window.addEventListener('pointerup', release);
window.addEventListener('pointercancel', release);

// ---------- Juice from simulation events ----------
function handleEvents() {
  for (const ev of state.events) {
    const p = state.player;
    switch (ev) {
      case 'jump':
        audio.play('jump', { volume: 0.5 });
        spawnFx(state, 6, { x: p.x, y: GROUND_Y, color: ['#c98a4b', '#e8d5b5'], size: 4, speed: 120, life: 0.5, gravity: 300 });
        break;
      case 'doublejump':
        audio.play('doublejump', { volume: 0.5, rate: 1.2 });
        spawnFx(state, 10, { x: p.x, y: p.y - 20, color: ['#fff', '#bfe4ff'], size: 4, speed: 160, life: 0.5, gravity: 100 });
        break;
      case 'land':
        spawnFx(state, 5, { x: p.x, y: GROUND_Y, color: ['#c98a4b', '#e8d5b5'], size: 3, speed: 100, life: 0.4, gravity: 300 });
        break;
      case 'hit':
        audio.play('hit');
        audio.play('splat', { volume: 0.6 });
        spawnFx(state, 16, { x: p.x, y: p.y - 30, color: ['#f4a0b5', '#fff', '#ffd166'], size: 4, speed: 260, life: 0.9 });
        break;
      case 'oink':
        audio.play('oink', { rate: 0.8 });
        break;
      case 'flap':
        audio.play('flap', { volume: 0.5 });
        break;
      case 'slip':
        audio.play('error', { volume: 0.6, rate: 1.4 });
        break;
      case 'wind':
        audio.play('flap', { volume: 0.4, rate: 0.6 });
        break;
      case 'quake':
        audio.play('hit', { volume: 0.5, rate: 0.5 });
        break;
      case 'impact':
        audio.play('hit', { volume: 0.9, rate: 0.8 });
        break;
      case 'boing':
        audio.play('jump', { volume: 0.8, rate: 0.5 });
        break;
      case 'clink':
        audio.play('click', { volume: 0.8, rate: 2 });
        break;
      case 'splat':
        audio.play('splat', { volume: 0.5, rate: 1.3 });
        break;
      default:
        break;
    }
  }
}

// ---------- Loop ----------
function tick(dt) {
  if (state.phase === PHASE.TITLE) return;
  if (autopilot && state.phase === PHASE.RUNNING) {
    const a = perfectInput(state);
    input.jumpPressed = a.jumpPressed;
    input.jumpHeld = a.jumpHeld;
  }
  step(state, input, dt);
  input.jumpPressed = false;
  handleEvents();

  if (state.phase === PHASE.ENDING && lastPhase !== PHASE.ENDING) onEnterEnding();
  if (state.phase === PHASE.LOST && lastPhase !== PHASE.LOST) onLost();
  if (state.phase === PHASE.WIN && lastPhase !== PHASE.WIN) onWin();
  if (state.phase === PHASE.DEAD && lastPhase !== PHASE.DEAD) onDead();
  lastPhase = state.phase;
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  tick(dt);
  if (renderer) renderer.draw(state, hud);
  requestAnimationFrame(frame);
}

// Keep the canvas letterboxed to the viewport.
function fit() {
  const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
  const stage = $('#stage');
  stage.style.width = `${Math.floor(W * scale)}px`;
  stage.style.height = `${Math.floor(H * scale)}px`;
}
window.addEventListener('resize', fit);
fit();

// ---------- Boot ----------
async function boot() {
  try {
    const [images] = await Promise.all([loadImages(), document.fonts ? document.fonts.load('12px "Press Start 2P"').catch(() => null) : null]);
    renderer = createRenderer(canvas, images, buildPixelSprites());
  } catch (err) {
    $('#loading-text').textContent = 'Could not load the art. Reload?';
    throw err;
  }
  loading.hidden = true;
  title.hidden = false;
  requestAnimationFrame(frame);
  // ?autoplay=1 starts a run immediately; ?advance=S steps the simulation S seconds (headless screenshots).
  if (params.has('autoplay')) {
    restart();
    const adv = Number(params.get('advance'));
    if (adv > 0) {
      for (let t = 0; t < adv; t += 1 / 60) tick(1 / 60);
      renderer.draw(state, hud);
    }
  }
}
boot();

if (params.has('debug')) {
  window.__almost = {
    get state() {
      return state;
    },
    get journal() {
      return journal;
    },
    get ready() {
      return !!renderer;
    },
    setAutopilot(on) {
      autopilot = !!on;
    },
    restart,
    // Deterministic stepping for verification when the tab is throttled.
    advance(seconds) {
      for (let t = 0; t < seconds; t += 1 / 60) tick(1 / 60);
      if (renderer) renderer.draw(state, hud);
    },
    press,
    release,
  };
}
