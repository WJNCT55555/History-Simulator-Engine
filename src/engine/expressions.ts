import type { Condition, Expression, GameProject, RuntimeState } from './model';
export const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
export function support(project: GameProject, state: RuntimeState, actorId: string): number {
  const total = project.groups.reduce((sum, group) => sum + group.weight, 0);
  return total ? project.groups.reduce((sum, group) => sum + group.weight * (state.support[group.id]?.[actorId] ?? 0), 0) / total : 0;
}
export function discipline(project: GameProject, state: RuntimeState, actorId: string): number {
  const factions = project.factions.filter(f => f.actorId === actorId);
  const weight = factions.reduce((sum, f) => sum + state.factions[f.id].influence, 0);
  return weight ? 1 - factions.reduce((sum, f) => sum + state.factions[f.id].influence * state.factions[f.id].dissent, 0) / weight / 100 : 1;
}
export function metricNames(p: GameProject): string[] {
  return ['turn','year','month','resources','armaments','ap','warActive',
    ...Object.keys(p.initial.economy).map(k => `economy.${k}`),
    ...p.actors.flatMap(a => [`support.${a.id}`,`seats.${a.id}`,`relation.${a.id}`,`discipline.${a.id}`,`satisfaction.${a.id}`]),
    ...p.groups.flatMap(g => p.actors.map(a => `group.${g.id}.${a.id}`)),
    ...p.factions.flatMap(f => [`influence.${f.id}`,`dissent.${f.id}`]),
    ...p.organizations.flatMap(o => [`coverage.${o.id}`,`founded.${o.id}`]),
    ...p.ownership.flatMap(s => Object.keys(s.shares).map(k => `ownership.${s.id}.${k}`)),
    ...p.offices.map(o => `office.${o.id}`),...p.laws.map(l => `law.${l.id}`),
    ...p.variables.map(v => `variable.${v.id}`),...p.sides.flatMap(s => [`regions.${s.id}`,`military.${s.id}`]),
    ...p.sources.flatMap(s => [`militarization.${s.id}`,...['manpower','artillery','tanks'].map(k => `pool.${s.id}.${k}`)]),
    ...p.regions.flatMap(r => [...p.sides.map(s=>`control.${r.id}.${s.id}`),...['barracks','fortress','recruitingOffice','ammoFactory'].map(k=>`building.${r.id}.${k}`)]),
    ...p.journals.map(j => `journal.${j.id}`),...p.achievements.map(a => `achievement.${a.id}`)];
}
export function metric(p: GameProject, s: RuntimeState, key: string): number {
  const [kind,id,sub] = key.split('.');
  switch (kind) {
    case 'turn': return s.turn;
    case 'year': return s.year;
    case 'month': return s.month;
    case 'resources': return s.resources;
    case 'armaments': return s.armaments;
    case 'ap': return s.ap;
    case 'warActive': return Number(s.warActive);
    case 'economy': return s.economy[id as keyof RuntimeState['economy']];
    case 'support': return support(p,s,id);
    case 'group': return s.support[id]?.[sub];
    case 'influence': return s.factions[id]?.influence;
    case 'dissent': return s.factions[id]?.dissent;
    case 'discipline': return discipline(p,s,id);
    case 'satisfaction': { const actor=p.actors.find(a=>a.id===id);const preferences=Object.entries(actor?.lawPreferences??{});return preferences.length?preferences.reduce((sum,[lawId,level])=>sum+clamp(100-Math.abs(s.laws[lawId]-level)/Math.max(1,(p.laws.find(l=>l.id===lawId)?.levels.length??1)-1)*100),0)/preferences.length:100; }
    case 'coverage': return s.coverage[id];
    case 'ownership': return s.ownership[id]?.[sub];
    case 'seats': return s.seats[id];
    case 'relation': return s.relations[id];
    case 'office': return Number(s.offices[id] === p.playerActorId);
    case 'law': return s.laws[id];
    case 'variable': return s.variables[id];
    case 'regions': return Object.values(s.regions).filter(r => r.owner === id).length;
    case 'military': return s.armies.filter(a => a.faction === id).reduce((sum,a) => sum + a.manpower,0);
    case 'pool': return s.sources[id]?.[sub as keyof RuntimeState['sources'][string]];
    case 'militarization': return s.militarization[id];
    case 'control': return Number(s.regions[id]?.owner===sub);
    case 'building': return s.regions[id]?.buildings[sub as keyof RuntimeState['regions'][string]['buildings']];
    case 'founded': return Number(s.founded.includes(id));
    case 'journal': return { inactive: 0, active: 1, completed: 2, failed: -1 }[s.journals[id]];
    case 'achievement': return Number(s.achievements.includes(id));
    default: throw new Error(`未知指标：${key}`);
  }
}
export function evaluate(p: GameProject, s: RuntimeState, e: Expression): number {
  if (typeof e === 'number') return e;
  if ('metric' in e) return metric(p,s,e.metric);
  const values = e.args.map(arg => evaluate(p,s,arg));
  const [first,...rest] = values;
  const value = e.op === 'add' ? values.reduce((a,b)=>a+b,0) : e.op === 'mul' ? values.reduce((a,b)=>a*b,1)
    : e.op === 'sub' ? rest.reduce((a,b)=>a-b,first) : e.op === 'div' ? rest.reduce((a,b)=>a/b,first)
    : e.op === 'min' ? Math.min(...values) : Math.max(...values);
  if (!Number.isFinite(value)) throw new Error('表达式产生非有限值，请检查除数与输入。');
  return value;
}
export function matches(p: GameProject, s: RuntimeState, c?: Condition): boolean {
  if (!c) return true;
  if ('all' in c) return c.all.every(item=>matches(p,s,item));
  if ('any' in c) return c.any.some(item=>matches(p,s,item));
  if ('not' in c) return !matches(p,s,c.not);
  const actual = metric(p,s,c.metric), expected = evaluate(p,s,c.value);
  return c.op === 'gte' ? actual >= expected : c.op === 'lte' ? actual <= expected : c.op === 'gt' ? actual > expected
    : c.op === 'lt' ? actual < expected : c.op === 'eq' ? actual === expected : actual !== expected;
}
export function random(s: RuntimeState): number {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let t = s.rng; t = Math.imul(t ^ (t >>> 15),t | 1); t ^= t + Math.imul(t ^ (t >>> 7),t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function fingerprint(p: GameProject): string {
  let hash = 2166136261;
  for (const char of JSON.stringify(p)) hash = Math.imul(hash ^ char.charCodeAt(0),16777619);
  return (hash >>> 0).toString(16);
}
