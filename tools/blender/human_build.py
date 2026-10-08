# Builds the game's human GLBs from the CC0 Quaternius models (see CREDITS.md).
# Usage: blender -b --factory-startup --python tools/blender/human_build.py
# For each source: drop helper meshes, bake every material into ONE vertex-colour material
# (COLOR_0 = flat colour, COLOR_1.r = region id for runtime tinting), scale to ~1.8 m, export with animations.
#   region: 0 fixed, .25 shirt, .5 pants, .75 hair, 1 skin
import bpy, bmesh, os, math
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'tools', 'assets-src', 'polypizza-quaternius')
OUT = os.path.join(ROOT, 'public', 'models')
VARIANTS = {  # out name: (source file, add police cap)
    'human_man_a': ('man1', False), 'human_man_b': ('man2', False), 'human_man_suit': ('mansuit', False),
    'human_woman_a': ('woman', False), 'human_woman_casual': ('womancasual', False),
    'human_woman_dress': ('womandress', False), 'human_woman_tank': ('womantank', False),
    'human_cop': ('man2', True),
}
KEEP_ANIMS = ['Idle', 'Walk', 'Run', 'Jump', 'Punch', 'Death']
TARGET_H = 1.8

def region_of(name):
    n = name.lower()
    if 'shirt' in n or 'dress' in n or 'top' in n or 'jacket' in n: return 0.25
    if 'pants' in n or 'legs' in n or 'jeans' in n: return 0.5
    if 'hair' in n: return 0.75
    if n == 'skin': return 1.0
    return 0.0

def base_color(m):
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    c = bsdf.inputs['Base Color'].default_value
    return (c[0], c[1], c[2], 1.0)

def build(out_name, src, cop):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, src + '.glb'))
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    for o in list(bpy.data.objects):
        if o.type == 'MESH' and not any(md.type == 'ARMATURE' for md in o.modifiers):
            bpy.data.objects.remove(o)
    body = next(o for o in bpy.data.objects if o.type == 'MESH')
    me = body.data
    # colour attributes per face corner
    ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    cr = me.color_attributes.new('Reg', 'FLOAT_COLOR', 'CORNER')
    mats = [s.material for s in body.material_slots]
    for p in me.polygons:
        m = mats[p.material_index]
        reg = region_of(m.name)
        col = (1, 1, 1, 1) if reg > 0 else base_color(m)
        if reg == 0.25 or reg == 0.5: col = tuple(min(1, c * 0 + 1) for c in col)
        for li in p.loop_indices:
            ca.data[li].color = col
            cr.data[li].color = (reg, 0, 0, 1)
    me.color_attributes.active_color = ca
    # shirt/pants/hair/skin keep their original brightness as a luminance hint in the colour
    for p in me.polygons:
        m = mats[p.material_index]
        reg = region_of(m.name)
        if reg > 0:
            c = base_color(m); lum = max(0.35, min(1.0, (0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]) ** 0.5 * 1.6))
            if reg == 1.0: lum = 1.0
            for li in p.loop_indices: ca.data[li].color = (lum, lum, lum, 1)
    # world-space measures
    bpy.context.view_layer.update()
    pts = [body.matrix_world @ v.co for v in me.vertices]
    zs = [p.z for p in pts]
    print('RAW', out_name, 'z', min(zs), max(zs), 'tris', sum(len(p.vertices) - 2 for p in me.polygons))
    if cop:
        add_cap(arm, body)
    f = TARGET_H / max(zs)
    arm.scale = (arm.scale[0] * f, arm.scale[1] * f, arm.scale[2] * f)
    # one material
    mat = bpy.data.materials.new('ped')
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Roughness'].default_value = 0.9
    vc = mat.node_tree.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'
    mat.node_tree.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
    me.materials.clear(); me.materials.append(mat)
    for p in me.polygons: p.material_index = 0
    if cop: paint_cap(body)
    # keep only wanted animations
    for a in list(bpy.data.actions):
        short = a.name.split('_')[-1].split('|')[-1]
        if short not in KEEP_ANIMS: bpy.data.actions.remove(a)
    print('ACTIONS', [a.name for a in bpy.data.actions])
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, out_name + '.glb'), export_format='GLB',
        export_vertex_color='NAME', export_vertex_color_name='Col', export_all_vertex_colors=True,
        export_animations=True, export_animation_mode='ACTIONS', export_optimize_animation_size=True,
        export_apply=False, export_yup=True, export_image_format='NONE')

def paint_cap(body):
    me = body.data   # joined cap polygons come last (COLOR_0 of joined polygons exports white, so the cap is tinted via the region id)
    ca, cr = me.color_attributes['Col'], me.color_attributes['Reg']
    for p in me.polygons[body['cap_first_poly']:]:
        for li in p.loop_indices:
            ca.data[li].color = (0.04, 0.09, 0.32, 1); cr.data[li].color = (0.25, 0, 0, 1)   # region 'shirt': the cap takes the uniform shirt colour at runtime
    me.update()

def add_cap(arm, body):
    head = arm.pose.bones['Head'] if 'Head' in arm.pose.bones else arm.pose.bones['Head']
    hw = arm.matrix_world @ head.head
    tw = arm.matrix_world @ head.tail
    print('HEAD world', hw, tw)
    # head top ~ tail; cap sits slightly above the crown
    zs = [(body.matrix_world @ v.co).z for v in body.data.vertices]
    top = max(zs)
    bm = bmesh.new()
    r = 0.115 * (top / 1.8) if top > 0 else 0.115
    cx, cy = hw.x, hw.y
    bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=r * 1.08, radius2=r * 1.0, depth=r * 0.55,
        matrix=__import__('mathutils').Matrix.Translation((cx, cy, top + r * 0.05)))
    bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=r * 1.05, radius2=r * 1.05, depth=r * 0.12,
        matrix=__import__('mathutils').Matrix.Translation((cx, cy - r * 0.95, top - r * 0.2)))
    mesh = bpy.data.meshes.new('cap'); bm.to_mesh(mesh); bm.free()
    ob = bpy.data.objects.new('cap', mesh); bpy.context.collection.objects.link(ob)
    # cap is built in world space; join converts it into the body's local space
    for c in ('Col', 'Reg'):
        a = ob.data.color_attributes.new(c, 'FLOAT_COLOR', 'CORNER')
        for d in a.data: d.color = (0.04, 0.09, 0.32, 1) if c == 'Col' else (0, 0, 0, 1)
    vg = ob.vertex_groups.new(name='Head')
    vg.add(list(range(len(ob.data.vertices))), 1.0, 'REPLACE')
    ob.data.materials.append(body.material_slots[0].material)
    for p in ob.data.polygons: p.material_index = 0
    n0 = len(body.data.polygons)
    with bpy.context.temp_override(active_object=body, object=body, selected_objects=[body, ob], selected_editable_objects=[body, ob]):
        bpy.ops.object.join()
    body['cap_first_poly'] = n0

os.makedirs(OUT, exist_ok=True)
import sys
only = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else list(VARIANTS)
for k in only:
    build(k, *VARIANTS[k])
