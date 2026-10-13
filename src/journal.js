// Failure Journal persistence. Storage is injectable so it can be tested without a browser.

export const STORAGE_KEY = 'almost-there:v2';

const EMPTY = () => ({ seen: [], attempts: 0, best: 0, wins: 0, bestM: 0, deaths: {} });

function safeStorage(storage) {
  if (storage) return storage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadJournal(storage) {
  const st = safeStorage(storage);
  if (!st) return EMPTY();
  try {
    const raw = st.getItem(STORAGE_KEY);
    if (!raw) return EMPTY();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return EMPTY();
    const deaths = {};
    if (parsed.deaths && typeof parsed.deaths === 'object') {
      for (const [k, v] of Object.entries(parsed.deaths)) if (typeof k === 'string' && Number.isFinite(v)) deaths[k] = v;
    }
    return {
      seen: Array.isArray(parsed.seen) ? parsed.seen.filter((x) => typeof x === 'string') : [],
      attempts: Number.isFinite(parsed.attempts) ? parsed.attempts : 0,
      best: Number.isFinite(parsed.best) ? Math.min(parsed.best, 99.9) : 0,
      wins: Number.isFinite(parsed.wins) ? parsed.wins : 0,
      bestM: Number.isFinite(parsed.bestM) ? Math.min(parsed.bestM, 100) : 0,
      deaths,
    };
  } catch {
    return EMPTY();
  }
}

export function saveJournal(journal, storage) {
  const st = safeStorage(storage);
  if (!st) return false;
  try {
    st.setItem(STORAGE_KEY, JSON.stringify({ ...journal, best: Math.min(journal.best, 99.9) }));
    return true;
  } catch {
    return false;
  }
}

export function markSeen(journal, endingId) {
  if (journal.seen.includes(endingId)) return journal;
  return { ...journal, seen: [...journal.seen, endingId] };
}

export function recordAttempt(journal, best) {
  return { ...journal, attempts: journal.attempts + 1, best: Math.min(Math.max(journal.best, best), 99.9) };
}

export function recordRun(journal, { distanceM, won, deathType = null }) {
  const deaths = { ...journal.deaths };
  if (deathType) deaths[deathType] = (deaths[deathType] ?? 0) + 1;
  return {
    ...journal,
    attempts: journal.attempts + 1,
    wins: journal.wins + (won ? 1 : 0),
    bestM: Math.min(100, Math.max(journal.bestM ?? 0, Math.round(distanceM * 10) / 10)),
    deaths,
  };
}
