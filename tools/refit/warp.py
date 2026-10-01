import json, re, sys, subprocess
import numpy as np
from scipy.interpolate import RBFInterpolator
A=json.load(open('anchors.json')); f=A['frame']
src=np.array([[p[1],p[2]] for p in A['pairs']],float)
dst=np.array([[(p[3]-f['ox'])*f['s'], -(p[4]-f['oy'])*f['s']] for p in A['pairs']],float)
SMOOTH=float(sys.argv[1]) if len(sys.argv)>1 else 50.0
tps=RBFInterpolator(src,dst,kernel='thin_plate_spline',smoothing=SMOOTH)
def T(pts): return tps(np.atleast_2d(np.asarray(pts,float)))
def to_px(m): return np.c_[m[:,0]/f['s']+f['ox'], -m[:,1]/f['s']+f['oy']]
res=T(src)-dst
print('anchor residual mi: mean %.1f max %.1f'%(np.hypot(*res.T).mean(), np.hypot(*res.T).max()))
