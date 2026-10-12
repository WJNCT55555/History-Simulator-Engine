/** Serializable contracts shared by the engine, authoring studio and exported games. */
export type Id = string;
export type Expression = number | { metric: string } | { op: 'add' | 'sub' | 'mul' | 'div' | 'min' | 'max'; args: Expression[] };
export type Condition = { all: Condition[] } | { any: Condition[] } | { not: Condition } | {
  metric: string; op: 'gte' | 'lte' | 'gt' | 'lt' | 'eq' | 'neq'; value: Expression;
};
export interface Named { id: Id; name: string; description?: string; assetId?: Id }
export interface Cost { ap?: number; resources?: number; armaments?: number }
export type EconomyKey = 'budget' | 'public_debt' | 'fiscal_arrears' | 'gold_reserves' | 'foreign_exchange' | 'economy_growth' | 'inflation_rate' | 'unemployment_rate' | 'economic_output_index' | 'military_spending';
export type Effect =
  | { type: 'resource'; key: 'resources' | 'armaments'; delta: Expression }
  | { type: 'economy'; key: EconomyKey; delta: Expression }
  | { type: 'support'; groupId: Id; actorId: Id; delta: Expression }
  | { type: 'influence' | 'dissent'; factionId: Id; delta: Expression }
  | { type: 'coverage'; organizationId: Id; delta: Expression }
  | { type: 'ownership'; sectorId: Id; ownerId: Id; delta: Expression }
  | { type: 'variable'; variableId: Id; mode: 'add' | 'set'; value: Expression }
  | { type: 'relation'; actorId: Id; delta: Expression }
  | { type: 'law'; lawId: Id; level: number }
  | { type: 'office'; officeId: Id; actorId: Id }
  | { type: 'found'; organizationId: Id }
  | { type: 'event'; eventId: Id }
  | { type: 'war'; active: boolean }
  | { type: 'region'; regionId: Id; sideId: Id }
  | { type: 'militarization'; sourceId: Id; delta: Expression }
  | { type: 'realign'; sourceId: Id; sideId: Id }
  | { type: 'pool'; sourceId: Id; key: 'artillery' | 'tanks' | 'manpower'; delta: Expression };
export interface Option extends Named { condition?: Condition; cost?: Cost; effects: Effect[]; nextEventId?: Id }
export interface Actor extends Named { color: string; eligible: boolean; turnout: number; relation: number; lawPreferences?: Record<Id,number> }
export interface SocialGroup extends Named { weight: number; support: Record<Id, number> }
export interface InternalFaction extends Named { actorId: Id; influence: number; dissent: number }
export interface Organization extends Named { actorId: Id; active: boolean; share: number; income: number; monthlyEffects: Effect[] }
export interface OwnershipSector extends Named { shares: Record<Id, number> }
export interface Office extends Named { holderId: Id; permissions: Array<'policy' | 'fiscal' | 'military'> }
export interface LawLevel extends Named { cost: number; upkeep: number; modifiers: Partial<Record<'growth' | 'inflation' | 'unemployment' | 'foreignExchange', number>>; monthlyEffects: Effect[] }
export interface Law extends Named { officeId: Id; initialLevel: number; levels: LawLevel[] }
export interface Variable extends Named { initial: number; min: number; max: number }
export interface Card extends Named { category: 'action' | 'government' | 'military'; condition?: Condition; cost: Cost; cooldown: number; copies: number; options: Option[] }
export interface GameEvent extends Named { body: string; scheduling: 'automatic' | 'chain'; condition?: Condition; date?: { year: number; month: number }; mandatory: boolean; repeatable: boolean; interval: number; priority: number; options: Option[] }
export interface Advisor extends Named { actorId: Id; factionId?: Id; condition?: Condition; cooldown: number; options: Option[] }
export interface Journal extends Named { start?: Condition; success: Condition; failure?: Condition; monthlyEffects: Effect[]; rewards: Effect[]; penalties: Effect[] }
export interface Outcome extends Named { condition: Condition; body: string; priority: number }
export interface MilitarySide extends Named { actorIds: Id[]; color: string; neutral: boolean; hostileTo: Id[]; supplies: number; industrialCapacity: number }
export interface MilitarySource extends Named { sideId: Id; organizationId?: Id; manpower: number; artillery: number; tanks: number; militarization: number }
export interface Composition { infantry: number; artillery: number; tanks: number }
export interface Army extends Named { faction: Id; identity?: Id; sourceId: Id; provinceId: Id; composition: Composition; manpower: number; morale: number; movesLeft: number }
export interface Region extends Named { owner: Id; x: number; y: number; polygons?: number[][][]; neighbors: Id[]; terrain: 'plains' | 'forest' | 'urban' | 'mountains'; industry: number; strategicValue: number; fortification: number; buildings: { barracks: number; fortress: number; recruitingOffice: number; ammoFactory: number } }
export interface MonthlyRule extends Named { timing: 'monthly' | 'annual'; stage?: 'environment' | 'society'; condition?: Condition; effects: Effect[] }
export interface EconomicShock { year: number; growth: number; inflation: number; unemployment: number; foreignExchangeMonthly: number; goldMonthly: number }
export interface Asset extends Named { mime: string; data: string }
export interface EconomyState {
  budget: number; public_debt: number; fiscal_arrears: number; gold_reserves: number; foreign_exchange: number;
  economy_growth: number; inflation_rate: number; unemployment_rate: number; economic_output_index: number; military_spending: number;
  tax_lower_class: number; tax_middle_class: number; tax_upper_class: number; tax_tariff: number; tax_consumption: number;
  armyLoyalty: number;
}
export interface Rules {
  apPerTurn: number; handSize: number; advisorSlots: number; seats: number; electionEvery: number; coalitionRelation: number;
  commandPoints: number; movesPerTurn: number; recruitmentCostPerThousand: number; buildingCost: number; baseSupplies: number;
  destructionThreshold: number; combatWidths: Record<Region['terrain'], number>;
  unitLabels: Record<keyof Composition, string>;
  economicProfile: Record<string, unknown>;
}
export interface GameProject {
  schemaVersion: 1; id: Id; version: string; name: string; description: string; start: { year: number; month: number };
  playerActorId: Id; playerSideId: Id; seed: number; accent: string; backgroundAssetId?: Id; musicAssetId?: Id;
  initial: { resources: number; armaments: number; warActive: boolean; economy: EconomyState };
  rules: Rules; actors: Actor[]; groups: SocialGroup[]; factions: InternalFaction[]; organizations: Organization[];
  ownership: OwnershipSector[]; offices: Office[]; laws: Law[]; variables: Variable[];
  cards: Card[]; events: GameEvent[]; advisors: Advisor[]; journals: Journal[]; endings: Outcome[]; achievements: Outcome[];
  sides: MilitarySide[]; sources: MilitarySource[]; regions: Region[]; armies: Army[]; monthlyRules: MonthlyRule[]; economicShocks: EconomicShock[]; assets: Asset[];
}
export type Collection = 'actors' | 'groups' | 'factions' | 'organizations' | 'ownership' | 'offices' | 'laws' | 'variables' | 'cards' | 'events' | 'advisors' | 'journals' | 'endings' | 'achievements' | 'sides' | 'sources' | 'regions' | 'armies' | 'monthlyRules' | 'assets';
export const collections: Collection[] = ['actors','groups','factions','organizations','ownership','offices','laws','variables','cards','events','advisors','journals','endings','achievements','sides','sources','regions','armies','monthlyRules','assets'];
export interface EventRef { kind: 'event' | 'card' | 'advisor'; id: Id }
export interface RuntimeState {
  turn: number; year: number; month: number; phase: 'event' | 'action' | 'war'; rng: number;
  resources: number; armaments: number; ap: number; warActive: boolean;
  economy: EconomyState; support: Record<Id, Record<Id, number>>; factions: Record<Id, { influence: number; dissent: number }>;
  coverage: Record<Id, number>; founded: Id[]; ownership: Record<Id, Record<Id, number>>;
  relations: Record<Id, number>; seats: Record<Id, number>; government: Id[]; offices: Record<Id, Id>; laws: Record<Id, number>; variables: Record<Id, number>;
  deck: Id[]; hand: Id[]; discard: Id[]; cooldowns: Record<Id, number>; advisors: Id[];
  currentEvent: EventRef | null; pendingEvents: EventRef[]; eventHistory: Record<Id, { triggered: number; resolved?: number }>;
  journals: Record<Id, 'inactive' | 'active' | 'completed' | 'failed'>; achievements: Id[]; ending: Id | null;
  regions: Record<Id, { owner: Id; buildings: Region['buildings'] }>;
  armies: Army[]; sources: Record<Id, { manpower: number; artillery: number; tanks: number }>;
  militarization: Record<Id,number>; sourceSides: Record<Id,Id>;
  sideResources: Record<Id, { supplies: number; industrialCapacity: number; commandPoints: number }>;
  casualties: Record<Id, number>; aiCompletedTurn: number; sequence: number;
  history: Array<{ turn: number; text: string }>; economyHistory: Array<{ turn: number; growth: number; inflation: number; unemployment: number }>;
}
export type Command =
  | { type: 'next' } | { type: 'skipEvent' } | { type: 'draw' }
  | { type: 'play'; id: Id } | { type: 'advisor'; id: Id } | { type: 'appointAdvisor'; id: Id } | { type: 'removeAdvisor'; id: Id }
  | { type: 'choose'; optionId: Id }
  | { type: 'policy'; lawId: Id; level: number }
  | { type: 'taxes'; rates: Pick<EconomyState, 'tax_lower_class' | 'tax_middle_class' | 'tax_upper_class' | 'tax_tariff' | 'tax_consumption'> }
  | { type: 'government'; actors: Id[] }
  | { type: 'move'; armyId: Id; regionId: Id }
  | { type: 'recruit'; sourceId: Id; regionId: Id; composition: Composition }
  | { type: 'reinforce'; armyId: Id; composition: Composition }
  | { type: 'split'; armyId: Id } | { type: 'merge'; armyIds: Id[] } | { type: 'disband'; armyId: Id }
  | { type: 'build'; regionId: Id; building: keyof Region['buildings'] };
