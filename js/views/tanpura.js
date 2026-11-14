// Tanpura studio.
import * as store from '../store.js';
import { tanpura, FIRST, TIMBRES, joraHz } from '../tanpura.js';
import { $, header, seg, fitCanvas, cssVar, fmtHz, icons, toast } from '../dom.js';
import { saHz, NOTE_NAMES, SAFED_KALI, mod, clamp } from '../theory.js';

export function mount(el) {
  let s = store.get();
  const t = () => store.get().tanpura;
  el.innerHTML = `
    ${header('Tanpura', 'Drone', '')}
    <section class="tp">
      <div class="tp-strings"><canvas id="cv"></canvas>
        <button class="tp-play" id="play" aria-label="Start or stop the tanpura"></button></div>
      <div class="tp-names" id="names"></div>
      <div class="tp-sa">
        <button class="round" id="saDn" aria-label="Lower Sa">${icons.minus}</button>
        <div><div class="tp-note" id="saN"></div><div class="tp-sub" id="saS"></div></div>
        <button class="round" id="saUp" aria-label="Raise Sa">${icons.plus}</button>
      </div>
    </section>

    <h2 class="h2">First string</h2>
    <div class="opts" id="first">${Object.entries(FIRST).map(([k, v]) => `<button data-v="${k}"><b>${v.label}</b><span>${v.desc.split(' · ')[1]}</span></button>`).join('')}</div>

    <h2 class="h2">Sound</h2>
    <div class="panel">
      <div class="slider"><label for="vol">Volume</label><input id="vol" type="range" min="0" max="1" step="0.01"><output id="volV"></output></div>
      <div class="slider"><label for="tempo">Tempo</label><input id="tempo" type="range" min="30" max="96" step="1"><output id="tempoV"></output></div>
      <div class="slider"><label for="jiv">Jivari</label><input id="jiv" type="range" min="0" max="1" step="0.05"><output id="jivV"></output></div>
      <div class="field"><div><b>Character</b><small>Preset voicing of the instrument</small></div>
        <div class="seg seg-s" id="timbre">${Object.entries(TIMBRES).map(([k, v]) => `<button data-v="${k}">${v.label}</button>`).join('')}</div></div>
      <div class="field"><div><b>Register</b><small>Octave of the drone strings</small></div>
        <div class="seg seg-s" id="reg"><button data-v="-1">Low</button><button data-v="0">Middle</button><button data-v="1">High</button></div></div>
    </div>
    <p class="hint">The drone keeps playing while you use the other sections, and its controls stay in the bar above the navigation. Use earphones when the detector is listening, otherwise the microphone hears the tanpura too. On an iPhone the ring/silent switch must be set to ring for sound, and iOS pauses the drone when the app is in the background or the screen locks.</p>`;

  const E = id => $('#' + id, el);
  const cv = E('cv');
  const energy = [0, 0, 0, 0];
  const offPluck = tanpura.onPluck(i => { energy[i] = 1; });

  function paint() {
    s = store.get(); const tp = s.tanpura;
    E('play').innerHTML = tanpura.loading ? '<i class="spin"></i>' : tanpura.playing ? icons.pause : icons.play;
    E('play').classList.toggle('on', tanpura.playing);
    E('saN').innerHTML = `${NOTE_NAMES[s.saPc]}<small>${SAFED_KALI[s.saPc]}</small>`;
    E('saS').textContent = `Sa ${fmtHz(saHz(s))} Hz · strings at ${fmtHz(joraHz(s))} Hz`;
    E('names').innerHTML = [FIRST[tp.first].label, 'Sa', 'Sa', 'Sa'].map((n, i) => `<span>${n}${i === 3 ? '<sub>low</sub>' : ''}</span>`).join('');
    E('vol').value = tp.volume; E('volV').textContent = Math.round(tp.volume * 100) + '%';
    E('tempo').value = tp.tempo; E('tempoV').textContent = tp.tempo + ' / min';
    E('jiv').value = tp.jivari; E('jivV').textContent = tp.jivari < 0.3 ? 'Soft' : tp.jivari < 0.7 ? 'Open' : 'Rich';
    pFirst(tp.first); pTimbre(tp.timbre); pReg(String(tp.register));
  }
  const pFirst = seg(E('first'), t().first, v => store.setTanpura({ first: v }));
  const pTimbre = seg(E('timbre'), t().timbre, v => store.setTanpura({ timbre: v }));
  const pReg = seg(E('reg'), String(t().register), v => store.setTanpura({ register: +v }));
  E('vol').oninput = e => store.setTanpura({ volume: +e.target.value });
  E('tempo').oninput = e => store.setTanpura({ tempo: +e.target.value });
  E('jiv').onchange = e => store.setTanpura({ jivari: +e.target.value });
  E('jiv').oninput = e => { E('jivV').textContent = +e.target.value < 0.3 ? 'Soft' : +e.target.value < 0.7 ? 'Open' : 'Rich'; };
  E('play').onclick = () => Promise.resolve(tanpura.toggle()).catch(e => toast('Could not start audio: ' + e.message));
  const stepSa = d => { const m = clamp(12 * (s.saOct + 1) + s.saPc + d, 48, 84); store.set({ saPc: mod(m, 12), saOct: Math.floor(m / 12) - 1 }); };
  E('saDn').onclick = () => stepSa(-1); E('saUp').onclick = () => stepSa(1);
  const offStore = store.subscribe(paint), offT = tanpura.onChange(paint);
  paint();

  let raf, ph = 0;
  const draw = () => {
    raf = requestAnimationFrame(draw);
    const { c, w, h } = fitCanvas(cv); if (!w) return;
    c.clearRect(0, 0, w, h); ph += 0.35;
    const gold = cssVar('--gold'), dim = cssVar('--grid-strong');
    for (let i = 0; i < 4; i++) {
      const x = w * (0.2 + 0.2 * i), e = energy[i];
      energy[i] *= 0.985;
      c.strokeStyle = e > 0.03 ? gold : dim; c.globalAlpha = 0.35 + 0.65 * Math.min(1, e * 1.4); c.lineWidth = i === 3 ? 2 : 1.3;
      c.beginPath();
      for (let y = 0; y <= h; y += 4) {
        const env = Math.sin(Math.PI * y / h);
        const dx = e * env * (5 * Math.sin(ph * (1.4 + i * 0.13)) + 2.2 * Math.sin(ph * 3.1 + y * 0.06));
        y ? c.lineTo(x + dx, y) : c.moveTo(x + dx, y);
      }
      c.stroke();
    }
    c.globalAlpha = 1;
  };
  draw();
  return () => { cancelAnimationFrame(raf); offPluck(); offStore(); offT(); };
}
