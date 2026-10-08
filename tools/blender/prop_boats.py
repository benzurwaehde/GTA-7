"""Three low-poly boats for the Marlin Pier harbour: prop_boat_skiff, prop_boat_sail, prop_boat_yacht.
Run: blender -b --factory-startup --python tools/blender/prop_boats.py   (or tools/heavy.sh blender -b ...)

Conventions (same as the car scripts): metres, bow = -Y in Blender (becomes +Z in the glTF export),
waterline at z=0, up = +Z. The game bakes each material colour into vertex colours and merges every boat
into one draw call, so keep the material count small and set Base Color on the Principled node.
Own work, no external assets (CC0 by the author).
"""
import math
import os
import bmesh
import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT_DIR = os.path.join(ROOT, 'public', 'models')

MATS = {
    'Hull': ((0.92, 0.92, 0.90, 1), 0.45),
    'HullDark': ((0.10, 0.20, 0.42, 1), 0.5),
    'Deck': ((0.62, 0.45, 0.27, 1), 0.8),
    'Trim': ((0.08, 0.08, 0.09, 1), 0.7),
    'Cabin': ((0.88, 0.86, 0.80, 1), 0.6),
    'Glass': ((0.06, 0.12, 0.18, 1), 0.1),
    'Sail': ((0.96, 0.94, 0.88, 1), 0.9),
    'Accent': ((0.78, 0.12, 0.10, 1), 0.5),
}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for m in list(bpy.data.materials):
        bpy.data.materials.remove(m)
    _cache.clear()


_cache = {}


def mat(name, color=None):
    key = (name, color)
    if key in _cache:
        return _cache[key]
    col, rough = MATS[name]
    if color:
        col = color
    m = bpy.data.materials.new(name + ('' if not color else '_c'))
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = col
    b.inputs['Roughness'].default_value = rough
    _cache[key] = m
    return m


def _obj(name, bm, material):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def hull(name, material, stations):
    """stations: (y, half_beam, z_keel, z_gunwale) from stern (+y) to bow (-y). Closed solid with a 5-point section."""
    bm = bmesh.new()
    rings = []
    for y, hb, zk, zg in stations:
        pts = [(-hb, y, zg), (-hb * 0.93, y, zk + 0.32 * (zg - zk)), (0.0, y, zk),
               (hb * 0.93, y, zk + 0.32 * (zg - zk)), (hb, y, zg)]
        rings.append([bm.verts.new(p) for p in pts])
    for a, b in zip(rings, rings[1:]):
        for i in range(4):
            bm.faces.new((a[i], a[i + 1], b[i + 1], b[i]))
        bm.faces.new((a[4], a[0], b[0], b[4]))  # open top closed below by the deck piece
    bm.faces.new(rings[0][::-1])
    bm.faces.new(rings[-1])
    return _obj(name, bm, material)


def box(name, material, size, loc, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    ob = _obj(name, bm, material)
    ob.location = loc
    ob.rotation_euler = rot
    return ob


def cyl(name, material, r, h, loc, segs=10, r2=None, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r if r2 is None else r2, depth=h)
    ob = _obj(name, bm, material)
    ob.location = loc
    ob.rotation_euler = rot
    return ob


def sail(name, material, pts):
    """Flat double-sided sail from a polygon given as (x, y, z) points."""
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in pts]
    bm.faces.new(vs)
    bm.faces.new([bm.verts.new(p) for p in reversed(pts)])  # separate verts: back side
    return _obj(name, bm, material)


def export(filename):
    os.makedirs(OUT_DIR, exist_ok=True)
    for o in bpy.context.scene.objects:
        o.select_set(o.type == 'MESH')
    path = os.path.join(OUT_DIR, filename)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, use_selection=True,
                              export_yup=True, export_cameras=False, export_lights=False)
    tris = sum(len(p.vertices) - 2 for o in bpy.context.scene.objects if o.type == 'MESH' for p in o.data.polygons)
    print('exported', path, os.path.getsize(path), 'bytes', tris, 'tris')


# ---------------------------------------------------------------- boats
def skiff():
    reset()
    L = 5.2
    st = [(L / 2, 0.85, -0.38, 0.55), (L / 2 - 0.4, 0.95, -0.40, 0.58), (0.4, 0.95, -0.40, 0.60), (-1.2, 0.80, -0.36, 0.68),
          (-2.0, 0.40, -0.25, 0.80), (-L / 2, 0.04, -0.10, 0.92)]
    hull('hull', mat('Hull'), st)
    box('stripe', mat('HullDark'), (1.92, 4.2, 0.12), (0, 0.2, 0.30))
    box('floor', mat('Deck'), (1.5, 3.4, 0.05), (0, 0.4, 0.57))
    box('seat', mat('Cabin'), (1.3, 0.5, 0.35), (0, 0.4, 0.75))
    box('console', mat('Cabin'), (0.8, 0.5, 0.55), (0, -0.8, 0.85))
    box('screen', mat('Glass'), (0.9, 0.06, 0.32), (0, -1.05, 1.28), rot=(math.radians(-25), 0, 0))
    box('engine', mat('Trim'), (0.45, 0.55, 0.7), (0, 2.75, 0.45))
    box('leg', mat('Trim'), (0.15, 0.2, 0.7), (0, 2.85, -0.05))
    export('prop_boat_skiff.glb')


def sailboat():
    reset()
    L = 9.5
    st = [(L / 2, 1.25, -0.55, 0.85), (L / 2 - 0.6, 1.5, -0.85, 0.95), (1.0, 1.55, -1.0, 1.0), (-1.5, 1.30, -0.85, 1.05),
          (-3.2, 0.60, -0.40, 1.25), (-L / 2, 0.05, -0.1, 1.45)]
    hull('hull', mat('Hull'), st)
    box('stripe', mat('HullDark'), (3.1, 7.0, 0.14), (0, 0.4, 0.55))
    box('deck', mat('Deck'), (2.7, 7.4, 0.07), (0, 0.6, 1.02))
    box('cabin', mat('Cabin'), (1.9, 3.2, 0.7), (0, 0.4, 1.4))
    box('windows', mat('Glass'), (1.95, 2.2, 0.22), (0, 0.4, 1.5))
    box('hatch', mat('Trim'), (0.8, 0.8, 0.12), (0, -0.8, 1.78))
    cyl('mast', mat('Trim'), 0.07, 12.0, (0, -0.9, 7.0), segs=6)
    box('boom', mat('Trim'), (0.08, 3.6, 0.08), (0, 1.0, 2.1))
    sail('main', mat('Sail'), [(0, -0.95, 12.4), (0, -0.95, 2.2), (0, 2.8, 2.2)])
    sail('jib', mat('Sail'), [(0, -1.1, 11.2), (0, -1.1, 1.8), (0, -4.6, 1.5)])
    box('flag', mat('Accent'), (0.02, 0.5, 0.25), (0, -0.95, 12.3))
    export('prop_boat_sail.glb')


def yacht():
    reset()
    L = 13.0
    st = [(L / 2, 2.0, -0.55, 1.35), (L / 2 - 0.8, 2.15, -0.75, 1.40), (1.5, 2.15, -0.85, 1.45), (-2.5, 1.85, -0.75, 1.55),
          (-4.6, 0.95, -0.40, 1.75), (-L / 2, 0.06, -0.10, 2.0)]
    hull('hull', mat('Hull'), st)
    box('stripe', mat('HullDark'), (4.4, 10.5, 0.16), (0, 0.5, 0.65))
    box('deck', mat('Deck'), (3.9, 11.5, 0.08), (0, 0.6, 1.42))
    box('cabin', mat('Cabin'), (3.3, 5.6, 1.25), (0, 1.2, 2.08))
    box('windows', mat('Glass'), (3.36, 4.6, 0.5), (0, 1.2, 2.25))
    box('bridge', mat('Cabin'), (2.5, 3.0, 1.0), (0, 0.4, 3.2))
    box('bridgeglass', mat('Glass'), (2.56, 2.2, 0.4), (0, 0.4, 3.3))
    box('roof', mat('Accent'), (2.8, 3.4, 0.1), (0, 0.4, 3.75))
    cyl('mast', mat('Trim'), 0.05, 2.2, (0, 0.8, 4.8), segs=6)
    box('radar', mat('Trim'), (1.0, 0.1, 0.1), (0, 0.8, 5.9))
    box('rail', mat('Cabin'), (3.6, 0.06, 0.06), (0, -4.7, 1.95))
    box('swim', mat('Trim'), (2.6, 1.0, 0.06), (0, 6.2, 0.35))
    export('prop_boat_yacht.glb')


if __name__ == '__main__':
    skiff()
    sailboat()
    yacht()
