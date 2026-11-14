// Offline analysis of a pitch track: note segmentation, intonation statistics,
// ornament detection, tonic estimation. Pure functions (testable in Node).
import { JUST_CENTS, SWARAS, mod, saptakName } from './theory.js';

const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);

// fr: { t: number[], f: number[] }  (f = 0 where unvoiced). Returns notes relative to `sa`.
export function segment(fr, sa, { minNoteMs = 100, temperament = 'just' } = {}) {
  const n = fr.t.length, runs = [];
  let cur = null;
  for (let i = 0; i < n; i++) {
    const f = fr.f[i], t = fr.t[i];
    if (!(f > 0)) continue;
    const x = 12 * Math.log2(f / sa);
    if (cur && Math.abs(x - cur.q) < 0.62 && t - cur.t1 < 0.09) { cur.xs.push(x); cur.t1 = t; }
    else { if (cur) runs.push(cur); cur = { q: Math.round(x), xs: [x], t0: t, t1: t }; }
  }
  if (cur) runs.push(cur);
  const dts = []; for (let i = 1; i < Math.min(n, 400); i++) dts.push(fr.t[i] - fr.t[i - 1]);
  dts.sort((a, b) => a - b);
  const dt = dts.length ? dts[dts.length >> 1] : 0.03;
  const minDur = minNoteMs / 1000;

  const notes = [];
  let trans = { dur: 0, from: null };
  for (const r of runs) {
    const dur = r.t1 - r.t0 + dt;
    if (dur < minDur) { trans.dur += dur; continue; }
    const prev = notes[notes.length - 1];
    if (prev && prev.semi === r.q && r.t0 - prev.end < 0.12) { // same note resumed after a blip
      prev.xs = prev.xs.concat(r.xs); prev.end = r.t1 + dt; trans = { dur: 0 };
      continue;
    }
    const note = { semi: r.q, start: r.t0, end: r.t1 + dt, xs: r.xs };
    if (prev) {
      const gap = r.t0 - prev.end;
      // Continuous voiced slide spanning 2+ semitones between two held notes = meend.
      if (Math.abs(r.q - prev.semi) >= 2 && gap >= 0.07 && gap < 1.5 && trans.dur >= gap * 0.7) note.meend = true;
    }
    notes.push(note); trans = { dur: 0 };
  }

  for (const nt of notes) {
    const xs = nt.xs, L = xs.length;
    const a = L >= 8 ? Math.floor(L * 0.15) : 0, b = L >= 8 ? Math.ceil(L * 0.85) : L;
    const core = xs.slice(a, b);
    const m = mean(core);
    const idx = mod(nt.semi, 12);
    const off = temperament === 'just' ? JUST_CENTS[idx] - idx * 100 : 0;
    nt.idx = idx; nt.oct = Math.floor(nt.semi / 12);
    nt.dur = nt.end - nt.start;
    nt.cents = (m - nt.semi) * 100 - off;
    nt.std = Math.sqrt(mean(core.map(x => (x - m) ** 2))) * 100;
    nt.freq = sa * 2 ** (m / 12);
    const half = core.length >> 1;
    nt.drift = core.length >= 10 ? (mean(core.slice(half)) - mean(core.slice(0, half))) * 100 : 0;
    // Oscillation: zero crossings around the mean -> vibrato / andolan.
    let zc = 0; for (let i = 1; i < core.length; i++) if ((core[i - 1] - m) * (core[i] - m) < 0) zc++;
    const rate = core.length > 1 ? zc / 2 / (core.length * dt) : 0;
    const extent = nt.std * Math.SQRT2;
    nt.osc = null;
    if (nt.dur >= 0.6 && extent >= 9) {
      if (rate >= 3.5 && rate <= 8.5) nt.osc = { kind: 'vibrato', rate, extent };
      else if (rate >= 0.8 && rate < 3.5 && extent >= 12) nt.osc = { kind: 'andolan', rate, extent };
    }
    delete nt.xs;
  }
  return { notes, dt };
}

// Collapse immediate repeats: the melodic outline used for raag analysis.
export function outline(notes) {
  const out = [];
  for (const n of notes) {
    const p = out[out.length - 1];
    if (p && p.semi === n.semi) p.dur += n.dur; else out.push({ semi: n.semi, dur: n.dur, meend: n.meend, osc: n.osc });
  }
  return out;
}

export function summarize(notes, { tol = 15 } = {}) {
  const total = notes.reduce((a, n) => a + n.dur, 0);
  if (!notes.length || !total) return null;
  const w = f => notes.reduce((a, n) => a + f(n) * n.dur, 0) / total;
  const per = {};
  for (const n of notes) {
    const p = per[n.semi] || (per[n.semi] = { semi: n.semi, idx: n.idx, count: 0, dur: 0, c: 0, s: 0 });
    p.count++; p.dur += n.dur; p.c += n.cents * n.dur; p.s += n.std * n.dur;
  }
  const swaras = Object.values(per).map(p => ({ ...p, cents: p.c / p.dur, std: p.s / p.dur })).sort((a, b) => a.semi - b.semi);
  const long = notes.filter(n => n.dur >= 0.8);
  const stats = {
    count: notes.length, total,
    accuracy: w(n => Math.abs(n.cents)),
    bias: w(n => n.cents),
    inTune: notes.filter(n => Math.abs(n.cents) <= tol).reduce((a, n) => a + n.dur, 0) / total,
    stability: w(n => n.std),
    longest: Math.max(...notes.map(n => n.dur)),
    avgDur: total / notes.length,
    meends: notes.filter(n => n.meend).length,
    vibrato: notes.filter(n => n.osc && n.osc.kind === 'vibrato').length,
    andolan: notes.filter(n => n.osc && n.osc.kind === 'andolan').length,
    swaras,
  };

  // Advice derived strictly from the measurements above.
  const tips = [];
  const name = s => SWARAS[mod(s, 12)].label + (Math.floor(s / 12) ? ' (' + saptakName(Math.floor(s / 12)).replace(' saptak', '').toLowerCase() + ')' : '');
  const off = swaras.filter(p => Math.abs(p.cents) > tol && (p.count >= 3 || p.dur >= 1)).sort((a, b) => Math.abs(b.cents) - Math.abs(a.cents));
  for (const p of off.slice(0, 4)) {
    tips.push(`${name(p.semi)} is consistently ${Math.abs(p.cents).toFixed(0)}¢ ${p.cents > 0 ? 'sharp' : 'flat'} across ${p.count} note${p.count > 1 ? 's' : ''}. ${p.cents > 0 ? 'Relax the air speed or roll the flute slightly inward.' : 'Support with faster air or roll the flute slightly outward.'}`);
  }
  const hi = notes.filter(n => n.oct >= 1), lo = notes.filter(n => n.oct < 0);
  const wm = arr => arr.reduce((a, n) => a + n.cents * n.dur, 0) / (arr.reduce((a, n) => a + n.dur, 0) || 1);
  if (hi.length >= 3 && wm(hi) > tol * 0.8) tips.push(`Taar saptak notes average ${wm(hi).toFixed(0)}¢ sharp — a typical sign of over-blowing. Narrow the lip opening instead of forcing more air.`);
  if (lo.length >= 3 && wm(lo) < -tol * 0.8) tips.push(`Mandra saptak notes average ${Math.abs(wm(lo)).toFixed(0)}¢ flat. Keep the air stream warm and steady and avoid covering too much of the blowing hole.`);
  if (long.length >= 2) {
    const d = mean(long.map(n => n.drift));
    if (d < -6) tips.push(`Long notes sag by about ${Math.abs(d).toFixed(0)}¢ toward the end. Work on breath support: sustain each note at an even air pressure until the last moment.`);
    if (d > 6) tips.push(`Long notes creep upward by about ${d.toFixed(0)}¢. Avoid pushing extra air as the note continues.`);
    const st = mean(long.filter(n => !n.osc).map(n => n.std));
    if (st > 12) tips.push(`Sustained notes waver by ±${st.toFixed(0)}¢ without a clear vibrato shape. Practise long tones against the tanpura until the needle holds still.`);
  }
  if (stats.inTune > 0.85 && !tips.length) tips.push('Intonation is consistently inside your tolerance in this take. No recurring problem was measured.');
  if (!tips.length) tips.push('No single swara stands out as a recurring problem in this take; deviations are scattered rather than systematic.');
  stats.tips = tips;
  return stats;
}

// Estimate candidate tonics from a pitch track. Heuristic: the most-dwelt pitch class that is
// also supported by its fifth or fourth, with a bonus for the note the take ends on.
export function estimateSa(fr) {
  const H = new Float64Array(120), ref = 261.6256;
  const voiced = [];
  for (let i = 0; i < fr.f.length; i++) if (fr.f[i] > 0) voiced.push(fr.f[i]);
  if (voiced.length < 40) return [];
  for (const f of voiced) H[mod(Math.round(120 * Math.log2(f / ref)), 120)] += 1;
  const S = new Float64Array(120);
  for (let i = 0; i < 120; i++) S[i] = H[i] + 0.75 * (H[mod(i - 1, 120)] + H[mod(i + 1, 120)]) + 0.4 * (H[mod(i - 2, 120)] + H[mod(i + 2, 120)]);
  const max = Math.max(...S);
  const around = b => Math.max(S[mod(b - 1, 120)], S[mod(b, 120)], S[mod(b + 1, 120)]);
  // Final sustained pitch
  const tail = voiced.slice(-Math.min(voiced.length, 20));
  const endBin = mod(Math.round(120 * Math.log2([...tail].sort((a, b) => a - b)[tail.length >> 1] / ref)), 120);
  const cands = [];
  for (let i = 0; i < 120; i++) {
    if (S[i] < 0.08 * max || S[i] < S[mod(i - 1, 120)] || S[i] <= S[mod(i + 1, 120)]) continue;
    let score = S[i] + 0.7 * Math.max(around(i + 70), around(i + 50));
    const de = Math.min(mod(i - endBin, 120), mod(endBin - i, 120));
    if (de <= 2) score += 0.35 * max;
    cands.push({ bin: i, score });
  }
  cands.sort((a, b) => b.score - a.score);
  const sorted = [...voiced].sort((a, b) => a - b), med = sorted[sorted.length >> 1];
  return cands.slice(0, 3).map(c => {
    // Refine the pitch class from the frames near the peak, then place Sa at or just below the median pitch.
    let sum = 0, cnt = 0;
    for (const f of voiced) { const x = 120 * Math.log2(f / ref); let dlt = mod(x - c.bin + 60, 120) - 60; if (Math.abs(dlt) <= 3) { sum += dlt; cnt++; } }
    const pc = (c.bin + (cnt ? sum / cnt : 0)) / 120;
    let f = ref * 2 ** pc;
    while (f > med * 1.03) f /= 2;
    while (f * 2 <= med * 1.03) f *= 2;
    return { freq: f, score: c.score / cands[0].score };
  });
}
