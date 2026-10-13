// Canvas renderer, pixel-art edition. World drawing uses Kenney CC0 sprites and hand-pixeled art
// (src/sprites.js, src/pixelart.js) at PIXEL_SCALE. No emoji anywhere.

import { W, H, GROUND_Y, TABLE_X, PX_PER_M, COURSE_M, PHASE, BASE_SPEED, BLACKOUT, progress, isPit, biomeAt, pendulumBall } from './game.js';
import { createSpriteDrawer, PIXEL_SCALE, SHEETS, SPRITES } from './sprites.js';

export const FONT = '"Press Start 2P", "Courier New", monospace';
const INK = '#2b2b3a';
const TILE = 18 * PIXEL_SCALE; // 54
const BG_TILE = 24 * PIXEL_SCALE; // 72

export function createRenderer(canvas, images, pixelSprites) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const sp = createSpriteDrawer(ctx, images, pixelSprites);

  // ---------- helpers exposed to endings ----------
  const g = {
    ctx,
    sprite: sp.draw,
    size: sp.size,
    text(str, x, y, { size = 12, color = INK, align = 'center', shadow = null } = {}) {
      ctx.save();
      ctx.font = `${size}px ${FONT}`;
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';
      if (shadow) {
        ctx.fillStyle = shadow;
        ctx.fillText(str, x + 2, y + 2);
      }
      ctx.fillStyle = color;
      ctx.fillText(str, x, y);
      ctx.restore();
    },
    bubble(text, x, y) {
      if (!text) return;
      ctx.save();
      ctx.font = `10px ${FONT}`;
      const w = Math.ceil((ctx.measureText(text).width + 20) / 3) * 3;
      const h = 27;
      const bx = Math.round((x - w / 2) / 3) * 3;
      const by = Math.round((y - h - 12) / 3) * 3;
      ctx.fillStyle = INK;
      ctx.fillRect(bx - 3, by - 3, w + 6, h + 6);
      ctx.fillStyle = '#fff';
      ctx.fillRect(bx, by, w, h);
      // tail
      ctx.fillStyle = INK;
      ctx.fillRect(x - 6, by + h, 12, 3);
      ctx.fillRect(x - 3, by + h + 3, 6, 3);
      ctx.fillRect(x - 3, by + h + 6, 3, 3);
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - 3, by + h, 6, 3);
      ctx.fillStyle = INK;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, bx + w / 2, by + h / 2 + 1);
      ctx.restore();
    },
    // 9-slice panel from the UI sheet (border 6 source px)
    panel(x, y, w, h, name = 'panelBeige') {
      const src = sp.source(name);
      if (!src.img) return;
      const b = 6;
      const B = b * PIXEL_SCALE;
      const img = src.img;
      const sx = src.sx;
      const sy = src.sy;
      const t = src.sw;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      const X = Math.round(x);
      const Y = Math.round(y);
      const dw = Math.max(0, w - 2 * B);
      const dh = Math.max(0, h - 2 * B);
      // corners
      ctx.drawImage(img, sx, sy, b, b, X, Y, B, B);
      ctx.drawImage(img, sx + t - b, sy, b, b, X + w - B, Y, B, B);
      ctx.drawImage(img, sx, sy + t - b, b, b, X, Y + h - B, B, B);
      ctx.drawImage(img, sx + t - b, sy + t - b, b, b, X + w - B, Y + h - B, B, B);
      // edges
      ctx.drawImage(img, sx + b, sy, t - 2 * b, b, X + B, Y, dw, B);
      ctx.drawImage(img, sx + b, sy + t - b, t - 2 * b, b, X + B, Y + h - B, dw, B);
      ctx.drawImage(img, sx, sy + b, b, t - 2 * b, X, Y + B, B, dh);
      ctx.drawImage(img, sx + t - b, sy + b, b, t - 2 * b, X + w - B, Y + B, B, dh);
      // centre
      ctx.drawImage(img, sx + b, sy + b, t - 2 * b, t - 2 * b, X + B, Y + B, dw, dh);
      ctx.restore();
    },
    lace(x, y) {
      ctx.save();
      ctx.fillStyle = '#f5f5f5';
      const pts = [
        [0, -6],
        [3, -3],
        [6, -3],
        [9, 0],
        [12, 0],
        [15, -3],
        [18, 0],
        [21, 3],
        [24, 0],
      ];
      for (const [dx, dy] of pts) ctx.fillRect(x + dx, y + dy - 3, 3, 3);
      ctx.restore();
    },
    sign(x, y, label) {
      sp.draw('signPost', x, y);
      g.panel(x - 90, y - 150, 180, 42, 'panelBeige');
      g.text(label, x, y - 129, { size: 10 });
      sp.draw('balloon', x + 100, y - 100);
      sp.draw('balloon', x + 118, y - 112);
    },
    // Legacy shim so any leftover emoji call still renders a sprite.
    emoji(char, x, y, size = 32) {
      const map = { '🎂': 'cake', '🐦': 'pigeon', '🐈': 'cat', '🍌': 'banana', '🐕': 'dog', '🕴️': 'repoman', '👮': 'referee', '⏰': 'clock', '🎈': 'balloon', '🧒': 'kid', '🐖': 'pig', '🛹': 'skate' };
      const name = map[char];
      if (name) sp.draw(name, x, y, { scale: size > 40 ? 1 : 0.8 });
    },
  };

  // ---------- main draw ----------
  function draw(state, hud) {
    const cam = state.camera;
    ctx.clearRect(0, 0, W, H);
    drawSky(state);

    const z = cam.zoom || 1;
    const fx = cam.x + W / 2;
    const fy = cam.focusY ?? H / 2;
    const sx = cam.shake ? Math.round((state.rng() - 0.5) * cam.shake * 14 / 3) * 3 : 0;
    const sy = cam.shake ? Math.round((state.rng() - 0.5) * cam.shake * 10 / 3) * 3 : 0;

    ctx.save();
    ctx.translate(W / 2 + sx, H / 2 + sy);
    ctx.scale(z, z);
    ctx.translate(-Math.round(fx), -Math.round(fy));

    const biome = biomeAt(state.player.x);
    ctx.globalAlpha = biome === 'night' ? 0.35 : 0.75;
    drawParallax(state, 0.15, 'bgFar', 'bgFarB', 'bgFarFill', GROUND_Y - BG_TILE * 2 - 30);
    ctx.globalAlpha = biome === 'night' ? 0.5 : 1;
    if (biome === 'desert') drawParallax(state, 0.4, 'bgDesert', 'bgDesertB', 'bgDesertFill', GROUND_Y - BG_TILE - 20);
    else if (biome === 'snow') drawParallax(state, 0.4, 'bgFar', 'bgFarB', 'bgFarFill', GROUND_Y - BG_TILE - 20);
    else drawParallax(state, 0.4, 'bgHills', 'bgHillsB', 'bgFill', GROUND_Y - BG_TILE - 20);
    ctx.globalAlpha = 1;
    drawClouds(state);
    drawGround(state);
    drawDecor(state);
    for (const h of state.hazards) drawHazard(h, state);
    drawTable(state);
    drawKid(state);
    drawPlayer(state);
    drawCake(state);
    for (const f of state.fx) drawParticle(f);
    if (state.ending && state.ending.def.drawWorld) state.ending.def.drawWorld(g, state);
    ctx.restore();

    if (state.dark > 0) drawBlackout(state);
    if (state.phase === PHASE.RUNNING) {
      drawOffscreenPig(state);
      drawSpeedLines(state);
      drawWind(state);
    }
    if (state.phase === PHASE.WIN) drawWin(state);
    drawOverlay(state);
    if (state.ending && state.ending.def.drawScreen) state.ending.def.drawScreen(g, state);
    drawHud(state, hud);
  }

  const SKIES = {
    meadow: ['#5fb3ff', '#6fbcff', '#82c6ff', '#9ad3ff', '#b6e1ff', '#d2eeff'],
    desert: ['#ffb26b', '#ffbe7d', '#ffc98f', '#ffd6a4', '#ffe2ba', '#ffecd0'],
    snow: ['#9fc4e8', '#aecef0', '#bdd8f4', '#cde2f8', '#dcebfb', '#eaf3fd'],
    night: ['#0b1030', '#101640', '#171d4f', '#1e255d', '#262d6b', '#303878'],
  };
  function drawSky(state) {
    const bands = SKIES[biomeAt(state.player.x)] ?? SKIES.meadow;
    const bh = Math.ceil(H / bands.length / 3) * 3;
    bands.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(0, i * bh, W, bh + 3);
    });
    const biome = biomeAt(state.player.x);
    if (biome === 'night') {
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 40; i++) ctx.fillRect(((i * 193) % W), ((i * 89) % 260) + 10, 3, 3);
      ctx.fillStyle = '#fff1b5';
      ctx.fillRect(W - 150, 54, 42, 42);
      ctx.fillStyle = SKIES.night[0];
      ctx.fillRect(W - 138, 48, 36, 36);
      return;
    }
    // sun
    ctx.fillStyle = '#fff1b5';
    ctx.fillRect(W - 150, 54, biome === 'desert' ? 72 : 54, biome === 'desert' ? 72 : 54);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(W - 144, 60, biome === 'desert' ? 60 : 42, biome === 'desert' ? 60 : 42);
  }

  function drawParallax(state, factor, a, b, fill, topY) {
    const cam = state.camera;
    const offset = cam.x * (1 - factor);
    const startX = Math.floor((cam.x - offset - BG_TILE) / BG_TILE) * BG_TILE + offset;
    for (let x = startX; x < cam.x + W + BG_TILE * 2; x += BG_TILE) {
      const i = Math.round((x - offset) / BG_TILE);
      sp.draw(i % 2 ? a : b, x, topY, { anchor: 'tl' });
      for (let y = topY + BG_TILE; y < GROUND_Y + 10; y += BG_TILE) sp.draw(fill, x, y, { anchor: 'tl' });
    }
  }

  function drawClouds(state) {
    const cam = state.camera;
    const factor = 0.3;
    for (let i = 0; i < 12; i++) {
      const wx = i * 520 + (i % 3) * 90 - cam.x * (1 - factor);
      const wy = 70 + (i % 4) * 34;
      if (wx + 60 < cam.x - 100 || wx > cam.x + W + 100) continue;
      sp.draw('cloudWhite', wx, wy, { anchor: 'tl', scale: i % 2 ? 1 : 1.5 });
    }
  }

  function drawGround(state) {
    const cam = state.camera;
    const start = Math.floor((cam.x - TILE) / TILE) * TILE;
    const end = cam.x + W + TILE;
    const pits = state.hazards.filter(isPit);
    for (let x = start; x < end; x += TILE) {
      const pit = pits.find((p) => x >= p.x - 6 && x + TILE <= p.x + p.w + 6);
      if (pit) continue;
      const i = Math.round(x / TILE);
      const b = biomeAt(x);
      const top = b === 'desert' ? (i % 5 === 2 ? 'groundTopSandAlt' : 'groundTopSand') : b === 'snow' ? (i % 5 === 2 ? 'groundTopSnowAlt' : 'groundTopSnow') : i % 5 === 2 ? 'groundTopAlt' : 'groundTop';
      const ice = state.hazards.find((h) => h.type === 'ice' && x >= h.anchorX - 10 && x + TILE <= h.anchorX + h.w + 10);
      sp.draw(top, x, GROUND_Y, { anchor: 'tl' });
      if (ice) {
        ctx.fillStyle = 'rgba(190,230,255,0.75)';
        ctx.fillRect(x, GROUND_Y, TILE, 15);
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + 6, GROUND_Y + 3, 18, 3);
      }
      sp.draw(i % 7 === 3 ? 'groundFillAlt' : 'groundFill', x, GROUND_Y + TILE, { anchor: 'tl' });
    }
    for (const p of pits) {
      if (p.x + p.w < cam.x - 50 || p.x > cam.x + W + 50) continue;
      ctx.fillStyle = '#3a2412';
      ctx.fillRect(Math.round(p.x), GROUND_Y, Math.round(p.w), H);
      ctx.fillStyle = '#5a3a1e';
      ctx.fillRect(Math.round(p.x), GROUND_Y, 6, H);
      ctx.fillRect(Math.round(p.x + p.w) - 6, GROUND_Y, 6, H);
      ctx.fillStyle = '#1d1208';
      ctx.fillRect(Math.round(p.x) + 6, GROUND_Y + 60, Math.round(p.w) - 12, H);
    }
  }

  const DECOR = {
    meadow: ['sprout', 'bush', 'mushroom', 'sunflower', 'treeRound', 'hay', 'pine'],
    desert: ['cactus', 'cactusTall', 'cactus', 'tumbleweed', 'barrel'],
    snow: ['pine', 'snowman', 'pine', 'sprout'],
    night: ['lantern', 'bush', 'lantern', 'pine'],
  };
  function drawDecor(state) {
    const cam = state.camera;
    for (let x = 300; x < TABLE_X - 200; x += 260) {
      if (x < cam.x - 80 || x > cam.x + W + 80) continue;
      const h = (x * 2654435761) >>> 0;
      const list = DECOR[biomeAt(x)] ?? DECOR.meadow;
      const name = list[h % list.length];
      const near = state.hazards.some((hz) => x > hz.anchorX - 90 && x < hz.anchorX + hz.w + 90);
      if (near) continue;
      sp.draw(name, x + (h % 40), GROUND_Y + 2);
    }
  }

  function drawHazard(h, state) {
    if (!h.visible) return;
    const y = GROUND_Y;
    const cx = h.x + h.w / 2;
    switch (h.type) {
      case 'fence':
        sp.draw('fence', cx, y + 2);
        break;
      case 'wall':
        if (biomeAt(h.anchorX) === 'desert') {
          // a giant cactus in the desert
          sp.draw('cactusTall', cx, y + 2);
          sp.draw('cactusTall', cx, y + 2 - TILE);
          sp.draw('cactus', cx, y + 2 - TILE * 2);
        } else {
          sp.draw('crate', cx, y + 2);
          sp.draw('crate', cx, y + 2 - TILE);
          sp.draw('crate', cx, y + 2 - TILE * 2);
          sp.draw('flagTop', cx, y + 2 - TILE * 3);
        }
        break;
      case 'puddle': {
        // Always a dark, raining cloud so it never reads as scenery; the puddle fills in as you approach.
        const ax = h.anchorX + 40;
        sp.draw('cloudDark', ax, y - 96, { scale: 1.5 });
        ctx.fillStyle = '#5fb3ff';
        for (let i = 0; i < 7; i++) {
          const rx = ax - 33 + i * 11;
          const ry = y - 92 + ((state.t * 300 + i * 37) % 86);
          ctx.fillRect(Math.round(rx / 3) * 3, Math.round(ry / 3) * 3, 3, 9);
        }
        if (h.w <= 0) {
          // damp patch marker before the puddle forms
          ctx.fillStyle = '#7fb0d8';
          ctx.fillRect(Math.round((ax - 24) / 3) * 3, y - 3, 48, 3);
        }
        if (h.w > 0) drawPuddle(h.anchorX + 40, y, h.w);
        break;
      }
      case 'dog':
        sp.draw('dog', cx, y + 2, { flip: false });
        if (h.state === 'active') {
          ctx.fillStyle = 'rgba(141,90,43,0.35)';
          ctx.fillRect(Math.round(h.x + h.w + 6), y - 6, 18, 6);
        }
        if (h.warn) g.bubble(h.warn, cx, y - 52);
        break;
      case 'skate':
        if (biomeAt(h.anchorX) === 'desert') sp.draw('tumbleweed', cx, y + 2 - Math.abs(Math.sin(state.t * 9)) * 10, { rot: -state.t * 6, anchor: 'c' });
        else sp.draw('skate', cx, y + 2);
        break;
      case 'pigeon': {
        // perch pole stays at the anchor
        ctx.fillStyle = INK;
        ctx.fillRect(Math.round(h.anchorX + h.w / 2) - 3, y - 150, 6, 150);
        ctx.fillStyle = '#8d5a2b';
        ctx.fillRect(Math.round(h.anchorX + h.w / 2) - 18, y - 153, 36, 6);
        const frame = h.state === 'active' ? Math.floor(state.t * 12) % 3 : 0;
        sp.draw('pigeon', cx, h.y + 6, { frame, flip: h.state === 'active' });
        if (h.state === 'active' && h.phase !== 'away') {
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.fillRect(Math.round(cx) - 15, y - 3, 30, 4);
        }
        if (h.warn) g.bubble(h.warn, cx, h.y - 42);
        break;
      }
      case 'bee': {
        const frame = Math.floor(state.t * 14) % 2;
        sp.draw('bee', cx, h.y + 6, { frame, flip: h.state === 'active', scale: 1.4 });
        // shadow on the ground marks the no-jump zone
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(Math.round(cx) - 21, y - 3, 42, 4);
        break;
      }
      case 'meteor': {
        if (h.state === 'idle') break;
        // shadow grows as the crate falls
        const k = h.state === 'falling' ? Math.min(1, h.t / 1.0) : 1;
        ctx.fillStyle = `rgba(0,0,0,${0.15 + 0.25 * k})`;
        const sw = Math.round((20 + 40 * k) / 3) * 3;
        ctx.fillRect(Math.round(cx) - sw / 2, y - 4, sw, 5);
        if (h.state === 'falling') sp.draw('crate', cx, h.y + 54, { rot: 0.2 * Math.sin(state.t * 10) });
        else sp.draw('crate', cx, y + 2);
        if (h.state === 'falling') g.bubble('!', cx, y - 70);
        break;
      }
      case 'crack': {
        if (h.state === 'idle') break;
        if (h.state === 'warn') {
          ctx.fillStyle = INK;
          const shake = Math.round(Math.sin(state.t * 60) * 3);
          for (let i = 0; i < 5; i++) ctx.fillRect(Math.round(h.anchorX + 10 + i * 26) + shake, y - 2 - (i % 2) * 3, 12, 3);
          ctx.fillRect(Math.round(h.anchorX + 30) + shake, y - 8, 3, 6);
          ctx.fillRect(Math.round(h.anchorX + 90) - shake, y - 10, 3, 8);
        }
        break;
      }
      case 'peel': {
        if (h.state === 'idle' || h.state === 'used') break;
        sp.draw('banana', cx, y + 2, { flip: h.state === 'sliding' && Math.floor(state.t * 10) % 2 === 0 });
        break;
      }
      case 'beam': {
        const top = y - 74 - 18;
        // posts
        ctx.fillStyle = INK;
        ctx.fillRect(Math.round(h.x) - 9, top, 15, 92);
        ctx.fillRect(Math.round(h.x + h.w) - 6, top, 15, 92);
        ctx.fillStyle = '#8d5a2b';
        ctx.fillRect(Math.round(h.x) - 6, top + 3, 9, 86);
        ctx.fillRect(Math.round(h.x + h.w) - 3, top + 3, 9, 86);
        // beam
        ctx.fillStyle = INK;
        ctx.fillRect(Math.round(h.x) - 9, top - 3, Math.round(h.w) + 18, 24);
        ctx.fillStyle = '#c98a4b';
        ctx.fillRect(Math.round(h.x) - 6, top, Math.round(h.w) + 12, 18);
        ctx.fillStyle = '#8d5a2b';
        for (let px = Math.round(h.x); px < h.x + h.w; px += 54) ctx.fillRect(px, top + 3, 3, 12);
        g.text('MIND YOUR HEAD', h.x + h.w / 2, top - 16, { size: 8, color: INK });
        break;
      }
      case 'cow':
        sp.draw('cow', cx, y + 2, { scale: 2.7 });
        if (h.warn) g.bubble(h.warn, cx, y - 136);
        break;
      case 'chick':
        sp.draw('chicken', cx, y + 2 - Math.abs(Math.sin(state.t * 16 + h.anchorX)) * 6);
        if (h.warn) g.bubble(h.warn, cx, y - 46);
        break;
      case 'slime': {
        const frame = h.phase === 'squash' ? 2 : h.phase === 'up' ? 1 : Math.floor(state.t * 4) % 2;
        sp.draw('slime', cx, h.y + 6, { frame });
        if (h.phase !== 'down') {
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.fillRect(Math.round(cx) - 18, y - 3, 36, 4);
        }
        break;
      }
      case 'snake':
        sp.draw('snake', cx, y + 2, { scale: 2.2, flip: Math.floor(state.t * 6) % 2 === 0 && false });
        if (h.warn) g.bubble(h.warn, cx, y - 36);
        break;
      case 'mole':
        sp.draw('mound', cx, y + 2);
        if (h.state === 'spray') {
          ctx.fillStyle = '#8d5a2b';
          for (let i = 0; i < 5; i++) ctx.fillRect(Math.round(cx - 24 + i * 12), y - 20 - ((state.t * 200 + i * 13) % 30), 3, 6);
        }
        if (h.popped) sp.draw('mole', cx, y + 2);
        if (h.warn) g.bubble(h.warn, cx, y - 50);
        break;
      case 'bro':
        sp.draw('repoman', cx, y + 2, { flip: false });
        sp.draw('phone', cx - 28, y - 30, { scale: 0.8 });
        if (h.warn) g.bubble(h.warn, cx, y - 76);
        break;
      case 'pendulum': {
        const b = pendulumBall(h, state.t);
        const pivotY = y - 120;
        ctx.fillStyle = INK;
        ctx.fillRect(Math.round(h.anchorX) - 24, pivotY - 9, 48, 9);
        ctx.fillRect(Math.round(h.anchorX) - 3, pivotY - 90, 6, 90);
        // chain
        ctx.fillStyle = '#8a8fa3';
        const links = 10;
        for (let i = 0; i < links; i++) {
          const k = i / links;
          ctx.fillRect(Math.round(h.anchorX + (b.x - h.anchorX) * k) - 3, Math.round(pivotY + (b.y - pivotY) * k) - 3, 6, 6);
        }
        sp.draw('spikeBall', b.x, b.y + 24, { rot: b.theta * 0.5 });
        break;
      }
      case 'trampoline':
        sp.draw('spring', cx, y + 2, { scale: h.state === 'used' ? 0.8 : 1 });
        break;
      case 'egg':
      case 'knife': {
        if (h.state === 'idle') break;
        const k = h.state === 'falling' ? Math.min(1, h.t / (h.type === 'egg' ? 0.6 : 0.45)) : 1;
        if (h.state === 'falling') {
          ctx.fillStyle = `rgba(0,0,0,${0.15 + 0.25 * k})`;
          const sw = Math.round((12 + 24 * k) / 3) * 3;
          ctx.fillRect(Math.round(cx) - sw / 2, y - 4, sw, 5);
          if (h.type === 'knife') {
            ctx.fillStyle = '#fff';
            ctx.fillRect(Math.round(cx) - 1, y - 150 - Math.round(((state.t * 400) % 90)), 3, 12);
          }
          sp.draw(h.type === 'egg' ? 'egg' : 'knife', cx, h.y + 20);
        } else if (h.state === 'landed') {
          sp.draw('knife', cx, y + 18);
        }
        break;
      }
      case 'wind': {
        // a few leaves on the ground mark the gusty stretch before you reach it
        if (h.state === 'done') break;
        ctx.fillStyle = h.dir < 0 ? '#5fbf5a' : '#ffd166';
        for (let i = 0; i < 6; i++) ctx.fillRect(Math.round((h.anchorX + 40 + i * (h.w / 6)) / 3) * 3, y - 6 - (i % 2) * 3, 9, 3);
        break;
      }
      case 'pig': {
        if (h.state !== 'active' && h.state !== 'done') break;
        const bob = Math.abs(Math.sin(state.t * 24)) * 4;
        sp.draw('pig', cx, y + 2 - bob, { flip: true });
        ctx.fillStyle = 'rgba(141,90,43,0.35)';
        for (let i = 0; i < 3; i++) ctx.fillRect(Math.round(h.x - 12 - i * 15), y - 6 - (i % 2) * 6, 12, 6);
        if (h.warn) g.bubble(h.warn, cx, y - 50);
        break;
      }
      default:
        break;
    }
  }

  function drawPuddle(cx, y, w) {
    // pixel-stepped ellipse
    const rows = [
      [0.55, '#9fd4ff'],
      [0.9, '#3f8dd8'],
      [1.0, '#3f8dd8'],
      [0.8, '#2d6fb5'],
    ];
    rows.forEach(([k, c], i) => {
      ctx.fillStyle = c;
      const rw = Math.round((w * k) / 6) * 6;
      ctx.fillRect(Math.round((cx - rw / 2) / 3) * 3, y - 3 + i * 3, rw, 3);
    });
  }

  // Edge indicator for a pig that is still off-screen behind the player.
  function drawOffscreenPig(state) {
    const pig = state.hazards.find((h) => h.type === 'pig' && h.state === 'active');
    if (!pig || pig.x + pig.w > state.camera.x) return;
    g.panel(12, GROUND_Y - 96, 150, 48, 'panelDark');
    g.text('< OINK', 87, GROUND_Y - 72, { size: 12, color: '#fff' });
  }

  function drawBlackout(state) {
    const d = state.dark;
    const p = state.player;
    const cam = state.camera;
    const px = Math.round((p.x - cam.x) * (cam.zoom || 1) + (W / 2 - W / 2 * (cam.zoom || 1)));
    const py = Math.round(p.y - 30);
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.97 * d})`;
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    if (d >= 1) {
      const r = BLACKOUT.spot;
      ctx.moveTo(px + r, py);
      ctx.arc(px, py, r, 0, Math.PI * 2, true);
    }
    ctx.fill('evenodd');
    if (d >= 1) g.text('WHO TURNED OFF THE LIGHTS', W / 2, 60, { size: 10, color: '#fff' });
    ctx.restore();
  }

  function drawWind(state) {
    const w = state.wind;
    if (w.t <= 0) return;
    const dir = w.mult < 1 ? -1 : 1;
    ctx.fillStyle = dir < 0 ? '#5fbf5a' : '#ffd166';
    for (let i = 0; i < 14; i++) {
      const y = 90 + ((i * 131) % 330);
      const x = (((i * 173 + state.t * 700 * dir) % W) + W) % W;
      ctx.fillRect(Math.round(x / 3) * 3, Math.round(y / 3) * 3 + Math.round(Math.sin(state.t * 8 + i) * 6), 9, 3);
    }
    g.text(dir < 0 ? '<< HEADWIND' : 'TAILWIND >>', W / 2, 100, { size: 14, color: dir < 0 ? '#5fbf5a' : '#ffd166', shadow: INK });
  }

  function drawWin(state) {
    const k = Math.min(1, state.winT / 0.6);
    g.text('CAKE DELIVERED!', W / 2, H / 2 - 60 - (1 - k) * 40, { size: 32, color: '#ffd166', shadow: INK });
    if (state.winT > 1.2) g.text('YOU ACTUALLY MADE IT', W / 2, H / 2 - 10, { size: 12, color: '#fff', shadow: INK });
  }

  function drawSpeedLines(state) {
    const k = state.speed / BASE_SPEED;
    if (k < 1.22) return;
    const n = Math.floor((k - 1.2) * 20);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < n; i++) {
      const y = 60 + ((i * 97 + Math.floor(state.t * 60) * 13) % 340);
      const x = ((i * 211 - state.t * 900) % W + W) % W;
      ctx.fillRect(Math.round(x / 3) * 3, Math.round(y / 3) * 3, 60 + (i % 3) * 24, 3);
    }
  }

  function drawTable(state) {
    const t = state.table;
    if (!t.visible) return;
    const cx = t.x + 70;
    sp.draw(t.collapsed ? 'tableBroken' : 'table', cx, t.y + 2);
    if (!t.collapsed) {
      const bob = Math.sin(state.t * 2) * 3;
      sp.draw('balloon', t.x - 4, t.y - 54 + bob);
      sp.draw('balloon', t.x + 146, t.y - 60 - bob);
    }
  }

  function drawKid(state) {
    const k = state.kid;
    if (!k.visible) return;
    const x = state.table.x + 190;
    sp.draw('kid', x, GROUND_Y + 2);
    g.bubble(k.say, x, GROUND_Y - 50);
  }

  function drawPlayer(state) {
    const p = state.player;
    if (!p.visible) return;
    const t = state.t;
    const flip = p.facing === -1;
    const x = p.x;
    const y = p.y + 2;
    switch (p.pose) {
      case 'run': {
        const frame = Math.floor(t * 10) % 2;
        if (state.slide > 0) sp.draw('hero', x, y - 30, { frame: 1, flip, rot: -0.5, anchor: 'c' });
        else sp.draw('hero', x, y, { frame, flip });
        break;
      }
      case 'jump':
        sp.draw('hero', x, y, { frame: 1, flip });
        break;
      case 'flip':
        sp.draw('hero', x, y - 36, { frame: 1, flip, rot: (flip ? -1 : 1) * p.airT * 14, anchor: 'c' });
        break;
      case 'fall':
      case 'slip':
        sp.draw('hero', x, y - 18, { frame: 0, rot: p.pose === 'slip' ? -1.9 : 1.6, anchor: 'c' });
        break;
      case 'sad':
        sp.draw('hero', x, y + 6, { frame: 0, flip });
        ctx.fillStyle = '#5fb3ff';
        ctx.fillRect(Math.round(x) + 21, Math.round(y) - 66 + Math.floor((t * 6) % 3) * 3, 3, 6);
        break;
      case 'cheer':
        sp.draw('hero', x, y - Math.abs(Math.sin(t * 8)) * 18, { frame: 1, flip });
        break;
      case 'float':
        sp.draw('hero', x, y - 36, { frame: 1, rot: Math.sin(t) * 0.6, anchor: 'c' });
        break;
      default:
        sp.draw('hero', x, y, { frame: 0, flip });
    }
    g.bubble(p.say, x, y - 74);
  }

  function drawCake(state) {
    const c = state.cake;
    if (!c.visible) return;
    if (c.splat) {
      sp.draw('cakeSplat', c.x, c.y + 2);
      return;
    }
    const name = c.label ? 'cakeDisplay' : 'cake';
    const bob = state.phase === PHASE.RUNNING && state.player.onGround ? Math.sin(state.t * 20) * 2 : 0;
    sp.draw(name, c.x, c.y + 14 + bob, { rot: c.rot ? c.rot : 0, anchor: c.rot ? 'c' : 'bc' });
  }

  function drawParticle(f) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
    ctx.fillStyle = f.color;
    const s = Math.max(3, Math.round(f.size / 3) * 3);
    ctx.fillRect(Math.round(f.x / 3) * 3, Math.round(f.y / 3) * 3, s, s);
    ctx.restore();
  }

  function drawOverlay(state) {
    const o = state.overlay;
    if (!o) return;
    ctx.save();
    if (o.style === 'fade') {
      ctx.fillStyle = `rgba(10,10,20,${o.alpha ?? 1})`;
      ctx.fillRect(0, 0, W, H);
    } else if (o.style === 'clock') {
      ctx.fillStyle = '#0a0a14';
      ctx.fillRect(0, 0, W, H);
      g.text(o.title, W / 2 + 30, H / 2 - 30, { size: 64, color: '#ff3b3b' });
      o.lines.forEach((l, i) => g.text(l, W / 2, H / 2 + 50 + i * 30, { size: 14, color: '#ddd' }));
      sp.draw('clock', W / 2 - 180, H / 2 + 10, { scale: 1.5 });
    } else if (o.style === 'toast') {
      ctx.font = `12px ${FONT}`;
      const w = ctx.measureText(o.lines[0]).width + 48;
      g.panel(W / 2 - w / 2, H - 112, w, 48, 'panelDark');
      g.text(o.lines[0], W / 2, H - 88, { size: 12, color: '#fff' });
    } else if (o.style === 'card') {
      ctx.translate(W / 2, H / 2 - 40);
      ctx.rotate(-0.06);
      g.panel(-270, -64, 540, 128, 'panelBeige');
      ctx.fillStyle = '#d7263d';
      ctx.fillRect(-258, -52, 516, 6);
      ctx.fillRect(-258, 46, 516, 6);
      g.text(o.title, 0, -16, { size: 30, color: '#d7263d' });
      o.lines.forEach((l, i) => g.text(l, 0, 22 + i * 18, { size: 10, color: '#d7263d' }));
    } else if (o.style === 'win') {
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(0, 0, W, H);
      g.text(o.title, W / 2, H / 2 - 50, { size: 48, color: '#ffd166', shadow: INK });
      o.lines.forEach((l, i) => g.text(l, W / 2, H / 2 + 20 + i * 28, { size: 14, color: INK }));
      if (o.progress != null) {
        ctx.fillStyle = INK;
        ctx.fillRect(W / 2 - 162, H / 2 + 58, 324, 24);
        ctx.fillStyle = '#5fbf5a';
        ctx.fillRect(W / 2 - 156, H / 2 + 64, Math.round((312 * o.progress) / 6) * 6, 12);
      }
    } else {
      // modal
      ctx.fillStyle = 'rgba(10,10,20,0.45)';
      ctx.fillRect(0, 0, W, H);
      g.panel(W / 2 - 240, H / 2 - 96, 480, 192, 'panelBeige');
      g.panel(W / 2 - 240, H / 2 - 96, 480, 48, 'panelDark');
      g.text(o.title, W / 2, H / 2 - 72, { size: 12, color: '#fff' });
      o.lines.forEach((l, i) => g.text(l, W / 2, H / 2 - 10 + i * 28, { size: 12 }));
      if (o.spinner) {
        const k = Math.floor(state.t * 8) % 4;
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = i === k ? INK : '#c9cdd9';
          ctx.fillRect(W / 2 - 24 + i * 15, H / 2 + 52, 9, 9);
        }
      }
    }
    ctx.restore();
  }

  function drawHud(state, hud) {
    if (state.phase === PHASE.TITLE) return;
    const pct = progress(state);
    if (state.slide > 0) g.text('SLIDING!', W / 2, 100, { size: 14, color: '#ffd166', shadow: INK });
    const atEnd = state.phase === PHASE.ENDING || state.phase === PHASE.LOST || state.phase === PHASE.WIN;
    const m = atEnd ? COURSE_M : (state.phase === PHASE.DEAD ? state.distance : Math.min(COURSE_M, state.player.x / PX_PER_M)).toFixed(1);
    g.panel(12, 12, 348, 66, 'panelBeige');
    g.text(`${m} m / ${COURSE_M} m`, 30, 34, { size: 10, align: 'left' });
    g.text(`${(pct * 100).toFixed(1)}%`, 342, 34, { size: 10, align: 'right' });
    ctx.fillStyle = INK;
    ctx.fillRect(30, 48, 312, 18);
    ctx.fillStyle = pct >= 0.97 ? '#ffd166' : '#5fbf5a';
    ctx.fillRect(33, 51, Math.round((306 * pct) / 3) * 3, 12);
    const k = state.speed / BASE_SPEED;
    if (state.phase === PHASE.RUNNING && k > 1.05) {
      g.text('>'.repeat(Math.min(4, Math.round((k - 1) * 10))), 372, 46, { size: 14, color: '#ffd166', align: 'left', shadow: INK });
    }
    g.panel(W - 318, 12, 306, 66, 'panelBeige');
    g.text(`TRY ${hud.attempts}  WINS ${hud.wins ?? 0}`, W - 300, 34, { size: 10, align: 'left' });
    g.text(hud.bestM != null ? `BEST ${hud.bestM.toFixed(1)} m` : `BEST ${hud.best.toFixed(1)}%`, W - 30, 34, { size: 10, align: 'right' });
    g.text(`${hud.muted ? 'MUTED' : 'SOUND ON'}  v6`, W - 30, 58, { size: 8, align: 'right', color: '#6b6f80' });
  }

  return { draw, g };
}

export { SHEETS, SPRITES };
