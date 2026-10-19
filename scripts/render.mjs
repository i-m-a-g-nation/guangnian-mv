// Zero npm dependencies. Uses installed Chromium/Chrome DevTools protocol.
import fs from 'node:fs/promises';
import fss from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {startServer} from './server.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const params=process.argv.slice(2);
const arg=(key,def)=>{const i=params.indexOf(key);return i<0?def:params[i+1]};
const flag=(key)=>params.includes(key);
const shotId=arg('--shot',null);
const demo=shotId==='DEMO';
const countOption=arg('--count',null);
const startOption=arg('--start',null);
const endOption=arg('--end',null);
const allowPlaceholder=flag('--allow-placeholder');
const delay=t=>new Promise(r=>setTimeout(r,t));
const proj=JSON.parse(await fs.readFile(path.join(root,'project.json'),'utf8'));
const timeline=JSON.parse(await fs.readFile(path.join(root,'timeline.json'),'utf8'));
if(shotId&&!demo&&!timeline.shots.find(s=>s.id===shotId))throw new Error(`Unknown shot ${shotId}`);
let start=demo?0:shotId?timeline.shots.find(s=>s.id===shotId).startFrame:0;
let end=demo?120:shotId?timeline.shots.find(s=>s.id===shotId).endFrame:proj.totalFrames;
if(startOption!==null)start=Number(startOption);
if(endOption!==null)end=Number(endOption);
if(countOption!==null)end=start+Number(countOption);
if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||end<=start)throw new Error('Invalid frame interval');
if(!demo&&(start<0||end>proj.totalFrames))throw new Error('Requested frame interval outside project');
const needed=demo?['DEMO']:timeline.shots.filter(s=>s.startFrame<end&&s.endFrame>start).map(s=>s.id);
if(!allowPlaceholder){
  let lacking=[];
  for(const id of needed){
    const shot=JSON.parse(await fs.readFile(path.join(root,'shots',id,'shot.json'),'utf8'));
    if(shot.assetStatus==='TODO')lacking.push(`${id}: assetStatus TODO`);
    for(const layer of shot.layers||[]){if(layer.required!==false&&!fss.existsSync(path.join(root,layer.src)))lacking.push(`${id}: ${layer.src}`)}
  }
  if(lacking.length)throw new Error('Aborted. Assets have not been prepared:\n'+lacking.slice(0,15).join('\n')+'\nUse --allow-placeholder only for debugging.');
}
const outputDir=path.resolve(root,arg('--out',demo?'output/demo_frames':'output/frames'));
await fs.mkdir(outputDir,{recursive:true});
const browserCandidates=process.platform==='win32'
  ?[process.env.CHROME_PATH,'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe']
  :[process.env.CHROME_PATH,'/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome','/opt/google/chrome/chrome'];
const chrome=browserCandidates.find(Boolean)&&browserCandidates.find(s=>s&&fss.existsSync(s));
if(!chrome)throw new Error('Chromium/Chrome not found; set CHROME_PATH to a browser executable.');

class CDP{
 constructor(ws){this.ws=ws;this.id=0;this.pending=new Map();ws.addEventListener('message',ev=>{
    let m;try{m=JSON.parse(ev.data)}catch{return}
    if(!m.id)return;
    const waiter=this.pending.get(m.id);if(!waiter)return;
    this.pending.delete(m.id);clearTimeout(waiter.timer);
    if(m.error)waiter.reject(new Error(`${waiter.method}: ${m.error.message}`));
    else waiter.resolve(m.result);
  });}
 send(method,params={},timeoutMs=60000){return new Promise((resolve,reject)=>{
   const id=++this.id;
   const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error(`${method} timeout`))},timeoutMs);
   this.pending.set(id,{resolve,reject,timer,method});
   this.ws.send(JSON.stringify({id,method,params}));
 });}
}
let dir=null,proc=null,site=null,socket=null;
try{
  site=await startServer({port:0});
  dir=await fs.mkdtemp(path.join(os.tmpdir(),'guangnian-chrome-'));
  proc=spawn(chrome,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--no-proxy-server','--proxy-bypass-list=*','--hide-scrollbars','--no-first-run','--no-default-browser-check','--force-device-scale-factor=1','--remote-allow-origins=*','--remote-debugging-port=0',`--user-data-dir=${dir}`,'about:blank'],{stdio:'ignore'});
  let port=null;
  for(let i=0;i<100;i++){
    try {let active=await fs.readFile(path.join(dir,'DevToolsActivePort'),'utf8');port=Number(active.trim().split('\n')[0]);break}catch{}
    if(proc.exitCode!==null)throw new Error('Chrome exited before DevTools endpoint became available');
    await delay(100);
  }
  if(!port)throw new Error('Timed out starting Chrome');
  let target=null;
  for(let i=0;i<30;i++){
    try {let list=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();target=list.find(x=>x.type==='page');if(target)break}catch{}
    await delay(100);
  }
  if(!target)throw new Error('Cannot find Chrome page');
  socket=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{
    socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});
  });
  const cdp=new CDP(socket);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:proj.width,height:proj.height,deviceScaleFactor:1,mobile:false});
  await cdp.send('Page.navigate',{url:`http://127.0.0.1:${site.port}/render.html`});
  let ready=false;
  for(let i=0;i<100;i++){
    try {const a=await cdp.send('Runtime.evaluate',{expression:'typeof window.renderFrame === "function"',returnByValue:true});if(a.result?.value===true){ready=true;break}}catch{}
    await delay(100);
  }
  if(!ready){ const debug=await cdp.send('Runtime.evaluate',{expression:'JSON.stringify({url:location.href,html:document.documentElement.outerHTML.slice(0,800),type:typeof window.renderFrame})',returnByValue:true}); throw new Error('Browser compositor did not initialize: '+JSON.stringify(debug)); }
  console.log(`Rendering ${shotId||'whole movie'} frames [${start},${end}) (${end-start} frames) to ${outputDir}`);
  for(let frame=start;frame<end;frame++){
    const expression=`window.renderFrame(${frame}, ${JSON.stringify({shot:shotId,allowPlaceholder,demoFrames:end-start})})`;
    const done=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},120000);
    if(done.exceptionDetails)throw new Error(`Render frame ${frame} failed: ${done.exceptionDetails.text} ${done.exceptionDetails.exception?.description||''}`);
    const img=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false},120000);
    const name=String(frame).padStart(6,'0')+'.png';
    await fs.writeFile(path.join(outputDir,name),Buffer.from(img.data,'base64'));
    if(frame===start||(frame-start+1)%24===0||frame===end-1)console.log(`${frame-start+1}/${end-start} frames`);
  }
  console.log('Finished PNG sequence. Subtitle and audio are intentionally NOT burned into these frames.');
}finally{
 try{socket?.close()}catch{}
 try{proc?.kill('SIGTERM')}catch{}
 try{site?.server.close()}catch{}
 if(dir)await fs.rm(dir,{recursive:true,force:true,maxRetries:4,retryDelay:200}).catch(()=>{});
}
