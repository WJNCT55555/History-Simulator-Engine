import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
const notices=await Promise.all(['react','react-dom','scheduler'].map(name=>readFile(new URL(`../node_modules/${name}/LICENSE`,import.meta.url),'utf8')));
await build({entryPoints:['src/runtime/player.tsx'],outfile:'generated/player.js',bundle:true,format:'iife',platform:'browser',target:'es2022',minify:true,legalComments:'none',define:{'process.env.NODE_ENV':'"production"'},banner:{js:`/* ${notices.join('\n\n').replace(/\*\//g,'* /')} */`}});
console.log('Built self-contained game player.');
