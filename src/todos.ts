import { DEFAULT_CATEGORY_ID } from './categories'

export type TaskStatus = 'open' | 'busy' | 'on-hold' | 'done'

export interface Subtodo {
  id: string
  title: string
  status: TaskStatus
  notes: string
}

export interface Todo {
  id: string
  title: string
  status: TaskStatus
  categoryId: string
  createdAt: number
  subtodos: Subtodo[]
  notes: string
}

export const TASK_STATUSES: TaskStatus[] = ['open', 'busy', 'on-hold', 'done']

export const STATUS_LABEL: Record<TaskStatus, string> = {
  open: 'Open',
  busy: 'Busy',
  'on-hold': 'On hold',
  done: 'Done',
}

export const DEFAULT_STATUS: TaskStatus = 'open'

export function isTaskDone(status: TaskStatus): boolean {
  return status === 'done'
}

export function compareTaskStatus(a: TaskStatus, b: TaskStatus): number {
  return TASK_STATUSES.indexOf(a) - TASK_STATUSES.indexOf(b)
}

export function sortByTaskStatus<T extends { status: TaskStatus }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => compareTaskStatus(a.status, b.status))
}

/**
 * Coerces an unknown task-like object into the new status-based shape.
 * Older versions of the app stored `done: boolean` instead of `status`,
 * so we migrate them to the new representation on read.
 */
function coerceStatus(raw: unknown): TaskStatus {
  if (typeof raw === 'string' && (TASK_STATUSES as string[]).includes(raw)) {
    return raw as TaskStatus
  }

  return DEFAULT_STATUS
}

export function normalizeSubtodo(raw: unknown): Subtodo {
  const value = (raw ?? {}) as Record<string, unknown>
  const legacyDone = value.done === true
  const status = value.status ? coerceStatus(value.status) : legacyDone ? 'done' : DEFAULT_STATUS

  return {
    id: typeof value.id === 'string' ? value.id : crypto.randomUUID(),
    title: typeof value.title === 'string' ? value.title : '',
    status,
    notes: typeof value.notes === 'string' ? value.notes : '',
  }
}

export function normalizeTodo(raw: unknown): Todo {
  const value = (raw ?? {}) as Record<string, unknown>
  const legacyDone = value.done === true
  const status = value.status ? coerceStatus(value.status) : legacyDone ? 'done' : DEFAULT_STATUS
  const subtodos = Array.isArray(value.subtodos) ? value.subtodos.map(normalizeSubtodo) : []
  const categoryId =
    typeof value.categoryId === 'string' && value.categoryId.length > 0
      ? value.categoryId
      : DEFAULT_CATEGORY_ID

  return {
    id: typeof value.id === 'string' ? value.id : crypto.randomUUID(),
    title: typeof value.title === 'string' ? value.title : '',
    status,
    categoryId,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
    subtodos,
    notes: typeof value.notes === 'string' ? value.notes : '',
  }
}

export function normalizeTodos(raw: unknown): Todo[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw.map(normalizeTodo)
}

export function assignTodoCategoryIds(todos: Todo[], categories: { id: string }[]): Todo[] {
  const fallbackId = categories[0]?.id ?? DEFAULT_CATEGORY_ID
  const validIds = new Set(categories.map((category) => category.id))

  return todos.map((todo) => ({
    ...todo,
    categoryId: validIds.has(todo.categoryId) ? todo.categoryId : fallbackId,
  }))
}
