// =====================================================================
//  FRAKKERA RUN - configurazione di gioco
//  Tutti i valori di bilanciamento sono qui: modificali senza toccare
//  la logica. Le distanze sono in "pixel di gioco" (px) salvo dove
//  indicato; 1 metro = PX_PER_METER px.
// =====================================================================

export const GAME_VERSION = '0.7.0';

// ---- Punteggio --------------------------------------------------------
export const SCORE = {
  PER_METER: 10,            // punti per ogni metro percorso
  MATERIAL: 50,             // materiale raccolto (asfodelo o ferula)
  NEAR_MISS: 100,           // ostacolo evitato all'ultimo istante
  NEAR_MISS_WINDOW_S: 0.28, // "ultimo istante": l'ostacolo era a meno di X secondi
  NEAR_MISS_COOLDOWN_S: 1.2,// intervallo minimo tra due bonus "per un pelo"
  CHAIN_SIZE: 5,            // raccolte consecutive per il bonus catena
  CHAIN_BONUS: 250,         // bonus catena
  // Bonus traguardo (metri -> punti). Oltre l'ultimo, ogni REPEAT_EVERY m
  // si ottiene REPEAT_BONUS.
  MILESTONES: [
    { m: 100, bonus: 200 },
    { m: 250, bonus: 400 },
    { m: 500, bonus: 750 },
    { m: 1000, bonus: 1500 },
    { m: 1500, bonus: 2000 },
    { m: 2000, bonus: 2500 },
  ],
  MILESTONE_REPEAT_EVERY: 500,
  MILESTONE_REPEAT_BONUS: 3000,
  // v2
  CARPET: 20,               // punti per tappeto (i tappeti restano soprattutto MONETA, contati a parte)
  BARREL: 150,              // botte distrutta con la pistola
  BARREL_GROUP: 300,        // gruppo di botti distrutto con un colpo
  GOAT: 100,                // capra fatta scappare con un colpo (meno di una botte: i colpi sono 3 per pistola, nessun abuso)
  OBST_BIOME: 150,          // v5s6: botte che rotola verso di te, masso caduto, carrello, pietra bagnata (come una botte)
  SURVIVAL_EVERY_S: 30,     // ogni X secondi con la fiamma accesa...
  SURVIVAL_BONUS: 250,      // ...bonus sopravvivenza
  // tetto anti-exploit: punti bonus (tutto tranne i metri) per finestra di 10 s
  BONUS_CAP_PER_10S: 2500,
};

// ---- Tappeti "Sa Burra" (moneta, separata dal punteggio) ---------------
export const CARPETS = {
  STREAK_P_START: 0.20,     // probabilita' di iniziare una scia di tappeti per fila
  STREAK_P_END: 0.12,
  STREAK_MIN_ROWS: 3,
  STREAK_MAX_ROWS: 8,
  PER_ROW: 2,               // tappeti per fila dentro una scia
  OFFPATH_SHARE: 0.3,       // quota di scie fuori dal sentiero sicuro (piu' rischiose)
  GAP_ROWS: 2,              // file vuote minime tra due scie
};

// ---- Pistola Broccu (power-up raro) -----------------------------------
export const PISTOL = {
  AMMO: 3,                  // colpi per pistola
  FROM_M: 140,              // non compare prima di X metri
  MIN_GAP_M: 380,           // distanza minima tra due pistole
  P_PER_ROW: 0.03,          // probabilita' per fila quando e' disponibile
  MAX_PER_RUN: 6,           // tetto per partita
  FIRE_COOLDOWN_S: 0.32,
  SHOT_SPEED: 430,          // px/s in piu' rispetto alla corsa
  BARREL_BOOST_ROWS: 24,    // dopo una pistola compaiono piu' botti
};

export const PX_PER_METER = 10;

// ---- v5s18: giro in carrello nella galleria di Funtana Raminosa -------------------------------
// Ogni giro, nella galleria (mine-int) da FROM_M a FROM_M + LEN_M (metri locali): si sale su uno dei
// carrelli fermi (uno per binario), si corre sui binari piu' veloci; agli scambi uno o due binari
// sono interrotti (respingente / binario crollato): cambia binario con uno swipe. Poi si scende.
export const CART = {
  BIOME: 'mine-int',
  FROM_M: 30,
  LEN_M: 130,
  LEAD_M: 15,               // tratto libero prima della salita
  SPEED_K: 1.22,            // il carrello corre piu' veloce della corsa a piedi
  JUNCTION_ROWS: 7,         // file tra uno scambio e l'altro (~21 m)
  FIRST_M: 12,              // primo scambio dopo la salita
  END_FREE_M: 12,           // ultimo tratto libero prima della discesa
  P_TWO_BLOCKED: 0.6,       // probabilita' che due binari su tre siano interrotti
  PTS_JUNCTION: 60,
  HIT_SLOW: 0.78,           // v5s22: nel carrello l'urto frena meno (a piedi WORLD.HIT_SLOW)
  CUE_S: 2.6,               // v5s22: avviso (suono, vibrazione, segnali piu' grandi) X s prima dello scambio
};

// ---- v5s17: minatori di Funtana Raminosa e lampade a muro nella miniera (solo scena, non bloccano) ----
// Generati da un flusso RNG separato (deterministici); le lampade si accendono quando il giocatore
// arriva a LAMP_ON_PX di distanza (registrato nelle statistiche, la sim resta deterministica).
export const MINE = {
  MINER_X: 55,             // px dal centro: lungo la parete (TUNNEL.halfW = 6.8 m)
  LAMP_X: 60,
  LAMP_ON_PX: 140,         // ~14 m davanti al giocatore la lampada si accende
  BIOMES: { 'mine-ext': { miners: [14, 24], lamps: null }, 'mine-int': { miners: [9, 16], lamps: [6, 8] }, 'mine-blue': { miners: [11, 18], lamps: [7, 9] } },
  POSES: 4,                // piccone, pala, lanterna in mano, carrello/saluto
};

// ---- v5s16: frakkeras accese lungo il percorso (falo' e paesani con la frakkera) -------
// Stanno sul marciapiede, fuori dalle corsie: passandoci accanto nella corsia laterale
// (sfiorandole) la fiamma riprende fuoco. Generate da un flusso RNG separato (deterministico,
// non sposta ostacoli e materiali), registrate nel log ('F').
export const FIRE = {
  BONUS: 12,               // fuoco aggiunto (stesso ordine dell'asfodelo: 16)
  PTS: 30,                 // punti
  X: 62,                   // distanza dal centro strada (px): bordo del marciapiede
  BRUSH_PX: 14,            // il giocatore deve stare entro questa distanza dal centro della corsia laterale
  FROM_M: 20,              // non prima di questi metri
  // ambiente -> lati ammessi e passo (file) tra una frakkera e l'altra
  BIOMES: { village: { sides: [-1, 1], gap: [12, 20] }, rock: { sides: [-1, 1], gap: [22, 34] }, river: { sides: [-1], gap: [24, 36] } },
  VILLAGER_SHARE: 0.5,     // quota di paesani con la frakkera in braccio (il resto: falo' a terra)
};

// ---- Fiamma (combustibile 0..100) ------------------------------------
export const FUEL = {
  MAX: 100,
  START: 100,
  DRAIN_START: 3.4,   // unita/secondo a difficolta 0
  DRAIN_END: 7.0,     // unita/secondo a difficolta 1
  ASFODELO: 16,       // ricarica asfodelo
  FERULA: 28,         // ricarica ferula (piu' rara)
  HIT_SOLID: 30,      // urto contro muretto, carro, botte...
  HIT_PUDDLE: 14,     // pozzanghera
  HIT_GOAT: 22,       // capra o botte che rotola
  HIT_BEAM: 26,       // v5s6: trave bassa presa in pieno (non ti sei abbassato)
  LOW_WARNING: 25,    // sotto questa soglia l'indicatore lampeggia
};

// ---- Velocita e difficolta -------------------------------------------
export const DIFFICULTY = {
  RAMP_METERS: 2400,      // metri per arrivare a difficolta 1
  RAMP_EXP: 1.15,         // >1 = inizio piu' dolce
  SPEED_START: 82,        // px/s
  SPEED_END: 185,         // px/s a difficolta 1 (v5s6: piu' basso, il resto arriva dai gradini per ambiente)
  SPEED_OVERDRIVE: 0.012, // px/s guadagnati per ogni metro oltre la rampa
  SPEED_MAX: 240,
  OBSTACLE_P_START: 0.09, // probabilita di ostacolo per corsia libera per fila
  OBSTACLE_P_END: 0.40,
  PICKUP_P_START: 0.14,   // probabilita di materiale per fila
  PICKUP_P_END: 0.065,
  FERULA_SHARE: 0.22,     // quota di ferula tra i materiali
  PATH_CHANGE_P_START: 0.18,
  PATH_CHANGE_P_END: 0.42,
  GROUP_FROM: 0.10,       // difficolta minima per i gruppi di botti
  NARROW_FROM: 0.22,      // ... per i vicoli che si stringono
  MOVING_FROM: 0.18,      // ... per capre / botti che attraversano
  PUDDLE_FROM: 0.05,
};

// ---- Mondo ------------------------------------------------------------
export const WORLD = {
  LANES: 3,
  LANE_W: 34,
  ROW: 30,                 // distanza tra file del generatore (px)
  PLAYER_Y_RATIO: 0.76,    // posizione verticale del giocatore sullo schermo
  LANE_EASE: 26,           // cambio corsia morbido: avvicinamento esponenziale (1/s)
  LANE_SNAP_PX: 0.6,
  LEAD_IN: 320,            // px di strada libera all'inizio
  FIXED_DT: 1 / 120,       // passo fisso della simulazione (s)
  MAX_STEPS_PER_FRAME: 12,
  HIT_INVULN_S: 1.1,
  DYING_S: 0.9,            // animazione di spegnimento prima del game over
  HIT_SLOW: 0.55,          // moltiplicatore velocita subito dopo un urto
  HIT_RECOVER_S: 1.4,
  HIT_EASE_S: 0.22,        // v5s22: la frenata dopo un urto entra in X s (prima era istantanea)
  START_RAMP_S: 1.6,       // v5s22: partenza dolce: da START_K a piena velocita' in X s
  START_K: 0.5,
};

// ---- Classifica demo (locale) -----------------------------------------
export const DEMO_BOARD = {
  SIZE: 20,
  NICK_MIN: 3,
  NICK_MAX: 12,
};

// ---- v5s6: gradini di velocita' per ambiente --------------------------
// Ogni nuovo ambiente raggiunto (paese > roccia > fiume > viadotto > miniera...)
// aggiunge un gradino alla velocita' di base (sopra la rampa continua), con
// banner 'PIU' VELOCE!' e suono. Il tetto evita velocita' ingiocabili nei giri successivi.
export const SPEED_STEPS = {
  PER_STEP: 4,             // px/s per ogni ambiente nuovo
  CAP_STEPS: 10,           // al massimo 10 gradini (+40 px/s), poi resta la rampa
  BANNER: 'PI\u00d9 VELOCE!',
};

// ---- v5s6: ostacoli tipici di ogni ambiente (tutti distruttibili con la pistola) ----
export const BIOME_OBST = {
  FROM: 0.03,              // difficolta' minima
  P_START: 0.05,           // probabilita' per fila (dove possibile)
  P_END: 0.11,
  MIN_GAP_ROWS: 7,         // file minime tra due ostacoli d'ambiente
  ROLL_K: 0.42,            // botte/carrello verso il giocatore: velocita' = ROLL_K * corsa
  ROLL_ROWS: 6,            // file di corsia riservate alla rotolata (dietro il punto di partenza)
  ROCK_LEAD_S: 0.85,       // il masso cade quando mancano X secondi (ombra visibile prima)
  WET_SLIP_S: 0.9,         // pietra bagnata: per X secondi il cambio corsia e' lento
  WET_EASE: 8,             // ... con questa morbidezza (normale: WORLD.LANE_EASE = 26)
};

// ---- v5s6: travi basse da passare abbassandosi (swipe giu' / freccia giu' / S) ----
export const DUCK = {
  TIME_S: 0.62,            // durata dell'abbassata
  COOLDOWN_S: 0.08,
  BEAM_FROM: 0.04,         // difficolta' minima per le travi
  BEAM_P_START: 0.035,
  BEAM_P_END: 0.07,
  BEAM_MIN_GAP_ROWS: 12,
  BEAM_LEN: 10,            // px di profondita' della trave
};

// ---- v5s10: maschere del carnevale di Gadoni (Giobia Lardaiolu) nel paese ----
// Un corteo = su Maimoni (carica a zig-zag tra le corsie, campanacci come avviso), due Stramaionis
// con la fune tesa su 2 corsie (ci si abbassa) e sa Grastula a bordo strada che lancia il fuso
// (segno a terra prima). Non si possono colpire con la pistola. Passato tutto il corteo: BRAVU!
export const MASKS = {
  FROM_M: 90,              // non prima di X metri di corsa
  P_LAP: [0.05, 0.09, 0.13, 0.16], // probabilita' per fila nel paese, per giro (poi l'ultimo)
  MIN_GAP_ROWS: 30,        // file minime tra due cortei
  MAIMONI_VX: [26, 40],    // velocita' laterale (px/s) da diff 0 a 1
  FUNE_GAP_ROWS: 3,        // file tra Maimoni (fine finestra calma) e la fune
  FUSO_GAP_ROWS: 3,        // file tra la fune e il fuso
  FUSO_WARN_S: 1.9,        // il segno a terra compare X s prima
  FUSO_THROW_S: 0.95,      // il fuso arriva a terra X s prima del passaggio (~1 s dopo il segno)
  BELL_AHEAD: 140,         // px oltre MOVE_AHEAD a cui si sentono i campanacci
  BONUS: 200,              // corteo intero passato senza urti
  HIT_MAIMONI: 24, HIT_FUNE: 16, HIT_FUSO: 14,  // carburante perso
};

// ---- v5s11: ballu tundu nella piazza della chiesa (una volta per giro, facoltativo: SALTA) ----
export const DANCE = {
  AT_M: 150,               // metri dentro il paese (piazza della chiesa) a cui parte il ballo
  CUE_S: 1.9,              // distanza del cue = X s a piena velocita' (rallentando diventano ~2.5-3 s)
  CUE_SLOW: 0.45,          // velocita' minima mentre ci si avvicina al cerchio
  INTRO_S: 2.0,            // entrata nel cerchio + battute di attacco
  ROUNDS: 2, ROUND_S: 9,   // giri di ballo (8-10 s ciascuno)
  ROUND_GAP_S: 1.4,
  BPM0: 96, BPM_LAP: 10, BPM_MAX: 150, ROUND2_K: 1.08,   // il tempo sale a ogni giro della corsa
  LEAD_S: 1.6,             // anticipo con cui le frecce scorrono
  PERFECT_S: 0.075, GOOD_S: 0.16, WINDOW_S: 0.24,
  PTS_PERFECT: 40, PTS_GOOD: 20, COMBO_K: 0.05, COMBO_MAX: 20, COMBO_BONUS: 10,
  FUEL_PERFECT: 1.2, FUEL_GOOD: 0.6, FUEL_WIN: 12,   // la fiamma cresce ballando
  CARPET_EVERY: 6, CARPET_MAX: 3,                    // un tappeto ogni X Perfetto
  WIN_RATIO: 0.5,          // sotto questa quota di colpi: niente bonus e un po' di carburante perso
  FAIL_FUEL: 6,
  OUT_S: 1.2,
};

// ---- v5s7: 'Garag di Pinu' (negozio a ogni ritorno al paese, pagato in tappeti Sa Burra) ----
// Ogni volta che il giro torna al paese (dopo la galleria blu, ~1600 m, e ogni giro dopo) compare
// per OFFER_S secondi il pulsante 'Entra da Pinu?'. Entrando la corsa si ferma (sim congelata,
// registrata nel log), gli acquisti passano dalla sim e dal log (convalida futura sul server).
export const SHOP = {
  NAME: 'Garag di Pinu',
  OFFER_AT_M: 6,           // metri dentro il paese a cui compare l'offerta
  OFFER_S: 5,              // secondi (di corsa) per decidere
  MAX_PER_VISIT: 3,        // acquisti al massimo per visita
  AMMO_CAP: 9,
  ITEMS: [
    { id: 'pistola', name: 'Pistola Broccu', desc: '3 colpi (o +3 se ce l\'hai gi\u00e0)', price: 40, max: 1 },
    { id: 'asfodelo', name: 'Fascio di asfodelo', desc: 'Fiamma piena', price: 20, max: 2 },
    { id: 'scudo', name: 'Scudo di sughero', desc: 'Para il prossimo urto', price: 35, max: 1 },
  ],
};

// v5s19: oggetti rari da collezione (campanacci e facciole) e costumi sbloccabili
export const COLLECT = {
  FROM_M: 60,               // niente collezionabili nei primi metri
  GAP_ROWS: [38, 70],       // file tra un collezionabile e l'altro (flusso RNG separato)
  P_FACCIOLA: 0.5,          // quota di facciole (il resto campanacci)
  PTS: 40,
  KINDS: { campanaccio: 'bell', facciola: 'sweet' },
};
export const SKINS = [
  { id: 'base', name: 'IL PORTATORE', desc: 'Il portatore della frakkera, vestito della festa.', cost: { bell: 0, sweet: 0 }, speedK: 1 },
  { id: 'stramaioni', name: 'SU STRAMAIONI', desc: 'Viso nero di fuliggine e mantello scuro di orbace. Corre piu veloce (+8%).', cost: { bell: 5, sweet: 5 }, speedK: 1.08 },
];

// v5s21: festa a Gadoni: tratto del paese in festa (bancarelle, festoni e luci, launeddas, folla che applaude)
export const FESTA = {
  BIOME: 'village',
  FROM_M: 30, TO_M: 128,    // metri dentro il paese (dopo l'offerta del Garag, prima del ballu tundu)
  X: 66,                    // bancarelle e folla sul marciapiede (px dal centro strada)
  STALL_GAP: [4, 6],        // file tra due bancarelle sullo stesso lato
  CROWD_GAP: [3, 5],        // file tra due gruppi di folla
  FESTOON_ROWS: 4,          // un festone con le luci ogni X file
  BRUSH_PX: 14,             // passando nella corsia laterale vicino alla folla: applauso
  PTS: 20,
  STREAK: 6,                // ogni X tappeti di fila nella festa: la folla esulta
};
