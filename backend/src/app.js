import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { config } from './config.js'
import { errorHandler, notFound } from './middleware/error-handler.js'
import { requestId } from './middleware/request-id.js'
import { healthRouter } from './routes/health.js'
import { imagesRouter } from './routes/images.js'

export const app = express()

app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(requestId)
app.use(helmet())
app.use(cors({ origin: config.FRONTEND_ORIGIN, methods: ['GET', 'POST', 'PATCH', 'DELETE'] }))
app.use(express.json({ limit: '64kb', strict: true }))
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
}))

app.use('/api/health', healthRouter)
app.use('/api/v1/images', imagesRouter)

app.use(notFound)
app.use(errorHandler)
