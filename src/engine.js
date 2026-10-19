// engine.js — deterministic full-resolution 2D illustration compositor.
// A render is a pure function of fixed assets, fixed shot data, and integer frame.
const canvas = document.getElementById('mv');
const ctx = canvas.getContext('2d', {alpha:false, desynchronized:false});
const jsonCache = new Map();
const imageCache = new Map();
const clamp01 = x => Math.max(0, Math.min(1, x));
const lerp = (a,b,t) => a+(b-a)*t;
const ease = (t,name) => {
  const u=clamp01(t);
  if(name==='linear')return u;
  if(name==='smoothstep')return u*u*(3-2*u);
  return u*u*u*(u*(u*6-15)+10); // smootherstep
};
async function readJSON(path) {
  if(!jsonCache.has(path))jsonCache.set(path,fetch('/'+path).then(r=>{
    if(!r.ok)throw new Error(`JSON ${path}: HTTP ${r.status}`);
    return r.json();
  }));
  return jsonCache.get(path);
}
async function readImage(path, required=true) {
  if(!imageCache.has(path))imageCache.set(path,new Promise((resolve,reject)=>{
    const im=new Image();
    im.onload=()=>resolve(im);
    im.onerror=()=>required?reject(new Error(`Required image not found: ${path}`)):resolve(null);
    im.src='/'+path;
  }));
  return imageCache.get(path);
}
let projectPromise=readJSON('project.json');
let timelinePromise=readJSON('timeline.json');
function decodeColor(hex) {
  const m=/^#([0-9a-fA-F]{6})$/.exec(hex||'');
  if(!m)return [127,216,216];
  const h=m[1];return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];
}
function drawGlow(fx,p,W,H) {
  if(fx.type!=='radialGlow')return;
  const [r,g,b]=decodeColor(fx.color);
  const [x,y]=fx.center;
  const a=clamp01((fx.opacity??0.12)*(1+(fx.pulse??0)*Math.sin(p*Math.PI*2)));
  const grad=ctx.createRadialGradient(x,y,0,x,y,fx.radius);
  grad.addColorStop(0,`rgba(${r},${g},${b},${a})`);
  grad.addColorStop(.35,`rgba(${r},${g},${b},${a*.35})`);
  grad.addColorStop(1,`rgba(${r},${g},${b},0)`);
  ctx.fillStyle=grad;
  ctx.fillRect(x-fx.radius,y-fx.radius,fx.radius*2,fx.radius*2);
}
function drawCover(im,W,H) {
  const k=Math.max(W/im.naturalWidth,H/im.naturalHeight);
  const w=im.naturalWidth*k,h=im.naturalHeight*k;
  ctx.drawImage(im,(W-w)/2,(H-h)/2,w,h);
}
function applyReveal(reveal,p,W,H) {
  if(!reveal)return;
  const f=clamp01((p-(reveal.from??0))/Math.max(1e-6,(reveal.to??1)-(reveal.from??0)));
  const v=ease(f,'smoothstep');
  const [cx,cy]=reveal.center||[W/2,H/2];
  ctx.beginPath();
  if(reveal.type==='radial-in'){
    ctx.rect(-W,-H,3*W,3*H);
    const radius=Math.hypot(W,H)*(1-v);
    if(radius>0)ctx.arc(cx,cy,radius,0,2*Math.PI,true);
    ctx.clip('evenodd');
  }else if(reveal.type==='radial-out'){
    ctx.arc(cx,cy,Math.hypot(W,H)*v,0,2*Math.PI);
    ctx.clip();
  }else if(reveal.type==='wipe-right'){
    ctx.rect(0,0,W*v,H);ctx.clip();
  }else if(reveal.type==='wipe-left'){
    ctx.rect(W*(1-v),0,W*v,H);ctx.clip();
  }
}
function drawLayer(layer,im,p,cam,W,H) {
  if(!im)return;
  const par=layer.parallax??1;
  const M=layer.motion;
  const q=ease(p,M?.ease);
  const m0=M?.from||{},m1=M?.to||{};
  const posx=lerp(m0.x??0,m1.x??0,q);
  const posy=lerp(m0.y??0,m1.y??0,q);
  const zoom=lerp(m0.scale??1,m1.scale??1,q);
  const rotation=lerp(m0.rotationDeg??0,m1.rotationDeg??0,q);
  let opacity=lerp(layer.opacityFrom??layer.opacity??1,layer.opacityTo??layer.opacity??1,p);
  if(Array.isArray(layer.opacityKeys) && layer.opacityKeys.length){
    const keys=layer.opacityKeys;
    if(p<=keys[0].t) opacity=keys[0].value;
    else if(p>=keys[keys.length-1].t) opacity=keys[keys.length-1].value;
    else for(let k=0;k<keys.length-1;k++){
      if(p>=keys[k].t && p<=keys[k+1].t){
        const u=ease((p-keys[k].t)/(keys[k+1].t-keys[k].t),'smoothstep');
        opacity=lerp(keys[k].value,keys[k+1].value,u);break;
      }
    }
  }
  ctx.save();
  ctx.globalAlpha=clamp01(opacity);
  ctx.globalCompositeOperation=layer.blend||'source-over';
  ctx.translate(W/2+cam.x*par+posx,H/2+cam.y*par+posy);
  ctx.rotate((cam.rotationDeg+rotation)*Math.PI/180);
  ctx.scale(cam.scale*zoom,cam.scale*zoom);
  ctx.translate(-W/2,-H/2);
  applyReveal(layer.reveal,p,W,H);
  if(layer.fit==='contain'){
    const k=Math.min(W/im.naturalWidth,H/im.naturalHeight);
    const w=im.naturalWidth*k,h=im.naturalHeight*k;
    ctx.drawImage(im,(W-w)/2,(H-h)/2,w,h);
  }else if(layer.fit==='stretch'){
    ctx.drawImage(im,0,0,W,H);
  }else{
    drawCover(im,W,H);
  }
  ctx.restore();
}
function fitCamera(camera,p) {
  const q=ease(p,camera.ease);
  let from=camera.from||{},to=camera.to||{};
  return {
    x:lerp(from.x??0,to.x??0,q),y:lerp(from.y??0,to.y??0,q),
    scale:lerp(from.scale??1,to.scale??1,q),
    rotationDeg:lerp(from.rotationDeg??0,to.rotationDeg??0,q)
  };
}
function findShot(timeline,globalFrame) {
  return timeline.shots.find(s=>s.startFrame<=globalFrame && globalFrame<s.endFrame);
}
function placeholder(id,W,H) {
  ctx.fillStyle='#0A1422';ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#7FD8D8';ctx.textAlign='center';ctx.font='42px sans-serif';
  ctx.fillText(`${id} — ASSETS PENDING`,W/2,H/2);
}
// In production, missing required assets cause an error unless explicitly in placeholder mode.
window.renderFrame=async function(globalFrame,opts={}) {
  const project=await projectPromise;
  const timeline=await timelinePromise;
  const frame=Math.floor(Number(globalFrame));
  const override=opts.shot;
  const record=override && override!=='DEMO'
    ?timeline.shots.find(x=>x.id===override)
    :(!override?findShot(timeline,frame):null);
  if(!override&&!record)throw new Error(`frame ${frame} outside timeline`);
  if(override!=='DEMO'&&!record)throw new Error(`unknown shot ${override}`);
  const sid=override||record.id;
  const shot=await readJSON(`shots/${sid}/shot.json`);
  canvas.width=project.width;canvas.height=project.height;
  const W=canvas.width,H=canvas.height;
  let p;
  if(override==='DEMO')p=clamp01(frame/Math.max(1,(opts.demoFrames??120)-1));
  else p=clamp01((frame-record.startFrame)/Math.max(1,record.endFrame-record.startFrame-1));
  const cam=fitCamera(shot.camera||{},p);
  ctx.setTransform(1,0,0,1,0,0);
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  ctx.fillStyle=project.background||'#0A1422';ctx.fillRect(0,0,W,H);
  if(shot.assetStatus==='TODO' && opts.allowPlaceholder){
    placeholder(sid,W,H);
    return {shot:sid,frame,progress:p};
  }
  const layers=[];
  for(const layer of shot.layers||[]){
    const img=await readImage(layer.src,layer.required!==false);
    layers.push([layer,img]);
  }
  const missing=layers.some(([l,img])=>l.required!==false&&!img);
  if(shot.assetStatus==='TODO' && opts.allowPlaceholder){
    placeholder(sid,W,H);
  }else if(missing){
    throw new Error(`required image missing for ${sid}`);
  }else{
    for(const [layer,img] of layers)drawLayer(layer,img,p,cam,W,H);
    for(const fx of shot.fx||[])drawGlow(fx,p,W,H);
  }
  return {shot:sid,frame,progress:p};
};
window.getProject=async()=>await projectPromise;
window.getTimeline=async()=>await timelinePromise;
