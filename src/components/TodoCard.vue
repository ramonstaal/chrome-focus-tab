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

function addSubtodo() {
  const title = subtodoDraft.value.trim()

  if (!title) {
    return
  }

  const subtodo: Subtodo = {
    id: crypto.randomUUID(),
    title,
    status: DEFAULT_STATUS,
    notes: '',
  }

  props.todo.subtodos.push(subtodo)
  subtodoDraft.value = ''
  emit('subtodo-added', subtodo)
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
          placeholder="Add a subtodo"
          class="todo-input backdrop-glass"
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
  color: var(--text);
}

.subtodo-row__title {
  color: var(--muted);
}

.todo-row__title:hover,
.subtodo-row__title:hover,
.todo-row__title:focus-visible,
.subtodo-row__title:focus-visible {
  color: var(--text);
  text-decoration-color: rgba(255, 255, 255, 0.42);
  text-underline-offset: 3px;
  text-decoration-line: underline;
  outline: none;
}

.todo-card--done .todo-row__title {
  text-decoration: line-through;
  text-decoration-color: rgba(255, 255, 255, 0.4);
}

.subtodo-row--done .subtodo-row__title {
  text-decoration: line-through;
  text-decoration-color: rgba(255, 255, 255, 0.32);
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
  background: rgba(255, 255, 255, 0.03);
}

.subtodo-notes {
  margin: 2px 0 6px 30px;
  padding: 8px 10px;
  border-left: 2px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.02);
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
