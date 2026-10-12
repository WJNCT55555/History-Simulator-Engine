# 《Social Democracy: An Alternate History》经济系统说明

> 版本基准：`package.json` v0.11.1 / `changes.txt` 最新条目 v1.3.2
> 分析对象：`source/scenes/**.dry`（167 个 DendryNexus 场景脚本）
> 说明：本文所有数值均来自源码，非推测。行号对应分析时的文件状态。

---

## 目录

1. [总览：三层资源结构](#1-总览三层资源结构)
2. [党的经济：resources 与 dues](#2-党的经济resources-与-dues)
3. [政府财政：budget](#3-政府财政budget)
4. [国民经济三指标](#4-国民经济三指标)
5. [月度经济结算模型](#5-月度经济结算模型)
6. [三大经济计划](#6-三大经济计划)
7. [财政工具箱：税收与关税](#7-财政工具箱税收与关税)
8. [福利国家与失业保险](#8-福利国家与失业保险)
9. [资本与右翼的隐形约束](#9-资本与右翼的隐形约束)
10. [外部经济事件时间线](#10-外部经济事件时间线)
11. [胜利条件中的经济指标](#11-胜利条件中的经济指标)
12. [实现细节与已知问题](#12-实现细节与已知问题)
13. [关键文件索引](#13-关键文件索引)

---

## 1. 总览：三层资源结构

游戏中的"经济"由三套彼此独立的系统组成，新手最容易混淆：

| 层级 | 核心变量 | 性质 | 主要用途 |
|---|---|---|---|
| 党的钱 | `resources` / `dues` | 存量 + 定期收入 | 竞选、媒体、拉拢友党、防务 |
| 政府的钱 | `budget` | 存量池（**不自动补充**） | 一切政府政策支出 |
| 国民经济 | `inflation` / `unemployed` / `economic_growth` | 宏观指标 | 民意、投票、事件触发 |

三者的耦合关系：

```
dues ──► resources ──► 竞选/媒体 ──► 各人群支持 ──► 选举结果
                                          │
税收/关税 ──► budget ──► 政策支出 ──► works_program / 国有化
                │                          │
                └──► 赤字 ──► inflation ◄──┘
                              │
                        unemployed ◄── economic_growth
                              │
                        pro_republic ──► 投票流向 NSDAP
```

---

## 2. 党的经济：`resources` 与 `dues`

**初始化**（`root.scene.dry:39-41`）：

| 难度 | resources | dues | budget |
|---|---|---|---|
| 简单 | 4 | 3 | 5 |
| 普通 | 2 | 2 | 4 |
| 困难 | 0 | 1 | 3 |
| 历史模式 | 2 | 1 | 2 |

### 2.1 收入来源

| 来源 | 效果 | 冷却 | 文件 |
|---|---|---|---|
| 党费募款卡 | `resources += dues` | 6 个月 | `party_affairs/fundraising.scene.dry` |
| 顾问紧急输血 | `resources += dues` | 消耗一次顾问行动 | `advisors/wels|juchacz|schumacher.scene.dry` |
| 商业化媒体 | `resources += 1` | — | `party_affairs/media.scene.dry:28` |
| 历史模式年度拨款 | `resources += 2` | 每年 1 月 | `post_event.scene.dry:109-111` |

**注意**：历史模式下**没有募款卡**，党产完全依赖每年 +2。

### 2.2 党费调整的代价

`fundraising.scene.dry` 三个选项：

- **维持**：`resources += dues`，无代价
- **降低**：`dues -= 1`，四大派系 `dissent` 各 −8（收买党内人心）
- **提高**：`dues += 1`，但
  - `workers_spd -= 3`、`unemployed_spd -= 3`
  - 若 `unemployed >= 15`，上述各再 −10
  - 若 `dues >= 5`，再扣 `3*dues`
  - 上限 `dues <= 4`

### 2.3 主要支出

| 用途 | 成本 |
|---|---|
| 竞选单个人群（工人/新中产/旧中产/农村/失业者/天主教徒） | 各 −1 |
| 电台宣传 | −2 或 −1 |
| 铁血阵线（Iron Front） | `-rb_militarization_cost` |
| 1932 年总统选举拉拢 Zentrum / KPD | 各 −3 |
| 组建大联合政府 | −2 |
| 平息联盟内异议 | −2 / −3 |
| 对奥地利社民党物质援助 | −1 / −2 |
| 支持 Joos 出任中间党领袖 | −1 |
| 雇佣总统候选人 | −2 |
| 与 KPD 搞资源外交 | −3 |

---

## 3. 政府财政：`budget`

### 3.1 核心设计

**`budget` 是一个存量池，不是每月的收支流量。** 它不会每月自动补充。因此：

- "赤字"= `budget` 变为负数
- 中期收入只能靠财政政策卡（加税 / 加关税）与事件奖励
- `budget <= -5` 会直接触发资本罢工事件（`events/capital_strike.scene.dry:3`）

### 3.2 初始与自动变化

| 时点 | 变化 | 文件 |
|---|---|---|
| 游戏开始 | `budget = 4`（难度 5/4/3/2） | `root.scene.dry:195, 596-618` |
| 每年 1 月（1930 起） | `budget -= 1`（若 > 0） | `events/1930.scene.dry:8-10` |
| 黑色星期四 | `budget -= 1` | `events/black_thursday.scene.dry:4` |

### 3.3 收入汇总

| 政策 | 效果 | 代价 |
|---|---|---|
| 提高富人税 | +2 | 资本罢工 +1（税档 >1/>3 再加） |
| 提高穷人税（消费税） | +2 | 工人 −4，左派/劳工 dissent +3 |
| 全面加税 | +3 | 全民 −4，失业 +2 |
| 加关税 | +2 | 通胀 +1，失业 +1.5，外交恶化 |
| 削减福利 | +1 | 工人 −6，全派系 dissent +10 |
| 削减科学经费 | +1 | 增长 −0.5 |
| 削减军费 | +1 | 资本罢工？→ `coup_progress += 1`，右翼关系 −8 |
| 取消战舰建造 | +1 | — |
| 停付赔款（谈判成功） | +2（胡佛备忘录后 +1） | — |
| 胡佛备忘录 | +1 | — |
| 洛桑会议 | +1 | — |
| 经济扩张事件 | +1 | 需累计扩张 ≥85 且失业 ≤6、通胀 ≤6 |
| 伦敦经济会议（部分选项） | +1 | — |

### 3.4 支出汇总

| 政策 | 成本 |
|---|---|
| WTB 计划首期 | `-wtb_budget`（基础 4，可降至 3） |
| WTB 计划续期 | −3 |
| 左派国有化 | `-nationalize_budget`（基础 4，可降至 2） |
| 改良派计划 | −2（缩水版 −1） |
| 增加福利 | −1 |
| 经济民主：社会化关键产业 / 支持合作社 | −1 各 |
| 科研（KWG / 应用 / 医学） | −1 各 |
| 公共高中 / 世俗化学校 | −1 |
| 司法改革 | −1 |
| 土地改革 / 农业信贷 / 食品采购 | −1；国家粮食垄断 −2 |
| 对苏经济援助 | −1 |
| 银行危机救助 | −1 |
| 支持奥地利民主（物质） | −1 |
| 全面减税 / 减穷人税 / 减富人税 | −3 / −2 / −2 |
| 降关税 | −2 |
| 女性权利法案 | −1 |

---

## 4. 国民经济三指标

| 变量 | 初始值 | 含义 | 初始化位置 |
|---|---|---|---|
| `inflation` | 2.9% | 通胀率（可为负 = 通缩） | `root.scene.dry:215` |
| `unemployed` | 8.6% | 失业率（下限 1%） | `root.scene.dry:205` |
| `economic_growth` | 4.4% | 年化增长率 | `root.scene.dry:218` |

三者被逐月写入 `Q.economic_records`（`post_event.scene.dry:125-127`），在图书馆页用 d3 绘制历史折线图（`library.scene.dry:442-450`）。

**历史上限**：`unemployed` 有硬下限 1%（`post_event.scene.dry:74-76`），但没有上限。

---

## 5. 月度经济结算模型

结算发生在 `post_event.scene.dry`，每次行动后 `time += 1` 时执行。源码注释自述为*"we're basically implicitly drawing a Philips curve"*（第 129 行）。

### 5.1 赤字 → 通胀（第 131–145 行）

```javascript
budget <= 0  && budget > -2 && inflation < 2.5  → inflation += 0.1
budget <= -2 && budget > -5 && inflation < 5    → inflation += 0.2
                                                   （若 unemployed >= 12 则 -0.1）
budget <= -5 && inflation < 10                  → inflation += 0.3
                                                   （若 unemployed >= 15 则 -0.1）
```

**边际递减**：通胀越接近 2.5 / 5 / 10 的上限，"打不动"越明显。高失业时赤字刺激的通胀效应会被削弱。

### 5.2 通缩 → 失业（第 147–152 行）

```javascript
inflation < -0.5 && inflation > -5 && unemployed < 15 → unemployed += 0.2
inflation <= -5 && unemployed < 20                    → unemployed += 0.3
```

这是对布吕宁式紧缩的直接惩罚。

### 5.3 增长 ↔ 失业（第 154–171 行）

| 条件 | 效果 |
|---|---|
| `growth < -0.5` 且失业 ≤18 | 失业 +0.1 |
| `growth < -5` 且失业 ≤28 | 失业 +0.1 |
| `growth >= 2` 且失业 ≥17 | 失业 −0.1 |
| `growth >= 4` 且失业 ≥12 | 失业 −0.1 |
| `growth >= 6` 且失业 ≥7 | 失业 −0.1 |
| `growth >= 8` 且失业 ≥3 | 失业 −0.1 |

### 5.4 过热与通缩自稳（第 172–186 行）

```javascript
growth >= 4 && inflation >= 7.5  → growth -= 0.1
growth >= -2.5 && inflation <= -5 → growth -= 0.1
growth >= 7                      → growth -= 0.1
growth >= 10                     → growth -= 0.2
growth >= 12                     → growth -= 0.3
```

**增长有软上限**，防止无限复利式繁荣。

### 5.5 科学与教育加成（第 188–233 行）

```
science_bonus = education_science
              + (science >= 1 ? 1 : 0)      // 注：见 §12 已知问题
              + 0.5 * applied_research
上限 6
```

然后把低增长经济往 `science_bonus` 的水平上"托底"：

```javascript
if (science_bonus >= 1) {
    if (return_to_normalcy && growth < science_bonus + 3) growth += 0.1;
    if (return_to_normalcy && growth < science_bonus)     growth += 0.1;
    if (growth < science_bonus - 3)                       growth += 0.1;
}
```

这是教育科研政策的长期经济回报机制。

### 5.6 经济扩张计时器（第 234–247 行）

```javascript
// 负增长：清空（若已 >0）或继续累加
if (growth < 0) { economic_expansion > 0 ? 0 : += growth }
// 正增长：仅 SPD 在政府中才累积
if (growth > 0 && reparations <= -2 && spd_in_government) economic_expansion += growth
else if (growth > 0 && spd_in_government)                 economic_expansion += growth/2
```

累计 `>= 85` 且失业 ≤6、通胀 ≤6 时触发 **经济扩张** 事件（`events/economic_expansion.scene.dry`）：`budget += 1`、`capital_strike_progress -= 2`、全民支持上升、通胀 +0.4。

**停付赔款让扩张累积速度翻倍**——这是赔款谈判的隐藏经济价值。

### 5.7 经济 → 政治反馈（第 248–295 行）

```javascript
unemployed > 15 && pro_republic > 40  → pro_republic -= 1
unemployed > 30 && pro_republic > 20  → pro_republic -= 1
inflation >= 8 && pro_republic > 40   → pro_republic -= 1
```

当 `pro_republic` 低于魏玛联盟得票率 −3 时，中产/农村/天主教选民按月流向 NSDAP（每项 −4/12 或 −5/12）。

1934 年起，若通胀 ≥8 或失业 ≥20 且 `pro_republic <= 45`，SPD 各人群支持每月再掉 6/12。

### 5.8 历史年度冲击（第 297–441 行）

| 年份 | 基础冲击 | 有条件修正 |
|---|---|---|
| 1929 | 失业 +3、通胀 −1、增长 −4 | — |
| 1930 | 失业 +6.8、通胀 −4、增长 −1 | 若 `works_program` 为 0，额外流向 NSDAP |
| 1931 | 失业 +6、通胀 −5、增长 −5 | `works_program` 存在：失业 −4、通胀 +3、增长 +3.5；`works_program > 1` 再 −1.5/+1/+1.5 |
| 1932 | 无工程：失业 +5、通胀 −2、增长 −1 | `works_program >= 2`：失业 −1、通胀 +1、增长 +1 |
| 1934 | 失业 ≥20 时 −2，通胀 +1 | — |

所有这些按月摊成 `/12` 执行。

---

## 6. 三大经济计划

`economic_plan` 取值：**0** 无 / **1** WTB / **2** 改良派 / **3** 左派国有化（`root.scene.dry:85-87`）。

计划由 `party_affairs/crisis_program.scene.dry` 决定，**必须在黑色星期四之后、`crisis_urgency >= 1` 时**才能召开。

### 6.1 WTB 计划（劳工派，proto-凯恩斯）

- **采纳**：`wtb_support >= 3` → `crisis_program.plan_adopted`，`economic_plan = 1`
  - 支持度来源：Woytinsky 顾问行动（+2）、国际关系卡（+1）、crisis_program 选项（+1）
  - 采纳后：`labor_strength += 10`、`center_strength -= 10`、`center_dissent += 20`
- **实施**：`government_affairs/economic_policy.scene.dry`，需 **经济部或财政部属 SPD**，12 个月冷却
- **成本** `wtb_budget`：基础 4；`works_councils >= 2` 或 `socializations >= 1` 或 `pro_labor >= 2` 时降至 3

| 阶段 | 预算 | 失业 | 通胀 | 增长 | 政治代价 |
|---|---|---|---|---|---|
| `implement_wtb_no_deficit` | `-wtb_budget` | −4 | +2 | +2.8 | 无 |
| `implement_wtb_deficit` | `-wtb_budget` | −4 | +3 | +3 | `coalition_dissent += 1`、`capital_strike_progress += 1` |
| `wtb_continuation` | **+1** | −3~−5 | +1.5~+2.5 | +1.2 | 联盟关系改善 |
| `wtb_2`（正常） | −3 | −3 | +2 | +1.6 | — |
| `wtb_2_deficit` | −3 | −3 | +3 | +1.6 | `coalition_dissent += 1`、`capital_strike_progress += 1` |

**关键权衡**：不赤字版本无政治代价；赤字版本在历史模式、布吕宁内阁下代价翻倍。KPD 视其为"拯救资本主义"，人民阵线/左翼阵线下 `kpd_relation -= 5`。

### 6.2 左派国有化计划（`economic_plan = 3`）

- **采纳**：`nationalization_support >= 3` → `adopt_left`，`coup_progress += 1`
- **成本** `nationalize_budget`：基础 4；`works_councils >= 2` 和 `>= 3` 各 −1；`socializations + nationalization_progress >= 2` 再 −1（最低 2）
- 预算不足时进入 `nationalize_deficit` 分支，三条递进路线：

| 路线 | 前置条件 | 资本罢工 | 政变进度 | 说明 |
|---|---|---|---|---|
| 赤字收买（`nationalize_deficit_1`） | 左派 > 改良+中间，或 Woytinsky 在任 | +3 | — | 温和路径 |
| 无补偿国有化 | `judicial_reform >= 3` | +7 | +3 | 中产/旧中产大跌 |
| 授权工人接管工厂（`empower_workers`） | `judicial_reform >= 3` 或 `rb_militancy >= 0.25`，且 `works_councils >= 1` | +6 | +5 | 可剥离法西斯工人支持 |

每次推进都 `economy_goal_completed += 1`、`works_program += 1`。

### 6.3 改良派就业创造计划（`economic_plan = 2`）

- **采纳**：`moderate_plan_support >= 2` → `adopt_moderate`，`z_relation += 5`
- 完整版：−2 预算，失业 −3、通胀 +1.5、增长 +1.6
- 缩水版（`moderate_plan_limited_budget`）：−1 预算，失业 −2、通胀 +1、增长 +0.7
- 唯一不激怒资本、不需赤字的方案，但 `kpd_coalition_dissent += 1`

### 6.4 计划对照

| | WTB | 左派 | 改良派 |
|---|---|---|---|
| 失业削减 | 强（−4~−5） | 中（−2.5~−3.5） | 弱（−2~−3） |
| 增长 | 强（+2.8~+3） | 中（+1~+2） | 中（+0.7~+1.6） |
| 通胀 | 高（+2~+3） | 高（+2~+4） | 低（+1~+1.5） |
| 资本罢工 | 中（赤字时） | 极高（+3~+7） | 无 |
| KPD 反应 | 敌视 | 友好 | 敌视 |
| 中间党反应 | 中立 | 敌对 | 友好（+5） |

---

## 7. 财政工具箱：税收与关税

`government_affairs/fiscal_policy.scene.dry`，需 **财政部属 SPD**，6 个月冷却。

`upper_tax_rates` / `lower_tax_rates` 是相对 1928 基准的档位，范围 **−5 … +5**。

| 操作 | 预算 | 通胀 | 增长 | 失业 | 政治效果 |
|---|---|---|---|---|---|
| 提高富人税 | +2 | −0.6 | −0.4 | +1 | 资本罢工 +1（税档 >1/>3 再加）；中产 −4 |
| 提高穷人税 | +2 | — | — | — | 工人 −4（税档 ≥2 再 −5） |
| 全面加税 | +3 | −1.1 | −0.6 | +2 | 全民 −4 |
| 全面减税 | −3 | +1 | +0.6 | −1.5 | 中产/资产阶级关系 +5 |
| 减穷人税 | −2 | +0.6 | +0.4 | −0.7 | 工人 +5 |
| 减富人税 | −2 | +0.6 | +0.4 | −0.7 | 资本罢工 −1 |
| 累进化 | 0 | — | — | — | 富人税 +1 / 穷人税 −1；资本罢工 +1 |
| 累退化 | 0 | — | — | — | 富人税 −1 / 穷人税 +1；中产 +5、劳工 −5 |
| 加关税 | +2 | +1 | −0.4 | +1.5 | 农村 +4；DDP −5、DVP −2；东西方关系 −1；赔款谈判 −2 |
| 降关税 | −2 | −0.5 | +0.4 | — | 工人 +4；农村 −5；东西方关系 +1 |

**软上限**：税率档位超过 ±5 后不可再动；关税超过 ±5 后文本提示"已接近经济自给自足"。`tariffs >= 3` 会累积资本罢工。

**累进化/累退化的特殊之处**：不改变总预算，只改变分配——是纯粹的政治操作。

---

## 8. 福利国家与失业保险

### 8.1 福利水平 `welfare`

相对 1928 的水平，可为负，下限 −5。

`government_affairs/social_welfare.scene.dry`：

| 选项 | 预算 | 福利 | 政治 |
|---|---|---|---|
| 削减福利 | +1 | −1 | 工人 −6、失业者 −6、全派系 dissent +10、`pro_republic -= 3` |
| 增加福利（失业 ≤15） | −1 | +1 | 工人 +6、全派系 dissent −5 |
| 增加福利（失业 >15） | −1 | 0 | 工人 +3（**只是维持**） |
| 维持支出（失业 ≤15） | 0 | 0 | — |
| 维持支出（失业 >15） | 0 | **−1** | 工人 −3、失业者 −4、全派系 dissent +5 |

**跑步机设计**：失业 >15 时，"什么都不做"等价于削减福利。这逼迫玩家在紧缩与加税之间做选择。

### 8.2 劳动权利 `labor_rights.scene.dry`

需 **劳动部属 SPD**，10 个月冷却：

- **40 小时工作制**：工人 +7、`capital_strike_progress += 1`（DVP 关系 ≤30 时）、增长 −0.1
- **缩短工时**（需黑色星期四后）：失业 −0.3、增长 −0.2、资本罢工 +1
- **安全法规**：`workers_safety += 1`；累计 ≥3 时资本罢工 +1
- **失业保险筹资**：削减给付 / 提高雇主缴费 / 劳资共担

### 8.3 失业保险危机

当 `unemployed >= unemployment_insurance_threshold + 4` 时爆发（`events/unemployment_insurance_1.scene.dry`、`unemployment_insurance_weimar.scene.dry`）：

| 应对 | 效果 |
|---|---|
| 削减给付 | `welfare -= 2`、工人支持 ×0.88、失业者 ×0.8、KPD 与 NSDAP 同时涨、`budget += 1` |
| 提高雇主缴费 | `capital_strike_progress += 2`、`welfare += 1`、工人 +6 |
| 劳资共担 | 双方都不满意、`welfare -= 1`、`budget += 1` |

---

## 9. 资本与右翼的隐形约束

这是本作经济系统最具特色的部分——**纯粹选举约束之外的第二种约束**。

### 9.1 两个累积计数器

- `capital_strike_progress`：由累进税、价格管制、福利扩张、国有化、赤字累积
- `coup_progress`：由无补偿国有化、工人接管工厂、土地改革、司法改革、削减军费累积

### 9.2 阈值事件链

```
capital_strike_progress >= 6  → Businesses Lose Confidence（失业 +2，增长 −1）
capital_strike_progress >= 10 或 budget <= -5 → 资本罢工
coup_progress >= 10            → 进军柏林（内战判定）
```

### 9.3 资本罢工的后果与应对

`events/capital_strike.scene.dry:6`：

```
失业 +5、工人支持 ×0.7、新中产 −15、旧中产 −15、农村 −15、
pro_republic −15、Z 关系 −10、DVP 关系 −10、增长 −4、
各右翼人群流向 NSDAP（+8 ~ +15）
```

四个应对：

| 应对 | 效果 | 前置 |
|---|---|---|
| 工人夺厂 | 失业 −2、`coup_progress += 6`、增长 +2 | 左派强势 + 司法改革或民兵 |
| 资本管制 | 失业 −1.5、增长 +2 | `judicial_reform >= 2` |
| 宣传攻势 | 工人/中产/失业者支持上升 | −1 resources，需电台 ≥2 或商业化媒体 ≥3 |
| 什么都不做 | — | — |

**设计意图**：越激进的经济政策越容易招致资本主义秩序的反击，而反击又反过来恶化经济指标——形成一个负反馈陷阱。

---

## 10. 外部经济事件时间线

| 时间 | 事件 | 经济效果 |
|---|---|---|
| 1929.01 | 1929 年 | 增长 −4 |
| 1929.10 | **黑色星期四** | 失业 +2、预算 −1、党费 −1、通胀 −1、增长 −1 |
| 1930.01 | 1930 年 | 失业 +6.8、通胀 −4、预算 −1 |
| 1931.01 | 1931 年 | 失业 +6、通胀 −5、增长 −5（有工程计划可抵回） |
| 1931 前后 | **银行危机**（需与奥地利关税同盟） | 失业 +3、增长 −1；可花 1 预算救助（失业 −2、增长 +0.9） |
| 1931.06+ | **胡佛备忘录** | 预算 +1、赔款谈判 +2 |
| 1932.06+ | **洛桑会议** | 赔款清零、预算 +1 |
| 1933.06+ | **全球经济复苏** | 失业 −1~−3、通胀回正 |
| 1933 | **伦敦经济会议** | 取决于选项：失业 −1~−2、通胀 +1~+1.5、预算 +1 |
| 1934.01 | 1934 年 | 失业 ≥20 时 −2、通胀 +1 |
| 通胀 ≥7 | **高通胀** | 五个应对（见下） |

### 高通胀的五个应对

| 选项 | 效果 |
|---|---|
| 加税 | 通胀 −1、预算 +2、失业 +1.5、资本罢工 −1 |
| 削减福利 | 通胀 −1、预算 +1、资本罢工 −2、工人 −5 |
| 价格与工资管制 | 通胀 −3、**资本罢工 +3**、失业 +1 |
| 求央行 | 资本罢工 +2（央行拒绝配合） |
| 无作为 | 资本罢工 +1 |

### 赔款停付的隐藏价值

`foreign_policy.scene.dry:131` 的 `reduce_reparations`：

```
reparations = -2、budget += 2、增长 +0.7（负增长时再 +0.5）、
coup_progress -= 2、全民支持上升
```

更重要的是：`reparations <= -2` 让 `economic_expansion` 的累积速度**翻倍**（见 §5.6）。

---

## 11. 胜利条件中的经济指标

| 成就 | 条件 | 位置 |
|---|---|---|
| **Wirtschaftspolitik** | 实施任一经济计划 | 各计划动作 |
| **Wirtschaftswunder** | 1932 年后：失业 < 8.6%（低于 1928 起点）、通胀 < 5%、`budget > 0` | `game_over.scene.dry:34` |
| **Wirtschaftsexperiment** | 实施两种不同经济计划 | `game_over.scene.dry:99-101` |
| **Freie Marktwirtschaft** | 全程不采纳任何经济计划活到 1933 年底 | `game_over.scene.dry` |
| **Räterepublik** | `nationalization_progress >= 2 且 economic_democracy >= 3`，或 `>= 1 且 >= 4` | `game_over.scene.dry:92` |
| **1934 年结局** | 总统为 SPD 且 `unemployed < 20` 且赔款停付等 | `events/game_over_1934.scene.dry:17` |

---

## 12. 实现细节与已知问题

### 12.1 值得注意的设计

1. **`budget` 不会每月自动补充**——财政政策卡（加税/关税）是唯一的中期收入来源，这使"赤字"成为真正的战略选择而非会计问题。
2. **通缩与通胀是双向惩罚**：`inflation < -0.5` 推高失业，`inflation >= 7` 触发高通胀事件并压低共和支持。**0–6% 才是安全带**。
3. **增长有软上限**：超过 7%/10%/12% 会自减。
4. **`unemployed` 没有每月自然回归**——只被年度历史事件、赤字/通缩/增长修正、政策行动改变。失业率本质上被"政策 + 历史剧本"共同钉住。
5. **历史模式的经济更紧**：预算起始 2（而非 4），无募款卡，赔款与外交成为关键。

### 12.2 疑似 bug

`post_event.scene.dry:205-212` 的 `science` 档位判断：

```javascript
if (Q.science) {
    if (Q.science >= 1) {        // 总是先命中
        Q.science_bonus += 1;
    } else if (Q.science >= 3) { // 不可达
        Q.science_bonus += 2;
    } else if (Q.science >= 5) { // 不可达
        Q.science_bonus += 3;
    }
}
```

由于 `>= 1` 分支优先，`>= 3` 与 `>= 5` 永远无法触发，科研投入超过 1 后不再有额外收益。

---

## 13. 关键文件索引

| 文件 | 作用 |
|---|---|
| `source/scenes/root.scene.dry` | 全部经济变量的初始化与难度修正 |
| `source/scenes/post_event.scene.dry` | **月度经济结算模型**（核心） |
| `source/scenes/status.scene.dry` | 经济指标的 UI 展示 |
| `source/scenes/government_affairs/economic_policy.scene.dry` | 三大计划的实施 |
| `source/scenes/government_affairs/fiscal_policy.scene.dry` | 税收与关税 |
| `source/scenes/government_affairs/economic_democracy.scene.dry` | 工厂委员会、社会化、合作社 |
| `source/scenes/government_affairs/social_welfare.scene.dry` | 福利水平 |
| `source/scenes/government_affairs/labor_rights.scene.dry` | 工时、安全、失业保险筹资 |
| `source/scenes/government_affairs/agricultural_policy.scene.dry` | 土地改革、农业信贷、粮食垄断 |
| `source/scenes/government_affairs/education_science.scene.dry` | 科研投入与课程改革（影响增长） |
| `source/scenes/government_affairs/foreign_policy.scene.dry` | 赔款、关税同盟、欧盟 |
| `source/scenes/party_affairs/crisis_program.scene.dry` | 经济计划的采纳流程 |
| `source/scenes/party_affairs/fundraising.scene.dry` | 党费与党产 |
| `source/scenes/events/1929-1934.scene.dry` | 年度历史冲击 |
| `source/scenes/events/black_thursday.scene.dry` | 大萧条起点 |
| `source/scenes/events/capital_strike.scene.dry` | 资本罢工 |
| `source/scenes/events/high_inflation.scene.dry` | 高通胀危机 |
| `source/scenes/events/emergency_cuts.scene.dry` | 紧急预算削减 |
| `source/scenes/events/banking_crisis.scene.dry` | 银行危机 |
| `source/scenes/events/economic_expansion.scene.dry` | 经济扩张（正向奖励） |
| `source/scenes/events/economic_recovery.scene.dry` | 全球复苏 |
| `source/scenes/events/london_economic_conference.scene.dry` | 伦敦经济会议 |
| `source/scenes/game_over.scene.dry` | 经济相关成就判定 |

---

*本文档基于源码静态分析生成，未运行游戏验证。数值如与最新版本不符，以源码为准。*
