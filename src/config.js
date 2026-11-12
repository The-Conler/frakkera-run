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
  GRACE_S: 2.6,             // v5s45: almeno ~2.5 s di corsa in carrello prima del primo scambio
  EXIT_GRACE_M: 16,         // v5s45: tratto libero anche dopo la discesa dal carrello
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
  BIOMES: { village: { sides: [1], gap: [12, 20] } },   // v5s45 (16b): niente frakkere accese/portatori sul lato SINISTRO del paese   // v5s34: solo in paese (nella natura niente frakkere a bordo strada)
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
  RAMP_METERS: 1400,      // metri per arrivare a difficolta 1 (dentro il giro 1, non a meta' del giro 2)
  RAMP_EXP: 0.70,         // <1 = sale prima: gia' nel paese si corre piu' forte
  SPEED_START: 98,        // px/s (prima 82)
  SPEED_END: 188,         // px/s a difficolta 1; i gradini per ambiente e l'overdrive continuano a far salire
  SPEED_OVERDRIVE: 0.014, // px/s guadagnati per ogni metro oltre la rampa
  SPEED_MAX: 240,
  OBSTACLE_P_START: 0.18, // probabilita di ostacolo per corsia libera per fila (prima 0.09)
  OBSTACLE_P_END: 0.55,   // prima 0.40. PACE (in secondi) scarta i tentativi troppo vicini
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
// Ogni giro successivo e' un po' piu' fitto del precedente (il giro 3 si sente piu' del giro 1).
// Moltiplica solo la probabilita': il tempo di reazione resta quello di PACE.
export const LAP_HEAT = [1, 1.2, 1.38];
export function lapHeat(lap) {
  const i = Math.max(0, lap | 0);
  return LAP_HEAT[Math.min(LAP_HEAT.length - 1, i)];
}

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
  DYING_S: 0.9,            // spegnimento senza urto (carburante finito)
  SLOW_S: 1.15,            // rallenty dopo un urto, cosi' si vede cosa ti ha preso
  SLOW_K: 0.2,             // quota della velocita' durante il rallenty
  HIT_SLOW: 0.55,          // moltiplicatore velocita subito dopo un urto
  HIT_RECOVER_S: 1.55,     // v5s46 (104): 1.4 -> 1.55 con una breve tenuta in basso
  HIT_HOLD_S: 0.25,        // v5s46 (104): dopo l'urto si resta lenti un attimo (si riprende il controllo), poi si riparte
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

// ---- v5s34: zona 3 (dal terzo giro): velocita' frenata e ritmo leggibile ------
// Dal terzo giro la velocita' scende dolcemente sotto un tetto e cresce appena;
// tra due "file di ostacoli" (cio' che obbliga a cambiare corsia, abbassarsi o saltare)
// passa almeno MIN_GAP_S secondi; meno ostacoli per fila; se il sentiero sicuro e'
// su una corsia esterna al massimo un'altra corsia bloccata (niente doppio scarto).
// I giri 1 e 2 restano identici (stesse file, stessa velocita').
// ---- v5s34: meno alberi caduti nella natura (roccia, fiume, viadotto) ----
export const NATURE_TREES = {
  BIOMES: ['rock', 'river', 'viaduct'],
  BEAM_K: 0.5,             // tronchi da passare abbassandosi: meta' probabilita'
  BRANCH_K: 0.45,          // rami caduti
  LOG_SHARE: 0.07,         // tronco a terra tra gli ostacoli corti (prima 0.2; il resto diventa masso)
  ROLL_LOG_SHARE: 0.22,    // tronco che rotola tra gli ostacoli mobili (prima 0.45; il resto capre)
};

export const ZONE3 = {
  FROM_LAP: 2,             // giro (da 0) da cui vale: il terzo
  SPEED_CAP: 226,          // sopra la velocita' media del giro 1, sotto il tetto assoluto
  SPEED_GROW: 0.003,       // px/s per metro oltre l'inizio della zona
  SPEED_CAP_MAX: 234,
  EASE_M: 150,             // metri di frenata dolce all'ingresso
  MIN_GAP_S: 0.7,          // secondi minimi tra due azioni obbligate
  OBST_K: 1.4,             // probabilita' degli ostacoli corti
  LONG_K: 1.2,             // vicoli e gruppi di botti
  BEAM_GAP_K: 1.35,        // travi piu' distanziate
  BIOME_GAP_K: 1.4,        // ostacoli d'ambiente piu' distanziati
};

// ---- v5s6: ostacoli tipici di ogni ambiente (tutti distruttibili con la pistola) ----
export const BIOME_OBST = {
  FROM: 0.03,              // difficolta' minima
  P_START: 0.07,           // probabilita' per fila (dove possibile) (prima 0.05)
  P_END: 0.15,
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
  BUFFER_S: 0.45,          // un secondo swipe giu' durante l'abbassata o in aria non si perde
  BEAM_FROM: 0.04,         // difficolta' minima per le travi
  BEAM_P_START: 0.05,      // prima 0.035
  BEAM_P_END: 0.10,        // prima 0.07; il minimo in secondi resta PACE.SAME_S
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
  FUNE_CLEAR_PX: 4,        // v5s44c: corda bassa (~0.5 m); un salto normale (1.5 m) la supera a ogni velocita'
  HIT_MAIMONI: 24, HIT_FUNE: 16, HIT_FUSO: 14,  // carburante perso
};

// ---- v5s11: ballu tundu nella piazza della chiesa (facoltativo: SALTA) ----
// Giri visti dal giocatore: 1, 2, 3... (in codice `lap` parte da 0).
// Il ballo c'e' solo nei giri pari, dal secondo: 2, 4, 6... mai al giro 1 ne' nei dispari.
export function danceThisLap(lap) { return lap >= 1 && lap % 2 === 1; }
export const DANCE = {
  AT_M: 84,                // v5s45 (19): subito dopo la vista di Su Nascimentu e della chiesa (VISTA.AT_M 58); prima 150
  CLEAR_BEFORE_M: 26, CLEAR_AFTER_M: 18,   // v5s45: niente ostacoli/pickup dentro e davanti al cerchio
  VIS_M: 110,              // v5s44c: il cerchio si vede da lontano (solo grafica; il cue/gameplay resta CUE_S)
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
  // v5s46d (251): il negozio sta all'INIZIO del paese, sul marciapiede destro, prima di Su Nascimentu,
  // del ballu tundu e di Ciccio. La scritta resta solo mentre gli si passa davanti (non viaggia fino a Santa Marta).
  OFFER_AT_M: 8,
  OFFER_UNTIL_M: 24,
  FACADE_FROM: 8, FACADE_TO: 20,   // buco delle case di destra: ci sta la facciata del Garag
  AT_M: 14,                        // centro della facciata (metri locali del paese)
  OFFER_S: 5,              // tetto di tempo, ma si chiude anche superato il negozio
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
  P_FACCIOLA: 0,            // v5s46d (utente): sa facciola tolta come oggetto da raccogliere (resta il velo di sa Grastula)
  PTS: 40,
  KINDS: { campanaccio: 'bell' },   // v5s46d (utente): niente piu' facciole da raccogliere
};
export const SKINS = [
  { id: 'base', name: 'IL PORTATORE', desc: 'La mascotte di Frakkera Run: berritta nera, gilet della festa e la frakkera in spalla.', cost: { bell: 0, sweet: 0 }, speedK: 1 },   // v5c: nuovo personaggio di default
  { id: 'stramaioni', name: 'SU STRAMAIONI', desc: 'Viso nero di fuliggine e mantello scuro di orbace. Corre piu veloce (+8%).', cost: { bell: 10, sweet: 0 }, speedK: 1.08 },   // v5s46d: solo campanacci (facciole tolte)
  { id: 'classico', name: 'IL PORTATORE CLASSICO', desc: 'Il portatore di prima, vestito della festa.', cost: { bell: 0, sweet: 0 }, speedK: 1 },   // v5c: il personaggio di prima resta come costume (gratis)
];

// v5s21: festa a Gadoni: tratto del paese in festa (bancarelle, festoni e luci, launeddas, folla che applaude)
export const FESTA = {
  BIOME: 'village',
  FROM_M: 30, TO_M: 128,    // metri dentro il paese (dopo l'offerta del Garag, prima del ballu tundu)
  X: 74,                    // v5s36: piu' sul marciapiede (prima 66: le bancarelle entravano nella via e nelle case)
  STALL_GAP: [10, 16],      // v5s36: meno bancarelle (prima [4,6]: via intasata)
  CROWD_GAP: [5, 8],        // v5s36: folla un po' piu' rada
  FESTOON_ROWS: 10,         // v5s36: meno festoni (prima ogni 4 file: cielo pieno di bandierine)
  BRUSH_PX: 14,             // passando nella corsia laterale vicino alla folla: applauso
  PTS: 20,
  STREAK: 6,                // ogni X tappeti di fila nella festa: la folla esulta
};

// v5s24: animali sulla strada (su pastore col gregge, maialetto, cane randagio, cane pastore, capre dalla roccia).
// Flusso RNG separato nel generatore; tutto nel registro della corsa.
export const ANIMALS = {
  ROCKGOAT_SHOT_PTS: 10,     // v5s26: capra della roccia colpita con la pistola
  FROM_M: 60,                     // non nei primi metri
  P_ROW: 0.035,                   // probabilita' per fila (flusso separato) di un evento animale
  GAP_ROWS: [22, 34],             // file minime tra due eventi
  FLOCK_BIOMES: ['rock', 'river'],
  FLOCK_N: [4, 6], FLOCK_STEP: 15, FLOCK_GAP: 52, FLOCK_VX: [24, 32],
  PIG_BIOMES: ['rock', 'river'], PIG_VX: [70, 92],
  DOG_BIOMES: ['village', 'rock', 'river'], DOG_S: 9, DOG_BARK_S: 1.0, DOG_X: 22,
  CHASE_S: 6, CHASE_SLOW_K: 0.8, NIP_FUEL: 6, CHASE_ROWS: 7,
  ROCKGOAT_BIOMES: ['rock'], ROCKGOAT_LEAD_S: 1.45,   // v5s40: prima 1.1 s
  STOP_S: 1.7,                    // v5s40: capre/pecore ferme a 1.7 s dal giocatore (corsia libera garantita)
  ROCKGOAT_N: [1, 2],
  SHEPHERD_X: 62,
};

// ---- v5s24: potenziamenti rari (flusso RNG proprio) e ramo caduto nei boschi / sulla roccia ----
export const POWER = {
  FROM_M: 140,             // non prima di X metri
  GAP_ROWS: [110, 190],    // file tra un potenziamento e l'altro (~330-570 m)
  KINDS: [['calamita', 0.38], ['finocchio', 0.34], ['scarponi', 0.28]],
  MAGNET_S: 10, MAGNET_PX: 320, MAGNET_PULL: 9, MAGNET_V0: 120, MAGNET_ACC: 1400, MAGNET_VMAX: 1600, MAGNET_GRAB: 10, MAGNET_AIM: 4, MAGNET_ARC: 12,   // v5s27p: volo verso il personaggio (px/s)     // calamita: tira i tappeti da tutte le corsie
  FENNEL_S: 5,             // scudo di finocchio intrecciato: para UN urto entro 5 s
  BOOTS_S: 4, BOOTS_K: 1.28, BOOTS_PTS: 8, BOOTS_TICK_S: 0.5,   // scarponi del calzolaio
  BRANCH_BIOMES: ['rock', 'river'], BRANCH_FROM_M: 60, BRANCH_GAP_ROWS: [26, 60], BRANCH_P: 0.09, BRANCH_LEN: 10,
};

// ---- v5s25: salto (swipe su / freccia su / W) sopra gli ostacoli bassi ----
// Il generatore continua a garantire un percorso SENZA saltare (il salto e' solo una scorciatoia).
// v5s44c: ritmo degli ostacoli (tempo a velocita' corrente, tutte le zone e i giri)
export const PACE = {
  // Soglie in secondi: la distanza minima cresce da sola con speedAt, quindi il tempo di reazione
  // resta questo anche con la rampa piu' ripida. Non si accorciano.
  SAME_S: 1.35,            // minimo tra due ostacoli della stessa azione (accovacciata globale, salto stessa corsia)
  ANY_S: 0.7,              // minimo tra due ondate di azioni obbligate (come zona 3, ora ovunque)
  CHAIN_N: 3,              // al massimo N azioni in CHAIN_WINDOW_S, poi un respiro
  CHAIN_WINDOW_S: 3.5,
  BREATHER_S: 1.8,
};

export const JUMP = {
  TIME_S: 0.62, COOLDOWN_S: 0.1, H_PX: 15, CLEAR_PX: 6, PTS: 5,
  BUFFER_S: 0.15,          // v5s45: swipe su in atterraggio: resta in memoria 150 ms
  KINDS: { botte: true, bottecoricata: true, muretto: true, sasso: true, pozza: true, bagnato: true, acqua: true },   // NON travi, rami, funi
};
// ---- v5s25: migliorie permanenti nel Garag di Pinu (salvate in locale, 3 livelli) ----
export const UPGRADES = [
  { id: 'calamita', name: 'Calamita pi\u00f9 forte', unit: 's', add: 2, prices: [40, 90, 180] },
  { id: 'finocchio', name: 'Finocchio pi\u00f9 fitto', unit: 's', add: 1.5, prices: [40, 90, 180] },
  { id: 'scarponi', name: 'Scarponi risuolati', unit: 's', add: 1.2, prices: [40, 90, 180] },
  { id: 'fiamma', name: 'Frakkera pi\u00f9 lenta', unit: '%', add: 0.07, prices: [60, 130, 260] },
];
// ---- v5s25: meteo: notte di pioggia (giri 4, 6, 8...) e nebbia nella valle (roccia / fiume) ----
export const WEATHER = {
  RAIN_FROM_LAP: 3,        // giro (da 0) della prima notte di pioggia; poi un giro si' e uno no
  PUDDLE_GAP_ROWS: [8, 18], PUDDLE_SLOW: 0.86, PUDDLE_SLOW_S: 0.55,
  FOG_BIOMES: ['rock'], FOG_BLOCK_M: 130, FOG_P: 0.6, FOG_LEN_M: [35, 65], FOG_FAR: 0.3,   // v5s28: niente nebbia a Sa Stiddiosa (copriva le cascate), nebbia meno fitta sulla roccia (QA L3)
};

// v5 stage 24: chiesa di Santa Marta attraversata di corsa (fine del paese): navata libera, solo tappeti sulla passatoia
export const SANTAMARTA = {
  BIOME: 'village',
  FROM_M: 240, LEN_M: 30,   // facciata a fine paese (dopo vicolo e cappella), la navata sconfina nei primi metri della roccia
  LEAD_M: 8,                // niente ostacoli anche sui gradini davanti al portone
  NO_SPAN_M: 80,            // v5s27q: niente travi/balconi di traverso negli ultimi 80 m prima della chiesa (coprivano il portone)
};

// ---- feat-village: vita del paese (flusso RNG separato, vedi generator.maybeVillage) ----
// panni stesi (la nonna): sostituiscono una trave nel paese, ci si abbassa (log L / urto h)
// tessitrice al telaio: sul marciapiede, passando nella corsia laterale ti lancia un tappeto (log W)
// processione di Santa Marta: rara, occupa una corsia fuori dal sentiero; urto = fuoco, non morte (log I, passata pulita i)
// paesani alle finestre: esultano per le scie di tappeti nel paese fuori dalla festa (log V)
export const VILLAGE = {
  BIOME: 'village',
  LAUNDRY_SHARE: 0,         // niente panni in paese: la trave resta al loro posto (stesso consumo di rng)
  LAUNDRY_RNG: 0.22,        // quota storica, solo per non spostare il rng del paese
  WEAVER_FROM_M: 118, WEAVER_TO_M: 146,   // v5s45 (15): una per giro, IN MEZZO alla via (corsia 1), girata verso chi corre
  WEAVER_LAP2_FROM_M: 102, WEAVER_LAP2_TO_M: 113,   // v5s45: nel giro 2 prima, per lasciare libero il passaggio di Ciccio
  WEAVER_LEN: 30,           // px di profondita' (telaio 2.8 m)
  WEAVER_HALF: 8,           // px di mezza larghezza (telaio ~1.5 m)
  WEAVER_LOSS_K: 0.25, WEAVER_LOSS_MAX: 5,   // urto: perdi il 25% dei tappeti (min 1, max 5)
  WEAVER_GAP: [14, 22],     // file tra due tessitrici
  WEAVER_X: 52,             // px dal centro (bordo del marciapiede, v5s24: piu' vicina per leggersi sul telefono)
  WEAVER_BRUSH_PX: 14,
  WEAVER_PTS: 15,
  PROC_SHARE: 0.5,         // quota di travi nel paese che diventano processione (se non gia' fatta in questo giro)
  PROC_FROM_M: 200, PROC_TO_M: 220,   // v5s44c: poco prima di Santa Marta (arrivo ~20-40 m prima dell'arco), non all'uscita della miniera
  PROC_LEN: 52,             // px di profondita' del corteo (statua + portatori)
  PROC_WALK_PX_S: 13,       // v5s44f: il corteo cammina VERSO chi corre (~1.3 m/s, passo di processione)
  PROC_WALK_MAX_PX: 60,     // v5s44f: al massimo ~6 m (2 file): resta dentro la corsia riservata dal generatore
  PROC_HALF: 13,
  PROC_FUEL: 12,            // urto: costa fuoco (mai sotto 1)
  PROC_PTS: 40,             // passata pulita
  CHEER_STREAK: 4,          // ogni X tappeti di fila nel paese (fuori dalla festa): applausi dalle finestre
  CHEER_PTS: 10,
};

// ---- v5s45 (18): "Ciccio": nel giro 2 (lap index 1, 1600-1850 m) un pickup bianco passa veloce nel paese ----
// Avviso (banner + clacson + corsia) WARN_S prima dell'incrocio alla velocita' attuale; corsia destra (2),
// finestra senza altri ostacoli (CLEAR_*), urto = morte immediata (scudo e invulnerabilita' non contano).
export const CICCIO = {
  LAP: 1,                    // lap index 1 = "giro 2" nella schermata di fine partita
  WARN_M: 128,               // metri dentro il paese a cui parte l'avviso (dopo ballo e tessitrice)
  WARN_S: 2.0,               // secondi dall'avviso all'incrocio
  SPEED_PX_S: 150,           // velocita' del camion verso il giocatore (15 m/s, ~54 km/h)
  LANE: 2,
  LEN: 52, HALF: 10,         // px: 5.2 m x 2.0 m
  CLEAR_FROM_M: 124, CLEAR_TO_M: 200,   // niente altri ostacoli (e niente pickup nella sua corsia) in questo tratto
  PTS: 60,
  BANNER: 'STAI ATTENTO! STA PASSANDO CICCIO!',
  REASON: 'Ciccio ti ha preso!',
};

// ---- v5s46: sensazione di gioco -------------------------------------------
export const LANE_FEEL = { OMEGA: 34, SNAP_M: 6, V_FULL: 40, LEAN: 0.13 };   // (101) molla critica a video (1/s), scatto oltre SNAP_M m, inclinazione max (rad) a V_FULL m/s laterali
export const CAM_SPEED = { FROM: 150, TO: 240, BACK: 1.5, UP: 0.35, FOV: 4 };   // (115) da FROM a TO px/s la camera arretra (m), sale (m) e si allarga (gradi)
export const RUN_SHADOW = { W: 1.6, D_K: 0.8, DZ: 0.05, OP: 0.85, SHRINK: 0.35, FADE: 0.3 };   // (105) ombra di contatto del corridore
export const VIBE = { HIT: 45, SHIELD: 25, WEAVER: [30, 40, 30], DIE: 140, CICCIO: [120, 60, 260] };   // (44) ms di vibrazione

