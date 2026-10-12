import type { GameProject } from '../engine/model';
import { collections } from '../engine/model';

const labels:Record<string,string>={support:'支持',factions:'派系',influence:'影响力',dissent:'异议',coverage:'组织覆盖',unorganized:'未组织',ownership:'所有权',variables:'进度',relations:'关系',laws:'法律',offices:'职位',regions:'地区',sources:'后备',militarization:'军事组织化率',sourceSides:'所属阵营',resources:'组织资源',armaments:'组织军备',ap:'行动点',economy:'经济',budget:'国家现金',public_debt:'公共债务',fiscal_arrears:'拖欠',gold_reserves:'黄金储备',foreign_exchange:'外汇储备',economy_growth:'增长率',inflation_rate:'通胀率',unemployment_rate:'失业率',economic_output_index:'产出指数',military_spending:'军事支出',armyLoyalty:'军队忠诚',warActive:'战争状态',manpower:'人数',artillery:'支援装备',tanks:'机动装备',private:'私人',cooperative:'合作组织',state:'国家'};
export function describeChange(p:GameProject,change:string):string {
  const separator=change.indexOf(': ');if(separator<0)return change;
  const path=change.slice(0,separator).split('.');
  const names=new Map(collections.flatMap(key=>p[key].map(item=>[item.id,item.name] as const)));
  return `${path.map(token=>names.get(token)??labels[token]??token).join(' · ')}${change.slice(separator)}`;
}
