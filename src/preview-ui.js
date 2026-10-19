const $=id=>document.getElementById(id);
const timeline=await window.getTimeline();
for(const s of timeline.shots){const op=document.createElement('option');op.value=s.id;op.textContent=`${s.id} · ${s.startSec.toFixed(3)}–${s.endSec.toFixed(3)}s`;$('shot').append(op)}
let running=false,raf=0,last=0,localIndex=0;
let record=null;
function bounds(){const shot=$('shot').value;record=timeline.shots.find(s=>s.id===shot)||null;
  $('frame').max=record?Math.max(0,record.endFrame-record.startFrame-1):119;
  $('frame').value='0';localIndex=0;paint();}
async function paint(){
 const demo=!record;
 const frame=demo?localIndex:record.startFrame+localIndex;
 $('time').textContent=(frame/24).toFixed(3)+' s';
 try{let info=await window.renderFrame(frame,{shot:demo?'DEMO':record.id,demoFrames:120,allowPlaceholder:true});
 $('status').textContent=`${info.shot} | 局部帧 ${localIndex} | 进度 ${(info.progress*100).toFixed(1)}%`;}
 catch(e){$('status').textContent=`素材或配置错误：${e.message}`;}
}
$('shot').addEventListener('change',()=>{running=false;$('play').textContent='播放';bounds()});
$('frame').addEventListener('input',()=>{localIndex=Number($('frame').value);paint()});
$('play').addEventListener('click',()=>{running=!running;$('play').textContent=running?'暂停':'播放';last=performance.now();if(running)requestAnimationFrame(loop)});
function loop(now){if(!running)return;const delta=(now-last)/1000;last=now;raf+=delta*24;const steps=Math.floor(raf);if(steps>0){raf-=steps;localIndex=(localIndex+steps)%(Number($('frame').max)+1);$('frame').value=localIndex;paint()}requestAnimationFrame(loop)}
bounds();
