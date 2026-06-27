# 设计系统规范 (Design System)

## 主题机制

- **CSS 自定义属性（变量）** 驱动所有颜色/阴影，定义在 `src/renderer/src/assets/base.css`
- 暗色为默认：`:root` + `[data-theme='dark']`
- 亮色：`[data-theme='light']`
- 切换通过 `<html data-theme="...">` 属性，CSS cascade 生效
- body 有 `transition: background-color 0.3s, color 0.3s`
- Tailwind `darkMode: ['selector', '[data-theme="dark"]']`，`dark:` 前缀可用

## 核心颜色变量

| 变量 | 暗色值 | 亮色值 |
|------|--------|--------|
| `--color-background` | `#0d1117` | `#f8f9fb` |
| `--color-surface` | `#161b22` | `#ffffff` |
| `--color-text` | `#f0f6fc` | `#1a1d21` |
| `--color-text-secondary` | `#8b949e` | `#5e6772` |
| `--color-border` | `#30363d` | `#e8ecf0` |
| `--color-accent` (蓝色) | `#58a6ff` | `#7c6bc4` |
| `--color-accent-soft` (莫兰迪紫) | `#8b7ec8` | `#7c6bc4` |
| `--color-success` | `#3fb950` | `#2da44e` |
| `--color-danger` | `#f85149` | `#cf222e` |

完整变量表见 `base.css`。

## 阴影

- `--shadow-sm` / `--shadow-md` / `--shadow-lg` / `--shadow-glow`
- 暗色调更浓，亮色更淡

## 字体

- **UI**: `Inter` (sans-serif)
- **代码**: `JetBrains Mono` (monospace)
- **字号**: `--font-size-base: 14px`, `--font-size-sm: 12px`, `--font-size-lg: 16px`

## shadcn/ui 组件

已安装（`src/renderer/src/components/ui/`）：

| 组件 | 文件 |
|------|------|
| Button | `button.tsx` — variants: default/destructive/outline/secondary/ghost/link |
| Input | `input.tsx` |
| ScrollArea | `scroll-area.tsx` |
| Separator | `separator.tsx` |
| Tooltip | `tooltip.tsx` |

**工具函数**: `cn(...)` 在 `lib/utils.ts` — 基于 `clsx` + `tailwind-merge`

## 页面 CSS 约定

- 每个工具页面一个独立的 CSS 文件，放在 `src/renderer/src/styles/`
- 所有 CSS 通过 `src/renderer/src/assets/main.css` 统一 `@import`
- 类名使用 **kebab-case**，加唯一前缀避免冲突（如 `.converter-*`、`.base64-*`）
- 颜色使用 `var(--color-*)` 变量，不要硬编码色值
- 标准圆角: 8px (按钮/卡片) / 14-20px (Hero/设置卡片)
- 标准过渡: `0.15s ease` (hover/active) / `0.25s ease` (布局变化)
- `background: var(--color-surface); border: 1px solid var(--color-border);` 是标准卡片模式

## Tailwind 用法

- **克制使用** — 主要用在 shadcn 组件内部
- 主题色映射到 CSS 变量: `bg-background`、`text-primary`、`border` 等
- 纯 CSS `var()` 方式优先于 Tailwind 工具类

## 共享样式类（global.css）

| 类 | 用途 |
|----|------|
| `.btn` / `.btn-primary` / `.btn-secondary` / `.btn-ghost` | 通用按钮 |
| `.page-loading` | 页面加载 spinner |
| `.toast` / `.toast-enter` / `.toast-exit` | Toast 通知系统 |
