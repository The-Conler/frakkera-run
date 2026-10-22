import bpy, addon_utils, sys
import importlib
mods=[m for m in sys.modules if 'mpfb' in m][:5]; print('mods', mods)
from bl_ext.user_default.mpfb.services.locationservice import LocationService
print('user data', LocationService.get_user_data())
print('sys data', LocationService.get_mpfb_data())
from bl_ext.user_default.mpfb.services import humanservice
print([n for n in dir(humanservice.HumanService) if not n.startswith('_')])
