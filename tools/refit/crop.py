import sys
from PIL import Image, ImageDraw
im=Image.open(sys.argv[1]).convert('RGB')
x0,y0,x1,y1=map(int,sys.argv[2:6]); step=int(sys.argv[7]) if len(sys.argv)>7 else 50
c=im.crop((x0,y0,x1,y1)); sc=900/max(c.size); c=c.resize((int(c.width*sc),int(c.height*sc)))
d=ImageDraw.Draw(c)
for x in range((x0//step+1)*step,x1,step):
    X=(x-x0)*sc; d.line([(X,0),(X,c.height)],fill=(0,160,255) if x%(step*2) else (0,90,255),width=1); d.text((X+2,2),str(x),fill=(0,0,255))
for y in range((y0//step+1)*step,y1,step):
    Y=(y-y0)*sc; d.line([(0,Y),(c.width,Y)],fill=(0,160,255) if y%(step*2) else (0,90,255),width=1); d.text((2,Y+2),str(y),fill=(0,0,255))
c.save(sys.argv[6])
