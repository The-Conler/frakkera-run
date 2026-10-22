# FRAKKERA RUN

*Quanto lontano riuscirai a portare il fuoco?*

Minigioco arcade 2D (endless runner verticale, pixel art) ispirato al rito di **Is Frakkeras di Gadoni**. Si gioca nel browser, senza download o registrazione, ed è pensato prima di tutto per lo smartphone in verticale.

> **Stato: versione 0.2 (v2: botti da vino, tappeti Sa Burra, pistola Broccu, nuova interfaccia).** La classifica di questa fase è **DEMO** e locale (resta sul singolo dispositivo). **Non vale per i premi.** La classifica ufficiale con validazione server arriva con la Fase 3.

---

## Avvio rapido

Requisiti: **Node.js 20.19 o superiore** (oppure 22+) e npm.

```bash
npm install
npm run dev          # http://localhost:5173  (con --host è raggiungibile anche dal telefono in rete locale)
```

Build di produzione:

```bash
npm run build        # genera dist/
npm run preview      # serve dist/ su http://localhost:4173
```

Se vuoi solo provare la build già pronta, va servita via HTTP: aprire `index.html` con doppio clic (`file://`) non funziona per via dei moduli ES. Per esempio:

```bash
npx serve dist       # oppure: python3 -m http.server -d dist 8080
```

### Test automatici

```bash
node tests/generator.test.mjs          # 400 seed x 6 km: verifica che non esistano mai percorsi impossibili
npm run build && npm run preview &     # serve la build sulla porta 4173
pip install playwright                 # una volta sola
python3 tests/e2e.py                   # test end-to-end: mobile 390x844 touch + desktop 1366x900
python3 tests/sprite_hash.py           # hash degli sprite protetti (giocatore, frakkera, fiamma)
python3 tests/sprite_sheet.py          # foglio sprite ingrandito in screenshots/v2-sprites.png
```

`tests/e2e.py` usa Chrome (`CHROME_PATH`, di default `/usr/bin/google-chrome`). Apre il menu e tutte le schermate, avvia la partita, gioca circa 20 s con un bot e verifica:

- punteggio, distanza e velocità che crescono, consumo della fiamma, raccolta dei materiali, bonus "per un pelo";
- pausa manuale e automatica, game over, filtro dei nickname, classifica demo, RIPROVA;
- persistenza del record, nessuna emoji, nessuno scroll e nessun errore in console;
- **v2** (con `?debug=pistol`): raccolta dei tappeti e totale salvato in localStorage, pistola raccolta con 3 colpi, sparo con il pulsante SPARA (mobile) o con Spazio/W/Su (desktop), botte distrutta, colpi a zero (HUD e pulsante spariscono), il tocco su SPARA non cambia corsia, riavvio istantaneo dal game over.

Gli screenshot finiscono in `screenshots/` con prefisso `v2-`.

`tests/protected-sprites.baseline.json` contiene gli hash di riferimento di giocatore, frakkera e fiamma: `tests/sprite_hash.py` deve restituire gli stessi valori.

**Parametro di debug:** `?debug=pistol` fa comparire una pistola già alla seconda fila e poi ogni 30 file (per test e demo). Le partite con `debug` non aggiornano record né classifica demo.

---

## Controlli

| Dispositivo | Azione |
|---|---|
| Desktop | Frecce sinistra/destra oppure A/D. **Spazio, W o freccia su: spara** (solo con la pistola). P o Esc per la pausa, M per l'audio. Al game over: Invio, Spazio o **R** per ripartire subito |
| Smartphone | Swipe a sinistra/destra (uno swipe sposta di una corsia) oppure tocco sulla metà sinistra o destra dello schermo. **Pulsante SPARA** in basso al centro (compare solo con colpi disponibili) oppure swipe verso l'alto. Al game over un tocco su RIPROVA riparte subito |

Tutto si gioca con un dito. Il pulsante SPARA intercetta il proprio tocco, che quindi non arriva al canvas e non cambia corsia. Per 350 ms dopo il game over i tasti di ripartenza sono ignorati: così uno sparo tenuto premuto al momento dello spegnimento non fa ripartire per sbaglio.

Durante la partita la pagina non scorre e non zooma: `touch-action: none`, `preventDefault` sui `touchmove` e niente doppio tocco o pinch.

---

## Struttura del progetto

```
frakkera-run/
├── index.html                 # pagina unica: canvas di gioco + interfaccia HTML (menu, HUD, schermate)
├── vite.config.js             # base './' => funziona in sottocartelle e iframe
├── netlify.toml               # deploy su Netlify già pronto
├── public/favicon.svg
├── src/
│   ├── main.js                # avvio, dimensionamento pixel-perfect, creazione del gioco Phaser
│   ├── config.js              # TUTTI i valori di punteggio, fiamma, difficoltà e mondo
│   ├── ui.js                  # menu, HUD, pausa, game over, nickname, classifica demo
│   ├── styles.css             # interfaccia in stile pixel (font pixel locali)
│   ├── bus.js                 # eventi tra il gioco e l'interfaccia
│   ├── scenes/GameScene.js    # gameplay: simulazione a passo fisso, collisioni, rendering, luce
│   ├── systems/
│   │   ├── generator.js       # generatore procedurale con garanzia di percorribilità
│   │   ├── rng.js             # PRNG deterministico (seed => stesso percorso)
│   │   ├── audio.js           # effetti sonori e musica sintetizzati con WebAudio
│   │   ├── storage.js         # record personale, impostazioni, classifica demo (localStorage)
│   │   └── nickname.js        # validazione e filtro di base dei nickname
│   ├── art/
│   │   ├── palette.js         # palette (notte, fuoco, pietra, legno, rosso bruciato)
│   │   ├── textures.js        # pixel art generata via codice (giocatore, frakkera e fiamma INVARIATI)
│   │   └── textures2.js       # v2: botti da vino, schegge, tappeti Sa Burra, pistola Broccu, vampata, colpo
│   └── assets/fonts/          # Press Start 2P e VT323 (SIL OFL 1.1), sottoinsieme latino, woff
├── tests/
│   ├── generator.test.mjs     # test di percorribilità
│   ├── e2e.py                 # test end-to-end Playwright (v1 + v2)
│   ├── sprite_hash.py         # verifica che gli sprite protetti non cambino
│   └── sprite_sheet.py        # esporta screenshots/v2-sprites.png
├── reference/                 # riferimento del tappeto sa burra
└── screenshots/               # catture dei test (mobile e desktop)
```

**Stack:** Phaser 3.90 (WebGL con ripiego su Canvas), JavaScript ES modules, Vite. Niente CDN: Phaser finisce nel bundle. A runtime nessun altro servizio esterno.

**Peso della build:** circa 340 KB gzip di JS (quasi tutto Phaser), 4 KB di CSS, 37 KB di font. Nessuna immagine da scaricare.

---

## Asset

- **Grafica:** tutta la pixel art è disegnata via codice in `src/art/textures.js` su canvas a bassa risoluzione (circa 180 px di larghezza logica). Poi viene ingrandita di un fattore **intero** di pixel fisici con filtro nearest-neighbour, così resta nitida su ogni schermo. Comprende:
  - il portatore della frakkera con 4 frame di corsa, la frakkera stessa e la fiamma animata (6 frame);
  - scintille, braci e fumo;
  - le case in pietra con tetti in coppi, finestre accese, porte e lanterne, i vicoletti laterali e l'acciottolato;
  - muretti a secco, pozzanghere, case che sporgono nel vicolo, capre;
  - **v2:** tutti gli ostacoli in legno sono **botti da vino** tradizionali (vista 3/4, doghe bombate, cerchi di ferro scuro, legno caldo): botte in piedi, botte coricata su zeppe, gruppo di 5 botti, botte che rotola (4 frame); schegge, pezzi di cerchio e schizzi di vino quando si rompono;
  - **v2:** 4 varianti di **tappeto Sa Burra** tessuto (rombi, zig-zag, righe, rombo centrale) nei colori rosso, bordeaux, senape e crema, con frange che si muovono;
  - **v2:** pistola Broccu (pickup), pistola in mano (sprite separato sovrapposto al personaggio), vampata in 3 frame, colpo, fumo;
  - i fasci di asfodelo e di ferula.
- **Sprite protetti:** giocatore, frakkera e fiamma (`player()`, `torch()`, `flame()`) non sono stati toccati in v2; la verifica è negli hash di `tests/protected-sprites.baseline.json`. La fiamma ora ha scala costante (stessa dimensione dei pixel di tutto il resto): il livello del fuoco si legge dal raggio della luce, dalle scintille e dal tremolio sotto il 25%.
- **Luce:** una maschera di oscurità blu notte con un "buco" morbido attorno alla fiamma. Il raggio dipende dal livello del fuoco e tremola. Sopra ci sono bagliori additivi su finestre, lanterne e materiali. Il costo è molto basso: niente shader e niente render texture a ogni frame.
- **Audio:** tutto sintetizzato in `src/systems/audio.js`, quindi nessun file audio:
  - passi, crepitio continuo del fuoco legato al livello della fiamma, raccolta, catena, "per un pelo", urto, pozzanghera (sfrigolio), capra, traguardo, game over, nuovo record;
  - v2: tappeto (note che salgono lungo una scia), pistola raccolta, sparo, botte che si rompe, rimbalzo sulla pietra, "senza colpi", bonus sopravvivenza;
  - musica d'atmosfera: bordone grave, vento notturno, note modali rade con eco e un battito che accelera con la corsa. Nessun cliché "folk sardo".
- **Font:** Press Start 2P e VT323, licenza SIL Open Font License 1.1 (vedi `src/assets/fonts/FONTS-LICENSE.txt`).
- **Fase 2:** per sostituire la grafica con sprite sheet disegnati a mano basta caricare PNG con le stesse chiavi (`player`, `flame`, `muretto`, ...) nel `preload` della scena. Le dimensioni attese sono quelle in `textures.js`.

---

## Punteggio (`src/config.js`, oggetto `SCORE`)

| Azione | Punti | Parametro |
|---|---|---|
| Metro percorso | +10 | `PER_METER` |
| Materiale raccolto (asfodelo/ferula) | +50 | `MATERIAL` |
| Ostacolo evitato all'ultimo istante ("PER UN PELO") | +100 | `NEAR_MISS`, finestra `NEAR_MISS_WINDOW_S` = 0,28 s, pausa minima `NEAR_MISS_COOLDOWN_S` = 1,2 s |
| 5 raccolte consecutive | +250 | `CHAIN_SIZE`, `CHAIN_BONUS` (la catena si azzera se perdi un materiale o urti) |
| Traguardi 100, 250, 500, 1000, 1500, 2000 m | +200, +400, +750, +1500, +2000, +2500 | `MILESTONES` |
| Ogni 500 m oltre i 2000 | +3000 | `MILESTONE_REPEAT_*` |
| Tappeto Sa Burra | +20 (e +1 nella collezione) | `CARPET` (metti 0 per renderli solo moneta) |
| Botte distrutta con la pistola / gruppo di botti | +150 / +300 | `BARREL`, `BARREL_GROUP` |
| Ogni 30 s con la fiamma accesa | +250 | `SURVIVAL_EVERY_S`, `SURVIVAL_BONUS` |
| Tetto ai bonus-azione | max 2500 punti ogni 10 s di corsa | `BONUS_CAP_PER_10S` |

**I tappeti sono una moneta, non punteggio:** il totale raccolto (`frakkera.carpets.v1` in localStorage) è separato dal punteggio e resta tra una partita e l'altra; nel punteggio valgono solo +20. Parametri delle scie in `CARPETS` (probabilità, lunghezza, quota fuori dal sentiero).

**Pistola Broccu** (`PISTOL`): 3 colpi, mai prima di 140 m, almeno 380 m tra due pistole, al massimo 6 per partita, 0,32 s tra un colpo e l'altro. Il colpo rompe solo le botti (in piedi, coricate, gruppi, che rotolano); sulla pietra rimbalza, le capre non vengono mai colpite. Dopo una pistola, per 24 file, gli ostacoli corti sono quasi tutti botti.

**Contro gli exploit:**

- I punti-distanza si accreditano solo per i metri realmente percorsi nella simulazione. Il personaggio non si può fermare e in pausa non si accumula nulla.
- Il "per un pelo" vale una sola volta per ostacolo, solo se l'ostacolo era nella tua corsia a meno di 0,28 s, solo se poi non lo urti, e al massimo uno ogni 1,2 s.
- La catena richiede materiali reali, che diventano sempre più rari.
- Tetto ai bonus-azione (tappeti, botti, materiali, catena, per un pelo): al massimo `BONUS_CAP_PER_10S` punti per finestra di 10 s; l'eccesso finisce in `stats.capped` e nel registro (`cap`). Traguardi e sopravvivenza sono legati a distanza e tempo, quindi restano fuori dal tetto.
- Le pistole hanno un tetto per partita e una distanza minima, i colpi un tempo di ricarica.
- Il delta di tempo è limitato a 0,25 s e la simulazione gira a passo fisso (1/120 s), quindi niente salti dopo un lag.

**Fiamma** (`FUEL`):

- Si consuma da 3,4 a 7,0 unità al secondo con la difficoltà.
- Asfodelo +16, ferula +28 (più rara).
- Urto -30, pozzanghera -14, capra o botte che rotola -22.
- Dopo un urto: 1,1 s di invulnerabilità e un rallentamento temporaneo.

**Difficoltà** (`DIFFICULTY`): sale da 0 a 1 in 2400 m con una curva più dolce all'inizio (`RAMP_EXP` 1,15).

- Velocità da 82 a 212 px/s, poi sale ancora lentamente fino a 240.
- Ostacoli dal 9% al 40% per corsia libera, materiali dal 14% al 6,5% per fila.
- Il sentiero cambia corsia più spesso.
- Gruppi di botti, vicoli stretti e ostacoli mobili si sbloccano a soglie di difficoltà diverse.
- Cambio corsia morbido (avvicinamento esponenziale, `WORLD.LANE_EASE`), hitbox più indulgenti (giocatore largo 6 px, ostacoli leggermente più stretti del disegno).

### Garanzia "nessuna situazione impossibile"

Il generatore (`systems/generator.js`) traccia prima un **sentiero sicuro**: una corsia sempre libera che si sposta al massimo di una corsia alla volta, lasciando libere entrambe le corsie per 2 file durante lo spostamento. Solo dopo piazza gli ostacoli, sempre fuori dal sentiero.

**Le botti non bloccano mai l'unica strada:** stanno solo fuori dal sentiero sicuro, quindi il percorso esiste sempre **anche senza pistola**. Pistole e tappeti sono messi sul sentiero o in corsie libere, mai sopra un ostacolo, e dopo un tappeto la corsia resta libera per una fila (niente trappole).

Capre e botti che rotolano compaiono solo in finestre calme di 7 file senza altri ostacoli. Tutto entra in scena dal bordo superiore, mai all'improvviso.

`tests/generator.test.mjs` lo verifica su 400 seed × 6 km. Il controllo è una programmazione dinamica che tiene conto della velocità massima e del tempo di cambio corsia, e tratta le botti come muri (cioè senza pistola). Controlla anche che nessun pickup si sovrapponga a un ostacolo, che tutte le pistole siano raggiungibili e che non ci siano trappole dopo un tappeto. Ultimo risultato: OK, 2400 pistole tutte raggiungibili, 97,4% dei tappeti raggiungibili (gli altri sono in scie rischiose fuori dal sentiero: si possono saltare).

---

## Pubblicazione

La build (`dist/`) è statica, quindi va bene qualsiasi hosting statico. Con `base: './'` funziona anche in una sottocartella, per esempio `https://sito.it/frakkera-run/`.

- **Netlify:** collega il repository (c'è già `netlify.toml`) oppure trascina la cartella `dist/` su app.netlify.com/drop.
- **Vercel:** nuovo progetto, framework "Vite", build `npm run build`, output `dist`.
- **GitHub Pages:**
  1. `npm run build`;
  2. pubblica il contenuto di `dist/` sul branch `gh-pages`, per esempio con `npx gh-pages -d dist`, oppure con una GitHub Action che pubblica `dist`.
- **Hosting tradizionale (Apache/Nginx, WordPress e simili):** carica via FTP il contenuto di `dist/` in una cartella, per esempio `/frakkera-run/`.

### Integrazione nel sito esistente

**Soluzione consigliata (mobile):** una pagina dedicata a schermo intero, cioè un link "GIOCA" che apre `https://sito.it/frakkera-run/`.

**In alternativa, un iframe:**

```html
<div style="max-width:480px;margin:0 auto;aspect-ratio:9/16;max-height:100dvh">
  <iframe src="https://sito.it/frakkera-run/"
          title="FRAKKERA RUN"
          style="width:100%;height:100%;border:0;display:block"
          allow="autoplay; fullscreen"
          loading="lazy"></iframe>
</div>
```

Il gioco si adatta da solo alla dimensione dell'iframe. In un iframe, la tastiera funziona dopo il primo clic sul gioco.

---

## Novità v2 (0.2.0)

1. **Botti da vino** al posto di botti/ceste/carri: botte singola, coricata, gruppi, botte che rotola. Sempre una strada senza pistola (testato).
2. **Tappeti Sa Burra** da collezionare: galleggiano, luccicano, si raccolgono con un effetto di fili e una nota che sale lungo la scia. Arrivano in file e zig-zag che invitano a cambiare corsia. Contatore nell'HUD, totale salvato e mostrato nel menu e nel game over.
3. **Pistola Broccu**: pickup raro, 3 colpi, colpi visibili nell'HUD solo quando è attiva. Pistola in mano con rinculo e vampata (il personaggio non cambia), colpo, scossa dello schermo, schegge, vino e bonus.
4. **Bilanciamento**: inizio più lento e curva più dolce, cambio corsia morbido, hitbox più giuste, riavvio istantaneo.
5. **Effetti**: selciato più calmo per far risaltare ostacoli e tappeti, cenere e braci nell'aria, luce della vampata, fiamma a scala costante.
6. **HUD compatto**: punti e record, metri, tappeti, audio, pausa; barra della fiamma con icona; colpi solo con la pistola.
7. **Menu e game over** rifatti: fascia tessuta sa burra, GIOCA ORA in evidenza, record e tappeti totali; game over con punteggio, nuovo record, distanza, tappeti, botti rotte, posizione, nickname e **RIPROVA** grande subito sotto le statistiche. Niente sfumature morbide, solo pixel.
8. **Punteggio** esteso (tappeti, botti, sopravvivenza) con tetto anti-exploit; COME SI GIOCA aggiornato.

## Implementato (Fase 1)

- [x] Menu con titolo, sottotitolo, GIOCA ORA, CLASSIFICA, COME SI GIOCA, scheda IS FRAKKERAS, interruttore audio salvato, record personale.
- [x] Corsa automatica in verticale con 3 corsie e cambio corsia fluido e reattivo, con coda dei comandi. Tastiera (frecce/WASD), swipe e tocco.
- [x] Velocità crescente. Simulazione a passo fisso, quindi indipendente dal frame rate: stesse collisioni a 30, 60 o 120 Hz.
- [x] Sistema della fiamma:
  - indicatore grafico che lampeggia sotto il 25%;
  - consumo continuo e ricarica con asfodelo e ferula;
  - urti e pozzanghere che tolgono fuoco;
  - fiamma animata, scintille, braci, fumo, luce dinamica il cui raggio dipende dal fuoco.
- [x] Ostacoli coerenti con l'ambientazione:
  - muretti a secco, botti, ceste, carri, pozzanghere;
  - case che sporgono (vicoli più stretti);
  - capre e botti che attraversano la strada (ostacoli mobili).
- [x] Generatore con percorso sempre percorribile (testato) e difficoltà progressiva.
- [x] Punteggio completo (metri, materiali, per un pelo, catena, traguardi) con valori configurabili e protezioni dagli exploit.
- [x] HUD minimale: punti, record, metri, fiamma, pausa, audio.
- [x] Pausa manuale e automatica quando la pagina va in background o perde il focus, con conto alla rovescia alla ripresa.
- [x] Game over con:
  - punteggio, distanza, record, materiali, "per un pelo";
  - posizione nella classifica demo;
  - nickname con filtro (IT, sardo, EN, leetspeak);
  - RIPROVA, CLASSIFICA, MENU.
- [x] "LA CLASSIFICA DEL FUOCO" (DEMO, locale): posizione, nickname, punti, data; primi 3 evidenziati, la propria voce evidenziata; azzeramento.
- [x] Record personale persistente in localStorage, scritto solo se migliore, con ripiego in memoria se lo storage è bloccato.
- [x] Audio WebAudio completo, attivato solo dopo un gesto dell'utente (rispetta le regole di autoplay e lo sblocco su iOS) e sospeso in background.
- [x] Mobile-first in verticale; su desktop una colonna centrata. Scala pixel-perfect e area sicura per il notch (`viewport-fit=cover`).
- [x] Testato in Chrome headless (mobile + desktop; in v2 110 controlli) e in Firefox (smoke test).

## Da sviluppare

**Fase 2, direzione artistica**

- Sprite disegnati a mano (o rifiniti partendo da quelli generati), più varianti di case:
  - scalinate, archi, chiesa e piazza come "tappe";
  - altri portatori di frakkere sullo sfondo, fumo e cielo.
- Animazione di inciampo e di caduta, schermata di caricamento illustrata, transizioni.
- Musica composta (resta valida la regola: niente cliché), mixaggio fine e vibrazione su mobile.
- Validazione dei testi culturali con gli organizzatori.

**Fase 3, classifica ufficiale e anti-cheat**: non presente in Fase 1, il progetto è descritto sotto.

**Fase 4, ottimizzazione**

- Test su dispositivi reali: iPhone/Safari, Android di fascia media, Firefox mobile.
- Profilazione e pooling degli oggetti.
- Taratura della difficoltà con playtest reali.
- Accessibilità: contrasto, riduzione degli effetti, daltonismo.

**Fase 5, pubblicazione**

- Dominio o pagina definitiva, eventuale PWA/offline, analytics rispettosi della privacy.
- Regolamento del concorso e informativa privacy.

---

## Fase 3: progetto della classifica ufficiale anti-cheat (bozza)

Un punteggio calcolato solo dal client si può sempre falsificare. Per questo il server **non accetta un numero**: accetta una **partita** e la verifica. Il gioco è già predisposto:

- **seed deterministico** (`systems/rng.js`): lo stesso seed genera lo stesso percorso;
- **simulazione a passo fisso**: `tick()` a 1/120 s;
- **registro degli input**: elenco `[passo, direzione]`, raccolto in `GameScene.inputs`. In v2 anche gli spari: `[passo, 'F']`.
- **registro degli eventi** (v2): `GameScene.events`, elenco `[passo, codice, valore]`. Codici: `f` fascio raccolto, `x` catena, `c` tappeto, `p` pistola, `b` botte distrutta, `h` urto, `w` pozzanghera, `n` per un pelo, `m` traguardo, `s` sopravvivenza, `cap` punti tagliati dal tetto. Il game over passa `log: {v: 2, seed, steps, inputs, events}`: il server potrà rigiocare la partita e confrontare evento per evento, non solo il totale.

**Note anti-cheat v2:**

- I tappeti contano come moneta solo sul dispositivo. Se un giorno servissero davvero (premi, sblocchi), il totale va tenuto sul server e calcolato dal replay, mai preso dal client.
- Il server deve **ignorare** `?debug=` (in produzione si può anche togliere dal codice): il seed lo sceglie il server e la generazione della pistola segue solo le regole di `PISTOL`. Una partita che dichiara `debug` va rifiutata.
- Nel replay vanno controllati il tetto delle pistole, il numero di colpi (`F` solo con colpi disponibili e dopo il tempo di ricarica) e il tetto ai bonus ogni 10 s.

**Backend proposto: Supabase** (Postgres, Edge Functions, Auth). In alternativa qualunque backend con funzioni serverless.

1. **Sessione emessa dal server.** All'avvio il client chiama la Edge Function `start_run`, che:
   - crea una riga `runs` (`id`, `player_id`, `seed` generato dal server, `started_at` con l'ora del server, `status='open'`);
   - restituisce un token di sessione firmato (JWT/HMAC, monouso, scadenza breve).

   Il seed lo sceglie il server, quindi il client non può scegliersi un percorso facile.
2. **Invio della partita.** A fine corsa il client chiama `finish_run` con token, punteggio dichiarato, distanza e registro degli input (compresso, pochi KB).
3. **Validazione sul server:**
   - **Replay:** la Edge Function (Deno) esegue la stessa logica di simulazione (`generator.js` + `tick()` estratti in un modulo senza rendering, condiviso tra client e server) con il seed e gli input, e ricalcola il punteggio. Si accetta solo se coincide.
   - **Controlli di plausibilità** (anche come ripiego):
     - tempo reale tra `start_run` e `finish_run` maggiore o uguale al tempo di gioco simulato;
     - punti al secondo entro la curva teorica;
     - numero di input umanamente plausibile, con limite di frequenza;
     - durata minima;
     - token usato una sola volta.
   - Le partite sospette restano nello stato `review` e non entrano in classifica.
4. **Identificazione minima dei giocatori, senza dati superflui:**
   - Per giocare non serve nulla: login anonimo Supabase, legato al dispositivo.
   - Per concorrere ai premi: nickname + email verificata con codice OTP (magic link), un account per email. Niente altri dati personali.
   - I dati per consegnare il premio si chiedono **solo ai vincitori**, fuori dal gioco.
5. **Limiti di frequenza:**
   - per account, per dispositivo (ID anonimo) e per IP salvato come hash con sale ruotato (nessun IP in chiaro);
   - per esempio massimo N partite all'ora, start/finish limitati al minuto;
   - blocco dei token duplicati.
6. **Interruttore del concorso.** Tabella `competition` (`opens_at`, `closes_at`, `is_open`, `season`). Fuori dalla finestra, `start_run` crea solo partite non classificate. Alla chiusura la classifica si congela in uno snapshot.
7. **Sicurezza dei dati.** RLS attivo: il client **non può** scrivere direttamente in `scores` o `runs`, solo tramite le Edge Functions con service role. La lettura della classifica passa da una vista pubblica che mostra solo nickname, punti e data.
8. **Pannello admin.** Pagina protetta, con ruolo admin su Supabase Auth, che permette di:
   - vedere la classifica, le partite in `review` e i dettagli del replay;
   - squalificare, bannare o rinominare i nickname;
   - aprire o chiudere il concorso;
   - esportare in CSV i primi N per la verifica dei vincitori secondo il regolamento.
9. **Verifica dei vincitori.** Al momento della chiusura: replay di controllo delle partite in classifica, contatto tramite l'email verificata e, se il regolamento lo prevede, una prova dal vivo alla manifestazione.

**Schema minimo:**

- `players(id, nickname, email_verified, created_at, banned)`
- `runs(id, player_id, seed, started_at, finished_at, status, score, meters, inputs, client_version, ip_hash)`
- `competition(...)`
- vista `leaderboard`

---

## Problemi noti e limiti

- La classifica è solo **demo/locale**: è modificabile da chi usa il dispositivo e non vale per i premi (lo dice anche l'interfaccia).
- Testato in Chrome headless (rendering software) e in Firefox. **Safari/iOS non è stato verificato su un dispositivo reale.** Il codice tiene già conto delle particolarità iOS (sblocco audio nel gesto, `visualViewport`, niente zoom o scroll), ma resta da provare in Fase 4.
- Su schermi in orizzontale il gioco resta una colonna verticale centrata. Non c'è un avviso "ruota il telefono", che può arrivare in Fase 4.
- Il 2,6% circa dei tappeti si trova in scie fuori dal sentiero che a velocità alta possono essere irraggiungibili senza rischi: è voluto (scelta rischio/ricompensa), ma si può ridurre con `CARPETS.OFFPATH_SHARE`.
- I popup centrali (per esempio "PISTOLA BROCCU!" e "LA FIAMMA RESISTE") possono sovrapporsi se capitano nello stesso istante.
- I font sono in woff (non woff2) perché nell'ambiente di build mancava il compressore brotli: circa 37 KB in totale.
- La grafica è generata via codice: è coerente e leggera, ma più semplice di sprite fatti a mano (obiettivo della Fase 2).
- Il testo sulla tradizione è volutamente breve e generale e va validato con gli organizzatori.
