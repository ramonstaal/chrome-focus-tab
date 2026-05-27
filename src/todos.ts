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

  return {
    id: typeof value.id === 'string' ? value.id : crypto.randomUUID(),
    title: typeof value.title === 'string' ? value.title : '',
    status,
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
