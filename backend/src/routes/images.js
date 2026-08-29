import { Router } from 'express'
import { rm } from 'node:fs/promises'
import { validate } from '../middleware/validate.js'
import { uploadSingleImage } from '../middleware/upload.js'
import {
  createImage,
  deleteImage,
  getImage,
  getImageFile,
  listImages,
  queueUploadedImage,
  updateImage,
} from '../services/images.js'
import {
  createImageSchema,
  imageIdSchema,
  listImagesSchema,
  updateImageSchema,
} from '../validation/images.js'

export const imagesRouter = Router()

imagesRouter.post('/', validate(createImageSchema), async (request, response) => {
  const image = await createImage(request.validated.body)
  response.status(201).location(`/api/v1/images/${image.id}`).json({ data: image })
})

imagesRouter.get('/', validate(listImagesSchema, 'query'), async (request, response) => {
  response.json(await listImages(request.validated.query))
})

imagesRouter.get('/:id', validate(imageIdSchema, 'params'), async (request, response) => {
  response.json({ data: await getImage(request.validated.params.id) })
})

imagesRouter.get('/:id/file', validate(imageIdSchema, 'params'), async (request, response) => {
  const file = await getImageFile(request.validated.params.id)
  response.type(file.mimeType)
  response.set({
    'Cache-Control': 'private, max-age=3600',
    'Content-Disposition': 'inline',
    'X-Content-Type-Options': 'nosniff',
  })
  response.sendFile(file.path)
})

imagesRouter.post(
  '/:id/upload',
  validate(imageIdSchema, 'params'),
  (request, response, next) => {
    uploadSingleImage(request, response, (error) => {
      if (!error) return next()
      if (request.file?.path) rm(request.file.path, { force: true }).catch(() => {})
      return next(error)
    })
  },
  async (request, response) => {
    const image = await queueUploadedImage(request.validated.params.id, request.file)
    response.status(202).json({ data: image })
  },
)

imagesRouter.patch(
  '/:id',
  validate(imageIdSchema, 'params'),
  validate(updateImageSchema),
  async (request, response) => {
    response.json({ data: await updateImage(request.validated.params.id, request.validated.body) })
  },
)

imagesRouter.delete('/:id', validate(imageIdSchema, 'params'), async (request, response) => {
  await deleteImage(request.validated.params.id)
  response.status(204).end()
})
