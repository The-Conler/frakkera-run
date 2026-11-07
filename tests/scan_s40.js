// v5s40: scansione a runtime (nel browser): case/prefab nelle 3 corsie, tronchi caduti fuori posto.
(() => {
  const g = window.__frk.game, w = g.world, env = w.env, sim = g.sim;
  const R = 5.5 - 0.15;           // carreggiata (3 corsie + margine): |x| < 5.35 m
  const out = window.__s40 || (window.__s40 = { house: new Map(), mark: new Map(), logs: new Map(), frames: 0 });
  const v3 = new w.camera.position.constructor();
  const playerZ = -sim.T * 0.1;
  function scanMesh(m, maxY) {
    if (!m.visible || !m.geometry || !m.geometry.attributes.position) return null;
    let o = m; while (o) { if (!o.visible) return null; o = o.parent; }
    m.updateWorldMatrix(true, false);
    const P = m.geometry.attributes.position, e = m.matrixWorld.elements; let n = 0, minX = 1e9, maxX = -1e9, zA = 1e9, zB = -1e9;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      const wy = e[1] * x + e[5] * y + e[9] * z + e[13]; if (wy > maxY || wy < 0.2) continue;
      const wx = e[0] * x + e[4] * y + e[8] * z + e[12]; if (Math.abs(wx) >= R) continue;
      const wz = e[2] * x + e[6] * y + e[10] * z + e[14]; if (wz > playerZ + 4 || wz < playerZ - 140) continue;
      n++; minX = Math.min(minX, wx); maxX = Math.max(maxX, wx); zA = Math.min(zA, wz); zB = Math.max(zB, wz);
    }
    return n ? { n, minX: +minX.toFixed(2), maxX: +maxX.toFixed(2), z: +zA.toFixed(1), z2: +zB.toFixed(1) } : null;
  }
  const bid = (z) => { try { return env.biomeIdAt(-z); } catch (e) { return '?'; } };
  const loc = (z) => { try { const i = env.info(-z); return `L${i.lap} ${i.b.id}:${i.local.toFixed(0)}`; } catch (e) { return '?'; } };
  for (const sd of env.sides) for (const p of sd.list) {
    for (const m of [p.mesh, ...(p.extra || [])]) { if (!m) continue; const h = scanMesh(m, 2.6); if (!h) continue;
      const k = `${sd.s}|${p.W0.toFixed(1)}|${p.key || 'own'}|${env.cur.lap}`; if (!out.house.has(k)) out.house.set(k, { side: sd.s, W0: +p.W0.toFixed(1), key: p.key || 'own', at: loc(-p.W0), ...h }); }
  }
  for (const [key, mk] of env.marks) { if (!mk.root) continue; mk.root.traverse((m) => { if (!m.isMesh) return; const h = scanMesh(m, 2.0); if (!h) return;
    const k = key + '|' + (m.name || m.uuid.slice(0, 6)); if (!out.mark.has(k)) out.mark.set(k, { key, name: m.name, at: loc(h.z), ...h }); }); }
  // tronchi / rami caduti (ostacoli e loro viste dal pool)
  const BAD = ['village', 'mine-ext', 'mine-int', 'mine-blue'];
  for (const e of sim.entities) {   // strettoia-casa del paese (casa che sporge nella corsia esterna)
    if (e.kind !== 'narrow') continue; const v = w.views.get(e.id); if (!v || !v.root.visible) continue;
    const z = v.root.position.z; if (bid(z) !== 'village') continue;
    const k = 'narrow|' + e.id; if (!out.house.has(k)) out.house.set(k, { key: 'narrow-house', lane: e.lane, at: loc(z) });
  }
  for (const e of sim.entities) {
    if (!['trave', 'ramo', 'bottecoricata', 'rollbarrel'].includes(e.kind)) continue;
    const v = w.views.get(e.id); if (!v || !v.root.visible) continue;
    const z = v.root.position.z, b = bid(z), skin = v.skin || v.poolKey;
    const isLog = /log|Trunk|ramo/i.test(String(skin) + e.kind);
    const why = [];
    if (isLog && BAD.includes(b)) why.push('zona ' + b);
    if (Math.abs(v.body.position.y) > 0.05 && !e.hit) why.push('y ' + v.body.position.y.toFixed(2));
    if ((Math.abs(v.body.rotation.x) > 0.05 || Math.abs(v.body.rotation.z) > 0.05) && !e.hit && e.kind !== 'rollbarrel') why.push('rot');
    if (Math.abs(v.root.position.y) > 0.05) why.push('root y');
    if (why.length) { const k = e.id; if (!out.logs.has(k)) out.logs.set(k, { kind: e.kind, skin, at: loc(z), why: why.join(',') }); }
  }
  out.frames++;
  return out.frames;
})()
