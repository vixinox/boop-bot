# 阶段1任务05：全屏舞台、视角控制与项目风格

状态：已实现并完成开发时验证。任务01–04作为已验证基线；本任务扩展应用壳、相机交互和 UI 组件规范，不改变 Companion Zustand store 契约。

## 目标与决策来源

- 主规格：[stage-1-development-spec.md](./stage-1-development-spec.md)。项目风格：[design-system.md](../../design-system.md)。
- 目标：在保留 header 的前提下以全视口布局展示舞台；增加鼠标拖拽视角和复原操作；窄屏控制收进 Sheet；统一采用 shadcn 风格控件和语义 token。
- 以当前工作区源码行为为实施基线；未检查或推断暂存/未暂存改动意图。

## 范围与所有权

- 修改 `src/App.tsx`、`src/styles.css`、`src/stage/**`、`src/ui/**`；在 `src/components/ui/**` 建立本地 shadcn 风格组件，并通过 `@/lib/utils` 复用已安装的 cn class helper。
- 更新主规格、实施文档索引、路线图、项目风格文档及本任务包。
- 使用已有 React、Tailwind、shadcn 配置、Base UI、Drei OrbitControls 与 Lucide；不增加依赖，不改 store、不新增业务状态或路由。
- 任务04原有窄屏上下堆叠验收由本任务“窄屏 Sheet”行为覆盖；任务01–03的业务行为验收保持有效。

## 布局与组件行为

- 根应用填满 `100dvh`，header 保留固定高度；剩余区域填满视口。桌面舞台占据左侧剩余空间，控制栏紧贴右侧并从 header 下方延伸至底部；页面无最大宽度或居中外边距。
- `md` 以下隐藏桌面侧栏，以舞台右上角的图标按钮打开右侧 Sheet。Sheet 内保留状态、休眠/唤醒、三种快捷互动、回复和三个表情权重滑块；可经关闭按钮、遮罩或 Escape 关闭。
- UI 交互使用本地 shadcn 风格 Button、Sheet、Slider、Card；基于已有 Base UI，不增加新依赖。非交互排版使用 Tailwind。全局 CSS 只保留主题 token、reset 和基础层；UI 不使用硬编码颜色或自定义页面选择器。
- 颜色使用 shadcn 语义 token，项目整体为黑、白、蓝的简约视觉；界面动效轻快克制，并尊重 reduced-motion。舞台材质颜色不受 UI token 限制。

## 相机交互

- Drei `OrbitControls` 支持鼠标或单指拖拽绕机器人旋转；水平旋转不设角度限制，俯仰角保持安全限制，关闭平移并启用低强度旋转阻尼。
- 桌面滚轮和移动端双指捏合由 GSAP 驱动相机距离，以约 0.2 秒 `power2.out` 过渡并限制在 1.6–12；OrbitControls 原生缩放关闭，避免即时缩放与 GSAP 动画叠加。
- 镜头目标点保持在机器人主体附近。Canvas 尺寸变化时重新计算适配距离，同时尽可能保留当前旋转方位，机器人和底座仍处于可视构图中。
- 舞台左上方提供圆形 shadcn Button，使用 `RotateCcw` 图标、tooltip/title 和 aria-label。hover 与按下只有轻微缩放；reduced-motion 下关闭缩放和非必要过渡。
- 复原按钮以 0.8 秒 GSAP `power2.out` 过渡回当前舞台尺寸的适配构图。新的旋转或缩放输入会取消活动 tween 并交还相机控制权。每次视口尺寸变化后更新复原基准。

## 验收与验证

- 桌面下 header 保留、舞台满铺剩余区域、控制栏贴右到底；窄屏无页面横向滚动，Sheet 可达且控件齐全。
- 鼠标或单指拖动可连续绕水平方向旋转且无方位角边界，俯仰仍受安全角度限制；双指捏合和滚轮缩放均以约 0.2 秒缓动，并限制在 1.6–12；平移不可用。
- 复原使用 GSAP `power2.out` 返回当前舞台尺寸的适配构图；拖动、滚轮或捏合输入可中断动画并正常控制相机。
- 原状态互动、回复、休眠锁定/唤醒和三个表情滑块行为保持有效；键盘焦点和 slider 键盘调节正常。
- 开发时运行 `pnpm test`、`pnpm typecheck`、`pnpm lint`、`pnpm format:check` 和 `pnpm build`。
- 实现后浏览器验收桌面及 390px 窄屏、Sheet 开关、完整水平旋转、俯仰边界、单指旋转、双指缩放、滚轮缩放、缩放边界、尺寸变化与可中断的复原动画，并确认无运行时错误。

## 依赖与完成结果

- 前置：任务01–04均已完成。
- 开发时验证：`pnpm test`（12项通过）、`pnpm typecheck`、`pnpm lint`、`pnpm format:check` 与 `pnpm build` 均通过。构建保留既有约1.34MB主包体积提示。
- 浏览器验收：默认桌面视口下 GLB/底座正常显示；拖拽改变角度，复原返回正面构图；390px 视口下 DOM 为 390×844 且无溢出，舞台填满 header 以下区域，Sheet 可开关、三个互动和滑块可用，点击摸头能更新状态和回复。干净浏览器会话无应用运行时错误。
- 阶段1完成状态以本任务的实际验证记录为准；用户可按以上流程再次体验，属于实现后体验验收，不阻塞开发时检查。
