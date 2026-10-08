"""Police helicopter (front = -Y in Blender). Run: blender -b --factory-startup --python tools/blender/vehicle_heli.py
Objects 'rotor_main' (spins around Y/up) and 'rotor_tail' (spins around X) have their origin at the hub, the game rotates them."""
import math
import os
import sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import car_lib as C

FUSE = [
    (3.00, 0.30, 1.00, 1.40, 3.0),
    (2.60, 0.78, 0.72, 1.85, 3.5),
    (1.60, 1.10, 0.56, 2.20, 3.5),
    (0.00, 1.12, 0.56, 2.25, 3.5),
    (-1.20, 0.75, 0.90, 1.95, 3.0),
    (-1.90, 0.32, 1.25, 1.75, 3.0),
]


def hub_object(objs, name, hub):
    """Join objs (modelled around the world origin) and put the object origin at the hub (x, z_forward, y_up)."""
    ob = C.join(objs, name)
    ob.location = Vector((hub[0], -hub[1], hub[2]))
    return ob


if __name__ == '__main__':
    C.reset()
    C.loft('fuselage', 'Paint', FUSE, n=18)
    C.loft('canopy', 'Glass', FUSE, z0=2.85, z1=0.55, inflate=0.025, yb_min=1.25, n=18)
    C.box('belly', 'Trim', (1.5, 3.0, 0.14), (0, 0.5, 0.6), bevel=0.04)
    C.box('engine', 'Trim', (1.1, 1.3, 0.55), (0, -0.6, 2.4), bevel=0.08)
    C.box('mast', 'Trim', (0.22, 0.22, 0.5), (0, -0.3, 2.65), bevel=0.02)
    C.box('boom', 'Paint', (0.3, 4.2, 0.34), (0, -3.8, 1.55), bevel=0.05)
    C.box('fin', 'Paint', (0.07, 0.9, 1.3), (0, -5.7, 2.15), bevel=0.02)
    C.box('stab', 'Trim', (1.6, 0.5, 0.06), (0, -5.5, 1.75))
    C.box('light_r', 'Siren_Red', (0.14, 0.14, 0.1), (0.0, -5.95, 2.85), bevel=0.02)
    C.box('light_b', 'Siren_Blue', (0.14, 0.14, 0.1), (0.0, -0.3, 2.98), bevel=0.02)
    C.box('searchlight', 'Headlight', (0.34, 0.34, 0.26), (0, 2.1, 0.5), bevel=0.05)
    for s in (1, -1):
        C.box('skid', 'Trim', (0.09, 3.6, 0.09), (s * 0.85, 0.4, 0.12), bevel=0.02)
        for z in (1.4, -0.5):
            C.box('strut', 'Trim', (0.07, 0.07, 0.5), (s * 0.82, z, 0.38))
    blades = [C.box('b1', 'Trim', (8.2, 0.34, 0.05), (0, 0, 0)), C.box('b2', 'Trim', (0.34, 8.2, 0.05), (0, 0, 0)),
              C.box('hub', 'Trim', (0.4, 0.4, 0.12), (0, 0, 0), bevel=0.03)]
    hub_object(blades, 'rotor_main', (0, -0.3, 2.95))
    tail = [C.box('t1', 'Trim', (0.05, 0.12, 1.5), (0, 0, 0))]
    hub_object(tail, 'rotor_tail', (0.13, -5.85, 2.3))
    C.export('vehicle_heli.glb')
