// v5s46c QA gate: funzioni iniettate nella pagina (?test=1). Nessun effetto sul gioco in produzione.
(() => {
  const F = window.__frk, G = F.game, Wd = G.world, S = G.sim, E = Wd.env, Q = Wd.qa;
  const qa = window.__qa = { log: [] };
  const RC = new Q.Raycaster(), V = (x, y, z) => new Q.Vector3(x, y, z);
  qa.m = () => S.runD / 10 + (S.mapOffsetM || 0);
  qa.local = () => ((qa.m() % 1600) + 1600) % 1600;
  qa.keep = () => { if (S.mode === 'run') { S.fuel = 100; S.invuln = Math.max(S.invuln || 0, 2); } if (S.mode === 'dance') try { S.skipDance(); } catch (e) { /* */ } if (S.mode === 'shop') try { G.exitShop(); } catch (e) { /* */ } };
  setInterval(qa.keep, 30);
  qa.ff = (target, per = 30) => new Promise((res) => {
    const t0 = performance.now();
    const step = () => {
      if (qa.m() >= target || S.mode === 'over' || performance.now() - t0 > 240000) return res(qa.m());
      for (let i = 0; i < per; i++) { qa.keep(); if (S.mode === 'run') S.tick(1 / 120); if (qa.m() >= target) break; }
      requestAnimationFrame(step);
    };
    step();
  });
  qa.frames = (n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  // ---------- classificazione oggetti
  const viewSet = () => { const s = new Set(); for (const [, v] of Wd.views) v.root.traverse((o) => s.add(o)); return s; };
  const chainVisible = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  // scenografia = solo cio' che appartiene all'ambiente (terreno, lati, galleria, monumenti, chiesa, albero, presepe)
  qa.tagged = () => {
    const roots = [];
    const add = (o, tag) => { if (o) roots.push([o, tag]); };
    for (const sg of E.ground || []) for (const m of sg.meshes || []) add(m, 'ground');
    for (const sd of E.sides) for (const p of sd.list) { add(p.mesh, 'side:' + (p.key || 'own')); for (const m of p.extra || []) add(m, 'side-extra'); }
    for (const [, b] of E.batches) add(b.mesh, 'batch');
    for (const p of E.center) { add(p.mesh, 'tunnel'); for (const m of p.extra || []) add(m, 'tunnel-extra'); }
    for (const p of E.decor) add(p.mesh, 'decor');
    for (const [k, mk] of E.marks) add(mk.root, 'mark:' + k.split('@')[0]);
    add(Wd.vista, 'vista'); add(Wd.burraTree, 'burraTree'); add(Wd.nasc && Wd.nasc.root, 'nascimentu');
    for (const k of ['tower', 'towerModel', 'benches', 'bench', 'panda']) { const o = Wd[k]; if (o && o.isObject3D) add(o, k); }
    const out = [];
    for (const [r, tag] of roots) r.traverse((o) => {
      if (!o.isMesh || !chainVisible(o)) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (m && m.transparent && m.depthWrite === false) return;
      if (o.position.y < -400) return;
      o.userData.qaTag = tag; out.push(o);
    });
    return out;
  };
  qa.scenery = () => qa.tagged();
  // box dei soli mesh visibili (le varianti nascoste nel pool non contano)
  qa.visBox = (root) => { const b = new Q.Box3(), t = new Q.Box3(); root.updateMatrixWorld(true); root.traverse((o) => { if (!o.isMesh || !chainVisible(o) || !o.geometry) return; const m = Array.isArray(o.material) ? o.material[0] : o.material; if (m && m.transparent && m.depthWrite === false) return; if (o.geometry.type === 'PlaneGeometry' && o.position.y < 0.12 && Math.abs(o.rotation.x + Math.PI / 2) < 0.01) return; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); t.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); b.union(t); }); return b; };
  const hitFirst = (orig, dir, far, objs) => { RC.set(orig, dir.clone().normalize()); RC.far = far; RC.near = 0; const h = RC.intersectObjects(objs, false); return h[0] || null; };
  // ---------- 1) buchi: pixel di "vuoto" sotto l'orizzonte (cielo nascosto, fondo magenta), e pannelli piatti di riempimento visibili
  qa.voids = () => {
    const r = Wd.renderer, cam = Wd.camera, sc = Wd.scene;
    const prevBg = sc.background, skyV = Wd.sky.visible, undV = Wd.under ? Wd.under.visible : false, fills = (Wd._sideFill || []).map((m) => [m, m.material.color.clone()]);
    sc.background = new Q.Color(1, 0, 1); Wd.sky.visible = false; if (Wd.under) Wd.under.visible = false;
    for (const [m] of fills) m.material.color.setRGB(0, 1, 1);
    const fog = sc.fog; sc.fog = null;
    r.render(sc, cam);
    const gl = r.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    sc.background = prevBg; Wd.sky.visible = skyV; if (Wd.under) Wd.under.visible = undV; sc.fog = fog; for (const [m, c] of fills) m.material.color.copy(c);
    let holes = 0, fill = 0, total = 0, hb = null; const step = 2, dir = V(0, 0, 0);
    for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4, R = px[i], Gc = px[i + 1], B = px[i + 2]; total++;
      dir.set((x / w) * 2 - 1, (y / h) * 2 - 1, 0.5).unproject(cam).sub(cam.position).normalize();
      if (dir.y > -0.035) continue;                                  // sopra (o vicino) all'orizzonte: cielo ammesso
      if (R > 200 && Gc < 60 && B > 200) { holes++; if (!hb) hb = [x, h - y, x, h - y]; else { hb[0] = Math.min(hb[0], x); hb[1] = Math.min(hb[1], h - y); hb[2] = Math.max(hb[2], x); hb[3] = Math.max(hb[3], h - y); } }
      else if (R < 40 && Gc > 200 && B > 200) fill++;
    }
    return { holes: holes / total, fill: fill / total, hb, w, h };
  };
  // autoverifica del rilevatore: senza terreno e lati i buchi DEVONO comparire
  qa.voidsSelfTest = () => { const hid = []; for (const o of qa.tagged()) if (o.visible) { o.visible = false; hid.push(o); } const r = qa.voids(); for (const o of hid) o.visible = true; return r; };
  // ---------- 2) luci senza supporto: ogni bagliore deve avere una lampada/supporto entro ~0.9 m
  const DIRS = []; for (let i = 0; i < 26; i++) { const t = Math.acos(1 - 2 * (i + 0.5) / 26), p = Math.PI * (1 + Math.sqrt(5)) * i; DIRS.push(V(Math.sin(t) * Math.cos(p), Math.cos(t), Math.sin(t) * Math.sin(p))); }
  qa.lamps = (range = 70) => {
    const objs = qa.scenery(), cz = Wd.camera.position.z, bad = [];
    let n = 0;
    for (const g of E.glows) {
      if (!g.visible) continue; const p = g.position; if (p.z > cz + 2 || p.z < cz - range) continue; n++;
      let best = 99;
      for (const d of DIRS) { const hh = hitFirst(p, d, 1.2, objs); if (hh && hh.distance < best) best = hh.distance; if (best < 0.9) break; }
      if (best >= 0.9) bad.push({ x: +p.x.toFixed(2), y: +p.y.toFixed(2), m: +(-p.z).toFixed(1) });
    }
    return { n, bad };
  };
  // ---------- 3) appoggio a terra di ostacoli, persone, animali, oggetti; raccoglibili non sepolti
  const MOVERS = new Set(['goat', 'caprarupe', 'capra', 'pecora', 'sheep', 'maialetto', 'pig', 'rollbarrel', 'rollin', 'tronco', 'cane', 'dog', 'maimoni']);
  const ROLLING = new Set(['rollin', 'rollbarrel']);   // botti che rotolano: il riquadro della botte ruotata scende sotto il suolo, la botte no
  const HANG = new Set(['panni', 'fune', 'trave', 'festone', 'scambio', 'lampada', 'ciccio', 'narrow', 'deadend', 'processione']);
  qa.ground = (range = 60) => {
    const objs = qa.scenery(), cz = Wd.camera.position.z, bad = []; let n = 0;
    for (const e of S.entities) {
      const v = Wd.views.get(e.id); if (!v || !v.root.visible || e.done) continue;
      const kind = e.kind; if (HANG.has(kind) || HANG.has(v.kind)) continue;
      const body = v.body || v.root; if (!chainVisible(body)) continue;
      const box = qa.visBox(body); if (box.isEmpty()) continue;
      const c = box.getCenter(V(0, 0, 0)); if (c.z > cz - 4 || c.z < cz - range) continue;
      if (isFinite(e.my) && e.my) continue;                       // in aria per scelta (salto, volo)
      n++;
      const qx = (box.max.x - box.min.x) * 0.25, qz = (box.max.z - box.min.z) * 0.25;
      const pts = [[c.x, c.z], [c.x - qx, c.z], [c.x + qx, c.z], [c.x, c.z - qz], [c.x, c.z + qz]];
      const y0 = box.min.y + Math.min(1.0, (box.max.y - box.min.y) * 0.5 + 0.2), hs = [];
      const sup = v.perch && v.perch.visible ? objs.concat([v.perch]) : objs;   // capra della roccia: aspetta sul suo masso
      for (const [x, z] of pts) { const hh = hitFirst(V(x, y0, z), V(0, -1, 0), 6, sup); if (hh) hs.push(hh.point.y); }
      if (!hs.length) { bad.push({ kind, why: 'no-ground', m: +(-c.z).toFixed(1), x: +c.x.toFixed(2), minY: +box.min.y.toFixed(2) }); continue; }
      hs.sort((a, b) => a - b); const gy = hs[Math.floor(hs.length / 2)];
      const gap = box.min.y - gy;
      if (e.pickup) { if (gap < -0.03) bad.push({ kind, why: 'buried', gap: +gap.toFixed(2), m: +(-c.z).toFixed(1) }); }
      else if (gap > (MOVERS.has(kind) ? 0.35 : 0.1)) bad.push({ kind, why: 'float', gap: +gap.toFixed(2), m: +(-c.z).toFixed(1), x: +c.x.toFixed(2) });
      else if (gap < -0.3 && !(MOVERS.has(kind) && Math.abs(c.x) > 5.4) && !ROLLING.has(kind)) bad.push({ kind, why: 'sink', gap: +gap.toFixed(2), m: +(-c.z).toFixed(1), x: +c.x.toFixed(2) });   // animali che entrano dal pendio: fuori dalla via
    }
    return { n, bad };
  };
  // ---------- 4) scenografia nelle corsie (0.3-4.2 m) e sopra la via del paese (fili, ponti: 4.2-10 m)
  const seen = new WeakMap();
  qa.corridor = (range = 120, opts = {}) => {
    const cz = Wd.camera.position.z, out = { lane: [], over: [] }, P = V(0, 0, 0);
    const allowOver = opts.allowOver || (() => false), allowLane = opts.allowLane || (() => false);
    for (const o of qa.scenery()) {
      const g = o.geometry; if (!g || !g.attributes.position) continue;
      o.updateMatrixWorld(); const A = g.attributes.position, mw = o.matrixWorld;
      const sig = mw.elements.join(',') + g.uuid + (g.drawRange.start || 0); if (seen.get(o) === sig) continue; seen.set(o, sig);
      let nl = 0, no = 0, ex = null;
      for (let i = 0; i < A.count; i++) {
        P.fromBufferAttribute(A, i).applyMatrix4(mw);
        if (P.z > cz + 1 || P.z < cz - range) continue;
        const ax = Math.abs(P.x);
        if (ax < 4.6 && P.y > 0.3 && P.y < 4.2 && !allowLane(P, o)) { nl++; ex = ex || [+P.x.toFixed(2), +P.y.toFixed(2), +(-P.z).toFixed(1)]; }
        else if (opts.over && ax < 3.6 && P.y >= 4.2 && P.y < 10 && !allowOver(P, o)) { no++; ex = ex || [+P.x.toFixed(2), +P.y.toFixed(2), +(-P.z).toFixed(1)]; }
      }
      if (nl) out.lane.push({ n: nl, ex, tag: o.userData.qaTag });
      if (no) out.over.push({ n: no, ex, tag: o.userData.qaTag });
    }
    return out;
  };
  // ---------- 5) monumento ai caduti visibile (160-200 m): i raggi dalla camera arrivano al gruppo di bronzo/piedistallo
  qa.memorial = () => {
    const key = [...E.marks.keys()].find((k) => k.startsWith('vicolo@')); if (!key) return { skip: 'no-mark' };
    const mk = E.marks.get(key), mesh = mk.root.children[0]; mk.root.updateMatrixWorld(true);
    const A = mesh.geometry.attributes.position, P = V(0, 0, 0), sets = { statue: [], base: [] };
    for (let i = 0; i < A.count; i += 3) { P.fromBufferAttribute(A, i); if (P.x < -6 && P.z < -14 && P.z > -28) { if (P.y > 5.8) sets.statue.push(P.clone()); else if (P.y > 2.2 && P.y < 5.2) sets.base.push(P.clone()); } }
    const objs = qa.scenery(), cam = Wd.camera.position, res = {};
    for (const k in sets) {
      const L = sets[k]; if (!L.length) continue; const c = L.reduce((a, b) => a.add(b), V(0, 0, 0)).multiplyScalar(1 / L.length).applyMatrix4(mesh.matrixWorld);
      const d = c.clone().sub(cam), dist = d.length(), hh = hitFirst(cam.clone(), d, dist + 2, objs);
      res[k] = { dist: +dist.toFixed(1), hit: hh ? +hh.distance.toFixed(1) : null, ok: !!hh && hh.distance > dist - 1.6, by: hh && hh.object !== mesh ? (hh.object.name || 'other') : 'self' };
    }
    return res;
  };
  // ---------- 6) superfici piatte coincidenti (z-fighting): tappeti, pozzanghere, passatoie
  qa.zfight = (range = 60) => {
    const cz = Wd.camera.position.z, flats = [];
    Wd.scene.traverse((o) => { if (!o.isMesh || o.isInstancedMesh || !chainVisible(o) || !o.geometry) return; const b = new Q.Box3().setFromObject(o); if (b.isEmpty()) return; if (b.max.y - b.min.y > 0.004 || b.min.y > 1.5 || b.max.y < -0.5) return; if (b.max.z < cz - range || b.min.z > cz + 2) return; const m = Array.isArray(o.material) ? o.material[0] : o.material; if (m && (m.polygonOffset || m.depthTest === false)) return; flats.push({ o, b }); });
    const bad = [];
    for (let i = 0; i < flats.length; i++) for (let j = i + 1; j < flats.length; j++) {
      const a = flats[i].b, b = flats[j].b; if (Math.abs(a.min.y - b.min.y) > 0.003) continue;
      const dw = (o) => { const m = Array.isArray(o.material) ? o.material[0] : o.material; return !m || m.depthWrite !== false; };
      if (!dw(flats[i].o) && !dw(flats[j].o)) continue;   // due velature senza scrittura di profondita' non possono sfarfallare tra loro
      if (a.max.x <= b.min.x || b.max.x <= a.min.x || a.max.z <= b.min.z || b.max.z <= a.min.z) continue;
      bad.push({ y: +a.min.y.toFixed(3), m: +(-(a.min.z + a.max.z) / 2).toFixed(1), a: flats[i].o.name || flats[i].o.parent?.name || '?', b: flats[j].o.name || flats[j].o.parent?.name || '?' });
    }
    return { n: flats.length, bad };
  };
  // ---------- 7) binari continui nelle 3 corsie (miniera): sotto ogni rotaia c'e' un ferro sopra il piano
  // da a a b metri DAVANTI al corridore (coordinate del mondo: la z non conta il giro/la mappa di partenza)
  qa.rails = (a, b) => {
    const objs = qa.scenery(), bad = [], z0 = S.T * 0.1, lim = 1597.5 - qa.local(); let n = 0;   // il gioco corre tra una chiamata e l'altra: mai oltre la fine della miniera
    b = Math.min(b, lim);
    for (const lx of [-3.4, 0, 3.4]) for (const off of [-0.55, 0.55]) for (let d = a; d < b; d += 0.5) {
      const z = z0 + d, hh = hitFirst(V(lx + off, 2.5, -z), V(0, -1, 0), 4, objs); n++;
      if (!hh || hh.point.y < 0.06) bad.push([lx + off, +(qa.local() + d).toFixed(1), hh ? +hh.point.y.toFixed(2) : null]);
    }
    return { n, bad };
  };
  // HUD: blocchi principali non sovrapposti, dentro lo schermo, testi leggibili; SPARA non copre la corsia destra; popup non sovrapposti
  const HUD_SEL = ['#hud-pause', '#hud-audio', '#fuel', '.hud-dist', '.chip-score', '#hud-carpets-cell', '#hud-ammo', '#hud-magnet', '#hud-fennel', '#hud-boots', '#fire-btn', '#shop-offer'];
  const vis = (e) => { if (!e) return false; const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05 && !e.closest('.hidden'); };
  qa.hud = () => {
    const boxes = []; for (const sel of HUD_SEL) for (const e of document.querySelectorAll(sel)) if (vis(e)) boxes.push({ id: sel, r: e.getBoundingClientRect(), e });
    const ov = (a, b, pad = 1) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > pad && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > pad;
    const over = []; for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (ov(boxes[i].r, boxes[j].r)) over.push([boxes[i].id, boxes[j].id]);
    const off = boxes.filter((b) => b.r.left < -1 || b.r.top < -1 || b.r.right > innerWidth + 1 || b.r.bottom > innerHeight + 1).map((b) => b.id);
    const small = [];
    for (const b of boxes) for (const t of [b.e, ...b.e.querySelectorAll('*')]) { if (!vis(t) || ![...t.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue; const fs = parseFloat(getComputedStyle(t).fontSize); if (fs < 9.5) small.push([b.id, fs, t.textContent.trim().slice(0, 12)]); }
    const pops = [...document.querySelectorAll('.pop')].filter(vis).map((e) => ({ t: e.textContent, r: e.getBoundingClientRect() }));
    const popOver = []; for (let i = 0; i < pops.length; i++) for (let j = i + 1; j < pops.length; j++) if (ov(pops[i].r, pops[j].r, 4)) popOver.push([pops[i].t, pops[j].t]);
    let fireLane = 0; const fb = document.querySelector('#fire-btn');
    if (vis(fb)) { const r = fb.getBoundingClientRect(), pz = -S.T * 0.1; for (let d = 4; d <= 40; d += 2) { const [x, y, z] = qa.project(3.4, 0.6, pz - d); if (z < 1 && x > r.left && x < r.right && y > r.top && y < r.bottom) fireLane++; } }
    return { n: boxes.length, over, off, small, popOver, fireLane, vw: innerWidth, vh: innerHeight };
  };
  qa.project = (x, y, z) => { const p = V(x, y, z).project(Wd.camera); return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight, p.z]; };
})();
