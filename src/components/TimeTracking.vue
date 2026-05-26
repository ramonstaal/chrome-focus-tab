<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { Play, Square, Timer } from '@lucide/vue'
import { formatDuration } from '../utils/duration'
import {
  formatBlockTime,
  toDateKey,
} from '../focusMetrics'
import {
  getActiveTimeTracking,
  getTimeEntries,
  startTimeTracking,
  stopTimeTracking,
  updateActiveTimeTracking,
  type ActiveTimeTracking,
  type TimeEntry,
} from '../timeTracking'

const emit = defineEmits<{
  activeChange: [active: boolean]
}>()

const now = ref(Date.now())
const activeSession = ref<ActiveTimeTracking | null>(null)
const entries = ref<TimeEntry[]>([])
const draftLabel = ref('')
const draftComment = ref('')
const showStartForm = ref(false)
const contextDialogOpen = ref(false)
let clockInterval: number | undefined

const isActive = computed(() => activeSession.value !== null)

const elapsedMs = computed(() => {
  if (!activeSession.value) {
    return 0
  }

  return Math.max(0, now.value - activeSession.value.startedAt)
})

const recentEntries = computed(() => entries.value.slice(0, 5))

const compactClockLabel = computed(() => {
  if (!activeSession.value?.label) {
    return 'Time tracking'
  }

  return activeSession.value.label
})

function emitActiveState() {
  emit('activeChange', isActive.value)
}

async function refreshState() {
  activeSession.value = await getActiveTimeTracking()
  entries.value = await getTimeEntries()

  if (activeSession.value) {
    draftLabel.value = activeSession.value.label
    draftComment.value = activeSession.value.comment
    showStartForm.value = false
  }

  emitActiveState()
}

async function handleStart() {
  const label = draftLabel.value.trim()

  if (!label) {
    return
  }

  activeSession.value = await startTimeTracking({
    label,
    comment: draftComment.value.trim(),
  })
  showStartForm.value = false
  emitActiveState()
}

async function handleStop() {
  contextDialogOpen.value = false
  await persistDraft()
  await stopTimeTracking()
  draftLabel.value = ''
  draftComment.value = ''
  showStartForm.value = false
  await refreshState()
}

async function persistDraft() {
  if (!activeSession.value) {
    return
  }

  const label = draftLabel.value.trim()
  const comment = draftComment.value.trim()

  if (label === activeSession.value.label && comment === activeSession.value.comment) {
    return
  }

  activeSession.value = await updateActiveTimeTracking({ label, comment })
}

function openStartForm() {
  draftLabel.value = ''
  draftComment.value = ''
  showStartForm.value = true
}

function cancelStartForm() {
  showStartForm.value = false
  draftLabel.value = ''
  draftComment.value = ''
}

function openContextDialog() {
  if (!activeSession.value) {
    return
  }

  draftLabel.value = activeSession.value.label
  draftComment.value = activeSession.value.comment
  contextDialogOpen.value = true
}

function formatEntryRange(entry: TimeEntry): string {
  return `${formatBlockTime(entry.startedAt)} – ${formatBlockTime(entry.endedAt)}`
}

function formatEntryDate(entry: TimeEntry): string {
  const todayKey = toDateKey(now.value)

  if (entry.dateKey === todayKey) {
    return 'Today'
  }

  return new Intl.DateTimeFormat('en', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(entry.startedAt)
}

watch(contextDialogOpen, (open) => {
  if (!open) {
    void persistDraft()
  }
})

onMounted(() => {
  clockInterval = window.setInterval(() => {
    now.value = Date.now()
  }, 1000)
  void refreshState()
})

onUnmounted(() => {
  if (clockInterval) {
    window.clearInterval(clockInterval)
  }
})

defineExpose({
  refreshState,
  isActive,
})
</script>

<template>
  <button
    v-if="isActive"
    type="button"
    class="time-tracking time-tracking--compact backdrop-glass"
    :aria-label="`${compactClockLabel}, ${formatDuration(elapsedMs)} elapsed. Open time tracking details.`"
    @click="openContextDialog"
  >
    <Timer class="time-tracking__compact-icon" :size="11" aria-hidden="true" />
    <span class="time-tracking__compact-clock">{{ formatDuration(elapsedMs) }}</span>
  </button>

  <section v-else class="time-tracking backdrop-glass" aria-label="Time tracking">
    <div class="time-tracking__header">
      <div class="time-tracking__title">
        <Timer :size="14" aria-hidden="true" />
        <h3>Time tracking</h3>
      </div>
    </div>

    <template v-if="showStartForm">
      <div class="time-tracking__fields">
        <label class="time-tracking__field">
          <span>Label</span>
          <InputText
            v-model="draftLabel"
            class="time-tracking-field backdrop-glass"
            placeholder="What are you working on?"
          />
        </label>
        <label class="time-tracking__field">
          <span>Comment</span>
          <textarea
            v-model="draftComment"
            class="time-tracking-field time-tracking-field--textarea backdrop-glass"
            rows="2"
            placeholder="Optional context"
          />
        </label>
      </div>
      <div class="time-tracking__start-actions">
        <button type="button" class="time-tracking__action backdrop-glass" @click="cancelStartForm">Cancel</button>
        <button
          type="button"
          class="time-tracking__action time-tracking__action--primary backdrop-glass backdrop-glass--solid"
          :disabled="!draftLabel.trim()"
          @click="handleStart"
        >
          <Play :size="14" aria-hidden="true" />
          Start tracking
        </button>
      </div>
    </template>

    <button
      v-else
      type="button"
      class="time-tracking__action time-tracking__action--primary backdrop-glass backdrop-glass--solid"
      @click="openStartForm"
    >
      <Play :size="14" aria-hidden="true" />
      Start tracking
    </button>

    <ul v-if="recentEntries.length > 0" class="time-tracking__history">
      <li v-for="entry in recentEntries" :key="entry.id" class="time-tracking__entry">
        <div class="time-tracking__entry-main">
          <strong>{{ entry.label || 'Untitled' }}</strong>
          <span>{{ formatDuration(entry.durationMs) }}</span>
        </div>
        <p class="time-tracking__entry-meta">
          {{ formatEntryDate(entry) }} · {{ formatEntryRange(entry) }}
        </p>
        <p v-if="entry.comment" class="time-tracking__entry-comment">{{ entry.comment }}</p>
      </li>
    </ul>
  </section>

  <Dialog
    v-model:visible="contextDialogOpen"
    modal
    class="time-tracking-context-dialog"
    header="Time tracking"
    :style="{ width: 'min(360px, 92vw)' }"
    :draggable="false"
  >
    <p class="time-tracking-context-dialog__elapsed">{{ formatDuration(elapsedMs) }}</p>
    <div class="time-tracking__fields">
      <label class="time-tracking__field">
        <span>Label</span>
        <InputText
          v-model="draftLabel"
          class="time-tracking-field backdrop-glass"
          placeholder="What are you working on?"
        />
      </label>
      <label class="time-tracking__field">
        <span>Comment</span>
        <textarea
          v-model="draftComment"
          class="time-tracking-field time-tracking-field--textarea backdrop-glass"
          rows="3"
          placeholder="Optional context"
        />
      </label>
    </div>
    <button
      type="button"
      class="time-tracking__action time-tracking__action--stop backdrop-glass"
      @click="handleStop"
    >
      <Square :size="14" fill="currentColor" aria-hidden="true" />
      Stop tracking
    </button>
  </Dialog>
</template>
