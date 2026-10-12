# 《Social Democracy: An Alternate History》军事系统说明

> 版本基准：`changes.txt` 最新条目 v1.3.2
> 分析对象：`source/scenes/**.dry`
> 说明：本文所有数值均来自源码，行号对应分析时的文件状态。

---

## 目录

1. [总览：军事系统的三层结构](#1-总览军事系统的三层结构)
2. [核心变量模型：Strength / Militancy / Loyalty](#2-核心变量模型strength--militancy--loyalty)
3. [四大准军事组织](#3-四大准军事组织)
4. [官方武装力量](#4-官方武装力量)
5. [SPD 的军事能力建设](#5-spd-的军事能力建设)
6. [内部安全与镇压工具](#6-内部安全与镇压工具)
7. [街头暴力与地方冲突](#7-街头暴力与地方冲突)
8. [军事财政：战舰与军费](#8-军事财政战舰与军费)
9. [政变与内战机制](#9-政变与内战机制)
10. [军事相关成就](#10-军事相关成就)
11. [关键文件索引](#11-关键文件索引)

---

## 1. 总览：军事系统的三层结构

游戏的军事系统不是"造兵打仗"式的军棋推演，而是一套**政治力量对比模拟**。它由三层组成：

```
┌─────────────────────────────────────────────────────────────┐
│  第一层：准军事组织（Paramilitaries）                        │
│  Reichsbanner │ SA │ Stahlhelm │ RFB                         │
│  属性：strength（人数）+ militancy（军事化程度）              │
│  用途：街头对抗、选举保卫、集会保护、内战战力                  │
├─────────────────────────────────────────────────────────────┤
│  第二层：官方武装（State Forces）                            │
│  Reichswehr │ 内政部警察 │ 普鲁士警察                         │
│  属性：strength + militancy + loyalty（忠诚度）               │
│  用途：镇压、政变、内战、选举干预                              │
├─────────────────────────────────────────────────────────────┤
│  第三层：政治控制（Political Control）                       │
│  coup_progress │ nazi_urgency │ strife │ judicial_reform      │
│  用途：决定何时爆发政变/内战、谁能镇压谁                       │
└─────────────────────────────────────────────────────────────┘
```

**核心设计思想**：SPD 在 1928 年拥有德国最庞大的准军事组织（Reichsbanner 200 万人），但它几乎没有军事化程度（militancy 0.01）。而敌人（Stahlhelm 50 万、SA 8 万）虽然人数少，军事化程度却是它的 50 倍。**人数不等于战力**——这是整个军事系统的核心张力。

在状态栏的"Paramilitaries"标签页中，四个组织的 Strength 与 Militancy 会实时显示（`status.scene.dry:104-136`），图书馆页也会展示（`library.scene.dry:240-280`）。

---

## 2. 核心变量模型：Strength / Militancy / Loyalty

所有军事计算都基于三个变量的乘法组合。

### 2.1 三个属性

| 属性 | 含义 | 范围 |
|---|---|---|
| `strength` | 组织人数（单位：千人） | 0 ~ 数千 |
| `militancy` | 军事化/训练/装备程度 | 0 ~ 5 |
| `loyalty` | 对民主政府的忠诚度 | 0 ~ 1 |

### 2.2 初始值（`root.scene.dry:134-162`）

| 组织 | strength | militancy | loyalty | 初始战力 |
|---|---|---|---|---|
| Reichsbanner | 2000 | 0.01 | — | **20** |
| Stahlhelm | 500 | 0.5 | — | **250** |
| SA | 80 | 0.5 | — | **40** |
| RFB | 130 | 0.5 | — | **65** |
| 内政部警察 | 50 | 1 | 0.45 | **22.5** |
| 普鲁士警察 | 90 | 1 | 0.5 | **45** |
| Reichswehr | 100 | 5 | 0.2 | **100**（忠诚部分） |

> 战力 = strength × militancy（官方武装再乘 loyalty）

**注意**：1928 年开局，Reichsbanner 的人数（2000 千）是 SA（80 千）的 25 倍，但战力只有 SA 的一半。**这是玩家必须立刻着手解决的核心问题。**

### 2.3 难度修正（`root.scene.dry:596-618`）

| 难度 | rb_strength |
|---|---|
| 简单 | 2500 |
| 普通 | 2000 |
| 困难 | 1000 |
| 历史模式 | 2000 |

---

## 3. 四大准军事组织

### 3.1 Reichsbanner Schwarz-Rot-Gold（黑红金国旗团）

**归属**：SPD 主导，官方上联合 SPD / 中央党 / DDP
**初始**：2000 千人，militancy 0.01
**定位**：共和国的群众性防卫组织，但"目前几乎算不上军事组织"（源码原话）

#### 军事化成本递增机制

`rb_militarization_cost` 由当前 militancy 决定（`reichsbanner.scene.dry:7`、`streetfighting.scene.dry:4`、`iron_front.scene.dry:5`）：

```javascript
rb_militarization_cost = 1                                    // 默认
if (rb_militancy > 0.1)  rb_militarization_cost = 2
if (rb_militancy > 0.25) rb_militarization_cost = 3
```

**这意味着军事化越深入，边际成本越高。**

#### 主要行动（`party_affairs/reichsbanner.scene.dry`，6 个月冷却，最多 6 次）

| 行动 | 成本 | 效果 |
|---|---|---|
| 军事化资助 | `-rb_militarization_cost` | `rb_strength += 100`、`rb_militancy += 0.05`、左派 strength +2、改良派 dissent +5、工人支持 +2 |
| 用既有资源加训 | — | `rb_militancy += 0.02`、`funded_reichsbanner -= 1` |
| 保持现状 | — | — |
| 削减资助 | `+1 resources` | `rb_strength -= 100`、`rb_militancy -= 0.05`、工人流向 KPD +2 |
| 允许女性加入 | `-1 resources` | `rb_strength += 400`、`rb_militancy *= 0.85`（新兵缺乏经验）；需 `womens_rights >= 4` + Sender 顾问 + 铁血阵线已成立 |

#### 招募困境

当 SPD 不再是工人中的主导政党时（`workers_spd < 46` 或低于 NSDAP/KPD），Reichsbanner 招募困难，成员流失（`reichsbanner.scene.dry:15`）。

#### 中央党与 DDP 的退出危机

`events/reichsbanner_zentrum.scene.dry`：当 `rb_militancy >= 0.2` 时，中央党和 DDP 威胁退出：

| 选项 | 效果 |
|---|---|
| 让他们走 | `rb_strength *= 0.9`、Z 关系 −5、DDP 关系 −5、左派 +5 |
| 降低军事化 | `rb_militancy *= 0.5`（代价惨重） |
| 说服他们留下 | 需 `strife >= 5` 且 Z 关系 ≥50（或 Joos 领袖 + ≥30）且 DDP 关系 ≥50 |

#### 其他增强途径

- `party_affairs/party_organizations.scene.dry:55`：−1 resources → `rb_strength += 100`、`rb_militancy += 0.01`
- 青年组织（`:63`）：−1 resources → `rb_strength += 50`、`rb_militancy += 0.02`
- Mierendorff 顾问行动（`advisors/mierendorff.scene.dry:23`）：按 SPD 在工人中的得票率比例招募，`rb_strength += 200 * workers_spd / (工人总支持)`
- Seydewitz 顾问行动（`advisors/seydewitz.scene.dry:32`）：−1 resources → `rb_strength += 50`、`rb_militancy += 0.025`

#### 削弱途径

| 事件 | 效果 |
|---|---|
| 中央派领袖辞职 | `rb_strength -= 100` |
| 改良派领袖辞职 | `rb_strength -= 250` |
| 左派分裂 | `rb_strength -= 300`、`rb_militancy -= 0.05` |
| 工会宣布独立 | `rb_strength -= 600` |
| 普鲁士政变投降 | `rb_strength -= 1000`、`rb_militancy /= 2` |
| 集会失败 | `rb_strength -= 50` |

### 3.2 SA（Sturmabteilung，纳粹冲锋队）

**归属**：NSDAP
**初始**：80 千人，militancy 0.5
**定位**：纳粹的街头暴力工具

#### 自动增长（`post_event.scene.dry:297-441`）

按月摊分，每年累计：

| 年份 | SA 增长 |
|---|---|
| 1929 | +50 |
| 1930 | +100 |
| 1931 | +50（若 `works_program` 为 0 则 +100） |
| 1932 | +200（若无就业计划） |
| 1932 | +50（若失业 >25） |

1931 年还有 `sa_militancy += 0.1/12`。

#### 事件驱动增长

| 事件 | 效果 |
|---|---|
| Harzburg Front | `sa_strength += 100` |
| 选举惨败（`coup_progress >= 7`） | `sa_strength += 100` |
| 紧急政府成立 | `sa_strength += 100` |
| 信任投票失败 | `sa_strength += 200` |
| 进军柏林 | `sa_strength += 80` |
| 允许 Altona 游行 | `sa_strength += 80` |
| 解除禁令 | `sa_strength += 100`、`sa_militancy += 0.05` |
| 法官解禁 | `sa_strength += 100`、`sa_militancy += 0.04` |
| 电影《西线无战事》被禁 | `sa_strength += 50` |
| 希特勒驱逐失败 | `sa_strength += 50`、`coup_progress += 3` |

#### 削弱途径

| 手段 | 效果 |
|---|---|
| 禁令（内政部） | `sa_strength *= 0.85`（警察忠诚 ≥0.7 时额外 ×0.7）、`sa_militancy -= 0.05` |
| 禁令（普鲁士） | `sa_strength *= 0.9`（警察忠诚 ≥0.75 时额外 ×0.75） |
| 进一步镇压 | `sa_strength *= 0.7`、`sa_militancy -= 0.05`（需司法改革 ≥3 + 警察忠诚 ≥0.7） |
| 调查极右 | `sa_strength -= 20` |
| 反犹宣传反击 | `sa_strength -= 20` |
| 希特勒驱逐成功 | `sa_strength /= 2` |
| 进军柏林胜利 | `sa_strength *= 0.7` |
| 回归常态 | `sa_strength *= 0.7` |
| 纳粹危机 | `sa_strength *= 0.7` |

#### 禁令的脆弱性

`events/judges_unban_sa.scene.dry`：当 `sa_banned == 1` 且 `sa_ban_timer == 0` 且 `judicial_reform < 2` 时，法官会**重新合法化 SA**，`sa_strength += 100`、`sa_militancy += 0.04`。

**这是军事系统与司法改革的强耦合**：不改革司法，禁令形同虚设。

### 3.3 Stahlhelm（钢盔团）

**归属**：DNVP
**初始**：500 千人，militancy 0.5（**开局最强的准军事组织**）
**定位**：右翼退伍军人组织

#### 自动增长

| 年份 | 增长 |
|---|---|
| 1929 | +100 |
| 1930 | +100 |
| 1931 | +50 |

#### 事件驱动

| 事件 | 效果 |
|---|---|
| Harzburg Front | +100 |
| 削减军费 | `sh_strength += 15`、`sh_militancy += 0.05`（退伍军人加入） |
| 选举惨败 | +100 |
| 信任投票失败 | +200 |
| 进军柏林 | +80 |

#### 削弱途径

| 手段 | 效果 |
|---|---|
| 禁令（内政部） | `sh_strength *= 0.85`（警察忠诚 ≥0.7 时额外 ×0.7） |
| 禁令（普鲁士） | `sh_strength *= 0.85`（警察忠诚 ≥0.75 时额外 ×0.7） |
| 进一步镇压 | `sh_strength *= 0.7`、`sh_militancy -= 0.05`（需司法改革 ≥4 + 警察忠诚 ≥0.7） |
| 法官解禁 | `sh_strength += 100`、`sh_militancy += 0.01` |

**政治代价**：禁 Stahlhelm 会 `dvp_relation -= 5`、普鲁士警察忠诚 −0.1；若 Hindenburg 是总统且处于大联合政府，还会 `coalition_dissent += 1`。

### 3.4 RFB（Rotfrontkämpferbund，红色前线战士同盟）

**归属**：KPD
**初始**：130 千人，militancy 0.5
**定位**：共产党的准军事组织

#### 变化途径

| 事件 | 效果 |
|---|---|
| 血腥五月（镇压） | `rfb_strength -= 80`、`rfb_banned = 1` |
| 血腥五月（支持） | `rfb_strength += 50`、`rfb_militancy += 0.1` |
| 血腥五月（联合） | `rfb_strength += 100`、`rfb_militancy += 0.1` |
| 与 RFB 停战 | `rfb_strength += 50` |
| 禁止 RFB | `rfb_strength -= 50`、`kpd_relation -= 15` |
| 进一步镇压 | `rfb_strength *= 0.7`、`rfb_militancy -= 0.05` |

#### 特殊地位

**RFB 是唯一可以为 SPD 所用的共产党武装**——在内战中，若 `kpd_relation >= 60`，RFB 全力加入 SPD 一方；`>= 45` 时加入一半（`civil_war.scene.dry:43-48`）。

---

## 4. 官方武装力量

### 4.1 Reichswehr（国防军）

**初始**：100 千人，militancy 5（**战力最高的单一组织**），loyalty 0.2（**极不忠诚**）

**政治定位**：源码称其为"深度反动的机构，对社会主义或民主的任何概念都普遍敌视"（`military_policy.scene.dry:12`）。

#### 忠诚度的关键作用

Reichswehr 的 loyalty 决定它在内战中的归属：

```javascript
loyal_reichswehr_power   = strength × militancy × loyalty        // 我方
hostile_reichswehr_power = strength × militancy × (1 - loyalty)  // 敌方
```

**初始状态**：忠诚战力 100，敌对战力 400。**如果不提升忠诚度，国防军会把 4 倍于自身忠诚部分的战力投向敌人。**

#### 军事政策三选项（`government_affairs/military_policy.scene.dry`，需国防部属 SPD，6 个月冷却）

| 选项 | 成本 | 效果 |
|---|---|---|
| **增加军费** | −1 预算 | `loyalty += 0.07`、`strength += 20`；左派 dissent +5、KPD dissent +1、东西方关系 −1、赔款谈判 −1 |
| **削减军费** | +1 预算 | `militancy -= 1`、`strength -= 20`、`loyalty -= 0.05`、`sh_strength += 15`、`sa_strength += 5`、`sh_militancy += 0.05`；**`coup_progress += 1`，且忠诚度越低加得越多**（<0.2、<0.1、≤0 各再加 1） |
| **彻底改革** | −1 预算 | `loyalty += 0.15`、`militancy -= 0.5`（若忠诚 <0.5）、`coup_progress += 1`、DVP 关系 −5 |

**削减军费的连锁反应**（`:33`）是游戏中最典型的"陷阱选项"：

```
coup_progress += 1
coup_progress += 1 if loyalty < 0.2
coup_progress += 1 if loyalty < 0.1
coup_progress += 1 if loyalty <= 0
→ 最坏情况一次性 +4
```

同时被裁撤的士兵流入 Stahlhelm（+15）和 SA（+5）。

#### 其他影响忠诚度的途径

| 来源 | 效果 |
|---|---|
| 苏援换军事合作 | `loyalty += 0.05`、`militancy += 0.2` |
| 建造战舰（Panzerkreuzer） | `loyalty += 0.1` |
| 否决战舰 | `loyalty -= 0.05` |
| 《世界舞台》事件（维护军方） | `loyalty -= 0.1`、`coup_progress += 1` |
| 《世界舞台》事件（批评军方） | `loyalty += 0.05` |
| 奥地利社民党胜利 | `loyalty += 0.1`、`coup_progress -= 2` |
| 全 SPD 内阁 | `loyalty -= 0.05 ~ 0.1` |
| KPD 全面掌权 | `loyalty += 0.25`（诡异但存在） |

### 4.2 内政部警察（Interior Police）

**初始**：50 千人，militancy 1，loyalty 0.45
**权限**：仅当 SPD 控制内政部时可用

#### 行动（`government_affairs/police.scene.dry`，6 个月冷却）

| 行动 | 效果 |
|---|---|
| 提升忠诚 | `interior_police_loyalty += 0.1` |
| 调查大企业腐败 | 需忠诚 ≥0.5；成功则工人支持 +5、通胀微降 |
| 调查极右 | 需忠诚 ≥0.55；成功则 `sa_strength -= 20`、纳粹各人群支持 −3 |
| 调查/取缔国内敌人 | 见 §6 |
| 驱逐希特勒 | 见 §6.4 |

#### 忠诚度的关键用途

1. **禁令效果翻倍**：禁 SA 时若 `interior_police_loyalty >= 0.7`，额外 ×0.7
2. **镇压的前提**：进一步镇压 SA 需忠诚 ≥0.7（司法改革 ≥3）；镇压 Stahlhelm 需 ≥0.7（司法改革 ≥4）
3. **调查成功与否**：调查腐败需 ≥0.5，调查极右需 ≥0.55

**注意**：禁止 SA 或 Stahlhelm 本身会 `interior_police_loyalty -= 0.05`——警察中"有很多纳粹的盟友"。

### 4.3 普鲁士警察（Prussian Police）

**初始**：90 千人，militancy 1，loyalty 0.5
**权限**：仅当 `spd_prussia == 1`（SPD 控制普鲁士州政府）

#### 行动（`government_affairs/prussian_affairs.scene.dry`，6 个月冷却）

| 行动 | 效果 |
|---|---|
| 提升忠诚 | `prussian_police_loyalty += 0.1` |
| 扩充警力 | `prussian_police_strength += 20` |
| 清洗官僚机构 | `loyalty += 0.05`、民族主义 −5、`coup_progress += 0.5` |
| 禁/解禁 SA / SH / RFB | 见 §6 |
| 与梵蒂冈谈判/签约 | 与军事无关 |

#### 忠诚度的关键用途

1. **集会保护**：`police_protect_success = 忠诚 × militancy × strength × 2 − SA 战力`（`rally.scene.dry:21`）
2. **警察+Reichsbanner 联合保护**：需先有 `prussian_police_training > 0`（`:50`）
3. **禁令效果**：禁 SA 时忠诚 ≥0.75 额外 ×0.75；禁 SH 时忠诚 ≥0.75 额外 ×0.7
4. **《西线无战事》放映保护**：需忠诚 ≥0.65（普通保护）或 ≥0.75（免费票）
5. **Altona 冲突**：忠诚 >0.75 时警察保持克制，否则开枪造成数十平民死亡（`altona_clashes.scene.dry:25`）
6. **普鲁士警察训练 Reichsbanner**：需忠诚 >0.5（`streetfighting.scene.dry:49`）
7. **教育政策反哺**：公共高中政策让 `prussian_police_loyalty += 0.04`（`education_science.scene.dry:133`）——**让无产阶级子弟受教育，警察就更忠诚**

---

## 5. SPD 的军事能力建设

### 5.1 铁血阵线（Iron Front）

**成立**：`party_affairs/confronting_nazis.scene.dry:38-42`，需 `nazi_urgency >= 3`

**成员**：SPD + ADGB 工会联合会 + Reichsbanner
**标志**：三支箭头（向下指向左边）

成立后解锁 `party_affairs/iron_front.scene.dry`（7 个月冷却）：

| 行动 | 成本 | 效果 |
|---|---|---|
| 防卫动员 | `-rb_militarization_cost` | `rb_strength += 50`、`rb_militancy += 0.05` |
| 和平主义宣传 | — | `pacifism += 1`、民族主义 −5 |
| 保卫共和 | — | `pro_republic += 5`、民主化 +1 |
| 支持 WTB 计划 | — | 工人/失业者支持大幅上升 |
| 反反犹主义 | — | 需 `confronting_antisemitism > 1`；纳粹各人群 −4 |

**成就**：`eiserne_front`（成立铁血阵线）

### 5.2 街头战斗（Streetfighting）

**解锁条件**：1930 年后且 `sa_strength >= 150` 且未进入回归常态
**冷却**：6 个月
**注意**：每次进入都 `strife += 1`

| 行动 | 效果 |
|---|---|
| **实战检验** | `rb_militancy += 0.1`、`sa_strength += 40`、`rb_strength -= 100`（需 0.1 < militancy < 0.5，仅 1 次） |
| **武装 Reichsbanner** | `-rb_militarization_cost` → `rb_militancy += 0.06`、`rb_strength += 50`、`sa_strength += 50` |
| **训练工会成员**（需铁血阵线） | `rb_militancy += 0.03`、`rb_strength += 200`、`sa_strength += 50`（最多 2 次） |
| **用普鲁士警察训练** | 需 `spd_prussia` 且警察忠诚 >0.5；`rb_militancy += 0.05`、`prussian_police_training += 1` |
| **避免冲突** | `rb_militancy -= 0.02`、`rb_strength -= 50`、`pacifism += 1` |
| **与 RFB 停战** | 需 `kpd_relation >= 45`；`rfb_strength += 50`、`rb_strength += 50`、`sa_strength += 50` |

**重要观察**：几乎所有激进选项都会**同时增强 SA**（+40 ~ +50）。这是对"街头对抗会为纳粹提供招募素材"的历史逻辑的模拟。

### 5.3 政治集会（Political Rally）

`party_affairs/rally.scene.dry`，6 个月冷却。

**当 `sa_strength > 180` 且 SA 未被禁且未进入回归常态时，SA 会打断集会**（`:8`）：

| 应对 | 判定公式 | 失败后果 |
|---|---|---|
| 警察保护 | `忠诚 × militancy × strength × 2 − SA 战力` | `strife += 1`、工人流向 NSDAP +3 |
| Reichsbanner 保护 | `rb_strength × rb_militancy − sa_strength × sa_militancy` | `workers_nsdap += 3`、`rb_strength -= 50` |
| 警察+RB 联合 | 需 `prussian_police_training > 0`；三者相加 | 同上 |
| 取消集会 | — | `workers_nsdap += 3` |

**注意**：警察保护公式中警察有一个 **×2 的加成**，且乘的是 loyalty——这意味着**训练有素的忠诚警察比同等规模的准军事组织更有效**。

---

## 6. 内部安全与镇压工具

### 6.1 调查国内敌人（`government_affairs/domestic_enemies.scene.dry`）

需 SPD 控制内政部。这是军事系统的"行政控制"分支。

| 行动 | 前置条件 | 效果 |
|---|---|---|
| **禁 SA** | `nazi_urgency >= 3` | `sa_strength *= 0.85`（忠诚 ≥0.7 时额外 ×0.7）、`sa_militancy -= 0.05`；DVP −3、内政部警察忠诚 −0.05、普鲁士警察忠诚 −0.05 |
| **禁 Stahlhelm** | — | `sh_strength *= 0.85`（忠诚 ≥0.7 时额外 ×0.7）；DVP −5、普鲁士警察忠诚 −0.1 |
| **禁 RFB** | `communist_coalition < 3` | `rfb_strength -= 50`；KPD −15、Z +5、DVP +5、两警察忠诚各 +0.1、KPD 联盟异议 +2 |
| **镇压 SA** | 司法改革 ≥3 + 内政警察忠诚 ≥0.7 | `sa_strength *= 0.7`、`sa_militancy -= 0.05` |
| **镇压 Stahlhelm** | 司法改革 ≥4 + 内政警察忠诚 ≥0.7 | `sh_strength *= 0.7`、`sh_militancy -= 0.05` |
| **镇压 RFB** | 需已禁 | `rfb_strength *= 0.7`、`rfb_militancy -= 0.05`、KPD −10 |
| **解禁** | 需已禁 | 各组织 `strength += 100`（RFB 为 +50） |

### 6.2 普鲁士版禁令（`government_affairs/prussian_affairs.scene.dry`）

与内政部版本并行但判定条件不同：

| 行动 | 效果差异 |
|---|---|
| 禁 SA | `sa_strength *= 0.9`（警察忠诚 ≥0.75 时额外 ×0.75） |
| 禁 Stahlhelm | `sh_strength *= 0.85`（忠诚 ≥0.75 时额外 ×0.7） |
| 禁 RFB | `rfb_strength -= 50`、KPD −15、普鲁士警察忠诚 +0.1 |

**内政部 vs 普鲁士**：内政部版本基础削弱更强（0.85 vs 0.9），普鲁士版本额外削弱更宽松（忠诚门槛 0.75 vs 0.7）。**同时控制两者可以叠加使用。**

### 6.3 司法改革的枢纽地位

军事系统的几乎所有镇压工具都依赖 `judicial_reform`：

| 行动 | 司法改革要求 |
|---|---|
| 镇压 SA | ≥3 |
| 镇压 Stahlhelm | ≥4 |
| 无补偿国有化 | ≥3 |
| 工人接管工厂 | ≥3（或 `rb_militancy >= 0.25`） |
| 资本管制 | ≥2 |
| 驱逐希特勒 | ≥2 |
| 禁止 Altona 游行 | ≥2 |
| 防止法官解禁 SA | ≥2（**低于此值禁令会被推翻**） |
| 土地改革 | ≥2 |

**`judicial_reform` 每次司法政策 +2**（`judiciary.scene.dry:27`），且 `coup_progress += 1`。

### 6.4 驱逐希特勒

`government_affairs/deport_hitler.scene.dry`

**前置**：`nazi_urgency >= 3`、未驱逐、总理非 Papen/Schleicher、`investigate_far_right >= 2`
**可选条件**：`judicial_reform >= 2`、总统选举未发生、`spd_prussia == 1`

**分支**：
- 若 `sa_strength < 200` → 直接成功
- 若 `sa_strength >= 200` → 强制突破判定：

```javascript
total_allied_strength = rb_strength × rb_militancy + 普鲁士警察战力
enemy_strength        = sa_strength × sa_militancy
```

| 结果 | 效果 |
|---|---|
| 成功 | `hitler_deported = 1`、`sa_strength /= 2`、`sa_banned = 1`、`coup_progress -= 2`、NSDAP 各人群 −10、领袖变为 Goebbels |
| 失败 | `sa_strength += 50`、NSDAP 各人群 +5、`coup_progress += 3` |

**成就**：`deport_hitler`

---

## 7. 街头暴力与地方冲突

### 7.1 `strife`（动乱度）

隐藏变量，用于衡量街头暴力的总体水平。主要来源：

- 街头战斗卡每次进入 +1
- 集会保护失败 +1
- Altona 冲突 +1
- 《西线无战事》事件 +1
- 与 RFB 停战 +1
- 进军柏林 +1

**用途**：说服中央党和 DDP 留在 Reichsbanner 需 `strife >= 5`（`reichsbanner_zentrum.scene.dry:31`）。

### 7.2 Altona 冲突（1932.6）

`events/altona_clashes.scene.dry`

| 选项 | 条件 | 效果 |
|---|---|---|
| 禁止游行 | 司法改革 ≥2 | `sa_strength -= 10` |
| 允许+重警力 | 警察忠诚 >0.75 | `sa_strength += 10`（无暴力） |
| 允许+重警力 | 警察忠诚 ≤0.75 | `strife += 1`、`sa_strength += 50`、KPD −8（**血腥星期日**） |
| 允许+无警力 | — | `sa_strength += 80`、`rfb_strength += 50`、`strife += 1`、KPD −8 |

### 7.3 《西线无战事》（1930.12）

`events/all_quiet.scene.dry`

| 选项 | 条件 | 效果 |
|---|---|---|
| 禁映 | — | `sa_strength += 50`、民族主义 +6、`pro_republic -= 5`、纳粹各人群上升 |
| 允许 | — | `sa_strength += 15`、`strife += 1` |
| 允许+警察保护 | 警察忠诚 ≥0.65 | 民族主义 −4、`pro_republic += 4`、`strife += 1` |
| 允许+免费票 | 警察忠诚 ≥0.75 | 民族主义 −5、`pro_republic += 5`、纳粹各人群 −3 |

### 7.4 血腥五月（Blutmai）

`events/blutmai.scene.dry`：多个分支，涉及 `rfb_strength` 与 `rfb_militancy` 的增减，以及 KPD 关系的变化。

### 7.5 Harzburg Front（1931.10 或 `coup_progress >= 6`）

`events/harzburg_front.scene.dry`：NSDAP + SA + Stahlhelm + DNVP 联合成立反政府阵线。

```
sh_strength += 100、sa_strength += 100、nazi_urgency += 1、iron_front_timer = 0
```

这是军事系统的一个重要转折点——右翼准军事力量开始统一指挥。

---

## 8. 军事财政：战舰与军费

### 8.1 Panzerkreuzer（装甲巡洋舰）事件链

**Panzerkreuzer A**（`events/panzerkreuzer_ministry.scene.dry`，1928.8 起，需国防部属 SPD）：

| 选项 | 效果 |
|---|---|
| 建造 | `reichswehr_loyalty += 0.1`；全派系 dissent +5~10 |
| 不建造 | `reichswehr_loyalty -= 0.05`；全派系 dissent −5~10、民族主义 −5、`pacifism += 1`、Z/DVP 关系 −5、工人支持 +5 |

**Panzerkreuzer B**（`events/panzerkreuzer_b.scene.dry`）：后续战舰，成功否决可 `budget += 1`。

### 8.2 军费与财政的耦合

- 增加军费 −1 预算，削减军费 +1 预算
- 削减军费降低 `economic_growth -= 0.1`，增加军费 `economic_growth += 0.1`
- 削减军费会恶化外交（东西方关系 −1、赔款谈判 −1、EU 进度 −1）

---

## 9. 政变与内战机制

### 9.1 `coup_progress` 的累积

| 来源 | 增量 |
|---|---|
| 选举失败 | +2（基础）+ 2（NSDAP ≥30%）+ 2（NSDAP+DNVP ≥50%） |
| 削减军费 | +1 ~ +4 |
| 军事改革 | +1 |
| 司法改革 | +1 |
| 官僚清洗 | +0.5 |
| 土地改革 | +1 |
| 左派经济计划采纳 | +1 |
| 无补偿国有化 | +3 |
| 工人接管工厂 | +5 |
| 资本罢工时夺厂 | +6 |
| 希特勒驱逐失败 | +3 |
| 《世界舞台》事件 | +1 |
| 流行阵线/左翼阵线政府 | +2 ~ +3 |
| 极右联盟获多数 | +3 |

**削减来源**：调查极右成功（`coup_progress >= 7` 时 −1）、驱逐希特勒成功（−2）、停付赔款（−2）、回归常态（−4）、纳粹危机（−4）、奥地利社民党胜利（−2）、进军柏林胜利（归零）。

### 9.2 政变爆发条件

**进军柏林**（`events/march_on_berlin.scene.dry:3`）：

```
(spd_in_government 且 coup_progress >= 10 且 year >= 1930 且 (SA 未禁 或 SH 未禁))
或 (year >= 1933 且 month >= 2 且 NSDAP+DNVP 得票率 >= 0.5)
```

**普鲁士政变**（`events/prussian_coup.scene.dry:3`）：

```
(chancellor == "Papen" 或 "Schleicher") 且 president == "Hindenburg"
且 year >= 1932 且 month >= 8 且 spd_in_government == 0
且 spd_prussia == 1 且 not presidential_powers
```

### 9.3 战力对比公式

三个场景使用**不同的公式**：

#### 进军柏林（`march_on_berlin.scene.dry:60`）

```javascript
defense_strength = rb_strength × rb_militancy × (1 - dissent/2)
                 + 普鲁士警察战力                    (若 spd_prussia)
                 + workers_spd_normalized × (2 - dissent) × (2 - unemployed/100)
                 + Reichswehr 忠诚战力               (若 president=="Braun" 且 spd_in_government)

enemy_strength   = sa_strength × sa_militancy + sh_strength × sh_militancy
```

#### 普鲁士政变（`prussian_coup.scene.dry:32`）

```javascript
defense_strength = 同上
enemy_strength   = sa_power + sh_power + reichswehr_strength × militancy × (1-loyalty)/2
```

**注意**：普鲁士政变中，敌方额外获得**不忠诚国防军战力的一半**，且我方**不获得**忠诚国防军加成。

#### 内战总决算（`civil_war.scene.dry:22-84`）

```javascript
// 我方
rb_power = rb_strength × rb_militancy
           × (1 - dissent/1.5)              // 若 dissent > 0.15
+ 普鲁士警察战力                            // 若 spd_prussia
+ Reichswehr 忠诚战力                       // 全额（若 SPD 组阁）；否则 1/4
+ RFB 战力                                  // kpd_relation >= 60 全额；>= 45 半额
+ (2 - labor_dissent/100) × normalized_workers_total × (2 - unemployed/100) × 2.5

// 敌方
enemy_power = sa_power + sh_power + reichswehr_strength × militancy × (1 - loyalty)
```

**判定**：

| 条件 | 结果 |
|---|---|
| `total_power > enemy_power × 1.1` | **共和胜利**（`republic_victory = 1`） |
| `total_power / enemy_power >= 0.6` | **长期内战**（`long_war = 1`） |
| 否则 | **彻底失败**（`total_defeat = 1`） |

**`is_favorable`**：`total_power >= enemy_power × 0.95` 时为 1（用于结局文本）。

### 9.4 内战前的四个选项（`civil_war.scene.dry:102-155`）

需要至少选 2 个才能推进到 `war_outcome`（`war_choices >= 2`）：

| 选项 | 效果 |
|---|---|
| 呼吁国防军保持中立 | `war_choices += 1`（文本按 loyalty 分档） |
| 呼吁共产党支持 | `war_choices += 1`（需非 KPD 掌权） |
| 总罢工 | `war_choices += 1`（文本按工人团结度分档） |
| 召唤忠诚警察 | `war_choices += 1`（需 `spd_prussia`） |
| 外国干预 | `war_choices += 1`（普鲁士政变时不可用） |

**总罢工的战力贡献**是公式中唯一依赖 `unemployed` 的项——**失业率越高，工人阶级的动员力越弱**（`2 - unemployed/100`）。

### 9.5 长期内战的求援（`civil_war.scene.dry:185-217`）

| 求援对象 | 条件 |
|---|---|
| 西方（法英） | `west_relation >= 2` |
| 苏联 | `(soviet_relation >= 1 且 kpd_relation >= 50)` 或 `kpd_relation >= 75` |
| 东方（波兰、捷克斯洛伐克） | `east_relation >= 2` |

**注意**：苏联援助主要流向 KPD，源码明确提示"如果获胜，这对我们的未来不利"。

### 9.6 内战触发的其他路径

内战并非只由进军柏林/普鲁士政变触发，还包括：

- 希特勒上台后选择"在街头战斗"（`hitler_takes_power.scene.dry:22`）
- 1932 年总统选举后 KPD 的 Thälmann 获胜且无总统制权力（`death_of_hindenburg_president.scene.dry:696`）
- 流行阵线/左翼阵线政府成立时 `coup_progress >= 10`（`election_1928.scene.dry:380, 511`）
- KPD 不信任投票（`kpd_vote_of_no_confidence.scene.dry:39`）

### 9.7 公民投票路径（`death_of_hindenburg_president.scene.dry:665-673`）

若选择"只能通过民主手段击败法西斯"：

```javascript
pro_democracy_votes = spd_votes + ddp_votes + z_votes
                    - (sa_strength × sa_militancy / 10)
                    + (rb_strength × rb_militancy / 10)
if (pro_republic >= 60) {
    pro_democracy_votes += kpd_votes + dvp_votes
}
```

**`>= 50` 则宪法危机化解，否则希特勒上台。** 这是准军事力量直接影响选举结果的唯一公式。

---

## 10. 军事相关成就

| 成就 | 条件 | 位置 |
|---|---|---|
| **Eiserne Front** | 成立铁血阵线 | `confronting_nazis.scene.dry:43` |
| **Drei Pfeile** | 不进内战击败政变（进军柏林或普鲁士政变胜利） | `march_on_berlin.scene.dry:70`、`prussian_coup.scene.dry:45` |
| **Bollwerk der Demokratie** | 抵抗普鲁士政变并获胜 | `prussian_coup.scene.dry:37` |
| **Bürgerkrieg** | 进入长期内战 | `game_over.scene.dry:16` |
| **Sieg für die Republik** | 内战胜利 | `game_over.scene.dry:20-22` |
| **Deport Hitler** | 成功驱逐希特勒 | `deport_hitler.scene.dry:44, 52` |
| **Mädchen und Uniform** | 允许女性加入 Reichsbanner | `reichsbanner.scene.dry:67` |
| **Anders als die Andern** | 同性恋者加入 Reichsbanner | `reichsbanner.scene.dry:74` |
| **Klassenkampf** | 高工人支持 + 低中产支持 | `game_over.scene.dry` |

---

## 11. 关键文件索引

| 文件 | 作用 |
|---|---|
| `source/scenes/root.scene.dry:131-162` | 全部军事变量的初始化 |
| `source/scenes/status.scene.dry:104-148` | 军事属性的 UI 展示 |
| `source/scenes/post_event.scene.dry:297-441` | SA/SH 的年度自动增长 |
| `source/scenes/events/civil_war.scene.dry` | **内战总决算**（核心公式） |
| `source/scenes/events/march_on_berlin.scene.dry` | 进军柏林政变 |
| `source/scenes/events/prussian_coup.scene.dry` | 普鲁士政变 |
| `source/scenes/government_affairs/military_policy.scene.dry` | 国防军政策（军费/改革） |
| `source/scenes/government_affairs/police.scene.dry` | 内政部警察 |
| `source/scenes/government_affairs/prussian_affairs.scene.dry` | 普鲁士警察与禁令 |
| `source/scenes/government_affairs/domestic_enemies.scene.dry` | 禁/镇压国内敌人 |
| `source/scenes/government_affairs/deport_hitler.scene.dry` | 驱逐希特勒 |
| `source/scenes/government_affairs/judiciary.scene.dry` | 司法改革（镇压前置） |
| `source/scenes/party_affairs/reichsbanner.scene.dry` | Reichsbanner 建设 |
| `source/scenes/party_affairs/streetfighting.scene.dry` | 街头战斗 |
| `source/scenes/party_affairs/iron_front.scene.dry` | 铁血阵线行动 |
| `source/scenes/party_affairs/confronting_nazis.scene.dry` | 铁血阵线成立 |
| `source/scenes/party_affairs/rally.scene.dry` | 集会保护判定 |
| `source/scenes/party_affairs/party_organizations.scene.dry` | 组织建设（含 RB 招募） |
| `source/scenes/events/reichsbanner_zentrum.scene.dry` | 中央党/DDP 退出危机 |
| `source/scenes/events/harzburg_front.scene.dry` | 右翼联合阵线 |
| `source/scenes/events/judges_unban_sa.scene.dry` | 法官解禁 SA |
| `source/scenes/events/judges_unban_sh.scene.dry` | 法官解禁 Stahlhelm |
| `source/scenes/events/altona_clashes.scene.dry` | Altona 冲突 |
| `source/scenes/events/all_quiet.scene.dry` | 《西线无战事》 |
| `source/scenes/events/blutmai.scene.dry` | 血腥五月 |
| `source/scenes/events/panzerkreuzer_ministry.scene.dry` | 装甲巡洋舰 A |
| `source/scenes/events/panzerkreuzer_b.scene.dry` | 装甲巡洋舰 B |
| `source/scenes/advisors/mierendorff.scene.dry` | Mierendorff 招募行动 |

---

*本文档基于源码静态分析生成，未运行游戏验证。数值如与最新版本不符，以源码为准。*
