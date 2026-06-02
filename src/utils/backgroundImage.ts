const UHD_MAX_WIDTH = 3840
const UHD_MAX_HEIGHT = 2160
const WEBP_QUALITY = 0.88
const JPEG_QUALITY = 0.88

/** Enough pixels for cover at native DPR, capped at UHD to limit storage use. */
function getTargetMaxDimensions(): { maxWidth: number; maxHeight: number } {
  const dpr = window.devicePixelRatio || 1
  const maxWidth = Math.min(UHD_MAX_WIDTH, Math.ceil(window.screen.width * dpr))
  const maxHeight = Math.min(UHD_MAX_HEIGHT, Math.ceil(window.screen.height * dpr))

  return { maxWidth, maxHeight }
}

function encodeCanvas(canvas: HTMLCanvasElement): string {
  const webp = canvas.toDataURL('image/webp', WEBP_QUALITY)
  if (webp.startsWith('data:image/webp')) {
    return webp
  }

  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}

export function compressBackgroundImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)

      const { maxWidth, maxHeight } = getTargetMaxDimensions()
      const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height)
      const width = Math.max(1, Math.round(image.width * scale))
      const height = Math.max(1, Math.round(image.height * scale))
      const canvas = document.createElement('canvas')

      canvas.width = width
      canvas.height = height

      const context = canvas.getContext('2d')

      if (!context) {
        reject(new Error('Could not prepare image'))
        return
      }

      context.drawImage(image, 0, 0, width, height)
      resolve(encodeCanvas(canvas))
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not load image'))
    }

    image.src = objectUrl
  })
}
