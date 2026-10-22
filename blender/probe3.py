import bpy
for o in bpy.data.objects:
    if o.type!='MESH': continue
    print(o.name, [(m.type, getattr(m,'vertex_group',None), getattr(m,'invert_vertex_group',None)) for m in o.modifiers], [m.name for m in o.data.materials], len(o.vertex_groups))
    for m in o.data.materials:
        if m and m.use_nodes:
            print('   ', m.name, [(n.type, n.image.name if getattr(n,'image',None) else '') for n in m.node_tree.nodes if n.type in ('TEX_IMAGE','BSDF_PRINCIPLED','GROUP')])
