<script setup lang="ts">
import { computed, ref } from 'vue'
import InputText from 'primevue/inputtext'
import { Archive, ChevronDown, FileText, Pencil, Plus, Trash2 } from '@lucide/vue'
import { DEFAULT_STATUS, isTaskDone, type Subtodo, type TaskStatus, type Todo } from '../todos'
import TaskStatusBadge from './TaskStatusBadge.vue'
import { renderMarkdown } from '../utils/markdown'

const props = defineProps<{ todo: Todo }>()

const emit = defineEmits<{
  'status-change': [
    payload:
      | { kind: 'todo'; oldStatus: TaskStatus; newStatus: TaskStatus }
      | { kind: 'subtodo'; subtodoId: string; oldStatus: TaskStatus; newStatus: TaskStatus },
  ]
  'subtodo-added': [subtodo: Subtodo]
  'request-edit': [target: { kind: 'todo' } | { kind: 'subtodo'; subtodoId: string }]
  'request-remove-subtodo': [subtodo: Subtodo]
  'request-remove': []
  archive: []
}>()

const subtodoDraft = ref('')
const todoNotesOpen = ref(false)
const subtodoNotesOpen = ref<Record<string, boolean>>({})

const hasTodoNotes = computed(() => props.todo.notes.trim().length > 0)
const renderedTodoNotes = computed(() => renderMarkdown(props.todo.notes))

function hasSubtodoNotes(subtodo: Subtodo): boolean {
  return subtodo.notes.trim().length > 0
}

function renderedSubtodoNotes(subtodo: Subtodo): string {
  return renderMarkdown(subtodo.notes)
}

function toggleSubtodoNotes(subtodoId: string) {
  subtodoNotesOpen.value = {
    ...subtodoNotesOpen.value,
    [subtodoId]: !subtodoNotesOpen.value[subtodoId],
  }
}

const isFullyComplete = computed(() => {
  if (!isTaskDone(props.todo.status)) {
    return false
  }

  return props.todo.subtodos.every((subtodo) => isTaskDone(subtodo.status))
})

function setTodoStatus(newStatus: TaskStatus) {
  const oldStatus = props.todo.status

  if (oldStatus === newStatus) {
    return
  }

  props.todo.status = newStatus
  emit('status-change', { kind: 'todo', oldStatus, newStatus })
}

function setSubtodoStatus(subtodo: Subtodo, newStatus: TaskStatus) {
  const oldStatus = subtodo.status

  if (oldStatus === newStatus) {
    return
  }

  subtodo.status = newStatus
  emit('status-change', {
    kind: 'subtodo',
    subtodoId: subtodo.id,
    oldStatus,
    newStatus,
  })
}

function splitSubtodoLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function createSubtodo(title: string): Subtodo {
  return {
    id: crypto.randomUUID(),
    title,
    status: DEFAULT_STATUS,
    notes: '',
  }
}

function addSubtodosFromLines(lines: string[]) {
  for (const title of lines) {
    const subtodo = createSubtodo(title)
    props.todo.subtodos.push(subtodo)
    emit('subtodo-added', subtodo)
  }
}

function addSubtodo() {
  const lines = splitSubtodoLines(subtodoDraft.value)

  if (lines.length === 0) {
    return
  }

  addSubtodosFromLines(lines)
  subtodoDraft.value = ''
}

function handleSubtodoPaste(event: ClipboardEvent) {
  const pasted = event.clipboardData?.getData('text/plain') ?? ''
  const pastedLines = splitSubtodoLines(pasted)

  if (pastedLines.length <= 1) {
    return
  }

  event.preventDefault()

  const draftLine = subtodoDraft.value.trim()
  const lines = draftLine ? [draftLine, ...pastedLines] : pastedLines

  addSubtodosFromLines(lines)
  subtodoDraft.value = ''
}
</script>

<template>
  <article
    class="todo-card"
    :class="[`todo-card--status-${todo.status}`, { 'todo-card--done': isTaskDone(todo.status) }]"
  >
    <div class="todo-row">
      <TaskStatusBadge
        :status="todo.status"
        :aria-label="`Todo status: change for '${todo.title}'`"
        @change="setTodoStatus"
      />
      <button
        type="button"
        class="todo-row__title"
        :class="`todo-row__title--status-${todo.status}`"
        :title="`Edit '${todo.title}'`"
        @click="emit('request-edit', { kind: 'todo' })"
      >
        {{ todo.title }}
      </button>
      <div class="todo-row-actions">
        <button
          v-if="hasTodoNotes"
          class="icon-button todo-notes-toggle"
          :class="{ 'todo-notes-toggle--open': todoNotesOpen }"
          type="button"
          :aria-expanded="todoNotesOpen"
          aria-label="Toggle notes"
          title="Toggle notes"
          @click="todoNotesOpen = !todoNotesOpen"
        >
          <FileText :size="13" />
          <ChevronDown class="todo-notes-toggle__chevron" :size="11" />
        </button>
        <button
          class="icon-button"
          type="button"
          aria-label="Edit todo"
          @click="emit('request-edit', { kind: 'todo' })"
        >
          <Pencil :size="14" />
        </button>
        <button
          v-if="isFullyComplete"
          class="icon-button"
          type="button"
          aria-label="Archive todo"
          @click="emit('archive')"
        >
          <Archive :size="15" />
        </button>
        <button
          class="icon-button"
          type="button"
          aria-label="Delete todo"
          @click="emit('request-remove')"
        >
          <Trash2 :size="15" />
        </button>
      </div>
    </div>

    <div
      v-if="hasTodoNotes && todoNotesOpen"
      class="todo-notes markdown-body"
      v-html="renderedTodoNotes"
    ></div>

    <div v-if="todo.subtodos.length" class="subtodo-list">
      <template v-for="subtodo in todo.subtodos" :key="subtodo.id">
        <div
          class="subtodo-row"
          :class="[
            `subtodo-row--status-${subtodo.status}`,
            { 'subtodo-row--done': isTaskDone(subtodo.status) },
          ]"
        >
          <TaskStatusBadge
            :status="subtodo.status"
            size="sm"
            :aria-label="`Subtodo status: change for '${subtodo.title}'`"
            @change="(status) => setSubtodoStatus(subtodo, status)"
          />
          <button
            type="button"
            class="subtodo-row__title"
            :class="`subtodo-row__title--status-${subtodo.status}`"
            :title="`Edit '${subtodo.title}'`"
            @click="emit('request-edit', { kind: 'subtodo', subtodoId: subtodo.id })"
          >
            {{ subtodo.title }}
          </button>
          <div class="todo-row-actions">
            <button
              v-if="hasSubtodoNotes(subtodo)"
              class="icon-button todo-notes-toggle"
              :class="{ 'todo-notes-toggle--open': subtodoNotesOpen[subtodo.id] }"
              type="button"
              :aria-expanded="!!subtodoNotesOpen[subtodo.id]"
              aria-label="Toggle subtodo notes"
              title="Toggle notes"
              @click="toggleSubtodoNotes(subtodo.id)"
            >
              <FileText :size="11" />
              <ChevronDown class="todo-notes-toggle__chevron" :size="10" />
            </button>
            <button
              class="icon-button"
              type="button"
              aria-label="Edit subtodo"
              @click="emit('request-edit', { kind: 'subtodo', subtodoId: subtodo.id })"
            >
              <Pencil :size="12" />
            </button>
            <button
              class="icon-button"
              type="button"
              aria-label="Delete subtodo"
              @click="emit('request-remove-subtodo', subtodo)"
            >
              <Trash2 :size="13" />
            </button>
          </div>
        </div>
        <div
          v-if="hasSubtodoNotes(subtodo) && subtodoNotesOpen[subtodo.id]"
          class="subtodo-notes markdown-body"
          v-html="renderedSubtodoNotes(subtodo)"
        ></div>
      </template>
    </div>

    <form class="subtodo-form" @submit.prevent="addSubtodo">
      <div class="todo-input-wrap">
        <InputText
          v-model="subtodoDraft"
          placeholder="Add a subtodo (paste multiple lines)"
          class="todo-input backdrop-glass"
          @paste="handleSubtodoPaste"
        />
        <button class="todo-input-addon" type="submit" aria-label="Add subtodo">
          <Plus :size="14" />
        </button>
      </div>
    </form>
  </article>
</template>

<style>
.todo-row__title,
.subtodo-row__title {
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  overflow-wrap: anywhere;
  border-radius: 4px;
}

.todo-row__title {
  font-weight: 600;
}

.todo-row__title--status-open,
.subtodo-row__title--status-open {
  color: rgba(255, 255, 255, 0.78);
}

.todo-row__title--status-busy,
.subtodo-row__title--status-busy {
  color: #cfe2ff;
}

.todo-row__title--status-on-hold,
.subtodo-row__title--status-on-hold {
  color: #fef3c7;
}

.todo-row__title--status-done,
.subtodo-row__title--status-done {
  color: #bbf7d0;
}

.todo-row__title:hover,
.subtodo-row__title:hover,
.todo-row__title:focus-visible,
.subtodo-row__title:focus-visible {
  text-decoration-color: currentColor;
  text-underline-offset: 3px;
  text-decoration-line: underline;
  outline: none;
  opacity: 0.92;
}

.todo-card--done .todo-row__title--status-done {
  text-decoration: line-through;
  text-decoration-color: rgba(134, 239, 172, 0.55);
}

.subtodo-row--done .subtodo-row__title--status-done {
  text-decoration: line-through;
  text-decoration-color: rgba(134, 239, 172, 0.45);
}

.todo-card--done {
  opacity: 0.7;
}

.subtodo-row--done {
  opacity: 0.78;
}

.todo-notes {
  margin: 6px 0 4px;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  background: var(--subtodo-list-bg);
}

.subtodo-notes {
  margin: 2px 0 6px 30px;
  padding: 8px 10px;
  border-left: 2px solid rgba(255, 255, 255, 0.12);
  background: var(--subtodo-list-bg);
  border-radius: 0 8px 8px 0;
  font-size: 12.5px;
  color: var(--muted);
}

.subtodo-notes.markdown-body {
  color: var(--muted);
}

.todo-notes-toggle {
  display: inline-flex;
  align-items: center;
  gap: 1px;
}

.todo-notes-toggle__chevron {
  transition: transform 160ms ease;
}

.todo-notes-toggle--open .todo-notes-toggle__chevron {
  transform: rotate(180deg);
}
</style>
