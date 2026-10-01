import numpy as np
from PIL import Image
from scipy import ndimage as nd
im=np.array(Image.open('ct.png').convert('RGB')).astype(int)
R,G,B=im[...,0],im[...,1],im[...,2]
ink=(R<120)&(G<120)&(B<120)
red=(R>150)&(G<140)&(B<140)
bar=nd.binary_dilation(ink|red,iterations=1); bar[:6]=bar[-6:]=True; bar[:,:6]=bar[:,-6:]=True
free=~bar
lab,n=nd.label(free)
sea_seeds=[(200,1500),(40,300),(600,80),(380,80)]
sea_ids={lab[y,x] for x,y in sea_seeds}
print('sea ids',sea_ids)
dt=nd.distance_transform_edt(free)
thick=nd.maximum(dt,lab,index=np.arange(n+1))
ok=(thick>7); ok[0]=False
for i in sea_ids: ok[i]=False
land=ok[lab]
land=nd.binary_dilation(land,iterations=1)
# absorb inland ink strokes (rivers, mountain drawings) then fill enclosed holes
st=nd.generate_binary_structure(2,1)
land=nd.binary_closing(land,structure=st,iterations=6)
land=nd.binary_fill_holes(land)
land=nd.binary_opening(land,structure=st,iterations=2)
np.save('land.npy',land)
out=np.where(land[...,None],[200,230,170],[60,110,170]).astype(np.uint8)
out[ink]=(out[ink]*0.4).astype(np.uint8)
Image.fromarray(out).resize((960,1065)).save('land_preview.png')
print('land frac',land.mean())
