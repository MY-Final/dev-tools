import { cn } from '@renderer/lib/utils'
import { isWebRuntime } from '@renderer/lib/platform'
import { getTool } from '@renderer/tools/registry'

interface Props {
  currentPage: string
}

const SPECIAL_TITLES: Record<string, string> = {
  home: '首页',
  settings: '设置',
  about: '关于'
}

/**
 * 自绘标题栏：Windows 上原生按钮由 titleBarOverlay 画在右侧，
 * macOS 上红绿灯内嵌在左侧。整条是拖拽区，双击最大化由系统处理。
 * Linux 与 Web 端保持原生窗框 / 不渲染。
 */
export default function TitleBar({ currentPage }: Props): React.JSX.Element | null {
  if (isWebRuntime()) return null

  const platform = window.electron?.process?.platform ?? ''
  if (platform !== 'win32' && platform !== 'darwin') return null

  const pageTitle = SPECIAL_TITLES[currentPage] ?? getTool(currentPage)?.name ?? ''

  return (
    <header className={cn('titlebar', platform === 'darwin' && 'titlebar--darwin')}>
      <span className="titlebar-brand">Dev Tools</span>
      {pageTitle && (
        <>
          <span className="titlebar-sep" aria-hidden="true">
            /
          </span>
          <span className="titlebar-page">{pageTitle}</span>
        </>
      )}
    </header>
  )
}
