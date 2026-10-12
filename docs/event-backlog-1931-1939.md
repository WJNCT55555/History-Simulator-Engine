# 事件候选清单（1931–1939）

> 编制依据：对 `src/` 的实际审计（`events/index.ts` 注册表、`GameState` 字段的全部写入方、`lawStances.ts` 法则上限、`journal/` 与 `achievements.tsx` 的可达性），不是凭记忆罗列。
> 用法：每条候选都标注 **挂钩字段**（事件必须踩在已有系统上）、**成本**（S ≈ 单文件 60–100 行；M ≈ 需要子事件或与战争/日志联动；L ≈ 需要新结局或修改规则层）、**顺带修复**（它能让哪些当前不可达的状态/成就变成可达）。

---

## 0. 先说结论：最大的内容缺口是"死状态"与"空法则阶梯"

审计发现以下状态**当前没有任何内容能写入**，因此对应的成就、结局、日志事实上不可达。做事件时应优先挑这些，一份内容两份收益。

| 死状态 / 空阶梯 | 审计证据 | 现状后果 | 修复候选 |
|---|---|---|---|
| `regionalStatuses.catalonia = 'independent'` | `'independent'` 只在 `achievements.tsx:144`、`SidePanel.tsx:759`、`mayDays.ts:29` 被**读**；`SET_REGIONAL_STATUS` 在 `reducers/types.ts:26` 定义、`GameContext.tsx:1289` 处理，但**全仓库无任何 dispatch** | 成就 `A_CATALONIA`（向加泰罗尼亚致敬）**不可达**；`mayDays.ts:29` 的反向门控（独立则不做五月危机）也永远不会生效 | §3.6 / §5.1 加泰罗尼亚独立路线 |
| `durrutiAlive = false` | 仅 `GameContext.tsx:941` 初始化为 `true`，只在 `achievements.tsx:141` 被读；**无任何写入 false 的地方** | 杜鲁蒂**永不阵亡**，`A_DURRUTI`（杜鲁蒂之梦）失去全部难度与历史感 | §4.1 马德里·杜鲁蒂 |
| `africaArmyStatus = 'delayed' / 'republic'` | 唯一写入是 `GameContext.tsx:1703`（政变里程碑 50 → `'nationalist'`）；初始值 `'neutral'` | "非洲军团延迟/倒向共和国"这条架空轴完全空置 | §4.2 / §5.3 |
| `pceInPower` / `pceAcceptsComintern` | 前者仍无正常内容写入；后者由 1935 年共产国际七大写入，1936 剧本预置 | **RUSSIAN_SPAIN（俄属西班牙）仍缺 PCE 掌权入口**；支持率新门槛为 >70%，大清洗为 >75%，78% 宽松上界已不能证明门槛不可达 | §5.2 PCE 路线 |
| ~~`public_order_law`~~ | ~~无任何内容写入（只有初始化 0、`policyDefinitions.ts` 的立场表、UI 图标）~~ | **已修复**：`events/ley_defensa_republica.ts`（1931·10）现在写入 L1/L2；L3/L4 仍空 | §2.4 ✅ |
| `land_law` | 唯一写入是 `la_sanjurjada.ts:29`（`land_law: 1`） | 土地法停在第 1 级，"强制没收/集体化"无内容路径 | §2.5 土地改革法 / §4.4 集体化法令 |
| `womens_rights` 上限 4，实际天花板 1 | 唯一写入 `constitution_1931.ts:28`（+1） | 成就 `A_MUJERES`、`A_CULTURAL_REV` 不可达 | §2.2 离婚法 / §4.5 蒙塞尼与女性 |
| `education_institutions` 上限 3，实际天花板 1 | 唯一写入 `constitution_1931.ts:30`（+1） | 成就 `A_CULTURAL_REV` 不可达 | §2.3 教育使团 / §2.6 教团法 |
| `language_policy` 上限 4，实际天花板 1 | 唯一写入 `catalonia_autonomy_1932.ts:35`（+1） | 成就 `A_ESPERANTO`（世界语）不可达 | §3.7 加利西亚/巴斯克自治法 / §5.4 雅典学苑世界语 |
| `regional_autonomy_progress`（0–100 日志） | 写入仅 `advisors/ramon_franco.ts:27`（+15）与 `ramon_campaign_events.ts:28`（+10） | 日志《地区问题》几乎不可能完成，且它每月扣 1 点共和国权威 | §2.1 巴斯克自治法 / §3.7 加利西亚自治法 |
| `adjustUnionShare`（工会占比向量） | `unions.ts:150` 定义后**无任何调用方**；`unionShare` 只由剧本初始化 | CNT/UGT/UR 的此消彼长无法通过内容表达（但已被 `rules/income.ts`、`wartimeCoalition.ts`、侧栏读取） | §2.7 三十人集团分裂 / §3.2 CNT–UGT 统一谈判 |
| `leverage` | 只在 `elections_1931_results.tsx:306/458`（1931 组阁）使用 | 1933 年后的议会博弈缺少筹码机制 | §3.5 议会博弈（可选） |
| `syndicalistParty` 关系 | 唯一写入 `founding_syndicalist_party.ts:40`（+10） | PS 成立后没有任何后续互动 | §3.3 PS 的选举活动 |
| `covert_ops_portugal` | 只由 `foreign_policy.ts` 的葡萄牙选项累加 | 《伊比利亚之梦》日志进度来源单一 | §4.3 里斯本水兵起义 |

---

## 1. 时代一：1931–1933（共和国奠基 → 黑色两年前夜）

**已有**：`proclamation_of_the_second_republic`、`burning_of_the_convents`、`azana_military_reform`、1931 大选与组阁链、CNT 第三次大会链、`huelga_telefonica_1931`、`manifesto_of_thirty`、`constitution_1931`、`jurados_mixtos`、`la_sanjurjada`、`catalonia_autonomy_1932`、`ceda_formation`、`nazi_power_1933`、`founding_of_falange`、`casas_viejas`（1933·1）、`elections_1933`。

### 2.1 `basque_statute_estella` — 1931·6 起草 / 1932 议会否决（史实，成本 M）
- 挂钩：`domesticPolicy.regional_autonomy_progress`（+15~25）、`religion_policy`、`partyRelations.PNV`、`regionalStatuses.basque`、`classes.Clero/Labradores`。
- 选项：**支持埃斯特利亚草案（含纳瓦拉、承认教会学校）** → 自治进度大涨、PNV/教会好感、但 `religion_policy` 受阻、IR/PSOE 不满；**要求世俗化的共和版自治法** → 进度中等、`religion_policy` 可推进、PNV 冷淡；**把纳瓦拉问题推给卡洛斯派** → 进度小、`stats.tension` 上升。
- 顺带修复：《地区问题》日志（每月 −1 权威）终于有可控进度来源。
- 史实注：纳瓦拉在 1932 年拒绝加入；巴斯克自治法直到 1936·10 才通过（仅比斯开与吉普斯夸）。

### 2.2 `divorce_law_1932` — 1932·3 共和国离婚法（史实，成本 S）
- 挂钩：`domesticPolicy.womens_rights`（+1，用 `clampLawLevel`）、`classes.Clero`（−）、`partyRelations.AP/RE`（−）、`factions`。
- 选项：**全力推动离婚法与民事婚姻** → 女性权利+1、教会与小资产阶级支持下降；**只推动民事婚姻、搁置离婚** → 温和、无 `womens_rights` 提升；**让各自治地区自行立法** → 加泰罗尼亚先行、中央权威略降。
- 顺带修复：`A_MUJERES` 阶梯的第一级。

### 2.3 `misiones_pedagogicas_1931` — 1931·5 起教育使团（史实，成本 S）
- 挂钩：`domesticPolicy.education_institutions`（+1）、`ateneos_established`、`classes.Braceros/Intelectuales` 支持、`stats.republicanAuthority`、`resources`（−1 可选）。
- 选项：**国家拨款派"流动教师"下乡** → 教育+1、权威+；**交给 CNT 的雅典学苑自办** → 教育+1 且 CNT 在雇农/知识分子中支持+、但国家权威不涨；**只做城市扫盲** → 便宜但收益小。
- 顺带修复：`A_CULTURAL_REV`（需 教育≥3、女性权利≥4、5 座雅典学苑）的第一级。

### 2.4 ✅ `ley_defensa_republica` — 1931·10 共和国防卫法（史实，已实现）
- **已落地**：`src/game/events/ley_defensa_republica.ts`，日期 1931·10，门控 `scenario === '1931'`，三个选项全部双语且都有实际效果。
- 实际挂钩：`domesticPolicy.public_order_law`：选项二「要求写入司法保障」→ **1**；选项三「按原文支持」→ **2** 且 `political_rights −1`；**默认选项一（史实 CNT 立场：拒绝承认）刻意不改法律**。
- 为何默认不改法律：1933/1936 剧本描述符由 1931 剧本经真实 reducer 回放生成，两者都记录 `public_order_law: 0`；若默认分支改法律，这两个开局会被静默改写（已用 `scripts/scenario-history-probe.ts` 同款循环验证 Nov 1933 仍为 0）。
- 仍未覆盖：`public_order_law` **L3 宪政与集会保障法案 / L4 公社防卫委员会**；其余已由 2.4b 补齐。
- 顺带效果：政治权利 L0「无选举」多了一条正常可达路径（1931·10 先降 0，1931·12 宪法升回 1），不再只能靠刺杀总统达成。

### 2.4b ✅ `ley_orden_publico` — 1933·7 公共秩序法（史实，已实现）
- **已落地**：`src/game/events/ley_orden_publico.ts`，日期 1933·7，门控「≥1933·7 且政府为共和-社会党内阁」（与 `catalonia_autonomy_1932`、`la_sanjurjada` 同款，**不按剧本门控**）。
- 实际挂钩：该法史实上**废止**了 1931 年防卫法，故「让法案通过」的两个选项都落在 `public_order_law = 1`，只有「续行法外条款」的选项保留 `2`（同样 `political_rights −1`）。
- 剧本水合：两个事件的默认选项组合起来回放为 `public_order_law: 0 → 1`（1933·7），因此 `1933.ts` / `1936.ts` 的 `public_order_law` 已由 0 改为 **1**（已用 `scripts/scenario-history-probe.ts` 验到 1936·7 无进一步变化）。
- 仍未覆盖：**L3 / L4**。
- 备注（同批变更，非事件）：三个剧本的 `militia_legality_law` 由 0 改为 **1**（默许地方民兵）。该法律至今无任何写入方，因此 L1 现在是全局唯一能停留的等级，L0 反而变成进不去的等级；该字段不参与 `rules/policy.ts` 的月度结算，故无数值影响。

### 2.5 `agrarian_reform_law_1932` — 1932·9 土地改革法（史实，成本 M）
- 挂钩：`domesticPolicy.land_law`（→1 或 2）、`land_reform_progress`、`classes.Braceros/Latifundistas`、`partyRelations.AP/RE`、`stats.tension`。
- 选项：**通过温和的《土地改革法》与定居者机构** → `land_law=1`、进度+15、农村支持+、右翼关系−；**征收南方大庄园（"强制没收"路线）** → `land_law=2`、进度+25、`Latifundistas` 支持崩、`tension` 大涨、`coupProgress` +5；**让议会继续扯皮** → 无进展、`Braceros` 支持−。
- 顺带修复：`land_law` 目前只被 `la_sanjurjada.ts` 写到 1，阶梯 2/3 无内容。

### 2.6 `ley_congregaciones_1933` — 1933·5 教团法（史实，成本 S）
- 挂钩：`education_institutions`（+1）、`religion_policy`（+1）、`classes.Clero`（−）、`classes.PequenaBurguesia`（−）、`partyRelations.AP`（−）、`stats.republicanAuthority`。
- 选项：**禁止教团办学、学校国有化** → 教育+1、教会/右翼强烈反弹、`tension`+；**限制但保留监督下的教会学校** → 只提升 `religion_policy`；**移交议会慢慢审议**（史实拖延）→ 无收益、`CEDA` 壮大。
- 顺带修复：教育阶梯第二级。

### 2.7 `castilblanco_arnedo` — 1931·12 / 1932·1 农村血案（史实，成本 S）
- 挂钩：`classes.Braceros`（+）、`classes.Labradores`（−）、`stats.tension`、`factions.Faistas` 影响+、`domesticPolicy.public_order_law`（可选 +1）、`resources`（抚恤）。
- 选项：**彻查国民警卫队并惩处凶手** → 权威受损但工人支持+；**支持"维护秩序"的警卫队** → 右翼关系+、工人支持−、CNT 内激进翼影响+；**把两者都压下去** → 双输。
- 备注：这是 `casas_viejas` 的前奏；放在 1931·12–1932·1 可让 1932 年不再空白。

### 2.8 `alt_llobregat_1932` — 1932·1 上略夫雷加特与菲戈尔斯起义（史实，成本 S）
- 挂钩：`factions.Faistas/Puristas`、`stats.workerControl`、`stats.revolutionaryFervor`、`cntStance`、`resources`（声援被捕者）。
- 选项：**承认这是矿工的革命行动、全力声援被捕者** → 热情+、Faistas+、共和派关系−；**谴责"小资产阶级冒险主义"**（三十人集团立场）→ Treintistas 异议−、Faistas 异议+；**保持沉默** → 双重损失。
- 备注：与 `casas_viejas`（1933·1）构成"CNT 起义季"。

### 2.9 `treintista_split_1933` — 1933 反对派工会另立（史实，成本 M）
- 挂钩：**`adjustUnionShare`（全仓库首个调用方）**：`CNT −2`、`other +2`；`factions.Treintistas`（影响−、异议+）、`workersAllianceProgress`、`resources`。
- 选项：**开除并公开清算三十人集团** → CNT 占比−、Faistas+、纯度提升；**容忍他们在工会内活动** → 占比流失较小、但异议持续；**谈判挽留（给职位）** → 占比稳、官僚化+。
- 顺带修复：让"工会占比"从纯展示变成可玩的系统，也给 `unionShare` 一个内容来源。

---

## 2. 时代二：1933–1936（黑色两年 → 人民阵线）

**已有**：`accion_nacional_formation`、`founding_of_falange`、`birth_of_fe_de_las_jons`、`falange_organizations`、`founding_of_poum`、`maoc_formation`、`cons_formation`、`republican_party_mergers`、`party_auxiliary_organizations`、`asturias_revolution`、`workers_alliance_attempt/formation`、`crossroads_uprising_alliance`、`nombela_scandal`、`elections_1936` 与总统链、`cnt_fourth_congress`、`mujeres_libres_formation`、`olimpiada_popular`（新增）。

### 3.1 `catalan_six_october_1934` — 1934·10·6 加泰罗尼亚"国家"宣告与自治中止（史实，成本 M）
- 挂钩：`regionalStatuses.catalonia`（→`direct`，自治中止；1936·2 恢复）、`regional_autonomy_progress`（−20）、`partyRelations.ERC`、`stats.republicanAuthority`、`factions`、`coupProgress`。
- 选项：**在巴塞罗那发起总罢工支持孔帕尼斯** → ERC 关系+、热情+、镇压后 CNT 损失惨重；**拒绝为"资产阶级政客"的火中取栗**（史实 CNT 的立场）→ 保存力量、ERC 关系−、`A_CATALONIA` 路线受影响；**只做地方性同情罢工** → 折中。
- 备注：与 `asturias_revolution`（1934·10）同月，是"黑色两年"最缺的一块拼图，也让加泰罗尼亚状态的升降有内容支撑。

### 3.2 `cnt_ugt_unity_pact` — 1934 阿斯图里亚斯同盟 / 1936·5–6 统一谈判（史实，成本 M）
- 挂钩：**`adjustUnionShare`**（CNT 与 UGT 互换 1–2 点）、`workersAllianceProgress`、`factions`（Cenetistas 异议−、Faistas/Puristas 异议+）、`partyRelations.PSOE`、`stats.workerControl`。
- 选项：**签署统一协议（工人联盟）** → 工人联盟进度+、工会占比互换、但纯粹派激烈反对；**只签地方性合作协议**（史实上阿斯图里亚斯就是这样做的）→ 小额收益；**拒绝并重申独立路线** → Faistas+、PSOE 关系−。
- 备注：与既有 UHP/工人联盟日志直接串联，是"未完成路线"的补强。

### 3.3 `ps_electoral_campaign_1936` — 工团党（PS）参加 1936 大选（史实，成本 S）
- 挂钩：`relations.syndicalistParty`（**目前只有成立时 +10，之后再无内容**）、`cntVotingRate`、`factions.Puristas` 异议+、`prrevsAbandoned` 路线互斥。
- 选项：**让佩斯塔尼亚的工团党放手一搏** → `syndicalistParty` 关系+、投票率+、纯粹派反弹；**只提供印刷与场地、不公开背书** → 小额；**公开与之切割** → Faistas+、PS 关系−。
- 备注：给"PRRevS 之外的议会路线"一个存在感，且不新增字段。

### 3.4 `ethiopia_crisis_1935` — 1935·10 意大利入侵阿比西尼亚与国联制裁（史实，成本 S）
- 挂钩：`relations.italy`（−10）、`relations.uk`/`france`（±3）、`internationalSocialists`（+3）。
- 选项：**全国反法西斯示威、抵制意货** → 和平主义与革命热情+、意大利关系−；**要求政府对意制裁立场一致** → 外交关系+、右翼不满；**保持中立、专注国内** → 无收益。
- 备注：这是内战前最重要的国际反法西斯动员，也是 1935 年唯一的"非西班牙事务"大事件。

### 3.5 `ume_umra_1935` — 军内密谋与反密谋（史实，成本 M）
- 挂钩：`coupProgress`（±5~10）、`stats.armyLoyalty`（±）、`molaStatus`、**`leverage`（1933 年后首个新用途）**、`organizations`（可通过情报换筹码）。
- 选项：**把情报交给阿萨尼亚政府并要求清洗军官团** → `coupProgress −10`、`armyLoyalty −5`、政府关系+；**在工会内部建立反政变工人武装**（史实上的防卫委员会路线）→ `coupProgress −5`、Faistas+、但被指"非法武装"；**按兵不动** → `coupProgress +5`。
- 备注：给政变进度一条"可主动干预"的负向通道，目前玩家能影响 `coupProgress` 的手段很少（刺杀卡、军政卡）。

### 3.6 `amnesty_and_catalonia_restored_1936` — 1936·2·19 大赦 / 1936·3·1 孔帕尼斯归来（史实，成本 S）
- 挂钩：`regionalStatuses.catalonia`（恢复 `autonomy`）、`regional_autonomy_progress`（+20）、`partyRelations.ERC`（+10）、`stats.republicanAuthority`、`classes.Obreros` 支持。
- 选项：**组织迎接孔帕尼斯的群众游行、把功劳记在工人头上** → CNT 支持+、ERC 关系+；**冷眼旁观"资产阶级的赦免"** → Faistas+、ERC 关系−；**要求政治犯全面特赦（含武装起义者）** → 热情+、政府关系−。
- 备注：逻辑上应排在 `elections_1936_results` 之后。它同时给 `olimpiada_popular` 的"加泰罗尼亚自治"门槛补上了因果链（人民阵线获胜 → 恢复自治 → 才有巴塞罗那办赛）。

### 3.7 `galician_statute_1936` — 1936·6·28 加利西亚自治法公投（史实，成本 M）
- 挂钩：`regionalStatuses.galicia`（`autonomy`）、`regional_autonomy_progress`（+20）、`domesticPolicy.language_policy`（+1，用 `clampLawLevel`）、`classes.Labradores/Clero`、`partyRelations`。
- 选项：**全力动员通过公投** → 进度+、语言法+1；**同时要求巴斯克自治法一并通过** → 更大收益、马德里阻力+；**视之为资产阶级的自治骗局**（CNT 内部主张）→ Faistas+、进度不涨。
- 顺带修复：`language_policy` 天花板（`A_ESPERANTO` 的第一级），并与同月 `olimpiada_popular` 形成"最后一个和平之夏"的双联画。

### 3.8 `jose_antonio_arrest_1936` — 1936·3·14 长枪党被禁、何塞·安东尼奥被捕（史实，成本 S）
- 挂钩：**`fe_leadership_crisis`（已有字段，目前只有 `propaganda_by_deed.ts:267` 一个写入方）**、`partyRelations.FE`、`coupProgress`（+3~5）、`classes.PequenaBurguesia`、`stats.tension`。
- 选项：**支持政府取缔长枪党并加强工人纠察** → 秩序+、但街头暴力升级；**趁机扩大反法西斯统一战线宣传** → 革命热情+、PCE/PSOE 关系+；**要求释放政治犯同时取缔法西斯** → 折中、`political_rights` 相关。
- 备注：与 `founding_of_falange` 之后的 FE 成长线呼应，也让"长枪党领导层危机"字段有第二条触发路径。

### 3.9 `yunteros_land_occupation_1936` — 1936·3 埃斯特雷马杜拉雇农占地（史实，成本 S）
- 挂钩：`land_reform_progress`（+10）、`classes.Braceros`（+）、`classes.Latifundistas`（−）、`stats.tension`、`coupProgress`（+2）、`domesticPolicy.land_law`（可选，要求已有土地改革法）。
- 选项：**工会组织并扩大占地** → 农村支持+、右翼恐慌（政变进度+）、土地改革进度+；**说服农民等待议会立法** → 无收益、`Braceros` 支持−；**占领后立即集体化** → `land_law` 提升、`Latifundistas` 崩、`tension` 大涨。
- 备注：1936 年农村火药桶的直观呈现，和 `land_reform` 日志对接。

---

## 3. 时代三：1936–1939（内战）

**已有**：`civil_war_setup`（15 个决策 + 结果节点的沉浸式链）、`catalonia_defense`、`aragon_council`、`defense_committee_formation`、`wartime_power_arrangement`（自定义 UI）、`may_days`（含 POUM 后续与分裂路线）、`andalusia_fire`、`nationalist_surrender`、`republican_surrender`，以及军政卡（`aragon_front`、`militia_reorg`、`anarchy_tanks`）与外交卡（法国援助、国际纵队、美国禁运、安道尔、直布罗陀、葡萄牙、莫斯科黄金）。

**本轮已实现：莫斯科黄金与 PCE 战时社会扩张**。`moscow_gold` 从内战开局完成后的第 **7** 个月起评估：西班牙内战仍在进行、CNT 未同时掌管国务部与财政部、`private_bank_seizure < 1`、黄金至少 150、尚未转移。按设计，银行储蓄与黄金使用同一储备概念；没收旗标表示 CNT 已接管这批银行资产，不再允许该自动转移。只掌管其中一部不能阻止事件。日期使用实际开局月份，史实模式也遵循七个月间隔；若当月未处理，则保留到后续符合条件的月份。

事件是马德里政府的决定，CNT 可支持军购、抗议依赖、或花 1 资源审查账目，均实际结算黄金 −150、军备 +4、坦克研究 +25（上限 100）、苏联关系 +5（上限 100）、产业工人内 PCE 支持 +5、`moscowGoldTransferred=true`；三种回应分别产生不同的党派关系和 CNT 派系异议。自动事件不消耗 CNT 的 AP、外交预算或冷却。原外交卡仍可主动军购，保持预算 −3、1 AP 与两个月冷却，和自动事件共享 `rules/moscowGold.ts` 的一次性实物结算。两种入口都不会写 PCE 掌权或共产国际旗标，也不直接生成地图部队。

| 新事件 | 内战开局后的时间与前置 | 社会竞争与选项 |
|---|---|---|
| `pce_political_vacuum`：谁来代表失去代言人的人？ | 第 2 个月起，PCE 仍是共和国合法活跃党派，且有党派已退出 | 留给 PCE：自耕农最多 +12、小资产阶级 +10；CNT 花 2 资源组织援助：CNT 最多 +8/+7、PCE +4/+3；拒绝吸纳：PCE 最多 +16/+14，换取热情与党内认可 |
| `pce_smallholder_guarantees`：小农的土地与收成 | 第 4 个月起，前一事件已解决 | 支持 PCE 保障小农：PCE 自耕农最多 +18；CNT 花 2 资源争取自愿合作：CNT 最多 +8、PCE +6；拒绝特别保障：PCE 最多 +22。前者与后者各额外受强制集体化影响，每次 +2、最多 +6 |
| `pce_middle_class_appeal`：后方秩序的承诺 | 第 6 个月起，前一事件已解决 | 支持 PCE 秩序宣传：PCE 小资产阶级最多 +16、知识分子 +8；CNT 花 2 资源组织服务：CNT 最多 +8/+5、PCE +6/+3；拒绝让步：PCE 最多 +20/+10。支持与拒绝分支在已没收银行时，再增加最多 4 点小资产阶级支持 |

以上支持数字均为**阶层内部百分点**，是游戏平衡值，不是历史民调。只从确已失去共和国政治资格的 AP/RE/CT/FE/PRR/DLR 按比例转移，受其剩余支持总量限制；不清空右翼全国社会基础，不额外扣除 CNT/PSOE 等活跃盟友支持，也不重分历史议席或删除国民军部队。共享支持助手增加可选来源池，其他卡牌与工会份额计算继续使用原有算法。设计依据为 PCE 同期保护亲自耕作农民的土地与收成、保护小商店的政治宣传：[何塞·迪亚斯 1937 年 2 月 2 日演说](https://www.marxists.org/espanol/diaz/1930s/tadl/36.htm)。这是宣传立场的原始资料，不将其当成中立民意统计。

**后续已实现：共产国际第七次代表大会与结局门槛调整**。新增 `comintern_seventh_congress`，1935 年 8 月一次性触发，唯一选项“西班牙共产党转向反法西斯人民阵线战略”写入 `pceAcceptsComintern=true`；1936 剧本预置这项历史状态。时间与战略依据为[季米特洛夫 1935 年 8 月 2 日七大报告](https://www.marxists.org/reference/archive/dimitrov/works/1935/08_02.htm)。大清洗改为全国 PCE 支持率严格 >75%，俄属西班牙严格 >70%；其他条件与优先级保持原设计。78% 宽松上界已不能证明新支持率门槛不可达，仍需普通路线验证。`pceInPower` 仍缺少内容写入，苏援交付、控制国家机构与镇压后续仍待扩展。

战争阶段继续保留现有议会机制与 UI；CNT 脱离共和国后获胜、五月事件三方战争后获胜的两套替代议会体制均暂不设计。

### 4.1 `durruti_at_madrid_1936` — 1936·11 杜鲁蒂在马德里（史实 + 分支，成本 M）
- 挂钩：**`durrutiAlive`（目前永不死）**、`factions.Faistas`（影响/异议）、`stats.revolutionaryFervor`、`militiaCombatPower`、成就 `A_DURRUTI`。
- 选项：**让他亲自坚守马德里前线**（史实：11·20 阵亡）→ `durrutiAlive=false`、Faistas 影响−/异议+、热情−、马德里防御+；**把他调回阿拉贡督战**（架空：存活）→ 热情+、Faistas+、马德里前线吃紧；**派他去国际宣传** → 热情+、`internationalSocialists`+、民兵战力−。
- 备注：`A_DURRUTI` 需要"胜利 + 杜鲁蒂存活 + Faistas 主导"，现在因为他不死而几乎白送；这条事件让成就重新有意义，也给玩家一个真实的取舍。

### 4.2 `strait_of_gibraltar_1936` — 1936·7–8 海峡空运（史实 + 架空分支，成本 M）
- 挂钩：**`africaArmyStatus`**（`'delayed'` 从未被写入）、`mapResources`/开局前线（需与 `warSetup.ts`、`civil_war_setup` 的空运步骤对齐）、`relations.germany/italy`（+），并复用内战开局链的 `civilWarChoices.step15` 海军选择结果。
- 选项：**共和海军封锁海峡（史实上未能坚持）** → `africaArmyStatus='delayed'`、前线压力大减；**把舰队撤回穆尔西亚保存实力** → 非洲军团按时抵达（历史）；**让水兵自行决断** → 根据 `civilWarChoices.step15` 及地图兵力结果处理，不再维护独立海军状态字段。
- 备注：需要与战争开局脚本核对，属于"高影响 + 高成本"，但它是内战前六周最具决定性的变量。

### 4.3 `lisbon_mutiny_1936` — 1936·9·8 里斯本水兵起义（史实，成本 M）
- 挂钩：`covert_ops_portugal`（+20~30）、`relations.portugal`（−15）、`internationalSocialists`（+5）、**《伊比利亚之梦》日志**、`stats.revolutionaryFervor`。
- 选项：**秘密支援起义者（武器/志愿者/宣传）** → 葡萄牙隐蔽行动大涨、葡萄牙关系崩、内战资源吃紧；**只做宣传声援** → 小额收益；**严守不干涉、避免与英国冲突** → 英国关系+、隐蔽行动停滞。
- 备注：让《伊比利亚之梦》的进度不再只靠外交卡，且和葡萄牙方向的历史事实吻合。

### 4.4 `collectivization_decree_1936` — 1936·10 加泰罗尼亚集体化法令与阿拉贡委员会（史实，成本 M）
- 挂钩：`domesticPolicy.land_law`（+1）、`stats.workerControl`、`classes.Braceros/Obreros/Labradores`、`factions`、`resources`（生产）、`aragonCouncilExists`。
- 选项：**颁布集体化法令、把工厂与土地交给工会** → 工人控制+、`land_law`+、中农与小镇商人支持−；**只承认既成事实、不立法** → 收益小但阻力小；**把集体化纳入国家战争工业体系** → 生产/军备+、`bureaucratization`+。
- 备注：与 `工会与生产控制系统设计.md` 的生产系统天然对接。

### 4.5 `federica_montseny_health_1936` — 1936·11 蒙塞尼出任卫生部长与女性权利（史实，成本 S）
- 挂钩：`domesticPolicy.womens_rights`（+1）、`classes.Obreros/Intelectuales`、`organizations`（`ML` 存在时额外收益）、`factions`（Cenetistas/Faistas）。
- 选项：**推动妇女劳动与生育自主（含加泰罗尼亚的堕胎法令）** → 女性权利+1、教会与保守派反弹；**先办儿童疏散与前线医疗** → `resources`−、`republicanAuthority`+；**只做象征性任命** → 无实质。
- 顺带修复：`A_MUJERES` 的后期阶梯（需 女性权利=4 + `ML` 成立），现在有了战时来源。

### 4.6 `guernica_1937` — 1937·4·26 格尔尼卡轰炸（史实，成本 S）
- 挂钩：`relations.uk`/`france`（±3）、`relations.germany`（−10）、`internationalSocialists`（+5）、`classes.PequenaBurguesia`、`stats.tension`。
- 选项：**把画面与证词送上国际报刊（毕加索式的宣传战）** → 国际社会主义者+、英法关系±；**重点控诉德意干涉、要求国联介入** → 对德关系崩、英法冷淡（不干涉仍在）；**把悲痛转为前线动员** → 热情+、民兵战力+。
- 备注：低成本高风味，且能推动"国际纵队/国际舆论"这条线。

### 4.7 `children_evacuation_1937` — 1937 起"战争的孩子"疏散（史实，成本 M）
- 挂钩：`relations.ussr`/`mexico`（+5）、`stats.republicanAuthority`（−/±）、`resources`（−2）、`classes.Obreros`、`journal`（可选新增）或 `internationalSocialists`。
- 选项：**接受苏联与墨西哥的接收** → 关系+、但"共和国把孩子送出国"损害权威与民心（可参考史实争议）；**在法国/比利时安置** → 英法关系+、苏联不满；**在国内后方省份安置** → 权威+、资源−。
- 备注：极强的情感风味事件，且同时牵动两条外交线。

### 4.8 `thirteen_points_1938` — 1938·4·30 内格林十三点（史实，成本 M）
- 挂钩：`relations.uk`/`france`（+3）、`partyRelations`（PSOE/PCE ±）、`coalition`（`activeCoalitions` 凝聚力）、`factions`（CNT 内对"为共和国而战还是为革命而战"的分歧）。
- 选项：**接受"为共和国而战"的纲领**（放弃革命目标以求民主国家支持）→ 外交+、Faistas 异议+；**要求加上"社会革命"条款** → CNT 内部团结、英法冷淡；**拒绝并重申革命路线** → 热情+、外交孤立。
- 备注：这是内战后期 CNT-FAI 身份危机的最佳载体。

### 4.9 `international_brigades_farewell_1938` — 1938·10·28 国际纵队告别（史实，成本 M）
- 挂钩：`internationalBrigades`（清零或转为干部）、`internationalBrigadesFormed`、`relations.internationalSocialists`（+5）、`stats.revolutionaryFervor`、成就 `A_YOUNG_WORLD` 的叙事收束。
- 选项：**举行巴塞罗那告别游行、把他们的故事变成宣传** → 国际社会主义者+、热情+；**劝其留下编入正规军（架空）** → 国际纵队保留、与"不干涉委员会"冲突、外交−；**低调遣散** → 无收益。
- 备注：`internationalBrigades` 目前只增不减，这条事件给这个字段一个终局。

### 4.10 `casado_coup_1939` — 1939·3 卡萨多政变（史实，成本 L）
- 挂钩：`government`、`activeCoalitions`、`mayDays` 遗产、`pceInPower`（反向：政变针对 PCE）、`republicanPartyStatus.PCE`、结局判定（可与 `WE_HAVE_PASSED`/新结局挂钩）。
- 选项：**支持卡萨多"为了和平"的政变** → PCE 被清洗、与佛朗哥谈判（史实路线，走向投降）；**保卫内格林政府、镇压政变** → 内战延长、PCE 保住地位；**CNT 宣布中立、保护工人区** → 三方分裂、马德里混乱。
- 备注：成本高（触及政府/联盟/结局层），但它是内战政治线的天然终点，也让 1939 年不再只是"等结局"。

### 4.11 `nin_case_1937` — 1937·6 安德烈斯·宁失踪（史实，成本 M）
- 挂钩：`republicanPartyStatus.POUM`、`partyRelations.PCE`（−）、`factions`（Faistas/Puristas 异议+）、`mayDays` 阶段（作为 POUM 结果的深水区）。
- 选项：**公开要求调查、把苏联顾问推上被告席** → PCE/苏联关系崩、工人团结+；**私下抗议、保住苏援** → 关系不变、Faistas 异议+；**保持沉默** → `bureaucratization`+、CNT 内部信任崩。
- 备注：与 `may_days` 的 `poum_result` 阶段串联，属于既有链的加厚。

---

## 4. 合理架空（跨时代）

### 5.1 `catalan_independence_1936` — 加泰罗尼亚独立路线（架空，成本 L）
- 挂钩：**`regionalStatuses.catalonia = 'independent'`**（全仓库无人写入 → `A_CATALONIA` 不可达）；注意 `mayDays.ts:29` 在 `catalonia === 'independent'` 时会**跳过五月危机**，所以这条路线必须放在五月危机之后（1937·5 以后）或明确设计为"绕开五月危机"的替代路径。
- 前置：`cataloniaControl === 'cnt_fai'`（`catalonia_defense` 的既有选项）+ 内战进行中 + 革命热情高。
- 选项：**宣布加泰罗尼亚自由公社、加入伊比利亚无政府主义联邦** → `independent`、Faistas+、与共和国政府关系崩、马德里可能断供；**宣布独立但保留军事同盟** → 折中；**放弃独立、回到自治** → 现状。
- 顺带修复：成就 `A_CATALONIA`；并让 `mayDays` 的门控真正生效一次。

### 5.2 `pce_road_to_power` — PCE 掌权路线（架空，成本 L）
- 挂钩：**`pceInPower`**（仍缺少正常游戏写入 → `RUSSIAN_SPAIN` 不可达）；`pceAcceptsComintern` 已由 1935 年共产国际七大提供。
- 待设计：人民阵线内部的 PCE 扩张 → 苏联顾问与武器依赖 → PCE 控制国家机构，用 `partySupport.PCE`、`relations.ussr`、`moscowGoldTransferred`、`republicanPartyStatus` 做门槛，复用已存在的共产国际路线状态。
- 顺带修复：解锁 RUSSIAN_SPAIN 结局，并给"CNT 被挤出决策"的玩家一条通向坏结局的路。

### 5.3 `africanistas_split` — 非洲军团分裂/倒戈（架空，成本 M）
- 挂钩：**`africaArmyStatus = 'republic'`**（从未写入）、`francoStatus`、`morocco` 民族主义选项（`civil_war_setup` 中已有"摩洛哥民族主义者起事"）。
- 选项：**用自治承诺换取里夫民族主义者中立** → 非洲军团分裂、`africaArmyStatus='republic'`、但对德意关系与殖民地秩序有长远代价；**用金钱收买指挥官**（`resources` 大额支出）；**放弃摩洛哥、固守半岛** → 前线变短但失去筹码。

### 5.4 `esperanto_ateneos` — 雅典学苑里的世界语（史实底色，成本 S）
- 挂钩：**`domesticPolicy.language_policy`（+1~2，目前只有 1 个写入方）**、`ateneos_established`、`classes.Intelectuales`、`organizations`（FIJL/ML 存在时加成）、成就 `A_ESPERANTO`。
- 选项：**把世界语办成工人国际主义的通用语** → 语言法+2、国际社会主义者+；**只作为扫盲与函授课程** → 语言法+1、教育/文化收益；**交给国家教育体系** → 权威+、CNT 自主性−。
- 顺带修复：`A_ESPERANTO`（需 `language_policy = 4`）的唯一可行阶梯之一。

### 5.5 `bank_of_spain_reserves` — 西班牙银行的黄金（架空，成本 M）
- 挂钩：`gold_reserves`、`foreign_exchange`、`stats.workerControl`、`relations.uk`/`france`（−）、`factions`。
- 选项：**CNT 把巴塞罗那分行的准备金交给自治区用于军购** → 外汇+、国际信誉−、工人控制+；**移交共和国国库（史实：黄金最终运往莫斯科）** → 与 `moscowGoldTransferred` 选项形成对照；**原封不动** → 安全但缺钱。
- 备注：与既有"莫斯科黄金"选项形成道德与战略上的三角。

### 5.6 `sanjurjada_succeeds_1932` — 1932 政变成功（架空，成本 L）
- 挂钩：`la_sanjurjada` 的失败分支 → 成功分支需要早期独裁/早期内战状态与结局（可能要新增 ending）。
- 备注：价值高但成本最高，建议放在最后做（会引入一整条"军政府西班牙"的时间线）。

### 5.7 `cnt_contests_1933` — CNT 公开参选 1933（架空，成本 M）
- 挂钩：`cntStance`（`cooperate`）、`cntVotingRate`、`cortes`、`partySupport`、`factions`（Faistas/Puristas 异议+）、`treintistasLeft`。
- 备注：与 `elections_1933` 的"弃权/秘密投票"二选一形成第三条路；也会显著改变 1933 与 1936 两次大选的席位结构。

### 5.8 `santoña_pact_1937` — 巴斯克单独媾和（史实，成本 M）
- 挂钩：`regionalStatuses.basque`、`partyRelations.PNV`、前线/`mapResources`、`coalition`、`stats.republicanAuthority`。
- 选项：**谴责 PNV 的投降并接管巴斯克工业区** → 权威+、工业+、PNV 关系崩；**默许其保存实力** → 关系+、但激励其他地区单独媾和；**全力阻止（史实上未能阻止）** → 资源−、无实质。

---

## 5. 推荐批次

**第一批（低成本、且能立刻修复不可达状态，5 个）**

| 事件 | 成本 | 修复 |
|---|---|---|
| `amnesty_and_catalonia_restored_1936` | S | 给 `olimpiada_popular` 补因果链，加泰罗尼亚状态有升降 |
| `divorce_law_1932` | S | `womens_rights` 第一级（`A_MUJERES`/`A_CULTURAL_REV`） |
| `misiones_pedagogicas_1931` | S | `education_institutions` 第一级（`A_CULTURAL_REV`） |
| `ley_defensa_republica_1931` | S | `public_order_law` 从 0 起步 |
| `treintista_split_1933` | M | 首次调用 `adjustUnionShare`，工会占比成为可玩系统 |

**第二批（时代主线缺口，4 个）**：`basque_statute_estella`、`agrarian_reform_law_1932`、`catalan_six_october_1934`、`galician_statute_1936`。

**第三批（内战与架空的大件）**：`durruti_at_madrid_1936`、`lisbon_mutiny_1936`、`catalan_independence_1936`（修 `A_CATALONIA`）、`pce_road_to_power`（修 RUSSIAN_SPAIN 结局）。

---

## 6. 写这些事件前必须知道的 8 条约束

1. **日期只在 Historical 难度精确匹配**：`date` 必须与 `condition` 里的 `isAtOrAfter`/年份窗配合，否则非历史难度下要么不触发、要么飘到荒唐的年份（`olimpiada_popular` 已踩过这个坑）。
2. **一次性由 `eventHistory` 保证**：不要为普通事件发明冷却字段；只有"可重复发生"的机制（如每年一次的大选类）才考虑 `repeatable` + 计时器。
3. **能不加字段就不加**：需要历史信息时优先读 `eventHistory.resolved`（成就 `A_OLIMPIADA` 就是这么做的）；确实要加，就按"可选字段 + `NEUTRAL_STATE`（`src/game/scenarios/base.ts`）+ 存档兼容 + `effectPreview` 标签"四件套补齐。若该字段随剧本而异，还要加进 `SCENARIO_OWNED_KEYS` 并在三份剧本描述里显式赋值。
4. **`adjustFactionInfluence` 会按比例回收影响力**：同一个 option 里连续调用两次，第二次的实际净收益会被稀释（`olimpiada_popular` 选项 B 踩过）。副标题里的数字必须等于实际结算值，必要时改用"异议"表达。
5. **法则等级只能显式提升**：用 `clampLawLevel(lawId, …)` 写，先查 `LAW_LEVEL_LIMITS`（`womens_rights`/`language_policy` 上限 4，`education_institutions`/`land_law`/`public_order_law` 上限 3～4）。**没有任何通用立法机制**会自动涨等级。
6. **地区状态没有现成 action 可用**：`SET_REGIONAL_STATUS` 从未被 dispatch，内容要改地区状态只能直接写 `regionalStatuses`；且 `mayDays.ts:29` 会因 `catalonia === 'independent'` 而跳过五月危机，设计独立路线时必须考虑这个耦合。
7. **战时事件在地图视图看不到**：`App.tsx` 在地图模式下不渲染事件看板，战时事件要等玩家切回标准视图；不要设计"必须在地图上立刻弹出"的战时事件。
8. **必须注册进 `INITIAL_EVENTS`**：`RESTORABLE_EVENTS` 靠 `...INITIAL_EVENTS` 展开，漏注册的事件不但永不触发，读档后 condition/effect 也无法恢复。
