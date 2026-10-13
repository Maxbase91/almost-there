// Every way the cake does not get delivered.
// Each ending: { id, title, caption, duration, interactive?, setup(s), update(s, dt), drawWorld?(g, s), drawScreen?(g, s) }
// `s` is the game state from game.js; `g` is the renderer helper from render.js.
// Interactive endings set s.ending.waiting = true and resolve via s.ui callbacks.

import { TABLE_X, GROUND_Y, RUN_SPEED, GRAVITY, PLAYER_H, launchCake, spawnFx } from './game.js';

function once(s, key, fn) {
  const fired = (s.ending.data._fired ??= new Set());
  if (fired.has(key)) return;
  fired.add(key);
  fn();
}

function at(s, time, key, fn) {
  if (s.ending.t >= time) once(s, key, fn);
}

function dropCake(s) {
  launchCake(s, 40, -120);
  s.player.pose = 'fall';
}

function finishLater(s, delay) {
  s.ending.data.resolvedAt = s.ending.t;
  s.ending.data.resolveDelay = delay;
  s.ending.waiting = false;
}

function tickResolved(s) {
  const d = s.ending.data;
  if (d.resolvedAt != null && s.ending.t - d.resolvedAt >= d.resolveDelay) s.ending.done = true;
}

const CONFETTI = ['#ff5c8a', '#ffd166', '#06d6a0', '#118ab2', '#ef476f', '#fff'];

export const ENDINGS = [
  {
    id: 'banana',
    title: 'Banana',
    caption: 'There was no banana there a second ago.',
    duration: 2.8,
    setup(s) {
      s.player.pose = 'run';
    },
    update(s, dt) {
      if (s.ending.t < 0.45) s.player.x += RUN_SPEED * 0.6 * dt;
      at(s, 0.15, 'spawn', () => {
        s.ending.data.bananaX = s.player.x + 28;
      });
      at(s, 0.45, 'slip', () => {
        s.player.pose = 'slip';
        launchCake(s, 180, -420);
        s.camera.shake = 0.4;
      });
    },
    drawWorld(g, s) {
      const x = s.ending.data.bananaX;
      if (x != null) g.sprite('banana', x, GROUND_Y + 2);
    },
  },

  {
    id: 'pigeon',
    title: 'Pigeon',
    caption: 'Pigeons have no concept of birthdays.',
    duration: 3.2,
    setup(s) {
      s.ending.data.bird = { x: s.player.x + 700, y: 60 };
    },
    update(s, dt) {
      const b = s.ending.data.bird;
      const t = s.ending.t;
      const c = s.cake;
      if (t < 1.1) {
        const k = t / 1.1;
        b.x = s.player.x + 700 - 700 * k;
        b.y = 60 + (c.y - 30 - 60) * k * k;
      } else {
        once(s, 'grab', () => {
          c.visible = false;
          s.player.pose = 'stand';
          s.player.say = '…';
        });
        b.x += 260 * dt;
        b.y -= 220 * dt;
      }
    },
    drawWorld(g, s) {
      const b = s.ending.data.bird;
      g.sprite('pigeon', b.x, b.y + 12, { frame: Math.floor(s.t * 12) % 3, flip: true });
      if (!s.cake.visible) g.sprite('cake', b.x - 4, b.y + 50, { scale: 0.75 });
    },
  },

  {
    id: 'bennyhill',
    title: 'Benny Hill',
    caption: 'The table had other plans.',
    duration: 3.6,
    setup(s) {
      s.player.pose = 'stand';
    },
    update(s, dt) {
      at(s, 0.5, 'go', () => {
        s.table.vx = RUN_SPEED * 1.35;
        s.player.pose = 'run';
        s.kid.say = 'bye';
        s.camera.pan = 1600;
      });
      if (s.ending.t >= 0.5) s.player.x += RUN_SPEED * dt;
    },
  },

  {
    id: 'areyousure',
    title: 'Are you sure?',
    caption: 'Both buttons said No. You pressed one.',
    duration: Infinity,
    interactive: true,
    setup(s) {
      s.ending.waiting = true;
      const resolve = () => {
        s.ui.hideDialog();
        dropCake(s);
        finishLater(s, 1.6);
      };
      s.ui.showDialog({
        title: 'Deliver the cake?',
        body: 'This action cannot be undone.',
        buttons: [
          { label: 'No', onClick: resolve },
          { label: 'No', onClick: resolve },
        ],
      });
    },
    update(s) {
      tickResolved(s);
    },
  },

  {
    id: 'gravityflip',
    title: 'Gravity flip',
    caption: 'Gravity was a suggestion.',
    duration: 3.2,
    setup() {},
    update(s, dt) {
      at(s, 0.5, 'flip', () => {
        s.gravitySign = -1;
        launchCake(s, 10, -60);
        s.player.pose = 'fall';
        s.player.vy = -40;
      });
      if (s.gravitySign < 0) {
        const p = s.player;
        p.vy += GRAVITY * s.gravitySign * dt;
        p.y += p.vy * dt;
        const ceil = 40 + PLAYER_H;
        if (p.y < ceil) {
          p.y = ceil;
          p.vy = 0;
        }
      }
    },
  },

  {
    id: 'wrongday',
    title: 'Wrong day',
    caption: 'The invitation said Tuesday. Today is Wednesday.',
    duration: 4.4,
    setup(s) {
      s.player.pose = 'stand';
    },
    update(s) {
      at(s, 0.6, 'a', () => (s.kid.say = "It's not my birthday."));
      at(s, 2.2, 'b', () => (s.kid.say = 'That was yesterday.'));
      at(s, 3.4, 'c', () => {
        s.player.pose = 'sad';
        s.kid.say = 'But thanks.';
      });
    },
  },

  {
    id: 'connection',
    title: 'Connection lost',
    caption: 'This game is fully offline. It does not matter.',
    duration: 4.2,
    setup() {},
    update(s) {
      at(s, 0.3, 'a', () => {
        s.overlay = { style: 'modal', title: 'Connection lost', lines: ['Reconnecting…'], spinner: true };
      });
      at(s, 2.4, 'b', () => {
        s.overlay = { style: 'modal', title: 'Session expired', lines: ['Cake not saved.'] };
        s.cake.visible = false;
      });
    },
  },

  {
    id: 'sneeze',
    title: 'Sneeze',
    caption: 'Pollen count: high.',
    duration: 3.4,
    setup(s) {
      s.player.pose = 'stand';
    },
    update(s) {
      at(s, 0.3, 'a', () => (s.player.say = 'Ah…'));
      at(s, 0.9, 'b', () => (s.player.say = 'Ah… ah…'));
      at(s, 1.5, 'c', () => {
        s.player.say = 'AH-CHOO!';
        launchCake(s, 300, -520);
        s.player.pose = 'fall';
        s.camera.shake = 0.6;
        spawnFx(s, 14, { x: s.player.x + 20, y: s.player.y - 50, color: '#bde', size: 3, speed: 260 });
      });
      at(s, 2.6, 'd', () => (s.player.say = 'Sorry.'));
    },
  },

  {
    id: 'disqualified',
    title: 'Disqualified',
    caption: 'Rule 4.2: ran too efficiently.',
    duration: 3.6,
    setup(s) {
      s.ending.data.ref = { x: s.player.x - 420 };
      s.player.pose = 'stand';
    },
    update(s, dt) {
      const r = s.ending.data.ref;
      if (r.x < s.player.x - 80) r.x += 420 * dt;
      at(s, 1.0, 'whistle', () => {
        s.ending.data.say = 'TWEEEET';
        s.camera.shake = 0.2;
      });
      at(s, 1.6, 'card', () => {
        s.overlay = { style: 'card', title: 'DISQUALIFIED', lines: ['Rule 4.2: ran too efficiently.'] };
        s.ending.data.say = '';
        s.cake.visible = false;
        s.player.pose = 'sad';
      });
    },
    drawWorld(g, s) {
      const r = s.ending.data.ref;
      g.sprite('referee', r.x, GROUND_Y + 2);
      if (s.ending.data.say) g.bubble(s.ending.data.say, r.x, GROUND_Y - 76);
      if (!s.cake.visible) g.sprite('cake', r.x + 30, GROUND_Y - 24, { scale: 0.75 });
    },
  },

  {
    id: 'sprinklers',
    title: 'Sprinklers',
    caption: 'The candle was a fire hazard.',
    duration: 3.6,
    setup(s) {
      s.player.pose = 'stand';
    },
    update(s) {
      at(s, 0.5, 'flame', () => {
        s.ending.data.flame = true;
      });
      if (s.ending.t > 1.1) {
        spawnFx(s, 6, { x: s.camera.x + 480, y: 20, spread: 960, color: ['#5fb3ff', '#9fd4ff'], size: 3, speed: 0, vy: 420, gravity: 300, life: 1.4 });
      }
      at(s, 2.0, 'melt', () => {
        s.cake.visible = false;
        s.ending.data.flame = false;
        s.player.pose = 'sad';
        spawnFx(s, 24, { x: s.cake.x, y: s.cake.y, color: ['#f9c', '#fff', '#e7a'], size: 4, speed: 160 });
      });
    },
    drawWorld(g, s) {
      if (s.ending.data.flame) g.sprite('flame', s.cake.x, s.cake.y - 34, { scale: 0.8 + Math.abs(Math.sin(s.t * 30)) * 0.3 });
      if (s.ending.data.rain || s.ending.t > 1.1) for (let i = 0; i < 5; i++) g.sprite('sprinkler', s.camera.x + 120 + i * 190, 30, { anchor: 'tl' });
    },
  },

  {
    id: 'cat',
    title: 'Cat',
    caption: 'Cat did not move.',
    duration: 6.4,
    setup(s) {
      s.player.pose = 'stand';
    },
    update(s) {
      at(s, 0.3, 'c', () => (s.kid.say = 'Move. Five.'));
      at(s, 1.3, '4', () => (s.kid.say = 'Four.'));
      at(s, 2.3, '3', () => (s.kid.say = 'Three.'));
      at(s, 3.3, '2', () => (s.kid.say = 'Two.'));
      at(s, 4.3, '1', () => (s.kid.say = 'One.'));
      at(s, 5.3, '0', () => {
        s.kid.say = '';
        s.overlay = { style: 'card', title: 'TIME', lines: ['Cat did not move.'] };
        s.player.pose = 'sad';
      });
    },
    drawWorld(g, s) {
      if (s.ending.t > 0.2) g.sprite('cat', s.table.x + 70, s.table.y - 46);
    },
  },

  {
    id: 'level404',
    title: 'Level 2',
    caption: 'Level 2 not found.',
    duration: 4.2,
    setup() {},
    update(s) {
      at(s, 0.3, 'a', () => {
        s.overlay = { style: 'win', title: 'LEVEL COMPLETE!', lines: ['Loading level 2…'], progress: 0 };
      });
      if (s.overlay && s.overlay.progress != null) s.overlay.progress = Math.min(0.97, (s.ending.t - 0.3) / 1.6);
      at(s, 2.3, 'b', () => {
        s.overlay = { style: 'modal', title: '404', lines: ['Level 2 not found.', 'Returning cake to sender.'] };
        s.cake.visible = false;
      });
    },
  },

  {
    id: 'repoman',
    title: 'Repo man',
    caption: 'Three missed payments.',
    duration: 4.6,
    setup(s) {
      s.ending.data.man = { x: s.player.x + 520, carrying: false };
      s.player.pose = 'stand';
    },
    update(s, dt) {
      const m = s.ending.data.man;
      if (!m.carrying) {
        if (m.x > s.player.x + 64) m.x -= 330 * dt;
        else
          once(s, 'take', () => {
            m.carrying = true;
            m.tookAt = s.ending.t;
            s.cake.visible = false;
            s.ending.data.say = 'This cake was a rental.';
            s.player.pose = 'sad';
          });
      } else {
        // Pause to deliver the line, then leave with the cake.
        if (s.ending.t - m.tookAt > 1.2) {
          m.x += 300 * dt;
          s.ending.data.say = '';
        }
      }
    },
    drawWorld(g, s) {
      const m = s.ending.data.man;
      g.sprite('repoman', m.x, GROUND_Y + 2, { flip: m.carrying });
      if (m.carrying) g.sprite('cake', m.x + 26, GROUND_Y - 24, { scale: 0.75 });
      if (s.ending.data.say) g.bubble(s.ending.data.say, m.x, GROUND_Y - 76);
    },
  },

  {
    id: 'terms',
    title: 'Terms & Conditions',
    caption: 'You did not accept the Terms in time.',
    duration: Infinity,
    interactive: true,
    setup(s) {
      s.ending.waiting = true;
      s.player.pose = 'stand';
      const resolve = (why) => {
        s.ui.hideDialog();
        s.ending.data.why = why;
        dropCake(s);
        s.overlay = { style: 'card', title: why === 'declined' ? 'DECLINED' : 'TIMEOUT', lines: ['Delivery requires consent.'] };
        finishLater(s, 1.8);
      };
      s.ui.showTerms({ seconds: 7, onDecline: () => resolve('declined'), onExpire: () => resolve('expired') });
    },
    update(s) {
      tickResolved(s);
    },
  },

  {
    id: 'shoelace',
    title: 'Shoelace',
    caption: 'You could have tied it.',
    duration: 3.8,
    setup(s) {
      s.player.pose = 'run';
    },
    update(s, dt) {
      const t = s.ending.t;
      if (t < 1.3) {
        s.player.x += RUN_SPEED * 0.4 * dt;
        s.camera.zoom = 1 + Math.min(1, t / 0.6) * 1.6;
        s.camera.focusX = s.player.x + 100;
        s.camera.focusY = GROUND_Y - 10;
      }
      at(s, 1.3, 'trip', () => {
        s.camera.zoom = 1;
        s.camera.focusY = null;
        s.player.pose = 'slip';
        launchCake(s, 220, -380);
        s.camera.shake = 0.3;
      });
      at(s, 1.8, 'msg', () => {
        s.overlay = { style: 'toast', lines: ['You could have tied it.'] };
      });
    },
    drawWorld(g, s) {
      if (s.ending.t < 1.3) g.lace(s.player.x + 8, GROUND_Y);
    },
  },

  {
    id: 'earthquake',
    title: 'Earthquake',
    caption: 'Magnitude 4.1, localized to the table.',
    duration: 3.4,
    setup(s) {
      s.player.pose = 'stand';
    },
    update(s) {
      const t = s.ending.t;
      if (t > 0.4 && t < 2.0) s.camera.shake = 1.0;
      at(s, 1.2, 'collapse', () => {
        s.table.collapsed = true;
        s.kid.say = '!!';
      });
      at(s, 1.5, 'fall', () => {
        s.player.pose = 'fall';
        launchCake(s, 90, -220);
      });
    },
  },

  {
    id: 'physicsquit',
    title: 'Physics quit',
    caption: 'Physics has left the chat.',
    duration: 4.0,
    setup(s) {
      s.player.pose = 'stand';
    },
    update(s, dt) {
      at(s, 0.4, 'toast', () => {
        s.overlay = { style: 'toast', lines: ['Physics has left the chat'] };
      });
      at(s, 0.9, 'float', () => {
        s.gravitySign = 0;
        launchCake(s, 6, -45);
        s.player.pose = 'float';
        s.ending.data.floating = true;
      });
      if (s.ending.data.floating) {
        s.player.y -= 32 * dt;
        s.table.y -= 22 * dt;
        s.cake.rot += 1.2 * dt;
      }
    },
  },

  {
    id: 'dream',
    title: 'It was a dream',
    caption: 'Monday. 06:30. No cake.',
    duration: 3.8,
    setup() {},
    update(s) {
      const t = s.ending.t;
      if (t > 0.3 && t < 1.7) {
        s.overlay = { style: 'fade', alpha: Math.min(1, (t - 0.3) / 1.3) };
      }
      at(s, 1.7, 'clock', () => {
        s.overlay = { style: 'clock', title: '06:30', lines: ['Monday.', 'It was a dream.'] };
      });
    },
  },

  {
    id: 'fakewin',
    title: 'Fake win',
    caption: 'Please contact support. Support is a cat.',
    duration: 4.6,
    setup(s) {
      s.player.pose = 'cheer';
      s.kid.say = 'YAY!';
    },
    update(s) {
      const t = s.ending.t;
      at(s, 0.2, 'win', () => {
        s.overlay = { style: 'win', title: 'YOU WIN!', lines: ['Cake delivered!'] };
      });
      if (t > 0.2 && t < 2.4) spawnFx(s, 2, { x: s.camera.x + 480, y: -10, spread: 960, color: CONFETTI, size: 6, speed: 60, vy: 120, gravity: 200, life: 2.5 });
      at(s, 2.5, 'void', () => {
        s.overlay = { style: 'modal', title: 'Error', lines: ['Score could not be saved.', 'Result voided.'] };
        s.player.pose = 'sad';
        s.kid.say = '';
        s.cake.visible = false;
        s.fx = [];
      });
    },
  },

  {
    id: 'nah',
    title: 'Nah',
    caption: 'Your character has reconsidered.',
    duration: 4.2,
    setup(s) {
      s.player.pose = 'stand';
      s.camera.focusX = s.player.x + 160;
    },
    update(s, dt) {
      at(s, 0.5, 'look', () => (s.player.facing = 0));
      at(s, 1.1, 'say', () => (s.player.say = 'Nah.'));
      at(s, 2.0, 'leave', () => {
        s.player.facing = -1;
        s.player.pose = 'run';
        s.player.say = '';
      });
      if (s.ending.t >= 2.0) s.player.x -= RUN_SPEED * 0.7 * dt;
    },
  },

  {
    id: 'displayonly',
    title: 'Display only',
    caption: 'Not for consumption.',
    duration: 4.2,
    setup(s) {
      s.player.pose = 'stand';
    },
    update(s) {
      const t = s.ending.t;
      s.camera.zoom = 1 + Math.min(1, t / 1.5) * 1.8;
      s.camera.focusX = s.cake.x;
      s.camera.focusY = s.cake.y - 10;
      at(s, 1.8, 'sticker', () => (s.cake.label = 'DISPLAY MODEL'));
      at(s, 2.6, 'toast', () => {
        s.overlay = { style: 'toast', lines: ['NOT FOR CONSUMPTION'] };
        s.kid.say = 'Oh.';
      });
    },
  },

  {
    id: 'wrongtable',
    title: 'Wrong table',
    caption: 'The party is 3 km further.',
    duration: 4.4,
    setup(s) {
      s.player.pose = 'stand';
      s.camera.pan = 1700;
    },
    update(s) {
      at(s, 0.4, 'a', () => (s.kid.say = "Oh, we're the neighbours."));
      at(s, 1.6, 'b', () => {
        s.kid.say = 'The party is that way.';
        s.camera.focusX = TABLE_X + 1300;
      });
      at(s, 3.4, 'c', () => {
        s.overlay = { style: 'toast', lines: ['Almost.'] };
      });
    },
    drawWorld(g, s) {
      g.sign(TABLE_X + 1250, GROUND_Y, 'PARTY → 3 km');
    },
  },
];

export const ENDING_IDS = ENDINGS.map((e) => e.id);

export function getEnding(id) {
  return ENDINGS.find((e) => e.id === id) ?? null;
}

/**
 * Uniform draw from endings not yet seen. Once everything has been seen, draw from the
 * whole pool but never repeat the immediately previous ending.
 */
export function pickEnding(rng, seenIds, lastId = null, pool = ENDINGS) {
  const seen = new Set(seenIds);
  let candidates = pool.filter((e) => !seen.has(e.id));
  if (candidates.length === 0) candidates = pool.filter((e) => e.id !== lastId);
  if (candidates.length === 0) candidates = pool;
  return candidates[Math.floor(rng() * candidates.length)];
}
