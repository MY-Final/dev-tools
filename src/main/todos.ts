import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

export interface TodoItem {
  id: string
  title: string
  note: string
  date: string
  completed: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateTodoInput {
  title: string
  note?: string
  date: string
}

export interface UpdateTodoInput {
  title?: string
  note?: string
  date?: string
  completed?: boolean
}

interface TodosData {
  version: number
  items: TodoItem[]
}

const TODOS_VERSION = 1

function isDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function createId(): string {
  return `todo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export class TodoStore {
  private filePath: string
  private data: TodosData

  constructor(userDataPath?: string) {
    const dataPath = userDataPath || app.getPath('userData')
    this.filePath = join(dataPath, 'todos.json')
    this.data = this.load()
  }

  private load(): TodosData {
    try {
      if (!existsSync(this.filePath)) {
        return { version: TODOS_VERSION, items: [] }
      }

      const raw = readFileSync(this.filePath, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<TodosData>
      return {
        version: TODOS_VERSION,
        items: Array.isArray(parsed.items) ? parsed.items : []
      }
    } catch (error) {
      console.error('Failed to load todos:', error)
      this.backupCorruptedFile()
      return { version: TODOS_VERSION, items: [] }
    }
  }

  private backupCorruptedFile(): void {
    try {
      if (existsSync(this.filePath)) {
        const backupPath = `${this.filePath}.backup.${Date.now()}`
        const data = readFileSync(this.filePath, 'utf-8')
        writeFileSync(backupPath, data, 'utf-8')
      }
    } catch (error) {
      console.error('Failed to backup corrupted todos:', error)
    }
  }

  private save(): void {
    try {
      const dir = join(this.filePath, '..')
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
      writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8')
    } catch (error) {
      console.error('Failed to save todos:', error)
    }
  }

  getItems(): TodoItem[] {
    return [...this.data.items].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  createItem(input: CreateTodoInput): TodoItem {
    const title = input.title.trim()
    if (!title) {
      throw new Error('Todo title is required')
    }
    if (!isDateString(input.date)) {
      throw new Error('Invalid todo date')
    }

    const now = new Date().toISOString()
    const item: TodoItem = {
      id: createId(),
      title,
      note: input.note?.trim() || '',
      date: input.date,
      completed: false,
      createdAt: now,
      updatedAt: now
    }

    this.data.items = [...this.data.items, item]
    this.save()
    return item
  }

  updateItem(id: string, updates: UpdateTodoInput): TodoItem | null {
    const index = this.data.items.findIndex((item) => item.id === id)
    if (index === -1) return null

    const current = this.data.items[index]
    const nextTitle = updates.title === undefined ? current.title : updates.title.trim()
    const nextDate = updates.date ?? current.date

    if (!nextTitle) {
      throw new Error('Todo title is required')
    }
    if (!isDateString(nextDate)) {
      throw new Error('Invalid todo date')
    }

    const next: TodoItem = {
      ...current,
      ...updates,
      title: nextTitle,
      note: updates.note === undefined ? current.note : updates.note.trim(),
      date: nextDate,
      updatedAt: new Date().toISOString()
    }

    this.data.items = [
      ...this.data.items.slice(0, index),
      next,
      ...this.data.items.slice(index + 1)
    ]
    this.save()
    return next
  }

  deleteItem(id: string): boolean {
    const before = this.data.items.length
    this.data.items = this.data.items.filter((item) => item.id !== id)
    const changed = this.data.items.length !== before
    if (changed) this.save()
    return changed
  }

  clearCompleted(date?: string): number {
    if (date && !isDateString(date)) {
      throw new Error('Invalid todo date')
    }

    const before = this.data.items.length
    this.data.items = this.data.items.filter((item) => {
      if (!item.completed) return true
      return date ? item.date !== date : false
    })
    const removed = before - this.data.items.length
    if (removed > 0) this.save()
    return removed
  }
}

export const todoStore = new TodoStore()
