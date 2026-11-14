// Shared AudioContext, microphone pitch engine, and a reference-tone synth.
import { Yin, Tracker } from './pitch.js';
import * as store from './store.js';
import { swaraHz } from './theory.js';
import { chromaFromSpectrum } from './finder.js';

let ctx = null;
export function getCtx() {
  if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; ctx = new AC({ latencyHint: 'interactive' }); }
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  return ctx;
}

// ---- Microphone engine: one shared instance, many listeners ----
export const mic = {
  active: false, stream: null, last: null,
  chroma: new Float64Array(12), chromaSec: 0,   // spectrum chroma since the last reset (for songs with accompaniment)
  chromaReset() { this.chroma.fill(0); this.chromaSec = 0; },
  _ls: new Set(), _st: new Set(),
  on(fn) { this._ls.add(fn); return () => this._ls.delete(fn); },
  onState(fn) { this._st.add(fn); return () => this._st.delete(fn); },
  _emit() { this._st.forEach(f => f(this.active)); },

  async start() {
    if (this.active) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      const e = new Error(window.isSecureContext ? 'This browser does not provide microphone access.' : 'The microphone needs a secure (https) address. Open the app from its https link or from the installed home-screen icon.');
      e.name = 'Unavailable'; throw e;
    }
    const s = store.get();
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: !!s.micEC, noiseSuppression: !!s.micNS, autoGainControl: false, channelCount: 1 } });
    const c = getCtx(); await c.resume();
    this.src = c.createMediaStreamSource(this.stream);
    this.an = c.createAnalyser();
    this.yin = new Yin(c.sampleRate);
    let n = 2048; while (n < this.yin.need) n *= 2;
    this.an.fftSize = n; this.an.smoothingTimeConstant = 0;
    this.src.connect(this.an);
    // A second, long analyser gives the fine frequency resolution chroma needs.
    this.an2 = c.createAnalyser(); this.an2.fftSize = 16384; this.an2.smoothingTimeConstant = 0;
    this.src.connect(this.an2);
    this.spec = new Float32Array(this.an2.frequencyBinCount); this.mags = new Float32Array(this.an2.frequencyBinCount);
    this.cframe = new Float64Array(12); this._tick = 0;
    this.buf = new Float32Array(n);
    this.tracker = new Tracker();
    this.t0 = performance.now();
    this.active = true; this._emit();
    try { this.wake = await navigator.wakeLock?.request('screen'); } catch { /* optional */ }
    // Analysis runs on a timer, not on animation frames, so it keeps its pace even if drawing is throttled.
    const step = () => {
      if (!this.active) return;
      const now = performance.now();
      this.an.getFloatTimeDomainData(this.buf);
      const st = store.get();
      const r = this.yin.detect(this.buf, st.gate);
      const voiced = r.freq > 0 && r.conf >= st.minConf;
      const tk = this.tracker.push(voiced ? r.freq : 0);
      const frame = { t: (now - this.t0) / 1000, freq: tk.freq, conf: r.conf, rms: r.rms, stab: tk.stab, std: tk.std };
      if (++this._tick % 5 === 0 && r.rms > st.gate) {
        this.an2.getFloatFrequencyData(this.spec);
        for (let i = 0; i < this.spec.length; i++) this.mags[i] = 10 ** (this.spec[i] / 20);
        this.cframe.fill(0);
        const tot = chromaFromSpectrum(this.mags, c.sampleRate, this.an2.fftSize, st.a4, this.cframe);
        if (tot > 0) { const w = Math.min(1, r.rms / 0.02); for (let i = 0; i < 12; i++) this.chroma[i] += this.cframe[i] / tot * w; this.chromaSec += 0.15; }
      }
      this.last = frame;
      this._ls.forEach(f => f(frame));
    };
    this.timer = setInterval(step, 30);
  },

  stop() {
    if (!this.active) return;
    this.active = false; clearInterval(this.timer);
    try { this.src.disconnect(); this.an2.disconnect(); } catch { /* already gone */ }
    this.stream.getTracks().forEach(t => t.stop());
    this.stream = null; this.last = null;
    try { this.wake?.release(); } catch { /* ignore */ }
    this._emit();
  },
};

export function micErrorText(e) {
  if (e.name === 'NotAllowedError' || e.name === 'SecurityError') return 'Microphone permission was denied. Allow microphone access for this app in your browser or phone settings, then try again.';
  if (e.name === 'NotFoundError') return 'No microphone was found on this device.';
  return e.message || 'Could not start the microphone.';
}

// ---- Reference tone (soft flute-like partials) ----
let live = [];
export function tone(freq, { when = 0, dur = 0.9, vol = 0.3 } = {}) {
  const c = getCtx(), t = Math.max(c.currentTime + 0.03, when);
  const out = c.createGain();
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(vol, t + 0.06);
  out.gain.setValueAtTime(vol, t + Math.max(0.07, dur - 0.14));
  out.gain.linearRampToValueAtTime(0, t + dur);
  const oscs = [[1, 1], [2, 0.26], [3, 0.09], [4, 0.03]].map(([k, a]) => {
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.value = freq * k; g.gain.value = a; o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05); return o;
  });
  out.connect(c.destination);
  const h = { out, oscs, end: t + dur };
  live.push(h);
  oscs[0].onended = () => { out.disconnect(); live = live.filter(x => x !== h); };
  return h;
}
let timers = [];
export function stopTones() {
  const c = getCtx();
  timers.forEach(clearTimeout); timers = [];
  for (const h of live) { try { h.out.gain.cancelScheduledValues(c.currentTime); h.out.gain.setTargetAtTime(0, c.currentTime, 0.02); h.oscs.forEach(o => o.stop(c.currentTime + 0.15)); } catch { /* ended */ } }
}
// notes: [{semi, beats}] relative to Sa. onStep(i) fires as each note sounds; onStep(-1) at the end.
export function playSemis(notes, { beat = 0.45, onStep } = {}) {
  stopTones();
  const s = store.get(), c = getCtx();
  const sa = s.a4 * 2 ** ((12 * (s.saOct + 1) + s.saPc - 69) / 12) * 2 ** (s.fine / 1200);
  let t = c.currentTime + 0.06;
  notes.forEach((n, i) => {
    const d = n.beats * beat;
    tone(swaraHz(sa, n.semi, s.temperament), { when: t, dur: d * 0.98 + 0.05 });
    if (onStep) timers.push(setTimeout(() => onStep(i), (t - c.currentTime) * 1000));
    t += d;
  });
  if (onStep) timers.push(setTimeout(() => onStep(-1), (t - c.currentTime) * 1000 + 60));
  return t - c.currentTime;
}
