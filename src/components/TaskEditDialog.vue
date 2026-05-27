<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { Activity, Check, Circle, CircleCheck, CirclePause, Eye, Pencil, X } from '@lucide/vue'
import { STATUS_LABEL, TASK_STATUSES, type TaskStatus } from '../todos'
import { renderMarkdown } from '../utils/markdown'

const visible = defineModel<boolean>('visible', { required: true })

const props = defineProps<{
  title: string
  status: TaskStatus
  notes: string
  taskKind: 'todo' | 'subtodo'
}>()

const emit = defineEmits<{
  save: [payload: { title: string; status: TaskStatus; notes: string }]
}>()

const titleDraft = ref(props.title)
const statusDraft = ref<TaskStatus>(props.status)
const notesDraft = ref(props.notes)
const notesMode = ref<'edit' | 'preview'>('edit')
const inputRef = useTemplateRef<InstanceType<typeof InputText>>('inputRef')

const renderedNotes = computed(() => renderMarkdown(notesDraft.value))

const STATUS_ICON = {
  open: Circle,
  busy: Activity,
  'on-hold': CirclePause,
  done: CircleCheck,
} as const

const STATUS_HINT: Record<TaskStatus, string> = {
  open: 'Not started yet',
  busy: 'Actively working',
  'on-hold': 'Paused for now',
  done: 'Completed',
}

const statusOptions = computed(() =>
  TASK_STATUSES.map((value) => ({
    label: STATUS_LABEL[value],
    value,
    icon: STATUS_ICON[value],
    hint: STATUS_HINT[value],
  })),
)

const canSave = computed(() => titleDraft.value.trim().length > 0)

const headerLabel = computed(() => (props.taskKind === 'todo' ? 'Edit todo' : 'Edit subtodo'))

const headerKicker = computed(() => (props.taskKind === 'todo' ? 'Task' : 'Subtask'))

const previewTitle = computed(() => titleDraft.value.trim() || 'Untitled task')

const isDirty = computed(
  () =>
    titleDraft.value.trim() !== props.title.trim() ||
    statusDraft.value !== props.status ||
    notesDraft.value !== props.notes,
)

watch(visible, async (isOpen) => {
  if (!isOpen) {
    return
  }

  titleDraft.value = props.title
  statusDraft.value = props.status
  notesDraft.value = props.notes
  notesMode.value = 'edit'
  await nextTick()
  const el = (inputRef.value as unknown as { $el?: HTMLElement } | null)?.$el as
    | HTMLElement
    | undefined
  const input = el?.querySelector('input')
  input?.focus()
  input?.select()
})

function handleCancel() {
  visible.value = false
}

function handleSave() {
  if (!canSave.value) {
    return
  }

  emit('save', {
    title: titleDraft.value.trim(),
    status: statusDraft.value,
    notes: notesDraft.value,
  })
  visible.value = false
}

function pickStatus(value: TaskStatus) {
  statusDraft.value = value
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    class="task-edit-dialog"
    :show-header="false"
    :style="{ width: 'min(460px, 94vw)' }"
    :draggable="false"
    :closable="false"
  >
    <header class="task-edit-dialog__header">
      <div class="task-edit-dialog__header-text">
        <span class="task-edit-dialog__kicker">{{ headerKicker }}</span>
        <h2 class="task-edit-dialog__title">{{ headerLabel }}</h2>
      </div>
      <button
        type="button"
        class="task-edit-dialog__close"
        aria-label="Close dialog"
        @click="handleCancel"
      >
        <X :size="16" />
      </button>
    </header>

    <div class="task-edit-dialog__preview" :class="`task-edit-dialog__preview--${statusDraft}`">
      <span class="task-edit-dialog__preview-dot" />
      <p class="task-edit-dialog__preview-title">{{ previewTitle }}</p>
      <span class="task-edit-dialog__preview-status">{{ STATUS_LABEL[statusDraft] }}</span>
    </div>

    <div class="task-edit-dialog__fields">
      <label class="task-edit-dialog__field">
        <span class="task-edit-dialog__field-label">Title</span>
        <InputText
          ref="inputRef"
          v-model="titleDraft"
          class="task-edit-dialog__input"
          placeholder="What needs doing?"
          @keyup.enter="handleSave"
        />
      </label>

      <div class="task-edit-dialog__field">
        <span class="task-edit-dialog__field-label">Status</span>
        <div class="task-edit-dialog__status" role="radiogroup" aria-label="Status">
          <button
            v-for="option in statusOptions"
            :key="option.value"
            type="button"
            role="radio"
            :aria-checked="statusDraft === option.value"
            class="status-card"
            :class="[
              `status-card--${option.value}`,
              { 'status-card--selected': statusDraft === option.value },
            ]"
            @click="pickStatus(option.value)"
          >
            <span class="status-card__icon-wrap">
              <component :is="option.icon" :size="16" />
            </span>
            <span class="status-card__label">{{ option.label }}</span>
            <Check
              v-if="statusDraft === option.value"
              class="status-card__check"
              :size="12"
              aria-hidden="true"
            />
          </button>
        </div>
        <p class="task-edit-dialog__hint">{{ STATUS_HINT[statusDraft] }}</p>
      </div>

      <div class="task-edit-dialog__field">
        <div class="task-edit-dialog__notes-header">
          <span class="task-edit-dialog__field-label">Notes</span>
          <div class="task-edit-dialog__notes-tabs" role="tablist" aria-label="Notes mode">
            <button
              type="button"
              role="tab"
              :aria-selected="notesMode === 'edit'"
              class="task-edit-dialog__notes-tab"
              :class="{ 'task-edit-dialog__notes-tab--active': notesMode === 'edit' }"
              @click="notesMode = 'edit'"
            >
              <Pencil :size="11" />
              Write
            </button>
            <button
              type="button"
              role="tab"
              :aria-selected="notesMode === 'preview'"
              class="task-edit-dialog__notes-tab"
              :class="{ 'task-edit-dialog__notes-tab--active': notesMode === 'preview' }"
              @click="notesMode = 'preview'"
            >
              <Eye :size="11" />
              Preview
            </button>
          </div>
        </div>
        <textarea
          v-show="notesMode === 'edit'"
          v-model="notesDraft"
          class="task-edit-dialog__notes-input"
          placeholder="Markdown supported — links, **bold**, lists, etc."
          rows="6"
          aria-label="Notes (markdown)"
        ></textarea>
        <div
          v-show="notesMode === 'preview'"
          class="task-edit-dialog__notes-preview markdown-body"
          role="tabpanel"
        >
          <div v-if="renderedNotes" v-html="renderedNotes"></div>
          <p v-else class="task-edit-dialog__notes-empty">Nothing to preview yet.</p>
        </div>
      </div>
    </div>

    <footer class="task-edit-dialog__actions">
      <button type="button" class="task-edit-dialog__button" @click="handleCancel">
        Cancel
      </button>
      <button
        type="button"
        class="task-edit-dialog__button task-edit-dialog__button--primary"
        :disabled="!canSave || !isDirty"
        @click="handleSave"
      >
        Save changes
      </button>
    </footer>
  </Dialog>
</template>

<style>
.task-edit-dialog.p-dialog {
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(18, 24, 42, 0.92) 0%, rgba(8, 13, 26, 0.88) 100%);
  box-shadow:
    0 32px 80px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(28px) saturate(140%);
  -webkit-backdrop-filter: blur(28px) saturate(140%);
  overflow: hidden;
}

.task-edit-dialog .p-dialog-content {
  padding: 0;
  background: transparent;
  color: var(--text);
}

.task-edit-dialog__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 22px 6px;
}

.task-edit-dialog__header-text {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.task-edit-dialog__kicker {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--muted);
}

.task-edit-dialog__title {
  margin: 0;
  font-size: 20px;
  font-weight: 500;
  line-height: 1.15;
  letter-spacing: -0.01em;
  color: var(--text);
}

.task-edit-dialog__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  margin-top: -2px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--muted);
  cursor: pointer;
  transition:
    background 160ms ease,
    color 160ms ease,
    border-color 160ms ease;
}

.task-edit-dialog__close:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.18);
  color: var(--text);
}

.task-edit-dialog__preview {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 14px 22px 0;
  padding: 12px 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  transition:
    background 220ms ease,
    border-color 220ms ease;
}

.task-edit-dialog__preview-dot {
  flex: 0 0 auto;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.45);
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.06);
  transition:
    background 220ms ease,
    box-shadow 220ms ease;
}

.task-edit-dialog__preview-title {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-edit-dialog__preview-status {
  flex: 0 0 auto;
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  transition:
    background 220ms ease,
    color 220ms ease,
    border-color 220ms ease;
}

.task-edit-dialog__preview--busy {
  border-color: rgba(96, 165, 250, 0.28);
  background: rgba(96, 165, 250, 0.08);
}

.task-edit-dialog__preview--busy .task-edit-dialog__preview-dot {
  background: #93c5fd;
  box-shadow: 0 0 0 4px rgba(96, 165, 250, 0.16);
}

.task-edit-dialog__preview--busy .task-edit-dialog__preview-status {
  color: #cfe2ff;
  border-color: rgba(96, 165, 250, 0.4);
  background: rgba(96, 165, 250, 0.16);
}

.task-edit-dialog__preview--on-hold {
  border-color: rgba(250, 204, 21, 0.28);
  background: rgba(250, 204, 21, 0.08);
}

.task-edit-dialog__preview--on-hold .task-edit-dialog__preview-dot {
  background: #fde047;
  box-shadow: 0 0 0 4px rgba(250, 204, 21, 0.18);
}

.task-edit-dialog__preview--on-hold .task-edit-dialog__preview-status {
  color: #fef3c7;
  border-color: rgba(250, 204, 21, 0.4);
  background: rgba(250, 204, 21, 0.16);
}

.task-edit-dialog__preview--done {
  border-color: rgba(74, 222, 128, 0.3);
  background: rgba(74, 222, 128, 0.08);
}

.task-edit-dialog__preview--done .task-edit-dialog__preview-dot {
  background: #86efac;
  box-shadow: 0 0 0 4px rgba(74, 222, 128, 0.18);
}

.task-edit-dialog__preview--done .task-edit-dialog__preview-status {
  color: #bbf7d0;
  border-color: rgba(74, 222, 128, 0.42);
  background: rgba(74, 222, 128, 0.16);
}

.task-edit-dialog__preview--done .task-edit-dialog__preview-title {
  text-decoration: line-through;
  text-decoration-color: rgba(255, 255, 255, 0.4);
  color: rgba(255, 255, 255, 0.72);
}

.task-edit-dialog__fields {
  display: grid;
  gap: 18px;
  padding: 18px 22px 4px;
}

.task-edit-dialog__field {
  display: grid;
  gap: 10px;
}

.task-edit-dialog__field-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
}

.task-edit-dialog__input.p-inputtext {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--text);
  font-size: 15px;
  letter-spacing: normal;
  text-transform: none;
  transition:
    background 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.task-edit-dialog__input.p-inputtext::placeholder {
  color: rgba(255, 255, 255, 0.42);
}

.task-edit-dialog__input.p-inputtext:enabled:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.2);
}

.task-edit-dialog__input.p-inputtext:enabled:focus {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.4);
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.06);
  outline: none;
}

.task-edit-dialog__status {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.status-card {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 6px;
  padding: 12px 8px 11px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--muted);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.01em;
  text-align: center;
  cursor: pointer;
  transition:
    background 180ms ease,
    border-color 180ms ease,
    color 180ms ease,
    transform 180ms ease,
    box-shadow 180ms ease;
}

.status-card:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.2);
  color: var(--text);
  transform: translateY(-1px);
}

.status-card:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.16);
}

.status-card__icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
  transition:
    background 180ms ease,
    color 180ms ease;
}

.status-card__label {
  display: block;
  line-height: 1;
}

.status-card__check {
  position: absolute;
  top: 6px;
  right: 6px;
  color: rgba(255, 255, 255, 0.7);
  opacity: 0;
  transform: scale(0.85);
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.status-card--selected .status-card__check {
  opacity: 1;
  transform: scale(1);
}

.status-card--open.status-card--selected {
  color: var(--text);
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.32);
}

.status-card--open.status-card--selected .status-card__icon-wrap {
  background: rgba(255, 255, 255, 0.16);
  color: var(--text);
}

.status-card--busy.status-card--selected {
  color: #e5efff;
  background: rgba(96, 165, 250, 0.16);
  border-color: rgba(96, 165, 250, 0.5);
}

.status-card--busy.status-card--selected .status-card__icon-wrap {
  background: rgba(96, 165, 250, 0.28);
  color: #cfe2ff;
}

.status-card--busy.status-card--selected .status-card__check {
  color: #cfe2ff;
}

.status-card--on-hold.status-card--selected {
  color: #fef9c3;
  background: rgba(250, 204, 21, 0.14);
  border-color: rgba(250, 204, 21, 0.5);
}

.status-card--on-hold.status-card--selected .status-card__icon-wrap {
  background: rgba(250, 204, 21, 0.26);
  color: #fef3c7;
}

.status-card--on-hold.status-card--selected .status-card__check {
  color: #fef3c7;
}

.status-card--done.status-card--selected {
  color: #d1fadf;
  background: rgba(74, 222, 128, 0.14);
  border-color: rgba(74, 222, 128, 0.5);
}

.status-card--done.status-card--selected .status-card__icon-wrap {
  background: rgba(74, 222, 128, 0.26);
  color: #bbf7d0;
}

.status-card--done.status-card--selected .status-card__check {
  color: #bbf7d0;
}

.task-edit-dialog__hint {
  margin: -2px 0 0;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.4;
  min-height: 1.2em;
}

.task-edit-dialog__notes-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.task-edit-dialog__notes-tabs {
  display: inline-flex;
  padding: 2px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
}

.task-edit-dialog__notes-tab {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition:
    background 160ms ease,
    color 160ms ease;
}

.task-edit-dialog__notes-tab:hover {
  color: var(--text);
}

.task-edit-dialog__notes-tab--active {
  color: var(--text);
  background: rgba(255, 255, 255, 0.1);
}

.task-edit-dialog__notes-input {
  width: 100%;
  min-height: 120px;
  padding: 12px 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--text);
  font: inherit;
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
  transition:
    background 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.task-edit-dialog__notes-input::placeholder {
  color: rgba(255, 255, 255, 0.42);
}

.task-edit-dialog__notes-input:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.2);
}

.task-edit-dialog__notes-input:focus {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.4);
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.06);
  outline: none;
}

.task-edit-dialog__notes-preview {
  min-height: 120px;
  padding: 12px 14px;
  border: 1px dashed rgba(255, 255, 255, 0.14);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.02);
  color: var(--text);
  font-size: 13px;
  line-height: 1.55;
}

.task-edit-dialog__notes-empty {
  margin: 0;
  color: var(--muted);
  font-style: italic;
}

.task-edit-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 18px;
  padding: 14px 22px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.task-edit-dialog__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 9px 18px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  color: var(--text);
  background: transparent;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.01em;
  cursor: pointer;
  transition:
    background 160ms ease,
    border-color 160ms ease,
    color 160ms ease,
    transform 160ms ease;
}

.task-edit-dialog__button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.24);
}

.task-edit-dialog__button:active:not(:disabled) {
  transform: translateY(1px);
}

.task-edit-dialog__button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.task-edit-dialog__button--primary {
  color: #0b1020;
  background: rgba(255, 255, 255, 0.92);
  border-color: rgba(255, 255, 255, 0.5);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.24);
}

.task-edit-dialog__button--primary:hover:not(:disabled) {
  background: #fff;
  border-color: rgba(255, 255, 255, 0.7);
}

@media (max-width: 480px) {
  .task-edit-dialog__status {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
