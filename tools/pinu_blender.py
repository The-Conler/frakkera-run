# v5s11b: Pinu modellato in Blender (headless): mesh a faccette vere (convex hull per pezzo + pieghe),
# colori per faccia, esportato in GLB -> public/models/pinu.glb
# Uso: blender -b -P tools/pinu_blender.py -- out.glb
# Coordinate dei pezzi nello spazio di three.js (y su, +z verso il tavolo/camera); qui convertite in Blender (z su).
import bpy, bmesh, math, random, sys
from mathutils import Vector
out = sys.argv[sys.argv.index('--') + 1]
random.seed(11)
bpy.ops.wm.read_factory_settings(use_empty=True)
T = lambda x, y, z: Vector((x, -z, y))           # three -> blender
def hexc(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c]   # sRGB -> lineare
objs = []
def hull(pts, color, vary=0.06, fold=0.0, name='p', shade_down=0.25):
    bm = bmesh.new()
    for p in pts: bm.verts.new(T(*p))
    r = bmesh.ops.convex_hull(bm, input=bm.verts[:])
    dead = list({v for v in r['geom_interior'] + r['geom_unused'] if isinstance(v, bmesh.types.BMVert)})
    if dead: bmesh.ops.delete(bm, geom=dead, context='VERTS')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    attr = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    base = hexc(color)
    for poly in me.polygons:
        n = poly.normal                     # blender: z su
        k = 1 + (random.random() - 0.5) * 2 * vary
        k *= 1 - shade_down * max(0, -n.z)  # facce verso il basso un po' piu' scure (pieghe)
        if fold: k *= 1 - fold * (0.5 + 0.5 * math.sin(poly.center.x * 31 + poly.center.z * 23))
        for li in poly.loop_indices: attr.data[li].color = (base[0] * k, base[1] * k, base[2] * k, 1)
    for poly in me.polygons: poly.use_smooth = False
    objs.append(ob); return ob
def ell(c, r, n, jit=0.0, ymin=None):
    pts = []; ga = math.pi * (3 - math.sqrt(5))
    for i in range(n):
        y = 1 - (i + 0.5) / n * 2; rr = math.sqrt(1 - y * y); a = i * ga
        j = 1 + (random.random() - 0.5) * 2 * jit
        p = (c[0] + math.cos(a) * rr * r[0] * j, c[1] + y * r[1] * j, c[2] + math.sin(a) * rr * r[2] * j)
        if ymin is None or p[1] >= ymin: pts.append(p)
    return pts
def capsule(a, b, ra, rb, n=7, jit=0.0):
    a, b = Vector(a), Vector(b); d = (b - a).normalized()
    up = Vector((0, 1, 0)) if abs(d.y) < 0.9 else Vector((1, 0, 0))
    u = d.cross(up).normalized(); v = d.cross(u)
    pts = []
    for (c, r) in ((a, ra), (b, rb)):
        for i in range(n):
            t = i / n * math.pi * 2; j = 1 + (random.random() - 0.5) * 2 * jit
            p = c + (u * math.cos(t) + v * math.sin(t)) * r * j
            pts.append(tuple(p))
        pts.append(tuple(c - d * r * 0.6) if c is a else tuple(c + d * r * 0.6))
    return pts
mir = lambda pts: pts + [(-x, y, z) for (x, y, z) in pts]
JK, JK2, SH, SK, SK2, BROW, HAIR, CAP, TIE = '#343338', '#232327', '#eeebe3', '#d68a5c', '#b06a48', '#4a4744', '#8b8782', '#47413b', '#25252b'
# ---------------------------------------------------------------- busto: spalle larghe e spioventi, giacca a pieghe
torso = mir([(0.15, 0.8, -0.3), (0.36, 0.72, -0.32), (0.56, 0.5, -0.34), (0.62, 0.34, -0.36), (0.54, 0.05, -0.4), (0.44, -0.02, -0.12), (0.36, 0.02, -0.02),
             (0.36, 0.42, -0.04), (0.2, 0.7, -0.15), (0.45, 0.62, -0.5), (0.3, 0.72, -0.5), (0.5, 0.2, -0.62), (0.2, 0.02, -0.66), (0.0, 0.8, -0.42)])
torso += ell((0, 0.36, -0.32), (0.55, 0.36, 0.29), 70, 0.06)
hull(torso, JK, 0.1, 0.12, 'torso')
# camicia (V), cravatta, risvolti, colletto sul davanti del busto (piano z = -0.16 + (0.76-y)*0.33)
FZ = lambda y, dz: -0.155 + (0.76 - y) * 0.33 + dz
hull([(-0.13, 0.76, FZ(0.76, 0.012)), (0.13, 0.76, FZ(0.76, 0.012)), (0, 0.4, FZ(0.4, 0.012)), (-0.13, 0.76, FZ(0.76, -0.02)), (0.13, 0.76, FZ(0.76, -0.02)), (0, 0.4, FZ(0.4, -0.02))], SH, 0.03, 0, 'shirt', 0)
hull([(-0.035, 0.73, FZ(0.73, 0.028)), (0.035, 0.73, FZ(0.73, 0.028)), (-0.05, 0.47, FZ(0.47, 0.03)), (0.05, 0.47, FZ(0.47, 0.03)), (0, 0.41, FZ(0.41, 0.03)),
      (-0.035, 0.73, FZ(0.73, 0.0)), (0.035, 0.73, FZ(0.73, 0.0)), (0, 0.43, FZ(0.43, 0.0))], TIE, 0.05, 0, 'tie', 0)
hull([(-0.04, 0.76, FZ(0.76, 0.035)), (0.04, 0.76, FZ(0.76, 0.035)), (0, 0.71, FZ(0.71, 0.04)), (0, 0.75, FZ(0.75, 0.0))], TIE, 0.05, 0, 'knot', 0)
for s in (-1, 1):
    hull([(s * 0.13, 0.77, FZ(0.77, 0.03)), (s * 0.27, 0.74, FZ(0.74, 0.03)), (s * 0.24, 0.55, FZ(0.55, 0.03)), (s * 0.02, 0.38, FZ(0.38, 0.03)),
          (s * 0.13, 0.77, FZ(0.77, -0.01)), (s * 0.27, 0.74, FZ(0.74, -0.01)), (s * 0.02, 0.38, FZ(0.38, -0.01))], JK2, 0.08, 0, 'lapel', 0.1)
    hull([(s * 0.04, 0.79, FZ(0.79, 0.03)), (s * 0.15, 0.82, FZ(0.82, 0.0)), (s * 0.13, 0.72, FZ(0.72, 0.035)), (s * 0.05, 0.84, FZ(0.84, -0.04))], SH, 0.03, 0, 'collar', 0)
# braccia: spalla -> gomito sul tavolo -> avambraccio verso le mani
for s in (-1, 1):
    hull(capsule((s * 0.56, 0.48, -0.3), (s * 0.5, 0.1, 0.12), 0.19, 0.15, 9, 0.08), JK, 0.1, 0.1, 'upper', 0.3)
    hull(capsule((s * 0.48, 0.1, 0.12), (s * 0.16, 0.11, 0.43), 0.15, 0.12, 9, 0.06), JK, 0.1, 0.1, 'fore', 0.3)
    hull(capsule((s * 0.19, 0.11, 0.41), (s * 0.15, 0.11, 0.45), 0.122, 0.118, 8), JK2, 0.06, 0, 'cuff', 0.2)
# mani grandi, dita intrecciate, pollici sopra (scalate attorno al centro delle mani)
_hull0 = hull
def hull(pts, *a, **k):
    if k.pop('hand', False): pts = [(x * 1.4, 0.14 + (y - 0.14) * 1.4 + 0.03, 0.56 + (z - 0.56) * 1.4) for (x, y, z) in pts]
    return _hull0(pts, *a, **k)
for s in (-1, 1):
    hull(ell((s * 0.085, 0.13, 0.56), (0.08, 0.075, 0.11), 26, 0.05), SK, 0.06, 0, 'palm', 0.2, hand=True)
for k in range(4):
    z = 0.5 + k * 0.048
    hull(capsule((-0.12, 0.17, z), (0.1, 0.2, z + 0.02), 0.03, 0.027, 6), SK if k % 2 else SK2, 0.05, 0, 'fL', 0.2, hand=True)
    z2 = z + 0.024
    hull(capsule((0.12, 0.17, z2), (-0.1, 0.205, z2 + 0.015), 0.03, 0.027, 6), SK2 if k % 2 else SK, 0.05, 0, 'fR', 0.2, hand=True)
for s in (-1, 1):
    hull(capsule((s * 0.06, 0.2, 0.6), (s * 0.02, 0.26, 0.68), 0.034, 0.028, 6), SK, 0.05, 0, 'thumb', 0.2, hand=True)
# collo
hull(capsule((0, 0.74, -0.25), (0, 0.9, -0.22), 0.12, 0.11, 8), SK2, 0.05, 0, 'neck', 0.2)
# ---------------------------------------------------------------- testa lunga e spigolosa, mascella forte
HX, HY, HZ = 0.0, 1.14, -0.19
HS = 1.12
H = lambda pts: [(HX + x * HS, HY + 0.03 + y * HS, HZ + z * HS) for (x, y, z) in pts]
head = H(mir([(0.13, 0.25, 0.1), (0.14, 0.25, -0.12), (0.19, 0.13, 0.08), (0.2, 0.1, -0.12), (0.16, 0.07, 0.19), (0.205, -0.01, 0.12),
              (0.185, -0.14, 0.11), (0.18, -0.24, 0.03), (0.155, -0.27, -0.07), (0.08, -0.33, 0.13), (0.1, -0.2, 0.19), (0.17, 0.0, -0.18),
              (0.12, -0.18, -0.15), (0.06, 0.03, 0.205)]) + [(0, 0.27, 0), (0, 0.07, 0.215), (0, -0.345, 0.15), (0, -0.22, 0.205), (0, 0.06, -0.23)])
hull(head, SK, 0.07, 0, 'head', 0.25)
hull(H([(0, 0.07, 0.205), (-0.03, 0.04, 0.2), (0.03, 0.04, 0.2), (0, -0.07, 0.285), (-0.05, -0.1, 0.235), (0.05, -0.1, 0.235), (0, -0.11, 0.25), (0, -0.05, 0.2)]), SK2, 0.04, 0, 'nose', 0.2)
for s in (-1, 1):
    # sopracciglia scure, piegate verso il basso al centro: sguardo severo
    hull(H([(s * 0.165, 0.105, 0.185), (s * 0.035, 0.06, 0.218), (s * 0.165, 0.075, 0.19), (s * 0.04, 0.035, 0.22), (s * 0.1, 0.09, 0.23), (s * 0.1, 0.06, 0.232)]), BROW, 0.06, 0, 'brow', 0)
    # occhi incavati: palpebra in ombra + iride scura
    hull(H([(s * 0.13, 0.035, 0.196), (s * 0.05, 0.022, 0.212), (s * 0.13, 0.005, 0.196), (s * 0.05, 0.0, 0.21), (s * 0.09, 0.02, 0.212)]), '#6a4636', 0.03, 0, 'lid', 0)
    hull(H([(s * 0.105, 0.025, 0.21), (s * 0.075, 0.022, 0.214), (s * 0.105, 0.005, 0.21), (s * 0.075, 0.004, 0.214), (s * 0.09, 0.015, 0.218)]), '#1c1410', 0.02, 0, 'eye', 0)
    # pieghe naso-bocca, zigomi in ombra
    hull(H([(s * 0.06, -0.1, 0.205), (s * 0.1, -0.21, 0.19), (s * 0.075, -0.1, 0.21), (s * 0.11, -0.2, 0.193)]), '#a06a50', 0.02, 0, 'fold', 0)
    hull(H([(s * 0.2, 0.05, 0.0), (s * 0.235, 0.02, -0.04), (s * 0.2, -0.09, -0.02), (s * 0.235, -0.07, -0.06), (s * 0.19, 0.03, -0.08), (s * 0.19, -0.08, -0.07)]), SK2, 0.05, 0, 'ear', 0.2)
    hull(H([(s * 0.19, 0.15, 0.05), (s * 0.21, 0.12, -0.12), (s * 0.18, 0.0, -0.17), (s * 0.205, 0.03, 0.03), (s * 0.16, 0.18, -0.15), (s * 0.2, 0.06, -0.16)]), HAIR, 0.1, 0, 'hair', 0)
# bocca dritta, sottile, angoli appena in giu' (niente baffi, niente sorriso)
hull(H([(-0.075, -0.205, 0.2), (0.075, -0.205, 0.2), (-0.085, -0.215, 0.195), (0.085, -0.215, 0.195), (0, -0.212, 0.207), (0, -0.2, 0.207)]), '#7a4434', 0.02, 0, 'mouth', 0)
hull(H([(-0.06, -0.15, 0.205), (0.06, -0.15, 0.205), (0, -0.14, 0.212), (0, -0.165, 0.21)]), '#b8805e', 0.02, 0, 'lip', 0)
# ---------------------------------------------------------------- coppola piatta con visiera
cap = H(mir([(0.215, 0.19, 0.12), (0.22, 0.19, -0.1), (0.15, 0.19, -0.22), (0.26, 0.29, 0.12), (0.26, 0.3, -0.08), (0.19, 0.33, -0.2), (0.22, 0.31, 0.22),
             (0.14, 0.38, 0.0), (0.1, 0.32, 0.27), (0.2, 0.36, 0.08)]) + [(0, 0.19, -0.24), (0, 0.39, -0.06), (0, 0.32, 0.29)])
cap = [(HX + (x - HX) * 1.12, HY + 0.03 + ((y - HY - 0.03) - 0.19 * HS) * 1.05 + 0.19 * HS, z) for (x, y, z) in cap]
hull(cap, CAP, 0.1, 0.06, 'cap', 0.3)
hull(H(mir([(0.19, 0.205, 0.17), (0.12, 0.2, 0.3), (0.19, 0.185, 0.17), (0.12, 0.175, 0.3)]) + [(0, 0.195, 0.34), (0, 0.17, 0.34)]), '#3a352f', 0.06, 0, 'brim', 0.4)
hull(H(mir([(0.215, 0.205, 0.12), (0.22, 0.205, -0.1), (0.215, 0.185, 0.12), (0.22, 0.185, -0.1)]) + [(0, 0.2, -0.235), (0, 0.185, -0.235)]), '#2e2a26', 0.04, 0, 'band', 0)
# ---------------------------------------------------------------- unisci ed esporta
bpy.ops.object.select_all(action='DESELECT')
for o in objs: o.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active; ob.name = 'Pinu'
me = ob.data; me.color_attributes.active_color = me.color_attributes['Col']
print('PINU faces', len(me.polygons), 'verts', len(me.vertices))
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_vertex_color='ACTIVE', export_normals=True, export_materials='NONE', use_selection=True, export_yup=True)
