// Canvas renderer, pixel-art edition. World drawing uses Kenney CC0 sprites and hand-pixeled art
// (src/sprites.js, src/pixelart.js) at PIXEL_SCALE. No emoji anywhere.

import { W, H, GROUND_Y, PX_PER_M, COURSE_M, PHASE, BASE_SPEED, BLACKOUT, CALM_DIM, CANOPY_CLEARANCE, progress, biomeAt, pendulumBall } from './game.js';
import { createSpriteDrawer, PIXEL_SCALE, SHEETS, SPRITES } from './sprites.js';
import { getTheme } from './themes.js';
import { createScenery } from './scenery.js';

export const FONT = '"Press Start 2P", "Courier New", monospace';
const INK = '#2b2b3a';
const TILE = 18 * PIXEL_SCALE; // 54
const snap = (v) => Math.round(v / 3) * 3;

export function createRenderer(canvas, images, pixelSprites) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const sp = createSpriteDrawer(ctx, images, pixelSprites);
  // Active game mode (src/themes.js): sprite slots, bubble words and banner texts.
  let theme = getTheme('cake');
  const A = (slot, fallback = slot) => theme.art[slot] ?? fallback;
  // Logical view width: 960 in landscape, narrower in portrait so sprites read bigger (D21).
  // The world stays centred on the same point, so only the edges of the view are cropped.
  let VW = W;
  let pxScale = 1;
  // Backdrops, ground and ambient effects come from the level's scene data (src/scenery.js).
  const scenery = createScenery(ctx, sp, () => VW);

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
      text = theme.say[text] ?? text;
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
    const scene = theme.scene;
    const calm = state.reducedMotion;
    ctx.setTransform(pxScale, 0, 0, pxScale, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, VW, H);
    scenery.sky(state, scene);

    // A hit lands with a short zoom punch (not with reduced motion).
    const punch = state.phase === PHASE.DEAD && !calm ? 0.05 * Math.max(0, 1 - state.deadT / 0.35) : 0;
    const z = (cam.zoom || 1) * (1 + punch);
    const fx = cam.x + W / 2;
    const fy = cam.focusY ?? H / 2;
    const shake = calm ? 0 : cam.shake;
    const sx = shake ? Math.round((state.rng() - 0.5) * shake * 14 / 3) * 3 : 0;
    const sy = shake ? Math.round((state.rng() - 0.5) * shake * 10 / 3) * 3 : 0;

    ctx.save();
    ctx.translate(VW / 2 + sx, H / 2 + sy);
    ctx.scale(z, z);
    ctx.translate(-Math.round(fx), -Math.round(fy));

    scenery.layers(state, scene);
    scenery.walls(state, scene);
    scenery.ground(state, scene);
    scenery.decor(state, scene);
    for (const h of state.hazards) drawHazard(h, state);
    drawTable(state);
    drawKid(state);
    drawPlayer(state);
    drawCake(state);
    for (const f of state.fx) drawParticle(f);
    if (state.ending && state.ending.def.drawWorld) state.ending.def.drawWorld(g, state);
    ctx.restore();

    scenery.ambient(state, scene);
    if (state.dark > 0) drawBlackout(state);
    if (state.phase === PHASE.RUNNING) {
      if (state.popup) drawPopup(state);
      drawOffscreenChaser(state);
      drawSpeedLines(state);
      drawWind(state);
      drawStretchBanner(state);
    }
    // One soft flash while the hit-stop holds the frame (never with reduced motion).
    if (state.phase === PHASE.DEAD && !calm && state.hitStop > 0) {
      ctx.fillStyle = `rgba(255,255,255,${(0.35 * state.hitStop) / 0.12})`;
      ctx.fillRect(0, 0, VW, H);
    }
    if (state.phase === PHASE.WIN) drawWin(state);
    drawOverlay(state);
    if (state.ending && state.ending.def.drawScreen) state.ending.def.drawScreen(g, state);
    drawHud(state, hud);
  }

  function drawHazard(h, state) {
    if (!h.visible) return;
    const y = GROUND_Y;
    const cx = h.x + h.w / 2;
    switch (h.type) {
      case 'fence':
        sp.draw(A('fence'), cx, y + 2);
        break;
      case 'wall':
        if (theme.art.wall) {
          for (let i = 0; i < 3; i++) sp.draw(A('wall'), cx, y + 2 - TILE * i);
          if (theme.art.wallTop) sp.draw(A('wallTop'), cx, y + 2 - TILE * 3);
        } else if (theme.id === 'cake' && biomeAt(h.anchorX) === 'desert') {
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
        sp.draw(A('rainCloud', 'cloudDark'), ax, y - 96, { scale: 1.5 });
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
        sp.draw(A('dog'), cx, y + 2, { flip: false });
        if (h.state === 'active') {
          ctx.fillStyle = 'rgba(141,90,43,0.35)';
          ctx.fillRect(Math.round(h.x + h.w + 6), y - 6, 18, 6);
        }
        if (h.warn) g.bubble(h.warn, cx, y - 52);
        break;
      case 'skate':
        if (theme.id === 'cake' && biomeAt(h.anchorX) === 'desert') sp.draw('tumbleweed', cx, y + 2 - Math.abs(Math.sin(state.t * 9)) * 10, { rot: -state.t * 6, anchor: 'c' });
        else sp.draw(A('skate'), cx, y + 2);
        break;
      case 'pigeon': {
        // perch pole stays at the anchor
        ctx.fillStyle = INK;
        ctx.fillRect(Math.round(h.anchorX + h.w / 2) - 3, y - 150, 6, 150);
        ctx.fillStyle = '#8d5a2b';
        ctx.fillRect(Math.round(h.anchorX + h.w / 2) - 18, y - 153, 36, 6);
        const frame = h.state === 'active' ? Math.floor(state.t * 12) % 3 : 0;
        sp.draw(A('pigeon'), cx, h.y + 6, { frame, flip: h.state === 'active' });
        if (h.state === 'active' && h.phase !== 'away') {
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.fillRect(Math.round(cx) - 15, y - 3, 30, 4);
        }
        if (h.warn) g.bubble(h.warn, cx, h.y - 42);
        break;
      }
      case 'bee': {
        const frame = Math.floor(state.t * 14) % 2;
        sp.draw(A('bee'), cx, h.y + 6, { frame, flip: h.state === 'active', scale: 1.4 });
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
        if (h.state === 'falling') sp.draw(A('meteor', 'crate'), cx, h.y + 54, { rot: 0.2 * Math.sin(state.t * 10) });
        else sp.draw(A('meteor', 'crate'), cx, y + 2);
        if (h.state === 'falling') g.bubble('!', cx, y - 70);
        break;
      }
      case 'crack': {
        if (h.state === 'idle') break;
        if (h.state === 'warn') {
          ctx.fillStyle = INK;
          const shake = state.reducedMotion ? 0 : Math.round(Math.sin(state.t * 60) * 3);
          for (let i = 0; i < 5; i++) ctx.fillRect(Math.round(h.anchorX + 10 + i * 26) + shake, y - 2 - (i % 2) * 3, 12, 3);
          ctx.fillRect(Math.round(h.anchorX + 30) + shake, y - 8, 3, 6);
          ctx.fillRect(Math.round(h.anchorX + 90) - shake, y - 10, 3, 8);
        }
        break;
      }
      case 'peel': {
        if (h.state === 'idle' || h.state === 'used') break;
        sp.draw(A('peel', 'banana'), cx, y + 2, { flip: h.state === 'sliding' && Math.floor(state.t * 10) % 2 === 0 });
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
        const [beamFill, beamMark] = theme.beamColors ?? ['#c98a4b', '#8d5a2b'];
        ctx.fillStyle = beamFill;
        ctx.fillRect(Math.round(h.x) - 6, top, Math.round(h.w) + 12, 18);
        ctx.fillStyle = beamMark;
        for (let px = Math.round(h.x); px < h.x + h.w; px += 54) ctx.fillRect(px, top + 3, 3, 12);
        // Office banners carry their slogan on the cloth: the office walls can be too dark for ink above it.
        if (theme.beamColors) g.text(theme.text.beam, h.x + h.w / 2, top + 9, { size: 10, color: '#fff' });
        else g.text(theme.text.beam, h.x + h.w / 2, top - 16, { size: 8, color: INK });
        break;
      }
      case 'cow':
        // The committee art is already drawn at hitbox size; the farm cow is a 16 px tile.
        sp.draw(A('cow'), cx, y + 2, { scale: theme.art.cow ? 1 : 2.7 });
        if (h.warn) g.bubble(h.warn, cx, theme.art.cow ? y - 76 : y - 136);
        break;
      case 'chick':
        sp.draw(A('chick', 'chicken'), cx, y + 2 - Math.abs(Math.sin(state.t * 16 + h.anchorX)) * 6);
        if (h.warn) g.bubble(h.warn, cx, y - 46);
        break;
      case 'slime': {
        const frame = h.phase === 'squash' ? 2 : h.phase === 'up' ? 1 : Math.floor(state.t * 4) % 2;
        sp.draw(A('slime'), cx, h.y + 6, { frame });
        if (h.phase !== 'down') {
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.fillRect(Math.round(cx) - 18, y - 3, 36, 4);
        }
        break;
      }
      case 'snake':
        sp.draw(A('snake'), cx, y + 2, { scale: 2.2, flip: Math.floor(state.t * 6) % 2 === 0 && false });
        if (h.warn) g.bubble(h.warn, cx, y - 36);
        break;
      case 'mole':
        sp.draw(A('mound'), cx, y + 2);
        if (h.state === 'spray') {
          ctx.fillStyle = '#8d5a2b';
          for (let i = 0; i < 5; i++) ctx.fillRect(Math.round(cx - 24 + i * 12), y - 20 - ((state.t * 200 + i * 13) % 30), 3, 6);
        }
        if (h.popped) sp.draw(A('mole'), cx, y + 2);
        if (h.warn) g.bubble(h.warn, cx, y - 50);
        break;
      case 'bro':
        sp.draw(A('bro', 'repoman'), cx, y + 2, { flip: false });
        sp.draw(A('broProp', 'phone'), cx - 28, y - 30, { scale: 0.8 });
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
        sp.draw(A('pendulum', 'spikeBall'), b.x, b.y + 24, { rot: b.theta * 0.5 });
        break;
      }
      case 'trampoline':
        sp.draw(A('trampoline', 'spring'), cx, y + 2, { scale: h.state === 'used' ? 0.8 : 1 });
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
          sp.draw(A(h.type), cx, h.y + 20);
        } else if (h.state === 'landed') {
          sp.draw(A('knife'), cx, y + 18);
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
      case 'creep': {
        // The hole itself is drawn with the ground; this is what tells you it moves.
        const post = theme.art.creepPost;
        if (post) {
          sp.draw(post, h.x - 3, y + 2);
          sp.draw(post, h.x + h.w + 3, y + 2);
        }
        if (h.state === 'active') {
          ctx.fillStyle = post ? '#8a8fa3' : '#8d5a2b';
          for (let i = 0; i < 4; i++) ctx.fillRect(snap(h.x - 9 - i * 9), y - 3 - snap((state.t * 60 + i * 11) % 15), 6, 3);
          g.text('<<', cx, y + 33, { size: 10, color: '#fff' });
        }
        if (h.warn) g.bubble(h.warn, cx, y - 24);
        break;
      }
      case 'grower': {
        const [fill, shade, accent] = theme.growerColors ?? ['#5fbf5a', '#2f8f4e', '#bfe8a0'];
        const hh = snap(h.h);
        const x0 = Math.round(h.x);
        const top = y - hh;
        if (theme.growerStyle === 'stack') {
          // a pile of paper that keeps growing
          ctx.fillStyle = INK;
          ctx.fillRect(x0, top - 3, h.w, hh + 3);
          for (let sy = y - 9, n = 0; sy >= top; sy -= 9, n++) {
            ctx.fillStyle = fill;
            ctx.fillRect(x0 + 3, sy, h.w - 6, 6);
            ctx.fillStyle = shade;
            ctx.fillRect(x0 + 3, sy + 6, h.w - 6, 3);
            ctx.fillStyle = accent;
            ctx.fillRect(x0 + 6 + (n % 3) * 15, sy, 9, 3);
          }
        } else {
          // a stalk that shoots up, leaves alternating left and right
          ctx.fillStyle = INK;
          ctx.fillRect(x0 + 9, top - 3, h.w - 18, hh + 3);
          ctx.fillStyle = fill;
          ctx.fillRect(x0 + 12, top, h.w - 24, hh);
          ctx.fillStyle = shade;
          ctx.fillRect(x0 + h.w - 21, top, 9, hh);
          for (let ly = y - 21, n = 0; ly >= top + 3; ly -= 24, n++) {
            const lx = n % 2 ? x0 + h.w - 12 : x0 - 3;
            ctx.fillStyle = INK;
            ctx.fillRect(lx, ly - 3, 15, 15);
            ctx.fillStyle = accent;
            ctx.fillRect(lx + 3, ly, 9, 9);
          }
          ctx.fillStyle = accent;
          ctx.fillRect(x0 + 18, top, h.w - 36, 6);
        }
        if (h.warn) g.bubble(h.warn, cx, top - 12);
        break;
      }
      case 'canopy': {
        const under = y - CANOPY_CLEARANCE;
        const top = under - 18;
        const x0 = Math.round(h.x);
        const x1 = Math.round(h.x + h.w);
        // two tall poles
        ctx.fillStyle = INK;
        ctx.fillRect(x0 - 9, top - 6, 9, y - top + 6);
        ctx.fillRect(x1, top - 6, 9, y - top + 6);
        ctx.fillStyle = '#8a8fa3';
        ctx.fillRect(x0 - 6, top - 3, 3, y - top + 3);
        ctx.fillRect(x1 + 3, top - 3, 3, y - top + 3);
        if (theme.canopyStyle === 'glass') {
          ctx.fillStyle = INK;
          ctx.fillRect(x0, top - 3, x1 - x0, 24);
          ctx.fillStyle = '#bfe4ff';
          ctx.fillRect(x0, top, x1 - x0, 18);
          ctx.fillStyle = '#ffffff';
          for (let px = x0 + 12; px < x1 - 30; px += 66) {
            ctx.fillRect(px, top + 3, 18, 3);
            ctx.fillRect(px + 6, top + 9, 9, 3);
          }
        } else {
          // a line of bunting: the flags hang exactly where a double jump would put your head
          ctx.fillStyle = INK;
          ctx.fillRect(x0, top, x1 - x0, 3);
          const flags = ['#e5484d', '#ffd166', '#5fbf5a', '#5fb3ff', '#f4a0b5'];
          for (let px = x0 + 6, n = 0; px < x1 - 18; px += 27, n++) {
            ctx.fillStyle = flags[n % flags.length];
            ctx.fillRect(px, top + 3, 18, 6);
            ctx.fillRect(px + 3, top + 9, 12, 6);
            ctx.fillRect(px + 6, top + 15, 6, 3);
          }
        }
        g.text(theme.text.canopy, (x0 + x1) / 2, top - 18, { size: 8, color: '#fff', shadow: INK });
        break;
      }
      case 'boomerang': {
        if (h.state !== 'out' && h.state !== 'back') break;
        const spin = state.reducedMotion ? 0.4 : state.t * 14;
        const by = h.state === 'out' ? h.y - 12 : y - 12;
        sp.draw(A('boomerang'), cx, by, { rot: spin, anchor: 'c' });
        if (h.state === 'out') {
          // shadow on the ground marks the no-jump moment
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.fillRect(Math.round(cx) - 18, y - 3, 36, 4);
        } else {
          ctx.fillStyle = 'rgba(141,90,43,0.35)';
          for (let i = 0; i < 3; i++) ctx.fillRect(Math.round(h.x - 12 - i * 15), y - 6 - (i % 2) * 6, 12, 6);
        }
        if (h.warn) g.bubble(h.warn, cx, by - 24);
        break;
      }
      case 'pig': {
        if (h.state !== 'active' && h.state !== 'done') break;
        const bob = Math.abs(Math.sin(state.t * 24)) * 4;
        sp.draw(A('pig'), cx, y + 2 - bob, { flip: true });
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

  // Edge indicator for a chaser that is still off-screen behind the player (pig, returning boomerang).
  function drawOffscreenChaser(state) {
    const left = state.camera.x + W / 2 - VW / 2;
    const chaser = state.hazards.find((h) => ((h.type === 'pig' && h.state === 'active') || (h.type === 'boomerang' && h.state === 'back')) && h.x + h.w <= left);
    if (!chaser) return;
    const label = chaser.type === 'pig' ? theme.text.pigMarker : theme.text.boomMarker;
    ctx.font = `12px ${FONT}`;
    const w = Math.max(150, Math.ceil((ctx.measureText(label).width + 36) / 3) * 3);
    g.panel(12, GROUND_Y - 96, w, 48, 'panelDark');
    g.text(label, 12 + w / 2, GROUND_Y - 72, { size: 12, color: '#fff' });
  }

  // 'popup' stretches: the view ahead is covered. The player and the ground just ahead stay visible.
  const POPUP_SLOTS = [[0.46, 0.22], [0.68, 0.36], [0.5, 0.54], [0.78, 0.18], [0.62, 0.7], [0.84, 0.52], [0.54, 0.8]];
  function drawPopup(state) {
    const { k, id } = state.popup;
    const calm = state.reducedMotion;
    const alpha = Math.min(1, k * 10) * (k > 0.92 ? Math.max(0, (1 - k) / 0.08) : 1);
    ctx.save();
    if (theme.popupStyle === 'windows' && theme.text.popups.length) {
      const items = theme.text.popups;
      const shown = Math.min(POPUP_SLOTS.length, 1 + Math.floor(k * 10));
      const w = Math.min(246, snap(VW * 0.4));
      const hh = 96;
      ctx.globalAlpha = alpha;
      for (let n = 0; n < shown; n++) {
        const [px, py] = POPUP_SLOTS[n];
        const age = k - n / 10;
        const slide = calm ? 0 : snap(Math.max(0, 1 - age * 14) * 36);
        const x = snap(VW * px - w / 2);
        const yy = snap(H * py - hh / 2) - slide;
        const [title, line] = items[(n + Math.abs(Math.round(id))) % items.length];
        g.panel(x, yy, w, hh, 'panelBeige');
        g.panel(x, yy, w, 36, 'panelDark');
        g.text(title, x + 15, yy + 19, { size: 8, color: '#fff', align: 'left' });
        g.text('x', x + w - 18, yy + 18, { size: 8, color: '#fff' });
        g.text(line, x + w / 2, yy + 54, { size: 8 });
        ctx.fillStyle = INK;
        ctx.fillRect(x + w / 2 - 33, yy + 66, 66, 21);
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(x + w / 2 - 30, yy + 69, 60, 15);
        g.text('OK', x + w / 2, yy + 77, { size: 8 });
      }
    } else {
      // a bank of fog rolling over the right-hand side of the view
      ctx.globalAlpha = 0.94 * alpha;
      for (let r = 0; r < 7; r++) {
        const yy = 90 + r * 51;
        const drift = calm ? 0 : snap(Math.sin(state.t * 0.7 + r * 1.3) * 18);
        for (let x = snap(VW * 0.36) + (r % 2) * 30; x < VW + 60; x += 108) {
          ctx.fillStyle = '#e8e8f0';
          ctx.fillRect(x + drift + 12, yy + 36, 84, 12);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x + drift, yy, 126, 39);
          ctx.fillRect(x + drift + 18, yy - 12, 66, 12);
        }
      }
    }
    ctx.globalAlpha = alpha;
    g.text(theme.text.fog, VW / 2, 60, { size: 10, color: '#fff', shadow: INK });
    ctx.restore();
  }

  // Name of the 25 m stretch you just entered.
  function drawStretchBanner(state) {
    const st = state.stretch;
    const name = theme.scene.stretches[st.i]?.name;
    if (!name || st.t > 2.2) return;
    const slide = state.reducedMotion ? 0 : snap(Math.max(0, 1 - st.t / 0.25) * 150);
    ctx.save();
    ctx.globalAlpha = st.t > 1.8 ? Math.max(0, (2.2 - st.t) / 0.4) : 1;
    ctx.font = `12px ${FONT}`;
    const w = Math.ceil((ctx.measureText(name).width + 48) / 3) * 3;
    const x = snap(VW / 2 - w / 2) + slide;
    const yy = VW >= 700 ? 126 : 162;
    g.panel(x, yy, w, 42, 'panelDark');
    g.text(name, x + w / 2, yy + 22, { size: 12, color: '#ffd166' });
    ctx.restore();
  }

  function drawBlackout(state) {
    const d = state.dark;
    const p = state.player;
    const cam = state.camera;
    const px = Math.round(VW / 2 + (p.x - cam.x - W / 2) * (cam.zoom || 1));
    const py = Math.round(p.y - 30);
    ctx.save();
    // Reduced motion: a steady dim (CALM_DIM) with the spotlight, never a full blackout.
    const full = state.reducedMotion ? d >= CALM_DIM : d >= 1;
    ctx.fillStyle = `rgba(0,0,0,${0.97 * d})`;
    ctx.beginPath();
    ctx.rect(0, 0, VW, H);
    if (full) {
      const r = BLACKOUT.spot;
      ctx.moveTo(px + r, py);
      ctx.arc(px, py, r, 0, Math.PI * 2, true);
    }
    ctx.fill('evenodd');
    if (full) g.text(state.reducedMotion ? theme.text.dim : theme.text.dark, VW / 2, 60, { size: 10, color: '#fff' });
    ctx.restore();
  }

  function drawWind(state) {
    const w = state.wind;
    if (w.t <= 0) return;
    const dir = w.mult < 1 ? -1 : 1;
    ctx.fillStyle = dir < 0 ? '#5fbf5a' : '#ffd166';
    for (let i = 0; i < 14; i++) {
      const y = 90 + ((i * 131) % 330);
      const x = (((i * 173 + state.t * 700 * dir) % VW) + VW) % VW;
      ctx.fillRect(Math.round(x / 3) * 3, Math.round(y / 3) * 3 + Math.round(Math.sin(state.t * 8 + i) * 6), 9, 3);
    }
    g.text(dir < 0 ? theme.text.headwind : theme.text.tailwind, VW / 2, 100, { size: 14, color: dir < 0 ? '#5fbf5a' : '#ffd166', shadow: INK });
  }

  function drawWin(state) {
    const k = Math.min(1, state.winT / 0.6);
    // Shrink the banner to fit a narrow (portrait) view.
    const size = Math.min(32, Math.floor((VW - 48) / theme.text.win.length));
    g.text(theme.text.win, VW / 2, H / 2 - 60 - (1 - k) * 40, { size, color: '#ffd166', shadow: INK });
    if (state.winT > 1.2) g.text(theme.text.winSub, VW / 2, H / 2 - 10, { size: 12, color: '#fff', shadow: INK });
  }

  function drawSpeedLines(state) {
    const k = state.speed / BASE_SPEED;
    if (k < 1.22) return;
    const n = Math.floor((k - 1.2) * 20);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < n; i++) {
      const y = 60 + ((i * 97 + Math.floor(state.t * 60) * 13) % 340);
      const x = ((i * 211 - state.t * 900) % VW + VW) % VW;
      ctx.fillRect(Math.round(x / 3) * 3, Math.round(y / 3) * 3, 60 + (i % 3) * 24, 3);
    }
  }

  function drawTable(state) {
    const t = state.table;
    if (!t.visible) return;
    const cx = t.x + 70;
    sp.draw(t.collapsed ? 'tableBroken' : A('table'), cx, t.y + 2);
    if (!t.collapsed) {
      const bob = Math.sin(state.t * 2) * 3;
      sp.draw(A('balloon'), t.x - 4, t.y - 54 + bob);
      sp.draw(A('balloon'), t.x + 146, t.y - 60 - bob);
    }
  }

  function drawKid(state) {
    const k = state.kid;
    if (!k.visible) return;
    const x = state.table.x + 190;
    sp.draw(A('kid'), x, GROUND_Y + 2);
    g.bubble(k.say, x, GROUND_Y - 50);
  }

  function drawPlayer(state) {
    const p = state.player;
    if (!p.visible) return;
    const t = state.t;
    const flip = p.facing === -1;
    const x = p.x;
    const y = p.y + 2;
    const hero = A('hero');
    switch (p.pose) {
      case 'run': {
        const frame = Math.floor(t * 10) % 2;
        if (state.slide > 0) sp.draw(hero, x, y - 30, { frame: 1, flip, rot: -0.5, anchor: 'c' });
        else sp.draw(hero, x, y, { frame, flip });
        break;
      }
      case 'jump':
        sp.draw(hero, x, y, { frame: 1, flip });
        break;
      case 'flip':
        // afterimage of the spin (motion effect: skipped with reduced motion)
        if (!state.reducedMotion && state.phase === PHASE.RUNNING) {
          for (const k of [2, 1]) sp.draw(hero, x - state.speed * 0.04 * k, y - 36 - p.vy * 0.04 * k, { frame: 1, flip, rot: (flip ? -1 : 1) * (p.airT - 0.04 * k) * 14, anchor: 'c', alpha: 0.14 * (3 - k) });
        }
        sp.draw(hero, x, y - 36, { frame: 1, flip, rot: (flip ? -1 : 1) * p.airT * 14, anchor: 'c' });
        break;
      case 'fall':
      case 'slip':
        sp.draw(hero, x, y - 18, { frame: 0, rot: p.pose === 'slip' ? -1.9 : 1.6, anchor: 'c' });
        break;
      case 'sad':
        sp.draw(hero, x, y + 6, { frame: 0, flip });
        ctx.fillStyle = '#5fb3ff';
        ctx.fillRect(Math.round(x) + 21, Math.round(y) - 66 + Math.floor((t * 6) % 3) * 3, 3, 6);
        break;
      case 'cheer':
        sp.draw(hero, x, y - Math.abs(Math.sin(t * 8)) * 18, { frame: 1, flip });
        break;
      case 'float':
        sp.draw(hero, x, y - 36, { frame: 1, rot: Math.sin(t) * 0.6, anchor: 'c' });
        break;
      default:
        sp.draw(hero, x, y, { frame: 0, flip });
    }
    g.bubble(p.say, x, y - 74);
  }

  function drawCake(state) {
    const c = state.cake;
    if (!c.visible) return;
    if (c.splat) {
      sp.draw(A('cakeSplat'), c.x, c.y + 2);
      return;
    }
    const name = A(c.label ? 'cakeDisplay' : 'cake');
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
      ctx.fillRect(0, 0, VW, H);
    } else if (o.style === 'clock') {
      ctx.fillStyle = '#0a0a14';
      ctx.fillRect(0, 0, VW, H);
      g.text(o.title, VW / 2 + 30, H / 2 - 30, { size: 64, color: '#ff3b3b' });
      o.lines.forEach((l, i) => g.text(l, VW / 2, H / 2 + 50 + i * 30, { size: 14, color: '#ddd' }));
      sp.draw('clock', VW / 2 - 180, H / 2 + 10, { scale: 1.5 });
    } else if (o.style === 'toast') {
      ctx.font = `12px ${FONT}`;
      const w = ctx.measureText(o.lines[0]).width + 48;
      g.panel(VW / 2 - w / 2, H - 112, w, 48, 'panelDark');
      g.text(o.lines[0], VW / 2, H - 88, { size: 12, color: '#fff' });
    } else if (o.style === 'card') {
      ctx.translate(VW / 2, H / 2 - 40);
      ctx.rotate(-0.06);
      g.panel(-270, -64, 540, 128, 'panelBeige');
      ctx.fillStyle = '#d7263d';
      ctx.fillRect(-258, -52, 516, 6);
      ctx.fillRect(-258, 46, 516, 6);
      g.text(o.title, 0, -16, { size: 30, color: '#d7263d' });
      o.lines.forEach((l, i) => g.text(l, 0, 22 + i * 18, { size: 10, color: '#d7263d' }));
    } else if (o.style === 'win') {
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(0, 0, VW, H);
      g.text(o.title, VW / 2, H / 2 - 50, { size: 48, color: '#ffd166', shadow: INK });
      o.lines.forEach((l, i) => g.text(l, VW / 2, H / 2 + 20 + i * 28, { size: 14, color: INK }));
      if (o.progress != null) {
        ctx.fillStyle = INK;
        ctx.fillRect(VW / 2 - 162, H / 2 + 58, 324, 24);
        ctx.fillStyle = '#5fbf5a';
        ctx.fillRect(VW / 2 - 156, H / 2 + 64, Math.round((312 * o.progress) / 6) * 6, 12);
      }
    } else {
      // modal
      ctx.fillStyle = 'rgba(10,10,20,0.45)';
      ctx.fillRect(0, 0, VW, H);
      g.panel(VW / 2 - 240, H / 2 - 96, 480, 192, 'panelBeige');
      g.panel(VW / 2 - 240, H / 2 - 96, 480, 48, 'panelDark');
      g.text(o.title, VW / 2, H / 2 - 72, { size: 12, color: '#fff' });
      o.lines.forEach((l, i) => g.text(l, VW / 2, H / 2 - 10 + i * 28, { size: 12 }));
      if (o.spinner) {
        const k = Math.floor(state.t * 8) % 4;
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = i === k ? INK : '#c9cdd9';
          ctx.fillRect(VW / 2 - 24 + i * 15, H / 2 + 52, 9, 9);
        }
      }
    }
    ctx.restore();
  }

  function drawHud(state, hud) {
    if (state.phase === PHASE.TITLE) return;
    const pct = progress(state);
    if (state.slide > 0) g.text(theme.text.sliding, VW / 2, 100, { size: 14, color: '#ffd166', shadow: INK });
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
    // A narrow (portrait) view has no room for two panels side by side: stack the stats panel.
    const wide = VW >= 700;
    const rx = wide ? VW - 318 : 12;
    const ry = wide ? 12 : 84;
    g.panel(rx, ry, 306, 66, 'panelBeige');
    g.text(`TRY ${hud.attempts}  WINS ${hud.wins ?? 0}`, rx + 18, ry + 22, { size: 10, align: 'left' });
    g.text(hud.bestM != null ? `BEST ${hud.bestM.toFixed(1)} m` : `BEST ${hud.best.toFixed(1)}%`, rx + 288, ry + 22, { size: 10, align: 'right' });
    g.text(`${hud.muted ? 'MUTED' : 'SOUND ON'}  v8`, rx + 288, ry + 46, { size: 8, align: 'right', color: '#6b6f80' });
  }

  // cssW/cssH: on-screen size of the canvas; the backing store matches device pixels so art stays crisp.
  function setView({ viewW = W, cssW = W, cssH = H, dpr = 1 } = {}) {
    VW = viewW;
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    pxScale = canvas.width / VW;
  }

  function setTheme(mode) {
    theme = getTheme(mode);
  }

  return { draw, g, setView, setTheme };
}

export { SHEETS, SPRITES };
