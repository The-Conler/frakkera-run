import bpy
rig = bpy.data.objects['Human.rig']
for n in ['pelvis','spine_03','clavicle_r','upperarm_r','lowerarm_r','hand_r','upperarm_l','neck_01','head','thigh_l','calf_l','foot_l','ball_l']:
    b = rig.data.bones[n]; print('REST', n, tuple(round(x,3) for x in b.head_local), tuple(round(x,3) for x in b.tail_local), 'x', tuple(round(x,2) for x in b.matrix_local.to_3x3().col[0]))
