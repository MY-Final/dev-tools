# 工具脚手架使用指南

## 快速创建新工具

使用脚手架脚本可以在 30 秒内创建一个新工具的完整结构。

### 用法

```bash
npm run new-tool <tool-id> <tool-name> <category>
```

### 参数说明

| 参数 | 说明 | 格式 | 示例 |
|------|------|------|------|
| `tool-id` | 工具唯一标识 | kebab-case | `my-awesome-tool` |
| `tool-name` | 工具显示名称 | 任意文本 | `"我的酷工具"` |
| `category` | 工具分类 | 见下表 | `"开发工具"` |

### 可用分类

- `换算工具`
- `网络工具`
- `系统工具`
- `编码/加密`
- `开发工具`
- `文本工具`
- `备忘录`
- `资源搜索`

### 示例

```bash
# 创建一个 JSON 转 YAML 工具
npm run new-tool json-to-yaml "JSON 转 YAML" "开发工具"

# 创建一个 IP 归属地查询工具
npm run new-tool ip-lookup "IP 归属地" "网络工具"

# 创建一个正则表达式可视化工具
npm run new-tool regex-visualizer "正则可视化" "开发工具"
```

## 脚本功能

### 自动生成的文件

1. **页面组件** `src/renderer/src/pages/{ComponentName}.tsx`
   - 完整的 React 组件结构
   - 输入/输出双面板布局
   - 复制、清空功能
   - 导入自定义 Hook

2. **样式文件** `src/renderer/src/styles/{tool-id}.css`
   - 完整的 CSS 变量引用
   - 响应式布局
   - 深色/浅色主题适配

3. **自定义 Hook** `src/renderer/src/tools/{tool-id}/use{ComponentName}.ts`
   - TypeScript 类型定义
   - 状态管理逻辑
   - 业务逻辑占位符

### 自动更新的文件

4. **工具配置** `src/renderer/src/tools/tools.json`
   - 添加工具元数据
   - 自动标记为 `isNew: true`

5. **路由注册** `src/renderer/src/pages/registry.ts`
   - 添加 lazy import
   - 自动处理逗号

6. **样式入口** `src/renderer/src/assets/main.css`
   - 添加 `@import` 语句

## 开发流程

### 1. 运行脚本

```bash
npm run new-tool my-tool "我的工具" "开发工具"
```

输出：
```
✨ 工具脚手架生成成功！

工具信息:
  ID:       my-tool
  名称:     我的工具
  分类:     开发工具

已生成文件:
  📄 src/renderer/src/pages/MyTool.tsx
  🎨 src/renderer/src/styles/my-tool.css
  🪝 src/renderer/src/tools/my-tool/useMyTool.ts

已更新文件:
  📋 src/renderer/src/tools/tools.json
  📋 src/renderer/src/pages/registry.ts
  📋 src/renderer/src/assets/main.css
```

### 2. 完善工具描述

编辑 `tools.json`，修改以下字段：

```json
{
  "id": "my-tool",
  "name": "我的工具",
  "shortDesc": "简短描述（请修改）",  // ← 改这里
  "desc": "详细描述工具的功能和用途（请修改）",  // ← 改这里
  "usage": "说明如何使用这个工具（请修改）",  // ← 改这里
  "tags": ["通用"],  // ← 改这里
  "icon": "Wrench",  // ← 改这里（Lucide React 图标名）
  "category": "开发工具",
  "categoryIcon": "Wrench",
  "isNew": true
}
```

### 3. 实现业务逻辑

编辑 `src/renderer/src/tools/my-tool/useMyTool.ts`：

```typescript
export function useMyTool(): UseMyToolReturn {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')

  const process = useCallback((value: string) => {
    setInput(value)
    
    // TODO: 在此实现你的处理逻辑
    try {
      // 示例：JSON 美化
      const parsed = JSON.parse(value)
      const result = JSON.stringify(parsed, null, 2)
      setOutput(result)
    } catch (error) {
      setOutput(`错误: ${(error as Error).message}`)
    }
  }, [])

  // ...
}
```

### 4. 调整 UI 布局（可选）

编辑 `src/renderer/src/pages/MyTool.tsx`：

- 添加更多按钮/选项
- 修改布局（单面板/双面板/三栏）
- 添加图表/表格组件
- 集成 CodeMirror 编辑器

### 5. 运行测试

```bash
npm run typecheck  # 类型检查
npm run dev        # 启动开发服务器
```

## 命名规范

### tool-id（kebab-case）

✅ 正确示例：
- `json-formatter`
- `base64-codec`
- `ip-range-expander`

❌ 错误示例：
- `JsonFormatter`（PascalCase）
- `json_formatter`（snake_case）
- `JSON-Formatter`（大写字母）

### 文件名映射

| tool-id | 组件名 | Hook 名 |
|---------|--------|---------|
| `my-tool` | `MyTool` | `useMyTool` |
| `json-formatter` | `JsonFormatter` | `useJsonFormatter` |
| `ip-range-expander` | `IpRangeExpander` | `useIpRangeExpander` |

## 常见问题

### Q: 生成后运行 `npm run dev` 报错？

**A**: 运行 `npm run typecheck` 检查类型错误，确保 Hook 的业务逻辑没有语法问题。

### Q: 工具在侧边栏不显示？

**A**: 检查 `tools.json` 中的 `category` 是否拼写正确（必须完全匹配 8 个可用分类之一）。

### Q: 如何删除生成的工具？

**A**: 手动删除以下内容：
1. 删除 `src/renderer/src/pages/{ComponentName}.tsx`
2. 删除 `src/renderer/src/styles/{tool-id}.css`
3. 删除 `src/renderer/src/tools/{tool-id}/` 目录
4. 从 `tools.json` 中删除条目
5. 从 `registry.ts` 中删除 lazy import
6. 从 `main.css` 中删除 `@import`

### Q: 脚本支持哪些平台？

**A**: 纯 Node.js 实现，支持：
- ✅ Windows (PowerShell / CMD)
- ✅ macOS (zsh / bash)
- ✅ Linux (bash)

### Q: 可以自定义模板吗？

**A**: 可以，编辑 `scripts/new-tool.js` 中的以下变量：
- `pageTemplate`（页面模板）
- `cssTemplate`（样式模板）
- `hookTemplate`（Hook 模板）

## 高级用法

### 批量创建工具

```bash
# 创建多个相关工具
npm run new-tool md5-hash "MD5 哈希" "编码/加密"
npm run new-tool sha1-hash "SHA1 哈希" "编码/加密"
npm run new-tool sha256-hash "SHA256 哈希" "编码/加密"
```

### 自定义模板

如果你的工具需要特殊布局（如三栏布局、图表展示），可以：

1. 先用脚本生成基础代码
2. 参考现有类似工具的实现（如 `JsonFormatter.tsx`）
3. 手动调整布局和样式

### 复用已有 Hook

如果多个工具共享相同逻辑，可以：

```typescript
// 生成后手动修改导入路径
import { useJsonFormatter } from '@renderer/tools/json-formatter/useJsonFormatter'

// 复用 Hook
function MyNewTool(): React.JSX.Element {
  const { input, output, format } = useJsonFormatter()
  // ...
}
```

## 贡献指南

如果你发现模板有改进空间，欢迎提 PR：

1. Fork 项目
2. 修改 `scripts/new-tool.js`
3. 测试 `npm run new-tool test-feature "Test" "开发工具"`
4. 提交 PR

---

**Happy Coding!** 🚀
