import bpy, math
exec(open('/workspace/frakkera-run/blender/step3_anim.py').read().split('# calibrazione empirica')[0])
for s, sg in (('l', 1), ('r', -1)): foot_t[s].location = (sg * 0.17, -0.06, 0.25)
c = P['calf_l'].constraints[0]
print('CON', [ (x.type, x.target.name if x.target else None) for x in P['calf_l'].constraints], c.pole_target.name, c.chain_count, c.use_tail, arm.bones['calf_l'].use_connect, arm.bones['thigh_l'].use_connect)
for k in range(0, 360, 45):
    c.pole_angle = math.radians(k); bpy.context.view_layer.update()
    print('ANG', k, tuple(round(x, 3) for x in P['thigh_l'].head), tuple(round(x, 3) for x in P['calf_l'].head), tuple(round(x, 3) for x in P['calf_l'].tail))
