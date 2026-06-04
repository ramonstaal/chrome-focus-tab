export interface Env {
  SYNC_KV: KVNamespace
}

const CORS_ORIGINS = ['http://127.0.0.1:5173', 'http://localhost:5173']

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('Origin') ?? ''
  const allowed = CORS_ORIGINS.includes(origin) ? origin : CORS_ORIGINS[0]

  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, If-Match',
    'Access-Control-Expose-Headers': 'ETag',
  }
}

function jsonResponse(body: unknown, status: number, request: Request, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(request),
      ...extraHeaders,
    },
  })
}

function extractToken(request: Request): string | null {
  const header = request.headers.get('Authorization')

  if (!header?.startsWith('Bearer ')) {
    return null
  }

  const token = header.slice('Bearer '.length).trim()

  if (!token || token.length > 128) {
    return null
  }

  return token
}

function kvKey(token: string): string {
  return `sync:${token}`
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) })
    }

    if (url.pathname !== '/sync') {
      return jsonResponse({ error: 'Not found' }, 404, request)
    }

    const token = extractToken(request)

    if (!token) {
      return jsonResponse({ error: 'Unauthorized' }, 401, request)
    }

    const key = kvKey(token)

    if (request.method === 'GET') {
      const entry = await env.SYNC_KV.getWithMetadata<{ updatedAt?: number }>(key)

      if (!entry.value) {
        return jsonResponse({ bundle: null, etag: null }, 200, request)
      }

      const etag = entry.metadata?.updatedAt?.toString() ?? '0'

      return new Response(entry.value, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ETag: `"${etag}"`,
          ...corsHeaders(request),
        },
      })
    }

    if (request.method === 'PUT') {
      const ifMatch = request.headers.get('If-Match')
      const existing = await env.SYNC_KV.getWithMetadata<{ updatedAt?: number }>(key)

      if (ifMatch && existing.metadata?.updatedAt) {
        const expected = ifMatch.replace(/^"|"$/g, '')

        if (expected !== String(existing.metadata.updatedAt)) {
          return jsonResponse({ error: 'Conflict' }, 409, request, {
            ETag: `"${existing.metadata.updatedAt}"`,
          })
        }
      }

      const body = await request.text()

      if (!body) {
        return jsonResponse({ error: 'Empty body' }, 400, request)
      }

      const updatedAt = Date.now()

      await env.SYNC_KV.put(key, body, {
        metadata: { updatedAt },
      })

      return jsonResponse({ ok: true, updatedAt }, 200, request, {
        ETag: `"${updatedAt}"`,
      })
    }

    return jsonResponse({ error: 'Method not allowed' }, 405, request)
  },
}
