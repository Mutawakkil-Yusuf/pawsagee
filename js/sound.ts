// Pawsage sound design. Everything is synthesized with WebAudio, so there are no audio files to download.
// Palette: soft sine "bubbles", glassy triangle chimes, and a small synthesized meow for Mochi.
import { prefs } from './store';

let ctx: AudioContext | null = null, master: GainNode | null = null;
let enabled = prefs.get<boolean>('sound', true) !== false;

const AC: typeof AudioContext | undefined = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
function ac(): AudioContext | null {
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export const soundOn = () => enabled;
export function setSound(v: boolean) { enabled = !!v; prefs.set('sound', enabled); if (enabled) sfx.pop(); }

/** One enveloped oscillator note. */
interface ToneOpts { f?: number; t?: number; d?: number; type?: OscillatorType; v?: number; slide?: number; a?: number; lp?: number }
function tone({ f = 440, t = 0, d = 0.16, type = 'sine', v = 0.22, slide = 0, a = 0.006, lp = 0 }: ToneOpts) {
  const c = ac(); if (!c || !enabled || !master) return;
  const t0 = c.currentTime + t;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t0 + d);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(v, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  let node: AudioNode = o;
  if (lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl); node = fl; }
  node.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + d + 0.05);
}

const N = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, E6: 1318.5, G6: 1568, G4: 392, E4: 329.63, C4: 261.63 };

export const sfx = {
  tap() { tone({ f: 620, d: 0.07, type: 'sine', v: 0.12, slide: 0.8 }); },
  pop() { tone({ f: 420, d: 0.12, v: 0.2, slide: 2.2 }); },
  toggleOn() { tone({ f: 520, d: 0.09, v: 0.16 }); tone({ f: 780, t: 0.07, d: 0.12, v: 0.16 }); },
  toggleOff() { tone({ f: 640, d: 0.09, v: 0.14 }); tone({ f: 420, t: 0.07, d: 0.12, v: 0.12 }); },
  step(up = true) { tone({ f: up ? 700 : 560, d: 0.05, type: 'triangle', v: 0.1 }); },
  swish() { tone({ f: 300, d: 0.18, type: 'sawtooth', v: 0.035, slide: 3, lp: 1800 }); },
  add() { [N.E5, N.A5, N.C6].forEach((f, i) => tone({ f, t: i * 0.07, d: 0.2, type: 'triangle', v: 0.17 })); },
  start() { tone({ f: N.G4, d: 0.14, type: 'triangle', v: 0.17 }); tone({ f: N.C5, t: 0.09, d: 0.2, type: 'triangle', v: 0.17 }); },
  pause() { tone({ f: N.C5, d: 0.12, type: 'triangle', v: 0.14 }); tone({ f: N.G4, t: 0.08, d: 0.18, type: 'triangle', v: 0.14 }); },
  finish() { [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => tone({ f, t: i * 0.08, d: 0.32, type: 'triangle', v: 0.18 })); },
  chime() { [N.E6, N.G6].forEach((f, i) => tone({ f, t: i * 0.12, d: 0.7, v: 0.12 })); },
  error() { tone({ f: 330, d: 0.12, type: 'triangle', v: 0.14 }); tone({ f: 262, t: 0.1, d: 0.2, type: 'triangle', v: 0.14 }); },
  fanfare() {
    [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => tone({ f, t: i * 0.1, d: 0.35, type: 'triangle', v: 0.2 }));
    [N.E6, N.G6, N.E6, N.G6].forEach((f, i) => tone({ f, t: 0.5 + i * 0.09, d: 0.5, v: 0.1 }));
    tone({ f: N.C5, t: 0.45, d: 1.1, type: 'sine', v: 0.14 });
    tone({ f: N.G5, t: 0.45, d: 1.1, type: 'sine', v: 0.1 });
  },
  /** A tiny synthesized meow: a gliding triangle through a moving low-pass, with a little vibrato. */
  meow() {
    const c = ac(); if (!c || !enabled) return;
    const t0 = c.currentTime, d = 0.5;
    const o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter();
    const lfo = c.createOscillator(), lg = c.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(520, t0);
    o.frequency.exponentialRampToValueAtTime(900, t0 + 0.14);
    o.frequency.exponentialRampToValueAtTime(430, t0 + d);
    fl.type = 'lowpass'; fl.Q.value = 3;
    fl.frequency.setValueAtTime(700, t0);
    fl.frequency.exponentialRampToValueAtTime(2600, t0 + 0.14);
    fl.frequency.exponentialRampToValueAtTime(600, t0 + d);
    lfo.frequency.value = 22; lg.gain.value = 14; lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(fl); fl.connect(g); if (master) g.connect(master);
    o.start(t0); lfo.start(t0); o.stop(t0 + d + 0.05); lfo.stop(t0 + d + 0.05);
  },
  purr() {
    const c = ac(); if (!c || !enabled) return;
    const t0 = c.currentTime, d = 0.9;
    const o = c.createOscillator(), g = c.createGain(), am = c.createOscillator(), ag = c.createGain();
    o.type = 'sawtooth'; o.frequency.value = 52;
    am.frequency.value = 24; ag.gain.value = 0.5; am.connect(ag);
    const out = c.createGain(); out.gain.value = 0.5; ag.connect(out.gain);
    const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 260;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(fl); fl.connect(out); out.connect(g); if (master) g.connect(master);
    o.start(t0); am.start(t0); o.stop(t0 + d + 0.05); am.stop(t0 + d + 0.05);
  },
};

export const buzz = (ms: number | number[]) => { if (enabled && navigator.vibrate) try { navigator.vibrate(ms); } catch { /* unsupported */ } };

// One delegated listener gives every tappable thing a soft tap. data-sfx="name" picks a sound, data-sfx="none" silences.
document.addEventListener('click', e => {
  const t = (e.target as Element)?.closest?.('[data-sfx], a, button, .chip, [role=button], [role=switch], [role=tab]') as HTMLElement | null;
  if (!t || (t as HTMLButtonElement).disabled) return;
  const name = t.dataset.sfx;
  if (name === 'none') return;
  if (name && name in sfx) (sfx as unknown as Record<string, () => void>)[name](); else sfx.tap();
  if (t.matches('.btn.primary, .nv a')) buzz(8);
}, true);
