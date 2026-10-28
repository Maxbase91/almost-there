// Game modes as skins over the same course (D20). A theme only changes words and pictures:
// hazard type ids, physics and the course generator are shared, so autopilot and tests hold for both.
// Pure data: no DOM, safe to import from tests.

import { HAZARD_TYPES } from './game.js';

export const MODES = ['cake', 'office'];
export const DEFAULT_MODE = 'cake';

export function isMode(m) {
  return MODES.includes(m);
}

const cake = {
  id: 'cake',
  journalKey: 'almost-there:v2',
  // Sprite and text overrides for the renderer; the cake theme is the renderer's built-in default.
  art: {},
  say: {},
  hazards: {},
  scene: 'meadow',
  text: {
    beam: 'MIND YOUR HEAD',
    pigMarker: '< OINK',
    dark: 'WHO TURNED OFF THE LIGHTS',
    dim: 'WHO DIMMED THE LIGHTS',
    headwind: '<< HEADWIND',
    tailwind: 'TAILWIND >>',
    sliding: 'SLIDING!',
    win: 'CAKE DELIVERED!',
    winSub: 'YOU ACTUALLY MADE IT',
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
    const titles = { mole: 'The mole got you.', pendulum: 'The spiked ball got you.', egg: 'An egg landed on you.', knife: 'A knife landed on you.', chick: 'You hit a chicken.', bro: 'The finance bro got you.', slime: 'You jumped into the slime.', cow: 'You ran into the cow.', snake: 'You stepped on the snake.' };
    return titles[h.type] ?? t;
  },
};

const office = {
  id: 'office',
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
  },
  scene: 'office',
  beamColors: ['#2684ff', '#1e5bb8'],
  text: {
    beam: 'SYNERGY',
    pigMarker: '< STANDUP',
    dark: 'INSTALLING UPDATE 1 OF 47',
    dim: 'INSTALLING UPDATES',
    headwind: '<< PRIORITY SHIFT',
    tailwind: 'FAST TRACK >>',
    sliding: 'SLIDING!',
    win: 'PROJECT DELIVERED!',
    winSub: 'ON TIME. NOBODY BELIEVES IT',
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
    };
    if (h.type === 'crack') return h.bro ? 'You fell in the backlog.' : 'Tech debt opened under you.';
    return titles[h.type] ?? `You hit the ${h.label}.`;
  },
};

export const THEMES = { cake, office };

export function getTheme(mode) {
  return THEMES[isMode(mode) ? mode : DEFAULT_MODE];
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
