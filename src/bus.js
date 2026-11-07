// Bus eventi tra gioco (WebGL) e interfaccia HTML: emettitore minimo, senza dipendenze.
class Emitter {
  constructor() { this.m = new Map(); }
  on(ev, fn) { if (!this.m.has(ev)) this.m.set(ev, []); this.m.get(ev).push(fn); return this; }
  once(ev, fn) { const w = (...a) => { this.off(ev, w); fn(...a); }; return this.on(ev, w); }
  off(ev, fn) { const l = this.m.get(ev); if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } return this; }
  emit(ev, ...a) { const l = this.m.get(ev); if (l) for (const fn of l.slice()) fn(...a); return this; }
}
export const bus = new Emitter();
