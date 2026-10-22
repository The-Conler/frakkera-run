import sys
from PIL import Image
out, ins = sys.argv[1], sys.argv[2:]
ims = [Image.open(i).convert('RGB') for i in ins]
H = 700; ims = [i.resize((int(i.width * H / i.height), H)) for i in ims]
c = Image.new('RGB', (sum(i.width for i in ims), H)); x = 0
for i in ims: c.paste(i, (x, 0)); x += i.width
c.save(out)
