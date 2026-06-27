import { Download } from 'lucide-react'

function isWeb(): boolean {
  try {
    return window.electron?.process?.platform === 'web'
  } catch {
    return true // safe fallback for environments where window.electron doesn't exist
  }
}

export default function ElectronOnlyPage({
  children,
  toolName
}: {
  children: React.ReactNode
  toolName: string
}): React.JSX.Element {
  if (!isWeb()) {
    return <>{children}</>
  }

  return (
    <div className="electron-only-page">
      <div className="electron-only-card">
        <div className="electron-only-icon-wrapper">
          <Download size={32} />
        </div>
        <h2 className="electron-only-title">该工具仅支持桌面端</h2>
        <p className="electron-only-desc">
          「{toolName}」需要使用 Electron 桌面环境的原生能力，
          <br />
          当前浏览器中无法使用。
        </p>
        <p className="electron-only-hint">
          请下载 Dev Tools 桌面版来使用此功能
        </p>
        <div className="electron-only-divider" />
        <p className="electron-only-alt">
          其他大部分工具在浏览器中均可正常使用，尽情探索吧！
        </p>
      </div>
    </div>
  )
}
