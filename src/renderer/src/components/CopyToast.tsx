import { AlertCircle } from 'lucide-react'

interface CopyToastProps {
  message: string | null
}

/** 复制失败时的统一提示，避免各页面各自实现一套 toast。 */
export default function CopyToast({ message }: CopyToastProps): React.JSX.Element | null {
  if (!message) return null

  return (
    <div className="toast-container" role="status" aria-live="polite">
      <div className="toast-item toast-item--error">
        <AlertCircle size={14} aria-hidden="true" />
        <span>{message}</span>
      </div>
    </div>
  )
}
