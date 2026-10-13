// Sprite atlas: which sheet + tile index each named sprite comes from, and a drawer that
// renders them crisp at PIXEL_SCALE. Hand-pixeled sprites (src/pixelart.js) are looked up first.
// Sheets are Kenney CC0 packs (see assets/LICENSES.md). Index = row * cols + col on the packed sheet.

export const PIXEL_SCALE = 3;

export const SHEETS = {
  tiles: { src: 'assets/sprites/pp-tiles.png', tile: 18, cols: 20 },
  chars: { src: 'assets/sprites/pp-chars.png', tile: 24, cols: 9 },
  bg: { src: 'assets/sprites/pp-bg.png', tile: 24, cols: 8 },
  farm: { src: 'assets/sprites/farm.png', tile: 16, cols: 12 },
  ui: { src: 'assets/sprites/ui.png', tile: 32, cols: 13 },
};

export const SPRITES = {
  // terrain (Pixel Platformer, 18 px)
  groundTop: { sheet: 'tiles', index: 1 },
  groundTopAlt: { sheet: 'tiles', index: 2 },
  groundFill: { sheet: 'tiles', index: 141 },
  groundFillAlt: { sheet: 'tiles', index: 142 },
  groundTopSand: { sheet: 'tiles', index: 41 },
  groundTopSandAlt: { sheet: 'tiles', index: 42 },
  groundTopSnow: { sheet: 'tiles', index: 101 },
  groundTopSnowAlt: { sheet: 'tiles', index: 102 },
  snowman: { sheet: 'tiles', index: 145 },
  bgDesert: { sheet: 'bg', index: 12 },
  bgDesertB: { sheet: 'bg', index: 13 },
  bgDesertFill: { sheet: 'bg', index: 20 },
  groundEdgeL: { sheet: 'tiles', index: 0 },
  groundEdgeR: { sheet: 'tiles', index: 3 },
  dirtDark: { sheet: 'tiles', index: 161 },
  fence: { sheet: 'tiles', index: 105 },
  fenceAlt: { sheet: 'tiles', index: 106 },
  crate: { sheet: 'tiles', index: 6 },
  block: { sheet: 'tiles', index: 12 },
  sprout: { sheet: 'tiles', index: 124 },
  cactus: { sheet: 'tiles', index: 125 },
  pine: { sheet: 'tiles', index: 126 },
  cactusTall: { sheet: 'tiles', index: 127 },
  mushroom: { sheet: 'tiles', index: 128 },
  signLeft: { sheet: 'tiles', index: 84 },
  signRight: { sheet: 'tiles', index: 85 },
  signPost: { sheet: 'tiles', index: 86 },
  cloudL: { sheet: 'tiles', index: 153 },
  cloudM: { sheet: 'tiles', index: 154 },
  cloudR: { sheet: 'tiles', index: 155 },
  heart: { sheet: 'tiles', index: 44 },
  coin: { sheet: 'tiles', index: 151 },
  gem: { sheet: 'tiles', index: 67 },
  flagTop: { sheet: 'tiles', index: 111 },
  bridge: { sheet: 'tiles', index: 83 },

  // characters (Pixel Platformer, 24 px)
  hero: { sheet: 'chars', frames: [0, 1] },
  heroBlue: { sheet: 'chars', frames: [2, 3] },
  heroPink: { sheet: 'chars', frames: [4, 5] },
  heroYellow: { sheet: 'chars', frames: [6, 7] },
  spikeBall: { sheet: 'chars', index: 8 },
  tanGuy: { sheet: 'chars', frames: [9, 10] },
  blockFace: { sheet: 'chars', index: 11 },
  blockAngry: { sheet: 'chars', index: 12 },
  bee: { sheet: 'chars', frames: [13, 14] },
  slime: { sheet: 'chars', frames: [18, 19, 20] },
  pigeon: { sheet: 'chars', frames: [24, 25, 26] },

  // backgrounds (24 px): green palette hills + pale palette far layer
  bgSky: { sheet: 'bg', index: 6 },
  bgHills: { sheet: 'bg', index: 14 },
  bgHillsB: { sheet: 'bg', index: 15 },
  bgFill: { sheet: 'bg', index: 22 },
  bgFar: { sheet: 'bg', index: 9 },
  bgFarB: { sheet: 'bg', index: 10 },
  bgFarFill: { sheet: 'bg', index: 17 },

  // farm props (Tiny Farm, 16 px)
  kid: { sheet: 'farm', index: 108 },
  farmerHat: { sheet: 'farm', index: 109 },
  cow: { sheet: 'farm', index: 120 },
  chicken: { sheet: 'farm', index: 122 },
  hay: { sheet: 'farm', index: 96 },
  barrel: { sheet: 'farm', index: 97 },
  bucket: { sheet: 'farm', index: 123 },
  sunflower: { sheet: 'farm', index: 83 },
  treeRound: { sheet: 'farm', index: 38 },
  treePine: { sheet: 'farm', index: 3 },
  bush: { sheet: 'farm', index: 50 },
  signFarm: { sheet: 'farm', index: 86 },
  hayBale: { sheet: 'farm', index: 96 },

  // UI (32 px)
  panelBeige: { sheet: 'ui', index: 0 },
  panelBrown: { sheet: 'ui', index: 1 },
  panelBlue: { sheet: 'ui', index: 2 },
  panelDark: { sheet: 'ui', index: 3 },
  btnRound: { sheet: 'ui', index: 39 },
};

export function loadImages() {
  const entries = Object.entries(SHEETS);
  return Promise.all(
    entries.map(
      ([key, sheet]) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve([key, img]);
          img.onerror = () => reject(new Error(`failed to load ${sheet.src}`));
          img.src = sheet.src;
        }),
    ),
  ).then((pairs) => Object.fromEntries(pairs));
}

/**
 * Drawer bound to a 2D context. draw(name, x, y, opts) where (x, y) is the sprite's bottom-centre in
 * world/screen units. opts: { frame, flip, scale, rot, alpha, anchor: 'bc' | 'tl' | 'c' }.
 */
export function createSpriteDrawer(ctx, images, pixelSprites = {}) {
  ctx.imageSmoothingEnabled = false;

  function source(name, frame = 0) {
    const px = pixelSprites[name];
    if (px) return { img: px.canvas, sx: 0, sy: 0, sw: px.w, sh: px.h };
    const def = SPRITES[name];
    if (!def) throw new Error(`unknown sprite ${name}`);
    const sheet = SHEETS[def.sheet];
    const img = images[def.sheet];
    const index = def.frames ? def.frames[frame % def.frames.length] : def.index;
    const col = index % sheet.cols;
    const row = Math.floor(index / sheet.cols);
    return { img, sx: col * sheet.tile, sy: row * sheet.tile, sw: sheet.tile, sh: sheet.tile };
  }

  function size(name) {
    const s = source(name);
    return { w: s.sw * PIXEL_SCALE, h: s.sh * PIXEL_SCALE };
  }

  function draw(name, x, y, opts = {}) {
    const { frame = 0, flip = false, scale = 1, rot = 0, alpha = 1, anchor = 'bc' } = opts;
    const s = source(name, frame);
    if (!s.img) return;
    const w = s.sw * PIXEL_SCALE * scale;
    const h = s.sh * PIXEL_SCALE * scale;
    let ox = -w / 2;
    let oy = -h;
    if (anchor === 'tl') {
      ox = 0;
      oy = 0;
    } else if (anchor === 'c') {
      oy = -h / 2;
    }
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (alpha !== 1) ctx.globalAlpha = alpha;
    // snap to the pixel grid to avoid shimmer
    ctx.translate(Math.round(x / PIXEL_SCALE) * PIXEL_SCALE, Math.round(y / PIXEL_SCALE) * PIXEL_SCALE);
    if (rot) ctx.rotate(rot);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(s.img, s.sx, s.sy, s.sw, s.sh, ox, oy, w, h);
    ctx.restore();
  }

  // Tile a sprite horizontally from x0 to x1 (top-left anchored).
  function strip(name, x0, x1, y, opts = {}) {
    const { w } = size(name);
    const start = Math.floor(x0 / w) * w;
    for (let x = start; x < x1; x += w) draw(name, x, y, { ...opts, anchor: 'tl' });
  }

  return { draw, size, strip, source };
}
