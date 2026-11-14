// Local persistence only: settings in localStorage, recordings in IndexedDB. Nothing leaves the device.
const KEY = 'bansuri.settings.v1';
const REV = 2; // bump to re-apply improved detection defaults once on existing installs
export const DEFAULTS = {
  saPc: 4, saOct: 4, fine: 0, a4: 440,
  bansuriName: 'My bansuri',
  temperament: 'just', notation: 'indian', theme: 'charcoal',
  minConf: 0.78, gate: 0.0025, tol: 15, minNoteMs: 100,
  myFlutes: [], rev: REV,
  micNS: false, micEC: false,
  tunerMode: 'swara',
  tanpura: { first: 'P', tempo: 54, volume: 0.7, jivari: 0.6, register: 0, timbre: 'concert' },
  intonation: {},
  practiceGoal: 20,
};
let state;
try { const raw = JSON.parse(localStorage.getItem(KEY) || '{}'); state = { ...DEFAULTS, ...raw, tanpura: { ...DEFAULTS.tanpura, ...(raw.tanpura || {}) } };
  if ((raw.rev || 1) < REV) state = { ...state, minConf: DEFAULTS.minConf, gate: DEFAULTS.gate, rev: REV }; }
catch { state = structuredClone(DEFAULTS); }
const subs = new Set();
export const get = () => state;
export function set(patch) {
  state = { ...state, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked */ }
  subs.forEach(f => f(state, patch));
}
export const setTanpura = patch => set({ tanpura: { ...state.tanpura, ...patch } });
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
export function reset() { state = structuredClone(DEFAULTS); localStorage.removeItem(KEY); subs.forEach(f => f(state, state)); }

// ---- Recordings (IndexedDB) ----
let dbp;
function db() {
  return dbp || (dbp = new Promise((res, rej) => {
    const rq = indexedDB.open('bansuri-studio', 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('recordings', { keyPath: 'id' });
    rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
  }));
}
const tx = async (mode, fn) => {
  const d = await db();
  return new Promise((res, rej) => { const t = d.transaction('recordings', mode); const rq = fn(t.objectStore('recordings')); t.oncomplete = () => res(rq && rq.result); t.onerror = t.onabort = () => rej(t.error); });
};
export const recordings = {
  put: rec => tx('readwrite', s => s.put(rec)),
  get: id => tx('readonly', s => s.get(id)),
  del: id => tx('readwrite', s => s.delete(id)),
  clear: () => tx('readwrite', s => s.clear()),
  async list() { const all = await tx('readonly', s => s.getAll()); return (all || []).sort((a, b) => b.created - a.created); },
};
export async function storageInfo() {
  if (!navigator.storage?.estimate) return null;
  const e = await navigator.storage.estimate();
  return { used: e.usage || 0, quota: e.quota || 0, persisted: navigator.storage.persisted ? await navigator.storage.persisted() : false };
}
export const requestPersist = () => navigator.storage?.persist ? navigator.storage.persist().catch(() => false) : Promise.resolve(false);
