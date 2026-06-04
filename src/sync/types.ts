import type { AppSettings } from '../appSettings'
import type { ArchivedTodo } from '../archivedTodos'
import type { BreakRecord } from '../breakRecords'
import type { TimerState, WallAlarm } from '../chromeAlarms'
import type { CompletedSubtodoAction, CompletedTodoAction } from '../completedActions'
import type { FocusBlock } from '../focusMetrics'
import type { TimeEntry } from '../timeTracking'
import type { Todo } from '../todos'
import type { TodoCategory } from '../categories'

export const SYNC_BUNDLE_VERSION = 1 as const

/** Settings fields synced across devices (excludes per-device sync UI state). */
export type SyncableAppSettings = Omit<
  AppSettings,
  'syncEnabled' | 'syncToken' | 'syncLastAt' | 'syncLastError' | 'syncEtag'
>

export interface SyncBundle {
  version: typeof SYNC_BUNDLE_VERSION
  updatedAt: number
  todoCategories: TodoCategory[]
  todos: Todo[]
  archivedTodos: ArchivedTodo[]
  completedTodoActions: CompletedTodoAction[]
  completedSubtodoActions: CompletedSubtodoAction[]
  focusBlocks: FocusBlock[]
  breakRecords: BreakRecord[]
  timeEntries: TimeEntry[]
  appSettings: SyncableAppSettings
  timer: TimerState
  wallAlarm: WallAlarm
}

export interface SyncPullResult {
  bundle: SyncBundle | null
  etag: string | null
}

export interface SyncConfig {
  enabled: boolean
  token: string
  apiUrl: string
  etag: string | null
}
