"""Texture del personaggio (<= 1024 px) a partire dagli asset CC0 MakeHuman: camicia bianca, pantaloni scuri, gilet, coppola scura."""
import json, os, random
from PIL import Image, ImageDraw, ImageFilter, ImageOps, ImageChops
D = '/home/box/.config/blender/4.2/extensions/.user/user_default/mpfb/data'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')
S = 1024
isl = json.load(open('/workspace/frakkera-run/.tmp/blend/suit_islands.json'))
mask = Image.new('L', (S, S), 0); md = ImageDraw.Draw(mask)
cover = Image.new('L', (S, S), 0); cd = ImageDraw.Draw(cover)
for i in isl:
    for p in i['polys']:
        pts = [(u * S, (1 - v) * S) for u, v in p]
        cd.polygon(pts, fill=255, outline=255)
        if i['label'] == 'shirt': md.polygon(pts, fill=255, outline=255)
mask = mask.filter(ImageFilter.MaxFilter(5))
ao = Image.open(f'{D}/clothes/male_casualsuit03/male_casualsuit03_ao.png').convert('L').resize((S, S), Image.LANCZOS)
ao = ImageOps.autocontrast(ao, cutoff=1)
nrm = Image.open(f'{D}/clothes/male_casualsuit03/male_casualsuit03_normal.png').convert('RGB').resize((S, S), Image.LANCZOS)
nrm.save(f'{OUT}/suit_normal.jpg', quality=88)
random.seed(3)
noise = Image.effect_noise((S, S), 22).filter(ImageFilter.GaussianBlur(0.6))
def tint(col, aopow, noise_amt):
    base = Image.new('RGB', (S, S), col)
    a = ao.point(lambda x: int(255 * (1 - aopow + aopow * (x / 255))))
    n = noise.point(lambda x: int(255 - noise_amt * (255 - x) / 255 * 255 / 255))
    m = ImageChops.multiply(a, n)
    return ImageChops.multiply(base, Image.merge('RGB', (m, m, m)))
shirt = tint((240, 237, 228), 0.35, 0.10)
pants = tint((44, 43, 48), 0.4, 0.25)
suit = Image.composite(shirt, pants, mask)
suit.save(f'{OUT}/suit_albedo.jpg', quality=88)
# gilet: lana scura con lieve spina di pesce
w = Image.new('L', (S, S), 0); wd = ImageDraw.Draw(w)
for y in range(0, S, 6):
    for x in range(0, S, 12):
        off = 3 if (x // 12) % 2 else -3
        wd.line([(x, y), (x + 6, y + off)], fill=40, width=2)
wtex = ImageChops.multiply(Image.new('RGB', (S, S), (40, 38, 42)), Image.merge('RGB', (noise.point(lambda x: 200 + x // 5),) * 3))
wl = ImageChops.subtract(wtex, Image.merge('RGB', (w, w, w)).point(lambda v: v // 4))
wl.save(f'{OUT}/waistcoat_albedo.jpg', quality=88)
# coppola: lana grigio scuro dalla texture originale (luminanza)
cap = Image.open(f'{D}/clothes/jujube_newsboy_cap/newsboy_cap.png').convert('L').resize((512, 512), Image.LANCZOS)
cap = ImageOps.autocontrast(cap, cutoff=2)
capc = ImageChops.multiply(Image.merge('RGB', (cap, cap, cap)), Image.new('RGB', (512, 512), (62, 58, 56)))
capc.save(f'{OUT}/cap_albedo.jpg', quality=88)
Image.open(f'{D}/clothes/jujube_newsboy_cap/newsboy_cap_normals.png').convert('RGB').resize((512, 512), Image.LANCZOS).save(f'{OUT}/cap_normal.jpg', quality=88)
Image.open(f'{D}/skins/middleage_caucasian_male/middleage_lightskinned_male_diffuse.png').convert('RGB').resize((S, S), Image.LANCZOS).save(f'{OUT}/skin_albedo.jpg', quality=88)
Image.open(f'{D}/clothes/shoes04/shoes04_diffuse.png').convert('RGB').resize((512, 512), Image.LANCZOS).save(f'{OUT}/shoes_albedo.jpg', quality=88)
Image.open(f'{D}/clothes/shoes04/shoes04_normal.png').convert('RGB').resize((512, 512), Image.LANCZOS).save(f'{OUT}/shoes_normal.jpg', quality=88)
h = Image.open(f'{D}/hair/short02/short02_diffuse.png').convert('RGBA').resize((512, 512), Image.LANCZOS)
h.save(f'{OUT}/hair_albedo.png')
Image.open(f'{D}/eyebrows/eyebrow001/eyebrow001.png').convert('RGBA').resize((256, 256), Image.LANCZOS).save(f'{OUT}/eyebrow.png')
Image.open(f'{D}/eyes/materials/brown_eye.png').convert('RGB').resize((256, 256), Image.LANCZOS).save(f'{OUT}/eye.jpg', quality=88)
print('ok', os.listdir(OUT))
