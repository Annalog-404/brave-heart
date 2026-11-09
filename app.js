'use strict';

/* ---------- Helpers ---------- */

const KEY = 'braveheart:v1';
const UNLOCK_KEY = 'braveheart:unlocked';
const LOCK_AFTER = 60000;
const PIN_ITER = 310000;
const PIN_FIELDS = ['pinHash', 'pinSalt', 'pinIter', 'pinFails', 'pinWaitUntil'];
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const pad = (n) => String(n).padStart(2, '0');
const dict = () => Object.create(null);

// sessionStorage can throw when storage is blocked.
const ss = {
  get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } },
  del(k) { try { sessionStorage.removeItem(k); } catch (e) { /* ignore */ } },
};

const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dkey(d); };
const fmt = (k, opts) => parseKey(k).toLocaleDateString('en-GB', opts);
const longDate = (k) => fmt(k, { weekday: 'long', day: 'numeric', month: 'long' });
const shortDate = (k) => fmt(k, { day: 'numeric', month: 'short' });
const monthShort = (k) => fmt(k, { month: 'short' });
const weekdayShort = (k) => fmt(k, { weekday: 'short' });
const dayLetter = (k) => fmt(k, { weekday: 'narrow' });
const dayNumber = (k) => String(parseKey(k).getDate());
const fmtNum = (n) => String(Math.round(Number(n) * 100) / 100);
const time12 = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
};
const relDay = (k) => {
  const t = dkey();
  if (k === t) return 'Today';
  if (k === addDays(t, -1)) return 'Yesterday';
  if (k > addDays(t, -7) && k < t) return fmt(k, { weekday: 'long' });
  return shortDate(k);
};
const times = (n) => (n === 1 ? 'Once' : n === 2 ? 'Twice' : `${n} times`);

/* ---------- Validation ---------- */

const isId = (s) => typeof s === 'string' && /^[A-Za-z0-9-]{1,40}$/.test(s);
const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && dkey(parseKey(s)) === s;
const isTime = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const isPhoto = (s) => typeof s === 'string' && s.length < 20e6 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s);
const obj = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? o : {});
const arr = (a) => (Array.isArray(a) ? a : []);
const str = (s, max = 4000) => (typeof s === 'string' ? s.slice(0, max) : '');
const num = (n, d = 0) => {
  if (typeof n === 'number' && Number.isFinite(n)) return n;
  if (typeof n === 'string' && n.trim() !== '' && Number.isFinite(Number(n))) return Number(n);
  return d;
};
const oneOf = (v, list, d) => (list.includes(v) ? v : d);
const uniqueIds = (list) => { const seen = new Set(); return list.filter((x) => !seen.has(x.id) && seen.add(x.id)); };
function mapOf(raw, keyOk, val) {
  const out = dict();
  for (const k of Object.keys(obj(raw))) {
    if (!keyOk(k)) continue;
    const v = val(raw[k]);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

const ICON_PATHS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  heart: '<path d="M12 20s-7-4.4-9-8.6C1.6 8.3 3.6 5 6.8 5c2 0 3.4 1.1 5.2 3 1.8-1.9 3.2-3 5.2-3 3.2 0 5.2 3.3 3.8 6.4-2 4.2-9 8.6-9 8.6z"/>',
  book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H19v-3"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="1.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  forward: '<path d="M9 6l6 6-6 6"/>',
  image: '<rect x="3.5" y="5" width="17" height="14" rx="1.5"/><circle cx="9" cy="10" r="1.6"/><path d="M20.5 16l-5-5-8 8"/>',
};
const icon = (name, size = 20, sw = 1.6) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]}</svg>`;
const CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

/* ---------- Data ---------- */

const DEFAULT_VALUES = [
  {
    id: 'worthy',
    name: 'Worthy',
    statement: "I am enough as I am. I don't have to earn rest, love or belonging.",
    practices: ['Name one thing I did well today', 'Rest without explaining why', 'Accept a compliment with just ‘thank you’', 'Write one kind thing about myself'],
  },
  {
    id: 'vulnerable',
    name: 'Vulnerable',
    statement: 'I let myself be seen, even when the outcome is uncertain.',
    practices: ['Share one honest thing with someone I trust', 'Ask for help with something small', 'Say how I really feel when asked', 'Say ‘I don’t know’ out loud'],
  },
  {
    id: 'courageous',
    name: 'Courageous',
    statement: 'I act before I feel ready, and I keep showing up.',
    practices: ['Do one small thing that scares me', 'Speak up once in a conversation', 'Ask for feedback', "Start the task I've been avoiding"],
  },
];

const MOODS = ['Heavy', 'Low', 'Okay', 'Good', 'Bright'];
const BEFORE = ['Nervous', 'Unsure', 'Calm'];
const AFTER = ['Proud', 'Relieved', 'Shaky'];
const STATUSES = [['considering', 'Considering'], ['registered', 'Registered'], ['attended', 'Attended']];

const defaults = () => ({
  version: 2,
  mantra: 'I am a worthy, vulnerable, courageous woman.',
  values: JSON.parse(JSON.stringify(DEFAULT_VALUES)),
  practiceDone: dict(),
  practiceSwap: dict(),
  moments: [],
  people: [],
  journal: dict(),
  goals: [],
  habitLog: dict(),
  events: [],
  recommittedAt: null,
  setupDone: false,
  pinHash: null,
  pinSalt: null,
  pinIter: 0,
  pinFails: 0,
  pinWaitUntil: 0,
});

// Rebuild state field by field, so stored or imported data can never break the app or inject markup.
function normalize(raw) {
  const s = defaults();
  raw = obj(raw);
  if (str(raw.mantra).trim()) s.mantra = str(raw.mantra, 500);

  const values = uniqueIds(arr(raw.values).filter((v) => v && isId(v.id)).slice(0, 12).map((v) => ({
    id: v.id,
    name: str(v.name, 60).trim() || v.id,
    statement: str(v.statement, 1000),
    practices: arr(v.practices).map((p) => str(p, 200).trim()).filter(Boolean).slice(0, 30),
  })));
  if (values.length) s.values = values;

  const isTrue = (x) => (x === true ? true : undefined);
  s.practiceDone = mapOf(raw.practiceDone, isDay, (m) => mapOf(m, isId, isTrue));
  s.practiceSwap = mapOf(raw.practiceSwap, isDay, (m) => mapOf(m, isId, (x) => (Number.isInteger(x) && x > 0 && x < 1000 ? x : undefined)));

  s.moments = uniqueIds(arr(raw.moments).filter((m) => m && isDay(m.date) && isId(m.valueId)).map((m) => ({
    id: isId(m.id) ? m.id : uid(),
    createdAt: str(m.createdAt, 40),
    date: m.date,
    valueId: m.valueId,
    what: str(m.what),
    who: arr(m.who).map((p) => str(p, 80).trim()).filter(Boolean).slice(0, 30),
    before: oneOf(m.before, BEFORE, ''),
    after: oneOf(m.after, AFTER, ''),
    learned: str(m.learned, 1000),
  })));
  s.people = [...new Set(arr(raw.people).map((p) => str(p, 80).trim()).filter(Boolean))].slice(0, 500);

  const lines = (a) => [0, 1, 2].map((i) => str(arr(a)[i]));
  s.journal = mapOf(raw.journal, isDay, (j) => {
    if (!j || typeof j !== 'object') return undefined;
    const m = obj(j.morning);
    const e = obj(j.evening);
    return {
      morning: { mood: oneOf(m.mood, MOODS, ''), grateful: lines(m.grateful), brave: str(m.brave), iam: str(m.iam) },
      evening: { good: lines(e.good), values: arr(e.values).filter(isId), letgo: str(e.letgo), mood: oneOf(e.mood, MOODS, '') },
    };
  });

  s.goals = uniqueIds(arr(raw.goals).filter((g) => g && isId(g.id)).map((g) => {
    const h = obj(g.habit);
    const habitName = str(h.name, 200).trim();
    return {
      id: g.id,
      createdAt: str(g.createdAt, 40),
      name: str(g.name, 200).trim() || 'Untitled goal',
      valueId: isId(g.valueId) ? g.valueId : '',
      why: str(g.why, 1000),
      current: Math.max(0, num(g.current)),
      target: Math.max(1, num(g.target, 1)),
      unit: str(g.unit, 40),
      next: str(g.next, 500),
      habit: habitName ? { name: habitName, perWeek: Math.min(7, Math.max(1, Math.round(num(h.perWeek, 3)))) } : null,
    };
  }));
  s.habitLog = mapOf(raw.habitLog, isId, (m) => mapOf(m, isDay, isTrue));

  s.events = uniqueIds(arr(raw.events).filter((e) => e && isId(e.id)).map((e) => ({
    id: e.id,
    createdAt: str(e.createdAt, 40),
    title: str(e.title, 200).trim() || 'Untitled event',
    date: isDay(e.date) ? e.date : dkey(),
    time: isTime(e.time) ? e.time : '',
    place: str(e.place, 300),
    cost: str(e.cost, 100),
    status: oneOf(e.status, STATUSES.map((x) => x[0]), 'considering'),
    goalId: isId(e.goalId) ? e.goalId : '',
    braveStep: str(e.braveStep, 500),
    takeaway: str(e.takeaway),
    people: str(e.people, 1000),
    action: str(e.action, 500),
    actionDone: e.actionDone === true,
  })));

  s.recommittedAt = isDay(raw.recommittedAt) ? raw.recommittedAt : null;
  // Data saved before the setup screen existed counts as already set up.
  s.setupDone = raw.setupDone === true || (raw.setupDone === undefined && Object.keys(raw).length > 0);
  if (typeof raw.pinHash === 'string' && /^[a-f0-9]{64}$/.test(raw.pinHash)) {
    s.pinHash = raw.pinHash;
    if (typeof raw.pinSalt === 'string' && /^[A-Za-z0-9+/=]{16,64}$/.test(raw.pinSalt)) {
      s.pinSalt = raw.pinSalt;
      s.pinIter = Math.min(5e6, Math.max(1000, Math.round(num(raw.pinIter, PIN_ITER))));
    }
    s.pinFails = Math.min(1000, Math.max(0, Math.round(num(raw.pinFails))));
    s.pinWaitUntil = Math.min(Date.now() + 300000, Math.max(0, num(raw.pinWaitUntil)));
  }
  return s;
}

// A backup must have the right shape before it may replace anything.
function looksLikeState(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const lists = ['values', 'goals', 'events', 'moments', 'people'];
  const maps = ['journal', 'habitLog', 'practiceDone', 'practiceSwap'];
  if (!Array.isArray(raw.values) || !raw.values.length) return false;
  return lists.every((k) => raw[k] === undefined || Array.isArray(raw[k]))
    && maps.every((k) => raw[k] === undefined || (raw[k] && typeof raw[k] === 'object' && !Array.isArray(raw[k])));
}

let loadProblem = false;
function load() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) { return defaults(); }
  if (!raw) return defaults();
  try {
    return normalize(JSON.parse(raw));
  } catch (e) {
    // Keep the unreadable copy so it isn't overwritten by the next save.
    try { localStorage.setItem(`${KEY}:unreadable-${Date.now()}`, raw); } catch (_) { /* ignore */ }
    loadProblem = true;
    return defaults();
  }
}

let state = load();
let saveTimer = null;
let saveFailed = false;

function save() {
  clearTimeout(saveTimer);
  saveTimer = null;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    saveFailed = false;
    return true;
  } catch (e) {
    saveFailed = true;
    toast("Couldn't save. Your phone's storage may be full. Export a backup.");
    return false;
  }
}
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 300);
}

const valueById = (id) => state.values.find((v) => v.id === id);
const valueName = (id) => (valueById(id) || {}).name || '';
const goalById = (id) => state.goals.find((g) => g.id === id);
const eventById = (id) => state.events.find((e) => e.id === id);

/* ---------- Values from the mantra ---------- */

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const sameName = (a, b) => a.toLowerCase() === b.toLowerCase();

// "I am a worthy, vulnerable, courageous woman." -> Worthy, Vulnerable, Courageous
function valuesFromMantra(text) {
  const body = text.trim().replace(/[.!]+$/, '').replace(/^i\s*(am|'m|’m)\s+((a|an|the)\s+)?/i, '');
  const parts = body.split(/\s*(?:,|;|&|\band\b)\s*/i).map((s) => s.trim()).filter(Boolean);
  const names = parts.map((p, i) => {
    const words = p.split(/\s+/);
    // In the last part the quality comes first ("courageous woman"); elsewhere it comes last ("who is brave").
    const word = words.length === 1 ? words[0] : i === parts.length - 1 ? words[0] : words[words.length - 1];
    return cap(word.replace(/[^\p{L}\p{N}’'-]/gu, '').toLowerCase());
  }).filter((w) => w.length > 1);
  return names.filter((n, i) => names.findIndex((m) => sameName(m, n)) === i).slice(0, 8);
}

const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

// Turn the chosen names into values, keeping the wording and practices of values that already exist.
function buildValues(names, f) {
  const used = new Set();
  return names.map((name) => {
    const existing = state.values.find((v) => sameName(v.name, name));
    const known = DEFAULT_VALUES.find((v) => sameName(v.name, name));
    let id = existing ? existing.id : slug(name);
    if (!isId(id) || used.has(id)) id = uid();
    used.add(id);
    const base = existing || known || { statement: '', practices: [] };
    const st = existing && f && f.elements[`statement-${existing.id}`];
    const pr = existing && f && f.elements[`practices-${existing.id}`];
    return {
      id,
      name: name.slice(0, 60),
      statement: st ? st.value.trim() : base.statement,
      practices: pr ? pr.value.split('\n').map((s) => s.trim()).filter(Boolean) : [...base.practices],
    };
  });
}

const valueChips = (chips) => chips.map(([name, on, origin], i) =>
  `<input class="sr" type="checkbox" id="vc-${i}" name="valueNames" value="${esc(name)}" data-origin="${origin}"${on ? ' checked' : ''}><label for="vc-${i}">${esc(name)}</label>`).join('');

// Rebuild the value chips as the mantra changes. Chips the person added stay; suggestions follow the mantra.
function refreshValueChips(f) {
  const box = f.querySelector('[data-value-chips]');
  const prev = Array.from(box.querySelectorAll('input')).map((el) => [el.value, el.checked, el.dataset.origin]);
  const chips = prev.filter(([, , origin]) => origin === 'user');
  valuesFromMantra(f.elements.mantra.value).forEach((name) => {
    if (chips.some(([n]) => sameName(n, name))) return;
    const before = prev.find(([n]) => sameName(n, name));
    chips.push([name, before ? before[1] : true, 'mantra']);
  });
  box.innerHTML = valueChips(chips);
}

function addValueChip(f) {
  const input = f.elements.newValue;
  const name = cap(input.value.trim().slice(0, 60));
  input.value = '';
  if (!name) return;
  const box = f.querySelector('[data-value-chips]');
  const chips = Array.from(box.querySelectorAll('input')).map((el) => [el.value, el.checked, el.dataset.origin]);
  const found = chips.find(([n]) => sameName(n, name));
  if (found) { found[1] = true; found[2] = 'user'; } else chips.push([name, true, 'user']);
  box.innerHTML = valueChips(chips);
  input.focus();
}

function valuePicker(chips) {
  return `<fieldset class="stack-s">
      <legend class="legend">Your values</legend>
      <span class="hint">Picked from the words in your mantra. Tap one to leave it out, or add your own.</span>
      <div class="chips" data-value-chips>${valueChips(chips)}</div>
      <div class="add-row"><input type="text" name="newValue" data-new-value placeholder="Add a value" aria-label="Add a value"><button type="button" class="btn btn-outline" data-action="addValue">Add</button></div>
      <p class="error" id="values-error" role="alert"></p>
    </fieldset>`;
}

function practiceFor(v, k) {
  const list = v.practices.filter(Boolean);
  if (!list.length) return '';
  const swaps = (state.practiceSwap[k] || {})[v.id] || 0;
  const [y, m, d] = k.split('-').map(Number);
  const day = Date.UTC(y, m - 1, d) / 86400000;
  return list[(day + swaps) % list.length];
}
const practiceDone = (vid, k) => !!(state.practiceDone[k] || {})[vid];
const habitDone = (gid, k) => !!(state.habitLog[gid] || {})[k];
const goalPercent = (g) => (g.target > 0 ? Math.max(0, Math.min(100, Math.round((g.current / g.target) * 100))) : 0);
const goalAmount = (g) => `${fmtNum(g.current)} of ${fmtNum(g.target)}${g.unit ? ' ' + esc(g.unit) : ''}`;

function sortMoments() {
  state.moments.sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
}
function upcomingEvents() {
  const t = dkey();
  return state.events
    .filter((e) => e.date >= t && e.status !== 'attended')
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
}
function pastEvents() {
  const t = dkey();
  return state.events
    .filter((e) => e.date < t || e.status === 'attended')
    .sort((a, b) => b.date.localeCompare(a.date));
}

function jEntry(d) {
  if (!state.journal[d]) {
    state.journal[d] = {
      morning: { mood: '', grateful: ['', '', ''], brave: '', iam: '' },
      evening: { good: ['', '', ''], values: [], letgo: '', mood: '' },
    };
  }
  return state.journal[d];
}
const J_FIELDS = { morning: ['mood', 'grateful', 'brave', 'iam'], evening: ['good', 'values', 'letgo', 'mood'] };
function setJ(d, part, path, val) {
  const [k, i] = path.split('.');
  if (!isDay(d) || !J_FIELDS[part] || !J_FIELDS[part].includes(k)) return;
  const entry = jEntry(d)[part];
  if (i !== undefined) entry[k][Number(i)] = val;
  else entry[k] = val;
  saveSoon();
}

/* ---------- Photos (IndexedDB) ---------- */

const photos = {
  dbp: null,
  open() {
    if (!this.dbp) {
      this.dbp = new Promise((resolve, reject) => {
        const req = indexedDB.open('braveheart', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('photos');
        req.onsuccess = () => {
          const db = req.result;
          db.onversionchange = () => { db.close(); this.dbp = null; };
          resolve(db);
        };
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error('Photo storage is busy'));
      }).catch((err) => { this.dbp = null; throw err; });
    }
    return this.dbp;
  },
  async run(mode, fn) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('photos', mode);
      const req = fn(tx.objectStore('photos'));
      tx.oncomplete = () => resolve(req && req.result);
      // A full disk aborts the transaction without a request error.
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('Photo storage failed'));
    });
  },
  get(k) { return this.run('readonly', (s) => s.get(k)); },
  set(k, v) { return this.run('readwrite', (s) => s.put(v, k)); },
  del(k) { return this.run('readwrite', (s) => s.delete(k)); },
  clear() { return this.run('readwrite', (s) => s.clear()); },
  all() {
    return this.run('readonly', (s) => {
      const out = dict();
      s.openCursor().onsuccess = (e) => {
        const c = e.target.result;
        if (c) { out[c.key] = c.value; c.continue(); }
      };
      return { result: out };
    });
  },
  // Clear and write in one transaction, so a failure leaves the old photos in place.
  replaceAll(map) {
    return this.run('readwrite', (s) => {
      s.clear();
      for (const k of Object.keys(map)) s.put(map[k], k);
    });
  },
};

function resizeImage(file, max = 1200) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Unreadable image')); };
    img.src = url;
  });
}

/* ---------- PIN ---------- */

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');

async function sha256(text) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}
async function derivePin(pin, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(salt), iterations }, key, 256));
}
async function setPin(pin) {
  const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
  state.pinHash = await derivePin(pin, salt, PIN_ITER);
  state.pinSalt = salt;
  state.pinIter = PIN_ITER;
  state.pinFails = 0;
  state.pinWaitUntil = 0;
}
function clearPin() {
  state.pinHash = null;
  state.pinSalt = null;
  state.pinIter = 0;
  state.pinFails = 0;
  state.pinWaitUntil = 0;
}
async function checkPin(pin) {
  if (!state.pinHash) return true;
  if (!state.pinSalt) {
    // PINs set before version 2 used a plain hash; upgrade on the first correct entry.
    const ok = (await sha256('braveheart:' + pin)) === state.pinHash;
    if (ok) await setPin(pin);
    return ok;
  }
  return (await derivePin(pin, state.pinSalt, state.pinIter)) === state.pinHash;
}
const pinWait = () => Math.max(0, Math.ceil((state.pinWaitUntil - Date.now()) / 1000));
function pinFailed() {
  state.pinFails += 1;
  if (state.pinFails >= 3) state.pinWaitUntil = Date.now() + Math.min(300, 5 * 2 ** (state.pinFails - 3)) * 1000;
  save();
}
function pinPassed() {
  state.pinFails = 0;
  state.pinWaitUntil = 0;
  save();
}
const waitMessage = (s) => `Too many tries. Try again in ${s} second${s === 1 ? '' : 's'}.`;

/* ---------- UI helpers ---------- */

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

// Navigate. `replace` drops the current screen from history, so Back skips a saved form.
const go = (hash, { replace = false } = {}) => {
  if (replace) { history.replaceState(null, '', hash); render(); }
  else if (location.hash === hash) render();
  else location.hash = hash;
};

function route() {
  const raw = location.hash.slice(1) || '/';
  const [path, qs] = raw.split('?');
  return { parts: path.split('/').filter(Boolean), q: new URLSearchParams(qs || '') };
}

function autogrow(el) {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
}

// Returns the trimmed value; if it's only spaces, clears the field and shows the "required" prompt.
function requireText(f, name) {
  const el = f.elements[name];
  const v = el.value.trim();
  if (!v) {
    el.value = '';
    el.reportValidity();
    el.focus();
  }
  return v;
}

const TABS = [['', 'Home', 'home'], ['values', 'Values', 'heart'], ['journal', 'Journal', 'book'], ['goals', 'Goals', 'target'], ['events', 'Events', 'calendar']];
function tabbar(active) {
  return `<nav class="tabbar" aria-label="Main"><div class="tabbar-inner">${TABS.map(([p, label, ic]) =>
    `<a class="tab" href="#/${p}"${active === p ? ' aria-current="page"' : ''}>${icon(ic)}${label}</a>`).join('')}</div></nav>`;
}

const radios = (name, options, selected, attrs = '') => options.map(([val, label], i) => {
  const id = `${name}-${i}-${uid()}`;
  return `<input class="sr" type="radio" id="${id}" name="${esc(name)}" value="${esc(val)}"${val === selected ? ' checked' : ''} ${attrs}><label for="${id}">${esc(label)}</label>`;
}).join('');

const backLink = (href, label) => `<a class="back" href="${href}">${icon('back', 18, 1.8)}${esc(label)}</a>`;

/* ---------- Views ---------- */

function viewHome() {
  const t = dkey();
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
  const habits = state.goals.filter((g) => g.habit && g.habit.name);
  const done = habits.filter((g) => habitDone(g.id, t)).length;
  const next = upcomingEvents()[0];

  const today = habits.length
    ? habits.map((g) => habitRow(g, t)).join('')
    : `<p class="empty">Habits you add to a goal show up here each day. <a class="link" href="#/goals/new">Add goal</a></p>`;

  const goals = state.goals.length
    ? state.goals.slice(0, 3).map((g) => {
      const p = goalPercent(g);
      return `<a class="goal-sum" href="#/goals"><div class="between"><span class="strong">${esc(g.name)}</span><span class="muted num nowrap">${goalAmount(g)}</span></div><div class="progress" role="progressbar" aria-label="${esc(g.name)}" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"><i style="width:${p}%"></i></div></a>`;
    }).join('')
    : `<p class="empty">No goals yet. <a class="link" href="#/goals/new">Add goal</a></p>`;

  const event = next
    ? eventRow(next, false)
    : `<p class="empty">Nothing planned yet. <a class="link" href="#/events/new">Add event</a></p>`;

  return `
    <header class="head">
      <div><p class="eyebrow">${esc(longDate(t))}</p><h1 class="title">${greet}</h1></div>
      <a class="link" href="#/settings">Settings</a>
    </header>
    <section class="section" aria-labelledby="h-mantra">
      <h2 id="h-mantra" class="label">Mantra</h2>
      <p class="mantra">${esc(state.mantra)}</p>
      <a class="values-line" href="#/values">${state.values.map((v) => esc(v.name)).join(', ')}</a>
    </section>
    <section class="section" aria-labelledby="h-today">
      <div class="between"><h2 id="h-today" class="label">Today</h2>${habits.length ? `<span class="small muted num">${done} of ${habits.length}</span>` : ''}</div>
      ${today}
    </section>
    <section class="section" aria-labelledby="h-goals">
      <div class="between"><h2 id="h-goals" class="label">Goals</h2>${state.goals.length ? '<a class="link small" href="#/goals">View all</a>' : ''}</div>
      ${goals}
    </section>
    <section class="section" aria-labelledby="h-next">
      <h2 id="h-next" class="label">Next event</h2>
      ${event}
    </section>`;
}

function habitRow(g, k) {
  const on = habitDone(g.id, k);
  return `<button type="button" class="row" data-action="habit" data-id="${esc(g.id)}" data-d="${esc(k)}" aria-pressed="${on}">
    <span class="check${on ? ' on' : ''}" aria-hidden="true">${CHECK}</span>
    <span class="grow">${esc(g.habit.name)}</span>
    <span class="small muted">${esc(valueName(g.valueId))}</span>
  </button>`;
}

function viewValues() {
  const t = dkey();
  const weekStart = addDays(t, -6);
  const month = fmt(t, { month: 'long' });
  const rc = state.recommittedAt;
  const recommit = rc && rc.slice(0, 7) === t.slice(0, 7)
    ? `<p class="small muted">Recommitted on ${esc(fmt(rc, { day: 'numeric', month: 'long' }))}. <button type="button" class="link small" data-action="recommit">Recommit again</button></p>`
    : `<button type="button" class="btn btn-primary btn-block" data-action="recommit">Recommit for ${esc(month)}</button>`;

  const blocks = state.values.map((v, i) => {
    const count = state.moments.filter((m) => m.valueId === v.id && m.date >= weekStart).length;
    const p = practiceFor(v, t);
    const done = practiceDone(v.id, t);
    const last = state.moments.find((m) => m.valueId === v.id);
    const swappable = v.practices.filter(Boolean).length > 1;
    const practice = !p ? '<p class="small muted">No daily practices yet. <a class="link" href="#/settings/mantra">Add them in Settings</a></p>' : `
      <p class="label practice-label">Today's practice</p>
      <div class="practice">
        ${done
          ? `<button type="button" class="hit" data-action="undoPractice" data-id="${esc(v.id)}" aria-pressed="true" aria-label="Today's ${esc(v.name)} practice is done. Tap to undo."><span class="check on">${CHECK}</span></button>`
          : `<a class="hit" href="#/moment?value=${esc(v.id)}&practice=1" aria-label="Log how I lived ${esc(v.name)} today"><span class="check"></span></a>`}
        <span class="grow">${esc(p)}</span>
        ${swappable && !done ? `<button type="button" class="link small" data-action="swap" data-id="${esc(v.id)}">Swap</button>` : ''}
      </div>`;
    const lastLine = last
      ? `<p class="small muted latest">Latest: ${esc(relDay(last.date))}${last.who && last.who.length ? ', with ' + esc(last.who.join(', ')) : ''}. ${esc(last.what)}</p>`
      : '';
    return `<article class="value">
      <span class="small muted num idx">${pad(i + 1)}</span>
      <div>
        <div class="between"><h2 class="value-name">${esc(v.name)}</h2>${count ? `<span class="small muted nowrap">${times(count)} this week</span>` : ''}</div>
        <p class="statement">${esc(v.statement)}</p>
        ${practice}
        ${lastLine}
      </div>
    </article>`;
  }).join('');

  return `
    <header><h1 class="title">I Choose to Be</h1></header>
    <div>${blocks}</div>
    <div class="stack-s">
      <a class="btn btn-quiet btn-block" href="#/moment">Log a moment</a>
      ${recommit}
    </div>`;
}

const mantraField = (val) => `<label class="field"><span>Your mantra</span><textarea name="mantra" rows="3" maxlength="500" required data-mantra placeholder="I am a worthy, vulnerable, courageous woman.">${esc(val)}</textarea><span class="hint">The sentence you want to live into. It stays at the top of your home screen.</span></label>`;

function viewSetup() {
  return `
    <header><p class="eyebrow">Welcome to Brave Heart</p><h1 class="title">Start With Your Mantra</h1></header>
    <form class="stack" data-form="setup">
      ${mantraField('')}
      ${valuePicker([])}
      <button class="btn btn-primary btn-block" type="submit">Start</button>
    </form>
    <p class="small muted">Moving from another phone? <label class="link"><input class="sr" type="file" accept="application/json,.json" data-import>Restore a backup</label></p>`;
}

function viewMantraEdit() {
  const fields = state.values.map((v) => `
    <fieldset class="section stack">
      <legend class="label float-legend">${esc(v.name)}</legend>
      <label class="field clear"><span>What it means to me</span><textarea name="statement-${esc(v.id)}" rows="3">${esc(v.statement)}</textarea></label>
      <label class="field"><span>Daily practices</span><textarea name="practices-${esc(v.id)}" rows="4">${esc(v.practices.join('\n'))}</textarea><span class="hint">One per line. The app suggests one each day; Swap shows the next.</span></label>
    </fieldset>`).join('');
  return `
    ${backLink('#/settings', 'Settings')}
    <header><h1 class="title">Mantra and Values</h1></header>
    <form class="stack" data-form="mantra">
      ${mantraField(state.mantra)}
      ${valuePicker(state.values.map((v) => [v.name, true, 'user']))}
      ${fields}
      <div class="actions"><a class="btn btn-quiet" href="#/settings">Cancel</a><button class="btn btn-primary" type="submit">Save</button></div>
    </form>`;
}

function viewMoment(q) {
  const t = dkey();
  const vid = valueById(q.get('value')) ? q.get('value') : state.values[0].id;
  const v = valueById(vid);
  const what = q.get('practice') ? practiceFor(v, t) : '';
  const people = state.people.length
    ? `<div class="chips">${state.people.map((p, i) => `<input class="sr" type="checkbox" id="who-${i}" name="who" value="${esc(p)}"><label for="who-${i}">${esc(p)}</label>`).join('')}</div>`
    : '';
  return `
    ${backLink('#/values', 'Values')}
    <header><h1 class="title">Log a Moment</h1><p class="body muted subtitle">How did you live your values today?</p></header>
    <form class="stack" data-form="moment">
      <fieldset><legend class="sr">Value</legend><div class="seg">${radios('value', state.values.map((x) => [x.id, x.name]), vid)}</div></fieldset>
      <label class="field"><span>What happened?</span><textarea name="what" rows="3" required placeholder="What you did, in a sentence or two">${esc(what)}</textarea></label>
      <fieldset class="stack-s">
        <legend class="legend">Who was there?</legend>
        ${people}
        <input type="text" name="newPeople" placeholder="Add a name" aria-label="Add people, separated by commas">
        <span class="hint">Leave empty if it was just you. Separate names with commas.</span>
      </fieldset>
      <fieldset class="stack-s">
        <legend class="legend">How did it feel?</legend>
        <div class="two">
          <fieldset><legend class="small muted">Before</legend><div class="seg rows">${radios('before', BEFORE.map((x) => [x, x]), '')}</div></fieldset>
          <fieldset><legend class="small muted">After</legend><div class="seg rows">${radios('after', AFTER.map((x) => [x, x]), '')}</div></fieldset>
        </div>
      </fieldset>
      <label class="field"><span>What did I learn?</span><input type="text" name="learned" placeholder="One line is enough"></label>
      <label class="field"><span>Date</span><input type="date" name="date" value="${t}" max="${t}" required></label>
      <button class="btn btn-primary btn-block" type="submit">Save moment</button>
    </form>`;
}

function viewJournal(part, d) {
  const t = dkey();
  const j = state.journal[d] || {};
  const prev = addDays(d, -1);
  const next = addDays(d, 1);
  const switcher = `<nav class="seg" aria-label="Time of day">
      <a href="#/journal/morning?d=${d}"${part === 'morning' ? ' aria-current="page"' : ''}>Morning</a>
      <a href="#/journal/evening?d=${d}"${part === 'evening' ? ' aria-current="page"' : ''}>Evening</a>
    </nav>`;
  const dayNav = `<div class="day-nav">
      <a class="link small" href="#/journal/${part}?d=${prev}" aria-label="Previous day, ${esc(longDate(prev))}">${icon('back', 16, 1.8)}${esc(shortDate(prev))}</a>
      ${d !== t ? `<a class="link small" href="#/journal/${part}">Today</a>` : '<span></span>'}
      ${d < t ? `<a class="link small" href="#/journal/${part}?d=${next}" aria-label="Next day, ${esc(longDate(next))}">${esc(shortDate(next))}${icon('forward', 16, 1.8)}</a>` : '<span></span>'}
    </div>`;
  const bind = (path) => `data-j="${path}" data-part="${part}" data-d="${d}"`;
  const line = (path, val, label, ph = '') => `<textarea class="line-input" rows="1" ${bind(path)} aria-label="${esc(label)}" placeholder="${esc(ph)}">${esc(val)}</textarea>`;
  const numbered = (key, list, label, ph) => [0, 1, 2].map((i) =>
    `<div class="numbered"><span class="small muted num">${i + 1}</span>${line(`${key}.${i}`, (list || [])[i] || '', `${label} ${i + 1}`, i === 2 ? ph : '')}</div>`).join('');
  const moodSeg = (mood) => `<div class="seg">${radios(`mood-${part}`, MOODS.map((m) => [m, m]), mood, bind('mood'))}</div>`;

  let body;
  if (part === 'morning') {
    const m = j.morning || {};
    const lastYear = `${Number(d.slice(0, 4)) - 1}${d.slice(4)}`;
    const ly = state.journal[lastYear];
    const lyText = ly && ly.morning ? (ly.morning.grateful || []).find(Boolean) : '';
    body = `
      <fieldset><legend class="label">How I feel</legend>${moodSeg(m.mood || '')}</fieldset>
      <section class="section"><h2 class="prompt">I'm grateful for</h2>${numbered('grateful', m.grateful, 'Grateful for', 'Something small counts too')}</section>
      <section class="section"><h2 class="prompt">What would make today brave?</h2>${line('brave', m.brave || '', 'What would make today brave')}</section>
      <section class="section"><h2 class="prompt">Today, I am</h2>${line('iam', m.iam || '', 'Today I am')}</section>
      <div class="photo-row">
        <div class="photo-slot" data-photo-slot="${d}">
          <label class="photo-add"><input class="sr" type="file" accept="image/*" data-photo="${d}">${icon('image')}<span>Add photo</span></label>
        </div>
        <div>${lyText
          ? `<p class="label">A year ago today</p><p class="body ly">“${esc(lyText)}”</p>`
          : '<p class="small muted">Add one photo from today. It stays only on this phone.</p>'}</div>
      </div>`;
  } else {
    const e = j.evening || {};
    const morningMood = j.morning && j.morning.mood;
    const vals = e.values || [];
    body = `
      <section class="section"><h2 class="prompt">Three good things that happened</h2>${numbered('good', e.good, 'Good thing', 'Something small counts too')}</section>
      <fieldset class="section"><legend class="prompt float-legend">Which values did I live today?</legend>
        <div class="chips clear">${state.values.map((v, i) => {
          const id = `ev-${i}`;
          return `<input class="sr" type="checkbox" id="${id}" name="values-${d}" value="${esc(v.id)}" ${bind('values')}${vals.includes(v.id) ? ' checked' : ''}><label for="${id}">${esc(v.name)}</label>`;
        }).join('')}</div>
      </fieldset>
      <section class="section"><h2 class="prompt">What can I let go of tonight?</h2>${line('letgo', e.letgo || '', 'What can I let go of tonight')}</section>
      <fieldset class="section"><legend class="prompt float-legend">How do I feel now?</legend>
        <div class="clear">${moodSeg(e.mood || '')}</div>
        ${morningMood ? `<p class="small muted this-morning">This morning: ${esc(morningMood)}</p>` : ''}
      </fieldset>`;
  }

  return `
    <header class="stack-s">
      <div><p class="eyebrow">${esc(longDate(d))}</p><h1 class="title">Journal</h1></div>
      ${switcher}
    </header>
    ${dayNav}
    ${body}
    <p class="small muted">${saveFailed ? 'Not saved. Your phone’s storage may be full.' : 'Saved automatically. Stored only on this phone.'}</p>`;
}

function viewGoals() {
  const t = dkey();
  const days = [-6, -5, -4, -3, -2, -1, 0].map((n) => addDays(t, n));
  const list = state.goals.map((g) => {
    const p = goalPercent(g);
    const vName = valueName(g.valueId);
    const meta = vName || g.why ? `<p class="small muted meta">${vName ? `<span class="ink">${esc(vName)}</span>${g.why ? '. ' : ''}` : ''}${esc(g.why)}</p>` : '<div class="meta-gap"></div>';
    const habit = g.habit && g.habit.name ? `
      <div class="habit">
        <div class="between small"><span class="muted">${esc(g.habit.name)}, ${times(g.habit.perWeek).toLowerCase()} a week</span><span class="muted num nowrap">${days.filter((k) => habitDone(g.id, k)).length} of ${g.habit.perWeek} in 7 days</span></div>
        <div class="days">${days.map((k) => {
          const on = habitDone(g.id, k);
          return `<button type="button" class="day${on ? ' on' : ''}${k === t ? ' today' : ''}" data-action="habit" data-id="${esc(g.id)}" data-d="${k}" aria-pressed="${on}" aria-label="${esc(g.habit.name)}, ${esc(longDate(k))}"><span>${esc(dayLetter(k))}</span><span class="num">${dayNumber(k)}</span></button>`;
        }).join('')}</div>
      </div>` : '';
    return `<article class="goal">
      <div class="between"><h2>${esc(g.name)}</h2><span class="num pct">${p}%</span></div>
      ${meta}
      <div class="progress" role="progressbar" aria-label="${esc(g.name)}" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"><i style="width:${p}%"></i></div>
      <div class="goal-step">
        <div class="grow">
          <p class="small muted num">${goalAmount(g)}</p>
          ${g.next ? `<p class="body next"><span class="strong">Next:</span> ${esc(g.next)}</p>` : ''}
        </div>
        <div class="stepper">
          <button type="button" data-action="goalStep" data-id="${esc(g.id)}" data-delta="-1" aria-label="Decrease progress on ${esc(g.name)}">−</button>
          <span class="num stepper-value">${fmtNum(g.current)}</span>
          <button type="button" data-action="goalStep" data-id="${esc(g.id)}" data-delta="1" aria-label="Increase progress on ${esc(g.name)}">+</button>
        </div>
      </div>
      ${habit}
      <a class="link small" href="#/goals/${esc(g.id)}">Edit goal</a>
    </article>`;
  }).join('');

  return `
    <header class="head">
      <h1 class="title">Goals</h1>
      <a class="btn btn-outline" href="#/goals/new">${icon('plus', 14, 2)}Add goal</a>
    </header>
    ${state.goals.length
      ? `<div>${list}</div>`
      : `<p class="empty section">No goals yet. Pick something you're working toward, why it matters, and one small habit that moves it forward.</p>`}`;
}

function viewGoalForm(id) {
  const g = id ? goalById(id) : null;
  if (id && !g) return viewNotFound('#/goals', 'Goals');
  const d = g || { name: '', valueId: '', why: '', current: 0, target: 10, unit: '', next: '', habit: { name: '', perWeek: 3 } };
  const habit = d.habit || { name: '', perWeek: 3 };
  return `
    ${backLink('#/goals', 'Goals')}
    <header><h1 class="title">${g ? 'Edit Goal' : 'Add Goal'}</h1></header>
    <form class="stack" data-form="goal" data-id="${g ? esc(g.id) : ''}">
      <label class="field"><span>Goal</span><input type="text" name="name" value="${esc(d.name)}" maxlength="200" required placeholder="Run a 10K"></label>
      <label class="field"><span>Which value does it serve?</span><select name="valueId"><option value="">None</option>${state.values.map((v) => `<option value="${esc(v.id)}"${v.id === d.valueId ? ' selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Why it matters</span><input type="text" name="why" value="${esc(d.why)}" placeholder="Because I can do hard things"></label>
      <fieldset class="stack-s"><legend class="legend">Progress</legend>
        <div class="two">
          <label class="field"><span class="small muted">Now</span><input type="number" name="current" value="${esc(fmtNum(d.current))}" min="0" step="any" inputmode="decimal"></label>
          <label class="field"><span class="small muted">Target</span><input type="number" name="target" value="${esc(fmtNum(d.target))}" min="1" step="any" inputmode="decimal" required></label>
        </div>
        <label class="field"><span class="small muted">Unit (optional)</span><input type="text" name="unit" value="${esc(d.unit)}" maxlength="40" placeholder="km, books, steps"></label>
      </fieldset>
      <label class="field"><span>Next step</span><input type="text" name="next" value="${esc(d.next)}" placeholder="Run 8K"></label>
      <fieldset class="section stack-s"><legend class="legend float-legend">Habit (optional)</legend>
        <label class="field clear"><span class="small muted">A small action that moves this goal forward</span><input type="text" name="habitName" value="${esc(habit.name)}" placeholder="Morning run"></label>
        <label class="field"><span class="small muted">Times a week</span><select name="perWeek">${[1, 2, 3, 4, 5, 6, 7].map((n) => `<option value="${n}"${n === Number(habit.perWeek) ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      </fieldset>
      <div class="actions"><a class="btn btn-quiet" href="#/goals">Cancel</a><button class="btn btn-primary" type="submit">Save goal</button></div>
      ${g ? `<button type="button" class="btn btn-danger btn-block" data-action="deleteGoal" data-id="${esc(g.id)}">Delete goal</button>` : ''}
    </form>`;
}

function eventMeta(e) {
  return [e.time ? `${weekdayShort(e.date)} ${time12(e.time)}` : weekdayShort(e.date), e.place, e.cost].filter(Boolean).map(esc).join(', ');
}
function eventRow(e, past) {
  const status = e.status === 'registered' ? '<span class="strong">Registered</span>' : e.status === 'attended' ? 'Attended' : 'Considering';
  const goal = !past && goalById(e.goalId);
  const extra = past
    ? (e.takeaway ? `<p class="body takeaway">“${esc(e.takeaway)}”</p>` : '<p class="small reflect">Add a reflection</p>')
    : [goal ? `<p class="small muted">Toward ${esc(goal.name)}</p>` : '', e.braveStep ? `<p class="small muted">Brave step: ${esc(e.braveStep)}</p>` : ''].join('');
  return `<a class="event-row" href="#/events/${esc(e.id)}">
    <div><span class="d num">${dayNumber(e.date)}</span><span class="label">${esc(monthShort(e.date))}</span></div>
    <div class="grow"><p class="strong ev-title">${esc(e.title)}</p><p class="small muted">${eventMeta(e)}</p><p class="small muted">${status}</p>${extra}</div>
  </a>`;
}

function viewEvents(f) {
  const filters = [['all', 'All'], ['considering', 'Considering'], ['registered', 'Registered'], ['attended', 'Attended']];
  if (!filters.some(([k]) => k === f)) f = 'all';
  const up = upcomingEvents();
  const past = pastEvents();
  const tabs = `<nav class="filters" aria-label="Filter events">${filters.map(([k, l]) => `<a href="#/events?f=${k}"${k === f ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>`;
  const list = (items, label, isPast, empty) => `<section class="section" aria-label="${esc(label)}"><h2 class="label">${esc(label)}</h2>${items.length ? items.map((e) => eventRow(e, isPast)).join('') : `<p class="empty">${empty}</p>`}</section>`;

  let body = '';
  if (!state.events.length) {
    body = `<p class="empty section">No events yet. Seminars, meetups and workshops you're considering, registered for or attended show up here.</p>`;
  } else if (f === 'all') {
    body = list(up, 'Upcoming', false, 'Nothing coming up.');
    if (past.length) body += list(past, 'Past', true, '');
  } else if (f === 'attended') {
    body = list(state.events.filter((e) => e.status === 'attended').sort((a, b) => b.date.localeCompare(a.date)), 'Attended', true, 'Nothing here yet. After an event, mark it attended and add a reflection.');
  } else {
    const label = f === 'registered' ? 'Registered' : 'Considering';
    body = list(up.filter((e) => e.status === f), label, false, `No ${label.toLowerCase()} events coming up.`);
  }

  return `
    <header class="head">
      <h1 class="title">Events</h1>
      <a class="btn btn-outline" href="#/events/new">${icon('plus', 14, 2)}Add event</a>
    </header>
    ${state.events.length ? tabs : ''}
    ${body}`;
}

function viewEventForm(id) {
  const ev = id ? eventById(id) : null;
  if (id && !ev) return viewNotFound('#/events', 'Events');
  const d = ev || { title: '', date: dkey(), time: '', place: '', cost: '', status: 'considering', goalId: '', braveStep: '', takeaway: '', people: '', action: '', actionDone: false };
  return `
    ${backLink('#/events', 'Events')}
    <header><h1 class="title">${ev ? 'Edit Event' : 'Add Event'}</h1></header>
    <form class="stack" data-form="event" data-id="${ev ? esc(ev.id) : ''}">
      <label class="field"><span>Name</span><input type="text" name="title" value="${esc(d.title)}" maxlength="200" required placeholder="Public Speaking Workshop"></label>
      <div class="two">
        <label class="field"><span>Date</span><input type="date" name="date" value="${esc(d.date)}" required></label>
        <label class="field"><span>Time</span><input type="time" name="time" value="${esc(d.time)}"></label>
      </div>
      <label class="field"><span>Place</span><input type="text" name="place" value="${esc(d.place)}" placeholder="Venue or link"></label>
      <label class="field"><span>Cost</span><input type="text" name="cost" value="${esc(d.cost)}" placeholder="Free"></label>
      <fieldset><legend class="legend">Status</legend><div class="seg">${radios('status', STATUSES, d.status, 'data-status')}</div></fieldset>
      <label class="field"><span>Toward a goal</span><select name="goalId"><option value="">None</option>${state.goals.map((g) => `<option value="${esc(g.id)}"${g.id === d.goalId ? ' selected' : ''}>${esc(g.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Brave step</span><input type="text" name="braveStep" value="${esc(d.braveStep)}" placeholder="Say hi to one new person"></label>
      <fieldset class="section stack" data-after${d.status === 'attended' ? '' : ' hidden'}><legend class="label float-legend">After the event</legend>
        <label class="field clear"><span>Key takeaway</span><textarea name="takeaway" rows="3">${esc(d.takeaway)}</textarea></label>
        <label class="field"><span>People I met</span><input type="text" name="people" value="${esc(d.people)}"></label>
        <label class="field"><span>One action to try</span><input type="text" name="action" value="${esc(d.action)}"></label>
        <label class="row no-rule"><input class="sr" type="checkbox" name="actionDone"${d.actionDone ? ' checked' : ''} data-check><span class="check${d.actionDone ? ' on' : ''}" aria-hidden="true">${CHECK}</span><span>I did my one action</span></label>
      </fieldset>
      <div class="actions"><a class="btn btn-quiet" href="#/events">Cancel</a><button class="btn btn-primary" type="submit">Save event</button></div>
      ${ev ? `<button type="button" class="btn btn-danger btn-block" data-action="deleteEvent" data-id="${esc(ev.id)}">Delete event</button>` : ''}
    </form>`;
}

const pinInput = (name, label, extra = '') =>
  `<label class="field"><span class="small muted">${label}</span><input type="password" name="${name}" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="off" ${extra}></label>`;

function viewSettings() {
  const lock = state.pinHash
    ? `<p class="body">The lock is on. You'll enter your PIN each time you open Brave Heart.</p>
       <button type="button" class="btn btn-quiet" data-action="lockNow">Lock now</button>
       <form class="stack-s pin-manage" data-form="pinManage">
         <p class="body muted">To change or turn off the lock, enter your current PIN.</p>
         ${pinInput('current', 'Current PIN', 'required aria-describedby="pin-manage-error"')}
         <div class="two">${pinInput('pin', 'New PIN')}${pinInput('pin2', 'Repeat new PIN')}</div>
         <p class="error" id="pin-manage-error" role="alert"></p>
         <div class="actions"><button class="btn btn-quiet" type="submit" value="change">Change PIN</button><button class="btn btn-danger" type="submit" value="off">Turn off lock</button></div>
       </form>`
    : `<form class="stack-s" data-form="pin">
        <p class="body muted">Ask for a PIN when the app opens. This keeps your journal from casual eyes; it doesn't encrypt your data.</p>
        <div class="two">${pinInput('pin', 'New PIN', 'required aria-describedby="pin-set-error"')}${pinInput('pin2', 'Repeat PIN', 'required')}</div>
        <span class="hint">4 to 8 digits</span>
        <p class="error" id="pin-set-error" role="alert"></p>
        <button class="btn btn-primary" type="submit">Turn on lock</button>
      </form>`;
  return `
    ${backLink('#/', 'Home')}
    <header><h1 class="title">Settings</h1></header>
    <section class="section stack-s"><h2 class="label">Mantra and values</h2>
      <p class="mantra-preview">${esc(state.mantra)}</p>
      <p class="small muted">${state.values.map((v) => esc(v.name)).join(', ')}</p>
      <a class="btn btn-quiet" href="#/settings/mantra">Edit mantra and values</a>
    </section>
    <section class="section stack-s"><h2 class="label">Privacy lock</h2>${lock}</section>
    <section class="section stack-s"><h2 class="label">Backup</h2>
      <p class="body muted">Everything lives only on this phone, in this app. If you clear your browser data or change phones, it's gone, so export a backup now and then and keep it somewhere safe. Backups are not encrypted and don't include your PIN.</p>
      <div class="actions">
        <button type="button" class="btn btn-quiet" data-action="export">Export backup</button>
        <label class="btn btn-quiet"><input class="sr" type="file" accept="application/json,.json" data-import>Import backup</label>
      </div>
    </section>
    <section class="section stack-s"><h2 class="label">Erase</h2>
      <p class="body muted">Delete all entries, goals, events and photos from this phone.</p>
      <button type="button" class="btn btn-danger btn-block" data-action="erase">Erase everything</button>
    </section>
    <p class="label">Brave Heart, version 2</p>`;
}

function viewLock() {
  const wait = pinWait();
  return `
    <div class="stack">
      <p class="eyebrow">Brave Heart</p>
      <h1 class="title">Enter Your PIN</h1>
      <form class="stack-s" data-form="unlock">
        <input type="password" name="pin" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="off" aria-label="PIN" aria-describedby="pin-error" required>
        <p class="error" id="pin-error" role="alert">${wait ? esc(waitMessage(wait)) : ''}</p>
        <button class="btn btn-primary btn-block" type="submit">Unlock</button>
      </form>
      <p class="small muted">Forgot your PIN? Without it, the only way back in is to clear this app's data in your browser settings, then restore a backup.</p>
    </div>`;
}

function viewNotFound(href, label) {
  return `${backLink(href, label)}<p class="empty">This item no longer exists.</p>`;
}

function viewBroken() {
  return `
    <header><h1 class="title">Something Went Wrong</h1></header>
    <p class="body">This screen couldn't be shown. Your data hasn't been changed.</p>
    <div class="actions"><a class="btn btn-quiet" href="#/">Home</a><a class="btn btn-quiet" href="#/settings">Settings</a></div>`;
}

/* ---------- Render ---------- */

let lastPath = null;
let renderedDay = dkey();
let draft = null;

// Keep what was typed into an open form, so locking doesn't lose it.
function snapshotDraft() {
  const f = $('form[data-form]');
  if (!f || f.dataset.form === 'unlock' || f.dataset.form.startsWith('pin')) return;
  draft = { hash: location.hash, fields: Array.from(f.elements).filter((el) => el.name && el.type !== 'file').map((el) => [el.value, el.checked]) };
}
function restoreDraft() {
  if (!draft) return;
  const { hash, fields } = draft;
  draft = null;
  const f = $('form[data-form]');
  if (!f || hash !== location.hash) return;
  const els = Array.from(f.elements).filter((el) => el.name && el.type !== 'file');
  if (els.length !== fields.length) return;
  els.forEach((el, i) => {
    if (el.type === 'checkbox' || el.type === 'radio') el.checked = fields[i][1];
    else el.value = fields[i][0];
    if (el.hasAttribute('data-check')) el.nextElementSibling.classList.toggle('on', el.checked);
  });
}

function lock() {
  snapshotDraft();
  ss.del(UNLOCK_KEY);
  render();
}

function render() {
  let html;
  let tab = null;
  let locked = false;
  try {
    const { parts, q } = route();
    locked = !!state.pinHash && ss.get(UNLOCK_KEY) !== '1';
    if (locked) {
      html = viewLock();
    } else if (!state.setupDone) {
      html = viewSetup();
    } else {
      switch (parts[0] || '') {
        case 'values':
          if (parts[1] === 'edit') html = viewMantraEdit();
          else { html = viewValues(); tab = 'values'; }
          break;
        case 'moment': html = viewMoment(q); break;
        case 'journal': {
          const qd = q.get('d');
          html = viewJournal(parts[1] === 'evening' ? 'evening' : 'morning', isDay(qd) && qd <= dkey() ? qd : dkey());
          tab = 'journal';
          break;
        }
        case 'goals':
          if (parts[1]) html = viewGoalForm(parts[1] === 'new' ? null : parts[1]);
          else { html = viewGoals(); tab = 'goals'; }
          break;
        case 'events':
          if (parts[1]) html = viewEventForm(parts[1] === 'new' ? null : parts[1]);
          else { html = viewEvents(q.get('f') || 'all'); tab = 'events'; }
          break;
        case 'settings': html = parts[1] === 'mantra' ? viewMantraEdit() : viewSettings(); break;
        default: html = viewHome(); tab = '';
      }
    }
  } catch (err) {
    console.error(err);
    html = viewBroken();
    tab = null;
  }
  renderedDay = dkey();
  $('#app').innerHTML = `<main class="screen${tab === null ? ' no-tabs' : ''}${locked ? ' lock' : ''}" id="main">${html}</main>${tab !== null ? tabbar(tab) : ''}`;

  const path = location.hash.split('?')[0];
  if (path !== lastPath) { window.scrollTo(0, 0); lastPath = path; }

  document.querySelectorAll('textarea.line-input').forEach(autogrow);
  const slot = $('[data-photo-slot]');
  if (slot) {
    const d = slot.dataset.photoSlot;
    photos.get(d).then((src) => {
      if (isPhoto(src) && slot.isConnected) {
        slot.innerHTML = `<img src="${esc(src)}" alt="Photo from ${esc(longDate(d))}"><button type="button" class="link small" data-action="removePhoto" data-d="${esc(d)}">Remove photo</button>`;
      }
    }).catch(() => {});
  }
  if (locked) { const f = $('[data-form="unlock"] input'); if (f) f.focus(); }
  else restoreDraft();
}

/* ---------- Actions ---------- */

const actions = {
  habit(el) {
    const { id, d } = el.dataset;
    if (!goalById(id) || !isDay(d)) return;
    const log = state.habitLog[id] || (state.habitLog[id] = dict());
    if (log[d]) delete log[d]; else log[d] = true;
    save();
    render();
  },
  undoPractice(el) {
    const t = dkey();
    if (state.practiceDone[t]) delete state.practiceDone[t][el.dataset.id];
    save();
    render();
  },
  swap(el) {
    const id = el.dataset.id;
    if (!valueById(id)) return;
    const t = dkey();
    const s = state.practiceSwap[t] || (state.practiceSwap[t] = dict());
    s[id] = (s[id] || 0) + 1;
    save();
    render();
  },
  recommit() {
    state.recommittedAt = dkey();
    save();
    render();
    toast(`Recommitted for ${fmt(dkey(), { month: 'long' })}`);
  },
  goalStep(el) {
    const g = goalById(el.dataset.id);
    if (!g) return;
    g.current = Math.max(0, Math.round((Number(g.current) + Number(el.dataset.delta)) * 100) / 100);
    save();
    render();
  },
  deleteGoal(el) {
    const g = goalById(el.dataset.id);
    if (!g || !confirm(`Delete "${g.name}" and its habit history?`)) return;
    state.goals = state.goals.filter((x) => x.id !== g.id);
    delete state.habitLog[g.id];
    state.events.forEach((e) => { if (e.goalId === g.id) e.goalId = ''; });
    save();
    go('#/goals', { replace: true });
    toast('Goal deleted');
  },
  deleteEvent(el) {
    const e = eventById(el.dataset.id);
    if (!e || !confirm(`Delete "${e.title}"?`)) return;
    state.events = state.events.filter((x) => x.id !== e.id);
    save();
    go('#/events', { replace: true });
    toast('Event deleted');
  },
  async removePhoto(el) {
    if (!confirm('Remove this photo?')) return;
    try {
      await photos.del(el.dataset.d);
    } catch (e) {
      toast("Couldn't remove the photo.");
    }
    render();
  },
  async export() {
    try {
      const rest = { ...state };
      PIN_FIELDS.forEach((k) => delete rest[k]);
      const data = { app: 'brave-heart', version: 2, exportedAt: new Date().toISOString(), state: rest, photos: await photos.all() };
      const name = `bh-${dkey().replace(/-/g, '')}.json`;
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      // On iPhone the share sheet ("Save to Files") is more reliable than a download link.
      const file = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          return;
        } catch (err) {
          if (err.name === 'AbortError') return;
        }
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 30000);
    } catch (e) {
      toast("Couldn't create the backup.");
    }
  },
  lockNow() {
    lock();
  },
  addValue(el) {
    addValueChip(el.form);
  },
  async erase() {
    if (!confirm('Erase everything on this phone? This cannot be undone.')) return;
    if (!confirm('Last check: erase all entries, goals, events and photos?')) return;
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    ss.del(UNLOCK_KEY);
    await photos.clear().catch(() => {});
    state = defaults();
    go('#/', { replace: true });
    toast('Everything erased');
  },
};

// Shared by the setup screen and the editor in Settings. Returns false if something is missing.
function saveMantra(f, fd) {
  const mantra = requireText(f, 'mantra');
  if (!mantra) return false;
  const names = fd.getAll('valueNames').map((n) => n.trim()).filter(Boolean);
  if (!names.length) {
    $('#values-error').textContent = 'Choose at least one value, or add your own.';
    return false;
  }
  state.mantra = mantra.slice(0, 500);
  state.values = buildValues(names, f);
  return true;
}

const forms = {
  setup(f, fd) {
    if (!saveMantra(f, fd)) return;
    state.setupDone = true;
    save();
    go('#/', { replace: true });
  },
  mantra(f, fd) {
    const names = fd.getAll('valueNames');
    const removed = state.values.filter((v) => !names.some((n) => sameName(n, v.name)));
    if (removed.length && !confirm(`Remove ${removed.map((v) => v.name).join(', ')}? Moments you logged for ${removed.length === 1 ? 'it' : 'them'} are kept.`)) return;
    if (!saveMantra(f, fd)) return;
    save();
    go('#/settings', { replace: true });
    toast('Saved');
  },
  moment(f, fd) {
    const what = requireText(f, 'what');
    if (!what) return;
    const valueId = fd.get('value');
    if (!valueById(valueId)) return;
    const date = isDay(fd.get('date')) && fd.get('date') <= dkey() ? fd.get('date') : dkey();
    const added = (fd.get('newPeople') || '').split(',').map((s) => s.trim().slice(0, 80)).filter(Boolean);
    const known = (p) => state.people.find((x) => x.toLowerCase() === p.toLowerCase());
    const addedNames = added.map((p) => {
      const existing = known(p);
      if (!existing) state.people.push(p);
      return existing || p;
    });
    const who = [...new Set([...fd.getAll('who'), ...addedNames])];
    state.moments.push({
      id: uid(), createdAt: new Date().toISOString(), date, valueId, what, who,
      before: oneOf(fd.get('before'), BEFORE, ''), after: oneOf(fd.get('after'), AFTER, ''), learned: (fd.get('learned') || '').trim(),
    });
    sortMoments();
    if (date === dkey()) {
      const pd = state.practiceDone[date] || (state.practiceDone[date] = dict());
      pd[valueId] = true;
    }
    save();
    go('#/values', { replace: true });
    toast('Moment saved');
  },
  goal(f, fd) {
    const id = f.dataset.id;
    const g = id ? goalById(id) : { id: uid(), createdAt: new Date().toISOString() };
    if (!g) { toast('This goal no longer exists.'); go('#/goals', { replace: true }); return; }
    const name = requireText(f, 'name');
    if (!name) return;
    g.name = name.slice(0, 200);
    g.valueId = valueById(fd.get('valueId')) ? fd.get('valueId') : '';
    g.why = (fd.get('why') || '').trim();
    g.current = Math.max(0, num(fd.get('current')));
    g.target = Math.max(1, num(fd.get('target'), 1));
    g.unit = (fd.get('unit') || '').trim().slice(0, 40);
    g.next = (fd.get('next') || '').trim();
    const hn = (fd.get('habitName') || '').trim();
    g.habit = hn ? { name: hn, perWeek: Math.min(7, Math.max(1, num(fd.get('perWeek'), 3))) } : null;
    if (!id) state.goals.push(g);
    save();
    go('#/goals', { replace: true });
    toast(id ? 'Goal saved' : 'Goal added');
  },
  event(f, fd) {
    const id = f.dataset.id;
    const e = id ? eventById(id) : { id: uid(), createdAt: new Date().toISOString() };
    if (!e) { toast('This event no longer exists.'); go('#/events', { replace: true }); return; }
    const title = requireText(f, 'title');
    if (!title) return;
    Object.assign(e, {
      title: title.slice(0, 200),
      date: isDay(fd.get('date')) ? fd.get('date') : dkey(),
      time: isTime(fd.get('time')) ? fd.get('time') : '',
      place: (fd.get('place') || '').trim(),
      cost: (fd.get('cost') || '').trim(),
      status: oneOf(fd.get('status'), STATUSES.map((x) => x[0]), 'considering'),
      goalId: goalById(fd.get('goalId')) ? fd.get('goalId') : '',
      braveStep: (fd.get('braveStep') || '').trim(),
      takeaway: (fd.get('takeaway') || '').trim(),
      people: (fd.get('people') || '').trim(),
      action: (fd.get('action') || '').trim(),
      actionDone: fd.get('actionDone') === 'on',
    });
    if (!id) state.events.push(e);
    save();
    go('#/events', { replace: true });
    toast(id ? 'Event saved' : 'Event added');
  },
  async pin(f, fd) {
    const err = $('#pin-set-error');
    const pin = fd.get('pin') || '';
    if (!/^\d{4,8}$/.test(pin)) { err.textContent = 'Use 4 to 8 digits.'; return; }
    if (pin !== fd.get('pin2')) { err.textContent = "The PINs don't match."; return; }
    await setPin(pin);
    ss.set(UNLOCK_KEY, '1');
    save();
    render();
    toast('Lock turned on');
  },
  async pinManage(f, fd, submitter) {
    const err = $('#pin-manage-error');
    const wait = pinWait();
    if (wait) { err.textContent = waitMessage(wait); return; }
    if (!(await checkPin(fd.get('current') || ''))) {
      pinFailed();
      err.textContent = "That isn't your current PIN.";
      f.elements.current.value = '';
      f.elements.current.focus();
      return;
    }
    pinPassed();
    if (submitter && submitter.value === 'off') {
      if (!confirm('Turn off the PIN lock?')) return;
      clearPin();
      save();
      render();
      toast('Lock turned off');
      return;
    }
    const pin = fd.get('pin') || '';
    if (!/^\d{4,8}$/.test(pin)) { err.textContent = 'Enter a new PIN of 4 to 8 digits.'; return; }
    if (pin !== fd.get('pin2')) { err.textContent = "The new PINs don't match."; return; }
    await setPin(pin);
    save();
    render();
    toast('PIN changed');
  },
  async unlock(f, fd) {
    const err = $('#pin-error');
    const wait = pinWait();
    if (wait) { err.textContent = waitMessage(wait); f.reset(); return; }
    if (await checkPin(fd.get('pin') || '')) {
      pinPassed();
      ss.set(UNLOCK_KEY, '1');
      render();
    } else {
      pinFailed();
      const w = pinWait();
      err.textContent = w ? waitMessage(w) : "That PIN doesn't match. Try again.";
      f.reset();
      f.querySelector('input').focus();
    }
  },
};

async function importBackup(file) {
  let next;
  let pics;
  try {
    if (file.size > 300 * 1024 * 1024) throw new Error('Too large');
    const data = JSON.parse(await file.text());
    if (!data || data.app !== 'brave-heart' || !looksLikeState(data.state)) throw new Error('Not a backup');
    next = normalize(data.state);
    pics = mapOf(data.photos, isDay, (v) => (isPhoto(v) ? v : undefined));
  } catch (err) {
    toast("That file isn't a Brave Heart backup. Nothing was changed.");
    return;
  }
  if (!confirm('Replace everything on this phone with this backup?')) return;
  // The PIN belongs to this phone, not the backup.
  PIN_FIELDS.forEach((k) => { next[k] = state[k]; });
  try {
    await photos.replaceAll(pics);
  } catch (err) {
    toast("Couldn't restore the photos. Nothing was changed.");
    return;
  }
  const prev = state;
  state = next;
  if (!save()) { state = prev; return; }
  go('#/', { replace: true });
  toast('Backup restored');
}

/* ---------- Events ---------- */

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (el && actions[el.dataset.action]) {
    e.preventDefault();
    actions[el.dataset.action](el, e);
  }
});

document.addEventListener('submit', async (e) => {
  const f = e.target;
  if (!f.dataset.form || !forms[f.dataset.form]) return;
  e.preventDefault();
  // Ignore a second tap while the first submit is still being handled.
  if (f.dataset.busy) return;
  f.dataset.busy = '1';
  try {
    await forms[f.dataset.form](f, new FormData(f), e.submitter);
  } finally {
    delete f.dataset.busy;
  }
});

document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.j && el.tagName === 'TEXTAREA') {
    autogrow(el);
    setJ(el.dataset.d, el.dataset.part, el.dataset.j, el.value);
  } else if (el.hasAttribute('data-mantra')) {
    refreshValueChips(el.form);
  }
});

// Enter in "Add a value" adds the chip instead of submitting the form.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.hasAttribute && e.target.hasAttribute('data-new-value')) {
    e.preventDefault();
    addValueChip(e.target.form);
  }
});

document.addEventListener('change', async (e) => {
  const el = e.target;
  if (el.dataset.j && el.type === 'radio') {
    setJ(el.dataset.d, el.dataset.part, el.dataset.j, el.value);
    save();
  } else if (el.dataset.j && el.type === 'checkbox') {
    const vals = Array.from(document.querySelectorAll(`input[name="${CSS.escape(el.name)}"]:checked`)).map((x) => x.value);
    setJ(el.dataset.d, el.dataset.part, el.dataset.j, vals);
    save();
  } else if (el.hasAttribute('data-status')) {
    // "After the event" only applies once the event is marked attended. Hidden fields still save.
    const after = el.form.querySelector('[data-after]');
    if (after) after.hidden = el.value !== 'attended';
  } else if (el.hasAttribute('data-check')) {
    el.nextElementSibling.classList.toggle('on', el.checked);
  } else if (el.dataset.photo && el.files && el.files[0]) {
    try {
      if (!isDay(el.dataset.photo)) throw new Error('Bad date');
      const src = await resizeImage(el.files[0]);
      await photos.set(el.dataset.photo, src);
      render();
    } catch (err) {
      toast("Couldn't add that photo.");
    }
  } else if (el.hasAttribute('data-import') && el.files && el.files[0]) {
    const file = el.files[0];
    el.value = '';
    await importBackup(file);
  }
});

window.addEventListener('hashchange', render);

// Hide the screen when the app goes to the background, and lock again after a minute away.
let hiddenAt = 0;
let updateReady = false;
const formOpen = () => !!$('form[data-form]:not([data-form="unlock"])');
const typing = () => /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '');
window.addEventListener('pagehide', () => {
  if (saveTimer) save();
  if (state.pinHash) document.body.classList.add('veil');
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (saveTimer) save();
    hiddenAt = Date.now();
    if (state.pinHash) document.body.classList.add('veil');
    return;
  }
  if (updateReady && !formOpen()) { location.reload(); return; }
  if (state.pinHash && hiddenAt && Date.now() - hiddenAt > LOCK_AFTER) lock();
  else if (dkey() !== renderedDay && !formOpen() && !typing()) render();
  document.body.classList.remove('veil');
});
window.addEventListener('pageshow', () => document.body.classList.remove('veil'));

// Move to the new day if the app is left open past midnight.
setInterval(() => {
  if (!document.hidden && dkey() !== renderedDay && !formOpen() && !typing()) render();
}, 60000);

/* ---------- Start ---------- */

render();
if (loadProblem) toast("Some saved data couldn't be read. A copy was kept.");

if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  const hadController = !!navigator.serviceWorker.controller;
  // A new version takes over in the background; reload next time the app is reopened.
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) updateReady = true; });
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
