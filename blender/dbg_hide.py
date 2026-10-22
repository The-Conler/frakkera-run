import bpy, sys
for n in sys.argv[sys.argv.index('--')+1].split(','):
    o = bpy.data.objects.get(n)
    if o: o.hide_render = True
bpy.ops.wm.save_as_mainfile(filepath='/workspace/frakkera-run/.tmp/blend/dbg.blend')
