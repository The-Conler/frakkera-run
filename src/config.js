// =====================================================================
//  FRAKKERA RUN - configurazione di gioco
//  Tutti i valori di bilanciamento sono qui: modificali senza toccare
//  la logica. Le distanze sono in "pixel di gioco" (px) salvo dove
//  indicato; 1 metro = PX_PER_METER px.
// =====================================================================

export const GAME_VERSION = '0.6.0';

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
