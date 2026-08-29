const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'heic'])
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/heic', 'image/heic-sequence'])

export const MIN_FILE_SIZE = 20 * 1024
export const MAX_FILE_SIZE = 15 * 1024 * 1024
export const MIN_IMAGE_DIMENSION = 600

export function getFileExtension(fileName) {
  return fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : ''
}

function readDimensions(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      const dimensions = { width: image.naturalWidth, height: image.naturalHeight }
      URL.revokeObjectURL(url)
      resolve(dimensions)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('The browser could not read this image.'))
    }
    image.src = url
  })
}

export async function validateImage(file) {
  const reasons = []
  const extension = getFileExtension(file.name)
  const extensionAllowed = ALLOWED_EXTENSIONS.has(extension)
  const mimeAllowed = !file.type || ALLOWED_MIME_TYPES.has(file.type.toLowerCase())

  if (!extensionAllowed || !mimeAllowed) reasons.push('Unsupported format. Please use a JPG, PNG, or HEIC image.')
  if (file.size < MIN_FILE_SIZE) reasons.push('The image must be at least 20 KB.')
  if (file.size > MAX_FILE_SIZE) reasons.push('The image must be no larger than 15 MB.')

  let dimensions = null
  const browserReadableFormat = extension === 'jpg' || extension === 'jpeg' || extension === 'png'

  if (extensionAllowed && mimeAllowed && browserReadableFormat) {
    try {
      dimensions = await readDimensions(file)
      if (dimensions.width < MIN_IMAGE_DIMENSION || dimensions.height < MIN_IMAGE_DIMENSION) {
        reasons.push('Image resolution must be at least 600 × 600 pixels.')
      }
    } catch (error) {
      reasons.push(error.message)
    }
  }

  return { valid: reasons.length === 0, reasons, dimensions, extension }
}
