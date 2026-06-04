<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import type { TodoCategory } from '../categories'

const visible = defineModel<boolean>('visible', { required: true })

const props = withDefaults(
  defineProps<{
    mode: 'create' | 'edit'
    category?: TodoCategory | null
    canDelete?: boolean
  }>(),
  {
    category: null,
    canDelete: false,
  },
)

const emit = defineEmits<{
  save: [name: string]
  delete: []
}>()

const nameDraft = ref('')
const inputRef = useTemplateRef<InstanceType<typeof InputText>>('inputRef')

const title = computed(() => (props.mode === 'create' ? 'New category' : 'Edit category'))
const canSave = computed(() => nameDraft.value.trim().length > 0)

const isDirty = computed(() => {
  if (props.mode === 'create') {
    return nameDraft.value.trim().length > 0
  }

  return nameDraft.value.trim() !== (props.category?.name ?? '').trim()
})

watch(visible, async (isOpen) => {
  if (!isOpen) {
    return
  }

  nameDraft.value = props.mode === 'edit' ? (props.category?.name ?? '') : ''
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

  emit('save', nameDraft.value.trim())
  visible.value = false
}

function handleDelete() {
  emit('delete')
  visible.value = false
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    class="category-dialog"
    :header="title"
    :style="{ width: 'min(360px, 92vw)' }"
    :draggable="false"
    :closable="false"
  >
    <label class="category-dialog__field">
      <span>Name</span>
      <InputText
        ref="inputRef"
        v-model="nameDraft"
        class="category-dialog__input backdrop-glass"
        placeholder="Category name"
        @keyup.enter="handleSave"
      />
    </label>
    <div class="category-dialog__actions">
      <button
        v-if="mode === 'edit' && canDelete"
        type="button"
        class="category-dialog__button category-dialog__button--danger"
        @click="handleDelete"
      >
        Delete
      </button>
      <div class="category-dialog__actions-main">
        <button type="button" class="category-dialog__button" @click="handleCancel">Cancel</button>
        <button
          type="button"
          class="category-dialog__button category-dialog__button--primary"
          :disabled="!canSave || (mode === 'edit' && !isDirty)"
          @click="handleSave"
        >
          Save
        </button>
      </div>
    </div>
  </Dialog>
</template>

<style>
.category-dialog.p-dialog {
  border: 1px solid var(--line);
  background: var(--panel-strong);
  box-shadow: var(--shadow);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
}

.category-dialog .p-dialog-header {
  padding: 16px 18px 8px;
  background: transparent;
  color: var(--text);
}

.category-dialog .p-dialog-title {
  font-size: 16px;
  font-weight: 500;
}

.category-dialog .p-dialog-content {
  padding: 0 18px 18px;
  background: transparent;
  color: var(--text);
}

.category-dialog__field {
  display: grid;
  gap: 6px;
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}

.category-dialog__input.p-inputtext {
  padding: 9px 11px;
  font-size: 14px;
  letter-spacing: normal;
  text-transform: none;
  color: var(--text);
}

.category-dialog__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 18px;
}

.category-dialog__actions-main {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-left: auto;
}

.category-dialog__button {
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  padding: 7px 14px;
  color: var(--text);
  background: transparent;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.category-dialog__button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
}

.category-dialog__button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.category-dialog__button--primary {
  color: #0f172a;
  background: rgba(255, 255, 255, 0.88);
  border-color: rgba(255, 255, 255, 0.42);
}

.category-dialog__button--primary:hover:not(:disabled) {
  background: #fff;
}

.category-dialog__button--danger {
  color: #fecaca;
  border-color: rgba(248, 113, 113, 0.35);
}

.category-dialog__button--danger:hover {
  background: rgba(248, 113, 113, 0.12);
}
</style>
