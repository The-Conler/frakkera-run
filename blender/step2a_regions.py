# Passo 2a: isole UV della tuta (camicia / pantaloni) -> JSON per creare le texture ricolorate
import bpy, bmesh, json
o = bpy.data.objects['Human.male_casualsuit03']
bm = bmesh.new(); bm.from_mesh(o.data); bm.faces.ensure_lookup_table()
uv = bm.loops.layers.uv.active
par = list(range(len(bm.faces)))
def f(a):
    while par[a] != a: par[a] = par[par[a]]; a = par[a]
    return a
key = {}
for fc in bm.faces:
    for l in fc.loops:
        k = (l.vert.index, round(l[uv].uv.x, 5), round(l[uv].uv.y, 5))
        if k in key: par[f(fc.index)] = f(key[k])
        else: key[k] = fc.index
names = [g.name for g in o.vertex_groups]
dw = []
for v in o.data.vertices:
    best = max(v.groups, key=lambda g: g.weight, default=None)
    dw.append(names[best.group] if best else '')
isl = {}
for fc in bm.faces: isl.setdefault(f(fc.index), []).append(fc)
out = []
for r, fs in isl.items():
    legs = sum(1 for fc in fs for v in fc.verts if dw[v.index].startswith(('thigh', 'calf', 'foot')))
    tot = sum(len(fc.verts) for fc in fs)
    zc = sum(v.co.z for fc in fs for v in fc.verts) / tot
    lab = 'pants' if legs / tot > 0.3 or zc < 0.9 else 'shirt'
    tris = [[[l[uv].uv.x, l[uv].uv.y] for l in fc.loops] for fc in fs]
    out.append({'label': lab, 'n': len(fs), 'z': zc, 'legs': legs / tot, 'polys': tris})
    print('ISL', lab, len(fs), round(zc, 2), round(legs / tot, 2))
json.dump(out, open('/workspace/frakkera-run/.tmp/blend/suit_islands.json', 'w'))
