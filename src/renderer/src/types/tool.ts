import type React from 'react'

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
}
