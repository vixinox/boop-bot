# 阶段2：动画选择与伴侣控制台规格

> 历史规格：本文记录阶段2交付时的 Auto 导演和指针注意力设计。阶段3重构已移除这些运行时行为；当前实现以阶段3重构规格为准，后续目标见[阶段4规格](../stage-4/stage-4-development-spec.md)。

## 状态与目标

- 状态：自动化验证通过；复杂视觉与真实手势由人工验收。
- 目标：围绕唯一模型 `public/RobotExpressive.glb` 提供低频自然的 Auto 行为，以及常驻、覆盖动画/骨骼/morph 的调试控制台。
- 新规格取代本目录此前的 Auto/Manual 双模式方案及其验收标准。阶段1文档保留为历史交付记录。
- 当前工作目录没有 Git 元数据，无法审阅 Git diff。

## 产品行为

- 应用只有一个工作界面，没有全局 Auto/Manual 模式。控制台桌面常驻于右侧 420px 面板；窄屏保留舞台右上角面板按钮与 Sheet，仅按钮样式为圆形。
- `Available clips` 包含 `Auto` 和资源内实际解析出的全部14段 clip（含 Death）。新会话默认选中 `Auto`；选中具体 clip 即停止导演，从头播放 clip 并启用 transport；再次选中 Auto 会回到 Idle 并重启导演。
- Auto 以循环 Idle 为默认姿态。每次安静间隔随机为12–24秒后，只有45%概率安排一个短事件；存在拖动态度输入时，间隔为5–9秒、事件概率75%。动作结束或无可选动作时回到 Idle。家族抽取权重为 expressive/locomotion/settle = 72/8/20；过滤 Death、循环动作和最近三段动作，settle 选择表示继续休息。所有节奏常量集中在 `autoDirector.ts`。
- Auto 短动作按 GLB clip 资产时长播放，移动动作锁定 Body 的 X/Z，保留 Y 起伏。Death 不参与 Auto。动作运行时不加入小幅持续摆动；安静期间只有 Idle 动画和注意力视线。
- Auto 下桌面左键拖动和触屏长按拖动传递注意力；右键拖动相机。选中具体 clip 后桌面左右键和触屏单指旋转相机。双指捏合、滚轮缩放、复原视角始终可用。

## 控制与状态契约

- Zustand 保存 `animationSource: 'Auto' | AnimationName`、当前实际 `animation`、transport、骨骼偏移、morph 权重、选中关节与注意力点。Three 对象、mixer 和逐帧姿态留在舞台运行时。
- `setAnimationSource('Auto')` 重置为 Idle、播放中、循环、1×速度并清理注意力；选择具体 clip 时从0播放，保留当前具体 clip 的循环/速度设置；从 Auto 进入具体 clip 时默认循环和1×速度。
- Auto 导演只能通过 `setAutoAnimation`、`setAutoIdle` 更新内部 clip；这些更新不得改变 `animationSource`。Auto transport 在 UI 禁用，store 也拒绝用户 transport 修改。
- 骨骼目录来自两个 skin 的 joints，按资源顺序去重并保留辅助关节标识。所有有效关节均可设置局部 Euler 三轴偏移，范围 -180..180 度、精度0.1度；可逐项和全部复位。偏移在 Auto 和具体 clip 下都有效。
- 三个 morph 权重范围0..1、精度0.01，在 Auto 和具体 clip 下均可编辑。具体 clip 播放时滑块覆盖动画 morph；Auto 保留 clip 自带 morph，非零滑块值作为用户覆盖。
- mixer 每帧求值后记录当帧动画四元数，再叠加偏移；下一帧只恢复上一帧动画基线，不将全部骨骼重置到静止 pose。切换、淡出、结束、暂停和 seek 不得产生周期性回弹或偏移累积。
- 具体 clip 独占 mixer；选 clip 时淡出旧 action 250ms、从0播放。速度范围0.1–2.0、步长0.1；循环关闭时停在末帧并暂停，再播放从0开始。拖动时间轴时暂停，释放后恢复拖动前播放状态。
- 所有控制仅在当前页面会话生效，不持久化；不实现姿态预设、导入导出或通用模型编辑器。

## 生命周期与故障处理

- Auto 选择、具体 clip 选择、组件卸载、模型重载和 HMR 时清除导演 timer、recovery timer、mixer action/listener 与 pointer capture。
- 页面隐藏暂停导演 timer 和 mixer；恢复后按剩余等待时间继续，不补播隐藏期间事件。指针取消、失焦和切换至具体 clip 时清除注意力。
- clip/joint 缺失时只显示实际有效目录；Idle 缺失则使用首个有效 clip。沿用 StageErrorBoundary 重试。
- 模型仍固定为当前 GLB，不做上传或通用骨架适配；不增加依赖。

## 实施任务

1. [任务01：统一状态与动画姿态运行时](./stage-2-task-01-runtime.md)：动画来源、clip transport、骨骼与 morph 写入所有权及回弹回归测试。
2. [任务02：低频 Auto 导演与注意力输入](./stage-2-task-02-auto-director.md)：Idle 主导、长间隔低概率短动作、注意力调制、页面隐藏暂停及相机仲裁。
3. [任务03：常驻控制台](./stage-2-task-03-manual-inspector.md)：Auto/clip 选择、transport、骨骼和 morph 调试控件。
4. [任务04：应用集成与旧功能退役](./stage-2-task-04-integration.md)：常驻侧栏、窄屏圆形入口、删去双模式入口并同步产品文档。

## 验收

- Store 测试覆盖默认 Auto、选择 clip/Auto 的切换语义、Auto 内部动画更新、transport 禁止/边界、骨骼偏移和 morph 在来源切换后保留。
- Auto 纯逻辑测试覆盖12–24秒与5–9秒随机等待、事件概率、家族权重、动作去重、Death/循环动作排除、attention 调制及假时钟暂停恢复。
- 姿态测试覆盖连续多帧恢复上一帧 mixer 姿态、应用关节偏移、清除偏移不残留，以及动画切换后不累积。
- 集成自动检查确认顶部无模式切换、桌面 Inspector 常驻、窄屏入口为圆形、Auto 与14个 clip 均可选、Auto transport 禁用、骨骼/morph 始终可编辑。
- 开发自动检查：`pnpm test`、`pnpm typecheck`、`pnpm lint`、`pnpm format:check`、`pnpm build`。
- Auto 观感、桌面与窄屏布局、注意力拖动/相机触控等复杂视觉和真实手势由人工 reviewer 验收，不在自动检查中宣称通过。

## 本次实现验证

- `pnpm test`：35项通过；`pnpm typecheck`、`pnpm lint`、`pnpm format:check`、`pnpm build`：通过。
- 生产构建主 chunk 约1.43MB，Vite 输出超过500kB提示；构建未失败。
- Auto 自然度、桌面/窄屏视觉和真实拖动/捏合交互仍待人工验收。
