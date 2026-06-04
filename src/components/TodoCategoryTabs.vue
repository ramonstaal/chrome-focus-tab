<script setup lang="ts">
import { Pencil, Plus } from '@lucide/vue'
import type { TodoCategory } from '../categories'

const props = defineProps<{
  categories: TodoCategory[]
  activeCategoryId: string
  todoCounts: Record<string, number>
}>()

const emit = defineEmits<{
  select: [categoryId: string]
  create: []
  edit: [category: TodoCategory]
}>()

function countFor(categoryId: string): number {
  return props.todoCounts[categoryId] ?? 0
}
</script>

<template>
  <nav class="todo-category-tabs" aria-label="Todo categories">
    <div class="todo-category-tabs__list" role="tablist">
      <div
        v-for="category in categories"
        :key="category.id"
        class="todo-category-tabs__item"
        :class="{ 'todo-category-tabs__item--active': category.id === activeCategoryId }"
      >
        <button
          type="button"
          role="tab"
          class="todo-category-tabs__tab"
          :class="{ 'todo-category-tabs__tab--active': category.id === activeCategoryId }"
          :aria-selected="category.id === activeCategoryId"
          @click="emit('select', category.id)"
          @dblclick="emit('edit', category)"
        >
          <span class="todo-category-tabs__label">{{ category.name }}</span>
          <span v-if="countFor(category.id) > 0" class="todo-category-tabs__count">
            {{ countFor(category.id) }}
          </span>
        </button>
        <button
          v-if="category.id === activeCategoryId"
          type="button"
          class="todo-category-tabs__edit"
          aria-label="Edit category"
          title="Edit category"
          @click="emit('edit', category)"
        >
          <Pencil :size="11" />
        </button>
      </div>
    </div>
    <button
      type="button"
      class="todo-category-tabs__add"
      aria-label="Add category"
      title="Add category"
      @click="emit('create')"
    >
      <Plus :size="14" />
    </button>
  </nav>
</template>

<style>
.todo-category-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.todo-category-tabs__list {
  display: flex;
  flex: 1;
  min-width: 0;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: thin;
}

.todo-category-tabs__item {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 2px;
}

.todo-category-tabs__item--active .todo-category-tabs__tab {
  border-top-right-radius: 8px;
  border-bottom-right-radius: 8px;
}

.todo-category-tabs__tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  padding: 7px 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--muted);
  font: inherit;
  font-size: 12px;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition:
    background 160ms ease,
    border-color 160ms ease,
    color 160ms ease;
}

.todo-category-tabs__tab:hover {
  color: var(--text);
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
}

.todo-category-tabs__tab--active {
  color: var(--text);
  background: rgba(255, 255, 255, 0.14);
  border-color: rgba(255, 255, 255, 0.34);
}

.todo-category-tabs__label {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.todo-category-tabs__count {
  min-width: 18px;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--muted);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.todo-category-tabs__tab--active .todo-category-tabs__count {
  color: var(--text);
  background: rgba(255, 255, 255, 0.12);
}

.todo-category-tabs__edit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  color: var(--muted);
  background: transparent;
  cursor: pointer;
}

.todo-category-tabs__edit:hover {
  color: var(--text);
  background: rgba(255, 255, 255, 0.1);
}

.todo-category-tabs__add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 999px;
  color: var(--muted);
  background: rgba(255, 255, 255, 0.04);
  cursor: pointer;
  transition:
    background 160ms ease,
    border-color 160ms ease,
    color 160ms ease;
}

.todo-category-tabs__add:hover {
  color: var(--text);
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.28);
}
</style>
