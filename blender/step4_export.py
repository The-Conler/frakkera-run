# Passo 4: unisce le parti per materiale (meno draw call) ed esporta un GLB unico con le 6 animazioni.
import bpy, sys, os
from mathutils.kdtree import KDTree
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else '/workspace/frakkera-run/public/models/frakkera-man.glb'
DRACO = len(argv) > 1 and argv[1] == 'draco'
O = bpy.data.objects
suit, wc = O['shirt_trousers'], O['waistcoat']
# UV dei risvolti = UV della manica piu' vicina (bianco camicia); bottoni = un punto scuro del gilet
kd = KDTree(len(suit.data.loops)); suv = suit.data.uv_layers.active.data
for l in suit.data.loops: kd.insert(suit.data.vertices[l.vertex_index].co, l.index)
kd.balance()
def give_uv(o, fn):
    me = o.data
    if not me.uv_layers: me.uv_layers.new(name=suit.data.uv_layers.active.name)
    uv = me.uv_layers.active
    for l in me.loops: uv.data[l.index].uv = fn(me.vertices[l.vertex_index].co)
for n in ('cuff_l', 'cuff_r'):
    give_uv(O[n], lambda co: suv[kd.find(co)[1]].uv.copy())
wuv = wc.data.uv_layers.active
btns = [o for o in O if o.name.startswith('btn')]
for b in btns:
    if b.data.uv_layers: b.data.uv_layers[0].name = wuv.name
    give_uv(b, lambda co: (0.5, 0.5))
def join(target, others):
    for o in bpy.context.view_layer.objects: o.select_set(False)
    for o in others: o.data.materials.clear(); [o.data.materials.append(m) for m in target.data.materials]; o.select_set(True)
    target.select_set(True); bpy.context.view_layer.objects.active = target
    bpy.ops.object.join()
join(suit, [O['cuff_l'], O['cuff_r']])
join(wc, btns)
for o in O:
    if o.type == 'MESH':
        for m in list(o.modifiers):
            if m.type != 'ARMATURE': o.modifiers.remove(m)
rig = O['Human.rig']; rig.name = 'rig'
rig.animation_data.action = None
for t in rig.animation_data.nla_tracks: t.mute = False
for o in bpy.context.view_layer.objects: o.select_set(False)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
kw = dict(filepath=OUT, export_format='GLB', use_selection=False, export_animations=True, export_animation_mode='ACTIONS',
          export_skins=True, export_morph=False, export_yup=True, export_apply=False, export_texcoords=True, export_normals=True,
          export_tangents=False, export_image_format='AUTO', export_force_sampling=True, export_frame_step=1,
          export_optimize_animation_size=True, export_def_bones=False, export_lights=False, export_cameras=False,
          export_extras=False, export_current_frame=False, export_reset_pose_bones=True)
if DRACO: kw.update(export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7, export_draco_position_quantization=14, export_draco_normal_quantization=10, export_draco_texcoord_quantization=12)
bpy.ops.export_scene.gltf(**kw)
print('EXPORTED', OUT, os.path.getsize(OUT))
