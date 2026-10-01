# Snap river ends onto the coast, a lake shore, or the parent river so the network is connected.
import re, json, sys
import numpy as np
path=sys.argv[1]; s=open(path).read()
O=json.load(open('coast_out.json')); C=np.array(O['coast'],float)
def seg_near(p,P,closed):
    A=P; B=np.roll(P,-1,0) if closed else P[1:]; A=A if closed else P[:-1]
    d=B-A; t=np.clip(((p-A)*d).sum(1)/np.maximum((d*d).sum(1),1e-9),0,1)
    Q=A+t[:,None]*d; k=np.argmin(np.hypot(*(Q-p).T)); return Q[k],np.hypot(*(Q[k]-p))
def inside(p,P):
    x,y=p; X,Y=P[:,0],P[:,1]; X2,Y2=np.roll(X,-1),np.roll(Y,-1)
    c=((Y>y)!=(Y2>y))&(x<(X2-X)*(y-Y)/(Y2-Y+1e-12)+X); return c.sum()%2==1
a=s.index('const RIVERS = ['); b=s.index('\n];',a)
lines=s[a:b].split('\n')
lakes=[np.array(json.loads('['+m+']'),float) for m in re.findall(r"pts:\[(\[.*?\])\]",s[s.index('const LAKES = ['):s.index('\n];',s.index('const LAKES = ['))])]
rivs=[]
for i,l in enumerate(lines):
    m=re.search(r"name:'((?:[^'\\]|\\.)*)'.*?rank:(\d).*?pts:\[(\[.*\])\]",l)
    if m: rivs.append([i,m.group(1),int(m.group(2)),np.array(json.loads('['+m.group(3)+']'),float)])
out=[]
for k,(i,name,rank,P) in enumerate(rivs):
    e=P[-1]
    # drop trailing points that fall in the sea
    while len(P)>2 and not inside(P[-2],C): P=P[:-1]
    cands=[]
    q,d=seg_near(P[-1],C,True); cands.append((d,'coast',q))
    for L in lakes: q,d=seg_near(P[-1],L,True); cands.append((d,'lake',q))
    for j,(_,n2,r2,P2) in enumerate(rivs):
        if j!=k and r2<=rank and len(P2)>1: q,d=seg_near(P[-1],P2,False); cands.append((d,'river:'+n2,q))
    d,kind,q=min(cands,key=lambda c:c[0])
    if d<60:
        if kind=='coast' and inside(P[-1],C): q=q+(q-P[-1])/max(d,1e-6)*1.5   # reach just past the shore
        P=np.vstack([P[:-1],q]) if np.hypot(*(P[-1]-q))<1 or len(P)<3 else np.vstack([P,q])
        if np.hypot(*(P[-2]-P[-1]))<0.5: P=np.delete(P,-2,0)
        out.append(f'{name:22s} -> {kind:20s} moved {d:5.1f} mi')
    rivs[k][3]=P
    pts=','.join(f'[{round(x,1):g},{round(y,1):g}]' for x,y in P)
    lines[i]=re.sub(r"pts:\[\[.*\]\]",lambda m:'pts:['+pts+']',lines[i])
s=s[:a]+'\n'.join(lines)+s[b:]
open(path,'w').write(s); print('\n'.join(out))
