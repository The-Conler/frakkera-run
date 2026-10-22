# Render di controllo (Cycles CPU): fronte, lato, retro. Uso: blender -b file.blend --python render_views.py -- out.png [frame] [action]
import bpy, sys, math, os
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:]
out = argv[0]; frame = int(argv[1]) if len(argv) > 1 else 1
act = argv[2] if len(argv) > 2 else None
sc = bpy.context.scene
rig = next((o for o in sc.objects if o.type == 'ARMATURE'), None)
if act and rig: rig.animation_data_create(); rig.animation_data.action = bpy.data.actions[act]
sc.frame_set(frame)
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 24; sc.cycles.use_denoising = False
sc.render.resolution_x = 420; sc.render.resolution_y = 760; sc.render.film_transparent = False
w = bpy.data.worlds.new('W') if not sc.world else sc.world
sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.55, 0.5, 0.48, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.9
if 'KeySun' not in bpy.data.objects:
    l = bpy.data.lights.new('KeySun', 'SUN'); l.energy = 3.5; o = bpy.data.objects.new('KeySun', l); sc.collection.objects.link(o); o.rotation_euler = (math.radians(50), 0, math.radians(30))
cam_d = bpy.data.cameras.new('C'); cam_d.lens = 50
cam = bpy.data.objects.new('C', cam_d); sc.collection.objects.link(cam); sc.camera = cam
H = float(argv[3]) if len(argv) > 3 else 1.9
dist = float(argv[4]) if len(argv) > 4 else 6.5
files = []
for name, ang in [('front', 0), ('side', 90), ('back', 180), ('q', 215)]:
    a = math.radians(ang)
    cam.location = Vector((math.sin(a) * -dist, -math.cos(a) * dist, H * 0.55 + 0.3))
    d = Vector((0, 0, H * 0.5)) - cam.location; cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    f = f'{out}.{name}.png'; sc.render.filepath = f; bpy.ops.render.render(write_still=True); files.append(f)
print('RENDERED', files)
