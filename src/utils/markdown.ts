import { marked } from 'marked'

marked.setOptions({
  gfm: true,
  breaks: true,
})

/**
 * Render trusted markdown to HTML and apply a conservative sanitization pass.
 *
 * Notes are user-authored content stored locally. We still defensively strip
 * script tags, event handlers, and `javascript:` URLs in case data is imported
 * from elsewhere later.
 */
export function renderMarkdown(source: string): string {
  if (!source.trim()) {
    return ''
  }

  const raw = marked.parse(source, { async: false }) as string
  return sanitize(raw)
}

function sanitize(html: string): string {
  if (typeof window === 'undefined' || typeof window.DOMParser === 'undefined') {
    return html
  }

  const doc = new DOMParser().parseFromString(html, 'text/html')
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT)
  const toRemove: Element[] = []

  let node = walker.nextNode() as Element | null
  while (node) {
    const tag = node.tagName.toLowerCase()

    if (tag === 'script' || tag === 'style' || tag === 'iframe' || tag === 'object' || tag === 'embed') {
      toRemove.push(node)
    } else {
      for (const attr of Array.from(node.attributes)) {
        const name = attr.name.toLowerCase()
        const value = attr.value.trim().toLowerCase()

        if (name.startsWith('on')) {
          node.removeAttribute(attr.name)
          continue
        }

        if ((name === 'href' || name === 'src') && value.startsWith('javascript:')) {
          node.removeAttribute(attr.name)
        }
      }

      if (tag === 'a') {
        node.setAttribute('target', '_blank')
        node.setAttribute('rel', 'noreferrer noopener')
      }
    }

    node = walker.nextNode() as Element | null
  }

  for (const el of toRemove) {
    el.remove()
  }

  return doc.body.innerHTML
}
