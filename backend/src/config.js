import 'dotenv/config'
import path from 'node:path'
import { z } from 'zod'

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173'),
  STORAGE_ROOT: z.string().default('./storage'),
  MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(15 * 1024 * 1024),
  MIN_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(20 * 1024),
  MIN_IMAGE_DIMENSION: z.coerce.number().int().positive().default(600),
  SIMILARITY_HAMMING_THRESHOLD: z.coerce.number().int().min(0).max(64).default(6),
  BLUR_VARIANCE_THRESHOLD: z.coerce.number().positive().default(80),
  MIN_FACE_AREA_RATIO: z.coerce.number().min(0).max(1).default(0.08),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(100).default(1000),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
  PROCESSING_TIMEOUT_MINUTES: z.coerce.number().int().min(1).default(10),
})

const parsedEnvironment = environmentSchema.safeParse(process.env)

if (!parsedEnvironment.success) {
  console.error('Invalid environment configuration', parsedEnvironment.error.flatten().fieldErrors)
  throw new Error('Backend environment configuration is invalid')
}

export const config = Object.freeze({
  ...parsedEnvironment.data,
  STORAGE_ROOT: path.resolve(process.cwd(), parsedEnvironment.data.STORAGE_ROOT),
})
