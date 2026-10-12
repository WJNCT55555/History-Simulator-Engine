# CNT–FAI 西班牙共和国模拟器：剧情路线总览

本文按 `src/game/events/index.ts` 的事件注册、`src/game/journal` 日志、`src/game/advisors` 顾问、三类事务卡牌和 `src/game/endings.ts` 的实际判定整理。事件的 `date` 只在 Historical 难度用于月份调度；Normal/Easy/Hard/Sandbox 主要依赖 `condition`。因此，下面的“日期”是历史锚点，“条件”才是跨难度可用性的硬门槛。

## 一、文字版剧情路线树

### 0. 三个剧本入口

- **1931·4（共和国诞生）**
  - 初始事件：`proclamation_of_the_second_republic`（谨慎乐观→三十人集团；推动社会革命→法伊派）。
  - 1931·5：`burning_of_the_convents`（恢复秩序／激进反教权）；`azana_military_reform`（军改法 +1、治安机关法 +1）。
  - 1931·6：进入 CNT 第三次大会链（见下）。
  - 1931–1935 的全部政治、组织、选举和危机节点均可出现。

- **1933·11（黑色两年开局）**
  - 跳过 1931–1933 的历史事件；初始政府为 `ceda_radical`（激进党–CEDA），CNT 处于反对派。
  - 立即可走 `workers_alliance_attempt`→UHP 日志；之后可走 1934 阿斯图里亚斯革命、1936 选举和内战。

- **1936·7（内战开局）**
  - `civilWarStatus = ongoing`，先显示西班牙内战超级事件，再进入 `civil_war_setup`；政治前置链（1931/1933 选举、总统选举）已视为完成。
  - 仍可触发加泰罗尼亚防御、阿拉贡委员会、军政卡牌、外交援助和两种投降结局。

### 1. 1931：CNT 第三次大会与首次组阁

`cnt_third_congress_1` → `_2` → `_3` → `_4` → `_5` → `_6`（闭幕后排入 1931 大选结果）。每一层都会改变派系影响、革命热情、官僚化或资源：

- `_2`：建立全国工业联合会（集中化）／拒绝联合会、坚持地方联邦制。
- `_3`：鼓动农村生产者（革命热情）／“短工与佃农联合”（三十人集团）／成立农业委员会（消耗资源、建立 FNA）。
- `_4`：筹资办《全国日报》（资源≥3、集中宣传）／优先地方出版物。
- `_5`：坚持反议会主义（`cntStance=oppose`）／默许地方参政但仍反对（`oppose`）／鼓励投票（`cntStance=cooperate`，投票率大增）。
- `_6`：闭幕，排入 `elections_1931_results`。

**1931 大选结果（`elections_1931_results`）**

- **共和–社会党联盟**（默认按钮）
  - 若 `cntStance=cooperate`：排入 `cabinet_formation_1931`。
    - 拒绝入阁：外部容忍，工人控制略升。
    - 接受入阁：`cntStance=govern`、官僚化上升，进入自定义 `minister_allocation`；可把 CNT 放入劳工、农业、财政、战争等部。
  - 若 `cntStance=oppose`：排入 `left_cabinet_excludes_cnt_1931`，阿萨尼亚组阁但 CNT 被排除。
- **共和派联盟**（`ERC+IR+UR+PRR+DLR >235` 席时可用）
  - `republican_cabinet_1931`：勒鲁任总理，社会党被排除，革命热情上升。

并行的 1931–1932 单次事件：电话大罢工（全国总罢工／局部破坏）、《三十人宣言》（静观／若法伊派主导则驱逐三十人集团）、混合陪审团、1931 宪法（直接行动／利用法律）、加泰罗尼亚自治法、桑胡尔霍政变。

### 2. 1933–1935：右翼整合、CNT 内部分裂与工人联盟

- `nazi_power_1933`：反法西斯社论（革命热情、PSOE/PCE 关系、对德关系）。
- `ceda_formation`（1933·3）：消耗资源动员街头／保持意识纯洁；两者都会使 CEDA 右翼整合。
- `founding_of_falange`（1933·10）→`birth_of_fe_de_las_jons`（1934·2）：右翼法西斯组织成立并合并。
- `elections_1933`（1933·11）：
  - **弃权**：法伊派影响和革命热情上升，结果进入 `Radical-CEDA Government`（黑色两年）。
  - **秘密反 CEDA 投票**：三十人集团影响上升、革命热情下降；结果仍由 `elections_1933_results` 结算为激进党–CEDA 政府。
- `manifesto_of_the_thirty`：
  - 静观：保留 Ángel Pestaña 与三十人集团路线。
  - 驱逐叛徒（需 Faistas 成为主导）：移除 Pestaña、设置 `treintistasLeft=true`，1934·7 可触发 `founding_of_the_syndicalist_party`（PS）。该选择会封死 PRRevS 路线。
- **PRRevS 路线（Pestaña 在场）**：需 Pestaña 激活、`cntStance=govern`、官僚化≥50、三十人集团影响>60、建设度≥4。
  - 组建 PRRevS：成立 CNT 的政治臂膀，但法伊/纯粹派分歧大增、革命热情下降。
  - 暂缓：三个月后重问。
  - 永久放弃：设置 `prrevsAbandoned`，不再出现。
- **Jabalí?（PRRevS 成立至少一个月）**：
  - 接受“野猪”路线：解锁 Ramón Franco、Eduardo Barriobero、Pedro Vallina，Jabalistas 影响=15；
  - 拒绝：不解锁三名顾问。
- **UHP/工人联盟路线**：
  - `workers_alliance_attempt`：需 1933·11 后、CNT 反对派且非共和–社会党执政；激活 UHP 日志。
  - UHP 日志完成：PSOE 关系≥70；之后由十字路口选项 A（进度+2）与 Orobón／Segundo Blanco 的“推动工人联盟”把进度推到 3，并在 PSOE 关系≥80、CNT 工会占比≥18、CNT+UGT≥35、右翼工会（CNCA+CONS）≤12 时完成 `journal_alianza_obrera`，形成 `workers_alliance` 并排入成立事件。完整阈值与源码位置见 [工人联盟→阿斯图里亚斯战争事件链详解](工人联盟-阿斯图里亚斯战争事件链.md)。
  - `crossroads_uprising_alliance`（1934+）：
    - **无产阶级起义**：革命热情+15、工人联盟进度+2，保留革命路线。
    - **反法西斯同盟**：形成 `popular_front`，CNT 合作，UHP/工人联盟日志失败，转向选举路线。
- `asturias_revolution`：
  - Historical：1934·10 后可触发；其他难度需 UHP 完成、CEDA–激进党执政、紧张度>60、革命热情>50。
  - **CNT 全力加入**（需工人联盟完成、革命热情>80、Faistas+Puristas 影响>80）：进入独立 `asturias_war` 地图战；失败时结局 `ASTURIAS_WAR_LOST`，胜利后继续主线。
  - **仅阿斯图里亚斯同志参加**：直接 `asturias_war=failed` 并显示失败叙事；只有地图战实际失败、状态写成 `lost` 时才触发 `ASTURIAS_WAR_LOST` 结局。
- `nombela_scandal`（1935·11，需激进党–CEDA 政府）：三种处理（革命动员／与左翼共和派战术合作／农村租佃斗争）都会击穿执政联盟；`governmentCrisis` 会在下个月自动排入 `presidential_dissolution_of_cortes`→`early_general_election_results`。

### 3. 1936：大选、总统危机与路线锁定

**1936 大选（`elections_1936`）**

- **特赦优先、解除弃权**：`cntStance=cooperate`，左翼席位增加，进入结果结算。
- **绝对弃权**：`cntStance=oppose`，革命热情与法伊派影响增加，右翼席位增加。

**结果（`elections_1936_results`）**

- 左翼席位≥右翼：组建 `popular_front` 内阁（阿萨尼亚，宣布特赦）。
- 右翼席位更多：组建 `national_front`（吉尔–罗伯斯），回滚土地/劳工改革、CNT 进入反对派。

**人民奥林匹克（`olimpiada_popular`，1936·6）**

- 触发门槛（和平期硬门槛）：`scenario !== '1936'`、`civilWarStatus = not_started` 且无其他战争、**人民阵线执政**（`rulingCoalition = popular_front`）、**加泰罗尼亚仍自治**（`regionalStatuses.catalonia = autonomy`）、且处于 **1936 年 6–8 月**这一赛事窗口内（过期不再出现）。Historical 难度按 1936·6 精确触发，其他难度按条件首次满足触发。
- **入场但打自己的旗**：国际社会主义者+5，ERC+5/PSOE+3，革命热情+4；工团派异议−3、纯粹派+4。
- **抵制**：无政府主义者影响+6、纯粹派异议−3；ERC−5/PSOE−3，热情+3；工团派异议+5、三十人集团+3。赛事照办，只是 CNT 缺席。
- **自下而上的工人节庆（−1 资源）**：自由雅典学苑+1，国际社会主义者+8，热情+5，四派异议−5/−5/−3/−3。
- 成就 `A_OLIMPIADA`（人民奥林匹克）在事件结算时解锁（读 `eventHistory.resolved`，无需新状态字段）。
- `olimpiada_popular_stranded`（1936·8，内战进行中且战争不早于 1936·3 爆发）：滞留的外国运动员**发枪入纵队**（−1 军备，国际社会主义者+8、热情+6）或**送他们去边境当见证人**（法国+4/英国+2、国际社会主义者+4、共和国权威+2）。

**政府危机与提前大选**

- 任一执政联盟因凝聚力/脚本事件解体后，月度管线自动排入 `presidential_dissolution_of_cortes`。
- 总统解散议会→`early_general_election_results`；席位最高者按年份/`crossroads_choice` 形成共和–社会党、人民阵线或 CEDA–激进党/国家阵线。
- 第二次解散后 `impeach_president` 卡可用（内战未开始时）。

**总统选举链（`presidential_election_decision`）**

- **弃权**：`presidential_election_auto_resolve`，脚本化由阿萨尼亚当选（权威+5、土地改革+15、政变进度+10）。
- **参与**：进入左翼初选：
  - 阿萨尼亚；
  - Ramón Franco（需完成 3 次 Ramón 竞选事件）。
- 进入候选人背书：左翼／马丁内斯·巴里奥（中间）／吉尔–罗伯斯（右翼）。
- 竞选大厅可分别游说 PSOE、ERC、街头动员、收买中间选举人；第二轮另有说服马丁内斯退选、收买吉尔–罗伯斯盟友。
- 第一轮达到 2/3 即结束，否则第二轮简单多数；结果分别可能锁定阿萨尼亚、Ramón Franco、马丁内斯·巴里奥或吉尔–罗伯斯总统。Ramón 胜选会显著提高革命热情与地区自治、并使政变进度+25；吉尔胜选会使改革倒退、革命热情+30。

### 4. 内战主线（1936·7 开局或政变进度=100）

`civil_war_setup` 有两个入口：

- **快速历史部署**：直接按历史地图布置，`civilWarStatus=ongoing`。
- **沉浸式链**：`cw_step1`–`cw_step31_summary`，每步先做决定再看结果，最后进入可操作内战。

沉浸式 15 个关键决策（结果节点只负责继续）：

1. 塞维利亚诡计：接受地方判断／PSOE 关系≥80 时联手 UGT 总罢工／广播≥2 时广播揭露政变／Ramón 在场时说服 Queipo 忠诚。
2. 安达卢西亚两端：观望／马拉加工人增援科尔多瓦／Pedro Vallina 在场时让“火焰继续”。
3. 萨拉戈萨信任危机：相信将军／立即总罢工／表面接受、秘密部署工人。
4. 老卡斯蒂利亚：接受既成事实／焦土撤退。
5. 纳瓦拉：卡洛斯派加入国民军（单一路径）。
6. 巴斯克：信任 PNV／CNT 领导圣塞巴斯蒂安抵抗／毕尔巴鄂工人夺取重工业区。
7. 巴塞罗那街垒：与突击警卫协调筑垒（单一路径）。
8. 马德里蒙塔尼亚兵营：强攻／炮击围困／支援瓜达拉哈拉与托莱多。
9. 奥维耶多背叛：矿工南下援助马德里／留守阿斯图里亚斯／一半南下。
10. 加利西亚：服从军令不抵抗／保卫费罗尔海军基地／保卫维戈港走廊。
11. 瓦伦西亚：罢工施压但不攻兵营／强攻兵营／配合马丁内斯·巴里奥使团。
12. 巴利阿里群岛：多数岛屿落入叛军（单一路径）。
13. 桑胡尔霍飞行：飞机失事／Ramón 在场时安全抵达布尔戈斯。
14. 佛朗哥接管非洲军团：历史性领导起义／犹豫观望／摩洛哥民族主义者起事。
15. 共和海军：封锁海峡／撤往穆尔西亚／红色海军自行决断。

**内战中的可选支线**

- 阿斯图里亚斯战持续 ≥3 回合时触发 `andalusia_fire`：自动把加的斯、马拉加交给工人联盟并增援部队（无第二个选项）。工人联盟若控制阿斯图里亚斯、奥维耶多、马德里、马拉加、萨拉戈萨、瓦伦西亚，则 `asturias_war=won`，奖励资源/军备后回到主线。
- `catalonia_defense`：CNT 夺取加泰罗尼亚（`cataloniaControl=cnt_fai`、工人控制+20）／与 Companys 临时结盟（`committee`）。
- `aragon_council`：承认阿拉贡防卫委员会（革命热情+15）；之后 `aragon_front` 卡可进行招募、纪律、教会政策三次分支。
- `militia_reorg`、`anarchy_tanks`：军备/民兵整编与坦克研发，改变战场胜负而不另开剧情终点。
- 外交卡：法国援助、国际纵队、美国禁运、安道尔/直布罗陀、葡萄牙行动；苏联菜单中的“转移莫斯科黄金”会设置 `moscowGoldTransferred`。
- 新增四个相对内战开局月份触发的一次性事件：第 2 个月起 `pce_political_vacuum`（争取失去政治代表的自耕农与店主），解决后第 4 个月起 `pce_smallholder_guarantees`（小农土地与收成保障），再解决后第 6 个月起 `pce_middle_class_appeal`（小商店与专业人士的后方秩序）。第 7 个月起 `moscow_gold` 独立触发，要求战争仍在进行、CNT 未同时掌管国务部与财政部、未没收私营银行储蓄、黄金至少 150 且此前未转移；它与外交卡共享转移结算，不能重复军购。前三个事件仅从已退出共和国政治的 AP/RE/CT/FE/PRR/DLR 转移阶层支持，CNT 可投入资源争取其中一部分，不改写议席或敌方部队。

**战争终点判定**

- `nationalist_surrender`：布尔戈斯被解放且国民军战略价值<60 → `civilWarStatus=won`。
- `republican_surrender`：马德里、巴塞罗那、瓦伦西亚均失守且共和战略价值<50 → `civilWarStatus=lost`。
- 1939 年仍未开战 → `SILENT_REPUBLIC`；1939 年仍在鏖战 → `FOR_WHOM_THE_BELL_TOLLS`。

### 5. 顾问/卡牌造成的关键“隐性分歧”

| 机制 | 路线作用 |
|---|---|
| Ángel Pestaña | `prepare_the_party` 提高 PRRevS 建设度；他被《三十人宣言》驱逐后，PRRevS 永久不可走。 |
| Valeriano Orobón | “改善与 UGT 关系”提高 PSOE 关系；“推动工人联盟”（**需 UHP 日志完成后解锁**）使工人联盟进度 +1，与 Segundo Blanco 的同名行动、十字路口选项 A（+2）共同构成进度 3 的来源。 |
| Ramón Franco | Jabalí 选项解锁；3 次竞选事件解锁总统初选的 Ramón 选项，并在内战第 1/13 步提供特殊选项。 |
| Pedro Vallina | Jabalí 选项解锁；在内战安达卢西亚节点提供第三选项。 |
| `organizations` 卡 | 可建立 FIJL、Mujeres Libres、FNA、Comités de Defensa；组织改变行动卡和战力，不直接改变结局判定。 |
| `prrevs_campaigning` 卡 | PRRevS 成立后按阶级投放资源，提升工人/农民/知识分子支持与投票能力。 |
| `propaganda_by_deed` 卡 | 1935 前刺杀弗朗哥可使政变进度−20；桑胡尔霍−15；Queipo−10；刺杀索特洛反而使政变进度+15（提供借口）；刺杀萨莫拉可直接开启总统选举危机。 |
| `impeach_president` 卡 | 第二次解散议会后可弹劾阿尔卡拉–萨莫拉；成功进入总统选举，弃权/反对则维持其总统任期。 |
| 政策/军政卡 | 通过 `coupProgress`、军队忠诚、革命热情、工人控制和地区自治，间接把游戏推向“政变→内战”或“1939 未开战”。 |

## 二、最终结局（按 `checkEndings` 的优先级）

三方战争先独立结算：委员会满足投降条件（巴塞罗那失守且剩余 SV 严格低于阈值，默认 50）后立即进入 **IBERIAN_COMMITTEE_DEFEAT / 防御委员会失败**，无需等剩余 AI 决出赢家；委员会成为唯一存续阵营时进入 **IBERIAN_COMMITTEE_VICTORY / 防御委员会的胜利**。三方战争进行期间不进入以下普通政治结局，也不受 1939 年截止限制。

以下为普通路线的检查顺序：

1. **THE_GREAT_PURGE / 大清洗**：全国支持率 `partySupport.PCE > 75` 且 `cntStance=govern`。优先于以下其他普通结局。
2. **ASTURIAS_WAR_LOST / 阿斯图里亚斯工人的挽歌**：阿斯图里亚斯战争标记为 `lost`。
3. **WE_HAVE_PASSED / 我们已经通过**：`civilWarStatus=lost`。
4. **RUSSIAN_SPAIN / 俄属西班牙**：内战胜利 + `moscowGoldTransferred` + 全国 PCE 支持>70 + `pceInPower` + `pceAcceptsComintern`。
5. **CHILDREN_OF_THE_PEOPLE / 人民之子**：内战胜利 + 革命热情>80 + 全部派系平均分歧<30。
6. **POPULAR_FRONT / 人民阵线**：内战胜利 + 革命热情<40 + `cntStance=govern`。
7. **GENERIC_WIN / 脆弱的和平**：其余所有内战胜利。
8. **SILENT_REPUBLIC / 寂静的共和**：1939 年、内战从未开始。
9. **FOR_WHOM_THE_BELL_TOLLS / 丧钟为谁而鸣**：1939 年、内战仍在进行。

### 代码审计提示

- `comintern_seventh_congress` 在 1935 年 8 月触发，唯一选项为“西班牙共产党转向反法西斯人民阵线战略”，写入 `pceAcceptsComintern=true`。1936 剧本预置该历史状态，不重复播放过去的事件。`RUSSIAN_SPAIN` 仍缺少 `pceInPower` 的正常游戏写入，因此目前仍不可达。
- 两个支持率门槛均使用全国人口加权数值和严格大于号：大清洗 >75%，俄属西班牙 >70%。新增内战事件后，直接 PCE 增益覆盖产业工人、自耕农、小资产阶级、知识分子，合计人口 56%；其余 44% 人口的阶层仍保留 PCE 不超过一个初始支持率更高、且没有直接增益或减益写入的政党的关系。宽松理论上限为 `56 + 44 / 2 = 78%`（忽略微小舍入），已不能证明新门槛不可达，但也不代表能实际达成。`scripts/audit-ending-invariants.ts` 核验写入方与不变量；大清洗仍需普通路线抵达证据。
- “大清洗”没有战争、苏援、PCE 掌权、共产国际或镇压事件门槛；理论上和平时期也能触发。“俄属西班牙”没有 CNT 立场门槛：CNT 参政时，`70 < PCE <=75` 可通过其支持率条件，PCE>75 则被更早检查的“大清洗”覆盖。
- 结局检查按上表短路；例如即使内战胜利且满足“人民之子”，只要 PCE>75 且 CNT 执政，仍会先落入“大清洗”。
- `meta.tags=['repeatable']` 仅是编辑标记；PRRevS 的再次出现实际由 `prrevsDeferralDate` 和运行时条件控制。

## 三、Mermaid 完整剧情图

图表源码已单独保存为 [`game-story-routes.mmd`](D:/cnt-fai-1931_-spanish-republic-simulator8.15/docs/game-story-routes.mmd)，可直接复制到 Mermaid Live、GitHub 或支持 Mermaid 的 Markdown 编辑器中渲染。图中每个方框均为事件、结果、状态检查或结局；连线文字是对应选项，虚线表示日期/条件触发或顾问、卡牌造成的旁路。
