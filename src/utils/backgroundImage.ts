const MAX_WIDTH = 1920
const MAX_HEIGHT = 1080
const JPEG_QUALITY = 0.82

export function compressBackgroundImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)

      const scale = Math.min(1, MAX_WIDTH / image.width, MAX_HEIGHT / image.height)
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
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY))
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not load image'))
    }

    image.src = objectUrl
  })
}
