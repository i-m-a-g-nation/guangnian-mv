#!/usr/bin/env python3
"""Deterministic offline illustration renderer using Pillow (pip install pillow).
Works without Chrome, useful for frame farms and reproducible production renders.
"""
from __future__ import annotations
import argparse, json, math, sys
from pathlib import Path
from functools import lru_cache
from PIL import Image, ImageOps, ImageChops, ImageDraw, ImageFilter

ROOT=Path(__file__).resolve().parents[1]
P=json.loads((ROOT/'project.json').read_text(encoding='utf-8'))
TIMELINE=json.loads((ROOT/'timeline.json').read_text(encoding='utf-8'))['shots']
W,H=P['width'],P['height']

def clamp(x):return min(1.0,max(0.0,x))
def smooth(x):
 x=clamp(x);return x*x*x*(x*(6*x-15)+10)
def ease(x,kind):
 x=clamp(x)
 if kind=='linear':return x
 if kind=='smoothstep':return x*x*(3-2*x)
 return smooth(x)
def interpolate(a,b,t):return a+(b-a)*t
@lru_cache(maxsize=200)
def get_layer(p):
 with Image.open(ROOT/p) as im:
  return im.convert('RGBA').copy()

def position(cam,progress,parallax,motion):
 t=ease(progress,cam.get('ease'))
 a=cam.get('from',{});b=cam.get('to',{})
 m=motion or {};mt=ease(progress,m.get('ease'))
 c=m.get('from',{});d=m.get('to',{})
 tx=interpolate(a.get('x',0),b.get('x',0),t)*parallax+interpolate(c.get('x',0),d.get('x',0),mt)
 ty=interpolate(a.get('y',0),b.get('y',0),t)*parallax+interpolate(c.get('y',0),d.get('y',0),mt)
 zoom=interpolate(a.get('scale',1),b.get('scale',1),t)*interpolate(c.get('scale',1),d.get('scale',1),mt)
 rot=interpolate(a.get('rotationDeg',0),b.get('rotationDeg',0),t)
 return tx,ty,zoom,rot

def transform(im,cam,progress,layer):
 fit=layer.get('fit','cover')
 if fit=='contain':canvas=ImageOps.contain(im,(W,H),method=Image.Resampling.LANCZOS);frame=Image.new('RGBA',(W,H));frame.alpha_composite(canvas,((W-canvas.width)//2,(H-canvas.height)//2))
 elif fit=='stretch':frame=im.resize((W,H),Image.Resampling.LANCZOS)
 else:frame=ImageOps.fit(im,(W,H),method=Image.Resampling.LANCZOS,centering=(.5,.5))
 tx,ty,zoom,rot=position(cam,progress,layer.get('parallax',1),layer.get('motion'))
 tw=max(1,round(W*zoom));th=max(1,round(H*zoom))
 frame=frame.resize((tw,th),Image.Resampling.BICUBIC)
 if rot:frame=frame.rotate(-rot,expand=True,resample=Image.Resampling.BICUBIC)
 left=round((W-frame.width)/2+tx);top=round((H-frame.height)/2+ty)
 output=Image.new('RGBA',(W,H))
 xa=max(0,left);ya=max(0,top);xb=min(W,left+frame.width);yb=min(H,top+frame.height)
 if xb>xa and yb>ya:
  clipped=frame.crop((xa-left,ya-top,xb-left,yb-top))
  output.alpha_composite(clipped,(xa,ya))
 return output

def apply_reveal(im,reveal,p):
 if not reveal:return im
 v=ease((p-reveal.get('from',0))/max(1e-6,reveal.get('to',1)-reveal.get('from',0)),'smoothstep')
 mask=Image.new('L',(W,H),0);d=ImageDraw.Draw(mask)
 typ=reveal.get('type');cx,cy=reveal.get('center',[W/2,H/2])
 if typ in ('radial-in','radial-out'):
  r=math.hypot(W,H)*(1-v if typ=='radial-in' else v)
  if typ=='radial-in':
   d.rectangle((0,0,W,H),fill=255);d.ellipse((cx-r,cy-r,cx+r,cy+r),fill=0)
  else:d.ellipse((cx-r,cy-r,cx+r,cy+r),fill=255)
 elif typ=='wipe-right':d.rectangle((0,0,W*v,H),fill=255)
 elif typ=='wipe-left':d.rectangle((W*(1-v),0,W,H),fill=255)
 else:raise ValueError(f'Unsupported reveal: {typ}')
 im.putalpha(ImageChops.multiply(im.getchannel('A'),mask))
 return im

@lru_cache(maxsize=30)
def glow_sprite(radius,color):
 # Cached local Gaussian brush; never regenerates a random texture per frame.
 R=int(radius);s=R*2+2
 glow=Image.new('RGBA',(s,s),(0,0,0,0))
 d=ImageDraw.Draw(glow)
 d.ellipse((R*.55,R*.55,R*1.45,R*1.45),fill=(*hexrgb(color),220))
 return glow.filter(ImageFilter.GaussianBlur(radius=max(1,R*.26)))
def hexrgb(col):return tuple(int(col[i:i+2],16) for i in (1,3,5))
def fx_glow(out,fx,p):
 radius=int(fx['radius']);g=glow_sprite(radius,fx['color']).copy();alpha=clamp(fx.get('opacity',.12)*(1+fx.get('pulse',0)*math.sin(2*math.pi*p)))
 g.putalpha(g.getchannel('A').point(lambda a:round(a*alpha)))
 x,y=fx['center'];x=round(x-radius-1);y=round(y-radius-1)
 xa=max(0,x);ya=max(0,y);xb=min(W,x+g.width);yb=min(H,y+g.height)
 if xb>xa and yb>ya:out.alpha_composite(g.crop((xa-x,ya-y,xb-x,yb-y)),(xa,ya))

def opacity_at(layer,p):
 keys=layer.get('opacityKeys')
 if not keys:return clamp(interpolate(layer.get('opacityFrom',layer.get('opacity',1)),layer.get('opacityTo',layer.get('opacity',1)),p))
 if p<=keys[0]['t']:return clamp(keys[0]['value'])
 if p>=keys[-1]['t']:return clamp(keys[-1]['value'])
 for a,b in zip(keys,keys[1:]):
  if a['t']<=p<=b['t']:
   v=ease((p-a['t'])/max(1e-8,b['t']-a['t']),'smoothstep')
   return clamp(interpolate(a['value'],b['value'],v))
 return 1

def draw(frame,shot,rec,opts):
 if shot['id']=='DEMO':p=clamp((frame-opts.start)/max(1,opts.end-opts.start-1))
 else:p=clamp((frame-rec['startFrame'])/max(1,rec['endFrame']-rec['startFrame']-1))
 out=Image.new('RGBA',(W,H),hexrgb(P['background'])+(255,))
 if shot.get('assetStatus')=='TODO' and opts.allow_placeholder:
  ImageDraw.Draw(out).text((W//2-110,H//2),shot['id']+' ASSETS PENDING',fill=(127,216,216),stroke_width=0)
  return out.convert('RGB')
 for layer in shot.get('layers',[]):
  fn=ROOT/layer['src']
  if not fn.exists():
   if layer.get('required',True):raise FileNotFoundError(f'{shot["id"]}: {layer["src"]}')
   continue
  im=transform(get_layer(layer['src']),shot.get('camera',{}),p,layer)
  im=apply_reveal(im,layer.get('reveal'),p)
  opacity=opacity_at(layer,p)
  if opacity!=1:im.putalpha(im.getchannel('A').point(lambda a:round(a*opacity)))
  blend = layer.get('blend', 'source-over')
  if blend == 'source-over':
   out.alpha_composite(im)
  elif blend == 'screen':
   # 滤色模式：让青金水彩光斑自然透亮，且绝不死白
   rgb_out = out.convert('RGB')
   rgb_im = im.convert('RGB')
   screened = ImageChops.screen(rgb_out, rgb_im)
   out = Image.composite(screened.convert('RGBA'), out, im.getchannel('A'))
  elif blend == 'add':
   # 叠加发光模式：适合星尘、怀表金环与 S35/S37 逆光边缘
   rgb_out = out.convert('RGB')
   rgb_im = im.convert('RGB')
   added = ImageChops.add(rgb_out, rgb_im)
   out = Image.composite(added.convert('RGBA'), out, im.getchannel('A'))
  else:
   raise NotImplementedError(f'Unsupported blend mode: {blend}')
 for fx in shot.get('fx',[]):
  if fx.get('type')=='radialGlow':fx_glow(out,fx,p)
  else:raise NotImplementedError('Unknown fx '+str(fx))
 return out.convert('RGB')

class Args:pass

def main():
 parser=argparse.ArgumentParser(description='Render MV frames from assets + shot configs, never generate new paintings')
 parser.add_argument('--shot',default='DEMO',help='DEMO, S05, or ALL')
 parser.add_argument('--count',type=int)
 parser.add_argument('--start',type=int)
 parser.add_argument('--end',type=int)
 parser.add_argument('--out')
 parser.add_argument('--allow-placeholder',action='store_true')
 args=parser.parse_args()
 demo=args.shot=='DEMO'
 if not demo and args.shot!='ALL' and args.shot not in {s['id'] for s in TIMELINE}:parser.error('Unknown shot')
 rec=next((s for s in TIMELINE if s['id']==args.shot),None)
 args.start = args.start if args.start is not None else (0 if demo or args.shot=='ALL' else rec['startFrame'])
 args.end = args.end if args.end is not None else (120 if demo else P['totalFrames'] if args.shot=='ALL' else rec['endFrame'])
 if args.count is not None:args.end=args.start+args.count
 if args.end<=args.start:parser.error('end must exceed start')
 if not demo and (args.start<0 or args.end>P['totalFrames']):parser.error('frame interval outside timeline')
 rootout=Path(args.out or ('output/demo_frames' if demo else 'output/frames'))
 if not rootout.is_absolute():rootout=ROOT/rootout
 rootout.mkdir(parents=True,exist_ok=True)
 used=['DEMO'] if demo else [s['id'] for s in TIMELINE if s['startFrame']<args.end and s['endFrame']>args.start]
 configs={id:json.loads((ROOT/'shots'/id/'shot.json').read_text(encoding='utf-8')) for id in used}
 if not args.allow_placeholder:
  missing=[]
  for id,shot in configs.items():
   if shot.get('assetStatus')=='TODO':missing.append(id+': TODO')
   missing.extend(layer['src'] for layer in shot.get('layers',[]) if layer.get('required',True) and not (ROOT/layer['src']).exists())
  if missing:raise RuntimeError('Missing production assets:\n'+'\n'.join(missing[:20]))
 print(f'Rendering {args.shot} frames [{args.start},{args.end}) -> {rootout}',flush=True)
 for f in range(args.start,args.end):
  s=next((s for s in TIMELINE if s['startFrame']<=f<s['endFrame']),None)
  if demo: shot=configs['DEMO']
  else:
   if not s:raise ValueError(f'Unmapped frame {f}')
   shot=configs[s['id']]
  im=draw(f,shot,s,args)
  im.save(rootout/f'{f:06d}.png',compress_level=4)
  if f==args.start or (f-args.start+1)%12==0 or f==args.end-1:print(f'frame {f-args.start+1}/{args.end-args.start}',flush=True)
 print('Done. These are subtitle-free frames.',flush=True)
if __name__=='__main__':main()
