<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue'
import { Check } from '@lucide/vue'
import { STATUS_LABEL, TASK_STATUSES, type TaskStatus } from '../todos'

const props = withDefaults(
  defineProps<{
    status: TaskStatus
    size?: 'sm' | 'md'
    ariaLabel?: string
  }>(),
  { size: 'md' },
)

const emit = defineEmits<{
  change: [status: TaskStatus]
}>()

const open = ref(false)
const chipRef = ref<HTMLButtonElement | null>(null)
const menuRef = ref<HTMLUListElement | null>(null)
const menuStyle = ref<{ top: string; left: string; minWidth: string }>({
  top: '0px',
  left: '0px',
  minWidth: '0px',
})

function updateMenuPosition() {
  const chip = chipRef.value

  if (!chip) {
    return
  }

  const rect = chip.getBoundingClientRect()
  const minWidth = Math.max(rect.width, 148)
  const viewportWidth = window.innerWidth
  const left = Math.min(rect.left, viewportWidth - minWidth - 8)

  menuStyle.value = {
    top: `${rect.bottom + 4}px`,
    left: `${Math.max(8, left)}px`,
    minWidth: `${minWidth}px`,
  }
}

function toggle(event: MouseEvent) {
  event.stopPropagation()
  open.value = !open.value
}

function selectStatus(status: TaskStatus, event: MouseEvent) {
  event.stopPropagation()
  open.value = false

  if (status !== props.status) {
    emit('change', status)
  }
}

function handleDocumentClick(event: MouseEvent) {
  const target = event.target as Node | null

  if (!target) {
    return
  }

  if (chipRef.value?.contains(target) || menuRef.value?.contains(target)) {
    return
  }

  open.value = false
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    open.value = false
  }
}

function handleViewportChange() {
  if (open.value) {
    updateMenuPosition()
  }
}

watch(open, async (isOpen) => {
  if (isOpen) {
    await nextTick()
    updateMenuPosition()
    document.addEventListener('click', handleDocumentClick)
    document.addEventListener('keydown', handleKeydown)
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)
  } else {
    document.removeEventListener('click', handleDocumentClick)
    document.removeEventListener('keydown', handleKeydown)
    window.removeEventListener('resize', handleViewportChange)
    window.removeEventListener('scroll', handleViewportChange, true)
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
  document.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', handleViewportChange)
  window.removeEventListener('scroll', handleViewportChange, true)
})
</script>

<template>
  <div class="task-status" :class="[`task-status--${size}`, { 'task-status--open-menu': open }]">
    <button
      ref="chipRef"
      type="button"
      class="task-status__chip"
      :class="`task-status__chip--${status}`"
      :aria-haspopup="true"
      :aria-expanded="open"
      :aria-label="ariaLabel ?? `Status: ${STATUS_LABEL[status]}. Change status`"
      @click="toggle"
    >
      <span class="task-status__dot" :class="`task-status__dot--${status}`" />
      <span class="task-status__label">{{ STATUS_LABEL[status] }}</span>
    </button>
    <Teleport to="body">
      <ul
        v-if="open"
        ref="menuRef"
        class="task-status__menu"
        role="menu"
        :style="menuStyle"
      >
        <li v-for="value in TASK_STATUSES" :key="value" role="none">
          <button
            type="button"
            role="menuitemradio"
            :aria-checked="value === status"
            class="task-status__option"
            :class="{ 'task-status__option--active': value === status }"
            @click="(event) => selectStatus(value, event)"
          >
            <span class="task-status__dot" :class="`task-status__dot--${value}`" />
            <span class="task-status__option-label">{{ STATUS_LABEL[value] }}</span>
            <Check v-if="value === status" class="task-status__check" :size="13" />
          </button>
        </li>
      </ul>
    </Teleport>
  </div>
</template>

<style>
.task-status {
  position: relative;
  display: inline-flex;
}

.task-status__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 8px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: var(--todo-card-bg);
  color: var(--text);
  font: inherit;
  font-size: 11px;
  letter-spacing: 0.04em;
  line-height: 1;
  cursor: pointer;
  transition:
    background 160ms ease,
    border-color 160ms ease,
    color 160ms ease;
  white-space: nowrap;
}

.task-status__chip:hover,
.task-status--open-menu .task-status__chip {
  background: var(--todo-card-bg-hover);
  border-color: rgba(255, 255, 255, 0.32);
}

.task-status--sm .task-status__chip {
  padding: 2px 8px 2px 6px;
  font-size: 10px;
  gap: 5px;
}

.task-status__dot {
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.32);
}

.task-status--sm .task-status__dot {
  width: 7px;
  height: 7px;
}

.task-status__dot--open {
  background: var(--todo-card-bg-strong);
}

.task-status__dot--busy {
  background: #93c5fd;
}

.task-status__dot--on-hold {
  background: #fde047;
}

.task-status__dot--done {
  background: #86efac;
}

.task-status__chip--open {
  color: rgba(255, 255, 255, 0.78);
}

.task-status__chip--busy {
  color: #cfe2ff;
  background: rgba(96, 165, 250, 0.14);
  border-color: rgba(96, 165, 250, 0.32);
}

.task-status__chip--on-hold {
  color: #fef3c7;
  background: rgba(250, 204, 21, 0.14);
  border-color: rgba(250, 204, 21, 0.32);
}

.task-status__chip--done {
  color: #bbf7d0;
  background: rgba(74, 222, 128, 0.14);
  border-color: rgba(74, 222, 128, 0.32);
}

.task-status__menu {
  position: fixed;
  z-index: 2000;
  min-width: 148px;
  margin: 0;
  padding: 4px;
  list-style: none;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 12px;
  background: var(--panel-strong);
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.task-status__option {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 6px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  transition: background 120ms ease;
}

.task-status__option:hover {
  background: var(--todo-card-bg-hover);
}

.task-status__option--active {
  background: var(--todo-card-bg-hover);
}

.task-status__option-label {
  flex: 1;
}

.task-status__check {
  flex: 0 0 auto;
  color: var(--muted);
}
</style>
