# 任务04：应用集成与旧功能退役

> 历史实现记录：本文描述阶段2当时的界面及功能移除。聊天、场景工具和相机能力已由阶段3重新加入；当前功能见根目录 README。

- 状态：已实现；自动检查通过，复杂视觉与触控验收留待人工 reviewer。依赖任务02和任务03。共享集成要求见[阶段2开发规格](./stage-2-development-spec.md)。
- 目标：交付单一工作界面、常驻调试侧栏和 Auto/clip 选择，并从产品代码移除无关聊天、快捷和传感器路径。
- 桌面主区常驻侧栏；删除 header Auto/Manual segmented control。窄屏维持现有 Sheet 入口与交互，只把按钮改为 `rounded-full`。
- Auto/clip 选择位于 Inspector 的 `Available clips`；相机手势随所选来源分配注意力/旋转输入，滚轮、双指缩放和复原持续可用。
- 删除聊天输入、文字意图解析、气泡、快捷动作、头腹传感器与旧情绪生命周期。同步 README、路线图、实施索引和阶段2任务文档。
- 完成条件：桌面 Inspector 常驻，窄屏圆形入口可打开；Auto 和14段 clip 正常运行；旧功能无 UI/store API 残留；舞台错误重试和相机缩放/复原无回归。
- 验证：`pnpm test`、`pnpm typecheck`、`pnpm lint`、`pnpm format:check`、`pnpm build`。复杂视觉与触控验收留给人工 reviewer。
