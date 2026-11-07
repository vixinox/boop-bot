# 阶段1：舞台与基础互动开发规格

## 状态与启动说明

- 状态：Verified（任务01–05已完成开发时验证）
- 目标：交付全视口桌面机器人舞台、可拖拽与复原的相机、核心状态转换、快捷互动、持续显示的回复气泡和基础表情权重调节。
- 范围：只覆盖路线图阶段1。阶段2的空间交互和阶段3的 Inspector、本地规则驱动不在本次交付内。
- 后续边界：本文的阶段1非目标描述是历史交付范围；当前阶段2范围以[阶段2开发规格](../stage-2/stage-2-development-spec.md)为准。
- 阅读顺序：先读本文和[项目风格](../../design-system.md)，再按依赖执行任务01–04基线及[任务05](./stage-1-task-05-viewport-camera-and-design-system.md)。
- 基线：以当前工作区源码为准；本规格未检查或推断暂存/未暂存改动的意图。

## 问题与用户模型

这是一个桌面浏览器中的纯前端原型。用户通过明确的快捷操作观察桌面伴侣的情绪、动作和回复；开发者可独立调节现有模型表情权重。应用不需要后端或外部凭据。

## 启动基线（实施前核实）

- 任务01–04的舞台、状态、控件和桌面/窄屏应用组合已交付；新增任务05将扩展布局与相机交互，并统一 UI 组件规范。
- `public/RobotExpressive.glb` 是现有角色资产，含 `Idle`、`Yes`、`ThumbsUp` 等 14 段动画，以及 `Angry`、`Surprised`、`Sad` 三个表情 morph target。
- 项目已安装 React、R3F、Drei、Three.js、Zustand、GSAP、Tailwind、Oxlint 和 Oxfmt；当前没有测试框架。
- `docs/roadmap.md` 将自然语言输入/本地规则驱动排在阶段3，将空间触摸交互排在阶段2。本文是阶段1的详细执行规格，阶段边界以本文和路线图同步后的文字为准。

## 已交付实现

- `src/state/companionStore.ts` 导出 `useCompanionStore` 与共享类型；回复可由 UI 通过 `interact(interaction, reply?)` 原子写入，不传时使用默认文案。
- `src/stage/CompanionStage.tsx` 导出 `CompanionStage`：包括模型世界矩阵更新后的精确尺寸归一化、自适应相机、程序化底座、动作淡入/重复重播、独立表情权重和四态氛围灯。
- `src/ui/CompanionControls.tsx` 导出 `CompanionControls`；当前 `src/App.tsx` 和 `src/styles.css` 组合桌面侧栏及窄屏上下布局，该窄屏布局由任务05改为右侧 Sheet。
- 任务05已将 UI 迁移至 shadcn 风格组件、以 shadcn token 为颜色来源，并将舞台扩展为 header 下全视口布局。
- 实施修正：身体动画的 morph 权重轨道与手动表情控制分离，避免动画混合器覆盖滑块目标；错误边界提供舞台重试。

## 已确认决策与推荐默认

### 已确认

- 使用 Vite + React + TypeScript、R3F/Drei、Three.js 动画能力及 Zustand；不增加状态机库、不引入后端、不增加外部角色/底座模型。
- 用 Three.js 基础几何体搭建简洁桌面底座。
- 核心情绪为 `IDLE`、`HAPPY`、`SHY`、`SLEEPY`。`HAPPY` 与 `SHY` 各自在进入后 3 秒自动回到 `IDLE`；任何新指令取消先前回退并按新状态重新计时。`SLEEPY` 锁定，直至显式唤醒。
- 快捷互动映射：摸头触发开心反馈；夸奖触发开心和 `ThumbsUp`；模拟摇晃触发害羞和身体晃动。
- 阶段1提供显式休眠/唤醒双态控件。休眠时其他快捷互动不生效。
- 回复气泡由快捷互动产生，保留到下一条互动回复并被替换；不实现文本输入或本地规则意图识别。
- 阶段1提供 `Angry`、`Surprised`、`Sad` 三个 0–1 独立表情权重控件。它们不自动映射到核心情绪。
- 阶段1不实现头部视线跟随、头顶/腹部空间触摸区、悬停提示、腮红、完整 Inspector、遥测或分类日志。

### 推荐默认（本规格采用，变更需更新本文）

- `IDLE` 播放 GLB `Idle`；夸奖播放 `ThumbsUp`；摸头开心反馈播放 `Yes`；模拟摇晃由程序化身体偏转表达，不借用语义不符的动画；`SHY` 使用轻微程序化姿态；`SLEEPY` 使用轻微低头姿态。
- 动画动作交叉淡入使用 250ms；表情权重以平滑插值到目标值。
- 固定中文快捷回复由 UI 层按互动类型提供；新互动原子地更新回复、状态和动作。
- 使用 Vitest 和假时钟测试状态生命周期；这是引入的唯一测试依赖建议，实施时加入相应依赖与脚本。
- 主界面保留顶部 header，其余可用视口由舞台和右侧控制栏填满；桌面控制栏固定贴右。`md` 以下控制栏改为右侧 Sheet，舞台优先占据可用空间。
- UI 采用 shadcn 组件和 `src/styles.css` 的语义 token，配色简约黑、白、蓝；布局使用 Tailwind utility，不增加页面级自定义选择器。界面动效轻快克制并尊重 reduced-motion。
- 舞台相机可绕水平方向连续旋转而不设方位角边界，俯仰角受安全范围限制；开放滚轮缩放并关闭平移。左上圆形复原按钮回到当前舞台尺寸适配后的默认构图。Resize 尽可能保留当前旋转方位并更新复原基准。
- 相机水平旋转由 OrbitControls 处理并启用阻尼；透视距离缩放由 GSAP 驱动约 0.2 秒的 `power2.out` 缓动，距离限制为 1.6–12。桌面滚轮和移动端双指捏合使用相同的缩放路径，单指拖动旋转且不平移。
- 复原按钮使用 GSAP `power2.out` 在 0.8 秒内回到当前舞台比例适配后的默认构图。新的拖动、滚轮或捏合输入会取消活动的相机 tween，再交还用户控制。

## 状态、数据所有权与接口

状态由 Zustand 单一 store 持有；舞台只消费状态并渲染，UI 只发起动作与展示反馈。建议接口位于 `src/state/companionStore.ts`：

```ts
type Emotion = 'IDLE' | 'HAPPY' | 'SHY' | 'SLEEPY'
type Interaction = 'headPat' | 'praise' | 'shake'
type ExpressionName = 'Angry' | 'Surprised' | 'Sad'
type ExpressionWeights = Record<ExpressionName, number>
type CompanionAction = 'Idle' | 'Yes' | 'ThumbsUp' | 'Shake' | 'Shy' | 'Sleepy'

interface CompanionState {
  emotion: Emotion
  action: CompanionAction
  bubble: string | null
  expressionWeights: ExpressionWeights
  interact: (interaction: Interaction, reply?: string) => void
  sleep: () => void
  wake: () => void
  setExpressionWeight: (name: ExpressionName, value: number) => void
}
```

实际实现可将衍生字段或内部定时器安排成更合适的 Zustand 写法，但上述消费接口和行为保持稳定。权重必须限制到 `[0, 1]`。互动回复由 UI 传入 `reply`，不传时 store 提供默认回复。状态模块负责清理/替换自动回退计时器，组件卸载或开发热更新不得留下过期回调。

## 行为与生命周期

- 初始情绪/动作是 `IDLE`/`Idle`；气泡初始为空；三个权重初始为 `0`。
- `headPat`：设置 `HAPPY`、`Yes` 及固定摸头回复；3 秒后回 `IDLE`/`Idle`，但仅当期间没有新指令。
- `praise`：设置 `HAPPY`、`ThumbsUp` 及固定夸奖回复；同样 3 秒回待机。
- `shake`：设置 `SHY`、`Shake` 及固定摇晃回复；渲染程序化身体晃动，3 秒回待机。
- `sleep`：设置 `SLEEPY`/`Sleepy`，清除自动回退计时器并保持锁定；既有气泡保留。
- `wake`：设置 `IDLE`/`Idle` 并解除锁定；既有气泡保留。
- 休眠期间 `interact` 无副作用（不改情绪、动作、气泡或计时器）。权重滑块仍可用，因为表情权重是独立调试能力。
- `setExpressionWeight` 更新所选权重；舞台在目标值变化时平滑插值，不影响情绪、动作、气泡或回退时钟。
- Three.js 动画映射必须对资产中缺失的程序化动作采用程序化姿态，不得请求不存在的 clip。

## 非目标与兼容性

- 不实现自然语言文本输入、本地规则/NLP、LLM/API Key、触摸传感器、视线追踪、情绪表情映射、腮红或阶段3 Inspector/遥测/日志。
- 保持单页应用，无需路由；不新增外部资产。
- 三维动画和姿态归 R3F/Three.js 管理；GSAP 如用于 UI 动效须限定在 DOM/UI 范围，避免同时驱动同一对象。

## 实施里程碑与任务依赖

1. `stage-1-task-01-state.md`：定义并验证 store 契约；先完成。
2. `stage-1-task-02-stage.md` 与 `stage-1-task-03-ui.md`：在任务01接口冻结后可并行，分别实现舞台与独立 UI 控件。
3. `stage-1-task-04-integration.md`：集成舞台/UI、替换应用壳并完成端到端检查；依赖任务01–03。
4. `stage-1-task-05-viewport-camera-and-design-system.md`：将应用扩展为全视口布局，加入相机拖拽/复原、窄屏 Sheet 和 shadcn UI 风格；以前四项已交付接口为基线。

每个任务负责人只修改其任务包列出的所有权目录；跨边界接口变更需先更新本文，并协调受影响任务后再改代码。

## 验收与验证

- 自动检查通过：`pnpm typecheck`、`pnpm build`、`pnpm lint`、`pnpm format:check`，以及阶段1状态生命周期测试。
- 状态测试覆盖初始值、HAPPY/SHY 3 秒回退、重复指令重置回退、sleep 清除回退、休眠锁定、wake 解锁、气泡保留/替换及权重边界。
- 集成验收确认 GLB 和程序化底座可见、动作切换平滑、三个快捷动作反馈正确、休眠/唤醒正确、气泡生命周期正确、三个滑块独立改变对应表情且不改变情绪。
- 任务05验收确认舞台/侧栏填满可用视口、窄屏 Sheet 可访问、相机水平连续旋转、俯仰受限、单指旋转、双指捏合缩放、桌面滚轮缩放在 1.6–12 范围内平滑生效、平移关闭；复原以 GSAP `power2.out` 返回当前尺寸构图且可被新相机输入打断。原有业务交互无回归，并符合[项目风格](../../design-system.md)。
- 手动浏览器验收在阶段1实现完成后执行；它不替代上述自动检查。

### 已执行结果

- 自动检查全部通过：12项状态测试、TypeScript、Oxlint、Oxfmt和生产构建。
- 浏览器确认角色与底座完整显示、快捷互动反馈、限时回退和气泡保留、休眠锁定/唤醒、三个独立表情变化与键盘操作；桌面和390px窄屏布局检查无横向溢出。
- 非阻塞提示：Three.js/R3F依赖的 `THREE.Clock` 弃用警告及约1.24MB（gzip约340kB）主包体积提示。阶段1不以依赖升级或包体优化为交付前置。
- 用户可在 `pnpm dev` 后按任务04体验清单复验；该体验验收属于实现后交接，不阻塞已完成的开发时验证。

## 未决项

- 无阻塞决策。推荐默认若因资产运行时事实必须改变，先记录代码证据并更新本规格和受影响任务包，再实施。
