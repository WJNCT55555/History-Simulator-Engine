# 军事化率与士气系统设计方案（v2）

> 本版按你的新规格重写：**军事化率按派系共享**（不再是每单位），**士气按地图单位独立**，战斗公式由人数／军事化率／士气／地形／兵种／骰子合成，并加入「人民军／民兵独立性」二选一的事件链与 PCE 独立路线。
>
> 本文件**取代**早先的 `peacetime-militarization-design.md`（该稿采用 per-unit `combatReadiness` 模型，已被本版否决）。

---

## 0. 本版相对前一版改变了什么

| 议题 | 前一版 | 本版（你的规格） |
|---|---|---|
| 军事化的粒度 | **per-unit** `combatReadiness`（每个编制表部队一个值） | **per-派系** `militarization`（9 个 `ArmyIdentity` 组，同组共享） |
| 政府军 vs 警察 | 各自独立（警队逐队上限） | **共用一个率**（开战后同入 `mapResources` 政府军池，且从该池募兵的单位 `identity` 全是 `gov`） |
| 民兵差异 | 每个池一个值 | **每个民兵派系一个值**，派系内所有部队共享 |
| 士气 | per-unit（和平期就演化） | 和平期：正规军按编制表、民兵按派系；**开战后每个地图单位独立** |
| 军事化上限来源 | 类别系数 × 训练系数 | 单一的**军事化系数**，不再有类别系数 |
| 制度等级 | 保留 v2 文档的全局 L0/L1/L2 | **本版取代它**（见 §12） |
| 事件链 | 无 | **人民军 / 民兵独立性** 两条互斥日志 + PCE 独立路线 |

**为什么你的粒度更好**：这款游戏的主体是政治而不是后勤。CNT 与 PCE 的差别不是"哪个营练得多"，而是**两种对军事化的政治态度**——工团自治 vs 布尔什维克纪律。"每派系一个率"恰好把军事化变成一个**政治立场变量**而不是训练台账。前一版的 per-unit 模型在这一点上是错的。

---

## 1. 现状核查（沿用前一版，已复核）

| 字段 | 位置 | 和平期有写入者吗 |
|---|---|---|
| `ArmyFormation.militarization` (0–100) | `map/types_map.ts:112` | **没有**。只在 `scenarios/base.ts:43` 初始化 |
| `ArmyFormation.morale` (0–100) | `map/types_map.ts:111` | **没有** |
| `SecurityCorpsState { manpower, loyalty }` | `rules/securityForces.ts:27` | 只有 `loyalty`（警察事务卡 +5） |
| `ArmedEntityPool { manpower, artillery, tanks }` | `types.ts:43` | 只有人力/装备池 |
| `state.militiaCombatPower`（初始 100） | `types.ts:663` | 3 张战时卡的 4 个选项 +5/+15/+5/+10；条件全要求开战 → **和平期锁死 100**，且 HUD 里看不到 |
| 全局「共和国军事化」L0/L1/L2 | `military-system-redesign-v2.md:227` | **代码里不存在** |

写入 `militarization` 的位置全在战时路径（`andalusia_fire`、`asturias_revolution`、`civil_war_setup`、`mapReducer` 招募写死 10、`warSetup.ts:216`）。

**结论：和平期军事化与士气完全是静态展示数据。**

---

## 2. 核心模型：两把尺子

```text
军事化率  militarization   —— 等级尺，per-派系，和平期与战时都有效
士气      morale           —— 缓冲尺，和平期按编制表/派系，开战后 per-地图单位
```

### 2.1 军事化率 = 「名义人力里，真正能当兵的那部分占多少」

这是全篇最容易卡住的概念，所以先讲人话。

一支 5,000 人的 CNT 纵队，**花名册上是 5,000 人，但这 5,000 人里有多少真的能当兵用？** 能听懂命令、能排队列、能在炮击下守住阵地、能按时归队（而不是回家收麦子）、打完仗还留在编制里——

- 军事化率 **17** 意思是：这 5,000 人里，真正按军队方式运转的约等于 **850 人**的量。剩下 4,150 人不是不存在，他们**会开枪、有热情、人数摆在那里**，但组织度撑不起阵地战：命令要靠喊、侧翼没人管、伤亡一上来就散。
- 军事化率 **85** 意思是：8,500 人当量的真正军人。同样 5,000 人编制，能顶住、能机动、能执行复杂命令。

所以：

```text
有效兵力 = 名义人数 × 军事化率 / 100
```

**军事化率不是"训练度百分比"，而是"人数折算成战斗力的折扣率"。** 它回答的是"这支部队在多大程度上是一支军队"，而不是"这些人打靶准不准"。

用这个理解再看三件事就顺了：

1. **为什么它是战斗乘数而不是加分项**：因为它是把人数打折。5,000 × 17% = 850 当量，5,000 × 85% = 4,250 当量，差的就是 5 倍。用 `1 + m/100` 这类形式只能得到 1.58 倍（见 §3.3），等于把"850 人"和"4,250 人"当成差不多，那是错的。
2. **为什么同派系共享一个值**：因为军事化率描述的是**组织形态**，不是这支部队练了多久。CNT 的全部纵队都是"自治纵队"这种组织形态，所以 `cnt` 一个值。哪一支练得苦一点，体现在它自己的**士气**上。
3. **为什么和平期就要有这个值**：和平期的民兵池虽然没有上战场，但它已经是"某种组织形态"了。1931 年 CNT 的 5 万人池和 PCE 的 1 万人池，组织度本来就不一样（17 vs 48）。开战只是把这个折算率拿到战场上用。

### 2.2 与士气的分工

- **军事化率回答"这 5,000 人里有多少能当兵用"** —— 由政治决定，改动慢，同派系共享，是玩家长期投入的结果。
- **士气回答"这些兵现在还想不想打"** —— 由薪饷、欠款、胜败、政治气氛决定，改动快，逐单位独立。

一个必然推论：**同派系的 5,000 人纵队和 500 人残部军事化率相同**（都是 CNT 的组织形态），但士气可以完全不同（残部士气低）。这正是我们想要的——组织形态是政治问题，想不想打是处境问题。

---

## 3. 军事化率

### 3.1 数据结构

直接复用 `ArmyIdentity` 做键——现有定义正好覆盖全部需要的组：

```ts
// types.ts
export type ArmyIdentity = 'gov' | 'cnt' | 'ugt' | 'poum' | 'pce' | 'intl' | 'requetes' | 'falange' | 'regional';

export interface GameState {
  /** 各武装派系的军事化率 0–100，同派系全部队共享。`gov` = 政府军 + 警察。 */
  militarization: Record<ArmyIdentity, number>;
  /** 军事化路线的选择与两条日志的进度（内战爆发后才有意义）。 */
  militarizationPaths: {
    chosen: 'none' | 'popular_army' | 'militia_autonomy';
    popularArmyProgress: number;
    militiaAutonomyProgress: number;
    chosenAt?: { year: number; month: number };
  };
}
```

**没有 `militiaMorale`。** 派系级士气已取消（见 §4）——士气只存在于开战后的地图单位上。

`gov` 同时覆盖政府军与警察——这一点已被代码确认：`formationToArmy`（`map_constants.ts:484`）给全部编制表部队 `identity: 'gov'`，`applyCivilWarLoyaltySplit` 把警队人力按忠诚切分进 `mapResources[faction].manpower`，而从该池募兵产生的单位（`mapReducer.ts:226`、`mapAiTurn.ts:200`）**同样是 `identity: 'gov'`**。所以共用一个率在数据上是自洽的。

### 3.2 初始值表

| `ArmyIdentity` | 名称 | 初始军事化率 | 依据 |
|---|---|---|---|
| `gov` | 政府军 + 警察 | **85** | 正规军与宪兵，制度性军事组织 |
| `intl` | 国际纵队 | **62** | 共产国际派来的干部骨架 |
| `requetes` | 雷盖特（敌） | **55** | 卡洛斯派民兵，传统与宗教动员，训练尚可 |
| `pce` | 共产党民兵 | **48** | 布尔什维克式纪律，最强调军事化 |
| `falange` | 长枪党（敌） | **42** | 狂热但缺乏训练 |
| `regional` | 巴斯克军（PNV） | **38** | 有正规军传统 |
| `ugt` | 社会主义民兵 | **30** | 比 CNT 更接受纪律 |
| `poum` | 马克思主义统一工党 | **26** | 半正规 |
| `cnt` | CNT-FAI 联合民兵 | **17** | 自治纵队，Faistas 反军事化传统 |

**`gov` : `cnt` = 85 : 17 = 5.00 倍** —— 正是你要的 1 : 0.2。

### 3.3 军事化系数曲线（你问的那个）

**"曲线"指的是：怎么把 0–100 这个军事化率数字，换算成一个战斗乘数。**

军事化率本身是"有效军人占比"（§2.1），所以最自然的换算是直接除以 100：85 → ×0.85，17 → ×0.17。这就是**线性曲线**，也是现在的方案。

但也可以**故意压低这条线的陡度**，让军事化率的差距在战斗里显得没那么致命——做法是给一个"地板"，比如 `0.4 + 0.6 × m/100`：这样军事化率 0 的部队仍有 ×0.40 战力，85 与 17 的差距就从 5 倍压到 1.8 倍。

四种曲线摆在一起（数字都已实算）：

| 曲线 | 公式 | `gov` 85 | `cnt` 17 | 倍差 | 民兵 17→70 的回报 | 军事化率 0 时 |
|---|---|---:|---:|---:|---:|---:|
| **A 线性（现方案）** | `clamp(m,10,100)/100` | 0.85 | 0.17 | **5.00×** | **4.12×** | 0.10 |
| B 温和 | `0.4 + 0.6 × m/100` | 0.91 | 0.50 | 1.81× | 1.63× | 0.40 |
| C 折中 | `0.2 + 0.8 × m/100` | 0.88 | 0.34 | 2.62× | 2.26× | 0.20 |
| D 平方根 | `√(m/100)` | 0.92 | 0.41 | 2.24× | 2.03× | 0.00 |

**你要的 1 : 0.2（政府军 vs 民兵）只有 A 能给。** B/C/D 都是"军事化率重要，但不是决定性的"。

**我推荐 A，理由是你自己加的另外两条规则：**

1. 你加了**战宽**（平原 6,000 人上限）—— 人海在单场战斗里已经没用了。
2. 你让**攻方预备队零伤亡、打光就撤** —— 进攻只能靠前线质量取胜。

这两条加起来，军事化率已经是唯一能改变单场胜负的变量。如果这时再把曲线压平（B/C/D），民兵就陷入"人数用不上、质量也拉不开"的死局，永远打不赢任何东西。**A 与这两条规则是配套的。**

**如果选了 A 之后实测觉得差距太大**，最健康的调法不是改曲线，而是**调初始值**：把 `cnt` 从 17 提到 25、`gov` 从 85 降到 78（倍差 3.1×）。这样保留线性曲线"每一分都值钱"的手感，但开局差距不至于让人绝望。

**下限 10 的作用**：避免"军事化率 0 = 战力 0"的退化（一群完全没组织的持枪群众仍然有伤害）。曲线 D 没有这个保护。

### 3.4 单一写入者

新增 `src/game/rules/militarization.ts`，结构对标 `securityForces.ts`（一个模块独占写入权）：

```ts
export const clampMilitarization = (value: number): number =>
  Math.max(0, Math.min(100, value));

/** 唯一合法的军事化率写入口。卡牌、顾问、事件、日志都必须走这里。 */
export const adjustMilitarization = (
  state: Pick<GameState, 'militarization'>,
  group: ArmyIdentity,
  delta: number,
): Partial<GameState> => ({
  militarization: {
    ...state.militarization,
    [group]: clampMilitarization((state.militarization[group] ?? 0) + delta),
  },
});

export const getMilitarizationMultiplier = (value: number): number =>
  Math.max(10, Math.min(100, value)) / 100;
```

`adjustMilitarization` 之外不允许出现对 `state.militarization` 的直接写入——这条规则让"谁改了什么"永远可审计。

### 3.5 月度演化

**自然衰减：确认不开。** 军事化率只升不降，唯一的下调来源是卡牌／事件里的显式减益（例如「削减军费」选项、CNT 抵制军事化的立场选项）。

**唯一的自动月度演化由 `army_reform_law` 的高等级承载**（§6.5 改过一次载体：原先设计成"日志激活时生效"，现已改为"法律等级生效"——因为两条军事化日志的落点本来就是写入这条法律，让法律单独拥有长期效果更干净，也避免日志与法律重复计一次）：

```text
army_reform_law L3「共和国人民军」    → gov 每月 +0.5；共和国权威 +0.5
army_reform_law L4「民兵纵队体系」    → cnt/ugt/poum 每月 +0.5；gov 每月 −0.3；
                                        革命热情 +0.5；共和国权威 −0.5
militia_legality_law L2「武装工会法令」      → 民兵每月 +0.2
militia_legality_law L3「后方民兵治安统合」  → 民兵每月 +0.3；共和国权威 −0.3
militia_legality_law L4「反法西斯民兵委员会」→ 民兵每月 +0.4；革命热情 +0.5；共和国权威 −0.5

army_reform_law L0–L2 与 militia_legality_law L0–L1 无军事化效果。
gov 在 L3 之前无任何自动演化 —— 它的升降完全由卡牌与事件驱动。
```

**实现方式（已落地）**：没有单独的"月度演化函数"。这些数字直接写在 `policyDefinitions.ts` 对应等级的 `monthlyModifiers` 上，用新增的 `PolicyModifier` kind `{ kind: 'militarization'; group; delta }`，由 `calculateMonthlyPolicyEffects` 统一结算——也就是**法律的长期效果和别的法律效果走同一条路径**，不另开管线阶段。

这样做的理由：法律本来就拥有自己的效果。把长期惯性也放在那里，就不会出现"日志和法律的数字各写一份、迟早不一致"的问题，也不必问"日志失效后惯性还算不算"。

### 3.6 `militiaCombatPower` 的迁移（现在它真的变成军事化率了）

前一版我判定它不该变成军事化，理由是"全局 + 只作用民兵 + 可被重复卡购买"。**你现在的规格解决了前两条**：粒度从"全局"细化到"每派系"，并且政府军/警察也有了自己的一条。第三条（可被重复卡购买）在本版里不再是问题——因为**军事化率不再是制度等级**，它本来就应该被卡牌推动，制度等级那层交给两条互斥日志去承担。

迁移规则：

```text
删除 state.militiaCombatPower。

民兵派系的军事化率初值 = 上表基准 + (militiaCombatPower − 100) × 0.5
  → 旧存档里 militiaCombatPower = 135 时，各民兵派系 +17.5
  → 新开局 militiaCombatPower = 100，各派系按上表原值

对应改造 3 张卡的 4 个选项（保留各自的政治代价，改为写具体派系）：
  militia_reorg 「正规化训练」   CNT +5，派系进度 +8
  militia_reorg 「建立突击营」   CNT +8，派系进度 +5
  aragon_front  「整顿纪律」     CNT +5，派系进度 +6
  anarchy_tanks 研究成功         cnt +6、pce +6、进度 +10（双路）
```

顺带修掉一个既有缺陷：**`militiaCombatPower` 在 HUD 里完全看不见**（只有 `effectPreview.ts:58` 一个标签，而效果预览仅 easy/sandbox 显示）。新字段必须在侧栏常显。

---

## 4. 士气

**派系级士气已取消。** 士气不再是派系属性、也不再有任何派系士气乘数——它只存在于**开战后的地图单位**上，每个单位一个值。

### 4.1 和平期没有士气

和平期没有地图单位，所以**没有士气这个量**。民兵池战力公式里不含士气项（§5.1）。

正规军编制表部队虽然带有 `morale` 字段（`ArmyFormation.morale`：第1师 80、非洲军团 85、布尔戈斯 55…），但它在和平期**只是一个待继承的出生值**，不参与任何和平期计算，也不逐月演化。

### 4.2 开战后：单位出生士气

每个地图单位有独立的 `Army.morale`（字段已存在，`types_map.ts:91`）：

| 单位来源 | 出生士气 |
|---|---|
| 正规军编制表部队 | 继承 `formation.morale`（80 / 85 / 55 … 保留部队间差异） |
| 民兵单位（新建或由池转化） | **60**（沿用 `mapReducer.ts:226`、`mapAiTurn.ts:208` 的现有常量） |
| 国际纵队 | **60** |
| 投降/缴获转化的单位 | 沿用现有逻辑 |

出生之后**各自独立演化**，互不影响。同派系的两支部队军事化率永远相同（查表），但士气可以完全不同——一支刚打完硬仗、一支刚补充新兵。

> 若以后想按派系给不同出生士气，加一张静态表即可。但那是**出生值**，不是持续乘数——不会重新引入派系士气系数。

### 4.3 士气演化

士气由战斗驱动（胜负、损失、撤退），这一层已存在于 `combat.ts`：攻方 `−[10 + 损失率×100 + max(0, 守骰−攻骰)×3]`、守方类似、下限 10。本方案**不改这一层**。

和平期的士气动力学（薪饷、欠款、革命热情等）**全部删除**——它们只在没有地图单位的阶段有意义，而现在那个阶段没有士气。

> 顺带保留一条正交性说明：`armyLoyalty` 低不代表打得差，最好的一支部队恰恰最反动。**忠诚只决定开战时倒向哪一方，军事化率只决定组织度，士气只决定当下想不想打。** 三者互不替代。

---

## 5. 战力公式

| 时点 | 公式 |
|---|---|
| 和平期（池，不接敌） | `池战力 = 池人力 × 军事化率 / 100` |
| 开战瞬间（池 → 单位） | 见 §5.2 的分化与合并流程 |
| 战时（地图单位） | `战力 = 基础战力 × 军事化率 × (1 + 士气/100) × 防守系数 × 随机系数` |

> 量纲：和平期池战力的单位是「**有效兵力（人）**」；战时战力的单位是「**千人当量**」（`1.0` = 1,000 名满组织化步兵）。

### 5.1 和平期：民兵池战力

```text
池战力 = 池人力 × militarization[该派系] / 100
```

就这一行。三条依据：

1. **和平期各池没有火炮和坦克。** 已核实：`organizations.ts:576-577` 的 `EMPTY_POOL` 把 `artillery` / `tanks` 写死为 0，`adjustCntMilitiaManpower` 也只改人力。重装备是开战后由军备、工业、研究产生的。
2. **和平期没有士气。** 没有地图单位就没有士气（§4.1）。
3. **不除以 1000。** 结果直接读作"有效兵力多少人"，比千人当量直观。

开局实算：

| 派系 | 池人力 | 军事化率 | 池战力（有效兵力） |
|---|---:|---:|---:|
| `cnt` | 50,000 | 17 | **8,500** |
| `ugt` | 20,000 | 30 | **6,000** |
| `pce` | 10,000 | 48 | **4,800** |
| `poum` | 5,000 | 26 | **1,300** |

**PCE 的人力只有 CNT 的五分之一，有效兵力却有 CNT 的 56%。** 这就是和平期玩家能看见的东西：CNT 人多，PCE 人精。

### 5.2 开战转换：池的分化与合并

三个池各自分化，再合并进两个阵营池：

```text
警察池（4 支警队，各自持有 loyalty）
  → 按每支警队自己的 loyalty 切分
  → 忠诚部分 → mapResources[REPUBLICAN].manpower
  → 其余     → mapResources[NATIONALIST].manpower
  → 警队人力清零

政府军池（未编入驻军的陆军员额）
  → 按 stats.armyLoyalty 统一切分
  → 忠诚部分 → mapResources[REPUBLICAN].manpower
  → 其余     → mapResources[NATIONALIST].manpower

民兵池（各派系本就分属两个阵营）
  → CNT / UGT / POUM / PCE / 巴斯克  → 共和阵营
  → Requeté / Falange                → 国民阵营
  → 地图上的现有部队按准备档位扩编，扩不完的转为阵营预备人力
```

前两个池已经由现有 `applyCivilWarLoyaltySplit`（`warSetup.ts:280`）实现，不需要改。民兵池由 `applyPeacetimeMobilization`（`warSetup.ts:176`）处理。

**单位化规则：**

```text
正规军编制表部队 → 每支部队生成一个地图单位，identity: 'gov'
                   出生士气 = formation.morale（80 / 85 / 55 … 保留部队差异）
民兵             → 由池扩编生成单位，identity = 该派系
                   出生士气 = 60（沿用 mapReducer.ts:226 的现有常量）
```

**单位不写入军事化率** —— 结算时现场读取 `militarization[单位 identity]`。一旦复制进单位，既会出现"同派系不同单位值不一致"的漏洞，也会让日志升级后老单位拿不到增益。

### 5.3 战时：地图单位战力

```text
第一步  算战宽占用（§5.4），得出【展开步兵】与【展开坦克】

第二步  基础战力 = [ 展开步兵
                   + 展开坦克
                   + 火炮                     ← 火炮无视战宽，全额参战
                   + 火炮 × 0.35              ← 火炮加成
                   + 展开坦克 × 0.60 ] / 1000 ← 装甲加成

第三步  最终战力 = 基础战力
                 × 军事化系数 = clamp(militarization[u.identity ?? 'gov'], 10, 100) / 100
                 × 士气系数   = 1 + u.morale / 100
                 × 防守系数   （仅防守方）
                 × 随机系数   ∈ [0.90, 1.10]
```

等效每兵种权重：**步兵 1.00／人、火炮 1.35／人、坦克 1.60／人**。所以"优先排坦克"确实是把最强的单位先放进战线。

> **`1 + 士气/100` 的区间是 [1.0, 2.0]**（已确认）。士气存 0–100，沿用现有 `Army.morale` 字段与 UI。满士气单位的战力是零士气单位的**两倍**。

**防守系数（仅防守方，已确认）—— 加法式：**

```text
防守系数 = 1.2 + ( 地形防御系数 − 1 ) + 工事等级
```

地形防御系数沿用现有表，但在新式子里它贡献的是**相对 1.0 的超出量**：

| 地形 | 地形防御系数 | 地形加成 = (系数 − 1) |
|---|---:|---:|
| 平原 | 1.00 | +0.00 |
| 森林 | 1.15 | +0.15 |
| 城市 | 1.20 | +0.20 |
| 山地 | 1.30 | +0.30 |

展开后的实际防守系数：

| 地形 ＼ 工事等级 | 0 | 1 | 2 | 3 |
|---|---:|---:|---:|---:|
| 平原 | **1.20** | 2.20 | 3.20 | 4.20 |
| 森林 | 1.35 | 2.35 | 3.35 | 4.35 |
| 城市 | 1.40 | 2.40 | 3.40 | 4.40 |
| 山地 | 1.50 | 2.50 | **3.50** | 4.50 |

与前几版对照：更早的 `地形 × (1 + 0.10 × 工事)` 山地工事 2 = ×1.56；上一版 `地形 × (1.5 + 工事)` = ×4.55；本版 = **×3.50**。天然防御基线从 ×1.50 降到 **×1.20**，正是"把旋钮降到 1.2"要的效果。

直接后果：**同等兵力下进攻仍然亏，但没有上一版那么极端。** 5,000 打 5,000（平原、无工事）：守／攻 = **1.20×**，损失 **334 : 232 ≈ 1.44 : 1**（上一版是 1.50× 与 2.25:1）。约 **1.4:1** 兵力优势就能打出正收益——比上一版的 2:1 好得多，进攻方终于有操作空间。

> **⚠️ 一处实现解释需要你确认。** 你写的是「1.2 +（地形防御系数 + 工事等级）」。若**把现有的地形值原样相加**（平原 1.00、山地 1.30），那么平原无工事就已经是 `1.2 + 1.00 = 2.20`，**比上一版还高**——与"把旋钮降到 1.2"的意图相反。所以我按**地形贡献其超出 1.0 的部分**实现（即上表的 `系数 − 1`）：平原无工事 = 1.20，正好落在你要的 1.2 上。
>
> 若你其实想要**另一组专门的地形加值**（不是由现有表减 1 得来），把那一列数字给我即可——公式本身不用改。

**政府军编制表部队**（`identity: 'gov'`）走完全相同的公式，只是查 `militarization.gov` = 85，士气取各自编制表的值。警察不生成地图单位，其人力进阵营池后由募兵产生 `identity: 'gov'` 的新单位，同样读 `militarization.gov`。

### 5.4 战宽与展开顺序

```text
战宽 W（地形）：平原 6,000 / 森林 4,500 / 城市 3,000 / 山地 2,000

第 1 步  坦克先占位：展开坦克 = min(坦克数, W)
第 2 步  步兵填剩余：展开步兵 = min(步兵数, W − 展开坦克)
第 3 步  火炮无视战宽：展开火炮 = 火炮数（全额）
未展开的坦克与步兵留在预备队，不贡献火力
```

同一省内多支防守部队先合并成一条战线再统一排位；因为可能来自不同派系，军事化系数与士气按人数加权（沿用现有 `combat.ts:70-85` 的做法）。

**预备队规则（已确认，攻守刻意不对称）：**

```text
进攻方
  · 只有展开部分参战，预备队不贡献火力、【零伤亡】
  · 伤亡按【展开人数】分摊
  · 展开部分被打掉后，预备队撤离，进攻失败

防守方
  · 瞬时火力同样受战宽限制
  · 但预备队【持续补位】 —— 伤亡按【守方总人数】分摊（补位上来的人同样挨打）
  · 只要总人力还够，战线维持，不因"第一波被打光"而崩溃
```

这条不对称是本系统里最有味道的一条规则：

- **进攻是一次性承诺**：你只能投入战宽允许的兵力，打光就没了。后面 9,000 名预备队只能眼睁睁看着前线 6,000 人被打垮然后一起撤退。
- **防守是持续消耗**：守方把全部人力当成一个缓冲池，一波波填线。2,000 人的守备队可以承受远超 2,000 人规模的累计损失。
- **净效果：进攻方必须在前线质量上取得真实优势，而不是靠人多。** 15,000 民兵进攻只能投 6,000；对面的守备队却可以用上全部人力挨打并补位。人海在**进攻方向**彻底失效。

**由此产生的结构性后果**：平原战宽 6,000 意味着 CNT 那 50,000 人的池在一场战斗里最多投入 6,000 人。数量优势只能靠多线同时开战来兑现——**军事化率（质量）成为打赢单场战斗的唯一途径**。从设计意图看这是好事，但请确认这是你要的。

### 5.5 伤亡

```text
原始人员损失率 = clamp(0.06 × 敌方最终战力 / 本方最终战力, 0.02, 0.18)
最终人员损失   = floor(该单位总人数 × 原始损失率 × 军事化伤亡系数)
军事化伤亡系数 = 1.10 − 0.20 × 军事化率 / 100
火炮损失 = 人员损失率 × 0.75 × 火炮数；坦克损失 = × 0.60 × 坦克数
败退方再分别乘 1.25 / 1.50
```

损失率是**相对比值**（2%–18%），不会出现"战力碾压 → 伤亡无限大"的退化。现有 `combat.ts` 把绝对战力乘 0.08／0.11，而战力约等于人力的 12–25 倍，实算几乎每战双方 100% 伤亡——本公式同时修掉了这个问题。

### 5.6 实算校验

全部按「平原、工事 0（防守系数 **1.20**）、随机系数取 1.00」计算，倒数第二行另行注明。

| 对局 | 攻方战力 | 守方战力 | 守／攻 | 攻方损失 | 守方损失 |
|---|---:|---:|---:|---:|---:|
| 非洲军团 6,000 攻 CNT 民兵 15,000（`cnt` 17） | 10.73 | 1.96 | **0.18×**（攻方强 5.5 倍） | 111 | 2,878 |
| 同上，民兵把 `cnt` 练到 70 | 10.73 | 8.06 | 0.75×（攻方强 1.3 倍） | 251 | 1,149 |
| CNT 民兵 15,000（`cnt` 17）攻 第6师 2,000 | 1.63 | 3.44 | **2.11×**（守方强） | 808 | 52 |
| 同上，民兵把 `cnt` 练到 70 | 6.72 | 3.44 | 0.51×（攻方强 2.0 倍） | 176 | 218 |
| 第1师 5,000 攻 纳瓦拉守备队 2,500（**山地、工事 2**，防守系数 3.50） | 6.62 | 12.73 | **1.92×** | 375 | 72 |
| 5,000 正规军 攻 5,000 正规军（完全同等兵力） | 6.80 | 8.16 | **1.20×** | 334 | 232 |

> 攻方损失以**展开人数**为基数，而火炮无视战宽、永远在线上，所以炮组成员始终算作暴露。第 1、2、5 行攻方带 1,500 门炮，展开人数因此是 6,000 / 6,000 / 3,500 而不是 4,500 / 4,500 / 2,000。

**四条关键结论：**

1. **同等兵力下进攻仍然亏，但程度合理**：守／攻 = **1.20×**，损失 **334 : 232 ≈ 1.44 : 1**。约 **1.4:1** 兵力优势就能打出正收益（上一版要 2:1）。进攻方有操作空间，防守方仍保有天然优势。

2. **军事化率 17 → 70 让同一批人的战力提升 4.12 倍**，足以让民兵从"进攻 2,000 人守备队亏 15.5 倍（808 : 52）"变成"以 2.0 倍优势打赢（176 : 218）"。**军事化率是唯一能让进攻成立的杠杆。**

3. **练满的民兵与非洲军团接近可战**（0.75×，损失 251 : 1,149 仍吃亏）。完全军事化的民兵能挡住最精锐的殖民军团，但在平原上主动进攻它仍然不划算——防守系数帮的是守军。

4. **人海在进攻方向彻底失效。** 15,000 民兵进攻只能投 6,000，而守方 2,000 人却能用全部人力挨打并补位。数量优势只能靠多线同时开战兑现。

> **一个防"打不疼"的提醒**：第 1 行里民兵损失 2,878 人（占 15,000 的 19%），靠的正是**防守预备队计入伤亡基数**（§5.4）。若改成守方预备队也不吃伤亡，这支部队就永远打不疼，战争会彻底僵住——所以那条不对称不只是味道好，是必需的。

---

## 6. 军事化事件链

### 6.1 触发条件：战时人民阵线成立后的下一个月

**已确认的触发时机**：不在"内战爆发 + 2 个月"，而是**战时人民阵线成立后的下一个月**。理由：这个决定的主体是人民阵线内部的政治博弈，阵线没成立就无从谈起。

事件通过 `SCHEDULED_EVENT_REGISTRY` 排队（与 `wartime_power_arrangement` 同一机制），条件函数放在 `rules/wartimeCoalition.ts` 旁边：

```ts
/** 军事化路线抉择：人民阵线成立满一个月后弹出，一次性的。 */
export const isMilitarizationCrossroadsDue = (state: GameState): boolean => Boolean(
  (state.militarizationPaths?.chosen ?? 'none') === 'none'
  && state.wartimePowerArrangement
  && state.rulingCoalition === WARTIME_COALITION_ID
  // 与 isWartimeArrangementDue 同一写法：严格大于成立月 ⇒ 正好是下一个月
  && monthIndex(state) > monthIndex(state.wartimePowerArrangement.formedAt)
  // 第三阵营已经分裂出去时，CNT 已有自己的军队，这个抉择失去意义
  && !state.iberianDefense
  && !state.eventHistory?.resolved.includes(MILITARIZATION_CROSSROADS_EVENT_ID)
);
```

三个子句的用意：

| 子句 | 理由 |
|---|---|
| `wartimePowerArrangement` + `rulingCoalition === WARTIME_COALITION_ID` | 阵线必须真的成立且真的在执政。`wartime_power_arrangement` 事件只是**选项**，若玩家选的那条没组阁成功，就不该触发 |
| `monthIndex > formedAt` | 与 `isWartimeArrangementDue`（`wartimeCoalition.ts:27`）完全同一写法，保证"下一个月"的语义一致 |
| `!state.iberianDefense` | 五月危机若已分裂出第三阵营，CNT 已脱离共和国，再问"要不要组建人民军"是荒谬的 |

**和平期不启用**（已确认）。和平期的军事化完全由卡牌与顾问推动（§6.7），不经过事件链——这让和平期的选择保持"很多条小路"而不是"一次二选一"。

**三条战时路线都允许触发**，包括 CNT 选择阁外合作（`external`）时：那时 CNT 仍以工会与民兵身份参与阵线，"武装民兵还是并入国家军队"同样是它的核心问题。若实测觉得阁外路线不该推动国家军队整编，加一句 `state.wartimePowerArrangement.route !== 'external'` 即可。

### 6.2 总事件「人民军还是武装民兵」`militarization_crossroads`

| | **A. 组建人民军** | **B. 武装民兵** |
|---|---|---|
| `textZh` | 组建人民军 | 武装民兵 |
| `subtitleZh` | 以正规军骨架收编各派民兵，建立统一指挥与参谋制度。各党的独立军事基础就此终结——包括我们自己的。 | 不设统一军衔与指挥，由工会继续武装和供养各纵队。革命热情与工人控制上升，但各纵队将继续各自为战。 |
| 立即效果 | `militarization.gov +3`、`militarization.pce +5`；Faistas 异议 +8、Puristas 异议 +6；革命热情 −5 | `militarization.cnt +5`；PCE 关系 −10、苏联关系 −5；革命热情 +5、工人控制 +3 |
| 政治后果 | **PCE 关系 +10**（人民军正是 PCE 的纲领）；**CNT 自身的法律满意度下降**（见下） | **CNT 自身的法律满意度上升**；PCE 视为背叛 |
| 日志 | `activateJournal(state, 'journal_popular_army')` | `activateJournal(state, 'journal_militia_autonomy')` |
| 路线写入 | `chooseMilitarizationPath(state, 'popular_army')` | `chooseMilitarizationPath(state, 'militia_autonomy')` |

**一个已经存在的意外之喜**：`policyDefinitions.ts` 的 `LAW_STANCE_PREFERENCES` 早就把这两条路线的政治含义编码好了——

| 派系 | 对 L3 共和国人民军 | 对 L4 民兵纵队体系 |
|---|---:|---:|
| **CNT_FAI** | **−4** | **+10** |
| **PCE** | **+10** | +1 |
| PSOE | +5 | +3 |
| IR | +6 | +1 |

也就是说：**选人民军会自动拉低 CNT 自己的法律满意度、抬高 PCE 的**；选武装民兵反之。而 `getPartyLawSatisfaction(state, member).overall * 0.1` 正是战时联盟贡献度的一个乘区（`wartimeCoalition.ts:124`）。所以这个选择的联盟后果**不需要新代码**，只要日志完成时写入法律等级就会自动生效。

事件由 `activationEventId` 接管日志激活（`rules/journalEvents.ts` 的既定契约），`checkStatus` 不得自行返回 `active`。

### 6.3 人民军日志 `journal_popular_army`

**按月效果（`activeEffect.apply`）**

| 效果 | 实现 |
|---|---|
| PCE 在工人中的支持率 **+10/12** | `adjustClassSupport(classes, 'Obreros', 'PCE', 10 / 12)` |

**完成条件（`checkStatus` → `'completed'`）**

```text
militarization.cnt > 85            且            domesticPolicy.militia_legality_law >= 4
```

**失败条件（`checkStatus` → `'failed'`）**

```text
monthIndex(state) >= monthIndex(militarizationPaths.chosenAt) + 24      // 日志触发满 24 个月
```

失败效果：**CNT 在战时人民阵线中的承诺度 −40**。

```ts
{
  id: 'journal_popular_army',
  title: 'The People\'s Army', titleZh: '人民军',
  activationEventId: 'militarization_crossroads',
  completionEventId: 'popular_army_formed',
  failureEventId: 'popular_army_stalled',
  hasProgress: true, progressMax: 100,
  // 进度条从完成条件派生：取两个条件里更紧的那一条
  getProgress: (state) => Math.min(
    (getMilitarization(state, 'cnt') / 85) * 100,
    (state.domesticPolicy.militia_legality_law / 4) * 100,
  ),
  successCondition: 'CNT 民兵军事化率超过 85，且民兵合法性法达到 4 级',
  successEffectDesc: '各党派民兵池并入共和军池；军队改革法跳到「共和国人民军」',
  failureCondition: '日志触发满 24 个月仍未完成',
  failureEffectDesc: '整编失败，CNT 在战时人民阵线中的承诺度 −40',
}
```

`onComplete`：**只做两件事**——

```ts
onComplete: (state) => ({
  ...mergeMilitiaPoolsIntoStateArmy(state),          // §6.6
  domesticPolicy: { ...state.domesticPolicy, army_reform_law: 3 },
})
```

**这个 24 个月期限就是整条路线的张力所在**：`cnt` 从 17 练到 86 需要 69 点，而最有效的杠杆是 `militia_reorg`（冷却仅 1 个月、每次 +8、代价 1 军备 + Puristas 异议 +10）。也就是说**必须在两年内几乎不间断地推**，同时还得把一条目前根本推不动的法律（民兵合法性，见 §6.5）搞到 4 级。做不到就是承诺度 −40 的硬着陆。

### 6.4 武装民兵日志 `journal_militia_autonomy`

**按月效果（`activeEffect.apply`）**

| 效果 | 实现 |
|---|---|
| 苏联好感度 **−5/12** | `relations.ussr − 5/12`（下限 0） |
| PCE 对 CNT 关系 **−10/12** | `partyRelations.PCE − 10/12`（下限 0） |
| CNT 在战时人民阵线中的承诺度 **−1** | `coalition.memberContributions.CNT_FAI − 1` |

**完成条件（`checkStatus` → `'completed'`）**

```text
场上归属 CNT 的民兵单位数 >= 8     且      domesticPolicy.militia_legality_law >= 4
```

**失败条件（`checkStatus` → `'failed'`）**

```text
militarization.cnt > 60
```

失败效果：**Puristas 异议度 +25**。

```ts
{
  id: 'journal_militia_autonomy',
  title: 'Militia Columns', titleZh: '民兵纵队',
  activationEventId: 'militarization_crossroads',
  completionEventId: 'militia_columns_secured',
  failureEventId: 'militia_columns_absorbed',
  hasProgress: true, progressMax: 100,
  getProgress: (state) => Math.min(
    (countCntMilitiaUnits(state) / 8) * 100,
    (state.domesticPolicy.militia_legality_law / 4) * 100,
  ),
  successCondition: '场上至少 8 支归属 CNT 的民兵单位，且民兵合法性法达到 4 级',
  successEffectDesc: '军队改革法跳到「民兵纵队体系」；各党派保有独立武装',
  failureCondition: 'CNT 民兵军事化率超过 60',
  failureEffectDesc: '民兵被事实性地正规化，纯粹派异议度 +25',
}
```

`onComplete`：

```ts
onComplete: (state) => ({
  domesticPolicy: { ...state.domesticPolicy, army_reform_law: 4 },
})
```

**池不动**——这正是这条路线的实质。各党派保留自己的池，未来的新兵继续带自己的 `identity`。

#### "归属 CNT 的民兵单位"的精确定义

代码里有两种判据，取**与联盟军事份额同一套逻辑**的那一种：

```ts
export const countCntMilitiaUnits = (state: GameState): number =>
  (state.armies || []).filter(army =>
    getArmyPoliticalMember(army) === 'CNT_FAI'
    && (army.faction === MapFaction.REPUBLICAN || army.faction === MapFaction.IBERIAN_DEFENSE)
    && army.manpower > 0
  ).length;
```

用 `getArmyPoliticalMember` 而不是手写 `sourceEntityId === 'cnt_defense_committees'`，有两个好处：

1. 它同时覆盖 `sourceEntityId: 'cnt_defense_committees'`（从 CNT 池募来的）与 `identity: 'cnt'`（政治身份）两种来源（`wartimeCoalition.ts:74-87`）。
2. 与 `getWartimeCoalitionPower` 用完全相同的归属判断，所以"我在联盟里的民兵份额"和"我离完成条件还差几支"永远一致，不会出现两个口径。

### 6.5 这条设计带来的四个问题（四个都已解决）

#### ✅ 问题 1：`militia_legality_law` 达到 4 级——已由**事件链**补上（2026-09-24 实装）

**问题原本是什么。** 两条日志的完成条件都要求 `militia_legality_law >= 4`，但这条法律是**零写入者**：三份剧本都把它停在 1 级，`policyDefinitions.ts` 里 L2–L4 虽然写了月度效果，却没有任何东西能把法律推到那儿。**两条路线因此永远完不成。**

**已确认的路线：由【事件】推动，不由卡牌。** 曾经实现过一张 `militia_legality` 行动卡（四级阶梯 + 维持现状，4 个月冷却），已按这个决定删除。

**现在的实现：`src/game/events/civil_war/militia_legality.ts`，三个一次性历史事件。**

| 事件 id | 名称 | 条件 | 接受后的效果 |
|---|---|---|---|
| `militia_legality_armed_unions` | 武装工会法令（→ L2） | 内战开局后 **1** 个月，法律 = 1 | 法律 → 2；`applyControlInfluence(state, 3, {land:0.3, industry:0.7})`；Faistas −6、Treintistas +6；权威 −6、热情 +5 |
| `militia_legality_rear_security` | 后方民兵治安统合（→ L3） | 内战开局后 **4** 个月，法律 = 2 | 法律 → 3；`applyControlInfluence(state, 5, {land:0.3, industry:0.7})`；PCE 关系 +10、PSOE +5；Faistas/Puristas 各 +6；权威 −5 |
| `militia_legality_committee` | 反法西斯民兵委员会（→ L4） | 内战开局后 **8** 个月，法律 = 3 | 法律 → 4；`applyControlInfluence(state, 8, {land:0.3, industry:0.7})`；Faistas −10、Treintistas +8；PCE −10、PSOE −6、苏联 −5；权威 −10、热情 +8 |

**四个设计要点：**

1. **时间锚点是 `civilWarSetupCompletedAt`，不是各自的解决时间。** `eventHistory` 只记 id 不记日期，`JournalState` 也没有时间戳。三个事件分别在内战开局完成后第 1 / 4 / 8 个月评估，阶梯因此一定走在「人民军还是武装民兵」那条抉择的附近，给 24 个月期限留出余量。用的是 `>=` 而不是 `===`，被别的事件占住时会顺延到下个月。
2. **阶梯的形状比速度重要。** L2 是"承认民兵存在"，L3 是"把后方治安交给他们"（PCE 的偏好：把民兵并入国家机器，立场分 9），L4 是"承认一个工团主义的平行治安机构"（CNT 的偏好，立场分 10，而 PCE 只有 2）。每一级都可以拒绝，**拒绝就停在原地，整条链走死**——这意味着 `army_reform_law` 的 L3/L4 也一起够不着。两个"拒绝"选项的副标题都明说了这一点。
3. **每一级都写所有权系统。** 那三个 `applyControlInfluence` 向量正是被删除的那张卡留下的接口（§4.5 表的 10a / 10b 行），现在挂回这里，`docs/工人控制度改造方案.md` §4.5 不再是未落实状态。
4. **不进内战开局链。** 开局链已经有 30+ 步，再插三个选项会让它在最混乱的月份里更拥挤；作为独立定时事件，玩家也会更清楚地看到"这是关于民兵合法性的一次决定"。

**L1–L4 的月度效果**（法律自己的效果，与谁推动它无关）：

| 等级 | 名称 | 月度效果 |
|---|---|---|
| L2 | 武装工会法令 | 民兵派系军事化率 +0.2 |
| L3 | 后方民兵治安统合 | 民兵派系 +0.3；共和国权威 −0.3 |
| L4 | 反法西斯民兵委员会 | 民兵派系 +0.4；革命热情 +0.5；共和国权威 −0.5 |

注意 L4 与 `army_reform_law` L4「民兵纵队体系」必须区分：前者是**治安机关的民兵化**（警察→工人巡逻队），后者是**野战军的民兵化**。

**验证**：`scripts/test-wartime-politics.tsx` 有 4 项检查覆盖这条链（逐级开合与时机、每月队列真的能捞出它、走通三级后端到端解锁两条日志、拒绝后永久关闭）。

#### ⚠️ 问题 2：进度条字段与 `advanceMilitarizationPath` 变成死代码（已解决）

新规格用的是**状态条件**，不是进度累积。因此：

| 符号 | 处置 |
|---|---|
| `militarizationPaths.popularArmyProgress` / `militiaAutonomyProgress` | **已删除**（`getProgress` 改为从条件派生，见上） |
| `advanceMilitarizationPath`（Phase 1 新建） | **已删除** |
| 6 张卡里的 `advanceMilitarizationPath(s, N)` 调用 | **已删除**（`military_training` / `military_policy` / `police_affairs` / `militia_reorg`×2 / `aragon_front` / `anarchy_tanks`） |
| `militarizationPaths.chosenAt` | **保留**——人民军的 24 个月期限需要它 |

这是我上一轮刚建好的东西，现在要拆掉一部分。之所以值得拆：留着两个永不被读的进度字段、和一个永不被消费的推进函数，正是上一轮审计里 P0-4 那类"看起来像已实现"的误导源。

#### ⚠️ 问题 3：`JournalState` 没有时间戳，24 个月期限只能挂在 `chosenAt` 上（已按此实现）

```ts
export interface JournalState { id: string; status: JournalStatus; progress: number; failureProgress?: number }
```

`failureProgress` 是计数器，不是日期。所以人民军的"触发满 24 个月"要用 `militarizationPaths.chosenAt`（Phase 1 已加）作为锚点。两条日志共用同一个 `chosenAt`（因为路线二选一、同时激活），语义自洽。

**落地细节**：`popular_army.ts` 的失败判定是 `monthIndex(state) >= monthIndex(chosenAt) + 24`，`monthIndex = year * 12 + month`。`JournalState` 本身**没有**加时间戳字段——如果将来还需要别的期限，应该先考虑加一个通用的 `activatedAt`，而不是再挂第二个锚点。

#### ⚠️ 问题 4：武装民兵的失败条件会和选项目打架（已按建议解决）

失败条件是 `cnt > 60`。但玩家在**和平期**完全可能已经把 `cnt` 推到 70（`militia_reorg`「正规化训练」+5 /「操练联合民兵」+2、Durruti +5/6月、Aurelio +3/6月）。那样他选完 B，**下个月立刻失败**——等于走进陷阱，而且是不可撤销的 −25 Puristas 异议。

**解决方式（已实现）：给选项 B 加 `getMilitarization(state, 'cnt') <= MILITIA_AUTONOMY_CEILING`（=60）的 `condition` 与 `unavailableSubtitle`**，让玩家在门口就知道自己已经把自治这条路练没了；而 `cnt > 60` 的失败条件专门用来惩罚"选了自治之后又把民兵练过头"。

- `unavailableSubtitle`: `The CNT militia is already too well organised for autonomy (militarization 60 or below required).`
- `unavailableSubtitleZh`: `CNT 民兵组织度已经太高，自治路线不再可行（需要军事化率不超过 60）。`

> **一处需要注意的相互作用**：`prepare_for_revolution`「武装民兵」带**和平期天花板 40**，所以它单独推不到失败线；但 `militia_reorg` 没有任何和平期上限，仍能把 `cnt` 在开战前推过 60。选项 B 的 `condition` 因此是玩家唯一的护栏——**它必须在总事件渲染前就生效**，否则这道闸门形同虚设。

### 6.6 两条日志的判定细节

**完成优先于失败。** `checkStatus` 只能返回一个状态，若同一月既满足完成又满足失败（人民军第 24 个月恰好把 `cnt` 练过 85），按既有的土地改革写法**先判完成、再判失败**（`land_reform.ts:26-29`）。这对玩家更友好，也符合"冲线"的直觉。

**`checkStatus` 只在 `active` 时判定。** 声明了 `activationEventId` 的日志不会自行激活（`isEventMediatedJournal`），所以条件判定天然只作用于已激活的日志——不需要额外守卫。

**需要新建一个 helper**：`adjustMemberContribution(state, member, delta)`。现在全库没有这个函数，`memberContributions` 只在 5 处被读、在 `mayDays.ts:104` 被整块展开写过。承诺度是本设计里最重的资源（−1/月、失败 −40），值得有自己的写入口，而不是让两条日志各自手写展开。

### 6.7 日志的落点是 `army_reform_law` —— 但 L3/L4 目前是空壳

这是本设计**最重要的一处前置依赖**。

`army_reform_law` 的 L3「共和国人民军」与 L4「民兵纵队体系」在 `policyDefinitions.ts:201-202` 上写着 `No monthly effects`，而且**现在根本不可达**（全库只有 `azana_military_reform` +1 与 `la_sanjurjida` →1，最高到 L1）。

所以"跳到共和国人民军"如果直接实现，**玩家只会看到一个标签变化**，没有任何游戏效果。必须先把 L3/L4 填上。

**建议的效果表**（把路线的长期后果放进法律，而不是塞进日志的 `onComplete`——这样"法律拥有自己的效果"这条既有原则不被破坏）：

| 等级 | 名称 | 月度军事化效果 | 其他月度效果 |
|---|---|---|---|
| **L3** | 共和国人民军 | **`gov` +0.5** | 共和国权威 +0.5 |
| **L4** | 民兵纵队体系 | **`cnt`/`ugt`/`poum` +0.5**；**`gov` −0.3** | 革命热情 +0.5；共和国权威 −0.5 |

读法：**L3 让国家军队变强；L4 让民兵变强，代价是国家军队与中央权威一起受损**（军官团被冷落 → `gov` 衰减）。这是两条路线的核心权衡，一眼可懂。

**连带要改的一处**：§3.5 原先规定"路线惯性由日志状态驱动"。既然落点是法律，惯性就该由**法律等级**承载（已落地为 `policyDefinitions.ts` 的 `militarization` modifier，见 §3.5 末端）：

- 惯性写在 `army_reform_law` 的 L3/L4 上，不另建函数、不另开管线阶段
- 日志的 `activeEffect` 只负责**政治效果**（PCE 支持率 / 苏联关系 / 承诺度），不再碰军事化率
- 二者因此不重叠

这也顺带解决了我上一轮审计里标记的 P0-4：**`army_reform_law` 从此有了真实的、可达的高等级**——它只能由这两条日志之一写入，而这正是设计想要的（制度等级不由重复卡购买）。

需要一个新的策略修正类型：

```ts
| { kind: 'militarization'; group: ArmyIdentity; delta: number }
```

### 6.8 池统一的精确规则

`onComplete` 里的 `mergeMilitiaPoolsIntoStateArmy(state)`：

**并入的池**（正好等于 `warSetup.ts` 的 `MOBILISED_MILITIA_ENTITIES`）：

| 池 | 归属 |
|---|---|
| `cnt_defense_committees` | CNT-FAI |
| `ugt_socialist_militias` | UGT/PSOE |
| `maoc` / `fifth_regiment` | PCE |
| `poum_militias` | POUM |

**明确排除的两个**：

| 池 | 排除理由 |
|---|---|
| `international_brigades` | 外国志愿者，不是西班牙民兵；且 `spendMilitiaPoolManpower` 对它有专门分支（同步写 `state.internationalBrigades`），并入会破坏该不变量 |
| `euzko_gudarostea` | 巴斯克自治政府保有本军，1937 年前并未并入人民军；保留它也给 PNV 一个不退出的理由 |

**操作**：人力 / 火炮 / 坦克全部转入 `republican_state`，被并入的池清空并把 `status` 置为既有的 `'integrated'`。

**四条必须让玩家看见的连带后果**——这不是"改个数字"，它会改变整场战争的形态：

1. **这些池不能再募兵**。`getMilitiaRecruitmentPools` 会返回 0 人，各党派的独立征兵入口消失（UI 需要显示"已并入共和军"而不是空白，否则玩家会以为卡了）。
2. **新募单位一律 `identity: 'gov'`**，于是使用 `militarization.gov`（初始 85）而不是 `militarization.cnt`（初始 17）。**这就是这条路线的军事回报，量级约 5 倍。**
3. **现有地图单位不受影响**：它们保留原 `identity` 与 `sourceEntityId`。老纵队仍是老纵队、仍按 `cnt` 的率作战。这是刻意的——历史上旧纵队与新建的混成旅长期并存。
4. **战时联盟凝聚力会显著下跌**。`getArmyPoliticalMember` 对 `sourceEntityId === 'republican_state'` 返回 `null`，于是 `getWartimeCoalitionPower` 里各成员的 `effectiveManpower` 骤降、`militaryIndex` 崩掉、贡献度随之下降，而 `cohesion` 是贡献度之和（`wartimeCoalition.ts:151`）。

第 4 条是本设计里最锋利的一刀，也可能是最需要你确认的一处：**选人民军在军事上大幅变强，却会亲手拆掉自己在联盟里的军事发言权。** 这在史实上是对的（1937 年 CNT 抵制军事化，正是因为整编会瓦解它的独立力量），但它会让选项 A 看起来很"自罚"。

三种处理方式：

- **(a) 接受**（推荐）：这正是"人民军"的历史代价。L3 给的 `共和国权威 +0.5/月` 是部分补偿，且凝聚力危机本就是战时政治的主线。
- **(b) 让 `getArmyPoliticalMember` 把 `republican_state` 单位按联盟权重分配给各成员**——机制更温和，但会抹掉上面那一刀的政治含义。
- **(c) 给 `onComplete` 追加一次性凝聚力补偿**——最省事，但也是最能被玩家看穿的补丁。

### 6.9 卡牌的位置变了：不再推进路线，只推军事化率与法律

**这是新规格带来的一处收缩。** 旧设计里 6 张卡带 `advanceMilitarizationPath(s, N)` 来推进路线进度条；既然完成条件改成了**状态条件**（`cnt > 85` / 8 支部队 / 法律 4 级），路线进度就不存在了。因此 `advanceMilitarizationPath` 与两个 `*Progress` 字段**要删掉**，6 处卡牌调用一并移除（§6.5 问题 2）。

删掉之后，卡牌在这套机制里的角色反而更清楚了：**它们是玩家达成完成条件的唯一工具**——把 `cnt` 练过 85、把 8 支 CNT 部队摆上地图、把民兵合法性推到 4 级，全靠它们。

| 卡 | 选项 | 军事化率 | 对完成条件的贡献 |
|---|---|---|---|
| `militia_reorg` | 正规化训练（−1 军备） | `cnt` +5 | **主力**：冷却仅 1 个月，可在 24 个月内反复推 |
| `militia_reorg` | 建立突击营（−1 军备） | `cnt` +8 | 更快，但 Puristas 异议 +10——与人民军路线的失败风险同向 |
| `militia_reorg` | 招募民兵（−1 军备） | —— | **+1000 人且 Puristas 异议 −5**；凑满 8 支部队靠它 |
| `militia_reorg` | 操练联合民兵（**由 `military_training` 并入**） | `cnt` +2、Faistas 异议 +4 | 无资源代价，是这张卡里唯一"不花军备也能推进度"的选项 |
| `militia_reorg` | 让民兵自行其是 | `cnt` −1、革命热情 +1 | 反向选项，武装民兵路线用它给 `cnt` 泄压 |
| `aragon_front` | 整顿纪律 | `cnt` +5 | |
| `anarchy_tanks` | 坦克研究成功 | `cnt` +6、`pce` +6 | 一次性 |
| `prepare_for_revolution`（**和平期专属**，防御委员会成立后才出现） | 武装民兵（−1 军备，最多 3 次） | `cnt` +2 | **和平期天花板 40**：`adjustMilitarization(state, 'cnt', 2, 40)`。所以它推不到失败线，但能在开战前把民兵组织度垫到 40 |
| 同上 | 破坏反动派（−1 军备，最多 3 次） | `requetes`/`falange` −2 | **这是全库唯一能动右翼军事化的杠杆**——它让"开战前削弱国民军的质量"成为一个可操作的战略 |
| `military_policy`（**新增选项**「整军演习」） | 需 CNT 掌战争部 | `gov` +3 | 走人民军路线时抬 `gov`，不抬 `cnt` |
| `police_affairs`（**新增选项**「警队训练」） | 需 1 军备 | `gov` +4 | 同上；注意它与政府军共用同一个率 |
| `militia_legality_*` 三个事件（**不是卡**） | 见 §6.5 问题 1 | —— | **民兵合法性法的推进链已由事件补齐**，每一级附带 `applyControlInfluence` |

> **2026-09 改动：** 原先独立的行动卡 `military_training`（操练联合民兵／让民兵自行其是，6 个月冷却）**已删除**，两个选项整体并入 `militia_reorg`。理由是路线推进与民兵训练本来就是同一件事，分成两张卡只会让玩家在两个冷却之间来回等，并且 `militia_reorg` 6 个选项正好覆盖两条路线的全部动作。并入后 `militia_reorg` 的顶层 effect 设置 `militia_reorg_timer: 1`（1 个月冷却），代价与收益的对称关系见下。

**一个由此浮现的设计张力**：`militia_reorg` 是抬 `cnt` 最有效的工具（+8/月），但它同时让 Puristas 异议 +10。而人民军路线的失败效果是承诺度 −40、武装民兵路线的失败条件是 `cnt > 60`。所以：

- 走**人民军**：必须猛刷 `militia_reorg`，政治代价是 Puristas 异议飙升
- 走**武装民兵**：必须**克制**地刷它（别让 `cnt` 超过 60），却又得靠它多募兵凑满 8 支部队——而「招募民兵」选项 **+1000 人且 Puristas 异议 −5**，正好是"要人不要组织度"的那一半

也就是说 `militia_reorg` 这一张卡，前后两组选项恰好对应两条路线各自的玩法。这是现有内容里意外形成的对称，建议保留并在卡面文案里点明。并入 `military_training` 之后这层对称更完整了：「操练联合民兵」（`cnt` +2、无资源代价）与「让民兵自行其是」（`cnt` −1、革命热情 +1）正好是"细水长流地练"与"主动泄压"这两手，而它们都不需要花军备——所以和平期攒不下军备时，这张卡仍然可用。

### 6.10 顾问

顾问不新建结构，只在既有的 `Advisor.actions[]`（每个行动是「一次性效果 + 6 个月 `advisorActionTimer` 冷却」）上挂军事化率。三位军方顾问分别对应三条互不重叠的路线：

| 顾问 | 行动 | 军事化率 | 设计理由 |
|---|---|---|---|
| **奥雷利奥·费尔南德斯**（FAI，防御委员会） | 统筹防御治安侦察 | **`cnt` +3** | 他为联合民兵建立了它原本没有的指挥与情报结构，却没有把它变成军队 |
| **梅尔乔·罗德里格斯**（红色天使，管教与治安） | 践行人道底线救赎 | **`gov` +2** | 唯一能让国家自身的强制机关像制度而非私刑的安那其主义者；警察与政府军共用 `gov` |
| **布埃纳文图拉·杜鲁蒂**（FAI，杜鲁蒂纵队） | 组织工人国民军 | **`cnt` +2** | 只发枪不操练：人数上去，组织度几乎不动 |
| 同上 | 革命纪律 | **`cnt` +5** | 卡面原文就是"即使这意味着采用传统的军事纪律"——顾问能做到的单次最大民兵军事化 |

三条路线互不冲突但共享同一个 6 个月冷却：玩家每半年只能推其中一条一次，所以"由谁来练、练谁"本身就是一个选择。

> 与旧稿的差异：早先版本给的是「正规军 readiness +3/月」「警察 morale +5」这类 per-unit 数值，那是已被否决的 per-unit 模型。本表是适配每派系军事化率之后的版本，主题归属也重新做过（例如杜鲁蒂**不会**去提升正规军，他是提升民兵）。

---

## 7. PCE 独立路径

**核心张力：当你（CNT）还在争论要不要军事化时，PCE 已经把自己的民兵练成正规军了。**

PCE 的军事化提升**不受 CNT 的路线选择影响**：

```text
自动（内战进行中且 partyRelations.PCE >= 40）：
  每月 militarization.pce += 0.40
  每月 militarization.intl += 0.30

事件：
  fifth_regiment 成立                     → pce +10
  internationalBrigadesFormed 转为 true   → intl +8
  MAOC 并入第五团                          → pce +5

CNT 可选立场（新增卡选项）：
  支持军事化 → pce +5、intl +3、PCE 关系 +5、Faistas 异议 +3
  抵制军事化 → pce −5、PCE 关系 −10、革命热情 +3
```

上限：`pce` 与 `intl` 均可达 85（不受任何路线上限约束——这是 PCE 独立路线的意义）。

**与 §6.6 池统一的交叉（必须一并处理）**：若玩家选了**人民军**路线，`maoc` 与 `fifth_regiment` 会被并入 `republican_state`，于是——

| 仍成立的 | 被削弱的 |
|---|---|
| `militarization.pce` 继续影响**已有的** PCE 地图单位（它们保留 `identity: 'pce'`） | 无法再从这两个池募到带 `pce` 身份的新兵；PCE 的军事份额随时间自然萎缩 |
| `international_brigades` **不在并入集合内**（§6.6），`militarization.intl` 与 PCE 的国际纵队份额完整保留 | PCE 在本土的独立军事基础被拆掉——这正是它用"支持人民军"换来的东西 |

所以人民军路线与 §7 并不矛盾，而是一种**交易**：PCE 拿独立民兵换统一指挥，且它的国际纵队仍然只属于它。这也让"PCE 关系 +10"（§6.2 选项 A）有了实际代价支撑，而不是白送的善意。

数据依据：PCE 的民兵池是 `maoc` 与 `fifth_regiment`（`ENTITY_IDENTITY` 均映射到 `'pce'`），国际纵队池 `international_brigades` 的 `owner` 也是 PCE（`organizations.ts:590`），且 `getArmyPoliticalMember` 把 `international_brigades` 归给 PCE（`wartimeCoalition.ts:78`）。

#### ✅ Phase 4 完成记录（2026-09-24 实装）

| 环节 | 落点 | 说明 |
|---|---|---|
| 常月增长 | `rules/militarization.ts` 的 `getPceMilitarizationMonthlyDrift` / `applyPceMilitarizationMonthlyDrift` | 纯查询 + 应用两步，仍然走 `adjustMilitarizations` 唯一写入口。条件是 `activeWar === 'spanish_civil_war' && civilWarStatus === 'ongoing'` 且 `partyRelations.PCE >= PCE_MILITARIZATION_RELATIONS_FLOOR`（40） |
| 月度接线 | `rules/monthlyPipeline.ts` 的 `applyMonthlyPoliticalMaintenance` | **没有**写进 `policyDefinitions`——它根本不是共和国的政策，而是共产党的自主行为。这是"法律承载月度演化"原则的唯一例外，例外本身就是设计 |
| MAOC 成立 | `events/maoc_formation.ts` | `pce` +10（`MAOC_MILITARIZATION_GAIN`）。史实上它是西班牙第一支"组织起来"的党派民兵 |
| 国际纵队成军 | `rules/phaseOrchestrator.ts` | `intl` +8（`INTERNATIONAL_BRIGADES_MILITARIZATION_GAIN`）。判的是**布尔值的跃迁**（`!state.internationalBrigadesFormed && newIntBrigadesFormed`），所以只发生一次 |
| CNT 立场 | `action_affairs/inter_party_relationships.ts` 新增两个选项 | 「当成称赞」= `pce` +5、`intl` +3、PCE 关系 +5、Faistas 异议 +3；「当成警告」= `pce` −5、PCE 关系 −10、革命热情 +3。两项都只在**内战进行中**出现 |

**四处实现判断：**

1. **`intl` 的常月增长与一次性跃升分开写。** 前者是 PCE 在战争期间持续整训国际志愿者，后者是国际纵队第一次成军。合在一起会让"国际纵队什么时候成立"这个历史节点消失在一条斜线里。
2. **关系门槛设在 40，且是 `>=`。** 低于它 PCE 就自己单干——军事化反而停滞。这让 CNT 的"抵制"立场（PCE 关系 −10）有了实际军事后果，而不只是好感度数字。
3. **不设额外的派系上限。** `pce` 与 `intl` 走和其他派系一样的 10–100 区间，"独立路线"体现在**不受 CNT 路线选择影响**，而不是体现在更高的天花板。
4. **立场选项挂在「与政党之间的关系」卡上，而不是新建一张卡。** 这张卡本来就是 CNT 与各党派打交道的入口（第 4 个选项已在谈与革命马克思主义者的合作），加两个战时专属选项比新开一张军事卡更自然；同时它们只在开战后出现，不会污染和平期的牌堆。

**与 §6.8 池统一的交叉已在代码里自洽**：走人民军路线时 `maoc` 与 `fifth_regiment` 被并入 `republican_state`，`militarization.pce` 仍然作用于已有的 `identity: 'pce'` 地图单位，而 `international_brigades` 不在并入集合内——所以 PCE 的国际纵队份额与 `militarization.intl` 完整保留。这正是"PCE 拿独立民兵换统一指挥"那笔交易在数据上的样子。

**验证**：`scripts/test-wartime-politics.tsx` 的 3 项检查（该文件现 **24 项**）——常月增长的门槛/战时性/不受路线影响、月度维护阶段真的调用它、MAOC 与国际纵队各自只给一次、以及两个立场选项的战时门禁与数值。

---

## 8. 政府军 + 警察共用一个率（已确认）

`militarization.gov` 同时服务政府军与警察，这一点已在代码里核实：

- `formationToArmy`（`map_constants.ts:484`）给全部编制表部队 `identity: 'gov'`
- `applyCivilWarLoyaltySplit` 把警队人力按忠诚切分进 `mapResources[faction].manpower`
- 从该池募兵产生的单位（`mapReducer.ts:226`、`mapAiTurn.ts:200`）**同样是 `identity: 'gov'`**

所以共用一个率在数据上自洽，不需要任何额外桥接。

**需要知情的一个耦合**：警察事务卡与军事政策卡会推同一个 `militarization.gov`，两条线互相蹭车——

- 为了治安而练警察 → 政府军军事化率一起涨 → 开战后正规军更强
- 为了政变安全而削弱军队 → 警察也跟着变弱 → 治安恶化

这个耦合是有趣的设计而不是缺陷：它意味着"治安投入有军事外溢"，玩家无法把国家武装力量拆成两个互不相干的抽屉。**警察的独立性由 `loyalty` 承担**（决定开战时倒向哪一方），与军事化率正交。

（备选方案是把 `gov` 拆成 `gov` + `police`，开战时按人力加权并入 —— 已否决，不再列为选项。）

---

## 9. 存档迁移（`saveMigrations.ts`）

| 缺失字段 | 默认值 |
|---|---|
| `militarization` | §3.2 的初始值表；若旧存档有 `militiaCombatPower`，民兵各项按 `+ (值−100) × 0.5` 折算 |
| `militarizationPaths` | `{ chosen: 'none', popularArmyProgress: 0, militiaAutonomyProgress: 0 }` |
| `journal['journal_popular_army']` / `['journal_militia_autonomy']` | 由 `JOURNAL_ENTRIES` 循环自动创建（`scenarios/base.ts:26` 的现有机制） |
| 旧 `militiaCombatPower` | 折算后删除 |

> 士气不需要迁移：`Army.morale` 字段早已存在，编制表部队沿用各自的值，民兵新单位用常量 60。

`journal` 的初始化是 `JOURNAL_ENTRIES.reduce(...)`（`scenarios/base.ts:26-34`），所以新日志只要加进 `journal/index.ts` 的注册表就会自动获得状态槽，无需改迁移逻辑。

---

## 10. UI

| 位置 | 改动 |
|---|---|
| `SidePanel.tsx`「武装情况」 | **新增「军事化率」区块**：9 个派系一行一个进度条 + 数值。这是本系统的核心面板，`militiaCombatPower` 以前完全不可见的问题在这里修掉 |
| `SidePanel.tsx` 正规军每一行 | 常显 `士气 80`，并显示所属派系的军事化率（`gov 85`） |
| `SidePanel.tsx` 准军事组织 | 加派系军事化率（士气只在开战后按单位显示） |
| `JournalPanel.tsx` | 两条新日志自动渲染（复用现有进度条组件与 `failureProgress` 支持） |
| `map/Sidebar.tsx` | 选中单位时显示 `派系 · 军事化率 · 士气 · 战力 · 战宽占用`，让玩家看懂"为什么人多却打不过" |
| `effectPreview.ts` | 加 `militarization` / `militarizationPaths` 的中英标签与 diff 渲染 |
| `SandboxMenu.tsx` | 提供 `militarization` 各派系与 `militarizationPaths.chosen` 的直接编辑 |

---

## 11. 实现清单

| 文件 | 改动 |
|---|---|
| `src/game/rules/militarization.ts` | **新建**。唯一写入者：`adjustMilitarization`、`getMilitarizationMultiplier`、`advanceMilitarizationPath`、初始值表、月度演化 |
| `src/game/types.ts` | `GameState` +`militarization` +`militarizationPaths`；删除 `militiaCombatPower`。**不新增任何士气字段** |
| `src/game/journal/popular_army.ts`、`militia_autonomy.ts` | **新建**两条日志 |
| `src/game/journal/index.ts` | 注册两条日志 |
| `src/game/events/civil_war/militarization_crossroads.ts` | **新建**总事件 + 三个结果事件（`popular_army_formed` / `popular_army_stalled` / `militia_autonomy_secured`） |
| `src/game/rules/combat.ts` | 按 §5.3–5.5 重写：战宽优先级排位、基础战力、军事化系数查表、`1+士气/100`、防守系数、攻守不对称预备队、相对损失率 |
| `src/game/rules/warSetup.ts` | `applyPeacetimeMobilization` 改用 `militarization`，民兵出生士气写 60；删除 `READINESS_PER_COMBAT_POWER` |
| `src/map/map_constants.ts` | 编制表 `militarization` 字段删除（改由 `gov` 统一提供），**保留 per-formation `morale` 作为出生值** |
| `src/game/military_affairs/militia_reorg.ts`、`aragon_front.ts`、`anarchy_tanks.ts` | 4 个选项按 §3.6 改造 |
| `src/game/government_affairs/military_policy.ts`、`police_affairs.ts` | 各新增一个选项 |
| `src/game/action_affairs/military_training.ts` | **新建**民兵训练卡，登记进 `action_affairs/index.ts`（⚠️ 后已删除，选项并入 `militia_reorg`，见 §6.9） |
| `src/game/rules/monthlyPipeline.ts` | 新增军事化月度演化阶段（§3.5）与日志 `activeEffect` 钩子 |
| `src/game/scenarios/base.ts` | 删除 `militiaCombatPower: 100`，加两个新字段初值 |
| `src/game/saveMigrations.ts` | §9 的迁移 |
| `src/game/effectPreview.ts`、`selectors.ts`、`components/SidePanel.tsx`、`map/Sidebar.tsx`、`components/SandboxMenu.tsx` | UI |

**Phase 3 的文件清单（按 §6 的新设计更新）**

| 文件 | 改动 |
|---|---|
| `src/game/rules/wartimeCoalition.ts` | 新增 `isMilitarizationCrossroadsDue(state)`（§6.1） |
| `src/game/events/civil_war/militarization_crossroads.tsx` | **新建**。总事件 + 三个结果事件（`popular_army_formed` / `popular_army_stalled` / `militia_columns_secured`）；选项 B 加 `cnt <= 60` 的 condition（§6.5 问题 4） |
| `src/game/journal/popular_army.ts`、`journal/militia_autonomy.ts` | **新建**两条日志（§6.3 / §6.4）；注册进 `journal/index.ts` |
| `src/game/rules/armyPools.ts` | **新建**。`mergeMilitiaPoolsIntoStateArmy(state)` + `countCntMilitiaUnits(state)`（§6.6 / §6.8）；纯函数 |
| `src/game/rules/wartimeCoalition.ts` | 另加 `adjustMemberContribution(state, member, delta)` helper（现无此函数） |
| `src/game/rules/policyDefinitions.ts` | 给 `army_reform_law` L3/L4 填月度效果（§6.7）；**另给 `militia_legality_law` L1–L4 填效果并补推进链**（§6.5 问题 1）；新增 `PolicyModifier` 的 `militarization` kind |
| `src/game/rules/militarization.ts` | `calculateMilitarizationDrift` 改为读 `army_reform_law`；**删除** `advanceMilitarizationPath`、两个 `*Progress` 字段的写入路径，以及（按裁决）`MILITIA_AUTONOMY_CEILING` / `getMilitarizationCeiling` |
| `src/game/types.ts` | `MilitarizationPaths` 去掉两个 `*Progress`、保留 `chosen` 与 `chosenAt` |
| 6 张卡（`military_training`/`military_policy`/`police_affairs`/`militia_reorg`×2/`aragon_front`/`anarchy_tanks`） | **移除** `advanceMilitarizationPath` 调用；`militarization` 效果保留 |
| `src/game/rules/monthlyPipeline.ts` | 把 `calculateMilitarizationDrift` 接进管线（现在它**从未被调用**） |
| `src/game/registries/scheduledEventRegistry.ts` | 注册新事件 |
| `scripts/test-*.ts` | 两条日志的完成/失败判定（含 24 个月期限与完成优先）、池合并的资产守恒与身份后果、`countCntMilitiaUnits` 的口径 |

**建议实施顺序**（**五步均已执行完毕，2026-09-24**；下表保留当时的分期与理由）

1. **Phase 1 — 数据与公式**：`militarization.ts` + 类型 + 迁移 + `combat.ts` 重写。此时军事化率已经是战斗的真实输入，但还没有杠杆。
2. **Phase 2 — 杠杆**：改 5 张现有卡 + 新建训练卡 + 顾问效果。
3. **Phase 3 — 事件链**：总事件 + 两条日志 + 三个结果事件。这是本系统的叙事核心。
4. **Phase 4 — PCE 独立路线**：自动增长 + 立场选项。
5. **Phase 5 — UI 与预览**。

> **两张卡在 Phase 3 之后被删除**：`military_training`（选项并入 `militia_reorg`）与 `militia_legality`（改由事件推动）。它们的记录保留在 §11.2 / §11.3 里并标注了失效范围，见 §11.4。

### 11.1 Phase 1 完成记录（已实现并验证）

`npm run verify:phase5` 全绿：lint（214 个源文件）+ 14 个测试套件 + `vite build`。

| 文件 | 实际改动 |
|---|---|
| `src/game/rules/militarization.ts` | **新建**。`INITIAL_MILITARIZATION` 表、`clampMilitarization`、`getMilitarization`、`getMilitarizationMultiplier`、`getUnitMilitarizationMultiplier`、`getMilitarizationCeiling`、`adjustMilitarization`、`adjustMilitarizations`、`advanceMilitarizationPath`、`chooseMilitarizationPath`、`calculateMilitarizationDrift` |
| `src/game/types.ts` | +`MilitarizationState`、`MilitarizationPaths`、`GameState.militarization`、`GameState.militarizationPaths`；−`militiaCombatPower` |
| `src/map/types_map.ts` | `Army` 与 `ArmyFormation` 移除 `militarization`；`MapRuntimeState` +可选的 `militarization`（内联声明以避免 `game/types` 循环依赖） |
| `src/map/map_constants.ts` | 8 条编制表移除 `militarization`，保留 `morale` 作为出生值 |
| `src/game/rules/combat.ts` | 全部重写，新增导出 `ARTILLERY_WEIGHT`、`ARMOUR_WEIGHT`、`TERRAIN_DEFENSE_COEFFICIENT`、`DEFENSE_BASE`、`getDefenseCoefficient`、`deployToWidth`、`getDeployedManpower`、`getBasePower`、`getCasualtyFactor`、`UNIT_DESTRUCTION_THRESHOLD` |
| `src/game/rules/warSetup.ts` | `applyPeacetimeMobilization` 只保留数量轴；删除 `MILITIA_BASE_READINESS` 与 `READINESS_PER_COMBAT_POWER`（两者均已无消费者） |
| `src/game/rules/wartimeCoalition.ts` | `getArmyEffectiveManpower(state, army)` 改为查派系军事化率 |
| `src/game/saveMigrations.ts` | `migrateMilitarization`：旧 `militiaCombatPower` 的超出量按 ×0.5 折算进各民兵派系；补齐两个新字段 |
| `src/game/scenarios/base.ts` | 两个新字段初值；删除 `militiaCombatPower: 100` |
| `src/game/military_affairs/militia_reorg.ts`、`aragon_front.ts`、`anarchy_tanks.ts` | §3.6 的迁移**提前到 Phase 1 完成**（因为删除字段迫使这三个文件必须改），并顺带接上 `advanceMilitarizationPath` |
| `src/components/SidePanel.tsx`、`src/map/Sidebar.tsx`、`src/components/WartimeCoalitionDetails.tsx`、`src/game/effectPreview.ts` | 改读派系军事化率；effectPreview 新增 `militarization` / `militarizationPaths` 的中英 diff 渲染 |
| `editor/src/simulator/gameSandbox.ts` | 沙盒初值同步 |
| `scripts/test-*.ts(x)` | 4 个测试脚本适配新签名；新增战宽排位、防守系数、军事化系数、攻方预备队零伤亡的断言 |

**实现期间的三个判断（都已落地）：**

1. **火炮乘员算暴露人数**。火炮无视战宽，所以永远在线上，也就永远会挨打。§5.6 表里第 1、2、5 行的攻方损失因此是 111 / 251 / 375，而不是早先草稿里的 83 / 188 / 214（那份草稿错误地把炮组排除在暴露基数之外）。**已用真实解算器端到端复现全部六行，守方损失逐位吻合。**
2. **`getMilitarizationCeiling` 已经预留民兵自治上限**，读取 `journal_militia_autonomy` 的状态。Phase 1 中该日志不存在，函数返回 100，所以是惰性的——Phase 3 接上日志即自动生效，不需要再改这个模块。
3. **`calculateMilitarizationDrift` 同样是惰性的**：它只在对应日志处于 `active` 时返回补丁，而日志要到 Phase 3 才有。所以和平期军事化率完全由卡牌与顾问驱动，符合 §3.5 的决定。

**Phase 1 未覆盖、留给后续阶段：**

- 1933 / 1936 剧本目前与 1931 共用同一张初始军事化表（§11 提到的"按历史积累给不同初值"留到平衡阶段）。
- `SandboxMenu` 尚未提供新字段的直接编辑（Phase 5）。
- SidePanel 的「军事化率」独立区块尚未新建（目前只在正规军行的 tooltip 里显示；完整面板属 Phase 5）。

### 11.2 Phase 2 完成记录（已实现并验证）

`npm run verify:phase5` 全绿；卡片注册表 **26 → 27** 张，架构边界扫描 179 个游戏源文件通过。

| 文件 | 改动 |
|---|---|
| `src/game/action_affairs/military_training.ts` | **新建**。和平期（及战时）民兵训练卡：「操练联合民兵」= `cnt` +2、路线进度 +5、Faistas 异议 +4；「让民兵自行其是」= 革命热情 +1、`cnt` −1。冷却 6 个月 |
| `src/game/action_affairs/index.ts` | 注册新卡（`CARD_REGISTRY` 自动把它放进行动牌堆，无需改 `base.ts`） |
| `src/game/government_affairs/military_policy.ts` | 新增「整军演习」选项：`gov` +3、路线进度 +4、`coupProgress` +1、Faistas 异议 +3。**`coupProgress` +1 是核心张力**：军官团练得越好越危险 |
| `src/game/government_affairs/police_affairs.ts` | 新增「让警队接受真正的训练」选项（−1 军备）：`gov` +4、路线进度 +3。副标题**明说与政府军共用同一军事化率**，把 §8 的耦合暴露给玩家 |
| `src/game/advisors/aurelio_fernandez.ts`、`melchor_rodriguez.ts`、`buenaventura_durruti.ts` | 按 §6.5 挂上 `cnt` +3 / `gov` +2 / `cnt` +2 与 `cnt` +5；顺带清掉 Aurelio 里多余的 `JSON.parse(JSON.stringify(...))` 派系深拷贝 |
| `src/game/types.ts`、`scenarios/base.ts`、`editor/.../gameSandbox.ts` | 新增 `military_training_timer` |
| `src/game/effectPreview.ts` | 新计时器的中英标签（`reverseTone`） |
| `scripts/test-action-affairs-effect-previews.ts` | 新卡的 8 条断言：选项数、中文描述、**显式预览必须等于实际 effect 推导出的预览**、双语字幕、选项关闭事件、`cnt` +2、Faistas +4、路线进度在未选路线时**不创建字段**、选路后 +5、`cnt` −1、冷却开合 |

**实现期间的两个判断：**

1. **冷却设在卡片顶层 effect，不在选项里。** 我最初把 `military_training_timer: 6` 写进了两个选项，与 `military_policy` / `police_affairs`（政府卡）一致。但核对后发现**行动卡的家族约定是顶层设置**——`fundraising`、`media`、`mujeres_libres`、`fijl` 四张卡全部如此（`fijlCard.effect` 与 `mujeresLibresCard.effect` 都直接返回 `*_timer: 6`）。已改为顶层，避免同一家族内出现两种写法。
2. **`military_training` 不加兵力门槛。** 设计文档 §6.4 的表格未给该选项任何 condition，所以 1931 年（CNT 民兵池为 0）也能用——这在主题上是对的：CNT 在**还没有武装纵队之前**就先辩论要不要操练，正是 1931–1936 的真实争论。若实测觉得太抽象，加 `entityPools.cnt_defense_committees.manpower > 0` 即可，届时需补 `unavailableSubtitle`。

**Phase 2 未覆盖：** PCE 独立路线（§7，属 Phase 4）与两条日志本身（Phase 3）——**两者均已完成**，见 §11.3 与 §11.6。

> **⚠️ 本节记录的两处内容后来被推翻（记于文末，不回改上文）：**
>
> 1. **`militarizationPaths.*Progress` 后来被整个删除。** 上表里「路线进度 +5」的说法已失效：完成条件改成了**状态条件**，路线进度字段不再存在（§6.5 问题 2）。
> 2. **`military_training` 这张卡后来被删除**，两个选项与 `military_training_timer` 一并并入 `militia_reorg`（§6.9）。因此上表的 1003 / 1004 / 1008 / 1009 / 1010 行、以及下面判断 1 与 2 所讨论的对象都已不存在；判断 1 的结论（**行动卡冷却设顶层**）仍然有效，并被 `militia_reorg` 沿用（顶层 `militia_reorg_timer: 1`）。判断 2 的结论（**不设兵力门槛**）同样被并入后的「操练联合民兵」选项继承，理由不变。

### 11.3 Phase 3 完成记录（已实现并验证）

`npm run verify:phase5` 全绿：lint（**221 个源文件**）+ 14 个测试套件 + `vite build`。注册表从 27 张卡 / 60 定时事件 / 143 可恢复事件变为 **28 / 61 / 148**。

| 文件 | 改动 |
|---|---|
| `src/game/rules/armyPools.ts` | **新建**。`mergeMilitiaPoolsIntoStateArmy`、`countCntMilitiaUnits`、`SPANISH_MILITIA_POOL_ENTITY_IDS` |
| `src/game/journal/popular_army.ts`、`journal/militia_autonomy.ts` | **新建**两条日志（完成/失败条件、失败效果、按月政治效果全部按 §6.3/§6.4）；注册进 `journal/index.ts` |
| `src/game/events/civil_war/militarization_crossroads.tsx` | **新建**总事件 + 4 个结果事件（`popular_army_formed` / `popular_army_stalled` / `militia_columns_secured` / `militia_columns_absorbed`） |
| `src/game/action_affairs/militia_legality.ts` | **新建**民兵合法性阶梯卡（4 级 + 维持现状；4 个月冷却）——**§6.5 问题 1 那个硬前置**（⚠️ 后已删除，改为由事件推动，见下） |
| `src/game/rules/wartimeCoalition.ts` | +`isMilitarizationCrossroadsDue`、+`adjustMemberContribution`（全库第一个承诺度写入口） |
| `src/game/rules/policyDefinitions.ts` | +`PolicyModifier` 的 `militarization` kind；填 `army_reform_law` L3/L4 与 `militia_legality_law` L2–L4 的月度效果 |
| `src/game/rules/policy.ts` | 结算新的 `militarization` modifier（走 `adjustMilitarization` 唯一写入口） |
| `src/game/rules/militarization.ts` | **删除** `advanceMilitarizationPath`、`getMilitarizationCeiling`、`MILITIA_AUTONOMY_CEILING`、`calculateMilitarizationDrift` 与三个 ID 常量 |
| `src/game/types.ts` | `MilitarizationPaths` 去掉两个 `*Progress`，只留 `chosen` 与 `chosenAt` |
| 6 张卡 | 移除全部 `advanceMilitarizationPath` 调用 |
| `src/game/effectPreview.ts` | 路线 diff 只显示"选了哪条"；+`militia_legality_timer` 标签（⚠️ 该计时器后随卡片一并删除） |
| 注册表 | `militarization_crossroads` 进 `SCHEDULED_EVENT_REGISTRY`，新模块整体进 `RESTORABLE_EVENT_REGISTRY` |
| `scripts/test-wartime-politics.tsx` | +4 个测试（该文件现 17 项检查）：触发时机取自 `formedAt` 的下一个月、两个选项各开一条日志并锁路线、池合并的资产守恒与两个排除项、两条日志的完成/失败边界与"完成优先" |

**实现期间的四项判断（都与设计文档有出入，以代码为准）：**

1. **删掉了 `calculateMilitarizationDrift`**。原设计让月度演化走一个独立函数，更好的做法是把数字写在法律的 `monthlyModifiers` 上——既符合"法律拥有自己的效果"这条既有原则，也省掉一个管线阶段，还免去"日志失效后惯性还算不算"这种边界问题。**因此 `monthlyPipeline.ts` 没有改动。**
2. **民兵合法性推进卡做成行动事务**而非政府事务。工会自行武装不需要部长席位，走阁外合作路线的 CNT 也应该能推这条阶梯。冷却 4 个月（而非 6）——它是两条日志完成条件的共同前置，而人民军日志只有 24 个月。**〔2026-09 推翻〕** 这张卡已整体删除：民兵合法性改由**事件**推动（§6.5 问题 1）。此判断记录的"为什么不该是政府事务"仍然成立——它正是将来写这些事件时应遵循的原则：**不要要求 CNT 先拿到部长席位，才能让工会武装合法化。**
3. **事件与日志的 id 用字符串字面量**。`test:registries` 会静态扫描 `src/game/events/**` 要求 `id` 是字面量，以此校验"每个作者手写的事件都在可恢复注册表里"。三个 ID 常量因此删掉了。
4. **`JournalState` 没有时间戳**，人民军的 24 个月期限因此挂在 `militarizationPaths.chosenAt` 上（两条日志共用同一锚点，因为路线二选一、同时激活）。

**Phase 3 未覆盖：** PCE 独立军事化路线（§7，属 Phase 4）**——已于 2026-09-24 完成，见 §11.6**。另外民兵合法性那条推进链当时尚未实现，同日补上（见 §11.5）。

### 11.4 2026-09 回改记录：两张卡被移除

Phase 3 之后做了一次内容收缩，**不影响军事化机制本身**（军事化率、战力公式、两条日志、总事件全部照旧），只改玩家推动它的入口。

| 动作 | 内容 | 理由 |
|---|---|---|
| **删除** `src/game/action_affairs/military_training.ts` | 该卡两个选项整体迁入 `militia_reorg`（见 §6.9 表内「操练联合民兵」「让民兵自行其是」）；`military_training_timer` 字段与标签一并删除 | 民兵训练与民兵整编是同一件事，两张卡只会让玩家在两个冷却之间来回等 |
| **删除** `src/game/action_affairs/militia_legality.ts` | 民兵合法性法律改由**事件**推动；`militia_legality_timer` 字段与标签一并删除 | 用户决定：法律等级应由事件推动，不由可重复的卡牌推动 |

**两处删除都波及了 4 个登记点**，已全部改完：`action_affairs/index.ts`（去掉 import 与数组项）、`src/game/types.ts` + `scenarios/base.ts` + `editor/src/simulator/gameSandbox.ts`（去掉两个计时器字段）、`src/game/rules/phaseOrchestrator.ts`（去掉两行计时器递减）、`src/game/effectPreview.ts`（去掉两个标签）。`scripts/test-action-affairs-effect-previews.ts` 的 `militia_reorg` 断言相应从 4 个选项改为 **6 个选项标题**。

**回改后的核对结果**（`npm run verify:phase5` 全绿）：lint 扫描 **252 个源文件**、架构边界扫描 **213 个游戏源文件**、**30 张卡**、**69 个定时事件**、**168 个可恢复事件**、**15 个测试套件**、`vite build` 通过。

### 11.5 2026-09-24 补齐：民兵合法性事件链

回改留下的唯一断口（`militia_legality_law` 零写入者）已在同日补上，做法按既定决定走**事件**而不是卡牌。

| 文件 | 改动 |
|---|---|
| `src/game/events/civil_war/militia_legality.ts` | **新建**。三个一次性定时事件：`militia_legality_armed_unions`（→L2）/ `militia_legality_rear_security`（→L3）/ `militia_legality_committee`（→L4）。条件锚在 `civilWarSetupCompletedAt` 之后的第 1 / 4 / 8 个月；每一级附 `applyControlInfluence`，把被删卡片留下的所有权接口挂回来 |
| `src/game/registries/scheduledEventRegistry.ts` | 三个事件进调度表（69 个定时事件） |
| `src/game/registries/restorableEventRegistry.ts` | 新模块整体进可恢复表（168 个可恢复事件） |
| `scripts/test-wartime-politics.tsx` | +4 项检查（该文件现 **21 项**）：阶梯逐级开合与时机、每月队列可捞取、走通三级后端到端解锁两条日志、拒绝后永久关闭 |

**这让整套军事化系统第一次形成闭环**：总事件抉择 → 两条日志 → `army_reform_law` L3/L4 → `militia_legality_law` L2–L4 的月度效果 → 派系军事化率 → 战力公式。此前链条在"法律"这一环断掉，两条日志的完成条件不可达。

### 11.6 2026-09-24 收尾：Phase 4（PCE 独立路线）实装

设计的最后一个未实装阶段（§7）同日完成。**至此五个 Phase 全部落地。**

| 文件 | 改动 |
|---|---|
| `src/game/rules/militarization.ts` | +`PCE_MILITARIZATION_RELATIONS_FLOOR`(40)、`PCE_MILITARIZATION_MONTHLY_GAIN`(0.4)、`INTL_MILITARIZATION_MONTHLY_GAIN`(0.3)、`MAOC_MILITARIZATION_GAIN`(10)、`INTERNATIONAL_BRIGADES_MILITARIZATION_GAIN`(8)；+`getPceMilitarizationMonthlyDrift` / `applyPceMilitarizationMonthlyDrift` |
| `src/game/rules/monthlyPipeline.ts` | `applyMonthlyPoliticalMaintenance` 结算 PCE 常月增长（**唯一不经过法律的月度军事化变化**，因为它不是共和国的政策） |
| `src/game/rules/phaseOrchestrator.ts` | 国际纵队成军那个月 `intl` +8，判布尔值跃迁、只发生一次 |
| `src/game/events/maoc_formation.ts` | MAOC 成立时 `pce` +10 |
| `src/game/action_affairs/inter_party_relationships.ts` | +2 个战时专属选项：「把共产党建军当成称赞」与「当成警告」 |
| `scripts/test-wartime-politics.tsx` | +3 项检查（该文件现 **24 项**） |

**核查结果**：`npm run verify:phase5` 全绿——`tsc --noEmit`、**252 个源文件**权威性扫描、**213 个游戏源文件**架构边界扫描、**15 个测试套件**、`vite build`；注册表 **30 张卡 / 69 个定时事件 / 168 个可恢复事件**。

**设计文档里仍然成立的开放项**：只有 §13 的三个待裁决问题（地形防御系数取值方式、池统一的联盟后果、阁外合作路线是否触发总事件），以及审计文档里列出的内容缺口（第 7/8 师、非洲军团轴、地图孤岛、右翼军事化成长、剧本差异化初值、战报渲染）。

**顺带记录一处发现**：`src/game/military_affairs/prepare_for_revolution.ts`（和平期专属的「准备革命」卡，三条手段各 3 次）也在动军事化率——武装民兵 `cnt` +2/次但**和平期天花板 40**，破坏反动派 `requetes`/`falange` −2/次，是全库唯一能削弱右翼军事化的杠杆。§6.9 的杠杆表原先没有收录它，现已补上。

---

## 12. 与既有文档的关系（重要：本版取代 v2 文档 §3.3）

| 文档 | 关系 |
|---|---|
| `military-system-redesign-v2.md` §3.3「共和国军事化状态」 | **本版取代它**。该节的全局三级 `republicMilitarization`（L0/L1/L2）被**每派系军事化率**替代。理由：全局单级无法表达"CNT 拒绝军事化、PCE 拥抱军事化"这一 1936–37 的核心冲突，而每派系一个率恰好表达它。§3.3 的修正表（L1 战斗力 +5% / L2 +10%）也随之取消——新模型的差距是 5 倍量级，不是 5%。 |
| `military-system-redesign-v2.md` §13.1「战斗公式」 | **采纳并简化**。地形参数表、损失率的相对比值形式（`clamp(0.06 × 敌我战力比, 0.02, 0.18)`）、随机系数 `[0.90, 1.10]` 全部沿用；但其中的**训练系数**与**共和国军事化系数**两个乘区合并成一个**军事化系数**。 |
| `military-system-redesign-v2.md` §3.2「`militarization` 应改名 `combatReadiness`」 | **不再适用**。本版把 `militarization` 这个名字留给新的派系级字段，编制表部队不再持有该字段。 |
| `military-system-redesign-v2.md` §6.3「准备档位」 | **保留**。它衡量的是**数量**（民兵池对历史基准的比值），与本版的**质量**（军事化率）是两条正交的轴，二者都应在 `applyPeacetimeMobilization` 中生效。 |
| `military-system-redesign-v2.md:961`「删除卡牌中的推进军事化选项」 | **不再适用**。该禁令针对的是"用重复卡绕过历史事件推进**制度等级**"。本版中制度等级已由两条互斥日志承担（且日志只由总事件激活），卡牌推进的是**派系军事化率**，不是制度等级。 |
| `peacetime-militarization-design.md` | **已删除**。其 per-unit `combatReadiness` 模型被本版否决；可保留的部分（§1 现状核查、`militiaCombatPower` 审计）已并入本文件。 |

---

## 13. 已确认的决定与仍需你确认的三项

**已确认：**

| 议题 | 决定 |
|---|---|
| 军事化粒度 | 每派系一个值、同派系共享；单位只持有 `identity`，结算时查表，不复制进单位（§5.2） |
| 军事化系数曲线 | **线性 A：`clamp(m,10,100)/100`**。`gov` 85 : `cnt` 17 = **5.00 倍**，民兵 17→70 回报 **4.12 倍**（§3.3） |
| 政府军 + 警察 | **共用一个 `militarization.gov`**，警察不单独维护（§8） |
| 派系士气 | **取消**。士气只存在于开战后的地图单位上，每个单位一个值（§4） |
| 士气强度 | **`1 + 士气/100`，区间 [1.0, 2.0]**。满士气单位战力是零士气单位的两倍（§5.3） |
| 和平期池战力 | `池人力 × 军事化率 / 100`，不含士气、不含火炮坦克（§5.1） |
| 防守系数 | **`1.2 + (地形防御系数 − 1) + 工事等级`**。平原无工事 = ×1.20，山地工事 2 = ×3.50（§5.3） |
| 预备队规则 | 攻方预备队**零伤亡**，前线被打掉就撤离；守方预备队**持续补位**，伤亡按总人数算（§5.4） |
| 自然衰减 | **不开**。只升不降，下调只来自卡牌／事件的显式减益（§3.5） |
| 事件链时机 | **战时人民阵线成立后的下一个月**（§6.1 已按新规格改写） |
| 路线落点 | 两条日志完成的落点是 **`army_reform_law`**：人民军 → L3「共和国人民军」；武装民兵 → L4「民兵纵队体系」（§6.7） |
| 日志完成条件 | 人民军：`cnt` 军事化率 > 85 且民兵合法性法 = 4；武装民兵：≥8 支归属 CNT 的民兵单位且民兵合法性法 = 4（§6.3 / §6.4） |
| 日志失败条件 | 人民军：触发满 24 个月 → CNT 承诺度 −40；武装民兵：`cnt` > 60 → Puristas 异议 +25（§6.3 / §6.4） |
| 池统一 | 人民军完成时把 **5 个西班牙党派民兵池**并入 `republican_state`；**排除**国际纵队与巴斯克军（§6.8） |
| 战宽展开顺序 | 坦克 → 步兵 → 火炮（火炮无视战宽）（§5.4） |
| `militiaCombatPower` | 删除，其值折算并入各民兵派系军事化率（§3.6） |

**仍需你确认的三项：**

0. ~~**`militia_legality_law` 推到 4 级的路径**~~ —— **已完成（2026-09-24）**。
   按你的决定走**事件**：`src/game/events/civil_war/militia_legality.ts` 的三个一次性历史事件，在内战开局后第 1 / 4 / 8 个月逐级把法律从 1 推到 4，每一级都附带所有权影响。
   曾经实现过的那张 `militia_legality` 行动卡已删除。**两条日志的完成条件现在可达**，整套军事化系统形成闭环（详见 §6.5 问题 1 与 §11.5）。

1. **地形防御系数的取值方式**（§5.3）。现按"地形贡献其超出 1.0 的部分"实现（平原 +0.00 / 森林 +0.15 / 城市 +0.20 / 山地 +0.30），平原无工事 = 1.20。若原样相加会变成 2.20，与"降到 1.2"矛盾。

2. **池统一的联盟后果是否接受**（§6.8 第 4 条）。`republican_state` 单位在 `getArmyPoliticalMember` 里返回 `null`，所以并入后各党派在战时联盟的军事份额会归零、凝聚力随之下跌。**选人民军会在军事上大幅变强，同时亲手拆掉自己在联盟里的军事发言权。** 建议接受（史实如此）。

3. **阁外合作路线（`external`）是否也触发本事件**（§6.1）。现在允许。

> ~~4. 民兵合法性阶梯的推进速度（只有一张卡、4 个月冷却……）~~ —— **作废**：那条阶梯卡已删除，推进速度的问题随之转移到"将来写多密的事件"上。给出事件时的建议节奏见 §6.5 问题 1：内战爆发链 +1，此后 2–3 个一次性历史事件推到 4 级。

> **已按你的决定落地**：人民军失败的承诺度惩罚保持 **−40**（`popular_army.ts` 的 `onFail`）。提醒一次量级：`memberContributions` 默认 80，而 `cohesion` 是各成员贡献度之和，所以这一刀很可能直接把凝聚力打穿到 25 以下、立刻触发战时危机。这是"路线失败 = 政治灾难"的刻意选择，不是 bug。

> **一个已定的平衡性质（不是待定项）**：防守系数 1.2 之后，**同等兵力进攻仍亏但可接受**（守/攻 = 1.20×，损失比 1.44:1），约 **1.4:1** 兵力优势即可打出正收益。战争节奏会比 1.5 那版明显快。
