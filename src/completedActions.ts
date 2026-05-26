import { toDateKey } from './focusMetrics'

export interface CompletedTodoAction {
  id: string
  todoId: string
  title: string
  completedAt: number
  dateKey: string
}

export interface CompletedSubtodoAction {
  id: string
  todoId: string
  subtodoId: string
  title: string
  completedAt: number
  dateKey: string
}

export const COMPLETED_TODOS_KEY = 'completedTodoActions'
export const COMPLETED_SUBTODOS_KEY = 'completedSubtodoActions'
const COMPLETED_TODOS_FALLBACK_KEY = 'focus-new-tab.completedTodoActions'
const COMPLETED_SUBTODOS_FALLBACK_KEY = 'focus-new-tab.completedSubtodoActions'

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local)
}

function normalizeTodoAction(raw: unknown): CompletedTodoAction | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const value = raw as Partial<CompletedTodoAction>
  const completedAt = Number(value.completedAt)

  if (!Number.isFinite(completedAt) || completedAt <= 0) {
    return null
  }

  return {
    id: typeof value.id === 'string' ? value.id : crypto.randomUUID(),
    todoId: typeof value.todoId === 'string' ? value.todoId : '',
    title: typeof value.title === 'string' ? value.title : '',
    completedAt,
    dateKey: typeof value.dateKey === 'string' ? value.dateKey : toDateKey(completedAt),
  }
}

function normalizeSubtodoAction(raw: unknown): CompletedSubtodoAction | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const value = raw as Partial<CompletedSubtodoAction>
  const completedAt = Number(value.completedAt)

  if (!Number.isFinite(completedAt) || completedAt <= 0) {
    return null
  }

  return {
    id: typeof value.id === 'string' ? value.id : crypto.randomUUID(),
    todoId: typeof value.todoId === 'string' ? value.todoId : '',
    subtodoId: typeof value.subtodoId === 'string' ? value.subtodoId : '',
    title: typeof value.title === 'string' ? value.title : '',
    completedAt,
    dateKey: typeof value.dateKey === 'string' ? value.dateKey : toDateKey(completedAt),
  }
}

export async function getCompletedTodoActions(): Promise<CompletedTodoAction[]> {
  if (hasChromeStorage()) {
    try {
      const data = await chrome.storage.local.get(COMPLETED_TODOS_KEY)
      const actions = data[COMPLETED_TODOS_KEY] as unknown[] | undefined

      if (Array.isArray(actions)) {
        return actions.map(normalizeTodoAction).filter((action): action is CompletedTodoAction => action !== null)
      }
    } catch {
      // Fall back to localStorage below.
    }
  }

  const raw = localStorage.getItem(COMPLETED_TODOS_FALLBACK_KEY)

  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as unknown[]
    return Array.isArray(parsed)
      ? parsed.map(normalizeTodoAction).filter((action): action is CompletedTodoAction => action !== null)
      : []
  } catch {
    return []
  }
}

export async function getCompletedSubtodoActions(): Promise<CompletedSubtodoAction[]> {
  if (hasChromeStorage()) {
    try {
      const data = await chrome.storage.local.get(COMPLETED_SUBTODOS_KEY)
      const actions = data[COMPLETED_SUBTODOS_KEY] as unknown[] | undefined

      if (Array.isArray(actions)) {
        return actions
          .map(normalizeSubtodoAction)
          .filter((action): action is CompletedSubtodoAction => action !== null)
      }
    } catch {
      // Fall back to localStorage below.
    }
  }

  const raw = localStorage.getItem(COMPLETED_SUBTODOS_FALLBACK_KEY)

  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as unknown[]
    return Array.isArray(parsed)
      ? parsed.map(normalizeSubtodoAction).filter((action): action is CompletedSubtodoAction => action !== null)
      : []
  } catch {
    return []
  }
}

async function saveCompletedTodoActions(actions: CompletedTodoAction[]): Promise<void> {
  if (hasChromeStorage()) {
    try {
      await chrome.storage.local.set({ [COMPLETED_TODOS_KEY]: actions })
    } catch {
      // Fall back to localStorage below.
    }
  }

  localStorage.setItem(COMPLETED_TODOS_FALLBACK_KEY, JSON.stringify(actions))
}

async function saveCompletedSubtodoActions(actions: CompletedSubtodoAction[]): Promise<void> {
  if (hasChromeStorage()) {
    try {
      await chrome.storage.local.set({ [COMPLETED_SUBTODOS_KEY]: actions })
    } catch {
      // Fall back to localStorage below.
    }
  }

  localStorage.setItem(COMPLETED_SUBTODOS_FALLBACK_KEY, JSON.stringify(actions))
}

export async function recordCompletedTodoAction(input: {
  todoId: string
  title: string
  completedAt?: number
}): Promise<CompletedTodoAction> {
  const completedAt = input.completedAt ?? Date.now()
  const action: CompletedTodoAction = {
    id: crypto.randomUUID(),
    todoId: input.todoId,
    title: input.title.trim(),
    completedAt,
    dateKey: toDateKey(completedAt),
  }

  const actions = await getCompletedTodoActions()
  actions.push(action)
  await saveCompletedTodoActions(actions)

  return action
}

export async function recordCompletedSubtodoAction(input: {
  todoId: string
  subtodoId: string
  title: string
  completedAt?: number
}): Promise<CompletedSubtodoAction> {
  const completedAt = input.completedAt ?? Date.now()
  const action: CompletedSubtodoAction = {
    id: crypto.randomUUID(),
    todoId: input.todoId,
    subtodoId: input.subtodoId,
    title: input.title.trim(),
    completedAt,
    dateKey: toDateKey(completedAt),
  }

  const actions = await getCompletedSubtodoActions()
  actions.push(action)
  await saveCompletedSubtodoActions(actions)

  return action
}
