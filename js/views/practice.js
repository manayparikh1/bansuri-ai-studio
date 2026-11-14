// Practice studio: record, store locally, analyse, play back, export, delete.
import * as store from '../store.js';
import { mic, micErrorText } from '../audio.js';
import { $, esc, header, icons, toast, sheet, fmtDur, fmtHz, signed, cssVar, download, fitCanvas } from '../dom.js';
import { saHz, swaraOf, noteHTML, noteText, axisLabel, mod, clamp, NOTE_NAMES, SWARAS } from '../theory.js';
import { segment, summarize, estimateSa } from '../analysis.js';

export function mount(el, args) {
  return args[0] ? detail(el, args[0]) : home(el);
}

const pickMime = () => ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'].find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
const MAX = 15 * 60;

function home(el) {
  let s = store.get(), rec = null, raf;
  el.innerHTML = `
    ${header('Practice', 'Record', 'Record a take, then study its notes, intonation and steadiness. Recordings stay on this device.')}
    <section class="recbox" id="box">
      <button class="rec-btn" id="rec" aria-label="Record"><i></i></button>
      <div class="rec-time" id="time">0:00</div>
      <div class="rec-now" id="now">Tap to record</div>
      <div class="scope scope-s"><canvas id="cv"></canvas></div>
    </section>
    <h2 class="h2">Recordings</h2>
    <div class="list" id="list"><p class="empty">Loading…</p></div>
    <p class="hint" id="stor"></p>`;
  const E = id => $('#' + id, el);
  const cv = E('cv');

  async function paintList() {
    let list = [];
    try { list = await store.recordings.list(); } catch { E('list').innerHTML = '<p class="empty">Local storage is unavailable in this browser mode (for example private browsing), so recordings cannot be saved.</p>'; return; }
    E('list').innerHTML = list.length ? list.map(r => `<a class="li" href="#/practice/${r.id}"><span><b>${esc(r.name)}</b><small>${new Date(r.created).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} · ${fmtDur(r.duration)} · Sa ${r.saLabel}</small></span>${icons.chev}</a>`).join('') : '<p class="empty">No recordings yet.</p>';
    const info = await store.storageInfo();
    if (info) E('stor').textContent = `Using ${(info.used / 1048576).toFixed(1)} MB of on-device storage.` + (info.persisted ? ' Storage is marked persistent.' : '');
  }
  paintList();

  async function start() {
    const startedMic = !mic.active;
    try { if (startedMic) await mic.start(); } catch (e) { return toast(micErrorText(e), 6000); }
    s = store.get();
    const mime = pickMime();
    let mr = null; const chunks = [];
    if (window.MediaRecorder) {
      try { mr = new MediaRecorder(mic.stream, mime ? { mimeType: mime, audioBitsPerSecond: 128000 } : undefined); mr.ondataavailable = e => e.data.size && chunks.push(e.data); mr.start(1000); }
      catch { mr = null; }
    }
    if (!mr) toast('This browser cannot capture audio files, so only the pitch analysis will be saved for this take.', 5000);
    rec = { mr, chunks, t: [], f: [], t0: null, startedMic, mime: mr ? mr.mimeType : '' };
    E('box').classList.add('on'); E('now').textContent = 'Recording…';
    store.requestPersist();
  }
  async function stop() {
    if (!rec) return;
    const r = rec; rec = null;
    E('box').classList.remove('on'); E('now').textContent = 'Saving…';
    const blob = r.mr ? await new Promise(res => { r.mr.onstop = () => res(new Blob(r.chunks, { type: r.mime.split(';')[0] })); try { r.mr.stop(); } catch { res(null); } }) : null;
    if (r.startedMic && mic.active) mic.stop();
    const duration = r.t.length ? r.t[r.t.length - 1] : 0;
    if (duration < 1) { E('now').textContent = 'Tap to record'; E('time').textContent = '0:00'; return toast('That take was too short to keep.'); }
    const id = 'r' + Date.now().toString(36), d = new Date();
    const item = { id, name: 'Take ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), created: Date.now(), duration, mime: r.mime, blob,
      t: new Float32Array(r.t), f: new Float32Array(r.f), sa: saHz(s), a4: s.a4, temperament: s.temperament, saLabel: NOTE_NAMES[s.saPc] + s.saOct };
    try { await store.recordings.put(item); location.hash = '#/practice/' + id; }
    catch (e) { toast('Could not save the recording: ' + (e?.message || 'storage error'), 6000); E('now').textContent = 'Tap to record'; }
  }
  E('rec').onclick = () => rec ? stop() : start();

  const offMic = mic.on(f => {
    if (!rec) return;
    if (rec.t0 === null) rec.t0 = f.t;
    const t = f.t - rec.t0;
    rec.t.push(t); rec.f.push(f.freq);
    E('time').textContent = fmtDur(t);
    E('now').innerHTML = f.freq > 0 ? `${noteHTML(swaraOf(f.freq, saHz(s), s.temperament).semi, s)} <small>${fmtHz(f.freq)} Hz</small>` : 'Recording…';
    if (t >= MAX) { toast('Reached the 15 minute limit for one take.'); stop(); }
  });
  const offState = mic.onState(on => { if (!on && rec) stop(); });

  const draw = () => {
    raf = requestAnimationFrame(draw);
    const { c, w, h } = fitCanvas(cv); if (!w) return;
    c.clearRect(0, 0, w, h);
    if (!rec || rec.t.length < 2) return;
    const sa = saHz(s), end = rec.t[rec.t.length - 1], span = 8;
    let lo = Infinity, hi = -Infinity; const pts = [];
    for (let i = rec.t.length - 1; i >= 0 && end - rec.t[i] < span; i--) { const f = rec.f[i]; if (f > 0) { const x = 12 * Math.log2(f / sa); lo = Math.min(lo, x); hi = Math.max(hi, x); pts.push([rec.t[i], x]); } else pts.push([rec.t[i], null]); }
    if (!isFinite(lo)) return;
    lo -= 2; hi += 2; if (hi - lo < 8) { const m = (hi + lo) / 2; lo = m - 4; hi = m + 4; }
    c.strokeStyle = cssVar('--gold'); c.lineWidth = 2; c.lineJoin = 'round'; c.beginPath(); let pen = false;
    for (let i = pts.length - 1; i >= 0; i--) { const [t, x] = pts[i]; if (x === null) { pen = false; continue; } const px = w - (end - t) / span * w, py = h - (x - lo) / (hi - lo) * h; pen ? c.lineTo(px, py) : c.moveTo(px, py); pen = true; }
    c.stroke();
  };
  draw();
  return () => { cancelAnimationFrame(raf); if (rec) stop(); offMic(); offState(); };
}

// ------------------------------------------------------------------------------------------
function detail(el, id) {
  let s = store.get(), rec, audio, url, raf, dead = false, sa, an, stats, pps = 70;
  el.innerHTML = `${header('Practice', 'Loading…', '', '#/practice')}`;

  store.recordings.get(id).then(r => {
    if (dead) return;
    if (!r) { el.innerHTML = `${header('Practice', 'Not found', 'This recording no longer exists.', '#/practice')}`; return; }
    rec = r; sa = rec.sa; render();
  });

  function analyse() {
    an = segment({ t: rec.t, f: rec.f }, sa, { minNoteMs: s.minNoteMs, temperament: rec.temperament || s.temperament });
    stats = summarize(an.notes, { tol: s.tol });
  }

  function render() {
    analyse();
    const cur = saHz(s), differs = Math.abs(1200 * Math.log2(cur / sa)) > 3;
    const st = stats;
    el.innerHTML = `
      ${header('Practice · ' + new Date(rec.created).toLocaleDateString([], { dateStyle: 'medium' }), esc(rec.name), `${fmtDur(rec.duration)} · analysed with Sa = ${fmtHz(sa)} Hz`, '#/practice')}
      ${rec.blob ? `<div class="player"><button class="round gold" id="pp" aria-label="Play">${icons.play}</button><div class="pl-t"><b id="ct">0:00</b><span> / ${fmtDur(rec.duration)}</span></div></div>` : '<p class="hint">No audio was captured for this take (the browser did not support recording); the pitch analysis is complete.</p>'}
      <div class="graph" id="gw"><div class="graph-in" id="gi"><canvas id="gc"></canvas><i class="head" id="head"></i></div></div>
      <p class="hint">Pitch against time. Blocks are detected notes: gold within ±${s.tol}¢, copper outside. ${rec.blob ? 'Tap the graph to move the playhead.' : ''}</p>
      ${!st ? '<div class="note-box"><b>No clear notes were detected in this take.</b><p>Record closer to the microphone in a quieter place, or lower the sensitivity threshold in Settings.</p></div>' : `
      <div class="stats">
        <div><b>${st.count}</b><span>notes</span></div>
        <div><b>${Math.round(st.inTune * 100)}%</b><span>within ±${s.tol}¢</span></div>
        <div><b>${st.accuracy.toFixed(1)}¢</b><span>avg deviation</span></div>
        <div><b>±${st.stability.toFixed(1)}¢</b><span>steadiness</span></div>
        <div><b>${st.longest.toFixed(1)} s</b><span>longest note</span></div>
        <div><b>${st.avgDur.toFixed(2)} s</b><span>avg note</span></div>
      </div>
      <p class="hint" style="margin-top:8px">Overall tendency ${signed(st.bias, 1)}¢${st.meends ? ` · ${st.meends} meend${st.meends > 1 ? 's' : ''} detected` : ''}${st.vibrato ? ` · vibrato on ${st.vibrato} note${st.vibrato > 1 ? 's' : ''}` : ''}${st.andolan ? ` · andolan on ${st.andolan}` : ''}</p>

      <h2 class="h2">Areas to work on</h2>
      <ul class="plain">${st.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>

      <h2 class="h2">Swara sequence</h2>
      <div class="seqwrap">${an.notes.map(n => `<span class="rn${Math.abs(n.cents) > s.tol ? ' off' : ''}${n.meend ? ' meend' : ''}" title="${n.dur.toFixed(2)} s, ${signed(n.cents, 0)}¢">${noteHTML(n.semi, s)}</span>`).join('')}</div>

      <h2 class="h2">Intonation by swara</h2>
      <div class="imap">${st.swaras.map(p => `<div class="im"><span class="im-n">${noteHTML(p.semi, s)}</span><div class="im-b"><i class="${Math.abs(p.cents) <= 5 ? 'ok' : Math.abs(p.cents) <= s.tol ? '' : 'off'}" style="${p.cents >= 0 ? 'left:50%' : 'right:50%'};width:${Math.min(50, Math.abs(p.cents))}%"></i></div><span class="im-v">${signed(p.cents, 0)}¢<small>×${p.count} · ${p.dur.toFixed(1)} s · ±${p.std.toFixed(0)}</small></span></div>`).join('')}</div>`}

      <h2 class="h2">This take</h2>
      <div class="list">
        <a class="li" href="#/raag/take/${rec.id}"><span><b>Identify the raag</b><small>Run this take through raag identification</small></span>${icons.chev}</a>
        <button class="li" id="est"><span><b>Estimate Sa from this take</b><small>Suggest the tonic from where the melody dwells and ends</small></span>${icons.chev}</button>
        ${differs ? `<button class="li" id="reSa"><span><b>Re-analyse with current Sa</b><small>Your Sa is now ${fmtHz(cur)} Hz; this take was recorded at ${fmtHz(rec.sa)} Hz</small></span>${icons.chev}</button>` : ''}
        <button class="li" id="ren"><span><b>Rename</b></span>${icons.chev}</button>
        ${rec.blob ? `<button class="li" id="exA"><span><b>Export audio</b><small>${rec.blob.type || 'audio'} · ${(rec.blob.size / 1048576).toFixed(2)} MB</small></span>${icons.share}</button>` : ''}
        <button class="li" id="exJ"><span><b>Export analysis</b><small>Notes, timings and pitch track as JSON</small></span>${icons.share}</button>
        <button class="li danger" id="del"><span><b>Delete recording</b></span>${icons.trash}</button>
      </div>`;
    wire(); drawGraph();
  }

  function wire() {
    const E = i => $('#' + i, el);
    if (rec.blob) {
      if (!audio) {
        url = URL.createObjectURL(rec.blob); audio = new Audio(url); audio.preload = 'metadata';
        // MediaRecorder files often lack a duration header; this forces the browser to compute it so seeking works.
        audio.addEventListener('loadedmetadata', () => { if (!isFinite(audio.duration)) { audio.currentTime = 1e7; audio.addEventListener('timeupdate', function f() { audio.removeEventListener('timeupdate', f); audio.currentTime = 0; }); } });
      }
      const pp = E('pp');
      const sync = () => { pp.innerHTML = audio.paused ? icons.play : icons.pause; };
      pp.onclick = () => audio.paused ? audio.play().catch(e => toast('Playback failed: ' + e.message)) : audio.pause();
      audio.onplay = audio.onpause = audio.onended = sync; sync();
      E('gi').onclick = e => { const x = e.clientX - E('gi').getBoundingClientRect().left; audio.currentTime = clamp(x / pps, 0, rec.duration); };
    }
    E('est').onclick = async () => {
      const c = estimateSa({ t: rec.t, f: rec.f });
      if (!c.length) return toast('Not enough pitched sound in this take to estimate Sa.');
      const a4 = s.a4, nm = f => { const m = 69 + 12 * Math.log2(f / a4), r = Math.round(m); return { r, txt: `${NOTE_NAMES[mod(r, 12)]}${Math.floor(r / 12) - 1} ${signed((m - r) * 100, 0)}¢ · ${fmtHz(f)} Hz`, fine: Math.round((m - r) * 100) }; };
      const best = nm(c[0].freq);
      const ok = await sheet({ title: 'Estimated Sa', body: `Most likely: <b>${best.txt}</b>.${c.length > 1 ? ' Other candidates: ' + c.slice(1).map(x => nm(x.freq).txt).join('; ') + '.' : ''}<br><br>This is an estimate based on the notes the melody dwells on, their fifth or fourth, and the final note. Confirm it by ear against the tanpura.`, ok: 'Use as my Sa' });
      if (ok) { store.set({ saPc: mod(best.r, 12), saOct: Math.floor(best.r / 12) - 1, fine: best.fine }); s = store.get(); sa = saHz(s); render(); toast('Sa updated and take re-analysed.'); }
    };
    if (E('reSa')) E('reSa').onclick = () => { sa = saHz(s); render(); };
    E('ren').onclick = async () => { const n = await sheet({ title: 'Rename recording', input: rec.name, ok: 'Save' }); if (n) { rec.name = n; await store.recordings.put(rec); render(); } };
    if (E('exA')) E('exA').onclick = () => download(rec.blob, rec.name.replace(/[^\w\- ]+/g, '') + (rec.blob.type.includes('mp4') ? '.m4a' : rec.blob.type.includes('ogg') ? '.ogg' : '.webm'));
    E('exJ').onclick = () => download(new Blob([JSON.stringify({ app: 'Bansuri AI Studio', name: rec.name, created: new Date(rec.created).toISOString(), durationSec: rec.duration, saHz: sa, a4: rec.a4, temperament: rec.temperament,
      summary: stats && { ...stats, swaras: stats.swaras.map(p => ({ swara: SWARAS[p.idx].label, semitonesFromSa: p.semi, count: p.count, seconds: p.dur, avgCents: p.cents, steadinessCents: p.std })) },
      notes: an.notes.map(n => ({ swara: SWARAS[n.idx].label, semitonesFromSa: n.semi, start: +n.start.toFixed(3), duration: +n.dur.toFixed(3), hz: +n.freq.toFixed(2), cents: +n.cents.toFixed(1), steadinessCents: +n.std.toFixed(1), meend: !!n.meend, oscillation: n.osc })),
      pitchTrack: { t: Array.from(rec.t, x => +x.toFixed(3)), hz: Array.from(rec.f, x => +x.toFixed(2)) } }, null, 1)], { type: 'application/json' }), rec.name.replace(/[^\w\- ]+/g, '') + '.json');
    E('del').onclick = async () => { if (await sheet({ title: 'Delete this recording?', body: 'The audio and its analysis will be removed from this device. This cannot be undone.', ok: 'Delete', danger: true })) { await store.recordings.del(rec.id); location.hash = '#/practice'; } };
  }

  function drawGraph() {
    const gw = $('#gw', el), gi = $('#gi', el), cv = $('#gc', el);
    const vw = gw.clientWidth, H = 230;
    pps = clamp(vw / rec.duration, 28, 90);
    let W = Math.max(vw, rec.duration * pps); if (W > 6000) { W = 6000; pps = W / rec.duration; }
    gi.style.width = W + 'px';
    const dpr = Math.min(window.devicePixelRatio || 1, 8000 / W, 3);
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const xs = []; for (let i = 0; i < rec.f.length; i++) if (rec.f[i] > 0) xs.push(12 * Math.log2(rec.f[i] / sa));
    if (!xs.length) return;
    xs.sort((a, b) => a - b);
    let lo = Math.floor(xs[Math.floor(xs.length * 0.01)]) - 2, hi = Math.ceil(xs[Math.floor(xs.length * 0.99)]) + 2;
    if (hi - lo < 10) { hi += 2; lo -= 2; }
    const y = x => H - 6 - (x - lo) / (hi - lo) * (H - 12);
    const gold = cssVar('--gold'), warn = cssVar('--warn'), line = cssVar('--grid'), strong = cssVar('--grid-strong'), text = cssVar('--muted');
    c.font = '10px ' + cssVar('--sans'); c.textBaseline = 'middle';
    for (let k = lo; k <= hi; k++) {
      const pc = mod(k, 12), yy = Math.round(y(k)) + .5;
      c.strokeStyle = pc === 0 ? strong : line; c.globalAlpha = pc === 0 ? 1 : 0.6; c.beginPath(); c.moveTo(0, yy); c.lineTo(W, yy); c.stroke();
    }
    c.globalAlpha = 1;
    for (let t = 0; t < rec.duration; t += 5) { c.fillStyle = text; c.fillText(fmtDur(t), t * pps + 4, H - 8); }
    const rh = Math.max(5, (H - 12) / (hi - lo) * 0.7);
    for (const n of an.notes) { c.fillStyle = Math.abs(n.cents) <= s.tol ? gold : warn; c.globalAlpha = 0.22; c.fillRect(n.start * pps, y(n.semi) - rh / 2, Math.max(2, n.dur * pps), rh); }
    c.globalAlpha = 1; c.strokeStyle = gold; c.lineWidth = 1.6; c.lineJoin = 'round'; c.beginPath(); let prev = -9;
    for (let i = 0; i < rec.f.length; i++) { const f = rec.f[i]; if (!(f > 0)) continue; const px = rec.t[i] * pps, py = y(12 * Math.log2(f / sa)); if (rec.t[i] - prev < 0.1) c.lineTo(px, py); else c.moveTo(px, py); prev = rec.t[i]; }
    c.stroke();
    // Sticky-looking labels at the left edge of every screenful
    for (let x0 = 0; x0 < W; x0 += Math.max(vw, 300)) for (let k = lo; k <= hi; k++) { const pc = mod(k, 12); if (![0, 2, 4, 5, 7, 9, 11].includes(pc) && hi - lo > 14) continue; if (y(k) > H - 20) continue; c.fillStyle = pc === 0 ? gold : text; c.globalAlpha = pc === 0 ? 1 : 0.75; c.fillText(axisLabel(k, s), x0 + 4, y(k)); }
    c.globalAlpha = 1;
  }

  const tick = () => {
    raf = requestAnimationFrame(tick);
    if (!audio) return;
    const head = $('#head', el), ct = $('#ct', el); if (!head) return;
    const t = Math.min(audio.currentTime, rec.duration);
    head.style.transform = `translateX(${t * pps}px)`; ct.textContent = fmtDur(t);
    if (!audio.paused) { const gw = $('#gw', el), x = t * pps; if (x < gw.scrollLeft || x > gw.scrollLeft + gw.clientWidth * 0.8) gw.scrollLeft = x - gw.clientWidth * 0.2; }
  };
  tick();
  const onResize = () => rec && drawGraph();
  window.addEventListener('resize', onResize);
  const off = store.subscribe(ns => { s = ns; if (rec) render(); });
  return () => { dead = true; cancelAnimationFrame(raf); off(); window.removeEventListener('resize', onResize); if (audio) { audio.pause(); audio.src = ''; URL.revokeObjectURL(url); } };
}
