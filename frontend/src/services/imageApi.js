function wait(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, milliseconds)
    signal?.addEventListener('abort', () => {
      window.clearTimeout(timer)
      reject(new DOMException('Upload cancelled', 'AbortError'))
    }, { once: true })
  })
}

// Replace this mock with presigned-S3 upload and status API calls when the backend is ready.
export async function processImageUpload({ signal, onProgress, onStage }) {
  onStage('uploading')
  for (const progress of [12, 31, 53, 76, 100]) {
    await wait(180, signal)
    onProgress(progress)
  }

  onStage('processing')
  await wait(900, signal)

  return { id: crypto.randomUUID(), status: 'accepted', rejectionReasons: [] }
}
