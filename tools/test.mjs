// Engine tests: pitch accuracy on synthetic signals, segmentation, raag identification, database sanity.
import { Yin, Tracker } from '../js/pitch.js';
import { segment, outline, summarize, estimateSa } from '../js/analysis.js';
import { identify } from '../js/raagid.js';
import { RAAGS, byId } from '../js/raags.js';
import { phraseSemis, phrasePlayable, swaraHz, IDS, THAATS, mod } from '../js/theory.js';

let fail = 0;
const ok = (c, msg) => { console.log((c ? '  ok   ' : '  FAIL ') + msg); if (!c) fail++; };
const cents = (a, b) => 1200 * Math.log2(a / b);
const sr = 48000;
function synth(f, { harm = [1, .5, .3, .2], noise = 0, vib = 0, n = 4096, amp = .3 } = {}) {
  const b = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) {
    const fi = f * 2 ** (vib * Math.sin(2 * Math.PI * 5.5 * i / sr) / 1200);
    ph += 2 * Math.PI * fi / sr;
    let s = 0; harm.forEach((a, k) => s += a * Math.sin((k + 1) * ph + k));
    b[i] = amp * s + noise * (Math.random() * 2 - 1);
  }
  return b;
}
console.log('Pitch detection');
const yin = new Yin(sr);
let worst = 0;
for (const f of [82.4, 110, 164.8, 220, 261.63, 329.63, 440, 587.3, 880, 1318.5, 1760, 2349]) {
  const r = yin.detect(synth(f)); worst = Math.max(worst, Math.abs(cents(r.freq, f)));
}
ok(worst < 1.5, `clean tones 82 Hz - 2.3 kHz within ${worst.toFixed(2)} cents`);
let r = yin.detect(synth(220, { harm: [.08, 1, .8, .6, .4] }));
ok(Math.abs(cents(r.freq, 220)) < 3, `weak fundamental, strong harmonics -> ${r.freq.toFixed(2)} Hz (true 220)`);
r = yin.detect(synth(659.26, { harm: [1, .15, .05], noise: 0.05 }));
ok(Math.abs(cents(r.freq, 659.26)) < 4 && r.conf > 0.8, `flute-like tone + noise -> ${r.freq.toFixed(2)} Hz conf ${r.conf.toFixed(2)}`);
r = yin.detect(new Float32Array(4096).map(() => (Math.random() * 2 - 1) * 0.2));
ok(r.freq === 0 || r.conf < 0.8, `white noise is rejected (conf ${r.conf.toFixed(2)})`);
r = yin.detect(new Float32Array(4096));
ok(r.freq === 0, 'silence gives no reading');
const t0 = performance.now(); for (let i = 0; i < 100; i++) yin.detect(synth(440)); 
console.log(`       (~${((performance.now() - t0) / 100).toFixed(2)} ms per frame incl. synthesis)`);

// Build a pitch track from a phrase
const sa = 329.63;
function track(phrase, { beat = 0.35, dev = () => 0, vib = 0 } = {}) {
  const t = [], f = []; let now = 0;
  for (const n of phrasePlayable(phrase)) {
    const dur = n.beats * beat, base = swaraHz(sa, n.semi, 'just') * 2 ** (dev(n) / 1200);
    for (let x = 0; x < dur - 0.04; x += 0.03) { t.push(now + x); f.push(base * 2 ** (vib * Math.sin(2 * Math.PI * 5 * x) / 1200)); }
    t.push(now + dur - 0.02); f.push(0); now += dur;
  }
  return { t, f };
}
console.log('Segmentation');
let tr = track("S R G P D S' D P G R S");
let seg = segment(tr, sa);
ok(seg.notes.map(n => n.semi).join() === phraseSemis("S R G P D S' D P G R S").join(), 'notes recovered in order');
ok(Math.max(...seg.notes.map(n => Math.abs(n.cents))) < 1, 'just-intoned notes read 0 cents in just mode');
tr = track('S G P G S G P', { dev: n => n.semi === 4 ? 22 : 0 });
let sum = summarize(segment(tr, sa).notes, { tol: 15 });
ok(Math.abs(sum.swaras.find(s => s.semi === 4).cents - 22) < 1.5 && /Shuddha Ga.*sharp/.test(sum.tips[0]), 'sharp Ga measured and reported: ' + sum.tips[0].slice(0, 48));
const est = estimateSa(track("S - - R G P - D S' - D P G R S - - .D S - - -"));
ok(est.length && Math.abs(cents(est[0].freq, sa)) < 15, `Sa estimate ${est[0]?.freq.toFixed(1)} Hz (true ${sa})`);

console.log('Raag identification');
const idOf = phrase => identify(outline(segment(track(phrase), sa).notes));
const cases = {
  yaman: ".N R G - M D N S' - N D P - M G - R G R S - .N R G - R S - P M G R S -",
  bhupali: "S R G - R S .D S - S R G P G - - D P G - R G - R S - G P D S' D P G - R S",
  malkauns: "S - .d .n S m - g m d n d m - g m g S - g m d n S' - n d m - g S -",
  darbari: ".n S R g - R S - m P d - n P - g m R S - .d .n S R S - R - m P d n S' d n P g m R S",
  desh: "R - m P N S' - S' n D P - D m G R - R m P n D P - m G R G .N S - R -",
  bageshree: "S .n .D S m - - m D n D m - g m D n S' - S' n D m - m P D m g R S - m -",
  marwa: ".N r G M D - D M G r - - .D .N r G r .N .D S - M D N r' N D M G r -",
  bhairav: "S r - G m P - G m d - d P - G m r - r S - G m d N S' N d P m G r - S",
  durga: "S R m P D S' - D P m R - R m P D m R S - S .D S R m - m R -",
  bihag: ".N S G m P N S' - S' N D P M P G m G - - R S - .N S G m G - P M P G m G R S",
};
for (const [id, ph] of Object.entries(cases)) {
  const res = idOf(ph);
  const top = res.results.slice(0, 3).map(x => `${x.raag.name} ${(x.score * 100).toFixed(0)}`).join(' | ');
  ok(res.sufficient && res.results[0]?.raag.id === id, `${byId[id].name.padEnd(16)} -> ${top}`);
}
ok(!idOf('S - - -').sufficient, 'single note: refuses to name a raag');
ok(!idOf('S R G R S R G').sufficient, 'three swaras: reports insufficient evidence');

console.log('Database');
ok(new Set(RAAGS.map(r => r.id)).size === RAAGS.length, `${RAAGS.length} raags, unique ids`);
let bad = [];
for (const r of RAAGS) {
  if (!IDS.includes(r.vadi) || !IDS.includes(r.samvadi)) bad.push(r.id + ': vadi/samvadi');
  if (!r.core[IDS.indexOf(r.vadi)] || !r.core[IDS.indexOf(r.samvadi)]) bad.push(r.id + ': vadi/samvadi not in scale');
  if (!r.set[0]) bad.push(r.id + ': no Sa');
  const th = THAATS[r.thaat];
  if (th) { const ts = th.split(' '); const extra = IDS.filter((x, i) => r.core[i] && !ts.includes(x)); if (extra.length > 2) bad.push(`${r.id}: ${extra} outside ${r.thaat}`); }
  for (const p of [r.aroha, r.avaroha, r.pakad, ...r.phrases]) if (phraseSemis(p).length < 3) bad.push(r.id + ': short phrase ' + p);
  const jumps = [r.aroha, r.avaroha, r.pakad, ...r.phrases].flatMap(p => { const s = phraseSemis(p); return s.slice(1).map((x, i) => Math.abs(x - s[i])); });
  if (Math.max(...jumps) > 12) bad.push(r.id + ': octave typo (leap > 12)');
}
ok(!bad.length, 'structural checks' + (bad.length ? '\n         ' + bad.join('\n         ') : ''));
console.log(fail ? `\n${fail} FAILED` : '\nAll engine tests passed');
process.exit(fail ? 1 : 0);
