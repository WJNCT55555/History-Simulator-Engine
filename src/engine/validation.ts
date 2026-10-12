import { collections, type Collection, type GameProject, type Condition, type Expression, type Effect } from './model';
import { metricNames } from './expressions';
import { ECONOMIC_RULES } from './economy';
export interface Issue { path: string; message: string; severity: 'error' | 'warning' }
export function validateProject(input: unknown): Issue[] {
  const issues: Issue[] = [];
  const error = (path: string,message: string) => issues.push({path,message,severity:'error'});
  const num = (v: unknown,path: string,min = -Infinity,max = Infinity,integer = false) => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) error(path,`需要${integer ? '整数' : '有限数值'}，范围 ${min}～${max}`);
  };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return [{path:'project',message:'项目必须为对象',severity:'error'}];
  const p = input as GameProject;
  if (p.schemaVersion !== 1) error('schemaVersion','不支持此项目格式版本');
  if (!/^[a-z][a-z0-9_-]{0,79}$/.test(p.id ?? '')) error('id','ID 必须以小写字母开头，仅包含小写字母、数字、下划线或连字符');
  for (const key of ['name','version','description'] as const) if (typeof p[key] !== 'string') error(key,'需要文本');
  if (typeof p.accent !== 'string' || !/^#[0-9a-f]{6}$/i.test(p.accent)) error('accent','需要六位十六进制颜色');
  for (const key of collections) if (!Array.isArray(p[key])) error(key,'需要列表');
  if (issues.length) return issues;
  const ids = Object.fromEntries(collections.map(key => [key,new Set(p[key].map(item=>item?.id))])) as Record<Collection,Set<string>>;
  const ref = (collection: Collection,id: unknown,path: string,optional = false) => {
    if (optional && (id === undefined || id === '')) return;
    if (typeof id !== 'string' || !ids[collection].has(id)) error(path,`找不到 ${collection} 中的 ID：${String(id)}`);
  };
  try {
    for (const key of collections) {
      const seen = new Set<string>();
      p[key].forEach((item,index)=>{
        const path = `${key}[${index}]`;
        if (!item || typeof item !== 'object') { error(path,'条目必须为对象'); return; }
        if (!/^[a-z][a-z0-9_-]{0,79}$/.test(item.id)) error(`${path}.id`,'无效 ID');
        if (seen.has(item.id)) error(`${path}.id`,'重复 ID'); seen.add(item.id);
        if (typeof item.name !== 'string' || !item.name.trim()) error(`${path}.name`,'名称不能为空');
        ref('assets',item.assetId,`${path}.assetId`,true);
      });
    }
    ref('actors',p.playerActorId,'playerActorId'); ref('sides',p.playerSideId,'playerSideId');
    ref('assets',p.backgroundAssetId,'backgroundAssetId',true); ref('assets',p.musicAssetId,'musicAssetId',true);
    num(p.seed,'seed',0,4294967295,true); num(p.start.year,'start.year',-9999,9999,true); num(p.start.month,'start.month',1,12,true);
    num(p.initial.resources,'initial.resources',0); num(p.initial.armaments,'initial.armaments',0);
    if (typeof p.initial.warActive !== 'boolean') error('initial.warActive','需要布尔值');
    const economyKeys = ['budget','public_debt','fiscal_arrears','gold_reserves','foreign_exchange','economy_growth','inflation_rate','unemployment_rate','economic_output_index','military_spending','tax_lower_class','tax_middle_class','tax_upper_class','tax_tariff','tax_consumption','armyLoyalty'];
    for (const k of economyKeys) num(p.initial.economy[k as keyof typeof p.initial.economy],`initial.economy.${k}`,['economy_growth','inflation_rate'].includes(k) ? -100 : 0,k.startsWith('tax_') || ['armyLoyalty','military_spending','unemployment_rate'].includes(k) ? 100 : Infinity);
    const profile = (base: Record<string,unknown>,patch: Record<string,unknown>,path: string) => {
      for (const [k,v] of Object.entries(patch)) {
        if (!(k in base)) { error(`${path}.${k}`,'未知经济参数'); continue; }
        if (typeof base[k] === 'number') num(v,`${path}.${k}`);
        else if (v && typeof v === 'object' && !Array.isArray(v)) profile(base[k] as Record<string,unknown>,v as Record<string,unknown>,`${path}.${k}`);
        else error(`${path}.${k}`,'需要参数对象');
      }
    };
    profile(ECONOMIC_RULES,p.rules.economicProfile,'rules.economicProfile');
    for (const [k,v] of Object.entries(p.rules)) if (typeof v === 'number') num(v,`rules.${k}`,0);
    for (const k of ['apPerTurn','handSize','advisorSlots','seats','electionEvery','commandPoints','movesPerTurn','destructionThreshold'] as const) num(p.rules[k],`rules.${k}`,k === 'seats' || k === 'handSize' ? 1 : 0,100000,true);
    for (const terrain of ['plains','forest','urban','mountains'] as const) num(p.rules.combatWidths[terrain],`rules.combatWidths.${terrain}`,1);
    const metrics = new Set(metricNames(p));
    const expr = (e: Expression,path: string,depth = 0): void => {
      if (depth > 16) { error(path,'表达式嵌套过深'); return; }
      if (typeof e === 'number') { num(e,path); return; }
      if (!e || typeof e !== 'object') { error(path,'无效表达式'); return; }
      if ('metric' in e) { if (!metrics.has(e.metric)) error(path,`未知指标 ${e.metric}`); return; }
      if (!['add','sub','mul','div','min','max'].includes(e.op) || !Array.isArray(e.args) || !e.args.length) { error(path,'无效运算'); return; }
      e.args.forEach((arg,i)=>expr(arg,`${path}.args[${i}]`,depth+1));
    };
    const cond = (c: Condition | undefined,path: string,depth = 0): void => {
      if (c === undefined) return;
      if (!c || typeof c !== 'object' || depth > 16) { error(path,'无效条件或嵌套过深'); return; }
      if ('all' in c || 'any' in c) {
        const list = 'all' in c ? c.all : c.any;
        if (!Array.isArray(list)) error(path,'条件组需要列表'); else list.forEach((v,i)=>cond(v,`${path}[${i}]`,depth+1));
      } else if ('not' in c) cond(c.not,`${path}.not`,depth+1);
      else { if (!metrics.has(c.metric)) error(path,`未知指标 ${c.metric}`); if (!['gte','lte','gt','lt','eq','neq'].includes(c.op)) error(path,'未知比较运算'); expr(c.value,`${path}.value`); }
    };
    const cost = (c: unknown,path: string): void => {
      if (!c || typeof c !== 'object') { error(path,'费用需要对象'); return; }
      for (const [k,v] of Object.entries(c)) { if (!['ap','resources','armaments'].includes(k)) error(`${path}.${k}`,'未知费用'); num(v,`${path}.${k}`,0); }
    };
    const effects = (list: Effect[],path: string): void => {
      if (!Array.isArray(list)) { error(path,'效果需要列表'); return; }
      list.forEach((e,i)=>{
        const at = `${path}[${i}]`;
        if ('delta' in e) expr(e.delta,`${at}.delta`);
        switch (e.type) {
          case 'resource': if (!['resources','armaments'].includes(e.key)) error(at,'未知资源'); break;
          case 'economy': if (!economyKeys.includes(e.key)) error(at,'未知经济指标'); break;
          case 'support': ref('groups',e.groupId,at); ref('actors',e.actorId,at); break;
          case 'influence': case 'dissent': ref('factions',e.factionId,at); break;
          case 'coverage': case 'found': ref('organizations',e.organizationId,at); break;
          case 'ownership': ref('ownership',e.sectorId,at); if (!p.ownership.find(s=>s.id===e.sectorId)?.shares.hasOwnProperty(e.ownerId)) error(at,'未知所有权类别'); break;
          case 'variable': ref('variables',e.variableId,at); if (!['set','add'].includes(e.mode)) error(at,'未知写入模式'); expr(e.value,`${at}.value`); break;
          case 'relation': ref('actors',e.actorId,at); break;
          case 'law': ref('laws',e.lawId,at); num(e.level,at,0, (p.laws.find(l=>l.id===e.lawId)?.levels.length ?? 1)-1,true); break;
          case 'office': ref('offices',e.officeId,at); ref('actors',e.actorId,at); break;
          case 'event': ref('events',e.eventId,at); break;
          case 'war': if (typeof e.active !== 'boolean') error(at,'战争状态需要布尔值'); break;
          case 'region': ref('regions',e.regionId,at); ref('sides',e.sideId,at); break;
          case 'militarization': ref('sources',e.sourceId,at); break;
          case 'realign': ref('sources',e.sourceId,at); ref('sides',e.sideId,at); break;
          case 'pool': ref('sources',e.sourceId,at); if (!['manpower','artillery','tanks'].includes(e.key)) error(at,'兵源池仅支持人力、支援和机动装备'); break;
          default: error(at,'未知效果类型');
        }
      });
    };
    const distribution = (shares: Record<string,number>,path: string) => {
      if (!shares || typeof shares !== 'object' || Array.isArray(shares) || !Object.keys(shares).length) { error(path,'份额不能为空'); return; }
      Object.entries(shares).forEach(([k,v])=>num(v,`${path}.${k}`,0,100));
      if (Math.abs(Object.values(shares).reduce((a,b)=>a+b,0)-100)>0.001) error(path,'份额合计必须等于 100');
    };
    p.actors.forEach((a,i)=>{ num(a.turnout,`actors[${i}].turnout`,0,100); num(a.relation,`actors[${i}].relation`,0,100); if(typeof a.eligible!=='boolean') error(`actors[${i}].eligible`,'需要布尔值'); if(!/^#[0-9a-f]{6}$/i.test(a.color)) error(`actors[${i}].color`,'无效颜色'); });
    if (!p.groups.length || p.groups.reduce((a,g)=>a+g.weight,0)<=0) error('groups','至少需要一个有正权重的社会群体');
    p.groups.forEach((g,i)=>{ num(g.weight,`groups[${i}].weight`,0); distribution(g.support,`groups[${i}].support`); for(const id of ids.actors) if(!(id in g.support)) error(`groups[${i}].support`, `缺少政治主体 ${id}`); for(const id of Object.keys(g.support)) ref('actors',id,`groups[${i}].support`); });
    p.factions.forEach((f,i)=>{ ref('actors',f.actorId,`factions[${i}]`); num(f.influence,`factions[${i}].influence`,0,100); num(f.dissent,`factions[${i}].dissent`,0,100); });
    p.actors.forEach(a=>{ const fs=p.factions.filter(f=>f.actorId===a.id); if(fs.length && Math.abs(fs.reduce((sum,f)=>sum+f.influence,0)-100)>0.001) error('factions',`${a.name} 的派系影响合计必须为 100`); });
    p.organizations.forEach((o,i)=>{ ref('actors',o.actorId,`organizations[${i}]`); num(o.share,`organizations[${i}].share`,0,100); num(o.income,`organizations[${i}].income`,0); if(typeof o.active!=='boolean') error(`organizations[${i}].active`,'需要布尔值'); effects(o.monthlyEffects,`organizations[${i}].monthlyEffects`); });
    if(p.organizations.reduce((sum,o)=>sum+o.share,0)>100.001) error('organizations','组织覆盖合计不能超过 100');
    p.ownership.forEach((s,i)=>distribution(s.shares,`ownership[${i}].shares`));
    p.offices.forEach((o,i)=>{ ref('actors',o.holderId,`offices[${i}].holderId`); if(!Array.isArray(o.permissions)||o.permissions.some(v=>!['policy','fiscal','military'].includes(v))) error(`offices[${i}].permissions`,'未知权限'); });
    p.laws.forEach((l,i)=>{ ref('offices',l.officeId,`laws[${i}].officeId`); if(!l.levels.length) error(`laws[${i}].levels`,'法律至少需要一个等级'); num(l.initialLevel,`laws[${i}].initialLevel`,0,l.levels.length-1,true); l.levels.forEach((v,j)=>{num(v.cost,`laws[${i}].levels[${j}].cost`,0);num(v.upkeep,`laws[${i}].levels[${j}].upkeep`,0); for(const n of Object.values(v.modifiers)) num(n,`laws[${i}].levels[${j}].modifiers`); effects(v.monthlyEffects,`laws[${i}].levels[${j}].monthlyEffects`);}); });
    p.actors.forEach((a,i)=>{for(const [lawId,level] of Object.entries(a.lawPreferences??{})){ref('laws',lawId,`actors[${i}].lawPreferences`);num(level,`actors[${i}].lawPreferences.${lawId}`,0,(p.laws.find(l=>l.id===lawId)?.levels.length??1)-1,true);}});
    p.variables.forEach((v,i)=>{num(v.min,`variables[${i}].min`);num(v.max,`variables[${i}].max`,v.min);num(v.initial,`variables[${i}].initial`,v.min,v.max);});
    const options = (list: GameProject['events'][number]['options'],path: string) => {
      if(!Array.isArray(list)||!list.length){error(path,'至少需要一个选项');return;}
      const seen=new Set<string>(); list.forEach((o,i)=>{if(!/^[a-z][a-z0-9_-]*$/.test(o.id)||seen.has(o.id)) error(`${path}[${i}].id`,'选项 ID 无效或重复');seen.add(o.id);if(typeof o.name!=='string'||!o.name.trim())error(`${path}[${i}].name`,'名称不能为空');cond(o.condition,`${path}[${i}].condition`);if(o.cost)cost(o.cost,`${path}[${i}].cost`);effects(o.effects,`${path}[${i}].effects`);ref('events',o.nextEventId,`${path}[${i}].nextEventId`,true);});
      if(!list.some(o=>!o.condition && (!o.cost||Object.values(o.cost).every(v=>v===0))))error(path,'需要一个无条件且无额外费用的继续或退出选项');
    };
    p.cards.forEach((c,i)=>{cond(c.condition,`cards[${i}].condition`);cost(c.cost,`cards[${i}].cost`);num(c.cooldown,`cards[${i}].cooldown`,0,10000,true);num(c.copies,`cards[${i}].copies`,1,100,true);if(!['action','government','military'].includes(c.category))error(`cards[${i}].category`,'未知卡牌分类');options(c.options,`cards[${i}].options`);});
    p.events.forEach((e,i)=>{cond(e.condition,`events[${i}].condition`);if(!['automatic','chain'].includes(e.scheduling))error(`events[${i}].scheduling`,'未知调度模式'); if(typeof e.body!=='string'||typeof e.mandatory!=='boolean'||typeof e.repeatable!=='boolean')error(`events[${i}]`,'事件正文和开关字段无效');num(e.interval,`events[${i}].interval`,1,10000,true);num(e.priority,`events[${i}].priority`);if(e.date){num(e.date.year,`events[${i}].date.year`,-9999,9999,true);num(e.date.month,`events[${i}].date.month`,1,12,true);}options(e.options,`events[${i}].options`);});
    p.advisors.forEach((a,i)=>{ref('actors',a.actorId,`advisors[${i}].actorId`);ref('factions',a.factionId,`advisors[${i}].factionId`,true);cond(a.condition,`advisors[${i}].condition`);num(a.cooldown,`advisors[${i}].cooldown`,0,10000,true);options(a.options,`advisors[${i}].options`);});
    p.journals.forEach((j,i)=>{cond(j.start,`journals[${i}].start`);cond(j.success,`journals[${i}].success`);cond(j.failure,`journals[${i}].failure`);effects(j.monthlyEffects,`journals[${i}].monthlyEffects`);effects(j.rewards,`journals[${i}].rewards`);effects(j.penalties,`journals[${i}].penalties`);});
    for(const key of ['endings','achievements'] as const)p[key].forEach((o,i)=>{cond(o.condition,`${key}[${i}].condition`);if(!o.condition)error(`${key}[${i}].condition`,'结果需要条件');num(o.priority,`${key}[${i}].priority`);});
    p.sides.forEach((s,i)=>{s.actorIds.forEach(id=>ref('actors',id,`sides[${i}].actorIds`));s.hostileTo.forEach(id=>{ref('sides',id,`sides[${i}].hostileTo`);if(id===s.id)error(`sides[${i}].hostileTo`,'不能与自身敌对');});num(s.supplies,`sides[${i}].supplies`,0);num(s.industrialCapacity,`sides[${i}].industrialCapacity`,0);if(typeof s.neutral!=='boolean')error(`sides[${i}].neutral`,'需要布尔值');});
    if(!p.sides.find(s=>s.id===p.playerSideId)?.actorIds.includes(p.playerActorId))error('playerSideId','玩家必须属于其指挥阵营');
    p.sources.forEach((s,i)=>{ref('sides',s.sideId,`sources[${i}].sideId`);ref('organizations',s.organizationId,`sources[${i}].organizationId`,true);for(const k of ['manpower','artillery','tanks'] as const)num(s[k],`sources[${i}].${k}`,0,Infinity,true);num(s.militarization,`sources[${i}].militarization`,5,100);});
    p.regions.forEach((r,i)=>{ref('sides',r.owner,`regions[${i}].owner`);num(r.x,`regions[${i}].x`);num(r.y,`regions[${i}].y`);for(const k of ['industry','strategicValue','fortification'] as const)num(r[k],`regions[${i}].${k}`,0);if(!['plains','forest','urban','mountains'].includes(r.terrain))error(`regions[${i}].terrain`,'未知地形');for(const k of ['barracks','fortress','recruitingOffice','ammoFactory'] as const)num(r.buildings[k],`regions[${i}].buildings.${k}`,0,3,true);if(new Set(r.neighbors).size!==r.neighbors.length)error(`regions[${i}].neighbors`,'邻接不能重复');r.neighbors.forEach(id=>{ref('regions',id,`regions[${i}].neighbors`);if(id===r.id)error(`regions[${i}].neighbors`,'不能邻接自身');if(!p.regions.find(v=>v.id===id)?.neighbors.includes(r.id))error(`regions[${i}].neighbors`,`${r.id} 与 ${id} 的邻接必须双向`);});r.polygons?.forEach((poly,j)=>{if(!Array.isArray(poly)||poly.length<3)error(`regions[${i}].polygons[${j}]`,'多边形至少需要三个点');poly.forEach(point=>{if(!Array.isArray(point)||point.length!==2)error(`regions[${i}].polygons`,'坐标必须是 [x,y]');point.forEach(v=>num(v,`regions[${i}].polygons`));});});});
    p.armies.forEach((a,i)=>{ref('sides',a.faction,`armies[${i}].faction`);ref('sources',a.sourceId,`armies[${i}].sourceId`);if(p.sources.find(v=>v.id===a.sourceId)?.sideId!==a.faction)error(`armies[${i}].sourceId`,'来源必须属于部队阵营');ref('regions',a.provinceId,`armies[${i}].provinceId`);for(const k of ['infantry','artillery','tanks'] as const)num(a.composition[k],`armies[${i}].composition.${k}`,0,Infinity,true);if(a.manpower!==Object.values(a.composition).reduce((sum,v)=>sum+v,0))error(`armies[${i}].manpower`,'总人数必须与编制合计一致');num(a.morale,`armies[${i}].morale`,0,100);num(a.movesLeft,`armies[${i}].movesLeft`,0,Infinity,true);});
    p.monthlyRules.forEach((r,i)=>{if(!['monthly','annual'].includes(r.timing))error(`monthlyRules[${i}].timing`,'未知结算时点');if(r.stage&&!['environment','society'].includes(r.stage))error(`monthlyRules[${i}].stage`,'未知结算阶段');cond(r.condition,`monthlyRules[${i}].condition`);effects(r.effects,`monthlyRules[${i}].effects`);});
    if(!Array.isArray(p.economicShocks))error('economicShocks','需要列表');else p.economicShocks.forEach((v,i)=>Object.entries(v).forEach(([k,n])=>num(n,`economicShocks[${i}].${k}`)));
    p.assets.forEach((a,i)=>{if(!/^data:(image\/(png|jpeg|webp|gif)|audio\/(mpeg|ogg|wav));base64,[A-Za-z0-9+/=]+$/.test(a.data)||a.data.length>16000000||!a.data.startsWith(`data:${a.mime};`))error(`assets[${i}].data`,'仅支持内嵌 PNG/JPEG/WebP/GIF 图片或 MP3/OGG/WAV 音频，单项不超过约 12 MB');});
  } catch { error('project','项目结构不完整，请补齐对象、列表与必要字段'); }
  return issues;
}
export function assertProject(input: unknown): asserts input is GameProject {
  const errors=validateProject(input).filter(i=>i.severity==='error');
  if(errors.length) throw new Error(errors.slice(0,8).map(i=>`${i.path}: ${i.message}`).join('\n'));
}
