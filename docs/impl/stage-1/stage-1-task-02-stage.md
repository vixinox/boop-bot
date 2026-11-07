# 阶段1任务02：三维舞台

状态：已完成。实现为 `src/stage/CompanionStage.tsx`，导出 `CompanionStage`。已完成角色尺寸、桌面/窄屏取景、身体动作、独立表情、四态灯光和舞台失败重试；最终检查记录见[索引](../README.md)。下文保留执行范围与验收标准。

## 目标与完成结果

实现可复用的 R3F 伴侣舞台组件，加载仓库角色、程序化底座，并将 store 状态映射到平滑动画、姿态和 morph target 权重。

## 必读与决策来源

- 主规格：[stage-1-development-spec.md](./stage-1-development-spec.md)。情绪/动作映射、动画时长和非目标以主规格为准。
- 资产：`public/RobotExpressive.glb`。已确认包含 14 个命名动画及 `Angry`、`Surprised`、`Sad` morph target。

## 范围与所有权

- 可写：`src/stage/**`。
- 不可写：store、`src/ui/**`、`src/App.tsx`、全局样式和文档。需要接口变化时回报集成负责人并更新主规格后再执行。
- 不实现触摸区、悬停/碰撞提示、鼠标视线跟随、腮红、情绪到表情映射、镜头预设或 Inspector。

## 输入与输出接口

- 输入：从主规格定义的 Zustand store 读取 `emotion`、`action`、`expressionWeights`。
- 输出：导出一个可被应用组合层挂载的舞台组件（建议 `CompanionStage`）；只负责三维渲染，不拥有产品状态。
- 程序化 `Shake`、`Shy`、`Sleepy` 是显示层动作，不要求 GLB 存在同名 clip；GLB clip 只播放确实存在的动画。

## 行为验收

- Canvas 中可见机器人和简洁、稳定尺寸的程序化桌面底座；窗口缩放时主体不被裁切。
- 初始播放 `Idle`；`Yes`、`ThumbsUp` 和动作切换使用 250ms 交叉淡入。
- `Shake`、`Shy`、`Sleepy` 以轻微程序化变换表现；动画更新不与 GSAP 同时写同一 Three.js 对象。
- 三个表情权重分别驱动对应 morph target，并平滑过渡到 0–1 目标值；滑块变化不触发情绪或动作改变。
- 组件卸载时停止/清理临时动画和帧更新，不留下对已卸载对象的引用。

## 验证

- 运行 `pnpm typecheck`、`pnpm lint`、`pnpm format:check` 和 `pnpm build`。
- 在任务04集成后执行手动浏览器验收，确认模型加载、底座可见、动画和三个表情控件均正常。

## 依赖与集成

- 前置：任务01冻结 store 契约。
- 后置：任务04挂载舞台；组件只通过明确导出和 store 连接，不直接修改 `App.tsx`。
