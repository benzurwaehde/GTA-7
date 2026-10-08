"""Muscle car (long hood, short cabin, hood scoop, twin stripes). Run: blender -b --factory-startup --python tools/blender/car_muscle.py"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import car_lib as C

BODY = [
    (2.45, 0.78, 0.40, 0.70, 3.0),
    (2.36, 0.90, 0.32, 0.80, 3.5),
    (2.10, 0.97, 0.28, 0.90, 5.0),
    (1.70, 1.00, 0.28, 0.98, 5.5),
    (0.90, 1.00, 0.28, 1.02, 5.5),
    (0.40, 0.98, 0.28, 1.04, 5.5),
    (-1.00, 0.98, 0.28, 1.05, 5.5),
    (-1.80, 1.00, 0.28, 1.05, 5.5),
    (-2.15, 0.97, 0.30, 1.02, 5.0),
    (-2.35, 0.90, 0.34, 0.98, 3.5),
    (-2.45, 0.78, 0.40, 0.88, 3.0),
]
CABIN = [
    (0.55, 0.80, 1.00, 1.05, 3.0),
    (0.05, 0.76, 1.00, 1.42, 3.0),
    (-0.85, 0.74, 1.00, 1.44, 3.0),
    (-1.65, 0.86, 1.00, 1.08, 3.0),
]

if __name__ == '__main__':
    C.reset()
    r, zf, zr, track = 0.36, 1.50, -1.45, 0.90
    C.common_parts(4.9, 1.96, r, 0.30, zf, zr, track)
    C.loft('body', 'Paint', BODY, n=20)
    C.loft('cabin', 'Glass', CABIN, n=16)
    C.loft('roof', 'Paint', CABIN, z0=0.18, z1=-1.0, inflate=0.012, clip_y=1.36, n=24)
    C.loft('pillarB', 'Paint', CABIN, z0=-0.40, z1=-0.52, inflate=0.012, clip_y=1.04, n=24)
    C.loft('pillarC', 'Paint', CABIN, z0=-1.45, z1=-1.65, inflate=0.012, clip_y=1.04, n=24)
    C.loft('bumperF', 'Trim', BODY, z0=2.47, z1=1.95, inflate=0.02, yb_min=0.30, yt_max=0.52, n=16)
    C.loft('bumperR', 'Trim', BODY, z0=-1.95, z1=-2.47, inflate=0.02, yb_min=0.30, yt_max=0.54, n=16)
    C.loft('skirts', 'Trim', BODY, z0=1.0, z1=-1.0, inflate=0.015, yb_min=0.28, yt_max=0.40, n=16)
    C.box('grille', 'Trim', (1.2, 0.06, 0.16), (0, 2.42, 0.62), bevel=0.03)
    C.box('scoop', 'Trim', (0.7, 0.9, 0.12), (0, 1.35, 1.03), bevel=0.04)
    # twin racing stripes over hood, roof and trunk
    for s in (1, -1):
        C.box('stripe_h', 'Trim', (0.26, 1.7, 0.02), (s * 0.2, 1.35, 0.99))
        C.box('stripe_t', 'Trim', (0.26, 0.8, 0.02), (s * 0.2, -2.05, 1.065))
    for s in (1, -1):
        for z in (zf, zr):
            C.arch('arch', r * 1.28, s * 1.0, z, r, 0.02)
        C.box('exhaust', 'Rim', (0.12, 0.2, 0.12), (s * 0.55, -2.5, 0.38), bevel=0.02)
    C.lights_front(None, 2.38, 0.72, 0.70, w=0.34, h=0.14)
    C.lights_rear(-2.43, 0.86, 0.74, w=0.5, h=0.14)
    C.mirrors(0.50, 1.08, 0.90)
    C.export('car_muscle.glb')
