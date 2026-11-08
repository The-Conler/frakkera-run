// Un solo KTX2Loader per tutti i GLB (Santa Marta, ballerini, …):
// più istanze attive fanno comparire l'avviso di Three.js e sprecano il transcoder Basis.
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

const BASE = (import.meta.env && import.meta.env.BASE_URL) || './';
let ktx = null;

export function sharedKTX2Loader(renderer) {
  if (!ktx) ktx = new KTX2Loader().setTranscoderPath(`${BASE}basis/`).detectSupport(renderer);
  return ktx;
}
