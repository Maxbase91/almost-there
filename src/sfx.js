// Tiny WebAudio sound effects. No asset files. Unlocked on first user gesture.

let ctx = null;

function ac() {
  if (ctx) return ctx;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

export function unlock() {
  const a = ac();
  if (a && a.state === 'suspended') a.resume().catch(() => {});
}

function tone({ type = 'square', from = 440, to = from, dur = 0.12, gain = 0.08, delay = 0 }) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  jump: () => tone({ type: 'square', from: 300, to: 620, dur: 0.14, gain: 0.05 }),
  splat: () => tone({ type: 'sawtooth', from: 180, to: 40, dur: 0.3, gain: 0.1 }),
  scratch: () => tone({ type: 'sawtooth', from: 900, to: 60, dur: 0.45, gain: 0.08 }),
  tick: () => tone({ type: 'sine', from: 900, to: 900, dur: 0.05, gain: 0.04 }),
  fanfare: () => {
    tone({ type: 'triangle', from: 523, dur: 0.14, gain: 0.07 });
    tone({ type: 'triangle', from: 659, dur: 0.14, gain: 0.07, delay: 0.14 });
    tone({ type: 'triangle', from: 784, dur: 0.3, gain: 0.08, delay: 0.28 });
  },
};
