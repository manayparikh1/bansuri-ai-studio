// Raag Studio: identification from live playing or a saved take, and the raag encyclopedia.
import * as store from '../store.js';
import { mic, tone, playSemis, stopTones } from '../audio.js';
import { tanpura, FIRST } from '../tanpura.js';
import { $, $$, esc, header, micButton, seg, icons, toast } from '../dom.js';
import { saHz, SWARAS, IDS, noteHTML, phraseHTML, phrasePlayable, swaraHz, mod } from '../theory.js';
import { RAAGS, byId, sameSwaras, PRAHAR, praharNow } from '../raags.js';
import { segment, outline } from '../analysis.js';
import { identify } from '../raagid.js';
import { analyse } from '../finder.js';
import { NOTE_NAMES } from '../theory.js';

const dots = r => `<span class="dots">${r.set.map((v, i) => `<i class="${v ? (r.core[i] ? 'on' : 'tch') : ''}"></i>`).join('')}</span>`;
const phraseBtn = (str, s) => `<button class="ph" data-ph="${esc(str)}"><span class="ph-t">${phraseHTML(str, s)}</span><span class="ph-i">${icons.play}</span></button>`;

function bindPhrases(el) {
  el.addEventListener('click', e => {
    const b = e.target.closest('.ph'); if (!b) return;
    if (b.classList.contains('playing')) { stopTones(); b.classList.remove('playing'); $$('.pn.on', b).forEach(n => n.classList.remove('on')); return; }
    $$('.ph.playing', el).forEach(x => { x.classList.remove('playing'); $$('.pn.on', x).forEach(n => n.classList.remove('on')); });
    const pns = $$('.pn', b); b.classList.add('playing');
    playSemis(phrasePlayable(b.dataset.ph), { onStep: i => { pns.forEach((n, k) => n.classList.toggle('on', k === i)); if (i < 0) b.classList.remove('playing'); } });
  });
}

export function mount(el, args) {
  if (args[0] && byId[args[0]]) return detail(el, byId[args[0]]);
  return studio(el, args);
}

// ------------------------------------------------------------------------------------------
function studio(el, args) {
  let s = store.get();
  let tab = args[0] === 'library' ? 'library' : 'identify';
  el.innerHTML = `
    ${header('Raag Studio', 'Raag', '')}
    <div class="seg" id="tabs"><button data-v="identify">Identify</button><button data-v="library">Library · ${RAAGS.length}</button></div>
    <section id="pId"></section><section id="pLib" hidden></section>`;
  const pId = $('#pId', el), pLib = $('#pLib', el);
  const show = () => { pId.hidden = tab !== 'identify'; pLib.hidden = tab !== 'library'; };
  seg($('#tabs', el), tab, v => { tab = v; history.replaceState(null, '', v === 'library' ? '#/raag/library' : '#/raag'); show(); });
  show();

  // ---- Identify ----
  const fr = { t: [], f: [] };
  let lastRun = 0, source = 'live', autoSa = true;
  pId.innerHTML = `
    <p class="lede">Play or sing a phrase: the aroha and avaroha, then the pakad. The app listens to which swaras you use, how you move between them, and where you rest.</p>
    <div class="row-between" style="margin-top:0"><span class="hint" id="saLine" style="margin:0">Sa: detecting from what you play…</span><div class="seg seg-s" id="saMode"><button data-v="auto">Auto Sa</button><button data-v="mine">My Sa</button></div></div>
    <div class="evi"><div><b id="eN">0</b><span>notes</span></div><div><b id="eD">0</b><span>swaras</span></div><div><b id="eS">0</b><span>seconds</span></div></div>
    <div class="hist12" id="h12">${SWARAS.map((w, i) => `<div><div class="hb"><i></i></div><span>${noteHTML(i, s)}</span></div>`).join('')}</div>
    <div class="recent" id="seq"><span class="muted">The melodic outline appears here as you play.</span></div>
    <div class="sticky-act two"><button class="btn btn-primary" id="micBtn"></button><button class="btn" id="reset">Reset</button></div>
    <div id="res"></div>
    <details class="more"><summary>Analyse a saved recording instead</summary><div id="recs" class="list"></div></details>
    <p class="hint">Identification is rule-based and runs entirely on this device. It compares your playing with ${RAAGS.length} raags using swaras, aroha and avaroha movement, characteristic phrases, emphasis and detectable ornaments. It suggests resemblances and explains them; it cannot be certain, and closely related raags often need a longer, more characteristic passage to separate.</p>`;
  const offBtn = micButton($('#micBtn', pId));
  const E = id => $('#' + id, pId);
  seg(E('saMode'), 'auto', v => { autoSa = v === 'auto'; run(); });

  function run() {
    let ol, out, auto = null;
    if (autoSa) {
      // No Sa assumed: the tonic is worked out from the melody itself.
      const r = analyse(fr, { a4: s.a4, minNoteMs: s.minNoteMs });
      if (r.enough && r.raag) { auto = r; ol = r.outline; out = r.raag; }
    }
    if (!auto) {
      const { notes } = segment(fr, saHz(s), { minNoteMs: s.minNoteMs, temperament: s.temperament });
      ol = outline(notes); out = identify(ol);
    }
    E('saLine').innerHTML = autoSa ? (auto ? `Sa detected: <b>${NOTE_NAMES[auto.tonicPc]}</b> · ${Math.round(auto.confidence * 100)}% sure` : 'Sa: detecting from what you play…') : `Sa fixed at <b>${NOTE_NAMES[s.saPc]}</b> (your setting)`;
    E('eN').textContent = out.evidence.notes; E('eD').textContent = out.evidence.distinct; E('eS').textContent = out.evidence.seconds.toFixed(0);
    const mx = Math.max(0.01, ...out.evidence.hist);
    $$('#h12 .hb i', pId).forEach((b, i) => { b.style.height = out.evidence.hist[i] / mx * 100 + '%'; });
    E('seq').innerHTML = ol.length ? ol.slice(-80).map(n => `<span class="rn${n.meend ? ' meend' : ''}">${noteHTML(n.semi, s)}</span>`).join('') : '<span class="muted">The melodic outline appears here as you play.</span>';
    E('seq').scrollLeft = 1e6;
    if (!ol.length) { E('res').innerHTML = ''; return; }
    if (!out.sufficient) {
      E('res').innerHTML = `<div class="note-box"><b>Not enough to suggest a raag yet.</b><p>A raag cannot be named from a note or two. Still needed: ${out.need.join('; ')}.</p></div>`;
      return;
    }
    if (!out.results.length) { E('res').innerHTML = `<div class="note-box"><b>No close match in the library.</b><p>The swaras and movement heard do not fit any of the ${RAAGS.length} raags well. Check that Sa is set correctly for your instrument, or play a longer passage.</p></div>`; return; }
    E('res').innerHTML = `<h2 class="h2">Possible raags</h2>${out.contested ? '<p class="hint" style="margin-top:0">The top suggestions are very close. Play the pakad or a full descent to separate them.</p>' : ''}` +
      out.results.map((x, i) => `<a class="res${i === 0 ? ' top' : ''}" href="#/raag/${x.raag.id}">
        <div class="res-h"><h3>${x.raag.name}</h3><span class="tag">${x.label}</span></div>
        <div class="res-m">${x.raag.thaat} thaat ${dots(x.raag)}</div>
        <div class="bar"><i style="width:${Math.round(x.score * 100)}%"></i></div>
        <ul class="why">${x.why.map(w => `<li>${esc(w.t)}${w.p ? ' ' + w.p.map(p => `<span class="inl">${phraseHTML(p, s)}</span>`).join(' · ') : ''}</li>`).join('')}</ul>
        ${x.against.length ? `<ul class="against">${x.against.map(w => `<li>${esc(w.t)}</li>`).join('')}</ul>` : ''}
      </a>`).join('');
  }
  const offMic = mic.on(f => {
    if (source !== 'live') { source = 'live'; fr.t.length = fr.f.length = 0; }
    const base = fr.t.length ? fr.t[fr.t.length - 1] : 0;
    // Keep a continuous timeline across separate listening sessions.
    if (!fr.t.length || f.t < fr._last) fr._off = base + 0.5 - f.t;
    fr._last = f.t;
    fr.t.push(f.t + (fr._off || 0)); fr.f.push(f.freq);
    if (fr.t.length > 20000) { fr.t.splice(0, 2000); fr.f.splice(0, 2000); }
    if (f.t - lastRun > 0.8 || f.t < lastRun) { lastRun = f.t; run(); }
  });
  E('reset').onclick = () => { fr.t.length = fr.f.length = 0; fr._off = 0; run(); };
  store.recordings.list().then(list => {
    E('recs').innerHTML = list.length ? list.map(r => `<button class="li" data-id="${r.id}"><span><b>${esc(r.name)}</b><small>${new Date(r.created).toLocaleDateString()} · ${Math.round(r.duration)} s</small></span>${icons.chev}</button>`).join('') : '<p class="empty">No recordings yet. Make one in Practice.</p>';
  }).catch(() => {});
  E('recs').addEventListener('click', async e => {
    const b = e.target.closest('[data-id]'); if (!b) return;
    const rec = await store.recordings.get(b.dataset.id); if (!rec) return;
    if (mic.active) mic.stop();
    source = 'rec'; fr.t = Array.from(rec.t); fr.f = Array.from(rec.f); run();
    toast(`Analysed “${rec.name}” against your current Sa.`); E('res').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  if (args[0] === 'take' && args[1]) store.recordings.get(args[1]).then(rec => { if (rec) { source = 'rec'; fr.t = Array.from(rec.t); fr.f = Array.from(rec.f); run(); } });

  // ---- Library ----
  let q = '', thaat = 'All';
  const thaats = ['All', 'Now', ...new Set(RAAGS.map(r => r.thaat).filter(t => !t.startsWith('None')))];
  pLib.innerHTML = `
    <input class="inp search" id="q" type="search" placeholder="Search raag, thaat, mood or time" autocomplete="off">
    <div class="chips" id="chips">${thaats.map(t => `<button data-v="${t}">${t === 'Now' ? 'This hour' : t}</button>`).join('')}</div>
    <div class="list" id="list"></div>`;
  const paintList = () => {
    const now = praharNow(), qq = q.toLowerCase();
    const rows = RAAGS.filter(r => (thaat === 'All' || (thaat === 'Now' ? r.prahar === now : r.thaat === thaat)) &&
      (!qq || [r.name, r.thaat, r.rasa, r.time, r.jati].join(' ').toLowerCase().includes(qq))).sort((a, b) => a.name.localeCompare(b.name));
    $('#list', pLib).innerHTML = rows.length ? rows.map(r => `<a class="li raag-li" href="#/raag/${r.id}"><span><b>${r.name}</b><small>${r.thaat.startsWith('None') ? 'Carnatic origin' : r.thaat} · ${r.time.split(';')[0].split('(')[0].trim()}</small></span>${dots(r)}${icons.chev}</a>`).join('') : '<p class="empty">No raag matches that search.</p>';
  };
  seg($('#chips', pLib), thaat, v => { thaat = v; paintList(); });
  $('#q', pLib).oninput = e => { q = e.target.value; paintList(); };
  paintList();

  const offStore = store.subscribe(() => { s = store.get(); run(); });
  return () => { offMic(); offBtn(); offStore(); };
}

// ------------------------------------------------------------------------------------------
function practiceFor(r) {
  const drone = FIRST[r.tanpura].label;
  const v = SWARAS[IDS.indexOf(r.vadi)].label, sv = SWARAS[IDS.indexOf(r.samvadi)].label;
  return {
    Beginner: [
      { t: `Set the tanpura to ${drone} – Sa – Sa – Sa. Hold each swara of the raag for eight slow counts, listening for the point where it settles against the drone.`, p: r.notes.join(' ') },
      { t: 'Play the aroha and avaroha slowly, one note per breath-pulse, exactly as written. Do not add notes the raag omits.', p: r.aroha + ', ' + r.avaroha },
      { t: 'Repeat the pakad ten times until it can be played from memory without looking.', p: r.pakad },
    ],
    Intermediate: [
      { t: `Nyas (resting) practice: end every phrase on ${v}, then on ${sv}, then on Sa. These are the raag's points of rest.` },
      ...r.phrases.slice(0, 3).map(p => ({ t: 'Play this characteristic phrase in three tempos: slow, medium, double.', p })),
      { t: 'Join two phrases at a time into longer sentences, always closing with part of the pakad.' },
    ],
    Advanced: [
      { t: `Alap: develop the raag in stages. Begin around Sa in the mandra saptak, establish ${v}, open the middle register up to ${sv}, then reach taar Sa and return. Stay several minutes in each region.` },
      { t: 'Improvise for five minutes using only the phrases on this page and their fragments, then record it in Practice and check the identification and intonation.' },
      { t: `Taans: build fast patterns from the aroha and avaroha only, keeping the raag's omitted and vakra movements intact at speed.`, p: r.aroha },
      ...(r.andolan ? [{ t: `Refine the andolan on ${r.andolan.map(a => SWARAS[IDS.indexOf(a)].label).join(' and ')}: a slow, wide oscillation that begins from the note above and never sounds like vibrato.` }] : []),
    ],
  };
}

function detail(el, r) {
  let s = store.get(), lvl = 'Beginner';
  const pr = practiceFor(r);
  const paint = () => {
    const sa = saHz(s), vi = IDS.indexOf(r.vadi), si = IDS.indexOf(r.samvadi), same = sameSwaras(r);
    el.innerHTML = `
      ${header(r.thaat.startsWith('None') ? 'Raag · Carnatic origin' : `Raag · ${r.thaat} thaat`, r.name, r.rasa, '#/raag/library')}
      <p class="body">${r.about}</p>
      <div class="keys">${SWARAS.map((w, i) => `<button data-semi="${i}" class="${r.set[i] ? (r.core[i] ? 'in' : 'tch') : 'out'}${i === vi ? ' vadi' : i === si ? ' samvadi' : ''}"><span>${noteHTML(i, s)}</span><em>${i === vi ? 'vadi' : i === si ? 'samvadi' : ''}</em></button>`).join('')}</div>
      <p class="hint">Gold swaras belong to the raag; outlined ones are occasional touches. Tap any note to hear it against your Sa (${fmtSa(s, sa)}).</p>

      <dl class="facts">
        <div><dt>Thaat</dt><dd>${r.thaat}</dd></div><div><dt>Jati</dt><dd>${r.jati}</dd></div>
        <div><dt>Vadi</dt><dd>${SWARAS[vi].label}</dd></div><div><dt>Samvadi</dt><dd>${SWARAS[si].label}</dd></div>
        <div class="wide"><dt>Time</dt><dd>${r.time}</dd></div>
        <div class="wide"><dt>Character</dt><dd>${r.rasa}</dd></div>
      </dl>

      <h2 class="h2">Aroha</h2>${phraseBtn(r.aroha, s)}
      <h2 class="h2">Avaroha</h2>${phraseBtn(r.avaroha, s)}
      <h2 class="h2">Pakad</h2>${phraseBtn(r.pakad, s)}
      <h2 class="h2">Characteristic phrases</h2>${r.phrases.map(p => phraseBtn(p, s)).join('')}

      <h2 class="h2">Important swaras</h2>
      <p class="body">${SWARAS[vi].label} is the vadi, the most emphasised note, and ${SWARAS[si].label} the samvadi that answers it. ${r.andolan ? `${r.andolan.map(a => SWARAS[IDS.indexOf(a)].label).join(' and ')} carry a slow andolan. ` : ''}${r.reg ? `The raag is developed mainly in the ${r.reg === 'low' ? 'lower and middle' : 'upper'} register. ` : ''}${IDS.filter((_, i) => r.set[i] && !r.core[i]).length ? `Occasional touches: ${IDS.filter((_, i) => r.set[i] && !r.core[i]).map(a => SWARAS[IDS.indexOf(a)].label).join(', ')}.` : ''}</p>

      <h2 class="h2">Tanpura</h2>
      <div class="panel"><div class="field"><div><b>${FIRST[r.tanpura].label} – Sa – Sa – Sa</b><small>${r.tanpura === 'P' ? 'Pancham tuning suits this raag.' : r.tanpura === 'm' ? 'Pa is absent or weak; tune the first string to Ma.' : 'Neither Pa nor shuddha Ma belongs here; tune the first string to Ni.'}</small></div><button class="btn btn-gold" id="setT">Play drone</button></div></div>

      <h2 class="h2">Common mistakes</h2>
      <ul class="plain">${r.mistakes.map(m => `<li>${m}</li>`).join('')}</ul>

      <h2 class="h2">Practice</h2>
      <div class="seg" id="lvl">${Object.keys(pr).map(k => `<button data-v="${k}">${k}</button>`).join('')}</div>
      <ol class="steps" id="prac"></ol>

      ${same.length ? `<h2 class="h2">Same swaras, different raag</h2><div class="list">${same.map(o => `<a class="li" href="#/raag/${o.id}"><span><b>${o.name}</b><small>Vadi ${SWARAS[IDS.indexOf(o.vadi)].label} · ${o.time.split(';')[0].split('(')[0].trim()}</small></span>${icons.chev}</a>`).join('')}</div>` : ''}
      <p class="hint">Vadi, samvadi and performance time follow the most widely taught convention; individual gharanas differ.</p>`;
    const pp = () => { $('#prac', el).innerHTML = pr[lvl].map(x => `<li><p>${x.t}</p>${x.p ? phraseBtn(x.p, s) : ''}</li>`).join(''); };
    seg($('#lvl', el), lvl, v => { lvl = v; pp(); }); pp();
    $('.keys', el).onclick = e => { const b = e.target.closest('[data-semi]'); if (b) tone(swaraHz(sa, +b.dataset.semi, s.temperament), { dur: 1.2 }); };
    $('#setT', el).onclick = () => { store.setTanpura({ first: r.tanpura }); if (!tanpura.playing) tanpura.start(); toast(`Tanpura: ${FIRST[r.tanpura].label} – Sa – Sa – Sa`); };
  };
  const fmtSa = (s, sa) => sa.toFixed(1) + ' Hz';
  paint(); bindPhrases(el);
  const off = store.subscribe((ns, patch) => { if ('tanpura' in patch && Object.keys(patch).length === 1) return; s = ns; paint(); });
  return () => { off(); stopTones(); };
}
