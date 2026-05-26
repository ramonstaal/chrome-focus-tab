<script setup lang="ts">
import { computed } from 'vue'
import { Pause } from '@lucide/vue'
import { formatDuration } from '../utils/duration'

const props = withDefaults(
  defineProps<{
    remainingMs: number
    endsAtMs?: number
    size?: 'hero' | 'panel' | 'compact'
    paused?: boolean
    label?: string
    tag?: 'h1' | 'h2' | 'p' | 'span'
  }>(),
  {
    size: 'panel',
    paused: false,
    tag: 'span',
  },
)

const display = computed(() => formatDuration(props.remainingMs))

const endTimeDisplay = computed(() => {
  const endsAt = props.endsAtMs

  if (!endsAt || endsAt <= 0) {
    return ''
  }

  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(endsAt)
})
</script>

<template>
  <div :class="['countdown-clock', `countdown-clock--${size}`]">
    <div class="countdown-clock__row">
      <Pause
        v-if="paused"
        class="countdown-clock__pause-icon"
        :size="size === 'hero' ? 28 : size === 'panel' ? 18 : 14"
        aria-hidden="true"
      />
      <component :is="tag" class="countdown-clock__time">{{ display }}</component>
    </div>
    <p v-if="endTimeDisplay" class="countdown-clock__end">{{ endTimeDisplay }}</p>
    <p v-if="label" class="countdown-clock__label">{{ label }}</p>
  </div>
</template>
