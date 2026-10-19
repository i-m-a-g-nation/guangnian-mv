import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const project=read('project.json'),timeline=read('timeline.json');
const missing=[];const errors=[];let end=0;
function validate(s){
 if(s.startFrame!==end)errors.push(`${s.id}: gap/overlap at frame ${end}`);
 if(s.endFrame<=s.startFrame)errors.push(`${s.id}: invalid frame duration`);
 if(s.startFrame!==Math.round(s.startSec*project.fps)||s.endFrame!==Math.round(s.endSec*project.fps))errors.push(`${s.id}: frame-time mismatch`);
 end=s.endFrame;
 let f=`shots/${s.id}/shot.json`;let shot=read(f);
 if(shot.id!==s.id)errors.push(`${s.id}: config ID mismatch`);
 if(shot.assetStatus==='TODO')missing.push(`${s.id} pending assets`);
 for(let layer of shot.layers||[]){if(layer.required!==false&&!fs.existsSync(path.join(root,layer.src)))missing.push(layer.src)}
}
for(let s of timeline.shots)validate(s);
if(end!==project.totalFrames)errors.push(`timeline ends at ${end}, project expects ${project.totalFrames}`);
if(timeline.shots.length!==43)errors.push(`shot count ${timeline.shots.length}, expected 43`);
console.log(`Timeline: ${timeline.shots.length} shots, ${end} frames, ${(end/project.fps).toFixed(3)} seconds.`);
console.log(`Asset preparation pending: ${missing.length} entries (expected at project start).`);
if(errors.length)console.error(errors.join('\n'));
if(process.argv.includes('--assets')&&missing.length)console.error('Missing required assets:\n'+missing.join('\n'));
process.exitCode=errors.length||(process.argv.includes('--assets')&&missing.length)?1:0;
