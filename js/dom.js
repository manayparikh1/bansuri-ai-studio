// Small DOM utilities, icons and shared UI pieces.
import { mic, micErrorText } from './audio.js';

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
export const fmtDur = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
export const fmtHz = f => f >= 1000 ? f.toFixed(1) : f.toFixed(2);
export const signed = (v, d = 0) => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(d);

export function fitCanvas(cv) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { c, w, h };
}

const I = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d.split('|').map(p => `<path d="${p}"/>`).join('')}${extra}</svg>`;
export const icons = {
  home: I('M4 11.5 12 5l8 6.5|M6 10.5V19h12v-8.5|M10 19v-4.5a2 2 0 0 1 4 0V19'),
  live: I('M2.5 12h2.2l2-6 3.1 12 3-9 2 5 1.6-2h5.1'),
  raag: I('M12 4.5c2.8 2.8 2.8 6.7 0 9.5-2.8-2.8-2.8-6.7 0-9.5Z|M4 9.5c3.9 0 6.9 1.8 8 5.5-3.9 0-6.9-1.8-8-5.5Z|M20 9.5c-3.9 0-6.9 1.8-8 5.5 3.9 0 6.9-1.8 8-5.5Z|M5.5 19h13'),
  tanpura: I('M12 3v9.5|M9.5 3h5|M10 6h4', '<circle cx="12" cy="17" r="4.5"/>'),
  tuner: I('M4 17a8 8 0 0 1 16 0|M12 17l3.6-6.2|M12 6.5V9|M5.8 10.4l1.8 1.4|M18.2 10.4l-1.8 1.4'),
  practice: I('', '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>'),
  learn: I('M4 6.2c3-.9 5.9-.7 8 1.1 2.1-1.8 5-2 8-1.1v11.6c-3-.9-5.900-.7-8 1.100-2.100-1.800-5-2-8-1.100Z|M12 7.300V18.900'),
  settings: I('M4 7.500h9|M18 7.500h2|M4 16.500h3|M12 16.500h8', '<circle cx="15.500" cy="7.500" r="2.300"/><circle cx="9.500" cy="16.500" r="2.300"/>'),
  play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.200v13.600a.6.6 0 0 0 .92.500l10.500-6.800a.6.600 0 0 0 0-1L8.920 4.700A.6.600 0 0 0 8 5.200Z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6.500" y="5" width="4" height="14" rx=".8"/><rect x="13.500" y="5" width="4" height="14" rx=".8"/></svg>',
  mic: I('M12 4a3 3 0 0 1 3 3v4a3 3 0 0 1-6 0V7a3 3 0 0 1 3-3Z|M6 11a6 6 0 0 0 12 0|M12 17v3'),
  back: I('M14.500 5.500 8 12l6.500 6.500'),
  chev: I('M9.500 5.500 16 12l-6.500 6.500'),
  trash: I('M5 7h14|M9.500 7V5h5v2|M7 7l.8 12h8.400L17 7'),
  share: I('M12 15V4|M8 7.500 12 4l4 3.500|M5 12v7h14v-7'),
  minus: I('M6 12h12'), plus: I('M6 12h12|M12 6v12'),
};

let toastT;
export function toast(msg, ms = 3200) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), ms);
}

export function sheet({ title, body, ok = 'Confirm', cancel = 'Cancel', danger = false, input = null }) {
  return new Promise(res => {
    const el = document.createElement('div'); el.className = 'sheet-wrap';
    el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><h3>${esc(title)}</h3>${body ? `<p>${body}</p>` : ''}
      ${input !== null ? `<input class="inp" type="text" value="${esc(input)}" maxlength="60">` : ''}
      <div class="sheet-btns">${cancel ? `<button class="btn" data-x>${esc(cancel)}</button>` : ''}<button class="btn ${danger ? 'btn-danger' : 'btn-gold'}" data-ok>${esc(ok)}</button></div></div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('on'));
    const inp = $('input', el); if (inp) { inp.focus(); inp.select(); }
    const done = v => { el.classList.remove('on'); setTimeout(() => el.remove(), 220); res(v); };
    el.addEventListener('click', e => {
      if (e.target === el || e.target.closest('[data-x]')) done(input !== null ? null : false);
      else if (e.target.closest('[data-ok]')) done(input !== null ? inp.value.trim() : true);
    });
  });
}

// Binds a button to the shared microphone. Returns an unsubscribe function.
export function micButton(btn, { idle = 'Begin listening', live = 'Stop listening' } = {}) {
  const paint = () => {
    btn.classList.toggle('is-live', mic.active);
    btn.innerHTML = `<span class="btn-ic">${mic.active ? '<i class="pulse"></i>' : icons.mic}</span><span>${mic.active ? live : idle}</span>`;
  };
  btn.addEventListener('click', async () => {
    if (mic.active) return mic.stop();
    btn.disabled = true;
    try { await mic.start(); } catch (e) { toast(micErrorText(e), 6000); }
    btn.disabled = false;
  });
  paint();
  return mic.onState(paint);
}

export function seg(el, value, onChange) {
  const paint = v => $$('button', el).forEach(b => b.classList.toggle('on', b.dataset.v === String(v)));
  paint(value);
  el.addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (!b) return; paint(b.dataset.v); onChange(b.dataset.v); });
  return paint;
}

export function download(blob, filename) {
  const file = new File([blob], filename, { type: blob.type });
  // In an installed iOS app the share sheet is the reliable way to save a file.
  if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
    navigator.share({ files: [file], title: filename }).catch(() => {});
    return;
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export const header = (eyebrow, title, sub = '', back = '') => `
  <header class="vh">${back ? `<a class="back" href="${back}" aria-label="Back">${icons.back}</a>` : ''}
    <div class="eyebrow">${eyebrow}</div><h1>${title}</h1>${sub ? `<p class="lede">${sub}</p>` : ''}
    <div class="orn"><i></i></div></header>`;
