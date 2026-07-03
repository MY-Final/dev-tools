import { ipcMain } from 'electron'
import { todoStore, type CreateTodoInput, type UpdateTodoInput } from './todos'

export function registerTodoHandlers(): void {
  ipcMain.handle('todos:get', () => todoStore.getItems())
  ipcMain.handle('todos:create', (_event, input: CreateTodoInput) => todoStore.createItem(input))
  ipcMain.handle('todos:update', (_event, id: string, updates: UpdateTodoInput) =>
    todoStore.updateItem(id, updates)
  )
  ipcMain.handle('todos:delete', (_event, id: string) => todoStore.deleteItem(id))
  ipcMain.handle('todos:clear-completed', (_event, date?: string) =>
    todoStore.clearCompleted(date)
  )
}
