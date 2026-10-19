import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const MIME={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.css':'text/css; charset=utf-8','.m4a':'audio/mp4'};
export function startServer({port=4173,host='127.0.0.1'}={}){
 const server=http.createServer(async(req,res)=>{
   try{
    const u=new URL(req.url,'http://localhost');
    const p=decodeURIComponent(u.pathname==='/'?'/preview.html':u.pathname);
    const filepath=path.resolve(root,'.'+p);
    if(filepath!==root&&!filepath.startsWith(root+path.sep)) {res.writeHead(403);res.end('forbidden');return}
    const s=await stat(filepath);if(!s.isFile())throw new Error('not file');
    const buff=await readFile(filepath);
    res.writeHead(200,{'Content-Type':MIME[path.extname(filepath)]||'application/octet-stream','Cache-Control':'no-store'});res.end(buff);
   }catch(e){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Not Found')}
 });
 return new Promise(resolve=>server.listen(port,host,()=>resolve({server,port:server.address().port,host})));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT||4173);
 const v=await startServer({port});console.log(`打开 http://${v.host}:${v.port}/preview.html`);
}
