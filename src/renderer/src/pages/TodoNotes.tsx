import { useCallback, useEffect, useState } from 'react'
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Edit3,
  ListTodo,
  Plus,
  RotateCcw,
  Trash2,
  X
} from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Calendar } from '@renderer/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import '../styles/todo-notes.css'

type TodoFilter = 'today' | 'all' | 'active' | 'completed'

interface TodoItem {
  id: string
  title: string
  note: string
  date: string
  completed: boolean
  createdAt: string
  updatedAt: string
}

interface EditingTodo {
  id: string
  title: string
  note: string
}

const filters: Array<{ id: TodoFilter; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' }
]

function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function shiftDate(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

function formatDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  })
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function getEmptyText(filter: TodoFilter): string {
  if (filter === 'today') return '这一天还没有待办。'
  if (filter === 'active') return '没有未完成事项。'
  if (filter === 'completed') return '还没有已完成事项。'
  return '还没有保存任何待办。'
}

export default function TodoNotes(): React.JSX.Element {
  const today = toDateKey(new Date())
  const [items, setItems] = useState<TodoItem[]>([])
  const [filter, setFilter] = useState<TodoFilter>('today')
  const [selectedDate, setSelectedDate] = useState(today)
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [editing, setEditing] = useState<EditingTodo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadItems = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const nextItems = await window.todos.getItems()
      setItems(nextItems)
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取待办失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  const visibleItems = items.filter((item) => {
    if (filter === 'today') return item.date === selectedDate
    if (filter === 'active') return !item.completed
    if (filter === 'completed') return item.completed
    return true
  })

  const todayItems = items.filter((item) => item.date === selectedDate)
  const completedCount = todayItems.filter((item) => item.completed).length
  const activeCount = items.filter((item) => !item.completed).length

  const createItem = useCallback(async () => {
    const nextTitle = title.trim()
    if (!nextTitle) return

    try {
      const item = await window.todos.createItem({
        title: nextTitle,
        note: note.trim(),
        date: selectedDate
      })
      setItems((prev) => [...prev, item])
      setTitle('')
      setNote('')
      setFilter('today')
    } catch (err) {
      setError(err instanceof Error ? err.message : '新增待办失败')
    }
  }, [note, selectedDate, title])

  const toggleItem = useCallback(async (item: TodoItem) => {
    try {
      const updated = await window.todos.updateItem(item.id, { completed: !item.completed })
      if (!updated) return
      setItems((prev) => prev.map((entry) => (entry.id === item.id ? updated : entry)))
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新待办失败')
    }
  }, [])

  const saveEdit = useCallback(async () => {
    if (!editing) return
    const nextTitle = editing.title.trim()
    if (!nextTitle) return

    try {
      const updated = await window.todos.updateItem(editing.id, {
        title: nextTitle,
        note: editing.note.trim()
      })
      if (!updated) return
      setItems((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)))
      setEditing(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存待办失败')
    }
  }, [editing])

  const deleteItem = useCallback(async (id: string) => {
    try {
      const deleted = await window.todos.deleteItem(id)
      if (deleted) {
        setItems((prev) => prev.filter((item) => item.id !== id))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除待办失败')
    }
  }, [])

  const clearCompleted = useCallback(async () => {
    try {
      const date = filter === 'today' ? selectedDate : undefined
      const removed = await window.todos.clearCompleted(date)
      if (removed === 0) return
      setItems((prev) =>
        prev.filter((item) => {
          if (!item.completed) return true
          return date ? item.date !== date : false
        })
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : '清理已完成失败')
    }
  }, [filter, selectedDate])

  const handleSubmit = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void createItem()
  }, [createItem])

  return (
    <div className="tn-page">
      <div className="tn-card">
        <div className="tn-header">
          <div className="tn-kicker">
            <ListTodo size={14} />
            本地保存
          </div>
          <h2 className="tn-title">Todo Notes</h2>
          <p className="tn-subtitle">每日待办 · 编辑 · 勾选完成</p>
        </div>

        <div className="tn-datebar">
          <button className="tn-icon-btn" onClick={() => setSelectedDate((date) => shiftDate(date, -1))} title="前一天">
            <ChevronLeft size={16} />
          </button>
          <div className="tn-date-display">
            <CalendarDays size={15} />
            <div>
              <span className="tn-date-main">{formatDateLabel(selectedDate)}</span>
              <span className="tn-date-sub">{selectedDate}</span>
            </div>
          </div>
          <button className="tn-icon-btn" onClick={() => setSelectedDate((date) => shiftDate(date, 1))} title="后一天">
            <ChevronRight size={16} />
          </button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="tn-calendar-trigger">
                <CalendarDays size={14} />
                选择日期
              </Button>
            </PopoverTrigger>
            <PopoverContent className="tn-calendar-content" align="end">
              <Calendar
                mode="single"
                selected={parseDateKey(selectedDate)}
                onSelect={(date) => {
                  if (date) setSelectedDate(toDateKey(date))
                }}
              />
            </PopoverContent>
          </Popover>
          <button className="tn-today-btn" onClick={() => setSelectedDate(today)}>
            今天
          </button>
        </div>

        <div className="tn-stats">
          <div className="tn-stat">
            <span className="tn-stat-value">{todayItems.length}</span>
            <span className="tn-stat-label">当天事项</span>
          </div>
          <div className="tn-stat">
            <span className="tn-stat-value">{completedCount}</span>
            <span className="tn-stat-label">当天完成</span>
          </div>
          <div className="tn-stat">
            <span className="tn-stat-value">{activeCount}</span>
            <span className="tn-stat-label">全部剩余</span>
          </div>
        </div>

        <form className="tn-compose" onSubmit={handleSubmit}>
          <div className="tn-compose-line">
            <input
              className="tn-title-input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="今天要做什么..."
            />
            <button className="tn-add-btn" type="submit" disabled={!title.trim()}>
              <Plus size={16} />
              添加
            </button>
          </div>
          <textarea
            className="tn-note-input"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="备注，可选"
            rows={2}
          />
        </form>

        <div className="tn-filterbar">
          {filters.map((entry) => (
            <button
              key={entry.id}
              className={`tn-filter ${filter === entry.id ? 'active' : ''}`}
              onClick={() => setFilter(entry.id)}
            >
              {entry.label}
            </button>
          ))}
          <button className="tn-clear-completed" onClick={clearCompleted}>
            <RotateCcw size={13} />
            清理已完成
          </button>
        </div>

        {error && <div className="tn-error">{error}</div>}

        {loading ? (
          <div className="tn-empty">读取待办中...</div>
        ) : visibleItems.length === 0 ? (
          <div className="tn-empty">
            <ListTodo size={42} className="tn-empty-icon" />
            <p>{getEmptyText(filter)}</p>
          </div>
        ) : (
          <div className="tn-list">
            {visibleItems.map((item) => {
              const isEditing = editing?.id === item.id
              return (
                <div key={item.id} className={`tn-item ${item.completed ? 'completed' : ''}`}>
                  <button className="tn-check" onClick={() => void toggleItem(item)} title="完成状态">
                    {item.completed ? <Check size={16} /> : <Circle size={16} />}
                  </button>

                  <div className="tn-item-body">
                    {isEditing ? (
                      <div className="tn-edit-form">
                        <input
                          className="tn-edit-title"
                          value={editing.title}
                          onChange={(event) => setEditing({ ...editing, title: event.target.value })}
                        />
                        <textarea
                          className="tn-edit-note"
                          value={editing.note}
                          onChange={(event) => setEditing({ ...editing, note: event.target.value })}
                          rows={2}
                        />
                      </div>
                    ) : (
                      <>
                        <div className="tn-item-title">{item.title}</div>
                        {item.note && <div className="tn-item-note">{item.note}</div>}
                        {filter !== 'today' && <div className="tn-item-date">{item.date}</div>}
                      </>
                    )}
                  </div>

                  <div className="tn-item-actions">
                    {isEditing ? (
                      <>
                        <button className="tn-action-btn primary" onClick={() => void saveEdit()} title="保存">
                          <Check size={14} />
                        </button>
                        <button className="tn-action-btn" onClick={() => setEditing(null)} title="取消">
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="tn-action-btn"
                          onClick={() => setEditing({ id: item.id, title: item.title, note: item.note })}
                          title="编辑"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button className="tn-action-btn danger" onClick={() => void deleteItem(item.id)} title="删除">
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
