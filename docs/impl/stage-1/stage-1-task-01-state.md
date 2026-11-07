# 阶段1任务01：核心状态与生命周期

状态：已完成。实现位于 `src/state/companionStore.ts`；测试位于同目录 `companionStore.test.ts`。当前状态测试12项通过，接口导出为 `useCompanionStore`。下文保留执行范围与验收标准。

## 目标与完成结果

实现并测试阶段1的 Zustand 核心状态 store，提供稳定的情绪、动作、互动、气泡和表情权重接口。完成后舞台与 UI 可只依赖 store 契约并并行开发。

## 必读与决策来源

- 主规格：[stage-1-development-spec.md](./stage-1-development-spec.md)。其中状态行为、类型及推荐默认是权威来源。
- 当前基线：[roadmap.md](../../roadmap.md)；以当前工作区源码为准，暂存/未暂存意图未纳入。

## 范围与所有权

- 可写：`src/state/**`、与状态测试直接相关的 `src/state/**` 测试文件、`package.json`、`pnpm-lock.yaml`（仅为 Vitest 和测试脚本所需）。
- 不可写：`src/App.tsx`、舞台/UI 目录、全局样式、路线图和主规格。若接口缺口阻塞其他任务，先提出规格更新建议，不自行更改共享契约。
- 不实现 React 组件、动画、模型加载、日志、自然语言驱动或 UI 控件。

## 共享接口

实现主规格中的 `CompanionState` 消费接口：`emotion`、`action`、`bubble`、`expressionWeights`、`interact`、`sleep`、`wake`、`setExpressionWeight`。`interact(interaction, reply?)` 的可选回复由 UI 提供，不传则使用 store 默认回复。可增加只服务测试的重置/注入时钟方式，但不要让 UI 或舞台依赖测试接口。

## 行为验收

- 初始为 `IDLE`/`Idle`、无气泡、所有权重为 0。
- `headPat`、`praise` 进入 `HAPPY`，`shake` 进入 `SHY`；三秒后仅在没有更新指令时回到 `IDLE`/`Idle`。
- 任意后续互动重置回退时钟并覆盖先前动作/气泡；sleep 取消回退，休眠时互动无副作用，wake 进入待机。
- sleep/wake 不清除既有气泡；互动产生新固定回复。
- 权重被限制在 0 到 1，且调整权重不改变其他状态。

## 验证

- 使用 Vitest 假时钟测试上述生命周期和边界，不用真实等待。
- 运行 `pnpm typecheck`、`pnpm lint`、`pnpm format:check` 与相关测试。
- 本任务不负责完整构建或手动浏览器验收；由任务04执行。

## 依赖与集成

- 前置：无。
- 输出：store 的导出路径和类型签名稳定后通知任务02、03开始并行实现。
- 后置：任务02、03依赖本任务契约；任务04依赖本任务完成。
