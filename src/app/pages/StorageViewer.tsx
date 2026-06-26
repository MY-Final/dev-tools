import { useState, useEffect, useCallback } from 'react'
import { Database, Trash2, Copy, Check, Edit3, X, Save, RefreshCw, HardDrive } from 'lucide-react'
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

// ── Component ──────────────────────────────────────────────────

export default function StorageViewer(): React.JSX.Element {
  const [storageType, setStorageType] = useState<StorageType>('localStorage')
  const [entries, setEntries] = useState<StorageEntry[]>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const refresh = useCallback(() => {
    try {
      setEntries(getEntries(storageType))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取存储失败')
    }
  }, [storageType])

  useEffect(() => {
    refresh()
  }, [refresh])

  const selectEntry = useCallback(
    (key: string) => {
      setSelectedKey((prev) => (prev === key ? null : key))
      setEditingKey(null)
    },
    []
  )

  const startEdit = useCallback((key: string, value: string) => {
    setEditingKey(key)
    setEditingValue(value)
  }, [])

  const saveEdit = useCallback(() => {
    if (!editingKey) return
    try {
      const storage = getStorage(storageType)
      if (editingValue) {
        storage.setItem(editingKey, editingValue)
      } else {
        storage.removeItem(editingKey)
        setSelectedKey(null)
      }
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
  const estimatedUsed = new Blob([JSON.stringify(localStorage)]).size + new Blob([JSON.stringify(sessionStorage)]).size

  return (
    <div className="sv-page">
      <div className="sv-card">
        <div className="sv-header">
          <h2 className="sv-title">Browser Storage Viewer</h2>
          <p className="sv-subtitle">localStorage / sessionStorage 查看编辑</p>
        </div>

        {/* Storage type selector */}
        <div className="sv-type-selector">
          {(['localStorage', 'sessionStorage'] as StorageType[]).map((t) => (
            <button
              key={t}
              className={`sv-type-btn ${storageType === t ? 'active' : ''}`}
              onClick={() => {
                setStorageType(t)
                setSelectedKey(null)
                setEditingKey(null)
              }}
            >
              <Database size={13} />
              {t}
            </button>
          ))}
        </div>

        {/* Stats bar */}
        <div className="sv-stats">
          <div className="sv-stat">
            <HardDrive size={12} />
            <span>{entries.length} 条</span>
          </div>
          <div className="sv-stat">
            <span>总大小: {totalSize < 1024 ? `${totalSize} B` : `${(totalSize / 1024).toFixed(1)} KB`}</span>
          </div>
          <div className="sv-stat">
            <span>估算使用: {estimatedUsed < 1024 ? `${estimatedUsed} B` : `${(estimatedUsed / 1024).toFixed(1)} KB`}</span>
          </div>
        </div>

        {/* Toolbar */}
        <div className="sv-toolbar">
          <button className="sv-add-btn" onClick={() => setShowAdd(!showAdd)}>
            + 添加
          </button>
          <button className="sv-refresh-btn" onClick={refresh}>
            <RefreshCw size={13} />
          </button>
          <button className="sv-clear-btn" onClick={clearAll}>
            <Trash2 size={13} />
            清空全部
          </button>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="sv-add-form">
            <input
              className="sv-input"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="Key"
            />
            <input
              className="sv-input"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Value"
            />
            <button className="sv-save-btn" onClick={addEntry}>
              <Save size={13} />
              保存
            </button>
            <button className="sv-cancel-btn" onClick={() => setShowAdd(false)}>
              <X size={13} />
            </button>
          </div>
        )}

        {/* Error */}
        {error && <div className="sv-error">{error}</div>}

        {/* Entry list */}
        {entries.length === 0 && !error && (
          <div className="sv-empty">暂无数据</div>
        )}

        {entries.map((entry) => (
          <div
            key={entry.key}
            className={`sv-entry ${selectedKey === entry.key ? 'selected' : ''}`}
          >
            <div className="sv-entry-header" onClick={() => selectEntry(entry.key)}>
              <div className="sv-entry-key">
                <Database size={12} />
                <span>{entry.key}</span>
              </div>
              <span className="sv-entry-size">
                {entry.rawSize < 1024 ? `${entry.rawSize} B` : `${(entry.rawSize / 1024).toFixed(1)} KB`}
              </span>
            </div>

            {selectedKey === entry.key && (
              <div className="sv-entry-body">
                {editingKey === entry.key ? (
                  <>
                    <textarea
                      className="sv-textarea"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      rows={4}
                    />
                    <div className="sv-entry-actions">
                      <button className="sv-save-btn" onClick={saveEdit}>
                        <Save size={12} /> 保存
                      </button>
                      <button className="sv-cancel-btn" onClick={() => setEditingKey(null)}>
                        <X size={12} /> 取消
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <pre className="sv-entry-value">{entry.value}</pre>
                    <div className="sv-entry-actions">
                      <button
                        className="sv-action-btn"
                        onClick={() => copyEntry(entry.value, entry.key)}
                      >
                        {copiedKey === entry.key ? <Check size={12} /> : <Copy size={12} />}
                        {copiedKey === entry.key ? '已复制' : '复制'}
                      </button>
                      <button
                        className="sv-action-btn"
                        onClick={() => startEdit(entry.key, entry.value)}
                      >
                        <Edit3 size={12} /> 编辑
                      </button>
                      <button
                        className="sv-action-btn sv-action-danger"
                        onClick={() => deleteEntry(entry.key)}
                      >
                        <Trash2 size={12} /> 删除
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
