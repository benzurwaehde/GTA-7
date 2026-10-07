"""Renders turntable stills of the exported cars. Usage:
blender -b --factory-startup --python tools/blender/car_preview.py -- out_dir car_sedan car_sports ...
Each car gets a front-3/4, rear-3/4 and a side view, as <out_dir>/<name>_<view>.png"""
import math
import os
import sys
import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
out_dir, names = args[0], args[1:]
root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
os.makedirs(out_dir, exist_ok=True)

for name in names:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(root, 'public', 'models', name + '.glb'))
    sc = bpy.context.scene
    for k in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT', 'BLENDER_WORKBENCH'):
        try:
            sc.render.engine = k
            break
        except TypeError:
            pass
    sc.render.resolution_x, sc.render.resolution_y = 900, 560
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs['Color'].default_value = (0.55, 0.62, 0.72, 1); bg.inputs['Strength'].default_value = 1.0
    bpy.ops.mesh.primitive_plane_add(size=30)
    sc.objects['Plane'].data.materials.append(bpy.data.materials.new('g'))
    sc.objects['Plane'].data.materials[0].diffuse_color = (0.25, 0.25, 0.27, 1)
    sun = bpy.data.lights.new('s', 'SUN'); sun.energy = 4
    so = bpy.data.objects.new('s', sun); sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(50), 0, math.radians(35))
    cam = bpy.data.objects.new('c', bpy.data.cameras.new('c')); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.lens = 40
    # imported glTF: front is +Y in Blender space after import (glTF +Z -> Blender -Y); look from both ends
    views = {'front': (5.5, -6.0, 2.6), 'rear': (-5.0, 6.0, 2.4), 'side': (9.0, 0, 1.2)}
    for vn, loc in views.items():
        cam.location = loc
        d = Vector((0, 0, 0.75)) - Vector(loc)
        cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(out_dir, f'{name}_{vn}.png')
        bpy.ops.render.render(write_still=True)
print('preview done')
