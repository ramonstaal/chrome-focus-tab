export interface TodoCategory {
  id: string
  name: string
  createdAt: number
}

export const DEFAULT_CATEGORY_ID = 'default-general'

export function createDefaultCategories(): TodoCategory[] {
  return [
    {
      id: DEFAULT_CATEGORY_ID,
      name: 'General',
      createdAt: Date.now(),
    },
  ]
}

export function createCategory(name: string): TodoCategory {
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    createdAt: Date.now(),
  }
}

export function normalizeCategory(raw: unknown): TodoCategory {
  const value = (raw ?? {}) as Record<string, unknown>

  return {
    id: typeof value.id === 'string' && value.id.length > 0 ? value.id : crypto.randomUUID(),
    name: typeof value.name === 'string' && value.name.trim().length > 0 ? value.name.trim() : 'Untitled',
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
  }
}

export function normalizeCategories(raw: unknown): TodoCategory[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw.map(normalizeCategory)
}

export function resolveCategoryId(
  categoryId: string | undefined,
  categories: TodoCategory[],
): string {
  if (categoryId && categories.some((category) => category.id === categoryId)) {
    return categoryId
  }

  return categories[0]?.id ?? DEFAULT_CATEGORY_ID
}
