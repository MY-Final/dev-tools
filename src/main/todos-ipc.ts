import { todoStore, type CreateTodoInput, type UpdateTodoInput } from './todos'
import { registerGuardedHandler } from './ipc-security'

export function registerTodoHandlers(): void {
  registerGuardedHandler('todos:get', () => todoStore.getItems())
  registerGuardedHandler('todos:create', (_event, input: CreateTodoInput) => todoStore.createItem(input))
  registerGuardedHandler('todos:update', (_event, id: string, updates: UpdateTodoInput) =>
    todoStore.updateItem(id, updates)
  )
  registerGuardedHandler('todos:delete', (_event, id: string) => todoStore.deleteItem(id))
  registerGuardedHandler('todos:clear-completed', (_event, date?: string) =>
    todoStore.clearCompleted(date)
  )
}
