// Tanpura: four plucked strings synthesised additively with a time-varying "jivari" formant sweep
// (the buzzing bridge that makes upper partials bloom after each pluck). Strings are rendered once
// per tuning with an OfflineAudioContext and then plucked in the traditional cycle.
import { getCtx } from './audio.js';
import * as store from './store.js';
import { saHz } from './theory.js';

export const FIRST = {
  P: { ratio: 3 / 4, label: 'Pa', desc: 'Pa – Sa – Sa – Sa · standard' },
  m: { ratio: 2 / 3, label: 'Ma', desc: 'Ma – Sa – Sa – Sa · raags without Pa' },
  N: { ratio: 15 / 16, label: 'Ni', desc: 'Ni – Sa – Sa – Sa · Marwa, Puriya, Sohini' },
  S: { ratio: 1, label: 'Sa', desc: 'Sa – Sa – Sa – Sa · neutral drone' },
};
export const TIMBRES = {
  concert: { label: 'Concert', bright: 0.6, tau: 2.9 },
  deep: { label: 'Deep', bright: 0.35, tau: 3.4 },
  bright: { label: 'Bright', bright: 0.95, tau: 2.4 },
};
const DUR = 7.5;

export function joraHz(s = store.get()) {
  let f = saHz(s);
  while (f >= 220) f /= 2;
  while (f < 110) f *= 2;
  return f * 2 ** (s.tanpura.register || 0);
}

async function renderString(f0, sr, { jivari, bright, tau }) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const oc = new OAC(1, Math.ceil(sr * DUR), sr);
  const H = Math.max(6, Math.min(44, Math.floor(7500 / f0)));
  const N = 160, cHi = 12 + 16 * bright, J = 0.6 + 3.2 * jivari;
  const master = oc.createGain(); master.gain.value = 0.2; master.connect(oc.destination);
  for (let k = 1; k <= H; k++) {
    const curve = new Float32Array(N);
    const A = (k === 1 ? 0.5 : 1) / k ** 0.82 * (1 + 0.5 * Math.exp(-(((k * f0 - 1100) / 700) ** 2)));
    const w = 2.2 + 0.08 * k;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1) * DUR;
      const c = 2.5 + (cHi - 2.5) * Math.exp(-t / 1.15);            // formant centre sweeps down the partials
      const jv = 1 + J * Math.exp(-((k - c) ** 2) / (2 * w * w));
      const att = 1 - Math.exp(-t / (0.005 + 0.0032 * k));            // upper partials bloom later
      const dec = Math.exp(-t * (1 + 0.03 * k) / tau);
      const tail = Math.min(1, (DUR - t) / 0.5);
      curve[i] = A * jv * att * dec * tail;
    }
    const o = oc.createOscillator(), g = oc.createGain();
    o.frequency.value = k * f0 * Math.sqrt(1 + 0.00004 * k * k);
    g.gain.setValueAtTime(0, 0);
    g.gain.setValueCurveAtTime(curve, 0, DUR - 0.01);
    o.connect(g).connect(master); o.start(0); o.stop(DUR);
  }
  const buf = await new Promise((res, rej) => { const p = oc.startRendering(); if (p && p.then) p.then(res, rej); else oc.oncomplete = e => res(e.renderedBuffer); });
  const d = buf.getChannelData(0); let peak = 0;
  for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  if (peak > 0) { const g = 0.85 / peak; for (let i = 0; i < d.length; i++) d[i] *= g; }
  return buf;
}

class Tanpura {
  constructor() {
    this.playing = false; this.loading = false; this.subs = new Set(); this.pluckSubs = new Set();
    this.key = ''; this.gen = null; this.step = 0;
    store.subscribe((s, patch) => { if (this.playing && ('tanpura' in patch || 'saPc' in patch || 'saOct' in patch || 'fine' in patch || 'a4' in patch)) this._retune(); });
  }
  onChange(fn) { this.subs.add(fn); return () => this.subs.delete(fn); }
  onPluck(fn) { this.pluckSubs.add(fn); return () => this.pluckSubs.delete(fn); }
  _emit() { this.subs.forEach(f => f(this)); }

  _key(s) { const t = s.tanpura; return [joraHz(s).toFixed(3), t.first, t.jivari, t.timbre].join('|'); }

  async _build(s) {
    const c = getCtx(), t = s.tanpura, f = joraHz(s), tb = TIMBRES[t.timbre] || TIMBRES.concert;
    const opt = { jivari: t.jivari, bright: tb.bright, tau: tb.tau };
    const freqs = [f * FIRST[t.first].ratio, f, f * 2 ** (1.6 / 1200), f / 2];
    return Promise.all(freqs.map((x, i) => renderString(x, c.sampleRate, i === 3 ? { ...opt, tau: opt.tau * 1.15 } : opt)));
  }

  async start() {
    if (this.playing || this.loading) return;
    const c = getCtx();
    this.loading = true; this._emit();
    try {
      const s = store.get();
      this.bufs = await this._build(s); this.key = this._key(s);
      if (!this.master) {
        this.master = c.createGain();
        this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 3; this.comp.attack.value = 0.02; this.comp.release.value = 0.4;
        this.master.connect(this.comp).connect(c.destination);
      }
      this.master.gain.setValueAtTime(s.tanpura.volume ** 1.6, c.currentTime);
      this._newGen();
      this.step = 0; this.next = c.currentTime + 0.08;
      this.playing = true;
      this.timer = setInterval(() => this._tick(), 90);
      this._tick();
    } finally { this.loading = false; this._emit(); }
  }

  _newGen() {
    const c = getCtx(), old = this.gen;
    if (old) { old.gain.setTargetAtTime(0, c.currentTime, 0.35); setTimeout(() => old.disconnect(), 3000); }
    this.gen = c.createGain(); this.gen.gain.setValueAtTime(0, c.currentTime); this.gen.gain.linearRampToValueAtTime(1, c.currentTime + (old ? 0.5 : 0.05));
    this.gen.connect(this.master);
  }

  _tick() {
    const c = getCtx(), t = store.get().tanpura;
    this.master.gain.setTargetAtTime(t.volume ** 1.6, c.currentTime, 0.08);
    const ahead = document.hidden ? 2.5 : 0.35; // background timers are throttled, so schedule further ahead
    while (this.next < c.currentTime + ahead) {
      const i = this.step, when = Math.max(this.next, c.currentTime + 0.01);
      const src = c.createBufferSource(); src.buffer = this.bufs[i];
      const g = c.createGain(); g.gain.value = (i === 3 ? 0.95 : 0.8) * (0.92 + Math.random() * 0.16);
      let node = src.connect(g);
      if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = [-0.3, -0.1, 0.12, 0.3][i]; node = node.connect(p); }
      node.connect(this.gen);
      src.start(when);
      const ms = (when - c.currentTime) * 1000;
      setTimeout(() => this.playing && this.pluckSubs.forEach(f => f(i)), Math.max(0, ms));
      const beat = 60 / t.tempo;
      this.next += beat * (i === 3 ? 1.3 : 1);
      this.step = (i + 1) % 4;
    }
  }

  async _retune() {
    clearTimeout(this._rt);
    this._rt = setTimeout(async () => {
      const s = store.get(), key = this._key(s);
      if (key === this.key || !this.playing) return;
      this.loading = true; this._emit();
      try {
        const bufs = await this._build(s);
        if (!this.playing) return;
        this.bufs = bufs; this.key = key; this._newGen();
        this.next = Math.max(this.next, getCtx().currentTime + 0.05);
      } finally { this.loading = false; this._emit(); }
    }, 220);
  }

  stop() {
    if (!this.playing) return;
    const c = getCtx();
    this.playing = false; clearInterval(this.timer);
    const g = this.gen; this.gen = null;
    if (g) { g.gain.setTargetAtTime(0, c.currentTime, 0.25); setTimeout(() => g.disconnect(), 2500); }
    this._emit();
  }
  toggle() { return this.playing ? this.stop() : this.start(); }
}
export const tanpura = new Tanpura();
