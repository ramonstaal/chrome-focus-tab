/** Deployed Worker URL — override with VITE_SYNC_API_URL at build time. */
export const DEFAULT_SYNC_API_URL =
  import.meta.env.VITE_SYNC_API_URL ?? 'https://focus-todo-sync.workers.dev'

export const SYNC_LOCAL_UPDATED_AT_KEY = 'syncLocalUpdatedAt'
