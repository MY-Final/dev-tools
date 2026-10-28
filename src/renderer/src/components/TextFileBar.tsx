import { useCallback, useMemo } from 'react'
import { FilePlus2, FolderOpen, Save } from 'lucide-react'
import { useTextFile, type FileSource } from '@renderer/hooks/useTextFile'
import type { FileEncoding } from '../../../shared/contracts'
import '../styles/text-file-bar.css'

interface TextFileBarProps {
  /** Current buffer contents; used for saving and for the modified marker. */
  value: string
  /** Replaces the page buffer with the opened file. */
  onOpened: (file: FileSource) => void
  /** Clears the document and any attachment to the file on disk. */
  onNew?: () => void
  suggestedName?: string
  /** Forces a decoder instead of letting the main process detect it. */
  encoding?: FileEncoding
  disabled?: boolean
  /** Tool-specific controls appended to the same row. */
  children?: React.ReactNode
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Open / save row shared by the text tools. The Electron bridge enforces the
 * path rules; the browser build falls back to pickers, so pages never branch.
 */
export default function TextFileBar({
  value,
  onOpened,
  onNew,
  suggestedName,
  encoding = 'auto',
  disabled = false,
  children
}: TextFileBarProps): React.JSX.Element {
  const { file, error, busy, open, save, saveAs, reset } = useTextFile()

  const dirty = useMemo(() => file !== null && file.content !== value, [file, value])

  const handleOpen = useCallback(async () => {
    const opened = await open(encoding)
    if (opened) onOpened(opened)
  }, [open, encoding, onOpened])

  const handleSave = useCallback(() => {
    void save(value, suggestedName)
  }, [save, value, suggestedName])

  const handleSaveAs = useCallback(() => {
    void saveAs(value, suggestedName)
  }, [saveAs, value, suggestedName])

  const handleNew = useCallback(() => {
    reset()
    onNew?.()
  }, [reset, onNew])

  return (
    <div className="tfb">
      <div className="tfb-actions">
        <button className="tfb-btn" onClick={handleOpen} disabled={disabled || busy}>
          <FolderOpen size={13} />
          打开
        </button>
        <button className="tfb-btn" onClick={handleSave} disabled={disabled || busy}>
          <Save size={13} />
          保存
        </button>
        <button className="tfb-btn" onClick={handleSaveAs} disabled={disabled || busy}>
          另存为
        </button>
        <button className="tfb-btn tfb-btn-quiet" onClick={handleNew} disabled={disabled || busy}>
          <FilePlus2 size={13} />
          新建
        </button>
      </div>

      <div className="tfb-meta">
        {file ? (
          <>
            <span className="tfb-name" title={file.path || file.name}>
              {file.name}
            </span>
            <span className="tfb-size">{formatSize(file.bytes)}</span>
            {file.encoding === 'gbk' && <span className="tfb-encoding">GBK</span>}
            {dirty && <span className="tfb-dirty">已修改</span>}
            {file.truncated && <span className="tfb-warn">文件过大，仅载入前 32 MB</span>}
          </>
        ) : (
          <span className="tfb-name tfb-name-empty">未关联文件</span>
        )}
      </div>

      {error && <span className="tfb-error">{error}</span>}
      {children}
    </div>
  )
}
