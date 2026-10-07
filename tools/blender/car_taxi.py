"""Taxi (sedan body with roof sign). Run: blender -b --factory-startup --python tools/blender/car_taxi.py"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import car_lib as C
import car_sedan

if __name__ == '__main__':
    car_sedan.build('taxi')
    C.export('car_taxi.glb')
