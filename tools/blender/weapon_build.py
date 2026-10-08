"""Low-poly weapon models for the player's hand.
Run: blender -b --factory-startup --python tools/blender/weapon_build.py   (or via tools/heavy.sh)
Writes public/models/weapon_<id>.glb for pistol, smg, shotgun, rifle, sniper, grenade.

Conventions (glTF space, metres): the grip is the origin, +Z is the barrel direction, +Y is up, +X is the weapon's left.
Every gun has an empty called "Muzzle" at the barrel tip; the game uses it for the muzzle flash and the tracer start.
Parts are described in glTF space and converted to Blender space (x, -z, y) in the helpers.
"""
import math
import os
import bmesh
import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT_DIR = os.path.join(ROOT, 'public', 'models')

COLORS = {  # name: (rgba, roughness, metallic)
    'Metal': ((0.10, 0.10, 0.12, 1), 0.38, 0.8),
    'MetalLight': ((0.34, 0.35, 0.38, 1), 0.4, 0.8),
    'Grip': ((0.04, 0.04, 0.05, 1), 0.85, 0.0),
    'Wood': ((0.36, 0.20, 0.09, 1), 0.7, 0.0),
    'Olive': ((0.18, 0.26, 0.10, 1), 0.6, 0.1),
    'Glass': ((0.05, 0.12, 0.2, 1), 0.1, 0.2),
    'Brass': ((0.75, 0.55, 0.15, 1), 0.35, 0.9),
}
_mats = {}


def mat(name):
    if name not in _mats:
        col, rough, metal = COLORS[name]
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        b.inputs['Base Color'].default_value = col
        b.inputs['Roughness'].default_value = rough
        b.inputs['Metallic'].default_value = metal
        _mats[name] = m
    return _mats[name]


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _mats.clear()


def to_bl(p):
    return (p[0], -p[2], p[1])


def make(name, bm, material, pos, pitch=0.0):
    """Turn a bmesh (already in glTF-axis coordinates) into an object at pos (glTF space), tilted by pitch (rad, about X)."""
    for v in bm.verts:
        v.co = to_bl(v.co)
    if pitch:
        bmesh.ops.rotate(bm, verts=bm.verts[:], cent=(0, 0, 0), matrix=__import__('mathutils').Matrix.Rotation(-pitch, 3, 'X'))
    bmesh.ops.translate(bm, verts=bm.verts[:], vec=to_bl(pos))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat(material))
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def box(name, material, pos, size, pitch=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= size[0]; v.co.y *= size[1]; v.co.z *= size[2]
    # cube verts are (x, y, z) in glTF axes here; make() converts
    return make(name, bm, material, pos, pitch)


def cyl(name, material, pos, r, length, axis='z', seg=8, r2=None):
    """Cylinder along a glTF axis ('z' = barrel direction, 'y' = up, 'x' = sideways)."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=length)
    # create_cone builds along its local Z; move that onto the wanted axis
    for v in bm.verts:
        x, y, z = v.co
        if axis == 'z':
            v.co = (x, y, z)
        elif axis == 'y':
            v.co = (x, z, y)
        else:
            v.co = (z, x, y)
    return make(name, bm, material, pos)


def sphere(name, material, pos, r, scale=(1, 1, 1), seg=8, rings=6):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    for v in bm.verts:
        v.co.x *= scale[0]; v.co.y *= scale[1]; v.co.z *= scale[2]
    return make(name, bm, material, pos)


def empty(name, pos):
    ob = bpy.data.objects.new(name, None)
    ob.location = to_bl(pos)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def finish(filename):
    # join all meshes into one object (one draw call per material in the game)
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    tris = sum(len(p.vertices) - 2 for p in bpy.context.view_layer.objects.active.data.polygons)
    path = os.path.join(OUT_DIR, filename)
    os.makedirs(OUT_DIR, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_yup=True,
                              export_cameras=False, export_lights=False)
    print('exported', path, os.path.getsize(path), 'bytes,', tris, 'tris')


# ---------------------------------------------------------------------------------------------- weapons
def pistol():
    box('slide', 'MetalLight', (0, 0.035, 0.085), (0.032, 0.036, 0.2))
    box('frame', 'Metal', (0, 0.005, 0.07), (0.034, 0.03, 0.17))
    box('grip', 'Grip', (0, -0.055, -0.005), (0.036, 0.11, 0.05), pitch=math.radians(-12))
    box('guard', 'Metal', (0, -0.03, 0.06), (0.02, 0.012, 0.05))
    box('sight', 'Metal', (0, 0.058, 0.17), (0.01, 0.012, 0.012))
    empty('Muzzle', (0, 0.035, 0.19))


def smg():
    box('body', 'Metal', (0, 0.02, 0.1), (0.05, 0.075, 0.26))
    box('top', 'MetalLight', (0, 0.065, 0.1), (0.03, 0.015, 0.22))
    cyl('barrel', 'MetalLight', (0, 0.03, 0.31), 0.014, 0.16)
    box('shroud', 'Metal', (0, 0.03, 0.27), (0.04, 0.045, 0.1))
    box('mag', 'MetalLight', (0, -0.1, 0.1), (0.032, 0.15, 0.05), pitch=math.radians(6))
    box('grip', 'Grip', (0, -0.06, -0.005), (0.036, 0.11, 0.05), pitch=math.radians(-12))
    box('stock', 'Metal', (0, 0.02, -0.14), (0.025, 0.035, 0.18))
    box('stockend', 'Grip', (0, 0.0, -0.24), (0.03, 0.08, 0.02))
    empty('Muzzle', (0, 0.03, 0.4))


def shotgun():
    box('receiver', 'Metal', (0, 0.015, 0.02), (0.046, 0.075, 0.24))
    cyl('barrel', 'MetalLight', (0, 0.04, 0.44), 0.019, 0.6)
    cyl('tube', 'Metal', (0, 0.0, 0.40), 0.015, 0.46)
    box('pump', 'Wood', (0, 0.0, 0.34), (0.05, 0.05, 0.16))
    box('stock', 'Wood', (0, 0.0, -0.26), (0.042, 0.1, 0.34), pitch=math.radians(-6))
    box('grip', 'Wood', (0, -0.05, -0.03), (0.04, 0.09, 0.045), pitch=math.radians(-18))
    box('bead', 'Metal', (0, 0.065, 0.73), (0.008, 0.012, 0.012))
    empty('Muzzle', (0, 0.04, 0.75))


def rifle():
    box('receiver', 'Metal', (0, 0.025, 0.1), (0.05, 0.085, 0.34))
    box('handguard', 'Metal', (0, 0.02, 0.38), (0.056, 0.06, 0.22))
    box('rail', 'MetalLight', (0, 0.07, 0.2), (0.022, 0.016, 0.34))
    cyl('barrel', 'MetalLight', (0, 0.03, 0.58), 0.013, 0.2)
    box('muzzlebrake', 'Metal', (0, 0.03, 0.69), (0.03, 0.03, 0.04))
    box('mag', 'MetalLight', (0, -0.1, 0.16), (0.034, 0.17, 0.055), pitch=math.radians(14))
    box('grip', 'Grip', (0, -0.06, -0.01), (0.036, 0.11, 0.05), pitch=math.radians(-16))
    box('stock', 'Grip', (0, 0.0, -0.22), (0.04, 0.09, 0.24), pitch=math.radians(-4))
    box('sight', 'Metal', (0, 0.09, 0.48), (0.01, 0.03, 0.012))
    empty('Muzzle', (0, 0.03, 0.71))


def sniper():
    box('receiver', 'Metal', (0, 0.02, 0.04), (0.046, 0.08, 0.32))
    cyl('barrel', 'MetalLight', (0, 0.035, 0.6), 0.014, 0.74)
    box('barrelhub', 'Metal', (0, 0.035, 0.3), (0.036, 0.04, 0.1))
    cyl('scope', 'Metal', (0, 0.1, 0.06), 0.028, 0.3)
    cyl('lensfront', 'Glass', (0, 0.1, 0.215), 0.032, 0.025, r2=0.026)
    cyl('lensback', 'Glass', (0, 0.1, -0.095), 0.026, 0.02, r2=0.031)
    box('mount1', 'Metal', (0, 0.07, 0.15), (0.014, 0.03, 0.03))
    box('mount2', 'Metal', (0, 0.07, -0.02), (0.014, 0.03, 0.03))
    box('mag', 'MetalLight', (0, -0.05, 0.08), (0.03, 0.06, 0.07))
    box('stock', 'Wood', (0, -0.005, -0.27), (0.046, 0.11, 0.38), pitch=math.radians(-5))
    box('cheek', 'Wood', (0, 0.05, -0.2), (0.04, 0.04, 0.2))
    box('grip', 'Wood', (0, -0.055, -0.04), (0.04, 0.1, 0.045), pitch=math.radians(-18))
    box('bolt', 'MetalLight', (0.04, 0.03, 0.0), (0.03, 0.012, 0.012))
    empty('Muzzle', (0, 0.035, 0.98))


def grenade():
    sphere('body', 'Olive', (0, 0, 0), 0.036, scale=(1, 1.25, 1), seg=10, rings=8)
    cyl('neck', 'MetalLight', (0, 0.056, 0), 0.014, 0.025, axis='y')
    box('lever', 'MetalLight', (0.02, 0.03, 0), (0.008, 0.07, 0.016))
    cyl('pin', 'Brass', (0, 0.07, 0.0), 0.006, 0.02, axis='x')
    empty('Muzzle', (0, 0.07, 0))


BUILDERS = {'pistol': pistol, 'smg': smg, 'shotgun': shotgun, 'rifle': rifle, 'sniper': sniper, 'grenade': grenade}

if __name__ == '__main__':
    for wid, fn in BUILDERS.items():
        reset()
        fn()
        finish('weapon_%s.glb' % wid)
