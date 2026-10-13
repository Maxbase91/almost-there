import { describe, it, expect } from 'vitest';
import { loadJournal, saveJournal, markSeen, recordAttempt, recordRun, STORAGE_KEY } from '../src/journal.js';

function fakeStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    _map: m,
  };
}

describe('journal', () => {
  it('returns an empty journal when nothing is stored or storage is unavailable', () => {
    expect(loadJournal(fakeStorage())).toEqual({ seen: [], attempts: 0, best: 0, wins: 0, bestM: 0, deaths: {} });
    expect(loadJournal(null)).toEqual({ seen: [], attempts: 0, best: 0, wins: 0, bestM: 0, deaths: {} });
  });

  it('round-trips through storage', () => {
    const st = fakeStorage();
    let j = loadJournal(st);
    j = markSeen(j, 'banana');
    j = markSeen(j, 'pigeon');
    j = recordAttempt(j, 98.4);
    expect(saveJournal(j, st)).toBe(true);
    expect(loadJournal(st)).toEqual({ seen: ['banana', 'pigeon'], attempts: 1, best: 98.4, wins: 0, bestM: 0, deaths: {} });
  });

  it('markSeen is idempotent', () => {
    let j = { seen: ['cat'], attempts: 0, best: 0 };
    j = markSeen(j, 'cat');
    expect(j.seen).toEqual(['cat']);
  });

  it('falls back to empty on corrupt or hostile data', () => {
    expect(loadJournal(fakeStorage({ [STORAGE_KEY]: '{not json' }))).toEqual({ seen: [], attempts: 0, best: 0, wins: 0, bestM: 0, deaths: {} });
    expect(loadJournal(fakeStorage({ [STORAGE_KEY]: '"string"' }))).toEqual({ seen: [], attempts: 0, best: 0, wins: 0, bestM: 0, deaths: {} });
    const j = loadJournal(fakeStorage({ [STORAGE_KEY]: JSON.stringify({ seen: [1, 'x', null], attempts: 'a', best: 150 }) }));
    expect(j).toEqual({ seen: ['x'], attempts: 0, best: 99.9, wins: 0, bestM: 0, deaths: {} });
  });

  it('best never reaches 100 and never decreases', () => {
    let j = { seen: [], attempts: 0, best: 99.1 };
    j = recordAttempt(j, 97.2);
    expect(j.best).toBe(99.1);
    j = recordAttempt(j, 100);
    expect(j.best).toBe(99.9);
    expect(j.attempts).toBe(2);
  });

  it('survives a throwing storage', () => {
    const bad = {
      getItem() {
        throw new Error('quota');
      },
      setItem() {
        throw new Error('quota');
      },
    };
    expect(loadJournal(bad)).toEqual({ seen: [], attempts: 0, best: 0, wins: 0, bestM: 0, deaths: {} });
    expect(saveJournal({ seen: [], attempts: 0, best: 0 }, bad)).toBe(false);
  });

  it('recordRun tracks tries, wins, honest best distance and deaths by hazard', () => {
    let j = loadJournal(fakeStorage());
    j = recordRun(j, { distanceM: 12.34, won: false, deathType: 'bee' });
    j = recordRun(j, { distanceM: 100, won: true });
    j = recordRun(j, { distanceM: 120, won: false, deathType: 'bee' });
    expect(j.attempts).toBe(3);
    expect(j.wins).toBe(1);
    expect(j.bestM).toBe(100);
    expect(j.deaths).toEqual({ bee: 2 });
  });
});
