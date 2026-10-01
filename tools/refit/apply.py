import json, re, sys
import numpy as np
exec(open('warp.py').read().split("res=T(src)")[0])
path=sys.argv[2]; s=open(path).read()
NUM=r'(-?\d+(?:\.\d+)?)'
def dec(t): return len(t.split('.')[1]) if '.' in t else 0
def fmt(v,orig):
    d=max(1,dec(orig)); t=f'{v:.{d}f}'
    if '.' in t: t=t.rstrip('0').rstrip('.')
    return '0' if t in ('-0','') else t
def far(x,y): return x<-1000 or x>3000
def W(xs,ys):
    x,y=float(xs),float(ys)
    if far(x,y): return xs,ys
    p=T([[x,y]])[0]; return fmt(p[0],xs),fmt(p[1],ys)
STR=r"'(?:[^'\\]|\\.)*'"
pat=re.compile(
  rf"(?P<lab>\[\s*{STR}\s*,\s*(?:{STR}\s*,\s*)?){NUM}\s*,\s*{NUM}(?=\s*,)"
  rf"|(?P<circ>circle:\[){NUM},\s*{NUM}(?=,)"
  rf"|(?P<xy>\bx:\s*){NUM}(?P<mid>,\s*y:\s*){NUM}"
  rf"|(?P<wp>\[){NUM},\s*{NUM}(?=,\s*')"
  rf"|(?P<pr>\[){NUM},\s*{NUM}(?=\])")
counts={}
def rep(m):
    g=m.groupdict(); nums=[t for t in m.groups() if t is not None and re.fullmatch(r'-?\d+(?:\.\d+)?',t)]
    k=[n for n in ('lab','circ','xy','wp','pr') if g[n] is not None][0]; counts[k]=counts.get(k,0)+1
    a,b=W(nums[0],nums[1])
    if k=='xy': return f"{g['xy']}{a}{g['mid']}{b}"
    return f"{g[k]}{a},{b}"
s=pat.sub(rep,s)
print('warped',counts)
O=json.load(open('coast_out.json'))
pts=O['coast']; rows=[ ','.join(f'[{x},{y}]' for x,y in pts[i:i+14]) for i in range(0,len(pts),14)]
block=("const COAST = [\n  // Traced from Christopher Tolkien's general map of Middle-earth (inner shore line, ~1 mi\n"
       "  // detail) inside the area that map covers; the far north, east and south are extrapolated.\n  "
       + ",\n  ".join(rows) + "\n];")
a=s.index("const COAST = ["); b=s.index("];",a)+2
s=s[:a]+block+s[b:]
tol=','.join(f'[{x},{y}]' for x,y in O['tolfalas'])
s=re.sub(r"(\{ name:'Tolfalas', pts:\[).*?(\] \})", lambda m: m.group(1)+tol+m.group(2), s, count=1)
open(path,'w').write(s)
print('coast points',len(pts))
# Ranges whose atlas course disagrees locally with the reference: set them straight from the map.
f=A['frame']
def px2mi(pts): return ','.join(f'[{round((x-f["ox"])*f["s"])},{round(-(y-f["oy"])*f["s"])}]' for x,y in pts)
s=open(path).read()
s=re.sub(r"(alt:'The Blue Mountains \(south\)'.*?pts:\[).*?(\] \})", lambda m: m.group(1)+px2mi([(322,600),(304,648),(280,698),(254,740),(228,782)])+m.group(2), s, count=1)
open(path,'w').write(s)
