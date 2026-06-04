import { scheduleImmediateSyncPush } from './sync/hooks'

export type TimerKind = 'Focus' | 'Short break' | 'Long break'
export type BreakKind = 'Short break' | 'Long break'

export interface BreakState {
  active: boolean
  kind: BreakKind
  durationMs: number
  endsAt: number
  startedAt: number
}

export interface TimerState {
  active: boolean
  kind: TimerKind
  durationMs: number
  endsAt: number
  pausedForBreak?: boolean
  break?: BreakState | null
  focusPlannedMs?: number
  sessionStartedAt?: number
}

export interface WallAlarm {
  enabled: boolean
  hour: number
  minute: number
  label?: string
}

export const TIMER_STORAGE_KEY = 'timer'
export const WALL_ALARM_STORAGE_KEY = 'wallAlarm'
export const FOCUS_TIMER_ALARM = 'focus-timer'
export const BREAK_TIMER_ALARM = 'break-timer'
export const WALL_ALARM_NAME = 'wall-alarm'
export const TIMER_FALLBACK_KEY = 'focus-new-tab.timer'
export const MAX_SESSION_MS = 4 * 60 * 60_000

const defaultWallAlarm = (): WallAlarm => ({ enabled: false, hour: 7, minute: 0 })

export function emptyTimerState(): TimerState {
  return {
    active: false,
    kind: 'Focus',
    durationMs: 0,
    endsAt: 0,
    pausedForBreak: false,
    break: null,
  }
}

export function hasPausedFocusRemaining(state: TimerState): boolean {
  return (
    !state.active &&
    !state.break?.active &&
    !state.pausedForBreak &&
    state.kind === 'Focus' &&
    state.durationMs > 0
  )
}

function normalizeBreakState(raw: BreakState | null | undefined): BreakState | null {
  if (!raw?.active) {
    return null
  }

  const kind: BreakKind = raw.kind === 'Long break' ? 'Long break' : 'Short break'
  const durationMs = Number(raw.durationMs)
  const endsAt = Number(raw.endsAt)
  const startedAt = Number(raw.startedAt)

  if (!Number.isFinite(endsAt) || endsAt <= Date.now()) {
    return null
  }

  const resolvedDurationMs =
    Number.isFinite(durationMs) && durationMs > 0 ? durationMs : endsAt - Date.now()

  return {
    active: true,
    kind,
    durationMs: resolvedDurationMs,
    endsAt,
    startedAt:
      Number.isFinite(startedAt) && startedAt > 0 ? startedAt : endsAt - resolvedDurationMs,
  }
}

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local)
}

export function normalizeTimerState(raw: Partial<TimerState> | null | undefined): TimerState {
  const fallback = emptyTimerState()
  const kind =
    raw?.kind === 'Short break' || raw?.kind === 'Long break' || raw?.kind === 'Focus'
      ? raw.kind
      : fallback.kind

  const parsedDurationMs = Number(raw?.durationMs)
  const breakState = normalizeBreakState(raw?.break ?? null)
  const focusPlannedMs = Number(raw?.focusPlannedMs)
  const sessionStartedAt = Number(raw?.sessionStartedAt)
  const isActive = Boolean(raw?.active)
  const state: TimerState = {
    active: isActive,
    kind,
    durationMs:
      Number.isFinite(parsedDurationMs) && parsedDurationMs > 0 && parsedDurationMs <= MAX_SESSION_MS
        ? parsedDurationMs
        : isActive
          ? Number.isFinite(focusPlannedMs) && focusPlannedMs > 0
            ? focusPlannedMs
            : 30 * 60_000
          : 0,
    endsAt: Number(raw?.endsAt) || 0,
    pausedForBreak: Boolean(raw?.pausedForBreak) && Boolean(breakState),
    break: breakState,
    focusPlannedMs:
      Number.isFinite(focusPlannedMs) && focusPlannedMs > 0 && focusPlannedMs <= MAX_SESSION_MS
        ? focusPlannedMs
        : undefined,
    sessionStartedAt:
      Number.isFinite(sessionStartedAt) && sessionStartedAt > 0 ? sessionStartedAt : undefined,
  }

  if (breakState) {
    state.active = false
    state.endsAt = 0
    state.kind = 'Focus'
    state.pausedForBreak = true
    return state
  }

  state.pausedForBreak = false
  state.break = null

  if (!state.active) {
    state.endsAt = 0

    if (!hasPausedFocusRemaining(state)) {
      state.durationMs = 0
      state.focusPlannedMs = undefined
      state.sessionStartedAt = undefined
    }

    return state
  }

  const remaining = state.endsAt - Date.now()

  if (!Number.isFinite(state.endsAt) || remaining <= 0) {
    return { ...state, active: false, endsAt: 0 }
  }

  if (remaining > MAX_SESSION_MS || remaining > state.durationMs + 60_000) {
    state.endsAt = Date.now() + state.durationMs
  }

  return state
}

export function nextWallAlarmTimestamp(hour: number, minute: number, from = Date.now()): number {
  const next = new Date(from)
  next.setHours(hour, minute, 0, 0)

  if (next.getTime() <= from) {
    next.setDate(next.getDate() + 1)
  }

  return next.getTime()
}

export function formatWallAlarmTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function parseWallAlarmTime(value: string): { hour: number; minute: number } {
  const [hourPart, minutePart] = value.split(':')
  const hour = Number(hourPart)
  const minute = Number(minutePart)

  return {
    hour: Number.isFinite(hour) ? hour : 7,
    minute: Number.isFinite(minute) ? minute : 0,
  }
}

export async function getStorageTimer(): Promise<TimerState | null> {
  if (hasChromeStorage()) {
    try {
      const data = await chrome.storage.local.get(TIMER_STORAGE_KEY)
      const raw = data[TIMER_STORAGE_KEY] as TimerState | undefined
      return raw ? normalizeTimerState(raw) : null
    } catch {
      // Fall back to localStorage below.
    }
  }

  const raw = localStorage.getItem(TIMER_FALLBACK_KEY)

  if (!raw) {
    return null
  }

  try {
    return normalizeTimerState(JSON.parse(raw) as TimerState)
  } catch {
    return null
  }
}

export async function setStorageTimer(
  timer: TimerState,
  options: { skipSync?: boolean } = {},
): Promise<void> {
  const normalized = normalizeTimerState(timer)

  if (hasChromeStorage()) {
    try {
      await chrome.storage.local.set({ [TIMER_STORAGE_KEY]: normalized })
    } catch {
      // Fall back to localStorage below.
    }
  }

  localStorage.setItem(TIMER_FALLBACK_KEY, JSON.stringify(normalized))

  if (!options.skipSync) {
    scheduleImmediateSyncPush()
  }
}

export async function scheduleTimerAlarm(endsAt: number): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.alarms) {
    return
  }

  try {
    await chrome.alarms.clear(FOCUS_TIMER_ALARM)

    if (endsAt > Date.now()) {
      await chrome.alarms.create(FOCUS_TIMER_ALARM, { when: endsAt })
    }
  } catch {
    // Timer UI should keep working without background alarms.
  }
}

export async function clearTimerAlarm(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.alarms) {
    return
  }

  try {
    await chrome.alarms.clear(FOCUS_TIMER_ALARM)
  } catch {
    // Ignore alarm API failures in the page context.
  }
}

export async function scheduleBreakAlarm(endsAt: number): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.alarms) {
    return
  }

  try {
    await chrome.alarms.clear(BREAK_TIMER_ALARM)

    if (endsAt > Date.now()) {
      await chrome.alarms.create(BREAK_TIMER_ALARM, { when: endsAt })
    }
  } catch {
    // Timer UI should keep working without background alarms.
  }
}

export async function clearBreakAlarm(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.alarms) {
    return
  }

  try {
    await chrome.alarms.clear(BREAK_TIMER_ALARM)
  } catch {
    // Ignore alarm API failures in the page context.
  }
}

export async function getWallAlarm(): Promise<WallAlarm> {
  const data = await chrome.storage.local.get(WALL_ALARM_STORAGE_KEY)
  return (data[WALL_ALARM_STORAGE_KEY] as WallAlarm | undefined) ?? defaultWallAlarm()
}

export async function setWallAlarm(
  alarm: WallAlarm,
  options: { skipSync?: boolean } = {},
): Promise<void> {
  await chrome.storage.local.set({ [WALL_ALARM_STORAGE_KEY]: alarm })

  if (!options.skipSync) {
    scheduleImmediateSyncPush()
  }
}

export async function scheduleWallAlarm(hour: number, minute: number): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.alarms) {
    return
  }

  try {
    await chrome.alarms.clear(WALL_ALARM_NAME)
    const when = nextWallAlarmTimestamp(hour, minute)
    await chrome.alarms.create(WALL_ALARM_NAME, { when, periodInMinutes: 24 * 60 })
  } catch {
    // Ignore alarm API failures in the page context.
  }
}

export async function clearWallAlarm(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.alarms) {
    return
  }

  try {
    await chrome.alarms.clear(WALL_ALARM_NAME)
  } catch {
    // Ignore alarm API failures in the page context.
  }
}
