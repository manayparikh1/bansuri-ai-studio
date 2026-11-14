// Scale Finder: listen to singing, an instrument or a song and report the Sa, the bansuri to
// pick up, the closest thaat and the raag underneath. No Sa needs to be set beforehand.
import * as store from '../store.js';
import { mic, tone, getCtx, micErrorText } from '../audio.js';
import { tanpura } from '../tanpura.js';
import { Yin, Tracker } from '../pitch.js';
import { analyse, chromaFromSpectrum, fftMag, WESTERN_MODE } from '../finder.js';
import { $, $$, esc, header, icons, toast, fmtHz, signed } from '../dom.js';
import { NOTE_NAMES, SAFED_KALI, SWARAS, IDS, FINGERING, swaraHTML, phraseHTML, mod, clamp, westernOf } from '../theory.js';

const holes = f => `<span class="holes">${f.map(v => `<i class="${v === 1 ? 'c' : v ? 'h' : ''}"></i>`).join('')}</span>`;
const dots = r => `<span class="dots">${r.set.map((v, i) => `<i class="${v ? (r.core[i] ? 'on' : 'tch') : ''}"></i>`).join('')}</span>`;
const indian = { notation: 'indian' };

export function mount(el) {
  let s = store.get();
  const fr = { t: [], f: [] };
  let off = 0, lastFrameT = -1, lastRun = 0, res = null, locked = null, source = 'Live';
  const recentPc = []; let challenger = -1, challengerN = 0, sig = '', livePc = -1, busy = false, settled = false;

  el.innerHTML = `
    ${header('Scale Finder', 'Find the Sa', 'Sing, play, or hold the phone near a song. Nothing to set up first.')}
    <section class="fx-listen">
      <button class="orb" id="orb" aria-label="Start or stop listening"><i class="orb-ring"></i><span class="orb-ic">${icons.mic}</span></button>
      <div class="fx-live"><b id="lvN">—</b><span id="lvC">&nbsp;</span></div>
      <div class="bar fx-level"><i id="lvL"></i></div>
      <p class="fx-status" id="status">Tap the microphone, then sing or play a few phrases.</p>
    </section>

    <section id="result" hidden>
      <div class="fx-head"><span class="cap" style="margin:0">Sa · bansuri scale</span><span class="tag" id="badge">Listening</span></div>
      <div class="fx-main">
        <div class="fx-sa" id="saN">—</div>
        <div class="fx-side">
          <div class="fx-flute" id="saF"></div>
          <div class="fx-hz" id="saH"></div><div class="fx-alt" id="saAlt"></div>
          <div class="fx-conf"><div class="bar"><i id="cfB"></i></div><span id="cfT">0%</span></div>
        </div>
      </div>
      <dl class="facts" id="facts"></dl>
      <div class="hist12" id="bars">${SWARAS.map((w, i) => `<div><div class="hb"><i></i></div><span>${swaraHTML(i)}</span></div>`).join('')}</div>
      <div class="fx-btns"><button class="btn btn-gold" id="useSa">Set as my Sa</button><button class="btn" id="hearSa">Hear Sa</button><button class="btn" id="redo">Re-detect</button></div>

      <h2 class="h2">Raag underneath</h2>
      <div id="raag"></div>

      <h2 class="h2">Which bansuri to pick up</h2>
      <div id="flutes"></div>
      <p class="cap">Flutes you own</p>
      <div class="chips wrap" id="mine">${NOTE_NAMES.map((n, i) => `<button data-v="${i}">${n}</button>`).join('')}</div>

      <h2 class="h2">Fingering · play what they sing</h2>
      <p class="hint" id="fgH" style="margin:0 0 8px"></p>
      <div class="tbl" id="fing"></div>
      <p class="hint">Six holes from the blowing end; half-filled means half-covered. From Pa upward, blow into the upper register. While listening, the note being sung lights up.</p>

      <h2 class="h2">Swaras heard</h2>
      <div class="seqwrap" id="seq"></div>
    </section>

    <h2 class="h2">Analyse an audio file</h2>
    <label class="drop" id="drop"><input type="file" id="file" accept="audio/*,video/mp4,.mp3,.wav,.m4a,.aac,.ogg,.flac" hidden><span id="dropT">Choose a recording or song from this device</span><div class="bar" id="fileBar" hidden><i id="fileFill"></i></div></label>
    <p class="hint">Works best on a clear single melody: a voice, a flute, a solo instrument. With full songs and accompaniment the Sa is estimated from the overall spectrum and the raag is given only as a hint. All analysis happens on this device.</p>`;

  const E = id => $('#' + id, el);
  const paintMine = () => $$('#mine button', el).forEach(b => b.classList.toggle('on', s.myFlutes.includes(+b.dataset.v)));
  paintMine();
  E('mine').onclick = e => { const b = e.target.closest('button'); if (!b) return; const v = +b.dataset.v; store.set({ myFlutes: s.myFlutes.includes(v) ? s.myFlutes.filter(x => x !== v) : [...s.myFlutes, v] }); };

  const current = () => locked || res;

  function render(force) {
    const r = current(); if (!r) return;
    E('result').hidden = false;
    const pc = r.tonicPc, th = r.thaat, top = r.raag && r.raag.sufficient ? r.raag.results.slice(0, 3) : [];
    const newSig = [pc, r.confidence < 0.5 && r.candidates[1] ? r.candidates[1].pc : -1, Math.round(r.cents / 4), th.name, top.map(x => x.raag.id + x.label).join(), !!locked, settled, r.melodic, r.raag ? r.raag.sufficient + (r.raag.need || []).join() : '', s.myFlutes.join(), source].join('|');
    E('cfB').style.width = Math.round(r.confidence * 100) + '%'; E('cfT').textContent = Math.round(r.confidence * 100) + '% sure';
    const mx = Math.max(0.01, ...r.rel);
    $$('#bars .hb i', el).forEach((b, i) => { b.style.height = r.rel[i] / mx * 100 + '%'; });
    if (r.outline.length) E('seq').innerHTML = r.outline.slice(-90).map(n => `<span class="rn">${swaraHTML(n.semi)}</span>`).join('');
    else E('seq').innerHTML = '<span class="muted">No single melodic line could be followed in this audio.</span>';
    if (newSig === sig && !force) return;
    sig = newSig;

    E('badge').textContent = locked ? 'From file' : settled ? 'Settled' : 'Confirming';
    E('badge').classList.toggle('solid', !!locked || settled);
    E('saN').textContent = NOTE_NAMES[pc];
    E('saF').innerHTML = `${NOTE_NAMES[pc]} bansuri<small>${SAFED_KALI[pc]}</small>`;
    const offTxt = Math.abs(r.cents) < 6 ? 'at concert pitch' : `${signed(r.cents, 0)}¢ from concert pitch`;
    E('saH').textContent = r.melodic ? `Sa heard at ${fmtHz(r.saHz)} Hz · ${offTxt}` : 'Estimated from the whole sound';
    const alt = r.candidates && r.candidates[1];
    E('saAlt').textContent = alt && r.confidence < 0.5 ? `Not certain yet. It could also be ${NOTE_NAMES[alt.pc]}; keep singing to settle it.` : '';
    const used = IDS.filter((_, i) => r.rel[i] >= 0.03 * r.rel.reduce((a, b) => a + b, 0) * 1).map(x => IDS.indexOf(x));
    E('facts').innerHTML = `
      <div><dt>Closest thaat</dt><dd>${th.name}</dd></div><div><dt>Western</dt><dd>${NOTE_NAMES[pc]} ${WESTERN_MODE[th.name] || ''}</dd></div>
      <div class="wide"><dt>Swaras used</dt><dd class="swl">${used.length ? used.map(i => swaraHTML(i)).join(' ') : '—'}</dd></div>`;

    // Raag
    if (!r.melodic) E('raag').innerHTML = `<div class="note-box"><b>Raag hint only</b><p>This audio has accompaniment, so individual swaras cannot be followed reliably. The scale is closest to <b>${th.name}</b> thaat. For a proper raag reading, sing or play the melody on its own.</p></div>`;
    else if (!r.raag || !r.raag.sufficient) E('raag').innerHTML = `<div class="note-box"><b>Keep going</b><p>A raag cannot be named yet. Still needed: ${r.raag ? r.raag.need.join('; ') : 'more melody'}.</p></div>`;
    else if (!top.length) E('raag').innerHTML = `<div class="note-box"><b>No close match</b><p>The movement does not fit any of the raags in the library well; it sits in <b>${th.name}</b> thaat.</p></div>`;
    else E('raag').innerHTML = (r.raag.contested ? '<p class="hint" style="margin:0 0 10px">The top suggestions are close. A full descent or the pakad will separate them.</p>' : '') + top.map((x, i) => `<a class="res${i === 0 ? ' top' : ''}" href="#/raag/${x.raag.id}">
        <div class="res-h"><h3>${x.raag.name}</h3><span class="tag">${x.label}</span></div>
        <div class="res-m">${x.raag.thaat} thaat ${dots(x.raag)}</div>
        <div class="bar"><i style="width:${Math.round(x.score * 100)}%"></i></div>
        <ul class="why">${x.why.slice(0, i === 0 ? 5 : 2).map(w => `<li>${esc(w.t)}${w.p ? ' ' + w.p.map(p => `<span class="inl">${phraseHTML(p, indian)}</span>`).join(' · ') : ''}</li>`).join('')}</ul>
        ${i === 0 && x.against.length ? `<ul class="against">${x.against.map(w => `<li>${esc(w.t)}</li>`).join('')}</ul>` : ''}</a>`).join('');

    // Flutes
    const own = new Set(s.myFlutes);
    const opts = [
      { tag: 'Recommended', sa: pc, d: 'The song\'s Sa is your flute\'s Sa (three holes closed). Natural fingering.' },
      { tag: 'Deeper · play from Ma', sa: mod(pc + 7, 12), d: 'Treat this flute\'s Ma as the song\'s Sa. A lower, fuller sound.' },
      { tag: 'Brighter · play from Pa', sa: mod(pc + 5, 12), d: 'Treat this flute\'s Pa as the song\'s Sa.' },
    ];
    if (own.size && !opts.some(o => own.has(o.sa))) {
      const rank = [0, 7, 5, 9, 2, 4, 11, 10, 3, 8, 1, 6];
      const best = [...own].map(sa => ({ sa, rel: mod(pc - sa, 12) })).sort((a, b) => rank.indexOf(a.rel) - rank.indexOf(b.rel))[0];
      opts.push({ tag: 'Best from your flutes', sa: best.sa, d: `The song's Sa falls on this flute's ${SWARAS[best.rel].label}. Play treating that note as Sa.` });
    }
    E('flutes').innerHTML = opts.map((o, i) => `<div class="flute${i === 0 ? ' top' : ''}"><div><span class="cap" style="margin:0">${o.tag}${own.has(o.sa) ? ' · yours' : ''}</span><b>${NOTE_NAMES[o.sa]} bansuri</b><small>${SAFED_KALI[o.sa]} · ${o.d}</small></div></div>`).join('');

    E('fgH').textContent = `On the ${NOTE_NAMES[pc]} bansuri (${SAFED_KALI[pc]}).`;
    const order = ['P', 'd', 'D', 'n', 'N', 'S', 'r', 'R', 'g', 'G', 'm', 'M'];
    E('fing').innerHTML = order.map(id => { const i = IDS.indexOf(id); return `<div class="tr" data-pc="${i}"><span class="td-s">${swaraHTML(i >= 7 ? i - 12 : i)}</span><span class="td-n">${holes(FINGERING[id])}</span><span class="td-r">${SWARAS[i].label}</span><span class="td-h">${NOTE_NAMES[mod(pc + i, 12)]}</span></div>`; }).join('');
    livePc = -1;
  }

  function setStatus() {
    const r = current();
    const st = E('status');
    if (busy) return;
    const name = r ? NOTE_NAMES[r.tonicPc] : '';
    if (locked) st.textContent = `Found ${name}. Pick up your ${name} bansuri.`;
    else if (settled) st.textContent = `Sa is ${name}. Pick up your ${name} bansuri.${mic.active ? ' Still listening.' : ''}`;
    else if (!mic.active) st.textContent = r ? `Best reading so far: ${name}, ${Math.round(r.confidence * 100)}% sure. Sing a little longer to confirm it.` : 'Tap the microphone, then sing or play a few phrases.';
    else if (r) st.textContent = `Hearing ${name}… confirming. Keep singing.`;
    else st.textContent = fr.f.some(x => x > 0) ? 'Listening… a few more notes.' : 'Listening… sing or play near the phone.';
  }

  // The answer always reflects everything heard so far. It is never frozen: a short excerpt can
  // point to the wrong Sa (often the raag's Ma or Pa), and more singing must be able to correct it.
  function estimate(final) {
    const tr = fr.t.length > 3400 ? { t: fr.t.slice(-3400), f: fr.f.slice(-3400) } : fr;
    const r = analyse(tr, { a4: s.a4, minNoteMs: s.minNoteMs, chroma: mic.chromaSec > 1.5 ? Array.from(mic.chroma) : null });
    if (!r.enough) { setStatus(); return; }
    locked = null;
    recentPc.push(r.tonicPc); if (recentPc.length > 8) recentPc.shift();
    if (final || !res || r.tonicPc === res.tonicPc) { res = r; challengerN = 0; }
    else {
      // A different Sa must lead three estimates running before the display moves, so it does not flicker.
      if (r.tonicPc === challenger) challengerN++; else { challenger = r.tonicPc; challengerN = 1; }
      if (challengerN >= 3) { res = r; challengerN = 0; }
    }
    const heard = r.melodic ? r.voicedSec >= 6 && r.notes >= 10 : mic.chromaSec >= 7;
    const was = settled;
    settled = recentPc.length >= 8 && recentPc.every(x => x === res.tonicPc) && res.confidence >= 0.5 && heard;
    if (settled && !was && navigator.vibrate) navigator.vibrate(60);
    render(); setStatus();
  }

  function clearAll() {
    fr.t.length = fr.f.length = 0; off = 0; lastFrameT = -1; res = locked = null; recentPc.length = 0; challengerN = 0; sig = ''; source = 'Live'; settled = false;
    mic.chromaReset(); E('result').hidden = true; setStatus();
  }

  const paintOrb = () => { E('orb').classList.toggle('on', mic.active); if (!mic.active && fr.t.length && !locked) estimate(true); setStatus(); };
  E('orb').onclick = async () => {
    if (mic.active) return mic.stop();
    if (locked && source === 'File') clearAll();
    try { await mic.start(); } catch (e) { toast(micErrorText(e), 6000); }
  };
  const offState = mic.onState(paintOrb);
  mic.chromaReset(); paintOrb();

  const offMic = mic.on(f => {
    if (f.t < lastFrameT || !fr.t.length) off = (fr.t.length ? fr.t[fr.t.length - 1] + 0.5 : 0) - f.t;
    lastFrameT = f.t;
    fr.t.push(f.t + off); fr.f.push(f.freq);
    E('lvL').style.width = clamp((20 * Math.log10(f.rms + 1e-6) + 60) / 54, 0, 1) * 100 + '%';
    const r = current();
    if (f.freq > 0) {
      const w = westernOf(f.freq, s.a4);
      E('lvN').textContent = w.name + w.octave;
      let pc = -1;
      if (r) { const x = 12 * Math.log2(f.freq / r.saHz); pc = mod(Math.round(x), 12); E('lvC').innerHTML = swaraHTML(Math.round(x)); } else E('lvC').textContent = fmtHz(f.freq) + ' Hz';
      if (pc !== livePc) { livePc = pc; $$('#fing .tr', el).forEach(n => n.classList.toggle('act', +n.dataset.pc === pc)); }
    } else { E('lvN').textContent = '—'; E('lvC').innerHTML = '&nbsp;'; if (livePc !== -1) { livePc = -1; $$('#fing .tr.act', el).forEach(n => n.classList.remove('act')); } }
    if (f.t - lastRun > 0.45 || f.t < lastRun) { lastRun = f.t; estimate(); }
  });

  E('redo').onclick = () => { clearAll(); toast('Cleared. Listening afresh.'); };
  E('hearSa').onclick = () => { const r = current(); if (!r) return; let f = r.saHz; while (f < 200) f *= 2; while (f > 520) f /= 2; tone(f, { dur: 2.4 }); };
  E('useSa').onclick = () => {
    const r = current(); if (!r) return;
    store.set({ saPc: r.tonicPc, saOct: 4, fine: clamp(Math.round(r.cents), -50, 50) });
    toast(`Sa set to ${NOTE_NAMES[r.tonicPc]}. The tuner, tanpura and detector now use it.`);
  };

  // ---- File analysis ----
  async function analyseFile(file) {
    if (mic.active) mic.stop();
    busy = true; E('status').textContent = `Reading “${file.name}”…`; E('fileBar').hidden = false; E('fileFill').style.width = '0';
    try {
      const ab = await getCtx().decodeAudioData(await file.arrayBuffer());
      const sr = ab.sampleRate, len = Math.min(ab.length, Math.floor(sr * 150));
      const data = new Float32Array(len);
      for (let ch = 0; ch < ab.numberOfChannels; ch++) { const d = ab.getChannelData(ch); for (let i = 0; i < len; i++) data[i] += d[i] / ab.numberOfChannels; }
      const yin = new Yin(sr), tk = new Tracker(), hop = Math.round(sr * 0.03), N = 16384;
      const win = new Float32Array(N); for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
      const t = [], f = [], chroma = new Float64Array(12), frame = new Float64Array(12), tmp = new Float32Array(N);
      let k = 0, csec = 0;
      for (let pos = yin.need; pos < len; pos += hop, k++) {
        const r = yin.detect(data.subarray(pos - yin.need, pos), s.gate);
        t.push(pos / sr); f.push(tk.push(r.freq > 0 && r.conf >= s.minConf ? r.freq : 0).freq);
        if (k % 6 === 0 && pos >= N && r.rms > s.gate) {
          for (let i = 0; i < N; i++) tmp[i] = data[pos - N + i] * win[i];
          frame.fill(0); const tot = chromaFromSpectrum(fftMag(tmp), sr, N, s.a4, frame);
          if (tot > 0) { for (let i = 0; i < 12; i++) chroma[i] += frame[i] / tot; csec += 0.18; }
        }
        if (k % 120 === 0) { E('fileFill').style.width = Math.round(pos / len * 100) + '%'; await new Promise(r2 => setTimeout(r2)); }
      }
      const r = analyse({ t, f }, { a4: s.a4, minNoteMs: s.minNoteMs, chroma: csec > 1.5 ? Array.from(chroma) : null });
      busy = false;
      if (!r.enough) { E('status').textContent = 'No clear pitched sound was found in that file.'; return; }
      fr.t = t; fr.f = f; res = r; locked = r; source = 'File'; sig = '';
      render(true); setStatus(); E('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
      E('dropT').textContent = file.name + (ab.duration > 150 ? ' · first 2½ minutes analysed' : '');
    } catch (e) { busy = false; E('status').textContent = 'That file could not be read as audio.'; toast('Could not decode the file: ' + (e?.message || 'unsupported format'), 5000); }
    finally { busy = false; E('fileBar').hidden = true; E('file').value = ''; }
  }
  E('file').onchange = e => { const f = e.target.files[0]; if (f) analyseFile(f); };

  const offStore = store.subscribe(ns => { s = ns; paintMine(); if (current()) render(true); });
  return () => { offMic(); offState(); offStore(); };
}
