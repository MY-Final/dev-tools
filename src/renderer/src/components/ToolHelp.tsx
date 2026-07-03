import { Info } from 'lucide-react'
import { tools } from '@renderer/tools/registry'

interface ToolHelpProps {
  toolId: string
}

export default function ToolHelp({ toolId }: ToolHelpProps): React.JSX.Element | null {
  const tool = tools.find((t) => t.id === toolId)
  if (!tool?.usage) return null

  return (
    <div className="tool-help">
      <div className="tool-help-heading">
        <Info size={14} className="tool-help-icon" />
        <span className="tool-help-label">使用说明</span>
      </div>
      <div className="tool-help-content">
        <p className="tool-help-text">{tool.usage}</p>
      </div>
    </div>
  )
}
