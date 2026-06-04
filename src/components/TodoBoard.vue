<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import InputText from 'primevue/inputtext'
import { Plus } from '@lucide/vue'
import TodoCard from './TodoCard.vue'
import type { Subtodo, TaskStatus, Todo } from '../todos'

const props = defineProps<{
  todos: Todo[]
  categoryName: string
  isCollapsed: (todoId: string) => boolean
}>()

const emit = defineEmits<{
  add: [title: string]
  'status-change': [
    todo: Todo,
    event:
      | { kind: 'todo'; oldStatus: TaskStatus; newStatus: TaskStatus }
      | { kind: 'subtodo'; subtodoId: string; oldStatus: TaskStatus; newStatus: TaskStatus },
  ]
  'subtodo-added': []
  'request-edit': [todoId: string, target: { kind: 'todo' } | { kind: 'subtodo'; subtodoId: string }]
  'request-remove': [todo: Todo]
  'request-remove-subtodo': [todoId: string, subtodo: Subtodo]
  archive: [todo: Todo]
  'toggle-collapse': [todoId: string]
}>()

const newTodoTitle = ref('')

const completedTodos = computed(
  () => props.todos.filter((todo) => todo.status === 'done').length,
)

const TODO_LIST_COLUMN_TARGET_PX = 500
const TODO_LIST_GAP_PX = 10

const todoListRef = ref<HTMLElement | null>(null)
const todoColumnsPerRow = ref(1)

function updateTodoColumnsPerRow(width: number) {
  const columns = Math.floor(
    (width + TODO_LIST_GAP_PX) / (TODO_LIST_COLUMN_TARGET_PX + TODO_LIST_GAP_PX),
  )
  todoColumnsPerRow.value = Math.max(1, columns)
}

const todoRows = computed(() => {
  const perRow = todoColumnsPerRow.value
  const items = props.todos

  if (!items.length) {
    return [] as Todo[][]
  }

  const rows: Todo[][] = []

  for (let index = 0; index < items.length; index += perRow) {
    rows.push(items.slice(index, index + perRow))
  }

  return rows
})

watchEffect((onCleanup) => {
  const listElement = todoListRef.value

  if (!listElement) {
    return
  }

  const observer = new ResizeObserver(([entry]) => {
    const width =
      entry.contentBoxSize?.[0]?.inlineSize ??
      entry.borderBoxSize?.[0]?.inlineSize ??
      entry.contentRect.width
    updateTodoColumnsPerRow(width)
  })
  observer.observe(listElement)
  updateTodoColumnsPerRow(listElement.getBoundingClientRect().width)

  onCleanup(() => observer.disconnect())
})

function submitTodo() {
  const title = newTodoTitle.value.trim()

  if (!title) {
    return
  }

  emit('add', title)
  newTodoTitle.value = ''
}
</script>

<template>
  <div class="todo-board">
    <div class="todo-board__intro">
      <div class="panel-heading">
        <div>
          <span class="kicker">Tasks</span>
          <h2>{{ categoryName }}</h2>
        </div>
        <span class="status-pill">{{ completedTodos }}/{{ todos.length }} done</span>
      </div>

      <form class="todo-form" @submit.prevent="submitTodo">
        <div class="todo-input-wrap">
          <InputText
            v-model="newTodoTitle"
            placeholder="Enter a todo"
            aria-label="New todo"
            class="todo-input backdrop-glass"
          />
          <button class="todo-input-addon" type="submit" aria-label="Add todo">
            <Plus :size="16" />
          </button>
        </div>
      </form>
    </div>

    <div
      v-if="todos.length"
      ref="todoListRef"
      class="todo-list"
      :style="{ '--todo-columns-per-row': todoColumnsPerRow }"
      :aria-label="`${categoryName} todos`"
    >
      <div v-for="(row, rowIndex) in todoRows" :key="`todo-row-${rowIndex}`" class="todo-list__row">
        <div v-for="todo in row" :key="todo.id" class="todo-list__column">
          <TodoCard
            :todo="todo"
            :collapsed="isCollapsed(todo.id)"
            @status-change="(event) => emit('status-change', todo, event)"
            @subtodo-added="emit('subtodo-added')"
            @request-edit="(target) => emit('request-edit', todo.id, target)"
            @request-remove="emit('request-remove', todo)"
            @request-remove-subtodo="(subtodo) => emit('request-remove-subtodo', todo.id, subtodo)"
            @archive="emit('archive', todo)"
            @toggle-collapse="emit('toggle-collapse', todo.id)"
          />
        </div>
      </div>
    </div>

    <p v-else class="todo-board__empty subtle">No todos in this category yet.</p>
  </div>
</template>

<style>
.todo-board__intro {
  margin-bottom: 4px;
}

.todo-board__empty {
  margin: 8px 0 0;
  text-align: center;
}
</style>
