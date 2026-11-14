// Live Detector: real-time note / swara readout, scrolling pitch history and the swara chart.
import * as store from '../store.js';
import { mic, tone } from '../audio.js';
import { $, $$, header, micButton, seg, fitCanvas, cssVar, fmtHz, signed } from '../dom.js';
import { saHz, swaraOf, westernOf, noteHTML, swaraHTML, westernHTML, saptakName, SWARAS, swaraHz, axisLabel, mod, saMidi, clamp } from '../theory.js';

export function mount(el, args) {
  let s = store.get(), sa = saHz(s);
  let tab = args[0] === 'chart' ? 'chart' : 'history';
  const hist = [], recent = [];
  let cand = null, centre = 4, lastVoiced = -9, lastT = 0, shown = null, col = {};

  el.innerHTML = `
    ${header('Live Detector', 'Listen', 'Play, sing or hum. Readings appear only while a clear pitch is detected.')}
    <section class="readout idle" id="ro">
      <div class="ro-top">
        <div class="ro-note" id="roS">—</div>
        <div class="ro-side">
          <div class="ro-alt" id="roW">&nbsp;</div>
          <div class="ro-hz"><span id="roHz">—</span><small>Hz</small></div>
          <div class="ro-oct" id="roO">Waiting for sound</div>
        </div>
      </div>
      <div class="meter">
        <div class="meter-track"><i class="zone"></i>${[-50, -25, 0, 25, 50].map(v => `<i class="tk${v === 0 ? ' mid' : ''}" style="left:${50 + v}%"></i>`).join('')}<b id="dot"></b></div>
        <div class="meter-lab"><span>flat</span><strong id="roC">&nbsp;</strong><span>sharp</span></div>
      </div>
      <div class="trio">
        <div><div class="bar"><i id="bSt"></i></div><b id="roSt">—</b><span>Stability</span></div>
        <div><div class="bar"><i id="bCf"></i></div><b id="roCf">—</b><span>Confidence</span></div>
        <div><div class="bar"><i id="bLv"></i></div><b id="roLv">—</b><span>Input level</span></div>
      </div>
    </section>
    <div class="row-between">
      <div class="seg" id="tabs"><button data-v="history">Pitch history</button><button data-v="chart">Swara chart</button></div>
      <div class="seg seg-s" id="nota"><button data-v="indian">Swara</button><button data-v="western">Western</button></div>
    </div>
    <section id="pHist">
      <div class="scope"><canvas id="cv"></canvas></div>
      <div class="recent-h"><span class="cap">Notes played</span><button class="link" id="clr">Clear</button></div>
      <div class="recent" id="recent"><span class="muted">Nothing yet.</span></div>
    </section>
    <section id="pChart" hidden></section>
    <div class="sticky-act"><button class="btn btn-primary" id="micBtn"></button></div>`;

  const ro = $('#ro', el), cv = $('#cv', el);
  const E = id => $('#' + id, el);
  const offBtn = micButton(E('micBtn'));
  const readCols = () => { col = { gold: cssVar('--gold'), line: cssVar('--grid'), strong: cssVar('--grid-strong'), text: cssVar('--muted'), ok: cssVar('--ok') }; };
  readCols();

  const showTab = () => { E('pHist').hidden = tab !== 'history'; E('pChart').hidden = tab !== 'chart'; };
  seg(E('tabs'), tab, v => { tab = v; showTab(); });
  const paintNota = seg(E('nota'), s.notation, v => store.set({ notation: v }));
  showTab();

  function paintChart() {
    const row = (o, name) => `<div class="sap"><span class="sap-n">${name}</span><div class="sap-r">${SWARAS.map((_, i) => `<button data-semi="${i + 12 * o}" class="${SWARAS[i].type}">${noteHTML(i + 12 * o, s)}</button>`).join('')}</div></div>`;
    E('pChart').innerHTML = `
      <div class="wheel">${SWARAS.map((w, i) => `<button data-pc="${i}" class="${w.type}" style="--a:${i * 30}deg"><span>${s.notation === 'western' ? westernHTML(saMidi(s) + i).replace(/<sub>.*<\/sub>/, '') : swaraHTML(i)}</span></button>`).join('')}
        <div class="wheel-c"><div class="wheel-s" id="wS">—</div><div class="wheel-h" id="wH">Sa = ${fmtHz(sa)} Hz</div></div></div>
      <p class="hint">Tap any swara to hear it against your Sa.</p>
      ${row(1, 'Taar')}${row(0, 'Madhya')}${row(-1, 'Mandra')}
      <h2 class="h2">Swara reference</h2>
      <div class="tbl">${SWARAS.map((w, i) => `<button class="tr" data-semi="${i}"><span class="td-s">${noteHTML(i, s)}</span><span class="td-n">${w.full}<small>${w.type === 'achal' ? 'Achal (fixed)' : w.type[0].toUpperCase() + w.type.slice(1)}</small></span><span class="td-r">${s.temperament === 'just' ? w.ratio.join(' : ') : (i * 100) + '¢'}</span><span class="td-h">${fmtHz(swaraHz(sa, i, s.temperament))}</span></button>`).join('')}</div>
      <p class="hint">${s.temperament === 'just' ? 'Frequencies use just-intonation ratios against Sa.' : 'Frequencies use equal temperament.'} Change this in Settings.</p>`;
  }
  paintChart();
  E('pChart').addEventListener('click', e => {
    const b = e.target.closest('[data-semi],[data-pc]'); if (!b) return;
    tone(swaraHz(sa, +(b.dataset.semi ?? b.dataset.pc), s.temperament), { dur: 1.1 });
  });

  function paintRecent() {
    E('recent').innerHTML = recent.length ? recent.map(x => `<span class="rn">${noteHTML(x, s)}</span>`).join('') : '<span class="muted">Nothing yet.</span>';
    E('recent').scrollLeft = 1e6;
  }
  E('clr').addEventListener('click', () => { recent.length = 0; hist.length = 0; paintRecent(); });

  const offStore = store.subscribe(() => { s = store.get(); sa = saHz(s); readCols(); paintChart(); paintRecent(); paintNota(s.notation); });

  const offMic = mic.on(f => {
    lastT = f.t;
    hist.push({ t: f.t, f: f.freq, c: f.conf });
    while (hist.length && f.t - hist[0].t > 14) hist.shift();
    const lv = clamp((20 * Math.log10(f.rms + 1e-6) + 60) / 54, 0, 1);
    E('bLv').style.width = lv * 100 + '%'; E('roLv').textContent = Math.round(20 * Math.log10(f.rms + 1e-6)) + ' dB';
    if (!(f.freq > 0)) {
      if (f.t - lastVoiced > 0.12) cand = null;
      if (f.t - lastVoiced > 0.5 && shown !== null) {
        shown = null; ro.classList.add('idle');
        E('roS').textContent = '—'; E('roW').innerHTML = '&nbsp;'; E('roHz').textContent = '—'; E('roO').textContent = 'Listening…';
        E('roC').innerHTML = '&nbsp;'; E('roSt').textContent = '—'; E('roCf').textContent = '—'; E('bSt').style.width = E('bCf').style.width = '0';
        $$('.act', el).forEach(n => n.classList.remove('act')); const w = E('wS'); if (w) w.textContent = '—';
      }
      return;
    }
    lastVoiced = f.t;
    const sw = swaraOf(f.freq, sa, s.temperament), wn = westernOf(f.freq, s.a4);
    const indian = s.notation === 'indian', cents = indian ? sw.cents : wn.cents;
    ro.classList.remove('idle');
    if (shown !== sw.semi + '|' + wn.midi + s.notation) {
      shown = sw.semi + '|' + wn.midi + s.notation;
      E('roS').innerHTML = indian ? swaraHTML(sw.semi) : westernHTML(wn.midi);
      E('roW').innerHTML = indian ? `${westernHTML(wn.midi)} <em>${SWARAS[sw.idx].full}</em>` : `${swaraHTML(sw.semi)} <em>${SWARAS[sw.idx].full}</em>`;
      E('roO').textContent = saptakName(sw.oct) + ' · octave ' + wn.octave;
      $$('.act', el).forEach(n => n.classList.remove('act'));
      $$(`[data-pc="${sw.idx}"],.sap [data-semi="${sw.semi}"]`, el).forEach(n => n.classList.add('act'));
      const w = E('wS'); if (w) w.innerHTML = noteHTML(sw.semi, s);
    }
    E('roHz').textContent = fmtHz(f.freq);
    const a = Math.abs(cents);
    E('dot').style.left = 50 + clamp(cents, -50, 50) + '%';
    ro.dataset.q = a <= 5 ? 'ok' : a <= s.tol ? 'near' : 'off';
    E('roC').textContent = a <= 5 ? `in tune (${signed(cents, 0)}¢)` : `${signed(cents, 0)}¢ ${cents > 0 ? 'sharp' : 'flat'}`;
    E('roSt').textContent = f.stab ? Math.round(f.stab * 100) + '%' : '—'; E('bSt').style.width = f.stab * 100 + '%';
    E('roCf').textContent = Math.round(f.conf * 100) + '%'; E('bCf').style.width = f.conf * 100 + '%';
    const wh = E('wH'); if (wh) wh.textContent = fmtHz(f.freq) + ' Hz';

    if (cand && cand.semi === sw.semi) {
      if (!cand.added && f.t - cand.t0 >= s.minNoteMs / 1000) {
        cand.added = true;
        if (recent[recent.length - 1] !== sw.semi || f.t - (cand.prevEnd || 0) > 0.3) { recent.push(sw.semi); if (recent.length > 64) recent.shift(); paintRecent(); }
      }
      cand.end = f.t;
    } else cand = { semi: sw.semi, t0: f.t, prevEnd: cand ? cand.end : 0 };
    if (Math.abs(sw.x - centre) > 5.5) centre += (sw.x - centre) * 0.06;
  });

  let raf;
  const draw = () => {
    raf = requestAnimationFrame(draw);
    if (tab !== 'history') return;
    const { c, w, h } = fitCanvas(cv);
    if (!w) return;
    c.clearRect(0, 0, w, h);
    const span = 10, rows = 17, rh = h / rows, left = 30;
    const now = mic.active ? (performance.now() - mic.t0) / 1000 : lastT;
    const y = x => h / 2 - (x - centre) * rh;
    c.font = '10px ' + cssVar('--sans'); c.textBaseline = 'middle';
    for (let k = Math.ceil(centre - rows / 2); k <= Math.floor(centre + rows / 2); k++) {
      const pc = mod(k, 12), yy = Math.round(y(k)) + 0.5;
      c.strokeStyle = pc === 0 ? col.strong : col.line; c.globalAlpha = pc === 0 ? 1 : pc === 7 ? 0.9 : 0.55;
      c.beginPath(); c.moveTo(left, yy); c.lineTo(w, yy); c.stroke();
      c.globalAlpha = pc === 0 ? 1 : 0.7; c.fillStyle = pc === 0 ? col.gold : col.text;
      c.fillText(axisLabel(k, s), 4, yy);
    }
    c.globalAlpha = 1; c.lineWidth = 2.2; c.lineJoin = c.lineCap = 'round'; c.strokeStyle = col.gold;
    let prev = null; c.beginPath();
    for (const p of hist) {
      if (!(p.f > 0)) { prev = null; continue; }
      const px = w - (now - p.t) / span * (w - left), py = y(12 * Math.log2(p.f / sa));
      if (px < left) { prev = null; continue; }
      if (prev && p.t - prev < 0.1) c.lineTo(px, py); else c.moveTo(px, py);
      prev = p.t;
    }
    c.stroke();
    const last = hist[hist.length - 1];
    if (mic.active && last && last.f > 0) { c.fillStyle = col.gold; c.beginPath(); c.arc(w - 3, y(12 * Math.log2(last.f / sa)), 3.5, 0, 7); c.fill(); }
    if (!mic.active && !hist.length) { c.fillStyle = col.text; c.textAlign = 'center'; c.font = '13px ' + cssVar('--sans'); c.fillText('Your pitch will trace here', w / 2 + 12, h / 2 - rh * 2.5); c.textAlign = 'left'; }
  };
  draw();

  return () => { cancelAnimationFrame(raf); offMic(); offStore(); offBtn(); };
}
