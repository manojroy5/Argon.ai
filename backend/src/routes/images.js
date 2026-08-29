import { Router } from 'express'
import { validate } from '../middleware/validate.js'
import {
  createImage,
  deleteImage,
  getImage,
  listImages,
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
