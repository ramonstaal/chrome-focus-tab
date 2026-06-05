<script setup lang="ts">
import { computed } from 'vue'
import SelectButton from 'primevue/selectbutton'
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

const selectedCategoryId = computed({
  get: () => props.activeCategoryId,
  set: (categoryId: string) => emit('select', categoryId),
})

const activeCategory = computed(
  () => props.categories.find((category) => category.id === props.activeCategoryId) ?? null,
)

function countFor(categoryId: string): number {
  return props.todoCounts[categoryId] ?? 0
}
</script>

<template>
  <nav class="todo-category-tabs" aria-label="Todo categories">
    <SelectButton
      v-model="selectedCategoryId"
      :options="categories"
      option-label="name"
      option-value="id"
      data-key="id"
      class="todo-category-tabs__select"
      aria-label="Todo categories"
    >
      <template #option="slotProps">
        <span
          class="todo-category-tabs__option"
          @dblclick.stop="emit('edit', slotProps.option)"
        >
          <span class="todo-category-tabs__label">{{ slotProps.option.name }}</span>
          <span v-if="countFor(slotProps.option.id) > 0" class="todo-category-tabs__count">
            {{ countFor(slotProps.option.id) }}
          </span>
        </span>
      </template>
    </SelectButton>
    <button
      v-if="activeCategory"
      type="button"
      class="todo-category-tabs__edit"
      aria-label="Edit category"
      title="Edit category"
      @click="emit('edit', activeCategory)"
    >
      <Pencil :size="11" />
    </button>
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
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}

.todo-category-tabs__select {
  display: inline-flex;
  flex: 0 1 auto;
  max-width: 100%;
  overflow-x: auto;
  border-radius: 999px;
  background: transparent;
  border: 0;
  box-shadow: none;
  scrollbar-width: thin;
}

.todo-category-tabs__select.p-selectbutton .p-togglebutton:first-child {
  border-start-start-radius: 999px;
  border-end-start-radius: 999px;
}

.todo-category-tabs__select.p-selectbutton .p-togglebutton:last-child {
  border-start-end-radius: 999px;
  border-end-end-radius: 999px;
}

.todo-category-tabs__select.p-selectbutton .p-togglebutton:first-child .p-togglebutton-content {
  border-start-start-radius: 999px;
  border-end-start-radius: 999px;
}

.todo-category-tabs__select.p-selectbutton .p-togglebutton:last-child .p-togglebutton-content {
  border-start-end-radius: 999px;
  border-end-end-radius: 999px;
}

.todo-category-tabs__select .p-togglebutton .p-togglebutton-content {
  background: transparent;
}

.todo-category-tabs__select .p-togglebutton {
  flex: 0 0 auto;
  color: var(--muted);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  box-shadow:
    inset 0 1px 0 var(--glass-highlight),
    var(--glass-shadow);
  transition:
    background 160ms ease,
    border-color 160ms ease,
    color 160ms ease,
    box-shadow 160ms ease,
    -webkit-backdrop-filter 160ms ease,
    backdrop-filter 160ms ease;
}

.todo-category-tabs__select .p-togglebutton:not(.p-togglebutton-checked):not([data-p-checked='true']):hover {
  color: var(--text);
  background: var(--glass-bg-hover);
  border-color: var(--glass-border-hover);
  box-shadow:
    inset 0 1px 0 var(--glass-highlight-hover),
    var(--glass-shadow-hover);
}

.todo-category-tabs__select .p-togglebutton.p-togglebutton-checked,
.todo-category-tabs__select .p-togglebutton[data-p-checked='true'],
.todo-category-tabs__select .p-togglebutton.p-togglebutton-checked:hover,
.todo-category-tabs__select .p-togglebutton[data-p-checked='true']:hover {
  color: var(--text);
  background: var(--glass-selected-bg);
  border-color: var(--glass-selected-border);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  box-shadow:
    inset 0 1px 0 var(--glass-highlight-hover),
    var(--glass-shadow);
}

.todo-category-tabs__option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
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

.todo-category-tabs__select .p-togglebutton-checked .todo-category-tabs__count,
.todo-category-tabs__select .p-togglebutton[data-p-checked='true'] .todo-category-tabs__count {
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
