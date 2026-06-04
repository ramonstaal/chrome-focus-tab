import { getAppSettings, normalizeAppSettings, setAppSettings, type AppSettings } from './appSettings'
import { normalizeTimerState, type WallAlarm } from './chromeAlarms'
import { normalizeCategories } from './categories'
import { loadActiveCategoryId, saveActiveCategoryId } from './categoriesStorage'
import { loadCollapsedTodoIds, saveCollapsedTodoIds } from './collapsedTodos'
import { applyBundle, collectBundle } from './sync/bundle'
import { scheduleSyncPush } from './sync/hooks'
import { SYNC_BUNDLE_VERSION, type SyncBundle } from './sync/types'
import { getActiveTimeTracking, replaceActiveTimeTracking, type ActiveTimeTracking } from './timeTracking'
import { normalizeTodos } from './todos'

export const LOCAL_BACKUP_FORMAT = 'focus-todo-backup' as const
export const LOCAL_BACKUP_VERSION = 1 as const

export interface LocalBackup {
  format: typeof LOCAL_BACKUP_FORMAT
  formatVersion: typeof LOCAL_BACKUP_VERSION
  exportedAt: number
  bundle: SyncBundle
  appSettings: AppSettings
  activeCategoryId: string | null
  collapsedTodoIds: string[]
  timeTrackingSession: ActiveTimeTracking | null
}

function defaultWallAlarm(): WallAlarm {
  return { enabled: false, hour: 9, minute: 0 }
}

function normalizeWallAlarm(raw: unknown): WallAlarm {
  if (!raw || typeof raw !== 'object') {
    return defaultWallAlarm()
  }

  const value = raw as Partial<WallAlarm>
  const hour = Number(value.hour)
  const minute = Number(value.minute)

  return {
    enabled: Boolean(value.enabled),
    hour: Number.isFinite(hour) && hour >= 0 && hour <= 23 ? hour : 9,
    minute: Number.isFinite(minute) && minute >= 0 && minute <= 59 ? minute : 0,
  }
}

function normalizeActiveSession(raw: unknown): ActiveTimeTracking | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const value = raw as Partial<ActiveTimeTracking>
  const startedAt = Number(value.startedAt)

  if (!Number.isFinite(startedAt) || startedAt <= 0) {
    return null
  }

  return {
    startedAt,
    label: typeof value.label === 'string' ? value.label.trim() : '',
    comment: typeof value.comment === 'string' ? value.comment.trim() : '',
  }
}

function normalizeCollapsedTodoIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw.filter((id): id is string => typeof id === 'string' && id.length > 0)
}

function normalizeSyncBundle(raw: unknown): SyncBundle {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Backup is missing data.')
  }

  const value = raw as Record<string, unknown>
  const updatedAt = Number(value.updatedAt)

  return {
    version: SYNC_BUNDLE_VERSION,
    updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : Date.now(),
    todoCategories: normalizeCategories(value.todoCategories ?? []),
    todos: normalizeTodos(value.todos ?? []),
    archivedTodos: Array.isArray(value.archivedTodos) ? (value.archivedTodos as SyncBundle['archivedTodos']) : [],
    completedTodoActions: Array.isArray(value.completedTodoActions)
      ? (value.completedTodoActions as SyncBundle['completedTodoActions'])
      : [],
    completedSubtodoActions: Array.isArray(value.completedSubtodoActions)
      ? (value.completedSubtodoActions as SyncBundle['completedSubtodoActions'])
      : [],
    focusBlocks: Array.isArray(value.focusBlocks) ? (value.focusBlocks as SyncBundle['focusBlocks']) : [],
    breakRecords: Array.isArray(value.breakRecords) ? (value.breakRecords as SyncBundle['breakRecords']) : [],
    timeEntries: Array.isArray(value.timeEntries) ? (value.timeEntries as SyncBundle['timeEntries']) : [],
    appSettings: (value.appSettings ?? {}) as SyncBundle['appSettings'],
    timer: normalizeTimerState(value.timer as Partial<SyncBundle['timer']> | null | undefined),
    wallAlarm: normalizeWallAlarm(value.wallAlarm),
  }
}

function isRecord(raw: unknown): raw is Record<string, unknown> {
  return Boolean(raw && typeof raw === 'object')
}

function isLegacySyncBundle(raw: Record<string, unknown>): boolean {
  return Array.isArray(raw.todos) && raw.version === SYNC_BUNDLE_VERSION
}

export function normalizeLocalBackup(raw: unknown): LocalBackup {
  if (!isRecord(raw)) {
    throw new Error('Unrecognized backup file.')
  }

  if (raw.format === LOCAL_BACKUP_FORMAT) {
    const exportedAt = Number(raw.exportedAt)

    return {
      format: LOCAL_BACKUP_FORMAT,
      formatVersion: LOCAL_BACKUP_VERSION,
      exportedAt: Number.isFinite(exportedAt) && exportedAt > 0 ? exportedAt : Date.now(),
      bundle: normalizeSyncBundle(raw.bundle),
      appSettings: normalizeAppSettings(raw.appSettings),
      activeCategoryId:
        typeof raw.activeCategoryId === 'string' && raw.activeCategoryId.length > 0
          ? raw.activeCategoryId
          : null,
      collapsedTodoIds: normalizeCollapsedTodoIds(raw.collapsedTodoIds),
      timeTrackingSession: normalizeActiveSession(raw.timeTrackingSession),
    }
  }

  if (isLegacySyncBundle(raw)) {
    const bundle = normalizeSyncBundle(raw)

    return {
      format: LOCAL_BACKUP_FORMAT,
      formatVersion: LOCAL_BACKUP_VERSION,
      exportedAt: bundle.updatedAt,
      bundle,
      appSettings: normalizeAppSettings(bundle.appSettings),
      activeCategoryId: null,
      collapsedTodoIds: [],
      timeTrackingSession: null,
    }
  }

  throw new Error('Unrecognized backup file.')
}

export async function collectLocalBackup(): Promise<LocalBackup> {
  const [bundle, appSettings, timeTrackingSession] = await Promise.all([
    collectBundle(),
    getAppSettings(),
    getActiveTimeTracking(),
  ])

  return {
    format: LOCAL_BACKUP_FORMAT,
    formatVersion: LOCAL_BACKUP_VERSION,
    exportedAt: Date.now(),
    bundle,
    appSettings,
    activeCategoryId: loadActiveCategoryId(),
    collapsedTodoIds: [...loadCollapsedTodoIds()],
    timeTrackingSession,
  }
}

export async function applyLocalBackup(backup: LocalBackup): Promise<void> {
  await applyBundle(backup.bundle)
  await setAppSettings(backup.appSettings, { skipSync: true })

  if (backup.activeCategoryId) {
    saveActiveCategoryId(backup.activeCategoryId)
  }

  saveCollapsedTodoIds(backup.collapsedTodoIds)
  await replaceActiveTimeTracking(backup.timeTrackingSession)

  if (backup.appSettings.syncEnabled && backup.appSettings.syncToken.trim()) {
    scheduleSyncPush()
  }
}

export function serializeLocalBackup(backup: LocalBackup): string {
  return JSON.stringify(backup, null, 2)
}

export function parseLocalBackupJson(text: string): LocalBackup {
  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Could not read backup file. Make sure it is valid JSON.')
  }

  return normalizeLocalBackup(parsed)
}

function backupFilename(exportedAt: number): string {
  const stamp = new Date(exportedAt).toISOString().slice(0, 10)
  return `focus-todo-backup-${stamp}.json`
}

export async function downloadLocalBackup(): Promise<void> {
  const backup = await collectLocalBackup()
  const json = serializeLocalBackup(backup)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = backupFilename(backup.exportedAt)
  anchor.click()
  URL.revokeObjectURL(url)
}
