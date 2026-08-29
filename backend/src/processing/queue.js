import { Prisma } from '@prisma/client'
import { config } from '../config.js'
import { prisma } from '../lib/database.js'

export async function recoverStaleJobs() {
  const cutoff = new Date(Date.now() - (config.PROCESSING_TIMEOUT_MINUTES * 60_000))
  const stale = await prisma.imageAsset.findMany({
    where: { status: 'PROCESSING', updatedAt: { lt: cutoff }, deletedAt: null },
    select: { id: true },
  })
  if (!stale.length) return 0

  await prisma.$transaction(async (transaction) => {
    await transaction.imageAsset.updateMany({
      where: { id: { in: stale.map(({ id }) => id) }, status: 'PROCESSING' },
      data: { status: 'QUEUED' },
    })
    await transaction.imageStatusEvent.createMany({
      data: stale.map(({ id }) => ({
        imageId: id,
        status: 'QUEUED',
        message: 'Stale processing job recovered and requeued',
      })),
    })
  })
  return stale.length
}

export async function claimNextJob() {
  return prisma.$transaction(async (transaction) => {
    const rows = await transaction.$queryRaw`
      SELECT id
      FROM "ImageAsset"
      WHERE status = 'QUEUED'::"ImageStatus" AND "deletedAt" IS NULL
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `
    const imageId = rows[0]?.id
    if (!imageId) return null

    await transaction.imageAsset.update({
      where: { id: imageId },
      data: { status: 'PROCESSING' },
    })
    await transaction.imageStatusEvent.create({
      data: { imageId, status: 'PROCESSING', message: 'Worker started image validation' },
    })
    return imageId
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })
}
