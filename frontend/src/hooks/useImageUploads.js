import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { processImageUpload } from '../services/imageApi.js'
import { getFileExtension, validateImage } from '../utils/imageValidation.js'

function createUpload(file) {
  return {
    id: crypto.randomUUID(),
    file,
    fileName: file.name,
    extension: getFileExtension(file.name) || 'file',
    previewUrl: URL.createObjectURL(file),
    status: 'validating',
    progress: 4,
    rejectionReasons: [],
    dimensions: null,
    serverId: null,
  }
}

function useImageUploads() {
  const [uploads, setUploads] = useState([])
  const uploadsRef = useRef([])
  const controllersRef = useRef(new Map())

  useEffect(() => { uploadsRef.current = uploads }, [uploads])

  useEffect(() => () => {
    controllersRef.current.forEach((controller) => controller.abort())
    uploadsRef.current.forEach((upload) => URL.revokeObjectURL(upload.previewUrl))
  }, [])

  const updateUpload = useCallback((id, changes) => {
    setUploads((current) => current.map((upload) => (
      upload.id === id ? { ...upload, ...changes } : upload
    )))
  }, [])

  const processUpload = useCallback(async (id, file) => {
    const controller = new AbortController()
    controllersRef.current.set(id, controller)

    try {
      const result = await processImageUpload({
        file,
        signal: controller.signal,
        onProgress: (progress) => updateUpload(id, { progress }),
        onStage: (status) => updateUpload(id, {
          status,
          progress: status === 'processing' ? 100 : 8,
        }),
      })
      updateUpload(id, {
        status: result.status,
        progress: 100,
        serverId: result.id,
        rejectionReasons: result.rejectionReasons,
      })
    } catch (error) {
      if (error.name !== 'AbortError') {
        updateUpload(id, {
          status: 'failed',
          rejectionReasons: [error.message || 'Upload failed. Check your connection and try again.'],
        })
      }
    } finally {
      controllersRef.current.delete(id)
    }
  }, [updateUpload])

  const addFiles = useCallback(async (files) => {
    const existingSignatures = new Set(
      uploadsRef.current.map(({ file }) => `${file.name}:${file.size}:${file.lastModified}`),
    )
    const newUploads = files.map(createUpload)
    setUploads((current) => [...newUploads, ...current])

    await Promise.all(newUploads.map(async (upload) => {
      const signature = `${upload.file.name}:${upload.file.size}:${upload.file.lastModified}`
      if (existingSignatures.has(signature)) {
        updateUpload(upload.id, {
          status: 'rejected',
          progress: 0,
          rejectionReasons: ['This exact file has already been selected.'],
        })
        return
      }
      existingSignatures.add(signature)

      const result = await validateImage(upload.file)
      if (!result.valid) {
        updateUpload(upload.id, {
          status: 'rejected',
          progress: 0,
          dimensions: result.dimensions,
          rejectionReasons: result.reasons,
        })
        return
      }

      updateUpload(upload.id, { status: 'ready', progress: 7, dimensions: result.dimensions })
      await processUpload(upload.id, upload.file)
    }))
  }, [processUpload, updateUpload])

  const removeUpload = useCallback((id) => {
    controllersRef.current.get(id)?.abort()
    controllersRef.current.delete(id)
    setUploads((current) => {
      const target = current.find((upload) => upload.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return current.filter((upload) => upload.id !== id)
    })
  }, [])

  const retryUpload = useCallback((id) => {
    const upload = uploadsRef.current.find((candidate) => candidate.id === id)
    if (!upload) return
    updateUpload(id, { status: 'ready', progress: 7, rejectionReasons: [] })
    processUpload(id, upload.file)
  }, [processUpload, updateUpload])

  const clearByStatus = useCallback((statuses) => {
    setUploads((current) => {
      const remaining = []
      current.forEach((upload) => {
        if (statuses.includes(upload.status)) URL.revokeObjectURL(upload.previewUrl)
        else remaining.push(upload)
      })
      return remaining
    })
  }, [])

  const groupedUploads = useMemo(() => ({
    activeUploads: uploads.filter((upload) => ['validating', 'ready', 'uploading', 'processing'].includes(upload.status)),
    acceptedUploads: uploads.filter((upload) => upload.status === 'accepted'),
    rejectedUploads: uploads.filter((upload) => ['rejected', 'failed'].includes(upload.status)),
  }), [uploads])

  return {
    ...groupedUploads,
    addFiles,
    removeUpload,
    retryUpload,
    clearAccepted: () => clearByStatus(['accepted']),
    clearRejected: () => clearByStatus(['rejected', 'failed']),
  }
}

export default useImageUploads
