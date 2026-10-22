import bpy
rig = bpy.data.objects['Human.rig']
for b in rig.data.bones:
    if any(k in b.name for k in ['index','middle','pinky','ring','thumb']) and not b.name.endswith('01_l'): continue
    m = b.matrix_local
    print(f"{b.name:12s} head {tuple(round(v,3) for v in b.head_local)} tail {tuple(round(v,3) for v in b.tail_local)} X {tuple(round(v,2) for v in m.col[0][:3])} Z {tuple(round(v,2) for v in m.col[2][:3])} parent {b.parent.name if b.parent else ''}")
print(rig.matrix_world)
