# Boop Bot 项目风格

## 状态与适用范围

- 状态：现行规范。
- 适用于所有 React 界面、后续阶段的调试工具与应用外壳；机器人模型和三维场景材质不必受 UI 配色 token 限制。
- 本文与 `src/styles.css` 的 shadcn 全局 token 配合使用。设计值以语义 token 为准，不在组件中重复定义主题色。

## 视觉基调

- 使用简约的黑、白、蓝体系：背景、正文与边界以中性色建立层次，蓝色作为主要操作与焦点反馈。
- 主要使用 `background`、`foreground`、`primary`、`secondary`、`muted`、`accent`、`border`、`ring` 等 shadcn 语义 token。
- 禁止在 UI 组件中硬编码颜色值；颜色通过 Tailwind token utility 表达。三维灯光、模型材质和场景地面属于舞台表现，可由 Three.js 单独控制。
- 使用现有 Inter 字体及系统中文回退；优先保证清晰、紧凑和长文本换行。

## 组件与布局

- 交互控件优先使用项目通过 shadcn CLI 安装的组件；先检查现有 `src/components/ui/`，避免重复实现。缺少适配组件时，使用 shadcn CLI 安装，不手写替代组件或本地包装。每次执行 CLI 前，必须在同一终端会话先运行 `proxy-off`，再执行安装命令（例如 `proxy-off; pnpm exec shadcn add -y -p src/components/ui <component>`）；禁止拆到不同终端。新组件必须落在 `src/components/ui/`，确保应用别名可以解析。
- 使用 Tailwind utility class 做组件布局和状态，不新增页面级 CSS 选择器或另一套组件样式体系。`src/styles.css` 仅维护 Tailwind/shadcn 引入、主题 token、必要的 reset 和基础层。
- 工作区优先让主要舞台填满可用空间，控制区贴右；窄屏保留主要内容，次级控制通过可访问的 Sheet 提供。
- 面板和重复信息使用清晰层级与细边界，避免卡片套卡片；使用 shadcn 默认圆角尺度，圆形按钮仅用于熟悉且有可访问名称的图标操作。

## 动效与可访问性

- 动画轻快、短促、克制；优先用颜色、透明度和小幅 transform 表达 hover、focus、press 状态，不使用持续脉冲或装饰性动效。
- 遵守 `prefers-reduced-motion`：减少动态效果时移除非必要 transform 与过渡。
- 所有图标按钮提供 `aria-label` 与 tooltip/title；控件具备键盘操作、清晰焦点、正确禁用状态和语义标签。
- 组件尺寸稳定，内容在桌面与窄屏均可读，不因 hover、长标签或数值变化产生布局抖动或溢出。
