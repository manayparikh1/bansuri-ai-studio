// Raag identification from a melodic outline. Transparent, rule-based scoring (no cloud, no ML):
//   swara-set fit, aroha/avaroha direction, characteristic phrases, vadi/samvadi emphasis, ornaments.
// It reports resemblance with reasons and never certainty.
import { RAAGS } from './raags.js';
import { phraseSemis, parsePhrase, mod, SWARAS, IDS } from './theory.js';

const collapse = s => s.filter((x, i) => i === 0 || x !== s[i - 1]);
const bi = (a, b) => `${mod(a, 12)}${b > a ? '+' : '-'}${mod(b, 12)}`;
const tri = (a, b, c) => `${mod(a, 12)}${b > a ? '+' : '-'}${mod(b, 12)}${c > b ? '+' : '-'}${mod(c, 12)}`;
const chunksOf = str => str.split(',').map(s => s.trim()).filter(Boolean);

function profile(r) {
  const p = { r, bi: new Set(), tri: new Set(), chunks: [] };
  const add = (semis) => {
    const s = collapse(semis);
    for (let i = 0; i + 1 < s.length; i++) p.bi.add(bi(s[i], s[i + 1]));
    for (let i = 0; i + 2 < s.length; i++) p.tri.add(tri(s[i], s[i + 1], s[i + 2]));
  };
  add(phraseSemis(r.aroha)); add(phraseSemis(r.avaroha));
  const seen = new Set();
  for (const src of [r.pakad, ...r.phrases]) {
    add(phraseSemis(src));
    for (const ch of chunksOf(src)) {
      const s = collapse(phraseSemis(ch));
      if (s.length < 3) continue;
      const key = s.map((x, i) => i ? (x > s[i - 1] ? '+' : '-') + mod(x, 12) : mod(x, 12)).join('');
      if (!seen.has(key)) { seen.add(key); p.chunks.push({ text: ch, key, len: s.length }); }
    }
  }
  const up = collapse(phraseSemis(r.aroha)).map(x => mod(x, 12)), dn = collapse(phraseSemis(r.avaroha)).map(x => mod(x, 12));
  p.up = new Set(up); p.dn = new Set(dn);
  p.vadi = IDS.indexOf(r.vadi); p.samvadi = IDS.indexOf(r.samvadi);
  p.size = r.core.filter(Boolean).length;
  return p;
}
const PROFILES = RAAGS.map(profile);

const list = idxs => idxs.map(i => SWARAS[i].label).join(', ');

// outline: [{ semi, dur, meend?, osc? }] with immediate repeats collapsed.
export function identify(outline, { force = false } = {}) {
  const total = outline.reduce((a, n) => a + n.dur, 0);
  const hist = new Array(12).fill(0);
  for (const n of outline) hist[mod(n.semi, 12)] += n.dur / (total || 1);
  const played = hist.map((h, i) => h >= 0.025 ? i : -1).filter(i => i >= 0);
  const evidence = { notes: outline.length, distinct: played.length, seconds: total, hist };
  if (!force && (outline.length < 8 || played.length < 4 || total < 4)) {
    const need = [];
    if (played.length < 4) need.push(`at least 4 different swaras (heard ${played.length})`);
    if (outline.length < 8) need.push(`a longer phrase (heard ${outline.length} of 8 notes)`);
    if (total < 4) need.push('a few more seconds of sustained playing');
    return { sufficient: false, evidence, need, results: [] };
  }
  const semis = outline.map(n => n.semi);
  const keyStr = semis.map((x, i) => i ? (x > semis[i - 1] ? '+' : '-') + mod(x, 12) : mod(x, 12)).join('');
  // Emphasis ranking (duration share)
  const rank = [...played].sort((a, b) => hist[b] - hist[a]);
  const centre = outline.reduce((a, n) => a + n.semi * n.dur, 0) / total; // average height above Sa, in semitones
  const oscOn = new Set(outline.filter(n => n.osc && n.osc.kind === 'andolan').map(n => mod(n.semi, 12)));

  const results = PROFILES.map(p => {
    const r = p.r;
    const inScale = hist.reduce((a, h, i) => a + (r.set[i] ? h : 0), 0);
    const foreign = played.filter(i => !r.set[i]);
    const scaleScore = Math.max(0, 1 - 4 * (1 - inScale));
    const coreIdx = r.core.map((v, i) => v ? i : -1).filter(i => i >= 0);
    const missing = coreIdx.filter(i => hist[i] < 0.025);
    const coverage = 1 - missing.length / coreIdx.length;
    const setScore = scaleScore * (0.35 + 0.65 * coverage ** 1.5);

    let dSum = 0, dN = 0, triHit = 0, triN = 0;
    for (let i = 0; i + 1 < semis.length; i++) {
      const a = semis[i], b = semis[i + 1];
      dN++;
      if (p.bi.has(bi(a, b))) dSum += 1;
      else if ((b > a ? p.up : p.dn).has(mod(a, 12)) && (b > a ? p.up : p.dn).has(mod(b, 12))) dSum += 0.45;
    }
    for (let i = 0; i + 2 < semis.length; i++) { triN++; if (p.tri.has(tri(semis[i], semis[i + 1], semis[i + 2]))) triHit++; }
    const dirScore = dN ? dSum / dN : 0;
    const matched = p.chunks.filter(c => keyStr.includes(c.key)).sort((a, b) => b.len - a.len);
    const phraseScore = Math.min(1, (triN ? triHit / triN : 0) * 0.75 + Math.min(0.45, matched.reduce((a, c) => a + 0.05 * c.len, 0)));

    const pos = i => { const k = rank.indexOf(i); return k < 0 ? 0 : k === 0 ? 1 : k === 1 ? 0.85 : k === 2 ? 0.6 : k === 3 ? 0.4 : 0.2; };
    const emphasis = 0.6 * pos(p.vadi) + 0.4 * pos(p.samvadi);

    let score = (0.42 * setScore + 0.2 * dirScore + 0.2 * phraseScore + 0.18 * emphasis) * (0.25 + 0.75 * scaleScore);
    const orn = (r.andolan || []).map(id => IDS.indexOf(id)).filter(i => oscOn.has(i));
    if (orn.length) score = Math.min(1, score + 0.03);
    // Register: some raags sharing a scale differ mainly in where they live (e.g. Darbari low, Adana high).
    let regNote = null;
    if (r.reg) {
      const fits = r.reg === 'low' ? centre < 5.5 : centre > 6.5;
      score = Math.max(0, Math.min(1, score + (fits ? 0.025 : -0.035)));
      regNote = fits;
    }

    // Explanations
    const why = [], against = [];
    if (!foreign.length) why.push({ t: `Every swara you played belongs to ${r.name}.` });
    else against.push({ t: `Outside the raag: ${list(foreign)} (${Math.round((1 - inScale) * 100)}% of playing time).` });
    if (!missing.length) why.push({ t: `All ${coreIdx.length} of its swaras were heard.` });
    else against.push({ t: `Not yet heard: ${list(missing)}.` });
    if (matched.length) why.push({ t: 'Characteristic phrase heard:', p: matched.slice(0, 2).map(c => c.text) });
    if (dirScore >= 0.8) why.push({ t: 'Ascending and descending movement follows its aroha and avaroha.' });
    else if (dirScore < 0.5) against.push({ t: 'Several note-to-note movements are unusual for its aroha / avaroha.' });
    const vr = rank.indexOf(p.vadi), sr = rank.indexOf(p.samvadi);
    if (vr >= 0 && vr <= 1) why.push({ t: `${SWARAS[p.vadi].label} (vadi) is among your most sustained notes${sr >= 0 && sr <= 2 ? `, with ${SWARAS[p.samvadi].label} (samvadi) also prominent` : ''}.` });
    else if (vr > 2 || vr < 0) against.push({ t: `Its vadi, ${SWARAS[p.vadi].label}, was not emphasised.` });
    if (regNote === true) why.push({ t: `Your playing sits in the ${r.reg === 'low' ? 'lower and middle' : 'upper'} register, where this raag lives.` });
    else if (regNote === false) against.push({ t: `This raag is normally developed in the ${r.reg === 'low' ? 'lower' : 'upper'} register.` });
    if (orn.length) why.push({ t: `Slow oscillation (andolan) detected on ${list(orn)}, typical of this raag.` });
    return { raag: r, score, parts: { set: setScore, direction: dirScore, phrase: phraseScore, emphasis }, why, against };
  }).filter(x => force || x.score >= 0.5).sort((a, b) => b.score - a.score).slice(0, 5);

  for (const x of results) x.label = x.score >= 0.85 ? 'Strong resemblance' : x.score >= 0.7 ? 'Likely' : 'Possible';
  const contested = results.length > 1 && results[0].score - results[1].score < 0.05;
  return { sufficient: true, evidence, results, contested };
}
