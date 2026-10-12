import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Game } from './runtime/Game';
import { demoProject } from './projects/template';
import { assertProject } from './engine/validation';
import type { GameProject } from './engine/model';
function Player(){const [project,setProject]=useState<GameProject>(demoProject),input=useRef<HTMLInputElement>(null);return <><input ref={input} hidden type="file" accept=".json" onChange={e=>{const file=e.target.files?.[0];if(file)void file.text().then(text=>{const value:unknown=JSON.parse(text);assertProject(value);setProject(value);}).catch(error=>window.alert(String(error)));e.target.value='';}}/><Game key={JSON.stringify(project)} project={project} onOpenProject={()=>input.current?.click()} editorUrl="./editor/"/></>;}
createRoot(document.getElementById('root')!).render(<Player/>);
