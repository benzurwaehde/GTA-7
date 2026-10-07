"""Sedan, also the base for taxi and police. Run: blender -b --factory-startup --python tools/blender/car_sedan.py"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import car_lib as C

# (z, half width, y bottom, y top, superellipse exponent), front -> back
BODY = [
    (2.25, 0.80, 0.40, 0.66, 3.0),
    (2.17, 0.89, 0.32, 0.74, 3.5),
    (1.95, 0.935, 0.27, 0.80, 5.0),
    (1.75, 0.965, 0.27, 0.88, 5.5),
    (1.00, 0.965, 0.27, 0.95, 5.5),
    (0.85, 0.94, 0.27, 0.98, 5.5),
    (-0.85, 0.94, 0.27, 0.99, 5.5),
    (-1.00, 0.965, 0.27, 0.99, 5.5),
    (-1.75, 0.965, 0.27, 0.96, 5.5),
    (-1.95, 0.935, 0.28, 0.94, 5.0),
    (-2.15, 0.89, 0.32, 0.90, 3.5),
    (-2.25, 0.78, 0.40, 0.78, 3.0),
]
# greenhouse (glass) sitting on the beltline
CABIN = [
    (0.95, 0.80, 0.94, 0.99, 3.0),
    (0.30, 0.74, 0.94, 1.44, 3.0),
    (-0.80, 0.72, 0.94, 1.46, 3.0),
    (-1.55, 0.78, 0.94, 1.03, 3.0),
]


def build(variant='sedan'):
    C.reset()
    police = variant == 'police'
    taxi = variant == 'taxi'
    L, W = 4.5, 1.85
    r, zf, zr, track = 0.34, 1.35, -1.35, 0.85
    C.common_parts(L, W, r, 0.25, zf, zr, track, rim_mat='Paint' if police else 'Rim')

    body = C.loft('body', 'Paint', BODY, n=20)
    C.loft('cabin', 'Glass', CABIN, n=16)
    # roof + A/B/C pillars in paint (thin inflated bands of the greenhouse)
    C.loft('roof', 'Paint', CABIN, z0=0.35, z1=-1.05, inflate=0.012, clip_y=1.38, n=24)
    C.loft('pillarB', 'Paint', CABIN, z0=-0.28, z1=-0.40, inflate=0.012, clip_y=0.97, n=24)
    C.loft('pillarC', 'Paint', CABIN, z0=-1.42, z1=-1.55, inflate=0.012, clip_y=0.97, n=24)
    # bumpers, grille, skirts
    C.loft('bumperF', 'Trim', BODY, z0=2.27, z1=1.70, inflate=0.02, yb_min=0.30, yt_max=0.52, n=16)
    C.loft('bumperR', 'Trim', BODY, z0=-1.75, z1=-2.27, inflate=0.02, yb_min=0.30, yt_max=0.52, n=16)
    C.box('grille', 'Trim', (0.9, 0.06, 0.16), (0, 2.22, 0.62), bevel=0.03)
    C.loft('skirts', 'Trim', BODY, z0=0.95, z1=-0.95, inflate=0.015, yb_min=0.27, yt_max=0.40, n=16)
    for s in (1, -1):
        for z in (zf, zr):
            C.arch('arch', r * 1.28, s * 0.968, z, r, 0.02)
    C.lights_front(None, 2.20, 0.72, 0.62)
    # police reuses Siren_Red for the tail lights (6 materials max); the game finds them by object name
    C.lights_rear(-2.21, 0.78, 0.66, mat_name='Siren_Red' if police else 'Taillight')
    C.mirrors(0.80, 1.02, 0.86)

    if police:
        # black hood/fenders and trunk, white doors (body Paint stays white)
        C.loft('blackF', 'Trim', BODY, z0=2.2, z1=0.95, inflate=0.014, yb_min=0.42, n=20)
        C.loft('blackR', 'Trim', BODY, z0=-1.45, z1=-2.2, inflate=0.014, yb_min=0.42, n=20)
        C.box('barbase', 'Trim', (1.0, 0.34, 0.06), (0, -0.3, 1.50))
        C.box('sirenR', 'Siren_Red', (0.46, 0.28, 0.14), (0.26, -0.3, 1.58), bevel=0.03)
        C.box('sirenB', 'Siren_Blue', (0.46, 0.28, 0.14), (-0.26, -0.3, 1.58), bevel=0.03)
    if taxi:
        C.box('sign', 'Headlight', (0.66, 0.26, 0.18), (0, -0.3, 1.56), bevel=0.04)
        C.box('stripe', 'Trim', (1.9, 3.8, 0.07), (0, 0.0, 0.72))
    return body


if __name__ == '__main__':
    build('sedan')
    C.export('car_sedan.glb')
