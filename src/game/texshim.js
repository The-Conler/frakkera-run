// Contenitore di texture compatibile con le API usate da art/textures.js
// (scene.textures.createCanvas / exists / remove / get): permette di
// riusare ESATTAMENTE le funzioni di disegno pixel art senza Phaser.
export function makeTexStore() {
  const map = new Map();
  const textures = {
    exists: (k) => map.has(k),
    remove: (k) => map.delete(k),
    get: (k) => map.get(k),
    createCanvas(key, w, h) {
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const t = {
        key, canvas, frames: [],
        getContext: () => ctx,
        getSourceImage: () => canvas,
        add(i, src, x, y, fw, fh) { t.frames[i] = { x, y, w: fw, h: fh }; },
        refresh() {},
      };
      map.set(key, t);
      return t;
    },
  };
  return { textures };
}
