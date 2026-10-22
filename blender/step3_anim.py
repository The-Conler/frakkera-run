# Passo 3: posa di trasporto (IK mani sulla frakkera), animazioni procedurali "a mano" via script, bake manuale -> azioni.
import bpy, math, sys, os
from mathutils import Vector, Quaternion, Matrix
OUT = '/workspace/frakkera-run/.tmp/blend/step3.blend'
rig = bpy.data.objects['Human.rig']; arm = rig.data; frk = bpy.data.objects['frakkera']
sc = bpy.context.scene; sc.render.fps = 30
sys.path.insert(0, '/workspace/frakkera-run/blender')
from frk_common import AX, G, L, SG, B0, rprof
# ---- osso 'carry' (presa, figlio del torace) -> 'frakkera' (puo' scorrere tra le mani)
bpy.context.view_layer.objects.active = rig; bpy.ops.object.mode_set(mode='EDIT')
eb = arm.edit_bones; fb = eb['frakkera']
cb = eb.new('carry'); cb.head = fb.head; cb.tail = fb.tail; cb.roll = fb.roll; cb.parent = eb['spine_03']; fb.parent = cb
bpy.ops.object.mode_set(mode='OBJECT')
for n in ('grip_l', 'grip_r'):
    if n in bpy.data.objects: bpy.data.objects.remove(bpy.data.objects[n])
def empty(name, pos, parent_bone=None):
    e = bpy.data.objects.new(name, None); sc.collection.objects.link(e); e.empty_display_size = 0.05
    e.parent = rig
    if parent_bone: e.parent_type = 'BONE'; e.parent_bone = parent_bone
    bpy.context.view_layer.update()
    e.matrix_world = Matrix.Translation(Vector(pos)); return e
def gpos(s, ang, off):
    a = math.radians(ang); return B0 + AX * s + Vector((math.cos(a), math.sin(a), 0)) * (rprof(s) + off)
GR = {'r': (SG + 0.08, 215, 0.045), 'l': (SG - 0.12, 330, 0.045)}
grip = {s: empty('grip_' + s, gpos(*GR[s]), 'carry') for s in 'lr'}
apole = {'r': empty('pole_arm_r', (-0.6, -0.05, 0.95)), 'l': empty('pole_arm_l', (0.45, -0.25, 0.8))}
foot_t = {s: empty('ik_foot_' + s, (sg * 0.17, -0.01, 0.07)) for s, sg in (('l', 1), ('r', -1))}
lpole = {s: empty('pole_leg_' + s, (sg * 0.17, -0.8, 0.5)) for s, sg in (('l', 1), ('r', -1))}
foot_r = {}
for s in 'lr':
    e = bpy.data.objects.new('rot_foot_' + s, None); sc.collection.objects.link(e); e.parent = rig; e.rotation_mode = 'QUATERNION'; foot_r[s] = e
P = rig.pose.bones; B = arm.bones
REST = {b.name: b.matrix_local.to_quaternion() for b in B}
def signed_angle(u, v, n):
    a = u.angle(v); return -a if u.cross(v).dot(n) < 0 else a
def pole_angle(base, tipb, pole):
    bb, tb = B[base], B[tipb]
    h, t = bb.head_local, tb.tail_local
    pn = (t - h).cross(pole - h); proj = pn.cross(bb.tail_local - h)
    return signed_angle(bb.matrix_local.to_3x3() @ Vector((1, 0, 0)), proj, bb.tail_local - h)
def add_ik(bone, base, tgt, pole):
    c = P[bone].constraints.new('IK'); c.target = tgt; c.pole_target = pole; c.chain_count = 2; c.use_tail = True
for s in 'lr':
    add_ik(f'lowerarm_{s}', f'upperarm_{s}', grip[s], apole[s])
    add_ik(f'calf_{s}', f'thigh_{s}', foot_t[s], lpole[s])
    c = P[f'foot_{s}'].constraints.new('COPY_ROTATION'); c.target = foot_r[s]
# calibrazione empirica del pole_angle: il gomito/ginocchio deve puntare verso il pole
for s, sg in (('l', 1), ('r', -1)): foot_t[s].location = (sg * 0.17, -0.06, 0.25)
for bone, base, pole in [(f'{a}_{s}', f'{b}_{s}', pl[s]) for s in 'lr' for a, b, pl in (('lowerarm', 'upperarm', apole), ('calf', 'thigh', lpole))]:
    c = P[bone].constraints[0]; best = None
    for k in range(72):
        c.pole_angle = math.radians(k * 5 - 180); bpy.context.view_layer.update()
        h, m, t = P[base].head, P[bone].head, P[bone].tail
        d = (t - h).normalized(); pr = h + d * (m - h).dot(d)
        pp = pole.matrix_world.translation; pq = h + d * (pp - h).dot(d)
        sc_ = (m - pr).normalized().dot((pp - pq).normalized())
        if best is None or sc_ > best[0]: best = (sc_, k * 5 - 180)
    c.pole_angle = math.radians(best[1]); print('POLE', bone, best)
X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
def R(ax, deg): return Quaternion(ax, math.radians(deg))
def setrot(name, *qs):
    q = Quaternion()
    for x in qs: q = q @ x
    r = REST[name]; P[name].rotation_quaternion = r.inverted() @ q @ r
def setloc(name, d): P[name].location = REST[name].inverted() @ Vector(d)
for pb in P: pb.rotation_mode = 'QUATERNION'
def reset():
    for pb in P: pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
FINGERS = ['index', 'middle', 'ring', 'pinky']
def hands(curl=1.0):
    for s in 'lr':
        for f in FINGERS:
            for k, a in ((1, 55), (2, 65), (3, 40)):
                P[f'{f}_0{k}_{s}'].rotation_quaternion = Quaternion(X, math.radians(a * curl))
        P[f'thumb_02_{s}'].rotation_quaternion = Quaternion(X, math.radians(25 * curl))
        P[f'thumb_03_{s}'].rotation_quaternion = Quaternion(X, math.radians(30 * curl))
def catmull(pts, p):
    n = len(pts); p = (p % 1.0) * n; i = int(p); t = p - i
    P0, P1, P2, P3 = (pts[(i + k) % n] for k in (-1, 0, 1, 2))
    return tuple(0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t) for a, b, c, d in zip(P0, P1, P2, P3))
# traiettoria della caviglia nella corsa (y avanti/indietro, z altezza, pitch del piede): 8 campioni equidistanti
RUNPATH = [(-0.34, 0.075, -14), (-0.14, 0.07, -2), (0.08, 0.07, 6), (0.28, 0.11, 30), (0.38, 0.28, 52), (0.24, 0.43, 45), (-0.08, 0.38, 14), (-0.33, 0.2, -12)]
def legs_run(phi, stride=1.0, lift=1.0, width=0.14, dx=0.0):
    for s, sg, off in (('l', 1, 0.0), ('r', -1, 0.5)):
        y, z, pitch = catmull(RUNPATH, phi + off)
        foot_t[s].location = (sg * width + dx, y * stride - 0.01, 0.07 + (z - 0.07) * lift)
        foot_r[s].rotation_quaternion = R(X, pitch * lift) @ REST[f'foot_{s}']
def legs_stand(w=0.17, dx=0.0, ya=0.0, yb=0.0):
    for s, sg, yy in (('l', 1, ya), ('r', -1, yb)):
        foot_t[s].location = (sg * w + dx, -0.013 + yy, 0.07)
        foot_r[s].rotation_quaternion = R(Z, sg * 8) @ REST[f'foot_{s}']
def upper(lean, twist=0.0, roll=0.0, breath=0.0, head_pitch=None):
    setrot('spine_01', R(X, lean * 0.4), R(Z, twist * 0.3), R(Y, roll * 0.4))
    setrot('spine_02', R(X, lean * 0.35), R(Z, twist * 0.35), R(Y, roll * 0.35))
    setrot('spine_03', R(X, lean * 0.25 - breath), R(Z, twist * 0.35), R(Y, roll * 0.25))
    hp = -lean * 0.7 if head_pitch is None else head_pitch
    setrot('neck_01', R(X, hp * 0.5 + breath * 0.5), R(Y, -roll * 0.3))
    setrot('head', R(X, hp * 0.5), R(Y, -roll * 0.3))
    for s, sg in (('l', 1), ('r', -1)):
        setrot(f'clavicle_{s}', R(Z, -sg * 12), R(Y, -sg * 3))
def carry(pitch=0.0, roll=0.0, slide=0.0, yaw=0.0):
    setrot('carry', R(X, pitch), R(Y, roll), R(Z, yaw))
    P['frakkera'].location = (0, slide, 0)
UPRIGHT = (-12.0, 6.0)
RUNSLIDE = 0.58
RUNPITCH = -9.0
RUNROLL = -9.0
# ------------------------------------------------------------------------------------------- clip
def c_idle(f, n):
    ph = f / n; br = math.sin(2 * math.pi * ph)
    reset(); hands()
    setloc('pelvis', (0.012 * math.sin(2 * math.pi * ph), 0, -0.02 + 0.004 * br))
    setrot('pelvis', R(Y, 1.5 * math.sin(2 * math.pi * ph)))
    legs_stand(0.17, ya=-0.03, yb=0.05)
    upper(-2, breath=1.2 * br, head_pitch=-1)
    carry(UPRIGHT[0] + 0.6 * br, UPRIGHT[1], -0.13)
def run_core(phi, amp=1.0, lean=14.0):
    s2 = math.cos(4 * math.pi * (phi - 0.06))
    setloc('pelvis', (0.014 * math.sin(2 * math.pi * phi), 0.02, -0.07 - 0.02 * s2 * amp))
    setrot('pelvis', R(X, 6), R(Z, -7 * math.cos(2 * math.pi * phi) * amp), R(Y, 3 * math.sin(2 * math.pi * phi) * amp))
    upper(lean + 1.5 * s2 * amp, twist=7 * math.cos(2 * math.pi * phi) * amp, breath=0)
    carry(RUNPITCH + 2.2 * math.sin(4 * math.pi * phi + 0.9) * amp, RUNROLL + 2.5 * math.sin(2 * math.pi * phi + 0.7) * amp, RUNSLIDE)
def c_run(f, n):
    phi = f / n; reset(); hands(); legs_run(phi); run_core(phi)
def c_lean(sign):
    def fn(f, n):
        phi = f / n; reset(); hands(); legs_run(phi, width=0.15, dx=-sign * 0.03); run_core(phi)
        q = P['pelvis'].rotation_quaternion.copy()
        setrot('pelvis', R(X, 6), R(Y, sign * 7), R(Z, sign * 5 - 7 * math.cos(2 * math.pi * phi)))
        P['pelvis'].location = P['pelvis'].location + REST['pelvis'].inverted() @ Vector((sign * 0.04, 0, 0))
        upper(14, twist=sign * 8 + 6 * math.cos(2 * math.pi * phi), roll=sign * 6)
        carry(RUNPITCH + 2.0 * math.sin(4 * math.pi * phi + 0.9), RUNROLL - sign * 5 + 2.0 * math.sin(2 * math.pi * phi + 0.7), RUNSLIDE, sign * 3)
    return fn
def c_stumble(f, n):
    t = f / 30.0; phi = (f / 20.0) % 1.0
    reset(); hands(0.8 + 0.2 * math.cos(t * 9)); legs_run(phi, stride=0.8)
    env = math.sin(math.pi * min(1, t / 0.32)) if t < 0.32 else math.exp(-(t - 0.32) * 6) * math.cos((t - 0.32) * 14)
    s2 = math.cos(4 * math.pi * (phi - 0.06))
    setloc('pelvis', (0.03 * math.sin(t * 20) * math.exp(-t * 4), 0.02, -0.08 - 0.06 * max(0, env)))
    setrot('pelvis', R(X, 6 + 8 * env), R(Z, -6 * math.cos(2 * math.pi * phi)), R(Y, 6 * math.sin(t * 17) * math.exp(-t * 3)))
    upper(14 + 16 * env, twist=10 * math.sin(t * 15) * math.exp(-t * 3), roll=7 * math.sin(t * 19) * math.exp(-t * 3), head_pitch=-6 - 10 * env)
    shake = math.exp(-t * 4.5)
    carry(RUNPITCH + 9 * env + 6 * math.sin(2 * math.pi * 6 * t) * shake, RUNROLL + 6 * math.sin(2 * math.pi * 4.5 * t + 1) * shake, RUNSLIDE)
def smooth(a, b, t):
    t = max(0.0, min(1.0, (t - a) / (b - a))); return t * t * (3 - 2 * t)
def c_gameover(f, n):
    t = f / 30.0
    # fase del passo con cadenza che rallenta fino a fermarsi
    T1 = 0.75
    rate = lambda tt: 1.5 * (1 - min(tt, T1) / T1) ** 1.3
    phi = sum(rate(i / 300.0) for i in range(int(t * 300))) / 300.0
    k = smooth(0.15, 1.0, t)           # 0 corsa -> 1 fermo
    reset(); hands()
    legs_run(phi, stride=1 - 0.8 * k, lift=1 - k)
    # blend piedi verso la posizione ferma
    stand = {'l': (0.17, -0.05), 'r': (-0.17, 0.07)}
    for s in 'lr':
        a = foot_t[s].location.copy(); b = Vector((stand[s][0], stand[s][1], 0.07))
        foot_t[s].location = a.lerp(b, smooth(0.5, 1.15, t))
        qa = foot_r[s].rotation_quaternion.copy(); qb = R(Z, (8 if s == 'l' else -8)) @ REST[f'foot_{s}']
        foot_r[s].rotation_quaternion = qa.slerp(qb, smooth(0.5, 1.15, t))
    run_amp = 1 - k
    s2 = math.cos(4 * math.pi * (phi - 0.06))
    br = math.sin(2 * math.pi * t * 0.9) * smooth(1.0, 1.4, t)
    setloc('pelvis', (0, 0.02 * (1 - k), (-0.07 - 0.02 * s2) * (1 - k) + (-0.035 + 0.004 * br) * k))
    setrot('pelvis', R(X, 6 * (1 - k) + 2 * k), R(Z, -7 * math.cos(2 * math.pi * phi) * run_amp))
    lean = 14 * (1 - k) + 9 * k
    upper(lean + 1.5 * s2 * run_amp, twist=7 * math.cos(2 * math.pi * phi) * run_amp, breath=2.0 * br, head_pitch=-lean * 0.7 * (1 - k) + 14 * k)
    kk = smooth(0.35, 1.3, t)
    carry(RUNPITCH + (UPRIGHT[0] - RUNPITCH) * kk + 1.5 * math.sin(t * 6) * math.exp(-t * 1.5) * kk, RUNROLL + (UPRIGHT[1] - RUNROLL) * kk, RUNSLIDE + (-0.13 - RUNSLIDE) * smooth(0.5, 1.5, t))
CLIPS = [('idle', c_idle, 60, True), ('run', c_run, 20, True), ('left', c_lean(1), 20, True), ('right', c_lean(-1), 20, True), ('stumble', c_stumble, 24, False), ('gameover', c_gameover, 54, False)]
BONES = [b.name for b in B]
baked = {}
for name, fn, n, loop in CLIPS:
    frames = []
    for f in range(n + 1):
        fn(f if not (loop and f == n) else n, n)
        bpy.context.view_layer.update()
        rec = {}
        for pb in P:
            m = rig.convert_space(pose_bone=pb, matrix=pb.matrix, from_space='POSE', to_space='LOCAL')
            l, q, _ = m.decompose(); rec[pb.name] = (l, q)
        frames.append(rec)
        if f == 0 and os.environ.get('DBG'):
            for b in ('thigh_l', 'calf_l', 'foot_l', 'upperarm_r', 'lowerarm_r'):
                print('DBG', name, b, tuple(round(x, 3) for x in P[b].head), tuple(round(x, 3) for x in P[b].tail))
            print('DBG target', tuple(foot_t['l'].matrix_world.translation), tuple(grip['r'].matrix_world.translation), rig.matrix_world)
    baked[name] = frames
    print('BAKED', name, len(frames))
# via vincoli ed helper
for pb in P:
    for c in list(pb.constraints): pb.constraints.remove(c)
for o in list(bpy.data.objects):
    if o.type == 'EMPTY' and o.name != 'frakkera_tip': bpy.data.objects.remove(o)
reset()
rig.animation_data_create()
LOCB = {'pelvis', 'frakkera'}
for name, frames in baked.items():
    act = bpy.data.actions.new(name); act.use_fake_user = True
    for bn in BONES:
        dp = f'pose.bones["{bn}"]'
        prev = None; qs = []
        for rec in frames:
            q = rec[bn][1].copy()
            if prev is not None and prev.dot(q) < 0: q.negate()
            prev = q; qs.append(q)
        for i in range(4):
            fc = act.fcurves.new(dp + '.rotation_quaternion', index=i, action_group=bn)
            fc.keyframe_points.add(len(qs))
            for k, q in enumerate(qs): fc.keyframe_points[k].co = (k, q[i]); fc.keyframe_points[k].interpolation = 'LINEAR'
        if bn in LOCB:
            for i in range(3):
                fc = act.fcurves.new(dp + '.location', index=i, action_group=bn)
                fc.keyframe_points.add(len(frames))
                for k, rec in enumerate(frames): fc.keyframe_points[k].co = (k, rec[bn][0][i]); fc.keyframe_points[k].interpolation = 'LINEAR'
    tr = rig.animation_data.nla_tracks.new(); tr.name = name; st = tr.strips.new(name, 0, act); tr.mute = True
rig.animation_data.action = bpy.data.actions['idle']
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print('SAVED')
