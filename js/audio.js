// Tiny synthesized sound effects (no audio files to ship or license).

let ctx = null;
let master = null;
let enabled = true;
let coinStreak = 0;
let lastCoinAt = 0;

export function setSoundEnabled(on) { enabled = on; }

export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
}

function tone({ freq = 440, to = null, type = 'sine', dur = 0.12, vol = 0.3, delay = 0, attack = 0.005 }) {
  if (!enabled || !ctx) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.3, vol = 0.3, from = 2000, to = 200, type = 'lowpass', delay = 0 }) {
  if (!enabled || !ctx) return;
  const t0 = ctx.currentTime + delay;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(from, t0);
  f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

// Pentatonic steps so rapid coin pickups climb a pleasant scale.
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

export const sfx = {
  coin() {
    const now = performance.now();
    coinStreak = now - lastCoinAt < 450 ? Math.min(coinStreak + 1, SCALE.length - 1) : 0;
    lastCoinAt = now;
    const f = 880 * Math.pow(2, SCALE[coinStreak] / 12);
    tone({ freq: f, type: 'square', dur: 0.07, vol: 0.08 });
    tone({ freq: f * 1.5, type: 'sine', dur: 0.12, vol: 0.12, delay: 0.03 });
  },
  gem() {
    [0, 4, 7, 12].forEach((s, i) => tone({ freq: 1046 * Math.pow(2, s / 12), type: 'triangle', dur: 0.18, vol: 0.18, delay: i * 0.05 }));
  },
  gate() { tone({ freq: 320, to: 420, type: 'triangle', dur: 0.06, vol: 0.07 }); },
  close() {
    noise({ dur: 0.25, vol: 0.25, from: 6000, to: 800, type: 'bandpass' });
    tone({ freq: 600, to: 1200, type: 'sine', dur: 0.15, vol: 0.12 });
  },
  power() {
    [0, 4, 7, 11, 14].forEach((s, i) => tone({ freq: 523 * Math.pow(2, s / 12), type: 'square', dur: 0.1, vol: 0.07, delay: i * 0.045 }));
  },
  frenzy() {
    tone({ freq: 200, to: 1600, type: 'sawtooth', dur: 0.6, vol: 0.12 });
    noise({ dur: 0.6, vol: 0.15, from: 500, to: 8000, type: 'bandpass' });
  },
  smash() { noise({ dur: 0.18, vol: 0.3, from: 3000, to: 300 }); },
  shieldPop() { tone({ freq: 900, to: 200, type: 'triangle', dur: 0.25, vol: 0.2 }); noise({ dur: 0.2, vol: 0.2 }); },
  crash() {
    noise({ dur: 0.6, vol: 0.5, from: 1800, to: 80 });
    tone({ freq: 160, to: 40, type: 'sine', dur: 0.5, vol: 0.5 });
  },
  tap() { tone({ freq: 700, type: 'sine', dur: 0.05, vol: 0.08 }); },
  buy() {
    [0, 7, 12, 16].forEach((s, i) => tone({ freq: 660 * Math.pow(2, s / 12), type: 'triangle', dur: 0.2, vol: 0.15, delay: i * 0.07 }));
  },
  levelUp() {
    [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone({ freq: 523 * Math.pow(2, s / 12), type: 'square', dur: 0.14, vol: 0.08, delay: i * 0.07 }));
  },
  zone() { tone({ freq: 392, to: 784, type: 'sine', dur: 0.5, vol: 0.12 }); tone({ freq: 587, to: 1174, type: 'sine', dur: 0.5, vol: 0.08, delay: 0.1 }); },
  error() { tone({ freq: 220, type: 'square', dur: 0.12, vol: 0.08 }); tone({ freq: 180, type: 'square', dur: 0.15, vol: 0.08, delay: 0.1 }); },
};
