"""Shared helpers for the car_*.py Blender scripts (run headless, see car_sedan.py).

Conventions: metres, car front = -Y in Blender (becomes +Z in the glTF export), ground at z=0 (y=0 in glTF),
left of the car = +X. Bodies are lofted from superellipse cross sections, so shapes stay round and low-poly.
"""
import math
import os
import bmesh
import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT_DIR = os.path.join(ROOT, 'public', 'models')

# Palette only matters for the Blender renders; the game recolors Paint and bakes the others as vertex colors.
MAT_DEFS = {
    'Paint': ((0.80, 0.12, 0.10, 1), 0.35, 0.3, None),
    'Glass': ((0.04, 0.06, 0.09, 1), 0.08, 0.0, None),
    'Trim': ((0.07, 0.07, 0.08, 1), 0.8, 0.0, None),
    'Rim': ((0.66, 0.69, 0.72, 1), 0.3, 0.9, None),
    'Headlight': ((1.0, 0.94, 0.72, 1), 0.2, 0.0, ((1.0, 0.94, 0.72, 1), 2.0)),
    'Taillight': ((0.7, 0.04, 0.04, 1), 0.3, 0.0, ((1.0, 0.1, 0.1, 1), 1.0)),
    'Siren_Red': ((1.0, 0.1, 0.1, 1), 0.3, 0.0, ((1.0, 0.1, 0.1, 1), 2.0)),
    'Siren_Blue': ((0.15, 0.35, 1.0, 1), 0.3, 0.0, ((0.15, 0.35, 1.0, 1), 2.0)),
}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for m in list(bpy.data.materials):
        bpy.data.materials.remove(m)


_mats = {}


def mat(name):
    if name in _mats and _mats[name].name in bpy.data.materials:
        return _mats[name]
    col, rough, metal, emit = MAT_DEFS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = col
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = emit[0]
        b.inputs['Emission Strength'].default_value = emit[1]
    _mats[name] = m
    return m


def _finish(bm, name, material, smooth_angle=40, recalc=True):
    if recalc:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    lim = math.radians(smooth_angle)
    for f in bm.faces:
        f.smooth = True
    for e in bm.edges:
        if len(e.link_faces) == 2 and e.calc_face_angle(0) > lim:
            e.smooth = False
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    me.materials.append(mat(material))
    return ob


def ring(hw, yb, yt, e, n, z, hw_top=None):
    """Superellipse cross section at depth along the car (blender y = -z), returns list of (x, y, z) points."""
    pts = []
    cy, hh = (yb + yt) / 2, (yt - yb) / 2
    for k in range(n):
        t = 2 * math.pi * k / n
        c, s = math.cos(t), math.sin(t)
        x = hw * math.copysign(abs(c) ** (2 / e), c)
        y = hh * math.copysign(abs(s) ** (2 / e), s)
        if hw_top is not None and s > 0:     # tumblehome: narrower shoulders
            x *= 1 - (1 - hw_top / hw) * s
        pts.append((x, -z, cy + y))
    return pts


def interp(pts, z):
    """pts: [(z, hw, yb, yt, e), ...] sorted front (large z) to back; piecewise linear."""
    if z >= pts[0][0]:
        return pts[0][1:]
    for a, b in zip(pts, pts[1:]):
        if b[0] <= z <= a[0]:
            k = (a[0] - z) / (a[0] - b[0])
            return tuple(a[i] + (b[i] - a[i]) * k for i in range(1, 5))
    return pts[-1][1:]


def loft(name, material, pts, z0=None, z1=None, steps=None, n=16, inflate=0.0, yb_min=None, yt_max=None, caps=True, clip_y=None):
    """Loft along z from z0 (front) to z1 (back) through profile pts. Extra sections at the profile's own knots.
    clip_y: keep only the part of each ring above this height (open arch used for roofs and pillars)."""
    z0 = pts[0][0] if z0 is None else z0
    z1 = pts[-1][0] if z1 is None else z1
    zs = [z0] + [p[0] for p in pts if z1 < p[0] < z0] + [z1]
    if steps:
        zs = [z0 + (z1 - z0) * i / steps for i in range(steps + 1)]
    bm = bmesh.new()
    rings = []
    for z in zs:
        hw, yb, yt, e = interp(pts, z)
        hw += inflate; yt += inflate; yb -= inflate
        if yb_min is not None:
            yb = max(yb, yb_min)
        if yt_max is not None:
            yt = min(yt, yt_max)
        P = ring(max(hw, 0.02), yb, max(yt, yb + 0.02), e, n, z)
        if clip_y is not None:
            # mirror-symmetric arch: right side up to the top, then the left side down again
            keep = [k for k in range(n // 2 + 1) if P[k][2] >= clip_y]
            keep2 = [k for k in range(n // 2, n) if P[k][2] >= clip_y]
            order = [k for k in range(n) if (k in keep or k in keep2)]
            order = sorted(order, key=lambda k: (k + n // 2) % n)   # contiguous run through the top
            rings.append([bm.verts.new(P[k]) for k in order])
        else:
            rings.append([bm.verts.new(p) for p in P])
    for r0, r1 in zip(rings, rings[1:]):
        m = min(len(r0), len(r1))
        rng = range(m - 1) if clip_y is not None else range(m)
        for k in rng:
            bm.faces.new((r0[k], r0[(k + 1) % m], r1[(k + 1) % m], r1[k]))
    if caps and len(rings[0]) > 2 and len(rings[-1]) > 2:
        bm.faces.new(rings[0][::-1])
        bm.faces.new(rings[-1])
    if clip_y is not None:
        # open arch: recalc cannot tell inside from outside, so point every face away from a spot below the arch
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        zmin = min(v.co.z for v in bm.verts) - 0.5
        for f in bm.faces:
            c = f.calc_center_median()
            if f.normal.dot((c.x, 0.0, c.z - zmin)) < 0:
                f.normal_flip()
    return _finish(bm, name, material, recalc=clip_y is None)


def box(name, material, size, loc, bevel=0.0, smooth=False):
    """Axis aligned box. size = (x, z_forward_length, height) in car terms; loc = (x, z_forward, y_up)."""
    sx, sl, sh = size
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= sx; v.co.y *= sl; v.co.z *= sh
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=1, affect='EDGES')
    for v in bm.verts:
        v.co.x += loc[0]; v.co.y += -loc[1]; v.co.z += loc[2]
    return _finish(bm, name, material, smooth_angle=30 if not smooth else 80)


def cylinder_x(name, material, r, width, loc, segs=16, taper=1.0):
    """Cylinder with its axis along X (wheel axis)."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r * taper, depth=width)
    mx = bpy.context.scene  # noqa: F841 (keep scene referenced)
    for v in bm.verts:
        # cone axis is Z; rotate to X
        x, y, z = v.co
        v.co = (z, y, -x)
    for v in bm.verts:
        v.co.x += loc[0]; v.co.y += -loc[1]; v.co.z += loc[2]
    return _finish(bm, name, material, smooth_angle=50)


def join(objs, name, keep_origin=None):
    for o in bpy.context.selected_objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.data.name = name
    return ob


def mirror_x(ob_fn):
    """Call ob_fn(sign) for both sides and return the created objects."""
    return [ob_fn(s) for s in (1, -1)]


def wheel(name, r, width, x, z, rim_mat='Rim', tire_mat='Trim', segs=16):
    """Round wheel: tyre cylinder, rim disc and hub cap, origin at the wheel centre."""
    side = 1 if x > 0 else -1
    tire = cylinder_x(name + '_t', tire_mat, r, width, (0, 0, 0), segs)
    rim = cylinder_x(name + '_r', rim_mat, r * 0.64, width + 0.03, (0, 0, 0), segs)
    hub = cylinder_x(name + '_h', tire_mat, r * 0.2, width + 0.06, (0, 0, 0), 8)
    spokes = []
    for k in range(5):  # five dark gaps between spokes read as a real rim, not an X
        a = math.pi * 2 * k / 5
        gap = cylinder_x(name + f'_g{k}', tire_mat, r * 0.13, width + 0.045, (0, math.sin(a) * r * 0.4, math.cos(a) * r * 0.4), 6)
        spokes.append(gap)
    ob = join([tire, rim, hub] + spokes, name)
    ob.location = (x, -z, r)
    # bake the offset into the mesh so origin = wheel centre in world: move vertices, keep object at location
    return ob


def export(filename):
    os.makedirs(OUT_DIR, exist_ok=True)
    for o in bpy.data.objects:
        if o.type == 'MESH':
            o.select_set(True)
    path = os.path.join(OUT_DIR, filename)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True,
                              export_yup=True, export_cameras=False, export_lights=False)
    print('exported', path, os.path.getsize(path), 'bytes')
    mats = {m.name for o in bpy.data.objects if o.type == 'MESH' for m in o.data.materials}
    print('materials', sorted(mats), len(mats))
    assert len(mats) <= 6, 'max 6 materials'


def common_parts(L, W, wheel_r, wheel_w, zf, zr, track, rim_mat='Rim', segs=16):
    """Wheels + helper values shared by all cars."""
    for nm, x, z in (('wheel_FL', track, zf), ('wheel_FR', -track, zf), ('wheel_RL', track, zr), ('wheel_RR', -track, zr)):
        wheel(nm, wheel_r, wheel_w, x, z, rim_mat=rim_mat, segs=segs)


def arch(name, r, x, z, y, width=0.05):
    """Dark wheel-arch disc on the body side (reads as a recessed Radkasten)."""
    return cylinder_x(name, 'Trim', r, width, (x, z, y), 18)


def mirrors(zpos, ypos, xpos, material='Paint'):
    out = []
    for s in (1, -1):
        out.append(box('mirror', material, (0.2, 0.1, 0.12), (s * xpos, zpos, ypos), bevel=0.03))
    return out


def lights_front(names, z, y, x, w=0.34, h=0.13, d=0.07, mat_name='Headlight'):
    return [box('headlight', mat_name, (w, d, h), (s * x, z, y), bevel=0.03) for s in (1, -1)]


def lights_rear(z, y, x, w=0.4, h=0.12, d=0.07, mat_name='Taillight'):
    return [box('taillight', mat_name, (w, d, h), (s * x, z, y), bevel=0.03) for s in (1, -1)]
