import { analyse } from '../js/finder.js';
import { phrasePlayable, swaraHz, IDS } from '../js/theory.js';
import { RAAGS } from '../js/raags.js';
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
export function sing(phrase, saHz, { beat = 0.38, vib = 14, jitter = 5 } = {}) {
  const t = [], f = []; let now = 0, prev = null;
  for (const n of phrasePlayable(phrase)) {
    const dur = n.beats * beat, target = swaraHz(saHz, n.semi, 'just');
    for (let x = 0; x < dur; x += 0.03) { let hz = target; if (prev && x < 0.07) hz = prev * (target / prev) ** (x / 0.07);
      const c = (x > 0.2 ? vib * Math.sin(2 * Math.PI * 5.5 * x) : 0) + (rnd() - 0.5) * 2 * jitter; t.push(now + x); f.push(rnd() < 0.04 ? 0 : hz * 2 ** (c / 1200)); }
    prev = target; now += dur;
    if (n.beats >= 2 && rnd() < 0.6) { for (let x = 0; x < 0.3; x += 0.03) { t.push(now + x); f.push(0); } now += 0.3; prev = null; }
  }
  return { t, f };
}
// Performance-like material for EVERY raag: aroha, pakad, phrases, avaroha with rests on phrase ends.
export const material = r => [r.aroha, r.pakad, ...r.phrases, r.avaroha, r.pakad].map(p => p.replace(/,/g, ' - ,')).join(' - - , ') + ' - -';
const fracs = [0.25, 0.5, 0.75, 1];
const stat = fracs.map(() => ({ ok: 0, n: 0, sure: 0, sureWrong: 0, raagOk: 0, conf: {} }));
const sas = [138.6, 164.8, 196, 220, 246.9, 293.7];
RAAGS.forEach((r, ri) => { for (let k = 0; k < 2; k++) {
  const sa = sas[(ri + k * 3) % sas.length] * 2 ** (((ri * 37 + k * 11) % 60 - 30) / 1200);
  const full = sing(material(r), sa);
  fracs.forEach((fq, i) => { const cut = Math.floor(full.t.length * fq); const a = analyse({ t: full.t.slice(0, cut), f: full.f.slice(0, cut) });
    const st = stat[i]; st.n++; if (!a.enough) return;
    const d = ((Math.round(12 * Math.log2(a.saHz / sa)) % 12) + 12) % 12;
    if (d === 0) { st.ok++; if (a.raag?.results[0]?.raag.id === r.id) st.raagOk++; } else { st.conf[IDS[d]] = (st.conf[IDS[d]] || 0) + 1; if (process.argv[2] && fq === 1) console.log('  miss', r.name, '-> Sa heard as its', IDS[d], 'conf', a.confidence.toFixed(2), a.raag?.results[0]?.raag.name); }
    if (a.confidence >= 0.5) { st.sure++; if (d) st.sureWrong++; } });
} });
fracs.forEach((fq, i) => { const s = stat[i]; console.log(`${String(fq * 100).padStart(3)}% heard: Sa right ${s.ok}/${s.n} (${(s.ok / s.n * 100).toFixed(0)}%)  raag also right ${s.raagOk}  | >=50% sure: ${s.sure}, wrong among them ${s.sureWrong} | wrong Sa landed on: ${Object.entries(s.conf).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + '×' + v).join(' ')}`); });
