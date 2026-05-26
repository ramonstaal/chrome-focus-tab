<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Archive, ChevronLeft, ChevronRight, Coffee, Target, Timer } from '@lucide/vue'
import { getArchivedTodos, type ArchivedTodo } from '../archivedTodos'
import {
  getCompletedSubtodoActions,
  getCompletedTodoActions,
  type CompletedSubtodoAction,
  type CompletedTodoAction,
} from '../completedActions'
import {
  formatBlockDuration,
  formatBlockTime,
  getFocusBlocks,
  parseDateKey,
  toDateKey,
  type FocusBlock,
} from '../focusMetrics'
import { getBreakRecords, type BreakRecord } from '../breakRecords'
import { getTimeEntries, type TimeEntry } from '../timeTracking'

const blocks = ref<FocusBlock[]>([])
const timeEntries = ref<TimeEntry[]>([])
const breakRecords = ref<BreakRecord[]>([])
const archivedTodos = ref<ArchivedTodo[]>([])
const completedTodoActions = ref<CompletedTodoAction[]>([])
const completedSubtodoActions = ref<CompletedSubtodoAction[]>([])

type DayActionDotType = 'focus' | 'todo' | 'subtodo'
const visibleMonth = ref(new Date().getMonth())
const visibleYear = ref(new Date().getFullYear())
const selectedDateKey = ref(toDateKey())

const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const monthLabel = computed(() => {
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(
    new Date(visibleYear.value, visibleMonth.value, 1),
  )
})

const blocksByDate = computed(() => {
  const map = new Map<string, FocusBlock[]>()

  for (const block of blocks.value) {
    const list = map.get(block.dateKey) ?? []
    list.push(block)
    map.set(block.dateKey, list)
  }

  for (const list of map.values()) {
    list.sort((a, b) => b.completedAt - a.completedAt)
  }

  return map
})

const archivedByDate = computed(() => {
  const map = new Map<string, ArchivedTodo[]>()

  for (const todo of archivedTodos.value) {
    const list = map.get(todo.dateKey) ?? []
    list.push(todo)
    map.set(todo.dateKey, list)
  }

  for (const list of map.values()) {
    list.sort((a, b) => b.archivedAt - a.archivedAt)
  }

  return map
})

const timeEntriesByDate = computed(() => {
  const map = new Map<string, TimeEntry[]>()

  for (const entry of timeEntries.value) {
    const list = map.get(entry.dateKey) ?? []
    list.push(entry)
    map.set(entry.dateKey, list)
  }

  for (const list of map.values()) {
    list.sort((a, b) => b.endedAt - a.endedAt)
  }

  return map
})

const breakRecordsByDate = computed(() => {
  const map = new Map<string, BreakRecord[]>()

  for (const record of breakRecords.value) {
    const list = map.get(record.dateKey) ?? []
    list.push(record)
    map.set(record.dateKey, list)
  }

  for (const list of map.values()) {
    list.sort((a, b) => b.endedAt - a.endedAt)
  }

  return map
})

const completedTodosByDate = computed(() => {
  const map = new Map<string, CompletedTodoAction[]>()

  for (const action of completedTodoActions.value) {
    const list = map.get(action.dateKey) ?? []
    list.push(action)
    map.set(action.dateKey, list)
  }

  return map
})

const completedSubtodosByDate = computed(() => {
  const map = new Map<string, CompletedSubtodoAction[]>()

  for (const action of completedSubtodoActions.value) {
    const list = map.get(action.dateKey) ?? []
    list.push(action)
    map.set(action.dateKey, list)
  }

  return map
})

function getDayActionDots(dateKey: string): DayActionDotType[] {
  const dots: DayActionDotType[] = []
  const seenTodoIds = new Set<string>()
  const seenSubtodoIds = new Set<string>()

  for (const _block of blocksByDate.value.get(dateKey) ?? []) {
    dots.push('focus')
  }

  for (const action of completedTodosByDate.value.get(dateKey) ?? []) {
    if (seenTodoIds.has(action.todoId)) {
      continue
    }

    seenTodoIds.add(action.todoId)
    dots.push('todo')
  }

  for (const action of completedSubtodosByDate.value.get(dateKey) ?? []) {
    if (seenSubtodoIds.has(action.subtodoId)) {
      continue
    }

    seenSubtodoIds.add(action.subtodoId)
    dots.push('subtodo')
  }

  for (const archived of archivedByDate.value.get(dateKey) ?? []) {
    if (!seenTodoIds.has(archived.id)) {
      seenTodoIds.add(archived.id)
      dots.push('todo')
    }

    for (const [index, subtodo] of archived.subtodos.entries()) {
      const subtodoKey = `${archived.id}:${subtodo.title}:${index}`

      if (seenSubtodoIds.has(subtodoKey)) {
        continue
      }

      seenSubtodoIds.add(subtodoKey)
      dots.push('subtodo')
    }
  }

  return dots
}

function formatDayActionLabel(dateKey: string): string {
  const dots = getDayActionDots(dateKey)
  const focus = dots.filter((dot) => dot === 'focus').length
  const todo = dots.filter((dot) => dot === 'todo').length
  const subtodo = dots.filter((dot) => dot === 'subtodo').length
  const parts: string[] = []

  if (focus > 0) {
    parts.push(`${focus} focus`)
  }

  if (todo > 0) {
    parts.push(`${todo} todo${todo === 1 ? '' : 's'}`)
  }

  if (subtodo > 0) {
    parts.push(`${subtodo} subtodo${subtodo === 1 ? '' : 's'}`)
  }

  return parts.length > 0 ? parts.join(', ') : 'no completed actions'
}

function formatTimeEntryRange(entry: TimeEntry): string {
  return `${formatBlockTime(entry.startedAt)} – ${formatBlockTime(entry.endedAt)}`
}

function formatBreakRecordRange(record: BreakRecord): string {
  return `${formatBlockTime(record.startedAt)} – ${formatBlockTime(record.endedAt)}`
}

function formatBreakKindLabel(kind: BreakRecord['kind']): string {
  return kind === 'Long break' ? 'Long break' : 'Short break'
}

const calendarCells = computed(() => {
  const firstOfMonth = new Date(visibleYear.value, visibleMonth.value, 1)
  const startOffset = (firstOfMonth.getDay() + 6) % 7
  const daysInMonth = new Date(visibleYear.value, visibleMonth.value + 1, 0).getDate()
  const cells: Array<{
    dateKey: string
    day: number
    inMonth: boolean
    isToday: boolean
    isSelected: boolean
    actionDots: DayActionDotType[]
  }> = []

  for (let index = 0; index < startOffset; index += 1) {
    const date = new Date(visibleYear.value, visibleMonth.value, index - startOffset + 1)
    const dateKey = toDateKey(date)

    cells.push({
      dateKey,
      day: date.getDate(),
      inMonth: false,
      isToday: dateKey === toDateKey(),
      isSelected: dateKey === selectedDateKey.value,
      actionDots: getDayActionDots(dateKey),
    })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(visibleYear.value, visibleMonth.value, day)
    const dateKey = toDateKey(date)

    cells.push({
      dateKey,
      day,
      inMonth: true,
      isToday: dateKey === toDateKey(),
      isSelected: dateKey === selectedDateKey.value,
      actionDots: getDayActionDots(dateKey),
    })
  }

  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1]
    const date = new Date(parseDateKey(last.dateKey))
    date.setDate(date.getDate() + 1)
    const dateKey = toDateKey(date)

    cells.push({
      dateKey,
      day: date.getDate(),
      inMonth: false,
      isToday: dateKey === toDateKey(),
      isSelected: dateKey === selectedDateKey.value,
      actionDots: getDayActionDots(dateKey),
    })
  }

  return cells
})

const selectedDayBlocks = computed(() => blocksByDate.value.get(selectedDateKey.value) ?? [])
const selectedDayTimeEntries = computed(() => timeEntriesByDate.value.get(selectedDateKey.value) ?? [])
const selectedDayBreakRecords = computed(() => breakRecordsByDate.value.get(selectedDateKey.value) ?? [])
const selectedDayArchived = computed(() => archivedByDate.value.get(selectedDateKey.value) ?? [])
const selectedDayTrackedTotalMs = computed(() =>
  selectedDayTimeEntries.value.reduce((total, entry) => total + entry.durationMs, 0),
)
const selectedDayBreakTotalMs = computed(() =>
  selectedDayBreakRecords.value.reduce((total, record) => total + record.durationMs, 0),
)
const selectedDayNetTrackedMs = computed(() =>
  Math.max(0, selectedDayTrackedTotalMs.value - selectedDayBreakTotalMs.value),
)
const selectedDayHasActivity = computed(
  () =>
    selectedDayBlocks.value.length > 0 ||
    selectedDayTimeEntries.value.length > 0 ||
    selectedDayBreakRecords.value.length > 0 ||
    selectedDayArchived.value.length > 0,
)

const selectedDayLabel = computed(() => {
  return new Intl.DateTimeFormat('en', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parseDateKey(selectedDateKey.value))
})

const totalBlocks = computed(() => blocks.value.length)

const monthBlockCount = computed(() => {
  return blocks.value.filter((block) => {
    const date = parseDateKey(block.dateKey)
    return date.getMonth() === visibleMonth.value && date.getFullYear() === visibleYear.value
  }).length
})

const monthTrackedMs = computed(() => {
  return timeEntries.value.reduce((total, entry) => {
    const date = parseDateKey(entry.dateKey)
    if (date.getMonth() !== visibleMonth.value || date.getFullYear() !== visibleYear.value) {
      return total
    }

    return total + entry.durationMs
  }, 0)
})

const monthBreakMs = computed(() => {
  return breakRecords.value.reduce((total, record) => {
    const date = parseDateKey(record.dateKey)
    if (date.getMonth() !== visibleMonth.value || date.getFullYear() !== visibleYear.value) {
      return total
    }

    return total + record.durationMs
  }, 0)
})

onMounted(() => {
  void loadMetrics()
})

async function loadMetrics() {
  const [loadedBlocks, loadedTimeEntries, loadedBreakRecords, loadedArchived, loadedTodoActions, loadedSubtodoActions] =
    await Promise.all([
      getFocusBlocks(),
      getTimeEntries(),
      getBreakRecords(),
      getArchivedTodos(),
      getCompletedTodoActions(),
      getCompletedSubtodoActions(),
    ])
  blocks.value = loadedBlocks
  timeEntries.value = loadedTimeEntries
  breakRecords.value = loadedBreakRecords
  archivedTodos.value = loadedArchived
  completedTodoActions.value = loadedTodoActions
  completedSubtodoActions.value = loadedSubtodoActions
}

defineExpose({
  reload: loadMetrics,
})

function shiftMonth(delta: number) {
  const next = new Date(visibleYear.value, visibleMonth.value + delta, 1)
  visibleMonth.value = next.getMonth()
  visibleYear.value = next.getFullYear()
}

function selectDate(dateKey: string) {
  selectedDateKey.value = dateKey
}
</script>

<template>
  <article class="glass metrics-panel">
    <div class="panel-heading">
      <div>
        <span class="kicker">Metrics</span>
        <h2>
          {{ monthBlockCount }} blocks<span v-if="monthTrackedMs > 0"> · {{ formatBlockDuration(monthTrackedMs) }} tracked</span><span v-if="monthBreakMs > 0"> · {{ formatBlockDuration(monthBreakMs) }} breaks</span>
          this month
        </h2>
      </div>
      <span class="status-pill">{{ totalBlocks }} total</span>
    </div>

    <div class="metrics-calendar">
      <div class="metrics-calendar__header">
        <button class="metrics-calendar__nav" type="button" aria-label="Previous month" @click="shiftMonth(-1)">
          <ChevronLeft :size="16" />
        </button>
        <h3>{{ monthLabel }}</h3>
        <button class="metrics-calendar__nav" type="button" aria-label="Next month" @click="shiftMonth(1)">
          <ChevronRight :size="16" />
        </button>
      </div>

      <div class="metrics-calendar__weekdays">
        <span v-for="label in weekdayLabels" :key="label">{{ label }}</span>
      </div>

      <div class="metrics-calendar__legend" aria-label="Calendar action legend">
        <span class="metrics-calendar__legend-item">
          <span class="metrics-calendar__day-dot metrics-calendar__day-dot--focus" aria-hidden="true" />
          Focus
        </span>
        <span class="metrics-calendar__legend-item">
          <span class="metrics-calendar__day-dot metrics-calendar__day-dot--todo" aria-hidden="true" />
          Todo
        </span>
        <span class="metrics-calendar__legend-item">
          <span class="metrics-calendar__day-dot metrics-calendar__day-dot--subtodo" aria-hidden="true" />
          Subtodo
        </span>
      </div>

      <div class="metrics-calendar__grid" role="grid" aria-label="Completed actions calendar">
        <button
          v-for="cell in calendarCells"
          :key="cell.dateKey"
          type="button"
          class="metrics-calendar__day"
          :class="{
            'is-outside': !cell.inMonth,
            'is-today': cell.isToday,
            'is-selected': cell.isSelected,
            'has-actions': cell.actionDots.length > 0,
          }"
          role="gridcell"
          :aria-selected="cell.isSelected"
          :aria-label="`${cell.day}, ${formatDayActionLabel(cell.dateKey)}`"
          @click="selectDate(cell.dateKey)"
        >
          <span class="metrics-calendar__day-number">{{ cell.day }}</span>
          <div v-if="cell.actionDots.length > 0" class="metrics-calendar__day-dots">
            <span
              v-for="(dot, index) in cell.actionDots"
              :key="`${cell.dateKey}-${dot}-${index}`"
              class="metrics-calendar__day-dot"
              :class="`metrics-calendar__day-dot--${dot}`"
              aria-hidden="true"
            />
          </div>
        </button>
      </div>
    </div>

    <section class="metrics-day-detail" aria-label="Activity for selected day">
      <h3>{{ selectedDayLabel }}</h3>
      <p v-if="!selectedDayHasActivity" class="metrics-day-detail__empty">
        No focus blocks, time tracked sessions, breaks, or archived tasks on this day.
      </p>
      <template v-else>
        <div
          v-if="selectedDayTrackedTotalMs > 0 || selectedDayBreakTotalMs > 0"
          class="metrics-day-detail__summary"
        >
          <span v-if="selectedDayTrackedTotalMs > 0" class="metrics-summary-chip metrics-summary-chip--tracked">
            <Timer :size="12" aria-hidden="true" />
            {{ formatBlockDuration(selectedDayTrackedTotalMs) }} tracked
            <span v-if="selectedDayTimeEntries.length > 1" class="metrics-summary-chip__meta">
              · {{ selectedDayTimeEntries.length }} sessions
            </span>
          </span>
          <span v-if="selectedDayBreakTotalMs > 0" class="metrics-summary-chip metrics-summary-chip--break">
            <Coffee :size="12" aria-hidden="true" />
            {{ formatBlockDuration(selectedDayBreakTotalMs) }} breaks
          </span>
          <span
            v-if="selectedDayTrackedTotalMs > 0 && selectedDayBreakTotalMs > 0"
            class="metrics-summary-chip metrics-summary-chip--net"
          >
            {{ formatBlockDuration(selectedDayNetTrackedMs) }} net
          </span>
        </div>

        <div class="metrics-day-groups">
          <section v-if="selectedDayBlocks.length > 0" class="metrics-day-group metrics-day-group--focus">
            <h4 class="metrics-day-group__heading">
              <Target :size="14" class="metrics-day-group__icon" aria-hidden="true" />
              Focus sessions
              <span class="metrics-day-group__count">{{ selectedDayBlocks.length }}</span>
            </h4>
            <ul class="metrics-day-group__list">
              <li v-for="block in selectedDayBlocks" :key="block.id" class="metrics-day-item metrics-day-item--focus">
                <Target :size="14" class="metrics-day-item__icon" aria-hidden="true" />
                <div class="metrics-day-item__content">
                  <div class="metrics-day-item__content--inline">
                    <span class="metrics-day-item__primary">{{ formatBlockTime(block.completedAt) }}</span>
                    <span class="metrics-day-item__secondary">
                      {{ formatBlockDuration(block.durationMs) }} focus
                    </span>
                  </div>
                  <p v-if="block.durationMs < block.plannedDurationMs" class="metrics-day-item__meta">
                    Ended early · {{ formatBlockDuration(block.plannedDurationMs) }} planned
                  </p>
                </div>
              </li>
            </ul>
          </section>

          <section v-if="selectedDayTimeEntries.length > 0" class="metrics-day-group metrics-day-group--tracked">
            <h4 class="metrics-day-group__heading">
              <Timer :size="14" class="metrics-day-group__icon" aria-hidden="true" />
              Time tracked
              <span class="metrics-day-group__count">{{ selectedDayTimeEntries.length }}</span>
            </h4>
            <ul class="metrics-day-group__list">
              <li
                v-for="entry in selectedDayTimeEntries"
                :key="entry.id"
                class="metrics-day-item metrics-day-item--tracked"
              >
                <Timer :size="14" class="metrics-day-item__icon" aria-hidden="true" />
                <div class="metrics-day-item__content">
                  <div class="metrics-day-item__content--inline">
                    <span class="metrics-day-item__primary">{{ entry.label || 'Untitled' }}</span>
                    <span class="metrics-day-item__secondary">{{ formatBlockDuration(entry.durationMs) }}</span>
                  </div>
                  <p class="metrics-day-item__meta">{{ formatTimeEntryRange(entry) }}</p>
                  <p v-if="entry.comment" class="metrics-day-item__detail">{{ entry.comment }}</p>
                </div>
              </li>
            </ul>
          </section>

          <section v-if="selectedDayBreakRecords.length > 0" class="metrics-day-group metrics-day-group--break">
            <h4 class="metrics-day-group__heading">
              <Coffee :size="14" class="metrics-day-group__icon" aria-hidden="true" />
              Breaks
              <span class="metrics-day-group__count">{{ selectedDayBreakRecords.length }}</span>
            </h4>
            <ul class="metrics-day-group__list">
              <li
                v-for="record in selectedDayBreakRecords"
                :key="record.id"
                class="metrics-day-item metrics-day-item--break"
              >
                <Coffee :size="14" class="metrics-day-item__icon" aria-hidden="true" />
                <div class="metrics-day-item__content">
                  <div class="metrics-day-item__content--inline">
                    <span class="metrics-day-item__primary">{{ formatBreakKindLabel(record.kind) }}</span>
                    <span class="metrics-day-item__secondary">{{ formatBlockDuration(record.durationMs) }}</span>
                  </div>
                  <p class="metrics-day-item__meta">
                    {{ formatBreakRecordRange(record) }}
                    <span v-if="record.durationMs < record.plannedDurationMs">
                      · ended early ({{ formatBlockDuration(record.plannedDurationMs) }} planned)
                    </span>
                  </p>
                </div>
              </li>
            </ul>
          </section>

          <section v-if="selectedDayArchived.length > 0" class="metrics-day-group metrics-day-group--todo">
            <h4 class="metrics-day-group__heading">
              <Archive :size="14" class="metrics-day-group__icon" aria-hidden="true" />
              Archived todos
              <span class="metrics-day-group__count">{{ selectedDayArchived.length }}</span>
            </h4>
            <ul class="metrics-day-group__list">
              <li v-for="todo in selectedDayArchived" :key="todo.id" class="metrics-day-item metrics-day-item--todo">
                <Archive :size="14" class="metrics-day-item__icon" aria-hidden="true" />
                <div class="metrics-day-item__content">
                  <div class="metrics-day-item__content--inline">
                    <span class="metrics-day-item__primary">{{ todo.title }}</span>
                    <span class="metrics-day-item__secondary">{{ formatBlockTime(todo.archivedAt) }}</span>
                  </div>
                  <p v-if="todo.subtodos.length > 0" class="metrics-day-item__detail">
                    {{ todo.subtodos.map((subtodo) => subtodo.title).join(' · ') }}
                  </p>
                </div>
              </li>
            </ul>
          </section>
        </div>
      </template>
    </section>
  </article>
</template>
