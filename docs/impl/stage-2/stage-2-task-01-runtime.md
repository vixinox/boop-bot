# 任务01：统一状态与动画姿态运行时

> 历史实现记录：本文中的 Auto director/source 契约已由阶段3重构取代。当前代码基线见[阶段3重构规格](../stage-3/stage-3-refactor-development-spec.md)。

- 状态：已实现；store 与骨骼姿态回归测试通过。共享契约见[阶段2开发规格](./stage-2-development-spec.md)。
- 目标：以 `animationSource: 'Auto' | AnimationName` 替代全局模式，稳定管理 Auto/clip action、骨骼偏移和 morph 写入。
- 范围：`src/state/**`、`src/stage/**` 的运行时/纯逻辑模块与测试。
- Auto director 只能通过独立的 Auto action 更新当前 clip，不能夺取 clip source；具体 clip 单独播放并提供 transport。Auto 下拒绝 transport 输入。
- mixer 更新后捕获动画四元数，再叠加骨骼旋转；下一帧从上次 mixer 四元数恢复以避免偏移累积。移除全关节静止 pose 的逐帧复位。Body 的 Auto X/Z 锚定单独处理。
- 骨骼偏移与 morph 权重在所有来源下可调；Auto 保留 clip morph，具体 clip 由滑块覆盖。source 切换不清除用户设置。
- 完成条件：每关节偏移连续更新/清除无跳变和累积；clip 选择250ms crossfade并从0播放；LoopOnce完成可暂停并从头重播；seek、卸载和 HMR 清除正确。
- 验证：store source/transport/偏移/morph 测试、四元数逐帧回归测试、`pnpm test`、`pnpm typecheck`、`pnpm lint`。
