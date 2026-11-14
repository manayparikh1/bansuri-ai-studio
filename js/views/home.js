// Home: current setup, quick start, sections, raags for the present hour, install help.
import * as store from '../store.js';
import { $, header, icons, fmtHz, signed } from '../dom.js';
import { saHz, NOTE_NAMES, SAFED_KALI } from '../theory.js';
import { RAAGS, PRAHAR, praharNow } from '../raags.js';
import { FIRST } from '../tanpura.js';
import { NAV, offlineStatus, installPrompt } from '../app.js';

const DESC = {
  finder: 'Hear a voice or song, get the Sa, the flute and the raag',
  live: 'Notes, swaras and pitch in real time', raag: `Identify a raag · library of ${RAAGS.length}`, tanpura: 'A continuous drone in your Sa',
  tuner: 'Needle, calibration and intonation map', practice: 'Record, analyse and review takes', learn: 'Graded lessons and exercises', settings: 'Instrument, tuning and display',
};

export function mount(el) {
  const paint = () => {
    const s = store.get(), p = praharNow();
    const now = RAAGS.filter(r => r.prahar === p);
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    el.innerHTML = `
      <header class="hero">
        <svg class="mandala" viewBox="0 0 200 200" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<g transform="rotate(${i * 30} 100 100)"><path d="M100 22c9 14 9 30 0 46c-9-16-9-32 0-46Z"/><circle cx="100" cy="14" r="1.6"/></g>`).join('')}<circle cx="100" cy="100" r="30"/><circle cx="100" cy="100" r="86"/><circle cx="100" cy="100" r="92" stroke-dasharray="1 5"/></svg>
        <div class="eyebrow">Indian classical music companion</div>
        <h1>Bansuri <em>AI</em> Studio</h1>
        <div class="orn"><i></i></div>
      </header>

      <a class="setup" href="#/settings">
        <div><span>Sa</span><b>${NOTE_NAMES[s.saPc]}<sub>${s.saOct}</sub></b><small>${fmtHz(saHz(s))} Hz${s.fine ? ' · ' + signed(s.fine, 0) + '¢' : ''}</small></div>
        <div><span>Flute</span><b class="sm">${SAFED_KALI[s.saPc]}</b><small>A = ${s.a4} Hz</small></div>
        <div><span>Tanpura</span><b class="sm">${FIRST[s.tanpura.first].label} · Sa</b><small>${s.temperament === 'just' ? 'Just intonation' : 'Equal temperament'}</small></div>
      </a>

      <a class="btn btn-primary cta" href="#/finder"><span class="btn-ic">${icons.mic}</span><span>Find the scale</span></a>

      <nav class="sections">${NAV.filter(n => n.id !== 'home').map(n => `<a href="#/${n.id}"><span class="s-ic">${icons[n.icon]}</span><span class="s-t"><b>${n.label}</b><small>${DESC[n.id]}</small></span>${icons.chev}</a>`).join('')}</nav>

      <h2 class="h2">Raags for this hour <small>${PRAHAR[p]}</small></h2>
      <div class="hscroll">${now.map(r => `<a class="rcard" href="#/raag/${r.id}"><b>${r.name}</b><small>${r.thaat.startsWith('None') ? 'Carnatic origin' : r.thaat}</small><span>${r.rasa.split(',')[0]}</span></a>`).join('') || '<p class="empty">No raag in the library is assigned to this prahar.</p>'}</div>

      <div class="status"><i class="led" id="led"></i><span id="offT">Checking offline status…</span></div>
      ${standalone ? '' : `<div class="note-box" id="inst"><b>Install on your phone</b><p>${ios ? 'In Safari, tap the Share button, then “Add to Home Screen”. The app then opens full-screen from its own icon and works without a connection.' : 'Add this app to your home screen to open it full-screen and use it offline.'}</p>${ios ? '' : '<button class="btn btn-gold" id="instBtn" hidden>Install app</button><p class="hint" id="instAlt" style="margin:8px 0 0">In Chrome: menu ⋮ → “Add to Home screen” or “Install app”.</p>'}</div>`}`;
    offlineStatus().then(o => { const t = $('#offT', el); if (!t) return; t.textContent = o.text; $('#led', el).classList.toggle('on', o.ready); });
    const b = $('#instBtn', el);
    if (b && installPrompt.event) { b.hidden = false; $('#instAlt', el).hidden = true; b.onclick = async () => { installPrompt.event.prompt(); await installPrompt.event.userChoice; installPrompt.event = null; b.hidden = true; }; }
  };
  paint();
  const off = store.subscribe(paint);
  const onInst = () => paint();
  window.addEventListener('installable', onInst);
  return () => { off(); window.removeEventListener('installable', onInst); };
}
