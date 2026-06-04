import { getAppSettings, setAppSettings, type AppSettings } from '../appSettings'
import { getArchivedTodos, replaceArchivedTodos } from '../archivedTodos'
import { getBreakRecords, replaceBreakRecords } from '../breakRecords'
import {
  getStorageTimer,
  getWallAlarm,
  normalizeTimerState,
  setStorageTimer,
  setWallAlarm,
} from '../chromeAlarms'
import {
  getCompletedSubtodoActions,
  getCompletedTodoActions,
  replaceCompletedSubtodoActions,
  replaceCompletedTodoActions,
} from '../completedActions'
import { getFocusBlocks, replaceFocusBlocks } from '../focusMetrics'
import { getTimeEntries, replaceTimeEntries } from '../timeTracking'
import { getTodos, saveTodos } from '../todosStorage'
import { getCategories, saveCategories } from '../categoriesStorage'
import { createDefaultCategories } from '../categories'
import { SYNC_LOCAL_UPDATED_AT_KEY } from './config'
import { SYNC_BUNDLE_VERSION, type SyncableAppSettings, type SyncBundle } from './types'

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local)
}

function toSyncableSettings(settings: AppSettings): SyncableAppSettings {
  const {
    syncEnabled: _syncEnabled,
    syncToken: _syncToken,
    syncLastAt: _syncLastAt,
    syncLastError: _syncLastError,
    syncEtag: _syncEtag,
    ...syncable
  } = settings

  return syncable
}

export async function getLocalUpdatedAt(): Promise<number> {
  if (hasChromeStorage()) {
    try {
      const data = await chrome.storage.local.get(SYNC_LOCAL_UPDATED_AT_KEY)
      const value = Number(data[SYNC_LOCAL_UPDATED_AT_KEY])
      return Number.isFinite(value) && value > 0 ? value : 0
    } catch {
      return 0
    }
  }

  const raw = localStorage.getItem(SYNC_LOCAL_UPDATED_AT_KEY)
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : 0
}

export async function setLocalUpdatedAt(updatedAt: number): Promise<void> {
  if (hasChromeStorage()) {
    try {
      await chrome.storage.local.set({ [SYNC_LOCAL_UPDATED_AT_KEY]: updatedAt })
    } catch {
      // Fall back below.
    }
  }

  localStorage.setItem(SYNC_LOCAL_UPDATED_AT_KEY, String(updatedAt))
}

export async function collectBundle(updatedAt = Date.now()): Promise<SyncBundle> {
  const [settings, todoCategories, todos, archivedTodos, completedTodoActions, completedSubtodoActions, focusBlocks, breakRecords, timeEntries, timer, wallAlarm] =
    await Promise.all([
      getAppSettings(),
      getCategories(),
      getTodos(),
      getArchivedTodos(),
      getCompletedTodoActions(),
      getCompletedSubtodoActions(),
      getFocusBlocks(),
      getBreakRecords(),
      getTimeEntries(),
      getStorageTimer(),
      getWallAlarm(),
    ])

  return {
    version: SYNC_BUNDLE_VERSION,
    updatedAt,
    todoCategories,
    todos,
    archivedTodos,
    completedTodoActions,
    completedSubtodoActions,
    focusBlocks,
    breakRecords,
    timeEntries,
    appSettings: toSyncableSettings(settings),
    timer: normalizeTimerState(timer ?? undefined),
    wallAlarm,
  }
}

export async function applyBundle(bundle: SyncBundle): Promise<void> {
  const currentSettings = await getAppSettings()

  const mergedSettings: AppSettings = {
    ...currentSettings,
    ...bundle.appSettings,
    syncEnabled: currentSettings.syncEnabled,
    syncToken: currentSettings.syncToken,
    syncLastAt: currentSettings.syncLastAt,
    syncLastError: currentSettings.syncLastError,
    syncEtag: currentSettings.syncEtag,
  }

  await Promise.all([
    saveCategories(bundle.todoCategories?.length ? bundle.todoCategories : createDefaultCategories(), {
      skipSync: true,
    }),
    saveTodos(bundle.todos, { skipSync: true }),
    replaceArchivedTodos(bundle.archivedTodos, { skipSync: true }),
    replaceCompletedTodoActions(bundle.completedTodoActions, { skipSync: true }),
    replaceCompletedSubtodoActions(bundle.completedSubtodoActions, { skipSync: true }),
    replaceFocusBlocks(bundle.focusBlocks, { skipSync: true }),
    replaceBreakRecords(bundle.breakRecords, { skipSync: true }),
    replaceTimeEntries(bundle.timeEntries, { skipSync: true }),
    setAppSettings(mergedSettings, { skipSync: true }),
    setStorageTimer(bundle.timer, { skipSync: true }),
    setWallAlarm(bundle.wallAlarm, { skipSync: true }),
    setLocalUpdatedAt(bundle.updatedAt),
  ])
}

export async function bumpLocalUpdatedAt(): Promise<number> {
  const updatedAt = Date.now()
  await setLocalUpdatedAt(updatedAt)
  return updatedAt
}
