// Learning Centre: graded lessons, playable exercises, palta generator and a live long-tone drill.
import * as store from '../store.js';
import { mic, tone, playSemis, stopTones } from '../audio.js';
import { $, $$, esc, header, micButton, seg, icons } from '../dom.js';
import { saHz, SWARAS, THAATS, IDS, phraseHTML, phrasePlayable, phraseSemis, semisToPhrase, swaraHz, swaraCents, noteHTML, clamp } from '../theory.js';
import { LESSONS, LEVELS, PATTERNS } from '../lessons.js';
import { byId } from '../raags.js';

const phraseBtn = (str, s) => `<button class="ph" data-ph="${esc(str)}"><span class="ph-t">${phraseHTML(str, s)}</span><span class="ph-i">${icons.play}</span></button>`;
function bindPhrases(el) {
  el.addEventListener('click', e => {
    const b = e.target.closest('.ph'); if (!b) return;
    const was = b.classList.contains('playing');
    stopTones(); $$('.ph.playing', el).forEach(x => x.classList.remove('playing')); $$('.pn.on', el).forEach(n => n.classList.remove('on'));
    if (was) return;
    const pns = $$('.pn', b); b.classList.add('playing');
    playSemis(phrasePlayable(b.dataset.ph), { beat: 0.4, onStep: i => { pns.forEach((n, k) => n.classList.toggle('on', k === i)); if (i < 0) b.classList.remove('playing'); } });
  });
}

export function mount(el, args) {
  const l = LESSONS.find(x => x.id === args[0]);
  return l ? lesson(el, l) : index(el);
}

function index(el) {
  el.innerHTML = `
    ${header('Learning Centre', 'Learn', 'A graded path for the bansuri, from first sound to professional refinement.')}
    ${LEVELS.map(lv => `<h2 class="h2">${lv}</h2><div class="list">${LESSONS.filter(l => l.level === lv).map(l => `<a class="li" href="#/learn/${l.id}"><span><b>${l.title}</b><small>${l.topic} · about ${l.mins} min${l.drill ? ' · interactive' : ''}</small></span>${icons.chev}</a>`).join('')}</div>`).join('')}`;
  return () => {};
}

export function paltaLines(thaat, pattern) {
  const scale = THAATS[thaat].split(' ').map(x => IDS.indexOf(x));
  const deg = d => scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
  const max = Math.max(...pattern), up = [], dn = [];
  for (let d = 0; d + max <= 7; d++) up.push(semisToPhrase(pattern.map(o => deg(d + o))));
  for (let d = 7; d - max >= 0; d--) dn.push(semisToPhrase(pattern.map(o => deg(d - o))));
  return { up: up.join(', '), dn: dn.join(', ') };
}

function lesson(el, l) {
  let s = store.get(), cleanup = [];
  const idx = LESSONS.indexOf(l), next = LESSONS[idx + 1];
  const paint = () => {
    cleanup.forEach(f => f()); cleanup = [];
    el.innerHTML = `
      ${header(`${l.level} · ${l.topic}`, l.title, l.intro, '#/learn')}
      <ul class="plain">${l.points.map(p => `<li>${p}</li>`).join('')}</ul>
      ${l.raags ? l.raags.map(g => `<h2 class="h2">${g.h}</h2><div class="list">${g.ids.map(id => byId[id]).filter(Boolean).map(r => `<a class="li" href="#/raag/${r.id}"><span><b>${r.name}</b><small>${r.thaat} · ${r.jati}</small></span>${icons.chev}</a>`).join('')}</div>`).join('') : ''}
      ${l.exercises.length ? `<h2 class="h2">Exercises</h2><ol class="steps">${l.exercises.map(x => `<li><b>${x.label}</b>${x.text ? `<p>${x.text}</p>` : ''}${x.phrase ? phraseBtn(x.phrase, s) : ''}</li>`).join('')}</ol>` : ''}
      ${l.drill === 'palta' ? '<h2 class="h2">Palta generator</h2><div id="palta"></div>' : ''}
      ${l.drill === 'sustain' ? '<h2 class="h2">Long-tone trainer</h2><div id="drill"></div>' : ''}
      ${l.tips.length ? `<h2 class="h2">Notes</h2><ul class="plain">${l.tips.map(p => `<li>${p}</li>`).join('')}</ul>` : ''}
      ${next ? `<div class="list" style="margin-top:28px"><a class="li" href="#/learn/${next.id}"><span><small>Next lesson</small><b>${next.title}</b></span>${icons.chev}</a></div>` : ''}`;
    if (l.drill === 'palta') palta($('#palta', el));
    if (l.drill === 'sustain') cleanup.push(drill($('#drill', el)));
  };

  let thaat = 'Bilawal', pat = 0;
  function palta(box) {
    const render = () => {
      const ln = paltaLines(thaat, PATTERNS[pat].p);
      box.innerHTML = `
        <div class="panel"><div class="field"><div><b>Thaat</b><small>${THAATS[thaat].split(' ').map(x => SWARAS[IDS.indexOf(x)].label.replace('Shuddha ', '')).join(', ')}</small></div>
          <select class="sel" id="th">${Object.keys(THAATS).map(t => `<option${t === thaat ? ' selected' : ''}>${t}</option>`).join('')}</select></div></div>
        <div class="chips" id="pt">${PATTERNS.map((p, i) => `<button data-v="${i}">${p.name}</button>`).join('')}</div>
        <p class="cap">Ascending</p>${phraseBtn(ln.up, s)}<p class="cap">Descending</p>${phraseBtn(ln.dn, s)}`;
      $('#th', box).onchange = e => { thaat = e.target.value; render(); };
      seg($('#pt', box), pat, v => { pat = +v; render(); });
    };
    render();
  }

  function drill(box) {
    let semi = 0, hold = 0, best = 0, lastT = null, grace = 0, sum = 0, n = 0;
    box.innerHTML = `
      <div class="panel">
        <div class="field"><div><b>Target swara</b><small>Hold it inside ±${s.tol}¢ for as long as you can</small></div>
          <select class="sel" id="tg">${[-5, -3, -1, 0, 2, 4, 5, 7, 9, 11, 12].map(x => `<option value="${x}">${SWARAS[((x % 12) + 12) % 12].label}${x < 0 ? ' (mandra)' : x >= 12 ? ' (taar)' : ''}</option>`).join('')}${[1, 3, 6, 8, 10].map(x => `<option value="${x}">${SWARAS[x].label}</option>`).join('')}</select></div>
        <div class="drill" id="dz"><div class="dr-t"><b id="dh">0.0</b><span>seconds in tune</span></div><div class="dr-t"><b id="db">0.0</b><span>best</span></div><div class="dr-t"><b id="dc">—</b><span>deviation</span></div></div>
        <div class="meter"><div class="meter-track"><i class="zone" style="left:${50 - s.tol}%;width:${2 * s.tol}%"></i><i class="tk mid" style="left:50%"></i><b id="dd"></b></div></div>
        <div class="two" style="margin-top:14px"><button class="btn btn-primary" id="dm"></button><button class="btn" id="dr">Hear target</button></div>
      </div>`;
    const E = i => $('#' + i, box);
    E('tg').value = '0';
    E('tg').onchange = e => { semi = +e.target.value; hold = 0; best = 0; E('dh').textContent = E('db').textContent = '0.0'; };
    E('dr').onclick = () => tone(swaraHz(saHz(s), semi, s.temperament), { dur: 2 });
    const offB = micButton(E('dm'), { idle: 'Start', live: 'Stop' });
    const off = mic.on(f => {
      const dt = lastT === null ? 0 : Math.min(0.1, f.t - lastT); lastT = f.t;
      let c = null;
      if (f.freq > 0) { c = 1200 * Math.log2(f.freq / saHz(s)) - swaraCents(semi, s.temperament); if (Math.abs(c) > 60) c = null; }
      const zone = E('dz');
      if (c !== null && Math.abs(c) <= s.tol) { hold += dt; grace = 0; sum += c; n++; }
      else { grace += dt; if (grace > 0.3) { hold = 0; sum = 0; n = 0; } }
      best = Math.max(best, hold);
      E('dh').textContent = hold.toFixed(1); E('db').textContent = best.toFixed(1);
      E('dc').textContent = c === null ? '—' : (c > 0 ? '+' : '') + c.toFixed(0) + '¢';
      E('dd').style.left = 50 + clamp(c ?? 0, -50, 50) + '%'; E('dd').style.opacity = c === null ? 0.2 : 1;
      zone.classList.toggle('good', c !== null && Math.abs(c) <= s.tol);
    });
    return () => { off(); offB(); };
  }

  paint(); bindPhrases(el);
  const offS = store.subscribe(ns => { const n = ns.notation !== s.notation; s = ns; if (n) paint(); });
  return () => { cleanup.forEach(f => f()); offS(); stopTones(); };
}
