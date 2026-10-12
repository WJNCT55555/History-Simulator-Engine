import fs from 'node:fs/promises';
import path from 'node:path';
import type { Plugin } from 'vite';
import { assertProject } from '../src/engine/validation';
export function projectApi(root:string):Plugin {
  const directory=path.join(root,'projects','local');
  return {name:'history-project-files',configureServer(server){server.middlewares.use('/api/projects',async(req,res)=>{
    const send=(code:number,value:unknown)=>{res.statusCode=code;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));};
    const id=(req.url??'/').split('?')[0].replace(/^\//,'');
    if(id&&!/^[a-z][a-z0-9_-]{0,79}$/.test(id))return send(400,{error:'Invalid project ID'});
    try{
      if(req.method==='GET'){
        if(id){const data=await fs.readFile(path.join(directory,id,'game.json'),'utf8');const project:unknown=JSON.parse(data);assertProject(project);return send(200,project);}
        let folders:string[]=[];try{folders=await fs.readdir(directory);}catch{return send(200,[]);}
        const list=[];for(const name of folders){if(!/^[a-z][a-z0-9_-]{0,79}$/.test(name))continue;try{const value:unknown=JSON.parse(await fs.readFile(path.join(directory,name,'game.json'),'utf8'));assertProject(value);list.push({id:value.id,name:value.name,version:value.version});}catch{/* Ignore non-project files. */}}return send(200,list);
      }
      if(req.method!=='POST'||id)return send(405,{error:'Method not allowed'});
      if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`)return send(403,{error:'Cross-origin project writes are disabled'});
      const chunks:Buffer[]=[];let size=0;
      for await(const chunk of req){size+=Buffer.byteLength(chunk);if(size>50000000)return send(413,{error:'Project exceeds 50 MB'});chunks.push(Buffer.from(chunk));}
      const value:unknown=JSON.parse(Buffer.concat(chunks).toString('utf8'));assertProject(value);
      const folder=path.join(directory,value.id);await fs.mkdir(folder,{recursive:true});const file=path.join(folder,'game.json');await fs.writeFile(`${file}.tmp`,`${JSON.stringify(value,null,2)}\n`,'utf8');await fs.rename(`${file}.tmp`,file);return send(200,{ok:true,path:file});
    }catch(error){return send(400,{error:String(error)});}
  });}};
}
