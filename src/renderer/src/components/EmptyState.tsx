import type { ComponentType, ReactNode } from 'react'
import { cn } from '@renderer/lib/utils'

type IconComponent = ComponentType<{ size?: number; className?: string }>

interface EmptyStateAction {
  label: string
  onClick: () => void
  icon?: IconComponent
}

interface EmptyStateProps {
  /** 与页面语义相关的图标；纯提示类空状态可不传 */
  icon?: IconComponent
  title: string
  /** 补充说明：告诉用户下一步能做什么，比单纯「没有数据」有用 */
  description?: ReactNode
  action?: EmptyStateAction
  /** sm 用于面板内嵌的小区域（列表、预设筛选），md 用于整块内容区 */
  size?: 'sm' | 'md'
  tone?: 'neutral' | 'error'
  className?: string
  /** 结果随搜索变化时播报；初始态（还没操作）不传，避免无谓打断 */
  live?: boolean
}

/**
 * 统一空状态：图标 + 标题 + 说明 + 可选操作。
 * 之前各页面各写一套（ev-empty / npm-empty / clm-empty …），
 * 尺寸和语气不一致；新页面一律用这个。
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = 'md',
  tone = 'neutral',
  className,
  live = false
}: EmptyStateProps): React.JSX.Element {
  const ActionIcon = action?.icon

  return (
    <div
      className={cn(
        'empty-state',
        size === 'sm' && 'empty-state--sm',
        tone === 'error' && 'empty-state--error',
        className
      )}
      role={live ? 'status' : undefined}
      aria-live={live ? 'polite' : undefined}
    >
      {Icon && (
        <span className="empty-state-icon" aria-hidden="true">
          <Icon size={size === 'sm' ? 16 : 24} />
        </span>
      )}
      <p className="empty-state-title">{title}</p>
      {description && <p className="empty-state-desc">{description}</p>}
      {action && (
        <button type="button" className="empty-state-action" onClick={action.onClick}>
          {ActionIcon && <ActionIcon size={13} />}
          {action.label}
        </button>
      )}
    </div>
  )
}
