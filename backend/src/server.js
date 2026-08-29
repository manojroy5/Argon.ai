import { app } from './app.js'
import { config } from './config.js'
import { disconnectDatabase } from './lib/database.js'

const server = app.listen(config.PORT, () => {
  console.log(`Argon AI API listening on http://localhost:${config.PORT}`)
})

async function shutDown(signal) {
  console.log(`${signal} received, shutting down`)
  server.close(async () => {
    await disconnectDatabase()
    process.exit(0)
  })
}

process.on('SIGINT', () => shutDown('SIGINT'))
process.on('SIGTERM', () => shutDown('SIGTERM'))
