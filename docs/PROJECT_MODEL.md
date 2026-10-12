# 项目格式 v1

权威类型为 `src/engine/model.ts`，`validateProject` 验证数据与引用。项目只有 JSON，不包含回调或可执行脚本；条件与表达式被解释执行。

根对象要求 `schemaVersion:1`、`id`、`version`、`name`、`description`、`start`、玩家主体/阵营、`seed`、`accent`、`initial`、`rules`。可选背景与音乐引用内嵌素材。

集合包含主体、群体、派系、组织、所有权、职位、法律、变量、卡牌、事件、顾问、目标、结局、成就、阵营、来源、地区、部队、周期规则、经济冲击与素材。不使用的集合填空列表；示例 JSON 给出完整字段。

普通条目有稳定 `id`、显示 `name` 和可选说明/素材。集合内 ID 唯一；实体以 ID 引用；人数/装备为非负整数；各分布守恒；邻接必须双向。

## 条件与表达式

表达式为常数、指标或运算：

```json
{"op":"mul","args":[{"metric":"coverage.association"},0.05]}
```

条件支持嵌套：

```json
{"all":[
  {"metric":"turn","op":"gte","value":12},
  {"metric":"variable.reform","op":"gte","value":60},
  {"not":{"metric":"warActive","op":"eq","value":1}}
]}
```

比较为 `gte/lte/gt/lt/eq/neq`，运算为 `add/sub/mul/div/min/max`，最多嵌套 16 层。除零会拒绝交易。空 all 为真，空 any 为假；省略条件为真。完整指标目录由 `metricNames(project)` 生成，包含经济、支持、议席、关系、派系、覆盖、所有权、职位/法律、变量、来源/军事/控制/建筑和目标成就。

## 选项与效果

```json
{
  "id":"expand",
  "name":"建设地方组织",
  "cost":{"resources":2},
  "effects":[
    {"type":"support","groupId":"farmers","actorId":"movement","delta":5},
    {"type":"variable","variableId":"reform","mode":"add","value":3}
  ],
  "nextEventId":"next_step"
}
```

费用支持 AP、组织资源、军备且非负。delta/value 支持表达式；份额使用统一转移函数，后备资产要求整数，变量受作者设定边界约束。

事件调度为 automatic/chain；链内节点可被 nextEventId 或 event 效果引用，date 为精确年月，间隔按月回合。运行决策引用包含 kind，避免跨集合同 ID 混淆。

rules 配置 AP/手牌/顾问、议会与选举、联盟、指挥/移动、招募/建设、战斗宽度/消灭阈值、三个兵种显示名、财政参数。财政覆盖只能使用 ECONOMIC_RULES 的已知键。

monthlyRules 的 stage 为 environment/society，省略视为 society；timing 为 monthly/annual。economicShocks 按年提供增长、通胀、失业和储备流量冲击。

运行状态变化不会改项目定义。存档绑定项目 ID、版本和指纹，发布定义更新应调内容版本并重新开局。格式扩展和迁移须显式管理兼容性。
