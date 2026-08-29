import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { ApiError } from '../lib/api-error.js'
import { prisma } from '../lib/database.js'
import { commitTemporaryFile, removeStoredFile, resolveStorageKey } from '../lib/storage.js'

const MIME_TO_FORMAT = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/heic': 'HEIC',
  'image/heic-sequence': 'HEIC',
}

const FORMAT_EXTENSIONS = {
  JPEG: new Set(['jpg', 'jpeg']),
  PNG: new Set(['png']),
  HEIC: new Set(['heic']),
}

function getExtension(filename) {
  const lastDot = filename.lastIndexOf('.')
  return lastDot === -1 ? '' : filename.slice(lastDot + 1).toLowerCase()
}

function assertExtensionMatches(filename, format) {
  if (!FORMAT_EXTENSIONS[format].has(getExtension(filename))) {
    throw new ApiError(422, 'FORMAT_MISMATCH', 'File extension does not match its declared MIME type')
  }
}

function encodeCursor(image) {
  return Buffer.from(JSON.stringify({
    createdAt: image.createdAt.toISOString(),
    id: image.id,
  })).toString('base64url')
}

function decodeCursor(cursor) {
  if (!cursor) return null

  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
    if (typeof decoded.id !== 'string' || Number.isNaN(Date.parse(decoded.createdAt))) throw new Error()
    return { id: decoded.id, createdAt: new Date(decoded.createdAt) }
  } catch {
    throw new ApiError(422, 'INVALID_CURSOR', 'Pagination cursor is invalid')
  }
}

export function serializeImage(image, { includeEvents = false } = {}) {
  const serialized = {
    ...image,
    sizeBytes: Number(image.sizeBytes),
  }

  if (includeEvents && serialized.events) {
    serialized.events = serialized.events.map((event) => ({ ...event, id: event.id.toString() }))
  } else {
    delete serialized.events
  }

  return serialized
}

export async function createImage(input) {
  const format = MIME_TO_FORMAT[input.mimeType]
  assertExtensionMatches(input.originalFilename, format)
  const imageId = randomUUID()
  const storageKey = `originals/${imageId}.upload`

  return prisma.$transaction(async (transaction) => {
    const image = await transaction.imageAsset.create({
      data: {
        id: imageId,
        originalFilename: input.originalFilename,
        mimeType: input.mimeType,
        format,
        sizeBytes: BigInt(input.sizeBytes),
        storageKey,
      },
      include: { rejections: true },
    })

    await transaction.imageStatusEvent.create({
      data: { imageId: image.id, status: image.status, message: 'Upload metadata created' },
    })

    return serializeImage(image)
  })
}

export async function queueUploadedImage(id, file) {
  if (!file) throw new ApiError(400, 'FILE_REQUIRED', 'Multipart field "file" is required')

  const existing = await prisma.imageAsset.findFirst({ where: { id, deletedAt: null } })
  if (!existing) {
    await rm(file.path, { force: true })
    throw new ApiError(404, 'IMAGE_NOT_FOUND', 'Image was not found')
  }
  if (existing.status !== 'PENDING_UPLOAD') {
    await rm(file.path, { force: true })
    throw new ApiError(409, 'UPLOAD_ALREADY_COMPLETED', 'This image is no longer waiting for a file')
  }
  if (BigInt(file.size) !== existing.sizeBytes) {
    await rm(file.path, { force: true })
    throw new ApiError(422, 'SIZE_MISMATCH', 'Uploaded bytes do not match the declared file size')
  }

  await commitTemporaryFile(file.path, existing.storageKey)

  try {
    const image = await prisma.$transaction(async (transaction) => {
      const claimed = await transaction.imageAsset.updateMany({
        where: { id, status: 'PENDING_UPLOAD', deletedAt: null },
        data: { status: 'QUEUED', uploadedAt: new Date() },
      })
      if (claimed.count !== 1) {
        throw new ApiError(409, 'UPLOAD_ALREADY_COMPLETED', 'This image is no longer waiting for a file')
      }
      await transaction.imageStatusEvent.createMany({
        data: [
          { imageId: id, status: 'UPLOADED', message: 'File stored securely on local storage' },
          { imageId: id, status: 'QUEUED', message: 'Image queued for asynchronous validation' },
        ],
      })
      return transaction.imageAsset.findUnique({
        where: { id },
        include: { rejections: true },
      })
    })
    return serializeImage(image)
  } catch (error) {
    await removeStoredFile(existing.storageKey)
    throw error
  }
}

export async function getImageFile(id) {
  const image = await prisma.imageAsset.findFirst({ where: { id, deletedAt: null } })
  if (!image) throw new ApiError(404, 'IMAGE_NOT_FOUND', 'Image was not found')
  if (!['ACCEPTED', 'REJECTED'].includes(image.status)) {
    throw new ApiError(409, 'IMAGE_NOT_READY', 'Image processing has not completed')
  }
  const storageKey = image.convertedStorageKey || image.storageKey
  return {
    path: resolveStorageKey(storageKey),
    mimeType: image.convertedStorageKey ? 'image/jpeg' : image.mimeType,
  }
}

export async function listImages({ status, limit, cursor }) {
  const decodedCursor = decodeCursor(cursor)
  const cursorFilter = decodedCursor ? {
    OR: [
      { createdAt: { lt: decodedCursor.createdAt } },
      { createdAt: decodedCursor.createdAt, id: { lt: decodedCursor.id } },
    ],
  } : {}

  const images = await prisma.imageAsset.findMany({
    where: {
      deletedAt: null,
      ...(status ? { status } : {}),
      ...cursorFilter,
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    include: { rejections: { orderBy: { createdAt: 'asc' } } },
  })

  const hasMore = images.length > limit
  const page = hasMore ? images.slice(0, limit) : images

  return {
    data: page.map((image) => serializeImage(image)),
    pagination: {
      nextCursor: hasMore ? encodeCursor(page.at(-1)) : null,
      hasMore,
    },
  }
}

export async function getImage(id) {
  const image = await prisma.imageAsset.findFirst({
    where: { id, deletedAt: null },
    include: {
      rejections: { orderBy: { createdAt: 'asc' } },
      events: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!image) throw new ApiError(404, 'IMAGE_NOT_FOUND', 'Image was not found')
  return serializeImage(image, { includeEvents: true })
}

export async function updateImage(id, input) {
  const existing = await prisma.imageAsset.findFirst({ where: { id, deletedAt: null } })
  if (!existing) throw new ApiError(404, 'IMAGE_NOT_FOUND', 'Image was not found')
  assertExtensionMatches(input.originalFilename, existing.format)

  const image = await prisma.imageAsset.update({
    where: { id },
    data: { originalFilename: input.originalFilename },
    include: { rejections: { orderBy: { createdAt: 'asc' } } },
  })

  return serializeImage(image)
}

export async function deleteImage(id) {
  const existing = await prisma.imageAsset.findFirst({ where: { id, deletedAt: null } })
  if (!existing) throw new ApiError(404, 'IMAGE_NOT_FOUND', 'Image was not found')

  await prisma.$transaction([
    prisma.imageAsset.update({
      where: { id },
      data: { status: 'DELETED', deletedAt: new Date() },
    }),
    prisma.imageStatusEvent.create({
      data: { imageId: id, status: 'DELETED', message: 'Image metadata deleted' },
    }),
  ])

  await Promise.allSettled([
    removeStoredFile(existing.storageKey),
    removeStoredFile(existing.convertedStorageKey),
  ])
}
