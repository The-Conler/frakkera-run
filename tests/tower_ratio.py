import sys
from PIL import Image
import numpy as np
def bbox(img, bg, thr=40):
  a=np.asarray(img.convert('RGB')).astype(int); d=np.abs(a-np.array(bg)).sum(2)>thr
  ys,xs=np.where(d); return xs.min(),xs.max(),ys.min(),ys.max()
sh=Image.open('/cursor/stores/store-11fbfa95-5843-4165-b5bc-18e21939dd6d/grok-bot/agents/7a79d614-bf2d-4163-bcc0-994f32185287/attachments/01M6H69CT74C34VNNWDFTARMQS.png').convert('RGB'); W=sh.size[0]; f=W/819
for name,box in [('left',(0,0,250,515)),('grey',(352,262,455,502))]:
  c=sh.crop(tuple(int(v*f) for v in box)); bg=c.getpixel((2,2)); x0,x1,y0,y1=bbox(c,bg)
  print(name,'W/H',round((x1-x0)/(y1-y0),3))
if len(sys.argv)>1:
  c=Image.open(sys.argv[1]); x0,x1,y0,y1=bbox(c,(42,42,46)); print('ours W/H',round((x1-x0)/(y1-y0),3))
