import sys
from PIL import Image
out, ins = sys.argv[1], sys.argv[2:]
ims = [Image.open(i).convert('RGB') for i in ins]
W = sum(i.width for i in ims); H = max(i.height for i in ims)
c = Image.new('RGB', (W, H)); x = 0
for i in ims: c.paste(i, (x, 0)); x += i.width
c.save(out)
