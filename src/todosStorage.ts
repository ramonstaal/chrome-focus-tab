import { DEFAULT_STATUS, normalizeTodos, type Todo } from './todos'
import { scheduleSyncPush } from './sync/hooks'

export const TODOS_STORAGE_KEY = 'todos'
const TODOS_LEGACY_KEY = 'focus-new-tab.todos'

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local)
}

export function createDefaultTodos(): Todo[] {
  return [
    {
      id: crypto.randomUUID(),
      title: 'Plan the first deep-work task',
      status: DEFAULT_STATUS,
      createdAt: Date.now(),
      notes: '',
      subtodos: [
        {
          id: crypto.randomUUID(),
          title: 'Break it into small steps',
          status: DEFAULT_STATUS,
          notes: '',
        },
        {
          id: crypto.randomUUID(),
          title: 'Start a 30 minute focus session',
          status: DEFAULT_STATUS,
          notes: '',
        },
      ],
    },
  ]
}

function loadLegacyTodos(): Todo[] | null {
  const raw = localStorage.getItem(TODOS_LEGACY_KEY)

  if (!raw) {
    return null
  }

  try {
    return normalizeTodos(JSON.parse(raw))
  } catch {
    return null
  }
}

function loadFallbackTodos(): Todo[] {
  const raw = localStorage.getItem(TODOS_STORAGE_KEY)

  if (!raw) {
    const legacy = loadLegacyTodos()
    return legacy ?? createDefaultTodos()
  }

  try {
    const parsed = normalizeTodos(JSON.parse(raw))
    return parsed.length > 0 ? parsed : createDefaultTodos()
  } catch {
    return createDefaultTodos()
  }
}

export async function getTodos(): Promise<Todo[]> {
  if (hasChromeStorage()) {
    try {
      const data = await chrome.storage.local.get(TODOS_STORAGE_KEY)
      const stored = data[TODOS_STORAGE_KEY]

      if (Array.isArray(stored) && stored.length > 0) {
        return normalizeTodos(stored)
      }

      const legacy = loadLegacyTodos()

      if (legacy && legacy.length > 0) {
        await saveTodos(legacy, { skipSync: true })
        localStorage.removeItem(TODOS_LEGACY_KEY)
        return legacy
      }
    } catch {
      // Fall back below.
    }
  }

  return loadFallbackTodos()
}

export async function saveTodos(
  todos: Todo[],
  options: { skipSync?: boolean } = {},
): Promise<void> {
  const normalized = normalizeTodos(todos)

  if (hasChromeStorage()) {
    try {
      await chrome.storage.local.set({ [TODOS_STORAGE_KEY]: normalized })
    } catch {
      // Fall back below.
    }
  }

  localStorage.setItem(TODOS_STORAGE_KEY, JSON.stringify(normalized))

  if (!options.skipSync) {
    scheduleSyncPush()
  }
}
