import { Router } from 'express'
import { prisma } from '../lib/database.js'

export const healthRouter = Router()

healthRouter.get('/live', (_request, response) => {
  response.json({ status: 'ok', service: 'argon-ai-api' })
})

healthRouter.get('/ready', async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    response.json({ status: 'ready', database: 'connected' })
  } catch {
    response.status(503).json({ status: 'not_ready', database: 'unavailable' })
  }
})
