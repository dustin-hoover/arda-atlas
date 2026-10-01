import json, numpy as np
from scipy.interpolate import RBFInterpolator
P=json.load(open('fanchors.json')); A=np.array([[p[1],p[2]] for p in P],float); B=np.array([[p[3],p[4]] for p in P],float)
to_f=RBFInterpolator(A,B,kernel='thin_plate_spline',smoothing=0.0)      # atlas miles -> Fonstad px
