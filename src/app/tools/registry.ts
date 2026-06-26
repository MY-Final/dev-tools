import type { ToolItem } from '@renderer/types/tool'
import { getIcon } from './icons'
import toolsData from './tools.json'

interface ToolConfig {
  id: string
  name: string
  desc: string
  icon: string
  category: string
  categoryIcon: string
  isNew?: boolean
}

export const tools: ToolItem[] = (toolsData as ToolConfig[]).map((tool) => ({
  id: tool.id,
  name: tool.name,
  desc: tool.desc,
  icon: getIcon(tool.icon),
  category: tool.category,
  categoryIcon: getIcon(tool.categoryIcon),
  isNew: tool.isNew
}))
