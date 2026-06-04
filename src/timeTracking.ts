import { toDateKey } from './focusMetrics'
import { scheduleSyncPush } from './sync/hooks'

export interface TimeEntry {
  id: string
  startedAt: number
  endedAt: number
  durationMs: number
  label: string
  comment: string
  dateKey: string
}

export interface ActiveTimeTracking {
  startedAt: number
  label: string
  comment: string
}

export const TIME_TRACKING_SESSION_KEY = 'timeTrackingSession'
export const TIME_ENTRIES_KEY = 'timeEntries'
const SESSION_FALLBACK_KEY = 'focus-new-tab.timeTrackingSession'
const ENTRIES_FALLBACK_KEY = 'focus-new-tab.timeEntries'

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local)
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

function normalizeEntry(raw: unknown): TimeEntry | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const value = raw as Partial<TimeEntry>
  const startedAt = Number(value.startedAt)
  const endedAt = Number(value.endedAt)
  const durationMs = Number(value.durationMs)

  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt < startedAt) {
    return null
  }

  return {
    id: typeof value.id === 'string' ? value.id : crypto.randomUUID(),
    startedAt,
    endedAt,
    durationMs: Number.isFinite(durationMs) && durationMs > 0 ? durationMs : endedAt - startedAt,
    label: typeof value.label === 'string' ? value.label.trim() : '',
    comment: typeof value.comment === 'string' ? value.comment.trim() : '',
    dateKey: typeof value.dateKey === 'string' ? value.dateKey : toDateKey(endedAt),
  }
}

function loadFallbackSession(): ActiveTimeTracking | null {
  const raw = localStorage.getItem(SESSION_FALLBACK_KEY)

  if (!raw) {
    return null
  }

  try {
    return normalizeActiveSession(JSON.parse(raw))
  } catch {
    return null
  }
}

function loadFallbackEntries(): TimeEntry[] {
  const raw = localStorage.getItem(ENTRIES_FALLBACK_KEY)

  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as unknown[]
    return Array.isArray(parsed)
      ? parsed.map(normalizeEntry).filter((entry): entry is TimeEntry => entry !== null)
      : []
  } catch {
    return []
  }
}

async function saveActiveSession(session: ActiveTimeTracking | null): Promise<void> {
  if (hasChromeStorage()) {
    try {
      if (session) {
        await chrome.storage.local.set({ [TIME_TRACKING_SESSION_KEY]: session })
      } else {
        await chrome.storage.local.remove(TIME_TRACKING_SESSION_KEY)
      }
    } catch {
      // Fall back to localStorage below.
    }
  }

  if (session) {
    localStorage.setItem(SESSION_FALLBACK_KEY, JSON.stringify(session))
  } else {
    localStorage.removeItem(SESSION_FALLBACK_KEY)
  }
}

async function saveEntries(
  entries: TimeEntry[],
  options: { skipSync?: boolean } = {},
): Promise<void> {
  if (hasChromeStorage()) {
    try {
      await chrome.storage.local.set({ [TIME_ENTRIES_KEY]: entries })
    } catch {
      // Fall back to localStorage below.
    }
  }

  localStorage.setItem(ENTRIES_FALLBACK_KEY, JSON.stringify(entries))

  if (!options.skipSync) {
    scheduleSyncPush()
  }
}

export async function replaceTimeEntries(
  entries: TimeEntry[],
  options: { skipSync?: boolean } = {},
): Promise<void> {
  await saveEntries(entries, options)
}

export async function replaceActiveTimeTracking(session: ActiveTimeTracking | null): Promise<void> {
  await saveActiveSession(session)
}

export async function getActiveTimeTracking(): Promise<ActiveTimeTracking | null> {
  if (hasChromeStorage()) {
    try {
      const data = await chrome.storage.local.get(TIME_TRACKING_SESSION_KEY)
      const session = normalizeActiveSession(data[TIME_TRACKING_SESSION_KEY])

      if (session) {
        return session
      }
    } catch {
      // Fall back to localStorage below.
    }
  }

  return loadFallbackSession()
}

export async function isTimeTrackingActive(): Promise<boolean> {
  const session = await getActiveTimeTracking()
  return session !== null
}

export async function getTimeEntries(): Promise<TimeEntry[]> {
  if (hasChromeStorage()) {
    try {
      const data = await chrome.storage.local.get(TIME_ENTRIES_KEY)
      const entries = data[TIME_ENTRIES_KEY] as unknown[] | undefined

      if (Array.isArray(entries)) {
        return entries.map(normalizeEntry).filter((entry): entry is TimeEntry => entry !== null)
      }
    } catch {
      // Fall back to localStorage below.
    }
  }

  return loadFallbackEntries()
}

export async function startTimeTracking(input: {
  label: string
  comment: string
  startedAt?: number
}): Promise<ActiveTimeTracking> {
  const active = await getActiveTimeTracking()

  if (active) {
    return active
  }

  const session: ActiveTimeTracking = {
    startedAt: input.startedAt ?? Date.now(),
    label: input.label.trim(),
    comment: input.comment.trim(),
  }

  await saveActiveSession(session)
  return session
}

export async function updateActiveTimeTracking(
  input: Partial<Pick<ActiveTimeTracking, 'label' | 'comment'>>,
): Promise<ActiveTimeTracking | null> {
  const session = await getActiveTimeTracking()

  if (!session) {
    return null
  }

  const next: ActiveTimeTracking = {
    ...session,
    label: input.label !== undefined ? input.label.trim() : session.label,
    comment: input.comment !== undefined ? input.comment.trim() : session.comment,
  }

  await saveActiveSession(next)
  return next
}

export async function stopTimeTracking(endedAt = Date.now()): Promise<TimeEntry | null> {
  const session = await getActiveTimeTracking()

  if (!session) {
    return null
  }

  const entry: TimeEntry = {
    id: crypto.randomUUID(),
    startedAt: session.startedAt,
    endedAt,
    durationMs: Math.max(0, endedAt - session.startedAt),
    label: session.label,
    comment: session.comment,
    dateKey: toDateKey(endedAt),
  }

  const entries = await getTimeEntries()
  entries.unshift(entry)
  await saveEntries(entries)
  await saveActiveSession(null)

  return entry
}
