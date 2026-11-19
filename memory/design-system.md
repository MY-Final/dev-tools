# 设计系统记忆（2026-11 校正）

> ⚠️ 旧版描述的「莫兰迪紫 + 毛玻璃 + Inter」已全部作废。以 `src/renderer/src/assets/base.css` 实际代码为准。

## 整体风格
- **设计理念**: 暖调石墨（warm graphite）+ 琥珀信号色（amber signal）。界面保持中性，颜色只用于状态、分类标识与代码高亮
- **平面化**: 全站去毛玻璃，`--glass-bg` 已别名到 `--color-surface`（旧页面沿用会自动获得新样式）
- **圆角**: 连续曲率 squircle（`corner-shape: squircle` 全局声明），正圆元素需单独写 `corner-shape: round`

## 配色

### 深色（默认，`:root` / `[data-theme='dark']`）
| 角色 | 色值 |
|------|------|
| 背景 | `#1a1a18` |
| 表面 / hover / active | `#21211f` / `#272725` / `#2e2e2b` |
| 侧栏背景 | `#151513` |
| 编辑器背景 | `#1c1c1a` |
| 边框 / hover / active | `#34342f` / `#45453f` / `#55554d` |
| 文字 / 次要 / 弱 | `#ecebe6` / `#b4b0a5` / `#948f84` |
| 强调（琥珀） | `#d9a441`，hover `#e8b65c` |
| success / warning / danger | `#7aa874` / `#d98a3d` / `#d0655c` |

### 浅色（`[data-theme='light']`）
| 角色 | 色值 |
|------|------|
| 背景 | `#f6f6f4` |
| 表面 / hover / active | `#ffffff` / `#f1f1ee` / `#e9e9e5` |
| 侧栏背景 | `#efefec` |
| 边框 | `#e2e2dd` |
| 文字 | `#1c1c1a`，次要 `#55534d` |
| 强调 | `#8a5a12`（深琥珀，保对比度） |

## 字体
- **正文**: IBM Plex Sans（Google Fonts import），CJK 回退 PingFang SC / Microsoft YaHei
- **等宽**: JetBrains Mono（代码、kbd、数字）——不是显示字体
- 数字对齐: `.tabular` / `[data-numeric]` → `font-variant-numeric: tabular-nums`

## 令牌标尺
- **圆角**: `--radius-xs/sm/md/lg/xl/pill` = 5 / 7.5 / 10 / 15 / 20 / 999px
- **字号**: `--text-2xs..3xl` = 10/11/12/13/14/16/20/24/28px；`html { font-size: var(--app-root-font-size) }`，设置项 small/medium/large = 14/16/18px
- **分类色**: `--cat-1..9`（低饱和土色），只做图标/分类标识，不参与交互
- **代码高亮**: `--jf-key/string/number/boolean/null`
- **旧别名保留**: `--color-accent-soft*` → accent；`--glass-*` → surface/border；`--gradient-bg` → background

## 布局骨架
```
.app-layout（flex，sidebar + main-content 100dvh）
  .tool-shell（container-type: inline-size; container-name: tool）
    .tool-shell-main（--tool-max 分档：表单 900 / 结果 1080 / 复杂 1120 / 速查 1240）
```
- 宽屏 container query ≥1080px 再放大一档；工作台类（jf/mp/csv/xf/df）占满高度
- 侧栏断点：<768 mobile drawer、<1024 tablet collapsed、desktop 用户控制

## 共享工具页类（tool-layout.css，新页面优先复用）
- 页框: `.tool-page` / `-header` / `-title` / `-desc` / `-actions`
- 平面: `.tool-panel`（+ `-head` `-title` `-body` `-body--flush`）——一个模块一张平面，内部用分隔线，不叠小卡片
- 控件标尺: `.tool-input/select` 32px（`--lg` 38px）、`.tool-btn` 32px（`--outline` `--primary`）、`.tool-icon-btn` 28px、`.tool-segmented/.tool-seg` 26px
- 行式数据: `.tool-rows/.tool-row`（44px 行高 + 发丝线）
- 分栏: `.tool-split`（+`--even` `--wide`，≥980px 才并排）

## 空状态与骨架屏（2026-11）
- **组件**: `components/EmptyState.tsx`（icon / title / description / action / size `md|sm` / tone `neutral|error` / live），`components/Skeleton.tsx`（`Skeleton` 占位块、`SkeletonList` 列表骨架、`PageSkeleton` 整页骨架，已接到 App.tsx 的 Suspense fallback）
- **样式**: `styles/states.css`（含全局 `.sr-only`），`main.css` 里紧跟 tool-layout 导入
- **约定**: 空状态文案要给出下一步（「换个关键词」「点击添加」），不要只写「暂无数据」；搜索类结果变化时传 `live` 播报，初始态不播；骨架屏只在首屏加载时出现，刷新已有结果时保留列表 + 一行小字状态
- **待迁移**: 各页面旧类 `.npm-empty/.dh-empty/.ev-empty/.clm-empty/.sv-empty/.tn-empty/.at-empty/.xp-no-match/.rx-no-match/.home-empty` 的 CSS 仍留在各自文件里，已无引用可删
- 旧页面 `.xx-card/.xx-header` 被 tool-layout 统一归一化：去卡片背景、标题左对齐同字号

## 动效系统（2026-11 已建成）
- **令牌**（base.css `:root`）: `--duration-instant/fast/base/slow` = 90/140/200/280ms；`--ease-out`（出现）、`--ease-in-out`、`--ease-overshoot`（按压/chevron 轻回弹）、`--press-scale: 0.97`
- **视图过渡**（App.tsx `navigate` + base.css）: `document.startViewTransition(() => flushSync(commit))`。**只给 `.main-content` 命名**（`view-transition-name: main-content`），侧栏等常驻 chrome 不进快照——整页一起淡入淡出就是用户说的「像刷新」。root 快照动画停掉（`animation: none` + z-index 0/1 分层）；内容区旧层静止垫底、新层 `vt-content-enter` 140ms 纯透明度淡入盖上，无位移
- **过渡守卫**: reduced-motion、`document.visibilityState !== 'visible'`（隐藏文档下 Chromium 会挂起过渡不执行）、API 缺失 → 一律直切
- **同页不过渡**: `page === currentPage` 直接 return，否则内容没变也淡一下=闪烁
- **两个踩过的坑**: ① update callback 是**异步**调用的（实测 ~74ms），兜底不能同步检查 `applied`，必须挂 `transition.updateCallbackDone.catch()`——过渡被跳过时 callback 不执行，导航会静默丢失；② 三条 promise 都要 catch，否则跳过时刷 Uncaught (in promise)
- **验证动效的前提**: 页面必须产帧（rAF）。Claude 预览面板不产帧时会挂起过渡回调，表现为「点击没反应」——环境问题，真实窗口 60fps 不受影响
- **按压反馈**: `.btn` / `.tool-btn` / `.tool-icon-btn` / `.tool-seg` / `.nav-icon-btn` / `.home-tool-card-main` / 侧栏按钮共用 `scale(var(--press-scale))`，过渡列表必须含 `transform var(--duration-instant)`
- **滚动重置**: navigate 时 `#main-content` scrollTo(0)，该容器跨页面复用
- **注意**: 页面 CSS 里仍有少量历史硬编码时长（如 0.1s/0.16s），新代码一律用令牌；lazy 页面未就绪时过渡会落到 Loading 骨架
## 可访问性基线
- skip-link、`:focus-visible` 2px 琥珀 outline、`aria-current="page"`、触屏 44px 最小热区、自定义滚动条

## 响应式断点
- 侧栏: 767 / 1024（JS 判断，Sidebar.tsx）
- 工具页: 767 / 1100 media query + container 980 / 1080
