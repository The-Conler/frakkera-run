# FRAKKERA RUN

*Quanto lontano riuscirai a portare il fuoco?*

Minigioco arcade (endless runner a 3 corsie) ispirato al rito di **Is Frakkeras di Gadoni**. Si gioca nel browser, senza download o registrazione, ed è pensato prima di tutto per lo smartphone in verticale.

> **Stato: versione 0.4 (v4: personaggio 3D vero, con scheletro e animazioni).** Il portatore e la frakkera sono ora un unico modello 3D GLB (`public/models/frakkera-man.glb`) creato in Blender con MPFB2/MakeHuman (asset CC0) e animato; fiamma, scintille e luce restano in Three.js. La classifica di questa fase è **DEMO** e locale (resta sul singolo dispositivo). **Non vale per i premi.** La classifica ufficiale con validazione server arriva con la Fase 3.
>
> La v3 (personaggio sprite pixel art in mondo 3D) è conservata nel tag git `v3` e negli archivi `frakkera-run-v3*.tgz`. La v2 (2D pixel art, Phaser) è conservata: tag git `v2` e copia completa in `../frakkera-run-v2-backup/` (con la sua `dist/`), oltre agli archivi `frakkera-run-v2*.tgz`.

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

La build va servita via HTTP: aprire `index.html` con doppio clic (`file://`) non funziona per via dei moduli ES. Per esempio:

```bash
npx serve dist       # oppure: python3 -m http.server -d dist 8080
```

### Test automatici

```bash
node tests/generator.test.mjs          # 400 seed x 6 km: verifica che non esistano mai percorsi impossibili
npm run build && npm run preview &     # serve la build sulla porta 4173
pip install playwright                 # una volta sola
python3 tests/e2e.py                   # end-to-end: mobile 390x844 touch + desktop 1366x900 (E2E_ONLY=mobile|desktop per uno solo)
python3 tests/charsheet.py http://127.0.0.1:5173/ screenshots/v4-character-turnaround.png screenshots/v4-run-cycle.png   # tavole del personaggio rese col motore
python3 tests/perf.py                  # tempo di frame indicativo in Chrome headless
```

I test usano Chrome (`CHROME_PATH`, di default `/usr/bin/google-chrome`) con WebGL software (`--use-angle=swiftshader --enable-unsafe-swiftshader`). `tests/e2e.py` apre il menu e tutte le schermate (anche IMPOSTAZIONI), avvia la partita, gioca con un bot e verifica:

- punteggio, distanza e velocità che crescono, consumo della fiamma, raccolta dei materiali, bonus "per un pelo";
- pausa manuale e automatica, game over con **conteggio animato** del punteggio (il valore finale deve coincidere), filtro dei nickname, classifica demo, RIPROVA;
- audio e musica attivabili e salvati, persistenza del record, nessuna emoji, nessuno scroll e nessun errore in console;
- personaggio 3D: GLB caricato, triangoli <= 20.000, clip presenti, stati IDLE nel menu, RUN in partita, peso delle clip di inclinazione nei cambi corsia, STUMBLE all'urto, sequenza di GAME OVER con fiamma che si spegne, ritorno a RUN con RIPROVA;
- con `?debug=pistol`: tappeti raccolti e totale salvato, pistola con 3 colpi, sparo con il pulsante SPARA (mobile) o con Spazio/W/Su (desktop), botte distrutta, colpi a zero (HUD e pulsante spariscono), il tocco su SPARA non cambia corsia, riavvio istantaneo.

Gli screenshot finiscono in `screenshots/` con prefisso `v4-`. Il vecchio controllo sugli hash degli sprite della v3 non vale più (il personaggio è cambiato su richiesta) ed è archiviato in `tests/obsolete/`.

**Parametri di debug:** `?debug=pistol` fa comparire una pistola già alla seconda fila e poi ogni 30 file. Le partite con `debug` non aggiornano record né classifica demo. `?test=1` espone `window.__frk` per i test. `?fixeddpr` disattiva la riduzione automatica della risoluzione.

---

## Controlli

| Dispositivo | Azione |
|---|---|
| Desktop | Frecce sinistra/destra oppure A/D. **Spazio, W o freccia su: spara** (solo con la pistola). P o Esc per la pausa, M per l'audio. Al game over: Invio, Spazio o **R** per ripartire subito |
| Smartphone | Swipe a sinistra/destra (uno swipe sposta di una corsia) oppure tocco sulla metà sinistra o destra dello schermo. **Pulsante SPARA** rotondo in basso a destra (compare solo con colpi disponibili) oppure swipe verso l'alto. Al game over un tocco su RIPROVA riparte subito |

Il pulsante SPARA intercetta il proprio tocco, che quindi non arriva al canvas e non cambia corsia. Per 350 ms dopo il game over i tasti di ripartenza sono ignorati. Durante la partita la pagina non scorre e non zooma.

---

## Architettura v4

```
frakkera-run/
├── index.html                 # canvas WebGL + interfaccia HTML/CSS; icone SVG inline (corona, coppa, libro, tappeto, ...)
├── vite.config.js             # base './' => funziona in sottocartelle e iframe
├── src/
│   ├── main.js                # avvio: colonna verticale, font, Game, UI, resize
│   ├── ui.js                  # menu, impostazioni, HUD, popup, pausa, game over (conteggio animato), classifica demo
│   ├── styles.css             # interfaccia cartoon: pulsanti arrotondati con bordo inferiore, pannelli blu notte, oro
│   ├── config.js              # TUTTI i valori di punteggio, fiamma, difficoltà e mondo (invariati dalla v2)
│   ├── bus.js                 # piccolo emettitore di eventi gioco <-> interfaccia
│   ├── game/
│   │   ├── sim.js             # simulazione pura (porting 1:1 della logica v2): passo fisso 1/120 s, collisioni, punteggio, registro
│   │   ├── game.js            # ciclo rAF, input (swipe/tocco/tastiera), audio, HUD, qualità adattiva
│   │   ├── world3d.js         # scena Three.js: cielo, luci, nebbia, strada, villaggio, oggetti, particelle, camere
│   │   ├── models.js          # modelli low-poly generati via codice (case, giardini, festoni, botti, capre, fasci, pistola, colline)
│   │   ├── kit.js             # fusione di primitive in un'unica geometria a colori per vertice (+ finta occlusione)
│   │   ├── tex3d.js           # texture su canvas: acciottolato, doghe, tappeti Sa Burra, bagliori, ombre
│   │   ├── particles.js       # scintille/fumo/vino (Points preallocati) e schegge di legno (InstancedMesh)
│   │   ├── character3d.js     # personaggio 3D: GLTFLoader + Meshopt, AnimationMixer, macchina a stati con dissolvenze, molla sulla frakkera, pistola in mano
│   │   ├── flame3d.js         # fiamma a 4 strati shader (rumore fbm) sulla punta della frakkera
│   │   ├── character.js       # billboard sprite della v3, usato solo come riserva se il GLB non si carica
│   │   └── texshim.js         # finto "scene.textures" per eseguire le funzioni di disegno originali senza Phaser
│   ├── systems/               # generator.js, rng.js, audio.js (+ interruttore musica), storage.js, nickname.js
│   ├── art/                   # textures.js (player/torch/flame INVARIATI), textures2.js (pistola in mano), palette.js
│   └── assets/fonts3/         # Lilita One e Baloo 2 (SIL OFL 1.1), woff2 latino
├── public/models/             # frakkera-man.glb (personaggio + frakkera, 1,6 MB)
├── blender/                   # pipeline Blender/MPFB2 che genera il GLB (script + texture originali)
├── tests/                     # generator.test.mjs, e2e.py, perf.py, charsheet.py, look4.py, obsolete/
├── reference/                 # tappeto sa burra, riferimenti v3 e v4 (concept del personaggio, foto della frakkera)
└── screenshots/               # catture dei test e tavole del personaggio (prefisso v4-)
```

**Stack:** Three.js 0.186 (WebGL), JavaScript ES modules, Vite. Phaser è stato rimosso. Niente CDN e nessun servizio esterno a runtime.

**Peso della build:** circa 211 KB gzip di JS (quasi tutto Three.js), 6 KB di CSS, 49 KB di font e il modello `frakkera-man.glb` da 1,6 MB (compresso con meshopt). Il resto del mondo è generato via codice.

**Logica separata dalla grafica.** `sim.js` non sa nulla del rendering: emette eventi (`spawn`, `barrel`, `carpet`, `shot`, `die`, ...) che `world3d.js` trasforma in modelli, particelle e scosse. Lo stesso modulo potrà girare sul server per il replay anti-cheat (Fase 3). Unità: 10 px della v2 = 1 m = 1 unità 3D; corsie, hitbox, velocità e generatore sono quelli della v2.

**Prestazioni mobile:**

- geometrie fuse per prefabbricato (una casa = 1 mesh con 2 materiali), riutilizzo a nastro di case, lampioni, festoni e oggetti (pool), nessuna allocazione per frame nel ciclo;
- particelle in buffer preallocati, schegge in `InstancedMesh`, ombre finte (blob) invece delle shadow map;
- risoluzione limitata a 1,75x; se per 2 s i frame superano 24 ms, la risoluzione scende a passi di 0,25 fino a 1x;
- pausa automatica e niente rendering quando la pagina è in background.

---

## Grafica e personaggio

- **Personaggio 3D (v4):** uomo di mezza età con camicia bianca a maniche arrotolate, gilet scuro con bottoni, pantaloni scuri, scarpe nere e coppola; porta la frakkera (circa 3,4 m, il doppio della sua altezza) sulla spalla destra tenendola con due mani. Modello unico GLB: 9 mesh, 55 ossa, **19.745 triangoli**, texture fino a 1024 px, 1,6 MB. Animazioni: `idle`, `run`, `left`, `right`, `stumble`, `gameover` (rallenta, si ferma, pianta la frakkera e china la testa). In gioco: dissolvenze tra le clip, inclinazione nei cambi corsia sincronizzata con la corsa, velocità della corsa legata alla velocità del gioco, molla sulla frakkera, lampeggio durante l'invulnerabilità, pistola nella mano destra. Se il GLB non si carica resta il billboard della v3.
- **Frakkera:** fascio denso di canne e rami (180 steli, 60 rametti, punta annerita, ramoscelli sporgenti) legato da 7 doppie corde, con estremità irregolari e svasate. La fiamma (4 strati shader), le scintille, il fumo e la luce calda sono in Three.js. Se la frakkera copre ostacoli o tappeti sullo schermo diventa semitrasparente (fino al 38%).
- **Camere:** menu di tre quarti sul personaggio fermo; in corsa dietro e sopra, con la camera che segue la corsia per tenere in quadro portatore e fiamma sul telefono in verticale; al game over camera da dietro più lontana con il personaggio sotto il titolo.
- **Pipeline (`blender/build_character.sh`):** Blender 4.2 headless + MPFB 2.0.8. `step1_human.py` crea l'uomo (macro, proxy, vestiti, coppola, capelli, pelle, scheletro game_engine); `make_textures.py` disegna le texture; `step2_build.py` taglia le maniche e aggiunge i risvolti, costruisce il gilet dal corpo, decima e modella la frakkera; `step3_anim.py` crea presa e IK e anima le 6 clip; `step4_export.py` esporta il glTF; infine `gltf-transform meshopt`. Rigenera il file con `bash blender/build_character.sh` (servono Blender e MPFB in `/workspace/tools`).
- **Villaggio:** case in intonaco caldo e pietra con tetti in coppi, cantonali, finestre con persiane (alcune accese), fioriere, balconi, lanterne, rampicanti, giardini; festoni di bandierine e drappi viola/rossi; colline, paese sul colle, chiesa con campanile e cipressi in lontananza; cielo a gradiente con sole o luna, nuvole e stelle.
- **Atmosfere:** menu al crepuscolo viola-blu con luna; corsa al tramonto dorato; game over più scuro. Passaggio graduale tra le tre.
- **Oggetti:** botti in 3D (in piedi, coricate su zeppe, gruppi, che rotolano) che esplodono in doghe, cerchi, schizzi di vino e polvere; tappeti Sa Burra galleggianti con texture tessuta (4 varianti), bagliore ed effetto di raccolta; pistola Broccu dorata con anello luminoso, vampata, scia del colpo e scossa della camera; fasci di asfodelo e ferula; muretti a secco, pozzanghere, capre, vicoli stretti.
- **Audio:** tutto sintetizzato in `src/systems/audio.js`, come in v2; in v3 la musica si può spegnere separatamente (IMPOSTAZIONI).
- **Font:** Lilita One (titoli) e Baloo 2 (testi), licenza SIL Open Font License 1.1 (`src/assets/fonts3/FONTS-LICENSE.txt`).

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

## Asset esterni e licenze (v4)

| Asset | Fonte | Licenza |
|---|---|---|
| Blender 4.2.9 (solo strumento, non distribuito) | https://download.blender.org/release/Blender4.2/blender-4.2.9-linux-x64.tar.xz | GPL (il materiale prodotto è di chi lo crea) |
| MPFB 2.0.8 (estensione MakeHuman per Blender, solo strumento) | https://github.com/makehumancommunity/mpfb2/releases/download/v2.0.8/mpfb-2.0.8.zip | codice GPL-3.0; i modelli generati sono CC0 |
| makehuman_system_assets: mesh base, proxy `male_generic`, vestito `male_casualsuit03`, scarpe `shoes04`, capelli `short02`, sopracciglia `eyebrow001`, occhi low-poly, pelle `middleage_caucasian_male`, scheletro `game_engine` | https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip | CC0 1.0 |
| Coppola `jujube_newsboy_cap` (pacchetto hats01, autore jujube) | https://files.makehumancommunity.org/asset_packs/hats01/hats01_cc0.zip | CC0 1.0 |
| gltf-transform (solo strumento di compressione) | https://gltf-transform.dev/ | MIT |
| three.js e decoder Meshopt (`three/examples/jsm/libs/meshopt_decoder.module.js`) | https://threejs.org/ | MIT |
| Font Lilita One e Baloo 2 | Google Fonts / @fontsource | SIL OFL 1.1 |

Originali, creati dagli script del progetto: frakkera (geometria e colori), gilet, risvolti delle maniche, bottoni, tutte le texture in `blender/tex/`, le 6 animazioni, la fiamma e gli effetti. Mixamo non è stato usato: con un account Adobe dell'utente potrebbe fornire animazioni di corsa da motion capture più naturali (opzione futura).

## Novità v5 (0.5.0) - il mondo di Gadoni

La corsa attraversa gli ambienti veri di Gadoni, costruiti dalle foto in `reference/gadoni/` (niente caverne di cristalli fantasy):

| Distanza | Ambiente (`id`) | Cosa c'è |
|---|---|---|
| 0-250 m | paese e piazza della chiesa (`village`) | vie del paese della v4, piazza con pavimento a scacchi, campanile in pietra con fasce e cornici rosa, cella campanaria ad arco con campana, orologio bianco, cuspide in coppi con croce, chiesa rosa a capanna, capanna del presepe col tetto d'erba, fili di lampadine dalla cima del campanile |
| 250-500 m | la roccia (`rock`) | sentiero sul fianco della valle, guglia di roccia alta ~100 m, bosco, muretti a secco |
| 500-750 m | fiume e piscina naturale (`river`) | sentiero in lastre di pietra, acqua animata, parete di travertino col muschio e cascatelle, massi bianchi, greto |
| 750-1000 m | viadotto (`viaduct`) | piloni rettangolari alti e snelli in cemento, impalcato lungo e dritto, fiume sotto; il giocatore corre su un sentiero separato, mai sull'impalcato |
| 1000-1150 m | Miniera Fenice, piazzale (`mine-ext`) | parete con reti, arco d'ingresso in pietra con imbocco vero della galleria, porticina laterale, colonna in ferro arrugginito, cartello di legno "MINIERA FENICE", carrello, binari, muro a secco |
| 1150-1350 m | galleria (`mine-int`) | roccia grigio-verde, tubo blu sulla volta, cavi, lampade, perforatrice; buio forte che cresce quando cala la fiamma |
| 1350-1600 m | galleria blu (`mine-blue`) | lastre di roccia sfaccettate blu notte/blu elettrico con macchie ocra, scintille minerali, pavimento bagnato e lucido con binari, centine di legno e lanterne calde in profondità, botti ai lati, pulviscolo sospeso; luce minerale propria |
| oltre 1600 m | si riparte dal paese | ciclo continuo, a ogni giro più verso sera/notte |

- **Solo grafica:** generatore, `sim.js`, collisioni, punteggi, raccolte, log di corsa e controlli sono quelli della v4 (stesso seed => stessa partita). Gli ostacoli cambiano solo "pelle" per ambiente (botti, massi, tronchi, carrelli di minerale, centine...), con la stessa collisione.
- **Transizioni sfumate:** suolo con fusione di 12 m ai confini, cielo/nebbia/luci interpolati, imbocco e uscita della galleria veri.
- **A pezzi (chunk):** si costruisce solo ~190 m davanti e si libera dietro; pezzi riusati da pool; le geometrie pesanti dei monumenti si pre-costruiscono nel menu e alla rimozione si libera la memoria GPU; tutte le luci decorative stanno in un solo draw call.
- **Luce della frakkera** su tutte le superfici vicine; in miniera la luce ambiente cala molto e il buio dipende dal livello del fuoco; la galleria blu ha il suo bagliore minerale.
- **Frakkera che si consuma:** il fascio si accorcia con il carburante; a zero brucia del tutto (game over senza nulla di cruento).
- **Audio d'ambiente** sintetizzato: vento, acqua, gocce in galleria, uccelli, campane della chiesa.

### Aggiornamento v5-stage4: inquadrature e tappeti ufficiali

- **Monumenti dentro l'inquadratura verticale.** Nel telefono in verticale la camera vede solo ~35° in orizzontale e la fiamma della frakkera occupa la parte destra: per questo
  - il **campanile** con chiesa rosa, presepe e fili di luci sta subito a destra della via (x ≈ +10 m), in fondo al rettilineo: si vede da lontano e cresce avvicinandosi;
  - nella **roccia** la valle con la **guglia** è a *sinistra* del sentiero (muretto a secco sul ciglio, parete di roccia a destra), con montagne subito dietro, cielo limpido, foschia ridotta;
  - nel **fiume** la parete di travertino con muschio, le **cascate** e la pozza verde smeraldo sono vicine al sentiero a destra, staccionata a sinistra;
  - il **viadotto** corre quasi parallelo al sentiero, a destra: la fila di piloni si vede davanti;
  - la camera è regolabile per ambiente (`light.camLook`, `light.camFov` in `src/game/biomes/config.js`): un po' più larga e meno inclinata dove servono i monumenti, invariata in miniera. Corsie e gameplay non cambiano.
- **Tappeti Sa Burra ufficiali:** i 4 tappeti veri (`reference/sa-burra-1..4.png`) con lo sfondo bianco reso trasparente (frange mantenute) sono in `public/textures/sa-burra-N.webp` (512 px, ~70 KB) e `sa-burra-N-icon.png` (128 px, icona di HUD/menu/game over). Si usano nel gioco (stesse 4 varianti per indice, proporzioni vere, sRGB, anisotropia) e nell'interfaccia; se un file non si carica resta il disegno procedurale di prima.

### Aggiornamento v5-stage5: passaggi tra ambienti senza "buchi", paese e piscina sui target2, capra e pistola
- **Passaggi senza pop-in**: i pezzi dell'ambiente si costruiscono sempre oltre la distanza visibile (nebbia
  dell'ambiente corrente e di quello successivo, limitata dal piano lontano della camera, + 40 m). Prima la
  costruzione si fermava a 190 m mentre roccia/fiume/viadotto si vedono fino a 340-520 m, quindi i pezzi
  "comparivano" in fondo e si vedeva il cielo attraverso. Entro 150 m tutto e' costruito subito; oltre, a tempo
  (3.5 ms per frame). Oltre 230 m i pezzi ai lati sono in versione leggera (senza sassi/felci/pietre dei muretti)
  e uniti a gruppi di 70 m in una sola mesh; si completano a 210 m. Tratti di suolo da 120 m.
  Shader di tutti gli ambienti (compresi i fondi di passaggio) compilati nel menu; i monumenti pesanti sono
  pre-costruiti nel menu e, se si parte subito, uno alla volta lontano dai confini; ogni monumento nuovo viene
  caricato sulla GPU un frame dopo la costruzione, ancora fuori vista. Sotto l'orizzonte il cielo usa il colore
  della nebbia: un eventuale vuoto lontano si legge come foschia, non come cielo arancione.
- **Paese (target2-villaggio)**: campanile 1.5x, dall'altra parte della via rispetto alla chiesa (poco a sinistra
  del centro, mai dietro la fiamma) su una piazzetta con vasi di fiori e lanterne; ~40 fili di luci a raggiera dalla
  cima; capanna con tetto in coppi e fioriere; grande albero a destra; tramonto piu' dorato, nebbia a 240 m.
- **Piscina naturale (target2-fiume)**: acqua smeraldo fino al bordo del sentiero, parete di travertino muschiata
  alta 27 m e piu' lontana, 7 cascate grandi, massi bianchi e felci sulla riva, alberi grandi chini sul sentiero a
  sinistra, fasci di luce. Il viadotto e la sua valle non si vedono piu' dalla piscina: compaiono in dissolvenza solo
  negli ultimi 45 m prima del viadotto (le due acque restano distinte: il fiume del viadotto non e' cambiato).
- **Capra e pistola**: un colpo fa scappare la capra (balzo, capriola, polvere, poi sparisce; niente sangue),
  +100 punti (`SCORE.GOAT`, meno di una botte), evento `g` nel log della partita. Test: `node tests/sim-goat.test.mjs`.
- Verifica dei passaggi: `python3 tests/transitions.py` (foglio provini per confine in `screenshots/v5s5-transizione-*.png`,
  metriche in `screenshots/v5s5-transizioni-after.json`; `--tag before` contro la versione precedente).

### Aggiornamento v5-stage6: ostacoli dei luoghi, travi basse, velocita' a gradini, piscina (target3)

- **Ostacoli tipici di ogni luogo**, tutti distruttibili con la pistola Broccu (+150, log `o`): in paese botti che **rotolano verso di te** lungo la corsia (rombo e polvere come avviso); sulla roccia **massi che cadono** (prima un anello arancio e l'ombra pulsante sulla corsia, poi il masso cade ~1 s prima e resta come ostacolo); alla piscina **pietre bagnate** (niente danno, ma per 0,9 s il cambio corsia e' lento, log `k`); in miniera **carrelli** lanciati sui binari. Il generatore li mette solo fuori dal sentiero sicuro (le botti/carrelli riservano la corsia per tutto il tratto che percorrono): resta sempre un percorso senza pistola (`tests/generator.test.mjs`).
- **Travi basse** (non distruttibili): archi/balconi fioriti in paese, tronchi caduti su roccia/fiume/viadotto, travi della miniera. **Swipe verso il basso** o **freccia giu' / S** per abbassarsi 0,62 s (input `D` nel log, passaggio `u`, urto -26 di fiamma). Il personaggio corre accovacciato e la frakkera si inclina in avanti. Suggerimento "SCORRI GIU' PER ABBASSARTI" alla prima trave (poi salvato), testo in COME SI GIOCA.
- **Velocita' a gradini**: ogni luogo nuovo +4 px/s (tabella `SPEED_STEPS` in `src/config.js`, tetto 10 gradini) con banner **PIU' VELOCE!** e suono (log `v`). La rampa continua e' piu' dolce (`SPEED_END` 185): a 1600 m ~175 px/s (prima 164).
- **Piscina (solo il bioma fiume)** verso `reference/gadoni/target3-cascata.png`: acqua turchese/smeraldo trasparente che arriva al sentiero con fondale visibile (sassi e chiazze di luce), parete muschiata piu' lontana con 7 cascate grandi e 8 sottili, isolotti con tronco, massi e cespugli low-poly, lastre del sentiero calde arancio-sabbia, inquadratura girata un poco verso l'acqua.
- Registro partita `v: 3` (con `mapOffsetM`). Test: `node tests/sim-s6.test.mjs`.

### Stage 7 — Garag di Pinu
Ad ogni ritorno al villaggio (dal giro 1, ~1600 m) compare per 5 s il pulsante «Entra da Pinu?». Entrando la simulazione si ferma (evento E), si compra con i tappeti di Sa Burra (B: indice*1000+prezzo, max 3 per visita; prezzi in config.js SHOP), «Esci» riprende dopo 3-2-1 (X). Oggetti: Pistola Broccu (3 colpi / +3), Fascio di asfodelo (fiamma piena), Scudo di sughero (para un urto, Z). Offerta scaduta: Q.

### Stage 7b — bancarella di Pinu rifatta
Scena del negozio ricostruita da zero (src/game/shop3d.js) sul riferimento 9:16 reference/gadoni/target2-garage-di-pinu.jpg: bancarella di legno con tetto di assi spesse e gronda, lanterne accese sui pali, zucche appese, muro crema con taglieri, cesti, cassa col tappeto sardo, stendardo, telaio, cassette di frutta, piramide di legno, bancone col telo scozzese e Pinu nuovo; cortile di lastre, muretti, alberi, casa di pietra, cielo. Sole caldo con ombre morbide (solo nel negozio) + AO cotta nei vertici. La camera e' calcolata dall'aspetto e dallo spazio lasciato libero da titolo e pannello (ora tre carte in fila). Logica, prezzi e log invariati. Corretto lo scatto della camera durante il 3-2-1.

### Stage 7c — Garag di Pinu ad alta fedelta'
Geometrie fatte a mano in src/game/shop/ (geo.js: assi smussate/imbarcate con venatura, travi grezze, pietre irregolari, lastre di Voronoi, torniti, tubi; tex.js: vimini, tappeto sardo, scozzese; pinu.js: testa scolpita da sfera deformata con naso, zigomi, arcate, occhi, rughe, coppola, giacca, camicia, braccia e mani giunte). Sole radente con ombre PCF 2048, GTAO (fallback a render semplice), luce rimbalzata, lanterne emissive con alone. Camera inclinata di 9 gradi, distanza/altezza calcolate proiettando tetto e lanterne nella fascia libera. Fumetto di Pinu spostato nel pannello.

### Stage 8 — menu principale
Menu come reference/target-menu.jpg: contatori RECORD / SA BURRA in una pillola in alto, logo FRAKKERA RUN con la striscia di tappeto dietro RUN e il sottotitolo, sfondo 3D dal vivo (via di Gadoni al tramonto, corridore con la frakkera accesa e le scintille) con una camera piu' larga, pulsante GIOCA ORA grande con il triangolo a sinistra, quattro tessere scure (CLASSIFICA, COME SI GIOCA, IS FRAKKERAS, IMPOSTAZIONI) collegate ai pannelli che c'erano gia'. Il gioco non cambia.

### Salto di mappa (sviluppo)

- `?map=village|rock|river|viaduct|mine-ext|mine-int|mine-blue` parte direttamente da quell'ambiente (anche nel menu), es. `index.html?map=mine-blue`.
- `&at=<metri>` parte più avanti dentro l'ambiente, es. `?map=village&at=110` (piazza della chiesa).
- `?dev=1` mostra un menu nascosto con i pulsanti dei 7 ambienti.
- Il salto cambia solo la grafica: la partita (seed, ostacoli, punteggio) è quella normale.

### Dove stanno le configurazioni degli ambienti

- `src/game/biomes/config.js`: un oggetto per ambiente (distanze, suolo, lati, vuoti, galleria, monumenti, pelli degli ostacoli, decorazioni, atmosfera cielo/nebbia/luci, luce della frakkera e buio, audio, lunghezza della transizione).
- `src/game/biomes/env.js`: gestore dei pezzi (suolo, lati, galleria, decorazioni, monumenti), materiali e fusioni.
- `src/game/biomes/builders/`: `church.js` (piazza, campanile, chiesa, presepe; isolata in funzioni proprie), `nature.js` (valle, guglia, piscina, cascate), `structures.js` (viadotto, galleria, imbocco della miniera, perforatrice), `skins.js` (pelli degli ostacoli), `common.js` (rocce, alberi, muretti).
- `src/game/biomes/textures.js`: texture procedurali (sentieri, ghiaia con traversine, cartello, reti).

Test aggiuntivi: `python3 tests/maps.py` (screenshot di ogni ambiente col salto di mappa) e `python3 tests/views.py` (inquadrature dei monumenti per il confronto con le foto).

## Novità v4 (0.4.0)

1. **Personaggio 3D vero** al posto del billboard: uomo con scheletro, vestiti del concept, frakkera 3D legata con corde, fiamma shader; 6 animazioni con macchina a stati e dissolvenze.
2. **Camere riviste** per il telefono in verticale (menu, corsa, game over) e trasparenza della frakkera quando copre gli oggetti.
3. **Game over animato:** il portatore rallenta, pianta la frakkera e la fiamma si spegne in fumo.
4. **Inciampo** visibile all'urto, con scintille e scossa.
5. Gameplay, generatore e punteggi invariati.

## Novità v3 (0.3.0)

1. **Mondo 3D in tempo reale** (Three.js): camera in terza persona dietro al portatore, strada lastricata a 3 corsie verso l'orizzonte, stile cartoon low-poly, luce del tramonto, nebbia, ombre morbide finte.
2. **Personaggio invariato** come billboard pixel art, con luce sulla fiamma e scintille 3D.
3. **Villaggio sardo** ridisegnato, botti/tappeti/pistola/fasci in 3D con effetti di rottura e raccolta.
4. **Interfaccia nuova** non pixel: logo a lettere grosse con fascia tessuta, GIOCA ORA giallo-arancio, quattro tasti (CLASSIFICA, COME SI GIOCA, IS FRAKKERAS, IMPOSTAZIONI con audio e musica), targa del record; HUD con pausa rotonda, barra della fiamma a pillola, pannelli per punti/record, tappeti e colpi; game over "FIAMMA SPENTA" con conteggio animato, nastro NUOVO RECORD!, righe con icone, nickname, RIPROVA grande, CLASSIFICA e MENU; animazioni di entrata.
5. **Tutto il gameplay della v2 è invariato** (stessa simulazione, stesso generatore, stessi punteggi e tetti, stesso registro v2).

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
- [x] Mobile-first in verticale; su desktop una colonna centrata. Area sicura per il notch (`viewport-fit=cover`).
- [x] Testato in Chrome headless (mobile + desktop; in v4 138 controlli). La v2 era stata provata anche in Firefox; la v3 non ancora.

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
- **registro degli input**: elenco `[passo, direzione]`, raccolto in `Sim.inputs` (`src/game/sim.js`). In v2 anche gli spari: `[passo, 'F']`.
- **registro degli eventi** (v2): `Sim.events`, elenco `[passo, codice, valore]`. Codici: `f` fascio raccolto, `x` catena, `c` tappeto, `p` pistola, `b` botte distrutta, `h` urto, `w` pozzanghera, `n` per un pelo, `m` traguardo, `s` sopravvivenza, `cap` punti tagliati dal tetto. Il game over passa `log: {v: 2, seed, steps, inputs, events}`: il server potrà rigiocare la partita e confrontare evento per evento, non solo il totale.

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
- Testato in Chrome headless (rendering software); la v2 anche in Firefox, la v4 non ancora. **Safari/iOS non è stato verificato su un dispositivo reale.** Il codice tiene già conto delle particolarità iOS (sblocco audio nel gesto, `visualViewport`, niente zoom o scroll), ma resta da provare in Fase 4.
- Su schermi in orizzontale il gioco resta una colonna verticale centrata. Non c'è un avviso "ruota il telefono", che può arrivare in Fase 4.
- Il 2,6% circa dei tappeti si trova in scie fuori dal sentiero che a velocità alta possono essere irraggiungibili senza rischi: è voluto (scelta rischio/ricompensa), ma si può ridurre con `CARPETS.OFFPATH_SHARE`.
- Il mondo 3D è generato via codice: leggero e coerente, ma meno ricco di asset fatti a mano. L'unico modello esterno è il personaggio (vedi licenze).
- Il personaggio 3D è realistico (MakeHuman), non stilizzato come il concept: più snello e meno tozzo, viso meno caratterizzato. Il gilet è ricavato dal corpo (niente revers o tasche). Le mani stringono la frakkera in modo approssimato (IK, dita solo piegate). Le animazioni sono fatte a mano via script, non motion capture: in qualche fotogramma la frakkera tocca la gamba. Da dietro la sagoma (coppola, maniche bianche, gilet scuro, frakkera sulla spalla destra) si legge, ma sul telefono il personaggio è piccolo. La frakkera è più chiara e regolare di quella della foto. Un modello stilizzato commissionato a un artista (e animazioni mocap) migliorerebbe molto la fedeltà.
- Prestazioni misurate solo in Chrome headless con WebGL software (SwiftShader): lì il tempo di frame è dominato dalla CPU che emula la GPU (circa 50-110 ms) e non è rappresentativo; il lavoro JavaScript per frame è di circa 3-4 ms (p95). Circa 270-320 draw call e 190-200 mila triangoli in corsa (il personaggio: 9 draw call e 19.745 triangoli, più 4 quadrati per la fiamma): vanno verificati su telefoni reali di fascia media; se serve si possono ridurre i dettagli delle case lontane.
- Il bundle JS supera i 500 KB non compressi (Three.js): Vite lo segnala, ma compresso sono circa 211 KB.
- Il testo sulla tradizione è volutamente breve e generale e va validato con gli organizzatori.

## v5 stage 10: le maschere del carnevale di Gadoni (Giobia Lardaiolu)
Ostacoli del paese (non Mamuthones), dalle fonti in `reference/gadoni/` (Gadoni2009.pdf, foto del gruppo, figura velata, stendardo):
- **su Maimoni**: abiti scuri e pelli di capra/pecora, corna di capra, maschera di lana di pecora, campanacci sulla schiena con imbragatura di corda, spiedo col lardo. Carica a zig-zag rimbalzando tra le corsie (finestra calma come la capra).
- **Stramaionis**: stracci scuri, mantello di orbace scuro o grigio-beige col cappuccio, viso di fuliggine, bastone/forcone/clava. In coppia tengono una **fune tesa su 2 corsie**: ci si abbassa (non c'e' il salto nel gioco) oppure si va nella terza corsia, sempre libera.
- **sa Grastula**: vedova in stracci scuri, velo nero (sa facciola), conocchia con la lana bianca. A bordo strada lancia il **fuso**: segno rosso a terra ~1 s prima che arrivi sulla corsia (mai sul sentiero sicuro).
- **Campanacci posizionali**: ritmo di scuotimento (piu' fitto per Maimoni) che cresce di volume avvicinandosi e va a destra/sinistra secondo la corsia; urto = campanacci che risuonano forte.
- La pistola le **attraversa** senza effetto. Urto: carburante (Maimoni 24, fune 16, fuso 14). Corteo intero passato senza urti: **BRAVU! +200**.
- Solo nel paese, piu' frequenti nei giri successivi (`MASKS` in config.js). Registro: `q` nuovo corteo, `j` fune passata abbassandosi, `J` fuso lanciato, `M` bonus corteo, `h` urto.
- Stendardo di cuoio "Ass. Culturale Maimoni e Grastula - Gadoni" con la testa di capra, a bordo via prima della piazza.
- Test: `tests/sim-masks.test.mjs` (nuovo), `tests/generator.test.mjs` (cortei completi, solo nel paese, percorso sempre libero). Screenshot: `screenshots/v5s10-*`.

## v5 stage 11: ballu tundu nella piazza della chiesa
- **Una volta per giro** a 150 m dentro il paese (piazza della chiesa). ~2.5-3 s prima: launeddas e coro a tenore generati, popup "BALLU TUNDU!", la corsa rallenta e si vede il cerchio.
- **Cerchio** di 9 ballerini nel costume di Gadoni (`reference/gadoni/costume-gadoni.jpg`): donne con velo di pizzo bianco, giacca verde scuro bordata di rosso e giallo, polsini di pizzo, gonna rosso scuro con orlo verde, grembiule nero col bordo a fiori; uomini con berritta nera alta, camicia bianca e nastrino rosso, gilet nero coi bottoni d'argento, giacca scura foderata di rosso, cintura di cuoio, gonnellino nero plissettato su calzoni bianchi larghi, gambali neri. Braccia allacciate, passo a tempo con saltello sul battere, il cerchio ondeggia; il corridore entra nel posto davanti con la **frakkera alzata**. A fine ballo il cerchio si apre e si passa in mezzo.
- **Minigioco a ritmo**: frecce (sinistra/giu'/su'/destra) che scorrono sul battito; swipe, frecce/WASD o tocco sui bersagli. PERFETTO / BENE / MANCATO + combo. 2 giri di ~9 s; il tempo sale a ogni giro della corsa (96, 106, 116... BPM, +8% nel secondo giro, controtempi dai giri successivi).
- **Premi**: punti (con moltiplicatore di combo + bonus combo massima), 1 tappeto ogni 6 Perfetto (max 3), la fiamma cresce a ogni colpo e alla fine. **Fallito** (meno del 50% di colpi): niente bonus e -6 di carburante, nient'altro.
- **SALTA** (in alto a destra, anche durante il cue): nessuna penalita'.
- Musica generata a tempo: tumbu e mancosa (bordone), mancosedda a terzine, tamburo e sonagli.
- Deterministico (spartito da seed + giro, passi fissi). Registro: `A` cue/inizio, `P` perfetto, `H` bene, `N` mancato, `Y` fine (punti), `K` saltato; input `a` (direzione), `K`.
- Test: `tests/sim-dance.test.mjs` (nuovo), e2e con i controlli del ballo (negli altri controlli il ballo viene saltato). Screenshot: `screenshots/v5s11-*`.

## v5 stage 11b: Pinu rifatto (mesh a faccette da Blender)
- Modellato in **Blender headless** (`tools/pinu_blender.py`, `blender -b -P tools/pinu_blender.py -- public/models/pinu.glb`): ogni pezzo e' un convex hull di punti (faccette vere), colori per faccia con pieghe piu' scure, ~930 facce, GLB 96 KB caricato in anticipo.
- Sul riferimento dell'utente: faccia lunga e spigolosa, mascella forte, sopracciglia scure piegate (sguardo severo), bocca dritta, **niente baffi ne' sorriso**, coppola piatta con visiera, spalle larghe e spioventi, giacca antracite a pieghe con risvolti, camicia bianca e cravatta, mani grandi a dita intrecciate sul tavolo.
- Luce calda di lato (spot da sinistra) nel negozio. Confronto: `screenshots/v5s11b-pinu-confronto.png`.
- Fix: il testo PERFETTO/BENE del ballo era spostato a sinistra (la classe `pop` collideva con quella dei popup).
