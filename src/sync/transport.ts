import type { SyncBundle, SyncConfig, SyncPullResult } from './types'

function syncUrl(apiUrl: string): string {
  const base = apiUrl.replace(/\/$/, '')
  return `${base}/sync`
}

export async function pullRemoteBundle(config: SyncConfig): Promise<SyncPullResult> {
  const response = await fetch(syncUrl(config.apiUrl), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.token}`,
    },
  })

  if (response.status === 401) {
    throw new Error('Sync token rejected. Check your token in Settings.')
  }

  if (!response.ok) {
    throw new Error(`Sync pull failed (${response.status})`)
  }

  const etagHeader = response.headers.get('ETag')
  const etag = etagHeader ? etagHeader.replace(/^"|"$/g, '') : null
  const text = await response.text()

  if (!text || text === '{"bundle":null,"etag":null}') {
    return { bundle: null, etag }
  }

  try {
    const parsed = JSON.parse(text) as SyncBundle
    if (parsed.version !== 1 || typeof parsed.updatedAt !== 'number') {
      return { bundle: null, etag }
    }
    return { bundle: parsed, etag }
  } catch {
    return { bundle: null, etag }
  }
}

export async function pushRemoteBundle(
  config: SyncConfig,
  bundle: SyncBundle,
): Promise<{ etag: string | null }> {
  const response = await fetch(syncUrl(config.apiUrl), {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
      ...(config.etag ? { 'If-Match': `"${config.etag}"` } : {}),
    },
    body: JSON.stringify(bundle),
  })

  if (response.status === 401) {
    throw new Error('Sync token rejected. Check your token in Settings.')
  }

  if (response.status === 409) {
    throw new Error('Sync conflict — another device saved more recently. Pulling latest.')
  }

  if (!response.ok) {
    throw new Error(`Sync push failed (${response.status})`)
  }

  const etagHeader = response.headers.get('ETag')
  const etag = etagHeader ? etagHeader.replace(/^"|"$/g, '') : String(bundle.updatedAt)

  return { etag }
}
