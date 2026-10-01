import json
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd
from skimage import measure
exec(open('warp.py').read().split("res=T(src)")[0])
G=json.load(open('geo.json'))
C=np.array(G['COAST'],float); W=T(C)
# --- outer land polygon (outside the reference frame), in reference miles
south=W[89:116].copy()
taper=np.interp(np.arange(len(south)),[0,9,11,12,len(south)],[1,1,0.6,0.25,0])
south[:,0]-=160*taper
north=[[2876,150],[2799,330],[2635,480],[2418,560],[2200,610],[1982,640],[1763,660],[1540,670],[1313,680],
       [1080,690],[835,700],[580,690],[420,680],[260,665],[150,660],[40,656],[-60,644],[-110,592],[-100,540],[-90,500],
       [-44,500],[-36,560],[-12,598],[60,612],[140,606],[180,572],[184,525],[184,400],[700,0],[78,-1434]]
outer=[[78,-1434]]+south.tolist()+W[116:118].tolist()+north
cape=[]
islands=[(i['name'],T(i['pts'])) for i in G['ISLANDS']]
# --- mile grid, 1 mi/px
X0,X1,Y0,Y1=-2300,3100,-2900,1000; R=1.0
GW,GH=int((X1-X0)/R),int((Y1-Y0)/R)
def gp(pts): return [((x-X0)/R,(Y1-y)/R) for x,y in pts]
img=Image.new('L',(GW,GH),0); d=ImageDraw.Draw(img)
d.polygon(gp(outer),fill=255)
outer_land=np.array(img)>127
# reference land, resampled onto the mile grid
L=np.load('land.npy'); H_,W_=L.shape
B=10
L[:B]=L[B]; L[-B:]=L[-B-1]; L[:,:B]=L[:,B:B+1]; L[:,-B:]=L[:,-B-1:-B]
gx=X0+(np.arange(GW)+0.5)*R; gy=Y1-(np.arange(GH)+0.5)*R
PX=gx/f['s']+f['ox']; PY=-gy/f['s']+f['oy']
ix=np.round(PX).astype(int); iy=np.round(PY).astype(int)
inx=(ix>=0)&(ix<W_); iny=(iy>=0)&(iy<H_)
ref=np.zeros((GH,GW),bool); dom=np.zeros((GH,GW),bool)
ref[np.ix_(iny,inx)]=L[np.ix_(iy[iny],ix[inx])]; dom[np.ix_(iny,inx)]=True
def sdf(m): return nd.distance_transform_edt(m)-nd.distance_transform_edt(~m)
w=np.clip(nd.distance_transform_edt(dom)*R/8,0,1)
comb=w*sdf(ref)+(1-w)*sdf(outer_land)
land=comb>0
disk=np.hypot(*np.mgrid[-2:3,-2:3])<=2.2
land=nd.binary_closing(nd.binary_opening(land,structure=disk),structure=disk)
# islands that fall outside the frame keep their warped atlas shapes
keep_isl=[]
for n,p in islands:
    c=p.mean(0); px_=c[0]/f['s']+f['ox']; py_=-c[1]/f['s']+f['oy']
    inside= 30<px_<W_-30 and 30<py_<H_-30
    print('island',n,c.round(),'inside frame' if inside else 'outside')
    if not inside: keep_isl.append((n,p))
np.save('land_miles.npy',land)
lab,n=nd.label(land); sizes=nd.sum(land,lab,range(1,n+1))
order=np.argsort(sizes)[::-1]
polys=[]
for k in order:
    if sizes[k]<12: break
    m=lab==(k+1)
    cs=measure.find_contours(np.pad(m,1).astype(float),0.5)
    c=max(cs,key=len)-1
    c=measure.approximate_polygon(c,tolerance=0.7)
    pts=[[round(X0+(x+0.5)*R),round(Y1-(y+0.5)*R)] for y,x in c]
    if pts[0]==pts[-1]: pts=pts[:-1]
    polys.append((int(sizes[k]),pts))
print('components kept',[(s,len(p)) for s,p in polys][:12])
json.dump({'coast':polys[0][1],'islands':[p for s,p in polys[1:]],'atlas_islands':[(n,p.round().astype(int).tolist()) for n,p in keep_isl]},open('coast_out.json','w'))
# preview
pv=np.zeros((GH,GW,3),np.uint8); pv[land]=(190,215,160); pv[~land]=(60,100,150)
Image.fromarray(pv[1500:3600:3,1500:4800:3]).save('coast_preview.png')
