#!/usr/bin/env node

/**
 * 跨平台工具脚手架脚本
 * 用法: npm run new-tool <tool-id> <tool-name> <category>
 * 示例: npm run new-tool my-tool "我的工具" "开发工具"
 */

const fs = require('fs')
const path = require('path')

// ────────────────────────────────────────────────────────────────
// 1. 参数解析与验证
// ────────────────────────────────────────────────────────────────

const [toolId, toolName, category] = process.argv.slice(2)

if (!toolId || !toolName || !category) {
  console.error(`
❌ 参数不足！

用法: npm run new-tool <tool-id> <tool-name> <category>

参数说明:
  tool-id     工具唯一标识（kebab-case，如: my-new-tool）
  tool-name   工具显示名称（如: "我的新工具"）
  category    工具分类（必须是以下之一）

可用分类:
  - 换算工具
  - 网络工具
  - 系统工具
  - 编码/加密
  - 开发工具
  - 文本工具
  - 备忘录
  - 资源搜索

示例:
  npm run new-tool my-awesome-tool "我的酷工具" "开发工具"
`)
  process.exit(1)
}

// 验证 tool-id 格式（kebab-case）
if (!/^[a-z][a-z0-9-]*$/.test(toolId)) {
  console.error(`❌ tool-id 必须是 kebab-case 格式（小写字母、数字、连字符）`)
  console.error(`   示例: my-tool, json-formatter, base64-codec`)
  process.exit(1)
}

// 验证分类
const validCategories = [
  '换算工具',
  '网络工具',
  '系统工具',
  '编码/加密',
  '开发工具',
  '文本工具',
  '备忘录',
  '资源搜索'
]

if (!validCategories.includes(category)) {
  console.error(`❌ 无效的分类: "${category}"`)
  console.error(`   必须是以下之一: ${validCategories.join(', ')}`)
  process.exit(1)
}

// ────────────────────────────────────────────────────────────────
// 2. 工具函数
// ────────────────────────────────────────────────────────────────

// kebab-case → PascalCase
function toPascalCase(str) {
  return str
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
}

// kebab-case → camelCase
function toCamelCase(str) {
  const pascal = toPascalCase(str)
  return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}

// 获取分类图标
function getCategoryIcon(cat) {
  const iconMap = {
    换算工具: 'Calculator',
    网络工具: 'Globe',
    系统工具: 'Monitor',
    '编码/加密': 'Lock',
    开发工具: 'Wrench',
    文本工具: 'FileText',
    备忘录: 'BookMarked',
    资源搜索: 'Search'
  }
  return iconMap[cat] || 'Wrench'
}

// ────────────────────────────────────────────────────────────────
// 3. 路径定义
// ────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..')
const TOOLS_JSON = path.join(ROOT, 'src/renderer/src/tools/tools.json')
const REGISTRY_TS = path.join(ROOT, 'src/renderer/src/pages/registry.ts')
const MAIN_CSS = path.join(ROOT, 'src/renderer/src/assets/main.css')

const componentName = toPascalCase(toolId)
const hookName = toCamelCase(toolId)

const PAGE_FILE = path.join(ROOT, `src/renderer/src/pages/${componentName}.tsx`)
const CSS_FILE = path.join(ROOT, `src/renderer/src/styles/${toolId}.css`)
const HOOK_DIR = path.join(ROOT, `src/renderer/src/tools/${toolId}`)
const HOOK_FILE = path.join(HOOK_DIR, `use${componentName}.ts`)

// ────────────────────────────────────────────────────────────────
// 4. 文件存在性检查
// ────────────────────────────────────────────────────────────────

if (fs.existsSync(PAGE_FILE)) {
  console.error(`❌ 页面文件已存在: ${PAGE_FILE}`)
  process.exit(1)
}

if (fs.existsSync(CSS_FILE)) {
  console.error(`❌ 样式文件已存在: ${CSS_FILE}`)
  process.exit(1)
}

// ────────────────────────────────────────────────────────────────
// 5. 模板生成
// ────────────────────────────────────────────────────────────────

const pageTemplate = `import { useState } from 'react'
import { Copy, Check, Trash2 } from 'lucide-react'
import { use${componentName} } from '@renderer/tools/${toolId}/use${componentName}'

function ${componentName}(): React.JSX.Element {
  const { input, output, process, reset } = use${componentName}()
  const [copied, setCopied] = useState(false)

  const handleCopy = async (): Promise<void> => {
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="${toolId}-page">
      <div className="${toolId}-container">
        <div className="${toolId}-panel">
          <div className="${toolId}-header">
            <h3>输入</h3>
            <button className="btn-icon" onClick={reset} title="清空">
              <Trash2 size={16} />
            </button>
          </div>
          <textarea
            className="${toolId}-input"
            value={input}
            onChange={(e) => process(e.target.value)}
            placeholder="在此输入内容..."
          />
        </div>

        <div className="${toolId}-panel">
          <div className="${toolId}-header">
            <h3>输出</h3>
            <button className="btn-icon" onClick={handleCopy} title="复制">
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <textarea
            className="${toolId}-output"
            value={output}
            readOnly
            placeholder="处理结果将显示在这里..."
          />
        </div>
      </div>
    </div>
  )
}

export default ${componentName}
`

const cssTemplate = `/* ${toolName} */

.${toolId}-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.${toolId}-container {
  flex: 1;
  display: flex;
  gap: 16px;
  padding: 20px;
  min-height: 0;
}

.${toolId}-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.${toolId}-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
}

.${toolId}-header h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.${toolId}-input,
.${toolId}-output {
  flex: 1;
  width: 100%;
  padding: 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  line-height: 1.6;
  resize: none;
  transition: border-color 0.2s;
}

.${toolId}-input:focus,
.${toolId}-output:focus {
  outline: none;
  border-color: var(--color-accent);
}

.${toolId}-output {
  background: var(--color-surface-subtle);
}
`

const hookTemplate = `import { useState, useCallback } from 'react'

interface Use${componentName}Return {
  input: string
  output: string
  process: (value: string) => void
  reset: () => void
}

export function use${componentName}(): Use${componentName}Return {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')

  const process = useCallback((value: string) => {
    setInput(value)
    
    // TODO: 在此实现你的处理逻辑
    try {
      const result = value.toUpperCase() // 示例：转大写
      setOutput(result)
    } catch (error) {
      setOutput(\`错误: \${(error as Error).message}\`)
    }
  }, [])

  const reset = useCallback(() => {
    setInput('')
    setOutput('')
  }, [])

  return { input, output, process, reset }
}
`

// ────────────────────────────────────────────────────────────────
// 6. 更新 tools.json
// ────────────────────────────────────────────────────────────────

console.log('📝 更新 tools.json...')
const toolsData = JSON.parse(fs.readFileSync(TOOLS_JSON, 'utf8'))

// 检查 ID 是否已存在
if (toolsData.some((t) => t.id === toolId)) {
  console.error(`❌ 工具 ID "${toolId}" 已存在于 tools.json 中`)
  process.exit(1)
}

const newTool = {
  id: toolId,
  name: toolName,
  shortDesc: '简短描述（请修改）',
  desc: '详细描述工具的功能和用途（请修改）',
  usage: '说明如何使用这个工具（请修改）',
  tags: ['通用'],
  icon: 'Wrench',
  category: category,
  categoryIcon: getCategoryIcon(category),
  isNew: true
}

toolsData.push(newTool)
fs.writeFileSync(TOOLS_JSON, JSON.stringify(toolsData, null, 2) + '\n', 'utf8')
console.log(`✅ 已添加到 tools.json`)

// ────────────────────────────────────────────────────────────────
// 7. 更新 registry.ts
// ────────────────────────────────────────────────────────────────

console.log('📝 更新 registry.ts...')
let registryContent = fs.readFileSync(REGISTRY_TS, 'utf8')

// 检查是否已存在
if (registryContent.includes(`'${toolId}':`)) {
  console.error(`❌ 工具 "${toolId}" 已注册在 registry.ts 中`)
  process.exit(1)
}

// 找到 pageMap 对象的最后一个条目，在它后面插入
const newEntry = `  '${toolId}': lazy(() => import('./${componentName}'))\n`

// 找到最后一个逗号的位置
const lastCommaMatch = registryContent.match(/,\n(\s*)\n?\s*\}/m)
if (!lastCommaMatch) {
  console.error('❌ 无法解析 registry.ts 结构')
  process.exit(1)
}

// 在最后一个条目后添加逗号，然后插入新条目
const lastCommaIndex = registryContent.lastIndexOf(',\n')
const closeBraceIndex = registryContent.indexOf('\n}', lastCommaIndex)

registryContent =
  registryContent.slice(0, closeBraceIndex) +
  ',\n' +
  newEntry +
  registryContent.slice(closeBraceIndex)

fs.writeFileSync(REGISTRY_TS, registryContent, 'utf8')
console.log(`✅ 已注册到 registry.ts`)

// ────────────────────────────────────────────────────────────────
// 8. 更新 main.css
// ────────────────────────────────────────────────────────────────

console.log('📝 更新 main.css...')
let mainCssContent = fs.readFileSync(MAIN_CSS, 'utf8')

// 检查是否已存在
if (mainCssContent.includes(`styles/${toolId}.css`)) {
  console.warn(`⚠️  ${toolId}.css 已在 main.css 中引入`)
} else {
  // 在最后一个 @import 后插入
  const lastImportIndex = mainCssContent.lastIndexOf("@import '../styles/")
  if (lastImportIndex !== -1) {
    const lineEnd = mainCssContent.indexOf('\n', lastImportIndex)
    const newImport = `@import '../styles/${toolId}.css';\n`
    mainCssContent =
      mainCssContent.slice(0, lineEnd + 1) + newImport + mainCssContent.slice(lineEnd + 1)
    fs.writeFileSync(MAIN_CSS, mainCssContent, 'utf8')
    console.log(`✅ 已添加到 main.css`)
  } else {
    console.warn('⚠️  无法自动更新 main.css，请手动添加 @import')
  }
}

// ────────────────────────────────────────────────────────────────
// 9. 生成文件
// ────────────────────────────────────────────────────────────────

console.log('📝 生成页面文件...')
fs.writeFileSync(PAGE_FILE, pageTemplate, 'utf8')
console.log(`✅ ${PAGE_FILE}`)

console.log('📝 生成样式文件...')
fs.writeFileSync(CSS_FILE, cssTemplate, 'utf8')
console.log(`✅ ${CSS_FILE}`)

console.log('📝 生成 Hook 文件...')
fs.mkdirSync(HOOK_DIR, { recursive: true })
fs.writeFileSync(HOOK_FILE, hookTemplate, 'utf8')
console.log(`✅ ${HOOK_FILE}`)

// ────────────────────────────────────────────────────────────────
// 10. 完成提示
// ────────────────────────────────────────────────────────────────

console.log(`
✨ 工具脚手架生成成功！

工具信息:
  ID:       ${toolId}
  名称:     ${toolName}
  分类:     ${category}

已生成文件:
  📄 ${path.relative(ROOT, PAGE_FILE)}
  🎨 ${path.relative(ROOT, CSS_FILE)}
  🪝 ${path.relative(ROOT, HOOK_FILE)}

已更新文件:
  📋 ${path.relative(ROOT, TOOLS_JSON)}
  📋 ${path.relative(ROOT, REGISTRY_TS)}
  📋 ${path.relative(ROOT, MAIN_CSS)}

下一步:
  1. 编辑 ${path.relative(ROOT, TOOLS_JSON)} 完善工具描述
  2. 编辑 ${path.relative(ROOT, HOOK_FILE)} 实现业务逻辑
  3. 根据需要调整 ${path.relative(ROOT, PAGE_FILE)} 的 UI 布局
  4. 运行 npm run dev 查看效果

Happy coding! 🚀
`)
