// Bansuri Tuner: needle, stability, deviation history, per-flute Sa calibration,
// fingering chart with target frequencies and a measured intonation map of the instrument.
import * as store from '../store.js';
import { mic, tone } from '../audio.js';
import { $, header, micButton, seg, fitCanvas, cssVar, fmtHz, signed, toast, sheet, icons } from '../dom.js';
import { saHz, swaraOf, westernOf, swaraHTML, westernHTML, noteHTML, SWARAS, IDS, FINGERING, swaraHz, mod, clamp, NOTE_NAMES, SAFED_KALI, saptakName } from '../theory.js';

const holes = f => `<span class="holes">${f.map(v => `<i class="${v === 1 ? 'c' : v ? 'h' : ''}"></i>`).join('')}</span>`;

export function mount(el) {
  let s = store.get(), sa = saHz(s);
  let mode = s.tunerMode, col = {}, calib = null, dirty = false;
  const dev = []; // {t, c}
  const into = structuredClone(s.intonation || {});
  let needle = 0, target = 0, lastVoiced = -9, lastT = 0;

  el.innerHTML = `
    ${header('Bansuri Tuner', 'Tune', '')}
    <div class="seg" id="mode"><button data-v="swara">Swara · against Sa</button><button data-v="chromatic">Chromatic</button></div>
    <section class="gauge idle" id="g">
      <svg viewBox="0 0 320 190" class="dial" aria-hidden="true">
        <path d="M34 170 A126 126 0 0 1 286 170" class="arc"/>
        <path d="${arc(-5, 5)}" class="arc-ok"/>
        ${Array.from({ length: 21 }, (_, i) => { const v = -50 + i * 5, a = v * 1.2 * Math.PI / 180, big = v % 10 === 0, r1 = 126, r2 = big ? 112 : 119; return `<line x1="${160 + r1 * Math.sin(a)}" y1="${170 - r1 * Math.cos(a)}" x2="${160 + r2 * Math.sin(a)}" y2="${170 - r2 * Math.cos(a)}" class="${v === 0 ? 'tk0' : big ? 'tkb' : 'tks'}"/>`; }).join('')}
        ${[-50, -25, 0, 25, 50].map(v => { const a = v * 1.2 * Math.PI / 180; return `<text x="${160 + 98 * Math.sin(a)}" y="${174 - 98 * Math.cos(a)}" class="tl">${v > 0 ? '+' + v : v}</text>`; }).join('')}
        <g id="needle" style="transform:rotate(0deg)"><line x1="160" y1="170" x2="160" y2="52" class="nd"/></g>
        <circle cx="160" cy="170" r="6" class="hub"/>
      </svg>
      <div class="g-read">
        <div class="g-note" id="gN">—</div>
        <div class="g-cents" id="gC">&nbsp;</div>
        <div class="g-hz"><span id="gHz">—</span> Hz <span class="muted" id="gT"></span></div>
        <div class="g-hint" id="gH">Play a long, steady note</div>
      </div>
      <div class="stab"><span>Stability</span><div class="bar"><i id="gSt"></i></div><b id="gSv">—</b></div>
    </section>
    <div class="scope scope-s"><canvas id="cv"></canvas></div>
    <p class="hint">Deviation over the last 8 seconds. The band marks ±5 cents.</p>
    <div class="sticky-act"><button class="btn btn-primary" id="micBtn"></button></div>

    <h2 class="h2">Your bansuri</h2>
    <div class="panel" id="flute"></div>

    <h2 class="h2">Tuning reference</h2>
    <div class="panel">
      <div class="field"><div><b>Concert pitch</b><small>Frequency of A4. Most bansuris are made to 440 Hz.</small></div>
        <div class="stepper"><button id="aDn" aria-label="Lower">${icons.minus}</button><output id="aV"></output><button id="aUp" aria-label="Raise">${icons.plus}</button></div></div>
      <div class="field"><div><b>Fine-tune Sa</b><small>Offset of your flute's Sa from the nominal note, in cents.</small></div>
        <div class="stepper"><button id="fDn" aria-label="Lower">${icons.minus}</button><output id="fV"></output><button id="fUp" aria-label="Raise">${icons.plus}</button></div></div>
    </div>

    <h2 class="h2">Fingering and target pitches</h2>
    <div class="tbl" id="fing"></div>
    <p class="hint">Six holes shown from the blowing end. Half-filled means half-covered. The same fingerings sound an octave higher with a faster, narrower air stream. Tap a row to hear the target.</p>

    <h2 class="h2">Intonation map</h2>
    <p class="hint" style="margin-top:0">Built from your own steady notes while the tuner is listening. It shows how each note of this flute sits against its target, so you know which notes to lip up or down.</p>
    <div id="map"></div>
    <button class="btn" id="mapReset">Reset map</button>`;

  function arc(a, b) { const p = v => { const r = v * 1.2 * Math.PI / 180; return `${160 + 126 * Math.sin(r)} ${170 - 126 * Math.cos(r)}`; }; return `M${p(a)} A126 126 0 0 1 ${p(b)}`; }
  const E = id => $('#' + id, el);
  const offBtn = micButton(E('micBtn'), { idle: 'Start tuner', live: 'Stop tuner' });
  const readCols = () => { col = { gold: cssVar('--gold'), line: cssVar('--grid'), strong: cssVar('--grid-strong'), ok: cssVar('--ok'), text: cssVar('--muted') }; };
  readCols();
  seg(E('mode'), mode, v => { mode = v; store.set({ tunerMode: v }); });

  function paintStatic() {
    const midi = 12 * (s.saOct + 1) + s.saPc;
    E('flute').innerHTML = `
      <div class="field"><div><b>${escName(s.bansuriName)}</b><small>Sa (three holes closed) = ${NOTE_NAMES[s.saPc]}${s.saOct} · ${SAFED_KALI[s.saPc]} · ${fmtHz(sa)} Hz</small></div>
        <div class="stepper"><button id="sDn" aria-label="Sa down a semitone">${icons.minus}</button><output>${NOTE_NAMES[s.saPc]}<sub>${s.saOct}</sub></output><button id="sUp" aria-label="Sa up a semitone">${icons.plus}</button></div></div>
      <div class="field"><div><b>Calibrate from the flute</b><small>Hold your Sa steadily for two seconds. The app measures it and sets Sa and the fine-tune offset to match this instrument.</small></div>
        <button class="btn btn-gold" id="cal">${calib ? 'Listening…' : 'Calibrate Sa'}</button></div>
      <div class="field"><div><b>Lowest note</b><small>All six holes closed: mandra Pa</small></div><span class="val">${fmtHz(swaraHz(sa, -5, s.temperament))} Hz</span></div>`;
    const stepSa = d => { const m = clamp(midi + d, 48, 84); store.set({ saPc: mod(m, 12), saOct: Math.floor(m / 12) - 1 }); };
    $('#sDn', el).onclick = () => stepSa(-1); $('#sUp', el).onclick = () => stepSa(1);
    $('#cal', el).onclick = startCal;
    E('aV').textContent = s.a4 + ' Hz'; E('fV').textContent = signed(s.fine, 0) + '¢';
    const order = ['P', 'd', 'D', 'n', 'N', 'S', 'r', 'R', 'g', 'G', 'm', 'M'];
    E('fing').innerHTML = order.map(id => { const i = IDS.indexOf(id), semi = i >= 7 ? i - 12 : i; return `<button class="tr" data-semi="${semi}"><span class="td-s">${noteHTML(semi, s)}</span><span class="td-n">${holes(FINGERING[id])}</span><span class="td-r">${SWARAS[i].label}</span><span class="td-h">${fmtHz(swaraHz(sa, semi, s.temperament))}</span></button>`; }).join('');
    paintMap();
  }
  const escName = n => String(n).replace(/[<>&]/g, '');
  function paintMap() {
    const rows = Object.entries(into).filter(([, v]) => v.n >= 25).map(([k, v]) => ({ semi: +k, c: v.sum / v.n, n: v.n })).sort((a, b) => a.semi - b.semi);
    E('map').innerHTML = rows.length ? `<div class="imap">${rows.map(r => `<div class="im"><span class="im-n">${noteHTML(r.semi, s)}</span><div class="im-b"><i class="${Math.abs(r.c) <= 5 ? 'ok' : Math.abs(r.c) <= s.tol ? '' : 'off'}" style="${r.c >= 0 ? 'left:50%' : 'right:50%'};width:${Math.min(50, Math.abs(r.c))}%"></i></div><span class="im-v">${signed(r.c, 0)}¢</span></div>`).join('')}</div>`
      : '<p class="empty">No notes measured yet. Start the tuner and hold each note of the flute for a second or two.</p>';
  }
  paintStatic();
  E('fing').addEventListener('click', e => { const b = e.target.closest('[data-semi]'); if (b) tone(swaraHz(sa, +b.dataset.semi, s.temperament), { dur: 1.4 }); });
  E('aDn').onclick = () => store.set({ a4: clamp(s.a4 - 1, 415, 466) }); E('aUp').onclick = () => store.set({ a4: clamp(s.a4 + 1, 415, 466) });
  E('fDn').onclick = () => store.set({ fine: clamp(s.fine - 1, -50, 50) }); E('fUp').onclick = () => store.set({ fine: clamp(s.fine + 1, -50, 50) });
  E('mapReset').onclick = async () => { if (await sheet({ title: 'Reset intonation map?', body: 'The measurements collected for this flute will be cleared.', ok: 'Reset', danger: true })) { for (const k in into) delete into[k]; store.set({ intonation: {} }); paintMap(); } };

  async function startCal() {
    if (calib) return;
    if (!mic.active) { try { await mic.start(); } catch (e) { return toast(e.message); } }
    calib = { vals: [], t0: null }; paintStatic(); toast('Hold your Sa steadily…');
  }
  function finishCal(vals) {
    calib = null;
    const sorted = vals.sort((a, b) => a - b), f = sorted[sorted.length >> 1];
    const m = 69 + 12 * Math.log2(f / s.a4), r = Math.round(m);
    if (r < 45 || r > 88) { toast('That pitch is outside the bansuri range. Try again.'); return paintStatic(); }
    for (const k in into) delete into[k];
    store.set({ saPc: mod(r, 12), saOct: Math.floor(r / 12) - 1, fine: Math.round((m - r) * 100), intonation: {} });
    toast(`Sa set to ${NOTE_NAMES[mod(r, 12)]}${Math.floor(r / 12) - 1} ${signed((m - r) * 100, 0)}¢ (${fmtHz(f)} Hz)`);
  }

  const offStore = store.subscribe((ns, patch) => {
    const saChanged = ['saPc', 'saOct', 'fine', 'a4', 'temperament'].some(k => k in patch);
    s = ns; sa = saHz(s); readCols();
    if (saChanged && !('intonation' in patch)) { for (const k in into) delete into[k]; }
    paintStatic();
  });

  let shown = null, mapT = 0;
  const offMic = mic.on(f => {
    lastT = f.t;
    if (!(f.freq > 0)) {
      dev.push({ t: f.t, c: null });
      if (f.t - lastVoiced > 0.6 && shown !== null) {
        shown = null; target = 0; E('g').classList.add('idle');
        E('gN').textContent = '—'; E('gC').innerHTML = '&nbsp;'; E('gHz').textContent = '—'; E('gT').textContent = ''; E('gH').textContent = 'Play a long, steady note'; E('gSv').textContent = '—'; E('gSt').style.width = '0';
      }
      if (calib) calib.vals.length = 0;
      return;
    }
    lastVoiced = f.t;
    let cents, html, tgt, key;
    const sw = swaraOf(f.freq, sa, s.temperament);
    if (mode === 'swara') { cents = sw.cents; tgt = sw.target; key = 's' + sw.semi + s.notation; html = () => noteHTML(sw.semi, s) + `<small>${s.notation === 'indian' ? westernHTML(westernOf(f.freq, s.a4).midi) : swaraHTML(sw.semi)}</small>`; }
    else { const w = westernOf(f.freq, s.a4); cents = w.cents; tgt = w.target; key = 'c' + w.midi; html = () => westernHTML(w.midi) + `<small>${swaraHTML(sw.semi)}</small>`; }
    if (key !== shown) { shown = key; E('gN').innerHTML = html(); E('gT').textContent = '· target ' + fmtHz(tgt); }
    E('g').classList.remove('idle');
    target = clamp(cents, -50, 50);
    const a = Math.abs(cents);
    E('g').dataset.q = a <= 5 ? 'ok' : a <= s.tol ? 'near' : 'off';
    E('gC').textContent = signed(cents, 1) + ' cents';
    E('gHz').textContent = fmtHz(f.freq);
    E('gH').textContent = a <= 5 ? 'In tune' : cents > 0 ? 'Sharp · relax the air, roll inward' : 'Flat · faster air, roll outward';
    E('gSt').style.width = f.stab * 100 + '%'; E('gSv').textContent = f.stab ? '±' + f.std.toFixed(1) + '¢' : '—';
    dev.push({ t: f.t, c: cents });
    while (dev.length && f.t - dev[0].t > 9) dev.shift();
    // Intonation map: only steady, confident frames count.
    if (f.stab > 0.75 && f.conf > 0.9 && sw.semi >= -7 && sw.semi <= 24) {
      const m = into[sw.semi] || (into[sw.semi] = { sum: 0, n: 0 }); m.sum += sw.cents; m.n++; dirty = true;
      if (f.t - mapT > 1.5) { mapT = f.t; paintMap(); }
    }
    if (calib) {
      if (f.stab > 0.8) calib.vals.push(f.freq); else calib.vals.length = 0;
      if (calib.vals.length >= 60) finishCal(calib.vals);
    }
  });

  const cv = E('cv'), nd = E('needle');
  let raf;
  const draw = () => {
    raf = requestAnimationFrame(draw);
    needle += (target - needle) * 0.22;
    nd.style.transform = `rotate(${(needle * 1.2).toFixed(2)}deg)`;
    const { c, w, h } = fitCanvas(cv); if (!w) return;
    c.clearRect(0, 0, w, h);
    const y = v => h / 2 - v / 50 * (h / 2 - 6), now = mic.active ? (performance.now() - mic.t0) / 1000 : lastT;
    c.fillStyle = col.ok; c.globalAlpha = 0.1; c.fillRect(0, y(5), w, y(-5) - y(5)); c.globalAlpha = 1;
    c.strokeStyle = col.strong; c.beginPath(); c.moveTo(0, Math.round(h / 2) + .5); c.lineTo(w, Math.round(h / 2) + .5); c.stroke();
    c.strokeStyle = col.line; [25, -25].forEach(v => { c.beginPath(); c.moveTo(0, y(v)); c.lineTo(w, y(v)); c.stroke(); });
    c.strokeStyle = col.gold; c.lineWidth = 2; c.lineJoin = 'round'; c.beginPath();
    let pen = false;
    for (const p of dev) { if (p.c === null) { pen = false; continue; } const x = w - (now - p.t) / 8 * w, yy = y(clamp(p.c, -50, 50)); if (pen) c.lineTo(x, yy); else c.moveTo(x, yy); pen = true; }
    c.stroke(); c.lineWidth = 1;
  };
  draw();

  return () => { cancelAnimationFrame(raf); offMic(); offStore(); offBtn(); if (dirty) store.set({ intonation: into }); };
}
