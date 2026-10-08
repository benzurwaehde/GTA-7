"""Delivery van (boxy, tall roof, sliding-door line). Run: blender -b --factory-startup --python tools/blender/car_van.py"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import car_lib as C

BODY = [
    (2.70, 0.85, 0.50, 1.00, 3.0),
    (2.62, 0.95, 0.40, 1.15, 4.0),
    (2.30, 1.00, 0.36, 1.30, 5.0),
    (1.70, 1.02, 0.34, 1.36, 5.5),
    (1.40, 1.02, 0.34, 2.05, 6.0),
    (-2.50, 1.02, 0.34, 2.15, 6.0),
    (-2.68, 0.98, 0.38, 2.10, 4.0),
    (-2.75, 0.90, 0.46, 1.95, 3.0),
]
WIND = [   # windscreen + side windows of the cab
    (1.55, 0.92, 1.38, 1.60, 3.0),
    (1.15, 0.94, 1.38, 1.95, 3.0),
    (0.20, 0.94, 1.38, 1.95, 3.0),
    (0.05, 0.94, 1.38, 1.95, 3.0),
]

if __name__ == '__main__':
    C.reset()
    r, zf, zr, track = 0.38, 1.75, -1.55, 0.88
    C.common_parts(5.5, 2.05, r, 0.28, zf, zr, track)
    C.loft('body', 'Paint', BODY, n=20)
    C.loft('windows', 'Glass', WIND, n=16)
    C.box('windscreen', 'Glass', (1.7, 0.08, 0.55), (0, 1.52, 1.62), bevel=0.02)
    for s in (1, -1):
        C.box('winCab', 'Glass', (0.04, 0.9, 0.5), (s * 1.025, 0.85, 1.65))
        C.box('doorline', 'Trim', (0.03, 0.04, 1.1), (s * 1.025, -0.15, 1.2))
        C.box('doorline2', 'Trim', (0.03, 0.04, 1.1), (s * 1.025, -1.7, 1.2))
    C.loft('bumperF', 'Trim', BODY, z0=2.72, z1=2.2, inflate=0.02, yb_min=0.34, yt_max=0.56, n=16)
    C.loft('bumperR', 'Trim', BODY, z0=-2.2, z1=-2.76, inflate=0.02, yb_min=0.36, yt_max=0.58, n=16)
    C.box('grille', 'Trim', (1.1, 0.06, 0.26), (0, 2.66, 0.82), bevel=0.03)
    C.box('beltline', 'Trim', (2.07, 5.0, 0.05), (0, -0.4, 0.86))
    for s in (1, -1):
        for z in (zf, zr):
            C.arch('arch', r * 1.28, s * 1.02, z, r, 0.02)
    C.lights_front(None, 2.64, 0.95, 0.70, w=0.34, h=0.18)
    C.lights_rear(-2.77, 1.0, 0.80, w=0.14, h=0.5)
    C.mirrors(1.3, 1.62, 1.12)
    C.export('car_van.glb')
