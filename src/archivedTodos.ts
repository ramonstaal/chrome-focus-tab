import { toDateKey } from './focusMetrics'
import { scheduleSyncPush } from './sync/hooks'

export interface ArchivedSubtodo {
  title: string
  notes?: string
}

export interface ArchivedTodo {
  id: string
  title: string
  subtodos: ArchivedSubtodo[]
  archivedAt: number
  dateKey: string
  notes?: string
}

export const ARCHIVED_TODOS_KEY = 'archivedTodos'
const ARCHIVED_TODOS_FALLBACK_KEY = 'focus-new-tab.archivedTodos'

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local)
}

export async function getArchivedTodos(): Promise<ArchivedTodo[]> {
  if (hasChromeStorage()) {
    try {
      const data = await chrome.storage.local.get(ARCHIVED_TODOS_KEY)
      const todos = data[ARCHIVED_TODOS_KEY] as ArchivedTodo[] | undefined
      return Array.isArray(todos) ? todos : []
    } catch {
      // Fall back to localStorage below.
    }
  }

  const raw = localStorage.getItem(ARCHIVED_TODOS_FALLBACK_KEY)

  if (!raw) {
    return []
  }

  try {
    const todos = JSON.parse(raw) as ArchivedTodo[]
    return Array.isArray(todos) ? todos : []
  } catch {
    return []
  }
}

export async function addArchivedTodo(input: {
  id: string
  title: string
  subtodos: ArchivedSubtodo[]
  archivedAt?: number
  notes?: string
}): Promise<ArchivedTodo> {
  const archivedAt = input.archivedAt ?? Date.now()
  const record: ArchivedTodo = {
    id: input.id,
    title: input.title,
    subtodos: input.subtodos,
    archivedAt,
    dateKey: toDateKey(archivedAt),
    notes: input.notes,
  }

  const todos = await getArchivedTodos()
  todos.push(record)
  await saveArchivedTodos(todos)

  return record
}

async function saveArchivedTodos(
  todos: ArchivedTodo[],
  options: { skipSync?: boolean } = {},
): Promise<void> {
  if (hasChromeStorage()) {
    try {
      await chrome.storage.local.set({ [ARCHIVED_TODOS_KEY]: todos })
    } catch {
      // Fall back to localStorage below.
    }
  }

  localStorage.setItem(ARCHIVED_TODOS_FALLBACK_KEY, JSON.stringify(todos))

  if (!options.skipSync) {
    scheduleSyncPush()
  }
}

export async function replaceArchivedTodos(
  todos: ArchivedTodo[],
  options: { skipSync?: boolean } = {},
): Promise<void> {
  await saveArchivedTodos(todos, options)
}
