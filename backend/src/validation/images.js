import { z } from 'zod'

export const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/heic-sequence']
export const imageStatuses = [
  'PENDING_UPLOAD',
  'UPLOADED',
  'QUEUED',
  'PROCESSING',
  'ACCEPTED',
  'REJECTED',
  'FAILED',
]

const safeFilename = z.string()
  .trim()
  .min(1)
  .max(255)
  .refine((value) => !value.includes('/') && !value.includes('\\') && value !== '.' && value !== '..', {
    message: 'Filename must not contain a path',
  })

export const createImageSchema = z.object({
  originalFilename: safeFilename,
  mimeType: z.enum(allowedMimeTypes),
  sizeBytes: z.number().int().positive().max(15 * 1024 * 1024),
})

export const updateImageSchema = z.object({
  originalFilename: safeFilename,
}).strict()

export const imageIdSchema = z.object({
  id: z.uuid(),
})

export const listImagesSchema = z.object({
  status: z.enum(imageStatuses).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(1000).optional(),
})
