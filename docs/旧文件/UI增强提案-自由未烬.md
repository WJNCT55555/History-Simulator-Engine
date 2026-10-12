# 《自由未烬 / Liberty Unquenched》UI 增强提案

> 性质：**只读调研 + 设计提案**。全程未修改、未新增、未删除任何源码文件。
> 调研方式：源码通读（25 个组件 / `types.ts` 922 行状态定义 / 地图层 / 规则层）、构建产物实机跑通、六路并行只读审计。
> 文中所有 `文件:行号` 均经核对。

---

## 0. 一句话结论

这款游戏已经长出了一套**非常完整的 1930 年代印刷品语法**：纸张底色、油墨黑、CNT 红、网点、硬投影、斜切标签、橡皮图章、打字机字体。
但这套语法只在**一个地方被彻底执行**——`EconomyModal` 的账本化处理（`src/index.css:127-251`）。其余界面仍然是"套了印刷皮肤的原生 Tailwind"。

与此同时，游戏模拟了**远比它展示的更多的东西**：政变进度阶梯、群众动员度、真实战报、事件年鉴、五维宣传网络、秘密行动积分、立法游说明细、联盟编年史……这些数据全部静静地躺在 `GameState` 里，从没有一个出口。

所以本提案的主线只有两句话：

> **一、把沉睡的数据做成看得见的仪表。**
> **二、把仪表做成印刷品。**

---

## 1. 起点：已有的"印刷品语法"清单

设计必须生长在既有语言上，否则"美观"会变成"贴皮"。现有可复用的母题：

| 母题 | 定义处 | 现状 |
|---|---|---|
| 纸张 / 油墨 / CNT 红 / 共和紫 / 共和黄 | `index.css:3-26` | 全局令牌，使用良好 |
| `border-print` 2px 墨框 + 3px 硬投影 | `index.css:50-63` | 已用于 3 处，是默认"印刷卡片" |
| `bg-halftone` 4px 网点 | `index.css:65-68` | 用于 MainArea 底纹、状态条填充 |
| body 噪点 SVG 纸纹 | `index.css:32` | 全局 |
| 斜切标签（`-skew-x-[30deg]`） | `TopBar.tsx:335-345` | 仅顶栏 5 个页签 |
| 橡皮图章（旋转边框文字） | `EndingScreen.tsx:133-144`、`LawStanceModal.tsx:190`、`StartScreen.tsx:278` | **三处各写一遍，未抽象** |
| 报头（双线花边 + 刊名 + 日期） | `LawStanceModal.tsx:210-233` | 全游戏仅此一处，浪费了 |
| 打字机正文（Special Elite） | 全局 | 用于标签与档案文本 |
| 账本纸（纸纹 + 3px 墨框 + 压印标题 + 去圆角） | `index.css:127-251` | **仅 EconomyModal 享有** |
| 电台木纹 + 黄铜 | `MusicPlayer.tsx` 硬编码 hex | 与令牌脱钩 |

---

## 2. 诊断：四个系统性缺口

### 缺口 A：数据沉睡
`GameState` 里有一大批**已经参与运算、却从不露面**的字段。最刺眼的几个：

- `coupProgress`（0-100）与 `coupTriggered10 … coupTriggered100` 十个里程碑布尔值 —— `postReducer.ts:139-197` 实现了完整的十级阴谋阶梯（"莫拉登场"扣军官忠诚、"非洲军团"翻转、"佛朗哥倒戈"…），玩家在正式界面上**完全看不到自己走到第几级、下一级会掉多少**。
- `stats.anarchistMilitia` —— 被 FIJL 卡、六位顾问、`mitin_popular`、`propaganda_by_deed` 反复写入，整个 `src/components` 里**一次都没出现过**。
- `mapHistory: string[]` —— 真实战报文本（各省投降、委员会成立、AI 回合已被 `combat.ts:418-473` 写好），`selectors.ts:58` 专门搬运它，**没有任何组件渲染**。
- `eventHistory.triggered / resolved` —— 玩家全程经历的事件 id 集合，UI 零呈现。
- 宣传五维 `commercialized_propaganda / campaign_propaganda / ideological_propaganda / radio / cinema` —— **全部未可视化**。
- `covert_ops_france / covert_ops_portugal / leverage / ateneos_established` —— 两条日志的胜负条件、组阁筹码、学苑数，全无显示。
- 28 个 `*_timer` 冷却计数 —— 卡牌冷却**只能靠"按钮灰着"表达**。
- `lawStanceModifiers` 的逐条元数据（`reasonZh` / `sourceType` / `expiresAtMonth`）—— 立法博弈目前是黑箱。
- `armedForces.entityPools` 的 `artillery` / `tanks` / `status` / `activeFrom` —— 11 个武装实体的家底只有 `manpower` 露脸。
- `coalitionHistory` / `dissolutionCount` / `governmentCrisisSequence` —— 一部现成的共和国宪政史。
- `relations.syndicalistParty` —— 十项国际关系中唯一被漏掉的一项。
- `dues`（会费档位）、`prepareRevolution` 的 9 次拉杆、`tankResearchProgress`、`militarizationPaths.chosen`、`internationalBrigades`、`aragonCouncilExists` —— 全是玩家用 AP 换来的长期资产，却只在沙盒调试菜单里可见。

### 缺口 B：反馈静默
- 结算（`RESOLVE_EVENT`，`eventReducer.ts:107-129`）**只改数字**：没有飘字、没有账单、没有音效、没有历史。玩家点完一个选项，不知道刚才改了什么。
- TopBar 的资源/军备是纯文本（`TopBar.tsx:101-102`），**数值变化零动效**。
- 主循环**没有翻牌动画**：手牌是普通 `div`（`MainArea.tsx:88`），抽牌瞬间出现；`discard` 弃牌堆全项目 UI 从未展示。
- 全游戏**只有背景音乐，没有任何 UI 音效**（盖章、打字、翻纸、静电）。

### 缺口 C：精致度不齐
四套视觉方言并存：①账本化＝仅 `EconomyModal`；②公报体＝仅 `LawStanceModal`；③`border-print` 硬投影＝`SandboxMenu` / `SaveManagerModal`；④**最朴素的通用 Tailwind**＝`DomesticPoliticsModal:530`、`DomesticPolicyModal:52`。

还有一批**根本不生效的样式**（详见 §8）：

- 用了但没定义：`hide-scrollbar`（`TopBar.tsx:99`）、`custom-scrollbar`（`JournalPanel.tsx:285`、`DomesticPoliticsModal.tsx:582`）、`bg-paper-light`（`EconomyModal.tsx:774/800/826/852/878`、`SidePanel.tsx:747`）、`animate-in fade-in`（5 处）、`animate-fade-in`（`EndingScreen.tsx:148`）。
- 定义了但没人用：`.bg-wood-texture` / `.glass-panel` / `.brass-button` / `.tube-glow`（`index.css:70-125`）—— 电台材质的 CSS 全部空转，`MusicPlayer` 自己硬编码了另一套 hex。**【已决：保留原状，仅在原地加废弃注释，不实现】**
- `.bg-contested-stripes`（原 `index.css:70-78`）：**【已决：删除】** 地图早期靠精灵图 PNG 渲染，后升级为 geojson；地块精度提升后，"争夺省份"这一概念本身已不需要，该样式随之废弃。
- 讽刺的是，"标杆弹窗"自己的作用域规则 `.economy-modal__panel .bg-paper-light.border`（`index.css:178`）也因为令牌不存在而失效。

### 缺口 D：动画与可访问性
- 五个弹窗**全无** `role="dialog"` / `aria-modal` / 焦点陷阱；全库**只有 `SaveManagerModal` 处理 Escape**（`:193/196`）。
- 十余处信息只挂在 `title=` 或 hover 浮层上，触屏不可达；侧栏两个浮层还被 `overflow-y-auto` 裁切（`SidePanel.tsx:1202/1292`）。
- **实测到一个真实死锁**：`AnimatePresence mode="wait"` + 被浏览器暂停的 `requestAnimationFrame`（后台标签页）会让退场动画永不完成，新界面永不挂载。复现：把页面切到后台，点击开始界面的"开始革命"——根节点 class 已更新为剧本选择态，但 DOM 里仍然只有主菜单；用一次强制渲染（截图）推动一帧后立刻恢复。这影响浏览器自动化、窗口最小化、以及"切走再切回"的边界体验。

---

## 3. A 类｜让沉睡的数据开口（玩法价值最高）

| # | 名称 | 数据 | 形态 | 落点 |
|---|---|---|---|---|
| A1 | **阴谋阶梯** | `coupProgress` + `coupTriggered10..100` + `molaStatus/queipoStatus/francoStatus/africaArmyStatus` | 十级阶梯剖面图，已过级实心、当前级闪红、未来级虚线；每级旁小字标注代价（"军官忠诚 −10"） | SidePanel「共和危机」区块内 |
| A2 | **群众动员条** | `stats.anarchistMilitia` | 与"革命热情"并排的第二根横条，网点填充、右端刻度标 FIJL 影响 | SidePanel `:359-371` |
| A3 | **战报电传机** | `mapHistory` | 打字机字体逐行滚动条，按【交战】【退却】【歼灭】着色，点击定位省份 | 地图左下 / SidePanel 顶部 |
| A4 | **大事记年鉴** | `eventHistory.triggered/resolved` | 竖时间轴 + 月份刻度，每格一枚小印章；点击回看事件卡 | JournalPanel 第二页签 |
| A5 | **媒体帝国** | 宣传五维 + `ateneos_established` | 三条产线（报刊/电台/影院）的建设进度车间图，学苑数用"教室窗格"计数 | 新面板，或 SidePanel 折叠区 |
| A6 | **伊比利亚之梦进度** | `covert_ops_france/portugal`、`gibraltar_resolved`、`andorra_secured` | 双国进度条 + 节点旗标 | 国际关系区块 |
| A7 | **立法谈判桌** | `lawStanceModifiers`（含 `reasonZh`、`expiresAtMonth`） | 逐条"谁 / 因为什么 / 支持或反对哪条法 / 到几月为止"的条目列表 | `LawStanceModal` 满意度栏下方 |
| A8 | **共和国编年史** | `coalitionHistory` + `dissolutionCount` + `governmentCrisisSequence` | 横向年代轴，每届联盟一段底色带，危机打星号 | SidePanel「国内政治」 |
| A9 | **革命准备九宫格** | `prepareRevolution.{militiaUses,armyUses,sabotageUses}`（各 0-3） | 9 枚可打孔的方格，已用打孔、剩余留白 | 军事面板或地图 HUD |
| A10 | **武装家底表** | `armedForces.entityPools` 的火炮/坦克/状态/成立月 | 11 行小表：实体徽记 + 人力/火炮/坦克三列 + 生命周期状态点 | SidePanel「武装情况」 |
| A11 | **长期资产栏** | `tankResearchProgress`、`militarizationPaths.chosen`、`internationalBrigades`、`aragonCouncilExists` | 一排"已获得资产"戳记，未获得显示为空心幽灵位 | 顶栏下方或侧栏顶部 |
| A12 | **冷却读数** | 28 个 `*_timer` | 见 C3「封印章」 | 卡面 |

**为什么这一类的性价比最高**：数据、逻辑、文案全都现成，只缺一个视图。A1 尤其关键——它把"我什么时候会输掉共和国"从黑箱变成可以规划的时间表。

---

## 4. B 类｜把数字变成印刷品（可视化升级）

| # | 名称 | 数据 | 形态 |
|---|---|---|---|
| B1 | **月结瀑布条** | `financing.cashUsedForDeficit/newBorrowing/newArrears` + `next*` | 横向分段瀑布：现金 → 借款 → 欠款 → 入库，负值段红斜纹。替换 `EconomyModal:637-648` 的纯文字块 |
| B2 | **指标 sparkline 三联** | 现成的 `economyHistory`（`EconomyModal:92` 已有折线组件可复用） | 嵌进 SidePanel「国家经济」六个数字格底部，一瞥知趋势 |
| B3 | **议会半圆 + 多数线 + 空缺席** | `getEffectiveCortes` / `getVacantCortesSeats` | 侧栏议会区块直接复用 `ParliamentChart`（**d3 版本已存在却只有弹窗在用**，`ParliamentChart.tsx`），画 236 席多数线，战时空缺画空心楔形；替掉 `SidePanel:700` 的硬编码 /470 色带 |
| B4 | **派系光谱丝带** | `factions[].influence/dissent` + `getOverallFactionDissent` | 100% 堆叠横带 + 每派分歧须线（caterpillar，须越长越危险） |
| B5 | **政党关系热力矩阵** | `partyRelations`（10×10） | 红→绿方格矩阵，替掉 `SidePanel:623` 的十行文字 |
| B6 | **工会格局残影条** | `unionShare` + 上月快照 | 100% 堆叠条叠加**上月半透明残影**，此消彼长一眼可见 |
| B7 | **所有权哑铃图** | `controlShares.{land,industry}` + `getControlCeilings` | 每桶"开局值 → 现值"连线，上限画虚线闸门 |
| B8 | **税基弹性尺** | `taxBaseFactors` + 当前税率 | 双轨刻度：上轨税率、下轨税基衰减阴影；悬停显示"再 +1% → 收入 +0.3M / 通胀 +0.2" |
| B9 | **内阁-部委矩阵** | `MINISTRIES_DEF` + `state.ministers` | 12×党派色小方格（空缺斜纹），一屏看清组阁版图 |
| B10 | **支持率 Δ 徽章** | `partySupport` + 月度快照 | 每党条右侧 ▲▼ 与百分点 |
| B11 | **组织徽章墙升级** | `getOrganizationsForOwner` + `isOrganizationEstablished` + `status` | 类型色条 + 成立/民兵化/升格三态角标（数据 `status`/`establishedAt` 已存在但从未显示） |
| B12 | **国际关系护照签证页** | `relations` 十项（补上漏掉的 `syndicalistParty`） | 做成护照内页：每国一枚签证章，盖章样式表示关系等级（同盟/友好/中立/敌对），过期章褪色 |

---

## 5. C 类｜仪式感：让机制有"手感"

这是"有趣"的主要来源，也是最能把印刷美学用足的一类。

**C1. 结算铅字账单（强烈推荐）**
复用 `cloneStateForPreview`（`effectPreview.ts:341-358`）拿到结算前后的差分，产出一张打字机小票：逐行打印 `RESOURCES +3`、`FAISTAS DISSENT +10`，负值用印泥红，末尾盖一枚"已执行"橡皮章，随后小票收进"本月账目"纸夹。
→ 一举解决缺口 B 的静默结算问题。

**C2. 月度号外（Extra）**
每月开场做一份报纸号外：报头双线花边（`LawStanceModal:210-233` 的报头语言可以升级为通用组件）、斜体大标题、"EXTRA" 竖排红字、油墨压印入场（0.15s，scale 0.97→1）。数据用 `eventHistory` 当月新增项。

**C3. AP 打孔券 & 冷却封印章**
当前 AP 只是 `MainArea.tsx:56-60` 的一行文字。改成右上角 2 枚**车票式打孔券**：花 1 点冲一个孔，孔洞透出纸背纹；悬停卡牌时高亮"将消耗几枚"。
不可用卡牌不要只 `opacity-50`——斜盖一枚褪色红章**"封存 · 尚余 3 月"**，把 `*_timer` 从隐藏逻辑变成可见叙事。

**C4. 扇形手牌 + 抽牌翻面**
手牌 4° 递进叠放，抽牌时沿弧线飞出并绕 Y 轴翻面（背面用 `MainArea.tsx:272` 已有的对角网点），打出时下滑入弃牌堆（`discard` 目前 UI 完全没有出口）。

**C5. 派系异议墨色温度条**
选项旁一条 5 级墨色窄条（浅墨 → 深墨 → 深红），预标出"这个选项会激怒谁"。数据 `factions[*].dissent`。

**C6. 日历翻页转场**
每月开始翻一页日历（纸张纹理 + 落下阴影 + 广播报时声），把"月份推进"从数字跳变变成一个动作。

**C7. 结局印章语义化**
目前 11 种结局共用同一枚红章（`EndingScreen.tsx:139-143`），乌托邦与"Hemos Pasado"（战败）视觉完全相同。按 胜利 / 失败 / 僵局 分三种材质：**黑金滚边章 / 褪色灰撕边章 / 虚线未生效章**；页眉的假档案号换成真实结局代号。

**C8. 打字机可控**
`EndingScreen` 正文 40ms/字，最长文本实测 574 英文字符 ≈ 23 秒且**不可跳过**。加右下角 `SKIP` / `2×` 与回车抖动。

**C9. 超级事件兜底与入场**
`SuperEvent.tsx:80-88` 指向 `public/music/SuperEvent/*.mp3`，该目录**不存在**→ 三个事件音频全部静默 404；未知 id 会渲染空框（`:35-77`）。补上"胶片划痕黑场入场"与 `EXTRA!` 报纸头版兜底，并加日期脚注（数据已有）。

---

## 6. D 类｜地图与战争层

| # | 名称 | 数据 | 形态 |
|---|---|---|---|
| D1 | **战线推进动效** | `provinces[].owner` + 上次归属 | 易主瞬间白闪 + 边界抖动 400ms（现在只有 300ms 颜色过渡） |
| D2 | **前线压力带** | 相邻省 `getCombatPower` | 沿 `politicalBordersPathString` 叠红/紫粗线，**线宽=战力差** |
| D3 | **补给网络层** | `getSupplyLimit` + `PROVINCE_ADJACENCY` | 新增 `mapMode: 'supply'`：补给源→前线流线，超载省份红晕 |
| D4 | **战争资源 HUD** | `commandPoints` / `manpower` / `supplies` / `IC` / `tankReserve` | 地图标题行：CP 做成可点亮的圆点组，其余四枚胶囊（**`commandPoints` 目前从不显示**） |
| D5 | **部队环形编制图** | `morale` + `composition` / `designedComposition` | 外环士气 + 内圈三兵种 donut，替掉 `ProvinceMap:1006-1029` 的细条 |
| D6 | **身份徽记** | 9 种 `ArmyIdentity` | 用不同 NATO 符号替代统一的斜十字 |
| D7 | **移动预览** | `deployToWidth` / `getDefenseCoefficient` | 悬停邻省画箭头 + 预计战力比与伤亡区间 |
| D8 | **省份名与岛屿 inset** | `INSET_CONFIG`（`ProvinceMap:177-202` 已写好却**被注释掉**） | 恢复加那利/马德拉/亚速尔小图（否则当地驻军标记会被裁掉）；省名补标签 |
| D9 | **战局时间轴** | `mapHistory` 结构化 | 地图底部按月画各方省份占比曲线 |
| D10 | **工具提示跟随鼠标** | — | 现在钉死在 `top-4 right-4`（`ProvinceMap:1463`），改为跟随并加驻军信息 |

---

## 7. E 类｜外壳与元界面

| # | 名称 | 数据 | 形态 |
|---|---|---|---|
| E1 | **常驻电台调谐条** | `MusicProvider` 的 `currentTrack/progress/isPlaying/volume` | 页签栏右侧一条琥珀刻度条 + 跑马灯曲名，播放时指针沿刻度走；点击展开收音机。现在电台埋在"设置 → 秘密电台"两层之下，只靠一个红点暗示 |
| E2 | **续接档案卡** | `readSaveLibrary().autosave.summary` + `savedAt` | 开始界面的"读取档案"从禁用灰按钮变成一张**火漆封印的档案卡**："1937.03 · 困难 · 行动阶段" |
| E3 | **成就三视图** | `unlockedAchievementsThisRun` + 两个 localStorage 集合 | 全部 / 本局 / 历史金星 三个页签 + "最新解锁"横排；**给 5 条 emoji 成就（✈️🗳️⚔️🪙🧭）补画与另外 17 张同风格的图标** |
| E4 | **存档胶片** | `record.snapshot`（含全量状态，可读出资源/支持率） | 每个槽位一条 48px 派系色条；删档从原生 `confirm` 换成印刷确认条 |
| E5 | **事件板分类与空态** | `pendingEvents` | 复用 `MainArea:17-21` 的卡族边色（行动=红 / 政府=紫 / 军事=黑）与序号；空态盖"本月无事"印章 |
| E6 | **终局指标表** | `stats` 七项 | 报纸数据版：Anton 大数字 + 横条，与两张饼并列 |
| E7 | **键盘操作** | — | `1-5` 切换顶栏页签、`Space` 抽牌、`Enter` 结算、`Esc` 关闭弹窗 |

---

## 8. F 类｜零成本精致：把已有素材和死代码变现

这一类不需要新设计，只需要"接线"，是投入产出比最高的部分。

**可以立刻用起来的闲置美术资源**（已 grep 确认 `src/` 零引用）：

- `public/img/Faction/` **五张派系徽章全部闲置**（Faistas / Treintistas / Cenetistas / Puristas / Jabalistas）——而 SidePanel 正用纯色条画这五个派系。这是最现成的一套素材。
- `public/img/Advisors/`：`Albert_Camus.png`、`Nestor_Makhno.png`、`Simone_Weil.png`、`Camillo_Berneri.png` 有图无定义（`src/game/advisors/` 下没有对应人物）。
- `public/img/Organization/JAP_Emblem.png`、`public/img/Party/PRC.png`、`public/img/República Española.png` 均未引用。
- `public/music/` 里 `Republicana-Jarama Valley.mp3`、`Nacional-Oriamendi.mp3` **两首曲子没有进 `PLAYLISTS`**（`MusicPlayer.tsx:15-26`）。

**必须清理的死样式**：

- 删或补：`hide-scrollbar`、`custom-scrollbar`、`bg-paper-light`、`animate-in fade-in`（5 处）、`animate-fade-in`。
  其中 `animate-in fade-in` 的失效意味着**三个大弹窗目前根本没有入场动画**。**【已决：暂不修复，保持现状】**
- **已决事项**：`index.css:70-125` 的电台材质（木纹/玻璃/黄铜/电子管辉光）**保持现状**，只在原地加一段废弃注释说明（不实现、不删除）；`.bg-contested-stripes` **直接删除**——地图从精灵图 PNG 升级为 geojson 后地块足够细，"争夺省份"概念已不需要。
- 潜在 404：`DomesticPoliticsModal.tsx:517` 写的是小写 `ramon_franco.png`，实际文件是 `Ramon_Franco.png`（大小写敏感主机上会挂）；`organizations.ts:87` 照抄了缺一个点的文件名 `FIJL_Emblempng.png`。
- **音频缺口**（复核后更正）：`MusicPlayer` 曲目表虽写绝对路径 `/music/...`，但 `MusicPlayer.tsx:70-72` 在赋给 `audio.src` 前补了 `BASE_URL`，**播放链路是通的**。真正缺的是 `SuperEvent.tsx:80` 指向的 `music/SuperEvent/${superEvent}.mp3`——**该目录不存在**，三个超级事件（`spanish_civil_war` / `spanish_civil_war_ends` / `abdication_alfonso`）全部静默无配乐，且无兜底提示。
- **曲库有料未用**：`public/music/` 共 8 首，`PLAYLISTS`（`MusicPlayer.tsx:15-26`）只收了 6 首，`Republicana-Jarama Valley.mp3`（7.0 MB）与 `Nacional-Oriamendi.mp3`（2.5 MB）全项目零引用，却仍被打进 `dist/`，白占约 9.5 MB 包体——要么收进对应歌单，要么移出构建。

---

## 9. G 类｜"精致"的前提：一致性与基础体验

**G1. 抽五个印刷原语组件，让"精致"可复制。**
现在同一个橡皮章在全项目手写了三遍，同一套账本纸只服务一个弹窗。建议抽出：

| 原语 | 作用 | 现状替代 |
|---|---|---|
| `<PaperPanel accent>` | 统一纸面板（3px 墨框 + 硬投影 + 纸纹 + 压印标题），accent 取 ink/red/purple/yellow | 四套方言并存 |
| `<Stamp variant>` | 橡皮章（旋转、双层边、`mix-blend-multiply`、撕边/虚线变体） | `EndingScreen:133`、`LawStanceModal:190`、`StartScreen:278` 各写一遍 |
| `<GazetteHead>` | 报头（双线花边 + 刊名 + 期号 + 日期） | 仅 `LawStanceModal:210-233` |
| `<IndexCard>` | 档案卡式 tooltip：portal + 自动上下翻转 | 十余处 `title=` 与两类手写浮层，且有裁切 bug |
| `<Ticker>` | 电传跑马灯（打字机字体、逐字、可点定位） | 无 |

**G2. 弹窗基础体验修复**
`role="dialog"` + `aria-modal` + 焦点陷阱 + `autoFocus` + Escape 关闭（全库目前只有 `SaveManagerModal` 做到）；`SandboxMenu` 的关闭按钮要 sticky（现在往下滚就消失）；`EconomyModal` 的双滚动条（`:369` 与 `:764`）合并或重置滚动位置；`DomesticPolicyModal` 在 <768px 下底部被裁且不可滚（`:53` + `:80`）。

**G3. 触屏与低视力**
hover-only 的难度说明（`StartScreen:302-306`）、经济图表提示、政党浮层改为可点击；给状态条补 `role="progressbar"`；折叠区补 `aria-expanded`（`SidePanel:1157`）。

**G4. 动画健壮性**
`App.tsx:27-29` 的开始界面↔游戏壳是硬切，无转场；同时请给所有 `AnimatePresence mode="wait"` 加"动画未完成也能挂载"的兜底（或用 `initial={false}` / `onAnimationComplete` 超时），以消除 §2 缺口 D 里实测到的后台标签页死锁。同时把 `prefers-reduced-motion` 从 `StartScreen.css` 推广到全部 Motion 动画。

**G5. 音效层（UI 精致度的一半）**
目前只有 BGM。建议最小集：盖章、打字机回车、翻纸、抽牌、收音机静电、AP 打孔。全部可用短采样，与"印刷品"语言同源。

**G6. 性能**
`SidePanel` 一次性渲染 13 个区块、51 键等值比较、且在 render 内对 16 党 × 6 阶层重复计算（`:56-81`、`:1121`）。加可视区懒渲染与 memo 化，能让"粘性导航 + 更多仪表"这类增强不至于拖慢帧率。

---

## 10. 优先级与实施批次

| 批次 | 内容 | 理由 | 依赖 |
|---|---|---|---|
| **批 A（接线即可）** | F 类全部（闲置素材、死样式、音频路径、文件名大小写）、E5 事件板、C8 打字机可控、C9 超级事件兜底 | 零新设计、零玩法风险，立刻提升"完成度" | 无 |
| **批 B（新仪表）** | A1 阴谋阶梯、A2 群众动员条、A3 战报电传机、A4 大事记、B2 sparkline、B3 议会半圆、B5 关系矩阵、A12 冷却读数 | 数据现成，直接改变玩家的决策质量 | 需要给 `CardViewModel` 补 timer 字段 |
| **批 C（原语与统一）** | G1 五个原语 → 用它们重做 4 个弹窗的视觉；G2 弹窗体验；G4 动画兜底；G5 音效 | 让后续所有新增 UI 自动"精致" | 建议在批 B 之后，避免返工 |
| **批 D（仪式感）** | C1 结算账单、C2 月度号外、C3 打孔券与封印章、C4 扇形手牌、C6 日历翻页、C7 结局印章 | 提升"有趣"的上限，需要新动画与音效配合 | 批 C 的原语 |
| **批 E（地图）** | D1-D10 | 地图层独立演进，可并行 | `mapHistory` 结构化 |
| **批 F（长尾）** | A5-A11、B1、B4、B6-B12、E1-E4、E6、E7 | 逐条补齐 | 视精力 |

---

## 11. 设计原则（十条，供后续新增 UI 时自查）

1. 新组件先问：**它属于哪张纸？**（账本 / 公报 / 档案卡 / 号外 / 票券）——不要引入第五种材质。
2. 只用现有五个颜色语义：纸、墨、CNT 红、共和紫、共和黄。**同色不同义是当前最大的视觉债务**（"紧张"与"革命热情"同为红、分歧条恒红而颜色函数返回绿黄橙）。
3. 数字必须有**参照系**：趋势、上限、上月残影、多数线——孤立的百分比不构成信息。
4. 任何**不可逆**操作都要有仪式：盖章、撕边、变色，而不是弹窗。
5. **结算必须可见**：改了什么，就打印什么。
6. 动效服务于叙事：翻页=时间推进，翻面=抽牌，落章=决定生效。
7. 悬停信息一律用 `<IndexCard>`，且必须键盘/触屏可达。
8. 空态要写成文案，不要留白（`EndingScreen:250-281` 的"无名战士"虚线是全项目的正确示范）。
9. 素材路径统一走 `BASE_URL`；文件名大小写与拼写要在 CI 里校验。
10. 每个新面板上线前自问：**它有没有让某个原本看不见的系统变得可以规划？** 如果没有，它大概只是装饰。

---

*本提案为纯设计文档，未对任何源码做改动。文中引用的行号对应调研时的代码状态。*
