import fs from 'node:fs/promises';
import path from 'node:path';
import { assertProject } from '../src/engine/validation';
import { standaloneHtml } from '../src/engine/package';
const [input,output]=process.argv.slice(2);
if(!input){console.error('Usage: npm run export -- projects/my-game/game.json output/my-game/index.html');process.exit(1);}
const project:unknown=JSON.parse(await fs.readFile(input,'utf8'));assertProject(project);
const target=path.resolve(output??`output/${project.id}/index.html`);
await fs.mkdir(path.dirname(target),{recursive:true});
await fs.writeFile(target,standaloneHtml(project,await fs.readFile('generated/player.js','utf8')),'utf8');
console.log(`Exported ${project.name}: ${target}`);
