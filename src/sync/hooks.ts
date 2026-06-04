let debouncedPush: ((delay?: number) => void) | null = null
let immediatePush: (() => void) | null = null

export function registerSyncHooks(hooks: {
  schedulePush: (delay?: number) => void
  scheduleImmediatePush: () => void
}): void {
  debouncedPush = hooks.schedulePush
  immediatePush = hooks.scheduleImmediatePush
}

export function scheduleSyncPush(delay?: number): void {
  debouncedPush?.(delay)
}

export function scheduleImmediateSyncPush(): void {
  immediatePush?.()
}
