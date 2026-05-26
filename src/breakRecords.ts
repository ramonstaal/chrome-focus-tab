import { toDateKey } from './focusMetrics'
import type { BreakKind, BreakState, TimerState } from './chromeAlarms'

export interface BreakRecord {
  id: string
  kind: BreakKind
  startedAt: number
  endedAt: number
  durationMs: number
  plannedDurationMs: number
  dateKey: string
}

export const BREAK_RECORDS_KEY = 'breakRecords'
const BREAK_RECORDS_FALLBACK_KEY = 'focus-new-tab.breakRecords'

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local)
}

function normalizeBreakRecord(raw: unknown): BreakRecord | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const value = raw as Partial<BreakRecord>
  const startedAt = Number(value.startedAt)
  const endedAt = Number(value.endedAt)
  const durationMs = Number(value.durationMs)
  const plannedDurationMs = Number(value.plannedDurationMs)
  const kind: BreakKind = value.kind === 'Long break' ? 'Long break' : 'Short break'

  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt < startedAt) {
    return null
  }

  const actualDurationMs =
    Number.isFinite(durationMs) && durationMs > 0 ? durationMs : Math.max(0, endedAt - startedAt)

  return {
    id: typeof value.id === 'string' ? value.id : crypto.randomUUID(),
    kind,
    startedAt,
    endedAt,
    durationMs: actualDurationMs,
    plannedDurationMs:
      Number.isFinite(plannedDurationMs) && plannedDurationMs > 0 ? plannedDurationMs : actualDurationMs,
    dateKey: typeof value.dateKey === 'string' ? value.dateKey : toDateKey(endedAt),
  }
}

export function computeActualBreakDurationMs(
  startedAt: number,
  endedAt: number,
  plannedDurationMs: number,
): number {
  const elapsed = Math.max(0, endedAt - startedAt)

  if (!Number.isFinite(plannedDurationMs) || plannedDurationMs <= 0) {
    return elapsed
  }

  return Math.min(elapsed, plannedDurationMs)
}

export function getBreakStartedAt(breakState: BreakState): number {
  if (Number.isFinite(breakState.startedAt) && breakState.startedAt > 0) {
    return breakState.startedAt
  }

  return breakState.endsAt - breakState.durationMs
}

export async function getBreakRecords(): Promise<BreakRecord[]> {
  if (hasChromeStorage()) {
    try {
      const data = await chrome.storage.local.get(BREAK_RECORDS_KEY)
      const records = data[BREAK_RECORDS_KEY] as unknown[] | undefined

      if (Array.isArray(records)) {
        return records.map(normalizeBreakRecord).filter((record): record is BreakRecord => record !== null)
      }
    } catch {
      // Fall back to localStorage below.
    }
  }

  const raw = localStorage.getItem(BREAK_RECORDS_FALLBACK_KEY)

  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as unknown[]
    return Array.isArray(parsed)
      ? parsed.map(normalizeBreakRecord).filter((record): record is BreakRecord => record !== null)
      : []
  } catch {
    return []
  }
}

async function saveBreakRecords(records: BreakRecord[]): Promise<void> {
  if (hasChromeStorage()) {
    try {
      await chrome.storage.local.set({ [BREAK_RECORDS_KEY]: records })
    } catch {
      // Fall back to localStorage below.
    }
  }

  localStorage.setItem(BREAK_RECORDS_FALLBACK_KEY, JSON.stringify(records))
}

export async function addBreakRecord(input: {
  kind: BreakKind
  startedAt: number
  endedAt: number
  plannedDurationMs: number
  durationMs?: number
}): Promise<BreakRecord | null> {
  const durationMs =
    input.durationMs !== undefined && input.durationMs > 0
      ? Math.min(input.durationMs, input.plannedDurationMs)
      : computeActualBreakDurationMs(input.startedAt, input.endedAt, input.plannedDurationMs)

  if (durationMs <= 0) {
    return null
  }

  const record: BreakRecord = {
    id: crypto.randomUUID(),
    kind: input.kind,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs,
    plannedDurationMs: input.plannedDurationMs,
    dateKey: toDateKey(input.endedAt),
  }

  const records = await getBreakRecords()
  records.unshift(record)
  await saveBreakRecords(records)

  return record
}

export async function recordBreakFromBreakState(
  breakState: BreakState,
  endedAt = Date.now(),
): Promise<BreakRecord | null> {
  const startedAt = getBreakStartedAt(breakState)

  return addBreakRecord({
    kind: breakState.kind,
    startedAt,
    endedAt,
    plannedDurationMs: breakState.durationMs,
  })
}

function isStandaloneBreakKind(kind: string): kind is BreakKind {
  return kind === 'Short break' || kind === 'Long break'
}

function resolveSessionStartedAt(session: TimerState, endedAt: number): number {
  const sessionStartedAt = session.sessionStartedAt

  if (sessionStartedAt !== undefined && Number.isFinite(sessionStartedAt) && sessionStartedAt > 0) {
    return sessionStartedAt
  }

  if (session.endsAt > 0) {
    return session.endsAt - session.durationMs
  }

  return endedAt - session.durationMs
}

export function getStandaloneBreakActualMs(session: TimerState, endedAt: number): number {
  const plannedDurationMs = session.focusPlannedMs ?? session.durationMs

  if (!Number.isFinite(plannedDurationMs) || plannedDurationMs <= 0) {
    return 0
  }

  const startedAt = resolveSessionStartedAt(session, endedAt)

  if (!session.active && session.durationMs > 0 && session.endsAt === 0) {
    return Math.max(0, Math.min(plannedDurationMs - session.durationMs, plannedDurationMs))
  }

  return computeActualBreakDurationMs(startedAt, endedAt, plannedDurationMs)
}

export async function recordStandaloneBreakSession(
  session: TimerState,
  endedAt = Date.now(),
): Promise<BreakRecord | null> {
  if (!isStandaloneBreakKind(session.kind)) {
    return null
  }

  const plannedDurationMs = session.focusPlannedMs ?? session.durationMs
  const durationMs = getStandaloneBreakActualMs(session, endedAt)

  if (durationMs <= 0 || !Number.isFinite(plannedDurationMs) || plannedDurationMs <= 0) {
    return null
  }

  const startedAt = resolveSessionStartedAt(session, endedAt)

  return addBreakRecord({
    kind: session.kind,
    startedAt,
    endedAt,
    plannedDurationMs,
    durationMs,
  })
}
