<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, watchEffect } from 'vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import {
  AlarmClock,
  Check,
  Clock3,
  ImagePlus,
  Pause,
  Play,
  BarChart3,
  Square,
  Settings,
  Trash2,
} from '@lucide/vue'
import CountdownClock from './components/CountdownClock.vue'
import MinimalConfirmDialog from './components/MinimalConfirmDialog.vue'
import MetricsCalendar from './components/MetricsCalendar.vue'
import TimeTracking from './components/TimeTracking.vue'
import TimeTrackingStartDialog from './components/TimeTrackingStartDialog.vue'
import TaskEditDialog from './components/TaskEditDialog.vue'
import TodoBoard from './components/TodoBoard.vue'
import TodoCategoryTabs from './components/TodoCategoryTabs.vue'
import CategoryDialog from './components/CategoryDialog.vue'
import WeatherForecast from './components/WeatherForecast.vue'
import {
  DEFAULT_STATUS,
  type Subtodo,
  type TaskStatus,
  type Todo,
} from './todos'
import {
  clearBreakAlarm,
  clearTimerAlarm,
  clearWallAlarm,
  emptyTimerState,
  hasPausedFocusRemaining,
  formatWallAlarmTime,
  getStorageTimer,
  getWallAlarm,
  nextWallAlarmTimestamp,
  normalizeTimerState,
  parseWallAlarmTime,
  scheduleBreakAlarm,
  scheduleTimerAlarm,
  scheduleWallAlarm,
  setStorageTimer,
  setWallAlarm,
  TIMER_STORAGE_KEY,
  type BreakKind,
  type TimerKind,
  type TimerState,
  type WallAlarm,
} from './chromeAlarms'
import {
  getAppSettings,
  pickRandomCustomBackground,
  setAppSettings,
  type AppSettings,
  type WeatherLocationMode,
  type WeatherUnits,
} from './appSettings'
import { geocodeCity } from './weather'
import { addArchivedTodo } from './archivedTodos'
import { recordCompletedSubtodoAction, recordCompletedTodoAction } from './completedActions'
import { recordCompletedFocusBlock } from './focusMetrics'
import { compressBackgroundImage } from './utils/backgroundImage'
import { formatDuration } from './utils/duration'
import { playSchoolbell, playTimerBeep } from './utils/sounds'
import { recordBreakFromBreakState, recordStandaloneBreakSession } from './breakRecords'
import { isTimeTrackingActive, startTimeTracking } from './timeTracking'
import { getTodos, saveTodos as persistTodos } from './todosStorage'
import {
  getCategories,
  loadActiveCategoryId,
  resolveActiveCategoryId,
  saveActiveCategoryId,
  saveCategories as persistCategories,
} from './categoriesStorage'
import { createCategory, type TodoCategory } from './categories'
import {
  loadCollapsedTodoIds,
  pruneCollapsedTodoIds,
  saveCollapsedTodoIds,
} from './collapsedTodos'
import {
  applyLocalBackup,
  downloadLocalBackup,
  parseLocalBackupJson,
  type LocalBackup,
} from './localBackup'
import {
  getSyncApiUrl,
  initSync,
  registerSyncApplyHandler,
  stopSyncPolling,
  syncNow,
} from './sync/coordinator'

type ViewName = 'clock' | 'settings' | 'metrics'

interface BackgroundPreset {
  label: string
  value: string
  css: string
}

type EditTarget =
  | { kind: 'todo'; todoId: string }
  | { kind: 'subtodo'; todoId: string; subtodoId: string }

type DeleteTarget =
  | { kind: 'todo'; todoId: string; title: string }
  | { kind: 'subtodo'; todoId: string; subtodoId: string; title: string }

const LEGACY_TIMER_KEY = 'focus-new-tab.timer'
const DEFAULT_DOCUMENT_TITLE = 'Focus Todo'

const backgroundPresets: BackgroundPreset[] = [
  {
    label: 'Alpine Dawn',
    value: 'alpine',
    css: 'radial-gradient(circle at 52% 22%, rgba(255,255,255,.2), transparent 22%), linear-gradient(160deg, #364158 0%, #6f7082 34%, #d29072 56%, #101827 100%)',
  },
  {
    label: 'Deep Glacier',
    value: 'glacier',
    css: 'radial-gradient(circle at 75% 16%, rgba(155,211,255,.3), transparent 24%), linear-gradient(150deg, #0f172a 0%, #24425e 44%, #0b101c 100%)',
  },
  {
    label: 'Warm Dusk',
    value: 'dusk',
    css: 'radial-gradient(circle at 78% 28%, rgba(255,196,132,.38), transparent 24%), linear-gradient(145deg, #1f2540 0%, #77556f 45%, #111827 100%)',
  },
]

const timerOptions = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '60 min', value: 60 },
  { label: '120 min', value: 120 },
]

const view = ref<ViewName>('clock')
const todos = ref<Todo[]>([])
const categories = ref<TodoCategory[]>([])
const activeCategoryId = ref('')
const collapsedTodoIds = ref<Set<string>>(loadCollapsedTodoIds())
const categoryDialogOpen = ref(false)
const categoryDialogMode = ref<'create' | 'edit'>('create')
const editingCategory = ref<TodoCategory | null>(null)
const settings = ref<AppSettings>({
  background: 'alpine',
  customBackgrounds: [],
  countdownEnabled: true,
  timeTrackingEnabled: true,
  todosEnabled: true,
  weatherEnabled: false,
  weatherLocationMode: 'auto',
  weatherCity: '',
  weatherLatitude: null,
  weatherLongitude: null,
  weatherLocationLabel: '',
  weatherUnits: 'celsius',
  weatherForecastDays: 7,
  syncEnabled: false,
  syncToken: '',
  syncLastAt: null,
  syncLastError: '',
  syncEtag: null,
})
const displayedCustomBackground = ref('')
const timer = ref<TimerState>(emptyTimerState())
const timerRevision = ref(0)
const wallAlarm = ref<WallAlarm>({ enabled: false, hour: 7, minute: 0 })
const wallAlarmTime = ref('07:00')
const now = ref(Date.now())
const selectedFocusMinutes = ref(30)
const settingsOpen = ref(false)
const alarmOpen = ref(false)
const restartConfirmOpen = ref(false)
const resetConfirmOpen = ref(false)
const timeTrackingPromptOpen = ref(false)
const pendingFocusMinutes = ref<number | null>(null)
const pendingTimerStart = ref<{ kind: TimerKind; minutes: number } | null>(null)
const timeTrackingRef = ref<InstanceType<typeof TimeTracking> | null>(null)
const metricsRef = ref<InstanceType<typeof MetricsCalendar> | null>(null)
const editTarget = ref<EditTarget | null>(null)
const deleteTarget = ref<DeleteTarget | null>(null)
const deleteConfirmOpen = ref(false)
const backupRestoreConfirmOpen = ref(false)
const backupError = ref('')
const backupInputRef = ref<HTMLInputElement | null>(null)
let pendingBackup: LocalBackup | null = null

const deleteConfirmTitle = computed(() => {
  if (deleteTarget.value?.kind === 'subtodo') {
    return 'Delete subtodo?'
  }

  return 'Delete todo?'
})

const deleteConfirmMessage = computed(() => {
  const target = deleteTarget.value

  if (!target) {
    return ''
  }

  const label = target.title.trim() || 'this item'
  const kindLabel = target.kind === 'subtodo' ? 'subtodo' : 'todo'

  return `“${label}” will be removed. This ${kindLabel} can't be recovered.`
})
const editDialogOpen = computed({
  get: () => editTarget.value !== null,
  set: (open) => {
    if (!open) {
      editTarget.value = null
    }
  },
})

const editingTodo = computed<Todo | null>(() => {
  const target = editTarget.value

  if (!target) {
    return null
  }

  return todos.value.find((todo) => todo.id === target.todoId) ?? null
})

const editingSubtodo = computed<Subtodo | null>(() => {
  const target = editTarget.value

  if (!target || target.kind !== 'subtodo' || !editingTodo.value) {
    return null
  }

  return editingTodo.value.subtodos.find((subtodo) => subtodo.id === target.subtodoId) ?? null
})

const editingTitle = computed(() => {
  if (editTarget.value?.kind === 'subtodo') {
    return editingSubtodo.value?.title ?? ''
  }

  return editingTodo.value?.title ?? ''
})

const editingStatus = computed<TaskStatus>(() => {
  if (editTarget.value?.kind === 'subtodo') {
    return editingSubtodo.value?.status ?? DEFAULT_STATUS
  }

  return editingTodo.value?.status ?? DEFAULT_STATUS
})

const editingNotes = computed(() => {
  if (editTarget.value?.kind === 'subtodo') {
    return editingSubtodo.value?.notes ?? ''
  }

  return editingTodo.value?.notes ?? ''
})

const editingKind = computed<'todo' | 'subtodo'>(() =>
  editTarget.value?.kind === 'subtodo' ? 'subtodo' : 'todo',
)

const editingCategoryId = computed(() => editingTodo.value?.categoryId ?? activeCategoryId.value)

const activeCategory = computed(
  () => categories.value.find((category) => category.id === activeCategoryId.value) ?? null,
)

const activeCategoryTodos = computed(() =>
  todos.value.filter((todo) => todo.categoryId === activeCategoryId.value),
)

const todoCountsByCategory = computed(() => {
  const counts: Record<string, number> = {}

  for (const category of categories.value) {
    counts[category.id] = 0
  }

  for (const todo of todos.value) {
    if (counts[todo.categoryId] !== undefined) {
      counts[todo.categoryId] += 1
    }
  }

  return counts
})

const canDeleteEditingCategory = computed(() => categories.value.length > 1)

const pendingFocusEndLabel = computed(() => {
  const minutes = pendingFocusMinutes.value

  if (!minutes) {
    return ''
  }

  const endsAt = now.value + minutes * 60_000

  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(endsAt)
})
let clockInterval: number | undefined

const currentPreset = computed(() => {
  return backgroundPresets.find((preset) => preset.value === settings.value.background)
})

const backgroundStyle = computed(() => {
  if (settings.value.background === 'custom' && displayedCustomBackground.value) {
    return `url("${displayedCustomBackground.value}")`
  }

  return currentPreset.value?.css ?? backgroundPresets[0].css
})

const currentTime = computed(() => {
  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now.value)
})

const currentDate = computed(() => {
  return new Intl.DateTimeFormat('en', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(now.value)
})

const onBreak = computed(() => Boolean(timer.value.break?.active))

const mainRemainingMs = computed(() => {
  if (onBreak.value || timer.value.pausedForBreak) {
    return timer.value.durationMs
  }

  if (timer.value.active) {
    return Math.max(0, timer.value.endsAt - now.value)
  }

  if (hasPausedFocusRemaining(timer.value)) {
    return timer.value.durationMs
  }

  return selectedFocusMinutes.value * 60_000
})

const breakRemainingMs = computed(() => {
  if (!timer.value.break?.active) {
    return 0
  }

  return Math.max(0, timer.value.break.endsAt - now.value)
})

const mainEndsAtMs = computed(() => {
  if (onBreak.value) {
    return 0
  }

  if (timer.value.active && timer.value.endsAt > 0) {
    return timer.value.endsAt
  }

  if (hasPausedFocusRemaining(timer.value)) {
    return now.value + timer.value.durationMs
  }

  return 0
})

const breakEndsAtMs = computed(() => {
  if (!timer.value.break?.active) {
    return 0
  }

  return timer.value.break.endsAt
})

const mainTimerPaused = computed(() => onBreak.value && timer.value.pausedForBreak)

const canPauseTimer = computed(() => !onBreak.value && timer.value.active)

const canResumeTimer = computed(
  () => !onBreak.value && !timer.value.active && isTimerSessionActive() && mainRemainingMs.value > 0,
)

const showPanelTimerControls = computed(
  () => !onBreak.value && (canPauseTimer.value || canResumeTimer.value || isTimerSessionActive()),
)

const activeFocusMinutes = computed(() => {
  if (timer.value.kind !== 'Focus') {
    return null
  }

  const focusSessionRunning =
    timer.value.active || onBreak.value || hasPausedFocusRemaining(timer.value)

  if (!focusSessionRunning) {
    return null
  }

  const plannedMs = timer.value.focusPlannedMs

  if (plannedMs && plannedMs > 0) {
    return Math.round(plannedMs / 60_000)
  }

  return null
})

const showCountdownInHero = computed(() => {
  return timer.value.active || onBreak.value || hasPausedFocusRemaining(timer.value)
})

const heroEyebrow = computed(() => {
  if (onBreak.value) {
    return 'Focus paused'
  }

  return timer.value.active ? timer.value.kind : currentDate.value
})

const completedTodos = computed(
  () => todos.value.filter((todo) => todo.status === 'done').length,
)
const openTodos = computed(() => todos.value.length - completedTodos.value)

const wallAlarmDisplay = computed(() => formatWallAlarmTime(wallAlarm.value.hour, wallAlarm.value.minute))

const documentTitle = computed(() => {
  if (onBreak.value) {
    return `${formatDuration(breakRemainingMs.value)} · ${timer.value.break?.kind ?? 'Break'}`
  }

  if (timer.value.active) {
    return `${formatDuration(mainRemainingMs.value)} · ${timer.value.kind}`
  }

  return `${currentTime.value} · ${DEFAULT_DOCUMENT_TITLE}`
})

watchEffect(() => {
  document.title = documentTitle.value
})

watch(view, (nextView) => {
  if (nextView === 'metrics') {
    void metricsRef.value?.reload()
  }
})

const nextWallAlarmLabel = computed(() => {
  if (!wallAlarm.value.enabled) {
    return ''
  }

  const when = nextWallAlarmTimestamp(wallAlarm.value.hour, wallAlarm.value.minute, now.value)
  const formatted = new Intl.DateTimeFormat('en', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(when)

  return `Next alarm at ${formatted}`
})

function handleStorageChange(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: chrome.storage.AreaName,
) {
  if (areaName !== 'local' || !changes[TIMER_STORAGE_KEY]?.newValue) {
    return
  }

  timer.value = normalizeTimerState(changes[TIMER_STORAGE_KEY].newValue as TimerState)
}

onMounted(() => {
  tick()
  clockInterval = window.setInterval(tick, 1000)

  registerSyncApplyHandler(reloadFromStorage)

  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener(handleStorageChange)
  }

  void initializeApp()
})

onUnmounted(() => {
  if (clockInterval) {
    window.clearInterval(clockInterval)
  }

  stopSyncPolling()

  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.removeListener(handleStorageChange)
  }

  document.title = DEFAULT_DOCUMENT_TITLE
})

function refreshDisplayedCustomBackground() {
  if (settings.value.background === 'custom' && settings.value.customBackgrounds.length > 0) {
    displayedCustomBackground.value = pickRandomCustomBackground(settings.value.customBackgrounds)
    return
  }

  displayedCustomBackground.value = ''
}

async function reloadFromStorage() {
  settings.value = await getAppSettings()
  categories.value = await getCategories()
  todos.value = await getTodos()
  refreshActiveCategory()
  refreshCollapsedTodoIds()
  refreshDisplayedCustomBackground()
  await hydrateTimer()
  await hydrateWallAlarm()
  await timeTrackingRef.value?.refreshState()
  await metricsRef.value?.reload?.()
}

async function initializeApp() {
  await reloadFromStorage()
  tick()
  await initSync()
}

function refreshActiveCategory() {
  activeCategoryId.value = resolveActiveCategoryId(categories.value, activeCategoryId.value || loadActiveCategoryId())
  saveActiveCategoryId(activeCategoryId.value)
}

function saveCategories() {
  void persistCategories(categories.value)
}

function selectCategory(categoryId: string) {
  activeCategoryId.value = categoryId
  saveActiveCategoryId(categoryId)
}

function openCreateCategoryDialog() {
  categoryDialogMode.value = 'create'
  editingCategory.value = null
  categoryDialogOpen.value = true
}

function openEditCategoryDialog(category: TodoCategory) {
  categoryDialogMode.value = 'edit'
  editingCategory.value = category
  categoryDialogOpen.value = true
}

function handleCategorySave(name: string) {
  if (categoryDialogMode.value === 'create') {
    const category = createCategory(name)
    categories.value = [...categories.value, category]
    saveCategories()
    selectCategory(category.id)
    return
  }

  const category = editingCategory.value

  if (!category) {
    return
  }

  category.name = name
  categories.value = [...categories.value]
  saveCategories()
}

function handleCategoryDelete() {
  const category = editingCategory.value

  if (!category || categories.value.length <= 1) {
    return
  }

  const fallbackCategory = categories.value.find((entry) => entry.id !== category.id)

  if (!fallbackCategory) {
    return
  }

  for (const todo of todos.value) {
    if (todo.categoryId === category.id) {
      todo.categoryId = fallbackCategory.id
    }
  }

  categories.value = categories.value.filter((entry) => entry.id !== category.id)
  saveCategories()
  saveTodos()

  if (activeCategoryId.value === category.id) {
    selectCategory(fallbackCategory.id)
  }
}

function refreshCollapsedTodoIds() {
  collapsedTodoIds.value = pruneCollapsedTodoIds(
    collapsedTodoIds.value,
    todos.value.map((todo) => todo.id),
  )
}

function isTodoCollapsed(todoId: string): boolean {
  return collapsedTodoIds.value.has(todoId)
}

function toggleTodoCollapse(todoId: string) {
  const next = new Set(collapsedTodoIds.value)

  if (next.has(todoId)) {
    next.delete(todoId)
  } else {
    next.add(todoId)
  }

  collapsedTodoIds.value = next
  saveCollapsedTodoIds(next)
}

function loadJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key)

  if (!raw) {
    return fallback
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function saveTodos() {
  void persistTodos(todos.value)
}

const syncApiUrl = getSyncApiUrl()

const syncLastAtDisplay = computed(() => {
  const lastAt = settings.value.syncLastAt

  if (!lastAt) {
    return 'Never'
  }

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(lastAt)
})

async function handleSyncEnabledChange() {
  await saveSettings()

  if (settings.value.syncEnabled && settings.value.syncToken.trim()) {
    await initSync()
    await syncNow()
    settings.value = await getAppSettings()
    return
  }

  stopSyncPolling()
}

async function handleSyncNow() {
  await syncNow()
  settings.value = await getAppSettings()
}

async function handleDownloadBackup() {
  backupError.value = ''

  try {
    await downloadLocalBackup()
  } catch (error) {
    backupError.value = error instanceof Error ? error.message : 'Download failed.'
  }
}

function handleRestoreBackupClick() {
  backupError.value = ''
  backupInputRef.value?.click()
}

async function handleBackupFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''

  if (!file) {
    return
  }

  try {
    const text = await file.text()
    pendingBackup = parseLocalBackupJson(text)
    backupRestoreConfirmOpen.value = true
  } catch (error) {
    pendingBackup = null
    backupError.value = error instanceof Error ? error.message : 'Could not read backup file.'
  }
}

async function confirmBackupRestore() {
  if (!pendingBackup) {
    return
  }

  backupError.value = ''

  try {
    await applyLocalBackup(pendingBackup)
    await reloadFromStorage()
  } catch (error) {
    backupError.value = error instanceof Error ? error.message : 'Restore failed.'
  } finally {
    pendingBackup = null
  }
}

function cancelBackupRestore() {
  pendingBackup = null
}

function handleTaskStatusChange(
  todo: Todo,
  event:
    | { kind: 'todo'; oldStatus: TaskStatus; newStatus: TaskStatus }
    | { kind: 'subtodo'; subtodoId: string; oldStatus: TaskStatus; newStatus: TaskStatus },
) {
  saveTodos()

  const becameDone = event.newStatus === 'done' && event.oldStatus !== 'done'

  if (!becameDone) {
    return
  }

  if (event.kind === 'todo') {
    void recordCompletedTodoAction({
      todoId: todo.id,
      title: todo.title,
    })
    return
  }

  const subtodo = todo.subtodos.find((entry) => entry.id === event.subtodoId)

  if (!subtodo) {
    return
  }

  void recordCompletedSubtodoAction({
    todoId: todo.id,
    subtodoId: subtodo.id,
    title: subtodo.title,
  })
}

async function saveSettings() {
  await setAppSettings(settings.value)
}

function onWeatherLocationResolved(payload: {
  latitude: number
  longitude: number
  label: string
}) {
  settings.value.weatherLatitude = payload.latitude
  settings.value.weatherLongitude = payload.longitude
  settings.value.weatherLocationLabel = payload.label
  void saveSettings()
}

function setWeatherLocationMode(mode: WeatherLocationMode) {
  if (settings.value.weatherLocationMode === mode) {
    return
  }

  settings.value.weatherLocationMode = mode

  if (mode === 'auto') {
    settings.value.weatherLatitude = null
    settings.value.weatherLongitude = null
    settings.value.weatherLocationLabel = ''
  }

  void saveSettings()
}

function setWeatherUnits(units: WeatherUnits) {
  if (settings.value.weatherUnits === units) {
    return
  }

  settings.value.weatherUnits = units
  void saveSettings()
}

function setWeatherForecastDays(days: 5 | 7) {
  if (settings.value.weatherForecastDays === days) {
    return
  }

  settings.value.weatherForecastDays = days
  void saveSettings()
}

async function resolveWeatherCityFromSettings() {
  if (settings.value.weatherLocationMode !== 'manual') {
    return
  }

  const query = settings.value.weatherCity.trim()
  if (!query) {
    settings.value.weatherLatitude = null
    settings.value.weatherLongitude = null
    settings.value.weatherLocationLabel = ''
    await saveSettings()
    return
  }

  try {
    const match = await geocodeCity(query)
    if (!match) {
      return
    }

    settings.value.weatherLatitude = match.latitude
    settings.value.weatherLongitude = match.longitude
    settings.value.weatherLocationLabel = match.name
    await saveSettings()
  } catch {
    // Weather panel will surface fetch errors on the homepage.
  }
}

async function saveTimer() {
  await setStorageTimer(timer.value)
}

async function hydrateTimer() {
  const revisionAtStart = timerRevision.value
  const stored = await getStorageTimer()
  const legacy = loadJson<TimerState | null>(LEGACY_TIMER_KEY, null)

  if (revisionAtStart !== timerRevision.value) {
    return
  }

  if (stored) {
    timer.value = stored
  } else if (legacy) {
    timer.value = normalizeTimerState(legacy)
    await saveTimer()
    localStorage.removeItem(LEGACY_TIMER_KEY)
  }

  if (revisionAtStart !== timerRevision.value) {
    return
  }

  if (timer.value.break?.active && timer.value.break.endsAt <= Date.now()) {
    await endBreak(false)
    return
  }

  if (timer.value.active && timer.value.endsAt <= Date.now()) {
    await finalizeTimerExpiry(false)
    return
  }

  if (timer.value.break?.active) {
    await scheduleBreakAlarm(timer.value.break.endsAt)
    return
  }

  if (timer.value.active) {
    await scheduleTimerAlarm(timer.value.endsAt)
  }
}

async function hydrateWallAlarm() {
  const stored = await getWallAlarm()
  wallAlarm.value = stored
  wallAlarmTime.value = formatWallAlarmTime(stored.hour, stored.minute)

  if (stored.enabled) {
    await scheduleWallAlarm(stored.hour, stored.minute)
  }
}

function tick() {
  now.value = Date.now()

  if (timer.value.break?.active && timer.value.break.endsAt <= now.value) {
    void endBreak(true)
    return
  }

  if (timer.value.active && timer.value.endsAt <= now.value) {
    void finalizeTimerExpiry(true)
  }
}

async function finalizeTimerExpiry(playSound: boolean) {
  const completedSession = { ...timer.value }

  timer.value = emptyTimerState()
  await clearTimerAlarm()
  await clearBreakAlarm()
  await saveTimer()

  if (completedSession.kind === 'Short break' || completedSession.kind === 'Long break') {
    await recordStandaloneBreakSession(completedSession, completedSession.endsAt || Date.now())
  } else {
    await recordCompletedFocusBlock(completedSession)
  }

  if (playSound) {
    playTimerBeep()
  }
}

function isTimerSessionActive(): boolean {
  return timer.value.active || onBreak.value || hasPausedFocusRemaining(timer.value)
}

function isFocusSessionInProgress(): boolean {
  if (timer.value.kind !== 'Focus' || onBreak.value) {
    return false
  }

  if (timer.value.active) {
    return true
  }

  return hasPausedFocusRemaining(timer.value)
}

async function startBreakDuringFocus(kind: BreakKind, minutes: number) {
  timerRevision.value += 1

  const mainRemaining = timer.value.active
    ? Math.max(0, timer.value.endsAt - Date.now())
    : timer.value.durationMs

  const durationMs = minutes * 60_000
  const startedAt = Date.now()
  const endsAt = startedAt + durationMs

  timer.value = normalizeTimerState({
    active: false,
    kind: 'Focus',
    durationMs: mainRemaining,
    endsAt: 0,
    pausedForBreak: true,
    focusPlannedMs: timer.value.focusPlannedMs,
    sessionStartedAt: timer.value.sessionStartedAt,
    break: {
      active: true,
      kind,
      durationMs,
      endsAt,
      startedAt,
    },
  })

  await clearTimerAlarm()
  await saveTimer()
  await scheduleBreakAlarm(endsAt)
}

async function endBreak(playSound: boolean) {
  const activeBreak = timer.value.break

  if (!activeBreak?.active) {
    return
  }

  await recordBreakFromBreakState(activeBreak)

  timerRevision.value += 1
  const mainRemaining = timer.value.durationMs

  timer.value = normalizeTimerState({
    active: mainRemaining > 0,
    kind: 'Focus',
    durationMs: mainRemaining,
    endsAt: mainRemaining > 0 ? Date.now() + mainRemaining : 0,
    pausedForBreak: false,
    focusPlannedMs: timer.value.focusPlannedMs,
    break: null,
  })

  await clearBreakAlarm()
  await saveTimer()

  if (timer.value.active) {
    await scheduleTimerAlarm(timer.value.endsAt)
  }

  if (playSound) {
    playSchoolbell()
  }
}

async function endBreakEarly() {
  await endBreak(false)
}

function addTodo(title: string) {
  const trimmed = title.trim()

  if (!trimmed || !activeCategoryId.value) {
    return
  }

  todos.value.unshift({
    id: crypto.randomUUID(),
    title: trimmed,
    status: DEFAULT_STATUS,
    categoryId: activeCategoryId.value,
    createdAt: Date.now(),
    subtodos: [],
    notes: '',
  })
  saveTodos()
}

function removeTodo(todoId: string) {
  todos.value = todos.value.filter((todo) => todo.id !== todoId)

  if (collapsedTodoIds.value.has(todoId)) {
    const next = new Set(collapsedTodoIds.value)
    next.delete(todoId)
    collapsedTodoIds.value = next
    saveCollapsedTodoIds(next)
  }

  saveTodos()
}

function removeSubtodo(todoId: string, subtodoId: string) {
  const todo = todos.value.find((entry) => entry.id === todoId)

  if (!todo) {
    return
  }

  todo.subtodos = todo.subtodos.filter((subtodo) => subtodo.id !== subtodoId)
  saveTodos()
}

function requestRemoveTodo(todo: Todo) {
  deleteTarget.value = { kind: 'todo', todoId: todo.id, title: todo.title }
  deleteConfirmOpen.value = true
}

function requestRemoveSubtodo(todoId: string, subtodo: Subtodo) {
  deleteTarget.value = {
    kind: 'subtodo',
    todoId,
    subtodoId: subtodo.id,
    title: subtodo.title,
  }
  deleteConfirmOpen.value = true
}

function confirmDelete() {
  const target = deleteTarget.value
  deleteConfirmOpen.value = false
  deleteTarget.value = null

  if (!target) {
    return
  }

  if (target.kind === 'todo') {
    removeTodo(target.todoId)
    return
  }

  removeSubtodo(target.todoId, target.subtodoId)
}

function cancelDelete() {
  deleteConfirmOpen.value = false
  deleteTarget.value = null
}

function isTodoFullyComplete(todo: Todo): boolean {
  if (todo.status !== 'done') {
    return false
  }

  return todo.subtodos.every((subtodo) => subtodo.status === 'done')
}

async function archiveTodo(todo: Todo) {
  if (!isTodoFullyComplete(todo)) {
    return
  }

  const archivedAt = Date.now()

  await addArchivedTodo({
    id: todo.id,
    title: todo.title,
    subtodos: todo.subtodos.map((subtodo) => ({
      title: subtodo.title,
      notes: subtodo.notes || undefined,
    })),
    archivedAt,
    notes: todo.notes || undefined,
  })

  void recordCompletedTodoAction({
    todoId: todo.id,
    title: todo.title,
    completedAt: archivedAt,
  })

  for (const subtodo of todo.subtodos) {
    void recordCompletedSubtodoAction({
      todoId: todo.id,
      subtodoId: subtodo.id,
      title: subtodo.title,
      completedAt: archivedAt,
    })
  }

  removeTodo(todo.id)
}

function openEditDialog(todoId: string, target: { kind: 'todo' } | { kind: 'subtodo'; subtodoId: string }) {
  if (target.kind === 'todo') {
    editTarget.value = { kind: 'todo', todoId }
  } else {
    editTarget.value = { kind: 'subtodo', todoId, subtodoId: target.subtodoId }
  }
}

function handleEditSave(payload: {
  title: string
  status: TaskStatus
  notes: string
  categoryId?: string
}) {
  const target = editTarget.value
  const todo = editingTodo.value

  if (!target || !todo) {
    return
  }

  if (target.kind === 'subtodo') {
    const subtodo = todo.subtodos.find((entry) => entry.id === target.subtodoId)

    if (!subtodo) {
      return
    }

    const oldStatus = subtodo.status
    subtodo.title = payload.title
    subtodo.status = payload.status
    subtodo.notes = payload.notes
    handleTaskStatusChange(todo, {
      kind: 'subtodo',
      subtodoId: subtodo.id,
      oldStatus,
      newStatus: payload.status,
    })
    return
  }

  const oldStatus = todo.status
  todo.title = payload.title
  todo.status = payload.status
  todo.notes = payload.notes

  if (payload.categoryId && categories.value.some((category) => category.id === payload.categoryId)) {
    todo.categoryId = payload.categoryId
  }

  handleTaskStatusChange(todo, {
    kind: 'todo',
    oldStatus,
    newStatus: payload.status,
  })
}

function timerSessionLabel(kind: TimerKind, minutes: number): string {
  if (kind === 'Focus') {
    return `${minutes} min focus`
  }

  if (kind === 'Short break') {
    return 'short break'
  }

  return 'long break'
}

const pendingTimerSessionLabel = computed(() => {
  const pending = pendingTimerStart.value

  if (!pending) {
    return 'session'
  }

  return timerSessionLabel(pending.kind, pending.minutes)
})

function requestFocusStart(minutes: number) {
  selectedFocusMinutes.value = minutes

  if (isTimerSessionActive()) {
    pendingFocusMinutes.value = minutes
    restartConfirmOpen.value = true
    return
  }

  void requestTimerStart('Focus', minutes)
}

async function requestTimerStart(kind: TimerKind, minutes: number) {
  if (
    settings.value.timeTrackingEnabled &&
    !(await isTimeTrackingActive())
  ) {
    pendingTimerStart.value = { kind, minutes }
    timeTrackingPromptOpen.value = true
    return
  }

  await startTimer(kind, minutes)
}

async function handleTimeTrackingPromptSkip() {
  const pending = pendingTimerStart.value
  pendingTimerStart.value = null

  if (!pending) {
    return
  }

  await startTimer(pending.kind, pending.minutes)
}

async function handleTimeTrackingPromptStart(payload: { label: string; comment: string }) {
  const pending = pendingTimerStart.value
  pendingTimerStart.value = null

  if (!pending) {
    return
  }

  await startTimeTracking(payload)
  await timeTrackingRef.value?.refreshState()
  await startTimer(pending.kind, pending.minutes)
}

function cancelFocusRestart() {
  restartConfirmOpen.value = false
  pendingFocusMinutes.value = null
}

async function confirmFocusRestart() {
  const minutes = pendingFocusMinutes.value
  restartConfirmOpen.value = false
  pendingFocusMinutes.value = null

  if (minutes) {
    await requestTimerStart('Focus', minutes)
  }
}

async function startTimer(kind: TimerKind, minutes: number) {
  if (kind !== 'Focus' && isFocusSessionInProgress()) {
    await startBreakDuringFocus(kind, minutes)
    return
  }

  if (kind === 'Focus') {
    selectedFocusMinutes.value = minutes
  }

  timerRevision.value += 1
  const durationMs = minutes * 60_000
  const startedAt = Date.now()
  const endsAt = startedAt + durationMs

  timer.value = normalizeTimerState({
    active: true,
    kind,
    durationMs,
    endsAt,
    pausedForBreak: false,
    break: null,
    focusPlannedMs: durationMs,
    sessionStartedAt: startedAt,
  })

  await clearBreakAlarm()
  await saveTimer()
  await scheduleTimerAlarm(timer.value.endsAt)
}

async function pauseTimer() {
  if (onBreak.value) {
    return
  }

  timer.value = {
    ...timer.value,
    active: false,
    durationMs: mainRemainingMs.value,
    endsAt: 0,
  }
  await clearTimerAlarm()
  await saveTimer()
}

async function resumeTimer() {
  if (onBreak.value) {
    return
  }

  timer.value = {
    ...timer.value,
    active: true,
    endsAt: Date.now() + timer.value.durationMs,
  }
  await saveTimer()
  await scheduleTimerAlarm(timer.value.endsAt)
}

function requestReset() {
  if (!isTimerSessionActive()) {
    return
  }

  resetConfirmOpen.value = true
}

async function resetTimer() {
  const session = { ...timer.value }
  const endedAt = Date.now()

  if (session.break?.active) {
    await recordBreakFromBreakState(session.break, endedAt)
    await recordCompletedFocusBlock(session, endedAt)
  } else if (session.kind === 'Short break' || session.kind === 'Long break') {
    if (session.active || session.durationMs > 0) {
      await recordStandaloneBreakSession(session, endedAt)
    }
  } else if (session.kind === 'Focus') {
    await recordCompletedFocusBlock(session, endedAt)
  }

  timer.value = emptyTimerState()
  await clearTimerAlarm()
  await clearBreakAlarm()
  await saveTimer()
}

async function confirmReset() {
  await resetTimer()
}

async function updateWallAlarmTime() {
  const parsed = parseWallAlarmTime(wallAlarmTime.value)
  wallAlarm.value.hour = parsed.hour
  wallAlarm.value.minute = parsed.minute
  await persistWallAlarm()
}

async function persistWallAlarm() {
  await setWallAlarm(wallAlarm.value)

  if (wallAlarm.value.enabled) {
    await scheduleWallAlarm(wallAlarm.value.hour, wallAlarm.value.minute)
  } else {
    await clearWallAlarm()
  }
}

function selectBackground(value: string) {
  settings.value.background = value
  refreshDisplayedCustomBackground()
  void saveSettings()
}

async function handleBackgroundUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files

  if (!files?.length) {
    return
  }

  const added: string[] = []

  for (const file of Array.from(files)) {
    try {
      added.push(await compressBackgroundImage(file))
    } catch {
      // Skip invalid or unreadable files.
    }
  }

  if (added.length === 0) {
    input.value = ''
    return
  }

  settings.value.customBackgrounds.push(...added)
  settings.value.background = 'custom'
  refreshDisplayedCustomBackground()
  await saveSettings()
  input.value = ''
}

function removeCustomBackground(index: number) {
  settings.value.customBackgrounds.splice(index, 1)

  if (settings.value.customBackgrounds.length === 0 && settings.value.background === 'custom') {
    settings.value.background = 'alpine'
  }

  refreshDisplayedCustomBackground()
  void saveSettings()
}

</script>

<template>
  <main class="new-tab todo-dark" :style="{ '--tab-background-image': backgroundStyle }">
    <div class="scrim">
      <div class="scrim-overlay" aria-hidden="true"></div>
      <div class="page-content">
      <nav class="top-nav" aria-label="New tab sections">
        <button :class="{ active: view === 'clock' }" type="button" @click="view = 'clock'">
          <Clock3 :size="14" />
          Clock
        </button>
        <button :class="{ active: view === 'settings' }" type="button" @click="view = 'settings'">
          <Settings :size="14" />
          Settings
        </button>
        <button :class="{ active: view === 'metrics' }" type="button" @click="view = 'metrics'">
          <BarChart3 :size="14" />
          Metrics
        </button>
      </nav>

      <section
        v-if="settings.countdownEnabled && view !== 'settings' && view !== 'metrics'"
        class="clock-hero"
        aria-live="polite"
      >
        <p class="eyebrow">{{ heroEyebrow }}</p>
        <div class="hero-stack">
          <CountdownClock
            v-if="showCountdownInHero"
            :remaining-ms="mainRemainingMs"
            :ends-at-ms="mainEndsAtMs"
            :paused="mainTimerPaused"
            size="hero"
            tag="h1"
          />
          <h1 v-else>{{ currentTime }}</h1>
          <div v-if="showCountdownInHero && showPanelTimerControls" class="hero-countdown-actions">
            <button
              v-if="canPauseTimer"
              class="countdown-action backdrop-glass"
              type="button"
              aria-label="Pause timer"
              @click="pauseTimer"
            >
              <Pause :size="20" />
            </button>
            <button
              v-else-if="canResumeTimer"
              class="countdown-action backdrop-glass"
              type="button"
              aria-label="Resume timer"
              @click="resumeTimer"
            >
              <Play :size="20" />
            </button>
            <button
              class="countdown-action backdrop-glass"
              type="button"
              aria-label="Stop timer"
              @click="requestReset"
            >
              <Square :size="16" fill="currentColor" />
            </button>
          </div>
          <CountdownClock
            v-if="onBreak"
            :remaining-ms="breakRemainingMs"
            :ends-at-ms="breakEndsAtMs"
            :label="timer.break?.kind ?? 'Break'"
            size="compact"
            tag="p"
          />
          <p v-if="wallAlarm.enabled" class="timer-alarm-hint">
            <AlarmClock :size="12" aria-hidden="true" />
            <span>Alarm {{ wallAlarmDisplay }}</span>
          </p>
        </div>
        <p class="subtle">
          {{
            onBreak
              ? 'On break — use End break to resume focus early.'
              : timer.active
                ? 'Stay with one task until the timer ends.'
                : `${openTodos} open tasks today`
          }}
        </p>
      </section>

      <WeatherForecast
        v-if="settings.weatherEnabled && view !== 'settings' && view !== 'metrics'"
        :location-mode="settings.weatherLocationMode"
        :city-query="settings.weatherCity"
        :latitude="settings.weatherLatitude"
        :longitude="settings.weatherLongitude"
        :location-label="settings.weatherLocationLabel"
        :units="settings.weatherUnits"
        :forecast-days="settings.weatherForecastDays"
        @location-resolved="onWeatherLocationResolved"
      />

      <section
        v-if="view !== 'settings' && view !== 'metrics' && (settings.countdownEnabled || settings.timeTrackingEnabled || settings.todosEnabled)"
        class="workspace"
      >
        <article v-if="settings.countdownEnabled" class="timer-panel">
          <div class="timer-panel-pane">
            <div v-if="!onBreak" class="focus-duration-buttons" role="group" aria-label="Focus duration">
              <button
                v-for="option in timerOptions"
                :key="option.value"
                type="button"
                class="focus-duration-button backdrop-glass"
                :class="{ 'backdrop-glass--solid': activeFocusMinutes === option.value }"
                @click="requestFocusStart(option.value)"
              >
                {{ option.label }}
              </button>
              <button
                type="button"
                class="focus-duration-button focus-duration-button--alarm backdrop-glass"
                :class="{ 'backdrop-glass--solid': wallAlarm.enabled }"
                aria-label="Set alarm"
                @click="alarmOpen = true"
              >
                <AlarmClock :size="14" />
              </button>
            </div>

            <div v-if="onBreak" class="timer-actions">
              <Button
                class="focus-start-button"
                size="small"
                label="End break"
                severity="secondary"
                outlined
                @click="endBreakEarly"
              />
            </div>

            <div v-else class="break-duration-buttons" role="group" aria-label="Break duration">
              <button
                type="button"
                class="focus-duration-button backdrop-glass"
                @click="requestTimerStart('Short break', 5)"
              >
                Short break
              </button>
              <button
                type="button"
                class="focus-duration-button backdrop-glass"
                @click="requestTimerStart('Long break', 15)"
              >
                Long break
              </button>
            </div>
          </div>
        </article>

        <TimeTracking v-if="settings.timeTrackingEnabled" ref="timeTrackingRef" />

        <article v-if="settings.todosEnabled" class="todo-panel">
          <TodoCategoryTabs
            :categories="categories"
            :active-category-id="activeCategoryId"
            :todo-counts="todoCountsByCategory"
            @select="selectCategory"
            @create="openCreateCategoryDialog"
            @edit="openEditCategoryDialog"
          />

          <TodoBoard
            v-if="activeCategory"
            :todos="activeCategoryTodos"
            :category-name="activeCategory.name"
            :is-collapsed="isTodoCollapsed"
            @add="addTodo"
            @status-change="handleTaskStatusChange"
            @subtodo-added="saveTodos"
            @request-edit="openEditDialog"
            @request-remove="requestRemoveTodo"
            @request-remove-subtodo="requestRemoveSubtodo"
            @archive="archiveTodo"
            @toggle-collapse="toggleTodoCollapse"
          />
        </article>
      </section>

      <section v-else-if="view === 'settings'" class="settings-layout">
        <article class="glass settings-panel">
          <div class="panel-heading">
            <div>
              <span class="kicker">Settings</span>
              <h2>Main page</h2>
            </div>
          </div>

          <p class="subtle settings-feature-hint">
            Choose which sections appear on the Clock view.
          </p>

          <div class="feature-toggles" role="group" aria-label="Main page features">
            <label class="feature-toggle">
              <Checkbox v-model="settings.countdownEnabled" binary class="backdrop-glass" @change="saveSettings" />
              <span>Countdown clock</span>
            </label>
            <label class="feature-toggle">
              <Checkbox v-model="settings.timeTrackingEnabled" binary class="backdrop-glass" @change="saveSettings" />
              <span>Time tracker</span>
            </label>
            <label class="feature-toggle">
              <Checkbox v-model="settings.todosEnabled" binary class="backdrop-glass" @change="saveSettings" />
              <span>Todo lists</span>
            </label>
            <label class="feature-toggle">
              <Checkbox v-model="settings.weatherEnabled" binary class="backdrop-glass" @change="saveSettings" />
              <span>Weather forecast</span>
            </label>
          </div>
        </article>

        <article class="glass settings-panel">
          <div class="panel-heading">
            <div>
              <span class="kicker">Settings</span>
              <h2>Weather</h2>
            </div>
          </div>

          <p class="subtle settings-feature-hint">
            Forecast uses Open-Meteo. Enable the section above, then choose how to find your location.
          </p>

          <label class="feature-toggle weather-settings-toggle">
            <Checkbox v-model="settings.weatherEnabled" binary class="backdrop-glass" @change="saveSettings" />
            <span>Show weather on Clock</span>
          </label>

          <div class="weather-settings" :class="{ 'weather-settings--disabled': !settings.weatherEnabled }">
            <fieldset class="weather-settings__group">
              <legend class="weather-settings__legend">Location</legend>
              <div class="weather-settings__choices" role="group" aria-label="Weather location source">
                <button
                  type="button"
                  class="weather-settings__choice backdrop-glass"
                  :class="{ 'backdrop-glass--solid': settings.weatherLocationMode === 'auto' }"
                  :disabled="!settings.weatherEnabled"
                  @click="setWeatherLocationMode('auto')"
                >
                  Use my location
                </button>
                <button
                  type="button"
                  class="weather-settings__choice backdrop-glass"
                  :class="{ 'backdrop-glass--solid': settings.weatherLocationMode === 'manual' }"
                  :disabled="!settings.weatherEnabled"
                  @click="setWeatherLocationMode('manual')"
                >
                  City name
                </button>
              </div>
            </fieldset>

            <label v-if="settings.weatherLocationMode === 'manual'" class="weather-settings__field">
              <span>City</span>
              <InputText
                v-model="settings.weatherCity"
                class="weather-settings__input backdrop-glass"
                placeholder="e.g. Amsterdam"
                :disabled="!settings.weatherEnabled"
                @change="resolveWeatherCityFromSettings"
              />
            </label>
            <p
              v-else-if="settings.weatherEnabled"
              class="subtle weather-settings__hint"
            >
              Chrome will ask for location permission the first time weather loads.
            </p>
            <p v-if="settings.weatherLocationLabel" class="subtle weather-settings__resolved">
              Showing: {{ settings.weatherLocationLabel }}
            </p>

            <fieldset class="weather-settings__group">
              <legend class="weather-settings__legend">Units</legend>
              <div class="weather-settings__choices" role="group" aria-label="Temperature units">
                <button
                  type="button"
                  class="weather-settings__choice backdrop-glass"
                  :class="{ 'backdrop-glass--solid': settings.weatherUnits === 'celsius' }"
                  :disabled="!settings.weatherEnabled"
                  @click="setWeatherUnits('celsius')"
                >
                  Celsius
                </button>
                <button
                  type="button"
                  class="weather-settings__choice backdrop-glass"
                  :class="{ 'backdrop-glass--solid': settings.weatherUnits === 'fahrenheit' }"
                  :disabled="!settings.weatherEnabled"
                  @click="setWeatherUnits('fahrenheit')"
                >
                  Fahrenheit
                </button>
              </div>
            </fieldset>

            <fieldset class="weather-settings__group">
              <legend class="weather-settings__legend">Forecast length</legend>
              <div class="weather-settings__choices" role="group" aria-label="Forecast days">
                <button
                  type="button"
                  class="weather-settings__choice backdrop-glass"
                  :class="{ 'backdrop-glass--solid': settings.weatherForecastDays === 5 }"
                  :disabled="!settings.weatherEnabled"
                  @click="setWeatherForecastDays(5)"
                >
                  5 days
                </button>
                <button
                  type="button"
                  class="weather-settings__choice backdrop-glass"
                  :class="{ 'backdrop-glass--solid': settings.weatherForecastDays === 7 }"
                  :disabled="!settings.weatherEnabled"
                  @click="setWeatherForecastDays(7)"
                >
                  7 days
                </button>
              </div>
            </fieldset>
          </div>
        </article>

        <article class="glass settings-panel">
          <div class="panel-heading">
            <div>
              <span class="kicker">Settings</span>
              <h2>Sync</h2>
            </div>
          </div>

          <p class="subtle settings-feature-hint">
            Sync todos, settings, metrics, and the countdown timer across your devices via Cloudflare.
            Generate a token with <code>openssl rand -hex 32</code> and use the same token on each device.
          </p>

          <label class="feature-toggle">
            <Checkbox
              v-model="settings.syncEnabled"
              binary
              class="backdrop-glass"
              @change="handleSyncEnabledChange"
            />
            <span>Enable sync</span>
          </label>

          <div class="sync-settings" :class="{ 'sync-settings--disabled': !settings.syncEnabled }">
            <label class="sync-settings__field">
              <span>Sync token</span>
              <InputText
                v-model="settings.syncToken"
                type="password"
                class="sync-settings__input backdrop-glass"
                placeholder="Paste your personal sync token"
                :disabled="!settings.syncEnabled"
                @change="saveSettings"
              />
            </label>

            <p class="subtle sync-settings__meta">
              Server: {{ syncApiUrl }}
            </p>
            <p class="subtle sync-settings__meta">
              Last synced: {{ syncLastAtDisplay }}
            </p>
            <p v-if="settings.syncLastError" class="sync-settings__error">
              {{ settings.syncLastError }}
            </p>

            <Button
              rounded
              severity="secondary"
              outlined
              :disabled="!settings.syncEnabled || !settings.syncToken.trim()"
              @click="handleSyncNow"
            >
              Sync now
            </Button>

            <p class="subtle sync-settings__hint">
              When sync is on, your data is sent to your Cloudflare Worker (encrypted in transit).
              Timer notifications may fire on each device.
            </p>
          </div>
        </article>

        <article class="glass settings-panel">
          <div class="panel-heading">
            <div>
              <span class="kicker">Settings</span>
              <h2>Backup</h2>
            </div>
          </div>

          <p class="subtle settings-feature-hint">
            Download a JSON snapshot of todos, categories, metrics, settings, and timer state stored
            in this browser. Restore replaces all local data with the file contents.
          </p>

          <div class="sync-settings">
            <Button rounded severity="secondary" outlined @click="handleDownloadBackup">
              Download backup
            </Button>
            <Button rounded severity="secondary" outlined @click="handleRestoreBackupClick">
              Restore from file
            </Button>
            <input
              ref="backupInputRef"
              type="file"
              accept="application/json,.json"
              hidden
              @change="handleBackupFileSelected"
            />
            <p v-if="backupError" class="sync-settings__error">
              {{ backupError }}
            </p>
          </div>
        </article>

        <article class="glass settings-panel">
          <div class="panel-heading">
            <div>
              <span class="kicker">Settings</span>
              <h2>Background</h2>
            </div>
            <Button rounded severity="secondary" outlined @click="settingsOpen = true">
              Preview
            </Button>
          </div>

          <div class="background-grid">
            <button
              v-for="preset in backgroundPresets"
              :key="preset.value"
              class="background-card"
              :class="{ active: settings.background === preset.value }"
              :style="{ backgroundImage: preset.css }"
              type="button"
              @click="selectBackground(preset.value)"
            >
              <span>{{ preset.label }}</span>
              <Check v-if="settings.background === preset.value" :size="16" />
            </button>
            <button
              v-if="settings.customBackgrounds.length"
              class="background-card"
              :class="{ active: settings.background === 'custom' }"
              :style="{ backgroundImage: `url('${settings.customBackgrounds[0]}')` }"
              type="button"
              @click="selectBackground('custom')"
            >
              <span>Your photos</span>
              <Check v-if="settings.background === 'custom'" :size="16" />
            </button>
          </div>

          <p v-if="settings.customBackgrounds.length" class="subtle custom-background-hint">
            A random photo is chosen each time you open a new tab.
          </p>

          <div v-if="settings.customBackgrounds.length" class="custom-background-grid">
            <article
              v-for="(image, index) in settings.customBackgrounds"
              :key="`${index}-${image.slice(0, 24)}`"
              class="custom-background-thumb"
              :style="{ backgroundImage: `url('${image}')` }"
            >
              <button
                class="icon-button custom-background-remove"
                type="button"
                aria-label="Remove photo"
                @click="removeCustomBackground(index)"
              >
                <Trash2 :size="14" />
              </button>
            </article>
          </div>

          <label class="upload-card" for="background-upload">
            <ImagePlus :size="20" />
            <span>
              {{
                settings.customBackgrounds.length
                  ? 'Add more photos'
                  : 'Upload your own backgrounds'
              }}
            </span>
            <input
              id="background-upload"
              type="file"
              accept="image/*"
              multiple
              @change="handleBackgroundUpload"
            />
          </label>
        </article>
      </section>

      <section v-else-if="view === 'metrics'" class="metrics-layout">
        <MetricsCalendar ref="metricsRef" />
      </section>
      </div>
    </div>

    <Dialog
      v-model:visible="alarmOpen"
      modal
      class="alarm-dialog"
      header="Alarm clock"
      :style="{ width: 'min(360px, 92vw)' }"
      :draggable="false"
    >
      <section class="alarm-section" aria-label="Daily alarm">
        <p class="alarm-dialog__time">{{ wallAlarmDisplay }}</p>
        <label class="alarm-enable" for="wall-alarm-time">
          <Checkbox v-model="wallAlarm.enabled" binary class="backdrop-glass" @change="persistWallAlarm" />
          <span>Enable alarm</span>
        </label>
        <input
          id="wall-alarm-time"
          v-model="wallAlarmTime"
          class="alarm-time-input backdrop-glass"
          type="time"
          :disabled="!wallAlarm.enabled"
          aria-label="Alarm time"
          @change="updateWallAlarmTime"
        />
        <p v-if="nextWallAlarmLabel" class="alarm-status">{{ nextWallAlarmLabel }}</p>
        <p v-else class="alarm-status">Set a time and enable the alarm for a daily reminder.</p>
      </section>
    </Dialog>

    <Dialog v-model:visible="settingsOpen" modal header="Current background" :style="{ width: 'min(720px, 92vw)' }">
      <div class="preview-frame" :style="{ backgroundImage: backgroundStyle }">
        <span>New tab preview</span>
      </div>
    </Dialog>

    <MinimalConfirmDialog
      v-model:visible="restartConfirmOpen"
      title="Replace current timer?"
      :message="`Start a ${pendingFocusMinutes} minute focus session instead? It ends at ${pendingFocusEndLabel}.`"
      confirm-label="Start"
      @confirm="confirmFocusRestart"
      @cancel="cancelFocusRestart"
    />

    <MinimalConfirmDialog
      v-model:visible="resetConfirmOpen"
      title="Reset timer?"
      message="This will clear the current focus session."
      confirm-label="Reset"
      @confirm="confirmReset"
    />

    <MinimalConfirmDialog
      v-model:visible="deleteConfirmOpen"
      :title="deleteConfirmTitle"
      :message="deleteConfirmMessage"
      confirm-label="Delete"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />

    <MinimalConfirmDialog
      v-model:visible="backupRestoreConfirmOpen"
      title="Restore backup?"
      message="This replaces all todos, settings, and history in this browser with the backup file. Your current data will be overwritten."
      confirm-label="Restore"
      @confirm="confirmBackupRestore"
      @cancel="cancelBackupRestore"
    />

    <TimeTrackingStartDialog
      v-model:visible="timeTrackingPromptOpen"
      :session-label="pendingTimerSessionLabel"
      @skip="handleTimeTrackingPromptSkip"
      @start="handleTimeTrackingPromptStart"
    />

    <TaskEditDialog
      v-model:visible="editDialogOpen"
      :title="editingTitle"
      :status="editingStatus"
      :notes="editingNotes"
      :task-kind="editingKind"
      :categories="categories"
      :category-id="editingCategoryId"
      @save="handleEditSave"
    />

    <CategoryDialog
      v-model:visible="categoryDialogOpen"
      :mode="categoryDialogMode"
      :category="editingCategory"
      :can-delete="canDeleteEditingCategory"
      @save="handleCategorySave"
      @delete="handleCategoryDelete"
    />
  </main>
</template>
