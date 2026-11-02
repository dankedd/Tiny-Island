/**
 * All sound is made live with the Web Audio API, so the app ships without any audio files.
 * Effects are short synth notes; the music is a slow, gentle pentatonic tune over soft waves.
 */

type Settings = { sfx: boolean; music: boolean };

let ctx: AudioContext | null = null;
let master: GainNode;
let sfxBus: GainNode;
let musicBus: GainNode;
let musicTimer = 0;
let ocean: AudioBufferSourceNode | null = null;
const settings: Settings = loadSettings();

function loadSettings(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem('sound-settings') || '{}');
    return { sfx: s.sfx !== false, music: s.music !== false };
  } catch {
    return { sfx: true, music: true };
  }
}
function saveSettings(): void {
  try { localStorage.setItem('sound-settings', JSON.stringify(settings)); } catch { /* fine */ }
}

/** Must be called from a tap: browsers and iOS only allow sound after the player touches the screen. */
export function unlockAudio(): void {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = settings.sfx ? 0.55 : 0; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = settings.music ? 0.22 : 0; musicBus.connect(master);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  if (settings.music) startMusic();
}

export const soundOn = () => settings.sfx;
export const musicOn = () => settings.music;
export function toggleSfx(): boolean {
  settings.sfx = !settings.sfx; saveSettings();
  if (ctx) sfxBus.gain.setTargetAtTime(settings.sfx ? 0.55 : 0, ctx.currentTime, 0.05);
  if (settings.sfx) play('tap');
  return settings.sfx;
}
export function toggleMusic(): boolean {
  settings.music = !settings.music; saveSettings();
  if (ctx) {
    musicBus.gain.setTargetAtTime(settings.music ? 0.22 : 0, ctx.currentTime, 0.3);
    if (settings.music) startMusic(); else stopMusic();
  }
  return settings.music;
}

// ---------- building blocks ----------
function note(freq: number, start: number, dur: number, opts: { type?: OscillatorType; vol?: number; bus?: GainNode; slideTo?: number } = {}): void {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(freq, start);
  if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(opts.slideTo, start + dur);
  const v = opts.vol ?? 0.5;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(v, start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(opts.bus ?? sfxBus);
  o.start(start);
  o.stop(start + dur + 0.05);
}

function noiseBuffer(seconds: number): AudioBuffer {
  const b = ctx!.createBuffer(1, ctx!.sampleRate * seconds, ctx!.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function splash(start: number, vol = 0.4, dur = 0.35): void {
  if (!ctx) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(dur);
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(1800, start); f.frequency.exponentialRampToValueAtTime(400, start + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, start); g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  src.connect(f).connect(g).connect(sfxBus);
  src.start(start);
}

// ---------- effects ----------
export type Sfx = 'tap' | 'select' | 'place' | 'upgrade' | 'night' | 'coin' | 'cast' | 'catch' | 'perfect' | 'miss' | 'pirates' | 'victory' | 'defeat' | 'end' | 'error';

export function play(name: Sfx): void {
  if (!ctx || !settings.sfx) return;
  const t = ctx.currentTime + 0.01;
  switch (name) {
    case 'tap': note(880, t, 0.06, { type: 'triangle', vol: 0.25 }); break;
    case 'select': note(660, t, 0.08, { type: 'triangle', vol: 0.3 }); note(990, t + 0.05, 0.1, { type: 'triangle', vol: 0.25 }); break;
    case 'place':
      note(180, t, 0.18, { type: 'sine', vol: 0.7, slideTo: 90 });
      note(520, t, 0.08, { type: 'triangle', vol: 0.2 });
      splash(t, 0.12, 0.12);
      break;
    case 'upgrade': [523, 659, 784, 1047].forEach((f, i) => note(f, t + i * 0.07, 0.25, { type: 'triangle', vol: 0.3 })); break;
    case 'night': [392, 330, 262].forEach((f, i) => note(f, t + i * 0.22, 0.9, { type: 'sine', vol: 0.3 })); break;
    case 'coin': note(1319, t, 0.08, { type: 'square', vol: 0.08 }); note(1760, t + 0.06, 0.15, { type: 'square', vol: 0.08 }); break;
    case 'cast': splash(t + 0.15, 0.25, 0.3); note(700, t, 0.2, { type: 'sine', vol: 0.15, slideTo: 300 }); break;
    case 'catch': splash(t, 0.3, 0.3); [659, 784, 988].forEach((f, i) => note(f, t + 0.1 + i * 0.08, 0.2, { type: 'triangle', vol: 0.3 })); break;
    case 'perfect': splash(t, 0.3, 0.3); [784, 988, 1175, 1568].forEach((f, i) => note(f, t + 0.1 + i * 0.08, 0.3, { type: 'triangle', vol: 0.3 })); break;
    case 'miss': splash(t, 0.25, 0.3); note(330, t + 0.1, 0.35, { type: 'triangle', vol: 0.25, slideTo: 220 }); break;
    case 'pirates':
      note(110, t, 0.9, { type: 'sawtooth', vol: 0.12 }); note(147, t + 0.05, 0.9, { type: 'sawtooth', vol: 0.1 });
      note(98, t + 0.6, 1.1, { type: 'sawtooth', vol: 0.12 });
      break;
    case 'victory': [523, 659, 784].forEach((f, i) => note(f, t + i * 0.12, 0.4, { type: 'triangle', vol: 0.3 })); note(1047, t + 0.36, 0.7, { type: 'triangle', vol: 0.3 }); break;
    case 'defeat': [392, 349, 311].forEach((f, i) => note(f, t + i * 0.2, 0.45, { type: 'triangle', vol: 0.25 })); break;
    case 'end': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => note(f, t + i * 0.13, 0.5, { type: 'triangle', vol: 0.3 })); break;
    case 'error': note(200, t, 0.15, { type: 'square', vol: 0.06 }); break;
  }
}

// ---------- music ----------
// C major pentatonic, two octaves. The tune wanders by small steps so it never feels busy.
const SCALE = [262, 294, 330, 392, 440, 523, 587, 659, 784, 880];
const CHORDS = [[131, 196, 262], [110, 165, 220], [175, 262, 349], [147, 220, 294]];

function startMusic(): void {
  if (!ctx || musicTimer) return;
  startOcean();
  let step = 0, idx = 5, bar = 0;
  const beat = 0.5;
  let next = ctx.currentTime + 0.2;
  const tick = () => {
    if (!ctx) return;
    while (next < ctx.currentTime + 1.2) {
      if (step % 8 === 0) {
        const ch = CHORDS[bar % CHORDS.length];
        ch.forEach(f => note(f, next, beat * 7.5, { type: 'sine', vol: 0.09, bus: musicBus }));
        bar++;
      }
      if (Math.random() < 0.62) {
        idx = Math.max(0, Math.min(SCALE.length - 1, idx + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
        note(SCALE[idx], next, beat * 1.8, { type: 'triangle', vol: 0.12, bus: musicBus });
      }
      next += beat;
      step++;
    }
  };
  tick();
  musicTimer = window.setInterval(tick, 300);
}

function stopMusic(): void {
  clearInterval(musicTimer);
  musicTimer = 0;
  if (ocean) { try { ocean.stop(); } catch { /* already stopped */ } ocean = null; }
}

function startOcean(): void {
  if (!ctx || ocean) return;
  ocean = ctx.createBufferSource();
  ocean.buffer = noiseBuffer(4);
  ocean.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
  const g = ctx.createGain(); g.gain.value = 0.12;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.12;
  const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.09;
  lfo.connect(lfoGain).connect(g.gain);
  lfo.start();
  ocean.connect(f).connect(g).connect(musicBus);
  ocean.start();
}

/** Pause everything when the app goes to the background. */
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) void ctx.suspend(); else void ctx.resume();
});
