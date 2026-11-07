# FRAKKERA RUN v5 - audit stage 9 (390x844 e 360x640, tutti gli ambienti via ?map=&at=)

| # | Gravita' | Dove | Riproduzione | Stato | Screenshot |
|---|---|---|---|---|---|
| 1 | Alta | Miniera (ext/int/blu) | ?map=mine-int&at=60 | CORRETTO: luce ambiente, esposizione, lampade e nebbia piu' alte; buio legato alla fiamma ma con soglia minima | screenshots/v5s9-miniera-prima-dopo.png |
| 2 | Media | Fiume, orizzonte: blocco chiaro | ?map=river&at=150 | ATTENUATO: colore nebbia accordato al cielo; resta un'ombra leggerissima (geometria lontana ~500 m) | screenshots/v5s9-fiume-orizzonte.png |
| 3 | Media | Avvio corsa prima del caricamento GLB | GIOCA ORA subito su rete lenta: solo fiamma, niente corridore | CORRETTO: si aspetta il modello (max 10 s, schermata ACCENSIONE) | - |
| 4 | Media | Pinu (negozio) | entrare da Pinu | CORRETTO: ripartito dal 7b a blocchi, verso il riferimento | screenshots/v5s9-pinu-closeup.png |
| 5 | Bassa | Console: "toNonIndexed(): already non-indexed" (spam in tutti gli ambienti) | qualsiasi mappa | CORRETTO (builders/common.js) | - |
| 6 | Bassa | Console: GL_INVALID_VALUE glTexSubImage2D "Offset overflows" (paese e miniere) | ?map=village / mine-* | APERTO: aggiornamento di una texture dinamica fuori misura; nessun effetto visibile notato | - |
| 7 | Bassa | Prestazioni: scatti 500-1000 ms nei primi secondi dopo un salto di mappa (compilazione shader / costruzione blocchi) | qualsiasi ?map= | APERTO -> stage 12 | screenshots/audit/ |
| 8 | Bassa | Galleria: fascia nera/soffitto che taglia la parte alta all'ingresso | ?map=mine-int&at=60, mine-ext&at=140 | APERTO (stage 12) | screenshots/audit/s9-mine-int-60.png |
| 9 | Bassa | Test e2e: controllo "colpi sparati / colpi a zero" dipende da una botte in vista | e2e | ATTENUATO (controllo dello zero anche fuori dal ramo di sparo); ogni tanto ancora instabile | - |
| 10 | Info | Lampeggio del corridore con invulnerabilita' nelle catture di test | solo strumenti | non e' un bug di gioco | - |

Pannelli del menu, negozio (offerta/acquisto/ESCI/3-2-1), game over, salvataggi tappeti: verificati dai test (150/150) senza errori.
