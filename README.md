# Dev Tools

一站式开发工具箱 — **62 个实用开发工具**。

> 🚀 **Web 版** — 纯浏览器运行，无需安装，一键部署到 Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Flumia1998%2Fdev-tools)

---

## 工具列表

### 编码/加密 (12)
- **AES/DES Encryptor** — 对称加密/解密（AES-CBC/GCM/CTR/ECB、DES、3DES）
- **Certificate Parser** — 解析 PEM/X.509 证书（颁发者/有效期/SAN/指纹）
- **HMAC Generator** — HMAC-SHA-1/256/384/512 签名生成
- **SSH Key Generator** — 生成 Ed25519/RSA 密钥对，OpenSSH 格式 + 指纹
- **Token Generator** — 生成 UUID、JWT、API Key 等随机标识符
- **JWT Generator** — 快速生成和调试 JSON Web Token
- **JWT Decoder** — 解析和检查 JWT Token
- **Hash Generator** — MD5、SHA-1、SHA-256、SHA-384、SHA-512
- **Password Generator** — 高强度随机密码
- **Base64 Codec** — Base64 编码与解码
- **URL Codec** — URL 编码与解码
- **UUID Decoder** — 解析 UUID 版本、变体、时间戳与 MAC

### 换算工具 (8)
- **Timezone Converter** — 多时区时间对照
- **Date Format Converter** — ISO/Unix/RFC/自定义日期格式互转
- **Number Formatter** — 千分位/货币/百分比/科学计数/进制
- **Unit Converter** — 10 种单位换算（长度/面积/体积/时间/角度/速度/温度/压力/热量/功率）
- **Data Size Converter** — 数据大小单位转换（Binary/Decimal）
- **Timestamp Converter** — Unix 时间戳与日期时间双向转换
- **Color Converter** — 颜色格式转换 HEX ↔ RGB ↔ HSL
- **Number Base Converter** — 进制转换 · 反码 · 补码（Bin/Oct/Dec/Hex）
- **Image Tools** — 图片转 Base64 · 图片信息查看

### 网络工具 (5)
- **我的 IP** — 查看本机内网 IP
- **Port Generator** — 生成随机网络端口号
- **Subnet Calculator** — IPv4 子网计算器
- **IPv4 Converter** — IPv4 地址与数字格式互相转换
- **IP Range Expander** — IP 范围转 CIDR 计算

### 系统工具 (8)
- **Clipboard Manager** — 剪贴板历史记录（Ctrl+Shift+V 读取）
- **Screen Info** — 屏幕分辨率/DPI/DPR/色彩深度/触摸屏
- **Browser Storage Viewer** — localStorage/sessionStorage 查看编辑
- **设备信息** — 设备和浏览器运行环境检测
- **Environment Variables** — 查看当前系统环境变量
- **Keyboard Tester** — 实时查看键盘按键的 KeyboardEvent
- **Mouse Tester** — 鼠标事件检测（坐标/滚轮/按键）
- **Timer & Stopwatch** — 秒表 · 倒计时 · 番茄钟 · 间歇训练

### 开发工具 (12)
- **AI Translator** — 基于 OpenAI 兼容 API 的多语言翻译
- **Cron Generator** — 可视化生成和解析 Cron 表达式
- **JSON Formatter** — 格式化、压缩、校验 JSON
- **Maven Dependency** — Maven Central 实时搜索依赖
- **File Generator** — 生成指定大小的测试文件
- **Regex Tester** — 正则表达式实时测试与替换
- **Diff Checker** — 逐行对比文本差异，高亮新增/删除/修改
- **XPath Tester** — XPath 表达式测试与 XML/HTML 节点查询
- **Data Format Converter** — CSV ↔ JSON ↔ XML 数据格式互转
- **JSON Converter** — JSON → TypeScript · TOML · XML · YAML
- **CSS Gradient Generator** — 可视化渐变生成器
- **HTML to JSX** — HTML 一键转 React JSX 语法

### 文本工具 (6)
- **Text Analyzer** — 实时文本统计与分析
- **Case Converter** — 大小写与命名格式实时转换（13 种）
- **Unicode Inspector** — 查看字符的 Unicode 详细信息
- **Lorem Ipsum Generator** — 虚拟占位文本生成
- **Diff Checker** — 逐行对比文本差异
- **Image Tools** — 图片转 Base64 · 图片信息查看

### 备忘录 (11)
- **Git Cheat Sheet** — Git 命令速查手册
- **Docker Cheat Sheet** — Docker 命令速查手册
- **npm Cheat Sheet** — npm / Yarn / pnpm 命令速查
- **Linux Cheat Sheet** — Linux 常用命令速查手册
- **Kubectl Cheat Sheet** — K8s 命令速查手册
- **ASCII Table** — ASCII 码表完整对照（0–127）
- **HTTP Status Codes** — HTTP 状态码速查手册（1xx–5xx）
- **Regex Cheat Sheet** — 正则表达式语法速查手册
- **HTML Entities** — HTML 实体字符速查手册
- **SQL Cheat Sheet** — SQL 常用语法速查手册
- **CSS Cheat Sheet** — Flexbox · Grid · 单位 · 选择器 · 动画速查

## 快捷功能

- **Ctrl+K** — 全局命令面板，搜索所有工具
- **Ctrl+Shift+V** — Clipboard Manager 读取剪贴板
- **Space** — Timer 组件开始/暂停
- **R** — Timer 组件重置
- **设置页** — 主题切换（浅色/深色/系统）、字体大小、AI 翻译配置、自动更新

## 技术栈

- **框架**: Electron 39 + React 19 + TypeScript 5.9
- **构建**: Vite 7 + electron-vite
- **UI**: Tailwind CSS + Lucide React（图标库）+ Radix UI
- **编辑器**: CodeMirror 6
- **更新**: electron-updater（GitHub Release 自动更新）

## 开发

```bash
npm install
npm run dev           # 开发模式 (localhost:4120)
npm run build:win     # 构建 Windows 安装包
npm run build:mac     # 构建 macOS 安装包
npm run build:linux   # 构建 Linux 安装包
npm run typecheck     # TypeScript 类型检查
npm run lint          # ESLint 检查
npm run format        # Prettier 格式化
```

## 更新日志

详见 [CHANGELOG.md](./CHANGELOG.md)
