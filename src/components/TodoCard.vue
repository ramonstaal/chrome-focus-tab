<script setup lang="ts">
import { computed, ref } from 'vue'
import InputText from 'primevue/inputtext'
import { Archive, Pencil, Plus, Trash2 } from '@lucide/vue'
import { DEFAULT_STATUS, isTaskDone, type Subtodo, type TaskStatus, type Todo } from '../todos'
import TaskStatusBadge from './TaskStatusBadge.vue'

const props = defineProps<{ todo: Todo }>()

const emit = defineEmits<{
  'status-change': [
    payload:
      | { kind: 'todo'; oldStatus: TaskStatus; newStatus: TaskStatus }
      | { kind: 'subtodo'; subtodoId: string; oldStatus: TaskStatus; newStatus: TaskStatus },
  ]
  'subtodo-added': [subtodo: Subtodo]
  'subtodo-removed': [subtodoId: string]
  'request-edit': [target: { kind: 'todo' } | { kind: 'subtodo'; subtodoId: string }]
  remove: []
  archive: []
}>()

const subtodoDraft = ref('')

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

function removeSubtodo(subtodoId: string) {
  props.todo.subtodos = props.todo.subtodos.filter((subtodo) => subtodo.id !== subtodoId)
  emit('subtodo-removed', subtodoId)
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
        <button class="icon-button" type="button" aria-label="Delete todo" @click="emit('remove')">
          <Trash2 :size="15" />
        </button>
      </div>
    </div>

    <div v-if="todo.subtodos.length" class="subtodo-list">
      <div
        v-for="subtodo in todo.subtodos"
        :key="subtodo.id"
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
            @click="removeSubtodo(subtodo.id)"
          >
            <Trash2 :size="13" />
          </button>
        </div>
      </div>
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
</style>
