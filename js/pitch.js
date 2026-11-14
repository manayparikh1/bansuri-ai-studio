// Monophonic pitch detection (YIN with multi-period refinement) and a light tracker.
// Pure functions: runs in the browser and in Node for tests.

export class Yin {
  constructor(sampleRate, { fmin = 65, fmax = 2800, window = 2048, threshold = 0.12 } = {}) {
    this.sr = sampleRate;
    // Scale the integration window with sample rate so it always spans ~43 ms.
    this.W = Math.round(window * sampleRate / 48000 / 2) * 2;
    this.tauMin = Math.max(2, Math.floor(sampleRate / fmax));
    this.tauMax = Math.ceil(sampleRate / fmin);
    this.need = this.W + this.tauMax + 2;
    this.d = new Float32Array(this.tauMax + 2);
    this.th = threshold;
  }

  _interp(t) {
    const d = this.d, a = d[t - 1], b = d[t], c = d[t + 1], den = a - 2 * b + c;
    return den > 1e-12 ? t + (a - c) / (2 * den) : t;
  }

  // buf: Float32Array of at least `need` samples (the most recent samples are used).
  detect(buf, gate = 0.004) {
    const { W, tauMax, tauMin, d } = this;
    const off = buf.length - this.need;
    if (off < 0) throw new Error('buffer too short');
    let e = 0;
    for (let i = off; i < buf.length; i++) e += buf[i] * buf[i];
    const rms = Math.sqrt(e / this.need);
    if (rms < gate) return { freq: 0, conf: 0, rms };

    d[0] = 1; let run = 0;
    for (let tau = 1; tau <= tauMax; tau++) {
      let s = 0;
      for (let j = off, end = off + W; j < end; j++) { const x = buf[j] - buf[j + tau]; s += x * x; }
      run += s;
      d[tau] = run > 0 ? s * tau / run : 1;
    }
    // First dip under the threshold is the fundamental period (ignores harmonics' shallower dips).
    let tau = -1;
    for (let t = tauMin; t < tauMax; t++) {
      if (d[t] < this.th) { while (t + 1 < tauMax && d[t + 1] < d[t]) t++; tau = t; break; }
    }
    if (tau < 0) {
      let best = tauMin;
      for (let t = tauMin + 1; t < tauMax; t++) if (d[t] < d[best]) best = t;
      if (d[best] > 0.35 || best <= tauMin || best >= tauMax - 1) return { freq: 0, conf: Math.max(0, 1 - d[best]), rms };
      tau = best;
    }
    const depth = d[tau];
    let period = this._interp(tau);
    // Refine using the dip at the largest whole multiple of the period: divides the timing error.
    const k = Math.floor((tauMax - 3) / period);
    if (k >= 2) {
      let c = Math.round(k * period), best = c;
      for (let t = Math.max(tauMin, c - 2); t <= Math.min(tauMax - 1, c + 2); t++) if (d[t] < d[best]) best = t;
      if (best > tauMin && best < tauMax - 1 && d[best] < depth + 0.08) {
        const p2 = this._interp(best) / k;
        if (Math.abs(p2 - period) / period < 0.02) period = p2;
      }
    }
    return { freq: this.sr / period, conf: Math.max(0, Math.min(1, 1 - depth)), rms };
  }
}

// Smooths frame-to-frame estimates: 3-frame median, isolated octave-jump rejection, stability metric.
export class Tracker {
  constructor() { this.h = []; this.c = []; this.miss = 0; }
  reset() { this.h.length = 0; this.c.length = 0; this.miss = 0; }
  push(freq) {
    if (!(freq > 0)) {
      if (++this.miss > 3) { this.h.length = 0; this.c.length = 0; }
      return { freq: 0, std: 0, stab: 0 };
    }
    this.miss = 0;
    let l = Math.log2(freq);
    const h = this.h;
    if (h.length >= 2) {
      const prev = h[h.length - 1], jump = Math.abs(l - prev);
      // A lone frame an octave/twelfth away from an otherwise steady pitch is a tracking glitch.
      if ((Math.abs(jump - 1) < 0.06 || Math.abs(jump - 1.585) < 0.06) && Math.abs(prev - h[h.length - 2]) < 0.03 && !this.jumped) { this.jumped = true; l = prev; }
      else this.jumped = false;
    }
    h.push(l); if (h.length > 3) h.shift();
    const s = [...h].sort((a, b) => a - b);
    const m = s[s.length >> 1];
    const c = this.c; c.push(m * 1200); if (c.length > 14) c.shift();
    let std = 0;
    if (c.length >= 5) { const mean = c.reduce((a, b) => a + b, 0) / c.length; std = Math.sqrt(c.reduce((a, b) => a + (b - mean) ** 2, 0) / c.length); }
    return { freq: 2 ** m, std, stab: c.length >= 5 ? Math.max(0, Math.min(1, 1 - std / 30)) : 0 };
  }
}
