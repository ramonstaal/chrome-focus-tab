<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'

const visible = defineModel<boolean>('visible', { required: true })

const props = defineProps<{
  sessionLabel: string
}>()

const emit = defineEmits<{
  skip: []
  start: [payload: { label: string; comment: string }]
}>()

const label = ref('')
const comment = ref('')

const canStartTracking = computed(() => label.value.trim().length > 0)

watch(visible, (open) => {
  if (!open) {
    label.value = ''
    comment.value = ''
  }
})

function handleSkip() {
  visible.value = false
  emit('skip')
}

function handleStartTracking() {
  if (!canStartTracking.value) {
    return
  }

  visible.value = false
  emit('start', {
    label: label.value.trim(),
    comment: comment.value.trim(),
  })
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    class="time-tracking-start-dialog"
    header="Start time tracking?"
    :style="{ width: 'min(360px, 92vw)' }"
    :draggable="false"
    :closable="false"
  >
    <p class="time-tracking-start-dialog__message">
      Track time for this {{ sessionLabel }} session with a label and note.
    </p>
    <div class="time-tracking-start-dialog__fields">
      <label class="time-tracking-start-dialog__field">
        <span>Label</span>
        <InputText v-model="label" class="time-tracking-field backdrop-glass" placeholder="What are you working on?" />
      </label>
      <label class="time-tracking-start-dialog__field">
        <span>Comment</span>
        <textarea
          v-model="comment"
          class="time-tracking-field time-tracking-field--textarea backdrop-glass"
          rows="3"
          placeholder="Optional context"
        />
      </label>
    </div>
    <div class="time-tracking-start-dialog__actions">
      <button type="button" class="time-tracking-start-dialog__button" @click="handleSkip">Timer only</button>
      <button
        type="button"
        class="time-tracking-start-dialog__button time-tracking-start-dialog__button--primary"
        :disabled="!canStartTracking"
        @click="handleStartTracking"
      >
        Start tracking
      </button>
    </div>
  </Dialog>
</template>

<style>
.time-tracking-start-dialog__message {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.5;
}

.time-tracking-start-dialog__fields {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}

.time-tracking-start-dialog__field {
  display: grid;
  gap: 6px;
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}

.time-tracking-start-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 18px;
}

.time-tracking-start-dialog__button {
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  padding: 7px 14px;
  color: var(--text);
  background: transparent;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.time-tracking-start-dialog__button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
}

.time-tracking-start-dialog__button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.time-tracking-start-dialog__button--primary {
  color: #0f172a;
  background: rgba(255, 255, 255, 0.88);
  border-color: rgba(255, 255, 255, 0.42);
}

.time-tracking-start-dialog__button--primary:hover:not(:disabled) {
  background: #fff;
}

.time-tracking-start-dialog.p-dialog {
  border: 1px solid var(--line);
  background: var(--panel-strong);
  box-shadow: var(--shadow);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
}

.time-tracking-start-dialog .p-dialog-header {
  padding: 16px 18px 8px;
  background: transparent;
  color: var(--text);
}

.time-tracking-start-dialog .p-dialog-title {
  font-size: 16px;
  font-weight: 500;
}

.time-tracking-start-dialog .p-dialog-content {
  padding: 0 18px 18px;
  background: transparent;
  color: var(--text);
}
</style>
