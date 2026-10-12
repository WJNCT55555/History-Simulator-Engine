# Olimpíada Popular 风味事件设计（v1.1 · 已实施）

> 状态：**已实施并通过 lint / build / 运行时校验**（实施记录见 §10）。
> 已落地事件：`olimpiada_popular`（1936·6–8 和平期主事件）、`olimpiada_popular_stranded`（1936·8 战时滞留变体）、成就 `A_OLIMPIADA`。
> 设计约束（已遵守）：**未新增任何 `GameState` 字段**；未改 `types.ts` / `GameContext.tsx` / `saveGame.ts` / `effectPreview.ts`。
> 已确认决策：门槛=**人民阵线执政 + 加泰罗尼亚自治 + 1936 年 6–8 月窗口**；范围=**主事件 + 战时变体 + 成就**。

---

## 1. 定位：什么样的“风味事件”

| 维度 | 取值 | 理由 |
|---|---|---|
| 事件类别 | `meta.category: 'news'` | 与 `nazi_power_1933`、`burning_of_the_convents`、`mujeres_libres_formation` 同类：历史氛围 + 一次政治表态。 |
| 流程 | `meta.flow: 'solo'` | 单节点，无子事件链，不占用 `pendingEvents` 后续槽位。 |
| 触发 | `date: { 1936, 6 }` + `condition` | Historical 难度按月份精确触发；其他难度按 `condition` 首次满足触发。 |
| 一次性 | 不设 `repeatable` | `eventHistory` 已保证不重复入队；无需冷却字段。 |
| 成本 | 无 AP、无冷却 | 事件由月度管线排入事件看板，玩家不“打牌”，因此不消耗行动点。 |
| 机制权重 | 轻（关系 ±3~8、热情 ±3~5、派系 ±3~6、1 点资源） | 与 `nazi_power_1933`、`international_contacts` 的数值量级对齐，见 §5 平衡表。 |
| 新增状态 | 无 | 需要写入的字段全部已存在且已被读取（§7 审计）。 |

设计意图：这是**共和国最后一个和平月份的政治切片**——一场“反柏林奥运”的人民奥运会正在筹备，而历史上它将在开幕前四天被军事叛乱碾碎。玩家在 1936·6 做的表态，决定了 CNT-FAI 在这场国际反法西斯群众运动中是“入场”“抵制”还是“自下而上接管”。

---

## 2. 历史依据

- 1931 年国际奥委会第 29 届全会在**巴塞罗那**举行，柏林以 43:16 击败巴塞罗那取得 1936 年奥运主办权——反奥林匹克的种子从一开始就埋在巴塞罗那。
- 1936 年 2 月人民阵线赢得大选后，加泰罗尼亚支持人民体育委员会（**Comitè Català pro-Esport Popular, CCPEP**）成立，在加泰罗尼亚自治政府与西班牙人民阵线政府支持下，号召抵制柏林奥运、改在巴塞罗那办赛。
- 赛期定为 **1936 年 7 月 19–26 日**（部分资料记 7 月 22–26 日），主会场为**蒙锥克体育场（Estadi de Montjuïc）**，开幕式原定由加泰罗尼亚自治政府主席**孔帕尼斯（Lluís Companys）**主持；因没有奥运村，运动员被安排进 1929 年世博会的旅馆，后集中到“奥林匹克旅馆”。
- 报名规模：约 **6,000 名运动员、49 个国家/地区**（美国、英国、荷兰、比利时、捷克斯洛伐克、丹麦、挪威、瑞典、法属阿尔及利亚等为主要代表团；另有德国、意大利、犹太人三支流亡队，以及加泰罗尼亚、加利西亚、巴斯克、阿尔萨斯、里夫、巴勒斯坦托管地等队）。苏联一边办自己的斯巴达克运动会，一边同意派队。
- 关键点：**运动员多由工会、工人俱乐部、社会党/共产党和左翼团体选派，而不是由国家奥委会选派**——这正是 CNT-FAI 能插手的地方。
- 项目除常规竞技外还有国际象棋、民间舞蹈、音乐与戏剧；女性可参加的项目多于同期柏林奥运。
- 1936 年 7 月 17–19 日军政变爆发，赛事在开幕前被仓促取消：边境关闭，部分运动员没能抵达，已在巴塞罗那的多数匆忙撤离；**至少约 200 名运动员留下并加入了工人民兵**（如 Clara Thalmann）。

参考：[People's Olympiad (Wikipedia)](https://en.wikipedia.org/wiki/People%27s_Olympiad)、[Warwick Modern Records Centre 档案报道](https://warwick.ac.uk/news/pressreleases/archive_material_reveals/)、[Jewish Telegraphic Agency: In 1936, Barcelona Was to Host the Anti-Nazi 'People's Olympiad'](https://www.jta.org/jewniverse/2017/in-1936-barcelona-was-to-host-the-anti-nazi-peoples-olympiad)。

---

## 3. 触发设计

### 3.1 主事件 `olimpiada_popular`

```ts
/** Both nodes share the organising committee called in March 1936 by the Generalitat. */
const gamesWereOrganised = (state: GameState) => {
  return state.rulingCoalition === 'popular_front'
    && state.regionalStatuses?.catalonia === 'autonomy';
};

date: { year: 1936, month: 6 },
condition: (state: GameState) => {
  // The games need both halves of the February 1936 settlement: a Popular Front
  // cabinet in Madrid that boycotts Berlin, and the Generalitat in Barcelona
  // that hosts the counter-games. A Republic at war has already lost them.
  const isPeacefulRepublic = state.civilWarStatus === 'not_started' && !state.activeWar;
  // The counter-games belong to the summer of 1936: after August the Berlin
  // reference and the festival itself are historically meaningless.
  const isGamesSummer = state.year === 1936 && state.month >= 6 && state.month <= 8;

  return state.scenario !== '1936'
    && isPeacefulRepublic
    && isGamesSummer
    && gamesWereOrganised(state);
},
```

**为什么是 1936·6，而不是 7 月开幕当月？**

1. Historical 难度下，内战固定在 **1936·7** 月份结算时由超级事件触发（`GameContext.tsx` 的 `isHistoricalTrigger`）。若事件放在 7 月，它会与内战超级事件同月争抢演出位，冲淡两头。
2. 6 月是**共和国最后一个和平月份**，“赛事正在筹备、代表团已在海上”与前方的 7 月形成戏剧性反讽，这正是风味事件的价值所在。
3. 非 Historical 难度下，政变进度 100 可能早于或晚于 1936·6；`civilWarStatus === 'not_started'` 保证仗打起来之后该事件不再出现（历史上下场就是被战争取消）。
4. 设 **1936·6–8 的窗口上限**：文案里的“柏林正在为八月擦亮体育场”只在 1936 年成立，若无上限，一个把和平维持到 1938 年的存档会收到一场荒诞的“反向奥运”。超出窗口即不再出现（属于 1936 年夏天的历史切片）。

**为什么以“人民阵线执政 + 加泰罗尼亚自治”为门槛？**

- 历史依据是双重的：赛事由 1936 年 2 月人民阵线胜选后才成立的 CCPEP 发起（马德里抵制柏林），场地与开幕式则由加泰罗尼亚自治政府（Generalitat）提供（孔帕尼斯主持）。两个条件同时成立，文案才完全自洽。
- 1933 剧本开局 `regionalStatuses.catalonia = 'autonomy'`；1931 剧本需走完 `catalonia_autonomy_1932`（政权为共和-社会党内阁时）才会置为 `autonomy`。
- 这是有意设计的“选择有回响”：1936 年 2 月大选若右翼获胜（`national_front`）或自治被拆掉，这场赛事在设定上就不成立，玩家将看不到该事件（已确认按此收紧）。若日后想放宽，只需把 `gamesWereOrganised` 里的 `rulingCoalition` 判断去掉。

### 3.2 各难度 / 剧本触发矩阵

| 场景 | Historical | Normal / Easy / Hard | Sandbox |
|---|---|---|---|
| 1931 剧本（1931·4 起） | 1936·6 月份结算时精确触发（前提：人民阵线执政、加泰罗尼亚已自治、未开战） | `condition` 首次满足的月份（须落在 1936·6–8 窗口内） | 同非历史难度；沙盒下 `checkAchievements` 直接返回，成就不可解锁 |
| 1933 剧本（1933·11 起） | 同上 | 同上（加泰罗尼亚开局即自治，人民阵线取决于 1936·2 大选） | 同上 |
| 1936 剧本（1936·7 起，内战进行中） | 不触发（`scenario !== '1936'` 且已开战） | 不触发 | 不触发；改由 `olimpiada_popular_stranded` 承接 |

---

## 4. 演出文本草案

### 主事件 `olimpiada_popular`

- **title (EN)**: `Olimpíada Popular: Barcelona's Counter-Olympiad`
- **titleZh**: `人民奥林匹克：巴塞罗那的反向奥运`

**description (EN)**

> The hotels of the 1929 Exposition are being emptied of tourists and filled with athletes. While Hitler's Berlin polishes its stadiums for August, Barcelona has answered with an anti-fascist counter-Olympiad: the Olimpíada Popular, 19–26 July, at the Estadi de Montjuïc. Six thousand athletes from some fifty nations have registered — French railwaymen, Belgian miners, Czechoslovak gymnasts, Jewish teams with no flag to march behind, German and Italian exiles who cannot go home, and Basques, Galicians and Catalans who will parade as nations the Olympic flag has never recognised. Most of them were sent by unions, workers' clubs and left-wing groups, not by any ministry. The organising committee, sheltered by the Generalitat and chaired by Catalan sport militants, has asked our unions to send athletes and to raise the black-and-red flag beside the others in the opening parade. Our own movement is not of one mind: some comrades call the games a spectacle of the Republican state, others answer that the workers of Europe are already packing their bags. Companys has sent word that he would be honoured. What shall the National Committee reply?

**descriptionZh**

> 1929 年博览会的旅馆正在清空游客、填满运动员。当希特勒的柏林为八月的赛事擦亮体育场时，巴塞罗那给出了反法西斯的回答：人民奥林匹克运动会，7 月 19 日至 26 日，蒙锥克体育场。来自约五十个国家的六千名运动员已经报名——法国铁路工人、比利时矿工、捷克斯洛伐克体操选手、没有国旗可打的犹太队伍、回不了家的德国与意大利流亡者，以及将以奥运旗帜从未承认过的民族名义入场的巴斯克人、加利西亚人和加泰罗尼亚人。他们大多由工会、工人俱乐部与左翼团体选派，而不是由任何部会派出。得到加泰罗尼亚自治政府庇护、由加泰罗尼亚体育活动家主持的筹委会，请求我们的工会派出运动员，并让黑红旗帜在开幕式队列中与其它旗帜并列。我们运动内部并非众口一词：有同志说这不过是共和国的体育景观，也有人回答：欧洲的工人已经在收拾行囊了。孔帕尼斯捎话来说，他将引以为荣。全国委员会该如何答复？

### 选项

| # | 英文文本 | 中文文本 |
|---|---|---|
| A | Send our athletes — under our own black-and-red banners. | 派出我们的运动员——但只打我们自己的黑红旗帜。 |
| B | No parade behind the Republic's podium. Boycott the games. | 我们不为共和国的看台列队。抵制这场赛事。 |
| C | Open our ateneos and canteens — make it a workers' festival, not a state ceremony. | 敞开我们的雅典学苑与食堂——把它办成工人阶级的节庆，而不是国家的典礼。 |

---

## 5. 选项机制与平衡

### 选项 A：入场，但打自己的旗（国际主义/统战路线）

- **subtitle**: `Join the anti-fascist games and take the tribune beside the left. +5 International Socialists, +5 ERC and +3 PSOE relations, +4 revolutionary fervor; Cenetistas dissent −3, Puristas dissent +4.`
- **subtitleZh**: `加入这场反法西斯赛事，在左翼身旁占据讲台。国际社会主义者 +5，ERC 关系 +5、PSOE 关系 +3，革命热情 +4；工团派异议 −3，纯粹派异议 +4。`
- **effect**：`relations.internationalSocialists +5`；`partyRelations.ERC +5 / PSOE +3`；`stats.revolutionaryFervor +4`；`adjustFactionDissents({ Cenetistas: -3, Puristas: 4 })`；`adjustClassSupport(Obreros, CNT_FAI, +2)`。
- **设计意图**：把群众体育/反法西斯文化当作统一战线的入口。工团派（主张与共和派、UGT 合作）满意，纯粹派（反对与资产阶级共和国同台）不满——代价是内部摩擦而非资源。

### 选项 B：抵制（纯粹派/反国家路线）

- **subtitle**: `Denounce the Olympiad as a state spectacle and keep the movement clean. Faistas influence +6, Puristas dissent −3; ERC −5 and PSOE −3 relations, +3 revolutionary fervor; Cenetistas dissent +5, Treintistas dissent +3.`
- **subtitleZh**: `谴责这场国家景观，保持运动的纯洁。无政府主义者影响力 +6，纯粹派异议 −3；ERC 关系 −5、PSOE 关系 −3，革命热情 +3；工团派异议 +5，三十人集团异议 +3。`
- **effect**：`adjustFactionInfluence(factions, 'Faistas', 6)`；`adjustFactionDissents({ Puristas: -3, Cenetistas: 5, Treintistas: 3 })`；`partyRelations.ERC −5 / PSOE −3`；`stats.revolutionaryFervor +3`。
- **设计意图**：该选项是本事件的“拒绝锚点”，收益完全在运动内部（激进翼影响力上移 + 革命热情），代价是与共和派左翼的关系。注意**它不会取消赛事**——赛事照办，只是 CNT 不在场，这也是历史学家对 CNT 的真实批评之一。
- **只做一次影响力调整的原因**：`adjustFactionInfluence` 会从其它派系按比例回收影响力并做取整补偿，同一次结算里连做两次（Faistas +6、Puristas +3）时第二次的净收益会被稀释（实测 +3 只落成 +1），副标题数字会与玩家看到的变化不符。因此纯粹派改用“异议 −3”表达满意，保证副标题里每个数字都等于实际结算值（影响力取整补偿可能让 Faistas 再多 1 点，属于引擎全局行为）。

### 选项 C：自下而上的工人节庆（运动建设路线，消耗 1 资源）

- **condition**: `state.resources >= 1`；**unavailableSubtitle**: `Requires 1 resource.` / `需要 1 资源。`
- **subtitle**: `Spend 1 resource to host the visiting delegations ourselves: +1 Ateneo Libertario, +8 International Socialists, +5 revolutionary fervor, lower dissent across all factions.`
- **subtitleZh**: `消耗 1 资源，由我们自己接待来访代表团：自由雅典学苑 +1，国际社会主义者 +8，革命热情 +5，并降低各派系异议。`
- **effect**：`resources −1`；`ateneos_established +1`；`relations.internationalSocialists +8`；`stats.revolutionaryFervor +5`；`adjustFactionDissents({ Faistas: -5, Cenetistas: -5, Puristas: -3, Treintistas: -3 })`；`adjustClassSupport(Obreros, CNT_FAI, +2)`。
- **设计意图**：第三条路——既不进国家的队列，也不做旁观者，而是把 6,000 名外国工人运动员变成 CNT 的客人。回报是**全派系异议下降**（与 `organizations` 卡的雅典学苑选项、`international_contacts` 的 IWA–AIT 选项同一设计语言）与最高的 `internationalSocialists`；代价是 1 点资源。

### 数值量级对照（防超模）

| 参照 | 关系变动 | 派系变动 | 资源 |
|---|---|---|---|
| `nazi_power_1933`（单一选项） | 对德 −25，PSOE +5 / PCE +8 | — | 0 |
| `international_contacts` → IWA–AIT | `internationalSocialists +8` | 四派异议 −5/−5/−5/−3 | −1 |
| `international_contacts` → 拉美交流 | 墨西哥 +5、`internationalSocialists +5` | 影响力 +3/+3/+2 | −2 |
| **本事件 A** | `internationalSocialists +5`、ERC +5、PSOE +3 | 异议 −3 / +4 | 0 |
| **本事件 B** | ERC −5、PSOE −3 | 影响力 +6，异议 −3/+5/+3 | 0 |
| **本事件 C** | `internationalSocialists +8` | 异议 −5/−5/−3/−3 | −1 |

三个选项的“总值”与既有卡牌选项同量级，且没有任何单一选项同时给出高关系 + 高凝聚力 + 高资源。

### 与既有系统的接口

- `relations.internationalSocialists` 是**国际纵队成军门槛**（`GameContext.tsx`：内战开始后，1936·9 起 `> 60` 即 `internationalBrigadesFormed = true`，并影响每月补充量与加成档位）。选项 C 的 +8 是本次风味事件唯一可能“撬动主线”的地方——正好呼应历史上 200 名滞留运动员后来加入民兵/国际纵队。
- 其余写入（`partyRelations`、`stats.revolutionaryFervor`、`factions`、`classes`、`ateneos_established`、`resources`）都是既有常态读取字段。

---

## 6. 代码草案

### 6.1 新文件 `src/game/events/olimpiada_popular.ts`

> 下列代码块是设计期草案；**已实施版本以仓库文件 `src/game/events/olimpiada_popular.ts` 为准**（它另含共享的 `gamesWereOrganised` 辅助函数，条件按 §3.1 的最终版，选项 B 按 §10 的修正）。

```ts
import type { GameEvent, GameState } from '../types';
import { adjustClassSupport, adjustFactionDissents, adjustFactionInfluence, isAtOrAfter } from '../utils';

const olimpiadaMeta = {
  category: 'news' as const,
  flow: 'solo' as const,
  series: ['olimpiada_popular'],
  tags: ['historical', 'flavor', 'catalonia', 'anti_fascist'],
};

/**
 * The People's Olympiad was to open at Montjuïc on 19 July 1936 as the workers'
 * answer to the Berlin Games. The event fires in the last peaceful month before
 * the rising, so the player decides how the CNT-FAI enters an international
 * anti-fascist festival it did not organise.
 */
export const olimpiadaPopular: GameEvent = {
  id: 'olimpiada_popular',
  meta: olimpiadaMeta,
  date: { year: 1936, month: 6 },
  condition: (state: GameState) => {
    // 最终版条件见 §3.1：和平 + 人民阵线执政 + 加泰罗尼亚自治 + 1936·6–8 窗口。
    const isPeacefulRepublic = state.civilWarStatus === 'not_started' && !state.activeWar;
    const isGamesSummer = state.year === 1936 && state.month >= 6 && state.month <= 8;

    return state.scenario !== '1936'
      && isPeacefulRepublic
      && isGamesSummer
      && gamesWereOrganised(state);
  },
  title: 'Olimpíada Popular: Barcelona\'s Counter-Olympiad',
  titleZh: '人民奥林匹克：巴塞罗那的反向奥运',
  description: `...（实施时已把 §4 的英文全文原样填入）`,
  descriptionZh: `...（实施时已把 §4 的中文全文原样填入）`,
  options: [
    {
      text: 'Send our athletes — under our own black-and-red banners.',
      textZh: '派出我们的运动员——但只打我们自己的黑红旗帜。',
      subtitle: 'Join the anti-fascist games and take the tribune beside the left. +5 International Socialists, +5 ERC and +3 PSOE relations, +4 revolutionary fervor; Cenetistas dissent −3, Puristas dissent +4.',
      subtitleZh: '加入这场反法西斯赛事，在左翼身旁占据讲台。国际社会主义者 +5，ERC 关系 +5、PSOE 关系 +3，革命热情 +4；工团派异议 −3，纯粹派异议 +4。',
      effect: (state: GameState): Partial<GameState> => {
        const classes = adjustClassSupport(state.classes, 'Obreros', 'CNT_FAI', 2);
        const factions = adjustFactionDissents(state.factions, { Cenetistas: -3, Puristas: 4 });

        return {
          stats: { ...state.stats, revolutionaryFervor: Math.min(100, state.stats.revolutionaryFervor + 4) },
          classes,
          factions,
          partyRelations: {
            ...state.partyRelations,
            ERC: Math.min(100, state.partyRelations.ERC + 5),
            PSOE: Math.min(100, state.partyRelations.PSOE + 3),
          },
          relations: {
            ...state.relations,
            internationalSocialists: Math.min(100, state.relations.internationalSocialists + 5),
          },
          currentEvent: null,
        };
      },
    },
    {
      text: 'No parade behind the Republic\'s podium. Boycott the games.',
      textZh: '我们不为共和国的看台列队。抵制这场赛事。',
      subtitle: 'Denounce the Olympiad as a state spectacle and keep the movement clean. Faistas influence +6, Puristas dissent −3; ERC −5 and PSOE −3 relations, +3 revolutionary fervor; Cenetistas dissent +5, Treintistas dissent +3.',
      subtitleZh: '谴责这场国家景观，保持运动的纯洁。无政府主义者影响力 +6，纯粹派异议 −3；ERC 关系 −5、PSOE 关系 −3，革命热情 +3；工团派异议 +5，三十人集团异议 +3。',
      effect: (state: GameState): Partial<GameState> => {
        // Only the Faistas gain influence here: the helper redistributes it from every
        // other faction, so a second influence gain in the same option would net out
        // to less than its advertised number. The purists are rewarded with dissent.
        const influenceShift = adjustFactionInfluence(state.factions, 'Faistas', 6);
        const factions = adjustFactionDissents(influenceShift, {
          Puristas: -3,
          Cenetistas: 5,
          Treintistas: 3,
        });

        return {
          stats: {
            ...state.stats,
            revolutionaryFervor: Math.min(100, state.stats.revolutionaryFervor + 3),
          },
          factions,
          partyRelations: {
            ...state.partyRelations,
            ERC: Math.max(0, state.partyRelations.ERC - 5),
            PSOE: Math.max(0, state.partyRelations.PSOE - 3),
          },
          currentEvent: null,
        };
      },
    },
    {
      text: 'Open our ateneos and canteens — make it a workers\' festival, not a state ceremony.',
      textZh: '敞开我们的雅典学苑与食堂——把它办成工人阶级的节庆，而不是国家的典礼。',
      subtitle: 'Spend 1 resource to host the visiting delegations ourselves: +1 Ateneo Libertario, +8 International Socialists, +5 revolutionary fervor, lower dissent across all factions.',
      subtitleZh: '消耗 1 资源，由我们自己接待来访代表团：自由雅典学苑 +1，国际社会主义者 +8，革命热情 +5，并降低各派系异议。',
      condition: (state: GameState) => {
        return state.resources >= 1;
      },
      unavailableSubtitle: () => 'Requires 1 resource.',
      unavailableSubtitleZh: () => '需要 1 资源。',
      effect: (state: GameState): Partial<GameState> => {
        const classes = adjustClassSupport(state.classes, 'Obreros', 'CNT_FAI', 2);
        const factions = adjustFactionDissents(state.factions, {
          Faistas: -5,
          Cenetistas: -5,
          Puristas: -3,
          Treintistas: -3,
        });

        return {
          resources: state.resources - 1,
          stats: { ...state.stats, revolutionaryFervor: Math.min(100, state.stats.revolutionaryFervor + 5) },
          classes,
          factions,
          relations: {
            ...state.relations,
            internationalSocialists: Math.min(100, state.relations.internationalSocialists + 8),
          },
          ateneos_established: (state.ateneos_established || 0) + 1,
          currentEvent: null,
        };
      },
    },
  ],
};
```

### 6.2 注册（`src/game/events/index.ts`，已实施）

```ts
import { olimpiadaPopular, olimpiadaPopularStranded } from './olimpiada_popular';   // 第 26 行
export const INITIAL_EVENTS = [
  // ...
  mujeresLibresFormation,
  olimpiadaPopular,            // 第 122 行
  olimpiadaPopularStranded,    // 第 123 行
  formationOfIzquierdaRepublicana,
  // ...
];
```

- `RESTORABLE_EVENTS` 已 `...INITIAL_EVENTS` 展开，**无需二次注册**；读档时 `hydrateEvents` 依赖 `INITIAL_EVENTS.find(id)`，因此必须加入该数组。
- 编辑器的事件流程图通过 `import.meta.glob('../../src/game/events/**/*.{ts,tsx}')` 自动发现新文件，无需改动 `editor/`。

---

## 7. 审计（按 `cnt-fai-card-design` 清单预检）

**结构**
- 事件位于 `src/game/events/`；`meta` 齐全（避免编辑器“缺少 meta”红标）；id 为 snake_case；`date` 年、月同时给出。
- 一个文件导出两个节点（和平期主事件 + 战时变体），共享 `olimpiadaMeta` 与 `gamesWereOrganised`；两者均为 `flow: 'solo'`，无子事件链、无 `renderContent`、无自定义 UI。

**文本**
- 每个面向玩家的字段均有中英对照，且中英描述同一机制（含数值与单位）。
- 三个选项都有 `subtitle` / `subtitleZh`；唯一可失败条件（选项 C 资源）有 `unavailableSubtitle` / `unavailableSubtitleZh`。
- 无 WIP / 返回手牌 / 取消类残留文本；注释为英文。

**效果与流向**
- 三个选项都有实质效果，均以 `effect: (state: GameState): Partial<GameState>` 函数体形式返回，`currentEvent` 置于返回对象末位。
- 事件无 AP/冷却：一次性事件由 `eventHistory.resolved` 阻断重复入队；不手动改 `actionsLeft`、不把卡牌推回 `hand`。
- 资源消耗用 `condition` + 不可用副标题表达，未在 `effect` 内静默失败。

**Helper**
- 派系影响力：`adjustFactionInfluence`（B，仅一次调用，避免比例回收稀释副标题数字）。
- 派系异议：`adjustFactionDissents`（A/B/C）。
- 阶层支持：`adjustClassSupport`（A/C）。
- 无 `factions.*.dissent` 直接赋值，无 `JSON.parse(JSON.stringify(factions))` 式的手工克隆。
- `partyRelations` / `relations` 采用展开克隆 + 钳制，符合既有权重写法。

**状态有效性**（写入字段是否存在于 `GameState` 且被读取）

| 字段 | 定义 | 读取方 |
|---|---|---|
| `relations.internationalSocialists` | `types.ts:639` | 国际纵队门槛与每月补充（`GameContext.tsx:1369-1380`）、外交卡、侧栏关系面板 |
| `relations.france` / `uk`（仅变体） | `types.ts:633` / `types.ts:631` | 外交卡、侧栏关系面板 |
| `partyRelations.ERC / PSOE` | `types.ts:606` | 组阁/选举/侧栏 |
| `stats.revolutionaryFervor` | `types.ts:514` | 事件条件、结局判定、侧栏 |
| `stats.republicanAuthority`（仅变体） | `types.ts:513` | 紧张度计算、事件条件 |
| `factions` / `classes` | `types.ts:567-570` | 全局 |
| `ateneos_established` | `types.ts:503` | 政策 `policyDefinitions.ts:494`、成就 `achievements.tsx:163`、侧栏 |
| `resources` / `armaments` | `types.ts:434-435` | 卡牌/事件成本 |

**无死字段**：不新增 `GameState` 字段，因此不需要存档迁移、不需要 `effectPreview.ts` 标签、不影响旧存档（`saveGame.ts` 无需改动）。

---

## 8. 集成清单（已全部完成）

1. ✅ 新增 `src/game/events/olimpiada_popular.ts`（两个事件：`olimpiadaPopular`、`olimpiadaPopularStranded`）。
2. ✅ `src/game/events/index.ts`：第 26 行 import，第 122–123 行插入 `INITIAL_EVENTS`（`RESTORABLE_EVENTS` 自动跟随）。
3. ✅ `docs/game-story-routes.md` §3「1936」已补「人民奥林匹克」小节。
4. ✅ 成就 `A_OLIMPIADA`（`人民奥林匹克`，图标 emoji `🏅`）写入 `src/game/achievements.tsx`：目录项位于 `A_ESPERANTO` 之后，判定位于 `checkAchievements` 末尾。
   - 判定条件**未新增字段**：`(state.eventHistory?.resolved || []).includes('olimpiada_popular')`（空值安全，`resolved` 只增不减，不可逆）。
   - 可达性（按 `cnt-fai-achievements` 的 Reachability Rule 核对）：写入方 `eventReducer` 的 `RESOLVE_EVENT`（`appendEventHistoryId(..., 'resolved', ...)`）；前置条件均在 1931/1933 剧本内可达（`popular_front` 由 `elections_1936_results` / `early_general_election` 写入，`catalonia` 由 `catalonia_autonomy_1932` 或 1933 剧本初始值写入）；1936 剧本与沙盒难度不可获得，已在文档说明。
5. ✅ 战时变体 `olimpiada_popular_stranded`，见 §9。
6. ✅ 验证结果见 §10。

---

## 9. 战时滞留变体 `olimpiada_popular_stranded`（已实施）

**定位**：为 1936 剧本（开局即内战）与 1931/1933 剧本中较晚开战的存档补上“赛事被战争碾碎”的后半段。历史依据：7 月 17–19 日政变爆发，赛事在开幕前取消，边境关闭，**至少约 200 名运动员留下并加入民兵**。

```ts
export const olimpiadaPopularStranded: GameEvent = {
  id: 'olimpiada_popular_stranded',
  meta: olimpiadaMeta,
  date: { year: 1936, month: 8 },
  condition: (state: GameState) => {
    // The Comitè Català pro-Esport Popular issued its call in March 1936. A war that
    // had already begun before that call means these games were never organised here.
    const warBegan = state.civilWarSetupCompletedAt;
    const gamesHadBeenCalled = !warBegan || isAtOrAfter(warBegan, 1936, 3);

    return state.civilWarStatus === 'ongoing'
      && isAtOrAfter(state, 1936, 8)
      && gamesHadBeenCalled;
  },
  ...
};
```

**设计说明**
- 赛期是 7 月 19–26 日，事件定在 **1936·8**：Historical 难度下内战固定 7 月爆发，8 月正是“赛事刚被取消、代表团滞留在巴塞罗那”的时点；1936 剧本（7 月开局）也会在第一次月结后自然看到它。
- `civilWarStatus === 'ongoing'` + `isAtOrAfter(1936, 8)` 保证：1935 年就开战的存档不会凭空出现这场从未筹备的赛事。
- `civilWarSetupCompletedAt`（`rules/wartimeCoalition.ts` 写入，缺失时按“允许”处理）用来判断“战争是否发生在赛事被发起（1936·3，CCPEP 成立）之前”——战争更早意味着这条时间线根本没有这场赛事。
- 只用 2 个选项（发枪 / 送走），两个方向都能推动 `internationalSocialists`（国际纵队门槛），符合“风味事件也能撬动主线”的定位。
- 注意：地图视图（`currentView === 'map'`）不渲染事件看板，该事件会在玩家切回标准视图时出现——与既有战时事件一致，不额外处理。
- 两个事件共用 `series: ['olimpiada_popular']`，编辑器流程图会把它们归为一组。

---

## 10. 验证结果（已执行）

| 项目 | 命令 / 方法 | 结果 |
|---|---|---|
| 类型检查 | `npm run lint`（`tsc --noEmit` + `audit-coalition-authority`） | ✅ 通过（189 个源文件） |
| 生产构建 | `npm run build` | ✅ 通过（3260 modules，`dist/assets/index-*.js` 2.09 MB） |
| 事件逻辑运行时校验 | 临时 `scripts/tmp-verify-olimpiada.ts` + `npx tsx`（校验后已删除） | ✅ 全部通过：主事件 8 组触发用例、变体 7 组触发用例、5 个选项的完整数值断言、中英字段对齐、`effect` 只写入已知字段（无死字段） |
| 注册检查 | `INITIAL_EVENTS` 第 122–123 行 | ✅ 两个 id 均在数组内（否则事件永不触发） |
| 成就图标审计 | 解析 `achievements.tsx` 的 `icon:` 字段并核对 `public/` 路径 | ✅ 20 项：13 个 PNG 全部 `OK`，7 个 emoji（含新增 `🏅`），无 `MISS` |

**校验过程中修正的两个问题**

1. 选项 B 原本连做两次 `adjustFactionInfluence`（Faistas +6、Puristas +3）：由于该 helper 从其它派系按比例回收影响力，第二次调用实测只净增 +1，与副标题数字不符 → 改为“影响力只调一次 + 纯粹派异议 −3”。
2. 主事件条件原为 `isAtOrAfter(state, 1936, 6)`：会把“反向奥运”放进 1937/1938 年（此时文案里的柏林奥运早已结束）→ 收紧为 1936·6–8 窗口。

**未在真实对局中跑通的验证**（需要长流程推进或独立服务，未执行）：编辑器模拟器「检查触发」面板的实际点击校验、1933 剧本手动推进至 1936·6 的实战检查。两者的判定逻辑已由上面的 `tsx` 校验等价覆盖（含 Historical 模式的精确月份匹配规则）。本机 PowerShell 无 `rg`，检索类命令请改用 `Select-String`。

---

## 11. 决策记录

1. **范围**：主事件 + 战时变体 + 成就 `A_OLIMPIADA`（已全部实施）。
2. **门槛**：收紧为“人民阵线执政 **且** 加泰罗尼亚自治 **且** 1936·6–8 窗口”。代价是 1936 年 2 月大选由右翼获胜（`national_front`）或自治被撤销的存档看不到主事件；收益是文案与历史条件完全自洽。放宽方式见 §3.1。
3. **文案**：保留“孔帕尼斯捎话来说，他将引以为荣”。主事件只在和平期、且加泰罗尼亚仍自治时触发，与 CNT 夺取加泰罗尼亚（`cataloniaControl = 'cnt_fai'`，仅战时）不会同局冲突。
