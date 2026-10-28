import { describe, it, expect } from 'vitest';
import { HAZARD_TYPES } from '../src/game.js';
import { THEMES, MODES, getTheme, isMode, hazardText, deathText, journalLabel } from '../src/themes.js';
import { buildPixelSprites, PIXEL_NAMES } from '../src/pixelart.js';
import { SPRITES } from '../src/sprites.js';
import { loadJournal, saveJournal, recordRun, STORAGE_KEY } from '../src/journal.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _map: m };
}

describe('themes', () => {
  it('knows exactly the cake and office modes and falls back to cake', () => {
    expect(MODES).toEqual(['cake', 'office']);
    expect(isMode('office')).toBe(true);
    expect(isMode('__proto__')).toBe(false);
    expect(getTheme('nope').id).toBe('cake');
    expect(getTheme(null).id).toBe('cake');
  });

  it('gives every hazard type a label in every theme, and office its own label for each', () => {
    for (const type of Object.keys(HAZARD_TYPES)) {
      for (const theme of Object.values(THEMES)) expect(hazardText(theme, type).label).toBeTruthy();
      expect(THEMES.office.hazards[type], type).toBeDefined();
      expect(THEMES.office.hazards[type].label).not.toBe(HAZARD_TYPES[type].label);
    }
  });

  it('only points sprite slots at sprites that exist', () => {
    const known = new Set([...PIXEL_NAMES, ...Object.keys(SPRITES)]);
    for (const theme of Object.values(THEMES)) for (const name of Object.values(theme.art)) expect(known.has(name), name).toBe(true);
  });

  it('builds all pixel art (no ragged rows, no unknown colours)', () => {
    expect(() => buildPixelSprites()).not.toThrow();
  });

  it('keeps the cake death screen copy word for word', () => {
    const cake = THEMES.cake;
    const at = (type, extra = {}) => deathText(cake, { type, ...extra }).title;
    expect(at('fence')).toBe('You hit the fence.');
    expect(at('skate')).toBe('You hit the skateboard.');
    expect(at('pig')).toBe('The pig got you.');
    expect(at('pit')).toBe('You fell in the hole.');
    expect(at('pitwide')).toBe('You fell in the big hole.');
    expect(at('crack', { state: 'open' })).toBe('The ground opened under you.');
    expect(at('crack', { state: 'open', bro: true })).toBe('You fell in the dip.');
    expect(at('meteor')).toBe('A crate fell on you.');
    expect(at('bro')).toBe('The finance bro got you.');
    expect(deathText(cake, { type: 'dog' }).line).toBe(HAZARD_TYPES.dog.line);
  });

  it('names office deaths after office things', () => {
    const office = THEMES.office;
    expect(deathText(office, { type: 'pig' }).title).toBe('The scrum master got you.');
    expect(deathText(office, { type: 'fence' }).title).toBe('You hit the printer.');
    expect(deathText(office, { type: 'crack', bro: true }).title).toBe('You fell in the backlog.');
    expect(deathText(office, { type: 'chick' }).line).toMatch(/blockers/);
  });

  it('labels the run log per theme', () => {
    expect(journalLabel(THEMES.cake, 'peel')).toBe('banana');
    expect(journalLabel(THEMES.cake, 'dog')).toBe('dog');
    expect(journalLabel(THEMES.office, 'chick')).toBe('Jira ticket');
  });

  it('translates every bubble the simulation emits for animals and bros', () => {
    for (const word of ['MOO', 'BAWK', 'sss', 'BUY THE DIP', 'HODL', 'OINK', 'CAKE!']) expect(THEMES.office.say[word], word).toBeTruthy();
  });
});

describe('journal per mode', () => {
  it('keeps the office journal apart from the cake journal, which keeps its original key', () => {
    const st = fakeStorage();
    expect(THEMES.cake.journalKey).toBe(STORAGE_KEY);
    const office = recordRun(loadJournal(st, THEMES.office.journalKey), { distanceM: 12, won: false, deathType: 'pig' });
    saveJournal(office, st, THEMES.office.journalKey);
    expect(loadJournal(st).attempts).toBe(0);
    expect(loadJournal(st, THEMES.office.journalKey)).toMatchObject({ attempts: 1, deaths: { pig: 1 } });
    expect([...st._map.keys()]).toEqual([THEMES.office.journalKey]);
  });
});
