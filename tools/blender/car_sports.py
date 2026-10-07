"""Sports car (low wedge, spoiler). Run: blender -b --factory-startup --python tools/blender/car_sports.py"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import car_lib as C

BODY = [
    (2.20, 0.72, 0.30, 0.52, 3.0),
    (2.10, 0.86, 0.26, 0.62, 3.5),
    (1.85, 0.945, 0.24, 0.70, 5.0),
    (1.60, 0.99, 0.24, 0.76, 5.5),
    (0.90, 0.99, 0.24, 0.88, 5.5),
    (0.50, 0.96, 0.24, 0.92, 5.0),
    (-0.80, 0.96, 0.24, 0.94, 5.0),
    (-1.00, 0.99, 0.24, 0.94, 5.5),
    (-1.70, 0.99, 0.24, 0.92, 5.5),
    (-2.00, 0.93, 0.26, 0.90, 5.0),
    (-2.12, 0.86, 0.28, 0.84, 3.5),
    (-2.20, 0.74, 0.32, 0.76, 3.0),
]
CABIN = [
    (0.60, 0.80, 0.90, 0.94, 3.0),
    (0.00, 0.76, 0.90, 1.17, 3.0),
    (-0.70, 0.74, 0.90, 1.19, 3.0),
    (-1.40, 0.82, 0.90, 0.98, 3.0),
]

if __name__ == '__main__':
    C.reset()
    r, zf, zr, track = 0.33, 1.30, -1.30, 0.87
    C.common_parts(4.4, 1.92, r, 0.28, zf, zr, track)
    C.loft('body', 'Paint', BODY, n=20)
    C.loft('cabin', 'Glass', CABIN, n=16)
    C.loft('roof', 'Paint', CABIN, z0=0.05, z1=-0.95, inflate=0.012, clip_y=1.12, n=24)
    C.loft('pillarB', 'Paint', CABIN, z0=-0.30, z1=-0.40, inflate=0.012, clip_y=0.93, n=24)
    C.loft('pillarC', 'Paint', CABIN, z0=-1.25, z1=-1.40, inflate=0.012, clip_y=0.93, n=24)
    C.loft('bumperF', 'Trim', BODY, z0=2.22, z1=1.70, inflate=0.02, yb_min=0.26, yt_max=0.42, n=16)
    C.loft('bumperR', 'Trim', BODY, z0=-1.75, z1=-2.22, inflate=0.02, yb_min=0.28, yt_max=0.46, n=16)
    C.loft('skirts', 'Trim', BODY, z0=0.95, z1=-0.95, inflate=0.015, yb_min=0.24, yt_max=0.36, n=16)
    C.box('grille', 'Trim', (1.0, 0.05, 0.1), (0, 2.14, 0.42), bevel=0.02)
    # racing stripe over hood and roof
    C.loft('stripe', 'Trim', BODY, z0=2.0, z1=0.7, inflate=0.012, clip_y=0.70, n=40)
    for s in (1, -1):
        for z in (zf, zr):
            C.arch('arch', r * 1.28, s * 0.995, z, r, 0.02)
    C.lights_front(None, 2.12, 0.55, 0.64, w=0.4, h=0.09)
    C.lights_rear(-2.14, 0.76, 0.66, w=0.5, h=0.09)
    C.mirrors(0.50, 0.99, 0.90)
    # spoiler: two struts + wing
    for s in (1, -1):
        C.box('strut', 'Trim', (0.07, 0.07, 0.22), (s * 0.55, -1.9, 1.0))
    C.box('wing', 'Trim', (1.8, 0.42, 0.06), (0, -2.0, 1.14), bevel=0.02)
    C.export('car_sports.glb')
