"""Pickup truck. Run: blender -b --factory-startup --python tools/blender/car_truck.py"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import car_lib as C

# hood + front fenders + chassis (front 2.7 .. cab at 0.0)
FRONT = [
    (2.70, 0.86, 0.50, 1.00, 3.0),
    (2.60, 0.97, 0.45, 1.12, 4.0),
    (2.30, 1.01, 0.42, 1.30, 5.0),
    (1.40, 1.01, 0.42, 1.34, 5.5),
    (0.60, 1.01, 0.42, 1.30, 5.5),
]
CAB_LOWER = [   # cab body below the windows
    (0.90, 0.97, 0.42, 1.34, 5.0),
    (-0.70, 0.97, 0.42, 1.34, 5.0),
    (-0.85, 0.97, 0.42, 1.30, 5.0),
]
CABIN = [
    (0.85, 0.88, 1.30, 1.34, 3.0),
    (0.20, 0.84, 1.30, 2.00, 3.0),
    (-0.50, 0.84, 1.30, 2.02, 3.0),
    (-0.80, 0.88, 1.30, 1.50, 3.0),
]

if __name__ == '__main__':
    C.reset()
    r, zf, zr, track = 0.50, 1.90, -1.50, 0.88
    C.common_parts(5.4, 2.05, r, 0.34, zf, zr, track, segs=18)
    C.loft('hood', 'Paint', FRONT, n=20)
    C.loft('cabbody', 'Paint', CAB_LOWER, n=20)
    C.loft('cabin', 'Glass', CABIN, n=16)
    C.loft('roof', 'Paint', CABIN, z0=0.35, z1=-0.55, inflate=0.012, clip_y=1.94, n=24)
    C.loft('pillarA', 'Paint', CABIN, z0=0.88, z1=0.80, inflate=0.012, clip_y=1.32, n=24)
    C.loft('pillarC', 'Paint', CABIN, z0=-0.72, z1=-0.85, inflate=0.012, clip_y=1.32, n=24)
    C.box('chassis', 'Trim', (1.6, 5.2, 0.28), (0, 0, 0.62))
    # bed: floor, side walls, tailgate, bulkhead
    C.box('bedfloor', 'Paint', (1.96, 2.45, 0.14), (0, -1.55, 0.92), bevel=0.02)
    for s in (1, -1):
        C.box('bedwall', 'Paint', (0.12, 2.5, 0.48), (s * 0.97, -1.55, 1.2), bevel=0.03)
        C.box('fender', 'Paint', (0.3, 1.0, 0.36), (s * 0.9, zr, 1.16), bevel=0.05)
    C.box('tailgate', 'Paint', (2.04, 0.1, 0.48), (0, -2.75, 1.2), bevel=0.03)
    C.box('bulkhead', 'Paint', (1.96, 0.1, 0.55), (0, -0.35, 1.25), bevel=0.03)
    C.box('bedliner', 'Trim', (1.7, 2.3, 0.03), (0, -1.55, 1.0))
    # bumpers, grille, lights
    C.box('bumperF', 'Trim', (2.1, 0.3, 0.3), (0, 2.62, 0.62), bevel=0.06)
    C.box('bumperR', 'Trim', (2.1, 0.3, 0.3), (0, -2.72, 0.66), bevel=0.06)
    C.box('grille', 'Trim', (1.1, 0.06, 0.4), (0, 2.68, 1.0), bevel=0.04)
    for s in (1, -1):
        for z in (zf, zr):
            C.arch('arch', r * 1.25, s * 1.012, z, r, 0.02)
    C.lights_front(None, 2.68, 1.02, 0.78, w=0.32, h=0.2)
    C.lights_rear(-2.80, 1.18, 0.88, w=0.14, h=0.34)
    C.mirrors(0.75, 1.62, 1.02)
    C.export('car_truck.glb')
