import { collections, type GameProject } from '../../src/engine/model';
import { validateProject } from '../../src/engine/validation';

// Drafts may have broken references or unfinished share totals. They must still
// contain structures that the form and graph editors can safely render.
export function isEditableProject(value: unknown): value is GameProject {
  if(!value||typeof value!=='object')return false;
  const p=value as GameProject;
  if(collections.some(key=>!Array.isArray(p[key])||p[key].some(item=>!item||typeof item.id!=='string'||typeof item.name!=='string'||(item.description!==undefined&&typeof item.description!=='string'))))return false;
  return !validateProject(value).some(issue=>issue.path==='project'||/需要列表|条目必须|需要文本|无效条件|无效表达式|无效运算|效果需要列表|条件组需要列表/.test(issue.message));
}
