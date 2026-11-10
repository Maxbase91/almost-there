// Data-driven backdrops and ambient effects for the level scenes (docs/LEVELS.md).
// A scene is four stretches; each is 'outdoor' (sky, two parallax silhouette layers, ground) or 'indoor'
// (a wall with a feature, a floor). Everything is drawn with 3 px pixels and is deterministic from the
// camera position and state.t, so nothing here touches the run rng.
// The lists below are the vocabulary a level file may use; tests validate level data against them.

import { W, H, GROUND_Y, TABLE_X, PHASE, isPit, stretchIndex } from './game.js';
import { PIXEL_SCALE } from './sprites.js';

export const SHAPES = ['tiles', 'hills', 'dunes', 'mountains', 'skyline', 'neon', 'forest', 'palms', 'sea', 'icebergs', 'graves', 'deadtrees', 'castle', 'cloudsea', 'houses', 'pier', 'rooftops', 'ropes', 'none'];
export const FEATURES = ['window', 'racks', 'whiteboard', 'charts', 'shelves', 'screens', 'stage', 'bar', 'portraits', 'crates', 'reception', 'cave', 'plan'];
export const AMBIENTS = ['none', 'snow', 'rain', 'storm', 'leaves', 'petals', 'embers', 'fireflies', 'bats', 'spray', 'fog', 'paper', 'sparks', 'dust', 'aurora', 'notes'];
export const ORBS = ['sun', 'bigsun', 'sunset', 'moon', 'bigmoon', 'none'];
export const GROUND_TILES = ['grass', 'sand', 'snow'];

const INK = '#2b2b3a';
const TILE = 18 * PIXEL_SCALE; // 54
const BG_TILE = 24 * PIXEL_SCALE; // 72
const WALL_SEG = 260;
const FADE = 0.6; // seconds of sky cross-fade when one outdoor stretch follows another
const GROUND_SETS = {
  grass: ['groundTop', 'groundTopAlt'],
  sand: ['groundTopSand', 'groundTopSandAlt'],
  snow: ['groundTopSnow', 'groundTopSnowAlt'],
};
const DEFAULT_PIT = { fill: '#3a2412', edge: '#5a3a1e', deep: '#1d1208' };

const snap = (v) => Math.round(v / 3) * 3;
// Deterministic 0..1 from an integer (cell index, particle index).
export const hash = (n) => (Math.imul(Math.floor(n) | 0, 0x9e3779b1) >>> 0) / 4294967296;
const wrap = (v, m) => ((v % m) + m) % m;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mixHex(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}
// Six sky bands, top to bottom: given as six, or as (top, horizon).
export function skyBands(sky) {
  if (sky.length >= 6) return sky.slice(0, 6);
  return [0, 1, 2, 3, 4, 5].map((i) => mixHex(sky[0], sky[1], i / 5));
}

export function createScenery(ctx, sp, getVW) {
  const rect = (x, y, w, h) => ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  // Stepped triangle (apex up), filled down to `base`.
  function peak(cx, base, halfW, h, step = 6) {
    for (let dy = 0; dy < h; dy += step) rect(snap(cx - (halfW * (dy + step)) / h), base - h + dy, snap((2 * halfW * (dy + step)) / h), step);
  }
  function disc(cx, cy, r) {
    for (let dy = -r; dy < r; dy += 3) {
      const half = snap(Math.sqrt(r * r - (dy + 1.5) * (dy + 1.5)));
      rect(cx - half, cy + dy, half * 2, 3);
    }
  }

  // Which outdoor stretch supplies the sky: the player's, else the one coming into view, else the one behind.
  function skyStretch(scene, i) {
    const s = scene.stretches;
    for (const k of [i, i + 1, i - 1]) if (s[k] && s[k].kind !== 'indoor') return k;
    return -1;
  }
  // [{ stretch, alpha }] to draw back to front, with a short cross-fade right after an outdoor→outdoor boundary.
  function skyStack(state, scene) {
    const i = stretchIndex(state.player.x);
    const k = skyStretch(scene, i);
    if (k < 0) return [];
    const s = scene.stretches;
    const t = state.stretch?.i === i ? state.stretch.t : FADE;
    if (k === i && i > 0 && s[i - 1].kind !== 'indoor' && state.phase === PHASE.RUNNING && t < FADE) return [{ s: s[i - 1], a: 1 }, { s: s[i], a: t / FADE }];
    return [{ s: s[k], a: 1 }];
  }

  // ---------- sky (screen space) ----------
  function sky(state, scene) {
    const VW = getVW();
    const stack = skyStack(state, scene);
    if (!stack.length) {
      ctx.fillStyle = scene.stretches[stretchIndex(state.player.x)].trim;
      ctx.fillRect(0, 0, VW, H);
      return;
    }
    for (const { s, a } of stack) {
      ctx.globalAlpha = a;
      const bands = skyBands(s.sky);
      const bh = Math.ceil(H / bands.length / 3) * 3;
      bands.forEach((c, n) => {
        ctx.fillStyle = c;
        ctx.fillRect(0, n * bh, VW, bh + 3);
      });
      if (s.stars) {
        ctx.fillStyle = '#fff';
        for (let n = 0; n < 40; n++) {
          if (!state.reducedMotion && Math.floor(state.t * 2 + n * 0.37) % 9 === 0) continue; // twinkle
          ctx.fillRect((n * 193) % VW, ((n * 89) % 260) + 10, 3, 3);
        }
      }
      orb(s.orb, VW, bands);
    }
    ctx.globalAlpha = 1;
  }

  function orb(kind, VW, bands) {
    if (kind === 'sun' || kind === 'bigsun') {
      const d = kind === 'bigsun' ? 72 : 54;
      ctx.fillStyle = '#fff1b5';
      ctx.fillRect(VW - 150, 54, d, d);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(VW - 144, 60, d - 12, d - 12);
    } else if (kind === 'sunset') {
      ctx.fillStyle = '#ffb26b';
      disc(snap(VW * 0.7), GROUND_Y - 96, 96);
      ctx.fillStyle = '#ffd166';
      disc(snap(VW * 0.7), GROUND_Y - 96, 78);
    } else if (kind === 'moon') {
      ctx.fillStyle = '#fff1b5';
      ctx.fillRect(VW - 150, 54, 42, 42);
      ctx.fillStyle = bands[0];
      ctx.fillRect(VW - 138, 48, 36, 36);
    } else if (kind === 'bigmoon') {
      ctx.fillStyle = '#fff1b5';
      disc(VW - 150, 108, 48);
      ctx.fillStyle = '#e8d5a3';
      ctx.fillRect(VW - 171, 90, 12, 9);
      ctx.fillRect(VW - 141, 114, 18, 12);
      ctx.fillRect(VW - 162, 126, 9, 6);
    }
  }

  // ---------- parallax layers (world space) ----------
  function layers(state, scene) {
    for (const { s, a } of skyStack(state, scene)) {
      layer(state, s.far, 0.15, 200, a);
      layer(state, s.mid, 0.4, 118, a);
      if (s.clouds) clouds(state, a);
    }
    ctx.globalAlpha = 1;
  }

  function clouds(state, a) {
    const cam = state.camera;
    ctx.globalAlpha = a;
    for (let n = 0; n < 12; n++) {
      const wx = n * 520 + (n % 3) * 90 - cam.x * (1 - 0.3);
      const wy = 70 + (n % 4) * 34;
      if (wx + 60 < cam.x - 100 || wx > cam.x + W + 100) continue;
      sp.draw('cloudWhite', wx, wy, { anchor: 'tl', scale: n % 2 ? 1 : 1.5 });
    }
  }

  function layer(state, def, factor, Hm, a) {
    if (!def || def.shape === 'none') return;
    const cam = state.camera;
    const off = cam.x * (1 - factor); // layer x → world x
    ctx.globalAlpha = a * (def.alpha ?? 1);
    if (def.shape === 'tiles') {
      const topY = factor < 0.3 ? GROUND_Y - BG_TILE * 2 - 30 : GROUND_Y - BG_TILE - 20;
      const startX = Math.floor((cam.x - off - BG_TILE) / BG_TILE) * BG_TILE + off;
      for (let x = startX; x < cam.x + W + BG_TILE * 2; x += BG_TILE) {
        const n = Math.round((x - off) / BG_TILE);
        sp.draw(n % 2 ? def.a : def.b, x, topY, { anchor: 'tl' });
        for (let y = topY + BG_TILE; y < GROUND_Y + 10; y += BG_TILE) sp.draw(def.fill, x, y, { anchor: 'tl' });
      }
      return;
    }
    const G = GROUND_Y + 12; // every silhouette is filled down to just below the ground line
    const c1 = def.color;
    const c2 = def.color2 ?? null;
    const far = factor < 0.3;
    const lx0 = cam.x * factor - 80;
    const lx1 = cam.x * factor + W + 80;
    // fn(cellIndex, worldX of the cell's left edge)
    const cells = (cw, fn, pad = 0) => {
      for (let c = Math.floor((lx0 - pad) / cw); c * cw < lx1 + pad; c++) fn(c, c * cw + off);
    };
    // A continuous outline in 12 px columns; fn(layerX) → height above the ground.
    const columns = (fn, top2 = 0) =>
      cells(12, (c, x) => {
        const h = snap(fn(c * 12));
        ctx.fillStyle = c1;
        rect(x, G - h, 12, h);
        if (c2 && top2) {
          ctx.fillStyle = c2;
          rect(x, G - h, 12, top2);
        }
      });
    const band = (h) => {
      ctx.fillStyle = c1;
      rect(cam.x - 100, G - h, W + 200, h);
    };
    const salt = far ? 0 : 1000;
    ctx.fillStyle = c1;
    switch (def.shape) {
      case 'hills':
        columns((lx) => Hm * (0.5 + 0.3 * Math.sin(lx / 170 + salt) + 0.2 * Math.sin(lx / 61 + 1.7)));
        break;
      case 'dunes':
        columns((lx) => Hm * (0.34 + 0.24 * Math.sin(lx / 260 + salt) + 0.08 * Math.sin(lx / 97 + 0.6)), 3);
        break;
      case 'cloudsea':
        columns((lx) => Hm * (0.34 + 0.24 * Math.abs(Math.sin(lx / 74 + salt)) + 0.14 * Math.abs(Math.sin(lx / 33 + 1))), 6);
        break;
      case 'mountains':
        band(Hm * 0.22);
        cells(
          240,
          (c, x) => {
            const cx = snap(x + 120 + (hash(c + salt) - 0.5) * 90);
            const h = snap(Hm * (0.62 + 0.38 * hash(c * 7 + 3 + salt)));
            ctx.fillStyle = c1;
            peak(cx, G, h * 0.95, h);
            if (c2) {
              ctx.fillStyle = c2;
              peak(cx, G - h + 30, 28, 30);
            }
          },
          240,
        );
        break;
      case 'skyline':
      case 'neon':
        cells(54, (c, x) => {
          const h = snap(Hm * (0.3 + 0.7 * hash(c * 3 + salt)));
          ctx.fillStyle = c1;
          rect(x, G - h, 48, h);
          if (hash(c * 11 + salt) > 0.7) rect(x + 18, G - h - 18, 6, 18); // antenna
          if (c2) {
            ctx.fillStyle = c2;
            for (let wy = 9; wy < h - 24; wy += 18) for (let wx = 6; wx < 42; wx += 12) if (hash(c * 131 + wy * 7 + wx + salt) > 0.55) rect(x + wx, G - h + wy, 6, 9);
          }
          if (def.shape === 'neon' && hash(c * 17 + 5 + salt) > 0.45) {
            const on = state.reducedMotion || Math.floor(state.t * 3 + c) % 5 !== 0;
            ctx.fillStyle = on ? ['#ff4fa3', '#7fe0d8', '#ffd166'][Math.abs(c) % 3] : c1;
            rect(x + 12, G - h + 12, 9, 39);
            rect(x + 12, G - h + 12, 24, 9);
          }
        });
        break;
      case 'forest':
        band(Hm * 0.2);
        cells(
          42,
          (c, x) => {
            const h = snap(Hm * (0.5 + 0.5 * hash(c * 5 + salt)));
            ctx.fillStyle = c1;
            peak(x + 21, G, 24, h);
            if (c2) {
              ctx.fillStyle = c2;
              peak(x + 21, G - h + 18, 8, 18);
            }
          },
          42,
        );
        break;
      case 'palms':
        band(Hm * 0.14);
        cells(
          170,
          (c, x) => {
            if (hash(c * 9 + salt) < 0.2) return;
            const h = snap(Hm * (0.6 + 0.4 * hash(c * 13 + 1 + salt)));
            const px = snap(x + 60 + hash(c + salt) * 50);
            ctx.fillStyle = c1;
            for (let n = 0; n < 4; n++) rect(px + n * 3, G - (h * (n + 1)) / 4, 6, h / 4 + 3); // leaning trunk
            const tx = px + 12;
            const ty = G - h;
            ctx.fillStyle = c2 ?? c1;
            rect(tx - 36, ty, 36, 6);
            rect(tx + 3, ty, 36, 6);
            rect(tx - 27, ty - 9, 24, 6);
            rect(tx + 6, ty - 9, 24, 6);
            rect(tx - 42, ty + 6, 15, 6);
            rect(tx + 30, ty + 6, 15, 6);
            rect(tx - 6, ty - 15, 15, 9);
          },
          170,
        );
        break;
      case 'sea': {
        const h = snap(Hm * 0.46);
        band(h);
        if (c2) {
          ctx.fillStyle = c2;
          const drift = state.reducedMotion ? 0 : state.t * 14;
          for (let r = 0; r < 4; r++) cells(96, (c, x) => rect(snap(x + wrap(hash(c * 7 + r) * 96 + drift * (r + 1) * 0.5, 96)), G - h + 9 + r * 15, 18 + r * 3, 3));
        }
        break;
      }
      case 'icebergs': {
        ctx.fillStyle = c2 ?? '#7fb0d8';
        rect(cam.x - 100, G - snap(Hm * 0.26), W + 200, snap(Hm * 0.26));
        cells(
          210,
          (c, x) => {
            if (hash(c * 3 + salt) < 0.25) return;
            const h = snap(Hm * (0.4 + 0.5 * hash(c * 5 + 2 + salt)));
            const cx = snap(x + 105);
            ctx.fillStyle = c1;
            peak(cx, G - 12, 66, h);
            peak(cx + 54, G - 12, 36, h * 0.55);
            ctx.fillStyle = '#ffffff';
            peak(cx, G - 12 - h + 18, 13, 18);
          },
          210,
        );
        break;
      }
      case 'graves':
        band(Hm * 0.18);
        cells(78, (c, x) => {
          const r = hash(c * 7 + salt);
          const b = G - snap(Hm * 0.18);
          ctx.fillStyle = c1;
          if (r > 0.45) {
            rect(x + 24, b - 30, 24, 30);
            rect(x + 27, b - 36, 18, 6);
            if (c2) {
              ctx.fillStyle = c2;
              rect(x + 30, b - 24, 12, 3);
              rect(x + 30, b - 15, 9, 3);
            }
          } else if (r > 0.2) {
            rect(x + 33, b - 39, 6, 39);
            rect(x + 24, b - 30, 24, 6);
          }
        });
        break;
      case 'deadtrees':
        band(Hm * 0.12);
        cells(
          132,
          (c, x) => {
            if (hash(c * 5 + salt) < 0.2) return;
            const h = snap(Hm * (0.55 + 0.45 * hash(c * 11 + salt)));
            const tx = snap(x + 50 + hash(c + salt) * 30);
            ctx.fillStyle = c1;
            rect(tx, G - h, 9, h);
            for (let n = 0; n < 3; n++) {
              const by = G - h + 12 + n * snap(h * 0.2);
              const len = 30 - n * 6;
              rect(tx - len, by, len, 6);
              rect(tx - len, by - 12, 6, 12);
              rect(tx + 9, by + 9, len, 6);
              rect(tx + 3 + len, by - 6, 6, 15);
            }
          },
          132,
        );
        break;
      case 'castle':
        band(Hm * 0.2);
        cells(
          640,
          (c, x) => {
            const b = G - snap(Hm * 0.2);
            const bx = snap(x + 200);
            const body = snap(Hm * 0.42);
            ctx.fillStyle = c1;
            rect(bx, b - body, 240, body);
            for (let n = 0; n < 240; n += 24) rect(bx + n, b - body - 9, 12, 9); // crenellations
            for (const [tx, tw, th] of [[-24, 54, 0.66], [93, 60, 0.8], [210, 54, 0.6]]) {
              const h = snap(Hm * th);
              rect(bx + tx, b - h, tw, h);
              peak(bx + tx + tw / 2, b - h, tw / 2 + 6, 36);
            }
            if (c2) {
              ctx.fillStyle = c2;
              const lit = (n) => state.reducedMotion || hash(c * 3 + n + Math.floor(state.t / 3)) > 0.25;
              [[-6, 0.5], [114, 0.68], [129, 0.5], [228, 0.46], [48, 0.3], [174, 0.3]].forEach(([wx, wy], n) => lit(n) && rect(bx + wx, b - snap(Hm * wy), 9, 15));
            }
          },
          640,
        );
        break;
      case 'houses':
        band(Hm * 0.1);
        cells(
          108,
          (c, x) => {
            const b = G - snap(Hm * 0.1);
            const h = 48 + snap(hash(c * 3 + salt) * 30);
            ctx.fillStyle = c1;
            rect(x + 12, b - h, 78, h);
            peak(x + 51, b - h, 48, 30);
            rect(x + 66, b - h - 27, 9, 21); // chimney
            if (c2) {
              ctx.fillStyle = c2;
              rect(x + 24, b - h + 12, 12, 12);
              if (hash(c * 7 + salt) > 0.4) rect(x + 60, b - h + 12, 12, 12);
            }
          },
          108,
        );
        break;
      case 'pier': {
        const deck = G - snap(Hm * 0.5);
        ctx.fillStyle = c1;
        rect(cam.x - 100, deck, W + 200, 9);
        rect(cam.x - 100, deck - 21, W + 200, 3);
        cells(66, (c, x) => {
          ctx.fillStyle = c1;
          rect(x + 27, deck, 9, G - deck);
          rect(x + 30, deck - 21, 3, 21);
          if (wrap(c, 4) === 0) {
            rect(x + 27, deck - 66, 6, 66);
            ctx.fillStyle = c2 ?? '#ffd166';
            rect(x + 21, deck - 75, 18, 9);
          }
        });
        break;
      }
      case 'rooftops':
        cells(
          150,
          (c, x) => {
            const h = snap(Hm * (0.4 + 0.5 * hash(c * 3 + salt)));
            const top = G - h;
            ctx.fillStyle = c1;
            rect(x + 6, top, 138, h);
            rect(x, top - 6, 150, 6); // parapet
            const r = hash(c * 13 + salt);
            if (r > 0.66) {
              rect(x + 36, top - 42, 36, 24); // water tank
              rect(x + 39, top - 18, 6, 12);
              rect(x + 63, top - 18, 6, 12);
              peak(x + 54, top - 42, 21, 12, 3);
            } else if (r > 0.33) {
              rect(x + 84, top - 57, 3, 51); // aerial
              rect(x + 75, top - 51, 21, 3);
              rect(x + 78, top - 42, 15, 3);
            } else rect(x + 30, top - 24, 30, 18); // AC box
            if (c2) {
              ctx.fillStyle = c2;
              for (let wx = 18; wx < 126; wx += 27) if (hash(c * 31 + wx + salt) > 0.5) rect(x + wx, top + 12, 12, 9);
            }
          },
          150,
        );
        break;
      case 'ropes': {
        const top = G - snap(Hm * 0.95);
        cells(
          192,
          (c, x) => {
            ctx.fillStyle = c1;
            rect(x + 90, top, 9, G - top);
            rect(x + 75, top + 18, 39, 6); // platform
            ctx.fillStyle = c2 ?? '#c98a4b';
            for (let n = 0; n < 16; n++) {
              const u = n / 16;
              const sag = 30 * 4 * u * (1 - u);
              rect(snap(x + 99 + u * 183), snap(top + 18 + sag), 9, 3);
              if (n % 3 === 0) rect(snap(x + 99 + u * 183), snap(top + 18 + sag), 3, 21); // rope ladder rungs
              rect(snap(x + 99 + u * 183), snap(top + 39 + sag), 9, 3);
            }
          },
          192,
        );
        break;
      }
      default:
        break;
    }
  }

  // ---------- indoor walls (world space, attached to the course) ----------
  function walls(state, scene) {
    const cam = state.camera;
    const start = Math.floor(cam.x / WALL_SEG) * WALL_SEG - WALL_SEG;
    for (let x = start; x < cam.x + W + WALL_SEG; x += WALL_SEG) {
      const o = scene.stretches[stretchIndex(x)];
      if (o.kind !== 'indoor') continue;
      const seg = Math.round(x / WALL_SEG);
      const dim = o.lit || ['racks', 'screens', 'cave', 'bar'].includes(o.feature);
      ctx.fillStyle = o.wall;
      ctx.fillRect(x, -60, WALL_SEG, GROUND_Y + 60);
      // ceiling strip with a light panel
      ctx.fillStyle = o.trim;
      ctx.fillRect(x, -60, WALL_SEG, 93);
      ctx.fillStyle = dim ? '#6b6f80' : '#fff8e0';
      ctx.fillRect(x + 90, 33, 84, 6);
      feature(state, o, x, seg);
      // skirting board
      ctx.fillStyle = o.trim;
      ctx.fillRect(x, GROUND_Y - 15, WALL_SEG, 15);
    }
  }

  function feature(state, o, x, seg) {
    const t = state.t;
    const calm = state.reducedMotion;
    const accent = o.accent;
    switch (o.feature) {
      case 'racks':
        // server racks with blinking LEDs
        for (let r = 0; r < 2; r++) {
          const rx = x + 36 + r * 108;
          ctx.fillStyle = '#111118';
          ctx.fillRect(rx, 96, 84, 246);
          ctx.fillStyle = '#45485c';
          for (let u = 0; u < 9; u++) ctx.fillRect(rx + 6, 102 + u * 27, 72, 21);
          for (let u = 0; u < 9; u++) {
            const on = calm ? u % 2 === 0 : ((Math.floor(t * 4) + u * 7 + r * 3 + x) >>> 0) % 5 < 3;
            ctx.fillStyle = on ? (u % 3 ? '#5fbf5a' : '#ffd166') : '#2b2b3a';
            ctx.fillRect(rx + 66, 111 + u * 27, 6, 3);
          }
        }
        break;
      case 'whiteboard': {
        ctx.fillStyle = '#8a8fa3';
        ctx.fillRect(x + 30, 93, 200, 162);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 36, 99, 188, 150);
        const notes = ['#ffd166', '#f4a0b5', '#bfe4ff', '#5fbf5a'];
        for (let n = 0; n < 6; n++) {
          ctx.fillStyle = notes[Math.floor(hash(seg * 7 + n) * notes.length)];
          ctx.fillRect(x + 45 + (n % 3) * 27 + snap(hash(seg + n * 3) * 6), 108 + Math.floor(n / 3) * 27, 18, 18);
        }
        ctx.fillStyle = accent ?? '#e5484d';
        for (let n = 0; n < 8; n++) ctx.fillRect(x + 132 + n * 10, 225 - snap(hash(seg * 5 + n) * 60 + n * 6), 9, 3);
        ctx.fillStyle = INK;
        ctx.fillRect(x + 132, 114, 3, 120);
        ctx.fillRect(x + 132, 231, 84, 3);
        ctx.fillRect(x + 45, 174, 66, 3);
        ctx.fillRect(x + 45, 186, 48, 3);
        ctx.fillRect(x + 45, 198, 57, 3);
        break;
      }
      case 'charts':
        for (let f = 0; f < 2; f++) {
          const fx = x + 27 + f * 114;
          ctx.fillStyle = INK;
          ctx.fillRect(fx, 102, 96, 114);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(fx + 6, 108, 84, 102);
          if ((seg + f) % 2 === 0) {
            for (let b = 0; b < 5; b++) {
              const bh = 18 + snap(hash(seg * 13 + f * 5 + b) * 60);
              ctx.fillStyle = b === 3 ? '#e5484d' : accent ?? '#5fbf5a';
              ctx.fillRect(fx + 15 + b * 15, 201 - bh, 9, bh);
            }
          } else {
            ctx.fillStyle = '#e5484d';
            for (let n = 0; n < 9; n++) ctx.fillRect(fx + 12 + n * 8, 123 + n * 6 + snap(hash(seg * 3 + n) * 15), 9, 3);
            ctx.fillStyle = '#c9cdd9';
            for (let n = 0; n < 3; n++) ctx.fillRect(fx + 12, 132 + n * 24, 72, 3);
          }
        }
        break;
      case 'shelves': {
        const spines = o.spines ?? ['#2684ff', '#e5484d', '#5fbf5a', '#ffd166', '#8a8fa3'];
        ctx.fillStyle = '#3a2412';
        ctx.fillRect(x + 21, 72, 218, 345);
        for (let row = 0; row < 5; row++) {
          const sy = 81 + row * 66;
          ctx.fillStyle = '#1d1208';
          ctx.fillRect(x + 27, sy, 206, 57);
          let bx = x + 30;
          for (let n = 0; bx < x + 222; n++) {
            const r = hash(seg * 101 + row * 17 + n);
            const bw = 9 + (r > 0.6 ? 3 : 0);
            const bh = 39 + snap(hash(seg * 37 + row * 5 + n) * 15);
            if (r > 0.12) {
              ctx.fillStyle = spines[Math.floor(hash(seg * 3 + row * 29 + n * 7) * spines.length)];
              ctx.fillRect(bx, sy + 57 - bh, bw, bh);
              ctx.fillStyle = 'rgba(255,255,255,0.45)';
              ctx.fillRect(bx + 3, sy + 57 - bh + 9, bw - 6, 6);
            }
            bx += bw + 3;
          }
        }
        break;
      }
      case 'screens':
        for (let m = 0; m < 3; m++) {
          const mx = x + 15 + m * 80;
          const alert = o.alert && (seg + m) % 3 === 0;
          ctx.fillStyle = '#111118';
          ctx.fillRect(mx, 105, 72, 54);
          ctx.fillStyle = alert ? (calm || Math.floor(t * 3) % 2 ? '#8b1e2d' : '#e5484d') : '#16243a';
          ctx.fillRect(mx + 3, 108, 66, 48);
          ctx.fillStyle = alert ? '#ffffff' : accent ?? '#5fbf5a';
          if (alert) {
            ctx.fillRect(mx + 33, 114, 6, 24);
            ctx.fillRect(mx + 33, 144, 6, 6);
          } else if (m % 2) {
            for (let b = 0; b < 6; b++) {
              const bh = 6 + snap(hash(seg * 7 + m * 3 + b + (calm ? 0 : Math.floor(t * 0.7))) * 30);
              ctx.fillRect(mx + 9 + b * 9, 150 - bh, 6, bh);
            }
          } else for (let n = 0; n < 8; n++) ctx.fillRect(mx + 6 + n * 7, 141 - snap(hash(seg * 11 + m + n) * 24), 6, 3);
          ctx.fillStyle = '#111118';
          ctx.fillRect(mx + 30, 159, 12, 9);
        }
        // ticker strip
        ctx.fillStyle = '#111118';
        ctx.fillRect(x + 15, 186, 232, 15);
        ctx.fillStyle = accent ?? '#5fbf5a';
        for (let n = 0; n < 9; n++) ctx.fillRect(x + 15 + wrap(n * 27 - (calm ? 0 : t * 30), 222), 192, n % 3 === 0 ? 15 : 9, 3);
        break;
      case 'stage': {
        const cur = accent ?? '#8b1e2d';
        ctx.fillStyle = cur;
        ctx.fillRect(x, 39, WALL_SEG, 36);
        for (let n = 0; n < WALL_SEG; n += 26) {
          ctx.fillStyle = 'rgba(0,0,0,0.22)';
          ctx.fillRect(x + n, 39, 6, 36 + (n % 52 ? 9 : 0));
        }
        if (seg % 2 === 0) {
          // projector screen with a slide
          ctx.fillStyle = INK;
          ctx.fillRect(x + 42, 96, 176, 126);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x + 48, 102, 164, 114);
          ctx.fillStyle = cur;
          ctx.fillRect(x + 60, 114, 96, 9);
          ctx.fillStyle = '#8a8fa3';
          for (let n = 0; n < 4; n++) {
            ctx.fillRect(x + 60, 138 + n * 18, 6, 6);
            ctx.fillRect(x + 72, 138 + n * 18, 60 + snap(hash(seg + n) * 60), 6);
          }
        } else {
          ctx.fillStyle = cur;
          ctx.fillRect(x + 78, 75, 104, 330);
          for (let n = 0; n < 104; n += 26) {
            ctx.fillStyle = 'rgba(0,0,0,0.22)';
            ctx.fillRect(x + 78 + n, 75, 6, 330);
          }
        }
        break;
      }
      case 'bar': {
        const neon = accent ?? '#ff4fa3';
        // string lights
        for (let n = 0; n < 9; n++) {
          const on = calm || (Math.floor(t * 2) + n) % 3 !== 0;
          ctx.fillStyle = on ? ['#ffd166', '#ff4fa3', '#7fe0d8'][n % 3] : '#45485c';
          ctx.fillRect(x + 12 + n * 29, 45 + (n % 2) * 6, 6, 6);
        }
        // neon sign
        ctx.fillStyle = neon;
        ctx.fillRect(x + 66, 84, 128, 6);
        ctx.fillRect(x + 66, 126, 128, 6);
        ctx.fillRect(x + 66, 84, 6, 48);
        ctx.fillRect(x + 188, 84, 6, 48);
        for (let n = 0; n < 5; n++) ctx.fillRect(x + 84 + n * 21, 99 + (n % 2) * 6, 12, 18 - (n % 2) * 6);
        // bottle shelves
        for (let row = 0; row < 2; row++) {
          const sy = 204 + row * 72;
          ctx.fillStyle = '#1d1208';
          ctx.fillRect(x + 24, sy, 212, 9);
          for (let n = 0; n < 12; n++) {
            if (hash(seg * 19 + row * 7 + n) < 0.2) continue;
            const bh = 27 + snap(hash(seg * 5 + row + n * 3) * 15);
            ctx.fillStyle = ['#5fbf5a', '#c98a4b', '#bfe4ff', '#e5484d', '#ffd166'][Math.floor(hash(seg + row * 3 + n * 11) * 5)];
            ctx.fillRect(x + 33 + n * 17, sy - bh, 9, bh);
            ctx.fillRect(x + 36 + n * 17, sy - bh - 9, 3, 9);
          }
        }
        break;
      }
      case 'portraits': {
        const gold = accent ?? '#d4af37';
        ctx.fillStyle = o.trim;
        for (let n = 0; n < WALL_SEG; n += 65) ctx.fillRect(x + n, 33, 3, GROUND_Y - 48);
        for (let f = 0; f < 2; f++) {
          const fx = x + 33 + f * 114;
          ctx.fillStyle = gold;
          ctx.fillRect(fx, 96, 81, 105);
          ctx.fillStyle = ['#3d4a61', '#4f2e17', '#2f5d50'][(seg + f) % 3];
          ctx.fillRect(fx + 6, 102, 69, 93);
          ctx.fillStyle = '#f1c9a5';
          ctx.fillRect(fx + 27, 117, 27, 30);
          ctx.fillStyle = ['#c9cdd9', '#5a3a1e', '#111118'][(seg * 3 + f) % 3];
          ctx.fillRect(fx + 24, 111, 33, 9);
          ctx.fillStyle = '#111118';
          ctx.fillRect(fx + 15, 150, 51, 45);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(fx + 36, 150, 9, 18);
          ctx.fillStyle = gold;
          ctx.fillRect(fx + 21, 207, 39, 6);
        }
        break;
      }
      case 'crates': {
        ctx.fillStyle = '#2a52be';
        ctx.fillRect(x + 9, 60, 9, 365);
        ctx.fillRect(x + 242, 60, 9, 365);
        for (let row = 0; row < 3; row++) {
          const sy = 168 + row * 90;
          ctx.fillStyle = accent ?? '#f59e42';
          ctx.fillRect(x + 9, sy, 242, 9);
          let bx = x + 24;
          for (let n = 0; bx < x + 210; n++) {
            const bw = 36 + snap(hash(seg * 23 + row * 5 + n) * 24);
            const bh = 36 + snap(hash(seg * 7 + row * 11 + n) * 30);
            if (hash(seg * 3 + row * 13 + n) > 0.2 && bx + bw < x + 240) {
              ctx.fillStyle = '#c98a4b';
              ctx.fillRect(bx, sy - bh, bw, bh);
              ctx.fillStyle = '#8d5a2b';
              ctx.fillRect(bx, sy - bh, bw, 3);
              ctx.fillRect(bx + snap(bw / 2) - 3, sy - bh, 6, bh);
            }
            bx += bw + 9;
          }
        }
        break;
      }
      case 'reception': {
        // framed abstract painting and a wall lamp
        ctx.fillStyle = INK;
        ctx.fillRect(x + 39, 99, 126, 96);
        ctx.fillStyle = '#fff8e0';
        ctx.fillRect(x + 45, 105, 114, 84);
        const cols = [accent ?? '#f59e42', '#2684ff', '#5fbf5a', '#e5484d'];
        ctx.fillStyle = cols[seg % 4];
        ctx.fillRect(x + 54, 114, 45, 39);
        ctx.fillStyle = cols[(seg + 1) % 4];
        ctx.fillRect(x + 90, 135, 57, 45);
        ctx.fillStyle = cols[(seg + 2) % 4];
        ctx.fillRect(x + 114, 111, 30, 18);
        ctx.fillStyle = 'rgba(255,241,181,0.35)';
        ctx.fillRect(x + 189, 120, 48, 75);
        ctx.fillStyle = '#d4af37';
        ctx.fillRect(x + 207, 105, 12, 15);
        ctx.fillStyle = '#fff1b5';
        ctx.fillRect(x + 198, 120, 30, 18);
        break;
      }
      case 'cave': {
        // rough rock, stalactites, one ancient terminal still running
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        for (let n = 0; n < 9; n++) ctx.fillRect(x + snap(hash(seg * 13 + n) * 220), 60 + snap(hash(seg * 7 + n * 3) * 320), 30 + snap(hash(seg + n) * 36), 15);
        ctx.fillStyle = o.trim;
        for (let n = 0; n < 5; n++) {
          const sx = x + 15 + n * 52 + snap(hash(seg * 5 + n) * 18);
          const sh = 30 + snap(hash(seg * 11 + n) * 54);
          for (let dy = 0; dy < sh; dy += 6) ctx.fillRect(sx + snap((dy / sh) * 12), 33 + dy, Math.max(3, 27 - snap((dy / sh) * 24)), 6);
        }
        if (seg % 2 === 0) {
          ctx.fillStyle = '#c9b48f';
          ctx.fillRect(x + 150, 246, 66, 54);
          ctx.fillStyle = '#0b2014';
          ctx.fillRect(x + 156, 252, 54, 36);
          ctx.fillStyle = accent ?? '#5fbf5a';
          ctx.fillRect(x + 162, 258, 30, 3);
          ctx.fillRect(x + 162, 267, 21, 3);
          if (calm || Math.floor(t * 2) % 2) ctx.fillRect(x + 162, 276, 6, 6);
          ctx.fillStyle = '#8a7a5c';
          ctx.fillRect(x + 144, 300, 78, 9);
        }
        break;
      }
      case 'plan': {
        // project plan: staggered bars and a red "today" line
        ctx.fillStyle = '#8a8fa3';
        ctx.fillRect(x + 27, 93, 206, 150);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 33, 99, 194, 138);
        const cols = [accent ?? '#2684ff', '#5fbf5a', '#ffd166', '#f4a0b5'];
        for (let row = 0; row < 6; row++) {
          ctx.fillStyle = '#c9cdd9';
          ctx.fillRect(x + 39, 111 + row * 20, 30, 6);
          ctx.fillStyle = cols[row % 4];
          ctx.fillRect(x + 78 + row * 18 + snap(hash(seg * 5 + row) * 12), 108 + row * 20, 36 + snap(hash(seg * 3 + row) * 42), 12);
        }
        ctx.fillStyle = '#e5484d';
        ctx.fillRect(x + 150, 99, 3, 138);
        break;
      }
      default: {
        // window with a skyline
        ctx.fillStyle = o.trim;
        ctx.fillRect(x + 48, 87, 168, 192);
        ctx.fillStyle = o.win ?? '#9ad3ff';
        ctx.fillRect(x + 57, 96, 150, 174);
        ctx.fillStyle = o.city ?? '#6fa9d6';
        const hgt = [72, 117, 54, 96, 132, 78];
        hgt.forEach((bh, n) => ctx.fillRect(x + 57 + n * 25, 270 - bh, 22, bh));
        if (o.lit) {
          ctx.fillStyle = '#ffd166';
          hgt.forEach((bh, n) => {
            for (let k = 0; k < bh - 12; k += 18) if ((n * 5 + k) % 4 !== 1) ctx.fillRect(x + 63 + n * 25, 270 - bh + 9 + k, 3, 6);
          });
        }
        ctx.fillStyle = o.trim;
        ctx.fillRect(x + 129, 96, 6, 174);
      }
    }
  }

  // ---------- ground (world space) ----------
  function ground(state, scene) {
    const cam = state.camera;
    const start = Math.floor((cam.x - TILE) / TILE) * TILE;
    const end = cam.x + W + TILE;
    const pits = state.hazards.filter(isPit);
    const ices = state.hazards.filter((h) => h.type === 'ice');
    for (let x = start; x < end; x += TILE) {
      if (pits.some((p) => x >= p.x - 6 && x + TILE <= p.x + p.w + 6)) continue;
      const o = scene.stretches[stretchIndex(x)];
      const n = Math.round(x / TILE);
      if (o.kind === 'indoor') {
        ctx.fillStyle = o.floor;
        ctx.fillRect(x, GROUND_Y, TILE, 18);
        ctx.fillStyle = o.floorMark;
        ctx.fillRect(x + 6, GROUND_Y + 6, 18, 3);
        ctx.fillStyle = INK;
        ctx.fillRect(x, GROUND_Y + 18, TILE, 3);
        ctx.fillStyle = o.fill;
        ctx.fillRect(x, GROUND_Y + 21, TILE, H - GROUND_Y);
      } else if (o.ground.tiles) {
        const set = GROUND_SETS[o.ground.tiles] ?? GROUND_SETS.grass;
        sp.draw(n % 5 === 2 ? set[1] : set[0], x, GROUND_Y, { anchor: 'tl' });
        sp.draw(n % 7 === 3 ? 'groundFillAlt' : 'groundFill', x, GROUND_Y + TILE, { anchor: 'tl' });
        if (o.ground.tint) {
          ctx.fillStyle = o.ground.tint;
          ctx.fillRect(x, GROUND_Y, TILE, H - GROUND_Y);
        }
      } else {
        ctx.fillStyle = o.ground.top;
        ctx.fillRect(x, GROUND_Y, TILE, 18);
        ctx.fillStyle = o.ground.mark;
        ctx.fillRect(x + (n % 2 ? 6 : 27), GROUND_Y + 6, 18, 3);
        if (n % 3 === 0) ctx.fillRect(x + 36, GROUND_Y + 12, 9, 3);
        ctx.fillStyle = o.ground.fill;
        ctx.fillRect(x, GROUND_Y + 18, TILE, H - GROUND_Y);
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(x, GROUND_Y + 18, TILE, 3);
        if (n % 4 === 1) ctx.fillRect(x + 12, GROUND_Y + 45, 15, 6);
      }
      if (ices.some((h) => x >= h.anchorX - 10 && x + TILE <= h.anchorX + h.w + 10)) {
        ctx.fillStyle = 'rgba(190,230,255,0.75)';
        ctx.fillRect(x, GROUND_Y, TILE, 15);
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + 6, GROUND_Y + 3, 18, 3);
      }
    }
    for (const p of pits) {
      if (p.x + p.w < cam.x - 50 || p.x > cam.x + W + 50) continue;
      const o = scene.stretches[stretchIndex(p.x + p.w / 2)];
      const px = Math.round(p.x);
      const pw = Math.round(p.w);
      if (o.kind === 'indoor') {
        ctx.fillStyle = '#1d1f2b';
        ctx.fillRect(px, GROUND_Y, pw, H);
        ctx.fillStyle = '#45485c';
        ctx.fillRect(px, GROUND_Y, 6, H);
        ctx.fillRect(px + pw - 6, GROUND_Y, 6, H);
        // cables dangling into the void
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(px + 12, GROUND_Y, 3, 36);
        ctx.fillStyle = '#5fb3ff';
        ctx.fillRect(px + pw - 18, GROUND_Y, 3, 24);
      } else {
        const c = { ...DEFAULT_PIT, ...(o.pit ?? {}) };
        ctx.fillStyle = c.fill;
        ctx.fillRect(px, GROUND_Y, pw, H);
        ctx.fillStyle = c.edge;
        ctx.fillRect(px, GROUND_Y, 6, H);
        ctx.fillRect(px + pw - 6, GROUND_Y, 6, H);
        ctx.fillStyle = c.deep;
        ctx.fillRect(px + 6, GROUND_Y + 60, pw - 12, H);
      }
    }
  }

  // ---------- decor (world space) ----------
  function decor(state, scene) {
    const cam = state.camera;
    for (let x = 300; x < TABLE_X - 200; x += 260) {
      if (x < cam.x - 80 || x > cam.x + W + 80) continue;
      const list = scene.stretches[stretchIndex(x)].decor;
      if (!list?.length) continue;
      const h = (x * 2654435761) >>> 0;
      if (state.hazards.some((hz) => x > hz.anchorX - 90 && x < hz.anchorX + hz.w + 90)) continue;
      sp.draw(list[h % list.length], x + (h % 40), GROUND_Y + 2);
    }
  }

  // ---------- ambient effects (screen space, over the world) ----------
  function ambient(state, scene) {
    const kind = scene.stretches[stretchIndex(state.player.x)].ambient;
    if (!kind || kind === 'none') return;
    const VW = getVW();
    const calm = state.reducedMotion;
    const t = state.t;
    const cx = state.camera.x;
    const px = (n, speed, drag = 0.3) => wrap(hash(n * 3 + 1) * VW + t * speed - cx * drag, VW + 60) - 30;
    const py = (n, speed, span = H) => wrap(hash(n * 7 + 2) * span + t * speed, span);
    const dot = (x, y, w, h) => ctx.fillRect(snap(x), snap(y), w, h);
    const count = (n) => (calm ? Math.ceil(n / 2) : n);
    ctx.save();
    switch (kind) {
      case 'snow':
        ctx.fillStyle = '#ffffff';
        for (let n = 0; n < count(36); n++) dot(px(n, -20) + Math.sin(t * 1.5 + n) * 9, py(n, 60 + (n % 4) * 16, GROUND_Y + 20), n % 3 ? 3 : 6, n % 3 ? 3 : 6);
        break;
      case 'rain':
      case 'storm':
        ctx.fillStyle = 'rgba(159,212,255,0.8)';
        for (let n = 0; n < count(40); n++) dot(px(n, -150, 0.5), py(n, 520 + (n % 3) * 60, GROUND_Y + 10), 3, 12);
        if (kind === 'storm' && !calm) {
          const k = wrap(t, 5.5);
          if (k < 0.1 || (k > 0.18 && k < 0.24)) {
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.fillRect(0, 0, VW, H);
            ctx.fillStyle = '#fff1b5';
            let bx = snap(VW * (0.25 + 0.5 * hash(Math.floor(t / 5.5))));
            for (let y = 0; y < 240; y += 24) {
              const nx = bx + (hash(y + Math.floor(t / 5.5) * 7) > 0.5 ? 12 : -12);
              ctx.fillRect(Math.min(bx, nx), y, Math.abs(nx - bx) + 6, 6);
              ctx.fillRect(nx, y, 6, 24);
              bx = nx;
            }
          }
        }
        break;
      case 'leaves': {
        const cols = ['#f59e42', '#c96a1b', '#ffd166'];
        for (let n = 0; n < count(14); n++) {
          ctx.fillStyle = cols[n % 3];
          dot(px(n, -70) + Math.sin(t * 2 + n) * 12, py(n, 50 + (n % 3) * 14, GROUND_Y), Math.floor(t * 4 + n) % 2 ? 6 : 3, Math.floor(t * 4 + n) % 2 ? 3 : 6);
        }
        break;
      }
      case 'petals': {
        const cols = ['#ffd3df', '#f4a0b5', '#ffffff'];
        for (let n = 0; n < count(12); n++) {
          ctx.fillStyle = cols[n % 3];
          dot(px(n, -40) + Math.sin(t * 1.4 + n * 2) * 15, py(n, 34 + (n % 3) * 9, GROUND_Y), n % 2 ? 6 : 3, 3);
        }
        break;
      }
      case 'embers': {
        const cols = ['#ffd166', '#f59e42', '#e5484d'];
        for (let n = 0; n < count(16); n++) {
          ctx.fillStyle = cols[n % 3];
          ctx.globalAlpha = calm ? 0.8 : 0.5 + 0.5 * Math.sin(t * 6 + n);
          dot(px(n, -30) + Math.sin(t * 2 + n) * 9, GROUND_Y - py(n, 60 + (n % 3) * 20, GROUND_Y - 40), 3, 3);
        }
        break;
      }
      case 'fireflies':
        ctx.fillStyle = '#fff1b5';
        for (let n = 0; n < count(12); n++) {
          if (!calm && Math.sin(t * 2.2 + n * 1.7) < -0.2) continue; // blink
          dot(px(n, -12, 0.2) + Math.sin(t * 0.9 + n) * 24, 210 + hash(n * 5) * 200 + Math.cos(t * 1.1 + n * 2) * 15, 3, 3);
        }
        break;
      case 'bats':
        ctx.fillStyle = '#1b1730';
        for (let n = 0; n < count(6); n++) {
          const x = px(n, -170 - (n % 3) * 30, 0.1);
          const y = 70 + hash(n * 9) * 170 + Math.sin(t * 3 + n * 2) * 18;
          const up = Math.floor(t * 9 + n) % 2 ? -3 : 3;
          dot(x, y, 6, 6);
          dot(x - 9, y + up, 9, 3);
          dot(x + 6, y + up, 9, 3);
        }
        break;
      case 'spray':
        for (let n = 0; n < count(14); n++) {
          ctx.fillStyle = n % 2 ? '#ffffff' : '#bfe4ff';
          const ph = wrap(t * 0.8 + hash(n * 3), 1);
          dot(px(n, -20, 0.6), GROUND_Y - 12 - Math.sin(ph * Math.PI) * (30 + (n % 4) * 18), 3, 3);
        }
        break;
      case 'fog':
        for (let n = 0; n < 5; n++) {
          ctx.fillStyle = `rgba(255,255,255,${0.07 + (n % 2) * 0.05})`;
          ctx.fillRect(snap(wrap(hash(n * 5) * VW + (calm ? 0 : t * (8 + n * 4)) - cx * 0.2, VW + 360) - 360), 270 + n * 33, 360, 24);
        }
        break;
      case 'paper':
        ctx.fillStyle = '#ffffff';
        for (let n = 0; n < count(5); n++) {
          const flat = Math.floor(t * 3 + n) % 2;
          dot(px(n, -50, 0.4) + Math.sin(t * 1.6 + n * 2) * 18, py(n, 38 + n * 6, GROUND_Y), flat ? 12 : 9, flat ? 6 : 12);
        }
        break;
      case 'sparks':
        ctx.fillStyle = '#ffd166';
        for (let n = 0; n < count(10); n++) {
          const ph = wrap(t * 1.3 + hash(n * 3) * 7, 1);
          if (ph > 0.18) continue;
          const slot = Math.floor(t * 1.3 + hash(n * 3) * 7);
          const x = hash(n * 31 + slot) * VW;
          const y = 90 + hash(n * 17 + slot * 3) * 230;
          dot(x, y + ph * 60, 3, 3);
          dot(x + 6, y + ph * 90, 3, 3);
          dot(x - 6, y + ph * 75, 3, 3);
        }
        break;
      case 'dust':
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        for (let n = 0; n < count(16); n++) dot(px(n, -6, 0.15) + Math.sin(t * 0.6 + n) * 9, py(n, 7, GROUND_Y - 20) + 10, 3, 3);
        break;
      case 'aurora': {
        const cols = ['rgba(95,255,170,0.16)', 'rgba(120,180,255,0.13)', 'rgba(190,120,255,0.11)'];
        const tt = calm ? 0 : t;
        cols.forEach((c, j) => {
          ctx.fillStyle = c;
          for (let x = 0; x < VW; x += 12) {
            const y = 54 + j * 21 + Math.sin(x / 90 + tt * 0.4 + j * 2) * 27;
            const h = 60 + Math.sin(x / 47 + tt * 0.7 + j) * 30;
            ctx.fillRect(x, snap(y), 12, snap(h));
          }
        });
        break;
      }
      case 'notes': {
        const cols = ['#ff4fa3', '#ffd166', '#7fe0d8'];
        for (let n = 0; n < count(8); n++) {
          ctx.fillStyle = cols[n % 3];
          const x = px(n, -14, 0.2) + Math.sin(t * 1.3 + n * 2) * 15;
          const y = GROUND_Y - 60 - py(n, 44 + (n % 3) * 10, GROUND_Y - 110);
          dot(x, y, 6, 6);
          dot(x + 6, y - 12, 3, 15);
          dot(x + 6, y - 12, 9, 3);
        }
        break;
      }
      default:
        break;
    }
    ctx.restore();
  }

  return { sky, layers, walls, ground, decor, ambient };
}
