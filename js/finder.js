// Scale Finder engine: from a pitch track with NO preset Sa, work out the tonic (Sa), the tuning
// offset, the closest thaat and the most likely raags. Pure functions (testable in Node).
//
// Method: every one of the 12 pitch classes is tried as Sa. Each candidate is scored on
//   - how well the melody then fits some raag's grammar (swara set, movement, phrases, emphasis),
//   - how tonic-like it is (key-profile correlation: Sa and Pa heavy, resting and final notes),
// and the best-supported candidate wins. Confidence is the margin over the runner-up.
import { segment, outline as toOutline } from './analysis.js';
import { identify } from './raagid.js';
import { THAATS, IDS, mod, clamp } from './theory.js';

// Krumhansl-Kessler key profiles (major, minor): how strongly each degree is heard in a key.
const KS_MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KS_MIN = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
// Drone-centred profile typical of raag music: Sa dominant, Pa and Ma supporting.
const DRONE = [7, 1.6, 3, 2.6, 3.6, 3.8, 2, 5.6, 2.2, 3.2, 2.4, 3];
const THAAT_SETS = Object.entries(THAATS).map(([name, str]) => ({ name, set: str.split(' ').map(x => IDS.indexOf(x)) }));
export const WESTERN_MODE = { Bilawal: 'major (Ionian)', Kalyan: 'Lydian', Khamaj: 'Mixolydian', Kafi: 'Dorian', Asavari: 'natural minor (Aeolian)', Bhairavi: 'Phrygian', Bhairav: 'double harmonic', Purvi: 'Purvi scale', Marwa: 'Marwa scale', Todi: 'Todi scale' };

function pearson(rel, prof) {
  let mx = 0, mp = 0;
  for (let i = 0; i < 12; i++) { mx += rel[i]; mp += prof[i]; }
  mx /= 12; mp /= 12;
  let num = 0, dx = 0, dp = 0;
  for (let i = 0; i < 12; i++) { const a = rel[i] - mx, b = prof[i] - mp; num += a * b; dx += a * a; dp += b * b; }
  const den = Math.sqrt(dx * dp);
  return den > 0 ? num / den : 0;
}
const rot = (h, t) => Array.from({ length: 12 }, (_, i) => h[(t + i) % 12]);
export const keyScore = rel => (Math.max(pearson(rel, KS_MAJ), pearson(rel, KS_MIN), pearson(rel, DRONE)) + 1) / 2;

// How far the performer's pitch grid sits from A4-based equal temperament, in cents (-50..50).
export function tuningOffset(freqs, a4 = 440) {
  let sx = 0, sy = 0;
  for (const f of freqs) { const c = 1200 * Math.log2(f / a4); const a = 2 * Math.PI * (c / 100); sx += Math.cos(a); sy += Math.sin(a); }
  const off = Math.atan2(sy, sx) / (2 * Math.PI) * 100;
  return { cents: off, strength: Math.hypot(sx, sy) / (freqs.length || 1) };
}

export function bestThaat(rel) {
  const total = rel.reduce((a, b) => a + b, 0) || 1;
  return THAAT_SETS.map(t => ({ ...t, fit: t.set.reduce((a, i) => a + rel[i], 0) / total })).sort((a, b) => b.fit - a.fit)[0];
}

// Relative weight of each kind of evidence for a candidate Sa (tuned on tools/bench-finder.mjs and tools/test-finder.mjs).
// Raag grammar carries most of the weight: it is what separates a raag's Sa from its Ma or Pa.
export const WEIGHTS = { raag: 1, pow: 2, key: 0.2, end: 0.05, rest: 0.15 };

// fr: { t: [], f: [] } pitch track. chroma: optional 12-bin spectrum chroma (absolute pitch classes, C = 0).
export function analyse(fr, { a4 = 440, minNoteMs = 100, chroma = null, W = WEIGHTS } = {}) {
  const voiced = []; for (let i = 0; i < fr.f.length; i++) if (fr.f[i] > 0) voiced.push(fr.f[i]);
  const chromaSum = chroma ? chroma.reduce((a, b) => a + b, 0) : 0;
  const empty = { enough: false, voicedSec: 0, notes: 0 };
  if (voiced.length < 25 && chromaSum <= 0) return empty;

  const tune = voiced.length >= 25 ? tuningOffset(voiced, a4) : { cents: 0, strength: 0 };
  // Only trust the offset when the notes agree on one grid; otherwise assume concert pitch.
  const off = tune.strength > 0.35 ? tune.cents : 0;
  const c4 = a4 * 2 ** (-9 / 12) * 2 ** (off / 1200);
  const seg = voiced.length >= 25 ? segment(fr, c4, { minNoteMs, temperament: 'et' }) : { notes: [], dt: 0.03 };
  const notes = seg.notes, ol = toOutline(notes);
  const total = notes.reduce((a, n) => a + n.dur, 0);
  const hist = new Array(12).fill(0);
  for (const n of notes) hist[mod(n.semi, 12)] += n.dur / (total || 1);
  const distinct = hist.filter(h => h >= 0.025).length;

  // How much to trust the single-line melody versus the spectrum (songs with accompaniment).
  const voicedShare = fr.f.length ? voiced.length / fr.f.length : 0;
  const wMono = clamp(ol.length / 10, 0, 1) * clamp(voicedShare / 0.3, 0, 1) * (distinct >= 3 ? 1 : 0.4);
  if (wMono === 0 && chromaSum <= 0) return { ...empty, voicedSec: total };

  // Median pitch (for placing Sa in the right octave) and resting notes.
  const sorted = [...notes].sort((a, b) => a.semi - b.semi);
  let acc = 0, med = sorted.length ? sorted[0].semi : 0;
  for (const n of sorted) { acc += n.dur; if (acc >= total / 2) { med = n.semi; break; } }
  // Phrase endings: the note held before each breath. Singers come to rest on Sa (and Pa) far more than chance.
  const lastT = fr.t.length ? fr.t[fr.t.length - 1] : 0;
  const pe = new Array(12).fill(0); let peT = 0;
  notes.forEach((n, i) => {
    const gap = i + 1 < notes.length ? notes[i + 1].start - n.end : lastT - n.end;
    if (gap >= 0.22 && n.dur >= 0.25) { const w = Math.min(n.dur, 1.5); pe[mod(n.semi, 12)] += w; peT += w; }
  });
  const rest = new Array(12).fill(0); let restT = 0;
  for (const n of notes) if (n.dur >= 0.45) { rest[mod(n.semi, 12)] += n.dur; restT += n.dur; }
  const chromaN = chromaSum > 0 ? chroma.map(x => x / chromaSum) : null;

  const cands = [];
  for (let t = 0; t < 12; t++) {
    let mono = 0, raags = null, shift = 0, feat = null;
    if (ol.length) {
      shift = t + 12 * Math.floor((med + 2 - t) / 12);       // Sa at or just below the middle of the melody
      const shifted = ol.map(n => ({ ...n, semi: n.semi - shift }));
      raags = identify(shifted, { force: true });
      const top = raags.results[0] ? raags.results[0].score : 0;
      const rel = rot(hist, t);
      const end = peT ? Math.min(1, (pe[t] + 0.4 * pe[mod(t + 7, 12)]) / peT) : 0;
      const resting = restT ? (rest[t] + 0.5 * rest[mod(t + 7, 12)]) / restT : 0;
      feat = { top, key: keyScore(rel), end, rest: Math.min(1, resting * 1.6) };
      mono = (W.raag * top ** W.pow + W.key * feat.key + W.end * end + W.rest * feat.rest) / (W.raag + W.key + W.end + W.rest);
    }
    const spec = chromaN ? keyScore(rot(chromaN, t)) : 0;
    const score = chromaN ? wMono * mono + (1 - wMono) * spec : mono;
    cands.push({ pc: t, score, shift, raags, mono, spec, feat });
  }
  cands.sort((a, b) => b.score - a.score);
  const best = cands[0], second = cands[1];
  const margin = best.score - second.score;
  // Confidence needs both a clear lead and enough music: a handful of notes can fit several keys equally well.
  const amount = chromaN && wMono < 0.5 ? clamp(chromaSum / 40, 0.2, 1) : clamp(ol.length / 24, 0.15, 1) * clamp(distinct / 5, 0.4, 1);
  const confidence = clamp(margin * 8, 0, 1) * amount;
  const rel = wMono >= 0.5 || !chromaN ? rot(hist, best.pc) : rot(chromaN, best.pc);
  const saMidi = 60 + best.shift;
  const out = {
    enough: true, tonicPc: best.pc, saMidi, saHz: a4 * 2 ** ((saMidi - 69) / 12) * 2 ** (off / 1200),
    cents: off, confidence, margin, melodic: wMono >= 0.5, wMono,
    voicedSec: total, notes: ol.length, distinct,
    rel, thaat: bestThaat(rel),
    candidates: cands.slice(0, 4).map(c => ({ pc: c.pc, score: c.score })), amount,
    features: cands.map(c => ({ pc: c.pc, shift: c.shift, ...c.feat })),
    outline: ol.map(n => ({ ...n, semi: n.semi - best.shift })),
    raag: null,
  };
  if (best.raags) {
    // Report raags with the normal evidence rules (no naming a raag from a note or two).
    out.raag = identify(out.outline);
  }
  return out;
}

// ---- Spectrum chroma (for songs with accompaniment) ----------------------------------------
// mags: linear magnitudes of an FFT; adds each spectral peak to its pitch class in `out` (C = 0).
export function chromaFromSpectrum(mags, sampleRate, fftSize, a4, out) {
  const binHz = sampleRate / fftSize;
  const lo = Math.max(2, Math.ceil(60 / binHz)), hi = Math.min(mags.length - 2, Math.floor(2400 / binHz));
  let max = 0; for (let b = lo; b <= hi; b++) if (mags[b] > max) max = mags[b];
  if (max <= 1e-7) return 0;
  const floor = max * 0.002; let total = 0;
  for (let b = lo; b <= hi; b++) {
    const m = mags[b];
    if (m < floor || m <= mags[b - 1] || m < mags[b + 1]) continue;
    const a = mags[b - 1], c = mags[b + 1], den = a - 2 * m + c;
    const f = (b + (den ? clamp(0.5 * (a - c) / den, -0.5, 0.5) : 0)) * binHz;
    const midi = 69 + 12 * Math.log2(f / a4), near = Math.round(midi), dc = (midi - near) * 100;
    const w = m ** 0.7 * Math.exp(-0.5 * (dc / 35) ** 2) / (1 + (f / 1800) ** 2);
    out[mod(near, 12)] += w; total += w;
  }
  return total;
}

// In-place radix-2 FFT magnitude (real input). Returns Float32Array of n/2 magnitudes.
export function fftMag(input) {
  const n = input.length, re = Float32Array.from(input), im = new Float32Array(n);
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { const t = re[i]; re[i] = re[j]; re[j] = t; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2, xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
  const out = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) out[i] = Math.hypot(re[i], im[i]);
  return out;
}
