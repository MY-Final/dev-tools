import { useState, useCallback } from 'react'
import {
  Database,
  Trash2,
  Copy,
  Check,
  Edit3,
  X,
  Save,
  RefreshCw,
  Plus,
  ChevronRight
} from 'lucide-react'
import '../styles/storage-viewer.css'

type StorageType = 'localStorage' | 'sessionStorage'

interface StorageEntry {
  key: string
  value: string
  rawSize: number
}

function getStorage(storageType: StorageType): Storage {
  return storageType === 'localStorage' ? localStorage : sessionStorage
}

function getEntries(storageType: StorageType): StorageEntry[] {
  const storage = getStorage(storageType)
  const entries: StorageEntry[] = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)!
    const value = storage.getItem(key) || ''
    entries.push({ key, value, rawSize: new Blob([value]).size })
  }
  return entries.sort((a, b) => a.key.localeCompare(b.key))
}

function getStorageByteSize(storage: Storage): number {
  let total = 0
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key === null) continue
    total += new Blob([key]).size
    total += new Blob([storage.getItem(key) ?? '']).size
  }
  return total
}

// ── Component ──────────────────────────────────────────────────

export default function StorageViewer(): React.JSX.Element {
  const [storageType, setStorageType] = useState<StorageType>('localStorage')
  const [entries, setEntries] = useState<StorageEntry[]>(() => {
    try {
      return getEntries('localStorage')
    } catch {
      return []
    }
  })
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [error, setError] = useState(() => {
    try {
      getEntries('localStorage')
      return ''
    } catch (err) {
      return err instanceof Error ? err.message : '读取存储失败'
    }
  })
  const [showAdd, setShowAdd] = useState(false)

  const refresh = useCallback(() => {
    try {
      setEntries(getEntries(storageType))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取存储失败')
    }
  }, [storageType])

  const selectStorageType = useCallback((nextStorageType: StorageType) => {
    setStorageType(nextStorageType)
    setSelectedKey(null)
    setEditingKey(null)
    try {
      setEntries(getEntries(nextStorageType))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取存储失败')
    }
  }, [])

  const selectEntry = useCallback((key: string) => {
    setSelectedKey((prev) => (prev === key ? null : key))
    setEditingKey(null)
  }, [])

  const startEdit = useCallback((key: string, value: string) => {
    setEditingKey(key)
    setEditingValue(value)
  }, [])

  const saveEdit = useCallback(() => {
    if (!editingKey) return
    try {
      const storage = getStorage(storageType)
      storage.setItem(editingKey, editingValue)
      setEditingKey(null)
      setEntries(getEntries(storageType))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    }
  }, [editingKey, editingValue, storageType])

  const deleteEntry = useCallback(
    (key: string) => {
      try {
        const storage = getStorage(storageType)
        storage.removeItem(key)
        if (selectedKey === key) setSelectedKey(null)
        if (editingKey === key) setEditingKey(null)
        setEntries(getEntries(storageType))
        setError('')
      } catch (err) {
        setError(err instanceof Error ? err.message : '删除失败')
      }
    },
    [storageType, selectedKey, editingKey]
  )

  const addEntry = useCallback(() => {
    if (!newKey.trim()) {
      setError('请输入 Key')
      return
    }
    try {
      const storage = getStorage(storageType)
      storage.setItem(newKey.trim(), newValue)
      setNewKey('')
      setNewValue('')
      setShowAdd(false)
      setEntries(getEntries(storageType))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加失败')
    }
  }, [newKey, newValue, storageType])

  const copyEntry = useCallback(async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 1500)
    } catch {
      /* ignore */
    }
  }, [])

  const clearAll = useCallback(() => {
    try {
      const storage = getStorage(storageType)
      storage.clear()
      setSelectedKey(null)
      setEntries([])
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '清空失败')
    }
  }, [storageType])

  const totalSize = entries.reduce((sum, e) => sum + e.rawSize, 0)
  const estimatedUsed = getStorageByteSize(localStorage) + getStorageByteSize(sessionStorage)

  return (
    <div className="sv-page tool-page">
      <header className="tool-page-header">
        <div className="tool-page-heading">
          <h2 className="tool-page-title">Browser Storage Viewer</h2>
          <p className="tool-page-desc">
            查看、编辑和清理当前窗口的 localStorage 与 sessionStorage。
          </p>
        </div>
        <div className="tool-page-actions">
          <button
            type="button"
            className="tool-btn tool-btn--primary"
            onClick={() => setShowAdd(!showAdd)}
          >
            <Plus size={14} aria-hidden="true" />
            添加
          </button>
          <button
            type="button"
            className="tool-btn tool-btn--outline"
            onClick={refresh}
            title="刷新"
            aria-label="刷新存储"
          >
            <RefreshCw size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="tool-btn tool-btn--outline"
            onClick={clearAll}
            disabled={entries.length === 0}
          >
            <Trash2 size={14} aria-hidden="true" />
            清空
          </button>
        </div>
      </header>

      <section className="tool-panel sv-toolbar">
        <div className="sv-toolbar-row">
          <div className="tool-segmented" role="group" aria-label="存储类型">
            {(['localStorage', 'sessionStorage'] as StorageType[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`tool-seg ${storageType === t ? 'active' : ''}`}
                onClick={() => selectStorageType(t)}
                aria-pressed={storageType === t}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="sv-stats">
            <span>{entries.length} 条</span>
            <span className="sv-stats-sep" aria-hidden="true" />
            <span>
              当前 {totalSize < 1024 ? `${totalSize} B` : `${(totalSize / 1024).toFixed(1)} KB`}
            </span>
            <span className="sv-stats-sep" aria-hidden="true" />
            <span>
              合计{' '}
              {estimatedUsed < 1024
                ? `${estimatedUsed} B`
                : `${(estimatedUsed / 1024).toFixed(1)} KB`}
            </span>
          </div>
        </div>

        {showAdd && (
          <div className="sv-add-form">
            <input
              className="tool-input sv-add-key"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="Key"
              aria-label="新条目 Key"
              spellCheck={false}
            />
            <input
              className="tool-input sv-add-value"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Value"
              aria-label="新条目 Value"
              spellCheck={false}
            />
            <button type="button" className="tool-btn tool-btn--primary" onClick={addEntry}>
              <Save size={13} aria-hidden="true" />
              保存
            </button>
            <button
              type="button"
              className="tool-btn tool-btn--outline"
              onClick={() => setShowAdd(false)}
              aria-label="取消添加"
            >
              <X size={13} aria-hidden="true" />
            </button>
          </div>
        )}

        {error && (
          <p className="sv-error" role="status">
            {error}
          </p>
        )}
      </section>

      <section className="tool-panel sv-list">
        <div className="tool-panel-head">
          <h3 className="tool-panel-title">条目</h3>
          <span className="sv-list-hint">点击条目展开内容</span>
        </div>

        {entries.length === 0 ? (
          <div className="sv-empty">
            <Database size={24} aria-hidden="true" />
            <span>{storageType} 中暂无数据</span>
            <span className="sv-empty-hint">点击「添加」写入第一条记录。</span>
          </div>
        ) : (
          <div className="sv-entries">
            {entries.map((entry) => {
              const expanded = selectedKey === entry.key
              return (
                <div key={entry.key} className={`sv-entry ${expanded ? 'selected' : ''}`}>
                  <button
                    type="button"
                    className="sv-entry-head"
                    onClick={() => selectEntry(entry.key)}
                    aria-expanded={expanded}
                  >
                    <ChevronRight size={14} className="sv-entry-chevron" aria-hidden="true" />
                    <span className="sv-entry-key" title={entry.key}>
                      {entry.key}
                    </span>
                    <span className="sv-entry-size">
                      {entry.rawSize < 1024
                        ? `${entry.rawSize} B`
                        : `${(entry.rawSize / 1024).toFixed(1)} KB`}
                    </span>
                  </button>

                  {expanded && (
                    <div className="sv-entry-body">
                      {editingKey === entry.key ? (
                        <>
                          <textarea
                            className="sv-textarea"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            rows={5}
                            aria-label={`编辑 ${entry.key} 的值`}
                            spellCheck={false}
                          />
                          <div className="sv-entry-actions">
                            <button
                              type="button"
                              className="tool-btn tool-btn--primary"
                              onClick={saveEdit}
                            >
                              <Save size={13} aria-hidden="true" />
                              保存
                            </button>
                            <button
                              type="button"
                              className="tool-btn tool-btn--outline"
                              onClick={() => setEditingKey(null)}
                            >
                              <X size={13} aria-hidden="true" />
                              取消
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <pre className="sv-entry-value">{entry.value}</pre>
                          <div className="sv-entry-actions">
                            <button
                              type="button"
                              className="tool-btn"
                              onClick={() => copyEntry(entry.value, entry.key)}
                            >
                              {copiedKey === entry.key ? (
                                <Check size={13} aria-hidden="true" />
                              ) : (
                                <Copy size={13} aria-hidden="true" />
                              )}
                              {copiedKey === entry.key ? '已复制' : '复制'}
                            </button>
                            <button
                              type="button"
                              className="tool-btn"
                              onClick={() => startEdit(entry.key, entry.value)}
                            >
                              <Edit3 size={13} aria-hidden="true" />
                              编辑
                            </button>
                            <button
                              type="button"
                              className="tool-btn sv-action-danger"
                              onClick={() => deleteEntry(entry.key)}
                            >
                              <Trash2 size={13} aria-hidden="true" />
                              删除
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
