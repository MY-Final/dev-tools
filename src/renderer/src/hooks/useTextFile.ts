import { useCallback, useRef, useState } from 'react'

interface FileSource {
  content: string
  path: string
  name: string
  bytes: number
  truncated: boolean
}

interface UseTextFileResult {
  /** Currently opened file, or null for an unsaved scratch buffer. */
  file: FileSource | null
  error: string
  busy: boolean
  open: () => Promise<FileSource | null>
  save: (content: string, suggestedName?: string) => Promise<boolean>
  saveAs: (content: string, suggestedName?: string) => Promise<boolean>
  reset: () => void
}

function readError(err: unknown): string {
  if (err instanceof Error) return err.message
  return '文件操作失败'
}

/**
 * Opens and saves text files through the Electron bridge when it exists and
 * falls back to the browser pickers otherwise. Pages only need `open`/`save`
 * and the current file name.
 */
export function useTextFile(): UseTextFileResult {
  const [file, setFile] = useState<FileSource | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)

  const open = useCallback(async (): Promise<FileSource | null> => {
    if (inFlight.current || !window.file) return null
    inFlight.current = true
    setBusy(true)
    setError('')
    try {
      const opened = await window.file.open()
      if (!opened) return null
      const next: FileSource = {
        content: opened.content,
        path: opened.path,
        name: opened.name,
        bytes: opened.bytes,
        truncated: opened.truncated
      }
      setFile(next)
      return next
    } catch (err) {
      setError(readError(err))
      return null
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }, [])

  const saveTo = useCallback(
    async (content: string, suggestedName: string | undefined, targetPath?: string): Promise<boolean> => {
      if (inFlight.current || !window.file) return false
      inFlight.current = true
      setBusy(true)
      setError('')
      try {
        const result = await window.file.save({ content, suggestedName, filePath: targetPath })
        if (result.canceled) return false
        setFile({
          content,
          path: result.path,
          name: result.name,
          bytes: result.bytes,
          truncated: false
        })
        return true
      } catch (err) {
        setError(readError(err))
        return false
      } finally {
        inFlight.current = false
        setBusy(false)
      }
    },
    []
  )

  const save = useCallback(
    (content: string, suggestedName?: string): Promise<boolean> =>
      saveTo(content, suggestedName, file?.path || undefined),
    [file?.path, saveTo]
  )

  const saveAs = useCallback(
    (content: string, suggestedName?: string): Promise<boolean> =>
      saveTo(content, suggestedName ?? file?.name),
    [file?.name, saveTo]
  )

  const reset = useCallback(() => {
    setFile(null)
    setError('')
  }, [])

  return { file, error, busy, open, save, saveAs, reset }
}
