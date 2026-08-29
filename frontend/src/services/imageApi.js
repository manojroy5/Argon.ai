const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'
const TERMINAL_STATUSES = new Set(['ACCEPTED', 'REJECTED', 'FAILED'])

function wait(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      window.clearTimeout(timer)
      reject(new DOMException('Upload cancelled', 'AbortError'))
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, milliseconds)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options)
  if (response.ok) return response.status === 204 ? null : response.json()

  let message = 'The server could not complete the request.'
  try {
    const payload = await response.json()
    message = payload.error?.message || message
  } catch {
    // Keep the safe fallback for non-JSON proxy errors.
  }
  throw new Error(message)
}

function getDeclaredMimeType(file) {
  if (file.type) return file.type.toLowerCase()
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension === 'png') return 'image/png'
  if (extension === 'heic') return 'image/heic'
  return 'image/jpeg'
}

export async function processImageUpload({ file, signal, onProgress, onStage }) {
  onStage('uploading')
  onProgress(8)

  const created = await apiRequest('/images', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      originalFilename: file.name,
      mimeType: getDeclaredMimeType(file),
      sizeBytes: file.size,
    }),
    signal,
  })
  const imageId = created.data.id
  onProgress(20)

  const formData = new FormData()
  formData.append('file', file)
  await apiRequest(`/images/${imageId}/upload`, {
    method: 'POST',
    body: formData,
    signal,
  })
  onProgress(55)
  onStage('processing')

  let image
  while (!signal?.aborted) {
    const result = await apiRequest(`/images/${imageId}`, { signal })
    image = result.data
    if (TERMINAL_STATUSES.has(image.status)) break
    onProgress(image.status === 'PROCESSING' ? 82 : 65)
    await wait(700, signal)
  }

  return {
    id: image.id,
    status: image.status.toLowerCase(),
    rejectionReasons: image.rejections?.map(({ message }) => message) || [],
  }
}
