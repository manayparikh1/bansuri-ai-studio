// Scale Finder tests: sung-style phrases in many keys and tunings, with no Sa given.
import { analyse } from '../js/finder.js';
import { phrasePlayable, swaraHz, NOTE_NAMES, mod } from '../js/theory.js';
import { byId } from '../js/raags.js';
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
// Voice-like track: just-intoned notes with vibrato, pitch scoops between notes, jitter and breaths.
function sing(phrase, saHz, { beat = 0.38, vib = 14, jitter = 5 } = {}) {
  const t = [], f = []; let now = 0, prev = null;
  for (const n of phrasePlayable(phrase)) {
    const dur = n.beats * beat, target = swaraHz(saHz, n.semi, 'just');
    for (let x = 0; x < dur; x += 0.03) {
      let hz = target;
      if (prev && x < 0.07) hz = prev * (target / prev) ** (x / 0.07);          // scoop into the note
      const c = (x > 0.2 ? vib * Math.sin(2 * Math.PI * 5.5 * x) : 0) + (rnd() - 0.5) * 2 * jitter;
      t.push(now + x); f.push(rnd() < 0.04 ? 0 : hz * 2 ** (c / 1200));
    }
    prev = target; now += dur;
    if (rnd() < 0.18) { for (let x = 0; x < 0.25; x += 0.03) { t.push(now + x); f.push(0); } now += 0.25; prev = null; }
  }
  return { t, f };
}
const P = {
  yaman: ".N R G - M D N S' - N D P - M G - R G R S - .N R G - R S - P M G R S - -",
  bhupali: "S R G - R S .D S - S R G P G - - D P G - R G - R S - G P D S' D P G - R S - -",
  malkauns: "S - .d .n S m - g m d n d m - g m g S - g m d n S' - n d m - g S - -",
  desh: "R - m P N S' - S' n D P - D m G R - R m P n D P - m G R G .N S - -",
  bageshree: "S .n .D S m - - m D n D m - g m D n S' - S' n D m - m P D m g R S - -",
  bhairav: "S r - G m P - G m d - d P - G m r - r S - G m d N S' N d P m G r - S - -",
  bhimpalasi: ".n S m - m g - P m - g m P n S' - S' n D P m - P m g - m g R S - -",
  kafi: "S R g m P - m g R S - R g m P D n S' - S' n D P m g R S - R g R S - -",
  durga: "S R m P D S' - D P m R - R m P D m R S - S .D S R m - m R S - -",
  bihag: ".N S G m P N S' - S' N D P M P G m G - - R S - .N S G m G - P M P G m G R S - -",
  khamaj: "S G m P D N S' - S' n D P - D m G - G m P D n D - m P D m G - R S - -",
  marwa: ".N r G M D - D M G r - - .D .N r G r .N .D S - M D N r' N D M G r - S - -",
};
// Sa in assorted keys and off-concert tunings, male and female registers.
const KEYS = [[130.81, 0], [146.83, 22], [164.81, -18], [185.0, 0], [207.65, 35], [220, -30], [246.94, 0], [277.18, 12], [311.13, -9], [349.23, 0], [196, 40], [233.08, -41]];
let ok = 0, raagOk = 0, n = 0, i = 0; const miss = [];
for (const [id, ph] of Object.entries(P)) for (let k = 0; k < 4; k++) {
  const [hz, cents] = KEYS[(i++ * 5 + k) % KEYS.length]; const sa = hz * 2 ** (cents / 1200);
  const r = analyse(sing(ph, sa)); n++;
  const err = r.enough ? 1200 * Math.log2(r.saHz / sa) : 999;
  const pcOk = r.enough && Math.abs(((err % 1200) + 1800) % 1200 - 600) < 30;
  const top = r.raag && r.raag.results[0] ? r.raag.results[0].raag.id : '-';
  if (pcOk) ok++; if (pcOk && top === id) raagOk++;
  if (!pcOk || top !== id) miss.push(`${byId[id].name} @ ${sa.toFixed(1)} Hz -> Sa ${r.enough ? NOTE_NAMES[r.tonicPc] + ' ' + r.saHz.toFixed(1) : 'none'} (${err.toFixed(0)}c) raag ${top} conf ${(r.confidence * 100 | 0)}% | ${r.candidates?.map(c => NOTE_NAMES[c.pc] + (c.score * 100 | 0)).join(' ')}`);
}
console.log(`Sa found: ${ok}/${n}   Sa + raag both right: ${raagOk}/${n}`);
if (miss.length) console.log(miss.join('\n'));
// Octave placement and offset accuracy on one case
const r = analyse(sing(P.yaman, 207.65 * 2 ** (35 / 1200)));
console.log(`detail: Sa ${r.saHz.toFixed(2)} Hz (true ${(207.65 * 2 ** (35 / 1200)).toFixed(2)}), offset ${r.cents.toFixed(0)}c, thaat ${r.thaat.name}, conf ${(r.confidence * 100).toFixed(0)}%`);
const few = analyse(sing('S - - R - -', 220));
console.log('two notes only ->', few.enough ? `Sa guess ${NOTE_NAMES[few.tonicPc]} conf ${(few.confidence * 100).toFixed(0)}%, raag named: ${few.raag?.sufficient}` : 'not enough');
// How early is the answer right? Same phrases cut short.
for (const frac of [0.4, 0.6, 0.8]) {
  let good = 0, tot = 0, sure = 0, sureWrong = 0; i = 0;
  for (const [id, ph] of Object.entries(P)) for (let k = 0; k < 4; k++) {
    const [hz, cents] = KEYS[(i++ * 5 + k) % KEYS.length]; const sa = hz * 2 ** (cents / 1200);
    const full = sing(ph, sa), cut = Math.floor(full.t.length * frac);
    const r = analyse({ t: full.t.slice(0, cut), f: full.f.slice(0, cut) }); tot++;
    const err = r.enough ? 1200 * Math.log2(r.saHz / sa) : 999;
    const pcOk = r.enough && Math.abs(((err % 1200) + 1800) % 1200 - 600) < 30;
    if (pcOk) good++; if (r.enough && r.confidence >= 0.5) { sure++; if (!pcOk) sureWrong++; }
  }
  console.log(`first ${frac * 100}% of the phrase: Sa right ${good}/${tot}; marked >=50% sure: ${sure}, of which wrong: ${sureWrong}`);
}
process.exit(ok / n >= 0.9 ? 0 : 1);
