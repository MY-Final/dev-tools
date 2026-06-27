# 项目状态 v1.0.12

| 指标 | 值 |
|------|-----|
| **版本** | v1.0.12 |
| **工具总数** | **64** |
| **分类数** | **8** |
| **技术栈** | Electron + React 19 + TypeScript 5.9 + Vite 7 + Tailwind 3 |
| **构建** | electron-builder 26 (Win/Mac/Linux) |

## 8 大分类

| 分类 | 工具数 | 包含 |
|------|--------|------|
| 编码/加密 | 12 | Token Gen, JWT Gen/Decode, Hash Gen, Password Gen, Base64, URL, UUID Decoder, AES/DES, Certificate Parser, HMAC Gen, SSH Key Gen |
| 备忘录 | 11 | Git, Docker, npm, Linux, K8s, ASCII, HTTP Status, Regex, HTML Entities, SQL, CSS |
| 开发工具 | 10 | Cron Gen, JSON Formatter, File Gen, Regex Tester, XPath, Data Converter, JSON Converter, Gradient Gen, HTML→JSX, AI Translator |
| 换算工具 | 9 | Data Size, Timestamp, Color, Number Base, Image, Unit, Timezone, Date Format, Number Formatter |
| 系统工具 | 9 | Device Info, Keyboard, Mouse, Env Vars, Timer, USB Viewer, Clipboard, Screen Info, Storage Viewer |
| 网络工具 | 5 | My IP, Port, Subnet, IPv4 Converter, IP Range |
| 文本工具 | 5 | Text Analyzer, Case, Unicode, Lorem Ipsum, Diff Checker |
| 资源搜索 🆕 | 3 | Maven Dependency, npm Search, Docker Hub Search |

## 主要功能

- **全局快捷键**: Alt+B 侧边栏, Ctrl+, 设置, Esc 首页
- **快捷键自定义**: 设置页可录制修改快捷键
- **AI Translator**: OpenAI 兼容 API，可配置 Base URL/API Key/Model/System Prompt
- **Command Palette**: Ctrl+K 搜索工具
- **自动更新**: electron-updater 增量更新
- **自定义图标**: SVG 应用图标
- **8 个速查表**: 通用 CheatSheet 组件
- **Settings 页面**: 折叠面板、主题切换、字号调整、代理/NPM 配置

## 架构

```
src/
├── main/           # Electron 主进程 (窗口/IPC/快捷键/更新/设置)
├── preload/        # contextBridge 桥接
└── renderer/src/   # React 前端
    ├── App.tsx     # 路由入口
    ├── pages/      # 64 页面 (含 registry.ts 懒加载)
    ├── components/ # 共享组件 (Sidebar/CommandPalette/CheatSheet/ui/)
    ├── tools/      # hooks + JSON 数据
    ├── lib/        # contexts/API/工具函数
    └── styles/     # CSS 文件 (base/global + 逐页面)
```

## 迭代方向参考

- 新增工具：遵循 `docs/tool-registry-pattern.md` 中的 5 步流程
- 发版：遵循 `docs/release-description-convention.md` 规范
