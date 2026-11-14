// Music theory core: swaras, tuning maths, notation parsing and rendering.
export const mod = (n, m) => ((n % m) + m) % m;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export const IDS = ['S', 'r', 'R', 'g', 'G', 'm', 'M', 'P', 'd', 'D', 'n', 'N'];
export const SWARAS = [
  { id: 'S', syl: 'Sa', label: 'Sa', full: 'Shadja', type: 'achal', ratio: [1, 1] },
  { id: 'r', syl: 'Re', label: 'Komal Re', full: 'Komal Rishabh', type: 'komal', ratio: [16, 15] },
  { id: 'R', syl: 'Re', label: 'Shuddha Re', full: 'Shuddha Rishabh', type: 'shuddha', ratio: [9, 8] },
  { id: 'g', syl: 'Ga', label: 'Komal Ga', full: 'Komal Gandhar', type: 'komal', ratio: [6, 5] },
  { id: 'G', syl: 'Ga', label: 'Shuddha Ga', full: 'Shuddha Gandhar', type: 'shuddha', ratio: [5, 4] },
  { id: 'm', syl: 'Ma', label: 'Shuddha Ma', full: 'Shuddha Madhyam', type: 'shuddha', ratio: [4, 3] },
  { id: 'M', syl: 'Ma', label: 'Tivra Ma', full: 'Tivra Madhyam', type: 'tivra', ratio: [45, 32] },
  { id: 'P', syl: 'Pa', label: 'Pa', full: 'Pancham', type: 'achal', ratio: [3, 2] },
  { id: 'd', syl: 'Dha', label: 'Komal Dha', full: 'Komal Dhaivat', type: 'komal', ratio: [8, 5] },
  { id: 'D', syl: 'Dha', label: 'Shuddha Dha', full: 'Shuddha Dhaivat', type: 'shuddha', ratio: [5, 3] },
  { id: 'n', syl: 'Ni', label: 'Komal Ni', full: 'Komal Nishad', type: 'komal', ratio: [9, 5] },
  { id: 'N', syl: 'Ni', label: 'Shuddha Ni', full: 'Shuddha Nishad', type: 'shuddha', ratio: [15, 8] },
];
export const JUST_CENTS = SWARAS.map(s => 1200 * Math.log2(s.ratio[0] / s.ratio[1]));
export const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const SAFED_KALI = ['Safed 1', 'Kali 1', 'Safed 2', 'Kali 2', 'Safed 3', 'Safed 4', 'Kali 3', 'Safed 5', 'Kali 4', 'Safed 6', 'Kali 5', 'Safed 7'];

export const THAATS = {
  Bilawal: 'S R G m P D N', Kalyan: 'S R G M P D N', Khamaj: 'S R G m P D n', Bhairav: 'S r G m P d N',
  Purvi: 'S r G M P d N', Marwa: 'S r G M P D N', Kafi: 'S R g m P D n', Asavari: 'S R g m P d n',
  Bhairavi: 'S r g m P d n', Todi: 'S r g M P d N',
};

export const saMidi = s => 12 * (s.saOct + 1) + s.saPc;
export const saHz = s => s.a4 * 2 ** ((saMidi(s) - 69) / 12) * 2 ** ((s.fine || 0) / 1200);

export function westernOf(freq, a4 = 440) {
  const m = 69 + 12 * Math.log2(freq / a4);
  const r = Math.round(m);
  return { midi: r, name: NOTE_NAMES[mod(r, 12)], octave: Math.floor(r / 12) - 1, cents: (m - r) * 100, target: a4 * 2 ** ((r - 69) / 12) };
}

// Cents above Sa of a swara `semi` semitone-steps from Sa, in the chosen temperament.
export function swaraCents(semi, temperament = 'just') {
  const idx = mod(semi, 12), oct = Math.floor(semi / 12);
  return temperament === 'just' ? JUST_CENTS[idx] + 1200 * oct : semi * 100;
}
export const swaraHz = (sa, semi, temperament) => sa * 2 ** (swaraCents(semi, temperament) / 1200);

export function swaraOf(freq, sa, temperament = 'just') {
  const x = 12 * Math.log2(freq / sa);
  const semi = Math.round(x);
  const tc = swaraCents(semi, temperament);
  return { semi, idx: mod(semi, 12), oct: Math.floor(semi / 12), cents: x * 100 - tc, target: sa * 2 ** (tc / 1200), x };
}

export const saptakName = oct => oct <= -2 ? 'Ati-mandra saptak' : oct === -1 ? 'Mandra saptak' : oct === 0 ? 'Madhya saptak' : oct === 1 ? 'Taar saptak' : 'Ati-taar saptak';

export function swaraHTML(semi) {
  const idx = mod(semi, 12), oct = Math.floor(semi / 12), s = SWARAS[idx];
  const cls = ['sw', s.type === 'komal' && 'k', s.type === 'tivra' && 't', oct > 0 && 'up', oct < 0 && 'dn', Math.abs(oct) > 1 && 'x2'].filter(Boolean).join(' ');
  return `<span class="${cls}">${s.type === 'tivra' ? '<i></i>' : ''}${s.syl}</span>`;
}
export function westernHTML(midi) {
  return `<span class="wn">${NOTE_NAMES[mod(midi, 12)]}<sub>${Math.floor(midi / 12) - 1}</sub></span>`;
}
export const noteHTML = (semi, s) => s.notation === 'western' ? westernHTML(saMidi(s) + semi) : swaraHTML(semi);
export function noteText(semi, s) {
  if (s.notation === 'western') { const m = saMidi(s) + semi; return NOTE_NAMES[mod(m, 12)] + (Math.floor(m / 12) - 1); }
  return SWARAS[mod(semi, 12)].label;
}
// Short axis label for graphs.
export function axisLabel(semi, s) {
  if (s.notation === 'western') return NOTE_NAMES[mod(saMidi(s) + semi, 12)];
  const o = Math.floor(semi / 12);
  return (o < 0 ? '.' : '') + IDS[mod(semi, 12)] + (o > 0 ? "'" : '');
}

// Phrase notation: S r R g G m M P d D n N ; leading '.' = mandra, trailing ' = taar,
// ',' = breath/pause, '-' = hold previous note one more beat.
const TOK = /(\.{0,2})([SrRgGmMPdDnN])('{0,2})|([,\-])/g;
export function parsePhrase(str) {
  const out = []; let m; TOK.lastIndex = 0;
  while ((m = TOK.exec(str))) {
    if (m[2]) { const idx = IDS.indexOf(m[2]); out.push({ type: 'n', idx, semi: idx + 12 * (m[3].length - m[1].length), beats: 1 }); }
    else if (m[4] === '-' && out.length && out[out.length - 1].type === 'n') out[out.length - 1].beats += 1;
    else if (m[4] === ',') out.push({ type: 'p' });
  }
  return out;
}
export const phraseSemis = str => parsePhrase(str).filter(t => t.type === 'n').map(t => t.semi);
export function phraseHTML(str, s) {
  return parsePhrase(str).map(t => t.type === 'n'
    ? `<span class="pn">${noteHTML(t.semi, s)}${t.beats > 1 ? '<span class="hold">' + ' –'.repeat(t.beats - 1) + '</span>' : ''}</span>`
    : '<span class="pc">,</span>').join(' ');
}
// Notes to schedule for playback: [{semi, beats}] with pauses adding half a beat of ring-out.
export function phrasePlayable(str) {
  const out = [];
  for (const t of parsePhrase(str)) {
    if (t.type === 'n') out.push({ semi: t.semi, beats: t.beats });
    else if (out.length) out[out.length - 1].beats += 0.5;
  }
  return out;
}
export function semisToPhrase(semis) {
  return semis.map(x => { const o = Math.floor(x / 12); return (o < 0 ? '.'.repeat(-o) : '') + IDS[mod(x, 12)] + (o > 0 ? "'".repeat(o) : ''); }).join(' ');
}

// Bansuri: six-hole fingerings from the blowing end. 1 closed, 0 open, 0.5 half.
export const FINGERING = {
  P: [1, 1, 1, 1, 1, 1], d: [1, 1, 1, 1, 1, .5], D: [1, 1, 1, 1, 1, 0], n: [1, 1, 1, 1, .5, 0], N: [1, 1, 1, 1, 0, 0],
  S: [1, 1, 1, 0, 0, 0], r: [1, 1, .5, 0, 0, 0], R: [1, 1, 0, 0, 0, 0], g: [1, .5, 0, 0, 0, 0], G: [1, 0, 0, 0, 0, 0],
  m: [.5, 0, 0, 0, 0, 0], M: [0, 0, 0, 0, 0, 0],
};
