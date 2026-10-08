"""Motorcycle (front = -Y in Blender, like the cars). Run: blender -b --factory-startup --python tools/blender/vehicle_bike.py
Wheels are named wheel_FL / wheel_RL (single wheels on the centre line); the game finds the axles by these names."""
import math
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import car_lib as C


def tilted(name, mat, size, loc, rot_x_deg):
    """Box centred at loc (x, z_forward, y_up), tilted about its own centre (positive = top leans forward)."""
    ob = C.box(name, mat, size, (0, 0, 0), bevel=0.01)
    ob.location = (loc[0], -loc[1], loc[2])
    ob.rotation_euler = (math.radians(-rot_x_deg), 0, 0)
    return ob


TANK = [(0.60, 0.10, 0.80, 0.93, 3.0), (0.35, 0.18, 0.74, 1.02, 3.0), (-0.15, 0.17, 0.72, 1.00, 3.0), (-0.38, 0.10, 0.76, 0.93, 3.0)]
TAIL = [(-0.30, 0.10, 0.80, 0.93, 3.0), (-0.65, 0.14, 0.78, 0.96, 3.0), (-1.00, 0.10, 0.80, 0.94, 3.0), (-1.08, 0.05, 0.82, 0.90, 3.0)]

if __name__ == '__main__':
    C.reset()
    r, zf, zr = 0.32, 0.78, -0.72
    C.wheel('wheel_FL', r, 0.16, 0.0, zf, segs=18)
    C.wheel('wheel_RL', r, 0.2, 0.0, zr, segs=18)
    C.loft('tank', 'Paint', TANK, n=14)
    C.loft('tailcowl', 'Paint', TAIL, n=12)
    C.box('seat', 'Trim', (0.28, 0.72, 0.1), (0, -0.28, 0.86), bevel=0.03)
    C.box('engine', 'Trim', (0.3, 0.5, 0.36), (0, 0.05, 0.5), bevel=0.03)
    C.box('cylinder', 'Rim', (0.26, 0.26, 0.22), (0, 0.22, 0.72), bevel=0.02)
    C.box('frame', 'Trim', (0.1, 1.0, 0.1), (0, -0.2, 0.62), bevel=0.01)
    for s in (1, -1):
        tilted('fork', 'Rim', (0.045, 0.045, 0.82), (s * 0.1, 0.68, 0.66), 14)
        C.box('swingarm', 'Trim', (0.05, 0.8, 0.06), (s * 0.11, -0.35, 0.38))
        C.box('exhaust', 'Rim', (0.08, 0.95, 0.08), (s * 0.22, -0.55, 0.3), bevel=0.02)
        C.box('grip', 'Trim', (0.12, 0.05, 0.05), (s * 0.37, 0.52, 1.08))
    tilted('headtube', 'Trim', (0.1, 0.1, 0.3), (0, 0.6, 0.98), 14)
    C.box('bars', 'Trim', (0.74, 0.05, 0.05), (0, 0.52, 1.08))
    C.box('fenderF', 'Paint', (0.12, 0.55, 0.04), (0, 0.8, 0.66), bevel=0.01)
    C.box('fenderR', 'Paint', (0.14, 0.45, 0.04), (0, -0.85, 0.58), bevel=0.01)
    C.box('headlight', 'Headlight', (0.2, 0.08, 0.2), (0, 0.72, 0.96), bevel=0.04)
    C.box('taillight', 'Taillight', (0.14, 0.05, 0.08), (0, -1.12, 0.84), bevel=0.02)
    C.box('visor', 'Glass', (0.22, 0.04, 0.2), (0, 0.62, 1.14))
    for s in (1, -1):
        C.box('mirror', 'Trim', (0.1, 0.04, 0.05), (s * 0.34, 0.5, 1.2))
    C.export('vehicle_bike.glb')
