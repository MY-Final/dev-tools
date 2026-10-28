import type React from 'react'

export type ToolPlatform = 'desktop' | 'web'

export interface ToolItem {
  id: string
  name: string
  shortDesc: string
  desc: string
  usage?: string
  tags?: string[]
  icon: React.ComponentType<{ size?: number; className?: string }>
  category: string
  categoryIcon: React.ComponentType<{ size?: number; className?: string }>
  isNew?: boolean
  /** Shells this tool works in. Defaults to both when omitted in tools.json. */
  platforms: ToolPlatform[]
}
