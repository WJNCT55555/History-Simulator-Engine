import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Game } from './runtime/Game';
import { demoProject } from './projects/template';
import { assertProject } from './engine/validation';
import type { GameProject } from './engine/model';
function Player(){const [project,setProject]=useState<GameProject>(demoProject);return <><div style={{padding:12,background:'#20362d',color:'#eee',fontFamily:'system-ui',display:'flex',gap:20,alignItems:'center'}}><a href="./editor/" style={{color:'#ddd'}}>打开制作工具</a><label>载入游戏项目 <input type="file" accept=".json" onChange={e=>{const file=e.target.files?.[0];if(file)void file.text().then(text=>{const value:unknown=JSON.parse(text);assertProject(value);setProject(value);}).catch(error=>window.alert(String(error)));}}/></label></div><Game key={JSON.stringify(project)} project={project}/></>;}
createRoot(document.getElementById('root')!).render(<Player/>);
