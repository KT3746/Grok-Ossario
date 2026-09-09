let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfx: GainNode | null = null;
let music: GainNode | null = null;
let muted = false;
let ambTimer = 0;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C({ latencyHint: "interactive" });
    master = ctx.createGain();
    sfx = ctx.createGain();
    music = ctx.createGain();
    sfx.gain.value = 0.7;
    music.gain.value = 0.22;
    master.gain.value = muted ? 0 : 0.85;
    sfx.connect(master);
    music.connect(master);
    master.connect(ctx.destination);
  }
  return ctx;
}

export function unlockAudio() {
  const c = ac();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
}

export function setMuted(v: boolean) {
  muted = v;
  if (master && ctx) {
    master.gain.setTargetAtTime(v ? 0 : 0.85, ctx.currentTime, 0.04);
  }
}

function envGain(c: AudioContext, dest: AudioNode, start: number, peak: number, attack: number, release: number) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + attack + release);
  g.connect(dest);
  return g;
}

function noise(c: AudioContext, dur: number) {
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  return src;
}

export function sfxStep() {
  const c = ac();
  if (!c || !sfx) return;
  const t = c.currentTime;
  const src = noise(c, 0.08);
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 420 + Math.random() * 180;
  src.connect(f);
  const g = envGain(c, sfx, t, 0.22, 0.005, 0.07);
  f.connect(g);
  src.start(t);
  src.stop(t + 0.09);
}

export function sfxSwing() {
  const c = ac();
  if (!c || !sfx) return;
  const t = c.currentTime;
  const src = noise(c, 0.16);
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.setValueAtTime(900, t);
  f.frequency.exponentialRampToValueAtTime(1800, t + 0.08);
  f.Q.value = 2.4;
  src.connect(f);
  const g = envGain(c, sfx, t, 0.35, 0.01, 0.12);
  f.connect(g);
  src.start(t);
  src.stop(t + 0.16);
}

export function sfxHit(heavy = false) {
  const c = ac();
  if (!c || !sfx) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(heavy ? 90 : 140, t);
  osc.frequency.exponentialRampToValueAtTime(50, t + 0.12);
  const g = envGain(c, sfx, t, heavy ? 0.45 : 0.32, 0.004, 0.14);
  osc.connect(g);
  osc.start(t);
  osc.stop(t + 0.16);
  const n = noise(c, 0.1);
  const f = c.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = 900;
  n.connect(f);
  const g2 = envGain(c, sfx, t, 0.28, 0.003, 0.08);
  f.connect(g2);
  n.start(t);
  n.stop(t + 0.1);
}

export function sfxUi() {
  const c = ac();
  if (!c || !sfx) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.value = 520 + Math.random() * 40;
  const g = envGain(c, sfx, t, 0.12, 0.004, 0.05);
  osc.connect(g);
  osc.start(t);
  osc.stop(t + 0.06);
}

export function sfxChest() {
  const c = ac();
  if (!c || !sfx) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(220, t);
  osc.frequency.exponentialRampToValueAtTime(440, t + 0.12);
  const g = envGain(c, sfx, t, 0.22, 0.01, 0.16);
  osc.connect(g);
  osc.start(t);
  osc.stop(t + 0.18);
}

export function sfxDeny() {
  const c = ac();
  if (!c || !sfx) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(140, t);
  osc.frequency.exponentialRampToValueAtTime(70, t + 0.12);
  const g = envGain(c, sfx, t, 0.18, 0.005, 0.12);
  osc.connect(g);
  osc.start(t);
  osc.stop(t + 0.14);
}

export function sfxHeal() {
  const c = ac();
  if (!c || !sfx) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(420, t);
  osc.frequency.exponentialRampToValueAtTime(720, t + 0.18);
  const g = envGain(c, sfx, t, 0.18, 0.01, 0.2);
  osc.connect(g);
  osc.start(t);
  osc.stop(t + 0.22);
}

export function sfxDeath() {
  const c = ac();
  if (!c || !sfx) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(110, t);
  osc.frequency.exponentialRampToValueAtTime(38, t + 0.7);
  const g = envGain(c, sfx, t, 0.3, 0.02, 0.7);
  osc.connect(g);
  osc.start(t);
  osc.stop(t + 0.75);
}

export function sfxWin() {
  const c = ac();
  if (!c || !sfx) return;
  const t = c.currentTime;
  for (const [i, f] of [330, 440, 550].entries()) {
    const osc = c.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = f;
    const g = envGain(c, sfx, t + i * 0.07, 0.16, 0.01, 0.18);
    osc.connect(g);
    osc.start(t + i * 0.07);
    osc.stop(t + i * 0.07 + 0.22);
  }
}

export function tickAmbience(now: number) {
  if (muted) return;
  const c = ac();
  if (!c || !music) return;
  if (now < ambTimer) return;
  ambTimer = now + 900 + Math.random() * 1400;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.value = 48 + Math.random() * 18;
  const g = envGain(c, music, t, 0.07, 0.4, 1.6);
  osc.connect(g);
  osc.start(t);
  osc.stop(t + 2.1);
}

if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", unlockAudio, { once: true });
  window.addEventListener("keydown", unlockAudio, { once: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") unlockAudio();
  });
}
