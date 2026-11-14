// Settings: instrument, tuning, notation, detection, appearance, data, offline status.
import * as store from '../store.js';
import { $, esc, header, seg, icons, sheet, toast, fmtHz, signed } from '../dom.js';
import { saHz, NOTE_NAMES, SAFED_KALI, mod, clamp } from '../theory.js';
import { FIRST } from '../tanpura.js';
import { RAAGS } from '../raags.js';
import { offlineStatus } from '../app.js';

export function mount(el) {
  let s = store.get();
  const sw = (id, on) => `<button class="switch${on ? ' on' : ''}" id="${id}" role="switch" aria-checked="${on}"><i></i></button>`;
  const paint = () => {
    s = store.get();
    const midi = 12 * (s.saOct + 1) + s.saPc;
    el.innerHTML = `
      ${header('Settings', 'Preferences', 'Everything here is stored on this device only.')}
      <h2 class="h2">Bansuri and Sa</h2>
      <div class="panel">
        <div class="field col"><label for="nm"><b>Name of this flute</b></label><input class="inp" id="nm" maxlength="40" value="${esc(s.bansuriName)}"></div>
        <div class="field"><div><b>Sa</b><small>The note with three holes closed · ${fmtHz(saHz(s))} Hz</small></div>
          <select class="sel" id="sa">${Array.from({ length: 31 }, (_, i) => 52 + i).map(m => `<option value="${m}"${m === midi ? ' selected' : ''}>${NOTE_NAMES[mod(m, 12)]}${Math.floor(m / 12) - 1} · ${SAFED_KALI[mod(m, 12)]}</option>`).join('')}</select></div>
        <div class="field"><div><b>Fine-tune</b><small>Offset of this flute's Sa, in cents. Calibrate it by ear or in the Tuner.</small></div>
          <div class="stepper"><button id="fDn">${icons.minus}</button><output>${signed(s.fine, 0)}¢</output><button id="fUp">${icons.plus}</button></div></div>
        <div class="field"><div><b>Concert pitch (A4)</b><small>Reference for Western note names</small></div>
          <div class="stepper"><button id="aDn">${icons.minus}</button><output>${s.a4} Hz</output><button id="aUp">${icons.plus}</button></div></div>
      </div>

      <h2 class="h2">Notation and tuning</h2>
      <div class="panel">
        <div class="field"><div><b>Notation</b><small>How notes are written throughout the app</small></div><div class="seg seg-s" id="nota"><button data-v="indian">Swara</button><button data-v="western">Western</button></div></div>
        <div class="field"><div><b>Swara targets</b><small>${s.temperament === 'just' ? 'Just intonation: pure ratios against Sa, as heard with a tanpura' : 'Equal temperament: the tuning of a harmonium or keyboard'}</small></div><div class="seg seg-s" id="temp"><button data-v="just">Just</button><button data-v="et">Equal</button></div></div>
        <div class="slider"><label for="tol">In-tune tolerance</label><input id="tol" type="range" min="5" max="30" step="1" value="${s.tol}"><output>±${s.tol}¢</output></div>
      </div>

      <h2 class="h2">Detection</h2>
      <div class="panel">
        <div class="field"><div><b>Microphone sensitivity</b><small>Higher picks up quieter playing, and more room noise</small></div><div class="seg seg-s" id="gate"><button data-v="0.008">Low</button><button data-v="0.0025">Normal</button><button data-v="0.001">High</button></div></div>
        <div class="field"><div><b>Pitch clarity required</b><small>Strict shows fewer but surer readings</small></div><div class="seg seg-s" id="conf"><button data-v="0.9">Strict</button><button data-v="0.78">Normal</button><button data-v="0.68">Lenient</button></div></div>
        <div class="slider"><label for="mn">Shortest note</label><input id="mn" type="range" min="60" max="250" step="10" value="${s.minNoteMs}"><output>${s.minNoteMs} ms</output></div>
        <div class="field"><div><b>Noise suppression</b><small>Phone voice processing. Leave off for music; it distorts sustained notes.</small></div>${sw('ns', s.micNS)}</div>
        <div class="field"><div><b>Echo cancellation</b><small>Can help when the tanpura plays through the speaker, at some cost to accuracy. Earphones are better.</small></div>${sw('ec', s.micEC)}</div>
      </div>
      <p class="hint">Microphone options apply the next time listening starts.</p>

      <h2 class="h2">Tanpura</h2>
      <div class="list"><a class="li" href="#/tanpura"><span><b>${FIRST[s.tanpura.first].label} – Sa – Sa – Sa</b><small>${s.tanpura.tempo} plucks / min · volume ${Math.round(s.tanpura.volume * 100)}%</small></span>${icons.chev}</a></div>

      <h2 class="h2">Appearance</h2>
      <div class="panel"><div class="field"><div><b>Theme</b></div><div class="seg seg-s" id="theme"><button data-v="charcoal">Charcoal</button><button data-v="midnight">Midnight</button><button data-v="ivory">Ivory</button></div></div></div>

      <h2 class="h2">Offline and privacy</h2>
      <div class="panel">
        <div class="field"><div><b>Offline use</b><small id="off">Checking…</small></div></div>
        <div class="field"><div><b>Your audio</b><small>Analysis runs on this device. Recordings are kept in this app's local storage and are never uploaded. There are no accounts, analytics or network requests after installation.</small></div></div>
        <div class="field"><div><b>Needs internet</b><small>Only the first visit (to install) and fetching a newer version of the app. Every feature works offline after that.</small></div></div>
        <div class="field"><div><b>Storage</b><small id="stor">—</small></div></div>
      </div>

      <h2 class="h2">Known limits</h2>
      <ul class="plain">
        <li>Detection is monophonic: one melodic line at a time. A tanpura or other instruments sounding through the room will confuse it; use earphones for the drone.</li>
        <li>Raag identification is a rule-based comparison with ${RAAGS.length} raags. It reports resemblance and its reasons, not certainty.</li>
        <li>Meend, vibrato and andolan are reported only when clearly measurable; fine ornaments such as kan and murki are too brief to classify reliably.</li>
        <li>iOS pauses audio when the app is in the background or the screen is locked, and mutes it when the ring/silent switch is on silent.</li>
        <li>The tanpura is synthesised, not sampled. It is voiced to resemble the instrument's jivari shimmer but is not a recording of one.</li>
      </ul>

      <h2 class="h2">Data</h2>
      <div class="list">
        <button class="li danger" id="delAll"><span><b>Delete all recordings</b></span>${icons.trash}</button>
        <button class="li danger" id="reset"><span><b>Reset all settings</b></span>${icons.chev}</button>
      </div>
      <p class="hint center">Bansuri AI Studio · version 1.0</p>`;

    const E = i => $('#' + i, el);
    E('nm').onchange = e => store.set({ bansuriName: e.target.value.trim() || 'My bansuri' });
    E('sa').onchange = e => { const m = +e.target.value; store.set({ saPc: mod(m, 12), saOct: Math.floor(m / 12) - 1 }); };
    E('fDn').onclick = () => store.set({ fine: clamp(s.fine - 1, -50, 50) }); E('fUp').onclick = () => store.set({ fine: clamp(s.fine + 1, -50, 50) });
    E('aDn').onclick = () => store.set({ a4: clamp(s.a4 - 1, 415, 466) }); E('aUp').onclick = () => store.set({ a4: clamp(s.a4 + 1, 415, 466) });
    seg(E('nota'), s.notation, v => store.set({ notation: v }));
    seg(E('temp'), s.temperament, v => store.set({ temperament: v }));
    seg(E('gate'), String(s.gate), v => store.set({ gate: +v }));
    seg(E('conf'), String(s.minConf), v => store.set({ minConf: +v }));
    seg(E('theme'), s.theme, v => store.set({ theme: v }));
    const slide = (id, key, fmt) => { E(id).oninput = e => { e.target.nextElementSibling.textContent = fmt(+e.target.value); }; E(id).onchange = e => store.set({ [key]: +e.target.value }); };
    slide('tol', 'tol', v => '±' + v + '¢'); slide('mn', 'minNoteMs', v => v + ' ms');
    E('ns').onclick = () => store.set({ micNS: !s.micNS }); E('ec').onclick = () => store.set({ micEC: !s.micEC });
    E('delAll').onclick = async () => { if (await sheet({ title: 'Delete all recordings?', body: 'Every recording and its analysis will be removed from this device. This cannot be undone.', ok: 'Delete all', danger: true })) { await store.recordings.clear(); toast('All recordings deleted.'); paint(); } };
    E('reset').onclick = async () => { if (await sheet({ title: 'Reset all settings?', body: 'Sa, tuning, tanpura and display preferences return to their defaults. Recordings are kept.', ok: 'Reset', danger: true })) { store.reset(); toast('Settings reset.'); } };
    offlineStatus().then(o => { const n = E('off'); if (n) n.textContent = o.text; });
    Promise.all([store.storageInfo(), store.recordings.list().catch(() => [])]).then(([i, l]) => { const n = E('stor'); if (n) n.textContent = `${l.length} recording${l.length === 1 ? '' : 's'}` + (i ? ` · ${(i.used / 1048576).toFixed(1)} MB used on this device` : ''); });
  };
  paint();
  let y = 0;
  const off = store.subscribe(() => { const v = $('#view'); y = v.scrollTop; paint(); v.scrollTop = y; });
  return off;
}
