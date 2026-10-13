// Hand-pixeled sprites for things no CC0 pack has (pig, dog, cat, cake, table, banana, clock, ...).
// Each sprite is a string grid; one character = one pixel. Built into offscreen canvases at load.

const PALETTE = {
  '.': null,
  K: '#2b2b3a', // outline
  W: '#ffffff',
  w: '#e8e8f0',
  P: '#f4a0b5', // pink
  p: '#ffd3df', // light pink
  M: '#e0698c', // deep pink
  R: '#e5484d',
  r: '#ff8a80',
  Y: '#ffd166',
  y: '#fff1b5',
  O: '#f59e42',
  B: '#8d5a2b', // brown
  b: '#c98a4b', // light brown
  d: '#5a3a1e', // dark brown
  G: '#5fbf5a',
  g: '#2f8f4e',
  L: '#5fb3ff',
  l: '#bfe4ff',
  S: '#8a8fa3', // grey
  s: '#c9cdd9', // light grey
  T: '#f1c9a5', // skin
  D: '#45485c', // dark grey
  E: '#111118', // near black
  V: '#6c5ce7', // purple
};

const ART = {
  // 16x16, faces left
  pig: [
    '................',
    '................',
    '....KKKKKKKK....',
    '...KPPPPPPPPK...',
    '..KPPPPPPPPPPK..',
    '.KPPPPPPPPPPPPK.',
    '.KPKEPPPPPPPPPK.',
    '.KPPPPPPPPPPPPK.',
    'KMKMKPPPPPPPPPK.',
    'KMMMKPPPPPPPPPK.',
    '.KKKKPPPPPPPPPK.',
    '..KPPPPPPPPPPK..',
    '...KPPKKPPKKK...',
    '...KPPK.KPPK....',
    '...KKKK.KKKK....',
    '................',
  ],
  // 16x16, faces left
  dog: [
    '................',
    '.KK.............',
    'KbbK.KKKKKKK....',
    'KbbbKbbbbbbbKKK.',
    'KbEbbbbbbbbbbbbK',
    'KbbbbbbbbbbbbbbK',
    'KKbbbbbbbbbbbKK.',
    '.KEKbbbbbbbbbK..',
    '.KKKbbbbbbbbbK..',
    '...KbbbbbbbbbK..',
    '...KbbKKKKKbbK..',
    '...KbbK...KbbK..',
    '...KbbK...KbbK..',
    '...KKKK...KKKK..',
    '................',
    '................',
  ],
  // 16x16, sitting cat facing left
  cat: [
    '................',
    '..K.......K.....',
    '.KSK.....KSK....',
    '.KSSKKKKKSSK....',
    '.KSSSSSSSSSK....',
    '.KSESSSSSESK....',
    '.KSSSSPSSSSK....',
    '..KSSSSSSSK.....',
    '...KSSSSSSSK....',
    '..KSSSSSSSSSK...',
    '..KSSSSSSSSSSK..',
    '..KSSSSSSSSSSK.K',
    '..KSSSSSSSSSSKSK',
    '..KSSKSSSSSKSSK.',
    '..KKKKKKKKKKKK..',
    '................',
  ],
  // 16x16 cake on a plate with a candle
  cake: [
    '.......Y........',
    '.......O........',
    '.......L........',
    '.......L........',
    '...KKKKKKKKKK...',
    '..KWWWWWWWWWWK..',
    '..KWMWMWMWMWWK..',
    '..KPPPPPPPPPPK..',
    '..KPPPPPPPPPPK..',
    '..KWWWWWWWWWWK..',
    '..KPPPPPPPPPPK..',
    '..KPPPPPPPPPPK..',
    '.KKKKKKKKKKKKKK.',
    'KssssssssssssssK',
    '.KKKKKKKKKKKKKK.',
    '................',
  ],
  // 16x8 splatted cake
  cakeSplat: [
    '................',
    '......Y.........',
    '....KKOKK.......',
    '..KKPPPPPKK.....',
    '.KPPMPPPPMPPK...',
    'KPPPPPPPPPPPPPK.',
    'KKKKKKKKKKKKKKKK',
    '................',
  ],
  // 16x16 cake with DISPLAY sticker
  cakeDisplay: [
    '.......Y........',
    '.......O........',
    '.......L........',
    '...KKKKKKKKKK...',
    '..KWWWWWWWWWWK..',
    '..KWMWMWMWMWWK..',
    '..KPPPPPPPPPPK..',
    '.KYYYYYYYYYYYYK.',
    '.KYKKYKYKKYKKYK.',
    '.KYYYYYYYYYYYYK.',
    '..KPPPPPPPPPPK..',
    '..KPPPPPPPPPPK..',
    '.KKKKKKKKKKKKKK.',
    'KssssssssssssssK',
    '.KKKKKKKKKKKKKK.',
    '................',
  ],
  // 32x16 party table with cloth
  table: [
    '................................',
    '................................',
    '................................',
    '................................',
    'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
    'KWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWK',
    'KPWPWPWPWPWPWPWPWPWPWPWPWPWPWPWK',
    'KWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWK',
    'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
    '..KBBK..................KBBK....',
    '..KBBK..................KBBK....',
    '..KBBK..................KBBK....',
    '..KBBK..................KBBK....',
    '..KBBK..................KBBK....',
    '..KBBK..................KBBK....',
    '..KKKK..................KKKK....',
  ],
  // 32x16 collapsed table
  tableBroken: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '..........................KKKK..',
    '.....................KKKKKWWWWK.',
    '................KKKKKWWWWWPWPWK.',
    '...........KKKKKWWWWWPWPWWWWWWK.',
    '......KKKKKWWWWWPWPWWWWWWKKKKK..',
    '.KKKKKWWWWWPWPWWWWWWKKKKK.......',
    'KWWWWWPWPWWWWWWKKKKK.KBBK..KBBK.',
    'KKKKKKKKKKKKKKK..KBK.KKKK..KKKK.',
    '.KBBK........KBBK...............',
  ],
  // 8x16 balloon
  balloon: [
    '..KKKK..',
    '.KRRRRK.',
    'KRRrRRRK',
    'KRrRRRRK',
    'KRRRRRRK',
    'KRRRRRRK',
    '.KRRRRK.',
    '..KRRK..',
    '...KK...',
    '...KK...',
    '....K...',
    '...K....',
    '....K...',
    '...K....',
    '....K...',
    '........',
  ],
  // 12x8 banana
  banana: [
    '..........K.',
    '.........KYK',
    '........KYYK',
    'K......KYYK.',
    'KYK...KYYK..',
    '.KYYKKYYK...',
    '..KYYYYK....',
    '...KKKK.....',
  ],
  // 16x16 alarm clock
  clock: [
    '..KK......KK....',
    '.KRRK....KRRK...',
    'KRRRRK..KRRRRK..',
    '.KKKKKKKKKKKK...',
    '...KWWWWWWK.....',
    '..KWWWWWWWWK....',
    '.KWWWKWWWWWWK...',
    '.KWWWKWWWWWWK...',
    '.KWWWKKKWWWWK...',
    '.KWWWWWWWWWWK...',
    '..KWWWWWWWWK....',
    '...KWWWWWWK.....',
    '....KKKKKK......',
    '...KK....KK.....',
    '..KK......KK....',
    '................',
  ],
  // 16x8 skateboard
  skate: [
    '................',
    '..KKKKKKKKKKKK..',
    '.KbbbbbbbbbbbbK.',
    'KbbbbbbbbbbbbbbK',
    '.KKKKKKKKKKKKKK.',
    '...KDK....KDK...',
    '..KDDDK..KDDDK..',
    '...KKK....KKK...',
  ],
  // 16x24 referee (striped shirt, cap)
  referee: [
    '....KKKKKK......',
    '...KEEEEEEK.....',
    '..KEEEEEEEEK....',
    '..KKKKKKKKKK....',
    '..KTTTTTTTTK....',
    '..KTETTTTETK....',
    '..KTTTTTTTTK....',
    '...KTTTTTTK.....',
    '....KKKKKK......',
    '..KKWWWWWWKK....',
    '.KEEWWWWWWEEK...',
    '.KEEEEEEEEEEK...',
    '.KEEWWWWWWEEK...',
    '.KKKEEEEEEKKK...',
    '...KWWWWWWK.....',
    '...KEEEEEEK.....',
    '...KKKKKKKK.....',
    '...KDDDKDDDK....',
    '...KDDDKDDDK....',
    '...KDDDKDDDK....',
    '...KDDDKDDDK....',
    '...KDDDKDDDK....',
    '..KKKKKKKKKKK...',
    '................',
  ],
  // 16x24 repo man (suit, briefcase)
  repoman: [
    '....KKKKKK......',
    '...KDDDDDDK.....',
    '..KDDDDDDDDK....',
    '..KTTTTTTTTK....',
    '..KTETTTTETK....',
    '..KTTTTTTTTK....',
    '...KTTTTTTK.....',
    '....KKKKKK......',
    '..KKEEWWEEKK....',
    '.KEEEEWWEEEEK...',
    '.KEEEEWWEEEEK...',
    '.KEEEEWWEEEEK...',
    '.KEEEEEEEEEEKKKK',
    '.KEEEEEEEEEEKBBK',
    '.KKKKEEEEKKKKBBK',
    '...KEEEEEEK.KKKK',
    '...KEEEEEEK.....',
    '...KEEEKEEEK....',
    '...KEEEKEEEK....',
    '...KEEEKEEEK....',
    '...KEEEKEEEK....',
    '..KKKKKKKKKKK...',
    '................',
    '................',
  ],
  // 16x8 rain cloud (dark)
  cloudDark: [
    '....KKKKK.......',
    '..KKSSSSSKK.....',
    '.KSSSSSSSSSKKK..',
    'KSSSSSSSSSSSSSK.',
    'KSSSSSSSSSSSSSSK',
    'KSSSSSSSSSSSSSSK',
    '.KKKKKKKKKKKKKK.',
    '................',
  ],
  // 16x8 sunny cloud (white)
  cloudWhite: [
    '....KKKKK.......',
    '..KKWWWWWKK.....',
    '.KWWWWWWWWWKKK..',
    'KWWWWWWWWWWWWWK.',
    'KWWWWWWWWWWWWWWK',
    'KWWWWWWWWWWWWWWK',
    '.KKKKKKKKKKKKKK.',
    '................',
  ],
  // 8x8 sprinkler head
  sprinkler: [
    '...KK...',
    '..KSSK..',
    '.KSSSSK.',
    'KSSSSSSK',
    'KKKKKKKK',
    '.KLKKLK.',
    '..L..L..',
    '.L....L.',
  ],
  // 8x12 flame
  flame: [
    '....Y...',
    '...YO...',
    '..YOOY..',
    '..YORO..',
    '.YORROY.',
    '.YORRROY',
    'YORRRROY',
    'YORRRROY',
    'YORRRRO.',
    '.YORRO..',
    '..YOO...',
    '...Y....',
  ],
  // 16x8 snake (faces left)
  snake: [
    '................',
    '.KKK............',
    'KGEGK...KKKK....',
    'KGGGGKKKGGGGKKK.',
    '.KGGGGGGGGGGGGGK',
    '..KKGGGKKKKGGGK.',
    '....KKK...KKKK..',
    '................',
  ],
  // 16x6 mole mound
  mound: [
    '......KKKK......',
    '....KKBBBBKK....',
    '..KKBBbbbbBBKK..',
    'KKBBBbbbbbbBBBKK',
    'KBBBBBBBBBBBBBBK',
    'KKKKKKKKKKKKKKKK',
  ],
  // 16x14 mole popped up
  mole: [
    '.....KKKKKK.....',
    '....KDDDDDDK....',
    '...KDDDDDDDDK...',
    '...KDEDDDDEDK...',
    '...KDDDPPDDDK...',
    '...KDDDDDDDDK...',
    '..KDDDDDDDDDDK..',
    '..KDDDDDDDDDDK..',
    '.KTKDDDDDDDDKTK.',
    '.KTTKDDDDDDKTTK.',
    '..KKKDDDDDDKKK..',
    '....KKBBBBKK....',
    '..KKBBbbbbBBKK..',
    'KKBBBBBBBBBBBBKK',
  ],
  // 6x16 knife (point down)
  knife: [
    '.KBBK.',
    '.KBBK.',
    '.KBBK.',
    'KKssKK',
    'KssssK',
    '.KssK.',
    '.KssK.',
    '.KssK.',
    '.KssK.',
    '.KssK.',
    '.KssK.',
    '.KssK.',
    '..KsK.',
    '..KsK.',
    '..KK..',
    '...K..',
  ],
  // 8x10 egg
  egg: [
    '...KK...',
    '..KWWK..',
    '.KWWWWK.',
    '.KWwWWK.',
    'KWWWWWWK',
    'KWWWWWWK',
    'KWWWWWWK',
    '.KWWWWK.',
    '..KWWK..',
    '...KK...',
  ],
  // 16x16 tumbleweed
  tumbleweed: [
    '.....KKKKKK.....',
    '...KKbBbbBbKK...',
    '..KbBbbbbbbBbK..',
    '.KBbbbBbbBbbbBK.',
    '.KbbBbbbbbbBbbK.',
    'KbBbbbbBBbbbbBbK',
    'KbbbbBbbbbBbbbbK',
    'KBbbbbbbbbbbbbBK',
    'KbbbBbbbbbbBbbbK',
    'KbbbbbbBBbbbbbbK',
    '.KBbbbbbbbbbBbK.',
    '.KbbbBbbBbbbbbK.',
    '..KbbbbbbbbbbK..',
    '...KKbBbbBbKK...',
    '.....KKKKKK.....',
    '................',
  ],
  // 12x8 spring (trampoline)
  spring: [
    '.KKKKKKKKKK.',
    'KRRRRRRRRRRK',
    '.KKKKKKKKKK.',
    '..KsK..KsK..',
    '..KsK..KsK..',
    '..KsK..KsK..',
    '.KKKKKKKKKK.',
    'KDDDDDDDDDDK',
  ],
  // 8x12 lantern (night)
  lantern: [
    '...KK...',
    '..KBBK..',
    '.KKKKKK.',
    '.KYYYYK.',
    '.KYyyYK.',
    '.KYyyYK.',
    '.KYYYYK.',
    '.KKKKKK.',
    '...KK...',
    '...KK...',
    '...KK...',
    '..KKKK..',
  ],
  // 6x8 phone (finance bro)
  phone: [
    'KKKKKK',
    'KLLLLK',
    'KLGGLK',
    'KLGLLK',
    'KLLLLK',
    'KLLLLK',
    'KKKKKK',
    '..KK..',
  ],
  // 8x8 heart
  heart: [
    '.KK..KK.',
    'KRRKKRRK',
    'KRRRRRRK',
    'KRrRRRRK',
    '.KRRRRK.',
    '..KRRK..',
    '...KK...',
    '........',
  ],
  // 16x12 whistle
  whistle: [
    '................',
    '..KKKKKKKKKKK...',
    '.KsssssssssssK..',
    '.KsKsssssssssKK.',
    '.KsssssssssssssK',
    '..KKKKKssssssssK',
    '......KssssssssK',
    '......KsssKKKKK.',
    '......KsssK.....',
    '......KKKKK.....',
    '................',
    '................',
  ],
};

export function buildPixelSprites() {
  const out = {};
  const hasDoc = typeof document !== 'undefined';
  for (const [name, rows] of Object.entries(ART)) {
    const h = rows.length;
    const w = rows[0].length;
    for (const r of rows) if (r.length !== w) throw new Error(`pixelart ${name}: ragged row`);
    if (!hasDoc) {
      out[name] = { w, h, canvas: null };
      continue;
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = PALETTE[rows[y][x]];
        if (c === undefined) throw new Error(`pixelart ${name}: unknown colour '${rows[y][x]}'`);
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    out[name] = { w, h, canvas };
  }
  return out;
}

export const PIXEL_NAMES = Object.keys(ART);
