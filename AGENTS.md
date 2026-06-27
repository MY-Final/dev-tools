# AGENTS.md

Dev Tools — Electron + React + TypeScript 桌面开发工具箱。

## Commands

```bash
npm run dev          # 开发模式 (localhost:4120)
npm run build:win    # 构建 Windows 安装包
npm run build:mac    # 构建 macOS 安装包
npm run build:linux  # 构建 Linux 安装包
npm run typecheck    # TypeScript 类型检查
npm run lint         # ESLint 检查
npm run format       # Prettier 格式化
```

所有构建命令先跑 `npm run typecheck`，失败会终止。

## Architecture

```
src/
├── main/           # Electron 主进程
│   ├── index.ts    # 窗口创建、IPC handler 注册、全局快捷键
│   ├── settings.ts # SettingsStore (JSON 文件持久化到 userData/)
│   └── updater.ts  # electron-updater 封装、状态转发
├── preload/        # contextBridge 桥接层
│   ├── index.ts    # 暴露 window.api / window.updater / window.maven
│   └── index.d.ts  # 全局类型声明 (Window 扩展)
└── renderer/src/   # React 前端
    ├── App.tsx     # 根组件：路由、主题、字体大小
    ├── pages/      # 51 工具页面 (每个工具一个文件)
    ├── components/ # 共享组件 (Sidebar, CommandPalette, CheatSheet, ui/)
    ├── tools/      # 每个工具的 hook + 数据 (JSON)
    ├── lib/        # contexts, updater-context, maven-api
    ├── styles/     # 每个页面一份 CSS，由 main.css @import
    └── assets/     # main.css 入口、base CSS 变量
```

**IPC 模式**: 主进程 `ipcMain.handle` / 渲染进程 `window.api.xxx()` (invoke) 或 `window.maven.xxx()` (Maven 代理) 或 `window.env.getEnvVars()` (环境变量)。状态更新走 `webContents.send` + `window.electron.ipcRenderer.on`。

**路由**: `App.tsx` 通过 `pages/registry.ts` 的 `getPageComponent()` 映射 tool id 到 lazy 组件，用 `Suspense` 包裹渲染。特殊页面（home / about / settings）硬编码在 App.tsx。

**样式**: 全局 CSS 变量定义在 `main.css`，每页 CSS 独立。使用 `var(--color-*)` 主题变量，dark/light 由 `data-theme` 属性控制。无 CSS Modules，纯全局 CSS。

## Conventions

- **行尾**: LF (`endOfLine: lf` in .prettierrc.yaml)，Git CRLF 警告忽略
- **引号**: 单引号，无分号 (`singleQuote: true, semi: false`)
- **Hooks**: 每个工具页面用一个自定义 hook（例: `useJsonFormatter`），放在 `tools/<tool-name>/` 下
- **IPC 调用**: 渲染进程不直接 `fetch` 外部 API（CORS 问题），走 main process 代理
- **数据分离**: 静态数据放 JSON 文件 import，不内联在组件里
- **React 19 + @types/react 19**: `useRef` 需要显式初始值；有 `react-hooks/set-state-in-effect` 严格检查
- **工具注册**: 新建工具需改 3 个地方 — `tools.json` (配置), `pages/registry.ts` (lazy import), 实现文件 (页面 + CSS)。App.tsx 不需要改
- **TypeScript**: `strict: true`，禁止 `any` 和 `@ts-ignore`，基础类型让 TS 推断，复杂类型显式标注泛型

## 回复约束（必须遵守）

- **每次回复必须以 `(∠・ω＜ )⌒☆` 开头** — 不可省略
- **语言跟随用户** — 用户写中文就用中文回复，切换时跟随
- **技术术语不翻译** — 代码、标识符、文件路径、命令保持原文
- **编码前先确认风格** — 阅读对应记忆文件，对齐项目已有风格，不要自由发挥

### 记忆文件索引（遇到对应场景必须先读）

| 文件 | 场景 |
|------|------|
| `memory/tool-patterns.md` | 新建/修改工具页面、注册表、hooks |
| `memory/design-system.md` | UI 样式、CSS 变量、组件布局 |
| `memory/ts-conventions.md` | TypeScript 类型、变量命名、React 类型写法 |
| `web-dual-mode-architecture.md` | 新增/维护 web 兼容层、API 映射、双模式构建

## Notes

- electron-builder v26: `win.nsis` 为工具集版本字符串，NSIS 选项在根级 `nsis` 键下
- Maven 搜索走主进程代理 (`maven:search` IPC) 绕过 CORS
- 全局快捷键 Ctrl+K 打开 CommandPalette，在 main process 通过 `globalShortcut` 注册
- .reasonix/ 已加入 .gitignore，无需提交
- **crypto-js 已移除** — HashGenerator 改用 Web Crypto API + 纯 JS MD5
- **CheatSheet 组件** — 速查表统一使用 `components/CheatSheet.tsx`，传入 JSON 数据
- **发版流程**: bump version → `git tag -a vX.Y.Z` → `gh release create vX.Y.Z` → `gh release edit` 更新 notes
- **Chromium 优化**: `src/main/index.ts` 中禁用拼写检查/PDF/语音/翻译等 Chromium 子系统
