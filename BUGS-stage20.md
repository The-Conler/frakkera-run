# Stage 20 - caccia ai bug (stage 16-19)

I playtested at 390 and 360 px: every biome (with a bot and fuel kept topped up), the cart ride, the ballu tundu, the shop, game over, retry, the 5-tile menu, COSTUMI and the Stramaioni skin.
Scripts: tests/play_s20.py, tests/ui_s20.py. Screenshots: screenshots/v5s20-before-* / v5s20-after-*.

## Fixed
1. **Minecart: the runner seemed to jump out of the cart when switching track.** The parked cart you boarded came back into view when you swiped (it only hid within 40 px of the current lane). The parked carts also sat ~15 m before the boarding point, so you ran through them. And the left/right lean clips (half weight) pushed the body sideways out of the cart.
   Fix: the parked carts now stand right at the boarding point. Only the one you boarded disappears, and it stays hidden. In the cart the character uses the standing pose only (no lean or stumble clips), sits lower (legs hidden by the sides), and the cart and runner move together.
2. **Minecart: sudden speed jump on boarding (83 -> 101) and on exit (105 -> 86).** The speed now ramps smoothly in both directions.
3. **Minecart: SCAMBI score was unfair.** One crash cancelled every junction already on screen (the junction was "good" only if the global hit count hadn't changed). Each junction now only counts crashes into its own broken tracks. Before: SCAMBI 0/5; after: 3/5 with the same play.
4. **Minecart: after death mid-ride, the empty cart from the previous run kept rolling into the new run.** It's now reset at start and when returning to the menu. A sim test checks death in the cart plus retry.
5. **Stramaioni inside the ballu tundu (user report).** (a) The mask parade (Maimoni, Stramaionis with the rope, sa Grastula) could start or continue inside the church-square dance circle: 15 in 200 seeds. The generator now keeps the parade out of the dance zone (0 in 200 seeds, test). (b) The player in the Stramaioni skin danced among the costumed dancers. During the dance the runner now wears the festive outfit (with a puff of smoke) and puts the costume back on afterwards.
6. **BALLU TUNDU title overlapped the HUD (fuel bar, carpets) and the SALTA button.** It's moved below them.
7. **Blank blue frame (whole screen) on slow phones.** The adaptive resolution changed size at the end of the frame, which cleared the canvas until the next frame. The change is now applied just before the render.
8. **360 px menu with 5 tiles: labels squashed or cut off** (IMPOSTAZIONI, COME SI GIOCA). The font is bigger, labels wrap onto 2 lines, and IMPOSTAZIONI hyphenates (IMPOSTA-ZIONI).
9. **360 px COSTUMI: the Stramaioni text was squeezed into a narrow column by the MANCANO label.** The button/label now goes under the text on narrow screens, and MANCANO only shows what is missing.

## Checked, no bug found
- Collectibles: pickup, popup, sound, saved count after reload, count shown in COSTUMI.
- Skin: selection persists after reload, +8% speed (sim test), shown in menu and in the run.
- Lamps light up (stats.lamps 4-11 per run) and miners show up.
- Retry after game over and after the shop: no leftover state (cart, dance, shop, ammo).
- No page errors or console errors.
- Performance: CPU frame time is normal in every biome (SwiftShader).

## Not fixed / notes
- WebGL warning `glTexSubImage2D: Offset overflows texture dimensions` (one per session, SwiftShader). No visible effect; source not identified.
- A hit slows you down a lot (from ~100 to ~55 in the cart): it's by design, but in the cart it feels like a hard brake (see improvements).
- "PIU VELOCE!" can show up together with "SCAMBI x/y" at the cart exit (overlapping popups).
- Next after the fixes (approved): **Sa Grastula as the third mask/skin**. Not started.
