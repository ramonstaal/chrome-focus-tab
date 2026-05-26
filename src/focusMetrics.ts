export interface FocusBlock {
  id: string
  completedAt: number
  plannedDurationMs: number
  durationMs: number
  dateKey: string
}

export interface FocusTimerSnapshot {
  kind: string
  active: boolean
  durationMs: number
  endsAt: number
  focusPlannedMs?: number
  sessionStartedAt?: number
  pausedForBreak?: boolean
  break?: { active: boolean } | null
}

export const FOCUS_BLOCKS_KEY = 'focusBlocks'
const FOCUS_BLOCKS_FALLBACK_KEY = 'focus-new-tab.focusBlocks'

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local)
}

export function toDateKey(value: Date | number = Date.now()): string {
  const date = typeof value === 'number' ? new Date(value) : value
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function formatBlockTime(completedAt: number): string {
  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(completedAt)
}

export function formatBlockDuration(plannedDurationMs: number): string {
  const totalMinutes = Math.round(plannedDurationMs / 60_000)

  if (totalMinutes < 60) {
    return `${totalMinutes} min`
  }

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
}

export function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

function normalizeFocusBlock(raw: unknown): FocusBlock | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const value = raw as Partial<FocusBlock>
  const completedAt = Number(value.completedAt)
  const plannedDurationMs = Number(value.plannedDurationMs)
  const durationMs = Number(value.durationMs)

  if (!Number.isFinite(completedAt) || !Number.isFinite(plannedDurationMs) || plannedDurationMs <= 0) {
    return null
  }

  const resolvedDurationMs =
    Number.isFinite(durationMs) && durationMs > 0 ? durationMs : plannedDurationMs

  return {
    id: typeof value.id === 'string' ? value.id : crypto.randomUUID(),
    completedAt,
    plannedDurationMs,
    durationMs: Math.min(resolvedDurationMs, plannedDurationMs),
    dateKey: typeof value.dateKey === 'string' ? value.dateKey : toDateKey(completedAt),
  }
}

export function getFocusSessionActualMs(timer: FocusTimerSnapshot, endedAt = Date.now()): number {
  if (timer.kind !== 'Focus') {
    return 0
  }

  const plannedDurationMs = timer.focusPlannedMs ?? timer.durationMs

  if (!Number.isFinite(plannedDurationMs) || plannedDurationMs <= 0) {
    return 0
  }

  if (timer.break?.active || (timer.pausedForBreak && !timer.active)) {
    return Math.max(0, Math.min(plannedDurationMs - timer.durationMs, plannedDurationMs))
  }

  if (!timer.active && timer.durationMs > 0 && timer.endsAt === 0) {
    return Math.max(0, Math.min(plannedDurationMs - timer.durationMs, plannedDurationMs))
  }

  const sessionStartedAt = timer.sessionStartedAt

  const startedAt =
    sessionStartedAt !== undefined && Number.isFinite(sessionStartedAt) && sessionStartedAt > 0
      ? sessionStartedAt
      : timer.endsAt > 0
        ? timer.endsAt - timer.durationMs
        : endedAt - timer.durationMs

  return Math.max(0, Math.min(endedAt - startedAt, plannedDurationMs))
}

export async function getFocusBlocks(): Promise<FocusBlock[]> {
  if (hasChromeStorage()) {
    try {
      const data = await chrome.storage.local.get(FOCUS_BLOCKS_KEY)
      const blocks = data[FOCUS_BLOCKS_KEY] as unknown[] | undefined

      if (Array.isArray(blocks)) {
        return blocks.map(normalizeFocusBlock).filter((block): block is FocusBlock => block !== null)
      }
    } catch {
      // Fall back to localStorage below.
    }
  }

  const raw = localStorage.getItem(FOCUS_BLOCKS_FALLBACK_KEY)

  if (!raw) {
    return []
  }

  try {
    const blocks = JSON.parse(raw) as unknown[]
    return Array.isArray(blocks)
      ? blocks.map(normalizeFocusBlock).filter((block): block is FocusBlock => block !== null)
      : []
  } catch {
    return []
  }
}

export async function addFocusBlock(input: {
  completedAt: number
  plannedDurationMs: number
  durationMs: number
}): Promise<FocusBlock | null> {
  const durationMs = Math.max(0, Math.min(input.durationMs, input.plannedDurationMs))

  if (durationMs <= 0) {
    return null
  }

  const block: FocusBlock = {
    id: crypto.randomUUID(),
    completedAt: input.completedAt,
    plannedDurationMs: input.plannedDurationMs,
    durationMs,
    dateKey: toDateKey(input.completedAt),
  }

  const blocks = await getFocusBlocks()
  blocks.push(block)
  await saveFocusBlocks(blocks)

  return block
}

function isFocusSessionRecordable(timer: FocusTimerSnapshot, endedAt = Date.now()): boolean {
  if (timer.kind !== 'Focus') {
    return false
  }

  return getFocusSessionActualMs(timer, endedAt) > 0
}

async function saveFocusBlocks(blocks: FocusBlock[]): Promise<void> {
  if (hasChromeStorage()) {
    try {
      await chrome.storage.local.set({ [FOCUS_BLOCKS_KEY]: blocks })
    } catch {
      // Fall back to localStorage below.
    }
  }

  localStorage.setItem(FOCUS_BLOCKS_FALLBACK_KEY, JSON.stringify(blocks))
}

export async function recordCompletedFocusBlock(
  timer: FocusTimerSnapshot,
  endedAt = Date.now(),
): Promise<void> {
  if (!isFocusSessionRecordable(timer, endedAt)) {
    return
  }

  const plannedDurationMs = timer.focusPlannedMs ?? timer.durationMs

  if (!Number.isFinite(plannedDurationMs) || plannedDurationMs <= 0) {
    return
  }

  const durationMs = getFocusSessionActualMs(timer, endedAt)
  const completedAt = timer.endsAt > endedAt ? timer.endsAt : endedAt

  await addFocusBlock({
    completedAt,
    plannedDurationMs,
    durationMs,
  })
}
