import { getAppSettings, setAppSettings } from '../appSettings'
import { applyBundle, bumpLocalUpdatedAt, collectBundle, getLocalUpdatedAt } from './bundle'
import { DEFAULT_SYNC_API_URL } from './config'
import { registerSyncHooks } from './hooks'
import { pullRemoteBundle, pushRemoteBundle } from './transport'
import type { SyncConfig } from './types'

type SyncApplyHandler = () => void | Promise<void>

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let pollInterval: ReturnType<typeof setInterval> | null = null
let applyHandler: SyncApplyHandler | null = null
let pushInFlight = false
let pullInFlight = false

const DEBOUNCE_MS = 2000
const POLL_MS = 60_000

export function registerSyncApplyHandler(handler: SyncApplyHandler): void {
  applyHandler = handler
}

async function readSyncConfig(): Promise<SyncConfig | null> {
  const settings = await getAppSettings()

  if (!settings.syncEnabled || !settings.syncToken.trim()) {
    return null
  }

  return {
    enabled: settings.syncEnabled,
    token: settings.syncToken.trim(),
    apiUrl: DEFAULT_SYNC_API_URL,
    etag: settings.syncEtag,
  }
}

async function updateSyncStatus(input: {
  lastAt?: number | null
  lastError?: string
  etag?: string | null
}): Promise<void> {
  const settings = await getAppSettings()

  await setAppSettings({
    ...settings,
    syncLastAt: input.lastAt !== undefined ? input.lastAt : settings.syncLastAt,
    syncLastError: input.lastError !== undefined ? input.lastError : settings.syncLastError,
    syncEtag: input.etag !== undefined ? input.etag : settings.syncEtag,
  }, { skipSync: true })
}

export async function pullSync(): Promise<boolean> {
  if (pullInFlight) {
    return false
  }

  const config = await readSyncConfig()

  if (!config) {
    return false
  }

  pullInFlight = true

  try {
    const { bundle, etag } = await pullRemoteBundle(config)

    if (!bundle) {
      await updateSyncStatus({ lastAt: Date.now(), lastError: '' })
      return false
    }

    const localUpdatedAt = await getLocalUpdatedAt()

    if (bundle.updatedAt <= localUpdatedAt) {
      await updateSyncStatus({
        lastAt: Date.now(),
        lastError: '',
        etag: etag ?? config.etag,
      })
      return false
    }

    await applyBundle(bundle)
    await updateSyncStatus({
      lastAt: Date.now(),
      lastError: '',
      etag: etag ?? String(bundle.updatedAt),
    })

    if (applyHandler) {
      await applyHandler()
    }

    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync pull failed'
    await updateSyncStatus({ lastError: message })
    return false
  } finally {
    pullInFlight = false
  }
}

export async function pushSync(): Promise<void> {
  if (pushInFlight) {
    return
  }

  const config = await readSyncConfig()

  if (!config) {
    return
  }

  pushInFlight = true

  try {
    const updatedAt = await bumpLocalUpdatedAt()
    const bundle = await collectBundle(updatedAt)
    const { etag } = await pushRemoteBundle(config, bundle)

    await updateSyncStatus({
      lastAt: Date.now(),
      lastError: '',
      etag,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync push failed'

    if (message.includes('conflict')) {
      await pullSync()
      await updateSyncStatus({ lastError: message })
      return
    }

    await updateSyncStatus({ lastError: message })
  } finally {
    pushInFlight = false
  }
}

function scheduleSyncPushInternal(delay = DEBOUNCE_MS): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }

  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void pushSync()
  }, delay)
}

function scheduleImmediateSyncPushInternal(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }

  void pushSync()
}

export function scheduleSyncPush(delay = DEBOUNCE_MS): void {
  scheduleSyncPushInternal(delay)
}

export function scheduleImmediateSyncPush(): void {
  scheduleImmediateSyncPushInternal()
}

export async function syncNow(): Promise<void> {
  await pullSync()
  await pushSync()
}

export function startSyncPolling(): void {
  stopSyncPolling()
  pollInterval = setInterval(() => {
    void pullSync()
  }, POLL_MS)
}

export function stopSyncPolling(): void {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

export async function initSync(): Promise<void> {
  const config = await readSyncConfig()

  if (!config) {
    stopSyncPolling()
    return
  }

  await pullSync()
  startSyncPolling()
}

/** Callable from the service worker after timer changes. */
export async function pushSyncFromServiceWorker(): Promise<void> {
  await pushSync()
}

export function getSyncApiUrl(): string {
  return DEFAULT_SYNC_API_URL
}

registerSyncHooks({
  schedulePush: (delay) => scheduleSyncPushInternal(delay),
  scheduleImmediatePush: () => scheduleImmediateSyncPushInternal(),
})
