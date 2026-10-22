# Passo 2: abiti (camicia a maniche arrotolate, gilet, pantaloni scuri, coppola), materiali, decimazione, frakkera.
import bpy, bmesh, math, random, sys, os
from mathutils import Vector, Matrix, Quaternion
from mathutils.kdtree import KDTree
TEX = '/workspace/frakkera-run/blender/tex/'
OUT = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '/workspace/frakkera-run/.tmp/blend/step2.blend'
random.seed(7)
rig = bpy.data.objects['Human.rig']
bpy.data.objects.remove(bpy.data.objects['Human'])
body = bpy.data.objects['Human.male_generic']; suit = bpy.data.objects['Human.male_casualsuit03']
shoes = bpy.data.objects['Human.shoes04']; cap = bpy.data.objects['Human.jujube_newsboy_cap']
hair = bpy.data.objects['Human.short02']; brows = bpy.data.objects['Human.eyebrow001']
eyes = next(o for o in bpy.data.objects if 'low-poly' in o.name)
for o, n in [(body, 'body'), (suit, 'shirt_trousers'), (shoes, 'shoes'), (cap, 'cap'), (hair, 'hair'), (brows, 'eyebrows'), (eyes, 'eyes')]:
    o.name = n; o.data.name = n

ARM = {s: (Vector((sg * 0.347, -0.02, 1.173)), Vector((sg * 0.473, -0.195, 1.054))) for s, sg in (('l', 1), ('r', -1))}
def forearm_t(co):
    best = None
    for s, (E, W) in ARM.items():
        d = W - E; t = (co - E).dot(d) / d.length_squared
        p = E + d * max(0, min(1, t)); dist = (co - p).length
        if dist < 0.11 and (best is None or dist < best[2]): best = (s, t, dist)
    return best
T_CUT = 0.40

# ---------------------------------------------------------------- corpo: elimina le parti coperte (tranne l'avambraccio)
def delete_groups(o, groups, keep_fn=None):
    bm = bmesh.new(); bm.from_mesh(o.data); dl = bm.verts.layers.deform.active
    idx = [o.vertex_groups[g].index for g in groups if g in o.vertex_groups]
    kill = []
    for v in bm.verts:
        w = v[dl]
        if any(w.get(i, 0) > 0.5 for i in idx) and not (keep_fn and keep_fn(v.co)): kill.append(v)
    bmesh.ops.delete(bm, geom=kill, context='VERTS'); bm.to_mesh(o.data); bm.free()
def keep_forearm(co):
    f = forearm_t(co); return f is not None and f[1] > T_CUT - 0.06
body_full = body.copy(); body_full.data = body.data.copy()
delete_groups(body, ['Delete.male_casualsuit03', 'Delete.shoes04', 'Delete.jujube_newsboy_cap'], keep_forearm)
for m in list(body.modifiers):
    if m.type == 'MASK': body.modifiers.remove(m)

# ---------------------------------------------------------------- camicia: maniche tagliate a meta' avambraccio + risvolto
bm = bmesh.new(); bm.from_mesh(suit.data)
kill = [f for f in bm.faces if all((lambda r: r is not None and r[1] > T_CUT)(forearm_t(v.co)) for v in f.verts)]
bmesh.ops.delete(bm, geom=kill, context='FACES')
bm.to_mesh(suit.data); bm.free()
def add_cuff(side):
    E, W = ARM[side]; d = (W - E).normalized()
    ring = [v for v in suit.data.vertices if (lambda r: r and r[0] == side and abs(r[1] - T_CUT) < 0.06)(forearm_t(v.co))]
    c = E + (W - E) * T_CUT
    rad = sum(((v.co - c) - d * (v.co - c).dot(d)).length for v in ring) / max(1, len(ring))
    prof = [(-0.032, 0.002), (-0.026, 0.012), (-0.012, 0.018), (0.004, 0.019), (0.018, 0.015), (0.026, 0.006), (0.03, -0.004)]
    seg = 18; bm = bmesh.new()
    u = d.orthogonal().normalized(); w2 = d.cross(u)
    rows = []
    for (a, dr) in prof:
        row = []
        for i in range(seg):
            th = 2 * math.pi * i / seg; n = u * math.cos(th) + w2 * math.sin(th)
            row.append(bm.verts.new(c + d * (a + 0.012) + n * (rad + dr)))
        rows.append(row)
    for j in range(len(rows) - 1):
        for i in range(seg):
            bm.faces.new((rows[j][i], rows[j][(i + 1) % seg], rows[j + 1][(i + 1) % seg], rows[j + 1][i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('cuff_' + side); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new('cuff_' + side, me); bpy.context.collection.objects.link(ob)
    return ob, rad
cuffs = [add_cuff('l'), add_cuff('r')]
print('cuff radius', [round(c[1], 3) for c in cuffs])

# ---------------------------------------------------------------- gilet: dalla superficie del corpo (alta risoluzione), scostata verso l'esterno
def in_vest(c):
    if c.z > 1.47 or c.z < 0.9: return False
    hem = 0.95 - (0.045 * max(0.0, 1 - abs(c.x) / 0.11) if c.y < -0.04 else 0.0)
    if c.z < hem: return False
    if abs(c.x) > 0.168 and c.z > 1.16: return False
    if abs(c.x) > 0.205: return False
    if c.z > 1.36 and math.hypot(c.x, c.y + 0.01) < 0.092: return False
    if c.y < -0.03 and abs(c.x) < 0.004 + max(0.0, c.z - 1.05) * 0.30: return False
    return True
wc = body_full; wc.data.name = 'x'; wc.name = 'waistcoat'; wc.data.name = 'waistcoat'; bpy.context.collection.objects.link(wc)
for m in list(wc.modifiers):
    if m.type == 'MASK': wc.modifiers.remove(m)
bm = bmesh.new(); bm.from_mesh(wc.data)
bmesh.ops.delete(bm, geom=[f for f in bm.faces if not all(in_vest(v.co) for v in f.verts)], context='FACES')
# tieni solo il pezzo connesso piu' grande (niente isole sulle braccia)
bm.faces.ensure_lookup_table(); seen = set(); parts = []
for f0 in bm.faces:
    if f0.index in seen: continue
    st = [f0]; comp = []; seen.add(f0.index)
    while st:
        f = st.pop(); comp.append(f)
        for e in f.edges:
            for g in e.link_faces:
                if g.index not in seen: seen.add(g.index); st.append(g)
    parts.append(comp)
parts.sort(key=len)
for comp in parts[:-1]: bmesh.ops.delete(bm, geom=comp, context='FACES')
# bordo levigato (niente scalini tra le facce)
for it in range(14):
    bd = [v for v in bm.verts if v.is_boundary]
    newp = {}
    for v in bd:
        nb = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
        if len(nb) == 2: newp[v] = v.co * 0.4 + (nb[0].co + nb[1].co) * 0.3
    for v, p in newp.items(): v.co = p
bm.normal_update()
from mathutils.bvhtree import BVHTree
sbm = bmesh.new(); sbm.from_mesh(suit.data); tree = BVHTree.FromBMesh(sbm)
offs = []
for v in bm.verts:
    n = v.normal; d = 0.02
    hit = tree.ray_cast(v.co - n * 0.005, n, 0.06)
    if hit[0] is not None: d = min(0.045, max(d, hit[3] - 0.005 + 0.012))
    offs.append(d)
# leviga gli offset per non avere gradini
for it in range(4):
    offs = [0.5 * offs[v.index] + 0.5 * max([offs[e.other_vert(v).index] for e in v.link_edges] + [offs[v.index]]) for v in bm.verts]
for v in bm.verts: v.co += v.normal * offs[v.index]
sbm.free()
bm.to_mesh(wc.data); bm.free()
# camicia sotto il gilet: via le facce coperte (meno triangoli, niente compenetrazioni)
def covered(c):
    if not in_vest(c): return False
    m = 0.045
    return all(in_vest(c + Vector(o)) for o in ((0, 0, m), (0, 0, -m), (m, 0, 0), (-m, 0, 0), (0, -m, 0), (0, m, 0)))
sb = bmesh.new(); sb.from_mesh(suit.data)
bmesh.ops.delete(sb, geom=[f for f in sb.faces if covered(f.calc_center_median())], context='FACES'); sb.to_mesh(suit.data); sb.free()
names = [g.name for g in suit.vertex_groups]
# bottoni
btn = []
for z in (1.05, 1.0, 0.955):
    near = min((v for v in wc.data.vertices if v.co.y < 0 and abs(v.co.z - z) < 0.03), key=lambda v: abs(v.co.x) + abs(v.co.z - z) * 0.5, default=None)
    if near is None: continue
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=4, radius=0.008)
    for v in bm.verts: v.co.y *= 0.5; v.co += Vector((0.0, near.co.y - 0.004, z))
    me = bpy.data.meshes.new('btn'); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new('btn', me); bpy.context.collection.objects.link(ob); btn.append(ob)

# ---------------------------------------------------------------- materiali
def img(name, colorspace='sRGB'):
    i = bpy.data.images.load(TEX + name); i.colorspace_settings.name = colorspace; return i
def make_mat(name, albedo=None, normal=None, rough=0.8, color=(1, 1, 1, 1), alpha_clip=False, vcol=False, double=False, emissive=None, metallic=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; p = nt.nodes['Principled BSDF']
    p.inputs['Roughness'].default_value = rough; p.inputs['Base Color'].default_value = color; p.inputs['Metallic'].default_value = metallic
    if albedo:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = img(albedo)
        nt.links.new(t.outputs['Color'], p.inputs['Base Color'])
        if alpha_clip: nt.links.new(t.outputs['Alpha'], p.inputs['Alpha'])
    if vcol:
        a = nt.nodes.new('ShaderNodeVertexColor'); a.layer_name = 'Col'
        nt.links.new(a.outputs['Color'], p.inputs['Base Color'])
    if normal:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = img(normal, 'Non-Color')
        nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(t.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], p.inputs['Normal'])
    if emissive:
        p.inputs['Emission Color'].default_value = emissive; p.inputs['Emission Strength'].default_value = 1.0
    if alpha_clip: m.blend_method = 'CLIP'; m.alpha_threshold = 0.5
    m.use_backface_culling = not double
    return m
MAT = {
    'skin': make_mat('skin', 'skin_albedo.jpg', rough=0.62),
    'cloth': make_mat('shirt_trousers', 'suit_albedo.jpg', 'suit_normal.jpg', rough=0.88),
    'cuff': make_mat('shirt_cuff', rough=0.9, color=(0.86, 0.85, 0.8, 1)),
    'waistcoat': make_mat('waistcoat', 'waistcoat_albedo.jpg', rough=0.72, double=True),
    'button': make_mat('button', rough=0.4, color=(0.05, 0.045, 0.04, 1)),
    'cap': make_mat('cap', 'cap_albedo.jpg', 'cap_normal.jpg', rough=0.92, double=True),
    'shoes': make_mat('shoes', 'shoes_albedo.jpg', 'shoes_normal.jpg', rough=0.45),
    'hair': make_mat('hair', 'hair_albedo.png', rough=0.7, alpha_clip=True, double=True),
    'brows': make_mat('eyebrows', 'eyebrow.png', rough=0.8, alpha_clip=True),
    'eyes': make_mat('eyes', 'eye.jpg', rough=0.25),
    'stalk': make_mat('frakkera_stalks', rough=0.95, vcol=True, double=True),
    'rope': make_mat('frakkera_rope', rough=0.95, vcol=True),
}
def setmat(o, m):
    o.data.materials.clear(); o.data.materials.append(m)
for o, k in [(body, 'skin'), (suit, 'cloth'), (wc, 'waistcoat'), (cap, 'cap'), (shoes, 'shoes'), (hair, 'hair'), (brows, 'brows'), (eyes, 'eyes')]: setmat(o, MAT[k])
for c, _ in cuffs: setmat(c, MAT['cuff'])
for b in btn: setmat(b, MAT['button'])

# ---------------------------------------------------------------- pesi per cuciture/bottoni: copia dal corpo/camicia
def bind(o, bones):
    for g in list(o.vertex_groups): o.vertex_groups.remove(g)
    for name, idxs, w in bones:
        g = o.vertex_groups.new(name=name); g.add(idxs, w, 'REPLACE')
    if not any(m.type == 'ARMATURE' for m in o.modifiers):
        m = o.modifiers.new('Armature', 'ARMATURE'); m.object = rig
    o.parent = rig
for (c, _), s in zip(cuffs, ('l', 'r')):
    bind(c, [(f'lowerarm_{s}', list(range(len(c.data.vertices))), 1.0)])
for b in btn: bind(b, [('spine_01', list(range(len(b.data.vertices))), 1.0)])

# ---------------------------------------------------------------- decimazione (budget mobile)
def decimate(o, target):
    tri = sum(len(p.vertices) - 2 for p in o.data.polygons)
    if tri <= target: return tri
    arm = [m for m in o.modifiers if m.type == 'ARMATURE']
    for m in arm: o.modifiers.remove(m)
    d = o.modifiers.new('dec', 'DECIMATE'); d.ratio = target / tri; d.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    bpy.ops.object.modifier_apply(modifier='dec'); o.select_set(False)
    m = o.modifiers.new('Armature', 'ARMATURE'); m.object = rig
    return sum(len(p.vertices) - 2 for p in o.data.polygons)
for o, t in [(body, 4700), (suit, 2900), (wc, 1200), (shoes, 900), (hair, 650), (cap, 800)]:
    print('DEC', o.name, decimate(o, t))

# ---------------------------------------------------------------- frakkera
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
eb = rig.data.edit_bones
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from frk_common import AX, G, L, SG, B0, rprof
fb = eb.new('frakkera'); fb.head = G; fb.tail = G + AX * 0.4; fb.parent = eb['spine_03']; fb.roll = 0
bpy.ops.object.mode_set(mode='OBJECT')
bm = bmesh.new(); col = bm.loops.layers.color.new('Col')
u0 = AX.orthogonal().normalized(); v0 = AX.cross(u0)
def frame_pt(s, th, rr): return B0 + AX * s + (u0 * math.cos(th) + v0 * math.sin(th)) * rr
def tube(path, rad, c, sides=3):
    rings = []
    for k, p in enumerate(path):
        tdir = (path[min(k + 1, len(path) - 1)] - path[max(k - 1, 0)]).normalized()
        a = tdir.orthogonal().normalized(); b = tdir.cross(a)
        rr = rad * (0.55 if k == len(path) - 1 else 1.0)
        rings.append([bm.verts.new(p + (a * math.cos(2 * math.pi * i / sides) + b * math.sin(2 * math.pi * i / sides)) * rr) for i in range(sides)])
    for k in range(len(rings) - 1):
        for i in range(sides):
            f = bm.faces.new((rings[k][i], rings[k][(i + 1) % sides], rings[k + 1][(i + 1) % sides], rings[k + 1][i]))
            for l in f.loops: l[col] = c
# nucleo scuro (riempie i vuoti tra gli steli)
core_path = [B0 + AX * (0.25 + i * (L - 0.45) / 6) for i in range(7)]
for k in range(len(core_path) - 1):
    pass
cr = []
for i, p in enumerate(core_path):
    s = 0.25 + i * (L - 0.45) / 6; rr = rprof(s) * 0.86
    cr.append([bm.verts.new(p + (u0 * math.cos(2 * math.pi * j / 10) + v0 * math.sin(2 * math.pi * j / 10)) * rr) for j in range(10)])
for k in range(len(cr) - 1):
    for j in range(10):
        f = bm.faces.new((cr[k][j], cr[k][(j + 1) % 10], cr[k + 1][(j + 1) % 10], cr[k + 1][j]))
        for l in f.loops: l[col] = (0.16, 0.11, 0.07, 1)
# steli
N = 180
for n in range(N):
    th = random.random() * math.tau; depth = 0.88 + random.random() * 0.14
    s0 = random.random() * 0.22; s1 = L - random.random() * 0.25
    wob = random.random() * math.tau; tw = (random.random() - 0.5) * 0.5
    path = []
    for k in range(5):
        s = s0 + (s1 - s0) * k / 4
        rr = rprof(s) * depth * (1 + 0.04 * math.sin(wob + k * 1.7))
        path.append(frame_pt(s, th + tw * (s / L), rr))
    g = 0.24 + random.random() * 0.3
    c = (g * 1.0, g * 0.7, g * 0.42, 1) if random.random() < 0.7 else (g * 1.3, g * 1.08, g * 0.72, 1)
    tube(path, 0.009 + random.random() * 0.007, c)
# fondo a scopa: steli corti che si aprono verso il basso e verso l'esterno
for n in range(60):
    th = random.random() * math.tau; s0 = 0.35 + random.random() * 0.3
    end_r = rprof(0) * (0.9 + random.random() * 0.5); s_end = -0.06 - random.random() * 0.12
    path = [frame_pt(s0, th, rprof(s0) * 0.95), frame_pt((s0 + s_end) * 0.5, th + 0.05, (rprof(s0) + end_r) * 0.52), frame_pt(s_end, th + 0.1, end_r)]
    g = 0.24 + random.random() * 0.18
    tube(path, 0.008 + random.random() * 0.005, (g * 1.05, g * 0.78, g * 0.5, 1))
# cima: estremita' irregolari e annerite
for n in range(40):
    th = random.random() * math.tau; s0 = L - 0.5
    path = [frame_pt(s0, th, rprof(s0) * 0.9), frame_pt(L - 0.1, th, rprof(L) * 0.95), frame_pt(L + 0.05 + random.random() * 0.18, th + 0.1, rprof(L) * (0.7 + random.random() * 0.5))]
    tube(path, 0.008 + random.random() * 0.005, (0.07, 0.05, 0.04, 1))
# rametti che sporgono (irregolarita' come nei fasci veri)
for n in range(70):
    s = 0.3 + random.random() * (L - 0.6); th = random.random() * math.tau
    ln = 0.08 + random.random() * 0.2
    p0 = frame_pt(s, th, rprof(s) * 0.95)
    d = (AX * (random.choice((1, 1, -1))) + (u0 * math.cos(th) + v0 * math.sin(th)) * (0.18 + random.random() * 0.4)).normalized()
    g = 0.2 + random.random() * 0.25
    tube([p0, p0 + d * ln * 0.5, p0 + d * ln], 0.006 + random.random() * 0.004, (g * 1.05, g * 0.75, g * 0.45, 1))
# legature in corda (7)
rope_s = [0.4, 0.8, 1.22, 1.66, 2.1, 2.54, 2.95]
for s in rope_s:
    s += (random.random() - 0.5) * 0.06
    for dup in (-0.018, 0.018):
      rr = rprof(s) * 1.02 + 0.008; seg = 14; ring_r = []
      for k in range(3):
        a = 2 * math.pi * k / 3
        row = []
        for i in range(seg):
            th = 2 * math.pi * i / seg
            off = AX * (dup + 0.014 * math.sin(a) + 0.008 * math.sin(th * 2 + dup * 90))
            row.append(bm.verts.new(frame_pt(s, th, rr + 0.014 * math.cos(a)) + off))
        ring_r.append(row)
      for k in range(3):
        for i in range(seg):
            f = bm.faces.new((ring_r[k][i], ring_r[k][(i + 1) % seg], ring_r[(k + 1) % 3][(i + 1) % seg], ring_r[(k + 1) % 3][i]))
            for l in f.loops: l[col] = (0.6, 0.48, 0.3, 1) if dup < 0 else (0.52, 0.41, 0.26, 1)
me = bpy.data.meshes.new('frakkera'); bm.to_mesh(me); bm.free()
frk = bpy.data.objects.new('frakkera', me); bpy.context.collection.objects.link(frk)
me.materials.append(MAT['stalk'])
mw = frk.matrix_world.copy()
frk.parent = rig; frk.parent_type = 'BONE'; frk.parent_bone = 'frakkera'; frk.matrix_world = mw
tip = bpy.data.objects.new('frakkera_tip', None); bpy.context.collection.objects.link(tip)
tip.location = B0 + AX * (L + 0.05); tmw = tip.matrix_world.copy(); tip.parent = frk; tip.matrix_world = Matrix.Translation(B0 + AX * (L + 0.05))
print('FRAKKERA tris', sum(len(p.vertices) - 2 for p in me.polygons))
# punti di presa per le mani (IK), figli della frakkera
def grip(name, s, ang, off=0.0):
    e = bpy.data.objects.new(name, None); bpy.context.collection.objects.link(e)
    p = B0 + AX * s; n = Vector((math.cos(ang), math.sin(ang), 0)); p = p + n * (rprof(s) + off)
    e.parent = frk; e.matrix_world = Matrix.Translation(p); return e
grip('grip_r', SG + 0.16, math.radians(235), 0.03)
grip('grip_l', SG - 0.22, math.radians(5), 0.03)
tot = 0
for o in bpy.data.objects:
    if o.type == 'MESH': t = sum(len(p.vertices) - 2 for p in o.data.polygons); tot += t; print('TRI', o.name, t)
print('TOTAL', tot)
bpy.ops.wm.save_as_mainfile(filepath=OUT)
