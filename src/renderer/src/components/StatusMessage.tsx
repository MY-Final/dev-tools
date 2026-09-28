import type { ReactNode } from 'react'
import { cn } from '@renderer/lib/utils'

type StatusMessageTone = 'neutral' | 'success' | 'error'

interface StatusMessageProps {
  children: ReactNode
  tone?: StatusMessageTone
  busy?: boolean
  srOnly?: boolean
  className?: string
  id?: string
}

export default function StatusMessage({
  children,
  tone = 'neutral',
  busy = false,
  srOnly = false,
  className,
  id
}: StatusMessageProps): React.JSX.Element {
  const isError = tone === 'error'

  return (
    <div
      id={id}
      className={cn(
        'status-message',
        `status-message--${tone}`,
        srOnly && 'status-message--sr-only',
        className
      )}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      aria-atomic="true"
      aria-busy={busy || undefined}
    >
      {children}
    </div>
  )
}
