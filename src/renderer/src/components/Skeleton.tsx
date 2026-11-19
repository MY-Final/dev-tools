import { cn } from '@renderer/lib/utils'

interface SkeletonProps {
  width?: number | string
  height?: number | string
  radius?: string
  className?: string
}

/** 基础占位块：宽度/高度/圆角都由调用方给，动画在 CSS 里统一 */
export function Skeleton({
  width = '100%',
  height = 12,
  radius = 'var(--radius-xs)',
  className
}: SkeletonProps): React.JSX.Element {
  return (
    <span
      className={cn('skeleton', className)}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  )
}

interface SkeletonListProps {
  rows?: number
  /** 读屏文案：列表内容未知时说明在等什么 */
  label?: string
  /** 嵌在已有 role="status" 的容器里时关掉，避免重复播报 */
  announce?: boolean
  className?: string
}

/**
 * 列表骨架：头像块 + 两行文字，对应 npm / Docker / Maven 这类结果列表。
 * 比「正在搜索…」一行字更能稳住布局，结果到达时不会跳动。
 */
export function SkeletonList({
  rows = 4,
  label = '正在加载列表',
  announce = true,
  className
}: SkeletonListProps): React.JSX.Element {
  return (
    <div
      className={cn('skeleton-list', className)}
      role={announce ? 'status' : undefined}
      aria-live={announce ? 'polite' : undefined}
      aria-busy={announce ? 'true' : undefined}
    >
      {announce && <span className="sr-only">{label}</span>}
      {Array.from({ length: rows }, (_, index) => (
        <div className="skeleton-row" key={index} aria-hidden="true">
          <Skeleton width={30} height={30} radius="var(--radius-sm)" />
          <div className="skeleton-row-lines">
            <Skeleton width={`${64 - (index % 3) * 9}%`} height={11} />
            <Skeleton width={`${42 - (index % 2) * 7}%`} height={9} />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * 整页骨架：lazy 页面加载时替代「Loading…」，
 * 结构与 .tool-shell 一致（页头两行 + 一块面板），切页时不会闪出空白。
 */
export function PageSkeleton(): React.JSX.Element {
  return (
    <div className="tool-shell page-skeleton" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">正在加载页面</span>
      <div className="tool-shell-main" aria-hidden="true">
        <div className="page-skeleton-head">
          <Skeleton width={168} height={18} radius="var(--radius-sm)" />
          <Skeleton width={260} height={11} />
        </div>
        <div className="page-skeleton-panel">
          <div className="page-skeleton-toolbar">
            <Skeleton width="38%" height={30} radius="var(--radius-md)" />
            <Skeleton width={92} height={26} radius="var(--radius-md)" />
          </div>
          <SkeletonList rows={5} announce={false} />
        </div>
      </div>
    </div>
  )
}
