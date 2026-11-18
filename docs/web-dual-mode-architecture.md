# Web 双模式架构

Dev Tools 的同一套 React 渲染层可以运行在两种宿主里：

| 模式 | 入口 | 后端 |
|------|------|------|
| Electron 桌面版 | `src/main` + `src/preload` | 主进程 IPC |
| Web 静态版 | `web/main.tsx` | 浏览器 API（无主进程） |

## 运行时判定

渲染层统一使用 `src/renderer/src/lib/platform.ts`：

```ts
isWebRuntime() // window.electron?.process?.platform === 'web'
```

`web/main.tsx` 在渲染层启动前安装兼容层，把 `window.api`、`window.updater`、`window.maven`、`window.docker`、`window.npm` 等替换为浏览器实现。

## 能力矩阵

| 能力 | 桌面版 | Web 版 |
|------|--------|--------|
| 纯前端工具（编码/换算/文本/正则等） | ✅ | ✅ |
| 设置持久化 | `userData/settings.json` | `localStorage` |
| 打开/保存文本文件 | 原生对话框 + 路径读写 | `<input type=file>` + 浏览器下载 |
| 环境变量 | 主进程读取 | 返回空对象 |
| 内网 IP | 主进程网卡枚举 | 不可用（`platforms: ["desktop"]`） |
| Maven Central | 主进程代理（绕过 CORS） | 明确报错，提示使用桌面版 |
| npm / Docker 搜索 | 主进程代理 | 直接 `fetch`，依赖上游 CORS |
| AI 翻译 | 主进程代理 | 直接 `fetch`，需服务商允许浏览器跨域 |
| WebSocket 测试 | 支持自定义头/代理模式 | 支持基础收发，不支持自定义头 |
| 自动更新 | electron-updater | 不适用 |

## 新增一个跨模式能力

1. 在 `src/shared/contracts.ts` 定义类型与 API 契约。
2. 桌面端：`src/main/*-ipc.ts` 注册 handler，`src/preload/index.ts` + `index.d.ts` 暴露。
3. Web 端：在 `web/api/web-api.ts` 实现同名方法；做不到就返回明确错误，不要静默失败。
4. 工具元数据：在 `src/renderer/src/tools/tools.json` 用 `platforms` 声明可用环境。
5. UI：用 `supportsWeb(tool)` 渲染「桌面端」标记；页面级用 `ElectronOnlyPage` 兜底。
6. 同步更新本文件与 README 的「Web 版能力说明」。

## 安全边界

- 渲染层只通过 `contextBridge` 暴露的窄接口访问原生能力，不使用通用 `invoke`/`send`。
- 主进程 handler 统一经 `registerGuardedHandler` 注册。
- Web 端没有 `process.env` 访问；API Key 存在 `localStorage`，只适用于个人浏览器环境。
