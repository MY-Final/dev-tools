# Changelog

## v1.0.14 (2026-06-27)

**新增 3 个文本工具** (总共 68 个)

- 📝 **Markdown Preview** — 左右分栏 Markdown 编辑器与实时 HTML 渲染预览，支持 GFM 语法（标题/列表/代码块/表格/链接/图片/粗斜体）
- 📊 **CSV Editor** — CSV 数据表格查看与编辑，支持单元格编辑、添加/删除行、文件导入、复制 CSV/JSON 格式
- 🔧 **XML Formatter** — XML 格式化/压缩/校验，支持 2/4 空格缩进切换、标签匹配校验与错误定位
- 📂 **CSV Editor 文件导入** — 点击「导入 CSV」按钮读取本地 .csv 文件，纯前端 FileReader 实现，无需 IPC

**改进**
- 🔧 JSON Converter — 修复嵌套对象 TypeScript 缩进错误，UI 改为左右分栏布局
- 🔌 WebSocket Tester — 全面升级：主进程代理支持自定义请求头 / Basic Auth / 自动认证消息

**修复**
- 🐛 修复 proxy effect 移动至 callback 声明之后导致的 TS2448/TS2454/TS6133 错误
- 🐛 删除未使用 import 消除编译告警
- 🐛 修复 WebSocket Tester 3 个 bug — proxy 事件闭包 / 日志区 min-height

---

## v1.0.13 (2026-06-27)

**新增**
- ⭐ **工具收藏** — 首页工具卡片 hover 显示星标按钮，点击收藏/取消；侧边栏顶部新增收藏分区（金色星标），快速访问常用工具
- 📖 **工具使用说明** — 64 个工具全部添加使用教程和适用场景介绍；工具页面顶部显示可折叠的「使用说明」面板

**改进**
- 💄 收藏星标按钮 hover 变为金色，已收藏的常亮显示
- 💄 侧边栏收藏分区支持展开/收起/flyout 悬浮菜单

---

## v1.0.12 (2026-06-27)

**新增**
- ⌨️ **全局快捷键** — Alt+B 切换侧边栏、Ctrl+, 打开设置、Esc 返回首页
- ⚙️ **快捷键自定义** — 设置页新增「快捷键」section，点击录制组合键即时修改，持久化保存
- 🗂️ **设置路径显示** — 设置页底部显示 `settings.json` 完整存储路径

**改进**
- 📂 **侧边栏优化** — 工具名称下方显示中文短描述（设置页可开关）
- 📂 **默认折叠** — 侧边栏默认只展开第一个分类，其余折叠
- 📂 **收起模式** — 收起侧边栏后只显示分类图标，悬停弹出工具浮层菜单
- ⏳ **Loading 居中** — 页面切换 loading 改为居中的 spinner 动画

**修复**
- 🐛 修复折叠分类在收起模式下全部变为一行的视觉 bug
- 🐛 修复悬浮浮层被 `overflow:hidden` 裁剪问题
- 🐛 修复鼠标无法移入浮层菜单的问题
- 🐛 补充 `preload/index.ts` 缺失的 `proxy` 字段
- 🐛 添加「资源搜索」分类的 Search 图标映射

---

## v1.0.11 (2026-06-26)

**新增**
- 🤖 **AI Translator** — 基于 OpenAI 兼容 API 的多语言翻译（设置页配置 Base URL / API Key / Model / System Prompt）
- 📋 **Clipboard Manager** — 剪贴板历史记录（Ctrl+Shift+V 读取）
- 🖥️ **Screen Info** — 屏幕分辨率/DPI/DPR/色彩深度
- 🗄️ **Browser Storage Viewer** — localStorage/sessionStorage 查看编辑

**改进**
- 🔢 Number Formatter 改为输入即时显示全部格式结果
- 🕐 Timezone Converter / Date Format Converter / Number Formatter 新增 3 个换算工具（v1.0.10 补记）

**修复**
- 🐛 替换应用图标为用户自定义图标（窗口 + About 页面）
- 🐛 更新说明弹窗 HTML 正确渲染
- 🐛 设置页 CSS 闭合错误修复

---

## v1.0.10 (2026-06-26)

**新增 4 个编码/加密工具** (总共 55 个)

- 🔐 **AES/DES Encryptor** — 对称加密/解密（AES-CBC/GCM/CTR/ECB、DES、3DES），支持密钥/IV 自动生成
- 📜 **Certificate Parser** — 解析 PEM/X.509 证书（颁发者/有效期/SAN/指纹/扩展）
- 🔏 **HMAC Generator** — HMAC-SHA-1/256/384/512 签名生成
- 🔑 **SSH Key Generator** — 生成 Ed25519/RSA 密钥对，OpenSSH 格式公钥 + SHA-256 指纹
- 🐛 **修复** 更新说明弹窗 HTML 未渲染问题

---

## v1.0.7 (2025-06-26)

**新增 8 个工具** (总共 46 个)

- ⏱️ **Timer & Stopwatch** — 秒表 · 倒计时 · 番茄钟 · 间歇训练计时器（Web Audio 闹钟，键盘 Space/R 快捷键）
- 🔌 **USB Device Viewer** — WebHID 设备查看器（VID/PID/HID 集合/输入报告/导出 JSON）
- 🔍 **XPath Tester** — XPath 表达式测试与 XML/HTML 节点查询（元素/属性/文本/数字/布尔结果）
- 📋 **HTTP Status Codes** — HTTP 状态码速查手册（1xx–5xx）
- 🎯 **Regex Cheat Sheet** — 正则表达式语法速查手册（语法/量词/锚点/分组/断言/标志位）
- 🔤 **HTML Entities** — HTML 实体字符速查手册（&amp; / &lt; / &copy; 等）
- 🗄️ **SQL Cheat Sheet** — SQL 常用语法速查（SELECT/JOIN/GROUP BY/DDL/DML）
- 🖼️ **Image Tools** — 图片转 Base64 · 拖放上传 · 图片信息（尺寸/格式/大小）
- 🔄 **Data Format Converter** — CSV ↔ JSON ↔ XML 数据格式互转

---

## v1.0.6 (2025-06-26)

**新增 8 个工具** (总共 38 个)

- 🎨 **Color Converter** — 颜色格式转换 HEX ↔ RGB ↔ HSL
- 📝 **Lorem Ipsum Generator** — 虚拟占位文本生成（段落/句子/单词）
- 🔍 **Regex Tester** — 正则表达式实时测试与替换（分组捕获/替换预览/标志位）
- 📊 **Diff Checker** — 逐行对比文本差异，LCS 算法，三色高亮
- 🔢 **Number Base Converter** — 进制转换（Bin/Oct/Dec/Hex）+ 反码/补码
- 📏 **Unit Converter** — 10 种单位换算（长度/面积/体积/时间/角度/速度/温度/压力/热量/功率）
- 🏠 **首页重设计** — Hero 区域 + 统计面板 + 分类色标卡片
- 🗂️ **分组重组** — 7 大分类，拆分「编码/加密」

---

## v1.0.5 (2025-06-25)

**修复**

- 🐛 修复更新检测版本比较和状态覆盖竞态问题
- 🐛 修复本地版本与 GitHub 版本不匹配导致的更新下载失败

---

## v1.0.4 (2025-06-25)

**修复**

- 📐 About 页面更新技术栈和图标库信息（Lucide React / Radix UI / CodeMirror 6）

---

## v1.0.3 (2025-06-25)

**修复**

- 🐛 修复设置页面窗口化无法滚动（移除双层 overflow 冲突）
- 🎨 检查更新 / 恢复默认按钮并排到底部 footer
- 📐 About 页面技术栈更新

---

## v1.0.2 (2025-06-25)

**N/A — 跳过**

---

## v1.0.1 (2025-06-25)

初始公开发布

---

## v1.1.0 (2025-06-25)

**新增工具**

- 📋 **npm Cheat Sheet** — npm / Yarn / pnpm 命令速查
- 🐧 **Linux Cheat Sheet** — Linux 常用命令速查手册
- ☸️ **Kubernetes Cheat Sheet** — K8s 命令速查手册
- 🧩 **通用 CheatSheet 组件** — 抽取可复用的速查表组件

---

## v1.0.0

首次发布 — 基础工具集。
