"""Police cruiser (sedan body, black/white, light bar). Run: blender -b --factory-startup --python tools/blender/car_police.py"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import car_lib as C
import car_sedan

if __name__ == '__main__':
    car_sedan.build('police')
    C.export('car_police.glb')
