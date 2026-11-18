# 产品迭代 Loop 章程

> 这是 Dev Tools 持续迭代的工作说明。每一轮 loop 开始前先读本文件，结束后把结论写回「迭代日志」与「待办」。
> 目标不是继续堆工具，而是让「找到工具 → 用完 → 下次更快回来」这条用户闭环更短。

## 1. 产品定位

Dev Tools 是一个**本地优先**的开发工具箱：72 个工具、9 个分类，同时提供 Electron 桌面版和纯静态 Web 版。

- 桌面版：完整能力，包含需要原生环境的工具（内网 IP、环境变量、Maven 代理、自动更新）。
- Web 版：桌面版的子集，纯前端计算全部可用，原生能力明确降级并标注「桌面端」。
- 数据默认不出本机：计算在渲染进程完成，配置保存在本地。

## 2. 用户与需求

| 用户 | 典型任务 | 对产品的核心要求 |
|------|----------|------------------|
| 前端 | JSON/HTML/CSS 处理、编码解码、正则、颜色、Diff、Mock 数据 | 打开快、结果可复制、深色模式一致 |
| 后端 | JWT、哈希/HMAC、Cron、时间戳、数据格式转换、接口调试 | 参数准确、算法可信、失败信息清楚 |
| 运维 | 子网/IP、端口、命令速查、WebSocket/CORS 排查 | 离线可用、命令可复制、少跳转 |
| 通用/安全 | Base64、密码、UUID、证书、SSH Key | 本地计算、不误导、不泄露密钥 |

场景筛选（前端/后端/运维/通用/安全/网络）必须能反映真实用途，新增工具要带 `tags`。

## 3. 前端与后端的角色

| 层 | 角色 | 用户可感知的承诺 |
|----|------|------------------|
| 渲染层（前端 / React） | 所有纯计算、编辑器、交互与状态 | 即时响应、离线可用、结果可复制 |
| Electron 主进程（后端） | 原生能力：文件系统、剪贴板、环境变量、网络代理、自动更新、设置持久化 | 能力可用且失败可解释 |
| Web 兼容层（`web/api/web-api.ts`） | 用浏览器能力实现同一份 `contracts` | 能做什么、不能做什么必须显式说明 |

规则：

1. 渲染进程不直接使用 Node / `process.env`，统一走 `window.api`。
2. 同一能力只在一处定义契约（`src/shared/contracts.ts`），桌面与 Web 各自实现。
3. 依赖主进程代理的接口（如 Maven Central）在 Web 端必须明确报错，不能静默失败。
4. 能力差异在 `tools.json` 的 `platforms` 声明，由 UI 统一渲染「桌面端」标记。

## 4. UI/UX 与交互标准

每个切片不仅要「能用」，还要符合下面这些标准：

1. **视觉一致性**：沿用 Soft Minimalism 与 `--color-*` 变量；JetBrains Mono 用于标题/代码，Inter 用于正文；dark/light 两套主题都要成立。
2. **状态完整**：每个页面必须有 loading / empty / error / success 状态；空状态要给出下一步动作，不能是死路。
3. **即时反馈**：复制、保存、清空、生成等操作在 100ms 内有可见反馈；错误文案要说清「为什么 + 怎么办」。
4. **键盘与可访问性**：所有交互元素可 Tab 到达、有 `:focus-visible`；弹层支持 Esc 关闭并把焦点还给触发者；图标按钮必须有 `aria-label`。
5. **响应式**：至少检查 375 / 768 / 1024 三档；侧边栏在窄屏走抽屉或 flyout，不出现横向滚动。
6. **动效克制**：过渡控制在 120–200ms，只用于状态变化；尊重 `prefers-reduced-motion`。
7. **性能**：页面保持 lazy 加载；重计算做防抖/延迟；大列表避免每次输入全量重渲染。
8. **文案**：中文为主，技术术语保持原文，按钮用动词，错误不甩锅给用户。

## 5. 每轮固定检查

1. **用户闭环**：搜索、收藏、最近使用、命令面板是否让回访更快；空状态是否可恢复。
2. **UI/UX 走查**：对照第 4 节，至少检查本切片涉及的页面在 dark/light、键盘和窄屏下的表现。
3. **能力诚实**：Web 端不能用的功能是否有标记、说明与替代路径；错误信息是否可行动。
4. **文档同步**：README 工具清单/数量、`docs/project-state-*`、`AGENTS.md` 引用是否仍准确。
5. **质量门**：`npm run typecheck`、`npx eslint <changed>`、`npm run build:web`，并在浏览器里实际走一遍改动路径。

## 6. 待办（按优先级）

### P0

- [ ] README / AGENTS.md / project-state 文档漂移定期核对（本轮已同步 README 清单与数量）。
- [x] Web 端「仅支持桌面端」页面补上下载入口，而不是只写一句提示。
- [x] 最近使用需要「清空」入口与跨窗口一致性验证。

### P1

- [x] 最近使用出现在侧边栏收藏下方，减少回首页的跳转。
- [x] 搜索覆盖 `usage` 文本，并支持英文名/中文描述混合命中。
- [x] 设置页增加「恢复默认」的范围说明，避免误清空收藏/最近使用。
- [x] 全部工具页复制迁移到统一 `copyText`（渲染层已无 `navigator.clipboard.writeText` 直调，仅保留 `lib/clipboard.ts` 内部实现）。

### P2

- [x] 本地使用频次统计（仅存本地），用来决定下一批工具优化顺序。
- [x] 收藏与设置的导出/导入，方便换机。
- [x] 工具页统一「复制结果」反馈审计（58 页全部有反馈，DeviceInfo/MyIp toast 补 live region）。
- [x] 全站补充 `prefers-reduced-motion` 降级（`global.css` 已有全局规则，本轮核对确认）。
- [x] 首页卡片增加键盘方向键导航（左右/上下移动焦点，按几何位置跨分类连续移动）。

## 7. 迭代日志

### 2026-10-30 — UUID Decoder 支持 v6 / v7 时间戳

- 补齐时间解析：原来只解 v1 时间戳，v6 / v7 明明带时间信息却显示为空。现在 v6 按重排后的 60 位 Gregorian 时钟解析，v7 直接读前 48 位 Unix 毫秒；三者在同一「时间戳 (v版本)」区块展示 UTC ISO 时间。
- 位布局按版本切换字段名：v7 显示 `unix_ts_ms` / `ver + rand_a` / `var + rand_b`，v6 显示 `time_high` / `ver + time_low` / 时钟序列 / node，不再把 v1 的 `time_low` 等标签套到 v7 上。
- 示例补齐：新增 v6 与 v7 样例按钮，并给每个样例加 `title` 显示完整 UUID（按钮只显示前 8 位）。
- 验证：v7 `01920000-7d2a-…` 解析为 `2024-09-17T12:41:25.034Z`、v6 `1e0b3a2e-9e0b-…` 为 `2011-07-21T14:08:31.100Z`，均与独立计算的期望值一致；v1 样例仍为 `1998-02-04T22:13:53.151Z`；位布局 v7 为 3 行、v6 为 5 行、v1 为 6 行且字段名正确；Nil UUID 版本 0 / NCS 变体且不显示时间戳；无效输入正常报错；typecheck / ESLint（0 error）/ `build:web` 通过；reload 后 console 无新增错误。

### 2026-10-30 — Token Generator 错误状态与结果一致性

- JWT 输入错误不再伪装成结果：Header / Payload JSON 不合法时，原来会生成一条内容为 `Invalid JSON in header or payload` 的「Token」，还能被复制和导出。现在按 Header / Payload 分别报错（「Payload 不是有效的 JSON，请检查括号与引号。」），结果区红框提示，复制 / 导出按钮保持禁用。
- 切换 Token 类型或修改任一配置时清空旧结果：此前生成一批 UUID 后切到 JWT，结果区仍显示 UUID，容易被当成 JWT。现在切换类型、改数量 / 字符集 / Header 都会复位结果；进行中的 JWT 异步签名用任务序号作废，避免慢结果写回新类型。
- API Key 前缀为空 / 全空格时不再生成 `_xxxx` 这种畸形值，而是直接输出随机部分；前缀会先 trim。
- JWT 过期时间下方补充说明：生成时会自动写入 `iat`，并按所选有效期写入 `exp`（覆盖 Payload 中的同名声明），避免用户以为 Payload 里写的 exp 会生效。
- 验证：UUID 格式合法；JWT 解码后 `iat` / `exp` 相差 3600 秒、自定义 sub/role 保留；无效 Payload 显示错误且无可复制结果；切换类型后结果区回到空状态；空前缀 API Key 长度 24 且不以 `_` 开头；JWT 配置区可见 iat / exp 覆盖说明；typecheck / ESLint（0 error）/ `build:web` 通过；reload 后 console 无新增错误。

### 2026-10-30 — Timezone Converter 支持完整 IANA 时区

- 能力补齐：原来「添加时区」只能从 18 个常用城市里选，丹佛、加德满都这类时区根本加不进来。现在优先使用 `Intl.supportedValuesOf('timeZone')` 的全量 IANA 列表（实测 416–418 项可用），常用城市仍排在最前并保留中文名。
- 搜索支持 `Los Angeles` 与 `Los_Angeles` 两种写法（搜索文本同时匹配标签、IANA id 和去下划线后的 id），中文标签与英文地名都能命中。
- 兼容 V8 的旧拼写：`Asia/Katmandu`、`Asia/Calcutta`、`Asia/Saigon`、`Asia/Rangoon`、`America/Godthab` 显示为现代名称 Kathmandu / Kolkata / Ho Chi Minh / Yangon / Nuuk；现代 id 已在常用列表时跳过旧拼写行，避免同一时区出现两次。
- 修复多词城市名被截断：添加时原来用 `label.split(' ')[0]`，`Buenos Aires` 会变成 `Buenos`；现在只去掉末尾括注（`洛杉矶 (PST)` → `洛杉矶`），多词名称完整保留。
- 复查 console 中的 `America/Los_Angeles` 重复 key 警告：根因是常用列表里洛杉矶与旧金山同为该时区而 key 只用 tz；当前列表 key 已带 label，复测添加两地不再报错。顺手把新增时区的 id 从 `Date.now()` 改为自增计数器，避免同一毫秒连续添加撞 key。
- 验证：丹佛显示 `UTC-06:00` 且日期正确回退一天；加德满都显示 `UTC+05:45`；搜索 Kolkata 只出现常用列表里的「印度 (IST)」；回车添加首个结果、Esc 关闭并把焦点还给「添加时区」；375px 下添加面板与列表无横向溢出；typecheck / ESLint（0 error）/ `build:web` 通过；reload 后 console 无新增错误。

### 2026-10-30 — Regex Tester 移入 Worker，杜绝灾难性回溯冻结页面

- 定位风险：匹配与替换都在主线程 `useMemo` 里实时执行，`MAX_MATCHES` 只限制结果条数，挡不住回溯爆炸。用户输入 `(a+)+$` 配几十个 `a` 的文本，整页会卡死到无法操作。
- 现在正则匹配与替换在 Web Worker 中执行：输入变化后 120ms 防抖启动，超过 1.5 秒直接 `terminate`，页面展示「计算已中止 / 可能存在灾难性回溯（例如 `(a+)+`）」的可操作提示，而不是一直转圈。
- 正常路径保留上一次结果直到新结果返回，避免每敲一个字符高亮区闪烁；正则编译错误仍同步提示，无效正则不会启动 Worker。
- 构建：`?worker` 产出独立 `regex-runner.worker-*.js` chunk（2.61 kB），Web 与 Electron 渲染层共用同一份逻辑。
- 验证：`\d+` 匹配 3 处、分组替换 `[$1]` 输出正确；病态 `(a+)+$` + 42 个 `a` 在 1.69s 中止，期间主线程 100ms 心跳执行 16 次（页面未冻结）；改回普通正则后立即恢复匹配；reload 后 Worker 正常加载且 console 无新错误；typecheck / ESLint（0 error）/ `build:web` 通过。

### 2026-10-30 — Password Generator 熵值口径与弱口令提示

- 熵值不再忽略「排除易混淆字符」：原来按 26/26/10/26 的完整字符集算，勾选排除后实际字符池是 22/25/6/26，16 位密码显示的熵值从 103 bits 降到 100 bits；现在生成与统计共用同一套实际字符池。
- 检测模式的符号字符集从 32 改为工具自身的 26，避免把同一份密码算得比生成器更「安全」；统计面板补充说明「按检测到的字符类别估算，不统计字典词、重复模式与个人信息」。
- 新增弱口令提示：检测到 `password`、`123456`、`qwerty` 等常见片段，或全相同字符、连续递增/递减序列（`abcdefgh`）时，在结果上方提示「实际强度会明显低于熵值估算」，避免用户把「中等」当成安全。
- 修复复制状态残留：生成新密码或修改任一生成选项后，复制按钮会停留在「已复制」约 1.5 秒，容易让用户以为剪贴板里是新密码；现在密码变化即复位。
- 验证：`password` / `abcdefgh` / `aaaaaaaa` / `12345678` 均命中提示，`aB3$xY9!kL` 不误报；排除易混淆前后熵值 103 → 100；复制后「已复制」、重新生成 / 切换选项后复位且密码变化；375px 提示条与说明文字不溢出；typecheck / ESLint（0 error）/ `build:web` 通过；reload 后 console 无错误。

### 2026-10-30 — 粗指针设备固定图标列裁切审计

- 定位系统性原因：`base.css` 的触控规则会给所有 `button` / `[role="button"]` / `a[href]` 加 `min-width: 44px`，而不少行布局用了 24–32px 的固定列放图标按钮，触摸设备上按钮被撑宽后压住相邻文字或被面板裁掉。
- Screen Info：`.si-field` 的复制按钮列由 `24px` 改为 `auto`（窄容器同样），长值列保持 `minmax(0, 1fr)`；375px 下按钮右缘 350px，面板右缘 363px，不再溢出。
- Timezone Converter：`.tzc-item` 的删除按钮列固定 `32px` 改为 `auto`，日期列保留 132px 以保证「周五 2026-10-30」不被截断；≤600px 三列布局改为 `minmax(0,1fr) auto auto`，删除按钮完整可见（右缘 348px）。
- Todo Notes：日期栏左右箭头补 `aria-label`（此前只有 `title`，读屏拿不到名称）；`.tn-datebar` 首尾固定列改 `auto`；列表勾选按钮所在的 `28px` / `26px` 列改为 `auto`，修复 375px 下勾选按钮压住标题 6px 的问题（实测勾选右缘 71px、标题左缘 83px，间隙 12px）。
- 同类排查：全站 `grid-template-columns` 中带小固定列的选择器逐一核对，Diff Checker / Keyboard Tester / Mouse Tester / Password Generator / IP Range Expander 的固定列只放行号、键名、复选框或装饰图标，不承载按钮，无需改动。
- 验证：375px 移动仿真（`pointer: coarse` 生效）实测上述三页按钮尺寸与右缘、无横向滚动；恢复桌面宽度后布局正常；typecheck / ESLint（0 error）/ `build:web` 通过；reload 后 console 无错误。

### 2026-10-30 — Hash Generator 异步竞态与大文件提示

- 修复幽灵结果：文件计算中点击「清空」或移除文件，原来的异步任务结束后仍会把哈希写回，页面出现没有对应文件的摘要。现在文本 / 文件各有任务序号，切换、清空、换文件都会作废旧任务。
- 修复模式竞态：文件计算中切回文本并输入，文件哈希可能晚到并覆盖文本结果；现在文件任务在文本模式下直接失效。
- 换文件先清空旧结果：计算新文件期间不再显示上一个文件的哈希（结果区显示「正在计算…」）。
- 修复同一文件无法重复选择：移除文件后未重置 file input 的 value，再选同一个文件不会触发 change；现在选择 / 移除 / 清空都会重置。
- 大文件提示：>32MB 时提示「会先读入内存，MD5 在主线程计算，界面可能短暂无响应」，说明能力边界。
- 窄屏修复：结果行复制按钮在 375px 被固定 26px 列裁切，改为 `auto` 列宽。
- 验证：`abc` 五算法与标准值一致；`hello.txt` 文件哈希正确；计算中清空 / 切文本无幽灵结果；移除后重选同一文件可再次计算；34MB 文件提示出现；375px 无溢出；typecheck / ESLint（0 error）/ `build:web` 通过；reload 后无 console 错误。

### 2026-10-30 — Number Formatter 崩溃防护与进制精度

- 修复整页崩溃：小数位输入 `-1` 时 `Intl.NumberFormat` 抛 `RangeError`，页面直接进入错误边界（实测页面消失）。现在输入被限制在 0–20，`formatNumber` 内部再兜底 clamp。
- 进制不再 32 位截断：十六 / 八 / 二进制原用 `>>> 0`，`-5` 显示 `FFFFFFFB`、`4294967296` 变成 `0`。现在用 `BigInt` 精确展示（`-5` → `-5`、`4294967296` → `100000000`），并在结果下方说明小数会四舍五入、负值保留负号。
- 无效输入提示补充支持的小数与科学计数法写法（如 `1234.5`、`-2e3`）。
- 超长二进制（如 `1e20` 的 67 位）在卡片内换行，卡片最高 7.5em 可滚动，避免撑高整页；hover 标题显示完整值。
- 验证：小数位 `-1` / `99` 钳制、负数与大整数进制、`1e20`、百分比、无效输入、375px 均实测；typecheck / ESLint（0 error）/ `build:web` 通过；reload 后无 console 错误。

### 2026-10-30 — IPv4 Converter 严格解析与十六进制输入

- 修复静默误解析：与子网计算器同源的 `parseInt` 问题，`192.168.1.1x`、`1e2.1.1.1`、`3232235777abc` 原来都能被当成合法输入。现在点分地址每段必须是 1–3 位十进制数字，整数输入必须是 1–10 位纯数字且 ≤ 4294967295。
- 补十六进制输入：工具能输出 `0xC0A80101`，却无法把它粘回来转换。现在支持 `0x` + 1–8 位十六进制（如 `0xFFFFFFFF` → `255.255.255.255`），并提示识别到十六进制。
- 带前导零的地址统一显示规范形式（`192.168.001.001` → `192.168.1.1`），避免显示值与换算值不一致。
- 越界整数（如 4294967296）不再显示「检测到十进制整数」的误导提示。
- 窄屏修复：≤560px 时复制按钮被 24px 固定列裁切，改为 `auto` 列宽后 375px 完整可见。
- 验证：点分/十进制/十六进制/广播地址/前导零/非法串/越界值均实测；375px 无横向溢出；typecheck / ESLint（0 error）/ `build:web` 通过；reload 后无 console 错误。

### 2026-10-30 — Subnet Calculator 输入严格性与地址类型

- IP 解析严格化：原来用 `parseInt` 逐段解析，`192.168.1.1x`、`1e2.1.1.1` 都能通过并被当成合法地址。现在每段必须是 1–3 位十进制数字且 ≤ 255。
- 前缀不再静默截断：输入 33 原来被 clamp 成 `/32` 并给出 `/32` 结果，容易被误用。现在区分提示「IP 地址无效」与「前缀长度需为 0–32 的整数」。
- 地址类型补全：原来只判断 RFC 1918，`127.0.0.1` 会显示 Public。现在区分回环、链路本地（169.254/16）、CGNAT（100.64/10）、组播、保留、本网络；IP 类别也修正 127 段归 A。
- 窄屏修复：≤640px 时触控目标把复制按钮撑到 44px，结果行最后一列固定 24px，按钮被面板裁掉。改为 `auto` 列宽后 375px 下按钮完整可见。
- 验证：`/24`、`/31`、`/32`、`/0`、`127/8`、`100.64/10`、`169.254/16`、`224/4` 结果与类型正确；非法 IP、`/33`、内联 CIDR 失焦解析均实测；375px 无横向溢出；typecheck / ESLint（0 error）/ `build:web` 通过；reload 后无 console 错误。

### 2026-10-30 — Cron Generator 无效输入与永不触发的区分

- 解析错误分级：`99 * * * *` 原来也提示「请输入 5 个字段」，误导。现在区分「字段数量不对」（显示实际段数）与「字段值/语法无效」（列出 `*`、`a-b`、`*/n`、逗号列表、英文缩写等支持写法）。
- 生成器越界校验：在「指定」输入 99 分钟、0 号等越界值时，表达式面板直接提示「分钟「99」超出有效范围（0–59），当前表达式不会触发」，不再静默生成无效表达式、只显示一句「没有可用的执行时间」。
- 永不触发说明：合法但无解的组合（如 `0 0 31 2 *`）提示「40 年内没有匹配的执行时间，请检查日期与月份组合」，与「表达式无效」明确区分。
- 月份缩写还原：解析 `0 0 1 JAN *` 时描述从「in JAN」改为「in January」；星期英文缩写（`MON-FRI`）同样正确展开。
- 验证：4 段表达式、越界值、英文缩写、2 月 31 日、生成器越界/恢复/重置均实测；375px 无横向溢出；typecheck / ESLint（0 error）/ `build:web` 通过；reload 后无 console 错误。

### 2026-10-30 — JWT Decoder 时间声明与算法可信度

- 状态语义纠正：徽标「有效」改为「未过期」。本工具只解码、不验签，原「有效」容易被理解为签名可信；Signature 面板继续保留「仅解码展示，未验证签名有效性」。
- 补 `nbf` 判断：Token 未到生效时间时显示「未生效 · x 后生效」，不再笼统显示为未过期；同时 `exp` 与 `nbf` 冲突时以过期优先。
- 时间声明按 NumericDate 严格判断：`exp` 为字符串或 null 时不再被当成有效（原来的 truthy + 字符串比较会把 `"9999999999"` 判成未过期）。徽标显示「exp 无效」，时间列表提示「不是有效的 NumericDate」；`exp: 0` 正确判为已过期。
- 算法风险提示：Header 缺少 `alg` 或 `alg: none` 时显示警示条，说明 Token 无法验证 / 可被伪造，避免安全工具给人错误的安全感。
- 字节数改用 UTF-8 实际字节（`TextEncoder`），非 ASCII 的 `kid` 不再少算；解析失败文案同时覆盖「不是三段」与「不是有效 Base64URL JSON」两种情况。
- 验证：未来 exp、未来 nbf、exp=0、exp 字符串、无 alg、alg=none、非 ASCII kid、示例 Token、非法串均实测；375px 警告条无横向溢出；typecheck / ESLint（0 error）/ `build:web` 通过；reload 后无 console 错误。

### 2026-10-30 — URL Codec 表单编码与转换状态

- 新增「表单格式」开关（参数编码模式）：`encodeURIComponent` 会把空格编成 `%20`，但 `application/x-www-form-urlencoded` 需要 `+`。开启后编码把 `%20` 换成 `+`，解码先把 `+` 还原为空格再解码（`%2B` 仍正确得到字面量 `+`），工具栏提示随模式与开关切换。
- 修复模式切换后结果残留：此前从「参数编码」切到「完整 URL」，旧结果仍留在输出区，用户会误以为已按新规则转换。现在切换模式或表单开关都会清空旧结果，回到空状态提示。
- 输入为空时禁用编码/解码按钮，避免点击无任何反馈；失败文案改成可行动的具体原因（无效百分号编码如 `%ZZ` / 截断的 `%E4`，或无法编码的孤立代理项）。
- 交换按钮改为「结果移回输入并反向转换」：编码后点交换会立即解码回原文，方便一次编码/解码往返核对；输出补充 `aria-live="polite"`。
- 验证：中文参数编码、表单 encode/decode、`a%2Bb+c` → `a+b c`、`%ZZ` 错误、完整 URL 保留结构字符、模式切换清空、交换往返均实测通过；375px 无横向溢出；typecheck / ESLint（0 error）/ `build:web` 通过；reload 后无 console 错误。

### 2026-10-30 — Color Converter 现代 HSL 语法与透明度边界

- 补齐现代 HSL 写法：此前只接受 `hsl(239, 84%, 67%)` 逗号格式，CSS Color 4 的空格写法 `hsl(239 84% 67% / 50%)` 会被判为无效。现在逗号/空格均可，支持可选 `deg`、小数色相与饱和度，负数色相自动归一（`hsl(-121 84% 67%)` 等同 239°）。
- 明确透明度边界：`rgba(99,102,241,0.5)`、`hsl(... / 40%)` 原会被静默丢掉 alpha，用户以为拿到了半透明色。现在解析 alpha，并在结果区提示「已忽略透明度 50%，转换为不透明颜色」。
- 修复示例色块：HSL 示例 `hsl(270, 70%, 50%)` 此前没有色点，因为预览解析只认 HEX/RGB；同时 `#abcd` 这类 4/5 位 HEX 会被当成合法预览色。现在色点复用正式解析器，HSL 有色点，非法 HEX 正常报错，格式提示补充空格写法。
- 验证：HSL 逗号/空格/`deg`/小数/负色相结果与浏览器 `getComputedStyle` 一致；alpha 提示 40% / 50%；`#abcd` 报格式错误；HEX/RGB 示例与复制不受影响；375px 无横向溢出；typecheck / ESLint（0 error）/ `build:web` 通过，reload 后无 console 错误。

### 2026-10-30 — Base64 Codec 格式化 JSON 与识别边界

- 修复「格式化 JSON」方向错误：此前会把格式化后的 JSON 写回输入框，解码模式随即报「无效的 Base64 字符串」，格式化内容反而出现在输入区。现在格式化视图直接显示在输出区、可「还原输出」，输入保持不变；输入或方向变化后自动回到原始结果。
- 收紧「输入看起来像 Base64」判定：原规则会把 hello、testtest 等普通单词误报。现在要求长度 ≥ 8、字符集合法且能解码为可读 UTF-8；真实 Base64（含 URL-safe 无填充）仍能识别。
- 明确能力边界：解码使用 `TextDecoder('utf-8', { fatal: true })`，纯二进制不再显示成一串替换字符，而是提示「解码结果不是有效的 UTF-8 文本」；非法 Base64 仍提示「无效的 Base64 字符串」。
- 验证：JSON Base64 解码后格式化/还原、输入变更自动复位；hello / testtest 不误报，aGVsbG8= / 5L2g5aW9 正确提示；/w== 与非法字符串分别显示对应错误；375px 无溢出；typecheck / ESLint（0 error）/ `build:web` 通过，reload 后无 console 错误。

### 2026-10-30 — Data Size Converter 输入与进制一致性

- 修复跨模式换算错误：Binary 模式下输入 `10 MB`（十进制单位）时，`toBytes` 因单位不在当前进制表而直接按字节处理，结果缩成 0.0097 KiB 级。现在按输入单位自身的进制换算，再以当前模式展示（`10 MB` → 10,000,000 B / 9765.625 KiB）。
- 整串严格解析：`10abc` 不再被 `parseFloat` 静默当成 10；支持 `10 MB`、`10mib`、科学计数法，未知单位或非法字符显示可行动提示。
- 编辑态保留原始输入：此前输入 `10 MB` 会在每个按键后被换算值覆盖，无法完整输入。现在聚焦时显示原文（含长数字），失焦后显示换算结果，并在识别到单位时提示「已按输入的 MB 换算」。
- 修复整数精度截断：`1 GiB` 的 B 结果原为 `1073741800`（8 位有效数字），现在整数直接精确显示 `1073741824`。
- 快捷换算随进制切换：Binary 显示 KiB/MiB/GiB/TiB，Decimal 显示 KB/MB/GB/TB，避免十进制模式下点「1 GiB → MiB」却看不到 MiB；无结果时禁用「复制全部」。
- 验证：`10 MB`、`10 mib`、`1 GiB`、`1000 KB → MB` 结果正确；`10abc` 显示提示；聚焦输入不丢字符；375px 无溢出；typecheck / ESLint（0 error）/ `build:web` 通过；reload 后无 console 错误（编辑过程中的 HMR 中间态异常已随最终代码消失）。

### 2026-10-30 — Timezone Converter 窄屏日期、空状态与键盘操作

- 修复窄屏信息缺失：≤600px 时原来直接隐藏日期，只剩时间。时区常常跨日（实测纽约为周四、东京为周五），隐藏日期会误导；现在日期放到时间下方，网格两行展示，不再丢信息。
- 补齐空状态：删除全部时区后显示「时区对照」空面板与添加入口，而不是整块消失；「复制全部」在 0 个时区时禁用，避免复制空内容还提示成功。
- 添加面板键盘操作：回车添加首个搜索结果并收起，Esc 收起；面板关闭后焦点回到「添加时区」按钮，键盘用户不会掉回页面顶部。
- 修复 React 重复 key：洛杉矶与旧金山共用 `America/Los_Angeles`，列表以 tz 作 key 触发 duplicate key 报错；改为 label + tz 组合 key。
- 验证：东京/伦敦/纽约跨日显示正确，375px 日期可见且无溢出；空状态、复制禁用、回车/Esc、焦点归还均实测；typecheck / ESLint（0 error）/ `build:web` 通过，reload 后无 console 错误。

### 2026-10-30 — Number Base Converter 位宽范围与补码一致性

- 修复补码计算与页面说明不符：负数的补码此前直接返回原模式（-1 显示 `1111 1111`），而说明是「反码 + 1」。现在统一按 N 位取负（`-n & mask`）：-1 的反码 `0x0`、补码 `0x1`，正数结果不变（5 → `0xFA` / `0xFB`）。
- 新增位宽范围提示：「反码与补码」标题显示有符号范围（如 `8-bit · -128 ~ 127`）；输入超出范围时显示警告，说明反码/补码按低位截断，避免把 300 在 8-bit 下的补码误当成有效结果。
- 修复正数超位宽时二进制分组错位：300 在 8-bit 下从 `1001 0110 0` 改为补零到 4 位整数倍的 `0001 0010 1100`。
- 无法识别输入时列出支持的格式（十进制、`0x`、`0b`、`0o`），错误提示补充 `role="status"`。
- 验证：-1 / 5 / 300 / 42 各场景结果与警告正确；`xyz` 显示格式说明；375px 无横向溢出；typecheck / ESLint（0 error）/ `build:web` 通过，无 console 错误。

### 2026-10-30 — Unit Converter 可切换输入单位与严格解析

- 补齐产品缺口：输入单位此前固定为类别第一个单位（长度只能按 km、温度只能按 °C 输入）。现在输入框旁提供单位下拉，可任选类别内单位，结果行高亮并标注「输入」。
- 修复静默误算：`parseFloat` 会把 `12kg` 解析成 12、`1,000` 解析成 1。现在严格校验整个输入（小数、负数、科学计数法），非法输入不显示结果，并提示支持的写法。
- 复制结果时去掉千分位逗号（界面显示 `1,000,000`，复制得到 `1000000`），避免粘贴到代码后变成错误数值。
- 切换类别时输入单位重置为该类别首单位；重复点击当前类别不会清掉已选单位。
- 验证：1 ft → 0.3048 m / 12 in；1 km 复制 `1000000`；-40 °C → -40 °F / 233.15 K；1000 °F → 537.7777778 °C；`12kg` 显示错误提示；375px 无溢出；typecheck / ESLint（0 error）/ `build:web` 通过，无 console 错误。

### 2026-10-30 — Date Format Converter RFC 2822 与窄屏修复

- 修复 RFC 2822 行与 UTC String 完全相同的问题：原实现直接调用 `toUTCString()`，输出 `GMT` 且没有数字时区偏移。现在按 RFC 2822 输出本地时间与偏移（如 `Fri, 30 Oct 2026 11:37:56 +0800`），两者明确区分；验证该输出回填本页可解析回同一时间戳。
- 「当前时间」按钮把本地时间写回输入框：此前只清空输入、把输出冻结在点击瞬间，标注仍是「当前时间预览」，容易误以为输出在实时更新。现在输入为空时才是实时预览。
- 无效输入的错误提示改为可行动文案，列出支持的格式；输出区同步提示「输入无效，显示当前时间」，与空输入时的「当前时间预览」区分开。
- 修复 375px 布局：输出网格 `minmax(380px, 1fr)` 在窄屏下超出容器并被 `overflow: hidden` 裁掉复制按钮；改为 `minmax(min(100%, 380px), 1fr)`，长值（RFC 2822）换行而非截断，「当前时间」按钮占满一行。
- 验证：`2026-10-30 11:37:56` → RFC `+0800`、Unix `1793331476`；RFC 字符串回填得到同一时间；`2026-02-30` 显示错误与「输入无效」提示；375px 无横向溢出、无截断；typecheck / ESLint（0 error）/ `build:web` 通过，无 console 错误。

### 2026-10-30 — Timestamp Converter 本地时间与无效输入

- 修复「日期时间」输入框的时区错位：回填使用 UTC ISO 字符串，但字段标注系统本地时间，导致点击当前时间后输入框与结果相差 8 小时。现在统一用 `formatLocalInput` 按系统本地时区回填，时间戳输入、当前时间、快捷偏移三条路径一致。
- 结果行「本地时间」改为「所选时区」，hint 直接显示当前时区；系统时区不在预置 7 项列表时，下拉框注入「城市（本地）」选项，避免选择框显示与实际计算不一致。
- 新增无效输入反馈：时间戳非 10/13 位、日期无法解析时显示行内错误并清空另一侧输入；结果区提示「输入无效，显示当前时间」，不再让人误以为当前时间就是转换结果。
- 验证：填充 `0` → 日期 `1970-01-01 08:00:00`、所选时区 `1970/01/01 08:00:00`、ISO `1970-01-01T00:00:00.000Z`；`abc` → 错误文案出现且日期清空；`2026-10-30 11:37:56` → 时间戳 `1793331476` 往返一致；切换 Tokyo 后结果 +1 小时；375px 错误行无溢出；typecheck / ESLint（0 error）通过，无 console 错误。

### 2026-10-30 — Data Converter 源格式切换一致性

- 修复真实交互缺陷：把源格式改成当前目标格式时，目标下拉框会显示首个选项（如 YAML），但内部状态仍是 JSON，导致面板标签、提示和实际转换互相矛盾。
- 现在源格式与目标格式相同时自动交换方向（JSON → CSV），目标下拉框、面板标题和提示始终一致；目标格式依旧排除源格式。手动切换源格式与打开文件自动识别两条路径都覆盖。
- 验证：默认 CSV → JSON，切换源为 JSON 后目标变为 CSV、同格式提示消失；打开 JSON 文件自动识别后目标从 JSON 变为 CSV 且立即输出 CSV；JSON 尾逗号显示中文行列错误；合法数组转 CSV 输出 `a,b` 表头与两行数据；375px 无横向溢出；typecheck / ESLint（0 error）通过。

### 2026-10-30 — JSON 错误文案统一

- 抽出 `lib/json-error.ts` 共用解析错误描述：JSON Formatter、JSON Converter 以及走 `parseDocument` 的 Data Converter 现在使用同一套中文说明。
- 转换页错误从「英文 V8 原文 / 仅截取行内容」改为「JSON 格式错误（第 N 行第 M 列）：说明」，例如尾逗号、缺引号、数据不完整都能直接指明原因。
- 验证：`{"a":1,}` 显示「属性名必须使用双引号，或对象末尾多了逗号」、`[1,2,]` 显示「数组末尾多了逗号」、`{"a":` 显示「JSON 数据不完整…」；JSON Converter 复制失败仍显示统一错误 toast；JSON Formatter 复查正常；typecheck / ESLint（0 error）通过。

### 2026-10-30 — JSON Formatter 错误定位与编辑器高度修复

- 解析错误从引擎英文原文改为可行动的中文提示：数据不完整、属性名缺双引号/尾逗号、对象或数组尾逗号等；保留行列位置，并新增「定位到错误」按钮，输入提前结束时定位到文本末尾。
- 修复真实布局问题：`@uiw/react-codemirror` 外层的 `.cm-theme-*` 没有参与 flex 布局，导致输入编辑器只有内容高度（约 97px），面板下方大片空白无法点击；补齐 wrapper 的 flex 约束后编辑区撑满面板。
- 滚动同步从 `.jf-editor-area` 改到真正的滚动容器 `.cm-scroller`，大文件左右视图仍能同步。
- 验证：`{"a":` 显示「JSON 数据不完整…」并可定位到第 1 行第 6 列；`{a:1}` 显示「缺少属性名…」并跳到第 1 行第 2 列；`[1,2,]` 提示数组尾逗号；240 行 JSON 左右滚动 240px 同步；点击编辑区底部可聚焦；375px 错误条换行且无横向溢出；typecheck / ESLint（0 error）通过。

### 2026-10-30 — 命令面板按相关度排序

- `tool-search` 增加 `scoreToolQuery`：名称命中高于分类，分类高于描述/标签；名称前缀、词首和完全匹配额外加分，多个关键词累加。
- 命令面板有查询时按「相关度 → 收藏 → 本地使用次数 → 名称」排序，搜索 `json` 时名称命中的工具排在描述命中之前；空查询仍保持最近使用优先，Enter 仍回到上次工具。
- 首页搜索保持原有的分类分组与过滤行为，不因排序打乱分类结构。
- 验证：浏览器实测 `json` 结果为 JSON Formatter / JSON Converter 优先，收藏在同等相关度下置顶；`regex` 下常用 Regex Tester 排在 Cheat Sheet 前；方向键 + Enter 可打开第二项；空查询首项仍为最近工具；类型检查与 ESLint（0 error）通过。

### 2026-10-30 — 使用统计可直接打开工具

- 统计行从只读文本改为按钮：带 `aria-label`、hover/focus 样式和右侧箭头，点击即跳转对应工具，并正常计入最近使用与打开次数。
- `SettingsPage` 接入由 `App` 注入的 `navigate`，避免为跳转复制路由逻辑；窄屏隐藏箭头并保留「排名 / 名称 / 次数 + 占比条换行」布局。
- 验证：`typecheck`、ESLint（0 error）、`build:web` 通过；浏览器实测 12 次统计点击后跳转 JSON Formatter 且计数变 13、最近使用同步更新；375px 无横向溢出、箭头隐藏；无新增 console 错误。

### 2026-10-30 — 本地使用统计

- 打开工具时在 `recordRecentTool` 中同时累计 `toolUsage`：桌面端写入 `settings.json`，Web 端写入 localStorage，不上报、不联网。
- 计数有边界：最多 200 个工具、单工具封顶 100 万次；导入时过滤非数字/非正数计数与 `__proto__` 等键，避免脏配置污染设置对象。
- 设置页新增「数据」分组，把「备份与恢复」迁入，并新增「本地使用统计」：显示前 5 名、相对占比条与总打开次数，清空需二次确认，且不影响收藏与最近使用。
- 设置契约升至 v4，旧配置自动补 `toolUsage: {}`，Web 端旧 localStorage 同样兼容。
- 验证：`npm run typecheck`、ESLint（0 error）、`npm run build:web` 通过；浏览器实测两次打开计数为 2、导入清洗非法计数、v3 迁移保留收藏/最近使用、清空统计不影响最近使用、375px 无横向溢出；无新增 console 错误。

### 2026-10-30 — 设置备份与恢复

- 设置页新增「备份与恢复」：导出完整设置 JSON（外观、编辑器、快捷键、翻译配置、收藏与最近使用），导入后经 `normalizeSettings` 校验并立即生效。
- 桌面端新增 `settings:import` IPC（预加载与类型声明同步），Web 端 `web-api` 使用同一套规范化逻辑，两端的坏数据都会被兜底为默认值。
- 边界处理：导入限制 1 MB、拒绝非 dev-tools 的设置文件、非法 JSON 给出明确错误；导出文件名带日期，并提示文件中含翻译 API Key。
- 验证：`npm run typecheck`、ESLint（0 error）、`npm run build:web` 通过；浏览器实测导出结构与文件名、合法导入（主题/收藏即时变化）、非法 JSON 错误提示正常；刷新后无新增 console 错误。

### 2026-10-30 — 回访闭环 + 文档对齐

- 新增「最近使用」：打开工具时记录（最多 8 个，去重、最近优先），首页顶部展示；搜索/筛选时自动隐藏。
- 设置契约新增 `recentTools`，桌面端（JSON 设置）与 Web 端（localStorage）同时实现，旧配置自动补默认值。
- 首页搜索扩展到 `tags`，输入「后端」「运维」可直接命中场景工具。
- README 工具清单按 `tools.json` 重新生成，修正分类数量并补齐「资源搜索」「备忘录」。
- 新增 `docs/web-dual-mode-architecture.md`，补齐 AGENTS.md 中缺失的引用。
- 验证：`npm run typecheck` 通过；浏览器实测记录/去重/排序/搜索隐藏正常，无 console 错误。

### 2026-10-30 — 桌面端下载入口

- Web 端打开桌面专属工具时，`ElectronOnlyPage` 增加「下载桌面版」按钮，直达最新 Release。
- 验证：`typecheck:web` 通过；浏览器实测链接、`target`、文案正确，无 console 错误。

### 2026-10-30 — 搜索统一与多关键词

- 抽出 `lib/tool-search.ts`，首页与 Ctrl+K 命令面板共用同一套匹配逻辑，避免两处结果不一致。
- 搜索范围扩展到 `usage` 与 `tags`；空格分隔的多个词按 AND 匹配，支持「jwt 生成」「json 格式化」这类中英混合查询。
- 验证：`typecheck` 通过；浏览器实测多关键词与单关键词结果符合预期，无 console 错误。

### 2026-10-30 — 侧边栏最近使用

- 侧边栏在「收藏」下方新增「最近使用」分组，展开态直接列出工具，收起态通过 flyout 弹出，顺序与首页一致。
- 复用现有收藏分组样式与交互（hover/键盘/焦点归还），避免新增一套视觉语言。
- 验证：`typecheck` 通过；浏览器实测分组出现、工具列表与本地记录一致，无 console 错误。

### 2026-10-30 — 恢复默认二次确认 + Esc 快捷键冲突

- 「恢复默认」改为二次确认对话框，明确列出会重置外观、编辑器、快捷键、翻译配置、收藏与最近使用；关闭后焦点回到触发按钮。
- 修复交互 bug：弹层（设置对话框 / Ctrl+K 命令面板）打开时按 Esc，会同时触发全局「返回首页」快捷键，导致关闭弹层后跳到首页。现在弹层打开时 Esc 只交给弹层处理。
- 验证：`typecheck` 通过；浏览器实测 Esc 关闭弹层且停留在设置页、焦点归还、确认后 `recentTools` 清空，无 console 错误。

### 2026-10-30 — 复制反馈与动效无障碍审计

- 核对 58 个工具页：57 个有复制反馈，DeviceInfo 通过 toast 反馈，无静默复制。
- DeviceInfo / MyIp 的复制 toast 补充 `role="status"` + `aria-live="polite"`，屏幕阅读器能听到「已复制」。
- 核对动效：`global.css` 已有 `prefers-reduced-motion: reduce` 全局降级（transition/animation 0.01ms，cmd-palette / dialog 动画关闭），无需重复实现。
- 验证：`typecheck` 通过；浏览器检查样式表存在 reduced-motion 规则，无 console 错误。

### 2026-10-30 — 命令面板优先最近使用

- Ctrl+K 命令面板在空查询时把最近使用排在最前，直接 Enter 即可回到上次的工具；输入查询后仍按相关结果排序。
- 与首页、侧边栏共用同一份 `recentTools`，不新增存储。
- 验证：`typecheck` 通过；浏览器实测空查询首个结果为最近打开的 DeviceInfo，输入 `crontab` 仍命中 Cron Generator，无 console 错误。

### 2026-10-30 — 剪贴板失败兜底

- 新增 `lib/clipboard.ts` 的 `copyText()`：优先 Clipboard API，失败回退 `execCommand`，返回真实成功状态。
- 迁移 DeviceInfo / MyIp / Converter：复制失败时提示「复制失败，请手动选择」，不再出现未捕获的 `NotAllowedError`，也不再误报「已复制」。
- 背景：审计时发现一个 `Uncaught (in promise) NotAllowedError: Document is not focused`，全站共 84 处直接调用 `navigator.clipboard.writeText`，其余页面列为 P1 迁移。
- 验证：`typecheck` 通过；浏览器点击复制后 toast 正常、console 无未捕获错误。

### 2026-10-30 — JSON Formatter 反馈修复

- JSON Formatter 迁移到 `copyText`，失败时显示带错误色的「复制失败，请手动选择」，成功仍显示原提示。
- 发现并修复：`useJsonFormatter` 的 `toast` 状态从未被页面渲染，格式化成功/失败、复制提示等消息此前全部不可见。现在统一以 `role="status"` 的 toast 展示。
- 验证：`typecheck` 通过；浏览器实测复制失败/成功提示正确，点击格式化显示「格式化成功」。

### 2026-10-30 — 统一复制失败提示组件

- 新增 `components/CopyToast.tsx`，复用已有 `.toast-container` / `.toast-item` 样式并补充错误色，避免每页自定义。
- Base64 Codec / URL Codec 迁移到 `copyText`：失败时显示「复制失败，请手动选择」，成功仍显示按钮「已复制」。
- 验证：`typecheck` 通过；浏览器实测两页的失败 toast 与成功按钮状态，无 console 错误。

### 2026-10-30 — 首页卡片方向键导航

- 首页工具卡片支持方向键移动焦点：上下按列、左右按行，并按几何位置跨分类连续移动；到达边缘时保持不动，不会把焦点弹到页面其他区域。
- 只拦截卡片主按钮上的方向键，搜索框、标签与收藏按钮不受影响；移动后使用 `scrollIntoView({ block: 'nearest' })`，避免整页跳动。
- 验证：`typecheck` 通过、ESLint 0 error；浏览器实测 4 列网格下 Right → 下一张、Down → 同列下一行（索引 1 → 5）、首张卡 Left/Up 保持不动，无 console 错误。

### 2026-10-30 — 复制迁移收尾：全站统一 copyText

- 最后 13 个页面完成迁移：Clipboard Manager、Storage Viewer、Screen Info、USB Viewer、Keyboard Tester、Mouse Tester、Number Formatter、ASCII Table、Unicode Inspector、UUID Decoder、User-Agent Parser、XPath Tester、WebSocket Tester。
- 修复两处未捕获的 Promise 拒绝：Mouse Tester 直接调用 `writeText` 无 catch，User-Agent Parser / WebSocket Tester 使用 `.then()` 无 `catch`。
- 保留页面自有反馈机制：Clipboard Manager 继续用 `copyFeedback`（含图片分支），Unicode Inspector 继续用 `copyFailed` 提示，不重复叠加 toast。
- **里程碑**：渲染层直调 `navigator.clipboard.writeText` 归零，仅保留 `lib/clipboard.ts` 内部实现；所有复制入口都会在失败时给出可行动提示。
- 验证：`typecheck` 通过、ESLint 0 error；浏览器实测 Screen Info、ASCII Table、User-Agent Parser 的失败提示，无 console 错误。USB / Keyboard / Mouse / WebSocket 需要真实设备或连接，仅做类型与代码走查。

### 2026-10-30 — 复制迁移覆盖文档/翻译/日期/单位页

- HTML to JSX、NPM Search、Translator、Timezone Converter、Date Format Converter、Unit Converter 迁移到 `copyText` + `CopyToast`。
- Markdown Preview 已有自己的失败提示（`flashNotice`），只把底层换成带回退的 `copyText`，不叠加 toast。
- 全站直调 `navigator.clipboard.writeText` 降至 15 处（13 个文件）。
- 验证：`typecheck` 通过、ESLint 0 error；浏览器实测 Markdown Preview、Timezone、Unit、HTML to JSX 的失败反馈；NPM Search / Translator 依赖网络或翻译服务，本轮仅类型与代码走查，无 console 错误。

### 2026-10-30 — 复制迁移覆盖网络与生成器页

- IPv4 Converter、IP Range Expander、Docker Hub Search、CORS Checker、Gradient Generator、Lorem Ipsum、Number Base 迁移到 `copyText` + `CopyToast`。
- CORS Checker 原来直接 `navigator.clipboard.writeText(...).then(...)`，没有 `catch`：剪贴板被拒绝时既无反馈，还会产生未捕获的 Promise 拒绝。现在改为 `copyText`，失败有明确提示。
- 全站直调 `navigator.clipboard.writeText` 降至 22 处（20 个文件）。
- 验证：`typecheck` 通过、ESLint 0 error；浏览器实测 IPv4 / Gradient / Number Base / Lorem Ipsum 的失败提示；Docker Hub 与 CORS 需要真实网络结果，本轮仅类型与代码走查，无 console 错误。

### 2026-10-30 — 复制迁移覆盖格式转换与表格页

- Data Format Converter、JSON Converter、XML Formatter、CSV Editor、Color Converter、Case Converter 迁移到 `copyText`。
- Case Converter 保留原有的按钮内状态文案（复制 / 已复制 / 复制失败），只是底层改用带回退的 `copyText`，不额外叠加 toast，避免同一页面出现两套反馈。
- 全站直调 `navigator.clipboard.writeText` 降至 30 处（27 个文件）。
- 验证：`typecheck` 通过、ESLint 0 error；浏览器实测六页的失败反馈（CSV Editor 复制 CSV、Data Format 复制、JSON Converter 复制、XML 复制、Color 复制 HEX、Case 按钮变「复制失败」），无 console 错误。

### 2026-10-30 — 复制迁移覆盖文本/网络/安全页，修复 Web 端 SSH 生成崩溃

- Text Analyzer、Subnet Calculator、Port Generator、SSH Key Generator、HMAC Generator、Certificate Parser 迁移到 `copyText` + `CopyToast`。
- 修复真实能力边界 bug：SSH Key Generator 在 Web 端点击「生成密钥对」直接报 `process is not defined`，原因是渲染层读取 `process.env.USER/HOSTNAME`，违反「渲染进程不直接使用 Node」规则。现在默认注释改为 `dev-tools`，两端都能生成密钥。
- 全站直调 `navigator.clipboard.writeText` 降至 36 处（33 个文件）。
- 验证：`typecheck` 通过、ESLint 0 error；浏览器实测 Subnet / Port / HMAC / Text Analyzer / SSH 生成与复制失败提示，SSH 页面不再出现 `process is not defined`，无 console 错误。Certificate Parser 无现成 PEM 样本，本轮仅类型与代码走查。

### 2026-10-30 — 复制迁移覆盖加密/文件/资源页

- AES/DES Encryptor、Env Vars、File to Base64、Maven Dependency 迁移到 `copyText`，失败统一显示 `CopyToast`。
- File to Base64 的 Base64 / Data URL / `<img>` / `<video>` 四个复制入口共用同一失败处理，避免只修一部分。
- 说明：Env Vars 与 Maven Dependency 仅桌面端可用，Web 预览只验证到 `ElectronOnlyPage`；本次通过 `typecheck` 保证类型正确，桌面端行为需在 Electron 中回归。
- 全站直调 `navigator.clipboard.writeText` 降至 43 处（39 个文件）。
- 验证：`typecheck` 通过、ESLint 0 error；浏览器实测 AES 加密结果与 File to Base64 的失败提示，无 console 错误。

### 2026-10-30 — 复制迁移覆盖高频工具

- Password Generator、Regex Tester、Timestamp Converter、Diff Checker 迁移到 `copyText`，失败时显示统一 `CopyToast`。
- 这四个页面此前在剪贴板不可用时完全静默（点击后既无成功也无失败反馈），属于「看起来能用、实际没复制」的误导状态；现在失败会明确提示手动选择。
- 全站直调 `navigator.clipboard.writeText` 降至 54 处（43 个文件）。
- 验证：`typecheck` 通过、ESLint 0 error；浏览器实测四页失败提示，无 console 错误。

### 2026-10-30 — 复制迁移覆盖独立速查表与生成器

- Git / Docker 两个独立实现的速查表（`gcs-` / `dcs-`）迁移到 `copyText`，复制失败时显示 `CopyToast`，不再静默吞掉异常。
- Cron Generator 与 JWT Generator 的 hook 层复制改为 async：成功提示「已复制到剪贴板」，失败提示「复制失败，请手动选择」，沿用页面已有 toast。
- 全站直调 `navigator.clipboard.writeText` 从 63 处降到 59 处（47 个文件），剩余页面继续按此模式迁移。
- 验证：`typecheck` 通过、ESLint 0 error；浏览器实测四个页面的复制失败提示，无 console 错误。

### 2026-10-30 — 复制迁移扩展到共享组件

- 共享 `CheatSheet` 迁移到 `copyText`，一次覆盖 Linux / K8s / npm / SQL / Regex / CSS / HTML Entities / HTTP Status 8 个速查表。
- Token Generator、Hash Generator、JWT Decoder 同步迁移，复制失败统一显示 `CopyToast`。
- 验证：`typecheck` 通过；浏览器实测 Linux Cheat Sheet 与 Hash Generator 失败提示正常，Hash 结果计算正确，无 console 错误。
