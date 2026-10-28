import type { ToolItem, ToolPlatform } from '@renderer/types/tool'
import { getIcon } from './icons'
import toolsData from './tools.json'

interface ToolConfig {
  id: string
  name: string
  shortDesc: string
  desc: string
  icon: string
  category: string
  categoryIcon: string
  isNew?: boolean
  usage?: string
  tags?: string[]
  platforms?: ToolPlatform[]
}

const DEFAULT_PLATFORMS: ToolPlatform[] = ['desktop', 'web']

export const tools: ToolItem[] = (toolsData as ToolConfig[]).map((tool) => ({
  id: tool.id,
  name: tool.name,
  shortDesc: tool.shortDesc,
  desc: tool.desc,
  icon: getIcon(tool.icon),
  category: tool.category,
  categoryIcon: getIcon(tool.categoryIcon),
  isNew: tool.isNew,
  usage: tool.usage,
  tags: tool.tags,
  platforms: tool.platforms ?? DEFAULT_PLATFORMS
}))

export function getTool(id: string): ToolItem | undefined {
  return tools.find((tool) => tool.id === id)
}

export function supportsWeb(tool: Pick<ToolItem, 'platforms'>): boolean {
  return tool.platforms.includes('web')
}
