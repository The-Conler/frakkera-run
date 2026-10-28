// Persistenza locale: record personale, impostazioni e classifica DEMO.
// NB: la classifica locale e' SOLO dimostrativa. La classifica ufficiale
// per i premi sara' server-side (Fase 3).
import { DEMO_BOARD } from '../config.js';

const K = {
  best: 'frakkera.best.v1',
  mute: 'frakkera.mute.v1',
  nick: 'frakkera.nick.v1',
  board: 'frakkera.demoBoard.v1',
  carpets: 'frakkera.carpets.v1',
  music: 'frakkera.music.v1',
  coll: 'frakkera.collect.v1',
  skins: 'frakkera.skins.v1',
  skin: 'frakkera.skin.v1',
  up: 'frakkera.upgrades.v1',
};

const mem = {}; // fallback se localStorage non e' disponibile (es. privacy mode)
function get(key) {
  try { const v = localStorage.getItem(key); return v === null ? mem[key] ?? null : v; }
  catch { return mem[key] ?? null; }
}
function set(key, val) {
  mem[key] = val;
  try { localStorage.setItem(key, val); } catch { /* quota / privacy */ }
}

export function getBest() {
  const raw = get(K.best);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}
// Salva solo se migliore: non si perde mai il record.
export function submitBest(score) {
  const prev = getBest();
  if (score > prev) { set(K.best, String(score)); return true; }
  return false;
}

// Tappeti "Sa Burra": moneta cumulativa, separata dal punteggio.
export function getCarpetTotal() {
  const n = parseInt(get(K.carpets) || '0', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
export function addCarpets(n) {
  const t = getCarpetTotal() + Math.max(0, Math.floor(n));
  set(K.carpets, String(t));
  return t;
}

// v5s7: spesa nel Garag di Pinu. Ritorna il nuovo totale, oppure -1 se i tappeti non bastano.
export function spendCarpets(n) {
  const t = getCarpetTotal(), c = Math.max(0, Math.floor(n));
  if (c > t) return -1;
  set(K.carpets, String(t - c));
  return t - c;
}

export const getMuted = () => get(K.mute) === '1';
export const setMuted = (m) => set(K.mute, m ? '1' : '0');
export const getMusic = () => get(K.music) !== '0';
export const setMusic = (m) => set(K.music, m ? '1' : '0');
export const getNick = () => get(K.nick) || '';
export const setNick = (n) => set(K.nick, n);

// Voci di esempio, marcate demo, per mostrare l'aspetto della classifica.
const SAMPLE = [
  { name: 'SCINTILLA', score: 18450, dist: 1020 },
  { name: 'BRACE', score: 12320, dist: 760 },
  { name: 'ASFODELO', score: 8710, dist: 540 },
  { name: 'FERULA', score: 5260, dist: 350 },
  { name: 'FUMO', score: 2480, dist: 180 },
].map((e) => ({ ...e, date: null, sample: true }));

export function getBoard() {
  let list = null;
  try { list = JSON.parse(get(K.board) || 'null'); } catch { list = null; }
  if (!Array.isArray(list)) list = SAMPLE.slice();
  return list
    .filter((e) => e && typeof e.name === 'string' && Number.isFinite(e.score))
    .sort((a, b) => b.score - a.score)
    .slice(0, DEMO_BOARD.SIZE);
}

// Posizione che avrebbe il punteggio (1-based), null se fuori classifica
export function rankFor(score) {
  const list = getBoard();
  let pos = list.findIndex((e) => score > e.score);
  if (pos === -1) pos = list.length;
  return pos < DEMO_BOARD.SIZE ? pos + 1 : null;
}

export function addToBoard(entry) {
  const list = getBoard();
  list.push({ name: entry.name, score: entry.score, dist: entry.dist, date: new Date().toISOString(), id: entry.id });
  list.sort((a, b) => b.score - a.score);
  const trimmed = list.slice(0, DEMO_BOARD.SIZE);
  set(K.board, JSON.stringify(trimmed));
  const idx = trimmed.findIndex((e) => e.id === entry.id);
  return idx >= 0 ? idx + 1 : null;
}

export function resetBoard() { set(K.board, JSON.stringify(SAMPLE)); }

// v5s19: collezionabili (campanacci 'bell', facciole 'sweet') e costumi sbloccati
export function getCollection() {
  let o = null; try { o = JSON.parse(get(K.coll) || 'null'); } catch { o = null; }
  const n = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  return { bell: n(o && o.bell), sweet: n(o && o.sweet) };
}
export function addCollectible(kind, n = 1) {
  const c = getCollection(); if (kind !== 'bell' && kind !== 'sweet') return c;
  c[kind] += Math.max(0, Math.floor(n)); set(K.coll, JSON.stringify(c)); return c;
}
export function getUnlocked() {
  let a = null; try { a = JSON.parse(get(K.skins) || 'null'); } catch { a = null; }
  const l = Array.isArray(a) ? a.filter((x) => typeof x === 'string') : [];
  if (!l.includes('base')) l.unshift('base');
  return l;
}
export function unlockSkin(id) { const l = getUnlocked(); if (!l.includes(id)) { l.push(id); set(K.skins, JSON.stringify(l)); } return l; }
export const getSkin = () => { const s = get(K.skin) || 'base'; return getUnlocked().includes(s) ? s : 'base'; };
export const setSkin = (id) => set(K.skin, id);

// v5s25: migliorie permanenti del Garag di Pinu ({ id: livello 0..3 })
export function getUpgrades() { try { const o = JSON.parse(get(K.up) || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; } }
export function setUpgrade(id, lvl) { const o = getUpgrades(); o[id] = Math.max(0, Math.min(3, lvl | 0)); set(K.up, JSON.stringify(o)); return o; }
