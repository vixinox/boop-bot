# 实施文档索引

## Tool 开发约束

- 新增或修改模型工具前，必须遵循 [Tool Contract 开发规范](./tool-contract-development-spec.md)，并在同一变更中补齐描述、严格 schema、运行时校验、执行逻辑、结构化错误及契约测试。
- 必跑门禁：`pnpm test`、`pnpm typecheck`、`pnpm lint`、`pnpm format:check`、`pnpm build`。

## 阶段1：舞台与基础互动

- 共享决策与接口：[开发规格](./stage-1/stage-1-development-spec.md)。任务01–05已实现并完成开发时验证，阶段1状态为 Verified。
- 应用入口：`src/App.tsx`；本地运行：`pnpm dev`。
- 原始依赖顺序：任务01 → 任务02与任务03并行 → 任务04集成 → 任务05全屏与视角扩展。任务01–04保留为已完成基线，任务05为本次新增扩展。

| 任务                                                                                  | 状态   | 代码所有权                        | 输出                                                     |
| ------------------------------------------------------------------------------------- | ------ | --------------------------------- | -------------------------------------------------------- |
| [01 核心状态](./stage-1/stage-1-task-01-state.md)                                     | 已完成 | `src/state/**`                    | `useCompanionStore`、共享类型、12项假时钟测试            |
| [02 三维舞台](./stage-1/stage-1-task-02-stage.md)                                     | 已完成 | `src/stage/**`                    | `CompanionStage`、角色/底座、动作/表情/氛围灯            |
| [03 互动控件](./stage-1/stage-1-task-03-ui.md)                                        | 已完成 | `src/ui/**`                       | `CompanionControls`、快捷操作、气泡、表情滑块            |
| [04 应用集成](./stage-1/stage-1-task-04-integration.md)                               | 已完成 | `src/App.tsx`、`src/styles.css`   | 桌面/窄屏布局、组合入口、集成验收                        |
| [05 全屏、视角与风格](./stage-1/stage-1-task-05-viewport-camera-and-design-system.md) | 已实现 | 应用壳、舞台相机、shadcn UI、文档 | 全视口舞台、无限水平旋转/缩放/复原、窄屏 Sheet、项目风格 |

## 阶段2：动画选择与伴侣控制台

- 历史规格：[阶段2开发规格](./stage-2/stage-2-development-spec.md)。其中 Auto 导演和指针注意力是历史实现，已由阶段3重构移除；这些任务只记录当时的实现边界。
- [01 统一状态与动画姿态运行时](./stage-2/stage-2-task-01-runtime.md)：历史记录，曾管理 Auto/clip 来源、skin joint 目录和 transport。
- [02 低频 Auto 导演与注意力输入](./stage-2/stage-2-task-02-auto-director.md)：历史记录；当前无 Auto 导演和指针注意力。
- [03 常驻动画与骨骼控制台](./stage-2/stage-2-task-03-manual-inspector.md)：其中动画/骨骼/morph 调试能力仍存在；Auto 选择器已被当前 Inspector 取代。
- [04 应用集成与旧功能退役](./stage-2/stage-2-task-04-integration.md)：历史界面集成记录；当前聊天、场景工具和相机能力已由阶段3重新加入。
- 旧阶段2测试题规格与任务包已由新规格取代。阶段1实施文档只记录历史交付事实。

## 阶段3：AI 动画时间线与场景创作

- 共享契约：[Stage 3 开发规格](./stage-3/stage-3-development-spec.md)，核心实现与自动验证已完成；真实 API 和复杂视觉验收留待人工执行。新规格取代旧的任意关节编排和“阶段3未定”描述。
- 重构规格：[Presentation Feedback and Explicit Playback Ownership](./stage-3/stage-3-refactor-development-spec.md)。该规格已实现并验证；关于时间线结束保持姿势、移除指针凝视的要求由阶段4行为规格取代。
- [01 动画与场景工具协议](./stage-3/stage-3-task-01-persona-and-tool-protocol.md)：有限动画时间线、场景 CRUD、灯光与现有相机 schema/校验，已实现。
- [02 有限动画时间线](./stage-3/stage-3-task-02-choreography-runtime.md)：有限片段播放、表情过渡和手动接管，已实现；Auto 恢复和头部跟随段落为历史约束，已被阶段3重构和阶段4实现取代。
- [03 场景状态、渲染与相机](./stage-3/stage-3-task-03-scene-runtime.md)：程序化基础几何体、灯光、现有相机位姿及用户接管，已实现。
- [04 聊天集成与验证](./stage-3/stage-3-task-04-integration-and-verification.md)：工具执行、每轮刷新场景上下文、协议兼容和自动验证，已实现。

## 阶段4：反应式伴侣行为（Verified）

- [阶段4开发规格](./stage-4/stage-4-development-spec.md)：原阶段及追加开发均已实现并通过自动验证。普通聊天采用轻量阶段反馈；本地中文规则映射中性/开心/安慰/困倦；输入栏含摸头、夸奖和睡眠/唤醒快捷按钮；LLM 可调用七种白名单语义动作。仅用现有 GLB 与程序化姿态。复杂视觉和窄屏手势仍留待人工验收。
- [任务01：行为运行时与生命周期](./stage-4/stage-4-task-01-behavior-runtime.md)：已实现 phases、优先级、稳定 reaction ID、手动接管、页面暂停与回退定时器。
- [任务02：对话表演](./stage-4/stage-4-task-02-conversation-performance.md)：已实现聊天阶段事件接线、模型行为指导和有限动画语义。
- [任务03：注意力与直接互动](./stage-4/stage-4-task-03-attention-interaction.md)：已实现镜头跟随、头/躯干/手部点按和拖拽/触摸区分类；真实模型观感留待人工验收。
- [任务04：待机、表情与资源盘点](./stage-4/stage-4-task-04-idle-expression-assets.md)：已审计 GLB 并实现 auto/manual 动画分流和临时动作恢复；复用连续 Idle，不增加随机动作。
- [任务05：集成、诊断与验收](./stage-4/stage-4-task-05-integration-verification.md)：诊断事件/UI 已实现；当前收尾文档同步和最终检查。

## 验证记录

- 阶段1开发时检查：`pnpm test`（12项）、`pnpm typecheck`、`pnpm lint`、`pnpm format:check`、`pnpm build`。
- 阶段1开发时浏览器记录：GLB与底座显示、相机取景、快捷互动、三秒回退、气泡、休眠/唤醒、表情权重及窄屏布局。该记录不代表阶段2人工验收。
- 旧阶段2（测试题闭环）自动检查历史记录：25项测试、typecheck、lint、format:check 和 build 曾通过；该结果不覆盖当前重构。
- 本次阶段2修订：`pnpm test`（35项）、typecheck、lint、format:check 和 build 通过；构建有非阻塞主包体积提示。
- 新阶段2桌面/移动端复杂视觉和 Auto 灵动感验收留待人工执行，不代表自动检查失败。
- 任务04对窄屏上下堆叠的验收要求已由任务05的窄屏 Sheet 交互取代；其余任务04业务集成验收继续有效。
- 任务05：`pnpm test`（12项）、typecheck、lint、format:check、build通过；桌面及390px视口确认舞台全宽高填充、窄屏抽屉开关、拖拽与复原工作正常。干净浏览器会话无应用运行时错误；构建有主包超过500kB提示。
- 相机交互追加：文档要求已扩展为水平无限旋转、俯仰安全限制、滚轮缩放和关闭平移；此追加后的完整相机交互仍需按任务05清单复验。源码现有 OrbitControls 阻尼用于视角位移缓动，不额外叠加 GSAP 相机 tween。
- 阶段3实现：`pnpm test`（69项，18个文件）、`pnpm typecheck`、`pnpm lint` 和 `pnpm build` 通过；构建有单一 JS bundle 超过 500 kB 的非阻塞提示。`pnpm format:check` 仍被 7 个既有文件阻塞：`.vscode/settings.json` 和 `src/components/ui/{checkbox,input,select,slider,switch,tabs}.tsx`；本次阶段3文件未出现在格式错误列表中。真实 API、桌面/窄屏复杂交互验收及展示视频录制留待人工完成。
- shadcn CLI 下载 Base Nova Button 时 registry 连接被对端关闭，因此沿用项目已安装的 Base UI 和 Tailwind 实现本地 shadcn 风格 Button、Sheet、Slider、Card，不新增依赖。

## 后续协作约定

- 新任务先读取开发规格和实际源码；本目录任务包保留原始责任边界与验收标准，不代表未来的所有权永久锁定。
- 涉及共享状态契约或阶段边界的变更，先同步开发规格与受影响任务包；不要通过不同任务重复添加业务状态。
- 阶段3核心实现与自动验证已完成；真实 API 和复杂视觉验收留待人工执行。展示视频录制属于后续发布准备，不是阶段4行为系统的实现门槛。
