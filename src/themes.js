// Levels as skins over the same simulation (D20, D22). A level only changes words, pictures, backdrops and the
// course profile (pool weights and limits): hazard type ids and physics are shared, so the autopilot and the
// fairness tests hold for every level. Two families: 'cake' (deliver something) and 'office' (ship something).
// The cake and office levels below are the family bases; the others live in src/levels/ as plain data and
// inherit whatever they do not override. Schema: docs/LEVELS.md.
// Pure data: no DOM, safe to import from tests.

import { HAZARD_TYPES, makeProfile } from './game.js';
import wedding from './levels/wedding.js';
import pumpkin from './levels/pumpkin.js';
import pizza from './levels/pizza.js';
import xmas from './levels/xmas.js';
import quarter from './levels/quarter.js';
import cloud from './levels/cloud.js';
import offsite from './levels/offsite.js';
import tender from './levels/tender.js';

export const MODES = ['cake', 'office']; // the two families
export const DEFAULT_MODE = 'cake';

export function isMode(m) {
  return MODES.includes(m);
}

const KENNEY_FAR = { shape: 'tiles', a: 'bgFar', b: 'bgFarB', fill: 'bgFarFill' };
const KENNEY_HILLS = { shape: 'tiles', a: 'bgHills', b: 'bgHillsB', fill: 'bgFill' };

const cake = {
  id: 'cake',
  family: 'cake',
  name: 'DELIVER THE CAKE',
  journalKey: 'almost-there:v2',
  // Sprite and text overrides for the renderer; the cake theme is the renderer's built-in default.
  art: {},
  say: {},
  hazards: {},
  scene: {
    stretches: [
      { name: 'MEADOW', kind: 'outdoor', sky: ['#5fb3ff', '#6fbcff', '#82c6ff', '#9ad3ff', '#b6e1ff', '#d2eeff'], orb: 'sun', far: { ...KENNEY_FAR, alpha: 0.75 }, mid: KENNEY_HILLS, clouds: true, ground: { tiles: 'grass' }, decor: ['sprout', 'bush', 'mushroom', 'sunflower', 'treeRound', 'hay', 'pine'], ambient: 'petals' },
      { name: 'DESERT', kind: 'outdoor', sky: ['#ffb26b', '#ffbe7d', '#ffc98f', '#ffd6a4', '#ffe2ba', '#ffecd0'], orb: 'bigsun', far: { ...KENNEY_FAR, alpha: 0.75 }, mid: { shape: 'tiles', a: 'bgDesert', b: 'bgDesertB', fill: 'bgDesertFill' }, clouds: true, ground: { tiles: 'sand' }, decor: ['cactus', 'cactusTall', 'cactus', 'tumbleweed', 'barrel'], ambient: 'dust' },
      { name: 'SNOW', kind: 'outdoor', sky: ['#9fc4e8', '#aecef0', '#bdd8f4', '#cde2f8', '#dcebfb', '#eaf3fd'], orb: 'sun', far: { ...KENNEY_FAR, alpha: 0.75 }, mid: KENNEY_FAR, clouds: true, ground: { tiles: 'snow' }, decor: ['pine', 'snowman', 'pine', 'sprout'], ambient: 'snow' },
      { name: 'NIGHT', kind: 'outdoor', sky: ['#0b1030', '#101640', '#171d4f', '#1e255d', '#262d6b', '#303878'], orb: 'moon', stars: true, far: { ...KENNEY_FAR, alpha: 0.35 }, mid: { ...KENNEY_HILLS, alpha: 0.5 }, clouds: true, ground: { tiles: 'grass' }, decor: ['lantern', 'bush', 'lantern', 'pine'], ambient: 'fireflies' },
    ],
  },
  growerStyle: 'stalk',
  growerColors: ['#5fbf5a', '#2f8f4e', '#bfe8a0'],
  canopyStyle: 'bunting',
  popupStyle: 'fog',
  text: {
    beam: 'MIND YOUR HEAD',
    canopy: 'ONE HOP ONLY',
    pigMarker: '< OINK',
    boomMarker: '< IT IS BACK',
    dark: 'WHO TURNED OFF THE LIGHTS',
    dim: 'WHO DIMMED THE LIGHTS',
    fog: 'FOG BANK',
    headwind: '<< HEADWIND',
    tailwind: 'TAILWIND >>',
    sliding: 'SLIDING!',
    win: 'CAKE DELIVERED!',
    winSub: 'YOU ACTUALLY MADE IT',
    popups: [],
  },
  sounds: {},
  dom: {
    loading: 'LOADING CAKE…',
    pitch: 'Carry the cake 100 m to the party.',
    winTitle: 'CAKE DELIVERED',
    rotate: 'ROTATE FOR THE FULL VIEW',
    closeJournal: 'BACK TO LOSING',
  },
  winLines: ['The kid is speechless. So are we.', 'Nobody expected that. Least of all the pig.', 'Frame this. It will not happen again soon.', 'The cake is slightly dented. Nobody minds.'],
  journalLabels: { pit: 'hole', pitwide: 'big hole', skate: 'skateboard', meteor: 'crate', peel: 'banana' },
  deathTitle(h) {
    let t = `You hit the ${h.label}.`;
    if (h.type === 'pig') t = 'The pig got you.';
    if (h.type === 'pit') t = 'You fell in the hole.';
    if (h.type === 'pitwide') t = 'You fell in the big hole.';
    if (h.type === 'meteor') t = 'A crate fell on you.';
    if (h.type === 'crack') t = h.bro ? 'You fell in the dip.' : 'The ground opened under you.';
    const titles = { mole: 'The mole got you.', pendulum: 'The spiked ball got you.', egg: 'An egg landed on you.', knife: 'A knife landed on you.', chick: 'You hit a chicken.', bro: 'The finance bro got you.', slime: 'You jumped into the slime.', cow: 'You ran into the cow.', snake: 'You stepped on the snake.', creep: 'You fell in the sinkhole.', boomerang: 'The boomerang came back.' };
    return titles[h.type] ?? t;
  },
};

// Same four stretches as the cake biomes: open-plan, server room, cold meeting room, after hours.
const OFFICE_ROOM = { kind: 'indoor', decor: ['plant'] };

const office = {
  id: 'office',
  family: 'office',
  name: 'SHIP THE PROJECT',
  journalKey: 'almost-there:office:v1',
  // Renderer sprite slots → hand-pixeled office art (src/pixelart.js).
  art: {
    cake: 'laptop',
    cakeSplat: 'laptopBroken',
    cakeDisplay: 'laptop',
    table: 'demoDesk',
    kid: 'client',
    balloon: 'balloonBlue',
    fence: 'printer',
    wall: 'firewall',
    wallTop: 'flame',
    rainCloud: 'acUnit',
    dog: 'customer',
    skate: 'mailCart',
    pigeon: 'paperPlane',
    bee: 'slackPing',
    meteor: 'scopeBox',
    peel: 'cable',
    cow: 'committee',
    chick: 'ticket',
    slime: 'ticketReopened',
    snake: 'paperTrail',
    mound: 'cubicle',
    mole: 'colleague',
    bro: 'coach',
    broProp: 'phone',
    pendulum: 'reorgBall',
    trampoline: 'spring',
    egg: 'email',
    knife: 'pen',
    pig: 'scrumMaster',
    boomerang: 'taskCard',
    creepPost: 'goalpost',
  },
  // In-world speech bubbles: the simulation emits the cake words, the office says these instead.
  say: {
    MOO: 'WHY ISN\'T IT DONE?',
    BAWK: 'BLOCKER',
    sss: 'PER MY LAST EMAIL',
    'BUY THE DIP': 'PIVOT!',
    HODL: 'VELOCITY!',
    OINK: 'STANDUP!',
    'CAKE!': 'SHIP IT!',
    WHOOSH: 'BACK TO YOU',
  },
  hazards: {
    fence: { label: 'printer', line: 'PC LOAD LETTER. It was also in the way.' },
    wall: { label: 'firewall', line: 'Port closed. That one needed a double jump.' },
    puddle: { label: 'AC leak', line: 'Facilities ticket opened in 2019.' },
    dog: { label: 'complaining customer', line: 'Actually, they wanted it in blue.' },
    skate: { label: 'mail cart', line: 'Nobody knows whose it is.' },
    pigeon: { label: 'paper plane', line: 'A memo, straight for the laptop.' },
    pig: { label: 'scrum master', line: 'You were supposed to be at standup.' },
    pit: { label: 'budget gap', line: 'It was in the forecast. It was also wide.' },
    pitwide: { label: 'missing requirements', line: 'Two jumps. Nobody wrote that down.' },
    bee: { label: 'Slack ping', line: 'Jumping at it was the wrong call. Ignore it.' },
    meteor: { label: 'scope creep', line: 'It came from above. The shadow was the hint.' },
    crack: { label: 'tech debt', line: 'The floor gave way. It rumbled for years.' },
    peel: { label: 'loose cable', line: 'You slid straight into the next thing.' },
    wind: { label: 'priority shift', line: '' },
    beam: { label: 'synergy banner', line: 'Low banner. Jumping under it was the mistake.' },
    cow: { label: 'steering committee', line: 'They were not in a hurry. You were.' },
    chick: { label: 'Jira ticket', line: 'Three blockers. You triaged two.' },
    slime: { label: 'reopened ticket', line: 'It was closed. Then it wasn\'t.' },
    snake: { label: 'approval chain', line: 'Longer than it looked. Per my last email.' },
    mole: { label: 'complaining colleague', line: 'Who approved this? Not you, apparently.' },
    bro: { label: 'agile coach', line: 'He pivoted. You fell in the backlog.' },
    pendulum: { label: 'reorg', line: 'It swings by every quarter. You jumped anyway.' },
    trampoline: { label: 'promotion', line: 'Up you go. Then the glass ceiling.' },
    egg: { label: 'reply-all', line: 'Fresh from the distribution list.' },
    knife: { label: 'pen', line: 'Who is throwing these?' },
    blackout: { label: 'forced update', line: '' },
    ice: { label: 'mopped floor', line: 'Nothing to grip. The sign was inside the cupboard.' },
    creep: { label: 'moving goalposts', line: 'The target was right there. Then it was closer.' },
    grower: { label: 'small ask', line: 'It was a quick favour. Then it had sub-tasks.' },
    canopy: { label: 'glass ceiling', line: 'One hop was fine. You aimed higher.' },
    boomerang: { label: 'delegated task', line: 'You handed it off. It came back.' },
    popup: { label: 'notification storm', line: '' },
  },
  scene: {
    stretches: [
      { ...OFFICE_ROOM, name: 'OPEN PLAN', wall: '#e9dcc3', trim: '#c9b48f', floor: '#7a8aa8', floorMark: '#8d9cb8', fill: '#3b4258', feature: 'window', win: '#9ad3ff', city: '#6fa9d6', decor: ['plant', 'cooler', 'plant', 'coffeeMachine'], ambient: 'paper' },
      { ...OFFICE_ROOM, name: 'SERVER ROOM', wall: '#5a6b88', trim: '#3d4a61', floor: '#b4bccb', floorMark: '#c9cdd9', fill: '#3b4258', feature: 'racks', ambient: 'sparks' },
      { ...OFFICE_ROOM, name: 'COLD MEETING ROOM', wall: '#dfe9f2', trim: '#a9bccd', floor: '#c9cdd9', floorMark: '#dde1ea', fill: '#4b5468', feature: 'window', win: '#eaf3fd', city: '#bdd8f4', decor: ['plant', 'cooler'], ambient: 'snow' },
      { ...OFFICE_ROOM, name: 'AFTER HOURS', wall: '#2a2440', trim: '#1b1730', floor: '#3d3a5c', floorMark: '#4a4770', fill: '#15131f', feature: 'window', win: '#101640', city: '#262d6b', lit: true, decor: ['plant', 'coffeeMachine'], ambient: 'dust' },
    ],
  },
  beamColors: ['#2684ff', '#1e5bb8'],
  growerStyle: 'stack',
  growerColors: ['#ffffff', '#c9cdd9', '#2684ff'],
  canopyStyle: 'glass',
  popupStyle: 'windows',
  text: {
    beam: 'SYNERGY',
    canopy: 'GLASS CEILING',
    pigMarker: '< STANDUP',
    boomMarker: '< BACK TO YOU',
    dark: 'INSTALLING UPDATE 1 OF 47',
    dim: 'INSTALLING UPDATES',
    fog: 'NOTIFICATIONS',
    headwind: '<< PRIORITY SHIFT',
    tailwind: 'FAST TRACK >>',
    sliding: 'SLIDING!',
    win: 'PROJECT DELIVERED!',
    winSub: 'ON TIME. NOBODY BELIEVES IT',
    popups: [
      ['CHAT', 'Got a sec?'],
      ['CALENDAR', 'Sync in 5 min'],
      ['MAIL', '47 unread'],
      ['UPDATE', 'Restart now?'],
      ['CHAT', 'Quick call?'],
      ['REMINDER', 'Timesheet due'],
    ],
  },
  sounds: { oink: 'error' },
  dom: {
    loading: 'LOADING PROJECT…',
    pitch: 'Ship the project 100 m to the go-live demo.',
    winTitle: 'PROJECT DELIVERED',
    rotate: 'ROTATE FOR THE FULL VIEW',
    closeJournal: 'BACK TO THE SPRINT',
  },
  winLines: ['The client is speechless. So is legal.', 'Nobody expected that. Least of all the scrum master.', 'Put it in the quarterly review. It will not happen again soon.', 'The laptop is slightly dented. Nobody minds.'],
  journalLabels: {},
  deathTitle(h) {
    const titles = {
      pig: 'The scrum master got you.',
      pit: 'You fell in the budget gap.',
      pitwide: 'You fell through the missing requirements.',
      meteor: 'Scope creep landed on you.',
      mole: 'The complaining colleague got you.',
      pendulum: 'The reorg got you.',
      egg: 'A reply-all landed on you.',
      knife: 'A pen landed on you.',
      chick: 'You hit a Jira ticket.',
      bro: 'The agile coach got you.',
      slime: 'You jumped into the reopened ticket.',
      cow: 'You ran into the steering committee.',
      snake: 'You stepped on the approval chain.',
      bee: 'You answered the Slack ping.',
      creep: 'The goalposts moved under you.',
      grower: 'The small ask got you.',
      boomerang: 'The delegated task came back.',
    };
    if (h.type === 'crack') return h.bro ? 'You fell in the backlog.' : 'Tech debt opened under you.';
    return titles[h.type] ?? `You hit the ${h.label}.`;
  },
};

cake.profile = makeProfile();
office.profile = makeProfile();

const BASES = { cake, office };
const MERGED = ['art', 'say', 'hazards', 'text', 'sounds', 'dom', 'journalLabels'];

// A level file (src/levels/<id>.js) overrides what it wants; everything else comes from its family base.
// Death titles are data there (deathTitles: { type: 'text', crack, crackBro }): a hazard the level relabels
// never falls back to the family's title, which would name the wrong thing.
export function deriveLevel(o) {
  const base = BASES[o.family];
  if (!base) throw new Error(`level ${o.id}: unknown family ${o.family}`);
  const level = { ...base, ...o };
  for (const k of MERGED) level[k] = { ...base[k], ...(o[k] ?? {}) };
  const titles = o.deathTitles ?? {};
  const relabelled = o.hazards ?? {};
  level.deathTitle = (h) => {
    if (h.type === 'crack' && (titles.crack || titles.crackBro)) return (h.bro ? titles.crackBro : titles.crack) ?? titles.crack ?? titles.crackBro;
    if (titles[h.type]) return titles[h.type];
    if (relabelled[h.type]?.label) return `You hit the ${h.label}.`;
    return base.deathTitle(h);
  };
  for (const t of Object.keys(relabelled)) if (!Object.hasOwn(o.journalLabels ?? {}, t)) delete level.journalLabels[t];
  level.profile = makeProfile(o.course ?? {});
  level.sprites = o.sprites ?? {};
  return level;
}

export const LEVELS = [cake, ...[wedding, pumpkin, pizza, xmas].map(deriveLevel), office, ...[quarter, cloud, offsite, tender].map(deriveLevel)];
export const THEMES = Object.fromEntries(LEVELS.map((l) => [l.id, l]));
export const DEFAULT_LEVEL = 'cake';

// Hand-pixeled sprites owned by level files, merged into the pixel-art atlas at load (src/pixelart.js).
export const LEVEL_SPRITES = Object.assign({}, ...LEVELS.map((l) => l.sprites ?? {}));

export function isLevel(id) {
  return typeof id === 'string' && Object.hasOwn(THEMES, id);
}

export function levelsOf(family) {
  return LEVELS.filter((l) => l.family === family);
}

export function getTheme(id) {
  return THEMES[isLevel(id) ? id : DEFAULT_LEVEL];
}

// Label and flavour line for a hazard type under a theme (falls back to the shared cake text).
export function hazardText(theme, type) {
  const base = HAZARD_TYPES[type] ?? { label: type, line: '' };
  const o = theme.hazards[type] ?? {};
  return { label: o.label ?? base.label, line: o.line ?? base.line };
}

// Title + line for the death screen.
export function deathText(theme, h) {
  const { label, line } = hazardText(theme, h.type);
  return { title: theme.deathTitle({ ...h, label }), line };
}

export function journalLabel(theme, type) {
  return theme.journalLabels[type] ?? hazardText(theme, type).label;
}
