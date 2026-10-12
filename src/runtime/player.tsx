import { createRoot } from 'react-dom/client';
import { assertProject } from '../engine/validation';
import { Game } from './Game';
const element=document.getElementById('game-project');
try {const project:unknown=JSON.parse(element?.textContent??'null');assertProject(project);createRoot(document.getElementById('root')!).render(<Game project={project}/>);}
catch(error){document.getElementById('root')!.textContent=`游戏项目无法加载：${String(error)}`;}
