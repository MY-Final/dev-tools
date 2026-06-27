# 工具注册规范 (Tool Registration Pattern)

## 添加一个新工具需要改动 5 处

假设工具 ID 为 `my-new-tool`：

### 1️⃣ tools.json — 添加配置

**文件:** `src/renderer/src/tools/tools.json`

```json
{
  "id": "my-new-tool",
  "name": "My New Tool",
  "shortDesc": "简短中文描述",
  "desc": "详细功能说明文字",
  "icon": "LucideIconName",
  "category": "所属分类",
  "categoryIcon": "Wrench"
}
```

> `icon` 必须是 [Lucide](https://lucide.dev) 图标名。如果图标缺失，Sidebar 会回退到 Wrench。

### 2️⃣ 创建页面组件

**新建文件:** `src/renderer/src/pages/MyNewTool.tsx`

```tsx
import type React from 'react'
import '../styles/my-new-tool.css'

export default function MyNewTool(): React.JSX.Element {
  return <div className="mnt-page">{/* UI */}</div>
}
```

**复杂逻辑 → 自定义 Hook**

新建 `src/renderer/src/tools/my-new-tool/useMyNewTool.ts`，页面组件导入使用。

### 3️⃣ registry.ts — 注册懒加载

**编辑:** `src/renderer/src/pages/registry.ts`

```ts
'my-new-tool': lazy(() => import('./MyNewTool')),
```

### 4️⃣ 创建 CSS 文件

**新建文件:** `src/renderer/src/styles/my-new-tool.css`

使用唯一前缀（如 `mnt-`）避免类名冲突。使用 `var(--color-*)` 主题变量。

### 5️⃣ main.css — 导入 CSS

**编辑:** `src/renderer/src/assets/main.css`

```css
@import '../styles/my-new-tool.css';
```

> 页面组件内也建议直接 `import '../styles/my-new-tool.css'`，便于自文档化。

### 不需要改的地方

| 文件 | 原因 |
|------|------|
| `App.tsx` | 自动通过 `getPageComponent(id)` 路由 |
| `tools/registry.ts` | 自动从 `tools.json` 读取 |
| `Sidebar` / `Home` | 自动通过 `tools` 数组渲染 |
| 路由配置 | 不存在路由配置文件 |

## 工具目录约定

```
tools/<tool-name>/
├── use<ToolName>.ts   # 自定义 hook（可选）
├── <data>.json        # 静态数据（可选）
└── ...                # 其他辅助文件
```

## 关键规则

- 使用 **React 函数组件** + 默认导出
- **CSS 类名前缀**与工具 ID 一致（如 `base64-codec` → 前缀 `bc-` 或 `base64-`）
- Hook 文件统一放在 `tools/<tool-name>/` 下
- 不要手动修改 `App.tsx` 或 Sidebar 来注册工具
