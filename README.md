# History Simulator Engine

用于制作月度回合政治、社会与战争模拟游戏的通用引擎和可视化编辑器。世界、政治主体、群体、组织、制度、事件、地图与结局由项目数据定义，引擎不依赖特定年代、国家或政治组织。

版本：0.1.0。公开仓库：[History-Simulator-Engine](https://github.com/WJNCT55555/History-Simulator-Engine)。

## 启动

需要 Node.js 20.19+ 和 npm。

```sh
npm ci
npm run dev
```

- 编辑器：`http://127.0.0.1:3000/editor/`
- 游戏播放器：`http://127.0.0.1:3000/`
- Windows 可双击 `start_editor.bat` 或 `start_game.bat`，首次自动安装依赖。

编辑器支持新建游戏、编辑全部定义、保存和打开磁盘项目、导入导出 JSON、事件链图、地图通路、GeoJSON、内嵌图片/音频、引用校验、真实试玩及独立游戏导出。独立 HTML 包含引擎、界面、项目与素材，可离线打开。

游戏界面沿用原游戏的排布：顶部日期和资源栏、左侧可折叠状态栏、中央事件与卡牌桌、底部顾问席位、右侧目标日志抽屉。财政、政治、法律与法律立场通过顶部标签打开弹窗；地图替换中央事务桌。编辑器试玩、网页播放器与独立导出共用这套界面，显示内容由项目定义。

## 通用机制

| 领域 | 规则 |
| --- | --- |
| 社会与组织 | 任意数量主体/群体、加权支持、份额转移、组织覆盖/收入、派系影响与异议 |
| 政治与制度 | 参与率、最大余数议席分配、联盟、多数政府、职位权限、法律等级及月效果 |
| 财政与经济 | 税基/征收效率、现金/债务/拖欠、储备、增长/通胀/失业/产出 |
| 内容与进程 | 牌库/AP/冷却、顾问、条件/日期事件链、目标、成就、优先级结局 |
| 地图与战争 | 自定义阵营/邻接、来源后备/装备、招募补充拆并、战斗/撤退、AI |
| 制作与交付 | 条件/数值表达式、周期规则、变量、素材、版本绑定存档、独立打包 |

`projects/demo/game.json` 是完整的中性机制演示，包含和平改革与军事冲突路径；`projects/starter/game.json` 是最小起点，均可导入编辑器。默认界面为中文，游戏名称、正文及显示名由作者填写。

## 必要目录

```text
src/engine/     纯 TypeScript 规则、状态、命令、校验、存档、打包
src/runtime/    通用界面与独立播放器
src/projects/   项目工厂与机制演示
editor/         可视化制作工具与本地保存服务
projects/       可分发项目 JSON；local/ 为未提交的用户作品
docs/           理论、架构、数据模型、制作指南
scripts/        构建和命令行导出
tests/          规则边界与正常路线回归
```

`node_modules/`、`generated/`、`dist/`、`output/` 为可再生成产物，不提交。旧题材源码、素材和专用工具已移出当前源码。

## 验证与发布

```sh
npm run verify
npm run export -- projects/demo/game.json output/commonwealth-demo/index.html
```

`verify` 执行严格类型检查、核心回归、编辑器和播放器生产构建。`dist/` 可整体部署到静态服务器；本地磁盘保存 API 仅在开发服务器提供。静态编辑器仍可使用浏览器项目库和文件导入导出。

引擎可独立调用 `createState(project)`、`execute(project,state,command)`、`saveGame`、`loadGame`。规则不导入界面或具体游戏数据。

当前制作范围为这套月度政治社会模拟玩法。条件、公式和周期规则可组合新内容；全新模拟系统、自定义 UI 布局或新的兵种槽位需要扩展源码。地图 AI 根据相邻敌对地区的战略与工业价值决策。结构校验不证明所有剧情可达，作者仍需试玩关键路线。

详见 [制作指南](docs/EDITOR_GUIDE.md)、[机制与理论](docs/MECHANISMS.md)、[架构](docs/ARCHITECTURE.md)、[项目格式](docs/PROJECT_MODEL.md)。MIT 许可；独立播放器包含依赖许可证，见 [第三方说明](THIRD_PARTY_NOTICES.md)。
