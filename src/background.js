const TIMER_STORAGE_KEY = 'timer'
const FOCUS_BLOCKS_KEY = 'focusBlocks'
const FOCUS_TIMER_ALARM = 'focus-timer'
const BREAK_TIMER_ALARM = 'break-timer'
const WALL_ALARM_NAME = 'wall-alarm'

async function triggerSyncPush() {
  try {
    const { pushSyncFromServiceWorker } = await import('./sync/coordinator')
    await pushSyncFromServiceWorker()
  } catch {
    // Sync is optional when the module is unavailable.
  }
}

function toDateKey(ms) {
  const date = new Date(ms)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function appendFocusBlock(completedAt, plannedDurationMs) {
  const data = await chrome.storage.local.get(FOCUS_BLOCKS_KEY)
  const blocks = Array.isArray(data[FOCUS_BLOCKS_KEY]) ? data[FOCUS_BLOCKS_KEY] : []

  blocks.push({
    id: crypto.randomUUID(),
    completedAt,
    plannedDurationMs,
    dateKey: toDateKey(completedAt),
  })

  await chrome.storage.local.set({ [FOCUS_BLOCKS_KEY]: blocks })
}

function resumeFocusAfterBreak(timer) {
  const remaining = Number(timer.durationMs) || 0

  return {
    ...timer,
    active: remaining > 0,
    kind: 'Focus',
    durationMs: remaining,
    endsAt: remaining > 0 ? Date.now() + remaining : 0,
    pausedForBreak: false,
    break: null,
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === WALL_ALARM_NAME) {
    chrome.notifications.create(`notification-${WALL_ALARM_NAME}`, {
      type: 'basic',
      iconUrl: 'favicon.svg',
      title: 'Alarm',
      message: 'Your scheduled alarm is ringing.',
    })
    return
  }

  if (alarm.name === BREAK_TIMER_ALARM) {
    const data = await chrome.storage.local.get(TIMER_STORAGE_KEY)
    const timer = data[TIMER_STORAGE_KEY] ?? {}
    const resumed = resumeFocusAfterBreak(timer)

    await chrome.storage.local.set({ [TIMER_STORAGE_KEY]: resumed })

    await triggerSyncPush()

    if (resumed.active && resumed.endsAt > Date.now()) {
      await chrome.alarms.create(FOCUS_TIMER_ALARM, { when: resumed.endsAt })
    }

    chrome.notifications.create(`notification-${BREAK_TIMER_ALARM}`, {
      type: 'basic',
      iconUrl: 'favicon.svg',
      title: 'Break over',
      message: 'Back to your focus session.',
    })
    return
  }

  if (alarm.name !== FOCUS_TIMER_ALARM) {
    return
  }

  const data = await chrome.storage.local.get(TIMER_STORAGE_KEY)
  const timer = data[TIMER_STORAGE_KEY] ?? {}
  const kind = timer.kind ?? 'Focus'

  if (kind === 'Focus' && !timer.break?.active) {
    const plannedDurationMs = Number(timer.focusPlannedMs) || Number(timer.durationMs) || 0

    if (plannedDurationMs > 0) {
      const completedAt = Number(timer.endsAt) > 0 ? Number(timer.endsAt) : Date.now()
      await appendFocusBlock(completedAt, plannedDurationMs)
    }
  }

  await chrome.storage.local.set({
    [TIMER_STORAGE_KEY]: {
      ...timer,
      active: false,
      durationMs: 0,
      endsAt: 0,
      pausedForBreak: false,
      break: null,
      focusPlannedMs: undefined,
    },
  })

  await triggerSyncPush()

  const title = `${kind} complete`
  const message =
    kind === 'Focus'
      ? 'Focus session complete.'
      : kind === 'Short break'
        ? 'Short break is over.'
        : 'Long break is over.'

  chrome.notifications.create(`notification-${FOCUS_TIMER_ALARM}`, {
    type: 'basic',
    iconUrl: 'favicon.svg',
    title,
    message,
  })
})
