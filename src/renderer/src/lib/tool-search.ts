export interface SearchableTool {
  name: string
  desc: string
  category: string
  usage?: string
  tags?: string[]
}

/**
 * 多关键词搜索：空格分隔的每个词都必须在名称/描述/分类/标签/用法中出现。
 * 英文大小写不敏感，中英文可混用。
 */
export function matchesToolQuery(tool: SearchableTool, query: string): boolean {
  return scoreToolQuery(tool, query) > 0
}

/**
 * 相关度评分：名称命中 > 分类命中 > 描述/标签命中。
 * 多个关键词会累加；名称前缀与词首命中额外加权，便于命令面板排序。
 */
export function scoreToolQuery(tool: SearchableTool, query: string): number {
  const raw = query.trim().toLowerCase()
  if (!raw) return 1

  const terms = raw.split(/\s+/).filter(Boolean)
  const name = tool.name.toLowerCase()
  const category = tool.category.toLowerCase()
  const details = [tool.desc, tool.usage ?? '', ...(tool.tags ?? [])].join(' ').toLowerCase()

  let score = 0
  for (const term of terms) {
    const nameIndex = name.indexOf(term)
    if (nameIndex >= 0) {
      score += 8
      if (nameIndex === 0) score += 6
      if (nameIndex === 0 || /[^a-z0-9]/.test(name[nameIndex - 1])) score += 3
    } else if (category.includes(term)) {
      score += 3
    } else if (details.includes(term)) {
      score += 1
    } else {
      return 0
    }
  }

  if (name === raw) score += 20
  return score
}
