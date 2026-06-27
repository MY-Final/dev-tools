import { useState, useCallback } from 'react'
import { Info, ChevronDown } from 'lucide-react'
import { tools } from '@renderer/tools/registry'
import { cn } from '@renderer/lib/utils'

interface ToolHelpProps {
  toolId: string
}

export default function ToolHelp({ toolId }: ToolHelpProps): React.JSX.Element | null {
  const [expanded, setExpanded] = useState(false)

  const tool = tools.find((t) => t.id === toolId)
  if (!tool?.usage) return null

  const toggle = useCallback(() => setExpanded((prev) => !prev), [])

  return (
    <div className={cn('tool-help', expanded && 'tool-help-expanded')}>
      <button className="tool-help-toggle" onClick={toggle}>
        <Info size={14} className="tool-help-icon" />
        <span className="tool-help-label">使用说明</span>
        <ChevronDown size={12} className="tool-help-arrow" />
      </button>
      {expanded && (
        <div className="tool-help-content">
          <p className="tool-help-text">{tool.usage}</p>
        </div>
      )}
    </div>
  )
}
