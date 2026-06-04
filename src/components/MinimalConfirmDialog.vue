<script setup lang="ts">
import { nextTick } from 'vue'
import Dialog from 'primevue/dialog'

const visible = defineModel<boolean>('visible', { required: true })

withDefaults(
  defineProps<{
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
  }>(),
  {
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
  },
)

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

function handleCancel() {
  emit('cancel')
  void nextTick(() => {
    visible.value = false
  })
}

function handleConfirm() {
  emit('confirm')
  void nextTick(() => {
    visible.value = false
  })
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    class="minimal-confirm-dialog"
    :header="title"
    :style="{ width: 'min(320px, 90vw)' }"
    :draggable="false"
    :closable="false"
  >
    <p class="minimal-confirm-dialog__message">{{ message }}</p>
    <div class="minimal-confirm-dialog__actions">
      <button type="button" class="minimal-confirm-dialog__button" @click="handleCancel">
        {{ cancelLabel }}
      </button>
      <button
        type="button"
        class="minimal-confirm-dialog__button minimal-confirm-dialog__button--primary"
        @click="handleConfirm"
      >
        {{ confirmLabel }}
      </button>
    </div>
  </Dialog>
</template>

<style>
.minimal-confirm-dialog__message {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.5;
}

.minimal-confirm-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 18px;
}

.minimal-confirm-dialog__button {
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  padding: 7px 14px;
  color: var(--text);
  background: transparent;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.minimal-confirm-dialog__button:hover {
  background: rgba(255, 255, 255, 0.08);
}

.minimal-confirm-dialog__button--primary {
  color: #0f172a;
  background: rgba(255, 255, 255, 0.88);
  border-color: rgba(255, 255, 255, 0.42);
}

.minimal-confirm-dialog__button--primary:hover {
  background: #fff;
}

.minimal-confirm-dialog.p-dialog {
  border: 1px solid var(--line);
  background: var(--panel-strong);
  box-shadow: var(--shadow);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
}

.minimal-confirm-dialog .p-dialog-header {
  padding: 16px 18px 8px;
  background: transparent;
  color: var(--text);
}

.minimal-confirm-dialog .p-dialog-title {
  font-size: 16px;
  font-weight: 500;
}

.minimal-confirm-dialog .p-dialog-content {
  padding: 0 18px 18px;
  background: transparent;
  color: var(--text);
}
</style>
