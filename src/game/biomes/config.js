// =====================================================================
//  FRAKKERA RUN - AMBIENTI DI GADONI (configurazione dei biomi)
//  Ogni ambiente e' un blocco di configurazione: distanze, terreno,
//  architettura/vegetazione (costruttori in ./builders), aspetto degli
//  ostacoli, luce e nebbia, decorazioni, audio, regole di transizione.
//  SOLO GRAFICA: la simulazione (sim.js), il generatore, il punteggio
//  e il registro della partita non leggono mai questo file.
//  Per aggiungere un luogo: un nuovo blocco in BIOMES + i suoi costruttori.
// =====================================================================

// distanze in metri dall'inizio della partita (1 m = 1 unita' 3D)
export const BIOMES = [
  {
    id: 'village', name: 'Gadoni - paese e piazza della chiesa', from: 0, to: 250,
    ground: { road: 'cobble', shoulder: 'walk', curb: true, terrain: '#7d8a4e', terrainY: -0.06 },
    sides: 'houses',            // architettura ai lati (env.js -> sidePiece, case da models.js)
    gaps: { right: [[140, 252]], left: [[0, 98], [150, 176], [186, 252]] },   // v5s43: il vuoto sinistro parte da 0 m, cosi' la casa a ~13-18 m non copre Santa Marta all'uscita della miniera
    landmarks: ['church', 'vicolo', 'cappella', 'farVillage', 'santamarta'],   // v5 stage 24: Santa Marta attraversata dopo la cappella
    skins: { botte: 'barrel', botti: 'barrels', bottecoricata: 'barrelLying', rollbarrel: 'barrel', muretto: 'wall', goat: 'goat', pozza: 'puddle', narrow: 'house', rollin: 'rollBarrel', trave: 'beamVillage' },
    decor: { banners: true, bulbs: true, lanterns: true },
    // tramonto dorato-rosa (target2-villaggio); nebbia piu' lontana perche' il campanile si veda dal fondo della via
    mood: { top: '#6a78c4', mid: '#f7a070', hor: '#ffc870', fog: '#f8c590', hemiS: '#ffd8a0', hemiG: '#7a5c48', hemiI: 1.4, dirC: '#ffb860', dirI: 2.6, moon: 0, sun: 1.2, far: '#ffe2c8', fogNear: 60, fogFar: 240 },
    nightStart: [75, 135],      // v5s37: sera di Natale alla partenza (campanile con le luci e Su Nascimentu), poi torna il tramonto
    moodEnd: { top: '#5257a8', mid: '#ee8c70', hor: '#ffb874', fog: '#f1ae88', hemiI: 1.22, dirI: 2.0 }, // verso sera a fine paese
    light: { flameDist: 11, flameK: 1, mineral: 0, lamp: 0, darkByFuel: 0, tunnel: 0, exposure: 1.05, camLook: 1.0, camFov: 4 },
    ambience: { wind: 0.06, water: 0, drips: 0, birds: 0.3, bells: 1, cave: 0 },
    transitionOut: 30,          // metri di dissolvenza di luce/nebbia verso il bioma successivo
  },
  {
    id: 'rock', name: 'La roccia (Su Pranu / guglia)', from: 250, to: 500,
    ground: { road: 'trail', shoulder: 'grassEdge', curb: false, terrain: '#6e7a3e', terrainY: -0.06, left: 'drop' },
    sides: 'mountain',
    landmarks: ['pinnacle', 'valley'],
    skins: { botte: 'boulder', botti: 'boulders', bottecoricata: 'log', rollbarrel: 'log', muretto: 'wall', goat: 'goat', pozza: 'puddle', narrow: 'outcrop', sasso: 'fallRock', trave: 'beamTrunk' },
    decor: { banners: false, bulbs: false, lanterns: false },
    mood: { top: '#5d86cf', mid: '#a9c2e0', hor: '#f7d7a8', fog: '#a9c0d6', hemiS: '#eef4ff', hemiG: '#4f5f32', hemiI: 1.15, dirC: '#fff0d0', dirI: 1.9, moon: 0, sun: 0.9, far: '#ffffff', fogNear: 120, fogFar: 650 },
    light: { flameDist: 11, flameK: 1, mineral: 0, lamp: 0, darkByFuel: 0, tunnel: 0, exposure: 1.05, camLook: 1.2, camFov: 6 },
    ambience: { wind: 0.16, water: 0, drips: 0, birds: 0.5, bells: 0, cave: 0 },
    transitionOut: 35,
  },
  {
    id: 'river', name: 'Il fiume e la piscina naturale', from: 500, to: 750,
    ground: { road: 'earthTrail', shoulder: 'earthEdge', curb: false, terrain: '#4f6e2e', terrainY: -0.06, right: 'water', mirrorWater: true },   // v5s32: terra battuta (target)
    sides: 'river',
    landmarks: ['pool'],
    skins: { botte: 'mossBoulder', botti: 'mossBoulders', bottecoricata: 'log', rollbarrel: 'log', muretto: 'mossWall', goat: 'goat', pozza: 'puddle', narrow: 'mossOutcrop', bagnato: 'wetStone', trave: 'beamTrunkMoss' },
    decor: { banners: false, bulbs: false, lanterns: false },
    // v5s32 (target): tramonto - cielo blu-viola, lilla, pesca all'orizzonte; sole basso dietro a sinistra; foschia calda
    mood: { top: '#3a4a9c', mid: '#b08ac0', hor: '#ffb070', fog: '#c89a8e', hemiS: '#ffe8d8', hemiG: '#3a3644', hemiI: 1.3, dirC: '#ffd8b0', dirI: 3.0, moon: 0, sun: 1.6, far: '#d8a8a0', fogNear: 60, fogFar: 380 },
    light: { flameDist: 13, flameK: 1.15, mineral: 0, lamp: 0, darkByFuel: 0, tunnel: 0, exposure: 1.2, camLook: 0.2, camFov: 5, camYaw: 0.9, sunDX: -30, sunDY: -22, sunDZ: -45, glowX: -88, glowY: 30, skySunX: -0.3 },  // v5s28: fiume a sinistra e parete a destra entrambi in quadro; v5s6: inquadratura girata verso la piscina (target3-cascata)
    ambience: { wind: 0.04, water: 0.22, drips: 0, birds: 0.7, bells: 0, cave: 0 },
    transitionOut: 35,
  },
  {
    id: 'viaduct', name: 'Il viadotto di Gadoni', from: 750, to: 1000,
    ground: { road: 'trail', shoulder: 'drystone', curb: false, terrain: '#6b6a3c', terrainY: -0.06, right: 'river' },
    sides: 'valley',
    landmarks: ['viaduct', 'valleyRiver'],
    skins: { botte: 'crate', botti: 'crates', bottecoricata: 'barrelLying', rollbarrel: 'barrel', muretto: 'wall', goat: 'goat', pozza: 'puddle', narrow: 'outcrop', trave: 'beamTimber' },   // v5s41: sul viadotto niente tronchi caduti (botte coricata, botte che rotola, trave di cantiere)
    decor: { banners: false, bulbs: false, lanterns: false },
    mood: { top: '#3d5fae', mid: '#f0956a', hor: '#ffc66e', fog: '#e7a982', hemiS: '#ffdcae', hemiG: '#5e4c3a', hemiI: 1.25, dirC: '#ffbf78', dirI: 2.3, moon: 0, sun: 1.25, far: '#ffd9b8', fogNear: 70, fogFar: 340 },
    light: { flameDist: 12, flameK: 1, mineral: 0, lamp: 0, darkByFuel: 0, tunnel: 0, exposure: 1.05, camLook: 1.2, camFov: 6 },
    ambience: { wind: 0.14, water: 0.12, drips: 0, birds: 0.25, bells: 0, cave: 0 },
    transitionOut: 30,
  },
  {
    id: 'mine-ext', name: 'Miniera Fenice - piazzale e ingresso', from: 1000, to: 1150,
    ground: { road: 'gravel', shoulder: 'gravelEdge', curb: false, terrain: '#8a857c', terrainY: -0.04, rails: true },
    sides: 'mineYard',
    gaps: { left: [[126, 150]], right: [[126, 150]] },   // piazzale davanti al portale
    landmarks: ['minePortal'],
    skins: { botte: 'drum', botti: 'oreCart', bottecoricata: 'timbers', rollbarrel: 'drum', muretto: 'wall', goat: 'goat', pozza: 'puddle', narrow: 'outcrop', rollin: 'cart', trave: 'beamTimber' },
    decor: { banners: false, bulbs: false, lanterns: true },
    mood: { top: '#3a4f8c', mid: '#b98a7c', hor: '#e8b48a', fog: '#a3948a', hemiS: '#eee0cc', hemiG: '#5a4c40', hemiI: 1.35, dirC: '#ffc89a', dirI: 1.6, moon: 0.3, sun: 0.6, far: '#d8c8c0', fogNear: 34, fogFar: 190 },   // v5s9: piu' leggibile
    light: { flameDist: 13, flameK: 1.15, mineral: 0, lamp: 0.75, darkByFuel: 0, tunnel: 0, exposure: 1.12, camLook: 0.8, camFov: 4 },
    ambience: { wind: 0.12, water: 0, drips: 0, birds: 0.1, bells: 0, cave: 0 },
    transitionOut: 14,          // si entra nel tunnel: passaggio rapido
  },
  {
    id: 'mine-int', name: 'Miniera Fenice - galleria', from: 1150, to: 1350,
    ground: { road: 'mineFloor', shoulder: 'none', curb: false, terrain: null, rails: true },
    sides: 'tunnel', tunnel: 'rock',
    landmarks: [],
    skins: { botte: 'cart', botti: 'oreCart', bottecoricata: 'timbers', rollbarrel: 'drum', muretto: 'rubble', goat: 'trolley', pozza: 'darkPuddle', narrow: 'tunnelRock', rollin: 'cart', trave: 'beamTimber' },
    decor: { banners: false, bulbs: false, lanterns: false, mineLamps: 12 },
    // luce ambientale quasi nulla: illumina la frakkera; il buio cresce quando la frakkera si consuma
    mood: { top: '#05060a', mid: '#05060a', hor: '#0a0c10', fog: '#0a1012', hemiS: '#c8c0b0', hemiG: '#3a2c20', hemiI: 1.05, dirC: '#ffb070', dirI: 0.35, moon: 0, sun: 0, far: '#000000', fogNear: 12, fogFar: 115 },   // v5s9: fondo di visibilita' piu' alto, riempimento caldo
    light: { flameDist: 26, flameK: 2.0, mineral: 0, lamp: 1.4, darkByFuel: 0.8, tunnel: 1, exposure: 1.32, camLook: 0, camFov: 0 },
    ambience: { wind: 0, water: 0, drips: 0.8, birds: 0, bells: 0, cave: 1 },
    transitionOut: 25,
  },
  {
    id: 'mine-blue', name: 'Miniera Fenice - galleria blu', from: 1350, to: 1600,
    ground: { road: 'blueFloor', shoulder: 'none', curb: false, terrain: null, rails: true },   // v5s34: pavimento asciutto (niente pozze lucide in galleria)
    sides: 'tunnel', tunnel: 'blue',
    landmarks: ['mineExit'],
    skins: { botte: 'barrel', botti: 'oreCart', bottecoricata: 'timbers', rollbarrel: 'barrel', muretto: 'rubbleBlue', goat: 'trolley', pozza: 'bluePuddle', narrow: 'tunnelBlue', rollin: 'oreCart', trave: 'beamTimber' },
    decor: { banners: false, bulbs: false, lanterns: false, mineLamps: 12, motes: true },
    // le pareti minerali hanno luce propria (non dipende dalla frakkera)
    // riempimento blu forte (luce di contorno blu su personaggio e frakkera), nebbia blu in profondita'
    mood: { top: '#05060a', mid: '#05060a', hor: '#0a0c18', fog: '#030820', hemiS: '#5a80ff', hemiG: '#2a2440', hemiI: 0.95, dirC: '#7a9cff', dirI: 0.9, moon: 0, sun: 0, far: '#000000', fogNear: 16, fogFar: 135 },   // v5s9: piu' leggibile
    light: { flameDist: 22, flameK: 1.4, mineral: 1, lamp: 1.05, darkByFuel: 0.35, tunnel: 1, exposure: 1.35, camLook: 0, camFov: 0 },
    ambience: { wind: 0, water: 0, drips: 0.5, birds: 0, bells: 0, cave: 1 },   // v5s34: niente scroscio d'acqua in galleria
    transitionOut: 16,          // uscita dalla miniera: di nuovo all'aperto
  },
];

// dopo l'ultimo ambiente il viaggio ricomincia dal paese (giro 2, 3...):
// stessi luoghi con variazioni (seme diverso) e luce che scende verso la sera/notte.
export const CYCLE = BIOMES[BIOMES.length - 1].to;
export const LAP_NIGHT = [0, 0.55, 0.85, 1];     // quota di "sera" per giro
export const NIGHT_MOOD = { top: '#141a46', mid: '#3a3474', hor: '#8a5a7a', fog: '#4a4068', hemiS: '#9b95da', hemiG: '#2e2638', hemiI: 0.75, dirC: '#ff9b70', dirI: 0.6, moon: 1, sun: 0.05, far: '#8a80b8' };
// schermata del menu (paese al crepuscolo) e del game over: come in v4
export const MENU_MOOD = { top: '#2a2c6e', mid: '#7a5aa8', hor: '#f39a7c', fog: '#b57c98', hemiS: '#c7b4ff', hemiG: '#6a4a58', hemiI: 1.15, dirC: '#ffb784', dirI: 1.5, moon: 1, sun: 0.35, far: '#c9b6ea', fogNear: 30, fogFar: 150 };
export const OVER_TINT = { k: 0.55, mood: { top: '#161a46', mid: '#43357a', hor: '#9a5d7f', fog: '#5a476e', hemiS: '#9b95da', hemiG: '#3a2a3e', hemiI: 0.8, dirC: '#ff9b70', dirI: 0.55, moon: 1, sun: 0.1, far: '#8a80b8', fogNear: 18, fogFar: 110 } };

export const BIOME_IDS = BIOMES.map((b) => b.id);
export const byId = Object.fromEntries(BIOMES.map((b) => [b.id, b]));

// bioma alla distanza d (m): { b, lap, local, index }
export function biomeAt(d) {
  if (d < 0) return { b: BIOMES[0], lap: 0, local: d, index: 0 };
  const lap = Math.floor(d / CYCLE);
  const x = d - lap * CYCLE;
  for (let i = 0; i < BIOMES.length; i++) {
    const b = BIOMES[i];
    if (x < b.to) return { b, lap, local: x - b.from, index: i };
  }
  return { b: BIOMES[0], lap: lap + 1, local: 0, index: 0 };
}
// prossimo confine (distanza assoluta) dopo d
export function nextBoundary(d) {
  const lap = Math.floor(Math.max(0, d) / CYCLE);
  const x = Math.max(0, d) - lap * CYCLE;
  for (const b of BIOMES) if (b.to > x + 1e-6) return lap * CYCLE + b.to;
  return (lap + 1) * CYCLE;
}

// modalita' sviluppatore: ?map=village|rock|river|viaduct|mine-ext|mine-int|mine-blue
export function mapFromURL(search = (typeof location !== 'undefined' ? location.search : '')) {
  const q = new URLSearchParams(search).get('map');
  if (!q) return null;
  const b = byId[q] || BIOMES.find((x) => x.id.replace('-', '') === q.replace('-', ''));
  return b || null;
}
