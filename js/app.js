// App shell: routing, navigation dock, persistent tanpura bar, theme, service worker.
import * as store from './store.js';
import { mic } from './audio.js';
import { tanpura, FIRST } from './tanpura.js';
import { $, $$, icons, toast } from './dom.js';
import { NOTE_NAMES } from './theory.js';

export const NAV = [
  { id: 'home', label: 'Home', icon: 'home' }, { id: 'live', label: 'Live Detector', short: 'Live', icon: 'live' },
  { id: 'raag', label: 'Raag Studio', short: 'Raag', icon: 'raag' }, { id: 'tanpura', label: 'Tanpura', icon: 'tanpura' },
  { id: 'tuner', label: 'Bansuri Tuner', short: 'Tuner', icon: 'tuner' }, { id: 'practice', label: 'Practice', icon: 'practice' },
  { id: 'learn', label: 'Learning Centre', short: 'Learn', icon: 'learn' }, { id: 'settings', label: 'Settings', icon: 'settings' },
];
const loaders = {
  home: () => import('./views/home.js'), live: () => import('./views/live.js'), raag: () => import('./views/raag.js'),
  tanpura: () => import('./views/tanpura.js'), tuner: () => import('./views/tuner.js'), practice: () => import('./views/practice.js'),
  learn: () => import('./views/learn.js'), settings: () => import('./views/settings.js'),
};

export const installPrompt = { event: null };
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt.event = e; window.dispatchEvent(new Event('installable')); });

export const CACHE_PREFIX = 'bansuri-studio-';
export async function offlineStatus() {
  if (!('serviceWorker' in navigator) || !window.caches) return { ready: false, text: 'Offline use is not available in this browser or over an insecure address.' };
  const keys = (await caches.keys()).filter(k => k.startsWith(CACHE_PREFIX));
  if (!keys.length) return { ready: false, text: 'Preparing offline copy… stay online for a moment.' };
  const n = (await (await caches.open(keys[keys.length - 1])).keys()).length;
  return n >= 20 ? { ready: true, text: `Ready for offline use · ${n} files stored on this device` } : { ready: false, text: 'Preparing offline copy…' };
}

const view = $('#view'), dock = $('#dock'), tbar = $('#tbar');
let cleanup = null, token = 0;

dock.innerHTML = NAV.map(n => `<a href="#/${n.id}" data-id="${n.id}"><span class="d-ic">${icons[n.icon]}</span><span class="d-l">${n.short || n.label}</span></a>`).join('');

async function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const id = loaders[parts[0]] ? parts[0] : 'home';
  const my = ++token;
  let mod;
  try { mod = await loaders[id](); } catch (e) { view.innerHTML = `<div class="page"><p class="empty">This section could not be loaded. ${navigator.onLine ? '' : 'You appear to be offline and the app has not finished saving itself for offline use.'}</p></div>`; return; }
  if (my !== token) return;
  if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
  const page = document.createElement('div'); page.className = 'page page-' + id;
  view.replaceChildren(page); view.scrollTop = 0;
  try { cleanup = mod.mount(page, parts.slice(1)) || null; } catch (e) { console.error(e); page.innerHTML = '<p class="empty">Something went wrong showing this section.</p>'; }
  $$('a', dock).forEach(a => { const on = a.dataset.id === id; a.classList.toggle('on', on); if (on) a.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); });
  document.body.dataset.route = id;
  paintBar();
}
window.addEventListener('hashchange', route);

// ---- Persistent tanpura bar ----
function paintBar() {
  const s = store.get();
  tbar.hidden = document.body.dataset.route === 'tanpura';
  tbar.classList.toggle('on', tanpura.playing);
  tbar.innerHTML = `<a href="#/tanpura" class="tb-l"><span class="tb-ic">${icons.tanpura}</span><span><b>Tanpura</b><small>${tanpura.loading ? 'Tuning the strings…' : `${NOTE_NAMES[s.saPc]} · ${FIRST[s.tanpura.first].label} – Sa – Sa – Sa${tanpura.playing ? '' : ' · off'}`}</small></span></a>
    <input type="range" min="0" max="1" step="0.01" value="${s.tanpura.volume}" aria-label="Tanpura volume" ${tanpura.playing ? '' : 'hidden'}>
    <button aria-label="${tanpura.playing ? 'Stop tanpura' : 'Start tanpura'}">${tanpura.loading ? '<i class="spin"></i>' : tanpura.playing ? icons.pause : icons.play}</button>`;
  $('button', tbar).onclick = () => Promise.resolve(tanpura.toggle()).catch(e => toast('Could not start audio: ' + e.message));
  $('input', tbar).oninput = e => { volDrag = true; store.setTanpura({ volume: +e.target.value }); volDrag = false; };
}
let volDrag = false;
tanpura.onChange(paintBar);
store.subscribe((s, patch) => { applyTheme(); if (!volDrag && ('tanpura' in patch || 'saPc' in patch)) paintBar(); });

function applyTheme() {
  const t = store.get().theme;
  document.documentElement.dataset.theme = t;
  $('meta[name=theme-color]').content = t === 'ivory' ? '#f3ecdc' : t === 'midnight' ? '#000000' : '#0e0d0b';
}
applyTheme();

// Release the microphone when the app is hidden.
document.addEventListener('visibilitychange', () => { if (document.hidden && mic.active) mic.stop(); });

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) toast('A newer version has been saved. It will be used the next time you open the app.', 5000); });
    });
  }).catch(() => {});
}
route();
