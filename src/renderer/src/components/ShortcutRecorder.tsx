import { useState, useCallback, useRef } from 'react'
import { keyEventToShortcut } from '@renderer/lib/shortcuts'

interface Props {
  value: string
  onChange: (shortcut: string) => void
}

export default function ShortcutRecorder({ value, onChange }: Props): React.JSX.Element {
  const [recording, setRecording] = useState(false)
  const [displayValue, setDisplayValue] = useState(value)
  const inputRef = useRef<HTMLButtonElement>(null)

  const startRecording = useCallback(() => {
    setRecording(true)
    setDisplayValue('按下组合键...')
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      e.preventDefault()
      e.stopPropagation()

      // Esc 取消录制
      if (e.key === 'Escape') {
        setRecording(false)
        setDisplayValue(value)
        return
      }

      const shortcut = keyEventToShortcut(e as unknown as KeyboardEvent)
      if (shortcut) {
        onChange(shortcut)
        setDisplayValue(shortcut)
        setRecording(false)
      }
    },
    [onChange, value]
  )

  const handleBlur = useCallback(() => {
    setRecording(false)
    setDisplayValue(value)
  }, [value])

  const formatForDisplay = (s: string): string => {
    return s
      .replace(/Ctrl/g, navigator.platform.includes('Mac') ? '⌘' : 'Ctrl')
      .replace(/\+/g, ' + ')
  }

  return (
    <button
      ref={inputRef}
      className={`shortcut-recorder ${recording ? 'recording' : ''}`}
      onClick={startRecording}
      onKeyDown={recording ? handleKeyDown : undefined}
      onBlur={handleBlur}
      title={recording ? '按下组合键记录，Esc 取消' : '点击修改快捷键'}
    >
      <kbd>{formatForDisplay(displayValue)}</kbd>
      {recording && <span className="shortcut-recorder-hint">输入...</span>}
    </button>
  )
}
