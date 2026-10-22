# Passo 1: crea l'uomo con MPFB2 (MakeHuman per Blender; output CC0), rig game_engine, abiti CC0.
import bpy, os, sys
from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.targetservice import TargetService
from bl_ext.user_default.mpfb.services.locationservice import LocationService
U = LocationService.get_user_data()
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
md = TargetService.get_default_macro_info_dict()
md.update({'gender': 1.0, 'age': 0.72, 'muscle': 0.68, 'weight': 0.96, 'height': 0.38, 'proportions': 0.4})
md['race'] = {'african': 0.0, 'asian': 0.0, 'caucasian': 1.0}
human = HumanService.create_human(mask_helpers=True, detailed_helpers=True, extra_vertex_groups=True, feet_on_ground=True, scale=0.1, macro_detail_dict=md)
rig = HumanService.add_builtin_rig(human, 'game_engine', import_weights=True)
def P(*a): return os.path.join(U, *a)
HumanService.add_mhclo_asset(P('proxymeshes', 'male_generic', 'male_generic.proxy'), human, asset_type='Proxymeshes', subdiv_levels=0, material_type='MAKESKIN')
for f in [P('clothes', 'male_casualsuit03', 'male_casualsuit03.mhclo'), P('clothes', 'shoes04', 'shoes04.mhclo'), P('clothes', 'jujube_newsboy_cap', 'jujube_newsboy_cap.mhclo'),
          P('hair', 'short02', 'short02.mhclo'), P('eyebrows', 'eyebrow001', 'eyebrow001.mhclo'), P('eyes', 'low-poly', 'low-poly.mhclo')]:
    if not os.path.exists(f): print('MISSING', f); continue
    t = 'Clothes' if '/clothes/' in f else ('Hair' if '/hair/' in f else ('Eyes' if '/eyes/' in f else 'Eyebrows'))
    HumanService.add_mhclo_asset(f, human, asset_type=t, subdiv_levels=0, material_type='MAKESKIN')
skin = P('skins', 'middleage_caucasian_male', 'middleage_caucasian_male.mhmat')
proxy = [o for o in bpy.data.objects if o.type == 'MESH' and 'generic' in o.name.lower()]
HumanService.set_character_skin(skin, human, bodyproxy=proxy[0] if proxy else None, skin_type='GAMEENGINE')
for o in bpy.data.objects:
    tri = sum(len(p.vertices) - 2 for p in o.data.polygons) if o.type == 'MESH' else 0
    print('OBJ', o.name, o.type, tri, o.parent.name if o.parent else '', [m.type for m in o.modifiers])
print('BONES', [b.name for b in rig.data.bones])
bpy.ops.wm.save_as_mainfile(filepath='/workspace/frakkera-run/.tmp/blend/step1.blend')
