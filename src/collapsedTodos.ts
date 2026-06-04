export const COLLAPSED_TODOS_KEY = 'focus-new-tab.collapsedTodos'

export function loadCollapsedTodoIds(): Set<string> {
  const raw = localStorage.getItem(COLLAPSED_TODOS_KEY)

  if (!raw) {
    return new Set()
  }

  try {
    const parsed = JSON.parse(raw) as unknown

    if (!Array.isArray(parsed)) {
      return new Set()
    }

    return new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0))
  } catch {
    return new Set()
  }
}

export function saveCollapsedTodoIds(ids: Iterable<string>): void {
  localStorage.setItem(COLLAPSED_TODOS_KEY, JSON.stringify([...ids]))
}

export function pruneCollapsedTodoIds(ids: Set<string>, activeTodoIds: Iterable<string>): Set<string> {
  const active = new Set(activeTodoIds)
  const pruned = new Set([...ids].filter((id) => active.has(id)))

  if (pruned.size !== ids.size) {
    saveCollapsedTodoIds(pruned)
  }

  return pruned
}
