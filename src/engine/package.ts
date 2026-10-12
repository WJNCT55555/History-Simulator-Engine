import type { GameProject } from './model';
import { assertProject } from './validation';
/** Offline artifact: engine + React player + definition + embedded media in one HTML. */
export function standaloneHtml(project:GameProject,playerBundle:string):string {
  assertProject(project);
  const title=project.name.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const definition=JSON.stringify(project).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{margin:0}button,input,select{font:inherit}</style></head><body><div id="root"></div><script id="game-project" type="application/json">${definition}</script><script>${playerBundle.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
}
