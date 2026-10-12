# 《Social Democracy: An Alternate History》政府卡牌说明

> 分析对象：`source/scenes/**/*.dry`
> 覆盖范围：所有带 `tags: govt_affairs` 的卡牌（共 **23 张**）+ 2 个由政府卡派生的子场景
> 说明：本文所有条件均逐字取自源码，可直接对照 `.dry` 文件核对。

---

## 目录

1. [卡牌系统基础：牌堆、抽卡与结算](#1-卡牌系统基础牌堆抽卡与结算)
2. [政府卡牌总表（23 张）](#2-政府卡牌总表23-张)
3. [逐卡详解](#3-逐卡详解)
   - [3.1 内阁卡（`cabinet`，简易难度可直取）](#31-内阁卡cabinet简易难度可直取)
   - [3.2 纯政务卡（只能靠政务牌堆随机抽）](#32-纯政务卡只能靠政务牌堆随机抽)
   - [3.3 由政务卡派生的子场景](#33-由政务卡派生的子场景)
4. [条件变量速查表](#4-条件变量速查表)
5. [关键门槛与依赖链](#5-关键门槛与依赖链)
6. [文件索引](#6-文件索引)

---

## 1. 卡牌系统基础：牌堆、抽卡与结算

### 1.1 主界面的三个来源

`main.scene.dry:19-22` 定义了普通难度下的手牌来源：

```
- @party                       党务牌堆（#party_affairs）
- @govt                        政务牌堆（#govt_affairs）  ← 本文主题
- #advisor                     顾问牌堆
- @shuffle_leadership_pinned   简易难度专用：改组领导层
```

| 项目 | 数值 | 出处 |
|---|---|---|
| 普通/困难/历史难度手牌上限 | `max-cards: 3` | `main.scene.dry:13` |
| 简易难度手牌上限 | `max-cards: 4` | `main.scene.dry:36` |

### 1.2 政务牌堆的解锁时间

`main.scene.dry:55-61`：

```
@govt
title: Government Affairs
view-if: time >= 6
card-image: img/reichstag_2.jpg
is-deck: true
- #govt_affairs
```

**关键条件：`time >= 6`。** `time` 从 1 开始计（1928 年 1 月），因此**政务牌堆要到 1928 年 6 月才会出现在手牌中**——游戏前 5 个月完全抽不到任何政府卡。

### 1.3 卡牌的字段语义

| 字段 | 含义 |
|---|---|
| `is-card: true` | 标记该场景为卡牌 |
| `tags: govt_affairs` | 进入政务牌堆（`#govt_affairs`）的凭据 |
| `tags: ..., cabinet` | 额外进入「内阁」牌堆（`#cabinet`），仅简易难度可用，见 3.1 |
| `view-if` | **抽取条件**：不满足则这张卡根本不在牌堆里，永远抽不到 |
| `frequency` | **抽取权重**。数值越高越容易被抽到；本作政府卡中出现的值：`25`（稀有）/ `50`（较稀有）/ `200`（高频），未写明的卡使用引擎默认权重 |
| `max-visits` | **最大访问次数**（卡级或选项级）。达到上限后该卡/该选项不再出现 |
| `on-arrival` | **打出结算**：写入 `*_timer` 冷却、`month_actions += 1`、修改各种数值 |
| `choose-if` | **选项可选条件**：不满足则该选项置灰、不可点 |
| `unavailable-subtitle` | 选项置灰时展示的原因文本（本质上复述了 `choose-if` 的各分支） |
| `go-to` | 打出后跳转（分岔结局、子菜单，或触发不信任投票） |

### 1.4 出牌代价：每月 1 次

`post_event.scene.dry:102-118`：当 `month_actions >= 1` 时推进一个月，并把所有 `Q.<name>_timer` 各减 1。

几乎所有政府卡 `on-arrival` 都会写 `month_actions += 1`。**因此一个月只能打出一张计入时间的卡。** 少见的例外：

- `domestic_enemies.scene.dry:2` 会 `month_actions += 1`，但它是从警察卡进入的子场景，不再单独抽卡；
- `shuffle_cabinet.scene.dry:35` 的 `month_actions += 1` 写在 `@shuffle` 选项里，而不是卡本身。

### 1.5 撤牌机制：`easy_discard` 与 `cancel_advisor_action`

`easy_discard.scene.dry`：

```
view-if: difficulty <= 0 and last_advisor_action = 0 and last_cabinet_action = 0
on-arrival:
    撤销 month_actions 的 +1
    把卡退回手牌
    Q[card.id + "_timer"] = 0     // 重置冷却
    visits[card.id] -= 1          // 撤销访问计数
```

即：**简易与普通难度下，抽到不满意的政府卡可以把时间「退回去」**，卡牌回到手牌，冷却清零，访问计数回滚。

`cancel_advisor_action.scene.dry` 类似，但只对 `last_advisor_action = 1 or last_cabinet_action = 1` 的情况生效（顾问行动 / 内阁行动）。

> 注意：`easy_discard` 依赖 `card.id + "_timer"` 与卡牌文件名一致。绝大多数政府卡满足这一约定（如 `agricultural_policy` → `agricultural_policy_timer`），这也是「冷却变量名 = 卡 id」的原因。

### 1.6 政府卡的 5 种「门槛」类型

读政府卡条件时，只要抓这五类门槛即可：

1. **执政门槛**：`spd_in_government = 1`
2. **部会门槛**：`<某>_minister_party = "SPD"`（外交/内政/司法/劳动/国防/经济/财政/农业八个部）
3. **冷却门槛**：`<card>_timer = 0`（或 `<= 0`）
4. **前置链门槛**：如 `economic_plan > 0`、`judicial_reform >= 4`、`progressive_coalition >= 50`、`labor_affairs_seen = 1`
5. **局势门槛**：`black_thursday_seen`、`year`、`unemployed`、`in_*_coalition` 等

---

## 2. 政府卡牌总表（23 张）

### 2.1 内阁卡（`tags: ..., cabinet`，16 张）

| # | 卡牌 | 文件 | 抽取条件（`view-if`） | 冷却 | 权重/次数 |
|---|---|---|---|---|---|
| 1 | Agricultural Policy | `government_affairs/agricultural_policy.scene.dry` | `spd_in_government = 1 and (agriculture_minister_party = "SPD") and agricultural_policy_timer == 0` | +6 | — |
| 2 | Constitutional Reform | `government_affairs/constitutional_reform.scene.dry` | `spd_in_government = 1 and justice_minister_party = "SPD" and constitutional_reform_timer = 0 and judicial_reform >= 4 and neorevisionism and ((in_weimar_coalition) or (in_spd_majority) or (in_left_front) or (in_popular_front)) and constitutional_reform < 3` | +12 | `frequency: 25` |
| 3 | Economic Democracy | `government_affairs/economic_democracy.scene.dry` | `spd_in_government and (economic_minister_party == "SPD" or finance_minister_party == "SPD") and (labor_minister_party == "SPD") and economic_democracy_timer <= 0` | +10 | `max-visits: 8` |
| 4 | Economic Policy | `government_affairs/economic_policy.scene.dry` | `spd_in_government = 1 and (economic_minister_party == "SPD" or finance_minister_party == "SPD") and economic_policy_timer <= 0 and economic_plan > 0` | +12 | — |
| 5 | Education & Science | `government_affairs/education_science.scene.dry` | `spd_in_government and spd_prussia and chancellor_party = "SPD" and education_science_timer = 0 and (black_thursday_seen = 0 or return_to_normalcy = 1)` | +9 | — |
| 6 | Fiscal Policy | `government_affairs/fiscal_policy.scene.dry` | `spd_in_government = 1 and finance_minister_party = "SPD" and fiscal_policy_timer = 0` | +6 | — |
| 7 | Foreign Policy | `government_affairs/foreign_policy.scene.dry` | `spd_in_government = 1 and foreign_minister_party = "SPD" and  foreign_policy_timer <= 0` | +8 | — |
| 8 | Homosexual Rights | `government_affairs/homosexual_rights.scene.dry` | `spd_in_government == 1 and (progressive_coalition >= 50) and chancellor_party == "SPD" and homosexual_rights_timer == 0 and homosexual_rights < 3` | +11 | `frequency: 25`、`max-visits: 3` |
| 9 | Judiciary Reform | `government_affairs/judiciary.scene.dry` | `spd_in_government = 1 and justice_minister_party = "SPD" and judiciary_timer = 0` | +6 | — |
| 10 | Labor Affairs | `government_affairs/labor_affairs.scene.dry` | `spd_in_government = 1 and labor_minister_party = "SPD" and labor_affairs_timer = 0 and strike_term_seen = 0` | 6 | — |
| 11 | Labor Rights | `government_affairs/labor_rights.scene.dry` | `spd_in_government = 1 and labor_minister_party = "SPD" and labor_rights_timer <= 0 and labor_affairs_seen = 1` | +10 | `max-visits: 6` |
| 12 | Military Policy | `government_affairs/military_policy.scene.dry` | `spd_in_government = 1 and reichswehr_minister_party = "SPD" and military_policy_timer <= 0` | +6 | — |
| 13 | Internal Security | `government_affairs/police.scene.dry` | `spd_in_government = 1 and interior_minister_party = "SPD" and police_timer <= 0` | +6 | — |
| 14 | Shuffle Cabinet | `government_affairs/shuffle_cabinet.scene.dry` | `spd_in_government == 1 and shuffle_cabinet_timer == 0 and chancellor_party == "SPD" and not in_spd_majority and not in_emergency_government and not in_left_front` | 6 | — |
| 15 | Social welfare policy | `government_affairs/social_welfare.scene.dry` | `spd_in_government = 1 and social_welfare_timer = 0` | 10 | — |
| 16 | Women's Rights | `government_affairs/womens_rights.scene.dry` | `spd_in_government = 1 and womens_rights_timer = 0 and chancellor_party == "SPD"` | +10 | `frequency: 50`、`max-visits: 6` |

### 2.2 纯政务卡（只有 `govt_affairs`，7 张）

| # | 卡牌 | 文件 | 抽取条件（`view-if`） | 冷却 | 权重/次数 |
|---|---|---|---|---|---|
| 17 | Coalition Affairs | `government_affairs/coalition_affairs.scene.dry` | `spd_in_government = 1 and coalition_dissent >= 1 and coalition_affairs_timer = 0 and (in_grand_coalition or in_weimar_coalition or in_popular_front)` | 5 | — |
| 18 | Dealing with Toleration | `government_affairs/dealing_with_toleration.scene.dry` | `dealing_with_toleration_timer = 0 and spd_toleration and chancellor_party == "Z"` | +6 | — |
| 19 | The Prussian Bulwark | `government_affairs/prussian_affairs.scene.dry` | `spd_prussia = 1 and prussian_affairs_timer <= 0` | +6 | — |
| 20 | War Guilt Inquiry | `government_affairs/war_guilt.scene.dry` | `spd_in_government = 1 and war_guilt_timer = 0` | 6 | `max-visits: 1` |
| 21 | The Economic Crisis | `party_affairs/crisis_program.scene.dry` | `crisis_urgency >= 1 and crisis_program_timer = 0 and economic_plan = 0 and black_thursday_seen == 1` | 5 | `frequency: 200` |
| 22 | Panzerkreuzer A（反对党部会） | `events/panzerkreuzer.scene.dry` | `panzerkreuzer_seen = 0 and year = 1928 and month >= 8 and reichswehr_minister_party != "SPD" and spd_in_government = 1` | — | — |
| 23 | Panzerkreuzer A（国防部在手） | `events/panzerkreuzer_ministry.scene.dry` | `panzerkreuzer_seen = 0 and year = 1928 and month >= 8 and reichswehr_minister_party = "SPD" and spd_in_government = 1` | — | — |

> **第 21 张的特殊性**：`crisis_program.scene.dry:8` 写的是 `tags: party_affairs, govt_affairs`，因此它**同时属于党务牌堆和政务牌堆**，无论点哪个牌堆都可能抽到。

### 2.3 部会门槛一览（决定你能抽到哪些卡）

| 部会变量 | 控制哪些卡 |
|---|---|
| `foreign_minister_party = "SPD"` | Foreign Policy |
| `interior_minister_party = "SPD"` | Internal Security |
| `justice_minister_party = "SPD"` | Judiciary Reform、Constitutional Reform |
| `labor_minister_party = "SPD"` | Labor Affairs、Labor Rights、Economic Democracy（必需） |
| `reichswehr_minister_party = "SPD"` | Military Policy、Panzerkreuzer A（22/23 互斥） |
| `economic_minister_party = "SPD"` | Economic Policy、Economic Democracy、Education & Science（科研分支） |
| `finance_minister_party = "SPD"` | Fiscal Policy、Economic Policy、Economic Democracy |
| `agriculture_minister_party = "SPD"` | Agricultural Policy |

无部会门槛的卡：Coalition Affairs、Dealing with Toleration、The Prussian Bulwark、War Guilt Inquiry、The Economic Crisis、Shuffle Cabinet、Social welfare policy、Women's Rights、Homosexual Rights（后者需要总理为 SPD）。

---

## 3. 逐卡详解

### 3.1 内阁卡（`cabinet`，简易难度可直取）

> **内阁机制**：`advisors/cabinet.scene.dry` 定义了固定的「Cabinet」卡：
>
> ```
> title: Cabinet
> is-pinned-card: true
> tags: advisor
> view-if: difficulty < 0 and spd_in_government and chancellor_party = "SPD"
> ...
> - #cabinet
> ```
>
> 也就是说：**简易难度（`difficulty = -1`）下，只要 SPD 执政且总理是 SPD，手牌里会常驻一个「内阁」入口；点开后直接列出带 `cabinet` 标签的政府卡，不必等政务牌堆随机抽。** 普通/困难/历史难度没有这个入口。
>
> 注意：内阁入口本身不修改卡牌各自的 `view-if`——**只列出当前已满足条件的卡**（部会在手、冷却归零、前置变量达标等一个都不能少），它省掉的只是「抽卡随机性」，不省掉门槛。

---

#### 1. Agricultural Policy 农业政策

- **文件**：`source/scenes/government_affairs/agricultural_policy.scene.dry`
- **抽取条件**：`spd_in_government = 1 and (agriculture_minister_party = "SPD") and agricultural_policy_timer == 0`
- **打出结算**：`agricultural_policy_timer += 6; month_actions += 1`

| 选项 | 显示条件 `view-if` | 可选条件 `choose-if` | 置灰原因（`unavailable-subtitle`） | 次数 |
|---|---|---|---|---|
| `@land_reform` 土地改革（-1 预算） | — | `judicial_reform >= 2 and budget > 0` | `budget <= 0` → 需 1 预算；`judicial_reform < 2` → 司法界绝不会允许 | `max-visits: 4` |
| `@agricultural_finance` 农业融资（-1 预算） | — | `budget >= 1` | — | — |
| `@pro_consumer` 食品采购（-1 预算） | — | `budget >= 1` | — | — |
| `@state_buyer` 国家粮食收购垄断（-2 预算） | — | `budget >= 2 and judicial_reform >= 2` | 副标题内提示 `judicial_reform < 2` 时司法界不会允许 | `max-visits: 1` |
| `@root` 暂不制定政策 | — | — | — | — |

另含 `@easy_discard`、`@cancel_advisor_action`。

---

#### 2. Constitutional Reform 宪制改革

- **文件**：`source/scenes/government_affairs/constitutional_reform.scene.dry`
- **抽取条件**：`spd_in_government = 1 and justice_minister_party = "SPD" and constitutional_reform_timer = 0 and judicial_reform >= 4 and neorevisionism and ((in_weimar_coalition) or (in_spd_majority) or (in_left_front) or (in_popular_front)) and constitutional_reform < 3`
  - 逐项拆解：SPD 执政 **且** 掌握司法部 **且** 冷却归零 **且** `司法改革 ≥ 4` **且** 已发现新修正主义（`neorevisionism`）**且** 处于魏玛联盟/SPD 多数/左翼阵线/人民阵线之一 **且** `宪制改革次数 < 3`
- **权重**：`frequency: 25`（很低，是稀有卡）
- **打出结算**：`month_actions += 1; constitutional_reform_timer += 12; pass_threshold = 0.51; pass_threshold = 0.6 if pro_republic < 65`
  - **注意 `pass_threshold`**：共和支持度 `pro_republic < 65` 时，公投门槛从 51% 提高到 **60%**。
- **跳转**：`go-to: reforms_menu`

| 选项 | 显示条件 `view-if` | 可选条件 `choose-if` | 支持度算法 `reform_support` |
|---|---|---|---|
| `@vote_threshold` 选票门槛改为 5% | `electoral_threshold = 0` | 见下一层 | `spd_normalized`；`+ z_normalized - 0.03` 若 `z_relation > 30`；`+ kpd_normalized` 若 `kpd_relation > 50 and kpd_normalized >= 0.1`；`+ nsdap_normalized` 若 `nsdap_normalized >= 0.2` |
| ↳ `@vote_threshold_2` 举行公投 | — | `reform_support >= pass_threshold` | 通过后：`electoral_threshold = 5; constitutional_reform += 1`；**`ddp_relation -= 25`、`dvp_relation -= 25`、`left_dissent += 20`**；小党选票按比例重新分配 |
| `@constructive_vonc` 禁止非建设性不信任案 | `constructive_vonc = 0` | 见下一层 | `spd_normalized + ddp_normalized`；`+ z_normalized - 0.03` 若 `z_relation >= 30`；`+ dvp_normalized` 若 `not stresemann_dead` |
| ↳ `@constructive_vonc_2` 举行公投 | — | `reform_support >= pass_threshold` | 通过后：`constructive_vonc = 1; constitutional_reform += 1` |
| `@presidential_powers` 削减总统权力 | `presidential_powers = 0` | 见下一层 | `spd_normalized + ddp_normalized + kpd_normalized`；`+ z_normalized` 若 `z_relation > 49 and (president == "Hindenburg" or president == "Eckener")`；否则若 `president == "Braun"` 则 `+ z_normalized - 0.03` |
| ↳ `@presidential_powers_2` 举行公投 | — | `reform_support >= pass_threshold` | 通过后：`presidential_powers = 1; constitutional_reform += 1` |
| `@as_is` 不推进宪制改革 | — | — | 直接 `go-to: root` |

三项改革通过后均授予成就 `verfassungsreform`。另有 `@easy_discard`、`@cancel_advisor_action`。

> 源码 `constitutional_reform.scene.dry:32` 另有 `@constitutional_bans`（允许取缔违宪政党），但被注释禁用，选择列表里不存在。

---

#### 3. Economic Democracy 经济民主

- **文件**：`source/scenes/government_affairs/economic_democracy.scene.dry`
- **抽取条件**：`spd_in_government and (economic_minister_party == "SPD" or finance_minister_party == "SPD") and (labor_minister_party == "SPD") and economic_democracy_timer <= 0`
  - **唯一需要「三部会」条件的卡**：劳动部 **必须**在手，经济部或财政部**至少**一个在手。
- **卡级次数**：`max-visits: 8`
- **打出结算**：`economic_democracy_timer += 10; month_actions += 1`

| 选项 | 显示条件 `view-if` | 可选条件 `choose-if` | 次数 |
|---|---|---|---|
| `@expand_councils` 支持企业委员会 | `works_councils == 0` | — | `max-visits: 1` |
| `@expand_councils_2` 支持全国/行业委员会 | `works_councils == 1` | — | `max-visits: 1` |
| `@expand_councils_3` 强化行业委员会（定工资与价格） | `works_councils == 2` | — | `max-visits: 1` |
| `@nationalize_1` 社会化关键产业（-1 预算） | — | `budget >= 1` | `max-visits: 3` |
| `@cooperatives_1` 支持工人与消费合作社（-1 预算） | — | `budget >= 1` | `max-visits: 3` |
| `@return` 暂不制定政策 | — | — | — |

> 三个委员会选项是**严格递进链**：`works_councils` 必须依次为 0 → 1 → 2，同一时间只有一个可见。

另含 `@easy_discard`、`@cancel_advisor_action`。

---

#### 4. Economic Policy 经济政策

- **文件**：`source/scenes/government_affairs/economic_policy.scene.dry`
- **抽取条件**：`spd_in_government = 1 and (economic_minister_party == "SPD" or finance_minister_party == "SPD") and economic_policy_timer <= 0 and economic_plan > 0`
  - **`economic_plan > 0` 是关键前置**：必须先通过 The Economic Crisis（第 21 张）确定经济路线（1 = WTB、2 = 温和、3 = 左翼），这张卡才会出现。
- **打出结算**：`economic_policy_timer += 12; month_actions += 1; nationalize_budget = 4; nationalize_budget -= 1 if works_councils >= 2; nationalize_budget -= 1 if works_councils >= 3; nationalize_budget -= 1 if socializations + nationalization_progress >= 2; wtb_budget = 4; wtb_budget -= 1 if works_councils >= 2 or socializations >= 1 or pro_labor >= 2`

| 选项 | 显示条件 `view-if` | 可选条件 `choose-if` | 置灰原因 |
|---|---|---|---|
| `@wtb_2` 继续 WTB 计划（-3 预算） | `wtb_implemented > 2 and budget >= 3` | `unemployed > 8` | 失业率已足够低，WTB 的时机已过 |
| `@wtb_2_deficit` 继续 WTB 计划（-3 预算，赤字） | `wtb_implemented > 2 and budget < 3 and budget >= -3` | `unemployed > 10` | 不应再搞赤字支出 |
| `@wtb_continuation` 回顾成果并继续 | `wtb_implemented >= 1 and wtb_implemented <= 2` | —（无条件） | — |
| `@implement_wtb_no_deficit` 实施 WTB 计划（-`wtb_budget` 预算） | `budget >= wtb_budget and wtb_implemented == 0 and wtb_adopted == 1` | `unemployed > 8` | 同上 |
| `@implement_wtb_deficit` 实施 WTB 计划（赤字） | `budget < wtb_budget and wtb_implemented == 0 and wtb_adopted == 1` | `unemployed > 8` | 同上 |
| `@nationalize_1` 左翼改造计划（首次） | `nationalization_adopted == 1 and nationalization_progress == 0` | 见下（跳转分支） | — |
| `@nationalize_2` 左翼改造计划（续） | `nationalization_adopted == 1 and nationalization_progress >= 1` | 见下（跳转分支） | — |
| `@moderate_plan` 改良派就业计划（-2 预算） | `moderate_plan_adopted == 1` | `budget >= 2 and unemployed >= 8` | 预算不足 / 失业率过低 |
| `@moderate_plan_limited_budget` 改良派就业计划（-1 预算，缩水版） | `moderate_plan_adopted == 1` | `budget >= 1 and unemployed >= 8` | 预算不足 / 失业率过低 |
| `@root` 不实施经济计划 | — | — | — |

**`@nationalize_1` / `@nationalize_2` 的跳转分岔**：

```
go-to: nationalize_deficit   if budget < nationalize_budget
       nationalize_no_deficit if budget >= nationalize_budget
```

预算不足时进入 `@nationalize_deficit` 子菜单，其选项：

| 子选项 | 可选条件 `choose-if` | 置灰原因 |
|---|---|---|
| `@nationalize_deficit_1` 以赤字资助国有化 | `left_strength > reformist_strength + center_strength or woytinsky_advisor == 1` | 党内尚不支持为此目的搞赤字；「也许请一位顾问能让这个方案更容易被接受？」 |
| `@nationalize_without_compensation` 无偿没收 | `left_strength > reformist_strength + center_strength and judicial_reform >= 3` | 党内主体不支持这种准合法行动；司法界会反对 |
| `@empower_workers` 授权工人接管工厂 | `left_strength > reformist_strength + neorevisionist_strength and (judicial_reform >= 3 or rb_militancy >= 0.25) and works_councils >= 1` | 党内主体不支持；司法界会反对；需提高准军事组织军事化程度；需先获得企业委员会支持 |
| `@return` 不这么做 | — | — |

实施 WTB / 国有化 / 温和计划后均授予成就 `wirtschaftspolitik`。

另含 `@easy_discard`、`@cancel_advisor_action`。

---

#### 5. Education & Science 教育与科学

- **文件**：`source/scenes/government_affairs/education_science.scene.dry`
- **抽取条件**：`spd_in_government and spd_prussia and chancellor_party = "SPD" and education_science_timer = 0 and (black_thursday_seen = 0 or return_to_normalcy = 1)`
  - 需要 **SPD 执政 + 控制普鲁士 + SPD 总理**。
  - **末尾条件很关键**：`(black_thursday_seen = 0 or return_to_normalcy = 1)`——**1929 年 10 月「黑色星期四」之后，这张卡会消失，除非触发「回归常态」（`return_to_normalcy`）事件。**
- **打出结算**：`education_science_timer += 9; month_actions += 1`；`go-to: ed_menu`

**顶层菜单 `@ed_menu` 自身的显示条件：`view-if: not last_advisor_action`。**

| 选项 | 显示条件 `view-if` | 可选条件 `choose-if` | 置灰原因 |
|---|---|---|---|
| `@increase_science` 增加科研经费 | — | `economic_minister_party = "SPD"` | 需要经济部 |
| `@structure` 改变教育结构与拨款 | — | — | — |
| `@curriculum` 修改教学大纲 | — | `curriculum_timer = 0` | 改得太早 / 未控制普鲁士州政府 |
| `@return` | — | — | — |

**`@increase_science` 子菜单：**

| 子选项 | 可选条件 `choose-if` | 置灰原因 |
|---|---|---|
| `@kwg` 资助威廉皇帝学会（基础研究，-1 预算） | `budget >= 1` | — |
| `@applied` 资助应用技术研究（-1 预算） | `budget >= 1` | — |
| `@medical` 资助生物医学研究（-1 预算） | `budget >= 1` | — |
| `@cut_funding` 削减科研经费（+1 预算） | `science_funding >= 1` | 我们还没有资助过科学 |

**`@structure` 子菜单：**

| 子选项 | 显示条件 `view-if` | 可选条件 `choose-if` | 次数 |
|---|---|---|---|
| `@secularize` 支持世俗学校（-1 预算） | `secularized = 0` | `budget >= 1 and (progressive_coalition + dvp_r >= 50)` | — |
| `@public_hs` 资助公立中学（-1 预算） | — | `budget >= 1` | `max-visits: 3` |
| `@school_boards` 设立民选校董会 | `school_boards = 0` | — | — |

> **`@secularize` 有重大政治后果**：`@secularize_2` 的 `go-to` 是
> `vote_of_no_confidence.vonc_menu if in_weimar_coalition or in_grand_coalition or in_popular_front or in_emergency_government`
> —— **在天主教中央党参与的任何联合政府里，这一选项会立刻引发对政府的不信任投票。**

**`@curriculum` 子菜单（两层）：**

先选主科（`@curriculum` 的 `choose-if: curriculum_timer = 0`）：

| 主科选项 | 结算要点 |
|---|---|
| `@dem_major` 民主课程 | `curriculum_timer = 50; major_curriculum = "democratic"` |
| `@science_major` 科学课程 | `curriculum_timer = 50; major_curriculum = "scientific"` |
| `@human_major` 人文课程 | `curriculum_timer = 50; major_curriculum = "humanist"` |
| `@vocational_major` 职业课程 | `curriculum_timer = 50; major_curriculum = "vocational"` |
| `@trad_major` 传统课程 | `curriculum_timer = 50; major_curriculum = "traditional"` |

再选副科（`@curriculum_minor`）——**副科不能与主科相同**：

| 副科选项 | 显示条件 `view-if` |
|---|---|
| `@dem_minor` | `major_curriculum != "democratic"` |
| `@science_minor` | `major_curriculum != "scientific"` |
| `@human_minor` | `major_curriculum != "humanist"` |
| `@vocational_minor` | `major_curriculum != "vocational"` |
| `@trad_minor` | `major_curriculum != "traditional"` |

另含 `@easy_discard`、`@cancel_advisor_action`。

---

#### 6. Fiscal Policy 财政政策

- **文件**：`source/scenes/government_affairs/fiscal_policy.scene.dry`
- **抽取条件**：`spd_in_government = 1 and finance_minister_party = "SPD" and fiscal_policy_timer = 0`
- **打出结算**：`fiscal_policy_timer += 6; month_actions += 1`；`go-to: fiscal_menu`
- **税率上下限**：所有税率相关选项的统一约束是 `-5 ≤ 税率 ≤ 5`。

| 选项 | 可选条件 `choose-if` | 置灰原因 | 效果摘要 |
|---|---|---|---|
| `@raise_rich` 对富人加税 | `upper_tax_rates <= 5` | 税率已经太高 | +2 预算，`upper_tax_rates += 1`，资本罢工进度 +1（税率 >1 再 +1，>3 再 +1） |
| `@raise_poor` 提高消费税 | `lower_tax_rates <= 5` | 税率已经太高 | +2 预算，`lower_tax_rates += 1`，工人支持下降 |
| `@raise_overall` 全面加税 | `upper_tax_rates <= 5 and lower_tax_rates <= 5` | 税率已经太高 | +3 预算，两项税率各 +1 |
| `@cut_rich` 削减富人所得税 | `budget >= 2 and upper_tax_rates >= -5` | 预算不足 / 税率已太低 | -2 预算，`upper_tax_rates -= 1` |
| `@cut_poor` 削减穷人消费税 | `budget >= 2 and lower_tax_rates >= -5` | 预算不足 / 税率已太低 | -2 预算，`lower_tax_rates -= 1` |
| `@cut_overall` 全面减税 | `budget >= 3 and upper_tax_rates >= -5 and lower_tax_rates >= -5` | 预算不足 / 税率已太低 | -3 预算，两项各 -1 |
| `@raise_progressive` 累进化（加富人/减穷人） | `lower_tax_rates >= -5 and upper_tax_rates <= 5` | 下层税率已太低 / 上层税率已太高 | 总收入不变，`upper +1 / lower -1` |
| `@regressive` 累退化（减富人/加工人） | `lower_tax_rates <= 5 and upper_tax_rates >= -5` | 富人税率已太低 / 下层税率已太高 | 总收入不变，`upper -1 / lower +1` |
| `@tariffs` 改用关税 | — | — | 进入关税子菜单 |

**`@tariffs` 子菜单：**

| 子选项 | 可选条件 `choose-if` | 效果摘要 |
|---|---|---|
| `@raise_tariffs` 提高进口关税 | `tariffs <= 5` | +2 预算；通胀上升、失业 +1.5、`west_relation -1`、`east_relation -1`、`reparations_negotiation -= 2`、`eu_progress -= 1` |
| `@lower_tariffs` 降低进口关税 | `budget >= 2 and tariffs > -5` | -2 预算；`west_relation +1`、`east_relation +1`、`eu_progress += 1` |

另有 `@fiscal_menu`（返回）、`@root`、`@easy_discard`、`@cancel_advisor_action`。

---

#### 7. Foreign Policy 外交政策

- **文件**：`source/scenes/government_affairs/foreign_policy.scene.dry`
- **抽取条件**：`spd_in_government = 1 and foreign_minister_party = "SPD" and  foreign_policy_timer <= 0`
- **打出结算**：`month_actions += 1; foreign_policy_timer += 8`（冷却最长的一张常规卡）；`go-to: fp_menu`

| 选项 | 显示条件 `view-if` | 可选条件 `choose-if` | 次数/说明 |
|---|---|---|---|
| `@improve_west` 改善与西方盟国关系 | — | — | `west_relation += 2; reparations_negotiation += 1` |
| `@improve_east` 改善与东方邻国关系 | — | — | `east_relation += 2` |
| `@improve_soviet` 改善与苏联关系 | — | — | 进入子菜单 |
| ↳ `@soviet_economic_aid_yes_mil` 援助换国防合作 | — | `budget >= 1` | -1 预算，`soviet_relation += 1; reichswehr_militancy += 0.2; reichswehr_loyalty += 0.05` |
| ↳ `@soviet_economic_aid_yes` 无条件援助 | — | `budget >= 1` | -1 预算，`soviet_relation += 2; coalition_dissent += 1` |
| ↳ `@soviet_economic_aid_no` 不援助 | — | — | — |
| ↳ `@kpd` 请莫斯科帮忙修复与德共关系 | — | — | `kpd_relation += 8*(1-dissent)` |
| ↳ `@wittorf` 利用维托夫事件 | `wittorf_secret = 1 and ((year = 1929 and month < 6) or year = 1928) and wittorf_soviet_union = 0` | — | `max-visits: 1` |
| `@customs_union` 与奥地利组建关税同盟 | `black_thursday_seen = 1 and customs_union = 0` | `eu = 0` | 需先经历大萧条 |
| ↳ `@customs_union_2` 确认 | — | — | `max-visits: 1`；`banking_crisis_timer = 2`（**会在 2 个月内引爆银行危机**） |
| `@negotiate` 就凡尔赛剩余义务谈判 | `reparations > -2 and reparations_negotiation < 3` | — | `west_relation += 1`，`reparations_negotiation` 多项加成 |
| `@reduce_reparations` 争取暂停赔款 | `reparations_negotiation >= 3 and black_thursday_seen == 1 and reparations > -2` | — | `max-visits: 1`；`reparations = -2` |
| `@expose` 曝光秘密重整军备 | `rearmament_exposed == 0` | — | `reparations_negotiation += 3`，`coup_progress += 2` |
| `@european_union` 迈出组建欧盟的第一步 | `reparations <= -2 and eu_progress < 2 and eu = 0` | `west_relation >= 5 and east_relation >= 4` | `eu_progress += 1` |
| `@european_union_2` 签署欧盟条约 | `west_relation >= 5 and east_relation >= 4 and eu_progress >= 2 and eu = 0` | — | `max-visits: 1`；成就 `eu` |
| `@concordat_negotiate` 与梵蒂冈谈判政教协定 | `prussian_concordat = 1 and reichskonkordat = 0 and reichskonkordat_progress < 4` | — | **前置：必须先在普鲁士签下政教协定** |
| `@concordat` 签署全国政教协定 | `reichskonkordat_progress >= 4 and reichskonkordat = 0` | — | 成就 `reichskonkordat` |
| `@support_austria` 口头支持奥地利民主 | `austrian_parliament_seen = 1 and austrian_civil_war_seen = 0` | — | `sdapo_strength += 1` |
| `@support_austria_2` 物质支援奥地利民主 | `austrian_parliament_seen = 1 and austrian_civil_war_seen = 0` | `budget >= 1` | -1 预算，`sdapo_strength += 3` |
| `@root` 暂不制定政策 | — | — | — |

另含 `@easy_discard`、`@cancel_advisor_action`。

---

#### 8. Homosexual Rights 同性恋权利

- **文件**：`source/scenes/government_affairs/homosexual_rights.scene.dry`
- **抽取条件**：`spd_in_government == 1 and (progressive_coalition >= 50) and chancellor_party == "SPD" and homosexual_rights_timer == 0 and homosexual_rights < 3`
  - **`progressive_coalition >= 50`**：进步联盟席位（SPD + KPD + DDP + SAPD，见 `election_1928.scene.dry:117`）过半；**`chancellor_party == "SPD"`**：必须由 SPD 组阁。
- **权重/次数**：`frequency: 25`（稀有）、`max-visits: 3`
- **打出结算**：`homosexual_rights_timer += 11; month_actions += 1`

| 选项 | 显示条件 `view-if` | 可选条件 `choose-if` | 置灰原因 |
|---|---|---|---|
| `@repeal_175` 废除第 175 条 | `repealed_175 == 0` | `progressive_coalition >= 50` | 我们没有多数支持 |
| `@reform_183` 改革第 183 条 | `reformed_183 == 0` | `progressive_coalition >= 50` | 我们没有多数支持 |
| `@change_sex` 建立法定性别变更程序 | `trans_rights == 0` | `progressive_coalition >= 50` | 我们没有多数支持 |
| `@return` 暂不推进 | — | — | — |

> 三个选项的 `choose-if` 与卡面 `view-if` 里的 `progressive_coalition >= 50` 重复，属于冗余保险。

另含 `@easy_discard`、`@cancel_advisor_action`。

---

#### 9. Judiciary Reform 司法改革

- **文件**：`source/scenes/government_affairs/judiciary.scene.dry`
- **抽取条件**：`spd_in_government = 1 and justice_minister_party = "SPD" and judiciary_timer = 0`
- **打出结算**：`month_actions += 1; judiciary_timer += 6`

| 选项 | 可选条件 `choose-if` | 置灰原因 | 效果摘要 |
|---|---|---|---|
| `@reform` 实质性司法改革（-1 预算） | `budget >= 1` | 预算不足 | `judicial_reform += 2`，`pro_republic += 5`，`coup_progress += 1`，`coalition_dissent += 1`（大联合 + 历史模式） |
| `@minor_reforms` 轻度司法改革 | —（无条件） | — | `judicial_reform += 1`，`pro_republic += 3`，且**再次** `judiciary_timer += 6`（叠加成 12 个月冷却） |
| `@as_is` 维持现状 | — | — | `go-to: root` |

> **`judicial_reform` 是整个政府卡系统的枢纽变量**：第 1 张（土地改革，需 ≥2）、第 4 张（国有化分支，需 ≥3）、第 3 张（宪制改革，需 ≥4）、Internal Security 的迫害选项（需 ≥3 / ≥4）全部依赖它。

另含 `@easy_discard`、`@cancel_advisor_action`。

---

#### 10. Labor Affairs 劳工事务

- **文件**：`source/scenes/government_affairs/labor_affairs.scene.dry`
- **抽取条件**：`spd_in_government = 1 and labor_minister_party = "SPD" and labor_affairs_timer = 0 and strike_term_seen = 0`
  - **`strike_term_seen = 0`**：这张卡**整局只出现一次**，任选一项都会把 `strike_term_seen` 置 1，之后永不出现。
- **打出结算**：`labor_affairs_timer = 6; month_actions += 1; labor_affairs_seen = 1`
  - `labor_affairs_seen = 1` 是 Labor Rights（第 11 张）的解锁钥匙。

| 选项 | 可选条件 | 效果摘要 |
|---|---|---|
| `@support_labor` 支持劳工诉求 | —（无条件） | `labor_strength += 5`，多派系不满下降；`capital_strike_progress` 视 `dvp_relation` / `unemployed` 最多 +3；`pro_labor += 1` |
| `@support_employers` 支持雇主诉求 | —（无条件） | `labor_dissent += 8`，`workers_spd -= 3`，`dvp_relation += 5`、`z_relation += 5`，`kpd_relation -= 8`，资本罢工进度下降 |
| `@balance` 折中调停 | —（无条件） | `labor_dissent += 4`，`workers_spd -= 2`，`kpd_relation -= 5` |

> 这张卡**没有** `@cancel_advisor_action`（源码中被注释掉），只有 `@easy_discard`。

---

#### 11. Labor Rights 劳工权利

- **文件**：`source/scenes/government_affairs/labor_rights.scene.dry`
- **抽取条件**：`spd_in_government = 1 and labor_minister_party = "SPD" and labor_rights_timer <= 0 and labor_affairs_seen = 1`
  - **`labor_affairs_seen = 1`**：必须先打过 Labor Affairs（第 10 张）。
- **卡级次数**：`max-visits: 6`
- **打出结算**：`labor_rights_timer += 10; month_actions += 1`；`go-to: labor_rights_menu`

| 选项 | 显示条件 `view-if` | 可选条件 `choose-if` |
|---|---|---|
| `@working_hours` 强制 40 小时周 | `working_hours < 2` | —（无条件） |
| `@shorten_hours` 缩短至 40 小时以下 | `working_hours >= 2 and black_thursday_seen = 1` | —（无条件） |
| `@safety` 制定并执行安全法规 | — | —（无条件） |
| `@unemployment_insurance` 为失业保险筹资 | `unemployed >= unemployment_insurance_threshold + 4` | —（进入子菜单） |
| `@root` 暂不制定政策 | — | — |

**`@unemployment_insurance` 子菜单：**

| 子选项 | 效果要点 |
|---|---|
| `@cut_benefits` 削减给付 | 大幅打击工人与失业者支持，`welfare -= 2`、`budget += 1`、各派系不满大增、`unemployment_insurance_threshold` 重置为当前失业率 |
| `@increase_employers` 提高雇主缴费 | `capital_strike_progress += 2`；**大联合政府下 `coalition_dissent = 2`**（很可能导致 DVP 拆伙） |
| `@balance` 劳资双方共同提高缴费 | `welfare -= 1`、`budget += 1`、`month += 1`（**额外消耗一个月**）；大联合且 `dvp_relation < 30` 时 `coalition_dissent = 2` |
| `@labor_rights_menu` 暂缓决定 | 返回 |

另含 `@easy_discard`、`@cancel_advisor_action`。

---

#### 12. Military Policy 军事政策

- **文件**：`source/scenes/government_affairs/military_policy.scene.dry`
- **抽取条件**：`spd_in_government = 1 and reichswehr_minister_party = "SPD" and military_policy_timer <= 0`
- **打出结算**：`military_policy_timer += 6; month_actions += 1`

| 选项 | 可选条件 `choose-if` | 置灰原因 | 效果摘要 |
|---|---|---|---|
| `@increase_funding` 增加军费买忠诚（-1 预算） | `budget >= 1` | 我们没有预算 | `reichswehr_loyalty += 0.07`（上限 1），`reichswehr_strength += 20`，`left_dissent += 5`，`west_relation -= 1`、`east_relation -= 1` |
| `@decrease_funding` 削减军费（+1 预算） | `reichswehr_strength > 0` | 已无物可削 | `reichswehr_strength -= 20`，`sh_strength += 15`、`sa_strength += 5`；`coup_progress` 视忠诚度最多 +4 |
| `@reform` 彻底改革军队（-1 预算） | `budget >= 1 and reichswehr_loyalty < 1` | 预算不足 / 国防军已完全忠诚 | `reichswehr_loyalty += 0.15`，`pacifism += 1`，`democratization += 1`，`coup_progress += 1` |
| `@root` 不变更军事政策 | — | — | — |

另含 `@easy_discard`、`@cancel_advisor_action`。

---

#### 13. Internal Security 内部安全

- **文件**：`source/scenes/government_affairs/police.scene.dry`
- **抽取条件**：`spd_in_government = 1 and interior_minister_party = "SPD" and police_timer <= 0`
- **打出结算**：`police_timer += 6; month_actions += 1`

| 选项 | 显示条件 `view-if` | 可选条件 `choose-if` | 分支判断 |
|---|---|---|---|
| `@loyalty` 提升内政部警力忠诚 | — | — | `interior_police_loyalty += 0.1` |
| `@investigate_corruption` 调查大企业腐败 | — | — | `interior_police_loyalty >= 0.5` → 成功；否则失败 |
| `@investigate_far_right` 调查极右翼非法活动 | — | — | `interior_police_loyalty >= 0.55` → 成功；否则失败 |
| `@domestic_enemies` 调查/取缔国内敌人 | — | — | 跳转到子场景（见 3.3） |
| `@deport_hitler` 驱逐希特勒 | — | — | 跳转到子场景（见 3.3） |
| `@root` 暂不行动 | — | — | — |

**忠诚度阈值是这张卡的核心**：`interior_police_loyalty >= 0.5` 才能查腐败，`>= 0.55` 才能查极右翼，`>= 0.7` 才能「进一步迫害」准军事组织（见 3.3）。

另含 `@easy_discard`、`@cancel_advisor_action`。

---

#### 14. Shuffle Cabinet 改组内阁

- **文件**：`source/scenes/government_affairs/shuffle_cabinet.scene.dry`
- **抽取条件**：`spd_in_government == 1 and shuffle_cabinet_timer == 0 and chancellor_party == "SPD" and not in_spd_majority and not in_emergency_government and not in_left_front`
  - **不存在的情形**：SPD 单独多数政府、紧急政府、左翼阵线政府下，这张卡不出现（因为此时无需与盟党分配部会）。
- **打出结算**：`shuffle_cabinet_timer = 6`（**注意：这条写在卡上，`month_actions += 1` 却写在选项里**）
- **卡面内容**：列出八个部的当前归属党（Labor / Interior / Finance / Economic / Justice / Foreign / Reichswehr / Agriculture）

| 选项 | 结算 |
|---|---|
| `@shuffle` 是，改组 | `coalition_dissent += 1; month_actions += 1`，`go-to: election_1928.ministries` |
| `@root` 不必了 | 直接返回 |
| `@easy_discard` / `@cancel_advisor_action` | — |

---

#### 15. Social welfare policy 社会福利政策

- **文件**：`source/scenes/government_affairs/social_welfare.scene.dry`
- **抽取条件**：`spd_in_government = 1 and social_welfare_timer = 0`
  - **无部会门槛**：只要 SPD 执政就能抽到，是最容易拿到的政府卡之一。
- **打出结算**：`social_welfare_timer = 10; month_actions += 1`

| 选项 | 显示条件 `view-if` | 可选条件 `choose-if` | 置灰原因 |
|---|---|---|---|
| `@reduce_spending` 削减福利支出（+1 预算） | — | `welfare >= -5` | 已无物可削 |
| `@increase_spending_pre_depression` 增加福利支出（-1 预算） | `unemployed <= 15` | `budget > 0` | — |
| `@increase_spending_post_depression` 增加支出（仅维持实际水准，-1 预算） | `unemployed > 15` | `budget > 0` | — |
| `@spending_same_pre_depression` 维持支出 | `unemployed <= 15` | — | — |
| `@spending_same_post_depression` 维持支出（实为削减服务） | `unemployed > 15` | — | — |

> **失业率 15% 是这张卡的分水岭**：`unemployed > 15` 后，「维持支出」等价于实际削减福利（`welfare -= 1`），而「增加支出」也只是原地踏步。

无 `@cancel_advisor_action`（源码中被注释掉），只有 `@easy_discard`。

---

#### 16. Women's Rights 妇女权利

- **文件**：`source/scenes/government_affairs/womens_rights.scene.dry`
- **抽取条件**：`spd_in_government = 1 and womens_rights_timer = 0 and chancellor_party == "SPD"`
- **权重/次数**：`frequency: 50`、`max-visits: 6`
- **打出结算**：`womens_rights_timer += 10; month_actions += 1`

| 选项 | 可选条件 `choose-if` | 次数 | 说明 |
|---|---|---|---|
| `@labor` 促进女性就业政策 | —（无条件） | `max-visits: 3` | `unemployed > 15` 时男性工人会反弹（`workers_spd -= 4`） |
| `@family` 改革婚姻、离婚与财产法 | —（无条件） | `max-visits: 2` | `coalition_dissent += 1`，`z_relation -= 4`，`catholics_spd -= 4` |
| `@welfare` 改善单身母亲与儿童福利（-1 预算） | `budget > 0` | — | `welfare += 1` |
| `@liberalize` 堕胎合法化 | —（进入分支） | `max-visits: 1` | 见下 |

**`@liberalize` 的分支**（不是 `choose-if`，而是 `go-to`）：

```
go-to: liberalize_fail    if progressive_coalition < 50
       liberalize_success if progressive_coalition >= 50
```

- `@liberalize_fail`：提案在国会遭否决，`z_relation -= 5`、`coalition_dissent += 1`、`catholics_spd -= 5`
- `@liberalize_success`：`abortion_rights += 1; womens_rights += 1`，但 `z_relation -= 8`、`catholics_spd -= 10`、`dvp_relation -= 5`

> **注意**：`@liberalize` 在任何情况下都能点（没有 `choose-if`），差别只在结果成败。副标题会预告：`progressive_coalition < 50` 时「这不太可能成功」。

另含 `@easy_discard`、`@cancel_advisor_action`。

---

### 3.2 纯政务卡（只能靠政务牌堆随机抽）

#### 17. Coalition Affairs 联盟事务

- **文件**：`source/scenes/government_affairs/coalition_affairs.scene.dry`
- **抽取条件**：`spd_in_government = 1 and coalition_dissent >= 1 and coalition_affairs_timer = 0 and (in_grand_coalition or in_weimar_coalition or in_popular_front)`
  - **`coalition_dissent >= 1`**：只有联合政府内部真的出现裂痕时才会出现。
  - 只适用于**大联合 / 魏玛联盟 / 人民阵线**三种政府形态。
- **打出结算**：`month_actions += 1; coalition_affairs_timer = 5`

| 选项 | 显示条件 `view-if` | 可选条件 `choose-if` | 置灰原因 | 效果 |
|---|---|---|---|---|
| `@promise_cuts` 同意削减福利 | — | — | — | `welfare -= 1`、`budget += 1`，`coalition_dissent = 0`（一次性清空） |
| `@resources` 用党资源支持盟友 | `historical_mode = 0` | `resources >= 2` | 资源不足（需 2） | `resources -= 2; coalition_dissent -= 1` |
| `@bring_down` 主动发起不信任投票推翻政府 | — | — | — | 终结本届政府，改由 Brüning 代理总理，3 个月后大选 |
| `@no_change` 不做任何事 | — | — | — | — |

> **`@resources` 在历史模式下被禁用**（`view-if: historical_mode = 0`），因为历史模式关闭存档/民意调查，也不给额外资源。

无 `@cancel_advisor_action`，只有 `@easy_discard`。

---

#### 18. Dealing with Toleration 应对容忍

- **文件**：`source/scenes/government_affairs/dealing_with_toleration.scene.dry`
- **抽取条件**：`dealing_with_toleration_timer = 0 and spd_toleration and chancellor_party == "Z"`
  - **唯一一张在「SPD 不在政府内」时也能抽到的政府卡**：条件是 SPD 在外部容忍一个**天主教中央党总理**的少数政府。
- **打出结算**：`dealing_with_toleration_timer += 6; month_actions += 1`

| 选项 | 显示条件 `view-if` | 可选条件 `choose-if` | 置灰原因 |
|---|---|---|---|
| `@break_toleration` 以不信任投票终止容忍协议 | `not constructive_vonc` | — | 进入 `@vonc` / `@stay_course` 二选一 |
| `@urge_against_austerity` 促请联盟增加社会支出 | — | `budget >= 1` | 只有财政盈余时才能这么做 |
| `@improve_relations` 改善与联盟各党关系 | — | — | — |
| `@new_grand_coalition` 加入新大联合政府 | `neo_weimar_coalition >= 50` | `z_relation >= 50 and dvp_relation >= 30 and resources >= 2` | 与中央党关系不足 / 与 DVP 关系不足 / 资源不足 |
| `@stay_course` 维持现状以求稳定 | — | — | — |

**`@urge_against_austerity` 的成败分支**（`go-to`，不是 `choose-if`）：

```
go-to: urge_success if dvp_relation >= 30 and z_relation >= 40
       urge_failure if dvp_relation < 30 or z_relation < 40
```

- 成功：`welfare += 1; budget -= 1`，但 `z_relation -= 3; dvp_relation -= 3`
- 失败：仍会 `z_relation -= 3; dvp_relation -= 3`（**无论如何都要付关系代价**）

`@new_grand_coalition` 成功后授予成就 `constitutional_coalition`，并可进入 `@election_1928.ministries` 分配部会。

无 `@cancel_advisor_action`，只有 `@easy_discard`。

---

#### 19. The Prussian Bulwark 普鲁士堡垒

- **文件**：`source/scenes/government_affairs/prussian_affairs.scene.dry`
- **抽取条件**：`spd_prussia = 1 and prussian_affairs_timer <= 0`
  - **不需要 SPD 在联邦政府执政**——只要 SPD 控制普鲁士州政府就能抽到。
- **打出结算**：`prussian_affairs_timer += 6; month_actions += 1`

| 选项 | 显示条件 `view-if` | 效果摘要 |
|---|---|---|
| `@police_loyalty` 强化警察忠诚 | `prussian_police_loyalty < 1` | `prussian_police_loyalty += 0.1` |
| `@police_strength` 扩充警察 | — | `prussian_police_strength += 20` |
| `@bureaucracy` 清洗官僚体系中的反动分子 | — | `prussian_police_loyalty += 0.05`，`nationalism -= 5`，`democratization += 1`，`coup_progress += 0.5` |
| `@ban_sa` 取缔冲锋队 | `nazi_urgency >= 3 and sa_banned == 0` | `sa_strength *= 0.9`（普鲁士警察忠诚 ≥0.75 再 ×0.75） |
| `@unban_sa` 解除冲锋队禁令 | `sa_banned = 1` | `sa_strength += 100` |
| `@ban_rfb` 取缔红色前线战士同盟 | `communist_coalition < 3 and rfb_banned = 0` | `kpd_relation -= 15`，`prussian_police_loyalty += 0.1` |
| `@unban_rfb` 解除 RFB 禁令 | `rfb_banned = 1` | `rfb_strength += 50` |
| `@ban_sh` 取缔钢盔团 | `sh_banned == 0` | `sh_strength *= 0.85`（普鲁士警察忠诚 ≥0.75 再 ×0.7） |
| `@unban_sh` 解除钢盔团禁令 | `sh_banned = 1` | `sh_strength += 100` |
| `@negotiate_concordat` 与梵蒂冈谈判政教协定 | `prussian_concordat_progress < 1` | `prussian_concordat_progress += 1`，`z_relation += 2` |
| `@sign_concordat` 签署普鲁士政教协定 | `prussian_concordat_progress >= 1 and prussian_concordat = 0` | `prussian_concordat = 1`，`z_relation += 5`，`catholics_spd += 3` |

> **`prussian_concordat = 1` 是全国政教协定的前置**（见 Foreign Policy 的 `@concordat_negotiate`）。
> 与 Internal Security 相比，普鲁士版本的取缔门槛更低（只看 `nazi_urgency`，不看警察忠诚），但削弱幅度更小。

另含 `@easy_discard`、`@cancel_advisor_action`。

---

#### 20. War Guilt Inquiry 战争罪责调查

- **文件**：`source/scenes/government_affairs/war_guilt.scene.dry`
- **抽取条件**：`spd_in_government = 1 and war_guilt_timer = 0`
- **卡级次数**：`max-visits: 1`（整局只出现一次）
- **打出结算**：`war_guilt_timer = 6; month_actions += 1`

| 选项 | 结算 |
|---|---|
| `@restart` 重启调查 | `war_guilt += 1`，进入二选一 |
| ↳ `@pure_history` 只做历史记录 | 无事发生 |
| ↳ `@rewrite` 破除「背后一刀」神话 | `pacifism += 1`，`nationalism -= 5`，`pro_republic += 5`，`coup_progress += 1` |
| `@root` 什么也不做 | — |
| `@easy_discard` / `@cancel_advisor_action` | — |

---

#### 21. The Economic Crisis 经济危机

- **文件**：`source/scenes/party_affairs/crisis_program.scene.dry`
- **标签**：`tags: party_affairs, govt_affairs`——**同时属于党务与政务两个牌堆**
- **抽取条件**：`crisis_urgency >= 1 and crisis_program_timer = 0 and economic_plan = 0 and black_thursday_seen == 1`
  - `crisis_urgency >= 1`：由黑色星期四事件的「我们必须做点什么」选项、或失业保险危机事件推高。
  - `economic_plan = 0`：**尚未确定经济路线**。
- **权重/次数**：`frequency: 200`（高频，几乎必出）
- **打出结算**：`month_actions += 1; crisis_program_timer = 5`

| 选项 | 可选条件 `choose-if` | 置灰原因 | 分支 |
|---|---|---|---|
| `@support_centrist` 支持中间派（让萧条自行出清） | —（无条件） | — | 不改 `economic_plan`，卡会再次出现 |
| `@support_labor` 支持劳工派（WTB 公共工程 + 财政刺激） | `historical_mode == 0 or (labor_strength >= left_strength and labor_strength >= center_strength and labor_strength >= reformist_strength)` | 劳工派不够强 | `wtb_support >= 3` → `@plan_adopted`（`economic_plan = 1`）；否则 `@plan_support` |
| `@support_left` 支持左翼派（大规模国有化） | `historical_mode == 0 or (left_strength >= labor_strength and left_strength >= center_strength and left_strength >= reformist_strength)` | 左翼派不够强 | `nationalization_support >= 3` → `@adopt_left`（`economic_plan = 3`）；否则 `@support_left_progress` |
| `@support_moderate` 支持改良派（不搞赤字的有限就业计划） | `historical_mode == 0 or (reformist_strength >= left_strength and reformist_strength >= center_strength and reformist_strength >= labor_strength)` | 改良派不够强 | `moderate_plan_support >= 2` → `@adopt_moderate`（`economic_plan = 2`）；否则 `@support_moderate_progress` |
| `@defer` 推迟决定 | — | — | 不改 `economic_plan` |

> **历史模式的硬约束**：`historical_mode = 0` 时三项都无条件可选；一旦开启历史模式，就必须**该派系实力在党内排名第一**才能选。这是历史模式限制玩家偏离史实路径的核心机制之一。
>
> **路线一旦确定，这张卡就永久消失**（`economic_plan = 0` 不再成立），并把 Economic Policy（第 4 张）解锁。

无 `@easy_discard`。

---

#### 22. Panzerkreuzer A 装甲巡洋舰 A（国防部不在手时）

- **文件**：`source/scenes/events/panzerkreuzer.scene.dry`
- **标签**：`tags: event, govt_affairs`
- **抽取条件**：`panzerkreuzer_seen = 0 and year = 1928 and month >= 8 and reichswehr_minister_party != "SPD" and spd_in_government = 1`
  - **只在 1928 年 8 月及以后**、SPD 执政、**且国防部不在 SPD 手中**时出现。
- **打出结算**：`panzerkreuzer_seen = 1`

| 选项 | 分支 |
|---|---|
| `@vote_yes` 赞成建造 | `panzerkreuzer_funded = 1`；各派系不满 +5~+10 |
| `@vote_no` 反对建造 | `dvp_relation -= 8`、`z_relation -= 5`、`coalition_dissent += 1`，然后：<br>· `chancellor_party = "SPD"` → 进 `@vote_no_chancellor`<br>· `chancellor_party != "SPD"` → 进 `@vote_no_pass` |
| ↳ `@braun`（总理为布劳恩） | `panzerkreuzer_funded = 0`、`panzerkreuzer_failed = 1`——**唯一能真正不造舰的路径** |
| ↳ `@muller`（总理为米勒） | `panzerkreuzer_funded = 1`——国会仍强行通过 |
| ↳ `@vote_no_pass` | `panzerkreuzer_funded = 1`——国会强行通过 |
| `@abstain` 弃权 | `panzerkreuzer_funded = 1` |

> 这张卡精确复刻了 1928 年真实历史：**只有布劳恩当总理才拦得住造舰**。

---

#### 23. Panzerkreuzer A 装甲巡洋舰 A（国防部在手时）

- **文件**：`source/scenes/events/panzerkreuzer_ministry.scene.dry`
- **标签**：`tags: event, govt_affairs`
- **抽取条件**：`panzerkreuzer_seen = 0 and year = 1928 and month >= 8 and reichswehr_minister_party = "SPD" and spd_in_government = 1`
  - 与第 22 张**互斥**（`reichswehr_minister_party` 是否为 SPD），且共享 `panzerkreuzer_seen` 标志，因此**一局只会看到其中一张**。
- **打出结算**：`panzerkreuzer_seen = 1`

| 选项 | 效果摘要 |
|---|---|
| `@vote_yes` 建造 | `reichswehr_loyalty += 0.1`，但 `left_dissent += 10`、`labor_dissent += 10` 等 |
| `@vote_no` 不建造 | `reichswehr_loyalty -= 0.05`，各派系不满下降，`nationalism -= 5`、`pacifism += 1`，`z_relation -= 5`、`dvp_relation -= 5`；`panzerkreuzer_failed = 1` |

> 掌握国防部时这张卡**没有 `choose-if`**，两项都能选——这是在内阁里掌握军权的好处。

---

### 3.3 由政务卡派生的子场景

这两个场景**不在任何牌堆里**（`domestic_enemies.scene.dry:8` 明确注释 `# this is not a card...`），只能从 Internal Security（第 13 张）进入。

#### A. Investigating Domestic Enemies 调查国内敌人

- **文件**：`source/scenes/government_affairs/domestic_enemies.scene.dry`
- **进入条件（自身的 `view-if`）**：`spd_in_government = 1 and interior_minister_party = "SPD"`
- **打出结算**：`month_actions += 1`
- **入口**：Internal Security 的 `@domestic_enemies`

| 选项 | 显示条件 `view-if` | 可选条件 `choose-if` | 置灰原因 |
|---|---|---|---|
| `@deport_hitler` 驱逐希特勒 | 见子场景 B | 见子场景 B | 见子场景 B |
| `@ban_sa` 取缔冲锋队 | `nazi_urgency >= 3 and sa_banned == 0` | — | — |
| `@unban_sa` 解除冲锋队禁令 | `sa_banned = 1` | — | — |
| `@persecute_sa` 进一步迫害冲锋队 | `sa_banned = 1` | `judicial_reform >= 3 and interior_police_loyalty >= 0.7` | 司法界不允许 / 警察忠诚不足 |
| `@ban_sh` 取缔钢盔团 | `sh_banned == 0` | — | — |
| `@unban_sh` 解除钢盔团禁令 | `sh_banned = 1` | — | — |
| `@persecute_sh` 进一步迫害钢盔团 | `sh_banned = 1` | `judicial_reform >= 4 and interior_police_loyalty >= 0.7` | 司法界不允许（**门槛比 SA 高 1 级**）/ 警察忠诚不足 |
| `@ban_rfb` 取缔德共 RFB | `communist_coalition < 3 and rfb_banned = 0` | — | — |
| `@unban_rfb` 解除 RFB 禁令 | `rfb_banned = 1` | — | — |
| `@persecute_rfb` 进一步迫害 RFB | `rfb_banned = 1` | —（无条件） | — |
| `@root` 暂不行动 | — | — | — |

**与普鲁士版（第 19 张）的关键差异**：

| 对比项 | Internal Security 版 | Prussian 版 |
|---|---|---|
| 取缔 SA 的显示条件 | `nazi_urgency >= 3 and sa_banned == 0` | `nazi_urgency >= 3 and sa_banned == 0` |
| 取缔 SA 的削弱幅度 | `×0.85`，警察忠诚 ≥0.7 时 `×0.7` | `×0.9`，警察忠诚 ≥0.75 时 `×0.75` |
| 是否有「进一步迫害」 | ✅ 需 `judicial_reform ≥ 3/4` 且警察忠诚 ≥0.7 | ❌ 无 |
| 对 `dvp_relation` 的影响 | `-3`（SA）/ `-5`（钢盔团） | `-3`（SA）/ `-5`（钢盔团） |
| 额外政治代价 | 取缔钢盔团在大联合 + 兴登堡总统时 `coalition_dissent += 1` | 同 |
| RFB 部分 | 有 `n_rfb_banned` / `n_rfb_persecuted` 计数以减免 `coalition_dissent` | 无这些计数 |

无 `@easy_discard`（它是子场景，用 `@root` 返回）。

---

#### B. Deport Hitler 驱逐希特勒

- **文件**：`source/scenes/government_affairs/deport_hitler.scene.dry`
- **显示条件 `view-if`**：`nazi_urgency >= 3 and hitler_deported = 0 and chancellor != "Papen" and chancellor != "Schleicher" and investigate_far_right >= 2`
- **可选条件 `choose-if`**：`judicial_reform >= 2 and presidential_election_seen == 0 and spd_prussia == 1`
- **置灰原因**：
  - `judicial_reform < 2` → 反动司法界不会配合
  - `presidential_election_seen == 1` → 希特勒已在总统大选前取得德国国籍
  - `not spd_prussia` → 没有普鲁士警察配合就做不到

**分支流程**：

```
@deport
  go-to: deport_violence if sa_strength >= 200
         deport_success  if sa_strength < 200
```

- `@deport_success`（`sa_strength < 200`）：`hitler_deported = 1`，`sa_strength /= 2`，各阶层纳粹支持 -10，`coup_progress -= 2`，`nsdap_leader = "Goebbels"`，成就 `deport_hitler`
- `@deport_violence`（`sa_strength >= 200`）：进入二次选择
  - `@force_approach` 强行突破：结算公式为
    ```
    我方战力 = rb_strength × rb_militancy + prussian_police_strength × prussian_police_militancy × prussian_police_loyalty
    敌方战力 = sa_strength × sa_militancy
    deportation_success = 1 if 我方战力 > 敌方战力 else 0
    ```
    - 成功 → `@force_success`：与 `deport_success` 同效果
    - 失败 → `@force_fail`：`sa_strength += 50`，各阶层纳粹支持 +5，`coup_progress += 3`
  - `@no_deport` 取消驱逐

> 这是全游戏中唯一一张**要求玩家把准军事组织军事化程度（`rb_militancy`）与普鲁士警察忠诚度养起来**才能稳过的政府卡。

---

## 4. 条件变量速查表

### 4.1 执政与政府形态

| 变量 | 含义 | 出现于 |
|---|---|---|
| `spd_in_government` | SPD 是否在联邦政府内（0/1） | 几乎全部政府卡 |
| `spd_toleration` | SPD 是否在外部容忍少数政府 | 第 18 张 |
| `spd_prussia` | SPD 是否控制普鲁士州政府 | 第 5、19 张 |
| `chancellor_party` | 总理所属党 | 第 5、8、14、16、22 张 |
| `president` | 总统（`Hindenburg` / `Braun` / `Eckener` 等） | 第 2 张（总统权力改革支持度） |
| `in_weimar_coalition` | 魏玛联盟（SPD+Z+DDP） | 第 2、3、17 张等 |
| `in_grand_coalition` | 大联合（SPD+Z+BVP+DDP+DVP） | 第 6、7、10、17 张等 |
| `in_popular_front` | 人民阵线（SPD+KPD+Z+DDP） | 第 2、3、5 张 |
| `in_left_front` | 左翼阵线（SPD+KPD） | 第 2、3 张 |
| `in_spd_majority` | SPD 单独多数政府 | 第 2、14 张 |
| `in_emergency_government` | SPD 参与的紧急政府 | 第 5、14 张 |
| `coalition_dissent` | 联盟内部不满计数 | 第 17 张 |
| `neo_weimar_coalition` | SPD+DDP+Z+DVP+其他 的席位占比 | 第 18 张 |
| `progressive_coalition` | SPD+KPD+DDP+SAPD 的席位占比 | 第 5、8、16 张 |

### 4.2 部会归属

`foreign_minister_party`、`interior_minister_party`、`justice_minister_party`、`labor_minister_party`、`reichswehr_minister_party`、`economic_minister_party`、`finance_minister_party`、`agriculture_minister_party`——取值 `"SPD"` / `"Z"` / `"DVP"` / `"DNVP"` / `"DDP"` / `"I"` 等。

### 4.3 财政与资源

| 变量 | 含义 | 相关卡 |
|---|---|---|
| `budget` | 财政预算（可为负） | 第 1、4、6、7、8、9、12、13、16 张 |
| `resources` | 党的竞选资源 | 第 17、18 张 |
| `welfare` | 相对 1928 年的福利水平（可负） | 第 15 张 |
| `upper_tax_rates` / `lower_tax_rates` | 相对基准的税率（区间 -5 ~ +5） | 第 6 张 |
| `tariffs` | 关税水平（区间 -5 ~ +5） | 第 6 张 |

### 4.4 制度与意识形态

| 变量 | 含义 | 关键阈值 |
|---|---|---|
| `judicial_reform` | 司法改革进度 | ≥2 / ≥3 / ≥4 层层解锁 |
| `democratization` | 民主化倾向 | — |
| `pacifism` | 和平主义倾向 | — |
| `nationalism` | 民族主义（初始 60） | — |
| `pro_republic` | 共和支持度（初始 59） | **< 65 会把宪制改革公投门槛抬到 60%** |
| `neorevisionism` | 是否已发现新修正主义 | 第 2 张的硬性前提 |
| `constitutional_reform` | 已完成的宪制改革项数 | `< 3` 才能继续 |
| `constructive_vonc` | 是否已实行建设性不信任案 | 第 2 张、第 18 张 |
| `presidential_powers` | 是否已削减总统权力 | 第 2 张 |
| `electoral_threshold` | 选票门槛是否已改为 5% | 第 2 张 |
| `economic_plan` | 经济路线：0 未定 / 1 WTB / 2 温和 / 3 左翼 | 第 4、21 张 |
| `wtb_adopted` / `nationalization_adopted` / `moderate_plan_adopted` | 各路线是否已获党大会通过 | 第 4 张 |
| `wtb_implemented` / `nationalization_progress` / `moderate_plan_progress` | 各路线实施进度 | 第 4 张 |
| `works_councils` | 企业委员会进展（0~3） | 第 3 张递进链 |
| `socializations` | 社会化企业数量 | 第 3 张 |
| `pro_labor` | 亲劳工政策计数 | 影响 `wtb_budget` |

### 4.5 外部局势

| 变量 | 含义 |
|---|---|
| `black_thursday_seen` | 是否已发生 1929 年 10 月黑色星期四 |
| `return_to_normalcy` | 是否已触发「回归常态」 |
| `crisis_urgency` | 党内对经济危机的紧迫感（0~10） |
| `nazi_urgency` | 党内对纳粹威胁的紧迫感（0~10） |
| `unemployed` | 失业率（%） |
| `unemployment_insurance_threshold` | 失业保险压力基线（初始 10） |
| `west_relation` / `east_relation` / `soviet_relation` | 与西方 / 东方 / 苏联的关系 |
| `reparations` | 赔款负担（< 0 为减轻，Young Plan = -1） |
| `reparations_negotiation` | 赔款谈判进度（≥3 可争取暂停） |
| `z_relation` / `dvp_relation` / `ddp_relation` / `kpd_relation` | 与各党关系（0~100） |
| `eu` / `eu_progress` | 欧洲联盟：是否成立 / 谈判进度 |
| `customs_union` | 是否已与奥地利组成关税同盟 |
| `prussian_concordat` / `prussian_concordat_progress` | 普鲁士政教协定 |
| `reichskonkordat` / `reichskonkordat_progress` | 全国政教协定 |
| `austrian_parliament_seen` / `austrian_civil_war_seen` | 奥地利国会危机 / 内战是否已发生 |
| `rearmament_exposed` | 是否已曝光秘密重整军备 |
| `hitler_deported` / `investigate_far_right` | 希特勒是否被驱逐 / 极右翼调查进度 |
| `sa_banned` / `sh_banned` / `rfb_banned` | 各准军事组织是否被取缔 |
| `sa_strength` / `sh_strength` / `rfb_strength` / `rb_strength` | 各准军事组织人数（千人） |
| `rb_militancy` / `sa_militancy` / `prussian_police_militancy` | 军事化程度 |
| `interior_police_loyalty` / `prussian_police_loyalty` | 警察忠诚度（0~1） |
| `reichswehr_loyalty` / `reichswehr_strength` | 国防军忠诚度 / 兵力 |
| `capital_strike_progress` / `coup_progress` | 资本罢工 / 政变进度（满 10 爆发） |
| `strike_term_seen` / `labor_affairs_seen` | Labor Affairs 是否已打过（分别控制该卡自身与 Labor Rights） |
| `difficulty` / `historical_mode` | 难度（`-1` 简易 / `0` 普通 / `1` 困难 / `2` 历史） |

---

## 5. 关键门槛与依赖链

### 5.1 连锁解锁图

```
【1928.01 - 1928.05】政务牌堆尚未解锁（time < 6），一张政府卡都抽不到
        │
        ▼
【1928.06 起】政务牌堆解锁
        │
        ├─ SPD 掌某部会 ──▶ 解锁对应部会卡
        │
        ├─ Labor Affairs（一次性，strike_term_seen 锁死）
        │        └── labor_affairs_seen = 1 ──▶ Labor Rights 解锁
        │
        ├─ Judiciary Reform ──▶ judicial_reform ↑
        │        ├── ≥2 ──▶ 农业政策可做土地改革；Internal Security 可驱逐希特勒
        │        ├── ≥3 ──▶ 左翼可无偿国有化；可进一步迫害冲锋队
        │        └── ≥4 ──▶ Constitutional Reform 解锁（还需 neorevisionism）
        │
        ├─ Internal Security ──▶ interior_police_loyalty ↑
        │        ├── ≥0.5  ──▶ 查腐败成功率
        │        ├── ≥0.55 ──▶ 查极右翼成功率 ──▶ investigate_far_right ≥2 ──▶ 可驱逐希特勒
        │        └── ≥0.7  ──▶ 可「进一步迫害」准军事组织
        │
        ├─ Economic Democracy ──▶ works_councils 0→1→2→3 递进
        │        └── works_councils ≥2 ──▶ 降低 nationalize_budget / wtb_budget
        │
        ├─ The Economic Crisis（黑色星期四后，frequency 200 几乎必出）
        │        └── economic_plan = 1/2/3 ──▶ Economic Policy 解锁
        │
        └─ Prussian Bulwark ──▶ prussian_concordat = 1
                 └── 全国政教协定谈判的前置（Foreign Policy）
```

### 5.2 最容易踩空的四个门槛

1. **`time >= 6`**：1928 年 6 月前没有任何政府卡，别指望靠政务开局。
2. **`judicial_reform`**：它同时是土地改革、无偿国有化、宪制改革、迫害准军事组织的总闸门，而它只能靠 Judiciary Reform 卡（+1 或 +2）和 Prussia 的 `@bureaucracy`（不加 judicial_reform）积累。
3. **`progressive_coalition >= 50`**：同性恋权利卡、堕胎合法化、世俗学校（用的是 `progressive_coalition + dvp_r >= 50`）都卡在这个数值上。
4. **`black_thursday_seen` 的双刃剑**：
   - 它**解锁** Foreign Policy 的关税同盟、赔款暂停、Labor Rights 的缩短工时；
   - 它**关闭** Education & Science（除非 `return_to_normalcy`）。

### 5.3 稀有度排序（政府卡内部）

| 稀有度 | 卡牌 | 理由 |
|---|---|---|
| 极稀有 | Constitutional Reform、Homosexual Rights | `frequency: 25` |
| 较稀有 | Women's Rights | `frequency: 50` |
| 高频 | The Economic Crisis | `frequency: 200` |
| 只出一次 | War Guilt Inquiry、Labor Affairs、Panzerkreuzer A | `max-visits: 1` 或 `*_seen = 0` 一次性标志 |
| 可重复 | 其余 | 受 `*_timer` 冷却限制 |

---

## 6. 文件索引

### 6.1 政府卡本体

```
source/scenes/government_affairs/
├── agricultural_policy.scene.dry        # 1  Agricultural Policy
├── coalition_affairs.scene.dry          # 17 Coalition Affairs
├── constitutional_reform.scene.dry      # 2  Constitutional Reform
├── dealing_with_toleration.scene.dry    # 18 Dealing with Toleration
├── deport_hitler.scene.dry              #    （子场景 B，非卡牌）
├── domestic_enemies.scene.dry           #    （子场景 A，非卡牌）
├── economic_democracy.scene.dry         # 3  Economic Democracy
├── economic_policy.scene.dry            # 4  Economic Policy
├── education_science.scene.dry          # 5  Education & Science
├── fiscal_policy.scene.dry              # 6  Fiscal Policy
├── foreign_policy.scene.dry             # 7  Foreign Policy
├── homosexual_rights.scene.dry          # 8  Homosexual Rights
├── judiciary.scene.dry                  # 9  Judiciary Reform
├── labor_affairs.scene.dry              # 10 Labor Affairs
├── labor_rights.scene.dry               # 11 Labor Rights
├── military_policy.scene.dry            # 12 Military Policy
├── police.scene.dry                     # 13 Internal Security
├── prussian_affairs.scene.dry           # 19 The Prussian Bulwark
├── shuffle_cabinet.scene.dry            # 14 Shuffle Cabinet
├── social_welfare.scene.dry             # 15 Social welfare policy
├── war_guilt.scene.dry                  # 20 War Guilt Inquiry
└── womens_rights.scene.dry              # 16 Women's Rights
```

### 6.2 标签为 `govt_affairs` 但位于其他目录的卡

```
source/scenes/party_affairs/crisis_program.scene.dry     # 21 The Economic Crisis（party_affairs + govt_affairs）
source/scenes/events/panzerkreuzer.scene.dry             # 22 Panzerkreuzer A（国防部不在手）
source/scenes/events/panzerkreuzer_ministry.scene.dry    # 23 Panzerkreuzer A（国防部在手）
```

### 6.3 相关支撑文件

| 文件 | 作用 |
|---|---|
| `source/scenes/main.scene.dry` | 定义 `@govt` 牌堆、手牌上限、`time >= 6` 解锁条件 |
| `source/scenes/root.scene.dry` | 全部初始变量与计时器清单（第 462-534 行） |
| `source/scenes/post_event.scene.dry` | 月度结算：计时器递减、`month_actions` 推进月份 |
| `source/scenes/easy_discard.scene.dry` | 退牌机制（重置 timer、回滚访问计数） |
| `source/scenes/cancel_advisor_action.scene.dry` | 取消顾问/内阁行动 |
| `source/scenes/advisors/cabinet.scene.dry` | 简易难度下的「内阁」直取入口（`- #cabinet`） |
| `source/scenes/election_1928.scene.dry` | `progressive_coalition`、`neo_weimar_coalition` 的计算与部会分配 |
| `source/scenes/events/black_thursday.scene.dry` | `black_thursday_seen` 的置位点（1929 年 10 月） |
| `source/scenes/events/election_1928.scene.dry` | `strike_term_seen` 的初始化（选举后重置） |
| `source/scenes/events/vote_of_no_confidence.scene.dry` | 世俗学校/联合政府崩解触发的不信任投票流程 |
| `source/scenes/status.scene.dry` | 状态栏中政府相关数值的显示逻辑 |
