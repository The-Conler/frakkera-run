// v5s19: collezionabili rari: campanaccio (bronzo, con battaglio e cinghia di cuoio) e facciola
// (dolce fritto: ciambella dorata intrecciata con zucchero). Kit a colori per vertice (mats2).
// Piu' l'abito di su Stramaioni da agganciare alle ossa del portatore (cappuccio, mantello, viso).
import { Kit, G, rng } from './kit.js';

const cache = {};
export function bellGeom() {
  return cache.bell || (cache.bell = (() => {
    const k = new Kit(191);
    k.add(G.cyl(0.36, 0.58, 0.95, 10), '#a87b34', { y: 0, flat: true, vary: 0.12 });
    k.add(G.cyl(0.6, 0.6, 0.08, 10), '#7a5a26', { y: -0.48 });
    k.add(G.cyl(0.37, 0.37, 0.06, 10), '#c79a4a', { y: 0.47 });
    k.add(G.torus(0.2, 0.05, 6, 12), '#5c3e1e', { y: 0.62 });
    k.add(G.sph(0.12, 8, 6), '#3a2a18', { y: -0.58 });
    k.add(G.box(0.12, 0.9, 0.06), '#6b4423', { y: 1.0 });
    return k.build({ ao: 0.1 });
  })());
}
export function sweetGeom() {
  return cache.sweet || (cache.sweet = (() => {
    const k = new Kit(192); const r = rng(192);
    k.add(G.torus(0.48, 0.2, 8, 18), '#d69a3e', { rx: Math.PI / 2, flat: true, vary: 0.1 });
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; k.add(G.ico(0.13, 0), i % 2 ? '#b8792c' : '#e3ae52', { x: Math.cos(a) * 0.48, y: 0.12, z: Math.sin(a) * 0.48, flat: true }); }
    for (let i = 0; i < 26; i++) { const a = r.range(0, 6.28), d = r.range(0.32, 0.64); k.add(G.box(0.05, 0.05, 0.05), '#fbf6ea', { x: Math.cos(a) * d, y: 0.24, z: Math.sin(a) * d }); }
    return k.build({ ao: 0.08 });
  })());
}
// abito di su Stramaioni (unita' locali dell'osso, scalate dal chiamante)
export function stramaHoodGeom() {
  return cache.hood || (cache.hood = (() => {
    const k = new Kit(193);
    k.add(G.cone(0.17, 0.36, 9), '#1c1916', { y: 0.2, z: -0.03, flat: true, vary: 0.1 });
    k.add(G.cyl(0.16, 0.17, 0.2, 9), '#1c1916', { y: 0.02, flat: true, vary: 0.1 });
    return k.build({ ao: 0.12 });
  })());
}
export function stramaCloakGeom() {
  return cache.cloak || (cache.cloak = (() => {
    const k = new Kit(194); const r = rng(194);
    k.add(G.cyl(0.2, 0.36, 0.78, 10), '#1e1b17', { y: -0.28, flat: true, vary: 0.1 });
    for (let i = 0; i < 14; i++) { const a = r.range(0, 6.28); k.add(G.box(r.range(0.07, 0.13), r.range(0.12, 0.22), 0.03), r.pick(['#171411', '#2a251f', '#1e1a16']), { x: Math.cos(a) * 0.34, y: -0.7, z: Math.sin(a) * 0.32, ry: -a, vary: 0.2 }); }
    k.add(G.cyl(0.05, 0.075, 0.12, 6), '#8a6a2e', { x: 0.12, y: -0.25, z: 0.3, flat: true });   // campanaccio a tracolla
    return k.build({ ao: 0.12 });
  })());
}
