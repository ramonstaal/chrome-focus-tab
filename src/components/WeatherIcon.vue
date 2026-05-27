<script setup lang="ts">
import { computed } from 'vue'
import { weatherIconKind } from '../weather'

const props = withDefaults(
  defineProps<{
    code: number
    size?: number
  }>(),
  {
    size: 24,
  },
)

const kind = computed(() => weatherIconKind(props.code))
const dimension = computed(() => `${props.size}px`)
</script>

<template>
  <svg
    class="weather-icon"
    :class="`weather-icon--${kind}`"
    :width="size"
    :height="size"
    :style="{ width: dimension, height: dimension }"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <g v-if="kind === 'clear'" class="weather-icon__sun">
      <circle cx="12" cy="12" r="4.25" stroke="currentColor" stroke-width="1.5" />
      <path
        d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M5.8 5.8l1.4 1.4M16.8 16.8l1.4 1.4M5.8 18.2l1.4-1.4M16.8 7.2l1.4-1.4"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
    </g>

    <g v-else-if="kind === 'partly-cloudy'">
      <circle cx="8.5" cy="9" r="3" stroke="currentColor" stroke-width="1.5" />
      <path
        d="M11.5 7.5a4.5 4.5 0 0 1 7.8 2.2A3.5 3.5 0 0 1 19.5 16h-9.5a3 3 0 0 1-.5-5.9"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </g>

    <g v-else-if="kind === 'cloudy'">
      <path
        d="M7 16.5h10.5a3.5 3.5 0 0 0 .4-7A4.5 4.5 0 0 0 8.5 7.5 3.5 3.5 0 0 0 7 16.5Z"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </g>

    <g v-else-if="kind === 'fog'">
      <path
        d="M7.5 11.5h10a3 3 0 0 0 .3-6A4 4 0 0 0 8.5 6.5 2.8 2.8 0 0 0 7.5 11.5Z"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path d="M5 15.5h14M6 18.5h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </g>

    <g v-else-if="kind === 'drizzle'">
      <path
        d="M7 15.5h10.5a3.5 3.5 0 0 0 .4-7A4.5 4.5 0 0 0 8.5 6.5 3.5 3.5 0 0 0 7 15.5Z"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M9 18.5v2M12 17.5v2M15 18.5v2"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
    </g>

    <g v-else-if="kind === 'rain' || kind === 'showers'">
      <path
        d="M7 14.5h10.5a3.5 3.5 0 0 0 .4-7A4.5 4.5 0 0 0 8.5 5.5 3.5 3.5 0 0 0 7 14.5Z"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M8.5 17.5l-1 2.5M12 17l-1 3M15.5 17.5l-1 2.5"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
    </g>

    <g v-else-if="kind === 'snow'">
      <path
        d="M7 14.5h10.5a3.5 3.5 0 0 0 .4-7A4.5 4.5 0 0 0 8.5 5.5 3.5 3.5 0 0 0 7 14.5Z"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M9 18.5h.01M12 17.5h.01M15 18.5h.01"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
      />
    </g>

    <g v-else-if="kind === 'thunderstorm'">
      <path
        d="M7 13.5h10.5a3.5 3.5 0 0 0 .4-7A4.5 4.5 0 0 0 8.5 4.5 3.5 3.5 0 0 0 7 13.5Z"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M13.5 15.5 11 20h2.5l-1.5 3.5"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </g>

    <g v-else>
      <path
        d="M7 16.5h10.5a3.5 3.5 0 0 0 .4-7A4.5 4.5 0 0 0 8.5 7.5 3.5 3.5 0 0 0 7 16.5Z"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </g>
  </svg>
</template>
