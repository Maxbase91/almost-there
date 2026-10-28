// Web Audio playback for the CC0 sound set in assets/audio (see assets/LICENSES.md).
// Music starts only after the first user gesture; mute is persisted.

const MUTE_KEY = 'almost-there:mute';

const SFX = {
  jump: 'assets/audio/jump.ogg',
  doublejump: 'assets/audio/jump2.ogg',
  hit: 'assets/audio/hit.ogg',
  oink: 'assets/audio/oink.ogg',
  flap: 'assets/audio/flap.ogg',
  fanfare: 'assets/audio/fanfare.ogg',
  lose: 'assets/audio/lose.ogg',
  click: 'assets/audio/click.ogg',
  error: 'assets/audio/error.ogg',
  splat: 'assets/audio/splat.ogg',
};
const MUSIC = 'assets/audio/music.ogg';

export function createAudio() {
  let ctx = null;
  const buffers = {};
  let musicBuffer = null;
  let musicSource = null;
  let musicGain = null;
  let sfxGain = null;
  let muted = false;
  try {
    muted = localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    muted = false;
  }

  function ensureCtx() {
    if (ctx) return ctx;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    musicGain = ctx.createGain();
    sfxGain = ctx.createGain();
    musicGain.gain.value = muted ? 0 : 0.35;
    sfxGain.gain.value = muted ? 0 : 0.8;
    musicGain.connect(ctx.destination);
    sfxGain.connect(ctx.destination);
    return ctx;
  }

  async function fetchBuffer(url) {
    const c = ensureCtx();
    if (!c) return null;
    try {
      const res = await fetch(url);
      const data = await res.arrayBuffer();
      return await c.decodeAudioData(data);
    } catch {
      return null;
    }
  }

  let loading = null;
  function load() {
    if (loading) return loading;
    loading = (async () => {
      if (!ensureCtx()) return;
      await Promise.all(
        Object.entries(SFX).map(async ([k, url]) => {
          buffers[k] = await fetchBuffer(url);
        }),
      );
      musicBuffer = await fetchBuffer(MUSIC);
    })();
    return loading;
  }

  function unlock() {
    const c = ensureCtx();
    if (!c) return;
    // iOS reports 'interrupted' after a call or app switch; any non-running state needs a resume from a gesture.
    if (c.state !== 'running') c.resume().catch(() => {});
    load().then(startMusic);
  }

  function startMusic() {
    if (!ctx || !musicBuffer || musicSource) return;
    musicSource = ctx.createBufferSource();
    musicSource.buffer = musicBuffer;
    musicSource.loop = true;
    musicSource.connect(musicGain);
    musicSource.start();
  }

  function play(name, { volume = 1, rate = 1 } = {}) {
    if (!ctx || !buffers[name]) return;
    const src = ctx.createBufferSource();
    src.buffer = buffers[name];
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = volume;
    src.connect(g).connect(sfxGain);
    src.start();
  }

  // Pause music while the tab is hidden; the next tap (unlock) resumes it if the browser refuses here.
  function setHidden(hidden) {
    if (!ctx) return;
    (hidden ? ctx.suspend() : ctx.resume()).catch(() => {});
  }

  function setMuted(on) {
    muted = !!on;
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (musicGain) musicGain.gain.value = muted ? 0 : 0.35;
    if (sfxGain) sfxGain.gain.value = muted ? 0 : 0.8;
  }

  return {
    unlock,
    load,
    setHidden,
    play,
    setMuted,
    get muted() {
      return muted;
    },
  };
}
