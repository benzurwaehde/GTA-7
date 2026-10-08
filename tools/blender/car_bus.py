"""City bus (long box, big window band, blue paint with white stripe). Run: blender -b --factory-startup --python tools/blender/car_bus.py"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import car_lib as C

BODY = [
    (4.30, 1.00, 0.50, 1.40, 3.0),
    (4.22, 1.20, 0.42, 1.60, 4.0),
    (3.90, 1.26, 0.36, 1.80, 8.0),
    (3.40, 1.30, 0.34, 3.05, 10.0),
    (-4.00, 1.30, 0.34, 3.10, 10.0),
    (-4.22, 1.26, 0.40, 3.05, 6.0),
    (-4.30, 1.12, 0.46, 2.90, 4.0),
]
GLASS = [
    (3.95, 1.24, 1.55, 2.60, 6.0),
    (3.70, 1.29, 1.55, 2.85, 8.0),
    (3.45, 1.29, 1.55, 2.85, 8.0),
    (-3.70, 1.29, 1.55, 2.85, 8.0),
    (-3.95, 1.24, 1.55, 2.60, 6.0),
]

if __name__ == '__main__':
    C.reset()
    r, zf, zr, track = 0.50, 2.9, -2.4, 1.0
    C.common_parts(8.6, 2.6, r, 0.34, zf, zr, track, segs=18)
    C.loft('body', 'Paint', BODY, n=20)
    # window band: slightly proud glass strip along both sides, pillars in Trim
    C.loft('windows', 'Glass', GLASS, z0=3.8, z1=-3.8, inflate=0.012, n=20)
    for k in range(8):
        C.box('pillar', 'Trim', (2.62, 0.09, 1.2), (0, 3.2 - k * 0.92, 2.2))
    C.box('stripe', 'Rim', (2.62, 8.2, 0.14), (0, 0.0, 1.35))
    C.box('roofunit', 'Trim', (1.4, 1.8, 0.2), (0, -1.5, 3.2), bevel=0.03)
    C.box('destination', 'Headlight', (1.5, 0.05, 0.22), (0, 4.18, 2.92))
    C.loft('bumperF', 'Trim', BODY, z0=4.32, z1=3.8, inflate=0.02, yb_min=0.34, yt_max=0.58, n=16)
    C.loft('bumperR', 'Trim', BODY, z0=-3.8, z1=-4.32, inflate=0.02, yb_min=0.34, yt_max=0.58, n=16)
    for s in (1, -1):
        for z in (zf, zr):
            C.arch('arch', r * 1.3, s * 1.3, z, r, 0.02)
    C.box('door', 'Glass', (0.04, 1.1, 1.8), (-1.31, 3.0, 1.6))   # door on the kerb side (right)
    C.lights_front(None, 4.28, 0.9, 0.82, w=0.4, h=0.2)
    C.lights_rear(-4.32, 1.0, 1.0, w=0.3, h=0.4)
    C.mirrors(4.1, 2.2, 1.42)
    C.export('car_bus.glb')
