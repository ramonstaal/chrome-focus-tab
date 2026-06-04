import {
  createDefaultCategories,
  normalizeCategories,
  resolveCategoryId,
  type TodoCategory,
} from './categories'
import { scheduleSyncPush } from './sync/hooks'

export const CATEGORIES_STORAGE_KEY = 'todoCategories'
const CATEGORIES_LEGACY_KEY = 'focus-new-tab.todoCategories'
export const ACTIVE_CATEGORY_KEY = 'focus-new-tab.activeTodoCategoryId'

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local)
}

function loadFallbackCategories(): TodoCategory[] {
  const raw =
    localStorage.getItem(CATEGORIES_STORAGE_KEY) ?? localStorage.getItem(CATEGORIES_LEGACY_KEY)

  if (!raw) {
    return createDefaultCategories()
  }

  try {
    const parsed = normalizeCategories(JSON.parse(raw))
    return parsed.length > 0 ? parsed : createDefaultCategories()
  } catch {
    return createDefaultCategories()
  }
}

export async function getCategories(): Promise<TodoCategory[]> {
  if (hasChromeStorage()) {
    try {
      const data = await chrome.storage.local.get(CATEGORIES_STORAGE_KEY)
      const stored = data[CATEGORIES_STORAGE_KEY]

      if (Array.isArray(stored) && stored.length > 0) {
        return normalizeCategories(stored)
      }
    } catch {
      // Fall back below.
    }
  }

  return loadFallbackCategories()
}

export async function saveCategories(
  categories: TodoCategory[],
  options: { skipSync?: boolean } = {},
): Promise<void> {
  const normalized =
    normalizeCategories(categories).length > 0 ? normalizeCategories(categories) : createDefaultCategories()

  if (hasChromeStorage()) {
    try {
      await chrome.storage.local.set({ [CATEGORIES_STORAGE_KEY]: normalized })
    } catch {
      // Fall back below.
    }
  }

  localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(normalized))
  localStorage.removeItem(CATEGORIES_LEGACY_KEY)

  if (!options.skipSync) {
    scheduleSyncPush()
  }
}

export function loadActiveCategoryId(): string | null {
  const raw = localStorage.getItem(ACTIVE_CATEGORY_KEY)

  if (!raw) {
    return null
  }

  return raw.length > 0 ? raw : null
}

export function saveActiveCategoryId(categoryId: string): void {
  localStorage.setItem(ACTIVE_CATEGORY_KEY, categoryId)
}

export function resolveActiveCategoryId(
  categories: TodoCategory[],
  preferredId: string | null = loadActiveCategoryId(),
): string {
  return resolveCategoryId(preferredId ?? undefined, categories)
}
