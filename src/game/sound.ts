// ============ SFX & MÚSICA 8-BIT SINTETIZADOS (WebAudio) ============
let actx: AudioContext | null = null;
let muted = false;
let bgMusicPlaying = false;
let musicTimer: number | null = null;

export function initAudio() {
  if (!actx) {
    try { actx = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { /* sem áudio */ }
  }
  if (actx?.state === 'suspended') actx.resume();
  startBgMusic();
}
export function setMuted(m: boolean) {
  muted = m;
  if (m) stopBgMusic();
  else if (!bgMusicPlaying) startBgMusic();
}
export function isMuted() { return muted; }

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0) {
  if (!actx || muted) return;
  try {
    const t0 = actx.currentTime + delay;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(actx.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  } catch { /* ignore */ }
}
function noise(dur: number, vol: number, delay = 0) {
  if (!actx || muted) return;
  try {
    const t0 = actx.currentTime + delay;
    const len = Math.max(1, Math.floor(actx.sampleRate * dur));
    const buf = actx.createBuffer(1, len, actx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = actx.createBufferSource(); src.buffer = buf;
    const g = actx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    src.connect(f); f.connect(g); g.connect(actx.destination);
    src.start(t0);
  } catch { /* ignore */ }
}

export const sfx = {
  hit() { noise(0.06, 0.10); tone(180, 0.06, 'square', 0.04, 90); },
  crit() { noise(0.09, 0.14); tone(300, 0.1, 'square', 0.06, 120); },
  cast() { tone(520, 0.12, 'sine', 0.06, 900); },
  ult() { tone(200, 0.3, 'sawtooth', 0.07, 600); tone(400, 0.3, 'sine', 0.05, 1200, 0.05); },
  kill() { tone(392, 0.1, 'square', 0.07); tone(523, 0.1, 'square', 0.07, undefined, 0.09); tone(784, 0.22, 'square', 0.08, undefined, 0.18); },
  doubleKill() { tone(523, 0.12, 'square', 0.08); tone(659, 0.12, 'square', 0.08, undefined, 0.12); tone(784, 0.25, 'square', 0.09, undefined, 0.24); },
  tripleKill() { tone(523, 0.1, 'square', 0.08); tone(659, 0.1, 'square', 0.08, undefined, 0.1); tone(784, 0.1, 'square', 0.09, undefined, 0.2); tone(1046, 0.3, 'square', 0.1, undefined, 0.3); },
  quadraKill() { [523, 659, 784, 987, 1174].forEach((f, i) => tone(f, 0.12, 'sawtooth', 0.08, undefined, i * 0.09)); },
  pentaKill() { [523, 659, 784, 1046, 1318, 1567].forEach((f, i) => tone(f, 0.18, 'sawtooth', 0.1, undefined, i * 0.1)); },
  ace() { tone(392, 0.2, 'square', 0.08); tone(523, 0.3, 'sawtooth', 0.09, undefined, 0.2); tone(659, 0.4, 'square', 0.1, undefined, 0.4); },
  death() { tone(220, 0.4, 'sawtooth', 0.09, 60); noise(0.25, 0.1); },
  levelup() { tone(523, 0.09, 'square', 0.06); tone(659, 0.09, 'square', 0.06, undefined, 0.08); tone(784, 0.09, 'square', 0.06, undefined, 0.16); tone(1046, 0.2, 'square', 0.07, undefined, 0.24); },
  gold() { tone(1200, 0.05, 'square', 0.05); tone(1600, 0.08, 'square', 0.05, undefined, 0.05); },
  buy() { tone(800, 0.06, 'square', 0.06); tone(1200, 0.1, 'square', 0.06, undefined, 0.06); },
  error() { tone(140, 0.15, 'square', 0.07, 90); },
  tower() { noise(0.3, 0.16); tone(120, 0.35, 'sawtooth', 0.08, 45); },
  objective() { tone(262, 0.15, 'square', 0.07); tone(330, 0.15, 'square', 0.07, undefined, 0.12); tone(392, 0.15, 'square', 0.07, undefined, 0.24); tone(523, 0.3, 'square', 0.08, undefined, 0.36); },
  click() { tone(900, 0.03, 'square', 0.03); },
  ping() { tone(1320, 0.08, 'sine', 0.07); tone(1760, 0.12, 'sine', 0.06, undefined, 0.08); },
  recall() { tone(440, 0.2, 'sine', 0.05, 880); tone(660, 0.25, 'sine', 0.05, 1320, 0.15); },
};

// Música chiptune procedural em loop leve
const MELODY = [261.63, 293.66, 329.63, 392.00, 329.63, 293.66, 261.63, 196.00];
let noteIdx = 0;
export function startBgMusic() {
  if (bgMusicPlaying || muted) return;
  bgMusicPlaying = true;
  const loop = () => {
    if (!bgMusicPlaying || muted) return;
    const freq = MELODY[noteIdx % MELODY.length];
    tone(freq, 0.35, 'triangle', 0.015);
    tone(freq / 2, 0.35, 'sine', 0.02);
    noteIdx++;
    musicTimer = window.setTimeout(loop, 400);
  };
  loop();
}
export function stopBgMusic() {
  bgMusicPlaying = false;
  if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
}
