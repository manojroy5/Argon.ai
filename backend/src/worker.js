import { setTimeout as delay } from 'node:timers/promises'
import { config } from './config.js'
import { disconnectDatabase } from './lib/database.js'
import { ensureStorageDirectories } from './lib/storage.js'
import { markProcessingFailed, processImage } from './processing/processor.js'
import { claimNextJob, recoverStaleJobs } from './processing/queue.js'

let shuttingDown = false

async function workerLoop(slot) {
  while (!shuttingDown) {
    let imageId
    try {
      imageId = await claimNextJob()
      if (!imageId) {
        await delay(config.WORKER_POLL_INTERVAL_MS)
        continue
      }
      console.log(`[worker:${slot}] processing ${imageId}`)
      await processImage(imageId)
      console.log(`[worker:${slot}] completed ${imageId}`)
    } catch (error) {
      if (imageId) await markProcessingFailed(imageId, error).catch(console.error)
      else console.error(`[worker:${slot}] queue error`, error)
      await delay(config.WORKER_POLL_INTERVAL_MS)
    }
  }
}

async function shutDown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`${signal} received, stopping worker after active jobs`)
}

process.on('SIGINT', () => shutDown('SIGINT'))
process.on('SIGTERM', () => shutDown('SIGTERM'))

await ensureStorageDirectories()
const recovered = await recoverStaleJobs()
console.log(`Argon AI worker started with ${config.WORKER_CONCURRENCY} slot(s); recovered ${recovered} stale job(s)`)
await Promise.all(Array.from({ length: config.WORKER_CONCURRENCY }, (_, index) => workerLoop(index + 1)))
await disconnectDatabase()
