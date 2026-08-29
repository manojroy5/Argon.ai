import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { fileTypeFromBuffer } from 'file-type'
import heicConvert from 'heic-convert'
import sharp from 'sharp'
import { config } from '../config.js'
import { prisma } from '../lib/database.js'
import { resolveStorageKey } from '../lib/storage.js'
import { detectFaces } from './faces.js'
import { calculateBlurVariance, createDifferenceHash, hammingDistance } from './metrics.js'

const ACCEPTED_SIGNATURES = new Map([
  ['image/jpeg', 'JPEG'],
  ['image/png', 'PNG'],
  ['image/heic', 'HEIC'],
  ['image/heif', 'HEIC'],
])

function rejection(code, message, details) {
  return { code, message, ...(details ? { details } : {}) }
}

async function rejectWithoutDecoding(image, reasons, detectedFormat) {
  await finishProcessing(image.id, {
    status: 'REJECTED',
    rejections: reasons,
    metadata: { detectedFormat },
  })
}

async function finishProcessing(imageId, result) {
  await prisma.$transaction(async (transaction) => {
    const current = await transaction.imageAsset.findUnique({ where: { id: imageId } })
    if (!current || current.status !== 'PROCESSING' || current.deletedAt) return
    await transaction.imageRejection.deleteMany({ where: { imageId } })
    if (result.rejections?.length) {
      await transaction.imageRejection.createMany({
        data: result.rejections.map((reason) => ({ imageId, ...reason })),
      })
    }
    await transaction.imageAsset.update({
      where: { id: imageId },
      data: {
        status: result.status,
        width: result.width,
        height: result.height,
        contentHash: result.contentHash,
        perceptualHash: result.perceptualHash,
        blurScore: result.blurScore,
        faceCount: result.faceCount,
        faceAreaRatio: result.faceAreaRatio,
        convertedStorageKey: result.convertedStorageKey,
        metadata: result.metadata,
        processedAt: new Date(),
      },
    })
    await transaction.imageStatusEvent.create({
      data: {
        imageId,
        status: result.status,
        message: result.status === 'ACCEPTED'
          ? 'Image passed all validation checks'
          : `Image rejected by ${result.rejections.length} validation check(s)`,
      },
    })
  })
}

export async function markProcessingFailed(imageId, error) {
  console.error(`Image ${imageId} processing failed`, error)
  await finishProcessing(imageId, {
    status: 'FAILED',
    rejections: [rejection('PROCESSING_ERROR', 'The image could not be processed safely')],
    metadata: { errorType: error?.name || 'Error' },
  })
}

export async function processImage(imageId) {
  const image = await prisma.imageAsset.findUnique({ where: { id: imageId } })
  if (!image || image.status !== 'PROCESSING' || image.deletedAt) return

  const originalBuffer = await readFile(resolveStorageKey(image.storageKey))
  const reasons = []
  if (originalBuffer.length < config.MIN_FILE_SIZE_BYTES) {
    reasons.push(rejection('TOO_SMALL_FILE', `Image must be at least ${config.MIN_FILE_SIZE_BYTES} bytes`, {
      actualBytes: originalBuffer.length,
      minimumBytes: config.MIN_FILE_SIZE_BYTES,
    }))
  }

  const signature = await fileTypeFromBuffer(originalBuffer)
  const detectedFormat = signature ? ACCEPTED_SIGNATURES.get(signature.mime) : null
  if (!detectedFormat || detectedFormat !== image.format) {
    reasons.push(rejection('INVALID_FORMAT', 'File contents do not match an allowed JPG, PNG, or HEIC format', {
      declaredFormat: image.format,
      detectedMimeType: signature?.mime || null,
    }))
    await rejectWithoutDecoding(image, reasons, signature?.mime || null)
    return
  }

  let decodableBuffer = originalBuffer
  if (detectedFormat === 'HEIC') {
    decodableBuffer = Buffer.from(await heicConvert({
      buffer: originalBuffer,
      format: 'JPEG',
      quality: 0.9,
    }))
  }

  const normalizedBuffer = await sharp(decodableBuffer)
    .rotate()
    .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer()
  const metadata = await sharp(normalizedBuffer).metadata()
  const width = metadata.width
  const height = metadata.height

  if (!width || !height || width < config.MIN_IMAGE_DIMENSION || height < config.MIN_IMAGE_DIMENSION) {
    reasons.push(rejection('TOO_SMALL_RESOLUTION', `Image resolution must be at least ${config.MIN_IMAGE_DIMENSION} × ${config.MIN_IMAGE_DIMENSION}`, {
      width: width || null,
      height: height || null,
      minimumDimension: config.MIN_IMAGE_DIMENSION,
    }))
  }

  const contentHash = createHash('sha256').update(originalBuffer).digest('hex')
  const perceptualHash = await createDifferenceHash(normalizedBuffer)
  const existingImages = await prisma.imageAsset.findMany({
    where: {
      id: { not: imageId },
      status: 'ACCEPTED',
      deletedAt: null,
      OR: [{ contentHash }, { perceptualHash: { not: null } }],
    },
    select: { id: true, contentHash: true, perceptualHash: true },
  })
  const closestImage = existingImages
    .map((candidate) => ({
      ...candidate,
      distance: candidate.contentHash === contentHash
        ? 0
        : hammingDistance(perceptualHash, candidate.perceptualHash),
    }))
    .sort((first, second) => first.distance - second.distance)[0]
  if (closestImage && closestImage.distance <= config.SIMILARITY_HAMMING_THRESHOLD) {
    reasons.push(rejection('TOO_SIMILAR', 'Image is too similar to an existing accepted image', {
      matchingImageId: closestImage.id,
      hammingDistance: closestImage.distance,
      maximumDistance: config.SIMILARITY_HAMMING_THRESHOLD,
    }))
  }

  const blurScore = await calculateBlurVariance(normalizedBuffer)
  if (blurScore < config.BLUR_VARIANCE_THRESHOLD) {
    reasons.push(rejection('BLURRY', 'Image appears blurry or out of focus', {
      score: blurScore,
      minimumScore: config.BLUR_VARIANCE_THRESHOLD,
    }))
  }

  const faceInput = await sharp(normalizedBuffer)
    .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const faces = await detectFaces(faceInput.data, faceInput.info.width, faceInput.info.height)
  const faceCount = faces.length
  const largestFaceRatio = faces.reduce((largest, face) => (
    Math.max(largest, (face.width * face.height) / (faceInput.info.width * faceInput.info.height))
  ), 0)

  if (faceCount === 0) {
    reasons.push(rejection('NO_FACE', 'No clear frontal face was detected'))
  } else if (faceCount > 1) {
    reasons.push(rejection('MULTIPLE_FACES', 'Image contains multiple faces', { faceCount }))
  } else if (largestFaceRatio < config.MIN_FACE_AREA_RATIO) {
    reasons.push(rejection('FACE_TOO_SMALL', 'The detected face is too small in the image', {
      faceAreaRatio: largestFaceRatio,
      minimumFaceAreaRatio: config.MIN_FACE_AREA_RATIO,
    }))
  }

  const convertedStorageKey = `processed/${imageId}.jpg`
  await writeFile(resolveStorageKey(convertedStorageKey), normalizedBuffer)

  await finishProcessing(imageId, {
    status: reasons.length ? 'REJECTED' : 'ACCEPTED',
    rejections: reasons,
    width,
    height,
    contentHash,
    perceptualHash,
    blurScore,
    faceCount,
    faceAreaRatio: largestFaceRatio,
    convertedStorageKey,
    metadata: {
      detectedMimeType: signature.mime,
      convertedFromHeic: detectedFormat === 'HEIC',
      normalizedMimeType: 'image/jpeg',
      faceDetector: 'OpenCV Haar cascade',
    },
  })
}
