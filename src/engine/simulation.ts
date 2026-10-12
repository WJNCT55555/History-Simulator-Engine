import type { Command, Composition, Cost, Effect, EventRef, GameProject, Option, RuntimeState } from './model';
import { assertProject } from './validation';
import { clamp, clone, discipline, evaluate, fingerprint, matches, random, support } from './expressions';
import { adjustZeroSumShare } from './shares';
import { calculateMonthlyEconomy, type EconomyBreakdown } from './economy';
import { resolveBattle } from './combat';
const sum = (c: Composition) => c.infantry + c.artillery + c.tanks;
const need = (ok: unknown,message: string): void => { if(!ok) throw new Error(message); };
const find = <T extends {id:string}>(list: readonly T[],id: string): T => { const item=list.find(v=>v.id===id); if(!item)throw new Error(`找不到定义 ${id}`);return item; };
const log = (s: RuntimeState,text: string) => {s.history.push({turn:s.turn,text});s.history=s.history.slice(-200);};
function nextUnitId(s: RuntimeState): string {let id:string;do{id=`unit-${++s.sequence}`;}while(s.armies.some(a=>a.id===id));return id;}
const permission = (p: GameProject,s: RuntimeState,kind: 'policy'|'fiscal'|'military') => p.offices.some(o=>o.permissions.includes(kind)&&s.offices[o.id]===p.playerActorId);
function pay(s: RuntimeState,c: Cost = {}): void {
  for(const [key,value] of Object.entries(c)) {
    const field=key==='ap'?'ap':key==='resources'?'resources':'armaments';
    need(Number.isFinite(value)&&value>=0, '费用无效');need(s[field]>=value,`${{ap:'行动点',resources:'组织资源',armaments:'组织军备'}[field]} 不足：需要 ${value}，现有 ${s[field]}`);s[field]-=value;
  }
}
export function definition(p: GameProject,ref: EventRef): {name: string; description?: string; body?: string; options: Option[]; assetId?: string} {
  return ref.kind==='event'?find(p.events,ref.id):ref.kind==='card'?find(p.cards,ref.id):find(p.advisors,ref.id);
}
function enqueue(s: RuntimeState,id: string): void {
  if(s.currentEvent?.kind==='event'&&s.currentEvent.id===id || s.pendingEvents.some(e=>e.kind==='event'&&e.id===id))return;
  need(s.pendingEvents.length<1000,'事件队列超出容量');s.pendingEvents.push({kind:'event',id});
}
function openNext(s: RuntimeState): void {
  if(s.currentEvent||!s.pendingEvents.length)return;
  s.currentEvent=s.pendingEvents.shift()!;
  if(s.currentEvent.kind==='event') s.eventHistory[s.currentEvent.id]={triggered:s.turn};
}
export function applyEffects(p: GameProject,s: RuntimeState,effects: Effect[]): void {
  for(const effect of effects) {
    const delta='delta' in effect?evaluate(p,s,effect.delta):0;
    switch(effect.type) {
      case 'resource': s[effect.key]+=delta; need(s[effect.key]>=0,`${effect.key} 不足`);break;
      case 'economy': s.economy[effect.key]+=delta;break;
      case 'support': s.support[effect.groupId]=adjustZeroSumShare(s.support[effect.groupId],effect.actorId,delta);break;
      case 'influence': {
        const owner=find(p.factions,effect.factionId).actorId;
        const shares=Object.fromEntries(p.factions.filter(f=>f.actorId===owner).map(f=>[f.id,s.factions[f.id].influence]));
        const next=adjustZeroSumShare(shares,effect.factionId,delta);for(const id of Object.keys(next))s.factions[id].influence=next[id];break;
      }
      case 'dissent': s.factions[effect.factionId].dissent=clamp(s.factions[effect.factionId].dissent+delta);break;
      case 'coverage': need(s.founded.includes(effect.organizationId),'组织尚未成立');s.coverage=adjustZeroSumShare(s.coverage,effect.organizationId,delta);break;
      case 'ownership': s.ownership[effect.sectorId]=adjustZeroSumShare(s.ownership[effect.sectorId],effect.ownerId,delta);break;
      case 'variable': {const v=find(p.variables,effect.variableId);s.variables[v.id]=clamp((effect.mode==='add'?s.variables[v.id]:0)+evaluate(p,s,effect.value),v.min,v.max);break;}
      case 'relation': s.relations[effect.actorId]=clamp(s.relations[effect.actorId]+delta);break;
      case 'law': s.laws[effect.lawId]=effect.level;break;
      case 'office': s.offices[effect.officeId]=effect.actorId;break;
      case 'found': if(!s.founded.includes(effect.organizationId))s.founded.push(effect.organizationId);break;
      case 'event': enqueue(s,effect.eventId);break;
      case 'war': if(effect.active&&!s.warActive) {s.aiCompletedTurn=-1;for(const pool of Object.values(s.sideResources))pool.commandPoints=p.rules.commandPoints;for(const army of s.armies)army.movesLeft=p.rules.movesPerTurn;}s.warActive=effect.active;break;
      case 'region': s.regions[effect.regionId].owner=effect.sideId;break;
      case 'militarization': s.militarization[effect.sourceId]=clamp(s.militarization[effect.sourceId]+delta,5,100);break;
      case 'realign': s.sourceSides[effect.sourceId]=effect.sideId;for(const unit of s.armies)if(unit.sourceId===effect.sourceId)unit.faction=effect.sideId;break;
      case 'pool': {const next=s.sources[effect.sourceId][effect.key as 'manpower'|'artillery'|'tanks']+delta;need(Number.isInteger(next)&&next>=0,'兵源或装备不足，或数量不是整数');s.sources[effect.sourceId][effect.key as 'manpower'|'artillery'|'tanks']=next;break;}
    }
  }
}
function scanEvents(p: GameProject,s: RuntimeState): void {
  const roots=p.events.filter(e=>e.scheduling==='automatic').sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id));
  for(const event of roots) {
    const history=s.eventHistory[event.id];
    if(history&&(!event.repeatable||s.turn-history.triggered<event.interval))continue;
    if(event.date&&(event.date.year!==s.year||event.date.month!==s.month))continue;
    if(matches(p,s,event.condition))enqueue(s,event.id);
  }
  openNext(s);
}
function post(p: GameProject,s: RuntimeState): void {
  s.economy.unemployment_rate=clamp(s.economy.unemployment_rate);s.economy.military_spending=clamp(s.economy.military_spending);s.economy.armyLoyalty=clamp(s.economy.armyLoyalty);
  for(const key of ['budget','public_debt','fiscal_arrears','gold_reserves','foreign_exchange','economic_output_index'] as const)s.economy[key]=Math.max(0,s.economy[key]);
  for(const journal of p.journals) {
    if(s.journals[journal.id]==='inactive'&&matches(p,s,journal.start)){s.journals[journal.id]='active';log(s,`目标启动：${journal.name}`);}
    if(s.journals[journal.id]!=='active')continue;
    if(journal.failure&&matches(p,s,journal.failure)){s.journals[journal.id]='failed';applyEffects(p,s,journal.penalties);log(s,`目标失败：${journal.name}`);}
    else if(matches(p,s,journal.success)){s.journals[journal.id]='completed';applyEffects(p,s,journal.rewards);log(s,`目标完成：${journal.name}`);}
  }
  for(const achievement of p.achievements)if(!s.achievements.includes(achievement.id)&&matches(p,s,achievement.condition)){s.achievements.push(achievement.id);log(s,`成就：${achievement.name}`);}
  if(!s.ending){const ending=[...p.endings].sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id)).find(e=>matches(p,s,e.condition));if(ending){s.ending=ending.id;log(s,`结局：${ending.name}`);}}
  openNext(s);
}
export function elect(p: GameProject,s: RuntimeState): void {
  const votes=p.actors.filter(a=>a.eligible).map(a=>({id:a.id,votes:support(p,s,a.id)*a.turnout/100}));
  const total=votes.reduce((sum,v)=>sum+v.votes,0);
  s.seats=Object.fromEntries(p.actors.map(a=>[a.id,0]));
  if(total<=0){log(s,'选举没有有效票，议席暂缺。');return;}
  const shares=votes.map(v=>({...v,exact:v.votes/total*p.rules.seats}));
  for(const v of shares)s.seats[v.id]=Math.floor(v.exact);
  const remainder=p.rules.seats-Object.values(s.seats).reduce((a,b)=>a+b,0);
  shares.sort((a,b)=>(b.exact-Math.floor(b.exact))-(a.exact-Math.floor(a.exact))||a.id.localeCompare(b.id));
  for(let i=0;i<remainder;i++)s.seats[shares[i].id]++;
  if(s.government.length&&s.government.reduce((sum,id)=>sum+s.seats[id],0)<=p.rules.seats/2){const old=new Set(s.government);s.government=[];for(const id of Object.keys(s.offices))if(old.has(s.offices[id]))s.offices[id]='';log(s,'原政府失去议会多数，职位等待重新分配。');}
  log(s,`选举完成：${p.rules.seats} 席已分配。`);
}
function canPlay(p: GameProject,s: RuntimeState,id: string): void {
  const card=find(p.cards,id);need(s.phase==='action'&&!s.currentEvent,'需要行动阶段且没有待决策事项');need(s.hand.includes(id),'卡牌不在手牌中');need(!(s.cooldowns[`card:${id}`]>0),'卡牌仍在冷却');need(matches(p,s,card.condition),'卡牌条件不满足');
  if(card.category==='government')need(permission(p,s,'policy')||permission(p,s,'fiscal'),'需要政府职位权限');
  if(card.category==='military')need(s.warActive,'军事卡牌需要战争进行中');
}
function draw(p: GameProject,s: RuntimeState): void {
  need(s.hand.length<p.rules.handSize,'手牌已满');
  const eligible=(id:string)=>{const c=find(p.cards,id);return matches(p,s,c.condition)&&!(s.cooldowns[`card:${id}`]>0)&&(c.category!=='government'||permission(p,s,'policy')||permission(p,s,'fiscal'))&&(c.category!=='military'||s.warActive);};
  let index=s.deck.findIndex(eligible);
  if(index<0&&s.discard.length){s.deck.push(...s.discard);s.discard=[];shuffle(s);index=s.deck.findIndex(eligible);}
  if(index>=0)s.hand.push(s.deck.splice(index,1)[0]);
}
function shuffle(s: RuntimeState): void {for(let i=s.deck.length-1;i>0;i--){const j=Math.floor(random(s)*(i+1));[s.deck[i],s.deck[j]]=[s.deck[j],s.deck[i]];}}
export function createState(project: GameProject): RuntimeState {
  assertProject(project);const p=project;
  const s: RuntimeState={turn:0,year:p.start.year,month:p.start.month,phase:'event',rng:p.seed,resources:p.initial.resources,armaments:p.initial.armaments,ap:p.rules.apPerTurn,warActive:p.initial.warActive,economy:clone(p.initial.economy),
    support:Object.fromEntries(p.groups.map(g=>[g.id,clone(g.support)])),factions:Object.fromEntries(p.factions.map(f=>[f.id,{influence:f.influence,dissent:f.dissent}])),
    coverage:{...Object.fromEntries(p.organizations.map(o=>[o.id,o.share])),unorganized:100-p.organizations.reduce((sum,o)=>sum+o.share,0)},founded:p.organizations.filter(o=>o.active).map(o=>o.id),ownership:Object.fromEntries(p.ownership.map(o=>[o.id,clone(o.shares)])),
    relations:Object.fromEntries(p.actors.map(a=>[a.id,a.relation])),seats:{},government:[...new Set(p.offices.map(o=>o.holderId))],offices:Object.fromEntries(p.offices.map(o=>[o.id,o.holderId])),laws:Object.fromEntries(p.laws.map(l=>[l.id,l.initialLevel])),variables:Object.fromEntries(p.variables.map(v=>[v.id,v.initial])),
    deck:p.cards.flatMap(c=>Array(c.copies).fill(c.id) as string[]),hand:[],discard:[],cooldowns:{},advisors:[],currentEvent:null,pendingEvents:[],eventHistory:{},journals:Object.fromEntries(p.journals.map(j=>[j.id,'inactive'])),achievements:[],ending:null,
    regions:Object.fromEntries(p.regions.map(r=>[r.id,{owner:r.owner,buildings:clone(r.buildings)}])),armies:clone(p.armies).map(a=>({...a,identity:a.sourceId})),militarization:Object.fromEntries(p.sources.map(v=>[v.id,v.militarization])),sourceSides:Object.fromEntries(p.sources.map(v=>[v.id,v.sideId])),sources:Object.fromEntries(p.sources.map(s=>[s.id,{manpower:s.manpower,artillery:s.artillery,tanks:s.tanks}])),
    sideResources:Object.fromEntries(p.sides.map(s=>[s.id,{supplies:s.supplies,industrialCapacity:s.industrialCapacity,commandPoints:p.rules.commandPoints}])),casualties:Object.fromEntries(p.sources.map(s=>[s.id,0])),aiCompletedTurn:-1,sequence:0,history:[],economyHistory:[]};
  shuffle(s);elect(p,s);post(p,s);scanEvents(p,s);assertRuntime(p,s);return s;
}
export function economicPreview(p: GameProject,s: RuntimeState): EconomyBreakdown {
  const levels=p.laws.map(l=>l.levels[s.laws[l.id]]);
  const modifiers={growthGraph:0,inflationGraph:0,unemployment:0,foreignExchangeGraph:0};
  for(const level of levels){modifiers.growthGraph+=level.modifiers.growth??0;modifiers.inflationGraph+=level.modifiers.inflation??0;modifiers.unemployment+=level.modifiers.unemployment??0;modifiers.foreignExchangeGraph+=level.modifiers.foreignExchange??0;}
  return calculateMonthlyEconomy({...s.economy,warActive:s.warActive,policyCost:levels.reduce((sum,l)=>sum+l.upkeep,0),modifiers,impulse:p.economicShocks.find(v=>v.year===s.year),profile:p.rules.economicProfile});
}
function monthly(p: GameProject,s: RuntimeState): void {
  // Income sees the old coverage snapshot; national accounting sees the new date.
  for(const org of p.organizations)if(org.actorId===p.playerActorId&&s.founded.includes(org.id))s.resources+=Math.floor(org.income*s.coverage[org.id]/100*discipline(p,s,org.actorId));
  s.turn++;s.month++;if(s.month>12){s.month=1;s.year++;}
  s.discard.push(...s.hand);s.hand=[];s.ap=p.rules.apPerTurn;
  if(s.warActive)for(const side of p.sides.filter(v=>!v.neutral)){
    const owned=p.regions.filter(r=>s.regions[r.id].owner===side.id);
    const resource=s.sideResources[side.id];resource.supplies+=p.rules.baseSupplies+owned.reduce((sum,r)=>sum+r.industry*2+s.regions[r.id].buildings.ammoFactory*500,0);
    resource.industrialCapacity=Math.min(250,resource.industrialCapacity+(50+owned.reduce((sum,r)=>sum+r.industry,0))*0.2);
    const national=p.sources.find(v=>s.sourceSides[v.id]===side.id&&!v.organizationId);if(national)s.sources[national.id].manpower+=500+owned.reduce((sum,r)=>sum+s.regions[r.id].buildings.recruitingOffice*1500,0);
    resource.commandPoints=p.rules.commandPoints;
  }
  for(const army of s.armies)army.movesLeft=p.rules.movesPerTurn;
  // Annual/monthly environment rules execute once before accounting.
  for(const rule of p.monthlyRules)if(rule.stage==='environment'&&(rule.timing==='monthly'||s.month===1)&&matches(p,s,rule.condition))applyEffects(p,s,rule.effects);
  const economy=economicPreview(p,s);
  Object.assign(s.economy,{budget:economy.nextBudget,public_debt:economy.nextDebt,fiscal_arrears:economy.nextFiscalArrears,foreign_exchange:economy.nextForeignExchange,armyLoyalty:economy.nextArmyLoyalty,economy_growth:economy.nextGrowth,inflation_rate:economy.nextInflation,unemployment_rate:economy.nextUnemployment,economic_output_index:economy.nextEconomicOutputIndex});
  s.economy.gold_reserves=Math.max(0,s.economy.gold_reserves+(p.economicShocks.find(v=>v.year===s.year)?.goldMonthly??0));
  s.economyHistory.push({turn:s.turn,growth:s.economy.economy_growth,inflation:s.economy.inflation_rate,unemployment:s.economy.unemployment_rate});s.economyHistory=s.economyHistory.slice(-120);
  for(const law of p.laws)applyEffects(p,s,law.levels[s.laws[law.id]].monthlyEffects);
  for(const rule of p.monthlyRules)if(rule.stage!=='environment'&&(rule.timing==='monthly'||s.month===1)&&matches(p,s,rule.condition))applyEffects(p,s,rule.effects);
  for(const org of p.organizations)if(s.founded.includes(org.id))applyEffects(p,s,org.monthlyEffects);
  for(const journal of p.journals)if(s.journals[journal.id]==='active')applyEffects(p,s,journal.monthlyEffects);
  if(p.rules.electionEvery>0&&s.turn%p.rules.electionEvery===0&&!s.warActive)elect(p,s);
  if(s.government.some(id=>id!==p.playerActorId&&s.relations[id]<p.rules.coalitionRelation)){const old=new Set(s.government);s.government=[];for(const id of Object.keys(s.offices))if(old.has(s.offices[id]))s.offices[id]='';log(s,'联盟关系不足，政府解散。');}
  for(const id of Object.keys(s.cooldowns))s.cooldowns[id]=Math.max(0,s.cooldowns[id]-1);
  s.phase='event';post(p,s);scanEvents(p,s);log(s,`月结完成：${s.year} 年 ${s.month} 月，财政结余 ${economy.budgetDelta.toFixed(2)}。`);
}
function hostile(p: GameProject,a: string,b: string): boolean {const left=find(p.sides,a),right=find(p.sides,b);return !left.neutral&&!right.neutral&&(left.hostileTo.includes(b)||right.hostileTo.includes(a));}
function move(p: GameProject,s: RuntimeState,armyId: string,regionId: string,sideId: string): void {
  find(p.regions,regionId);const army=find(s.armies,armyId),from=find(p.regions,army.provinceId);
  need(army.faction===sideId,'无法指挥其他阵营的部队');need(from.neighbors.includes(regionId),'目标不相邻');need(army.movesLeft>0&&s.sideResources[sideId].commandPoints>0,'移动点或指挥点不足');
  const owner=s.regions[regionId].owner;need(owner===sideId||hostile(p,sideId,owner),'目标是中立或友好地区');
  s.sideResources[sideId].commandPoints--;
  if(owner===sideId){army.provinceId=regionId;army.movesLeft--;return;}
  const before=Object.fromEntries(p.sources.map(source=>[source.id,s.armies.filter(a=>a.sourceId===source.id).reduce((sum,a)=>sum+a.manpower,0)]));
  const regions=Object.fromEntries(p.regions.map(r=>[r.id,{...r,...s.regions[r.id]}]));
  const result=resolveBattle(s.armies,regions,army,regionId,true,s.militarization,()=>random(s),Object.fromEntries(p.regions.map(r=>[r.id,r.neighbors])),p.rules.combatWidths,p.rules.destructionThreshold);
  s.armies=result.updatedArmies;
  for(const [id,region] of Object.entries(result.updatedRegions))s.regions[id].owner=region.owner;
  for(const source of p.sources)s.casualties[source.id]+=Math.max(0,before[source.id]-s.armies.filter(a=>a.sourceId===source.id).reduce((sum,a)=>sum+a.manpower,0));
  result.messages.forEach(message=>log(s,message));
}
function ai(p: GameProject,s: RuntimeState): void {
  if(s.aiCompletedTurn===s.turn)return;
  for(const side of p.sides.filter(v=>v.id!==p.playerSideId&&!v.neutral))for(const unit of [...s.armies].filter(a=>a.faction===side.id)){
    const current=s.armies.find(a=>a.id===unit.id);if(!current||!current.movesLeft||s.sideResources[side.id].commandPoints<=0)continue;
    const candidates=find(p.regions,current.provinceId).neighbors.map(id=>find(p.regions,id)).filter(r=>hostile(p,side.id,s.regions[r.id].owner)).sort((a,b)=>(b.strategicValue+b.industry)-(a.strategicValue+a.industry)||a.id.localeCompare(b.id));
    if(candidates[0])move(p,s,current.id,candidates[0].id,side.id);
  }
  s.aiCompletedTurn=s.turn;log(s,'其他阵营指挥已结算。');
}
function acquire(p: GameProject,s: RuntimeState,sourceId: string,regionId: string,c: Composition): void {
  const source=find(p.sources,sourceId);need(s.sourceSides[source.id]===p.playerSideId,'兵源不属于玩家阵营');need(!source.organizationId||s.founded.includes(source.organizationId),'来源组织未成立');need(s.regions[regionId]?.owner===p.playerSideId,'需要己方地区');
  for(const n of Object.values(c))need(Number.isInteger(n)&&n>=0,'编制需要非负整数');need(sum(c)>0,'编制不能为空');
  const pool=s.sources[sourceId];need(pool.manpower>=sum(c)&&pool.artillery>=c.artillery&&pool.tanks>=c.tanks,'兵源或装备不足');
  const cost=Math.ceil(sum(c)/1000*p.rules.recruitmentCostPerThousand);need(s.sideResources[p.playerSideId].supplies>=cost,'补给不足');
  pool.manpower-=sum(c);pool.artillery-=c.artillery;pool.tanks-=c.tanks;s.sideResources[p.playerSideId].supplies-=cost;
}
function handle(p: GameProject,s: RuntimeState,command: Command): void {
  need(!s.ending,'游戏已结束');
  if(command.type==='next'){
    need(!s.currentEvent&&!s.pendingEvents.length,'请先处理待决策事项');
    if(s.phase==='event'){s.phase='action';s.ap=p.rules.apPerTurn;for(let i=s.hand.length;i<p.rules.handSize;i++)draw(p,s);}
    else if(s.phase==='action'&&s.warActive)s.phase='war';
    else {if(s.phase==='war')ai(p,s);monthly(p,s);}return;
  }
  if(command.type==='skipEvent'){need(s.currentEvent?.kind==='event','只有普通事件可以跳过');const event=find(p.events,s.currentEvent!.id);need(!event.mandatory,'强制事件不能跳过');s.eventHistory[event.id].resolved=s.turn;s.currentEvent=null;openNext(s);return;}
  if(command.type==='choose'){
    need(s.currentEvent,'没有正在处理的决策');const ref=s.currentEvent!;const option=find(definition(p,ref).options,command.optionId);need(matches(p,s,option.condition),'选项条件不满足');pay(s,option.cost);s.currentEvent=null;
    if(ref.kind==='event')s.eventHistory[ref.id].resolved=s.turn;
    applyEffects(p,s,option.effects);log(s,`选择：${option.name}`);
    if(option.nextEventId){s.currentEvent={kind:'event',id:option.nextEventId};s.eventHistory[option.nextEventId]={triggered:s.turn};}else openNext(s);return;
  }
  need(!s.currentEvent&&!s.pendingEvents.length,'请先处理待决策事项');
  if(command.type==='play'){canPlay(p,s,command.id);const card=find(p.cards,command.id);pay(s,card.cost);s.hand.splice(s.hand.indexOf(card.id),1);s.discard.push(card.id);s.cooldowns[`card:${card.id}`]=card.cooldown;s.currentEvent={kind:'card',id:card.id};return;}
  if(command.type==='draw'){need(s.phase==='action','需要行动阶段');draw(p,s);return;}
  if(command.type==='appointAdvisor'){const a=find(p.advisors,command.id);need(a.actorId===p.playerActorId&&matches(p,s,a.condition),'顾问不可任命');need(!s.advisors.includes(a.id)&&s.advisors.length<p.rules.advisorSlots,'已任命或槽位已满');s.advisors.push(a.id);return;}
  if(command.type==='removeAdvisor'){s.advisors=s.advisors.filter(id=>id!==command.id);return;}
  if(command.type==='advisor'){const a=find(p.advisors,command.id);need(s.phase==='action'&&s.advisors.includes(a.id)&&matches(p,s,a.condition),'需要行动阶段及已任命顾问');need(!(s.cooldowns[`advisor:${a.id}`]>0),'顾问仍在冷却');pay(s,{ap:1});s.cooldowns[`advisor:${a.id}`]=a.cooldown;s.currentEvent={kind:'advisor',id:a.id};return;}
  if(command.type==='government'){need(s.phase==='action'&&!s.warActive,'需要和平行动阶段');const members=[...new Set(command.actors)];need(members.includes(p.playerActorId),'玩家必须加入联盟');for(const id of members){need(find(p.actors,id).eligible&&s.seats[id]>0,'联盟成员需要有效议席');if(id!==p.playerActorId)need(s.relations[id]>=p.rules.coalitionRelation,'党际关系不足');}need(members.reduce((sum,id)=>sum+s.seats[id],0)>p.rules.seats/2,'联盟需要过半议席');pay(s,{ap:1});s.government=members;for(const office of p.offices)s.offices[office.id]=p.playerActorId;log(s,'多数联盟组成政府，玩家取得行政职位。');return;}
  if(command.type==='policy'){const law=find(p.laws,command.lawId);need(s.phase==='action'&&s.offices[law.officeId]===p.playerActorId,'需要行动阶段及对应职位');need(Number.isInteger(command.level)&&command.level>=0&&command.level<law.levels.length,'无效法律等级');need(s.laws[law.id]!==command.level,'政策等级未改变');pay(s,{ap:1,resources:law.levels[command.level].cost});s.laws[law.id]=command.level;log(s,`政策生效：${law.name} / ${law.levels[command.level].name}`);return;}
  if(command.type==='taxes'){need(s.phase==='action'&&permission(p,s,'fiscal'),'需要行动阶段及财政权限');for(const n of Object.values(command.rates))need(Number.isFinite(n)&&n>=0&&n<=100,'税率范围为 0～100');need(Object.keys(command.rates).length===5&&['tax_lower_class','tax_middle_class','tax_upper_class','tax_tariff','tax_consumption'].every(k=>k in command.rates),'需要完整五项税率');pay(s,{ap:1});Object.assign(s.economy,command.rates);log(s,'税收草案已提交。');return;}
  need(s.phase==='war'&&s.warActive,'需要战争阶段');
  if(command.type==='move'){move(p,s,command.armyId,command.regionId,p.playerSideId);return;}
  if(command.type==='recruit'){find(p.regions,command.regionId);acquire(p,s,command.sourceId,command.regionId,command.composition);const count=sum(command.composition);s.armies.push({id:nextUnitId(s),name:`新编部队 ${s.sequence}`,faction:p.playerSideId,identity:command.sourceId,sourceId:command.sourceId,provinceId:command.regionId,composition:clone(command.composition),manpower:count,morale:60,movesLeft:0});return;}
  if(command.type==='build'){need(s.regions[command.regionId]?.owner===p.playerSideId,'需要己方地区');need(['barracks','fortress','recruitingOffice','ammoFactory'].includes(command.building),'未知建筑');const buildings=s.regions[command.regionId].buildings;need(buildings[command.building]<3,'建筑已达到等级上限');need(s.sideResources[p.playerSideId].industrialCapacity>=p.rules.buildingCost,'工业点不足');s.sideResources[p.playerSideId].industrialCapacity-=p.rules.buildingCost;buildings[command.building]++;return;}
  if(command.type==='merge'){need(command.armyIds.length>=2&&new Set(command.armyIds).size===command.armyIds.length,'至少选择两支不同部队');const units=command.armyIds.map(id=>find(s.armies,id));const first=units[0];need(units.every(a=>a.faction===p.playerSideId&&a.provinceId===first.provinceId&&a.sourceId===first.sourceId),'只能合并同地区、同来源的己方部队');const total=units.reduce((sum,a)=>sum+a.manpower,0);first.morale=units.reduce((sum,a)=>sum+a.morale*a.manpower,0)/total;first.movesLeft=Math.min(...units.map(a=>a.movesLeft));first.composition={infantry:units.reduce((sum,a)=>sum+a.composition.infantry,0),artillery:units.reduce((sum,a)=>sum+a.composition.artillery,0),tanks:units.reduce((sum,a)=>sum+a.composition.tanks,0)};first.manpower=total;s.armies=s.armies.filter(a=>!command.armyIds.includes(a.id)||a.id===first.id);return;}
  const army=find(s.armies,command.armyId);need(army.faction===p.playerSideId,'无法操作其他阵营部队');
  if(command.type==='reinforce'){acquire(p,s,army.sourceId,army.provinceId,command.composition);for(const k of ['infantry','artillery','tanks'] as const)army.composition[k]+=command.composition[k];army.manpower=sum(army.composition);return;}
  if(command.type==='disband'){const source=s.sources[army.sourceId];source.manpower+=army.manpower;source.artillery+=army.composition.artillery;source.tanks+=army.composition.tanks;s.armies=s.armies.filter(a=>a.id!==army.id);return;}
  if(command.type==='split'){need(army.manpower>=2,'人数不足以拆分');const part={infantry:Math.floor(army.composition.infantry/2),artillery:Math.floor(army.composition.artillery/2),tanks:Math.floor(army.composition.tanks/2)};need(sum(part)>0,'可拆分人数不足');for(const k of ['infantry','artillery','tanks'] as const)army.composition[k]-=part[k];army.manpower=sum(army.composition);s.armies.push({...clone(army),id:nextUnitId(s),name:`${army.name} · 分队`,composition:part,manpower:sum(part)});return;}
  throw new Error('未知命令');
}
export type CommandResult = { ok: true; state: RuntimeState } | { ok: false; state: RuntimeState; error: string };
export function execute(p: GameProject,state: RuntimeState,command: Command): CommandResult {
  try {const next=clone(state);handle(p,next,command);post(p,next);assertRuntime(p,next);return {ok:true,state:next};}
  catch(error){return {ok:false,state,error:error instanceof Error?error.message:String(error)};}
}
export function previewOption(p: GameProject,state: RuntimeState,option: Option): {changes:string[];error?:string} {
  try {const next=clone(state);pay(next,option.cost);applyEffects(p,next,option.effects);const changes:string[]=[];
    const diff=(a:unknown,b:unknown,path:string)=>{if(typeof a==='number'&&typeof b==='number'&&Math.abs(a-b)>0.00001)changes.push(`${path}: ${a.toFixed(2)} → ${b.toFixed(2)}`);else if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a))for(const key of Object.keys(a))diff((a as Record<string,unknown>)[key],(b as Record<string,unknown>)[key],path?`${path}.${key}`:key);};
    diff(state,next,'');return {changes};
  } catch(error){return {changes:[],error:String(error)};}
}
export function assertRuntime(p: GameProject,s: RuntimeState): void {
  need(s&&typeof s==='object','存档状态缺失');
  for(const key of ['turn','year','month','phase','rng','resources','armaments','ap','warActive','economy','support','factions','coverage','founded','ownership','relations','seats','government','offices','laws','variables','deck','hand','discard','cooldowns','advisors','currentEvent','pendingEvents','eventHistory','journals','achievements','ending','regions','armies','sources','militarization','sourceSides','sideResources','casualties','aiCompletedTurn','sequence','history','economyHistory'])need(key in s,`存档缺少 ${key}`);
  for(const key of Object.keys(p.initial.economy))need(typeof s.economy[key as keyof typeof s.economy]==='number','经济状态不完整');
  for(const key of ['founded','government','deck','hand','discard','advisors','pendingEvents','achievements','armies','history','economyHistory'] as const)need(Array.isArray(s[key]),`存档 ${key} 必须是列表`);

  const finite=(v:unknown)=>{if(typeof v==='number')need(Number.isFinite(v),'状态包含非有限数值');else if(v&&typeof v==='object')Object.values(v).forEach(finite);};finite(s);
  need(Number.isInteger(s.turn)&&s.turn>=0&&Number.isInteger(s.year)&&Number.isInteger(s.month)&&s.month>=1&&s.month<=12,'无效日期');need(['event','action','war'].includes(s.phase),'无效阶段');need(typeof s.warActive==='boolean','无效战争状态');need(s.resources>=0&&s.armaments>=0&&s.ap>=0,'资源不能为负');
  const distribution=(values:Record<string,number>)=>need(values&&Object.values(values).every(v=>typeof v==='number'&&v>=0)&&Math.abs(Object.values(values).reduce((sum,v)=>sum+v,0)-100)<0.001,'份额不守恒');
  for(const g of p.groups){distribution(s.support[g.id]);need(p.actors.every(a=>a.id in s.support[g.id]),'支持矩阵缺主体');}
  for(const a of p.actors){const fs=p.factions.filter(f=>f.actorId===a.id);if(fs.length)distribution(Object.fromEntries(fs.map(f=>[f.id,s.factions[f.id].influence])));need(typeof s.seats[a.id]==='number'&&s.seats[a.id]>=0&&typeof s.relations[a.id]==='number','政治状态不完整');}
  for(const f of p.factions)need(s.factions[f.id].dissent>=0&&s.factions[f.id].dissent<=100,'异议超出范围');
  distribution(s.coverage);for(const o of p.ownership)distribution(s.ownership[o.id]);
  for(const v of p.variables)need(s.variables[v.id]>=v.min&&s.variables[v.id]<=v.max,'变量超出范围');
  for(const l of p.laws)need(Number.isInteger(s.laws[l.id])&&Boolean(l.levels[s.laws[l.id]]),'法律等级缺失');
  for(const o of p.offices)need(s.offices[o.id]===''||p.actors.some(a=>a.id===s.offices[o.id]),'职位归属无效');
  for(const r of p.regions)need(p.sides.some(side=>side.id===s.regions[r.id].owner)&&Object.values(s.regions[r.id].buildings).every(v=>Number.isInteger(v)&&v>=0&&v<=3),'地区状态无效');
  for(const source of p.sources){need(p.sides.some(side=>side.id===s.sourceSides[source.id]),'兵源阵营归属无效');need(s.militarization[source.id]>=5&&s.militarization[source.id]<=100,'军事组织化率超界');need(Object.values(s.sources[source.id]).every(n=>Number.isInteger(n)&&n>=0),'兵源装备为负或非整数');need(s.casualties[source.id]>=0,'伤亡账缺失');}
  for(const side of p.sides)need(Object.values(s.sideResources[side.id]).every(v=>v>=0),'阵营资源为负');
  const ids=new Set<string>();for(const a of s.armies){need(!ids.has(a.id),'部队 ID 重复');ids.add(a.id);need(s.sourceSides[a.sourceId]===a.faction&&a.identity===a.sourceId,'部队来源不匹配');find(p.regions,a.provinceId);need(a.manpower===sum(a.composition)&&Object.values(a.composition).every(n=>Number.isInteger(n)&&n>=0),'编制与人数不一致');need(a.morale>=0&&a.morale<=100&&a.movesLeft>=0,'部队状态无效');}
  for(const id of [...s.hand,...s.deck,...s.discard])find(p.cards,id);for(const id of s.advisors)find(p.advisors,id);for(const id of s.founded)find(p.organizations,id);for(const id of s.achievements)find(p.achievements,id);for(const id of s.government)find(p.actors,id);
  for(const j of p.journals)need(['inactive','active','completed','failed'].includes(s.journals[j.id]),'日志状态无效');
  for(const ref of [...s.pendingEvents,...(s.currentEvent?[s.currentEvent]:[])]){need(['event','card','advisor'].includes(ref.kind),'决策类型无效');definition(p,ref);}
  need(typeof s.rng==='number'&&Number.isInteger(s.rng)&&s.rng>=0&&s.rng<=4294967295,'随机状态无效');need(Array.isArray(s.history)&&Array.isArray(s.economyHistory)&&s.cooldowns&&s.eventHistory,'运行状态不完整');if(s.ending)find(p.endings,s.ending);
}
export interface GameSave {format:'history-simulator';schemaVersion:1;projectId:string;contentVersion:string;fingerprint:string;state:RuntimeState}
export function saveGame(p:GameProject,s:RuntimeState):GameSave {assertRuntime(p,s);return {format:'history-simulator',schemaVersion:1,projectId:p.id,contentVersion:p.version,fingerprint:fingerprint(p),state:clone(s)};}
export function loadGame(p:GameProject,input:unknown):RuntimeState {
  const save=input as GameSave;need(save?.format==='history-simulator'&&save.schemaVersion===1,'存档格式不支持');need(save.projectId===p.id&&save.contentVersion===p.version&&save.fingerprint===fingerprint(p),'存档与当前项目版本不一致');assertRuntime(p,save.state);return clone(save.state);
}
