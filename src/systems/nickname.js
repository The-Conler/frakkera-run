// Validazione nickname + filtro parole offensive di base (IT / sardo / EN).
// Non e' un filtro perfetto: in Fase 3 la moderazione finale avverra'
// lato server e dal pannello admin.
import { DEMO_BOARD } from '../config.js';

const BLOCK = [
  'cazz', 'minchi', 'merd', 'stronz', 'troi', 'puttan', 'zoccol', 'vaffanc', 'fancul',
  'culo', 'figa', 'fica', 'cogli', 'bastard', 'porcod', 'diocan', 'dioporc', 'porcamadonn',
  'madonnaputt', 'dioboia', 'negr', 'frocio', 'froci', 'ricchion', 'finocch', 'mongol',
  'ritardat', 'handicap', 'nazist', 'hitler', 'sieg', 'cunnu', 'bagass', 'caddoz',
  'fuck', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'nigg', 'fag', 'whore', 'slut', 'porn',
  'sesso', 'sex', 'vagin', 'tette', 'pompin', 'segaiol', 'suca', 'sborr',
];

// normalizza leetspeak e ripetizioni: "C4ZZZ0" -> "cazo" (+ varianti)
function normalize(s) {
  return s.toLowerCase()
    .replace(/[4@]/g, 'a').replace(/3/g, 'e').replace(/[1!|]/g, 'i')
    .replace(/0/g, 'o').replace(/[5$]/g, 's').replace(/7/g, 't').replace(/8/g, 'b')
    .replace(/k/g, 'c').replace(/[^a-z]/g, '');
}
const dedupe = (s) => s.replace(/(.)\1+/g, '$1');

export function cleanNick(raw) {
  return String(raw || '').toUpperCase().replace(/[^A-Z0-9 _-]/g, '').replace(/\s+/g, ' ').trim()
    .slice(0, DEMO_BOARD.NICK_MAX);
}

// ritorna { ok, nick, error }
export function validateNick(raw) {
  const nick = cleanNick(raw);
  if (nick.length < DEMO_BOARD.NICK_MIN) {
    return { ok: false, nick, error: `Almeno ${DEMO_BOARD.NICK_MIN} caratteri (lettere, numeri, - _)` };
  }
  const n = normalize(nick);
  const d = dedupe(n);
  const bad = BLOCK.some((w) => n.includes(w) || d.includes(dedupe(w)));
  if (bad) return { ok: false, nick, error: 'Nickname non ammesso, scegline un altro' };
  return { ok: true, nick, error: '' };
}
