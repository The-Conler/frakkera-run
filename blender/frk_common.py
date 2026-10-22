# Costanti condivise: geometria e posa di trasporto della frakkera (spazio armatura Blender: -Y avanti, +X sinistra dell'uomo, Z su)
import math
from mathutils import Vector
TILT_F, TILT_R = math.radians(12), math.radians(6)
AX = Vector((-math.sin(TILT_R), -math.sin(TILT_F), 1)).normalized()
G = Vector((-0.185, -0.25, 1.2))      # punto di presa (testa dell'osso 'frakkera')
L = 3.4; SG = 1.05; B0 = G - AX * SG
def rprof(s):
    t = s / L
    r = 0.165 + 0.01 * math.sin(math.pi * t)
    r += 0.055 * math.exp(-((t) / 0.06) ** 2)          # fondo che si apre a scopa
    r -= 0.04 * max(0, t - 0.86) / 0.14               # cima che si stringe
    return r
